// Statistiques de marché issues des ventes DVF (DGFiP), lues via la micro-API
// publique de cquest (https://github.com/cquest/dvf_as_api). L'instance est
// « sans garantie de disponibilité » : toute erreur renvoie simplement [],
// l'appelant décide alors de ne rien afficher.

import type { MarcheQuartier } from '~/types'

export interface VenteMarche {
  prixM2: number
  date: string
}

const API = 'https://api.cquest.org/dvf'

export const DIST_M = 500
export const SEUIL_VENTES = 3 // en dessous, parler de « marché » serait trompeur

const NB_BARRES = 8

// Plage de plausibilité d'un prix au m² : élimine les ventes symboliques à
// 1 €, les erreurs de surface et les biens atypiques (hôtels particuliers…).
const M2_MIN = 300
const M2_MAX = 60000

/** DVF livre les nombres en string avec virgule, en nombre, ou pas du tout. */
export function nombreDvf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const nettoye = v.replace(/\s/g, '').replace(',', '.')
  if (!nettoye) return null
  const n = Number(nettoye)
  return Number.isFinite(n) ? n : null
}

/** Transforme une feature GeoJSON en vente exploitable, ou null. */
export function venteDepuisFeature(f: any): VenteMarche | null {
  const p = f?.properties
  if (!p) return null
  // Ventes fermes uniquement : exclut échanges, adjudications, expropriations.
  // Garde le neuf (« Vente en l'état futur d'achèvement »).
  if (typeof p.nature_mutation !== 'string' || !p.nature_mutation.startsWith('Vente')) return null
  // On ne compare que des appartements, l'écrasante majorité des annonces suivies.
  if (p.type_local !== 'Appartement') return null

  const valeur = nombreDvf(p.valeur_fonciere)
  // Le millésime a corrigé la coquille historique du nom de champ.
  const surface = nombreDvf(p.surface_reelle_bati ?? p.surface_relle_batiment)
  if (!valeur || !surface || surface < 9 || surface > 500) return null

  const prixM2 = Math.round(valeur / surface)
  if (prixM2 < M2_MIN || prixM2 > M2_MAX) return null

  const date = typeof p.date_mutation === 'string' ? p.date_mutation : ''
  return { prixM2, date }
}

export function extraireVentes(json: any): VenteMarche[] {
  if (!Array.isArray(json?.features)) return []
  return json.features
    .map(venteDepuisFeature)
    .filter((v: VenteMarche | null): v is VenteMarche => v != null)
}

export async function ventesProches(lat: number, lon: number, dist = DIST_M): Promise<VenteMarche[]> {
  const url = new URL(API)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('dist', String(dist))
  url.searchParams.set('nature_mutation', 'Vente')
  url.searchParams.set('type_local', 'Appartement')

  let json: any
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return []
    json = await res.json()
  } catch {
    return []
  }
  return extraireVentes(json)
}

function percentile(tries: number[], p: number): number {
  const idx = (tries.length - 1) * p
  const bas = Math.floor(idx)
  const haut = Math.ceil(idx)
  if (bas === haut) return tries[bas]!
  return Math.round(tries[bas]! + (tries[haut]! - tries[bas]!) * (idx - bas))
}

/** Statistiques sur les prix au m², ou null si l'échantillon est trop faible. */
export function statistiquesMarche(ventes: VenteMarche[]): MarcheQuartier | null {
  if (ventes.length < SEUIL_VENTES) return null

  const prix = ventes.map((v) => v.prixM2).sort((a, b) => a - b)
  const min = prix[0]!
  const max = prix[prix.length - 1]!

  const barres = new Array<number>(NB_BARRES).fill(0)
  for (const p of prix) {
    const i = Math.min(NB_BARRES - 1, Math.floor(((p - min) / (max - min || 1)) * NB_BARRES))
    barres[i]!++
  }

  const dates = ventes.map((v) => v.date).filter(Boolean).sort()

  return {
    mediane: percentile(prix, 0.5),
    q1: percentile(prix, 0.25),
    q3: percentile(prix, 0.75),
    min,
    max,
    nbVentes: prix.length,
    barres,
    du: dates[0] ?? '',
    au: dates[dates.length - 1] ?? '',
    maj: new Date().toISOString()
  }
}

/** Clé de cache : maille d'environ 1 km, le marché ne varie pas à l'échelle de la rue. */
export function cleCache(lat: number, lon: number): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

import type { ModeTrajet } from '~/types'

/**
 * Temps de trajet.
 * - voiture / vélo / marche : OpenRouteService (matrice, une requête pour N biens).
 * - transports en commun : Navitia (un itinéraire par bien, pas de matrice).
 * Chaque source est optionnelle : sans clé, le mode est simplement indisponible.
 */

export interface Point {
  lat: number
  lon: number
}

export interface Duree {
  duree_s: number | null
  distance_m: number | null
}

const PROFILS_ORS: Record<Exclude<ModeTrajet, 'transport'>, string> = {
  voiture: 'driving-car',
  velo: 'cycling-regular',
  marche: 'foot-walking'
}

/** Au-delà, ORS refuse la matrice : on découpe les biens par paquets. */
export const MAX_ORIGINES = 40

/** Requêtes Navitia menées de front : on reste poli avec l'API. */
export const CONCURRENCE_TRANSPORT = 4

export function routageDisponible(mode?: ModeTrajet): boolean {
  if (mode === 'transport') return !!process.env.NAVITIA_TOKEN
  if (mode) return !!process.env.ORS_API_KEY
  return !!process.env.ORS_API_KEY || !!process.env.NAVITIA_TOKEN
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
}

export function paquets<T>(liste: T[], taille = MAX_ORIGINES): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

/* ---------- Voiture / vélo / marche : OpenRouteService ---------- */

async function matriceOrs(
  origines: Point[],
  ancre: Point,
  mode: Exclude<ModeTrajet, 'transport'>
): Promise<Duree[]> {
  const cle = process.env.ORS_API_KEY
  if (!cle) throw createError({ statusCode: 503, statusMessage: 'ORS_API_KEY absente' })

  // ORS attend [lon, lat]. L'ancre est la dernière position, seule destination.
  const locations = [...origines.map((o) => [o.lon, o.lat]), [ancre.lon, ancre.lat]]

  const reponse = await $fetch<{ durations?: number[][]; distances?: number[][] }>(
    `https://api.openrouteservice.org/v2/matrix/${PROFILS_ORS[mode]}`,
    {
      method: 'POST',
      headers: { Authorization: cle, 'Content-Type': 'application/json' },
      body: {
        locations,
        sources: origines.map((_, i) => i),
        destinations: [origines.length],
        metrics: ['duration', 'distance']
      }
    }
  )

  return origines.map((_, i) => ({
    duree_s: nombreOuNull(reponse.durations?.[i]?.[0]),
    distance_m: nombreOuNull(reponse.distances?.[i]?.[0])
  }))
}

/* ---------- Transports en commun : Navitia ---------- */

export interface ReponseNavitia {
  journeys?: { duration?: number; nb_transfers?: number; type?: string }[]
}

/**
 * Un horaire de référence est obligatoire : un trajet en transports ne dure pas
 * la même chose à 8 h qu'à 3 h du matin. On prend le prochain mardi 8 h 30.
 */
export function prochainMardi8h30(maintenant = new Date()): string {
  const d = new Date(maintenant)
  const versMardi = (2 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + versMardi)
  d.setHours(8, 30, 0, 0)

  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

/** Retient le meilleur itinéraire réellement praticable. */
export function dureeDepuisJourneys(reponse: ReponseNavitia): number | null {
  const utiles = (reponse.journeys ?? []).filter(
    (j) => typeof j.duration === 'number' && j.duration > 0 && j.type !== 'non_pt_walk'
  )
  if (!utiles.length) return null
  return Math.round(Math.min(...utiles.map((j) => j.duration!)))
}

async function itineraireNavitia(origine: Point, ancre: Point, datetime: string): Promise<Duree> {
  const token = process.env.NAVITIA_TOKEN
  if (!token) throw createError({ statusCode: 503, statusMessage: 'NAVITIA_TOKEN absent' })

  const url = new URL('https://api.navitia.io/v1/journeys')
  url.searchParams.set('from', `${origine.lon};${origine.lat}`)
  url.searchParams.set('to', `${ancre.lon};${ancre.lat}`)
  url.searchParams.set('datetime', datetime)
  url.searchParams.set('datetime_represents', 'departure')
  url.searchParams.set('max_nb_journeys', '1')

  try {
    const reponse = await $fetch<ReponseNavitia>(url.toString(), {
      headers: { Authorization: token }
    })
    // Hors zone couverte ou aucune solution : pas d'erreur, juste pas de trajet.
    return { duree_s: dureeDepuisJourneys(reponse), distance_m: null }
  } catch {
    return { duree_s: null, distance_m: null }
  }
}

async function itinerairesNavitia(origines: Point[], ancre: Point): Promise<Duree[]> {
  const datetime = prochainMardi8h30()
  const resultats: Duree[] = []

  for (const lot of paquets(origines, CONCURRENCE_TRANSPORT)) {
    resultats.push(...(await Promise.all(lot.map((o) => itineraireNavitia(o, ancre, datetime)))))
  }

  return resultats
}

/* ---------- Point d'entrée ---------- */

/**
 * Une origine par bien, une seule destination (l'ancre).
 * Renvoie un tableau aligné sur `origines` ; un trajet impossible vaut null.
 */
export async function dureesVersAncre(
  origines: Point[],
  ancre: Point,
  mode: ModeTrajet
): Promise<Duree[]> {
  if (origines.length === 0) return []
  if (mode === 'transport') return itinerairesNavitia(origines, ancre)
  return matriceOrs(origines, ancre, mode)
}

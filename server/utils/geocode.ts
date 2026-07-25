import type { GeoPrecision } from '~/types'

export interface Localisation {
  lat: number
  lon: number
  precision: GeoPrecision
  label: string
}

export interface AdresseBien {
  adresse?: string | null
  ville?: string | null
  code_postal?: string | null
}

const BAN = 'https://api-adresse.data.gouv.fr/search/'

const PRECISIONS: Record<string, GeoPrecision> = {
  housenumber: 'exacte',
  street: 'rue',
  locality: 'ville',
  municipality: 'ville'
}

async function interroger(params: Record<string, string>): Promise<Localisation | null> {
  const url = new URL(BAN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  let json: any
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    json = await res.json()
  } catch {
    return null
  }

  const f = json?.features?.[0]
  const coords = f?.geometry?.coordinates
  const precision = PRECISIONS[f?.properties?.type]
  if (!precision || !Array.isArray(coords) || coords.length < 2) return null
  if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null

  return { lat: coords[1], lon: coords[0], precision, label: f.properties.label ?? '' }
}

export async function geocoder(bien: AdresseBien): Promise<Localisation | null> {
  const cp = bien.code_postal?.trim() || ''
  const requete = [bien.adresse, bien.ville].filter(Boolean).join(' ').trim()

  if (requete) {
    const params: Record<string, string> = { q: requete, limit: '1' }
    if (cp) params.postcode = cp
    const trouve = await interroger(params)
    if (trouve) return trouve
  }

  if (/^\d{5}$/.test(cp)) {
    return await interroger({ q: cp, type: 'municipality', limit: '1' })
  }

  return null
}

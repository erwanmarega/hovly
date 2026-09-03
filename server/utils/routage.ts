import type { TravelMode } from '~/types'

export interface Point {
  lat: number
  lon: number
}

export interface Duration {
  duree_s: number | null
  distance_m: number | null
}

const ORS_PROFILES: Record<Exclude<TravelMode, 'transport'>, string> = {
  voiture: 'driving-car',
  velo: 'cycling-regular',
  marche: 'foot-walking'
}

export const MAX_ORIGINS = 40

export const TRANSIT_CONCURRENCY = 2

export function routingAvailable(mode?: TravelMode): boolean {
  if (mode === 'transport') return true
  if (mode) return !!process.env.ORS_API_KEY
  return true
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
}

export function batches<T>(liste: T[], taille = MAX_ORIGINS): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

async function orsMatrix(
  origines: Point[],
  ancre: Point,
  mode: Exclude<TravelMode, 'transport'>
): Promise<Duration[]> {
  const cle = process.env.ORS_API_KEY
  if (!cle) throw createError({ statusCode: 503, statusMessage: 'ORS_API_KEY absente' })

  const locations = [...origines.map((o) => [o.lon, o.lat]), [ancre.lon, ancre.lat]]

  const reponse = await $fetch<{ durations?: number[][]; distances?: number[][] }>(
    `https://api.openrouteservice.org/v2/matrix/${ORS_PROFILES[mode]}`,
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
    duree_s: numberOrNull(reponse.durations?.[i]?.[0]),
    distance_m: numberOrNull(reponse.distances?.[i]?.[0])
  }))
}

const TRANSITOUS = 'https://api.transitous.org/api/v1/plan'

const UA_TRANSITOUS = 'Hovly/1.0 (+https://hovly.app; contact@hovly.app)'

const TIMEZONE = 'Europe/Paris'

export interface TransitousResponse {
  itineraries?: { duration?: number; transfers?: number; legs?: { mode?: string }[] }[]
}

const NON_TRANSIT_MODES = new Set(['WALK', 'BIKE', 'CAR', 'CAR_PARKING', 'RENTAL', 'ODM', 'FLEX'])

function usesTransit(legs?: { mode?: string }[]): boolean {
  if (!legs?.length) return true
  return legs.some((l) => !!l.mode && !NON_TRANSIT_MODES.has(l.mode))
}

export function durationFromItineraries(reponse: TransitousResponse): number | null {
  const utiles = (reponse.itineraries ?? []).filter(
    (i) => typeof i.duration === 'number' && i.duration > 0 && usesTransit(i.legs)
  )
  if (!utiles.length) return null
  return Math.round(Math.min(...utiles.map((i) => i.duration!)))
}

function parisOffset(d: Date): string {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  const offset = nom?.replace('GMT', '') ?? ''
  return offset || '+00:00'
}

function parisDay(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  }).formatToParts(d)

  const champ = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    annee: Number(champ('year')),
    mois: Number(champ('month')),
    jour: Number(champ('day')),
    semaine: JOURS.indexOf(champ('weekday'))
  }
}

export function nextTuesday830(maintenant = new Date()): string {
  const { annee, mois, jour, semaine } = parisDay(maintenant)
  const versMardi = (2 - semaine + 7) % 7 || 7

  const cible = new Date(Date.UTC(annee, mois - 1, jour + versMardi, 12))

  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${cible.getUTCFullYear()}-${p(cible.getUTCMonth() + 1)}-${p(cible.getUTCDate())}`
  return `${date}T08:30:00${parisOffset(cible)}`
}

async function transitousItinerary(origine: Point, ancre: Point, time: string): Promise<Duration> {
  const url = new URL(TRANSITOUS)
  url.searchParams.set('fromPlace', `${origine.lat},${origine.lon}`)
  url.searchParams.set('toPlace', `${ancre.lat},${ancre.lon}`)
  url.searchParams.set('time', time)
  url.searchParams.set('arriveBy', 'false')
  url.searchParams.set('numItineraries', '2')

  try {
    const reponse = await $fetch<TransitousResponse>(url.toString(), {
      headers: { 'User-Agent': UA_TRANSITOUS }
    })
    return { duree_s: durationFromItineraries(reponse), distance_m: null }
  } catch {
    return { duree_s: null, distance_m: null }
  }
}

async function transitousItineraries(origines: Point[], ancre: Point): Promise<Duration[]> {
  const time = nextTuesday830()
  const resultats: Duration[] = []

  for (const lot of batches(origines, TRANSIT_CONCURRENCY)) {
    resultats.push(...(await Promise.all(lot.map((o) => transitousItinerary(o, ancre, time)))))
  }

  return resultats
}

export async function durationsToAnchor(
  origines: Point[],
  ancre: Point,
  mode: TravelMode
): Promise<Duration[]> {
  if (origines.length === 0) return []
  if (mode === 'transport') return transitousItineraries(origines, ancre)
  return orsMatrix(origines, ancre, mode)
}

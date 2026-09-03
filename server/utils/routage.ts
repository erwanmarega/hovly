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

export function batches<T>(list: T[], size = MAX_ORIGINS): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function orsMatrix(
  origins: Point[],
  anchor: Point,
  mode: Exclude<TravelMode, 'transport'>
): Promise<Duration[]> {
  const apiKey = process.env.ORS_API_KEY
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'ORS_API_KEY absente' })

  const locations = [...origins.map((o) => [o.lon, o.lat]), [anchor.lon, anchor.lat]]

  const response = await $fetch<{ durations?: number[][]; distances?: number[][] }>(
    `https://api.openrouteservice.org/v2/matrix/${ORS_PROFILES[mode]}`,
    {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: {
        locations,
        sources: origins.map((_, i) => i),
        destinations: [origins.length],
        metrics: ['duration', 'distance']
      }
    }
  )

  return origins.map((_, i) => ({
    duree_s: numberOrNull(response.durations?.[i]?.[0]),
    distance_m: numberOrNull(response.distances?.[i]?.[0])
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

export function durationFromItineraries(response: TransitousResponse): number | null {
  const valid = (response.itineraries ?? []).filter(
    (i) => typeof i.duration === 'number' && i.duration > 0 && usesTransit(i.legs)
  )
  if (!valid.length) return null
  return Math.round(Math.min(...valid.map((i) => i.duration!)))
}

function parisOffset(d: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  const offset = name?.replace('GMT', '') ?? ''
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

  const field = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    year: Number(field('year')),
    month: Number(field('month')),
    day: Number(field('day')),
    weekday: DAYS.indexOf(field('weekday'))
  }
}

export function nextTuesday830(now = new Date()): string {
  const { year, month, day, weekday } = parisDay(now)
  const toTuesday = (2 - weekday + 7) % 7 || 7

  const target = new Date(Date.UTC(year, month - 1, day + toTuesday, 12))

  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${target.getUTCFullYear()}-${p(target.getUTCMonth() + 1)}-${p(target.getUTCDate())}`
  return `${date}T08:30:00${parisOffset(target)}`
}

async function transitousItinerary(origin: Point, anchor: Point, time: string): Promise<Duration> {
  const url = new URL(TRANSITOUS)
  url.searchParams.set('fromPlace', `${origin.lat},${origin.lon}`)
  url.searchParams.set('toPlace', `${anchor.lat},${anchor.lon}`)
  url.searchParams.set('time', time)
  url.searchParams.set('arriveBy', 'false')
  url.searchParams.set('numItineraries', '2')

  try {
    const response = await $fetch<TransitousResponse>(url.toString(), {
      headers: { 'User-Agent': UA_TRANSITOUS }
    })
    return { duree_s: durationFromItineraries(response), distance_m: null }
  } catch {
    return { duree_s: null, distance_m: null }
  }
}

async function transitousItineraries(origins: Point[], anchor: Point): Promise<Duration[]> {
  const time = nextTuesday830()
  const results: Duration[] = []

  for (const batch of batches(origins, TRANSIT_CONCURRENCY)) {
    results.push(...(await Promise.all(batch.map((o) => transitousItinerary(o, anchor, time)))))
  }

  return results
}

export async function durationsToAnchor(
  origins: Point[],
  anchor: Point,
  mode: TravelMode
): Promise<Duration[]> {
  if (origins.length === 0) return []
  if (mode === 'transport') return transitousItineraries(origins, anchor)
  return orsMatrix(origins, anchor, mode)
}

import type { ModeTrajet } from '~/types'

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

export const MAX_ORIGINES = 40

export const CONCURRENCE_TRANSPORT = 2

export function routageDisponible(mode?: ModeTrajet): boolean {
  if (mode === 'transport') return true
  if (mode) return !!process.env.ORS_API_KEY
  return true
}

function nombreOuNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null
}

export function paquets<T>(liste: T[], taille = MAX_ORIGINES): T[][] {
  const out: T[][] = []
  for (let i = 0; i < liste.length; i += taille) out.push(liste.slice(i, i + taille))
  return out
}

async function matriceOrs(
  origines: Point[],
  ancre: Point,
  mode: Exclude<ModeTrajet, 'transport'>
): Promise<Duree[]> {
  const cle = process.env.ORS_API_KEY
  if (!cle) throw createError({ statusCode: 503, statusMessage: 'ORS_API_KEY absente' })

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

const TRANSITOUS = 'https://api.transitous.org/api/v1/plan'

const UA_TRANSITOUS = 'Hovly/1.0 (+https://hovly.app; contact@hovly.app)'

const FUSEAU = 'Europe/Paris'

export interface ReponseTransitous {
  itineraries?: { duration?: number; transfers?: number; legs?: { mode?: string }[] }[]
}

const MODES_HORS_TC = new Set(['WALK', 'BIKE', 'CAR', 'CAR_PARKING', 'RENTAL', 'ODM', 'FLEX'])

function utiliseTransport(legs?: { mode?: string }[]): boolean {
  if (!legs?.length) return true
  return legs.some((l) => !!l.mode && !MODES_HORS_TC.has(l.mode))
}

export function dureeDepuisItineraires(reponse: ReponseTransitous): number | null {
  const utiles = (reponse.itineraries ?? []).filter(
    (i) => typeof i.duration === 'number' && i.duration > 0 && utiliseTransport(i.legs)
  )
  if (!utiles.length) return null
  return Math.round(Math.min(...utiles.map((i) => i.duration!)))
}

function offsetParis(d: Date): string {
  const nom = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, timeZoneName: 'longOffset' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value
  const offset = nom?.replace('GMT', '') ?? ''
  return offset || '+00:00'
}

function jourParis(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU,
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

export function prochainMardi8h30(maintenant = new Date()): string {
  const { annee, mois, jour, semaine } = jourParis(maintenant)
  const versMardi = (2 - semaine + 7) % 7 || 7

  const cible = new Date(Date.UTC(annee, mois - 1, jour + versMardi, 12))

  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${cible.getUTCFullYear()}-${p(cible.getUTCMonth() + 1)}-${p(cible.getUTCDate())}`
  return `${date}T08:30:00${offsetParis(cible)}`
}

async function itineraireTransitous(origine: Point, ancre: Point, time: string): Promise<Duree> {
  const url = new URL(TRANSITOUS)
  url.searchParams.set('fromPlace', `${origine.lat},${origine.lon}`)
  url.searchParams.set('toPlace', `${ancre.lat},${ancre.lon}`)
  url.searchParams.set('time', time)
  url.searchParams.set('arriveBy', 'false')
  url.searchParams.set('numItineraries', '2')

  try {
    const reponse = await $fetch<ReponseTransitous>(url.toString(), {
      headers: { 'User-Agent': UA_TRANSITOUS }
    })
    return { duree_s: dureeDepuisItineraires(reponse), distance_m: null }
  } catch {
    return { duree_s: null, distance_m: null }
  }
}

async function itinerairesTransitous(origines: Point[], ancre: Point): Promise<Duree[]> {
  const time = prochainMardi8h30()
  const resultats: Duree[] = []

  for (const lot of paquets(origines, CONCURRENCE_TRANSPORT)) {
    resultats.push(...(await Promise.all(lot.map((o) => itineraireTransitous(o, ancre, time)))))
  }

  return resultats
}

export async function dureesVersAncre(
  origines: Point[],
  ancre: Point,
  mode: ModeTrajet
): Promise<Duree[]> {
  if (origines.length === 0) return []
  if (mode === 'transport') return itinerairesTransitous(origines, ancre)
  return matriceOrs(origines, ancre, mode)
}

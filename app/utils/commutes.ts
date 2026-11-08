import type { Anchor, TravelMode, Commute } from '~/types'

export const MODE_LABELS: Record<TravelMode, string> = {
  voiture: 'en voiture',
  velo: 'à vélo',
  marche: 'à pied',
  transport: 'en transports'
}

export interface CommuteDisplay {
  ancre: Anchor
  duree_s: number | null
  distance_m: number | null
  depasse: boolean
  calcule: boolean
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  return `${h} h ${String(minutes % 60).padStart(2, '0')}`
}

export function formatDistance(meters: number | null): string {
  if (meters == null) return '—'
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

export const commuteKey = (bienId: string, ancreId: string, mode: string) =>
  `${bienId}|${ancreId}|${mode}`

export function indexCommutes(trajets: Commute[]): Map<string, Commute> {
  return new Map(trajets.map((t) => [commuteKey(t.bien_id, t.ancre, t.mode), t]))
}

export function propertyCommutes(
  bienId: string,
  ancres: Anchor[],
  index: Map<string, Commute>
): CommuteDisplay[] {
  return ancres.map((ancre) => {
    const t = index.get(commuteKey(bienId, ancre.id, ancre.mode))
    const duration = t?.duree_s ?? null
    return {
      ancre,
      duree_s: duration,
      distance_m: t?.distance_m ?? null,
      depasse: duration != null && ancre.maxMinutes != null && duration > ancre.maxMinutes * 60,
      calcule: !!t
    }
  })
}

export function longestCommute(list: CommuteDisplay[]): CommuteDisplay | null {
  const completed = list.filter((t) => t.duree_s != null)
  if (!completed.length) return null
  return completed.reduce((worst, t) => (t.duree_s! > worst.duree_s! ? t : worst))
}

export function commuteForAnchor(list: CommuteDisplay[], ancreId: string): CommuteDisplay | null {
  const t = list.find((x) => x.ancre.id === ancreId)
  return t && t.duree_s != null ? t : null
}

export function selectedCommute(list: CommuteDisplay[], ancreId: string | null): CommuteDisplay | null {
  return ancreId ? commuteForAnchor(list, ancreId) : longestCommute(list)
}

export function exceededCount(list: CommuteDisplay[]): number {
  return list.filter((t) => t.depasse).length
}

export type ModesState = Record<TravelMode, boolean>

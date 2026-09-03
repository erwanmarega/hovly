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

export function formatDuration(secondes: number | null): string {
  if (secondes == null) return '—'
  const minutes = Math.round(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  return `${h} h ${String(minutes % 60).padStart(2, '0')}`
}

export function formatDistance(metres: number | null): string {
  if (metres == null) return '—'
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1).replace('.', ',')} km`
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
    const duree = t?.duree_s ?? null
    return {
      ancre,
      duree_s: duree,
      distance_m: t?.distance_m ?? null,
      depasse: duree != null && ancre.maxMinutes != null && duree > ancre.maxMinutes * 60,
      calcule: !!t
    }
  })
}

export function longestCommute(liste: CommuteDisplay[]): CommuteDisplay | null {
  const calcules = liste.filter((t) => t.duree_s != null)
  if (!calcules.length) return null
  return calcules.reduce((pire, t) => (t.duree_s! > pire.duree_s! ? t : pire))
}

export function commuteForAnchor(liste: CommuteDisplay[], ancreId: string): CommuteDisplay | null {
  const t = liste.find((x) => x.ancre.id === ancreId)
  return t && t.duree_s != null ? t : null
}

export function selectedCommute(liste: CommuteDisplay[], ancreId: string | null): CommuteDisplay | null {
  return ancreId ? commuteForAnchor(liste, ancreId) : longestCommute(liste)
}

export function exceededCount(liste: CommuteDisplay[]): number {
  return liste.filter((t) => t.depasse).length
}

export type ModesState = Record<TravelMode, boolean>

const DISPLAYED_ANCHOR_KEY = 'hovly:trajet-ancre'

export function useCommutes() {
  const { preferences } = usePreferences()

  const commutes = useState<Commute[]>('trajets', () => [])
  const calculating = useState('trajets-calcul', () => false)
  const error = useState('trajets-erreur', () => '')
  const modesState = useState<ModesState | null>('trajets-etat', () => null)

  const index = computed(() => indexCommutes(commutes.value))
  const ancres = computed(() => preferences.value.ancres)
  const active = computed(() => ancres.value.length > 0)

  const displayedAnchor = useState<string | null>('trajets-ancre-affichee', () => null)
  const anchorHydrated = useState('trajets-ancre-hydratee', () => false)

  if (import.meta.client && !anchorHydrated.value) {
    anchorHydrated.value = true
    displayedAnchor.value = localStorage.getItem(DISPLAYED_ANCHOR_KEY) || null
  }

  const selectedAnchor = computed(
    () => ancres.value.find((a) => a.id === displayedAnchor.value) ?? null
  )

  function selectAnchor(id: string | null) {
    displayedAnchor.value = id
    if (!import.meta.client) return
    if (id) localStorage.setItem(DISPLAYED_ANCHOR_KEY, id)
    else localStorage.removeItem(DISPLAYED_ANCHOR_KEY)
  }

  const isAvailable = (mode: TravelMode) => modesState.value?.[mode] !== false

  const calculable = computed(() => ancres.value.some((a) => isAvailable(a.mode)))

  async function loadModesState() {
    if (modesState.value) return
    try {
      modesState.value = await $fetch<ModesState>('/api/trajets/etat')
    } catch {
    }
  }

  async function refresh() {
    await loadModesState()
    commutes.value = await $fetch<Commute[]>('/api/trajets')
  }

  const forProperty = (bienId: string) => propertyCommutes(bienId, ancres.value, index.value)

  const selected = (bienId: string) => selectedCommute(forProperty(bienId), selectedAnchor.value?.id ?? null)

  async function calculate(): Promise<boolean> {
    calculating.value = true
    error.value = ''
    try {
      await $fetch('/api/trajets/calculer', {
        method: 'POST',
        body: { ancres: ancres.value }
      })
      await refresh()
      return true
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Calcul impossible')
      return false
    } finally {
      calculating.value = false
    }
  }

  return {
    commutes,
    ancres,
    active,
    calculable,
    isAvailable,
    modesState,
    calculating,
    error,
    refresh,
    loadModesState,
    calculate,
    forProperty,
    selected,
    selectedAnchor,
    selectAnchor
  }
}

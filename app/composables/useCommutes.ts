import type { Commute, TravelMode } from '~/types'
import { indexCommutes, propertyCommutes, selectedCommute, type ModesState } from '~/utils/commutes'

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

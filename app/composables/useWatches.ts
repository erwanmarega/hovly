import type { Property, ResultState, SavedSearch, WatchResult } from '~/types'

export interface ScanSummary {
  recherche_id: string
  label: string
  trouvees: number
  filtrees: number
  connues: number
  nouvelles: WatchResult[]
  erreur: string | null
}

/** Le champ `prix` d'un bien est en centimes ; les filtres d'une veille suivent la même unité. */
export const toCents = (euros: number | null) =>
  euros == null || !Number.isFinite(euros) ? null : Math.round(euros * 100)

export const toEuros = (centimes: number | null) =>
  centimes == null ? null : Math.round(centimes / 100)

export function useWatches() {
  const searches = useState<SavedSearch[]>('recherches', () => [])
  const results = useState<Record<string, WatchResult[]>>('veille-resultats', () => ({}))

  const newCount = computed(() =>
    searches.value.reduce((total, r) => total + (r.nouveaux ?? 0), 0)
  )

  function updateCounter(searchId: string, delta: number) {
    const r = searches.value.find((x) => x.id === searchId)
    if (r) r.nouveaux = Math.max(0, (r.nouveaux ?? 0) + delta)
  }

  async function refresh() {
    searches.value = await $fetch<SavedSearch[]>('/api/recherches')
    return searches.value
  }

  async function create(payload: Partial<SavedSearch>): Promise<SavedSearch> {
    const row = await $fetch<SavedSearch>('/api/recherches', { method: 'POST', body: payload })
    searches.value = [{ ...row, nouveaux: 0 }, ...searches.value]
    return row
  }

  async function update(id: string, patch: Partial<SavedSearch>) {
    const r = searches.value.find((x) => x.id === id)
    const before = r ? { ...r } : null
    if (r) Object.assign(r, patch)
    try {
      await $fetch(`/api/recherches/${id}`, { method: 'PATCH', body: patch })
    } catch (e) {
      if (r && before) Object.assign(r, before)
      throw e
    }
  }

  async function remove(id: string) {
    const snapshot = searches.value
    searches.value = searches.value.filter((x) => x.id !== id)
    try {
      await $fetch(`/api/recherches/${id}`, { method: 'DELETE' })
      const { [id]: _removed, ...rest } = results.value
      results.value = rest
    } catch (e) {
      searches.value = snapshot
      throw e
    }
  }

  async function scan(id: string): Promise<ScanSummary> {
    const summary = await $fetch<ScanSummary>(`/api/recherches/${id}/scan`, { method: 'POST' })

    const r = searches.value.find((x) => x.id === id)
    if (r) {
      r.derniere_verif = new Date().toISOString()
      r.derniere_erreur = null
      r.echecs_consecutifs = 0
      r.nouveaux = (r.nouveaux ?? 0) + summary.nouvelles.length
    }
    if (summary.nouvelles.length) {
      results.value[id] = [...summary.nouvelles, ...(results.value[id] ?? [])]
    }
    return summary
  }

  async function loadResults(id: string, etat?: ResultState) {
    const list = await $fetch<WatchResult[]>(`/api/recherches/${id}/resultats`, {
      query: etat ? { etat } : undefined
    })
    results.value[id] = list
    return list
  }

  function removeResult(searchId: string, resultId: string) {
    const list = results.value[searchId]
    if (list) results.value[searchId] = list.filter((r) => r.id !== resultId)
  }

  async function ignore(searchId: string, resultId: string) {
    await $fetch(`/api/resultats/${resultId}`, { method: 'PATCH', body: { etat: 'ignore' } })
    removeResult(searchId, resultId)
    updateCounter(searchId, -1)
  }

  /** Scrape la fiche complète et crée le bien. Plus lent qu'« ignorer » : prévoir un état de chargement. */
  async function keep(searchId: string, resultId: string): Promise<Property> {
    const { bien } = await $fetch<{ bien: Property }>(`/api/resultats/${resultId}`, {
      method: 'PATCH',
      body: { etat: 'garde' }
    })
    removeResult(searchId, resultId)
    updateCounter(searchId, -1)
    return bien
  }

  return {
    searches,
    results,
    newCount,
    refresh,
    create,
    update,
    remove,
    scan,
    loadResults,
    keep,
    ignore
  }
}

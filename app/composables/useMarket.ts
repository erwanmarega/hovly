import type { Property, NeighborhoodMarket } from '~/types'
import { looksLikeSale } from '~/utils/market'

export function useMarket() {
  // bien_id → statistiques, null quand DVF n'a rien d'exploitable
  const markets = useState<Record<string, NeighborhoodMarket | null>>('neighborhood-market', () => ({}))
  const requests = useState<Record<string, boolean>>('neighborhood-market-requests', () => ({}))

  async function load(bien: Property): Promise<void> {
    if (!looksLikeSale(bien) || bien.lat == null || bien.lon == null) return
    if (bien.id in markets.value || requests.value[bien.id]) return
    requests.value = { ...requests.value, [bien.id]: true }
    try {
      const { market } = await $fetch<{ market: NeighborhoodMarket | null }>('/api/dvf', {
        query: { lat: bien.lat, lon: bien.lon, type: bien.type_bien ?? 'appartement' }
      })
      markets.value = { ...markets.value, [bien.id]: market }
    } catch {
      markets.value = { ...markets.value, [bien.id]: null }
    } finally {
      requests.value = { ...requests.value, [bien.id]: false }
    }
  }

  function loadAll(biens: Property[]) {
    for (const b of biens) void load(b)
  }

  const get = (bienId: string): NeighborhoodMarket | null => markets.value[bienId] ?? null

  return { markets, load, loadAll, get }
}

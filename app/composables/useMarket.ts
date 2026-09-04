import type { Property, NeighborhoodMarket, Transaction } from '~/types'
import { SALE_PRICE_THRESHOLD_EUROS } from '~/types'

/**
 * Un bien est comparable aux ventes DVF s'il s'agit d'un achat. Le repli sur
 * le prix couvre les fiches créées avant l'existence du champ `transaction`.
 */
export function looksLikeSale(bien: Pick<Property, 'prix'> & { transaction?: Transaction }): boolean {
  if (bien.transaction) return bien.transaction === 'achat'
  return !!bien.prix && bien.prix / 100 >= SALE_PRICE_THRESHOLD_EUROS
}

export function pricePerSqm(bien: Pick<Property, 'prix' | 'surface'>): number | null {
  return bien.prix && bien.surface ? Math.round(bien.prix / 100 / bien.surface) : null
}

/** Écart en % entre un prix au m² et la médiane du marché (négatif = sous le marché). */
export function gapPercent(prixM2: number, market: NeighborhoodMarket): number {
  return Math.round(((prixM2 - market.mediane) / market.mediane) * 100)
}

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

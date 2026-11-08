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

import type { Property, NeighborhoodMarket, Transaction } from '~/types'
import { SALE_PRICE_THRESHOLD_EUROS } from '~/types'

export { SALE_PRICE_THRESHOLD_EUROS as SEUIL_PRIX_VENTE }

/**
 * Un bien est comparable aux ventes DVF s'il s'agit d'un achat. Le repli sur
 * le prix couvre les fiches créées avant l'existence du champ `transaction`.
 */
export function ressembleVente(bien: Pick<Property, 'prix'> & { transaction?: Transaction }): boolean {
  if (bien.transaction) return bien.transaction === 'achat'
  return !!bien.prix && bien.prix / 100 >= SALE_PRICE_THRESHOLD_EUROS
}

export function prixAuM2(bien: Pick<Property, 'prix' | 'surface'>): number | null {
  return bien.prix && bien.surface ? Math.round(bien.prix / 100 / bien.surface) : null
}

/** Écart en % entre un prix au m² et la médiane du marché (négatif = sous le marché). */
export function ecartPct(prixM2: number, marche: NeighborhoodMarket): number {
  return Math.round(((prixM2 - marche.mediane) / marche.mediane) * 100)
}

export function useMarche() {
  // bien_id → statistiques, null quand DVF n'a rien d'exploitable
  const marches = useState<Record<string, NeighborhoodMarket | null>>('marche-quartier', () => ({}))
  const requetes = useState<Record<string, boolean>>('marche-quartier-requetes', () => ({}))

  async function charger(bien: Property): Promise<void> {
    if (!ressembleVente(bien) || bien.lat == null || bien.lon == null) return
    if (bien.id in marches.value || requetes.value[bien.id]) return
    requetes.value = { ...requetes.value, [bien.id]: true }
    try {
      const { marche } = await $fetch<{ marche: NeighborhoodMarket | null }>('/api/dvf', {
        query: { lat: bien.lat, lon: bien.lon, type: bien.type_bien ?? 'appartement' }
      })
      marches.value = { ...marches.value, [bien.id]: marche }
    } catch {
      marches.value = { ...marches.value, [bien.id]: null }
    } finally {
      requetes.value = { ...requetes.value, [bien.id]: false }
    }
  }

  function chargerTous(biens: Property[]) {
    for (const b of biens) void charger(b)
  }

  const pour = (bienId: string): NeighborhoodMarket | null => marches.value[bienId] ?? null

  return { marches, charger, chargerTous, pour }
}

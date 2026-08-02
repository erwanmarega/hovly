import type { Bien, MarcheQuartier, Transaction } from '~/types'
import { SEUIL_PRIX_VENTE_EUROS } from '~/types'

export { SEUIL_PRIX_VENTE_EUROS as SEUIL_PRIX_VENTE }

/**
 * Un bien est comparable aux ventes DVF s'il s'agit d'un achat. Le repli sur
 * le prix couvre les fiches créées avant l'existence du champ `transaction`.
 */
export function ressembleVente(bien: Pick<Bien, 'prix'> & { transaction?: Transaction }): boolean {
  if (bien.transaction) return bien.transaction === 'achat'
  return !!bien.prix && bien.prix / 100 >= SEUIL_PRIX_VENTE_EUROS
}

export function prixAuM2(bien: Pick<Bien, 'prix' | 'surface'>): number | null {
  return bien.prix && bien.surface ? Math.round(bien.prix / 100 / bien.surface) : null
}

/** Écart en % entre un prix au m² et la médiane du marché (négatif = sous le marché). */
export function ecartPct(prixM2: number, marche: MarcheQuartier): number {
  return Math.round(((prixM2 - marche.mediane) / marche.mediane) * 100)
}

export function useMarche() {
  // bien_id → statistiques, null quand DVF n'a rien d'exploitable
  const marches = useState<Record<string, MarcheQuartier | null>>('marche-quartier', () => ({}))
  const requetes = useState<Record<string, boolean>>('marche-quartier-requetes', () => ({}))

  async function charger(bien: Bien): Promise<void> {
    if (!ressembleVente(bien) || bien.lat == null || bien.lon == null) return
    if (bien.id in marches.value || requetes.value[bien.id]) return
    requetes.value = { ...requetes.value, [bien.id]: true }
    try {
      const { marche } = await $fetch<{ marche: MarcheQuartier | null }>('/api/dvf', {
        query: { lat: bien.lat, lon: bien.lon }
      })
      marches.value = { ...marches.value, [bien.id]: marche }
    } catch {
      marches.value = { ...marches.value, [bien.id]: null }
    } finally {
      requetes.value = { ...requetes.value, [bien.id]: false }
    }
  }

  function chargerTous(biens: Bien[]) {
    for (const b of biens) void charger(b)
  }

  const pour = (bienId: string): MarcheQuartier | null => marches.value[bienId] ?? null

  return { marches, charger, chargerTous, pour }
}

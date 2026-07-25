import type { Ancre, ModeTrajet, Trajet } from '~/types'

export const LIBELLES_MODE: Record<ModeTrajet, string> = {
  voiture: 'en voiture',
  velo: 'à vélo',
  marche: 'à pied',
  transport: 'en transports'
}

export interface TrajetAffiche {
  ancre: Ancre
  /** Durée en secondes, null si non calculée ou trajet impossible. */
  duree_s: number | null
  distance_m: number | null
  /** Dépasse la durée maximale fixée sur l'ancre. */
  depasse: boolean
  calcule: boolean
}

/** « 8 min », « 1 h 05 ». */
export function formatDuree(secondes: number | null): string {
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

export const cleTrajet = (bienId: string, ancreId: string, mode: string) =>
  `${bienId}|${ancreId}|${mode}`

export function indexer(trajets: Trajet[]): Map<string, Trajet> {
  return new Map(trajets.map((t) => [cleTrajet(t.bien_id, t.ancre, t.mode), t]))
}

/** Les trajets d'un bien, un par ancre, dans l'ordre des préférences. */
export function trajetsDuBien(
  bienId: string,
  ancres: Ancre[],
  index: Map<string, Trajet>
): TrajetAffiche[] {
  return ancres.map((ancre) => {
    const t = index.get(cleTrajet(bienId, ancre.id, ancre.mode))
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

/** Le trajet le plus long : c'est lui qui fait renoncer à un logement. */
export function trajetLePlusLong(liste: TrajetAffiche[]): TrajetAffiche | null {
  const calcules = liste.filter((t) => t.duree_s != null)
  if (!calcules.length) return null
  return calcules.reduce((pire, t) => (t.duree_s! > pire.duree_s! ? t : pire))
}

export function nbDepassements(liste: TrajetAffiche[]): number {
  return liste.filter((t) => t.depasse).length
}

export type EtatModes = Record<ModeTrajet, boolean>

export function useTrajets() {
  const { preferences } = usePreferences()

  const trajets = useState<Trajet[]>('trajets', () => [])
  const calcul = useState('trajets-calcul', () => false)
  const erreur = useState('trajets-erreur', () => '')
  /** Modes que le serveur sait calculer : dépend des clés d'API présentes. */
  const etat = useState<EtatModes | null>('trajets-etat', () => null)

  const index = computed(() => indexer(trajets.value))
  const ancres = computed(() => preferences.value.ancres)
  const actif = computed(() => ancres.value.length > 0)

  const disponible = (mode: ModeTrajet) => etat.value?.[mode] !== false

  /** Au moins une ancre dont le mode est réellement calculable. */
  const calculable = computed(() => ancres.value.some((a) => disponible(a.mode)))

  async function chargerEtat() {
    if (etat.value) return
    try {
      etat.value = await $fetch<EtatModes>('/api/trajets/etat')
    } catch {
      // Indéterminé : on laisse l'utilisateur essayer plutôt que de bloquer.
    }
  }

  async function refresh() {
    await chargerEtat()
    trajets.value = await $fetch<Trajet[]>('/api/trajets')
  }

  const pour = (bienId: string) => trajetsDuBien(bienId, ancres.value, index.value)

  /** Relance le calcul côté serveur (API de routage) puis recharge. */
  async function calculer(): Promise<boolean> {
    calcul.value = true
    erreur.value = ''
    try {
      await $fetch('/api/trajets/calculer', {
        method: 'POST',
        body: { ancres: ancres.value }
      })
      await refresh()
      return true
    } catch (e: unknown) {
      const err = e as { statusMessage?: string; message?: string }
      erreur.value = err.statusMessage || err.message || 'Calcul impossible'
      return false
    } finally {
      calcul.value = false
    }
  }

  return {
    trajets,
    ancres,
    actif,
    calculable,
    disponible,
    etat,
    calcul,
    erreur,
    refresh,
    chargerEtat,
    calculer,
    pour
  }
}

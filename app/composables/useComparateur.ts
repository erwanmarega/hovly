import type { Ancre, Bien, DPE, Trajet } from '~/types'
import type { Score } from '~/composables/useScore'
import type { OptionsCout } from '~/composables/useCoutReel'
import { coutReel } from '~/composables/useCoutReel'
import { estAchat } from '~/composables/useBiens'
import { cleTrajet, formatDuree } from '~/composables/useTrajets'

export const MAX_COMPARAISON = 4

export interface LigneComparaison {
  cle: string
  label: string
  sens: 'min' | 'max' | null
  affichage: string[]
  meilleurs: number[]
}

const DPE_ORDRE: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const eur = (n: number) => n.toLocaleString('fr-FR')

function meilleursIndices(valeurs: (number | null)[], sens: 'min' | 'max' | null): number[] {
  if (!sens) return []
  const definies = valeurs.filter((v): v is number => v != null)
  if (definies.length < 2) return []
  if (new Set(definies).size === 1) return []

  const cible = sens === 'min' ? Math.min(...definies) : Math.max(...definies)
  return valeurs.flatMap((v, i) => (v === cible ? [i] : []))
}

function ligne(
  cle: string,
  label: string,
  sens: 'min' | 'max' | null,
  valeurs: (number | null)[],
  format: (v: number | null) => string
): LigneComparaison {
  return {
    cle,
    label,
    sens,
    affichage: valeurs.map(format),
    meilleurs: meilleursIndices(valeurs, sens)
  }
}

export interface ContexteTrajets {
  ancres: Ancre[]
  index: Map<string, Trajet>
}

export function comparer(
  biens: Bien[],
  scores: Score[],
  optionsCout: OptionsCout = {},
  trajets?: ContexteTrajets,
  dvf?: (number | null)[]
): LigneComparaison[] {
  const couts = biens.map((b) => coutReel(b, optionsCout))
  const loyers = biens.map((b) => (b.prix ? Math.round(b.prix / 100) : null))
  const charges = biens.map((b) => (b.charges != null ? Math.round(b.charges / 100) : null))
  // Pour un achat, le « total mensuel » est la mensualité estimée + charges ;
  // pour une location, le loyer + charges comme avant.
  const totaux = biens.map((b, i) => {
    if (estAchat(b)) {
      const credit = couts[i]!.postes.find((p) => p.cle === 'credit')?.montant ?? 0
      return Math.round((credit + (b.charges ?? 0)) / 100) || null
    }
    return loyers[i] == null ? null : loyers[i]! + (charges[i] ?? 0)
  })
  const coutsReels = couts.map((c) => Math.round(c.total / 100) || null)
  const surfaces = biens.map((b) => b.surface || null)
  const auM2 = biens.map((b) => (b.surface && b.prix ? Math.round(b.prix / 100 / b.surface) : null))
  const pieces = biens.map((b) => b.nb_pieces || null)
  const etages = biens.map((b) => b.etage)
  const dpes = biens.map((b) => (b.dpe ? DPE_ORDRE.indexOf(b.dpe) : null))
  const totauxScore = scores.map((s) => s.total)
  const horsCriteres = scores.map((s) => s.criteres.filter((c) => !c.ok).length)

  const vide = (v: number | null) => (v == null ? '—' : String(v))

  const lignesTrajets = (trajets?.ancres ?? []).map((ancre) =>
    ligne(
      `trajet-${ancre.id}`,
      ancre.label,
      'min',
      biens.map((b) => trajets!.index.get(cleTrajet(b.id, ancre.id, ancre.mode))?.duree_s ?? null),
      (v) => formatDuree(v)
    )
  )

  return [
    ligne('loyer', 'Prix', 'min', loyers, (v) => (v == null ? '—' : `${eur(v)} €`)),
    ligne('charges', 'Charges', 'min', charges, (v) => (v == null ? '—' : `${eur(v)} €`)),
    ligne('total', 'Total /mois', 'min', totaux, (v) => (v == null ? '—' : `${eur(v)} €`)),
    ligne('cout_reel', 'Coût réel', 'min', coutsReels, (v) =>
      v == null ? '—' : `${eur(v)} €`
    ),
    ligne('surface', 'Surface', 'max', surfaces, (v) => (v == null ? '—' : `${v} m²`)),
    ligne('m2', 'Prix au m²', 'min', auM2, (v) => (v == null ? '—' : `${eur(v)} €`)),
    ...(dvf
      ? [
          ligne('dvf', 'Écart marché (DVF)', 'min', dvf, (v) =>
            v == null ? '—' : `${v > 0 ? '+' : ''}${v} %`
          )
        ]
      : []),
    ligne('pieces', 'Pièces', 'max', pieces, vide),
    ligne('etage', 'Étage', null, etages, vide),
    ligne('dpe', 'DPE', 'min', dpes, (v) => (v == null ? '—' : DPE_ORDRE[v]!)),
    ...lignesTrajets,
    ligne('score', 'Score', 'max', totauxScore, (v) => (v == null ? '—' : String(v))),
    ligne('criteres', 'Critères non respectés', 'min', horsCriteres, (v) =>
      v == null ? '—' : v === 0 ? 'Aucun' : String(v)
    )
  ]
}

export function useComparateur() {
  const selection = useState<string[]>('comparateur', () => [])

  const complet = computed(() => selection.value.length >= MAX_COMPARAISON)
  const nombre = computed(() => selection.value.length)
  const comparable = computed(() => selection.value.length >= 2)

  const estSelectionne = (id: string) => selection.value.includes(id)

  function basculer(id: string) {
    if (estSelectionne(id)) {
      selection.value = selection.value.filter((x) => x !== id)
      return true
    }
    if (complet.value) return false
    selection.value = [...selection.value, id]
    return true
  }

  function retirer(id: string) {
    selection.value = selection.value.filter((x) => x !== id)
  }

  function vider() {
    selection.value = []
  }

  return { selection, nombre, complet, comparable, estSelectionne, basculer, retirer, vider }
}

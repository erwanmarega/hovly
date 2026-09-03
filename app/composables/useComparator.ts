import type { Anchor, Property, SharedProperty, DPE, Commute } from '~/types'
import type { Score } from '~/composables/useScore'
import type { OptionsCout } from '~/composables/useActualCost'
import { actualCost } from '~/composables/useActualCost'
import { isPurchase } from '~/composables/useProperties'
import { pricePerSqm } from '~/composables/useMarket'
import { commuteKey, formatDuration } from '~/composables/useCommutes'

export const MAX_COMPARISON = 4

export interface ComparisonRow {
  key: string
  label: string
  direction: 'min' | 'max' | null
  display: string[]
  best: number[]
}

const DPE_ORDER: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const eur = (n: number) => n.toLocaleString('fr-FR')

function bestIndices(values: (number | null)[], direction: 'min' | 'max' | null): number[] {
  if (!direction) return []
  const defined = values.filter((v): v is number => v != null)
  if (defined.length < 2) return []
  if (new Set(defined).size === 1) return []

  const target = direction === 'min' ? Math.min(...defined) : Math.max(...defined)
  return values.flatMap((v, i) => (v === target ? [i] : []))
}

function row(
  key: string,
  label: string,
  direction: 'min' | 'max' | null,
  values: (number | null)[],
  format: (v: number | null) => string
): ComparisonRow {
  return {
    key,
    label,
    direction,
    display: values.map(format),
    best: bestIndices(values, direction)
  }
}

export interface CommutesContext {
  ancres: Anchor[]
  index: Map<string, Commute>
}

export function compare(
  properties: Property[],
  scores: Score[],
  optionsCout: OptionsCout = {},
  trajets?: CommutesContext,
  dvf?: (number | null)[]
): ComparisonRow[] {
  const costs = properties.map((b) => actualCost(b, optionsCout))
  const rents = properties.map((b) => (b.prix ? Math.round(b.prix / 100) : null))
  const charges = properties.map((b) => (b.charges != null ? Math.round(b.charges / 100) : null))
  // Pour un achat, le « total mensuel » est la mensualité estimée + charges ;
  // pour une location, le loyer + charges comme avant.
  const totals = properties.map((b, i) => {
    if (isPurchase(b)) {
      const loanPayment = costs[i]!.items.find((p) => p.cle === 'credit')?.montant ?? 0
      return Math.round((loanPayment + (b.charges ?? 0)) / 100) || null
    }
    return rents[i] == null ? null : rents[i]! + (charges[i] ?? 0)
  })
  const actualCosts = costs.map((c) => Math.round(c.total / 100) || null)
  const surfaces = properties.map((b) => b.surface || null)
  const pricesPerSqm = properties.map((b) => pricePerSqm(b))
  const pieces = properties.map((b) => b.nb_pieces || null)
  const floors = properties.map((b) => b.etage)
  const dpes = properties.map((b) => (b.dpe ? DPE_ORDER.indexOf(b.dpe) : null))
  const scoreTotals = scores.map((s) => s.total)
  const failedCriteria = scores.map((s) => s.criteria.filter((c) => !c.ok).length)

  const empty = (v: number | null) => (v == null ? '—' : String(v))

  const commuteRows = (trajets?.ancres ?? []).map((ancre) =>
    row(
      `trajet-${ancre.id}`,
      ancre.label,
      'min',
      properties.map((b) => trajets!.index.get(commuteKey(b.id, ancre.id, ancre.mode))?.duree_s ?? null),
      (v) => formatDuration(v)
    )
  )

  return [
    row('loyer', 'Prix', 'min', rents, (v) => (v == null ? '—' : `${eur(v)} €`)),
    row('charges', 'Charges', 'min', charges, (v) => (v == null ? '—' : `${eur(v)} €`)),
    row('total', 'Total /mois', 'min', totals, (v) => (v == null ? '—' : `${eur(v)} €`)),
    row('cout_reel', 'Coût réel', 'min', actualCosts, (v) =>
      v == null ? '—' : `${eur(v)} €`
    ),
    row('surface', 'Surface', 'max', surfaces, (v) => (v == null ? '—' : `${v} m²`)),
    row('m2', 'Prix au m²', 'min', pricesPerSqm, (v) => (v == null ? '—' : `${eur(v)} €`)),
    ...(dvf
      ? [
          row('dvf', 'Écart marché (DVF)', 'min', dvf, (v) =>
            v == null ? '—' : `${v > 0 ? '+' : ''}${v} %`
          )
        ]
      : []),
    row('pieces', 'Pièces', 'max', pieces, empty),
    row('etage', 'Étage', null, floors, empty),
    row('dpe', 'DPE', 'min', dpes, (v) => (v == null ? '—' : DPE_ORDER[v]!)),
    ...commuteRows,
    row('score', 'Score', 'max', scoreTotals, (v) => (v == null ? '—' : String(v))),
    row('criteres', 'Critères non respectés', 'min', failedCriteria, (v) =>
      v == null ? '—' : v === 0 ? 'Aucun' : String(v)
    )
  ]
}

/**
 * Comparaison pour la page de partage publique : seuls les champs de
 * `SharedProperty` sont dispo (pas de charges, préférences, trajets ni score,
 * tous privés — voir `PUBLIC_PROPERTY_FIELDS` côté serveur).
 */
export function comparePublic(properties: SharedProperty[]): ComparisonRow[] {
  const rents = properties.map((b) => (b.prix ? Math.round(b.prix / 100) : null))
  const surfaces = properties.map((b) => b.surface || null)
  const pricesPerSqm = properties.map((b) => pricePerSqm(b))
  const pieces = properties.map((b) => b.nb_pieces || null)
  const floors = properties.map((b) => b.etage)
  const dpes = properties.map((b) => (b.dpe ? DPE_ORDER.indexOf(b.dpe) : null))

  const empty = (v: number | null) => (v == null ? '—' : String(v))

  return [
    row('prix', 'Prix', 'min', rents, (v) => (v == null ? '—' : `${eur(v)} €`)),
    row('surface', 'Surface', 'max', surfaces, (v) => (v == null ? '—' : `${v} m²`)),
    row('m2', 'Prix au m²', 'min', pricesPerSqm, (v) => (v == null ? '—' : `${eur(v)} €`)),
    row('pieces', 'Pièces', 'max', pieces, empty),
    row('etage', 'Étage', null, floors, empty),
    row('dpe', 'DPE', 'min', dpes, (v) => (v == null ? '—' : DPE_ORDER[v]!))
  ]
}

export function useComparator() {
  const selection = useState<string[]>('comparateur', () => [])

  const full = computed(() => selection.value.length >= MAX_COMPARISON)
  const count = computed(() => selection.value.length)
  const comparable = computed(() => selection.value.length >= 2)

  const isSelected = (id: string) => selection.value.includes(id)

  function toggle(id: string) {
    if (isSelected(id)) {
      selection.value = selection.value.filter((x) => x !== id)
      return true
    }
    if (full.value) return false
    selection.value = [...selection.value, id]
    return true
  }

  function remove(id: string) {
    selection.value = selection.value.filter((x) => x !== id)
  }

  function clear() {
    selection.value = []
  }

  return { selection, count, full, comparable, isSelected, toggle, remove, clear }
}

import type { ApplicationStep, ApplicationStepType, NeighborhoodMarket, Property, Status, Transaction } from '~/types'
import { gapPercent } from '~/utils/market'

export const APPLICATION_STEP_TYPES: readonly ApplicationStepType[] = [
  'candidature',
  'contre_offre',
  'acceptation',
  'refus'
]

// 100 M€ en centimes : borne haute pour écarter les saisies absurdes.
export const MAX_STEP_AMOUNT_CENTS = 10_000_000_000
export const MAX_STEP_NOTE_LENGTH = 1000
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000

/** Statut du bien qui découle d'une étape. */
export function statusAfterStep(type: ApplicationStepType): Status {
  if (type === 'acceptation') return 'accepte'
  if (type === 'refus') return 'refuse'
  return 'en_attente'
}

/** Statut issu de la dernière étape (par `fait_le`, puis `created_at`), sinon `fallback`. */
export function currentStatus(
  steps: Pick<ApplicationStep, 'type' | 'fait_le' | 'created_at'>[],
  fallback: Status
): Status {
  if (!steps.length) return fallback
  const last = steps.reduce((a, b) => {
    const byDate = Date.parse(b.fait_le) - Date.parse(a.fait_le)
    if (byDate !== 0) return byDate > 0 ? b : a
    return Date.parse(b.created_at) >= Date.parse(a.created_at) ? b : a
  })
  return statusAfterStep(last.type)
}

export function stepLabel(type: ApplicationStepType, transaction: Transaction): string {
  const sale = transaction === 'achat'
  switch (type) {
    case 'candidature': return sale ? 'Offre faite' : 'Dossier envoyé'
    case 'contre_offre': return 'Contre-proposition'
    case 'acceptation': return sale ? 'Offre acceptée' : 'Dossier accepté'
    case 'refus': return sale ? 'Offre refusée' : 'Dossier refusé'
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Écarts d'une offre vs prix affiché et vs médiane DVF du quartier (négatif = en dessous). */
export function offerAnalysis(
  amountCents: number,
  bien: Pick<Property, 'prix' | 'surface'>,
  market: NeighborhoodMarket | null
): { askingGapPercent: number | null; marketGapPercent: number | null } {
  const askingGapPercent = bien.prix ? round1(((amountCents - bien.prix) / bien.prix) * 100) : null
  const marketGapPercent =
    market && bien.surface ? gapPercent(Math.round(amountCents / 100 / bien.surface), market) : null
  return { askingGapPercent, marketGapPercent }
}

export interface ValidatedStep {
  type: ApplicationStepType
  montant: number | null
  note: string | null
  fait_le: string
}

/** Valide et nettoie le corps d'une nouvelle étape. Lève une `Error` au message français. */
export function validateStep(body: unknown, _transaction: Transaction): ValidatedStep {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  const type = input.type as ApplicationStepType
  if (!APPLICATION_STEP_TYPES.includes(type)) throw new Error('Type de démarche invalide')

  let montant: number | null = null
  if (input.montant != null) {
    const amount = input.montant
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_STEP_AMOUNT_CENTS) {
      throw new Error('Montant invalide')
    }
    // Le montant n'a de sens que pour une offre / une contre-proposition.
    if (type === 'candidature' || type === 'contre_offre') montant = amount
  }

  let note: string | null = null
  if (input.note != null) {
    if (typeof input.note !== 'string') throw new Error('Note invalide')
    const trimmed = input.note.trim()
    if (trimmed.length > MAX_STEP_NOTE_LENGTH) {
      throw new Error(`La note ne peut pas dépasser ${MAX_STEP_NOTE_LENGTH} caractères`)
    }
    note = trimmed || null
  }

  let faitLe = new Date()
  if (input.fait_le != null) {
    const date = typeof input.fait_le === 'string' ? new Date(input.fait_le) : new Date(Number.NaN)
    if (Number.isNaN(date.getTime())) throw new Error('Date invalide')
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) throw new Error('La date ne peut pas être dans le futur')
    faitLe = date
  }

  return { type, montant, note, fait_le: faitLe.toISOString() }
}

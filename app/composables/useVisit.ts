import type { VisitRating, Property, Checklist } from '~/types'

export interface VisitCriterion {
  id: string
  label: string
  help: string
}

export const VISIT_CRITERIA: VisitCriterion[] = [
  { id: 'luminosite', label: 'Luminosité', help: 'Orientation, pièces sombres en journée' },
  { id: 'bruit', label: 'Bruit', help: 'Rue, voisins, fenêtres ouvertes' },
  { id: 'humidite', label: 'Humidité', help: 'Odeur, traces sur les murs, salle de bain' },
  { id: 'vis_a_vis', label: 'Vis-à-vis', help: 'Fenêtres en face, rez-de-chaussée' },
  { id: 'etat', label: 'État général', help: 'Sols, murs, fenêtres, électricité' },
  { id: 'chauffage', label: 'Chauffage', help: 'Type, âge, radiateurs dans chaque pièce' },
  { id: 'rangements', label: 'Rangements', help: 'Placards, cave, local vélo' },
  { id: 'quartier', label: 'Quartier', help: 'Commerces, transports, ambiance du soir' }
]

export interface AgentQuestion {
  id: string
  label: string
}

export const AGENT_QUESTIONS: AgentQuestion[] = [
  { id: 'charges', label: 'Que couvrent exactement les charges ?' },
  { id: 'travaux', label: 'Des travaux votés ou prévus dans l’immeuble ?' },
  { id: 'chauffage_cout', label: 'Coût réel du chauffage sur une année ?' },
  { id: 'depart', label: 'Pourquoi le locataire actuel part-il ?' },
  { id: 'duree', label: 'Depuis quand l’annonce est-elle en ligne ?' },
  { id: 'dossier', label: 'Quels justificatifs pour le dossier, et pour quand ?' },
  { id: 'disponibilite', label: 'À partir de quand le bien est-il libre ?' },
  { id: 'internet', label: 'Fibre installée dans l’immeuble ?' }
]

export const RATINGS: { value: VisitRating; label: string; className: string }[] = [
  { value: 'bon', label: 'Bon', className: 'bg-teal text-[#0a4a42]' },
  { value: 'moyen', label: 'Moyen', className: 'bg-brand-light text-[#8a6d1c]' },
  { value: 'mauvais', label: 'Mauvais', className: 'bg-coral text-[#600000]' }
]

const WEIGHTS: Record<VisitRating, number> = { bon: 1, moyen: 0.5, mauvais: 0 }

export function normalizeChecklist(raw: Partial<Checklist> | null | undefined): Checklist {
  return {
    notes: raw?.notes && typeof raw.notes === 'object' ? { ...raw.notes } : {},
    questions: Array.isArray(raw?.questions) ? [...raw.questions] : []
  }
}

export interface VisitSummary {
  filled: number
  total: number
  score: number | null
  failing: string[]
}

export function visitSummary(raw: Partial<Checklist> | null | undefined): VisitSummary {
  const { notes } = normalizeChecklist(raw)
  const filled = VISIT_CRITERIA.filter((c) => notes[c.id])
  const sum = filled.reduce((s, c) => s + WEIGHTS[notes[c.id]!], 0)

  return {
    filled: filled.length,
    total: VISIT_CRITERIA.length,
    score: filled.length ? Math.round((sum / filled.length) * 100) : null,
    failing: filled.filter((c) => notes[c.id] === 'mauvais').map((c) => c.label)
  }
}

export type VisitState = 'none' | 'upcoming' | 'today' | 'past'

export function visitState(bien: Property, now = new Date()): VisitState {
  if (!bien.visite_le) return 'none'
  const d = new Date(bien.visite_le)
  if (Number.isNaN(d.getTime())) return 'none'
  if (d.getTime() < now.getTime()) return 'past'
  return d.toDateString() === now.toDateString() ? 'today' : 'upcoming'
}

export function daysUntil(iso: string, now = new Date()): number {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((day(new Date(iso)) - day(now)) / 86_400_000)
}

const time = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function visitLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const days = daysUntil(iso, now)
  if (days === 0) return `Aujourd’hui ${time(d)}`
  if (days === 1) return `Demain ${time(d)}`
  if (days === -1) return `Hier ${time(d)}`
  if (days > 1 && days <= 7) {
    return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} ${time(d)}`
  }
  if (days < 0) return `Le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time(d)}`
}

export function longVisitDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function quickSlots(now = new Date()): { label: string; iso: string }[] {
  const at = (days: number, h: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    d.setHours(h, 0, 0, 0)
    return d
  }

  const toSaturday = (6 - now.getDay() + 7) % 7 || 7
  return [
    { label: 'Ce soir 18 h', iso: at(0, 18).toISOString() },
    { label: 'Demain 18 h', iso: at(1, 18).toISOString() },
    { label: 'Samedi 10 h', iso: at(toSaturday, 10).toISOString() }
  ].filter((c) => new Date(c.iso).getTime() > now.getTime())
}

export function upcomingVisits(biens: Property[], now = new Date()): Property[] {
  return biens
    .filter((b) => b.actif && b.visite_le && new Date(b.visite_le).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.visite_le!).getTime() - new Date(b.visite_le!).getTime())
}

export function useVisit() {
  const { update } = useProperties()

  async function schedule(id: string, iso: string | null) {
    await update(id, iso ? { visite_le: iso, statut: 'planifie' } : { visite_le: null })
  }

  async function saveChecklist(id: string, checklist: Checklist) {
    await update(id, { checklist })
  }

  async function saveReport(id: string, text: string) {
    await update(id, { compte_rendu: text })
  }

  return { schedule, saveChecklist, saveReport }
}

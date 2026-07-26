import type { AvisVisite, Bien, Checklist } from '~/types'

export interface CritereVisite {
  id: string
  label: string
  aide: string
}

export const CRITERES_VISITE: CritereVisite[] = [
  { id: 'luminosite', label: 'Luminosité', aide: 'Orientation, pièces sombres en journée' },
  { id: 'bruit', label: 'Bruit', aide: 'Rue, voisins, fenêtres ouvertes' },
  { id: 'humidite', label: 'Humidité', aide: 'Odeur, traces sur les murs, salle de bain' },
  { id: 'vis_a_vis', label: 'Vis-à-vis', aide: 'Fenêtres en face, rez-de-chaussée' },
  { id: 'etat', label: 'État général', aide: 'Sols, murs, fenêtres, électricité' },
  { id: 'chauffage', label: 'Chauffage', aide: 'Type, âge, radiateurs dans chaque pièce' },
  { id: 'rangements', label: 'Rangements', aide: 'Placards, cave, local vélo' },
  { id: 'quartier', label: 'Quartier', aide: 'Commerces, transports, ambiance du soir' }
]

export interface QuestionAgent {
  id: string
  label: string
}

export const QUESTIONS_AGENT: QuestionAgent[] = [
  { id: 'charges', label: 'Que couvrent exactement les charges ?' },
  { id: 'travaux', label: 'Des travaux votés ou prévus dans l’immeuble ?' },
  { id: 'chauffage_cout', label: 'Coût réel du chauffage sur une année ?' },
  { id: 'depart', label: 'Pourquoi le locataire actuel part-il ?' },
  { id: 'duree', label: 'Depuis quand l’annonce est-elle en ligne ?' },
  { id: 'dossier', label: 'Quels justificatifs pour le dossier, et pour quand ?' },
  { id: 'disponibilite', label: 'À partir de quand le bien est-il libre ?' },
  { id: 'internet', label: 'Fibre installée dans l’immeuble ?' }
]

export const AVIS: { value: AvisVisite; label: string; classe: string }[] = [
  { value: 'bon', label: 'Bon', classe: 'bg-teal text-[#0a4a42]' },
  { value: 'moyen', label: 'Moyen', classe: 'bg-brand-light text-[#8a6d1c]' },
  { value: 'mauvais', label: 'Mauvais', classe: 'bg-coral text-[#600000]' }
]

const POIDS: Record<AvisVisite, number> = { bon: 1, moyen: 0.5, mauvais: 0 }

export function normaliserChecklist(brut: Partial<Checklist> | null | undefined): Checklist {
  return {
    notes: brut?.notes && typeof brut.notes === 'object' ? { ...brut.notes } : {},
    questions: Array.isArray(brut?.questions) ? [...brut.questions] : []
  }
}

export interface BilanVisite {
  remplis: number
  total: number
  note: number | null
  mauvais: string[]
}

export function bilanVisite(brut: Partial<Checklist> | null | undefined): BilanVisite {
  const { notes } = normaliserChecklist(brut)
  const remplis = CRITERES_VISITE.filter((c) => notes[c.id])
  const somme = remplis.reduce((s, c) => s + POIDS[notes[c.id]!], 0)

  return {
    remplis: remplis.length,
    total: CRITERES_VISITE.length,
    note: remplis.length ? Math.round((somme / remplis.length) * 100) : null,
    mauvais: remplis.filter((c) => notes[c.id] === 'mauvais').map((c) => c.label)
  }
}

export type EtatVisite = 'aucune' | 'a_venir' | 'aujourdhui' | 'passee'

export function etatVisite(bien: Bien, maintenant = new Date()): EtatVisite {
  if (!bien.visite_le) return 'aucune'
  const d = new Date(bien.visite_le)
  if (Number.isNaN(d.getTime())) return 'aucune'
  if (d.getTime() < maintenant.getTime()) return 'passee'
  return d.toDateString() === maintenant.toDateString() ? 'aujourdhui' : 'a_venir'
}

export function joursAvant(iso: string, maintenant = new Date()): number {
  const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((jour(new Date(iso)) - jour(maintenant)) / 86_400_000)
}

const heure = (d: Date) =>
  d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function libelleVisite(iso: string, maintenant = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const jours = joursAvant(iso, maintenant)
  if (jours === 0) return `Aujourd’hui ${heure(d)}`
  if (jours === 1) return `Demain ${heure(d)}`
  if (jours === -1) return `Hier ${heure(d)}`
  if (jours > 1 && jours <= 7) {
    return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} ${heure(d)}`
  }
  if (jours < 0) return `Le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${heure(d)}`
}

export function dateVisiteLongue(iso: string): string {
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

export function versInputLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function depuisInputLocal(valeur: string): string | null {
  if (!valeur) return null
  const d = new Date(valeur)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function creneauxRapides(maintenant = new Date()): { label: string; iso: string }[] {
  const a = (jours: number, h: number) => {
    const d = new Date(maintenant)
    d.setDate(d.getDate() + jours)
    d.setHours(h, 0, 0, 0)
    return d
  }

  const versSamedi = (6 - maintenant.getDay() + 7) % 7 || 7
  return [
    { label: 'Ce soir 18 h', iso: a(0, 18).toISOString() },
    { label: 'Demain 18 h', iso: a(1, 18).toISOString() },
    { label: 'Samedi 10 h', iso: a(versSamedi, 10).toISOString() }
  ].filter((c) => new Date(c.iso).getTime() > maintenant.getTime())
}

export function prochainesVisites(biens: Bien[], maintenant = new Date()): Bien[] {
  return biens
    .filter((b) => b.actif && b.visite_le && new Date(b.visite_le).getTime() >= maintenant.getTime())
    .sort((a, b) => new Date(a.visite_le!).getTime() - new Date(b.visite_le!).getTime())
}

export function useVisite() {
  const { mettreAJour } = useBiens()

  async function planifier(id: string, iso: string | null) {
    await mettreAJour(id, iso ? { visite_le: iso, statut: 'planifie' } : { visite_le: null })
  }

  async function enregistrerChecklist(id: string, checklist: Checklist) {
    await mettreAJour(id, { checklist })
  }

  async function enregistrerCompteRendu(id: string, texte: string) {
    await mettreAJour(id, { compte_rendu: texte })
  }

  return { planifier, enregistrerChecklist, enregistrerCompteRendu }
}

import type { Property, DPE, Preferences } from '~/types'
import { isPurchase } from './useProperties'
import { pricePerSqm } from './useMarket'

export interface ScorePart {
  label: string
  points: number
  max: number
  hint: string
}

export interface Criterion {
  label: string
  ok: boolean
  detail: string
}

export interface Score {
  total: number
  label: string
  color: string
  tint: string
  parts: ScorePart[]
  criteria: Criterion[]
  customized: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  budgetMax: null,
  surfaceMin: null,
  piecesMin: null,
  dpeMin: null,
  poidsPrix: 50,
  poidsDpe: 30,
  poidsCharges: 20,
  prixKwh: null,
  chauffageDansCharges: false,
  budgetAchatMax: null,
  apport: null,
  tauxEmprunt: null,
  dureeEmpruntAns: null,
  ancres: []
}

const CRITERION_PENALTY = 12

const DPE_ORDER: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const DPE_FRACTION: Record<DPE, number> = {
  A: 1,
  B: 26 / 30,
  C: 21 / 30,
  D: 0.5,
  E: 9 / 30,
  F: 4 / 30,
  G: 0
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function pm2(b: Property): number {
  return pricePerSqm(b) ?? 0
}

export function isCustomized(p: Preferences): boolean {
  return (
    p.budgetMax != null ||
    p.budgetAchatMax != null ||
    p.surfaceMin != null ||
    p.piecesMin != null ||
    p.dpeMin != null ||
    p.poidsPrix !== DEFAULT_PREFERENCES.poidsPrix ||
    p.poidsDpe !== DEFAULT_PREFERENCES.poidsDpe ||
    p.poidsCharges !== DEFAULT_PREFERENCES.poidsCharges
  )
}

function splitWeights(prefs: Preferences): { prix: number; dpe: number; charges: number } {
  const raw = [
    Math.max(0, prefs.poidsPrix),
    Math.max(0, prefs.poidsDpe),
    Math.max(0, prefs.poidsCharges)
  ]
  const sum = raw[0]! + raw[1]! + raw[2]!
  if (!sum) return { prix: 50, dpe: 30, charges: 20 }

  const prix = Math.round((raw[0]! / sum) * 100)
  const dpe = Math.round((raw[1]! / sum) * 100)
  return { prix, dpe, charges: 100 - prix - dpe }
}

function criteria(bien: Property, prefs: Preferences): Criterion[] {
  const out: Criterion[] = []
  const eur = (n: number) => n.toLocaleString('fr-FR')

  const budget =
    bien.transaction === 'achat' ? prefs.budgetAchatMax : prefs.budgetMax
  if (budget != null) {
    const prix = Math.round(bien.prix / 100)
    out.push({
      label: 'Budget',
      ok: prix <= budget,
      detail: `${eur(prix)} € / max ${eur(budget)} €`
    })
  }
  if (prefs.surfaceMin != null) {
    out.push({
      label: 'Surface',
      ok: bien.surface >= prefs.surfaceMin,
      detail: `${bien.surface} m² / min ${prefs.surfaceMin} m²`
    })
  }
  if (prefs.piecesMin != null) {
    out.push({
      label: 'Pièces',
      ok: bien.nb_pieces >= prefs.piecesMin,
      detail: `${bien.nb_pieces} / min ${prefs.piecesMin}`
    })
  }
  if (prefs.dpeMin != null) {
    const rang = bien.dpe ? DPE_ORDER.indexOf(bien.dpe) : -1
    out.push({
      label: 'DPE',
      ok: rang >= 0 && rang <= DPE_ORDER.indexOf(prefs.dpeMin),
      detail: bien.dpe ? `${bien.dpe} / min ${prefs.dpeMin}` : `non renseigné / min ${prefs.dpeMin}`
    })
  }
  return out
}

export function scoreProperty(
  bien: Property,
  context: Property[],
  prefs: Preferences = DEFAULT_PREFERENCES
): Score {
  const weights = splitWeights(prefs)
  const parts: ScorePart[] = []

  const p = pm2(bien)
  // On ne compare des €/m² qu'entre biens de même nature : un prix de vente
  // au m² n'a rien à voir avec un loyer au m².
  const comparables = context.filter((b) => isPurchase(b) === isPurchase(bien))
  const sameCity = comparables.filter((b) => b.actif && b.surface > 0 && b.ville === bien.ville)
  const refs = sameCity.length >= 2 ? sameCity : comparables.filter((b) => b.actif && b.surface > 0)
  const med = median(refs.map(pm2))

  let pricePoints: number
  let priceHint: string
  if (!p || !med) {
    pricePoints = Math.round(weights.prix * 0.5)
    priceHint = 'Pas assez de comparables'
  } else {
    const ratio = p / med
    pricePoints = Math.round(clamp01((1.25 - ratio) / 0.5) * weights.prix)
    const gap = Math.round((ratio - 1) * 100)
    priceHint =
      gap <= -5
        ? `${Math.abs(gap)}% sous le marché local`
        : gap >= 5
          ? `${gap}% au-dessus du marché local`
          : 'Dans le marché local'
  }
  parts.push({ label: 'Prix au m²', points: pricePoints, max: weights.prix, hint: priceHint })

  const dpePoints = Math.round((bien.dpe ? DPE_FRACTION[bien.dpe] : 0.5) * weights.dpe)
  parts.push({
    label: 'Performance énergétique',
    points: dpePoints,
    max: weights.dpe,
    hint: bien.dpe ? `DPE ${bien.dpe}` : 'DPE non renseigné'
  })

  let chargesPoints: number
  let chargesHint: string
  if (bien.charges == null || !bien.prix) {
    chargesPoints = Math.round(weights.charges * 0.5)
    chargesHint = 'Charges non renseignées'
  } else if (isPurchase(bien)) {
    // Charges de copropriété : jugées en €/m²/mois (le ratio charges/prix
    // de vente serait toujours proche de 0 et ne dirait rien).
    const feesPerSqm = bien.charges / 100 / (bien.surface || 1)
    chargesPoints = Math.round(clamp01((4 - feesPerSqm) / 2.5) * weights.charges)
    chargesHint = `${feesPerSqm.toFixed(1).replace('.', ',')} €/m²/mois de copropriété`
  } else {
    const c = bien.charges / bien.prix
    chargesPoints = Math.round(clamp01((0.3 - c) / 0.25) * weights.charges)
    chargesHint = `${Math.round(c * 100)}% du loyer`
  }
  parts.push({ label: 'Charges', points: chargesPoints, max: weights.charges, hint: chargesHint })

  const criteriaList = criteria(bien, prefs)
  const penalty = criteriaList.filter((c) => !c.ok).length * CRITERION_PENALTY
  const raw = parts.reduce((s, part) => s + part.points, 0)
  const total = Math.max(0, raw - penalty)

  const { label, color, tint } =
    total >= 80
      ? { label: 'Excellent', color: 'text-[#1c6a3a]', tint: 'bg-teal' }
      : total >= 65
        ? { label: 'Bon', color: 'text-[#1c6a3a]', tint: 'bg-teal' }
        : total >= 50
          ? { label: 'Correct', color: 'text-[#8a6d1c]', tint: 'bg-brand' }
          : total >= 35
            ? { label: 'Moyen', color: 'text-[#8a4a1c]', tint: 'bg-coral' }
            : { label: 'Faible', color: 'text-[#8a1c1c]', tint: 'bg-coral' }

  return {
    total,
    label,
    color,
    tint,
    parts,
    criteria: criteriaList,
    customized: isCustomized(prefs)
  }
}

export function scoreColor(total: number | null | undefined): string {
  if (total == null) return '#8e91a0'
  if (total >= 65) return '#0fbcb0'
  if (total >= 50) return '#fcb900'
  if (total >= 35) return '#ff9999'
  return '#e35d5d'
}

import type { Bien, DPE, Preferences } from '~/types'

export interface ScorePart {
  label: string
  points: number
  max: number
  hint: string
}

export interface Critere {
  label: string
  ok: boolean
  detail: string
}

export interface Score {
  total: number
  label: string
  couleur: string
  tint: string
  parts: ScorePart[]
  criteres: Critere[]
  personnalise: boolean
}

export const PREFERENCES_DEFAUT: Preferences = {
  budgetMax: null,
  surfaceMin: null,
  piecesMin: null,
  dpeMin: null,
  poidsPrix: 50,
  poidsDpe: 30,
  poidsCharges: 20
}

const MALUS_CRITERE = 12

const DPE_ORDRE: DPE[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const DPE_FRACTION: Record<DPE, number> = {
  A: 1,
  B: 26 / 30,
  C: 21 / 30,
  D: 0.5,
  E: 9 / 30,
  F: 4 / 30,
  G: 0
}

function mediane(vals: number[]): number {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function pm2(b: Bien): number {
  return b.surface ? b.prix / b.surface : 0
}

export function estPersonnalise(p: Preferences): boolean {
  return (
    p.budgetMax != null ||
    p.surfaceMin != null ||
    p.piecesMin != null ||
    p.dpeMin != null ||
    p.poidsPrix !== PREFERENCES_DEFAUT.poidsPrix ||
    p.poidsDpe !== PREFERENCES_DEFAUT.poidsDpe ||
    p.poidsCharges !== PREFERENCES_DEFAUT.poidsCharges
  )
}

function repartir(prefs: Preferences): { prix: number; dpe: number; charges: number } {
  const brut = [
    Math.max(0, prefs.poidsPrix),
    Math.max(0, prefs.poidsDpe),
    Math.max(0, prefs.poidsCharges)
  ]
  const somme = brut[0]! + brut[1]! + brut[2]!
  if (!somme) return { prix: 50, dpe: 30, charges: 20 }

  const prix = Math.round((brut[0]! / somme) * 100)
  const dpe = Math.round((brut[1]! / somme) * 100)
  return { prix, dpe, charges: 100 - prix - dpe }
}

function criteres(bien: Bien, prefs: Preferences): Critere[] {
  const out: Critere[] = []
  const eur = (n: number) => n.toLocaleString('fr-FR')

  if (prefs.budgetMax != null) {
    const loyer = Math.round(bien.prix / 100)
    out.push({
      label: 'Budget',
      ok: loyer <= prefs.budgetMax,
      detail: `${eur(loyer)} € / max ${eur(prefs.budgetMax)} €`
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
    const rang = bien.dpe ? DPE_ORDRE.indexOf(bien.dpe) : -1
    out.push({
      label: 'DPE',
      ok: rang >= 0 && rang <= DPE_ORDRE.indexOf(prefs.dpeMin),
      detail: bien.dpe ? `${bien.dpe} / min ${prefs.dpeMin}` : `non renseigné / min ${prefs.dpeMin}`
    })
  }
  return out
}

export function scoreBien(
  bien: Bien,
  contexte: Bien[],
  prefs: Preferences = PREFERENCES_DEFAUT
): Score {
  const poids = repartir(prefs)
  const parts: ScorePart[] = []

  const p = pm2(bien)
  const memeVille = contexte.filter((b) => b.actif && b.surface > 0 && b.ville === bien.ville)
  const refs = memeVille.length >= 2 ? memeVille : contexte.filter((b) => b.actif && b.surface > 0)
  const med = mediane(refs.map(pm2))

  let ptsPrix: number
  let hintPrix: string
  if (!p || !med) {
    ptsPrix = Math.round(poids.prix * 0.5)
    hintPrix = 'Pas assez de comparables'
  } else {
    const ratio = p / med
    ptsPrix = Math.round(clamp01((1.25 - ratio) / 0.5) * poids.prix)
    const ecart = Math.round((ratio - 1) * 100)
    hintPrix =
      ecart <= -5
        ? `${Math.abs(ecart)}% sous le marché local`
        : ecart >= 5
          ? `${ecart}% au-dessus du marché local`
          : 'Dans le marché local'
  }
  parts.push({ label: 'Prix au m²', points: ptsPrix, max: poids.prix, hint: hintPrix })

  const ptsDpe = Math.round((bien.dpe ? DPE_FRACTION[bien.dpe] : 0.5) * poids.dpe)
  parts.push({
    label: 'Performance énergétique',
    points: ptsDpe,
    max: poids.dpe,
    hint: bien.dpe ? `DPE ${bien.dpe}` : 'DPE non renseigné'
  })

  let ptsCharges: number
  let hintCharges: string
  if (bien.charges == null || !bien.prix) {
    ptsCharges = Math.round(poids.charges * 0.5)
    hintCharges = 'Charges non renseignées'
  } else {
    const c = bien.charges / bien.prix
    ptsCharges = Math.round(clamp01((0.3 - c) / 0.25) * poids.charges)
    hintCharges = `${Math.round(c * 100)}% du loyer`
  }
  parts.push({ label: 'Charges', points: ptsCharges, max: poids.charges, hint: hintCharges })

  const listeCriteres = criteres(bien, prefs)
  const malus = listeCriteres.filter((c) => !c.ok).length * MALUS_CRITERE
  const brut = parts.reduce((s, part) => s + part.points, 0)
  const total = Math.max(0, brut - malus)

  const { label, couleur, tint } =
    total >= 80
      ? { label: 'Excellent', couleur: 'text-[#1c6a3a]', tint: 'bg-teal' }
      : total >= 65
        ? { label: 'Bon', couleur: 'text-[#1c6a3a]', tint: 'bg-teal' }
        : total >= 50
          ? { label: 'Correct', couleur: 'text-[#8a6d1c]', tint: 'bg-brand' }
          : total >= 35
            ? { label: 'Moyen', couleur: 'text-[#8a4a1c]', tint: 'bg-coral' }
            : { label: 'Faible', couleur: 'text-[#8a1c1c]', tint: 'bg-coral' }

  return {
    total,
    label,
    couleur,
    tint,
    parts,
    criteres: listeCriteres,
    personnalise: estPersonnalise(prefs)
  }
}

export function couleurScore(total: number | null | undefined): string {
  if (total == null) return '#8e91a0'
  if (total >= 65) return '#0fbcb0'
  if (total >= 50) return '#fcb900'
  if (total >= 35) return '#ff9999'
  return '#e35d5d'
}

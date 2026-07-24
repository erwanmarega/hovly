import type { Bien, DPE } from '~/types'

export interface ScorePart {
  label: string
  points: number
  max: number
  hint: string
}

export interface Score {
  total: number
  label: string
  couleur: string
  tint: string
  parts: ScorePart[]
}

const DPE_POINTS: Record<DPE, number> = {
  A: 30,
  B: 26,
  C: 21,
  D: 15,
  E: 9,
  F: 4,
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

export function scoreBien(bien: Bien, contexte: Bien[]): Score {
  const parts: ScorePart[] = []

  const p = pm2(bien)
  const memeVille = contexte.filter(
    (b) => b.actif && b.surface > 0 && b.ville === bien.ville
  )
  const refs = memeVille.length >= 2 ? memeVille : contexte.filter((b) => b.actif && b.surface > 0)
  const med = mediane(refs.map(pm2))

  let ptsPrix: number
  let hintPrix: string
  if (!p || !med) {
    ptsPrix = 25
    hintPrix = 'Pas assez de comparables'
  } else {
    const ratio = p / med
    ptsPrix = Math.round(clamp01((1.25 - ratio) / 0.5) * 50)
    const ecart = Math.round((ratio - 1) * 100)
    hintPrix =
      ecart <= -5
        ? `${Math.abs(ecart)}% sous le marché local`
        : ecart >= 5
          ? `${ecart}% au-dessus du marché local`
          : 'Dans le marché local'
  }
  parts.push({ label: 'Prix au m²', points: ptsPrix, max: 50, hint: hintPrix })

  const ptsDpe = bien.dpe ? DPE_POINTS[bien.dpe] : 15
  parts.push({
    label: 'Performance énergétique',
    points: ptsDpe,
    max: 30,
    hint: bien.dpe ? `DPE ${bien.dpe}` : 'DPE non renseigné'
  })

  let ptsCharges: number
  let hintCharges: string
  if (bien.charges == null || !bien.prix) {
    ptsCharges = 10
    hintCharges = 'Charges non renseignées'
  } else {
    const c = bien.charges / bien.prix
    ptsCharges = Math.round(clamp01((0.3 - c) / 0.25) * 20)
    hintCharges = `${Math.round(c * 100)}% du loyer`
  }
  parts.push({ label: 'Charges', points: ptsCharges, max: 20, hint: hintCharges })

  const total = parts.reduce((s, p) => s + p.points, 0)

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

  return { total, label, couleur, tint, parts }
}

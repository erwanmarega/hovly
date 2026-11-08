import type { Anchor, TravelMode, Preferences } from '~/types'
import { DEFAULT_PREFERENCES } from '~/composables/useScore'

const MODES: TravelMode[] = ['voiture', 'velo', 'marche', 'transport']

export const MAX_ANCHORS = 5

const cleanId = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[^a-z0-9-]/gi, '').slice(0, 32) : ''

function validAnchors(raw: unknown): Anchor[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const out: Anchor[] = []

  for (const a of raw) {
    const id = cleanId(a?.id)
    if (!id || seen.has(id)) continue
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue

    seen.add(id)
    out.push({
      id,
      label: String(a.label ?? '').slice(0, 40) || 'Ancre',
      adresse: String(a.adresse ?? '').slice(0, 200),
      lat: a.lat,
      lon: a.lon,
      mode: MODES.includes(a.mode) ? a.mode : 'voiture',
      maxMinutes:
        typeof a.maxMinutes === 'number' && Number.isFinite(a.maxMinutes) && a.maxMinutes > 0
          ? Math.round(a.maxMinutes)
          : null
    })
    if (out.length >= MAX_ANCHORS) break
  }

  return out
}

export function normalize(raw: unknown): Preferences {
  const p = (raw ?? {}) as Partial<Preferences>
  const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

  return {
    budgetMax: number(p.budgetMax),
    surfaceMin: number(p.surfaceMin),
    piecesMin: number(p.piecesMin),
    dpeMin: p.dpeMin ?? null,
    poidsPrix: p.poidsPrix ?? DEFAULT_PREFERENCES.poidsPrix,
    poidsDpe: p.poidsDpe ?? DEFAULT_PREFERENCES.poidsDpe,
    poidsCharges: p.poidsCharges ?? DEFAULT_PREFERENCES.poidsCharges,
    prixKwh: number(p.prixKwh),
    chauffageDansCharges: p.chauffageDansCharges === true,
    budgetAchatMax: number(p.budgetAchatMax),
    apport: number(p.apport),
    tauxEmprunt: number(p.tauxEmprunt),
    dureeEmpruntAns: number(p.dureeEmpruntAns),
    ancres: validAnchors(p.ancres)
  }
}

export function shouldSync(remote: Preferences, expected: string): boolean {
  return !expected || JSON.stringify(remote) === expected
}

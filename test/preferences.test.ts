import { describe, it, expect } from 'vitest'
import { scoreProperty, isCustomized, DEFAULT_PREFERENCES } from '../app/composables/useScore'
import { shouldSync } from '../app/composables/usePreferences'
import type { Property, Preferences } from '../app/types'

function bien(over: Partial<Property> = {}): Property {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.pap.fr/annonces/1',
    site_source: 'pap',
    titre: 'T3',
    prix: 100000,
    surface: 50,
    nb_pieces: 3,
    etage: 2,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Lyon',
    code_postal: '69006',
    lat: null,
    lon: null,
    geo_precision: null,
    geocode_le: null,
    photos: [],
    description: null,
    statut: 'a_visiter',
    note_perso: null,
    actif: true,
    created_at: '2026-07-01T10:00:00.000Z',
    ...over
  }
}

const prefs = (over: Partial<Preferences> = {}): Preferences => ({
  ...DEFAULT_PREFERENCES,
  ...over
})

const ctx = [
  bien({ id: 'a', prix: 200000, surface: 50 }),
  bien({ id: 'b', prix: 200000, surface: 50 })
]

const part = (s: ReturnType<typeof scoreProperty>, label: string) =>
  s.parts.find((p) => p.label.startsWith(label))!

describe('isCustomized', () => {
  it('est faux pour les réglages par défaut', () => {
    expect(isCustomized(DEFAULT_PREFERENCES)).toBe(false)
  })

  it('est vrai dès qu’un poids change', () => {
    expect(isCustomized(prefs({ poidsPrix: 70 }))).toBe(true)
  })

  it('est vrai dès qu’un minimum est posé', () => {
    expect(isCustomized(prefs({ budgetMax: 1200 }))).toBe(true)
    expect(isCustomized(prefs({ dpeMin: 'C' }))).toBe(true)
  })
})

describe('pondération', () => {
  it('reproduit le barème historique sans préférences', () => {
    const s = scoreProperty(bien({ prix: 200000, surface: 50, dpe: 'D', charges: null }), ctx)
    expect(s.parts.map((p) => p.max)).toEqual([50, 30, 20])
    expect(s.total).toBe(50)
    expect(s.customized).toBe(false)
  })

  it('redistribue les maximums selon les poids', () => {
    const s = scoreProperty(bien(), ctx, prefs({ poidsPrix: 80, poidsDpe: 10, poidsCharges: 10 }))
    expect(s.parts.map((p) => p.max)).toEqual([80, 10, 10])
    expect(s.parts.reduce((t, p) => t + p.max, 0)).toBe(100)
  })

  it('normalise des poids qui ne totalisent pas 100', () => {
    const s = scoreProperty(bien(), ctx, prefs({ poidsPrix: 3, poidsDpe: 1, poidsCharges: 1 }))
    expect(s.parts.map((p) => p.max)).toEqual([60, 20, 20])
  })

  it('retombe sur le barème par défaut si tous les poids sont à zéro', () => {
    const s = scoreProperty(bien(), ctx, prefs({ poidsPrix: 0, poidsDpe: 0, poidsCharges: 0 }))
    expect(s.parts.map((p) => p.max)).toEqual([50, 30, 20])
  })

  it('donne plus de points au prix quand il pèse plus lourd', () => {
    const cible = bien({ prix: 100000, surface: 50 })
    const neutre = scoreProperty(cible, ctx)
    const prixDabord = scoreProperty(cible, ctx, prefs({ poidsPrix: 90, poidsDpe: 5, poidsCharges: 5 }))
    expect(part(prixDabord, 'Prix').points).toBeGreaterThan(part(neutre, 'Prix').points)
  })

  it('conserve les proportions du DPE après pondération', () => {
    const s = scoreProperty(bien({ dpe: 'A' }), ctx, prefs({ poidsPrix: 40, poidsDpe: 40, poidsCharges: 20 }))
    expect(part(s, 'Performance').points).toBe(40)
    const moyen = scoreProperty(bien({ dpe: 'D' }), ctx, prefs({ poidsPrix: 40, poidsDpe: 40, poidsCharges: 20 }))
    expect(part(moyen, 'Performance').points).toBe(20)
  })
})

describe('critères minimums', () => {
  it('n’expose aucun critère par défaut', () => {
    expect(scoreProperty(bien(), ctx).criteria).toEqual([])
  })

  it('valide un budget respecté sans malus', () => {
    const sans = scoreProperty(bien({ prix: 100000 }), ctx)
    const avec = scoreProperty(bien({ prix: 100000 }), ctx, prefs({ budgetMax: 1200 }))
    expect(avec.criteria[0]).toMatchObject({ label: 'Budget', ok: true })
    expect(avec.total).toBe(sans.total)
  })

  it('retire 12 points par critère non respecté', () => {
    const sans = scoreProperty(bien({ prix: 150000, surface: 30 }), ctx)
    const avec = scoreProperty(
      bien({ prix: 150000, surface: 30 }),
      ctx,
      prefs({ budgetMax: 1000, surfaceMin: 50 })
    )
    expect(avec.criteria.filter((c) => !c.ok)).toHaveLength(2)
    expect(avec.total).toBe(Math.max(0, sans.total - 24))
  })

  it('ne descend jamais sous zéro', () => {
    const s = scoreProperty(
      bien({ prix: 900000, surface: 10, nb_pieces: 1, dpe: 'G', charges: 300000 }),
      ctx,
      prefs({ budgetMax: 500, surfaceMin: 80, piecesMin: 4, dpeMin: 'B' })
    )
    expect(s.total).toBe(0)
    expect(s.label).toBe('Faible')
  })

  it('accepte un DPE meilleur ou égal au minimum', () => {
    const ok = scoreProperty(bien({ dpe: 'B' }), ctx, prefs({ dpeMin: 'C' }))
    expect(ok.criteria[0]!.ok).toBe(true)

    const ko = scoreProperty(bien({ dpe: 'E' }), ctx, prefs({ dpeMin: 'C' }))
    expect(ko.criteria[0]!.ok).toBe(false)
  })

  it('considère un DPE absent comme non conforme', () => {
    const s = scoreProperty(bien({ dpe: null }), ctx, prefs({ dpeMin: 'D' }))
    expect(s.criteria[0]).toMatchObject({ ok: false })
    expect(s.criteria[0]!.detail).toContain('non renseigné')
  })

  it('décrit chaque critère avec sa valeur et son seuil', () => {
    const s = scoreProperty(
      bien({ prix: 120000, surface: 45, nb_pieces: 2 }),
      ctx,
      prefs({ budgetMax: 1000, surfaceMin: 40, piecesMin: 3 })
    )
    expect(s.criteria.map((c) => [c.label, c.ok])).toEqual([
      ['Budget', false],
      ['Surface', true],
      ['Pièces', false]
    ])
    expect(s.criteria[1]!.detail).toBe('45 m² / min 40 m²')
  })

  it('marque le score comme personnalisé', () => {
    expect(scoreProperty(bien(), ctx, prefs({ budgetMax: 1500 })).customized).toBe(true)
    expect(scoreProperty(bien(), ctx).customized).toBe(false)
  })
})

describe('shouldSync', () => {
  const distant = { ...DEFAULT_PREFERENCES, budgetMax: 1200 }

  it('synchronise quand aucune écriture locale n’est en attente', () => {
    expect(shouldSync(distant, '')).toBe(true)
  })

  it('refuse d’écraser une écriture locale que le user n’a pas encore reprise', () => {
    const local = JSON.stringify({ ...DEFAULT_PREFERENCES, budgetMax: 900 })
    expect(shouldSync(distant, local)).toBe(false)
  })

  it('reprend la synchronisation dès que le user a rattrapé', () => {
    expect(shouldSync(distant, JSON.stringify(distant))).toBe(true)
  })
})

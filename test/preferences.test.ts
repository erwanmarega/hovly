import { describe, it, expect } from 'vitest'
import { scoreBien, estPersonnalise, PREFERENCES_DEFAUT } from '../app/composables/useScore'
import type { Bien, Preferences } from '../app/types'

function bien(over: Partial<Bien> = {}): Bien {
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
  ...PREFERENCES_DEFAUT,
  ...over
})

const ctx = [
  bien({ id: 'a', prix: 200000, surface: 50 }),
  bien({ id: 'b', prix: 200000, surface: 50 })
]

const part = (s: ReturnType<typeof scoreBien>, label: string) =>
  s.parts.find((p) => p.label.startsWith(label))!

describe('estPersonnalise', () => {
  it('est faux pour les réglages par défaut', () => {
    expect(estPersonnalise(PREFERENCES_DEFAUT)).toBe(false)
  })

  it('est vrai dès qu’un poids change', () => {
    expect(estPersonnalise(prefs({ poidsPrix: 70 }))).toBe(true)
  })

  it('est vrai dès qu’un minimum est posé', () => {
    expect(estPersonnalise(prefs({ budgetMax: 1200 }))).toBe(true)
    expect(estPersonnalise(prefs({ dpeMin: 'C' }))).toBe(true)
  })
})

describe('pondération', () => {
  it('reproduit le barème historique sans préférences', () => {
    const s = scoreBien(bien({ prix: 200000, surface: 50, dpe: 'D', charges: null }), ctx)
    expect(s.parts.map((p) => p.max)).toEqual([50, 30, 20])
    expect(s.total).toBe(50)
    expect(s.personnalise).toBe(false)
  })

  it('redistribue les maximums selon les poids', () => {
    const s = scoreBien(bien(), ctx, prefs({ poidsPrix: 80, poidsDpe: 10, poidsCharges: 10 }))
    expect(s.parts.map((p) => p.max)).toEqual([80, 10, 10])
    expect(s.parts.reduce((t, p) => t + p.max, 0)).toBe(100)
  })

  it('normalise des poids qui ne totalisent pas 100', () => {
    const s = scoreBien(bien(), ctx, prefs({ poidsPrix: 3, poidsDpe: 1, poidsCharges: 1 }))
    expect(s.parts.map((p) => p.max)).toEqual([60, 20, 20])
  })

  it('retombe sur le barème par défaut si tous les poids sont à zéro', () => {
    const s = scoreBien(bien(), ctx, prefs({ poidsPrix: 0, poidsDpe: 0, poidsCharges: 0 }))
    expect(s.parts.map((p) => p.max)).toEqual([50, 30, 20])
  })

  it('donne plus de points au prix quand il pèse plus lourd', () => {
    const cible = bien({ prix: 100000, surface: 50 })
    const neutre = scoreBien(cible, ctx)
    const prixDabord = scoreBien(cible, ctx, prefs({ poidsPrix: 90, poidsDpe: 5, poidsCharges: 5 }))
    expect(part(prixDabord, 'Prix').points).toBeGreaterThan(part(neutre, 'Prix').points)
  })

  it('conserve les proportions du DPE après pondération', () => {
    const s = scoreBien(bien({ dpe: 'A' }), ctx, prefs({ poidsPrix: 40, poidsDpe: 40, poidsCharges: 20 }))
    expect(part(s, 'Performance').points).toBe(40)
    const moyen = scoreBien(bien({ dpe: 'D' }), ctx, prefs({ poidsPrix: 40, poidsDpe: 40, poidsCharges: 20 }))
    expect(part(moyen, 'Performance').points).toBe(20)
  })
})

describe('critères minimums', () => {
  it('n’expose aucun critère par défaut', () => {
    expect(scoreBien(bien(), ctx).criteres).toEqual([])
  })

  it('valide un budget respecté sans malus', () => {
    const sans = scoreBien(bien({ prix: 100000 }), ctx)
    const avec = scoreBien(bien({ prix: 100000 }), ctx, prefs({ budgetMax: 1200 }))
    expect(avec.criteres[0]).toMatchObject({ label: 'Budget', ok: true })
    expect(avec.total).toBe(sans.total)
  })

  it('retire 12 points par critère non respecté', () => {
    const sans = scoreBien(bien({ prix: 150000, surface: 30 }), ctx)
    const avec = scoreBien(
      bien({ prix: 150000, surface: 30 }),
      ctx,
      prefs({ budgetMax: 1000, surfaceMin: 50 })
    )
    expect(avec.criteres.filter((c) => !c.ok)).toHaveLength(2)
    expect(avec.total).toBe(Math.max(0, sans.total - 24))
  })

  it('ne descend jamais sous zéro', () => {
    const s = scoreBien(
      bien({ prix: 900000, surface: 10, nb_pieces: 1, dpe: 'G', charges: 300000 }),
      ctx,
      prefs({ budgetMax: 500, surfaceMin: 80, piecesMin: 4, dpeMin: 'B' })
    )
    expect(s.total).toBe(0)
    expect(s.label).toBe('Faible')
  })

  it('accepte un DPE meilleur ou égal au minimum', () => {
    const ok = scoreBien(bien({ dpe: 'B' }), ctx, prefs({ dpeMin: 'C' }))
    expect(ok.criteres[0]!.ok).toBe(true)

    const ko = scoreBien(bien({ dpe: 'E' }), ctx, prefs({ dpeMin: 'C' }))
    expect(ko.criteres[0]!.ok).toBe(false)
  })

  it('considère un DPE absent comme non conforme', () => {
    const s = scoreBien(bien({ dpe: null }), ctx, prefs({ dpeMin: 'D' }))
    expect(s.criteres[0]).toMatchObject({ ok: false })
    expect(s.criteres[0]!.detail).toContain('non renseigné')
  })

  it('décrit chaque critère avec sa valeur et son seuil', () => {
    const s = scoreBien(
      bien({ prix: 120000, surface: 45, nb_pieces: 2 }),
      ctx,
      prefs({ budgetMax: 1000, surfaceMin: 40, piecesMin: 3 })
    )
    expect(s.criteres.map((c) => [c.label, c.ok])).toEqual([
      ['Budget', false],
      ['Surface', true],
      ['Pièces', false]
    ])
    expect(s.criteres[1]!.detail).toBe('45 m² / min 40 m²')
  })

  it('marque le score comme personnalisé', () => {
    expect(scoreBien(bien(), ctx, prefs({ budgetMax: 1500 })).personnalise).toBe(true)
    expect(scoreBien(bien(), ctx).personnalise).toBe(false)
  })
})

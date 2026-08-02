import { describe, it, expect } from 'vitest'
import { scoreBien, PREFERENCES_DEFAUT } from '../app/composables/useScore'
import type { Bien, DPE } from '../app/types'

function bien(over: Partial<Bien> = {}): Bien {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.seloger.com/annonces/1.htm',
    site_source: 'seloger',
    titre: 'T2 lumineux',
    prix: 100000,
    surface: 50,
    nb_pieces: 2,
    etage: 3,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Lyon',
    code_postal: '69003',
    photos: [],
    description: null,
    statut: 'a_visiter',
    transaction: 'location',
    note_perso: null,
    actif: true,
    created_at: '2026-06-20T10:00:00.000Z',
    ...over
  }
}

const partPrix = (b: Bien, ctx: Bien[]) =>
  scoreBien(b, ctx).parts.find((p) => p.label === 'Prix au m²')!
const partDpe = (b: Bien, ctx: Bien[]) =>
  scoreBien(b, ctx).parts.find((p) => p.label === 'Performance énergétique')!
const partCharges = (b: Bien, ctx: Bien[]) =>
  scoreBien(b, ctx).parts.find((p) => p.label === 'Charges')!

describe('scoreBien — prix au m²', () => {
  it('donne 25 pts neutres sans comparable', () => {
    const p = partPrix(bien(), [])
    expect(p.points).toBe(25)
    expect(p.max).toBe(50)
    expect(p.hint).toBe('Pas assez de comparables')
  })

  it('donne 25 pts neutres si le bien n’a pas de surface', () => {
    const cible = bien({ surface: 0 })
    const ctx = [bien({ id: 'a' }), bien({ id: 'b' })]
    expect(partPrix(cible, ctx).points).toBe(25)
  })

  it('donne le max quand le bien est très en dessous de la médiane ville', () => {
    const cible = bien({ prix: 100000, surface: 50 })
    const ctx = [
      bien({ id: 'a', prix: 200000, surface: 50 }),
      bien({ id: 'b', prix: 200000, surface: 50 })
    ]
    const p = partPrix(cible, ctx)
    expect(p.points).toBe(50)
    expect(p.hint).toBe('50% sous le marché local')
  })

  it('donne 25 pts au prix médian', () => {
    const cible = bien({ prix: 200000, surface: 50 })
    const ctx = [
      bien({ id: 'a', prix: 200000, surface: 50 }),
      bien({ id: 'b', prix: 200000, surface: 50 })
    ]
    const p = partPrix(cible, ctx)
    expect(p.points).toBe(25)
    expect(p.hint).toBe('Dans le marché local')
  })

  it('tombe à 0 quand le bien est bien au-dessus de la médiane', () => {
    const cible = bien({ prix: 300000, surface: 50 })
    const ctx = [
      bien({ id: 'a', prix: 200000, surface: 50 }),
      bien({ id: 'b', prix: 200000, surface: 50 })
    ]
    const p = partPrix(cible, ctx)
    expect(p.points).toBe(0)
    expect(p.hint).toBe('50% au-dessus du marché local')
  })

  it('reste "dans le marché" pour un écart inférieur à 5%', () => {
    const cible = bien({ prix: 204000, surface: 50 })
    const ctx = [
      bien({ id: 'a', prix: 200000, surface: 50 }),
      bien({ id: 'b', prix: 200000, surface: 50 })
    ]
    expect(partPrix(cible, ctx).hint).toBe('Dans le marché local')
  })

  it('se rabat sur le contexte global si moins de 2 comparables dans la ville', () => {
    const cible = bien({ ville: 'Lyon', prix: 100000, surface: 50 })
    const ctx = [
      bien({ id: 'a', ville: 'Lyon', prix: 200000, surface: 50 }),
      bien({ id: 'b', ville: 'Paris', prix: 200000, surface: 50 }),
      bien({ id: 'c', ville: 'Paris', prix: 200000, surface: 50 })
    ]
    expect(partPrix(cible, ctx).points).toBe(50)
  })

  it('ignore les biens inactifs et sans surface dans la médiane', () => {
    const cible = bien({ prix: 100000, surface: 50 })
    const ctx = [
      bien({ id: 'a', prix: 200000, surface: 50 }),
      bien({ id: 'b', prix: 200000, surface: 50 }),
      bien({ id: 'c', prix: 1000, surface: 50, actif: false }),
      bien({ id: 'd', prix: 1000, surface: 0 })
    ]
    expect(partPrix(cible, ctx).points).toBe(50)
  })
})

describe('scoreBien — DPE', () => {
  const bareme: [DPE, number][] = [
    ['A', 30],
    ['B', 26],
    ['C', 21],
    ['D', 15],
    ['E', 9],
    ['F', 4],
    ['G', 0]
  ]

  it.each(bareme)('DPE %s vaut %i pts', (dpe, pts) => {
    const p = partDpe(bien({ dpe }), [])
    expect(p.points).toBe(pts)
    expect(p.hint).toBe(`DPE ${dpe}`)
  })

  it('donne 15 pts neutres si le DPE est absent', () => {
    const p = partDpe(bien({ dpe: null }), [])
    expect(p.points).toBe(15)
    expect(p.hint).toBe('DPE non renseigné')
  })
})

describe('scoreBien — charges', () => {
  it('donne 10 pts neutres si les charges sont absentes', () => {
    const p = partCharges(bien({ charges: null }), [])
    expect(p.points).toBe(10)
    expect(p.hint).toBe('Charges non renseignées')
  })

  it('donne 10 pts neutres si le prix est nul', () => {
    expect(partCharges(bien({ prix: 0, charges: 5000 }), []).points).toBe(10)
  })

  it('donne le max sous 5% du loyer', () => {
    const p = partCharges(bien({ prix: 100000, charges: 5000 }), [])
    expect(p.points).toBe(20)
    expect(p.hint).toBe('5% du loyer')
  })

  it('tombe à 0 à 30% du loyer', () => {
    const p = partCharges(bien({ prix: 100000, charges: 30000 }), [])
    expect(p.points).toBe(0)
    expect(p.hint).toBe('30% du loyer')
  })

  it('interpole entre les deux bornes', () => {
    const p = partCharges(bien({ prix: 100000, charges: 15000 }), [])
    expect(p.points).toBe(12)
    expect(p.hint).toBe('15% du loyer')
  })
})

describe('scoreBien — total et libellé', () => {
  const ctxMedian = [
    bien({ id: 'a', prix: 200000, surface: 50 }),
    bien({ id: 'b', prix: 200000, surface: 50 })
  ]

  it('somme les trois critères', () => {
    const s = scoreBien(bien({ prix: 200000, surface: 50, dpe: 'D', charges: 60000 }), ctxMedian)
    expect(s.parts.map((p) => p.points)).toEqual([25, 15, 0])
    expect(s.total).toBe(40)
    expect(s.parts.reduce((acc, p) => acc + p.max, 0)).toBe(100)
  })

  it('note un bien idéal "Excellent"', () => {
    const s = scoreBien(bien({ prix: 100000, surface: 50, dpe: 'A', charges: 5000 }), ctxMedian)
    expect(s.total).toBe(100)
    expect(s.label).toBe('Excellent')
    expect(s.tint).toBe('bg-teal')
  })

  it('note un bien médian "Correct"', () => {
    const s = scoreBien(bien({ prix: 200000, surface: 50, dpe: 'D', charges: null }), ctxMedian)
    expect(s.total).toBe(50)
    expect(s.label).toBe('Correct')
    expect(s.tint).toBe('bg-brand')
  })

  it('note un bien cher, passoire et chargé "Faible"', () => {
    const s = scoreBien(bien({ prix: 400000, surface: 50, dpe: 'G', charges: 200000 }), ctxMedian)
    expect(s.total).toBe(0)
    expect(s.label).toBe('Faible')
    expect(s.tint).toBe('bg-coral')
  })

  it('classe "Bon" entre 65 et 79', () => {
    const s = scoreBien(bien({ prix: 100000, surface: 50, dpe: 'D', charges: null }), ctxMedian)
    expect(s.total).toBe(75)
    expect(s.label).toBe('Bon')
  })

  it('classe "Moyen" entre 35 et 49', () => {
    const s = scoreBien(bien({ prix: 300000, surface: 50, dpe: 'D', charges: null }), ctxMedian)
    expect(s.total).toBe(25)
    expect(s.label).toBe('Faible')
    const s2 = scoreBien(bien({ prix: 220000, surface: 50, dpe: 'C', charges: null }), ctxMedian)
    expect(s2.total).toBe(46)
    expect(s2.label).toBe('Moyen')
  })
})

describe('scoreBien — biens en achat', () => {
  const prefsAchat = {
    ...PREFERENCES_DEFAUT,
    budgetAchatMax: 200000
  }

  it('vérifie le budget d’achat contre le prix total, pas le budget location', () => {
    const b = bien({ transaction: 'achat', prix: 25000000 }) // 250 000 €
    const critere = scoreBien(b, [], prefsAchat).criteres.find((c) => c.label === 'Budget')!
    expect(critere.ok).toBe(false)
    expect(critere.detail).toContain((250000).toLocaleString('fr-FR'))
    expect(critere.detail).toContain((200000).toLocaleString('fr-FR'))

    const ok = scoreBien(b, [], { ...prefsAchat, budgetAchatMax: 300000 }).criteres[0]!
    expect(ok.ok).toBe(true)
  })

  it('ignore le budget location pour un achat, et réciproquement', () => {
    const location = bien({ prix: 150000 }) // 1 500 €/mois
    const avecAchat = scoreBien(location, [], prefsAchat)
    expect(avecAchat.criteres.find((c) => c.label === 'Budget')).toBeUndefined()

    const achat = bien({ transaction: 'achat', prix: 25000000 })
    const avecLocation = scoreBien(achat, [], { ...PREFERENCES_DEFAUT, budgetMax: 1000 })
    expect(avecLocation.criteres.find((c) => c.label === 'Budget')).toBeUndefined()
  })

  it('ne compare les €/m² qu’entre biens de même nature', () => {
    const cible = bien({ prix: 100000, surface: 50 })
    const ctxAchats = [
      bien({ id: 'x', transaction: 'achat', prix: 30000000 }),
      bien({ id: 'y', transaction: 'achat', prix: 32000000 })
    ]
    const p = partPrix(cible, ctxAchats)
    expect(p.points).toBe(25)
    expect(p.hint).toBe('Pas assez de comparables')
  })

  it('note les charges de copropriété en €/m²/mois', () => {
    const legere = partCharges(bien({ transaction: 'achat', charges: 7500 }), [])
    expect(legere.points).toBe(20) // 1,5 €/m²/mois → excellent
    expect(legere.hint).toContain('€/m²/mois')

    const lourde = partCharges(bien({ transaction: 'achat', charges: 20000 }), [])
    expect(lourde.points).toBe(0) // 4 €/m²/mois → mauvais
  })
})

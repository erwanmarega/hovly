import { describe, it, expect } from 'vitest'
import { comparer, MAX_COMPARAISON } from '../app/composables/useComparateur'
import { scoreBien } from '../app/composables/useScore'
import {
  DUREE_DEFAUT_ANS,
  FRAIS_NOTAIRE,
  TAUX_DEFAUT,
  mensualiteCredit
} from '../app/composables/useCoutReel'
import type { Bien } from '../app/types'

let compteur = 0
function bien(over: Partial<Bien> = {}): Bien {
  compteur++
  return {
    id: `b${compteur}`,
    user_id: 'u1',
    url_source: `https://www.pap.fr/annonces/${compteur}`,
    site_source: 'pap',
    titre: `Bien ${compteur}`,
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
    transaction: 'location',
    note_perso: null,
    visite_le: null,
    compte_rendu: null,
    checklist: null,
    rappel_envoye_le: null,
    actif: true,
    created_at: '2026-07-01T10:00:00.000Z',
    ...over
  }
}

const scores = (liste: Bien[]) => liste.map((b) => scoreBien(b, liste))
const ligne = (lignes: ReturnType<typeof comparer>, cle: string) =>
  lignes.find((l) => l.cle === cle)!

const norm = (s: string) => s.replace(/\s/gu, ' ')

describe('comparer — structure', () => {
  it('produit une ligne par critère avec une valeur par bien', () => {
    const liste = [bien(), bien(), bien()]
    const lignes = comparer(liste, scores(liste))
    expect(lignes.length).toBeGreaterThanOrEqual(10)
    for (const l of lignes) expect(l.affichage).toHaveLength(3)
  })

  it('limite la comparaison à 4 biens', () => {
    expect(MAX_COMPARAISON).toBe(4)
  })

  it('gère une liste vide', () => {
    const lignes = comparer([], [])
    expect(lignes.every((l) => l.affichage.length === 0)).toBe(true)
    expect(lignes.every((l) => l.meilleurs.length === 0)).toBe(true)
  })
})

describe('comparer — meilleure valeur', () => {
  it('désigne le loyer le plus bas', () => {
    const liste = [bien({ prix: 150000 }), bien({ prix: 90000 }), bien({ prix: 120000 })]
    const l = ligne(comparer(liste, scores(liste)), 'loyer')
    expect(l.sens).toBe('min')
    expect(l.meilleurs).toEqual([1])
    expect(norm(l.affichage[1]!)).toBe('900 €')
  })

  it('désigne la plus grande surface', () => {
    const liste = [bien({ surface: 40 }), bien({ surface: 75 })]
    const l = ligne(comparer(liste, scores(liste)), 'surface')
    expect(l.sens).toBe('max')
    expect(l.meilleurs).toEqual([1])
  })

  it('désigne le meilleur DPE', () => {
    const liste = [bien({ dpe: 'E' }), bien({ dpe: 'B' }), bien({ dpe: 'D' })]
    const l = ligne(comparer(liste, scores(liste)), 'dpe')
    expect(l.meilleurs).toEqual([1])
    expect(l.affichage).toEqual(['E', 'B', 'D'])
  })

  it('surligne les ex æquo', () => {
    const liste = [bien({ prix: 90000 }), bien({ prix: 90000 }), bien({ prix: 150000 })]
    expect(ligne(comparer(liste, scores(liste)), 'loyer').meilleurs).toEqual([0, 1])
  })

  it('ne surligne rien si toutes les valeurs sont identiques', () => {
    const liste = [bien({ surface: 50 }), bien({ surface: 50 })]
    expect(ligne(comparer(liste, scores(liste)), 'surface').meilleurs).toEqual([])
  })

  it('ne surligne rien sur une ligne sans direction', () => {
    const liste = [bien({ etage: 1 }), bien({ etage: 5 })]
    const l = ligne(comparer(liste, scores(liste)), 'etage')
    expect(l.sens).toBeNull()
    expect(l.meilleurs).toEqual([])
  })
})

describe('comparer — valeurs manquantes', () => {
  it('affiche un tiret pour une valeur absente', () => {
    const liste = [bien({ charges: null }), bien({ charges: 8000 })]
    const l = ligne(comparer(liste, scores(liste)), 'charges')
    expect(l.affichage[0]).toBe('—')
    expect(norm(l.affichage[1]!)).toBe('80 €')
  })

  it('ne désigne pas de gagnant face à une valeur inconnue', () => {
    const liste = [bien({ charges: null }), bien({ charges: 8000 })]
    expect(ligne(comparer(liste, scores(liste)), 'charges').meilleurs).toEqual([])
  })

  it('compare normalement dès que deux valeurs sont connues', () => {
    const liste = [bien({ charges: null }), bien({ charges: 8000 }), bien({ charges: 15000 })]
    expect(ligne(comparer(liste, scores(liste)), 'charges').meilleurs).toEqual([1])
  })

  it('ne surligne pas quand une seule valeur est renseignée', () => {
    const liste = [bien({ dpe: null }), bien({ dpe: 'C' })]
    expect(ligne(comparer(liste, scores(liste)), 'dpe').meilleurs).toEqual([])
  })
})

describe('comparer — calculs dérivés', () => {
  it('additionne loyer et charges', () => {
    const liste = [bien({ prix: 100000, charges: 8000 }), bien({ prix: 95000, charges: 20000 })]
    const l = ligne(comparer(liste, scores(liste)), 'total')
    expect(l.affichage.map(norm)).toEqual(['1 080 €', '1 150 €'])
    expect(l.meilleurs).toEqual([0])
  })

  it('traite des charges absentes comme nulles dans le total', () => {
    const liste = [bien({ prix: 100000, charges: null })]
    expect(norm(ligne(comparer(liste, scores(liste)), 'total').affichage[0]!)).toBe('1 000 €')
  })

  it('calcule le prix au m²', () => {
    const liste = [bien({ prix: 100000, surface: 50 }), bien({ prix: 120000, surface: 40 })]
    const l = ligne(comparer(liste, scores(liste)), 'm2')
    expect(l.affichage).toEqual(['20 €', '30 €'])
    expect(l.meilleurs).toEqual([0])
  })

  it('compte les critères non respectés, moins il y en a mieux c’est', () => {
    const liste = [bien({ prix: 200000 }), bien({ prix: 80000 })]
    const avecPrefs = liste.map((b) =>
      scoreBien(b, liste, {
        budgetMax: 1000,
        surfaceMin: null,
        piecesMin: null,
        dpeMin: null,
        poidsPrix: 50,
        poidsDpe: 30,
        poidsCharges: 20,
        prixKwh: null,
        chauffageDansCharges: false
      })
    )
    const l = ligne(comparer(liste, avecPrefs), 'criteres')
    expect(l.affichage).toEqual(['1', 'Aucun'])
    expect(l.meilleurs).toEqual([1])
  })

  it('classe sur le coût réel, pas sur le loyer affiché', () => {
    const liste = [bien({ prix: 100000, surface: 50, dpe: 'G' }), bien({ prix: 100000, surface: 50, dpe: 'A' })]
    const l = ligne(comparer(liste, scores(liste)), 'cout_reel')
    expect(l.sens).toBe('min')
    expect(l.meilleurs).toEqual([1])
    expect(ligne(comparer(liste, scores(liste)), 'total').meilleurs).toEqual([])
  })

  it('désigne le meilleur score', () => {
    const liste = [bien({ prix: 300000, surface: 50 }), bien({ prix: 80000, surface: 50 })]
    const l = ligne(comparer(liste, scores(liste)), 'score')
    expect(l.sens).toBe('max')
    expect(l.meilleurs).toEqual([1])
  })
})

describe('comparer — biens en achat', () => {
  it('libelle « Prix » et « Total /mois » plutôt que « Loyer »', () => {
    const liste = [bien(), bien({ prix: 120000 })]
    const lignes = comparer(liste, scores(liste))
    expect(ligne(lignes, 'loyer').label).toBe('Prix')
    expect(ligne(lignes, 'total').label).toBe('Total /mois')
  })

  it('le total mensuel d’un achat est la mensualité estimée + charges', () => {
    const b = bien({ transaction: 'achat', prix: 20000000, charges: 10000 })
    const liste = [b, bien({ transaction: 'achat', prix: 24000000, charges: 10000 })]
    const l = ligne(comparer(liste, scores(liste)), 'total')

    const attendu = Math.round(
      (mensualiteCredit(Math.round(20000000 * (1 + FRAIS_NOTAIRE)), TAUX_DEFAUT, DUREE_DEFAUT_ANS) +
        10000) /
        100
    )
    expect(l.affichage[0]).toBe(`${attendu.toLocaleString('fr-FR')} €`)
    expect(l.meilleurs).toEqual([0])
  })

  it('le total mensuel d’une location reste loyer + charges', () => {
    const liste = [bien({ prix: 100000, charges: 8000 }), bien({ prix: 120000, charges: 8000 })]
    const l = ligne(comparer(liste, scores(liste)), 'total')
    expect(l.affichage[0]).toBe(`${(1080).toLocaleString('fr-FR')} €`)
  })
})

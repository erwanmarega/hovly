import { describe, it, expect } from 'vitest'
import {
  normalizeCity,
  similarity,
  areDuplicates,
  groupDuplicates,
  duplicatesOf,
  representatives
} from '../app/composables/useDuplicates'
import type { Property } from '../app/types'

let compteur = 0
function bien(over: Partial<Property> = {}): Property {
  compteur++
  return {
    id: `b${compteur}`,
    user_id: 'u1',
    url_source: `https://www.pap.fr/annonces/${compteur}`,
    site_source: 'pap',
    titre: 'Appartement 3 pièces 62 m² proche métro',
    prix: 150000,
    surface: 62,
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

describe('normalizeCity', () => {
  it('ignore casse, accents et ponctuation', () => {
    expect(normalizeCity('Aix-en-Provence')).toBe(normalizeCity('aix en provence'))
    expect(normalizeCity('Nîmes')).toBe('nimes')
  })

  it('ignore l’arrondissement', () => {
    expect(normalizeCity('Lyon 6e')).toBe('lyon')
    expect(normalizeCity('Paris 12ème')).toBe('paris')
  })

  it('gère l’absence de ville', () => {
    expect(normalizeCity(null)).toBe('')
    expect(normalizeCity('')).toBe('')
  })
})

describe('similarity', () => {
  it('donne 1 pour la même URL', () => {
    const a = bien({ url_source: 'https://x.fr/1' })
    const b = bien({ url_source: 'https://x.fr/1', site_source: 'leboncoin' })
    expect(similarity(a, b)).toEqual({ score: 1, reasons: ['URL identique'] })
  })

  it('donne 0 pour un bien comparé à lui-même', () => {
    const a = bien()
    expect(similarity(a, a).score).toBe(0)
  })

  it('donne 0 quand ni la ville ni le code postal ne correspondent', () => {
    const a = bien({ ville: 'Lyon', code_postal: '69006' })
    const b = bien({ ville: 'Marseille', code_postal: '13008' })
    expect(similarity(a, b).score).toBe(0)
  })

  it('reconnaît le même bien publié sur deux sites', () => {
    const a = bien({ site_source: 'pap', prix: 150000, surface: 62 })
    const b = bien({
      site_source: 'leboncoin',
      url_source: 'https://www.leboncoin.fr/ad/locations/9',
      prix: 150000,
      surface: 62
    })
    const s = similarity(a, b)
    expect(s.score).toBeGreaterThanOrEqual(0.75)
    expect(s.reasons).toContain('Surface identique')
    expect(s.reasons).toContain('Prix identique')
  })

  it('tolère un léger écart de prix et de surface', () => {
    const a = bien({ prix: 150000, surface: 62 })
    const b = bien({ prix: 152000, surface: 63 })
    expect(similarity(a, b).score).toBeGreaterThanOrEqual(0.75)
  })

  it('reste sous le seuil pour deux biens différents de la même ville', () => {
    const a = bien({ prix: 150000, surface: 62, nb_pieces: 3, titre: 'T3 avec balcon' })
    const b = bien({ prix: 90000, surface: 28, nb_pieces: 1, titre: 'Studio rénové' })
    expect(similarity(a, b).score).toBeLessThan(0.75)
  })

  it('ne confond pas deux studios semblables aux titres différents', () => {
    const a = bien({ prix: 70000, surface: 25, nb_pieces: 1, titre: 'Studio quartier Guillotière' })
    const b = bien({ prix: 71000, surface: 25, nb_pieces: 1, titre: 'Studio Part-Dieu rénové' })
    const s = similarity(a, b)
    expect(s.score).toBeGreaterThan(0.7)
  })

  it('rapproche deux annonces du même code postal sans ville renseignée', () => {
    const a = bien({ ville: '', code_postal: '69006' })
    const b = bien({ ville: '', code_postal: '69006', site_source: 'bienici' })
    expect(similarity(a, b).reasons).toContain('Même code postal')
  })
})

describe('areDuplicates', () => {
  it('respecte le seuil fourni', () => {
    const a = bien({ prix: 150000, surface: 62 })
    const b = bien({ prix: 120000, surface: 55, titre: 'Autre bien' })
    expect(similarity(a, b).score).toBeCloseTo(0.35, 2)
    expect(areDuplicates(a, b, 0.3)).toBe(true)
    expect(areDuplicates(a, b, 0.9)).toBe(false)
  })
})

describe('groupDuplicates', () => {
  it('ne renvoie aucun groupe sans doublon', () => {
    const liste = [
      bien({ prix: 150000, surface: 62, titre: 'T3 balcon' }),
      bien({ prix: 80000, surface: 25, nb_pieces: 1, titre: 'Studio' , ville: 'Marseille', code_postal: '13008' })
    ]
    expect(groupDuplicates(liste)).toEqual([])
  })

  it('regroupe deux annonces du même bien', () => {
    const a = bien()
    const b = bien({ site_source: 'leboncoin' })
    const groupes = groupDuplicates([a, b, bien({ ville: 'Nice', code_postal: '06000', prix: 50000, surface: 20, nb_pieces: 1, titre: 'Studio Nice' })])
    expect(groupes).toHaveLength(1)
    expect(groupes[0]!.map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('fusionne un groupe de trois par transitivité', () => {
    const a = bien()
    const b = bien({ site_source: 'leboncoin' })
    const c = bien({ site_source: 'bienici' })
    const groupes = groupDuplicates([a, b, c])
    expect(groupes).toHaveLength(1)
    expect(groupes[0]).toHaveLength(3)
  })

  it('gère une liste vide', () => {
    expect(groupDuplicates([])).toEqual([])
  })
})

describe('duplicatesOf', () => {
  it('retourne les autres annonces du même bien', () => {
    const a = bien()
    const b = bien({ site_source: 'leboncoin' })
    const autre = bien({ ville: 'Nice', code_postal: '06000', surface: 20, prix: 50000, nb_pieces: 1, titre: 'Studio Nice' })
    expect(duplicatesOf(a, [a, b, autre]).map((x) => x.id)).toEqual([b.id])
  })

  it('retourne une liste vide sans correspondance', () => {
    const a = bien()
    expect(duplicatesOf(a, [a])).toEqual([])
  })
})

describe('representatives', () => {
  it('ne garde que la première annonce de chaque groupe', () => {
    const ancien = bien({ created_at: '2026-06-01T10:00:00.000Z' })
    const recent = bien({ site_source: 'leboncoin', created_at: '2026-07-01T10:00:00.000Z' })
    const seul = bien({ ville: 'Nice', code_postal: '06000', surface: 20, prix: 50000, nb_pieces: 1, titre: 'Studio Nice' })

    const restants = representatives([recent, ancien, seul]).map((b) => b.id)
    expect(restants).toContain(ancien.id)
    expect(restants).toContain(seul.id)
    expect(restants).not.toContain(recent.id)
  })

  it('laisse la liste intacte sans doublon', () => {
    const liste = [bien(), bien({ ville: 'Nice', code_postal: '06000', surface: 20, prix: 50000, nb_pieces: 1, titre: 'Studio Nice' })]
    expect(representatives(liste)).toHaveLength(2)
  })
})

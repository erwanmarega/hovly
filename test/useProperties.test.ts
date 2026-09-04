import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Property } from '../app/types'

const etats = new Map<string, { value: any }>()
vi.stubGlobal('useState', (cle: string, init: () => any) => {
  if (!etats.has(cle)) etats.set(cle, { value: init() })
  return etats.get(cle)!
})

const { STATUSES, useProperties, detectSource } = await import('../app/composables/useProperties')

function bien(over: Partial<Property> = {}): Property {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.seloger.com/annonces/1.htm',
    site_source: 'seloger',
    titre: 'T2',
    prix: 157000,
    surface: 42,
    nb_pieces: 2,
    etage: null,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Lyon',
    code_postal: '69003',
    photos: [],
    description: null,
    statut: 'a_visiter',
    note_perso: null,
    actif: true,
    created_at: '2026-06-20T10:00:00.000Z',
    ...over
  }
}

beforeEach(() => etats.clear())

describe('STATUSES', () => {
  it('expose les 5 statuts avec un libellé', () => {
    expect(STATUSES.map((s) => s.value)).toEqual([
      'a_visiter',
      'planifie',
      'visite',
      'coup_de_coeur',
      'elimine'
    ])
    expect(STATUSES.every((s) => s.label.length > 0)).toBe(true)
  })
})

describe('monthlyPrice', () => {
  it('convertit les centimes en euros', () => {
    const { monthlyPrice } = useProperties()
    expect(monthlyPrice(bien({ prix: 157000 }))).toBe(1570)
  })

  it('arrondit à l’euro', () => {
    const { monthlyPrice } = useProperties()
    expect(monthlyPrice(bien({ prix: 157049 }))).toBe(1570)
    expect(monthlyPrice(bien({ prix: 157050 }))).toBe(1571)
  })
})

describe('pricePerSqm', () => {
  it('divise le loyer en euros par la surface', () => {
    const { pricePerSqm } = useProperties()
    expect(pricePerSqm(bien({ prix: 100000, surface: 50 }))).toBe(20)
  })

  it('arrondit le résultat', () => {
    const { pricePerSqm } = useProperties()
    expect(pricePerSqm(bien({ prix: 157000, surface: 42 }))).toBe(37)
  })

  it('retourne 0 sans surface', () => {
    const { pricePerSqm } = useProperties()
    expect(pricePerSqm(bien({ surface: 0 }))).toBe(0)
  })
})

describe('detectSource (client)', () => {
  it('reconnaît chaque source supportée', () => {
    expect(detectSource('https://www.seloger.com/annonces/1.htm')).toBe('seloger')
    expect(detectSource('https://www.leboncoin.fr/ventes/2')).toBe('leboncoin')
    expect(detectSource('https://www.pap.fr/annonce/3')).toBe('pap')
    expect(detectSource('https://www.logic-immo.com/detail/4')).toBe('logic-immo')
    expect(detectSource('https://www.bienici.com/annonce/5')).toBe('bienici')
    expect(detectSource('https://www.orpi.com/annonce-vente-appartement-6/')).toBe('orpi')
  })

  it('retourne null pour une source non supportée', () => {
    expect(detectSource('https://www.example.com/x')).toBeNull()
  })

  it('retourne null pour une URL invalide', () => {
    expect(detectSource('pas-une-url')).toBeNull()
    expect(detectSource('')).toBeNull()
  })
})

describe('état partagé', () => {
  it('partage la liste des biens entre deux appels', () => {
    const a = useProperties()
    const b = useProperties()
    a.biens.value = [bien()]
    expect(b.biens.value).toHaveLength(1)
  })
})

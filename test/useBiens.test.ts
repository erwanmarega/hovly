import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Bien } from '../app/types'

const etats = new Map<string, { value: any }>()
vi.stubGlobal('useState', (cle: string, init: () => any) => {
  if (!etats.has(cle)) etats.set(cle, { value: init() })
  return etats.get(cle)!
})

const { STATUTS, useBiens, detecterSource } = await import('../app/composables/useBiens')

function bien(over: Partial<Bien> = {}): Bien {
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

describe('STATUTS', () => {
  it('expose les 5 statuts avec un libellé', () => {
    expect(STATUTS.map((s) => s.value)).toEqual([
      'a_visiter',
      'planifie',
      'visite',
      'coup_de_coeur',
      'elimine'
    ])
    expect(STATUTS.every((s) => s.label.length > 0)).toBe(true)
  })
})

describe('prixMensuel', () => {
  it('convertit les centimes en euros', () => {
    const { prixMensuel } = useBiens()
    expect(prixMensuel(bien({ prix: 157000 }))).toBe(1570)
  })

  it('arrondit à l’euro', () => {
    const { prixMensuel } = useBiens()
    expect(prixMensuel(bien({ prix: 157049 }))).toBe(1570)
    expect(prixMensuel(bien({ prix: 157050 }))).toBe(1571)
  })
})

describe('prixM2', () => {
  it('divise le loyer en euros par la surface', () => {
    const { prixM2 } = useBiens()
    expect(prixM2(bien({ prix: 100000, surface: 50 }))).toBe(20)
  })

  it('arrondit le résultat', () => {
    const { prixM2 } = useBiens()
    expect(prixM2(bien({ prix: 157000, surface: 42 }))).toBe(37)
  })

  it('retourne 0 sans surface', () => {
    const { prixM2 } = useBiens()
    expect(prixM2(bien({ surface: 0 }))).toBe(0)
  })
})

describe('detecterSource (client)', () => {
  it('reconnaît chaque source supportée', () => {
    expect(detecterSource('https://www.seloger.com/annonces/1.htm')).toBe('seloger')
    expect(detecterSource('https://www.leboncoin.fr/ventes/2')).toBe('leboncoin')
    expect(detecterSource('https://www.pap.fr/annonce/3')).toBe('pap')
    expect(detecterSource('https://www.logic-immo.com/detail/4')).toBe('logic-immo')
    expect(detecterSource('https://www.bienici.com/annonce/5')).toBe('bienici')
  })

  it('retourne null pour une source non supportée', () => {
    expect(detecterSource('https://www.century21.fr/x')).toBeNull()
  })

  it('retourne null pour une URL invalide', () => {
    expect(detecterSource('pas-une-url')).toBeNull()
    expect(detecterSource('')).toBeNull()
  })
})

describe('état partagé', () => {
  it('partage la liste des biens entre deux appels', () => {
    const a = useBiens()
    const b = useBiens()
    a.biens.value = [bien()]
    expect(b.biens.value).toHaveLength(1)
  })
})

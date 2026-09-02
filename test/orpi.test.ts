import { describe, it, expect } from 'vitest'
import { extraireOrpi } from '../server/utils/scrape/extract'
import { detecterSource } from '../server/utils/scrape/source'

const VENTE = JSON.stringify({
  transaction: 'buy',
  zipCode: '38120',
  price: 204000,
  priceHC: null,
  surface: 59.0,
  nbRooms: 2,
  story: 6,
  storyLocation: 1,
  consumptionIndex: null,
  dpeDisplay: false,
  chargeReserve: null,
  city: { name: 'Saint-Égrève' },
  locationDescription: 'Saint-Égrève',
  images: [
    'https://cutjhqvjma.cloudimg.io/_prod_/sweepbright-s3/a3a684b9--746965b8.jpg'
  ]
})

const LOCATION = JSON.stringify({
  transaction: 'rent',
  zipCode: '69004',
  price: 740,
  priceHC: 728,
  surface: 43.75,
  nbRooms: 2,
  story: 5,
  storyLocation: 1,
  consumptionIndex: 3,
  dpeDisplay: true,
  chargeReserve: 12,
  city: { name: 'Lyon 1' },
  locationDescription: 'Lyon 1',
  images: [
    'https://cutjhqvjma.cloudimg.io/_prod_/sweepbright-s3/4fa58efa--6a3ea463.jpg',
    'https://cutjhqvjma.cloudimg.io/_prod_/sweepbright-s3/4fa58efa--bc53c70e.jpg'
  ]
})

describe('detecterSource', () => {
  it('reconnaît une URL Orpi', () => {
    expect(
      detecterSource(
        'https://www.orpi.com/annonce-vente-appartement-t2-saint-egreve-38120-abc-123/'
      )
    ).toBe('orpi')
  })

  it('reconnaît le domaine sans www', () => {
    expect(detecterSource('https://orpi.com/annonce-vente-appartement-1/')).toBe('orpi')
  })
})

describe('extraireOrpi — vente', () => {
  it('lit prix, surface, pièces, étage', () => {
    const d = extraireOrpi(VENTE)
    expect(d.prix).toBe(20400000)
    expect(d.surface).toBe(59)
    expect(d.nb_pieces).toBe(2)
    expect(d.etage).toBe(1)
  })

  it('mappe storyLocation (étage du bien), pas story (étages de l’immeuble)', () => {
    expect(extraireOrpi(VENTE).etage).toBe(1)
  })

  it('DPE non requis (dpeDisplay=false) → dpe null, pas une lettre par défaut', () => {
    expect(extraireOrpi(VENTE).dpe).toBeNull()
  })

  it('garde le nom de ville accentué', () => {
    expect(extraireOrpi(VENTE).ville).toBe('Saint-Égrève')
    expect(extraireOrpi(VENTE).code_postal).toBe('38120')
  })

  it('charges absentes → null', () => {
    expect(extraireOrpi(VENTE).charges).toBeNull()
  })
})

describe('extraireOrpi — location', () => {
  it('lit le loyer en centimes', () => {
    expect(extraireOrpi(LOCATION).prix).toBe(74000)
  })

  it('convertit l’indice DPE numérique en lettre', () => {
    expect(extraireOrpi(LOCATION).dpe).toBe('C')
  })

  it('lit la provision pour charges', () => {
    expect(extraireOrpi(LOCATION).charges).toBe(1200)
  })

  it('arrondit une surface décimale', () => {
    expect(extraireOrpi(LOCATION).surface).toBe(44)
  })

  it('récupère les photos', () => {
    expect(extraireOrpi(LOCATION).photos).toHaveLength(2)
  })
})

describe('extraireOrpi — cas limites', () => {
  it('estateData absent → objet vide', () => {
    expect(extraireOrpi(undefined)).toEqual({})
  })

  it('estateData invalide → objet vide', () => {
    expect(extraireOrpi('{pas du json')).toEqual({})
  })
})

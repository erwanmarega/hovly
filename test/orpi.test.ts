import { describe, it, expect } from 'vitest'
import { extractOrpi } from '../server/utils/scrape/extract'
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

describe('extractOrpi — vente', () => {
  it('lit prix, surface, pièces, étage', () => {
    const d = extractOrpi(VENTE)
    expect(d.prix).toBe(20400000)
    expect(d.surface).toBe(59)
    expect(d.nb_pieces).toBe(2)
    expect(d.etage).toBe(1)
  })

  it('mappe storyLocation (étage du bien), pas story (étages de l’immeuble)', () => {
    expect(extractOrpi(VENTE).etage).toBe(1)
  })

  it('DPE non requis (dpeDisplay=false) → dpe null, pas une lettre par défaut', () => {
    expect(extractOrpi(VENTE).dpe).toBeNull()
  })

  it('garde le nom de ville accentué', () => {
    expect(extractOrpi(VENTE).ville).toBe('Saint-Égrève')
    expect(extractOrpi(VENTE).code_postal).toBe('38120')
  })

  it('charges absentes → null', () => {
    expect(extractOrpi(VENTE).charges).toBeNull()
  })
})

describe('extractOrpi — location', () => {
  it('lit le loyer en centimes', () => {
    expect(extractOrpi(LOCATION).prix).toBe(74000)
  })

  it('convertit l’indice DPE numérique en lettre', () => {
    expect(extractOrpi(LOCATION).dpe).toBe('C')
  })

  it('lit la provision pour charges', () => {
    expect(extractOrpi(LOCATION).charges).toBe(1200)
  })

  it('arrondit une surface décimale', () => {
    expect(extractOrpi(LOCATION).surface).toBe(44)
  })

  it('récupère les photos', () => {
    expect(extractOrpi(LOCATION).photos).toHaveLength(2)
  })
})

describe('extractOrpi — cas limites', () => {
  it('estateData absent → objet vide', () => {
    expect(extractOrpi(undefined)).toEqual({})
  })

  it('estateData invalide → objet vide', () => {
    expect(extractOrpi('{pas du json')).toEqual({})
  })
})

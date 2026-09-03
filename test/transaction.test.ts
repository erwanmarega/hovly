import { describe, it, expect } from 'vitest'
import { detectTransaction } from '../server/utils/scrape/transaction'

const euros = (n: number) => n * 100

describe('detectTransaction — motifs d’URL', () => {
  it.each([
    ['https://www.leboncoin.fr/ad/ventes_immobilieres/2456789', 'achat'],
    ['https://www.leboncoin.fr/ad/locations/2456789', 'location'],
    ['https://www.bienici.com/annonce/vente/paris-75011/appartement/123', 'achat'],
    ['https://www.bienici.com/annonce/location/lyon-69006/appartement/123', 'location'],
    ['https://www.seloger.com/annonces/achat/appartement/paris-11eme/123.htm', 'achat'],
    ['https://www.seloger.com/annonces/location/appartement/paris-11eme/123.htm', 'location'],
    ['https://www.logic-immo.com/detail-vente-123.htm', 'achat'],
    ['https://www.logic-immo.com/detail-location-123.htm', 'location'],
    ['https://www.century21.fr/acheter/appartement/123', 'achat'],
    ['https://www.century21.fr/louer/appartement/123', 'location'],
    ['https://www.orpi.com/annonce-vente-appartement-t2-lyon-69001-abc/', 'achat'],
    ['https://www.orpi.com/annonce-location-appartement-t2-lyon-69001-abc/', 'location']
  ] as const)('%s → %s', (url, attendu) => {
    expect(detectTransaction(url, null)).toBe(attendu)
  })

  it('le motif prime sur le prix', () => {
    // Une location de luxe à 60 000 €/mois reste une location.
    expect(
      detectTransaction('https://www.leboncoin.fr/ad/locations/123', euros(60_000))
    ).toBe('location')
    // Une viager ou une chambre de bonne à 30 000 € reste un achat.
    expect(
      detectTransaction('https://www.seloger.com/annonces/achat/appartement/x.htm', euros(30_000))
    ).toBe('achat')
  })
})

describe('detectTransaction — repli sur le prix', () => {
  it('50 000 € et au-delà → achat', () => {
    expect(detectTransaction('https://www.pap.fr/annonces/x', euros(50_000))).toBe('achat')
    expect(detectTransaction('https://www.pap.fr/annonces/x', euros(250_000))).toBe('achat')
  })

  it('en dessous → location', () => {
    expect(detectTransaction('https://www.pap.fr/annonces/x', euros(49_999))).toBe('location')
    expect(detectTransaction('https://www.pap.fr/annonces/x', euros(1_200))).toBe('location')
  })

  it('sans prix → location', () => {
    expect(detectTransaction('https://www.pap.fr/annonces/x', null)).toBe('location')
  })
})

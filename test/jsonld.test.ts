import { describe, it, expect } from 'vitest'
import { extract, isSearchPage, flattenJsonLd, type PageData } from '../server/utils/scrape/extract'

const page = (over: Partial<PageData> = {}): PageData => ({
  title: '',
  ogTitle: '',
  ogImages: [],
  jsonLd: [],
  h1: '',
  bodyText: '',
  ...over
})

const BIENICI_ANNONCE = [
  {
    '@context': 'http://schema.org',
    '@type': 'Accommodation',
    address: { '@type': 'PostalAddress', addressLocality: 'Lyon 6e', postalCode: '69006' },
    numberOfRooms: 3,
    floorSize: { '@type': 'QuantitativeValue', unitCode: 'MTK', value: 76.59 }
  },
  {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name: 'Location appartement 3 pièces 77 m², Lyon 6e - 1 410 €',
    offers: {
      '@type': 'Offer',
      priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'EUR', price: 1410.33 }
    }
  }
]

const BIENICI_RECHERCHE = [
  { '@context': 'http://schema.org', '@type': 'BreadcrumbList', itemListElement: [] },
  {
    '@context': 'http://schema.org',
    '@type': 'Product',
    name: '107 appartements à Lyon 6e',
    offers: {
      '@type': 'AggregateOffer',
      offerCount: 107,
      lowPrice: 550,
      highPrice: 8000,
      priceCurrency: 'EUR'
    }
  }
]

describe('flattenJsonLd', () => {
  it('déplie les tableaux et les @graph', () => {
    const flat = flattenJsonLd([
      [{ '@type': 'A' }, { '@type': 'B' }],
      { '@type': 'C', '@graph': [{ '@type': 'D' }] }
    ])
    expect(flat.map((n) => n['@type'])).toEqual(['A', 'B', 'C', 'D'])
  })

  it('ignore les valeurs non exploitables', () => {
    expect(flattenJsonLd([null, undefined, 'texte', 42])).toEqual([])
  })
})

describe('extract — agrégation multi-nœuds (cas Bien’ici)', () => {
  it('combine l’adresse du nœud Accommodation et le prix du nœud Product', () => {
    const d = extract(page({ jsonLd: BIENICI_ANNONCE }))

    expect(d.prix).toBe(141000)
    expect(d.surface).toBe(77)
    expect(d.nb_pieces).toBe(3)
    expect(d.ville).toBe('Lyon')
    expect(d.code_postal).toBe('69006')
  })

  it('ne se laisse plus piéger par le corps de page quand le JSON-LD suffit', () => {
    const d = extract(
      page({
        jsonLd: BIENICI_ANNONCE,
        bodyText: 'Autres annonces : 550 € 48 m² 2 pièces — 700 € 60 m² 2 pièces'
      })
    )
    expect(d.prix).toBe(141000)
    expect(d.surface).toBe(77)
    expect(d.nb_pieces).toBe(3)
  })

  it('garde le repli texte quand le JSON-LD est vide', () => {
    const d = extract(page({ bodyText: 'Loyer 1 410 € — 77 m² — 3 pièces' }))
    expect(d.prix).toBe(141000)
    expect(d.surface).toBe(77)
    expect(d.nb_pieces).toBe(3)
  })

  it('ignore un prix agrégé au profit du prix réel', () => {
    const d = extract(
      page({
        jsonLd: [
          { '@type': 'Product', offers: { '@type': 'AggregateOffer', offerCount: 107, lowPrice: 550 } },
          { '@type': 'Accommodation', offers: { '@type': 'Offer', price: 1410 } }
        ]
      })
    )
    expect(d.prix).toBe(141000)
  })
})

describe('isSearchPage', () => {
  it('reconnaît une page de résultats Bien’ici', () => {
    expect(isSearchPage(page({ jsonLd: BIENICI_RECHERCHE }))).toBe(true)
  })

  it('laisse passer une vraie annonce', () => {
    expect(isSearchPage(page({ jsonLd: BIENICI_ANNONCE }))).toBe(false)
  })

  it('laisse passer une page sans JSON-LD', () => {
    expect(isSearchPage(page({ bodyText: 'Appartement 3 pièces' }))).toBe(false)
  })

  it('laisse passer un agrégat accompagné de vraies caractéristiques', () => {
    expect(
      isSearchPage(
        page({
          jsonLd: [
            ...BIENICI_RECHERCHE,
            { '@type': 'Accommodation', floorSize: { value: 77 }, numberOfRooms: 3 }
          ]
        })
      )
    ).toBe(false)
  })

  it('laisse passer un agrégat d’une seule offre', () => {
    expect(
      isSearchPage(
        page({
          jsonLd: [
            { '@type': 'Product', offers: { '@type': 'AggregateOffer', offerCount: 1, lowPrice: 900 } }
          ]
        })
      )
    ).toBe(false)
  })
})

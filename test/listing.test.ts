import { describe, it, expect } from 'vitest'
import {
  adsFromJsonLd,
  adsFromLinks,
  leboncoinAds,
  extractAds,
  normalizeAdUrl,
  parseCard,
  titleFromCard,
  bestReading,
  LISTING_PATTERN
} from '../server/utils/scrape/listing'
import type { CardLink, PageData } from '../server/utils/scrape/extract'

const page = (over: Partial<PageData> = {}): PageData => ({
  title: '',
  ogTitle: '',
  ogImages: [],
  jsonLd: [],
  h1: '',
  bodyText: '',
  ...over
})

describe('normalizeAdUrl', () => {
  it('résout une URL relative contre la page de résultats', () => {
    expect(normalizeAdUrl('/ad/locations/123456', 'https://www.leboncoin.fr/recherche')).toBe(
      'https://www.leboncoin.fr/ad/locations/123456'
    )
  })

  it('supprime query et hash quand l’id vit dans le chemin', () => {
    expect(
      normalizeAdUrl('https://www.pap.fr/annonces/t2-paris-r123456789?position=3#photos')
    ).toBe('https://www.pap.fr/annonces/t2-paris-r123456789')
  })

  it('garde la query quand le chemin ne porte aucun id', () => {
    expect(normalizeAdUrl('https://exemple.fr/annonce?id=42')).toBe(
      'https://exemple.fr/annonce?id=42'
    )
  })

  it('rejette une URL non http', () => {
    expect(normalizeAdUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeAdUrl('pas une url')).toBeNull()
  })
})

describe('parseCard', () => {
  it('lit loyer, surface et pièces dans le texte d’une carte', () => {
    const c = parseCard('Appartement 3 pièces 62,5 m² Paris 75011 — 1 250 € CC')
    expect(c.prix).toBe(125000)
    expect(c.surface).toBe(63)
    expect(c.nb_pieces).toBe(3)
    expect(c.code_postal).toBe('75011')
  })

  it('comprend la notation T2', () => {
    expect(parseCard('Studio T2 - 890 €').nb_pieces).toBe(2)
  })

  it('rend null sur une carte illisible plutôt que d’inventer', () => {
    const c = parseCard('Voir toutes les annonces')
    expect(c.prix).toBeNull()
    expect(c.surface).toBeNull()
    expect(c.nb_pieces).toBeNull()
  })

  it('ne prend pas un code postal pour un prix', () => {
    expect(parseCard('Lyon 69006').prix).toBeNull()
  })

  // Textes relevés sur une vraie page de résultats SeLoger : l'ancre est vide et
  // le texte remonté est la carte entière, compteur de carrousel compris.
  it('ignore le compteur de carrousel qui précède le prix', () => {
    const c = parseCard(
      '1 / 24 2 268 € /mois charges comprises Comparez les déménageurs ' +
        'Appartement à louer 1 pièce · 42 m² · dès le 15/09/2026 ' +
        'Aligre-Gare de Lyon, Paris 12ème arrondissement (75012)'
    )
    expect(c.prix).toBe(226800)
    expect(c.surface).toBe(42)
    expect(c.nb_pieces).toBe(1)
  })

  it('lit une carte avec badge DPE et surface décimale', () => {
    const c = parseCard(
      '1 / 5 Nouveau B 3 426 € /mois charges comprises Appartement à louer ' +
        '2 pièces · 1 chambre · 53,8 m² · 8ème étage Nation-Picpus, Paris 12ème (75012)'
    )
    expect(c.prix).toBe(342600)
    expect(c.surface).toBe(54)
    expect(c.nb_pieces).toBe(2)
  })

  // Relevé sur une page Century 21 : abréviation « pcs », surface en « m2 »,
  // décimale à la virgule, prix avant les caractéristiques.
  it('lit l’abréviation « pcs » de Century 21', () => {
    const c = parseCard(
      'Exclusivité CHESSY 77 2 780 € par mois charges comprises 95,3 m2 , Appartement , 4 pcs'
    )
    expect(c.prix).toBe(278000)
    expect(c.surface).toBe(95)
    expect(c.nb_pieces).toBe(4)
  })

  it('lit le singulier « pc »', () => {
    expect(parseCard('LAGNY 77 695 € par mois 21 m2 , Appartement , 1 pc').nb_pieces).toBe(1)
  })

  it('lit un loyer à décimale', () => {
    expect(parseCard('Appartement F4 à louer 1 583,80 € par mois').prix).toBe(158380)
  })

  it('accepte les deux écritures du millier et la décimale', () => {
    expect(parseCard('Loyer 150000 €').prix).toBe(15000000)
    expect(parseCard('Loyer 2.422 €').prix).toBe(242200)
    expect(parseCard('Loyer 1 250,50 €').prix).toBe(125050)
  })
})

describe('titleFromCard', () => {
  it('repart du type de bien pour couper le bruit de la carte', () => {
    expect(
      titleFromCard(
        '1 / 8 E 1 517 € /mois charges comprises Investissez dans l’immobilier ' +
          'Appartement à louer 2 pièces · 41 m² · 1er étage Nation-Picpus'
      )
    ).toBe('Appartement à louer 2 pièces · 41 m² · 1er étage Nation-Picpus')
  })

  it('laisse intact un titre déjà propre', () => {
    expect(titleFromCard('Appartement 3 pièces 62 m² proche métro')).toBe(
      'Appartement 3 pièces 62 m² proche métro'
    )
  })

  it('garde le texte tel quel faute de type de bien reconnu', () => {
    expect(titleFromCard('T3 lumineux plein sud')).toBe('T3 lumineux plein sud')
  })

  it('rend null sur un texte trop court', () => {
    expect(titleFromCard('Voir')).toBeNull()
  })
})

describe('LISTING_PATTERN', () => {
  const fiches: [keyof typeof LISTING_PATTERN, string][] = [
    ['seloger', '/annonces/locations/appartement/paris-11eme-75/roquette/123456789.htm'],
    ['leboncoin', '/ad/locations/2891234567'],
    ['pap', '/annonces/appartement-paris-11e-r123456789'],
    ['logic-immo', '/detail-location/12345678'],
    ['bienici', '/annonce/location/paris-11e/appartement/2pieces/abc'],
    ['century21', '/trouver_logement/detail/1234567/']
  ]

  it.each(fiches)('reconnaît une fiche %s', (source, chemin) => {
    expect(LISTING_PATTERN[source].test(chemin)).toBe(true)
  })

  it('ne prend pas une page de résultats pour une fiche', () => {
    expect(LISTING_PATTERN.seloger.test('/list.htm')).toBe(false)
    expect(LISTING_PATTERN.leboncoin.test('/recherche')).toBe(false)
    expect(LISTING_PATTERN.bienici.test('/recherche/location/paris-11e')).toBe(false)
  })
})

describe('adsFromLinks', () => {
  const link = (href: string, text = '', image = ''): CardLink => ({ href, text, image })

  it('ne retient que les liens vers des fiches du même site', () => {
    const ads = adsFromLinks(
      [
        link('/annonces/locations/appartement/paris-11eme-75/roquette/123456789.htm', 'T2 1 100 €'),
        link('/list.htm?ci=750111', 'Page 2'),
        link('https://www.facebook.com/annonces/locations/x/999999.htm', 'Partager'),
        link('/aide/contact', 'Contact')
      ],
      'seloger',
      'https://www.seloger.com/list.htm?ci=750111'
    )

    expect(ads).toHaveLength(1)
    expect(ads[0]!.url).toBe(
      'https://www.seloger.com/annonces/locations/appartement/paris-11eme-75/roquette/123456789.htm'
    )
    expect(ads[0]!.prix).toBe(110000)
  })

  it('fusionne le lien photo et le lien titre de la même annonce', () => {
    const ads = adsFromLinks(
      [
        link('/ad/locations/2891234567', '', 'https://img.leboncoin.fr/api/v1/photo.jpg'),
        link('/ad/locations/2891234567', 'Appartement 2 pièces 40 m² 980 €')
      ],
      'leboncoin',
      'https://www.leboncoin.fr/recherche?category=10'
    )

    expect(ads).toHaveLength(1)
    expect(ads[0]!.photo).toBe('https://img.leboncoin.fr/api/v1/photo.jpg')
    expect(ads[0]!.prix).toBe(98000)
    expect(ads[0]!.surface).toBe(40)
  })

  it('écarte les images de décor', () => {
    const ads = adsFromLinks(
      [link('/ad/locations/2891234567', 'T1 700 €', 'https://cdn.site.fr/static/logo.svg')],
      'leboncoin',
      'https://www.leboncoin.fr/recherche'
    )
    expect(ads[0]!.photo).toBeNull()
  })
})

describe('adsFromJsonLd', () => {
  it('lit un ItemList', () => {
    const ads = adsFromJsonLd(
      [
        {
          '@type': 'ItemList',
          itemListElement: [
            {
              '@type': 'ListItem',
              item: {
                url: '/annonces/appartement-lyon-r123456789',
                name: 'T3 Lyon 6e',
                offers: { price: '1100' },
                floorSize: { value: '62' },
                numberOfRooms: 3,
                address: { addressLocality: 'Lyon', postalCode: '69006' }
              }
            }
          ]
        }
      ],
      'https://www.pap.fr/annonce/locations'
    )

    expect(ads).toHaveLength(1)
    expect(ads[0]).toMatchObject({
      url: 'https://www.pap.fr/annonces/appartement-lyon-r123456789',
      titre: 'T3 Lyon 6e',
      prix: 110000,
      surface: 62,
      nb_pieces: 3,
      ville: 'Lyon',
      code_postal: '69006'
    })
  })

  it('ignore un JSON-LD sans liste', () => {
    expect(adsFromJsonLd([{ '@type': 'Organization', name: 'PAP' }], 'https://pap.fr')).toEqual(
      []
    )
  })
})

describe('leboncoinAds', () => {
  const nextData = JSON.stringify({
    props: {
      pageProps: {
        searchData: {
          ads: [
            {
              list_id: 2891234567,
              url: 'https://www.leboncoin.fr/ad/locations/2891234567',
              subject: 'Appartement T2 refait à neuf',
              price: [980],
              attributes: [
                { key: 'square', value: '42' },
                { key: 'rooms', value: '2' }
              ],
              images: { urls: ['https://img.leboncoin.fr/api/v1/photo.jpg'] },
              location: { city: 'Paris', zipcode: '75011' }
            }
          ]
        }
      }
    }
  })

  it('lit les cartes du __NEXT_DATA__', () => {
    const ads = leboncoinAds(nextData)
    expect(ads).toHaveLength(1)
    expect(ads[0]).toMatchObject({
      url: 'https://www.leboncoin.fr/ad/locations/2891234567',
      titre: 'Appartement T2 refait à neuf',
      prix: 98000,
      surface: 42,
      nb_pieces: 2,
      ville: 'Paris',
      code_postal: '75011'
    })
  })

  it('ne casse pas sur un JSON absent ou invalide', () => {
    expect(leboncoinAds(undefined)).toEqual([])
    expect(leboncoinAds('{oups')).toEqual([])
  })
})

describe('extractAds', () => {
  it('complète les données du DOM avec celles du JSON-LD', () => {
    const ads = extractAds(
      page({
        jsonLd: [
          {
            '@type': 'ItemList',
            itemListElement: [
              {
                item: {
                  url: 'https://www.pap.fr/annonces/t2-paris-r123456789',
                  name: 'T2 Paris 11e',
                  address: { addressLocality: 'Paris', postalCode: '75011' }
                }
              }
            ]
          }
        ],
        links: [
          {
            href: '/annonces/t2-paris-r123456789?position=1',
            text: '2 pièces 40 m² 980 €',
            image: 'https://cdn.pap.fr/photos/1.jpg'
          }
        ]
      }),
      'pap',
      'https://www.pap.fr/annonce/locations'
    )

    expect(ads).toHaveLength(1)
    expect(ads[0]).toMatchObject({
      titre: 'T2 Paris 11e',
      ville: 'Paris',
      prix: 98000,
      surface: 40,
      photo: 'https://cdn.pap.fr/photos/1.jpg'
    })
  })

  it('rend une liste vide quand la page ne contient aucune fiche', () => {
    expect(
      extractAds(page({ links: [{ href: '/aide', text: 'Aide' }] }), 'pap', 'https://www.pap.fr/x')
    ).toEqual([])
  })
})

describe('bestReading', () => {
  it('préfère la carte quand l’ancre n’est qu’un badge', () => {
    const l = bestReading({
      href: '/trouver_logement/detail/176/',
      text: 'Exclusivité',
      cardText: 'SERRIS 77 62,93 m2, 3 pièces Ref : 176 Appartement F3 à louer 1 620 € par mois'
    })

    expect(l.fields.prix).toBe(162000)
    expect(l.fields.surface).toBe(63)
    expect(l.fields.nb_pieces).toBe(3)
    expect(l.title).toContain('Appartement F3 à louer')
  })

  it('ignore un libellé de bouton au profit de la carte', () => {
    const l = bestReading({
      href: '/trouver_logement/detail/176/',
      text: 'Voir le détail du bien',
      cardText: 'CHESSY 45 m2, 2 pièces Appartement F2 à louer 980 € par mois'
    })

    expect(l.fields.prix).toBe(98000)
    expect(l.title).not.toContain('Voir le détail')
  })

  it('garde l’ancre à égalité de signal — elle est plus étroite', () => {
    const l = bestReading({
      href: '/annonces/x-r123456789',
      text: 'Appartement 3 pièces 62 m²',
      cardText: 'Trier par prix Appartement 3 pièces 62 m²'
    })

    expect(l.title).toBe('Appartement 3 pièces 62 m²')
  })

  it('fonctionne sans carte (ancre porteuse, aucun motif)', () => {
    const l = bestReading({ href: '/x', text: 'Studio 20 m² 700 €' })
    expect(l.fields.prix).toBe(70000)
    expect(l.signal).toBe(2)
  })
})

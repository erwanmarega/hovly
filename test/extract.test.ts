import { describe, it, expect } from 'vitest'
import {
  entier,
  decimal,
  imgValide,
  cleNormalisee,
  collecterPhotos,
  extraire,
  extraireLeboncoin,
  type PageData
} from '../server/utils/scrape/extract'

describe('entier', () => {
  it('parse un entier simple', () => {
    expect(entier('1570')).toBe(1570)
  })

  it('strip le séparateur de milliers FR (point)', () => {
    expect(entier('1.570 €')).toBe(1570)
    expect(entier('1 200 000 €')).toBe(1200000)
  })

  it('retourne null si pas de chiffre', () => {
    expect(entier('abc')).toBeNull()
    expect(entier('')).toBeNull()
    expect(entier(undefined)).toBeNull()
  })
})

describe('decimal', () => {
  it('parse une surface décimale', () => {
    expect(decimal('42 m²')).toBe(42)
    expect(decimal('9,92 m²')).toBe(9.92)
    expect(decimal('33.5')).toBe(33.5)
  })

  it('retourne null si vide', () => {
    expect(decimal(undefined)).toBeNull()
    expect(decimal('m²')).toBeNull()
  })
})

describe('imgValide', () => {
  it('accepte une vraie photo CDN', () => {
    expect(imgValide('https://cdn.pap.fr/photos/pap/05/0-p1.jpg')).toBe(true)
    expect(imgValide('https://mms.seloger.com/a/b.jpg?ci_seal=xyz')).toBe(true)
  })

  it('rejette le bruit UI', () => {
    expect(imgValide('https://x.com/logo.png')).toBe(false)
    expect(imgValide('https://x.com/sprite-icons.svg')).toBe(false)
    expect(imgValide('https://www.seloger.com/shared/images/media/selection_property_house.png')).toBe(false)
    expect(imgValide('https://maps.google.com/staticmap.png')).toBe(false)
  })

  it('rejette data URI et non-http', () => {
    expect(imgValide('data:image/png;base64,AAAA')).toBe(false)
    expect(imgValide('//cdn/x.jpg')).toBe(false)
    expect(imgValide('')).toBe(false)
  })
})

describe('cleNormalisee', () => {
  it('ignore la query string', () => {
    expect(cleNormalisee('https://h.com/a/b.jpg?seal=1')).toBe(
      cleNormalisee('https://h.com/a/b.jpg?seal=2')
    )
  })

  it('ignore les tokens de taille dans le path', () => {
    expect(cleNormalisee('https://h.com/360x240/photo.jpg')).toBe(
      cleNormalisee('https://h.com/800x600/photo.jpg')
    )
  })
})

describe('collecterPhotos', () => {
  const base = (over: Partial<PageData>): PageData => ({
    title: '',
    ogTitle: '',
    ogImages: [],
    jsonLd: [],
    h1: '',
    bodyText: '',
    ...over
  })

  it('fusionne og + dom + scripts et dédupe', () => {
    const data = base({
      ogImages: ['https://cdn.x.fr/photos/1.jpg'],
      domImages: ['https://cdn.x.fr/photos/1.jpg?v=2', 'https://cdn.x.fr/photos/2.jpg'],
      scriptImages: ['https://cdn.x.fr/photos/3.webp']
    })
    const out = collecterPhotos(data, null)
    expect(out).toHaveLength(3)
  })

  it('inclut node.image (string ou objet)', () => {
    const out = collecterPhotos(base({}), { image: { url: 'https://cdn.x.fr/photos/9.jpg' } })
    expect(out).toEqual(['https://cdn.x.fr/photos/9.jpg'])
  })

  it('filtre le bruit et cap à 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `https://cdn.x.fr/photos/${i}.jpg`)
    const data = base({ domImages: ['https://x.fr/logo.png', ...many] })
    const out = collecterPhotos(data, null)
    expect(out).toHaveLength(20)
    expect(out.some((u) => u.includes('logo'))).toBe(false)
  })
})

describe('extraire', () => {
  it('extrait prix en centimes, surface arrondie, dpe, cp', () => {
    const data: PageData = {
      title: 'Annonce',
      ogTitle: 'Appartement T2 Paris',
      ogImages: ['https://cdn.x.fr/photos/1.jpg'],
      jsonLd: [],
      h1: '',
      bodyText: 'Loyer 1.570 € charges comprises. Surface 42,3 m². 3 pièces. 2ème étage. DPE : D. 75011 Paris',
    }
    const r = extraire(data)
    expect(r.titre).toBe('Appartement T2 Paris')
    expect(r.prix).toBe(157000)
    expect(r.surface).toBe(42)
    expect(r.nb_pieces).toBe(3)
    expect(r.etage).toBe(2)
    expect(r.dpe).toBe('D')
    expect(r.code_postal).toBe('75011')
    expect(r.photos).toEqual(['https://cdn.x.fr/photos/1.jpg'])
  })

  it('priorise le prix JSON-LD sur le regex body', () => {
    const data: PageData = {
      title: '',
      ogTitle: 'Studio',
      ogImages: [],
      jsonLd: [{ '@type': 'Apartment', name: 'Studio', offers: { price: '650' } }],
      h1: '',
      bodyText: 'autour de 999 € ailleurs'
    }
    const r = extraire(data)
    expect(r.prix).toBe(65000)
  })

  it('extrait le prix niché dans offers.priceSpecification (BienIci)', () => {
    const data: PageData = {
      title: '',
      ogTitle: 'Location appartement 3 pièces 52 m², Meaux - 795 €',
      ogImages: [],
      jsonLd: [
        {
          '@type': 'Product',
          name: 'Location appartement',
          offers: { '@type': 'Offer', priceSpecification: { price: 795, priceCurrency: 'EUR' } }
        }
      ],
      h1: '',
      bodyText: '3 pièces 52 m² 77100 Meaux'
    }
    const r = extraire(data)
    expect(r.prix).toBe(79500)
    expect(r.surface).toBe(52)
    expect(r.code_postal).toBe('77100')
  })

  it('gère une page sans données', () => {
    const data: PageData = {
      title: '', ogTitle: '', ogImages: [], jsonLd: [], h1: '', bodyText: ''
    }
    const r = extraire(data)
    expect(r.prix).toBeNull()
    expect(r.surface).toBeNull()
    expect(r.photos).toEqual([])
  })
})

describe('extraireLeboncoin', () => {
  const nextData = JSON.stringify({
    props: {
      pageProps: {
        ad: {
          subject: 'Appartement 3 pièces 76 m²',
          body: 'T3 meublé secteur Brotteaux',
          price: [1528],
          price_cents: 152800,
          attributes: [
            { key: 'square', value: '76', value_label: '76 m²' },
            { key: 'rooms', value: '3', value_label: '3' },
            { key: 'floor_number', value: '1', value_label: '1' },
            { key: 'monthly_charges', value: '58', value_label: '58 €' },
            { key: 'energy_rate', value: 'c', value_label: 'C' }
          ],
          location: { city: 'Lyon', zipcode: '69006', city_label: 'Lyon 69006 Les Brotteaux' }
        }
      }
    }
  })

  it('parse les champs structurés du __NEXT_DATA__', () => {
    const r = extraireLeboncoin(nextData)
    expect(r.titre).toBe('Appartement 3 pièces 76 m²')
    expect(r.prix).toBe(152800)
    expect(r.surface).toBe(76)
    expect(r.nb_pieces).toBe(3)
    expect(r.etage).toBe(1)
    expect(r.charges).toBe(5800)
    expect(r.dpe).toBe('C')
    expect(r.ville).toBe('Lyon')
    expect(r.code_postal).toBe('69006')
  })

  it('retombe sur price[0] si price_cents absent', () => {
    const sansCents = JSON.parse(nextData)
    delete sansCents.props.pageProps.ad.price_cents
    const r = extraireLeboncoin(JSON.stringify(sansCents))
    expect(r.prix).toBe(152800)
  })

  it('retourne {} si JSON invalide ou ad absent', () => {
    expect(extraireLeboncoin('pas du json')).toEqual({})
    expect(extraireLeboncoin('{}')).toEqual({})
    expect(extraireLeboncoin(undefined)).toEqual({})
  })
})

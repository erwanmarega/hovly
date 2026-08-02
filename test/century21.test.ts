import { describe, it, expect } from 'vitest'
import { extraireCentury21, type PageData } from '../server/utils/scrape/extract'
import { detecterSource } from '../server/utils/scrape/source'

const page = (over: Partial<PageData> = {}): PageData => ({
  title: '',
  ogTitle: '',
  ogImages: [],
  jsonLd: [],
  h1: '',
  bodyText: '',
  ...over
})

const FICHE = page({
  ogTitle: 'Appartement F2 à louer - 2 pièces - 37,07 m2 - Paris - 75005 - ILE-DE-FRANCE',
  bodyText:
    'Ref : 470 1 760 € par mois charges comprises Voir sur la carte ' +
    'Surface totale : 37,1 m2 Surface habitable : 37,1 m2 Type d’appartement : F2 ' +
    'Étage : 1 Nombre de pièces : 2 Chauffage : Individuel À savoir ' +
    'Loyer de base : 1700 € par mois Provision pour charges : 60 € par mois ' +
    'Honoraires charge locataire : 560,87 € Dépôt de garantie : 2400 €',
  domImages: [
    '/imagesBien/s3/202/3770/c21_202_3770_470_8_ABC.jpg',
    'https://www.century21.fr/imagesBien/s3/202/3770/c21_202_3770_470_9_DEF.jpg',
    '/static/logo.svg'
  ]
})

describe('detecterSource', () => {
  it('reconnaît une URL Century 21', () => {
    expect(detecterSource('https://www.century21.fr/trouver_logement/detail/15950286266/')).toBe(
      'century21'
    )
  })

  it('reconnaît le domaine sans www', () => {
    expect(detecterSource('https://century21.fr/trouver_logement/detail/1/')).toBe('century21')
  })
})

describe('extraireCentury21 — prix', () => {
  it('prend le loyer de base, pas le loyer charges comprises', () => {
    expect(extraireCentury21(FICHE).prix).toBe(170000)
  })

  it('ne se laisse pas piéger par la référence collée au prix', () => {
    expect(extraireCentury21(FICHE).prix).not.toBe(47017600000)
  })

  it('lit la provision pour charges', () => {
    expect(extraireCentury21(FICHE).charges).toBe(6000)
  })

  it('ignore honoraires et dépôt de garantie', () => {
    const d = extraireCentury21(FICHE)
    expect(d.prix).toBe(170000)
    expect(d.charges).toBe(6000)
  })

  it('gère un loyer avec décimales', () => {
    const d = extraireCentury21(page({ bodyText: 'Loyer de base : 1 456,50 € par mois' }))
    expect(d.prix).toBe(145700)
  })

  it('extrait le prix de vente après la référence', () => {
    const d = extraireCentury21(
      page({
        bodyText:
          'Ref : 28123 207 000 € Honoraires charge vendeur Surface habitable : 79,57 m2'
      })
    )
    expect(d.prix).toBe(20700000)
  })

  it('ne recolle pas la référence au prix de vente', () => {
    const d = extraireCentury21(
      page({ bodyText: 'Ref : 3997 199 900 € Honoraires charge vendeur' })
    )
    expect(d.prix).toBe(19990000)
  })

  it('le loyer de base prime sur le prix collé à la référence', () => {
    const d = extraireCentury21(
      page({ bodyText: 'Ref : 470 1 760 € par mois Loyer de base : 1 700 € par mois' })
    )
    expect(d.prix).toBe(170000)
  })

  it('laisse le prix absent si le libellé manque', () => {
    expect(extraireCentury21(page({ bodyText: 'Aucune information' })).prix).toBeUndefined()
  })
})

describe('extraireCentury21 — caractéristiques', () => {
  it('préfère la surface habitable', () => {
    const d = extraireCentury21(
      page({ bodyText: 'Surface totale : 80 m2 Surface habitable : 66,3 m2' })
    )
    expect(d.surface).toBe(66)
  })

  it('se rabat sur la surface totale', () => {
    expect(extraireCentury21(page({ bodyText: 'Surface totale : 45,2 m2' })).surface).toBe(45)
  })

  it('lit le nombre de pièces et l’étage', () => {
    const d = extraireCentury21(FICHE)
    expect(d.nb_pieces).toBe(2)
    expect(d.etage).toBe(1)
  })

  it('traduit le rez-de-chaussée en étage 0', () => {
    const d = extraireCentury21(page({ bodyText: 'Appartement en rez-de-chaussée sur cour' }))
    expect(d.etage).toBe(0)
  })

  it('extrait ville et code postal depuis le titre', () => {
    const d = extraireCentury21(FICHE)
    expect(d.ville).toBe('Paris')
    expect(d.code_postal).toBe('75005')
  })
})

describe('extraireCentury21 — photos', () => {
  it('ne garde que les photos du bien et les rend absolues', () => {
    const photos = extraireCentury21(FICHE).photos!
    expect(photos).toHaveLength(2)
    expect(photos.every((p) => p.startsWith('https://www.century21.fr/imagesBien/'))).toBe(true)
  })

  it('dédoublonne les photos', () => {
    const d = extraireCentury21(
      page({
        domImages: ['/imagesBien/a.jpg', '/imagesBien/a.jpg'],
        scriptImages: ['https://www.century21.fr/imagesBien/a.jpg']
      })
    )
    expect(d.photos).toHaveLength(1)
  })

  it('n’expose pas de champ photos sans image du bien', () => {
    expect(extraireCentury21(page({ domImages: ['/static/logo.svg'] })).photos).toBeUndefined()
  })
})

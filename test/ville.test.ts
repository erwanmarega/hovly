import { describe, it, expect } from 'vitest'
import { extraireVille, extraire, type PageData } from '../server/utils/scrape/extract'

const page = (over: Partial<PageData> = {}): PageData => ({
  title: '',
  ogTitle: '',
  ogImages: [],
  jsonLd: [],
  h1: '',
  bodyText: '',
  ...over
})

describe('extraireVille', () => {
  it('lit la ville placée après le code postal', () => {
    expect(extraireVille(['Appartement 3 pièces — 75012 Paris'], '75012')).toBe('Paris')
  })

  it('lit la ville placée avant le code postal entre parenthèses', () => {
    expect(extraireVille(['Location appartement à Cachan (94230)'], '94230')).toBe('Cachan')
  })

  it('retire l’arrondissement du nom de ville', () => {
    expect(extraireVille(['T3 à Paris 12ème (75012)'], '75012')).toBe('Paris')
    expect(extraireVille(['Studio Lyon 6e 69006'], '69006')).toBe('Lyon')
  })

  it('gère les noms composés', () => {
    expect(extraireVille(['77100 Meaux'], '77100')).toBe('Meaux')
    expect(extraireVille(['Bien situé 92100 Boulogne-Billancourt'], '92100')).toBe(
      'Boulogne-Billancourt'
    )
    expect(extraireVille(['13100 Aix-en-Provence — 4 pièces'], '13100')).toBe('Aix-en-Provence')
  })

  it('parcourt les sources dans l’ordre et garde la première exploitable', () => {
    expect(extraireVille([undefined, '', 'blabla 69006 Lyon'], '69006')).toBe('Lyon')
  })

  it('rejette un mot qui n’est pas une ville', () => {
    expect(extraireVille(['75012 Appartement de standing'], '75012')).toBeNull()
    expect(extraireVille(['Studio 75012'], '75012')).toBeNull()
  })

  it('retourne null sans code postal', () => {
    expect(extraireVille(['Paris 12e'], null)).toBeNull()
    expect(extraireVille(['Paris'], 'abc')).toBeNull()
  })

  it('retourne null si le code postal est absent des sources', () => {
    expect(extraireVille(['Bel appartement lumineux'], '75012')).toBeNull()
  })

  it('ignore une capture vide ou trop longue', () => {
    expect(extraireVille(['75012'], '75012')).toBeNull()
  })
})

describe('extraire — champ ville', () => {
  it('privilégie le JSON-LD quand il est présent', () => {
    const d = extraire(
      page({
        jsonLd: [{ '@type': 'Apartment', address: { addressLocality: 'Nantes', postalCode: '44000' } }],
        bodyText: 'Annonce 44000 Rezé'
      })
    )
    expect(d.ville).toBe('Nantes')
  })

  it('se rabat sur le og:title quand le JSON-LD n’a pas de ville', () => {
    const d = extraire(
      page({
        ogTitle: 'Appartement 3 pièces 65 m² — 75012 Paris',
        bodyText: 'Loyer 1 570 € — 65 m²'
      })
    )
    expect(d.ville).toBe('Paris')
    expect(d.code_postal).toBe('75012')
  })

  it('se rabat sur le corps de page en dernier recours', () => {
    const d = extraire(page({ bodyText: 'Charmant T2 à Cachan (94230), proche RER' }))
    expect(d.ville).toBe('Cachan')
  })

  it('reste null si aucune source ne donne la ville', () => {
    const d = extraire(page({ bodyText: 'Bel appartement, 3 pièces, 65 m²' }))
    expect(d.ville).toBeNull()
  })

  it('nettoie une ville sale venue du JSON-LD', () => {
    const d = extraire(
      page({ jsonLd: [{ '@type': 'Apartment', address: { addressLocality: 'Lyon 6e' } }] })
    )
    expect(d.ville).toBe('Lyon')
  })
})

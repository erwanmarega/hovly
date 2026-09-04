import { describe, it, expect } from 'vitest'
import { detectPropertyType } from '../server/utils/scrape/property-type'

describe('detectPropertyType — mots du titre', () => {
  it.each([
    ['Appartement 3 pièces 76 m² - Paris 11e', 'appartement'],
    ['Maison 5 pièces avec jardin - Nantes', 'maison'],
    ['Studio meublé proche métro', 'appartement'],
    ['Duplex lumineux dernier étage', 'appartement'],
    ['Loft atypique quartier bastille', 'appartement'],
    ['Villa avec piscine et vue mer', 'maison'],
    ['Terrain à bâtir 500 m²', null],
    ['Immeuble de rapport 6 lots', null],
    ['', null]
  ] as const)('%s → %s', (titre, attendu) => {
    expect(detectPropertyType(titre)).toBe(attendu)
  })

  it('est insensible à la casse', () => {
    expect(detectPropertyType('MAISON 4 PIÈCES')).toBe('maison')
    expect(detectPropertyType('appartement T2')).toBe('appartement')
  })
})

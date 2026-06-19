import { describe, it, expect } from 'vitest'
import { detecterSource } from '../server/utils/scrape/source'

describe('detecterSource', () => {
  it('reconnaît chaque source supportée', () => {
    expect(detecterSource('https://www.seloger.com/annonces/123.htm')).toBe('seloger')
    expect(detecterSource('https://www.leboncoin.fr/ventes/456')).toBe('leboncoin')
    expect(detecterSource('https://www.pap.fr/annonces/colocation-r401')).toBe('pap')
    expect(detecterSource('https://www.logic-immo.com/detail/789')).toBe('logic-immo')
    expect(detecterSource('https://www.bienici.com/annonce/abc')).toBe('bienici')
  })

  it('ignore le préfixe www', () => {
    expect(detecterSource('https://seloger.com/x')).toBe('seloger')
  })

  it('retourne null pour source non supportée', () => {
    expect(detecterSource('https://www.century21.fr/x')).toBeNull()
  })

  it('retourne null pour URL invalide', () => {
    expect(detecterSource('pas-une-url')).toBeNull()
    expect(detecterSource('')).toBeNull()
  })
})

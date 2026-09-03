import { describe, it, expect } from 'vitest'
import {
  cleanUrl,
  urlKey,
  extractUrls,
  parseUrls,
  importSummary
} from '../app/composables/useBulkImport'

describe('cleanUrl', () => {
  it('retire les paramètres de pistage', () => {
    expect(cleanUrl('https://www.pap.fr/annonces/r1?utm_source=mail&utm_medium=cpc')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
    expect(cleanUrl('https://www.pap.fr/annonces/r1?fbclid=abc')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
  })

  it('conserve les paramètres utiles', () => {
    expect(cleanUrl('https://www.bienici.com/annonce/x?ref=42')).toBe(
      'https://www.bienici.com/annonce/x?ref=42'
    )
  })

  it('retire l’ancre', () => {
    expect(cleanUrl('https://www.pap.fr/annonces/r1#photos')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
  })

  it('nettoie la ponctuation collée', () => {
    expect(cleanUrl('https://www.pap.fr/annonces/r1,')).toBe('https://www.pap.fr/annonces/r1')
    expect(cleanUrl(' https://www.pap.fr/annonces/r1 ')).toBe('https://www.pap.fr/annonces/r1')
  })

  it('complète le protocole manquant', () => {
    expect(cleanUrl('www.pap.fr/annonces/r1')).toBe('https://www.pap.fr/annonces/r1')
  })

  it('laisse tel quel ce qui n’est pas une URL', () => {
    expect(cleanUrl('coucou')).toBe('coucou')
    expect(cleanUrl('')).toBe('')
  })
})

describe('urlKey', () => {
  it('ignore le protocole, le www et la casse', () => {
    expect(urlKey('https://www.PAP.fr/annonces/R1')).toBe(urlKey('http://pap.fr/annonces/r1'))
  })

  it('ignore tous les paramètres, pas seulement le pistage', () => {
    expect(urlKey('https://www.logic-immo.com/detail-location-268323363.htm?serp=abc')).toBe(
      urlKey('https://www.logic-immo.com/detail-location-268323363.htm')
    )
  })

  it('ignore la barre oblique finale', () => {
    expect(urlKey('https://www.pap.fr/annonces/r1/')).toBe(urlKey('https://www.pap.fr/annonces/r1'))
  })

  it('distingue deux annonces différentes', () => {
    expect(urlKey('https://www.pap.fr/annonces/r1')).not.toBe(
      urlKey('https://www.pap.fr/annonces/r2')
    )
  })
})

describe('extractUrls', () => {
  it('découpe sur les sauts de ligne et les espaces', () => {
    const texte = `https://a.fr/1
      https://b.fr/2   https://c.fr/3`
    expect(extractUrls(texte)).toHaveLength(3)
  })

  it('ignore le texte qui n’est pas une URL', () => {
    expect(extractUrls('mes biens :\nhttps://a.fr/1\nvoilà')).toEqual(['https://a.fr/1'])
  })

  it('retourne une liste vide sur du texte vide', () => {
    expect(extractUrls('   \n  ')).toEqual([])
  })
})

describe('parseUrls', () => {
  const pap = 'https://www.pap.fr/annonces/appartement-clichy-92110-r452802672'
  const lbc = 'https://www.leboncoin.fr/ad/locations/3236278421'

  it('détecte la source de chaque URL', () => {
    const r = parseUrls(`${pap}\n${lbc}`)
    expect(r.map((e) => e.source)).toEqual(['pap', 'leboncoin'])
    expect(r.every((e) => e.statut === 'prete')).toBe(true)
  })

  it('signale une source non supportée', () => {
    const r = parseUrls('https://www.example.com/annonce/1')
    expect(r[0]).toMatchObject({ statut: 'source_inconnue', source: null })
  })

  it('signale une annonce déjà en base', () => {
    const r = parseUrls(pap, [pap])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('compare avec la base après nettoyage du pistage', () => {
    const r = parseUrls(`${pap}?utm_source=newsletter`, [pap])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('reconnaît une annonce déjà en base malgré des paramètres différents', () => {
    const enBase = 'https://www.logic-immo.com/detail-location-268323363.htm?serp=xyz'
    const r = parseUrls('https://www.logic-immo.com/detail-location-268323363.htm', [enBase])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('signale un doublon interne à la liste collée', () => {
    const r = parseUrls(`${pap}\n${pap}`)
    expect(r[0]!.statut).toBe('prete')
    expect(r[1]!.statut).toBe('doublon_liste')
  })

  it('ne considère pas deux annonces différentes comme doublons', () => {
    const r = parseUrls(`${pap}\n${lbc}`)
    expect(r.every((e) => e.statut === 'prete')).toBe(true)
  })

  it('conserve l’URL brute pour l’affichage', () => {
    const r = parseUrls(`  ${pap}?utm_source=x  `)
    expect(r[0]!.url).toBe(pap)
    expect(r[0]!.brut).toContain('utm_source')
  })

  it('gère un collage vide', () => {
    expect(parseUrls('')).toEqual([])
  })
})

describe('importSummary', () => {
  it('compte chaque catégorie', () => {
    const entrees = [
      { url: 'a', brut: 'a', source: 'pap' as const, statut: 'prete' as const },
      { url: 'b', brut: 'b', source: 'pap' as const, statut: 'ajoutee' as const },
      { url: 'c', brut: 'c', source: 'pap' as const, statut: 'echec' as const },
      { url: 'd', brut: 'd', source: null, statut: 'source_inconnue' as const },
      { url: 'e', brut: 'e', source: 'pap' as const, statut: 'deja_ajoutee' as const }
    ]
    expect(importSummary(entrees)).toEqual({
      total: 5,
      pretes: 1,
      ajoutees: 1,
      echecs: 1,
      ignorees: 2
    })
  })

  it('gère une liste vide', () => {
    expect(importSummary([])).toEqual({ total: 0, pretes: 0, ajoutees: 0, echecs: 0, ignorees: 0 })
  })
})

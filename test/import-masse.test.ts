import { describe, it, expect } from 'vitest'
import {
  nettoyerUrl,
  cleUrl,
  extraireUrls,
  parserUrls,
  resumeImport
} from '../app/composables/useImportMasse'

describe('nettoyerUrl', () => {
  it('retire les paramètres de pistage', () => {
    expect(nettoyerUrl('https://www.pap.fr/annonces/r1?utm_source=mail&utm_medium=cpc')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
    expect(nettoyerUrl('https://www.pap.fr/annonces/r1?fbclid=abc')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
  })

  it('conserve les paramètres utiles', () => {
    expect(nettoyerUrl('https://www.bienici.com/annonce/x?ref=42')).toBe(
      'https://www.bienici.com/annonce/x?ref=42'
    )
  })

  it('retire l’ancre', () => {
    expect(nettoyerUrl('https://www.pap.fr/annonces/r1#photos')).toBe(
      'https://www.pap.fr/annonces/r1'
    )
  })

  it('nettoie la ponctuation collée', () => {
    expect(nettoyerUrl('https://www.pap.fr/annonces/r1,')).toBe('https://www.pap.fr/annonces/r1')
    expect(nettoyerUrl(' https://www.pap.fr/annonces/r1 ')).toBe('https://www.pap.fr/annonces/r1')
  })

  it('complète le protocole manquant', () => {
    expect(nettoyerUrl('www.pap.fr/annonces/r1')).toBe('https://www.pap.fr/annonces/r1')
  })

  it('laisse tel quel ce qui n’est pas une URL', () => {
    expect(nettoyerUrl('coucou')).toBe('coucou')
    expect(nettoyerUrl('')).toBe('')
  })
})

describe('cleUrl', () => {
  it('ignore le protocole, le www et la casse', () => {
    expect(cleUrl('https://www.PAP.fr/annonces/R1')).toBe(cleUrl('http://pap.fr/annonces/r1'))
  })

  it('ignore tous les paramètres, pas seulement le pistage', () => {
    expect(cleUrl('https://www.logic-immo.com/detail-location-268323363.htm?serp=abc')).toBe(
      cleUrl('https://www.logic-immo.com/detail-location-268323363.htm')
    )
  })

  it('ignore la barre oblique finale', () => {
    expect(cleUrl('https://www.pap.fr/annonces/r1/')).toBe(cleUrl('https://www.pap.fr/annonces/r1'))
  })

  it('distingue deux annonces différentes', () => {
    expect(cleUrl('https://www.pap.fr/annonces/r1')).not.toBe(
      cleUrl('https://www.pap.fr/annonces/r2')
    )
  })
})

describe('extraireUrls', () => {
  it('découpe sur les sauts de ligne et les espaces', () => {
    const texte = `https://a.fr/1
      https://b.fr/2   https://c.fr/3`
    expect(extraireUrls(texte)).toHaveLength(3)
  })

  it('ignore le texte qui n’est pas une URL', () => {
    expect(extraireUrls('mes biens :\nhttps://a.fr/1\nvoilà')).toEqual(['https://a.fr/1'])
  })

  it('retourne une liste vide sur du texte vide', () => {
    expect(extraireUrls('   \n  ')).toEqual([])
  })
})

describe('parserUrls', () => {
  const pap = 'https://www.pap.fr/annonces/appartement-clichy-92110-r452802672'
  const lbc = 'https://www.leboncoin.fr/ad/locations/3236278421'

  it('détecte la source de chaque URL', () => {
    const r = parserUrls(`${pap}\n${lbc}`)
    expect(r.map((e) => e.source)).toEqual(['pap', 'leboncoin'])
    expect(r.every((e) => e.statut === 'prete')).toBe(true)
  })

  it('signale une source non supportée', () => {
    const r = parserUrls('https://www.century21.fr/annonce/1')
    expect(r[0]).toMatchObject({ statut: 'source_inconnue', source: null })
  })

  it('signale une annonce déjà en base', () => {
    const r = parserUrls(pap, [pap])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('compare avec la base après nettoyage du pistage', () => {
    const r = parserUrls(`${pap}?utm_source=newsletter`, [pap])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('reconnaît une annonce déjà en base malgré des paramètres différents', () => {
    const enBase = 'https://www.logic-immo.com/detail-location-268323363.htm?serp=xyz'
    const r = parserUrls('https://www.logic-immo.com/detail-location-268323363.htm', [enBase])
    expect(r[0]!.statut).toBe('deja_ajoutee')
  })

  it('signale un doublon interne à la liste collée', () => {
    const r = parserUrls(`${pap}\n${pap}`)
    expect(r[0]!.statut).toBe('prete')
    expect(r[1]!.statut).toBe('doublon_liste')
  })

  it('ne considère pas deux annonces différentes comme doublons', () => {
    const r = parserUrls(`${pap}\n${lbc}`)
    expect(r.every((e) => e.statut === 'prete')).toBe(true)
  })

  it('conserve l’URL brute pour l’affichage', () => {
    const r = parserUrls(`  ${pap}?utm_source=x  `)
    expect(r[0]!.url).toBe(pap)
    expect(r[0]!.brut).toContain('utm_source')
  })

  it('gère un collage vide', () => {
    expect(parserUrls('')).toEqual([])
  })
})

describe('resumeImport', () => {
  it('compte chaque catégorie', () => {
    const entrees = [
      { url: 'a', brut: 'a', source: 'pap' as const, statut: 'prete' as const },
      { url: 'b', brut: 'b', source: 'pap' as const, statut: 'ajoutee' as const },
      { url: 'c', brut: 'c', source: 'pap' as const, statut: 'echec' as const },
      { url: 'd', brut: 'd', source: null, statut: 'source_inconnue' as const },
      { url: 'e', brut: 'e', source: 'pap' as const, statut: 'deja_ajoutee' as const }
    ]
    expect(resumeImport(entrees)).toEqual({
      total: 5,
      pretes: 1,
      ajoutees: 1,
      echecs: 1,
      ignorees: 2
    })
  })

  it('gère une liste vide', () => {
    expect(resumeImport([])).toEqual({ total: 0, pretes: 0, ajoutees: 0, echecs: 0, ignorees: 0 })
  })
})

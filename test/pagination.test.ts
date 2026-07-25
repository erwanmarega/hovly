import { describe, it, expect } from 'vitest'

function fenetrePages(page: number, nbPages: number): (number | '…')[] {
  if (nbPages <= 7) return Array.from({ length: nbPages }, (_, i) => i + 1)

  const out: (number | '…')[] = [1]
  const debut = Math.max(2, page - 1)
  const fin = Math.min(nbPages - 1, page + 1)

  if (debut > 2) out.push('…')
  for (let i = debut; i <= fin; i++) out.push(i)
  if (fin < nbPages - 1) out.push('…')
  out.push(nbPages)
  return out
}

const nbPages = (total: number, parPage: number) => Math.max(1, Math.ceil(total / parPage))
const tranche = <T>(liste: T[], page: number, parPage: number) =>
  liste.slice((page - 1) * parPage, page * parPage)

const liste = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('nombre de pages', () => {
  it.each([
    [0, 12, 1],
    [1, 12, 1],
    [12, 12, 1],
    [13, 12, 2],
    [24, 12, 2],
    [25, 12, 3]
  ])('%i biens sur %i par page → %i page(s)', (total, parPage, attendu) => {
    expect(nbPages(total, parPage)).toBe(attendu)
  })
})

describe('découpage', () => {
  it('renvoie les 12 premiers sur la page 1', () => {
    expect(tranche(liste(30), 1, 12)).toEqual(liste(12))
  })

  it('renvoie le bon bloc au milieu', () => {
    expect(tranche(liste(30), 2, 12)[0]).toBe(13)
    expect(tranche(liste(30), 2, 12)).toHaveLength(12)
  })

  it('renvoie un dernier bloc partiel', () => {
    expect(tranche(liste(30), 3, 12)).toEqual([25, 26, 27, 28, 29, 30])
  })

  it('renvoie une liste vide au-delà de la dernière page', () => {
    expect(tranche(liste(30), 9, 12)).toEqual([])
  })
})

describe('fenêtre de pages', () => {
  it('affiche toutes les pages jusqu’à 7', () => {
    expect(fenetrePages(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(fenetrePages(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('tronque à droite quand on est au début', () => {
    expect(fenetrePages(1, 20)).toEqual([1, 2, '…', 20])
  })

  it('tronque des deux côtés au milieu', () => {
    expect(fenetrePages(10, 20)).toEqual([1, '…', 9, 10, 11, '…', 20])
  })

  it('tronque à gauche quand on est à la fin', () => {
    expect(fenetrePages(20, 20)).toEqual([1, '…', 19, 20])
  })

  it('garde toujours la première et la dernière page', () => {
    for (const p of [1, 5, 12, 20]) {
      const f = fenetrePages(p, 20)
      expect(f[0]).toBe(1)
      expect(f[f.length - 1]).toBe(20)
    }
  })

  it('n’insère jamais deux ellipses consécutives', () => {
    for (let p = 1; p <= 20; p++) {
      const f = fenetrePages(p, 20)
      expect(f.some((v, i) => v === '…' && f[i + 1] === '…')).toBe(false)
    }
  })
})

describe('correction de la page courante', () => {
  const corriger = (page: number, total: number, parPage: number) =>
    Math.min(page, nbPages(total, parPage))

  it('ramène sur la dernière page si la liste rétrécit', () => {
    expect(corriger(5, 20, 12)).toBe(2)
  })

  it('ramène sur la page 1 quand la liste se vide', () => {
    expect(corriger(3, 0, 12)).toBe(1)
  })

  it('laisse la page inchangée si elle reste valide', () => {
    expect(corriger(2, 30, 12)).toBe(2)
  })
})

import type { Property } from '~/types'

export interface Similarity {
  score: number
  reasons: string[]
}

export const DUPLICATE_THRESHOLD = 0.75

const STOP_WORDS = new Set([
  'a',
  'au',
  'aux',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'et',
  'en',
  'avec',
  'sans',
  'pour',
  'sur',
  'location',
  'louer',
  'appartement',
  'appart',
  'maison',
  'meuble',
  'meublee',
  'pieces',
  'piece',
  'chambre',
  'm2'
])

export function normalizeCity(ville: string | null | undefined): string {
  if (!ville) return ''
  return ville
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\d{1,2}\s*(?:er|ers|e|eme|ème)\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

function titleWords(titre: string | null | undefined): Set<string> {
  if (!titre) return new Set()
  const mots = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !STOP_WORDS.has(m))
  return new Set(mots)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let common = 0
  for (const m of a) if (b.has(m)) common++
  return common / (a.size + b.size - common)
}

const isClose = (a: number, b: number, tolerance: number) => {
  const max = Math.max(a, b)
  return max === 0 ? a === b : Math.abs(a - b) / max <= tolerance
}

export function similarity(a: Property, b: Property): Similarity {
  if (a.id === b.id) return { score: 0, reasons: [] }
  if (a.url_source && a.url_source === b.url_source) {
    return { score: 1, reasons: ['URL identique'] }
  }

  const sameCity = normalizeCity(a.ville) && normalizeCity(a.ville) === normalizeCity(b.ville)
  const samePostalCode = !!a.code_postal && a.code_postal === b.code_postal
  if (!sameCity && !samePostalCode) return { score: 0, reasons: [] }

  const reasons: string[] = []
  let score = 0

  if (samePostalCode) {
    score += 0.15
    reasons.push('Même code postal')
  } else {
    score += 0.05
    reasons.push('Même ville')
  }

  if (a.surface > 0 && b.surface > 0) {
    if (isClose(a.surface, b.surface, 0.02)) {
      score += 0.35
      reasons.push('Surface identique')
    } else if (isClose(a.surface, b.surface, 0.06)) {
      score += 0.18
      reasons.push('Surface voisine')
    }
  }

  if (a.nb_pieces > 0 && a.nb_pieces === b.nb_pieces) {
    score += 0.2
    reasons.push('Même nombre de pièces')
  }

  if (a.prix > 0 && b.prix > 0) {
    if (isClose(a.prix, b.prix, 0.02)) {
      score += 0.25
      reasons.push('Prix identique')
    } else if (isClose(a.prix, b.prix, 0.06)) {
      score += 0.12
      reasons.push('Prix voisin')
    }
  }

  const commonWords = jaccard(titleWords(a.titre), titleWords(b.titre))
  if (commonWords >= 0.5) {
    score += 0.15
    reasons.push('Titre très proche')
  } else if (commonWords >= 0.25) {
    score += 0.07
    reasons.push('Titre proche')
  }

  return { score: Math.min(1, Math.round(score * 100) / 100), reasons }
}

export function areDuplicates(a: Property, b: Property, seuil = DUPLICATE_THRESHOLD): boolean {
  return similarity(a, b).score >= seuil
}

export function groupDuplicates(biens: Property[], seuil = DUPLICATE_THRESHOLD): Property[][] {
  const parent = new Map<string, string>()
  const root = (id: string): string => {
    const p = parent.get(id)
    if (!p || p === id) return id
    const r = root(p)
    parent.set(id, r)
    return r
  }
  const union = (x: string, y: string) => {
    const rx = root(x)
    const ry = root(y)
    if (rx !== ry) parent.set(rx, ry)
  }

  for (const b of biens) parent.set(b.id, b.id)

  for (let i = 0; i < biens.length; i++) {
    for (let j = i + 1; j < biens.length; j++) {
      if (areDuplicates(biens[i]!, biens[j]!, seuil)) union(biens[i]!.id, biens[j]!.id)
    }
  }

  const groups = new Map<string, Property[]>()
  for (const b of biens) {
    const r = root(b.id)
    groups.set(r, [...(groups.get(r) ?? []), b])
  }

  return [...groups.values()].filter((g) => g.length > 1)
}

export function duplicatesOf(bien: Property, biens: Property[], seuil = DUPLICATE_THRESHOLD): Property[] {
  return biens.filter((b) => b.id !== bien.id && areDuplicates(bien, b, seuil))
}

export function representatives(biens: Property[], seuil = DUPLICATE_THRESHOLD): Property[] {
  const groups = groupDuplicates(biens, seuil)
  const toExclude = new Set<string>()

  for (const groupe of groups) {
    const sorted = [...groupe].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    for (const b of sorted.slice(1)) toExclude.add(b.id)
  }

  return biens.filter((b) => !toExclude.has(b.id))
}

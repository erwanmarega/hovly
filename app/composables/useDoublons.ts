import type { Bien } from '~/types'

export interface Similarite {
  score: number
  raisons: string[]
}

export const SEUIL_DOUBLON = 0.75

const MOTS_VIDES = new Set([
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

export function normaliserVille(ville: string | null | undefined): string {
  if (!ville) return ''
  return ville
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\d{1,2}\s*(?:er|ers|e|eme|ème)\b/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

function motsTitre(titre: string | null | undefined): Set<string> {
  if (!titre) return new Set()
  const mots = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m))
  return new Set(mots)
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let commun = 0
  for (const m of a) if (b.has(m)) commun++
  return commun / (a.size + b.size - commun)
}

const proche = (a: number, b: number, tolerance: number) => {
  const max = Math.max(a, b)
  return max === 0 ? a === b : Math.abs(a - b) / max <= tolerance
}

export function similarite(a: Bien, b: Bien): Similarite {
  if (a.id === b.id) return { score: 0, raisons: [] }
  if (a.url_source && a.url_source === b.url_source) {
    return { score: 1, raisons: ['URL identique'] }
  }

  const memeVille = normaliserVille(a.ville) && normaliserVille(a.ville) === normaliserVille(b.ville)
  const memeCp = !!a.code_postal && a.code_postal === b.code_postal
  if (!memeVille && !memeCp) return { score: 0, raisons: [] }

  const raisons: string[] = []
  let score = 0

  if (memeCp) {
    score += 0.15
    raisons.push('Même code postal')
  } else {
    score += 0.05
    raisons.push('Même ville')
  }

  if (a.surface > 0 && b.surface > 0) {
    if (proche(a.surface, b.surface, 0.02)) {
      score += 0.35
      raisons.push('Surface identique')
    } else if (proche(a.surface, b.surface, 0.06)) {
      score += 0.18
      raisons.push('Surface voisine')
    }
  }

  if (a.nb_pieces > 0 && a.nb_pieces === b.nb_pieces) {
    score += 0.2
    raisons.push('Même nombre de pièces')
  }

  if (a.prix > 0 && b.prix > 0) {
    if (proche(a.prix, b.prix, 0.02)) {
      score += 0.25
      raisons.push('Prix identique')
    } else if (proche(a.prix, b.prix, 0.06)) {
      score += 0.12
      raisons.push('Prix voisin')
    }
  }

  const motsCommuns = jaccard(motsTitre(a.titre), motsTitre(b.titre))
  if (motsCommuns >= 0.5) {
    score += 0.15
    raisons.push('Titre très proche')
  } else if (motsCommuns >= 0.25) {
    score += 0.07
    raisons.push('Titre proche')
  }

  return { score: Math.min(1, Math.round(score * 100) / 100), raisons }
}

export function sontDoublons(a: Bien, b: Bien, seuil = SEUIL_DOUBLON): boolean {
  return similarite(a, b).score >= seuil
}

export function grouperDoublons(biens: Bien[], seuil = SEUIL_DOUBLON): Bien[][] {
  const parent = new Map<string, string>()
  const racine = (id: string): string => {
    const p = parent.get(id)
    if (!p || p === id) return id
    const r = racine(p)
    parent.set(id, r)
    return r
  }
  const unir = (x: string, y: string) => {
    const rx = racine(x)
    const ry = racine(y)
    if (rx !== ry) parent.set(rx, ry)
  }

  for (const b of biens) parent.set(b.id, b.id)

  for (let i = 0; i < biens.length; i++) {
    for (let j = i + 1; j < biens.length; j++) {
      if (sontDoublons(biens[i]!, biens[j]!, seuil)) unir(biens[i]!.id, biens[j]!.id)
    }
  }

  const groupes = new Map<string, Bien[]>()
  for (const b of biens) {
    const r = racine(b.id)
    groupes.set(r, [...(groupes.get(r) ?? []), b])
  }

  return [...groupes.values()].filter((g) => g.length > 1)
}

export function doublonsDe(bien: Bien, biens: Bien[], seuil = SEUIL_DOUBLON): Bien[] {
  return biens.filter((b) => b.id !== bien.id && sontDoublons(bien, b, seuil))
}

export function representants(biens: Bien[], seuil = SEUIL_DOUBLON): Bien[] {
  const groupes = grouperDoublons(biens, seuil)
  const aEcarter = new Set<string>()

  for (const groupe of groupes) {
    const trie = [...groupe].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    for (const b of trie.slice(1)) aEcarter.add(b.id)
  }

  return biens.filter((b) => !aEcarter.has(b.id))
}

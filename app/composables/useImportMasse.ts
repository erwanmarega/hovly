import type { SiteSource } from '~/types'
import { detecterSource } from '~/composables/useBiens'

export type StatutImport =
  | 'prete'
  | 'source_inconnue'
  | 'deja_ajoutee'
  | 'doublon_liste'
  | 'analyse'
  | 'ajoutee'
  | 'echec'

export interface EntreeImport {
  url: string
  brut: string
  source: SiteSource | null
  statut: StatutImport
  message?: string
  titre?: string
}

const PARAMS_PISTAGE = /^(utm_|fbclid|gclid|mtm_|msclkid|_ga|xtor|cmp)/i

export function nettoyerUrl(brut: string): string {
  const texte = brut.trim().replace(/[<>"'`,;]+$/g, '')
  if (!texte) return ''

  const ressembleADomaine = /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(texte)
  if (!/^https?:\/\//i.test(texte) && !ressembleADomaine) return texte

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(texte) ? texte : `https://${texte}`)
  } catch {
    return texte
  }

  for (const cle of [...url.searchParams.keys()]) {
    if (PARAMS_PISTAGE.test(cle)) url.searchParams.delete(cle)
  }
  url.hash = ''

  const propre = url.toString()
  return propre.endsWith('?') ? propre.slice(0, -1) : propre
}

export function cleUrl(brut: string): string {
  const propre = nettoyerUrl(brut)
  try {
    const url = new URL(propre)
    const hote = url.hostname.replace(/^www\./i, '').toLowerCase()
    const chemin = url.pathname.replace(/\/+$/, '').toLowerCase()
    return `${hote}${chemin}`
  } catch {
    return propre.toLowerCase()
  }
}

export function extraireUrls(texte: string): string[] {
  return texte
    .split(/[\s\n\r\t]+/)
    .map((m) => m.trim())
    .filter((m) => /^(https?:\/\/|www\.)/i.test(m))
}

export function parserUrls(texte: string, dejaEnBase: string[] = []): EntreeImport[] {
  const connues = new Set(dejaEnBase.map(cleUrl))
  const vues = new Set<string>()

  return extraireUrls(texte).map((brut) => {
    const url = nettoyerUrl(brut)
    const cle = cleUrl(url)
    const source = detecterSource(url)

    let statut: StatutImport = 'prete'
    let message: string | undefined

    if (!source) {
      statut = 'source_inconnue'
      message = 'Source non supportée'
    } else if (connues.has(cle)) {
      statut = 'deja_ajoutee'
      message = 'Déjà dans ton tableau'
    } else if (vues.has(cle)) {
      statut = 'doublon_liste'
      message = 'En double dans la liste'
    }

    vues.add(cle)
    return { url, brut, source, statut, message }
  })
}

export function resumeImport(entrees: EntreeImport[]) {
  const par = (s: StatutImport) => entrees.filter((e) => e.statut === s).length
  return {
    total: entrees.length,
    pretes: par('prete'),
    ajoutees: par('ajoutee'),
    echecs: par('echec'),
    ignorees: par('source_inconnue') + par('deja_ajoutee') + par('doublon_liste')
  }
}

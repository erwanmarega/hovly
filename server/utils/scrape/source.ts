import type { SiteSource } from '~/types'

const DOMAINES: Record<string, SiteSource> = {
  'seloger.com': 'seloger',
  'leboncoin.fr': 'leboncoin',
  'pap.fr': 'pap',
  'logic-immo.com': 'logic-immo',
  'bienici.com': 'bienici',
  'century21.fr': 'century21'
}

export function detecterSource(url: string): SiteSource | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
  for (const [domaine, source] of Object.entries(DOMAINES)) {
    if (host === domaine || host.endsWith(`.${domaine}`)) return source
  }
  return null
}

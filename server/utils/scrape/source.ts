import type { SiteSource } from '~/types'

const DOMAINS: Record<string, SiteSource> = {
  'seloger.com': 'seloger',
  'leboncoin.fr': 'leboncoin',
  'pap.fr': 'pap',
  'logic-immo.com': 'logic-immo',
  'bienici.com': 'bienici',
  'century21.fr': 'century21',
  'orpi.com': 'orpi'
}

/** Nom conservé en français (`detecterSource`) : évite toute collision d'auto-import
 *  avec `detectSource` côté client (`app/composables/useProperties.ts`), homonyme
 *  proche mais distinct. */
export function detecterSource(url: string): SiteSource | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
  for (const [domaine, source] of Object.entries(DOMAINS)) {
    if (host === domaine || host.endsWith(`.${domaine}`)) return source
  }
  return null
}

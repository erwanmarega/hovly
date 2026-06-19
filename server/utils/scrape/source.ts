import type { SiteSource } from '~/types'

export function detecterSource(url: string): SiteSource | null {
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  if (host.includes('seloger')) return 'seloger'
  if (host.includes('leboncoin')) return 'leboncoin'
  if (host.includes('pap.fr')) return 'pap'
  if (host.includes('logic-immo')) return 'logic-immo'
  if (host.includes('bienici')) return 'bienici'
  return null
}

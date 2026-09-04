import type { SiteSource } from '~/types'
import { detectSource } from '~/composables/useProperties'

export type ImportStatus =
  | 'ready'
  | 'unknown_source'
  | 'already_added'
  | 'duplicate_in_list'
  | 'analyzing'
  | 'added'
  | 'failed'

export interface ImportEntry {
  url: string
  raw: string
  source: SiteSource | null
  status: ImportStatus
  message?: string
  titre?: string
}

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mtm_|msclkid|_ga|xtor|cmp)/i

export function cleanUrl(raw: string): string {
  const text = raw.trim().replace(/[<>"'`,;]+$/g, '')
  if (!text) return ''

  const looksLikeDomain = /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(text)
  if (!/^https?:\/\//i.test(text) && !looksLikeDomain) return text

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return text
  }

  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key)
  }
  url.hash = ''

  const clean = url.toString()
  return clean.endsWith('?') ? clean.slice(0, -1) : clean
}

export function urlKey(raw: string): string {
  const clean = cleanUrl(raw)
  try {
    const url = new URL(clean)
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    const path = url.pathname.replace(/\/+$/, '').toLowerCase()
    return `${host}${path}`
  } catch {
    return clean.toLowerCase()
  }
}

export function extractUrls(text: string): string[] {
  return text
    .split(/[\s\n\r\t]+/)
    .map((m) => m.trim())
    .filter((m) => /^(https?:\/\/|www\.)/i.test(m))
}

export function parseUrls(text: string, knownUrls: string[] = []): ImportEntry[] {
  const known = new Set(knownUrls.map(urlKey))
  const seen = new Set<string>()

  return extractUrls(text).map((raw) => {
    const url = cleanUrl(raw)
    const key = urlKey(url)
    const source = detectSource(url)

    let status: ImportStatus = 'ready'
    let message: string | undefined

    if (!source) {
      status = 'unknown_source'
      message = 'Source non supportée'
    } else if (known.has(key)) {
      status = 'already_added'
      message = 'Déjà dans ton tableau'
    } else if (seen.has(key)) {
      status = 'duplicate_in_list'
      message = 'En double dans la liste'
    }

    seen.add(key)
    return { url, raw, source, status, message }
  })
}

export function importSummary(entries: ImportEntry[]) {
  const count = (s: ImportStatus) => entries.filter((e) => e.status === s).length
  return {
    total: entries.length,
    ready: count('ready'),
    added: count('added'),
    failed: count('failed'),
    ignored: count('unknown_source') + count('already_added') + count('duplicate_in_list')
  }
}

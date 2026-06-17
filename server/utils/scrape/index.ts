import type { Bien, SiteSource } from '~/types'
import { getBrowser, pickUserAgent, randomDelay } from './browser'
import { extraire, type PageData } from './extract'

function detecterSource(url: string): SiteSource | null {
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

export interface ScrapeResult {
  source: SiteSource
  data: Partial<Bien>
  indisponible: boolean
}

const MOTS_INDISPONIBLE = [
  'page indisponible',
  'annonce supprimée',
  'annonce expirée',
  "n'existe plus",
  'annonce introuvable',
  'cette annonce a été'
]

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const source = detecterSource(url)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'Source non supportée' })
  }

  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: pickUserAgent(url.length),
    locale: 'fr-FR',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
  })
  const page = await context.newPage()

  try {
    await randomDelay()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1500)
    const status = response?.status() ?? 0

    const raw: PageData = await page.evaluate(() => {
      const meta = (p: string) =>
        document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ||
        document.querySelector(`meta[name="${p}"]`)?.getAttribute('content') ||
        ''
      const ogImages = Array.from(
        document.querySelectorAll('meta[property="og:image"]')
      ).map((m) => m.getAttribute('content') || '')

      const jsonLd: any[] = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          jsonLd.push(JSON.parse(s.textContent || 'null'))
        } catch {
        }
      })

      return {
        title: document.title || '',
        ogTitle: meta('og:title'),
        ogImages,
        jsonLd,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        bodyText: (document.body?.innerText || '').slice(0, 20000)
      }
    })

    const data = extraire(raw)
    data.url_source = url
    data.site_source = source

    const bodyLower = raw.bodyText.toLowerCase()
    const indisponible =
      status === 404 ||
      status === 410 ||
      MOTS_INDISPONIBLE.some((m) => bodyLower.includes(m))

    return { source, data, indisponible }
  } finally {
    await context.close()
  }
}

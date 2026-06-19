import type { Bien, SiteSource } from '~/types'
import { getBrowser, pickUserAgent, randomDelay } from './browser'
import { extraire, extraireLeboncoin, type PageData } from './extract'
import { detecterSource } from './source'
import { htmlToPageData } from './html'
import { scrapeViaApi, apiKey } from './fetch-api'

export interface ScrapeResult {
  source: SiteSource
  data: Partial<Bien>
  indisponible: boolean
}

const SITES_PROTEGES: SiteSource[] = ['leboncoin']

const MOTS_BLOQUE = [
  'enable js and disable any ad blocker',
  'verifying you are human',
  'captcha-delivery',
  'datadome',
  'please enable cookies',
  'unusual traffic'
]

const MOTS_INDISPONIBLE = [
  'page indisponible',
  'annonce supprimée',
  'annonce expirée',
  "n'existe plus",
  'annonce introuvable',
  'cette annonce a été'
]

function finaliser(raw: PageData, source: SiteSource, url: string, status: number): ScrapeResult {
  const bodyLower = raw.bodyText.toLowerCase()

  const bloque =
    status === 403 ||
    status === 429 ||
    MOTS_BLOQUE.some((m) => bodyLower.includes(m))
  if (bloque) {
    throw createError({
      statusCode: 423,
      statusMessage:
        "Annonce protégée par un anti-bot. Impossible d'extraire automatiquement — saisis les infos manuellement."
    })
  }

  const data = extraire(raw)
  if (source === 'leboncoin') {
    const lbc = extraireLeboncoin(raw.nextData)
    for (const [k, v] of Object.entries(lbc)) {
      if (v != null && v !== '') (data as any)[k] = v
    }
  }
  data.url_source = url
  data.site_source = source

  const indisponible =
    status === 404 ||
    status === 410 ||
    MOTS_INDISPONIBLE.some((m) => bodyLower.includes(m))

  return { source, data, indisponible }
}

async function scrapeViaApiExtract(url: string, source: SiteSource): Promise<ScrapeResult> {
  const { html, status } = await scrapeViaApi(url)
  if (status !== 200 || !html) {
    throw createError({
      statusCode: 423,
      statusMessage:
        "Annonce protégée par un anti-bot. Impossible d'extraire automatiquement — saisis les infos manuellement."
    })
  }
  return finaliser(htmlToPageData(html), source, url, 200)
}

async function scrapeViaPlaywright(url: string, source: SiteSource): Promise<ScrapeResult> {
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
    if (source === 'bienici') {
      await page
        .waitForFunction(
          () =>
            Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some((s) =>
              /"price"/.test(s.textContent || '')
            ),
          { timeout: 9000 }
        )
        .catch(() => {})
    } else {
      await page.waitForTimeout(1500)
    }
    const status = response?.status() ?? 0

    const raw: PageData = await page.evaluate(() => {
      const meta = (p: string) =>
        document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ||
        document.querySelector(`meta[name="${p}"]`)?.getAttribute('content') ||
        ''
      const ogImages = Array.from(
        document.querySelectorAll('meta[property="og:image"]')
      ).map((m) => m.getAttribute('content') || '')

      const plusGrande = (srcset: string) => {
        const parts = srcset
          .split(',')
          .map((p) => p.trim().split(/\s+/))
          .filter((p) => p[0])
        if (!parts.length) return ''
        parts.sort((a, b) => (parseInt(b[1] || '0', 10) || 0) - (parseInt(a[1] || '0', 10) || 0))
        return parts[0][0]
      }

      const domImages: string[] = []
      document.querySelectorAll('img').forEach((img) => {
        const el = img as HTMLImageElement
        const cand =
          el.currentSrc ||
          el.getAttribute('data-src') ||
          el.getAttribute('data-lazy-src') ||
          el.getAttribute('data-original') ||
          plusGrande(el.getAttribute('srcset') || '') ||
          el.src ||
          ''
        if (cand) domImages.push(cand)
      })
      document.querySelectorAll('source[srcset]').forEach((s) => {
        const u = plusGrande(s.getAttribute('srcset') || '')
        if (u) domImages.push(u)
      })

      const scriptImages: string[] = []
      const reImg = /https?:\\?\/\\?\/[^"'\\\s]+?\.(?:jpe?g|webp|png)(?:\?[^"'\\\s]*)?/gi
      document.querySelectorAll('script').forEach((s) => {
        const t = s.textContent || ''
        if (t.length > 200000) return
        const found = t.match(reImg)
        if (found) scriptImages.push(...found.map((u) => u.replace(/\\\//g, '/')))
      })

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
        domImages,
        scriptImages,
        jsonLd,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        bodyText: (document.body?.innerText || '').slice(0, 20000)
      }
    })

    return finaliser(raw, source, url, status)
  } finally {
    await context.close()
  }
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const source = detecterSource(url)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'Source non supportée' })
  }

  if (SITES_PROTEGES.includes(source)) {
    return scrapeViaApiExtract(url, source)
  }

  try {
    return await scrapeViaPlaywright(url, source)
  } catch (e: any) {
    if (e?.statusCode === 423 && apiKey()) {
      return scrapeViaApiExtract(url, source)
    }
    throw e
  }
}

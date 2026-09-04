import type { SiteSource } from '~/types'
import {
  flattenJsonLd,
  decimal,
  toInteger,
  isValidImage,
  leboncoinRooms,
  leboncoinPriceCents,
  leboncoinSurface,
  type CardLink,
  type PageData
} from './extract'
import { detecterSource } from './source'
import { htmlToPageData } from './html'
import { scrapeViaApi, apiKey } from './fetch-api'
import { getBrowser, pickUserAgent, guardContextAgainstSsrf, randomDelay } from './browser'
import { assertPublicHostname } from '../validation'

export interface ListingAd {
  url: string
  titre: string | null
  prix: number | null
  surface: number | null
  nb_pieces: number | null
  photo: string | null
  ville: string | null
  code_postal: string | null
}

export interface ListResult {
  source: SiteSource
  ads: ListingAd[]
}

/** Chemin d'une fiche annonce, par site. Une page de résultats pointe vers ces URLs. */
export const LISTING_PATTERN: Record<SiteSource, RegExp> = {
  seloger: /\/annonces\/[^?#]+\/\d{6,}\.htm/i,
  leboncoin: /\/ad\/[a-z_]+\/\d{6,}/i,
  pap: /\/annonces\/[^/?#]*-r\d{6,}/i,
  'logic-immo': /\/(?:detail-[a-z]+|annonces?)\/[^?#]*\d{6,}/i,
  bienici: /\/annonce\/(?:location|vente|colocation)\//i,
  century21: /\/trouver_logement\/detail\/\d{4,}/i,
  orpi: /\/annonce-(?:vente|location)-.+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i
}

const PROTECTED_SITES: SiteSource[] = ['leboncoin']

const MAX_ADS = 60

// Deux formes seulement : groupée à la française (« 2 268 », « 1.250,50 ») ou
// chiffres collés (« 150000 »). Accepter n'importe quelle suite chiffres-espaces
// ferait avaler ce qui précède : sur une carte SeLoger « 1 / 24 2 268 € », le
// compteur de carrousel donnerait 242 268 €. Le lookbehind évite en plus de
// démarrer au milieu d'un mot (« T2 1 100 € »). `\s` couvre les espaces insécables.
const RE_PRICE = /(?<!\w)(\d{1,3}(?:[\s.]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*€/
const RE_SURFACE = /(\d+(?:[.,]\d+)?)\s*m(?:²|2(?!\d)|\^2)/i
// « 3 pièces », mais aussi l'abréviation « 3 pcs » / « 1 pc » de Century 21.
const RE_ROOMS = /(\d+)\s*(?:pi[eè]ces?|pcs?)\b/i
const RE_ROOMS_SHORT = /\b[TF](\d)\b/
const RE_ZIP = /\b(\d{5})\b(?!\s*(?:€|EUR|euros?))/i

/**
 * Retire query et hash — l'id d'annonce vit dans le chemin sur tous les sites
 * supportés, et les params (tracking, position dans la liste) varient d'un scan
 * à l'autre, ce qui casserait la détection de nouveauté.
 */
export function normalizeAdUrl(raw: string, base?: string): string | null {
  let u: URL
  try {
    u = new URL(raw, base)
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null

  const idInPath = /\d{4,}/.test(u.pathname)
  const query = idInPath ? '' : u.search
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}${query}`
}

const sameHost = (a: string, b: string) =>
  a.replace(/^www\./, '').toLowerCase() === b.replace(/^www\./, '').toLowerCase()

/**
 * `toInteger()` supprime tous les non-chiffres : « 2 422,68 » y deviendrait
 * 242 268. Ici le motif garantit que le point et l'espace ne sont que des
 * séparateurs de milliers, et la virgule la seule décimale.
 */
export function priceInCents(raw: string | undefined): number | null {
  if (!raw) return null

  const v = parseFloat(raw.replace(/[\s.]/g, '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
}

export function parseCard(text: string): Partial<ListingAd> {
  const prix = priceInCents(text.match(RE_PRICE)?.[1])
  const surface = decimal(text.match(RE_SURFACE)?.[1])
  const pieces =
    toInteger(text.match(RE_ROOMS)?.[1]) ?? toInteger(text.match(RE_ROOMS_SHORT)?.[1])

  return {
    prix,
    surface: surface ? Math.round(surface) : null,
    nb_pieces: pieces,
    code_postal: text.match(RE_ZIP)?.[1] ?? null
  }
}

/** Fusionne deux extractions de la même annonce : la valeur définie gagne. */
function merge(a: ListingAd, b: Partial<ListingAd>): ListingAd {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (v == null || v === '') continue
    if (out[k as keyof ListingAd] == null) (out as any)[k] = v
  }
  return out
}

function empty(url: string): ListingAd {
  return {
    url,
    titre: null,
    prix: null,
    surface: null,
    nb_pieces: null,
    photo: null,
    ville: null,
    code_postal: null
  }
}

const RE_PROPERTY_TYPE =
  /(appartement|maison|studio|colocation|duplex|loft|villa|immeuble|terrain|parking|local|bureau)\b/i

/**
 * Sur un lien étiré, `text` est la carte entière — compteur de carrousel,
 * badges et boutons compris. On repart du type de bien, qui ouvre presque
 * toujours le libellé. Titre d'attente : « Garder » rescrape la vraie fiche.
 */
export function titleFromCard(text: string): string | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < 10) return null

  const i = clean.search(RE_PROPERTY_TYPE)
  return (i > 0 ? clean.slice(i) : clean).slice(0, 200) || null
}

interface Reading {
  fields: Partial<ListingAd>
  title: string | null
  signal: number
}

const read = (text: string): Reading => {
  const fields = parseCard(text)
  return {
    fields,
    title: titleFromCard(text),
    signal: [fields.prix, fields.surface, fields.nb_pieces].filter((v) => v != null).length
  }
}

/**
 * L'ancre ou la carte ? On ne devine pas d'après la longueur du texte — un badge
 * « Exclusivité » est plus long qu'un seuil arbitraire et pourtant vide de sens.
 * On lit les deux et on garde celle qui livre le plus de champs. À égalité,
 * l'ancre gagne : elle est plus étroite, donc moins susceptible d'avoir happé le
 * texte d'un voisin.
 */
export function bestReading(link: CardLink): Reading {
  return [link.text, link.cardText]
    .filter((t): t is string => !!t)
    .map(read)
    .sort((a, b) => b.signal - a.signal)[0] ?? read('')
}

export function adsFromLinks(
  links: CardLink[],
  source: SiteSource,
  baseUrl: string
): ListingAd[] {
  const pattern = LISTING_PATTERN[source]
  let host: string
  try {
    host = new URL(baseUrl).hostname
  } catch {
    return []
  }

  const byUrl = new Map<string, ListingAd>()

  for (const link of links) {
    let u: URL
    try {
      u = new URL(link.href, baseUrl)
    } catch {
      continue
    }
    if (!sameHost(u.hostname, host)) continue
    if (!pattern.test(u.pathname)) continue

    const url = normalizeAdUrl(u.href)
    if (!url) continue

    // Une même annonce a souvent deux liens : la photo (sans texte) et le titre.
    const best = bestReading(link)
    const image = link.image && isValidImage(link.image) ? link.image : null

    byUrl.set(
      url,
      merge(byUrl.get(url) ?? empty(url), {
        ...best.fields,
        titre: best.title,
        photo: image
      })
    )
  }

  return [...byUrl.values()]
}

export function adsFromJsonLd(jsonLd: any[], baseUrl: string): ListingAd[] {
  const out: ListingAd[] = []

  for (const node of flattenJsonLd(jsonLd ?? [])) {
    const elements = node?.itemListElement
    if (!Array.isArray(elements)) continue

    for (const el of elements) {
      const item = el?.item ?? el
      const url = normalizeAdUrl(String(el?.url ?? item?.url ?? ''), baseUrl)
      if (!url) continue

      const offer = Array.isArray(item?.offers) ? item.offers[0] : item?.offers
      const priceEuros = decimal(String(offer?.price ?? offer?.priceSpecification?.price ?? ''))
      const surface = decimal(String(item?.floorSize?.value ?? ''))
      const image = Array.isArray(item?.image) ? item.image[0] : item?.image

      out.push(
        merge(empty(url), {
          titre: typeof item?.name === 'string' ? item.name.slice(0, 200) : null,
          prix: priceEuros ? Math.round(priceEuros * 100) : null,
          surface: surface ? Math.round(surface) : null,
          nb_pieces: toInteger(String(item?.numberOfRooms ?? '')),
          photo: typeof image === 'string' && isValidImage(image) ? image : null,
          ville: item?.address?.addressLocality ?? null,
          code_postal: item?.address?.postalCode ?? null
        })
      )
    }
  }

  return out
}

export function leboncoinAds(nextData: string | undefined): ListingAd[] {
  if (!nextData) return []

  let ads: any[]
  try {
    const props = JSON.parse(nextData)?.props?.pageProps
    ads = props?.searchData?.ads ?? props?.initialProps?.searchData?.ads ?? []
  } catch {
    return []
  }
  if (!Array.isArray(ads)) return []

  const out: ListingAd[] = []
  for (const ad of ads) {
    const raw = ad?.url || (ad?.list_id ? `https://www.leboncoin.fr/ad/locations/${ad.list_id}` : '')
    const url = normalizeAdUrl(String(raw), 'https://www.leboncoin.fr')
    if (!url) continue

    const attrs: Record<string, string> = {}
    for (const a of ad.attributes ?? []) if (a?.key) attrs[a.key] = a.value

    const photo = ad.images?.urls?.[0] ?? ad.images?.thumb_url ?? null

    out.push(
      merge(empty(url), {
        titre: ad.subject ? String(ad.subject).slice(0, 200) : null,
        prix: leboncoinPriceCents(ad),
        surface: leboncoinSurface(attrs),
        nb_pieces: leboncoinRooms(attrs),
        photo: typeof photo === 'string' && isValidImage(photo) ? photo : null,
        ville: ad.location?.city ?? null,
        code_postal: ad.location?.zipcode ?? null
      })
    )
  }
  return out
}

export function extractAds(
  data: PageData,
  source: SiteSource,
  baseUrl: string
): ListingAd[] {
  const byUrl = new Map<string, ListingAd>()

  // Du plus riche au plus pauvre : les données structurées priment sur le DOM.
  const layers = [
    source === 'leboncoin' ? leboncoinAds(data.nextData) : [],
    adsFromJsonLd(data.jsonLd, baseUrl),
    adsFromLinks(data.links ?? [], source, baseUrl)
  ]

  for (const layer of layers) {
    for (const a of layer) {
      byUrl.set(a.url, byUrl.has(a.url) ? merge(byUrl.get(a.url)!, a) : a)
    }
  }

  return [...byUrl.values()].slice(0, MAX_ADS)
}

async function listingViaApi(url: string, source: SiteSource): Promise<PageData> {
  const { html, status } = await scrapeViaApi(url)
  if (status !== 200 || !html) {
    throw createError({
      statusCode: 423,
      statusMessage: 'Anti-bot',
      message: `Page de résultats ${source} bloquée par l'anti-bot.`
    })
  }
  return htmlToPageData(html, LISTING_PATTERN[source])
}

async function listingViaPlaywright(url: string, source: SiteSource): Promise<PageData> {
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: pickUserAgent(url.length),
    locale: 'fr-FR',
    viewport: { width: 1280, height: 1600 },
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
  })
  await guardContextAgainstSsrf(context)
  const page = await context.newPage()

  try {
    await randomDelay()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    const status = response?.status() ?? 0
    if (status === 403 || status === 429) {
      throw createError({
        statusCode: 423,
        statusMessage: 'Anti-bot',
        message: 'Page de résultats bloquée par un anti-bot.'
      })
    }

    // Les listes chargent les cartes au défilement.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1800)

    return await page.evaluate((listingPattern: string) => {
      const jsonLd: any[] = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          jsonLd.push(JSON.parse(s.textContent || 'null'))
        } catch {
        }
      })

      // Voir cardFrom() dans html.ts : même règle de remontée, transposée au DOM
      // vivant. Le motif ne peut pas traverser page.evaluate, il arrive en texte.
      const pattern = new RegExp(listingPattern, 'i')

      const cardFrom = (anchor: Element): Element => {
        // Voir cardFrom() dans html.ts : on ne remonte que depuis une ancre de
        // fiche, sinon chaque lien de navigation coûterait 5 balayages du DOM.
        if (!pattern.test(anchor.getAttribute('href') || '')) return anchor

        let current: Element = anchor
        let card: Element = anchor

        for (let i = 0; i < 5 && current.parentElement; i++) {
          current = current.parentElement
          // Clé = la portion d'URL identifiant l'annonce, pas le href brut :
          // deux liens vers la même fiche (ancre étirée + bouton) sont souvent
          // l'un relatif et l'autre absolu.
          const listings = new Set<string>()
          current.querySelectorAll('a[href]').forEach((x) => {
            const match = (x.getAttribute('href') || '').match(pattern)
            if (match) listings.add(match[0])
          })
          if (listings.size > 1) break
          card = current
        }
        return card
      }

      // Voir thumbnailTooSmall() dans html.ts. Ici on dispose en plus de
      // naturalWidth : le logo d'agence est déjà chargé (86 px) là où les vraies
      // photos sont en lazy-load et valent encore 0.
      const tooSmall = (url: string, img: HTMLImageElement) => {
        const inUrl = (key: string) => {
          const m = url.match(new RegExp(`[?&](?:${key})=(\\d+)`, 'i'))
          return m ? parseInt(m[1]!, 10) : null
        }
        const l = inUrl('w|width') ?? (img.naturalWidth || null)
        const h = inUrl('h|height') ?? (img.naturalHeight || null)
        return (l !== null && l < 200) || (h !== null && h < 150)
      }

      const firstImage = (el: Element): string => {
        for (const img of Array.from(el.querySelectorAll('img')).slice(0, 8)) {
          const i = img as HTMLImageElement
          const cand = i.currentSrc || i.getAttribute('data-src') || i.src || ''
          if (!cand || !/^https?:\/\//i.test(cand)) continue
          if (tooSmall(cand, i)) continue
          return cand
        }
        return ''
      }

      const links: { href: string; text: string; cardText?: string; image: string }[] = []
      document.querySelectorAll('a[href]').forEach((a) => {
        if (links.length >= 600) return
        const el = a as HTMLAnchorElement

        const clean = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        const card = cardFrom(el)
        const cardText =
          card === el
            ? ''
            : ((card as HTMLElement).innerText || card.textContent || '')
                .replace(/\s+/g, ' ')
                .trim()

        links.push({
          href: el.getAttribute('href') || '',
          text: clean.slice(0, 300),
          ...(cardText && cardText !== clean ? { cardText: cardText.slice(0, 400) } : {}),
          image: firstImage(card)
        })
      })

      return {
        title: document.title || '',
        ogTitle: '',
        ogImages: [],
        jsonLd,
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        bodyText: (document.body?.innerText || '').slice(0, 20000),
        nextData: document.querySelector('#__NEXT_DATA__')?.textContent || '',
        links
      }
    }, LISTING_PATTERN[source].source)
  } finally {
    await context.close()
  }
}

export async function scrapeListing(url: string): Promise<ListResult> {
  const source = detecterSource(url)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'Source non supportée' })
  }
  await assertPublicHostname(new URL(url).hostname)

  let data: PageData
  if (PROTECTED_SITES.includes(source)) {
    data = await listingViaApi(url, source)
  } else {
    try {
      data = await listingViaPlaywright(url, source)
    } catch (e: any) {
      if (e?.statusCode !== 423 || !apiKey()) throw e
      data = await listingViaApi(url, source)
    }
  }

  const ads = extractAds(data, source, url)
  if (!ads.length) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Aucune annonce',
      message:
        "Aucune annonce trouvée sur cette page. Vérifie que l'URL est bien une page de résultats."
    })
  }

  return { source, ads }
}

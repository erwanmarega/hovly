import type { SiteSource } from '~/types'
import { aplatirJsonLd, decimal, entier, imgValide, type LienCarte, type PageData } from './extract'
import { detecterSource } from './source'
import { htmlToPageData } from './html'
import { scrapeViaApi, apiKey } from './fetch-api'
import { getBrowser, pickUserAgent, randomDelay } from './browser'

export interface AnnonceListe {
  url: string
  titre: string | null
  prix: number | null
  surface: number | null
  nb_pieces: number | null
  photo: string | null
  ville: string | null
  code_postal: string | null
}

export interface ListeResult {
  source: SiteSource
  annonces: AnnonceListe[]
}

/** Chemin d'une fiche annonce, par site. Une page de résultats pointe vers ces URLs. */
export const MOTIF_FICHE: Record<SiteSource, RegExp> = {
  seloger: /\/annonces\/[^?#]+\/\d{6,}\.htm/i,
  leboncoin: /\/ad\/[a-z_]+\/\d{6,}/i,
  pap: /\/annonces\/[^/?#]*-r\d{6,}/i,
  'logic-immo': /\/(?:detail-[a-z]+|annonces?)\/[^?#]*\d{6,}/i,
  bienici: /\/annonce\/(?:location|vente|colocation)\//i,
  century21: /\/trouver_logement\/detail\/\d{4,}/i
}

const SITES_PROTEGES: SiteSource[] = ['leboncoin']

const MAX_ANNONCES = 60

// Deux formes seulement : groupée à la française (« 2 268 », « 1.250,50 ») ou
// chiffres collés (« 150000 »). Accepter n'importe quelle suite chiffres-espaces
// ferait avaler ce qui précède : sur une carte SeLoger « 1 / 24 2 268 € », le
// compteur de carrousel donnerait 242 268 €. Le lookbehind évite en plus de
// démarrer au milieu d'un mot (« T2 1 100 € »). `\s` couvre les espaces insécables.
const RE_PRIX = /(?<!\w)(\d{1,3}(?:[\s.]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*€/
const RE_SURFACE = /(\d+(?:[.,]\d+)?)\s*m(?:²|2(?!\d)|\^2)/i
// « 3 pièces », mais aussi l'abréviation « 3 pcs » / « 1 pc » de Century 21.
const RE_PIECES = /(\d+)\s*(?:pi[eè]ces?|pcs?)\b/i
const RE_PIECES_COURT = /\b[TF](\d)\b/
const RE_CP = /\b(\d{5})\b(?!\s*(?:€|EUR|euros?))/i

/**
 * Retire query et hash — l'id d'annonce vit dans le chemin sur tous les sites
 * supportés, et les params (tracking, position dans la liste) varient d'un scan
 * à l'autre, ce qui casserait la détection de nouveauté.
 */
export function normaliserUrlAnnonce(brut: string, base?: string): string | null {
  let u: URL
  try {
    u = new URL(brut, base)
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null

  const idDansChemin = /\d{4,}/.test(u.pathname)
  const query = idDansChemin ? '' : u.search
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}${query}`
}

const memeHote = (a: string, b: string) =>
  a.replace(/^www\./, '').toLowerCase() === b.replace(/^www\./, '').toLowerCase()

/**
 * `entier()` supprime tous les non-chiffres : « 2 422,68 » y deviendrait
 * 242 268. Ici le motif garantit que le point et l'espace ne sont que des
 * séparateurs de milliers, et la virgule la seule décimale.
 */
export function prixEnCentimes(brut: string | undefined): number | null {
  if (!brut) return null

  const v = parseFloat(brut.replace(/[\s.]/g, '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null
}

export function parseCarte(texte: string): Partial<AnnonceListe> {
  const prix = prixEnCentimes(texte.match(RE_PRIX)?.[1])
  const surface = decimal(texte.match(RE_SURFACE)?.[1])
  const pieces =
    entier(texte.match(RE_PIECES)?.[1]) ?? entier(texte.match(RE_PIECES_COURT)?.[1])

  return {
    prix,
    surface: surface ? Math.round(surface) : null,
    nb_pieces: pieces,
    code_postal: texte.match(RE_CP)?.[1] ?? null
  }
}

/** Fusionne deux extractions de la même annonce : la valeur définie gagne. */
function fusionner(a: AnnonceListe, b: Partial<AnnonceListe>): AnnonceListe {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (v == null || v === '') continue
    if (out[k as keyof AnnonceListe] == null) (out as any)[k] = v
  }
  return out
}

function vide(url: string): AnnonceListe {
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

const RE_TYPE_BIEN =
  /(appartement|maison|studio|colocation|duplex|loft|villa|immeuble|terrain|parking|local|bureau)\b/i

/**
 * Sur un lien étiré, `texte` est la carte entière — compteur de carrousel,
 * badges et boutons compris. On repart du type de bien, qui ouvre presque
 * toujours le libellé. Titre d'attente : « Garder » rescrape la vraie fiche.
 */
export function titreDepuisCarte(texte: string): string | null {
  const propre = texte.replace(/\s+/g, ' ').trim()
  if (propre.length < 10) return null

  const i = propre.search(RE_TYPE_BIEN)
  return (i > 0 ? propre.slice(i) : propre).slice(0, 200) || null
}

interface Lecture {
  champs: Partial<AnnonceListe>
  titre: string | null
  signal: number
}

const lire = (texte: string): Lecture => {
  const champs = parseCarte(texte)
  return {
    champs,
    titre: titreDepuisCarte(texte),
    signal: [champs.prix, champs.surface, champs.nb_pieces].filter((v) => v != null).length
  }
}

/**
 * L'ancre ou la carte ? On ne devine pas d'après la longueur du texte — un badge
 * « Exclusivité » est plus long qu'un seuil arbitraire et pourtant vide de sens.
 * On lit les deux et on garde celle qui livre le plus de champs. À égalité,
 * l'ancre gagne : elle est plus étroite, donc moins susceptible d'avoir happé le
 * texte d'un voisin.
 */
export function meilleureLecture(lien: LienCarte): Lecture {
  return [lien.texte, lien.texteCarte]
    .filter((t): t is string => !!t)
    .map(lire)
    .sort((a, b) => b.signal - a.signal)[0] ?? lire('')
}

export function annoncesDepuisLiens(
  liens: LienCarte[],
  source: SiteSource,
  baseUrl: string
): AnnonceListe[] {
  const motif = MOTIF_FICHE[source]
  let hote: string
  try {
    hote = new URL(baseUrl).hostname
  } catch {
    return []
  }

  const parUrl = new Map<string, AnnonceListe>()

  for (const lien of liens) {
    let u: URL
    try {
      u = new URL(lien.href, baseUrl)
    } catch {
      continue
    }
    if (!memeHote(u.hostname, hote)) continue
    if (!motif.test(u.pathname)) continue

    const url = normaliserUrlAnnonce(u.href)
    if (!url) continue

    // Une même annonce a souvent deux liens : la photo (sans texte) et le titre.
    const meilleur = meilleureLecture(lien)
    const image = lien.image && imgValide(lien.image) ? lien.image : null

    parUrl.set(
      url,
      fusionner(parUrl.get(url) ?? vide(url), {
        ...meilleur.champs,
        titre: meilleur.titre,
        photo: image
      })
    )
  }

  return [...parUrl.values()]
}

export function annoncesDepuisJsonLd(jsonLd: any[], baseUrl: string): AnnonceListe[] {
  const out: AnnonceListe[] = []

  for (const noeud of aplatirJsonLd(jsonLd ?? [])) {
    const elements = noeud?.itemListElement
    if (!Array.isArray(elements)) continue

    for (const el of elements) {
      const item = el?.item ?? el
      const url = normaliserUrlAnnonce(String(el?.url ?? item?.url ?? ''), baseUrl)
      if (!url) continue

      const offre = Array.isArray(item?.offers) ? item.offers[0] : item?.offers
      const prixEuros = decimal(String(offre?.price ?? offre?.priceSpecification?.price ?? ''))
      const surface = decimal(String(item?.floorSize?.value ?? ''))
      const image = Array.isArray(item?.image) ? item.image[0] : item?.image

      out.push(
        fusionner(vide(url), {
          titre: typeof item?.name === 'string' ? item.name.slice(0, 200) : null,
          prix: prixEuros ? Math.round(prixEuros * 100) : null,
          surface: surface ? Math.round(surface) : null,
          nb_pieces: entier(String(item?.numberOfRooms ?? '')),
          photo: typeof image === 'string' && imgValide(image) ? image : null,
          ville: item?.address?.addressLocality ?? null,
          code_postal: item?.address?.postalCode ?? null
        })
      )
    }
  }

  return out
}

export function annoncesLeboncoin(nextData: string | undefined): AnnonceListe[] {
  if (!nextData) return []

  let ads: any[]
  try {
    const props = JSON.parse(nextData)?.props?.pageProps
    ads = props?.searchData?.ads ?? props?.initialProps?.searchData?.ads ?? []
  } catch {
    return []
  }
  if (!Array.isArray(ads)) return []

  const out: AnnonceListe[] = []
  for (const ad of ads) {
    const brut = ad?.url || (ad?.list_id ? `https://www.leboncoin.fr/ad/locations/${ad.list_id}` : '')
    const url = normaliserUrlAnnonce(String(brut), 'https://www.leboncoin.fr')
    if (!url) continue

    const attrs: Record<string, string> = {}
    for (const a of ad.attributes ?? []) if (a?.key) attrs[a.key] = a.value

    const prixEuros = Array.isArray(ad.price) ? ad.price[0] : null
    const photo = ad.images?.urls?.[0] ?? ad.images?.thumb_url ?? null

    out.push(
      fusionner(vide(url), {
        titre: ad.subject ? String(ad.subject).slice(0, 200) : null,
        prix:
          typeof ad.price_cents === 'number'
            ? ad.price_cents
            : prixEuros != null
              ? Math.round(prixEuros * 100)
              : null,
        surface: attrs.square ? Math.round(parseFloat(attrs.square)) : null,
        nb_pieces: attrs.rooms ? parseInt(attrs.rooms, 10) : null,
        photo: typeof photo === 'string' && imgValide(photo) ? photo : null,
        ville: ad.location?.city ?? null,
        code_postal: ad.location?.zipcode ?? null
      })
    )
  }
  return out
}

export function extraireAnnonces(
  data: PageData,
  source: SiteSource,
  baseUrl: string
): AnnonceListe[] {
  const parUrl = new Map<string, AnnonceListe>()

  // Du plus riche au plus pauvre : les données structurées priment sur le DOM.
  const couches = [
    source === 'leboncoin' ? annoncesLeboncoin(data.nextData) : [],
    annoncesDepuisJsonLd(data.jsonLd, baseUrl),
    annoncesDepuisLiens(data.liens ?? [], source, baseUrl)
  ]

  for (const couche of couches) {
    for (const a of couche) {
      parUrl.set(a.url, parUrl.has(a.url) ? fusionner(parUrl.get(a.url)!, a) : a)
    }
  }

  return [...parUrl.values()].slice(0, MAX_ANNONCES)
}

async function listeViaApi(url: string, source: SiteSource): Promise<PageData> {
  const { html, status } = await scrapeViaApi(url)
  if (status !== 200 || !html) {
    throw createError({
      statusCode: 423,
      statusMessage: `Page de résultats ${source} bloquée par l'anti-bot.`
    })
  }
  return htmlToPageData(html, MOTIF_FICHE[source])
}

async function listeViaPlaywright(url: string, source: SiteSource): Promise<PageData> {
  const browser = await getBrowser()
  const context = await browser.newContext({
    userAgent: pickUserAgent(url.length),
    locale: 'fr-FR',
    viewport: { width: 1280, height: 1600 },
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' }
  })
  const page = await context.newPage()

  try {
    await randomDelay()
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    const status = response?.status() ?? 0
    if (status === 403 || status === 429) {
      throw createError({
        statusCode: 423,
        statusMessage: 'Page de résultats bloquée par un anti-bot.'
      })
    }

    // Les listes chargent les cartes au défilement.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1800)

    return await page.evaluate((motifFiche: string) => {
      const jsonLd: any[] = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          jsonLd.push(JSON.parse(s.textContent || 'null'))
        } catch {
        }
      })

      // Voir carteDe() dans html.ts : même règle de remontée, transposée au DOM
      // vivant. Le motif ne peut pas traverser page.evaluate, il arrive en texte.
      const motif = new RegExp(motifFiche, 'i')

      const carteDe = (ancre: Element): Element => {
        // Voir carteDe() dans html.ts : on ne remonte que depuis une ancre de
        // fiche, sinon chaque lien de navigation coûterait 5 balayages du DOM.
        if (!motif.test(ancre.getAttribute('href') || '')) return ancre

        let courant: Element = ancre
        let carte: Element = ancre

        for (let i = 0; i < 5 && courant.parentElement; i++) {
          courant = courant.parentElement
          // Clé = la portion d'URL identifiant l'annonce, pas le href brut :
          // deux liens vers la même fiche (ancre étirée + bouton) sont souvent
          // l'un relatif et l'autre absolu.
          const annonces = new Set<string>()
          courant.querySelectorAll('a[href]').forEach((x) => {
            const cible = (x.getAttribute('href') || '').match(motif)
            if (cible) annonces.add(cible[0])
          })
          if (annonces.size > 1) break
          carte = courant
        }
        return carte
      }

      // Voir vignetteTropPetite() dans html.ts. Ici on dispose en plus de
      // naturalWidth : le logo d'agence est déjà chargé (86 px) là où les vraies
      // photos sont en lazy-load et valent encore 0.
      const tropPetite = (url: string, img: HTMLImageElement) => {
        const dansUrl = (cle: string) => {
          const m = url.match(new RegExp(`[?&](?:${cle})=(\\d+)`, 'i'))
          return m ? parseInt(m[1]!, 10) : null
        }
        const l = dansUrl('w|width') ?? (img.naturalWidth || null)
        const h = dansUrl('h|height') ?? (img.naturalHeight || null)
        return (l !== null && l < 200) || (h !== null && h < 150)
      }

      const premiereImage = (el: Element): string => {
        for (const img of Array.from(el.querySelectorAll('img')).slice(0, 8)) {
          const i = img as HTMLImageElement
          const cand = i.currentSrc || i.getAttribute('data-src') || i.src || ''
          if (!cand || !/^https?:\/\//i.test(cand)) continue
          if (tropPetite(cand, i)) continue
          return cand
        }
        return ''
      }

      const liens: { href: string; texte: string; texteCarte?: string; image: string }[] = []
      document.querySelectorAll('a[href]').forEach((a) => {
        if (liens.length >= 600) return
        const el = a as HTMLAnchorElement

        const propre = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        const carte = carteDe(el)
        const texteCarte =
          carte === el
            ? ''
            : ((carte as HTMLElement).innerText || carte.textContent || '')
                .replace(/\s+/g, ' ')
                .trim()

        liens.push({
          href: el.getAttribute('href') || '',
          texte: propre.slice(0, 300),
          ...(texteCarte && texteCarte !== propre ? { texteCarte: texteCarte.slice(0, 400) } : {}),
          image: premiereImage(carte)
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
        liens
      }
    }, MOTIF_FICHE[source].source)
  } finally {
    await context.close()
  }
}

export async function scrapeListe(url: string): Promise<ListeResult> {
  const source = detecterSource(url)
  if (!source) {
    throw createError({ statusCode: 422, statusMessage: 'Source non supportée' })
  }

  let data: PageData
  if (SITES_PROTEGES.includes(source)) {
    data = await listeViaApi(url, source)
  } else {
    try {
      data = await listeViaPlaywright(url, source)
    } catch (e: any) {
      if (e?.statusCode !== 423 || !apiKey()) throw e
      data = await listeViaApi(url, source)
    }
  }

  const annonces = extraireAnnonces(data, source, url)
  if (!annonces.length) {
    throw createError({
      statusCode: 422,
      statusMessage:
        "Aucune annonce trouvée sur cette page. Vérifie que l'URL est bien une page de résultats."
    })
  }

  return { source, annonces }
}

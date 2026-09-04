import type { Property, DPE } from '~/types'

export interface CardLink {
  href: string
  /** Texte propre à l'ancre. Vide sur un lien étiré. */
  text: string
  /** Texte de la carte englobante, quand elle diffère de l'ancre. */
  cardText?: string
  image?: string
}

export interface PageData {
  title: string
  ogTitle: string
  ogImages: string[]
  domImages?: string[]
  scriptImages?: string[]
  jsonLd: any[]
  h1: string
  bodyText: string
  nextData?: string
  estateData?: string
  links?: CardLink[]
}

const VALID_DPE = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const NON_CITY_WORDS = new Set([
  'appartement', 'appart', 'maison', 'studio', 'duplex', 'loft', 'villa', 'immeuble',
  'location', 'louer', 'vente', 'vendre', 'achat', 'loyer', 'charges', 'surface',
  'prix', 'dpe', 'ref', 'référence', 'reference', 'annonce', 'immobilier', 'pièces',
  'pieces', 'chambre', 'chambres', 'terrain', 'parking', 'garage'
])

const CITY_TOKEN = /^[A-ZÀ-ÖØ-Þ][\p{L}'’-]*$/u

function cleanCity(brut: string | undefined | null): string | null {
  if (!brut) return null
  let v = brut.replace(/\s+/g, ' ').trim()
  v = v.replace(/\s+\d{1,2}\s*(?:er|ers|e|è|ème|eme)\b.*$/i, '')
  v = v.replace(/[-,;:.]+$/, '').trim()
  v = v.replace(/\s+(?:de|du|des|le|la|les|en|sur|sous|a|à|d'|l')$/i, '').trim()
  if (v.length < 2 || v.length > 60) return null
  if (NON_CITY_WORDS.has(v.split(/[ -]/)[0]!.toLowerCase())) return null
  return v
}

function uppercaseSequence(mots: string[], depuisLaFin: boolean): string[] {
  const ordre = depuisLaFin ? [...mots].reverse() : mots
  const pris: string[] = []
  for (const m of ordre) {
    if (!CITY_TOKEN.test(m) || pris.length === 4) break
    pris.push(m)
  }
  return depuisLaFin ? pris.reverse() : pris
}

function cityFromSequence(mots: string[]): string | null {
  const out = [...mots]
  while (out.length && NON_CITY_WORDS.has(out[0]!.toLowerCase())) out.shift()
  const stop = out.findIndex((m) => NON_CITY_WORDS.has(m.toLowerCase()))
  return cleanCity((stop > 0 ? out.slice(0, stop) : out).join(' '))
}

const splitWords = (s: string) => s.split(/[\s,;:|/]+/).filter(Boolean)

export function extractCity(
  sources: (string | undefined | null)[],
  code_postal: string | null
): string | null {
  if (!code_postal) return null
  const cp = code_postal.replace(/\s/g, '')
  if (!/^\d{5}$/.test(cp)) return null

  for (const src of sources) {
    if (!src) continue
    for (const occurrence of [...src.matchAll(new RegExp(cp, 'g'))]) {
      const i = occurrence.index!

      const apres = cityFromSequence(uppercaseSequence(splitWords(src.slice(i + 5)), false))
      if (apres) return apres

      const avant = src
        .slice(0, i)
        .replace(/[([,\-–\s]+$/, '')
        .replace(/\s*\d{1,2}\s*(?:er|ers|e|è|ème|eme)$/i, '')
      const v = cityFromSequence(uppercaseSequence(splitWords(avant), true))
      if (v) return v
    }
  }
  return null
}

export function flattenJsonLd(blocs: any[]): any[] {
  const flat: any[] = []
  const pousser = (n: any) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) {
      n.forEach(pousser)
      return
    }
    flat.push(n)
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(pousser)
  }
  blocs.forEach(pousser)
  return flat
}

function findPropertyNode(blocs: any[]): any | null {
  const cibles = [
    'RealEstateListing',
    'Residence',
    'Apartment',
    'House',
    'Accommodation',
    'Product',
    'Offer',
    'Place'
  ]
  const flat = flattenJsonLd(blocs)
  for (const cible of cibles) {
    const found = flat.find((n) => {
      const t = n['@type']
      return Array.isArray(t) ? t.includes(cible) : t === cible
    })
    if (found) return found
  }
  return flat[0] ?? null
}

function offersFrom(n: any): any[] {
  const o = n?.offers ?? n?.offer
  if (!o) return []
  return Array.isArray(o) ? o : [o]
}

function isAggregate(o: any): boolean {
  return o?.['@type'] === 'AggregateOffer'
}

export function isSearchPage(data: PageData): boolean {
  const flat = flattenJsonLd(data.jsonLd)
  if (!flat.length) return false

  let agregat = false
  for (const n of flat) {
    for (const o of offersFrom(n)) {
      if (!isAggregate(o)) return false
      if ((o.offerCount ?? 0) > 1) agregat = true
    }
  }
  if (!agregat) return false

  return !flat.some(
    (n) => n?.floorSize?.value != null || n?.numberOfRooms != null || n?.address?.streetAddress
  )
}

function machinePrice(brut: unknown): number | null {
  const v = decimal(String(brut))
  return v == null ? null : Math.round(v)
}

function jsonLdPrice(flat: any[]): number | null {
  for (const n of flat) {
    for (const o of offersFrom(n)) {
      if (isAggregate(o)) continue
      const brut = o?.price ?? o?.priceSpecification?.price
      if (brut != null) return machinePrice(brut)
    }
    const direct = n?.price ?? n?.priceSpecification?.price
    if (direct != null) return machinePrice(direct)
  }
  return null
}

function firstDefined<T>(flat: any[], lire: (n: any) => T | null | undefined): T | null {
  for (const n of flat) {
    const v = lire(n)
    if (v != null && v !== '') return v
  }
  return null
}

export function toInteger(text: string | undefined): number | null {
  if (!text) return null
  const clean = text.replace(/[^\d]/g, '')
  if (!clean) return null
  const n = parseInt(clean, 10)
  return Number.isFinite(n) ? n : null
}

export function decimal(text: string | undefined): number | null {
  if (!text) return null
  const clean = text.replace(/[^\d.,]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

const PHOTO_NOISE = /logo|sprite|icon|avatar|placeholder|favicon|blank|pixel|tracking|\.svg|\/static\/|\/ui\/|\/shared\/|selection_property|map|carte|street|google|gstatic|facebook|twitter|whatsapp/i

export function isValidImage(u: string): boolean {
  if (!u || u.startsWith('data:')) return false
  if (!/^https?:\/\//i.test(u)) return false
  if (PHOTO_NOISE.test(u)) return false
  return /\.(jpe?g|webp|png)(\?|$)/i.test(u) || /image|photo|media|cdn|annonce/i.test(u)
}

export function normalizedKey(u: string): string {
  try {
    const url = new URL(u)
    let p = url.pathname.toLowerCase()
    p = p.replace(/\/\d{2,4}x\d{0,4}\//g, '/').replace(/[_-]\d{2,4}x\d{2,4}/g, '')
    return url.hostname + p
  } catch {
    return u.split('?')[0].toLowerCase()
  }
}

export function collectPhotos(data: PageData, node: any): string[] {
  const raw: string[] = []
  if (Array.isArray(data.ogImages)) raw.push(...data.ogImages)
  if (node?.image) {
    const imgs = Array.isArray(node.image) ? node.image : [node.image]
    raw.push(...imgs.map((i: any) => (typeof i === 'string' ? i : i?.url ?? i?.contentUrl ?? '')))
  }
  if (Array.isArray(data.domImages)) raw.push(...data.domImages)
  if (Array.isArray(data.scriptImages)) raw.push(...data.scriptImages)

  const seen = new Set<string>()
  const out: string[] = []
  for (const u of raw) {
    if (!isValidImage(u)) continue
    const key = normalizedKey(u)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out.slice(0, 20)
}

/** Prix en centimes depuis un objet `ad` leboncoin (fiche ou carte de liste). */
export function leboncoinPriceCents(ad: any): number | null {
  const prixEuros = Array.isArray(ad?.price) ? ad.price[0] : null
  return typeof ad?.price_cents === 'number'
    ? ad.price_cents
    : prixEuros != null
      ? Math.round(prixEuros * 100)
      : null
}

/** Surface/nb de pièces depuis les `attributes` (`key`→`value`) d'une annonce leboncoin. */
export function leboncoinSurface(attrs: Record<string, string>): number | null {
  return attrs.square ? Math.round(parseFloat(attrs.square)) : null
}
export function leboncoinRooms(attrs: Record<string, string>): number | null {
  return attrs.rooms ? parseInt(attrs.rooms, 10) : null
}

export function extractLeboncoin(nextData: string | undefined): Partial<Property> {
  if (!nextData) return {}
  let ad: any
  try {
    ad = JSON.parse(nextData)?.props?.pageProps?.ad
  } catch {
    return {}
  }
  if (!ad) return {}

  const val: Record<string, string> = {}
  const label: Record<string, string> = {}
  for (const a of ad.attributes ?? []) {
    if (a?.key) {
      val[a.key] = a.value
      label[a.key] = a.value_label
    }
  }

  const prix = leboncoinPriceCents(ad)
  const surface = leboncoinSurface(val)
  const nb_pieces = leboncoinRooms(val)
  const etage = val.floor_number != null ? parseInt(val.floor_number, 10) : null
  const charges = val.monthly_charges ? Math.round(parseFloat(val.monthly_charges) * 100) : null

  const dpeRaw = (label.energy_rate || val.energy_rate || '').toUpperCase()
  const dpe = VALID_DPE.includes(dpeRaw) ? (dpeRaw as DPE) : null

  const out: Partial<Property> = {
    titre: (ad.subject || '').slice(0, 200) || null,
    prix,
    surface,
    nb_pieces,
    etage: Number.isFinite(etage as number) ? etage : null,
    charges,
    dpe,
    ville: ad.location?.city ?? null,
    code_postal: ad.location?.zipcode ?? null,
    adresse: ad.location?.city_label ?? null,
    description: ad.body ? String(ad.body).slice(0, 5000) : null
  }
  return out
}

export function extractOrpi(estateData: string | undefined): Partial<Property> {
  if (!estateData) return {}
  let e: any
  try {
    e = JSON.parse(estateData)
  } catch {
    return {}
  }
  if (!e) return {}

  const dpeIdx = typeof e.consumptionIndex === 'number' ? e.consumptionIndex : null
  const dpe = dpeIdx != null && dpeIdx >= 1 && dpeIdx <= 7 ? (VALID_DPE[dpeIdx - 1] as DPE) : null

  const ville = e.city?.name || e.locationDescription || null
  const chargesEuros = typeof e.chargeReserve === 'number' ? e.chargeReserve : null

  const out: Partial<Property> = {
    prix: typeof e.price === 'number' ? Math.round(e.price * 100) : undefined,
    charges: chargesEuros != null ? Math.round(chargesEuros * 100) : null,
    surface: typeof e.surface === 'number' ? Math.round(e.surface) : undefined,
    nb_pieces: typeof e.nbRooms === 'number' ? e.nbRooms : null,
    etage: typeof e.storyLocation === 'number' ? e.storyLocation : null,
    dpe,
    ville,
    code_postal: e.zipCode || null,
    photos: Array.isArray(e.images) ? e.images.slice(0, 20) : undefined
  }
  return out
}

const C21_BASE = 'https://www.century21.fr'

function amountInEuros(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern)
  if (!m?.[1]) return null
  const v = decimal(m[1].replace(/[\s\u00a0\u202f]/g, ''))
  return v == null ? null : Math.round(v)
}

export function extractCentury21(data: PageData): Partial<Property> {
  const txt = data.bodyText.replace(/\s+/g, ' ')
  const out: Partial<Property> = {}

  const rent = amountInEuros(txt, /Loyer de base\s*:\s*([\d\s.,\u00a0\u202f]+)\s*€/i)
  if (rent != null) {
    out.prix = rent * 100
  } else {
    // Vente : le prix suit la référence (« Ref : 28123 » puis « 207 000 € »).
    // Le loyer prime : sur une location « Ref : 470 1 760 € par mois », le motif
    // vente capturerait « 1 760 » à tort. La référence est un seul jeton sans
    // espace et le prix exige un groupage strict : sinon la capture pouvait
    // démarrer au milieu d'un nombre et recoller référence + prix.
    const sale = amountInEuros(txt, /Ref\s*:\s*\d[\d.,\u00a0\u202f]*[ \u00a0\u202f]+(\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d+)\s*€/i)
    if (sale != null) out.prix = sale * 100
  }

  const charges = amountInEuros(txt, /Provision pour charges\s*:\s*([\d\s.,\u00a0\u202f]+)\s*€/i)
  if (charges != null) out.charges = charges * 100

  const surface =
    amountInEuros(txt, /Surface habitable\s*:\s*([\d\s.,]+)\s*m2/i) ??
    amountInEuros(txt, /Surface totale\s*:\s*([\d\s.,]+)\s*m2/i)
  if (surface != null) out.surface = surface

  const pieces = txt.match(/Nombre de pi[eè]ces\s*:\s*(\d+)/i) ?? txt.match(/(\d+)\s*pi[eè]ces?/i)
  if (pieces?.[1]) out.nb_pieces = toInteger(pieces[1])

  if (/rez[- ]de[- ]chauss[ée]e/i.test(txt)) {
    out.etage = 0
  } else {
    const etage = txt.match(/[ÉE]tage\s*:\s*(\d+)/i)
    if (etage?.[1]) out.etage = toInteger(etage[1])
  }

  const lieu = (data.ogTitle || data.title || '').match(/([A-ZÀ-Ü][\p{L}'’ -]+?)\s*-\s*(\d{5})/u)
  if (lieu) {
    const ville = cleanCity(lieu[1])
    if (ville) out.ville = ville
    out.code_postal = lieu[2]
  }

  const photos = [...(data.domImages ?? []), ...(data.scriptImages ?? [])]
    .filter((u) => u.includes('/imagesBien/'))
    .map((u) => (u.startsWith('http') ? u : `${C21_BASE}${u.startsWith('/') ? '' : '/'}${u}`))
  if (photos.length) out.photos = [...new Set(photos)].slice(0, 20)

  return out
}

export function extract(data: PageData): Partial<Property> {
  const node = findPropertyNode(data.jsonLd)
  const flat = flattenJsonLd(data.jsonLd)
  const txt = data.bodyText

  const name = firstDefined<string>(flat, (n) => (typeof n?.name === 'string' ? n.name : null))
  const titre = (data.ogTitle || name || data.h1 || data.title || '').trim().slice(0, 200)

  let prixEuros = jsonLdPrice(flat)
  if (!prixEuros) {
    // Groupage strict à la française : un montant est soit des chiffres collés,
    // soit des groupes de 3 chiffres séparés. Sans ça, le repli démarre au
    // milieu d'un nombre et recolle référence + prix (« Ref : 3997 199 900 € »
    // donnait 97 199 900 €). Le lookbehind évite de démarrer après un chiffre,
    // et le saut de ligne reste une frontière (sinon « Ref : 28123\n207 000 € »
    // se lirait « 3 207 000 »).
    const m = txt.match(/(?<!\w)(\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d+)\s*€/)
    if (m) prixEuros = toInteger(m[1])
  }
  const prix = prixEuros ? prixEuros * 100 : null

  let surface: number | null = null
  const surfaceLd = firstDefined<number | string>(flat, (n) => n?.floorSize?.value)
  if (surfaceLd != null) surface = decimal(String(surfaceLd))
  if (!surface) {
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s*m(?:²|2|\^2)/i)
    if (m) surface = decimal(m[1])
  }
  if (surface) surface = Math.round(surface)

  let nb_pieces: number | null = null
  const piecesLd = firstDefined<number | string>(flat, (n) => n?.numberOfRooms)
  if (piecesLd != null) nb_pieces = toInteger(String(piecesLd))
  if (!nb_pieces) {
    const m = txt.match(/(\d+)\s*pi[eè]ces?/i) || txt.match(/\b[TF](\d)\b/)
    if (m) nb_pieces = toInteger(m[1])
  }

  let etage: number | null = null
  const me = txt.match(/(\d+)\s*(?:er|e|ème|eme)?\s*étage/i)
  if (me) etage = toInteger(me[1])

  let dpe: DPE | null = null
  const md = txt.match(/DPE\s*:?\s*([A-G])\b/i) || txt.match(/classe\s*énerg\w*\s*:?\s*([A-G])\b/i)
  if (md && VALID_DPE.includes(md[1].toUpperCase())) dpe = md[1].toUpperCase() as DPE

  const rue = firstDefined<string>(flat, (n) => n?.address?.streetAddress)

  let code_postal = firstDefined<string>(flat, (n) => n?.address?.postalCode)
  if (!code_postal) {
    for (const src of [data.ogTitle, data.h1, data.title, rue, txt]) {
      const m = src?.match(/\b(\d{5})\b(?!\s*(?:€|EUR|euros?))/i)
      if (m) {
        code_postal = m[1]!
        break
      }
    }
  }

  const ville: string | null =
    cleanCity(firstDefined<string>(flat, (n) => n?.address?.addressLocality)) ??
    extractCity([data.ogTitle, data.h1, data.title, rue, txt], code_postal)

  const photos = collectPhotos(data, node)

  return {
    titre: titre || null,
    prix,
    surface,
    nb_pieces,
    etage,
    dpe,
    code_postal,
    ville,
    photos,
    adresse: rue
  }
}

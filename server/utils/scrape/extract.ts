import type { Bien, DPE } from '~/types'

export interface LienCarte {
  href: string
  /** Texte propre à l'ancre. Vide sur un lien étiré. */
  texte: string
  /** Texte de la carte englobante, quand elle diffère de l'ancre. */
  texteCarte?: string
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
  liens?: LienCarte[]
}

const DPE_VALIDES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

const MOTS_NON_VILLE = new Set([
  'appartement', 'appart', 'maison', 'studio', 'duplex', 'loft', 'villa', 'immeuble',
  'location', 'louer', 'vente', 'vendre', 'achat', 'loyer', 'charges', 'surface',
  'prix', 'dpe', 'ref', 'référence', 'reference', 'annonce', 'immobilier', 'pièces',
  'pieces', 'chambre', 'chambres', 'terrain', 'parking', 'garage'
])

const TOKEN_VILLE = /^[A-ZÀ-ÖØ-Þ][\p{L}'’-]*$/u

function nettoyerVille(brut: string | undefined | null): string | null {
  if (!brut) return null
  let v = brut.replace(/\s+/g, ' ').trim()
  v = v.replace(/\s+\d{1,2}\s*(?:er|ers|e|è|ème|eme)\b.*$/i, '')
  v = v.replace(/[-,;:.]+$/, '').trim()
  v = v.replace(/\s+(?:de|du|des|le|la|les|en|sur|sous|a|à|d'|l')$/i, '').trim()
  if (v.length < 2 || v.length > 60) return null
  if (MOTS_NON_VILLE.has(v.split(/[ -]/)[0]!.toLowerCase())) return null
  return v
}

function suiteMajuscules(mots: string[], depuisLaFin: boolean): string[] {
  const ordre = depuisLaFin ? [...mots].reverse() : mots
  const pris: string[] = []
  for (const m of ordre) {
    if (!TOKEN_VILLE.test(m) || pris.length === 4) break
    pris.push(m)
  }
  return depuisLaFin ? pris.reverse() : pris
}

function villeDepuisSuite(mots: string[]): string | null {
  const out = [...mots]
  while (out.length && MOTS_NON_VILLE.has(out[0]!.toLowerCase())) out.shift()
  const stop = out.findIndex((m) => MOTS_NON_VILLE.has(m.toLowerCase()))
  return nettoyerVille((stop > 0 ? out.slice(0, stop) : out).join(' '))
}

const decouper = (s: string) => s.split(/[\s,;:|/]+/).filter(Boolean)

export function extraireVille(
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

      const apres = villeDepuisSuite(suiteMajuscules(decouper(src.slice(i + 5)), false))
      if (apres) return apres

      const avant = src
        .slice(0, i)
        .replace(/[([,\-–\s]+$/, '')
        .replace(/\s*\d{1,2}\s*(?:er|ers|e|è|ème|eme)$/i, '')
      const v = villeDepuisSuite(suiteMajuscules(decouper(avant), true))
      if (v) return v
    }
  }
  return null
}

export function aplatirJsonLd(blocs: any[]): any[] {
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

function trouverNoeudImmo(blocs: any[]): any | null {
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
  const flat = aplatirJsonLd(blocs)
  for (const cible of cibles) {
    const found = flat.find((n) => {
      const t = n['@type']
      return Array.isArray(t) ? t.includes(cible) : t === cible
    })
    if (found) return found
  }
  return flat[0] ?? null
}

function offresDe(n: any): any[] {
  const o = n?.offers ?? n?.offer
  if (!o) return []
  return Array.isArray(o) ? o : [o]
}

function estAgregat(o: any): boolean {
  return o?.['@type'] === 'AggregateOffer'
}

export function estPageRecherche(data: PageData): boolean {
  const flat = aplatirJsonLd(data.jsonLd)
  if (!flat.length) return false

  let agregat = false
  for (const n of flat) {
    for (const o of offresDe(n)) {
      if (!estAgregat(o)) return false
      if ((o.offerCount ?? 0) > 1) agregat = true
    }
  }
  if (!agregat) return false

  return !flat.some(
    (n) => n?.floorSize?.value != null || n?.numberOfRooms != null || n?.address?.streetAddress
  )
}

function prixMachine(brut: unknown): number | null {
  const v = decimal(String(brut))
  return v == null ? null : Math.round(v)
}

function prixJsonLd(flat: any[]): number | null {
  for (const n of flat) {
    for (const o of offresDe(n)) {
      if (estAgregat(o)) continue
      const brut = o?.price ?? o?.priceSpecification?.price
      if (brut != null) return prixMachine(brut)
    }
    const direct = n?.price ?? n?.priceSpecification?.price
    if (direct != null) return prixMachine(direct)
  }
  return null
}

function premierDefini<T>(flat: any[], lire: (n: any) => T | null | undefined): T | null {
  for (const n of flat) {
    const v = lire(n)
    if (v != null && v !== '') return v
  }
  return null
}

export function entier(texte: string | undefined): number | null {
  if (!texte) return null
  const clean = texte.replace(/[^\d]/g, '')
  if (!clean) return null
  const n = parseInt(clean, 10)
  return Number.isFinite(n) ? n : null
}

export function decimal(texte: string | undefined): number | null {
  if (!texte) return null
  const clean = texte.replace(/[^\d.,]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

const PHOTO_BRUIT = /logo|sprite|icon|avatar|placeholder|favicon|blank|pixel|tracking|\.svg|\/static\/|\/ui\/|\/shared\/|selection_property|map|carte|street|google|gstatic|facebook|twitter|whatsapp/i

export function imgValide(u: string): boolean {
  if (!u || u.startsWith('data:')) return false
  if (!/^https?:\/\//i.test(u)) return false
  if (PHOTO_BRUIT.test(u)) return false
  return /\.(jpe?g|webp|png)(\?|$)/i.test(u) || /image|photo|media|cdn|annonce/i.test(u)
}

export function cleNormalisee(u: string): string {
  try {
    const url = new URL(u)
    let p = url.pathname.toLowerCase()
    p = p.replace(/\/\d{2,4}x\d{0,4}\//g, '/').replace(/[_-]\d{2,4}x\d{2,4}/g, '')
    return url.hostname + p
  } catch {
    return u.split('?')[0].toLowerCase()
  }
}

export function collecterPhotos(data: PageData, node: any): string[] {
  const brut: string[] = []
  if (Array.isArray(data.ogImages)) brut.push(...data.ogImages)
  if (node?.image) {
    const imgs = Array.isArray(node.image) ? node.image : [node.image]
    brut.push(...imgs.map((i: any) => (typeof i === 'string' ? i : i?.url ?? i?.contentUrl ?? '')))
  }
  if (Array.isArray(data.domImages)) brut.push(...data.domImages)
  if (Array.isArray(data.scriptImages)) brut.push(...data.scriptImages)

  const vues = new Set<string>()
  const out: string[] = []
  for (const u of brut) {
    if (!imgValide(u)) continue
    const cle = cleNormalisee(u)
    if (vues.has(cle)) continue
    vues.add(cle)
    out.push(u)
  }
  return out.slice(0, 20)
}

export function extraireLeboncoin(nextData: string | undefined): Partial<Bien> {
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

  const prixEuros = Array.isArray(ad.price) ? ad.price[0] : null
  const prix =
    typeof ad.price_cents === 'number'
      ? ad.price_cents
      : prixEuros != null
        ? Math.round(prixEuros * 100)
        : null

  const surface = val.square ? Math.round(parseFloat(val.square)) : null
  const nb_pieces = val.rooms ? parseInt(val.rooms, 10) : null
  const etage = val.floor_number != null ? parseInt(val.floor_number, 10) : null
  const charges = val.monthly_charges ? Math.round(parseFloat(val.monthly_charges) * 100) : null

  const dpeRaw = (label.energy_rate || val.energy_rate || '').toUpperCase()
  const dpe = DPE_VALIDES.includes(dpeRaw) ? (dpeRaw as DPE) : null

  const out: Partial<Bien> = {
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

const C21_BASE = 'https://www.century21.fr'

function montantEuros(texte: string, motif: RegExp): number | null {
  const m = texte.match(motif)
  if (!m?.[1]) return null
  const v = decimal(m[1].replace(/[\s\u00a0\u202f]/g, ''))
  return v == null ? null : Math.round(v)
}

export function extraireCentury21(data: PageData): Partial<Bien> {
  const txt = data.bodyText.replace(/\s+/g, ' ')
  const out: Partial<Bien> = {}

  const loyer = montantEuros(txt, /Loyer de base\s*:\s*([\d\s.,\u00a0\u202f]+)\s*€/i)
  if (loyer != null) out.prix = loyer * 100

  const charges = montantEuros(txt, /Provision pour charges\s*:\s*([\d\s.,\u00a0\u202f]+)\s*€/i)
  if (charges != null) out.charges = charges * 100

  const surface =
    montantEuros(txt, /Surface habitable\s*:\s*([\d\s.,]+)\s*m2/i) ??
    montantEuros(txt, /Surface totale\s*:\s*([\d\s.,]+)\s*m2/i)
  if (surface != null) out.surface = surface

  const pieces = txt.match(/Nombre de pi[eè]ces\s*:\s*(\d+)/i) ?? txt.match(/(\d+)\s*pi[eè]ces?/i)
  if (pieces?.[1]) out.nb_pieces = entier(pieces[1])

  if (/rez[- ]de[- ]chauss[ée]e/i.test(txt)) {
    out.etage = 0
  } else {
    const etage = txt.match(/[ÉE]tage\s*:\s*(\d+)/i)
    if (etage?.[1]) out.etage = entier(etage[1])
  }

  const lieu = (data.ogTitle || data.title || '').match(/([A-ZÀ-Ü][\p{L}'’ -]+?)\s*-\s*(\d{5})/u)
  if (lieu) {
    const ville = nettoyerVille(lieu[1])
    if (ville) out.ville = ville
    out.code_postal = lieu[2]
  }

  const photos = [...(data.domImages ?? []), ...(data.scriptImages ?? [])]
    .filter((u) => u.includes('/imagesBien/'))
    .map((u) => (u.startsWith('http') ? u : `${C21_BASE}${u.startsWith('/') ? '' : '/'}${u}`))
  if (photos.length) out.photos = [...new Set(photos)].slice(0, 20)

  return out
}

export function extraire(data: PageData): Partial<Bien> {
  const node = trouverNoeudImmo(data.jsonLd)
  const flat = aplatirJsonLd(data.jsonLd)
  const txt = data.bodyText

  const nom = premierDefini<string>(flat, (n) => (typeof n?.name === 'string' ? n.name : null))
  const titre = (data.ogTitle || nom || data.h1 || data.title || '').trim().slice(0, 200)

  let prixEuros = prixJsonLd(flat)
  if (!prixEuros) {
    const m = txt.match(/(\d[\d\s.\u00a0]{2,9})\s*€/)
    if (m) prixEuros = entier(m[1])
  }
  const prix = prixEuros ? prixEuros * 100 : null

  let surface: number | null = null
  const surfaceLd = premierDefini<number | string>(flat, (n) => n?.floorSize?.value)
  if (surfaceLd != null) surface = decimal(String(surfaceLd))
  if (!surface) {
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s*m(?:²|2|\^2)/i)
    if (m) surface = decimal(m[1])
  }
  if (surface) surface = Math.round(surface)

  let nb_pieces: number | null = null
  const piecesLd = premierDefini<number | string>(flat, (n) => n?.numberOfRooms)
  if (piecesLd != null) nb_pieces = entier(String(piecesLd))
  if (!nb_pieces) {
    const m = txt.match(/(\d+)\s*pi[eè]ces?/i) || txt.match(/\b[TF](\d)\b/)
    if (m) nb_pieces = entier(m[1])
  }

  let etage: number | null = null
  const me = txt.match(/(\d+)\s*(?:er|e|ème|eme)?\s*étage/i)
  if (me) etage = entier(me[1])

  let dpe: DPE | null = null
  const md = txt.match(/DPE\s*:?\s*([A-G])\b/i) || txt.match(/classe\s*énerg\w*\s*:?\s*([A-G])\b/i)
  if (md && DPE_VALIDES.includes(md[1].toUpperCase())) dpe = md[1].toUpperCase() as DPE

  const rue = premierDefini<string>(flat, (n) => n?.address?.streetAddress)

  let code_postal = premierDefini<string>(flat, (n) => n?.address?.postalCode)
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
    nettoyerVille(premierDefini<string>(flat, (n) => n?.address?.addressLocality)) ??
    extraireVille([data.ogTitle, data.h1, data.title, rue, txt], code_postal)

  const photos = collecterPhotos(data, node)

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

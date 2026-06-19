import type { Bien, DPE } from '~/types'

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
}

const DPE_VALIDES = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

function trouverNoeudImmo(blocs: any[]): any | null {
  const cibles = ['RealEstateListing', 'Residence', 'Apartment', 'House', 'Product', 'Offer', 'Place']
  const flat: any[] = []
  const pousser = (n: any) => {
    if (!n || typeof n !== 'object') return
    flat.push(n)
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(pousser)
  }
  blocs.forEach(pousser)
  for (const cible of cibles) {
    const found = flat.find((n) => {
      const t = n['@type']
      return Array.isArray(t) ? t.includes(cible) : t === cible
    })
    if (found) return found
  }
  return flat[0] ?? null
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

export function extraire(data: PageData): Partial<Bien> {
  const node = trouverNoeudImmo(data.jsonLd)
  const txt = data.bodyText

  const titre = (data.ogTitle || node?.name || data.h1 || data.title || '').trim().slice(0, 200)

  let prixEuros: number | null = null
  const offer = Array.isArray(node?.offers) ? node.offers[0] : (node?.offers ?? node)
  const prixBrut = offer?.price ?? offer?.priceSpecification?.price ?? offer?.lowPrice
  if (prixBrut != null) prixEuros = entier(String(prixBrut))
  if (!prixEuros) {
    const m = txt.match(/(\d[\d\s. ]{2,9})\s*€/)
    if (m) prixEuros = entier(m[1])
  }
  const prix = prixEuros ? prixEuros * 100 : null

  let surface: number | null = null
  if (node?.floorSize?.value) surface = decimal(String(node.floorSize.value))
  if (!surface) {
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s*m(?:²|2|\^2)/i)
    if (m) surface = decimal(m[1])
  }
  if (surface) surface = Math.round(surface)

  let nb_pieces: number | null = null
  if (node?.numberOfRooms) nb_pieces = entier(String(node.numberOfRooms))
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

  let code_postal: string | null = node?.address?.postalCode ?? null
  if (!code_postal) {
    const m = txt.match(/\b(\d{5})\b/)
    if (m) code_postal = m[1]
  }
  const ville: string | null = node?.address?.addressLocality ?? null

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
    adresse: node?.address?.streetAddress ?? null
  }
}

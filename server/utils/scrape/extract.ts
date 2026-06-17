import type { Bien, DPE } from '~/types'

export interface PageData {
  title: string
  ogTitle: string
  ogImages: string[]
  jsonLd: any[]
  h1: string
  bodyText: string
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

function entier(texte: string | undefined): number | null {
  if (!texte) return null
  const clean = texte.replace(/[^\d]/g, '')
  if (!clean) return null
  const n = parseInt(clean, 10)
  return Number.isFinite(n) ? n : null
}

function decimal(texte: string | undefined): number | null {
  if (!texte) return null
  const clean = texte.replace(/[^\d.,]/g, '').replace(',', '.')
  const n = parseFloat(clean)
  return Number.isFinite(n) ? n : null
}

export function extraire(data: PageData): Partial<Bien> {
  const node = trouverNoeudImmo(data.jsonLd)
  const txt = data.bodyText

  const titre = (data.ogTitle || node?.name || data.h1 || data.title || '').trim().slice(0, 200)

  let prixEuros: number | null = null
  const offer = node?.offers ?? node
  if (offer?.price) prixEuros = entier(String(offer.price))
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

  let photos: string[] = []
  if (Array.isArray(data.ogImages)) photos = data.ogImages.filter(Boolean)
  if (node?.image) {
    const imgs = Array.isArray(node.image) ? node.image : [node.image]
    photos.push(...imgs.filter(Boolean))
  }
  photos = [...new Set(photos)].filter((u) => !/logo/i.test(u)).slice(0, 8)

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

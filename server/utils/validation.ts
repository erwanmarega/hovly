import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import type { H3Event } from 'h3'
import { createError } from 'h3'

/** Longueur maximale acceptée pour une URL source. */
export const MAX_URL_LENGTH = 2048

/** Taille maximale par défaut d'un corps de requête JSON. */
export const MAX_BODY_BYTES = 131072 // 128 KiB

/**
 * Valide une URL source d'annonce immobilière.
 * Retourne l'URL nettoyée ou lève une erreur 400.
 */
export function validateSourceUrl(url: unknown): string {
  if (typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'URL requise' })
  }

  const nettoyee = url.trim()
  if (!nettoyee) {
    throw createError({ statusCode: 400, statusMessage: 'URL requise' })
  }

  if (nettoyee.length > MAX_URL_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL invalide',
      message: `L'URL ne doit pas dépasser ${MAX_URL_LENGTH} caractères.`
    })
  }

  let parsed: URL
  try {
    parsed = new URL(nettoyee)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL invalide',
      message: 'Seuls les protocoles HTTP et HTTPS sont acceptés.'
    })
  }

  if (!parsed.hostname || parsed.hostname.includes('..')) {
    throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  }

  return nettoyee
}

/**
 * Vérifie que le corps de la requête n'est pas démesurément grand avant
 * de tenter de le lire.
 */
export function assertBodySize(event: H3Event, maxBytes = MAX_BODY_BYTES) {
  const length = event.node.req.headers['content-length']
  if (length) {
    const taille = Number(length)
    if (Number.isNaN(taille) || taille > maxBytes) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Payload Too Large',
        message: `La taille maximale autorisée est ${maxBytes} octets.`
      })
    }
  }
}

/** Blocs IPv4 privés/réservés (RFC 1918, loopback, link-local incl. metadata cloud, CGNAT). */
const IPV4_BLOCKS: [number, number][] = [
  [ip4(0, 0, 0, 0), ip4(0, 255, 255, 255)], // "this network"
  [ip4(10, 0, 0, 0), ip4(10, 255, 255, 255)],
  [ip4(100, 64, 0, 0), ip4(100, 127, 255, 255)], // CGNAT
  [ip4(127, 0, 0, 0), ip4(127, 255, 255, 255)], // loopback
  [ip4(169, 254, 0, 0), ip4(169, 254, 255, 255)], // link-local + metadata cloud
  [ip4(172, 16, 0, 0), ip4(172, 31, 255, 255)],
  [ip4(192, 168, 0, 0), ip4(192, 168, 255, 255)],
  [ip4(224, 0, 0, 0), ip4(255, 255, 255, 255)] // multicast + réservé
]

function ip4(a: number, b: number, c: number, d: number): number {
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

function isIpv4Private(ip: string): boolean {
  const octets = ip.split('.').map(Number)
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true // adresse malformée : on refuse par prudence
  }
  const [a, b, c, d] = octets as [number, number, number, number]
  const valeur = ip4(a, b, c, d)
  return IPV4_BLOCKS.some(([debut, fin]) => valeur >= debut && valeur <= fin)
}

function isIpv6Private(ip: string): boolean {
  const normalisee = ip.toLowerCase()
  if (normalisee === '::1' || normalisee === '::') return true
  // IPv4 mappée dans une adresse IPv6 (::ffff:a.b.c.d).
  const mappee = normalisee.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappee) return isIpv4Private(mappee[1]!)
  const premierGroupe = normalisee.split(':')[0] ?? ''
  if (normalisee.startsWith('fe8') || normalisee.startsWith('fe9')) return true // link-local fe80::/10
  if (normalisee.startsWith('fea') || normalisee.startsWith('feb')) return true
  const valeurGroupe = parseInt(premierGroupe, 16)
  if (!Number.isNaN(valeurGroupe) && valeurGroupe >= 0xfc00 && valeurGroupe <= 0xfdff) return true // ULA fc00::/7
  return false
}

/**
 * Résout un hostname et lève une erreur 422 si une des IP obtenues pointe vers
 * le réseau privé/interne (RFC 1918, loopback, link-local — y compris le
 * endpoint de métadonnées cloud 169.254.169.254). Protection SSRF : appelée
 * juste avant tout scraping, pour couvrir aussi le cas d'une IP qui aurait
 * changé (DNS rebinding) après la création du bien/de la veille.
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    const privee = isIP(hostname) === 4 ? isIpv4Private(hostname) : isIpv6Private(hostname)
    if (privee) {
      throw createError({ statusCode: 422, statusMessage: 'Cible interdite' })
    }
    return
  }

  const adresses = await lookup(hostname, { all: true, verbatim: true })
  for (const { address, family } of adresses) {
    const privee = family === 4 ? isIpv4Private(address) : isIpv6Private(address)
    if (privee) {
      throw createError({ statusCode: 422, statusMessage: 'Cible interdite' })
    }
  }
}

/** Durée de mise en cache d'une décision d'hôte public/privé (ms). */
const HOSTNAME_CACHE_MS = 5 * 60_000
const hostnamePublicCache = new Map<string, { isPublic: boolean; expiresAt: number }>()

/**
 * Variante non-throwing d'`assertPublicHostname`, mise en cache par hôte.
 * Utilisée pour valider *chaque* requête réseau d'une page scrapée (nav,
 * redirections, sous-ressources) sans relancer une résolution DNS à chaque
 * appel — une page charge souvent des dizaines d'images sur les mêmes 1-3 CDN.
 */
export async function isPublicHostname(hostname: string): Promise<boolean> {
  const key = hostname.toLowerCase()
  const cached = hostnamePublicCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.isPublic

  let isPublic: boolean
  try {
    await assertPublicHostname(hostname)
    isPublic = true
  } catch {
    isPublic = false
  }
  hostnamePublicCache.set(key, { isPublic, expiresAt: Date.now() + HOSTNAME_CACHE_MS })
  return isPublic
}

/**
 * Nettoie une chaîne de texte libre pour stockage en base.
 */
export function cleanText(valeur: unknown, maxLongueur: number): string | null {
  if (valeur == null) return null
  const texte = String(valeur).trim()
  if (!texte) return null
  return texte.slice(0, maxLongueur)
}

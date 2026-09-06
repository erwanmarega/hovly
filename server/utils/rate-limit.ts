import type { H3Event } from 'h3'

export interface RateLimitOptions {
  /** Fenêtre de temps en millisecondes. */
  windowMs: number
  /** Nombre maximum de requêtes dans la fenêtre. */
  max: number
  /** Message d'erreur personnalisé. */
  message?: string
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

interface BucketEntry {
  /** Requêtes enregistrées, triées par timestamp croissant. */
  requests: number[]
}

class RateLimitStore {
  private buckets = new Map<string, BucketEntry>()
  private lastCleanup = Date.now()
  private cleanupIntervalMs: number

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupIntervalMs = cleanupIntervalMs
  }

  check(key: string, windowMs: number, max: number): RateLimitResult {
    this.maybeCleanup()

    const now = Date.now()
    const resetAt = now + windowMs
    let entry = this.buckets.get(key)

    if (!entry) {
      entry = { requests: [] }
      this.buckets.set(key, entry)
    }

    const windowStart = now - windowMs
    const recentRequests = entry.requests.filter((t) => t > windowStart)
    entry.requests = recentRequests

    if (recentRequests.length >= max) {
      return { ok: false, remaining: 0, resetAt }
    }

    recentRequests.push(now)
    return { ok: true, remaining: Math.max(0, max - recentRequests.length), resetAt }
  }

  reset() {
    this.buckets.clear()
    this.lastCleanup = Date.now()
  }

  private maybeCleanup() {
    const now = Date.now()
    if (now - this.lastCleanup < this.cleanupIntervalMs) return

    for (const [key, entry] of this.buckets) {
      // Garde une marge de 2x la plus grande fenêtre possible serait impossible
      // à connaître ici ; on supprime les buckets vides et on tronque les vieilles
      // requêtes de plus de 24h.
      const cutoff = now - 24 * 60 * 60 * 1000
      entry.requests = entry.requests.filter((t) => t > cutoff)
      if (entry.requests.length === 0) {
        this.buckets.delete(key)
      }
    }
    this.lastCleanup = now
  }
}

// Store global au processus. Dans un environnement serverless qui recycle les
// workers, les compteurs se réinitialisent — c'est acceptable pour un MVP.
const globalStore = new RateLimitStore()

export function resetRateLimits() {
  globalStore.reset()
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  return globalStore.check(key, options.windowMs, options.max)
}

export function checkRateLimitForEvent(
  event: H3Event,
  options: RateLimitOptions & { key?: string }
): RateLimitResult {
  const ip = getClientIp(event)
  if (!ip) {
    return { ok: false, remaining: 0, resetAt: Date.now() + options.windowMs }
  }
  const suffix = options.key ? `:${options.key}` : ''
  return checkRateLimit(`${ip}${suffix}`, options)
}

export function checkRateLimitForUser(
  event: H3Event,
  userId: string,
  options: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(event)
  // On combine userId et IP : un vol de session ne suffit pas à contourner les
  // limites depuis une autre machine, et un NAT d'entreprise ne pénalise pas
  // un utilisateur actif authentifié.
  const key = ip ? `${userId}:${ip}` : userId
  return checkRateLimit(key, options)
}

export function getClientIp(event: H3Event): string | null {
  const headers = event.node.req.headers

  // Cloudflare et proxys courants.
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }

  const cf = headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf) return cf

  const realIp = headers['x-real-ip']
  if (typeof realIp === 'string' && realIp) return realIp

  const remoteAddress = event.node.req.socket?.remoteAddress
  if (remoteAddress) return remoteAddress

  return null
}

export function createRateLimitError(resetAt: number, message?: string) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return createError({
    statusCode: 429,
    statusMessage: message || 'Trop de requêtes. Réessaie plus tard.',
    data: { retryAfter }
  })
}

export function setRateLimitHeaders(
  event: H3Event,
  result: RateLimitResult,
  options: RateLimitOptions
) {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  setHeader(event, 'X-RateLimit-Limit', String(options.max))
  setHeader(event, 'X-RateLimit-Remaining', String(result.remaining))
  setHeader(event, 'X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  if (!result.ok) {
    setHeader(event, 'Retry-After', retryAfter)
  }
}

/**
 * Vérifie plusieurs quotas pour un utilisateur authentifié. Lève une erreur 429
 * dès qu'un quota est dépassé.
 */
export function assertRateLimitForUser(
  event: H3Event,
  userId: string,
  ...quotas: RateLimitOptions[]
): RateLimitResult {
  let lastResult: RateLimitResult | null = null
  for (const quota of quotas) {
    const result = checkRateLimitForUser(event, userId, quota)
    lastResult = result
    if (!result.ok) {
      setRateLimitHeaders(event, result, quota)
      throw createRateLimitError(result.resetAt, quota.message)
    }
  }
  return lastResult!
}

export const QUOTAS = {
  /** Route générale par IP. */
  global: { windowMs: 60_000, max: 120 },
  /** Scraping d'une annonce unique. */
  scrape: { windowMs: 60_000, max: 10 },
  scrapePerHour: { windowMs: 60 * 60_000, max: 50 },
  /** Rafraîchissement manuel d'un bien. */
  refresh: { windowMs: 60_000, max: 10 },
  refreshPerHour: { windowMs: 60 * 60_000, max: 50 },
  /** Scan manuel d'une veille (page de résultats). */
  scan: { windowMs: 60_000, max: 5 },
  scanPerHour: { windowMs: 60 * 60_000, max: 30 },
  /** Calcul des trajets. */
  commutes: { windowMs: 60_000, max: 10 },
  commutesPerHour: { windowMs: 60 * 60_000, max: 100 },
  /** Vérification manuelle des biens (check). */
  check: { windowMs: 60_000, max: 5 },
  checkPerHour: { windowMs: 60 * 60_000, max: 20 },
  /** Création d'un lien de partage. */
  share: { windowMs: 60_000, max: 10 },
  sharePerHour: { windowMs: 60 * 60_000, max: 30 },
  /** Export PDF d'une comparaison (rendu Playwright, coûteux). */
  pdfExport: { windowMs: 60_000, max: 5 },
  pdfExportPerHour: { windowMs: 60 * 60_000, max: 20 },
  /** Suppression en masse de biens. */
  bulkDelete: { windowMs: 60_000, max: 5 },
  bulkDeletePerHour: { windowMs: 60 * 60_000, max: 20 }
} as const

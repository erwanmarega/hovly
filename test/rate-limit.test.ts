import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkRateLimit, resetRateLimits } from '../server/utils/rate-limit'
import {
  validateSourceUrl,
  assertBodySize,
  MAX_URL_LENGTH
} from '../server/utils/validation'
import type { H3Event } from 'h3'

describe('rate-limit', () => {
  beforeEach(() => {
    resetRateLimits()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('autorise les requêtes sous le quota', () => {
    const r1 = checkRateLimit('ip1', { windowMs: 60_000, max: 2 })
    expect(r1.ok).toBe(true)
    expect(r1.remaining).toBe(1)

    const r2 = checkRateLimit('ip1', { windowMs: 60_000, max: 2 })
    expect(r2.ok).toBe(true)
    expect(r2.remaining).toBe(0)
  })

  it('bloque au-delà du quota', () => {
    checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    const r = checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('réinitialise le compteur après la fenêtre glissante', () => {
    checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    vi.advanceTimersByTime(60_001)
    const r = checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    expect(r.ok).toBe(true)
  })

  it('isole les clés entre elles', () => {
    checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    const r = checkRateLimit('ip2', { windowMs: 60_000, max: 1 })
    expect(r.ok).toBe(true)
  })

  it('resetRateLimits vide tous les compteurs', () => {
    checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    resetRateLimits()
    const r = checkRateLimit('ip1', { windowMs: 60_000, max: 1 })
    expect(r.ok).toBe(true)
  })
})

describe('validateSourceUrl', () => {
  it('accepte une URL HTTPS valide', () => {
    expect(validateSourceUrl('https://www.seloger.com/annonces/1.htm')).toBe(
      'https://www.seloger.com/annonces/1.htm'
    )
  })

  it('accepte une URL HTTP valide', () => {
    expect(validateSourceUrl('http://example.com/annonce')).toBe('http://example.com/annonce')
  })

  it('trim les espaces', () => {
    expect(validateSourceUrl('  https://seloger.com/1  ')).toBe('https://seloger.com/1')
  })

  it('rejette une valeur non string', () => {
    expect(() => validateSourceUrl(123 as unknown)).toThrow(/URL requise/)
  })

  it('rejette une chaîne vide', () => {
    expect(() => validateSourceUrl('   ')).toThrow(/URL requise/)
  })

  it('rejette une URL trop longue', () => {
    const url = 'https://seloger.com/' + 'a'.repeat(MAX_URL_LENGTH)
    expect(() => validateSourceUrl(url)).toThrow(/ne doit pas dépasser/)
  })

  it('rejette un protocole non HTTP', () => {
    expect(() => validateSourceUrl('ftp://example.com')).toThrow(/Seuls les protocoles/)
  })

  it('rejette une URL mal formée', () => {
    expect(() => validateSourceUrl('pas une url')).toThrow(/URL invalide/)
  })
})

describe('assertBodySize', () => {
  function makeEvent(contentLength?: string): H3Event {
    return {
      node: {
        req: {
          headers: { 'content-length': contentLength }
        }
      }
    } as unknown as H3Event
  }

  it('passe si pas de Content-Length', () => {
    expect(() => assertBodySize(makeEvent())).not.toThrow()
  })

  it('passe si la taille est dans la limite', () => {
    expect(() => assertBodySize(makeEvent('1024'))).not.toThrow()
  })

  it('rejette un corps trop grand', () => {
    expect(() => assertBodySize(makeEvent('999999999'))).toThrow(/taille maximale/)
  })

  it('rejette un Content-Length invalide', () => {
    expect(() => assertBodySize(makeEvent('abc'))).toThrow(/taille maximale/)
  })
})

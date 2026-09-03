import { describe, it, expect, vi, afterEach } from 'vitest'
import { detecterSource } from '../server/utils/scrape/source'
import { assertPublicHostname, isPublicHostname } from '../server/utils/validation'

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn()
}))

describe('detecterSource', () => {
  it('reconnaît un domaine officiel', () => {
    expect(detecterSource('https://www.bienici.com/annonce/1')).toBe('bienici')
    expect(detecterSource('https://bienici.com/annonce/1')).toBe('bienici')
  })

  it("rejette un domaine contenant le nom d'un site en sous-chaîne", () => {
    expect(detecterSource('https://bienici.attacker.com/annonce/1')).toBeNull()
    expect(detecterSource('https://century21.exemple.net/annonce/1')).toBeNull()
    expect(detecterSource('https://notcentury21.io/annonce/1')).toBeNull()
  })

  it('accepte un sous-domaine légitime', () => {
    expect(detecterSource('https://immo.bienici.com/annonce/1')).toBe('bienici')
  })

  it('renvoie null pour une URL invalide', () => {
    expect(detecterSource('pas une url')).toBeNull()
  })
})

describe('assertPublicHostname', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejette une IP littérale privée', async () => {
    await expect(assertPublicHostname('127.0.0.1')).rejects.toThrow()
    await expect(assertPublicHostname('10.0.0.1')).rejects.toThrow()
    await expect(assertPublicHostname('169.254.169.254')).rejects.toThrow()
    await expect(assertPublicHostname('192.168.1.1')).rejects.toThrow()
  })

  it('accepte une IP littérale publique', async () => {
    await expect(assertPublicHostname('8.8.8.8')).resolves.toBeUndefined()
  })

  it('rejette un hostname qui résout vers une IP privée', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never)
    await expect(assertPublicHostname('bienici.attacker.com')).rejects.toThrow()
  })

  it('accepte un hostname qui résout vers une IP publique', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockResolvedValue([{ address: '203.0.113.10', family: 4 }] as never)
    await expect(assertPublicHostname('www.bienici.com')).resolves.toBeUndefined()
  })
})

describe('isPublicHostname', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renvoie false pour un hôte privé, sans lever', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockResolvedValue([{ address: '169.254.169.254', family: 4 }] as never)
    await expect(isPublicHostname('cache-privee-1.exemple')).resolves.toBe(false)
  })

  it('renvoie true pour un hôte public', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockResolvedValue([{ address: '203.0.113.20', family: 4 }] as never)
    await expect(isPublicHostname('cache-publique-1.exemple')).resolves.toBe(true)
  })

  it('met en cache le résultat : une seule résolution DNS pour deux appels', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockResolvedValue([{ address: '203.0.113.21', family: 4 }] as never)

    await isPublicHostname('cache-publique-2.exemple')
    await isPublicHostname('cache-publique-2.exemple')

    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('renvoie false si la résolution DNS échoue', async () => {
    const { lookup } = await import('node:dns/promises')
    vi.mocked(lookup).mockRejectedValue(new Error('ENOTFOUND'))
    await expect(isPublicHostname('cache-echec.exemple')).resolves.toBe(false)
  })
})

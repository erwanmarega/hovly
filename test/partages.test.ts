import { describe, it, expect } from 'vitest'
import {
  CHAMPS_PUBLICS_BIEN,
  genererTokenPartage,
  partageExpire,
  SELECT_PUBLIC_BIEN
} from '../server/utils/partages'

describe('genererTokenPartage', () => {
  it('génère un token suffisamment long et url-safe', () => {
    const token = genererTokenPartage()
    expect(token.length).toBeGreaterThanOrEqual(20)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('ne génère jamais deux fois le même token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => genererTokenPartage()))
    expect(tokens.size).toBe(50)
  })
})

describe('partageExpire', () => {
  it('un partage sans date d’expiration n’expire jamais', () => {
    expect(partageExpire(null)).toBe(false)
  })

  it('une date passée est expirée', () => {
    expect(partageExpire(new Date(Date.now() - 1000).toISOString())).toBe(true)
  })

  it('une date future n’est pas expirée', () => {
    expect(partageExpire(new Date(Date.now() + 1000).toISOString())).toBe(false)
  })
})

describe('CHAMPS_PUBLICS_BIEN', () => {
  const INTERDITS = [
    'user_id',
    'url_source',
    'note_perso',
    'statut',
    'charges',
    'description',
    'compte_rendu',
    'checklist',
    'visite_le',
    'rappel_envoye_le',
    'created_at',
    'actif'
  ]

  it("n'expose aucun champ sensible ou interne", () => {
    for (const champ of INTERDITS) {
      expect(CHAMPS_PUBLICS_BIEN).not.toContain(champ)
    }
  })

  it('reste alignée avec la clause select construite pour Supabase', () => {
    expect(SELECT_PUBLIC_BIEN).toBe(CHAMPS_PUBLICS_BIEN.join(', '))
  })
})

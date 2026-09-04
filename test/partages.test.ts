import { describe, it, expect } from 'vitest'
import {
  PUBLIC_PROPERTY_FIELDS,
  generateShareToken,
  isShareExpired,
  PUBLIC_PROPERTY_SELECT
} from '../server/utils/partages'

describe('generateShareToken', () => {
  it('génère un token suffisamment long et url-safe', () => {
    const token = generateShareToken()
    expect(token.length).toBeGreaterThanOrEqual(20)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('ne génère jamais deux fois le même token', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()))
    expect(tokens.size).toBe(50)
  })
})

describe('isShareExpired', () => {
  it('un partage sans date d’expiration n’expire jamais', () => {
    expect(isShareExpired(null)).toBe(false)
  })

  it('une date passée est expirée', () => {
    expect(isShareExpired(new Date(Date.now() - 1000).toISOString())).toBe(true)
  })

  it('une date future n’est pas expirée', () => {
    expect(isShareExpired(new Date(Date.now() + 1000).toISOString())).toBe(false)
  })
})

describe('PUBLIC_PROPERTY_FIELDS', () => {
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
      expect(PUBLIC_PROPERTY_FIELDS).not.toContain(champ)
    }
  })

  it('reste alignée avec la clause select construite pour Supabase', () => {
    expect(PUBLIC_PROPERTY_SELECT).toBe(PUBLIC_PROPERTY_FIELDS.join(', '))
  })
})

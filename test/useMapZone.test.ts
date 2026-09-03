import { describe, it, expect, vi } from 'vitest'
import type { Property } from '../app/types'

const etats = new Map<string, { value: any }>()
vi.stubGlobal('useState', (cle: string, init: () => any) => {
  if (!etats.has(cle)) etats.set(cle, { value: init() })
  return etats.get(cle)!
})

const { distanceM, useMapZone } = await import('../app/composables/useMapZone')

function bien(over: Partial<Property> = {}): Property {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.seloger.com/annonces/1.htm',
    site_source: 'seloger',
    titre: 'T2',
    prix: 157000,
    surface: 42,
    nb_pieces: 2,
    etage: null,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Paris',
    code_postal: '75011',
    lat: 48.8566,
    lon: 2.3522,
    geo_precision: 'precise',
    geocode_le: null,
    photos: [],
    description: null,
    statut: 'a_visiter',
    transaction: 'location',
    note_perso: null,
    visite_le: null,
    compte_rendu: null,
    checklist: null,
    rappel_envoye_le: null,
    actif: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over
  }
}

describe('distanceM', () => {
  it('mesure ~1 km entre deux points espacés de 0.009° de latitude', () => {
    const paris = { lat: 48.8566, lon: 2.3522 }
    const unKmPlusLoin = { lat: 48.8656, lon: 2.3522 }
    const d = distanceM(paris, unKmPlusLoin)
    expect(d).toBeGreaterThan(950)
    expect(d).toBeLessThan(1050)
  })

  it('retourne 0 pour un point identique', () => {
    const p = { lat: 48.8566, lon: 2.3522 }
    expect(distanceM(p, p)).toBe(0)
  })
})

describe('useMapZone', () => {
  it('sans zone active, tous les biens passent', () => {
    const { zone, inZone } = useMapZone()
    zone.value = null
    expect(inZone(bien())).toBe(true)
    expect(inZone(bien({ lat: null, lon: null }))).toBe(true)
  })

  it('avec une zone active, ne garde que les biens à l’intérieur du rayon', () => {
    const { zone, inZone } = useMapZone()
    zone.value = { lat: 48.8566, lon: 2.3522, radiusM: 1000 }

    expect(inZone(bien({ lat: 48.8566, lon: 2.3522 }))).toBe(true) // centre
    expect(inZone(bien({ lat: 48.8616, lon: 2.3522 }))).toBe(true) // ~556 m, dans le rayon
    expect(inZone(bien({ lat: 48.8746, lon: 2.3522 }))).toBe(false) // ~2 km, hors zone
  })

  it('exclut un bien sans coordonnées quand une zone est active', () => {
    const { zone, inZone } = useMapZone()
    zone.value = { lat: 48.8566, lon: 2.3522, radiusM: 1000 }
    expect(inZone(bien({ lat: null, lon: null }))).toBe(false)
  })

  it('clear() vide la zone', () => {
    const { zone, clear } = useMapZone()
    zone.value = { lat: 48.8566, lon: 2.3522, radiusM: 1000 }
    clear()
    expect(zone.value).toBeNull()
  })
})

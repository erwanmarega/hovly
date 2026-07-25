import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'
import { geocoder } from '../server/utils/geocode'

let fetchMock: MockInstance<typeof fetch>

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => {
  vi.restoreAllMocks()
})

const reponse = (features: unknown[]) =>
  ({ ok: true, json: async () => ({ features }) }) as unknown as Response

const feature = (type: string, lon = 2.33152, lat = 48.79135, label = 'Cachan') => ({
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { type, label, score: 0.9 }
})

const urlAppelee = (i = 0) => new URL(fetchMock.mock.calls[i]![0] as URL)

describe('geocoder — requête', () => {
  it('interroge la BAN avec adresse + ville et le code postal en filtre', async () => {
    fetchMock.mockResolvedValue(reponse([feature('housenumber')]))
    await geocoder({ adresse: '12 rue des Lilas', ville: 'Cachan', code_postal: '94230' })

    const u = urlAppelee()
    expect(u.origin + u.pathname).toBe('https://api-adresse.data.gouv.fr/search/')
    expect(u.searchParams.get('q')).toBe('12 rue des Lilas Cachan')
    expect(u.searchParams.get('postcode')).toBe('94230')
    expect(u.searchParams.get('limit')).toBe('1')
  })

  it('se contente de la ville quand l’adresse manque', async () => {
    fetchMock.mockResolvedValue(reponse([feature('municipality')]))
    await geocoder({ adresse: null, ville: 'Cachan', code_postal: '94230' })
    expect(urlAppelee().searchParams.get('q')).toBe('Cachan')
  })
})

describe('geocoder — précision', () => {
  it.each([
    ['housenumber', 'exacte'],
    ['street', 'rue'],
    ['municipality', 'ville'],
    ['locality', 'ville']
  ])('mappe le type BAN %s sur la précision %s', async (type, precision) => {
    fetchMock.mockResolvedValue(reponse([feature(type)]))
    const loc = await geocoder({ ville: 'Cachan', code_postal: '94230' })
    expect(loc?.precision).toBe(precision)
  })

  it('retourne les coordonnées inversées depuis le GeoJSON (lon, lat)', async () => {
    fetchMock.mockResolvedValue(reponse([feature('street', 4.85703, 45.76687, 'Bd des Brotteaux')]))
    const loc = await geocoder({ ville: 'Lyon', code_postal: '69006' })
    expect(loc).toEqual({
      lat: 45.76687,
      lon: 4.85703,
      precision: 'rue',
      label: 'Bd des Brotteaux'
    })
  })

  it('ignore un type BAN inconnu', async () => {
    fetchMock.mockResolvedValue(reponse([feature('galaxie')]))
    expect(await geocoder({ ville: 'Cachan', code_postal: '94230' })).toBeNull()
  })
})

describe('geocoder — repli sur le code postal', () => {
  it('retombe sur la commune quand ville et adresse sont absentes', async () => {
    fetchMock.mockResolvedValue(reponse([feature('municipality')]))
    const loc = await geocoder({ adresse: null, ville: null, code_postal: '94230' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const u = urlAppelee()
    expect(u.searchParams.get('q')).toBe('94230')
    expect(u.searchParams.get('type')).toBe('municipality')
    expect(loc?.precision).toBe('ville')
  })

  it('retente sur le code postal quand la requête adresse ne donne rien', async () => {
    fetchMock
      .mockResolvedValueOnce(reponse([]))
      .mockResolvedValueOnce(reponse([feature('municipality')]))

    const loc = await geocoder({ ville: 'Villeinconnue', code_postal: '94230' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(urlAppelee(1).searchParams.get('q')).toBe('94230')
    expect(loc?.precision).toBe('ville')
  })

  it('retourne null sans aucune donnée de localisation', async () => {
    expect(await geocoder({})).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retourne null si le code postal est mal formé et la ville absente', async () => {
    expect(await geocoder({ code_postal: '75' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('geocoder — robustesse', () => {
  it('retourne null si l’API répond en erreur HTTP', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response)
    expect(await geocoder({ ville: 'Cachan', code_postal: '94230' })).toBeNull()
  })

  it('retourne null si le réseau échoue', async () => {
    fetchMock.mockRejectedValue(new Error('ENOTFOUND'))
    expect(await geocoder({ ville: 'Cachan', code_postal: '94230' })).toBeNull()
  })

  it('retourne null sur une réponse vide ou malformée', async () => {
    fetchMock.mockResolvedValue(reponse([]))
    expect(await geocoder({ ville: 'Cachan' })).toBeNull()

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response)
    expect(await geocoder({ ville: 'Cachan' })).toBeNull()

    fetchMock.mockResolvedValue(
      reponse([{ geometry: { coordinates: ['x', 'y'] }, properties: { type: 'street' } }])
    )
    expect(await geocoder({ ville: 'Cachan' })).toBeNull()
  })
})

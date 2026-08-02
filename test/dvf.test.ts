import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MockInstance } from 'vitest'
import {
  nombreDvf,
  venteDepuisFeature,
  extraireVentes,
  ventesProches,
  statistiquesMarche,
  cleCache
} from '../server/utils/dvf'
import { ressembleVente, prixAuM2, ecartPct } from '~/composables/useMarche'
import type { MarcheQuartier } from '~/types'

let fetchMock: MockInstance<typeof fetch>

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => {
  vi.restoreAllMocks()
})

const feature = (props: Record<string, unknown>) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [2.35, 48.85] },
  properties: props
})

const venteOk = (valeur: unknown, surface: unknown, extra: Record<string, unknown> = {}) =>
  feature({
    nature_mutation: 'Vente',
    type_local: 'Appartement',
    valeur_fonciere: valeur,
    surface_reelle_bati: surface,
    date_mutation: '2024-03-15',
    ...extra
  })

describe('nombreDvf', () => {
  it('accepte les nombres', () => {
    expect(nombreDvf(120000)).toBe(120000)
    expect(nombreDvf(45.5)).toBe(45.5)
  })

  it('parse les chaînes à virgule et espaces', () => {
    expect(nombreDvf('120000,00')).toBe(120000)
    expect(nombreDvf('1 234,5')).toBe(1234.5)
  })

  it('rejette le reste', () => {
    expect(nombreDvf(null)).toBeNull()
    expect(nombreDvf(undefined)).toBeNull()
    expect(nombreDvf('abc')).toBeNull()
    expect(nombreDvf(NaN)).toBeNull()
    expect(nombreDvf('')).toBeNull()
  })
})

describe('venteDepuisFeature', () => {
  it('extrait un prix au m² arrondi et la date', () => {
    expect(venteDepuisFeature(venteOk(250000, 50))).toEqual({ prixM2: 5000, date: '2024-03-15' })
    expect(venteDepuisFeature(venteOk('250000,00', '48,5'))).toEqual({
      prixM2: 5155,
      date: '2024-03-15'
    })
  })

  it('garde les ventes en l’état futur d’achèvement mais pas les autres natures', () => {
    expect(
      venteDepuisFeature(venteOk(250000, 50, { nature_mutation: "Vente en l'état futur d'achèvement" }))
    ).not.toBeNull()
    expect(venteDepuisFeature(venteOk(250000, 50, { nature_mutation: 'Echange' }))).toBeNull()
    expect(venteDepuisFeature(venteOk(250000, 50, { nature_mutation: 'Adjudication' }))).toBeNull()
  })

  it('ignore les maisons et les locaux', () => {
    expect(venteDepuisFeature(venteOk(250000, 50, { type_local: 'Maison' }))).toBeNull()
    expect(venteDepuisFeature(venteOk(250000, 50, { type_local: 'Local industriel. commercial ou assimilé' }))).toBeNull()
  })

  it('lit l’ancien nom de champ surface_relle_batiment', () => {
    const f = feature({
      nature_mutation: 'Vente',
      type_local: 'Appartement',
      valeur_fonciere: 250000,
      surface_relle_batiment: 50
    })
    expect(venteDepuisFeature(f)).toEqual({ prixM2: 5000, date: '' })
  })

  it('rejette les surfaces et prix au m² invraisemblables', () => {
    expect(venteDepuisFeature(venteOk(250000, 5))).toBeNull() // surface < 9 m²
    expect(venteDepuisFeature(venteOk(250000, 600))).toBeNull() // surface > 500 m²
    expect(venteDepuisFeature(venteOk(1000, 30))).toBeNull() // 33 €/m²
    expect(venteDepuisFeature(venteOk(90000000, 100))).toBeNull() // 900 000 €/m²
    expect(venteDepuisFeature(venteOk(null, 50))).toBeNull()
    expect(venteDepuisFeature(venteOk(250000, null))).toBeNull()
  })

  it('rejette une feature sans properties', () => {
    expect(venteDepuisFeature({ type: 'Feature' })).toBeNull()
    expect(venteDepuisFeature(null)).toBeNull()
  })
})

describe('extraireVentes', () => {
  it('ne garde que les ventes exploitables', () => {
    const json = {
      type: 'FeatureCollection',
      features: [
        venteOk(250000, 50),
        venteOk(300000, 60, { type_local: 'Maison' }),
        venteOk(280000, 55)
      ]
    }
    expect(extraireVentes(json)).toHaveLength(2)
  })

  it('tolère une réponse vide ou malformée', () => {
    expect(extraireVentes({})).toEqual([])
    expect(extraireVentes(null)).toEqual([])
    expect(extraireVentes({ features: 'oops' })).toEqual([])
  })
})

describe('ventesProches — requête', () => {
  const reponse = (features: unknown[]) =>
    ({ ok: true, json: async () => ({ features }) }) as unknown as Response

  it('interroge l’API avec lat/lon/dist et les filtres vente + appartement', async () => {
    fetchMock.mockResolvedValue(reponse([venteOk(250000, 50)]))
    const ventes = await ventesProches(48.8566, 2.3522, 500)

    const u = new URL(fetchMock.mock.calls[0]![0] as URL)
    expect(u.origin + u.pathname).toBe('https://api.cquest.org/dvf')
    expect(u.searchParams.get('lat')).toBe('48.8566')
    expect(u.searchParams.get('lon')).toBe('2.3522')
    expect(u.searchParams.get('dist')).toBe('500')
    expect(u.searchParams.get('nature_mutation')).toBe('Vente')
    expect(u.searchParams.get('type_local')).toBe('Appartement')
    expect(ventes).toEqual([{ prixM2: 5000, date: '2024-03-15' }])
  })

  it('renvoie [] si l’API est en erreur ou injoignable', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response)
    expect(await ventesProches(48.85, 2.35)).toEqual([])

    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await ventesProches(48.85, 2.35)).toEqual([])
  })
})

describe('statistiquesMarche', () => {
  const v = (prixM2: number, date = '2024-01-01') => ({ prixM2, date })

  it('renvoie null en dessous de 3 ventes', () => {
    expect(statistiquesMarche([])).toBeNull()
    expect(statistiquesMarche([v(5000), v(6000)])).toBeNull()
  })

  it('calcule médiane, quartiles et bornes', () => {
    const m = statistiquesMarche([v(4000), v(5000), v(6000), v(7000)])!
    expect(m.mediane).toBe(5500)
    expect(m.q1).toBe(4750)
    expect(m.q3).toBe(6250)
    expect(m.min).toBe(4000)
    expect(m.max).toBe(7000)
    expect(m.nbVentes).toBe(4)
  })

  it('médiane d’un nombre impair de ventes', () => {
    const m = statistiquesMarche([v(4000), v(5000), v(9000)])!
    expect(m.mediane).toBe(5000)
  })

  it('l’histogramme compte toutes les ventes', () => {
    const ventes = [v(3000), v(3200), v(5000), v(5400), v(9000)]
    const m = statistiquesMarche(ventes)!
    expect(m.barres).toHaveLength(8)
    expect(m.barres.reduce((a, b) => a + b, 0)).toBe(5)
  })

  it('supporte des prix tous identiques', () => {
    const m = statistiquesMarche([v(5000), v(5000), v(5000)])!
    expect(m.min).toBe(m.max)
    expect(m.barres.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('borne la période par les dates extrêmes', () => {
    const m = statistiquesMarche([
      v(5000, '2023-11-02'),
      v(5200, '2024-06-18'),
      v(4800, '2024-03-05')
    ])!
    expect(m.du).toBe('2023-11-02')
    expect(m.au).toBe('2024-06-18')
  })
})

describe('cleCache', () => {
  it('arrondit à la maille de 0,01°', () => {
    expect(cleCache(48.8566, 2.3522)).toBe('48.86,2.35')
    expect(cleCache(45.764, 4.8357)).toBe('45.76,4.84')
  })
})

describe('ressembleVente / prixAuM2 / ecartPct', () => {
  it('distingue un loyer d’un prix de vente', () => {
    expect(ressembleVente({ prix: 120000 })).toBe(false) // 1 200 €/mois
    expect(ressembleVente({ prix: 25000000 })).toBe(true) // 250 000 €
    expect(ressembleVente({ prix: 0 })).toBe(false)
  })

  it('calcule le prix au m² en euros', () => {
    expect(prixAuM2({ prix: 25000000, surface: 50 })).toBe(5000)
    expect(prixAuM2({ prix: 25000000, surface: 0 })).toBeNull()
  })

  it('mesure l’écart à la médiane en %, négatif sous le marché', () => {
    const marche = { mediane: 5000 } as MarcheQuartier
    expect(ecartPct(4500, marche)).toBe(-10)
    expect(ecartPct(5600, marche)).toBe(12)
    expect(ecartPct(5000, marche)).toBe(0)
  })
})

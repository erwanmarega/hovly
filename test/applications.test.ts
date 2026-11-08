import { describe, it, expect, vi } from 'vitest'
import {
  MAX_STEP_AMOUNT_CENTS,
  MAX_STEP_NOTE_LENGTH,
  currentStatus,
  offerAnalysis,
  statusAfterStep,
  stepLabel,
  validateStep
} from '../app/utils/applications'
import { gapPercent } from '../app/composables/useMarket'
import type { NeighborhoodMarket } from '../app/types'

const market = { mediane: 5000 } as NeighborhoodMarket

describe('statusAfterStep', () => {
  it('mappe chaque type vers le bon statut', () => {
    expect(statusAfterStep('candidature')).toBe('en_attente')
    expect(statusAfterStep('contre_offre')).toBe('en_attente')
    expect(statusAfterStep('acceptation')).toBe('accepte')
    expect(statusAfterStep('refus')).toBe('refuse')
  })
})

describe('currentStatus', () => {
  const step = (type: any, fait_le: string, created_at = fait_le) => ({ type, fait_le, created_at })

  it('renvoie le fallback sans étape', () => {
    expect(currentStatus([], 'a_visiter')).toBe('a_visiter')
  })

  it('la dernière étape par fait_le gagne, quel que soit l’ordre du tableau', () => {
    const a = step('candidature', '2026-01-01T00:00:00Z')
    const b = step('acceptation', '2026-01-05T00:00:00Z')
    expect(currentStatus([a, b], 'a_visiter')).toBe('accepte')
    expect(currentStatus([b, a], 'a_visiter')).toBe('accepte')
  })

  it('à fait_le égal, le created_at le plus récent gagne', () => {
    const a = step('candidature', '2026-01-01T00:00:00Z', '2026-01-01T10:00:00Z')
    const b = step('refus', '2026-01-01T00:00:00Z', '2026-01-01T11:00:00Z')
    expect(currentStatus([a, b], 'a_visiter')).toBe('refuse')
    expect(currentStatus([b, a], 'a_visiter')).toBe('refuse')
  })

  it('après suppression de la dernière étape, la précédente pilote le statut', () => {
    const a = step('candidature', '2026-01-01T00:00:00Z')
    const b = step('refus', '2026-01-05T00:00:00Z')
    expect(currentStatus([a, b], 'a_visiter')).toBe('refuse')
    expect(currentStatus([a], 'a_visiter')).toBe('en_attente')
  })
})

describe('stepLabel', () => {
  it('libellés location', () => {
    expect(stepLabel('candidature', 'location')).toBe('Dossier envoyé')
    expect(stepLabel('contre_offre', 'location')).toBe('Contre-proposition')
    expect(stepLabel('acceptation', 'location')).toBe('Dossier accepté')
    expect(stepLabel('refus', 'location')).toBe('Dossier refusé')
  })

  it('libellés achat', () => {
    expect(stepLabel('candidature', 'achat')).toBe('Offre faite')
    expect(stepLabel('contre_offre', 'achat')).toBe('Contre-proposition')
    expect(stepLabel('acceptation', 'achat')).toBe('Offre acceptée')
    expect(stepLabel('refus', 'achat')).toBe('Offre refusée')
  })
})

describe('offerAnalysis', () => {
  it('écart négatif vs prix affiché', () => {
    expect(offerAnalysis(27_000_000, { prix: 30_000_000, surface: 50 }, null).askingGapPercent).toBe(-10)
  })

  it('écart positif vs prix affiché', () => {
    expect(offerAnalysis(31_500_000, { prix: 30_000_000, surface: 50 }, null).askingGapPercent).toBe(5)
  })

  it('arrondit à 1 décimale', () => {
    // (29_900_000 - 30_000_000) / 30_000_000 = -0.3333 %
    expect(offerAnalysis(29_900_000, { prix: 30_000_000, surface: 50 }, null).askingGapPercent).toBe(-0.3)
  })

  it('prix 0 → écart affiché null', () => {
    expect(offerAnalysis(100, { prix: 0, surface: 50 }, market).askingGapPercent).toBeNull()
  })

  it('surface 0 ou null → écart marché null', () => {
    expect(offerAnalysis(100, { prix: 100, surface: 0 }, market).marketGapPercent).toBeNull()
    expect(offerAnalysis(100, { prix: 100, surface: null }, market).marketGapPercent).toBeNull()
  })

  it('marché null → écart marché null', () => {
    expect(offerAnalysis(100, { prix: 100, surface: 50 }, null).marketGapPercent).toBeNull()
  })

  it('écart marché cohérent avec gapPercent', () => {
    // 25_000_000 cts = 250 000 € / 50 m² = 5000 €/m² → 0 %; 27_500_000 → 5500 €/m² → +10 %
    expect(offerAnalysis(25_000_000, { prix: 26_000_000, surface: 50 }, market).marketGapPercent).toBe(0)
    const r = offerAnalysis(27_500_000, { prix: 30_000_000, surface: 50 }, market)
    expect(r.marketGapPercent).toBe(gapPercent(5500, market))
    expect(r.marketGapPercent).toBe(10)
  })
})

describe('validateStep', () => {
  const T = 'achat' as const

  it('type inconnu ou corps non objet → erreur de type', () => {
    expect(() => validateStep({ type: 'nope' }, T)).toThrow('Type de démarche invalide')
    expect(() => validateStep(null, T)).toThrow('Type de démarche invalide')
    expect(() => validateStep('candidature', T)).toThrow('Type de démarche invalide')
    expect(() => validateStep(undefined, T)).toThrow('Type de démarche invalide')
  })

  it('montants invalides rejetés', () => {
    for (const montant of [-1, 1.5, '1000', MAX_STEP_AMOUNT_CENTS + 1, Number.NaN, Infinity]) {
      expect(() => validateStep({ type: 'candidature', montant }, T)).toThrow('Montant invalide')
    }
  })

  it('montant valide conservé pour candidature et contre_offre, bornes incluses', () => {
    expect(validateStep({ type: 'candidature', montant: 0 }, T).montant).toBe(0)
    expect(validateStep({ type: 'contre_offre', montant: MAX_STEP_AMOUNT_CENTS }, T).montant).toBe(MAX_STEP_AMOUNT_CENTS)
  })

  it('montant ignoré pour acceptation et refus', () => {
    expect(validateStep({ type: 'acceptation', montant: 1000 }, T).montant).toBeNull()
    expect(validateStep({ type: 'refus', montant: 1000 }, T).montant).toBeNull()
  })

  it('montant absent → null', () => {
    expect(validateStep({ type: 'candidature' }, T).montant).toBeNull()
  })

  it('note trimée, vide → null', () => {
    expect(validateStep({ type: 'refus', note: '  hello  ' }, T).note).toBe('hello')
    expect(validateStep({ type: 'refus', note: '   ' }, T).note).toBeNull()
    expect(validateStep({ type: 'refus' }, T).note).toBeNull()
  })

  it('note trop longue ou non string → erreur', () => {
    expect(validateStep({ type: 'refus', note: 'a'.repeat(MAX_STEP_NOTE_LENGTH) }, T).note).toHaveLength(MAX_STEP_NOTE_LENGTH)
    expect(() => validateStep({ type: 'refus', note: 'a'.repeat(MAX_STEP_NOTE_LENGTH + 1) }, T)).toThrow('dépasser')
    expect(() => validateStep({ type: 'refus', note: 42 }, T)).toThrow('Note invalide')
  })

  it('fait_le invalide → erreur', () => {
    expect(() => validateStep({ type: 'refus', fait_le: 'pas une date' }, T)).toThrow('Date invalide')
    expect(() => validateStep({ type: 'refus', fait_le: 123 }, T)).toThrow('Date invalide')
  })

  it('fait_le à plus d’un jour dans le futur → erreur, moins d’un jour accepté', () => {
    const future = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(() => validateStep({ type: 'refus', fait_le: future }, T)).toThrow('futur')
    const soon = new Date(Date.now() + 3_600_000).toISOString()
    expect(validateStep({ type: 'refus', fait_le: soon }, T).fait_le).toBe(soon)
  })

  it('fait_le absent → maintenant en ISO', () => {
    const before = Date.now()
    const r = validateStep({ type: 'refus' }, T)
    const t = Date.parse(r.fait_le)
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })
})

describe('POST /api/biens/:id/demarches', () => {
  const setup = (bien: any, opts: { insertError?: any; updateError?: any } = {}) => {
    const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: opts.updateError ?? null })) }))
    const insert = vi.fn((row: any) => ({
      select: () => ({ single: async () => (opts.insertError ? { data: null, error: opts.insertError } : { data: { id: 's1', ...row }, error: null }) })
    }))
    const client = {
      from: vi.fn((table: string) => table === 'biens'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: bien }) }) }), update }
        : { insert })
    }
    vi.stubGlobal('defineEventHandler', (fn: any) => fn)
    vi.stubGlobal('requireUser', vi.fn(async () => ({ id: 'u1' })))
    vi.stubGlobal('db', vi.fn(async () => client))
    vi.stubGlobal('getRouterParam', () => 'b1')
    vi.stubGlobal('createError', (e: any) => Object.assign(new Error(e.statusMessage), e))
    return { insert, update }
  }
  const call = async (body: unknown) => {
    vi.stubGlobal('readBody', async () => body)
    vi.resetModules()
    const handler = (await import('../server/api/biens/[id]/demarches.post')).default as any
    return handler({ node: { req: { headers: {} } } })
  }

  it('404 si le bien est introuvable', async () => {
    const { insert } = setup(null)
    await expect(call({ type: 'candidature' })).rejects.toMatchObject({ statusCode: 404 })
    expect(insert).not.toHaveBeenCalled()
  })

  it('400 sur corps invalide, sans insertion', async () => {
    const { insert } = setup({ id: 'b1', transaction: 'achat' })
    await expect(call({ type: 'bogus' })).rejects.toMatchObject({ statusCode: 400 })
    expect(insert).not.toHaveBeenCalled()
  })

  it('insère l’étape et met à jour le statut du bien', async () => {
    const { insert, update } = setup({ id: 'b1', transaction: 'achat' })
    const res = await call({ type: 'acceptation', montant: 5 })
    expect(res.statut).toBe('accepte')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ bien_id: 'b1', type: 'acceptation', montant: null }))
    expect(update).toHaveBeenCalledWith({ statut: 'accepte' })
  })

  it('500 si l’insertion échoue, sans toucher au statut', async () => {
    const { update } = setup({ id: 'b1', transaction: 'achat' }, { insertError: { message: 'boom' } })
    await expect(call({ type: 'refus' })).rejects.toMatchObject({ statusCode: 500 })
    expect(update).not.toHaveBeenCalled()
  })
})

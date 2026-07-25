import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Bien } from '../app/types'

const envoyerRappelEmail = vi.fn()
const envoyerPush = vi.fn()
const pushDisponible = vi.fn()

vi.mock('../server/utils/email', () => ({
  envoyerRappelEmail: (...a: any[]) => envoyerRappelEmail(...a)
}))
vi.mock('../server/utils/push', () => ({
  envoyerPush: (...a: any[]) => envoyerPush(...a),
  pushDisponible: () => pushDisponible()
}))

const { aRappeler, envoyerRappels } = await import('../server/utils/rappels')

const MAINTENANT = new Date('2026-07-25T09:00:00.000Z')
const dans = (heures: number) =>
  new Date(MAINTENANT.getTime() + heures * 3600_000).toISOString()

function bien(over: Partial<Bien> = {}): Bien {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.pap.fr/annonces/1',
    site_source: 'pap',
    titre: 'T2 Cachan',
    prix: 100000,
    surface: 45,
    nb_pieces: 2,
    etage: null,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Cachan',
    code_postal: '94230',
    lat: null,
    lon: null,
    geo_precision: null,
    geocode_le: null,
    photos: [],
    description: null,
    statut: 'planifie',
    note_perso: null,
    visite_le: dans(20),
    compte_rendu: null,
    checklist: null,
    rappel_envoye_le: null,
    actif: true,
    created_at: '2026-07-01T10:00:00.000Z',
    ...over
  }
}

function fakeClient() {
  const majs: { row: any; id: any }[] = []
  const client = {
    from() {
      return {
        update(row: any) {
          return {
            eq(_col: string, id: any) {
              majs.push({ row, id })
              return Promise.resolve({ error: null })
            }
          }
        }
      }
    }
  }
  return { client, majs }
}

beforeEach(() => {
  envoyerRappelEmail.mockReset()
  envoyerRappelEmail.mockResolvedValue({ envoye: true })
  envoyerPush.mockReset()
  envoyerPush.mockResolvedValue({ envoyes: 1, echecs: 0, raisons: [] })
  pushDisponible.mockReset()
  pushDisponible.mockReturnValue(true)
})

describe('aRappeler', () => {
  it('retient une visite dans les 24 h', () => {
    expect(aRappeler(bien({ visite_le: dans(20) }), MAINTENANT)).toBe(true)
    expect(aRappeler(bien({ visite_le: dans(1) }), MAINTENANT)).toBe(true)
  })

  it('écarte une visite trop lointaine ou déjà passée', () => {
    expect(aRappeler(bien({ visite_le: dans(30) }), MAINTENANT)).toBe(false)
    expect(aRappeler(bien({ visite_le: dans(-1) }), MAINTENANT)).toBe(false)
  })

  it('n’envoie qu’une fois', () => {
    expect(aRappeler(bien({ rappel_envoye_le: dans(-2) }), MAINTENANT)).toBe(false)
  })

  it('ignore un bien archivé, sans date ou avec date illisible', () => {
    expect(aRappeler(bien({ actif: false }), MAINTENANT)).toBe(false)
    expect(aRappeler(bien({ visite_le: null }), MAINTENANT)).toBe(false)
    expect(aRappeler(bien({ visite_le: 'demain' }), MAINTENANT)).toBe(false)
  })
})

describe('envoyerRappels', () => {
  it('notifie et marque le bien comme rappelé', async () => {
    const { client, majs } = fakeClient()

    const resume = await envoyerRappels(client, [bien()], 'moi@example.com', MAINTENANT)

    expect(resume).toMatchObject({ candidats: 1, envoyes: 1, echecs: 0 })
    expect(envoyerRappelEmail).toHaveBeenCalledOnce()
    expect(envoyerPush).toHaveBeenCalledOnce()
    expect(envoyerPush.mock.calls[0]![1]).toBe('u1')
    expect(envoyerPush.mock.calls[0]![2].url).toBe('/bien/b1')
    expect(majs).toEqual([
      { row: { rappel_envoye_le: MAINTENANT.toISOString() }, id: 'b1' }
    ])
  })

  it('ne touche pas aux biens hors fenêtre', async () => {
    const { client, majs } = fakeClient()

    const resume = await envoyerRappels(
      client,
      [bien({ id: 'loin', visite_le: dans(48) })],
      'moi@example.com',
      MAINTENANT
    )

    expect(resume.candidats).toBe(0)
    expect(envoyerRappelEmail).not.toHaveBeenCalled()
    expect(majs).toEqual([])
  })

  it('suffit du push quand l’email échoue', async () => {
    const { client, majs } = fakeClient()
    envoyerRappelEmail.mockResolvedValue({ envoye: false, raison: 'RESEND_API_KEY absente' })

    const resume = await envoyerRappels(client, [bien()], null, MAINTENANT)

    expect(resume.envoyes).toBe(1)
    expect(resume.raisons).toContain('RESEND_API_KEY absente')
    expect(majs).toHaveLength(1)
  })

  it('ne marque pas le bien si rien n’est parti — le prochain passage réessaiera', async () => {
    const { client, majs } = fakeClient()
    envoyerRappelEmail.mockResolvedValue({ envoye: false, raison: 'aucune adresse email' })
    envoyerPush.mockResolvedValue({ envoyes: 0, echecs: 1, raisons: ['410 gone'] })

    const resume = await envoyerRappels(client, [bien()], null, MAINTENANT)

    expect(resume).toMatchObject({ candidats: 1, envoyes: 0, echecs: 1 })
    expect(majs).toEqual([])
  })

  it('saute le push quand les clés VAPID manquent', async () => {
    const { client } = fakeClient()
    pushDisponible.mockReturnValue(false)

    const resume = await envoyerRappels(client, [bien()], 'moi@example.com', MAINTENANT)

    expect(envoyerPush).not.toHaveBeenCalled()
    expect(resume.envoyes).toBe(1)
  })
})

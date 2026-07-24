import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Bien } from '../app/types'

const scrapeUrl = vi.fn()
const envoyerAlerteEmail = vi.fn()

vi.mock('../server/utils/scrape', () => ({ scrapeUrl: (...a: any[]) => scrapeUrl(...a) }))
vi.mock('../server/utils/email', () => ({
  envoyerAlerteEmail: (...a: any[]) => envoyerAlerteEmail(...a)
}))

const { verifierBiens, notifier } = await import('../server/utils/check')

function bien(over: Partial<Bien> = {}): Bien {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.seloger.com/annonces/1.htm',
    site_source: 'seloger',
    titre: 'T2 lumineux',
    prix: 100000,
    surface: 50,
    nb_pieces: 2,
    etage: 3,
    charges: null,
    dpe: null,
    adresse: null,
    ville: 'Lyon',
    code_postal: '69003',
    photos: [],
    description: null,
    statut: 'a_visiter',
    note_perso: null,
    actif: true,
    created_at: '2026-06-20T10:00:00.000Z',
    ...over
  }
}

interface Call {
  table: string
  op: 'insert' | 'update'
  row: any
  eq?: [string, any]
}

function fakeClient() {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      return {
        insert(row: any) {
          calls.push({ table, op: 'insert', row })
          return Promise.resolve({ error: null })
        },
        update(row: any) {
          const call: Call = { table, op: 'update', row }
          calls.push(call)
          return {
            eq(col: string, val: any) {
              call.eq = [col, val]
              return Promise.resolve({ error: null })
            }
          }
        }
      }
    }
  }
  return { client, calls }
}

beforeEach(() => {
  scrapeUrl.mockReset()
  envoyerAlerteEmail.mockReset()
})

describe('verifierBiens', () => {
  it('enregistre une baisse de prix : historique, alerte, mise à jour', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 90000 } })
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 1, baisses: 1, supprimes: 0, erreurs: 0 })
    expect(resume.alertes).toEqual([
      {
        bien_id: 'b1',
        type: 'baisse_prix',
        ancien_prix: 100000,
        nouveau_prix: 90000,
        titre: 'T2 lumineux'
      }
    ])
    expect(calls).toEqual([
      { table: 'prix_historique', op: 'insert', row: { bien_id: 'b1', prix: 90000 } },
      {
        table: 'alertes',
        op: 'insert',
        row: { bien_id: 'b1', type: 'baisse_prix', ancien_prix: 100000, nouveau_prix: 90000 }
      },
      { table: 'biens', op: 'update', row: { prix: 90000 }, eq: ['id', 'b1'] }
    ])
  })

  it('met à jour le prix sans alerte quand il monte', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 120000 } })
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 1, baisses: 0 })
    expect(resume.alertes).toEqual([])
    expect(calls.filter((c) => c.table === 'alertes')).toEqual([])
    expect(calls).toContainEqual({
      table: 'biens',
      op: 'update',
      row: { prix: 120000 },
      eq: ['id', 'b1']
    })
  })

  it('n’écrit que l’historique quand le prix est inchangé', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 100000 } })
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 1, baisses: 0, erreurs: 0 })
    expect(calls).toEqual([
      { table: 'prix_historique', op: 'insert', row: { bien_id: 'b1', prix: 100000 } }
    ])
  })

  it('désactive le bien et alerte quand l’annonce est supprimée', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: true, data: {} })
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 1, supprimes: 1, baisses: 0 })
    expect(resume.alertes[0]).toMatchObject({ type: 'annonce_supprimee', nouveau_prix: null })
    expect(calls).toEqual([
      { table: 'biens', op: 'update', row: { actif: false }, eq: ['id', 'b1'] },
      {
        table: 'alertes',
        op: 'insert',
        row: {
          bien_id: 'b1',
          type: 'annonce_supprimee',
          ancien_prix: 100000,
          nouveau_prix: null
        }
      }
    ])
  })

  it('compte une erreur et n’écrit rien si le scrape échoue', async () => {
    scrapeUrl.mockRejectedValue(new Error('timeout'))
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 0, erreurs: 1 })
    expect(calls).toEqual([])
  })

  it('ignore un scrape sans prix', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: {} })
    const { client, calls } = fakeClient()

    const resume = await verifierBiens(client, [bien()])

    expect(resume).toMatchObject({ verifies: 1, baisses: 0, erreurs: 0 })
    expect(calls).toEqual([])
  })

  it('poursuit la boucle après une erreur sur un bien', async () => {
    scrapeUrl
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ indisponible: false, data: { prix: 80000 } })
    const { client } = fakeClient()

    const resume = await verifierBiens(client, [bien({ id: 'ko' }), bien({ id: 'ok' })])

    expect(resume).toMatchObject({ verifies: 1, erreurs: 1, baisses: 1 })
    expect(resume.alertes.map((a) => a.bien_id)).toEqual(['ok'])
  })

  it('retourne un résumé vide sans bien', async () => {
    const { client } = fakeClient()
    expect(await verifierBiens(client, [])).toEqual({
      verifies: 0,
      baisses: 0,
      supprimes: 0,
      erreurs: 0,
      alertes: []
    })
  })
})

describe('notifier', () => {
  const resume = {
    verifies: 1,
    baisses: 1,
    supprimes: 0,
    erreurs: 0,
    alertes: [
      {
        bien_id: 'b1',
        type: 'baisse_prix' as const,
        ancien_prix: 100000,
        nouveau_prix: 90000,
        titre: 'T2'
      },
      {
        bien_id: 'b2',
        type: 'annonce_supprimee' as const,
        ancien_prix: 100000,
        nouveau_prix: null,
        titre: 'T3'
      }
    ]
  }

  it('envoie un email par alerte', async () => {
    envoyerAlerteEmail.mockResolvedValue(undefined)
    await notifier('a@b.fr', resume)
    expect(envoyerAlerteEmail).toHaveBeenCalledTimes(2)
    expect(envoyerAlerteEmail).toHaveBeenNthCalledWith(1, 'a@b.fr', resume.alertes[0])
    expect(envoyerAlerteEmail).toHaveBeenNthCalledWith(2, 'a@b.fr', resume.alertes[1])
  })

  it('n’envoie rien sans email', async () => {
    await notifier(null, resume)
    expect(envoyerAlerteEmail).not.toHaveBeenCalled()
  })

  it('n’envoie rien sans alerte', async () => {
    await notifier('a@b.fr', { ...resume, alertes: [] })
    expect(envoyerAlerteEmail).not.toHaveBeenCalled()
  })

  it('avale les erreurs d’envoi', async () => {
    envoyerAlerteEmail.mockRejectedValue(new Error('smtp down'))
    await expect(notifier('a@b.fr', resume)).resolves.toBeUndefined()
    expect(envoyerAlerteEmail).toHaveBeenCalledTimes(2)
  })
})

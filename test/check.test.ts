import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Property } from '../app/types'

const scrapeUrl = vi.fn()
const sendAlertEmail = vi.fn()

vi.mock('../server/utils/scrape', () => ({ scrapeUrl: (...a: any[]) => scrapeUrl(...a) }))
vi.mock('../server/utils/email', () => ({
  sendAlertEmail: (...a: any[]) => sendAlertEmail(...a)
}))

const { checkProperties, notify } = await import('../server/utils/check')

function bien(over: Partial<Property> = {}): Property {
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
  sendAlertEmail.mockReset()
})

describe('checkProperties', () => {
  it('enregistre une baisse de prix : historique, alerte, mise à jour', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 90000 } })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 1, removed: 0, errors: 0 })
    expect(summary.alerts).toEqual([
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

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 0 })
    expect(summary.alerts).toEqual([])
    expect(calls.filter((c) => c.table === 'alertes')).toEqual([])
    expect(calls).toContainEqual({
      table: 'biens',
      op: 'update',
      row: { prix: 120000 },
      eq: ['id', 'b1']
    })
  })

  it('n’écrit rien quand le prix est inchangé', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 100000 } })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 0, errors: 0 })
    expect(calls).toEqual([])
  })

  it('ignore un prix aberrant sans rien écrire', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 97199900 } })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 0, errors: 0 })
    expect(summary.alerts).toEqual([])
    expect(calls).toEqual([])
  })

  it('ignore une baisse aberrante sans rien écrire', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: { prix: 30000 } })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 0, errors: 0 })
    expect(calls).toEqual([])
  })

  it('désactive le bien et alerte quand l’annonce est supprimée', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: true, data: {} })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, removed: 1, priceDrops: 0 })
    expect(summary.alerts[0]).toMatchObject({ type: 'annonce_supprimee', nouveau_prix: null })
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

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 0, errors: 1 })
    expect(calls).toEqual([])
  })

  it('ignore un scrape sans prix', async () => {
    scrapeUrl.mockResolvedValue({ indisponible: false, data: {} })
    const { client, calls } = fakeClient()

    const summary = await checkProperties(client, [bien()])

    expect(summary).toMatchObject({ checked: 1, priceDrops: 0, errors: 0 })
    expect(calls).toEqual([])
  })

  it('poursuit la boucle après une erreur sur un bien', async () => {
    scrapeUrl
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ indisponible: false, data: { prix: 80000 } })
    const { client } = fakeClient()

    const summary = await checkProperties(client, [bien({ id: 'ko' }), bien({ id: 'ok' })])

    expect(summary).toMatchObject({ checked: 1, errors: 1, priceDrops: 1 })
    expect(summary.alerts.map((a) => a.bien_id)).toEqual(['ok'])
  })

  it('retourne un résumé vide sans bien', async () => {
    const { client } = fakeClient()
    expect(await checkProperties(client, [])).toEqual({
      checked: 0,
      priceDrops: 0,
      removed: 0,
      errors: 0,
      alerts: []
    })
  })
})

describe('notify', () => {
  const summary = {
    checked: 1,
    priceDrops: 1,
    removed: 0,
    errors: 0,
    alerts: [
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

  it('envoie un email par alerte et compte les envois', async () => {
    sendAlertEmail.mockResolvedValue({ envoye: true })
    const emails = await notify('a@b.fr', summary)

    expect(sendAlertEmail).toHaveBeenCalledTimes(2)
    expect(sendAlertEmail).toHaveBeenNthCalledWith(1, 'a@b.fr', summary.alerts[0])
    expect(sendAlertEmail).toHaveBeenNthCalledWith(2, 'a@b.fr', summary.alerts[1])
    expect(emails).toEqual({ sent: 2, failed: 0, reasons: [] })
  })

  it('compte un échec quand il n’y a pas d’adresse email', async () => {
    const emails = await notify(null, summary)
    expect(sendAlertEmail).not.toHaveBeenCalled()
    expect(emails).toEqual({ sent: 0, failed: 2, reasons: ['aucune adresse email'] })
  })

  it('n’envoie rien sans alerte', async () => {
    const emails = await notify('a@b.fr', { ...summary, alerts: [] })
    expect(sendAlertEmail).not.toHaveBeenCalled()
    expect(emails).toEqual({ sent: 0, failed: 0, reasons: [] })
  })

  it('remonte la raison d’un refus sans lever', async () => {
    sendAlertEmail.mockResolvedValue({ envoye: false, raison: '403 domain not verified' })
    const emails = await notify('a@b.fr', summary)

    expect(emails.sent).toBe(0)
    expect(emails.failed).toBe(2)
    expect(emails.reasons).toEqual(['403 domain not verified'])
  })

  it('capture une exception d’envoi sans interrompre la boucle', async () => {
    sendAlertEmail
      .mockImplementationOnce(() => Promise.reject(new Error('smtp down')))
      .mockResolvedValueOnce({ envoye: true })

    const emails = await notify('a@b.fr', summary)

    expect(sendAlertEmail).toHaveBeenCalledTimes(2)
    expect(emails).toMatchObject({ sent: 1, failed: 1, reasons: ['smtp down'] })
  })

  it('mélange succès et échecs', async () => {
    sendAlertEmail
      .mockResolvedValueOnce({ envoye: true })
      .mockResolvedValueOnce({ envoye: false, raison: 'rate limited' })

    expect(await notify('a@b.fr', summary)).toEqual({
      sent: 1,
      failed: 1,
      reasons: ['rate limited']
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CreatedAlert } from '../app/types/check'

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: (...a: any[]) => setVapidDetails(...a),
    sendNotification: (...a: any[]) => sendNotification(...a)
  }
}))

const { alertPayload, sendPush, pushAvailable } = await import('../server/utils/push')

interface Op {
  op: 'select' | 'delete' | 'update'
  row?: any
  eq: [string, any][]
}

function fakeClient(abonnements: any[], erreurSelect: string | null = null) {
  const ops: Op[] = []

  function chainable(op: Op, resultat: any = { data: null, error: null }) {
    const chain: any = {
      eq(col: string, val: any) {
        op.eq.push([col, val])
        return chain
      },
      then(res: any, rej: any) {
        return Promise.resolve(resultat).then(res, rej)
      }
    }
    return chain
  }

  const client = {
    from() {
      return {
        select() {
          const op: Op = { op: 'select', eq: [] }
          ops.push(op)
          return chainable(op, {
            data: erreurSelect ? null : abonnements,
            error: erreurSelect ? { message: erreurSelect } : null
          })
        },
        delete() {
          const op: Op = { op: 'delete', eq: [] }
          ops.push(op)
          return chainable(op)
        },
        update(row: any) {
          const op: Op = { op: 'update', row, eq: [] }
          ops.push(op)
          return chainable(op)
        }
      }
    }
  }

  return { client, ops }
}

const abonnement = (id: string) => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: 'cle-publique',
  auth: 'secret'
})

const alerte = (over: Partial<CreatedAlert> = {}): CreatedAlert => ({
  bien_id: 'b1',
  type: 'baisse_prix',
  ancien_prix: 100000,
  nouveau_prix: 92000,
  titre: 'T2 lumineux',
  ...over
})

beforeEach(() => {
  sendNotification.mockReset()
  sendNotification.mockResolvedValue({})
  setVapidDetails.mockReset()
  process.env.VAPID_PUBLIC_KEY = 'publique'
  process.env.VAPID_PRIVATE_KEY = 'privee'
})

describe('alertPayload', () => {
  it('affiche l’ancien et le nouveau prix en euros pour une baisse', () => {
    const p = alertPayload(alerte())
    expect(p.titre).toContain('T2 lumineux')
    expect(p.corps.replace(/\s/g, ' ')).toBe('1 000 € → 920 €')
    expect(p.url).toBe('/bien/b1')
    expect(p.tag).toBe('bien-b1')
  })

  it('reste lisible si un prix manque', () => {
    const p = alertPayload(alerte({ nouveau_prix: null }))
    expect(p.corps).toBe('Le prix a baissé.')
  })

  it('gère une annonce supprimée', () => {
    const p = alertPayload(alerte({ type: 'annonce_supprimee', nouveau_prix: null }))
    expect(p.titre).toContain('Annonce supprimée')
    expect(p.url).toBe('/bien/b1')
  })
})

describe('pushAvailable', () => {
  it('est faux sans clés VAPID', () => {
    delete process.env.VAPID_PUBLIC_KEY
    expect(pushAvailable()).toBe(false)
  })

  it('est vrai avec les clés', () => {
    expect(pushAvailable()).toBe(true)
  })
})

describe('sendPush', () => {
  const payload = { titre: 'T', corps: 'C', url: '/alertes' }

  it('envoie à chaque appareil de l’utilisateur', async () => {
    const { client, ops } = fakeClient([abonnement('a1'), abonnement('a2')])

    const res = await sendPush(client, 'u1', payload)

    expect(res).toEqual({ sent: 2, failed: 0, reasons: [] })
    expect(sendNotification).toHaveBeenCalledTimes(2)
    expect(sendNotification.mock.calls[0]![0]).toEqual({
      endpoint: 'https://push.example/a1',
      keys: { p256dh: 'cle-publique', auth: 'secret' }
    })
    expect(JSON.parse(sendNotification.mock.calls[0]![1])).toEqual(payload)
    expect(ops[0]!.eq).toEqual([['user_id', 'u1']])
  })

  it('supprime un abonnement révoqué (410)', async () => {
    const { client, ops } = fakeClient([abonnement('a1')])
    sendNotification.mockRejectedValue({ statusCode: 410, body: 'gone' })

    const res = await sendPush(client, 'u1', payload)

    expect(res.sent).toBe(0)
    expect(res.failed).toBe(1)
    const suppression = ops.find((o) => o.op === 'delete')
    expect(suppression?.eq).toEqual([['id', 'a1']])
  })

  it('mémorise l’erreur sans supprimer sur panne temporaire (500)', async () => {
    const { client, ops } = fakeClient([abonnement('a1')])
    sendNotification.mockRejectedValue({ statusCode: 500, body: 'boom' })

    const res = await sendPush(client, 'u1', payload)

    expect(res.failed).toBe(1)
    expect(ops.some((o) => o.op === 'delete')).toBe(false)
    const maj = ops.find((o) => o.op === 'update')
    expect(maj?.row.derniere_erreur).toBe('500 boom')
  })

  it('ne tente rien sans clés VAPID', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    const { client } = fakeClient([abonnement('a1')])

    const res = await sendPush(client, 'u1', payload)

    expect(sendNotification).not.toHaveBeenCalled()
    expect(res.reasons).toContain('clés VAPID absentes')
  })

  it('remonte une erreur de lecture des abonnements', async () => {
    const { client } = fakeClient([], 'table absente')

    const res = await sendPush(client, 'u1', payload)

    expect(res.failed).toBe(1)
    expect(res.reasons).toContain('table absente')
  })
})

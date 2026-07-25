import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AlerteCreee } from '../app/types/check'

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

const { envoyerAlerteEmail } = await import('../server/utils/email')

const supprimee: AlerteCreee = {
  bien_id: 'b1',
  type: 'annonce_supprimee',
  ancien_prix: 157000,
  nouveau_prix: null,
  titre: 'T3 Cachan'
}

const baisse: AlerteCreee = {
  bien_id: 'b2',
  type: 'baisse_prix',
  ancien_prix: 157000,
  nouveau_prix: 149000,
  titre: 'T2 Lyon'
}

const corps = () => fetchMock.mock.calls[0]![1].body

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ id: 'msg_1' })
  process.env.RESEND_API_KEY = 'test_key'
  delete process.env.RESEND_FROM
})

afterEach(() => {
  delete process.env.RESEND_API_KEY
  vi.unstubAllEnvs()
})

describe('envoyerAlerteEmail — annonce supprimée', () => {
  it('envoie un email et signale le succès', async () => {
    const res = await envoyerAlerteEmail('moi@exemple.fr', supprimee)

    expect(res).toEqual({ envoye: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.resend.com/emails')
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer test_key')
  })

  it('compose un sujet et un corps explicites', async () => {
    await envoyerAlerteEmail('moi@exemple.fr', supprimee)
    const b = corps()

    expect(b.to).toBe('moi@exemple.fr')
    expect(b.subject).toBe('Annonce supprimée — T3 Cachan')
    expect(b.html).toContain('T3 Cachan')
    expect(b.html).toContain('Archivés')
  })

  it('utilise l’expéditeur par défaut sans RESEND_FROM', async () => {
    await envoyerAlerteEmail('moi@exemple.fr', supprimee)
    expect(corps().from).toBe('Hovly <onboarding@resend.dev>')
  })

  it('respecte RESEND_FROM quand il est défini', async () => {
    process.env.RESEND_FROM = 'Hovly <alertes@hovly.fr>'
    await envoyerAlerteEmail('moi@exemple.fr', supprimee)
    expect(corps().from).toBe('Hovly <alertes@hovly.fr>')
  })
})

describe('envoyerAlerteEmail — baisse de prix', () => {
  it('affiche l’ancien et le nouveau prix en euros', async () => {
    await envoyerAlerteEmail('moi@exemple.fr', baisse)
    const b = corps()

    expect(b.subject).toBe('Baisse de prix — T2 Lyon')
    expect(b.html).toMatch(/1\s570\s€/u)
    expect(b.html).toMatch(/1\s490\s€/u)
  })
})

describe('envoyerAlerteEmail — échecs', () => {
  it('ne tente rien et explique quand la clé API manque', async () => {
    delete process.env.RESEND_API_KEY
    const res = await envoyerAlerteEmail('moi@exemple.fr', supprimee)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(res).toEqual({ envoye: false, raison: 'RESEND_API_KEY absente' })
  })

  it('remonte la raison renvoyée par Resend', async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(
        Object.assign(new Error('Forbidden'), {
          statusCode: 403,
          data: { message: 'The hovly.fr domain is not verified' }
        })
      )
    )

    const res = await envoyerAlerteEmail('moi@exemple.fr', supprimee)

    expect(res.envoye).toBe(false)
    expect(res.raison).toBe('403 The hovly.fr domain is not verified')
  })

  it('retombe sur le message d’erreur brut', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('ECONNRESET')))
    const res = await envoyerAlerteEmail('moi@exemple.fr', supprimee)

    expect(res.envoye).toBe(false)
    expect(res.raison).toBe('ECONNRESET')
  })
})

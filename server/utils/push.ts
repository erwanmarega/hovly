import webpush from 'web-push'
import type { CreatedAlert, SendSummary } from '~/types/check'
import { formatPrice } from './price'

export interface PushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushPayload {
  titre: string
  corps: string
  url: string
  tag?: string
}

let configured = false

export function pushAvailable(): boolean {
  const publique = process.env.VAPID_PUBLIC_KEY
  const privee = process.env.VAPID_PRIVATE_KEY
  if (!publique || !privee) return false

  if (!configured) {
    const subject = process.env.VAPID_SUBJECT || 'mailto:contact@hovly.app'
    webpush.setVapidDetails(subject, publique, privee)
    configured = true
  }
  return true
}

export function alertPayload(alerte: CreatedAlert): PushPayload {
  if (alerte.type === 'baisse_prix') {
    const ancien = formatPrice(alerte.ancien_prix)
    const nouveau = formatPrice(alerte.nouveau_prix)
    return {
      titre: `Baisse de prix — ${alerte.titre}`,
      corps: ancien && nouveau ? `${ancien} → ${nouveau}` : 'Le prix a baissé.',
      url: `/bien/${alerte.bien_id}`,
      tag: `bien-${alerte.bien_id}`
    }
  }

  return {
    titre: `Annonce supprimée — ${alerte.titre}`,
    corps: 'Le bien est probablement loué ou vendu. Il reste consultable dans Hovly.',
    url: `/bien/${alerte.bien_id}`,
    tag: `bien-${alerte.bien_id}`
  }
}

export async function sendPush(
  client: any,
  userId: string,
  payload: PushPayload
): Promise<SendSummary> {
  const result: SendSummary = { sent: 0, failed: 0, reasons: [] }

  if (!pushAvailable()) {
    result.reasons.push('clés VAPID absentes')
    return result
  }

  const { data, error } = await client
    .from('push_abonnements')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    result.failed++
    result.reasons.push(error.message)
    return result
  }

  const subscriptions = (data ?? []) as PushSubscription[]
  const body = JSON.stringify(payload)

  for (const a of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        body,
        { TTL: 60 * 60 * 24 }
      )
      result.sent++
    } catch (e: unknown) {
      const err = e as { statusCode?: number; body?: string; message?: string }
      result.failed++
      const raison = `${err.statusCode ?? ''} ${err.body || err.message || 'erreur inconnue'}`.trim()
      if (!result.reasons.includes(raison)) result.reasons.push(raison)

      if (err.statusCode === 404 || err.statusCode === 410) {
        await client.from('push_abonnements').delete().eq('id', a.id)
      } else {
        await client.from('push_abonnements').update({ derniere_erreur: raison }).eq('id', a.id)
      }
    }
  }

  return result
}

export async function sendAlertPush(
  client: any,
  userId: string,
  alerte: CreatedAlert
): Promise<SendSummary> {
  return sendPush(client, userId, alertPayload(alerte))
}

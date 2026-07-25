import webpush from 'web-push'
import type { AlerteCreee, ResumeEnvois } from '~/types/check'

export interface AbonnementPush {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Ce qui traverse le réseau jusqu'au service worker (`public/sw.js`). */
export interface PayloadPush {
  titre: string
  corps: string
  url: string
  /** Regroupe les notifications d'un même bien : la nouvelle remplace l'ancienne. */
  tag?: string
}

const eur = (centimes: number | null) =>
  centimes == null ? '' : Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'

let configure = false

/** Renvoie false si les clés VAPID manquent : le push est alors simplement désactivé. */
export function pushDisponible(): boolean {
  const publique = process.env.VAPID_PUBLIC_KEY
  const privee = process.env.VAPID_PRIVATE_KEY
  if (!publique || !privee) return false

  if (!configure) {
    const sujet = process.env.VAPID_SUBJECT || 'mailto:contact@hovly.app'
    webpush.setVapidDetails(sujet, publique, privee)
    configure = true
  }
  return true
}

export function payloadAlerte(alerte: AlerteCreee): PayloadPush {
  if (alerte.type === 'baisse_prix') {
    const ancien = eur(alerte.ancien_prix)
    const nouveau = eur(alerte.nouveau_prix)
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

/**
 * Envoie un payload à tous les appareils d'un utilisateur.
 * Un endpoint mort (404 / 410) est supprimé : le navigateur a révoqué l'abonnement.
 */
export async function envoyerPush(
  client: any,
  userId: string,
  payload: PayloadPush
): Promise<ResumeEnvois> {
  const envois: ResumeEnvois = { envoyes: 0, echecs: 0, raisons: [] }

  if (!pushDisponible()) {
    envois.raisons.push('clés VAPID absentes')
    return envois
  }

  const { data, error } = await client
    .from('push_abonnements')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    envois.echecs++
    envois.raisons.push(error.message)
    return envois
  }

  const abonnements = (data ?? []) as AbonnementPush[]
  const corps = JSON.stringify(payload)

  for (const a of abonnements) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        corps,
        { TTL: 60 * 60 * 24 }
      )
      envois.envoyes++
    } catch (e: unknown) {
      const err = e as { statusCode?: number; body?: string; message?: string }
      envois.echecs++
      const raison = `${err.statusCode ?? ''} ${err.body || err.message || 'erreur inconnue'}`.trim()
      if (!envois.raisons.includes(raison)) envois.raisons.push(raison)

      if (err.statusCode === 404 || err.statusCode === 410) {
        await client.from('push_abonnements').delete().eq('id', a.id)
      } else {
        await client.from('push_abonnements').update({ derniere_erreur: raison }).eq('id', a.id)
      }
    }
  }

  return envois
}

export async function envoyerAlertePush(
  client: any,
  userId: string,
  alerte: AlerteCreee
): Promise<ResumeEnvois> {
  return envoyerPush(client, userId, payloadAlerte(alerte))
}

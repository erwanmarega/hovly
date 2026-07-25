import { envoyerPush, pushDisponible } from '../../utils/push'

/** Envoie une notification de vérification sur tous les appareils de l'utilisateur. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  if (!pushDisponible()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Notifications push non configurées sur le serveur (clés VAPID absentes)'
    })
  }

  const client = await db(event)
  const envois = await envoyerPush(client, user.id, {
    titre: 'Hovly',
    corps: 'Les notifications fonctionnent. Tu seras prévenu dès qu’un prix baisse.',
    url: '/alertes',
    tag: 'test'
  })

  return { ok: envois.envoyes > 0, ...envois }
})

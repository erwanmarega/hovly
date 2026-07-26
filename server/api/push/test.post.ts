import { envoyerPush, pushDisponible } from '../../utils/push'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  if (!pushDisponible()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Push non configure',
      message: 'Notifications push non configurées sur le serveur (clés VAPID absentes)'
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

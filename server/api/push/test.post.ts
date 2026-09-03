import { sendPush, pushAvailable } from '../../utils/push'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  if (!pushAvailable()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Push non configure',
      message: 'Notifications push non configurées sur le serveur (clés VAPID absentes)'
    })
  }

  const client = await db(event)
  const envois = await sendPush(client, user.id, {
    titre: 'Hovly',
    corps: 'Les notifications fonctionnent. Tu seras prévenu dès qu’un prix baisse.',
    url: '/alertes',
    tag: 'test'
  })

  return { ok: envois.sent > 0, ...envois }
})

import { assertTailleCorps } from '../../utils/validation'

interface CorpsAbonnement {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertTailleCorps(event)
  const body = await readBody<CorpsAbonnement>(event)

  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw createError({ statusCode: 400, statusMessage: 'Abonnement push incomplet' })
  }

  const client = serviceDb(event)

  const { data: existing } = await client
    .from('push_abonnements')
    .select('user_id')
    .eq('endpoint', endpoint)
    .maybeSingle()

  if (existing && existing.user_id !== user.id) {
    // Un abonnement Web Push est lié au navigateur, pas au compte : quand un
    // autre utilisateur se connecte sur le même appareil et active le push,
    // le transfert est légitime. On le journalise plutôt que de le bloquer,
    // pour garder une trace si ça correspond en fait à un endpoint qui a fuité.
    console.warn('[push] endpoint réassigné', { previousUserId: existing.user_id, newUserId: user.id })
  }

  const { error } = await client.from('push_abonnements').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      agent: getHeader(event, 'user-agent') ?? null,
      derniere_erreur: null
    },
    { onConflict: 'endpoint' }
  )

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})

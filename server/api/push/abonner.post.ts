interface CorpsAbonnement {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<CorpsAbonnement>(event)

  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    throw createError({ statusCode: 400, statusMessage: 'Abonnement push incomplet' })
  }

  const client = serviceDb(event)

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

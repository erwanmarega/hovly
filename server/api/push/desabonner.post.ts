export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { endpoint } = await readBody<{ endpoint?: string }>(event)

  if (!endpoint) {
    throw createError({ statusCode: 400, statusMessage: 'Endpoint manquant' })
  }

  const client = await db(event)
  const { error } = await client
    .from('push_abonnements')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})

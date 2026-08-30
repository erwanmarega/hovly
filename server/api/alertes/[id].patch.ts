export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data, error } = await client
    .from('alertes')
    .update({ vue: true })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, statusMessage: 'Alerte introuvable' })
  }
  return data
})

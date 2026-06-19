export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data, error } = await client
    .from('prix_historique')
    .select('prix, controle_le')
    .eq('bien_id', id)
    .order('controle_le', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data ?? []
})

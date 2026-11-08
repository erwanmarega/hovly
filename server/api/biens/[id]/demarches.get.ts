export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = requireRouterParam(event)

  const { data, error } = await client
    .from('demarches')
    .select('*')
    .eq('bien_id', id)
    .order('fait_le', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data ?? []
})

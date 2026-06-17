export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)

  const { data, error } = await client
    .from('alertes')
    .select('*, biens!inner(titre, ville, photos)')
    .order('vue', { ascending: true })
    .order('envoyee_le', { ascending: false })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)

  // La RLS limite déjà aux biens de l'utilisateur.
  const { data, error } = await client.from('trajets').select('*')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})

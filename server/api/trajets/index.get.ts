export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)

  const { data, error } = await client.from('trajets').select('*')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { error } = await client.from('partages').delete().eq('id', id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return { ok: true }
})

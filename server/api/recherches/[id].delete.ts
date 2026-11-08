export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = requireRouterParam(event)

  const { error } = await client.from('recherches').delete().eq('id', id)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return { ok: true }
})

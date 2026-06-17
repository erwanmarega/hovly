export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)

  const { error } = await client.from('alertes').update({ vue: true }).eq('vue', false)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})

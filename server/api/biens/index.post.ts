export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)
  const body = await readBody(event)

  if (!body?.url_source) {
    throw createError({ statusCode: 400, statusMessage: 'url_source requis' })
  }

  return creerBien(client, user.id, body)
})

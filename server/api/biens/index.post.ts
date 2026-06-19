export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)
  const body = await readBody(event)

  if (!body?.url_source) {
    throw createError({ statusCode: 400, statusMessage: 'url_source requis' })
  }

  const payload: Record<string, unknown> = { user_id: user.id }
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) payload[champ] = body[champ]
  }
  payload.url_source = body.url_source
  payload.site_source = body.site_source ?? null

  const { data, error } = await client
    .from('biens')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (data?.prix != null) {
    await client.from('prix_historique').insert({ bien_id: data.id, prix: data.prix })
  }

  return data
})

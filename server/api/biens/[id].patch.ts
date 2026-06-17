export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (body?.statut && !STATUTS_VALIDES.includes(body.statut)) {
    throw createError({ statusCode: 400, statusMessage: 'Statut invalide' })
  }

  const patch: Record<string, unknown> = {}
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) patch[champ] = body[champ]
  }
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun champ à mettre à jour' })
  }

  const { data, error } = await client
    .from('biens')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

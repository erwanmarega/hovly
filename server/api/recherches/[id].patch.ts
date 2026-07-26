export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const patch = champsVeille(body ?? {})
  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun champ à mettre à jour' })
  }

  // Réactiver une veille mise en pause par les échecs lui redonne sa chance.
  if (patch.active === true) {
    patch.echecs_consecutifs = 0
    patch.derniere_erreur = null
  }

  const { data, error } = await client
    .from('recherches')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

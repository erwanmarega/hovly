const STATES = ['nouveau', 'garde', 'ignore']

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')
  const state = getQuery(event).etat as string | undefined

  let query = client
    .from('recherche_resultats')
    .select('*')
    .eq('recherche_id', id)
    .order('trouve_le', { ascending: false })
    .limit(200)

  if (state) {
    if (!STATES.includes(state)) {
      throw createError({ statusCode: 400, statusMessage: 'État invalide' })
    }
    query = query.eq('etat', state)
  }

  const { data, error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

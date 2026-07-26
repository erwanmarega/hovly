const ETATS = ['nouveau', 'garde', 'ignore']

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')
  const etat = getQuery(event).etat as string | undefined

  let requete = client
    .from('recherche_resultats')
    .select('*')
    .eq('recherche_id', id)
    .order('trouve_le', { ascending: false })
    .limit(200)

  if (etat) {
    if (!ETATS.includes(etat)) {
      throw createError({ statusCode: 400, statusMessage: 'État invalide' })
    }
    requete = requete.eq('etat', etat)
  }

  const { data, error } = await requete
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

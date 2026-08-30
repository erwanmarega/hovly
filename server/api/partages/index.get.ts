export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)

  const { data, error } = await client
    .from('partages')
    .select('*, partage_biens(count)')
    .eq('user_id', user.id)
    .order('cree_le', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    token: p.token,
    titre: p.titre,
    cree_le: p.cree_le,
    expire_le: p.expire_le,
    nb_biens: p.partage_biens?.[0]?.count ?? 0
  }))
})

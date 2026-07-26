import type { Recherche } from '~/types'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)

  const { data, error } = await client
    .from('recherches')
    .select('*, recherche_resultats(count)')
    .eq('recherche_resultats.etat', 'nouveau')
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return (data ?? []).map((r: any): Recherche => {
    const { recherche_resultats, ...recherche } = r
    return { ...recherche, nouveaux: recherche_resultats?.[0]?.count ?? 0 }
  })
})

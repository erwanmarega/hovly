import type { Bien, Recherche } from '~/types'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data: recherche, error } = await client
    .from('recherches')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !recherche) {
    throw createError({ statusCode: 404, statusMessage: 'Veille introuvable' })
  }

  const { data: biens } = await client.from('biens').select('*')

  const resume = await verifierRecherche(client, recherche as Recherche, (biens ?? []) as Bien[])

  // Scan manuel : l'utilisateur regarde déjà l'écran, pas de notification.
  if (resume.erreur) {
    throw createError({ statusCode: 422, statusMessage: resume.erreur })
  }

  return resume
})

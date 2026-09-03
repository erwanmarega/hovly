import type { Property, SavedSearch } from '~/types'
import { assertRateLimitForUser, QUOTAS } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.scan, QUOTAS.scanHeure)
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

  const resume = await verifierRecherche(client, recherche as SavedSearch, (biens ?? []) as Property[])

  // Scan manuel : l'utilisateur regarde déjà l'écran, pas de notification.
  if (resume.erreur) {
    throw createError({ statusCode: 422, statusMessage: resume.erreur })
  }

  return resume
})

import type { Property, SavedSearch } from '~/types'
import { assertRateLimitForUser, QUOTAS } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.scan, QUOTAS.scanPerHour)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data: search, error } = await client
    .from('recherches')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !search) {
    throw createError({ statusCode: 404, statusMessage: 'Veille introuvable' })
  }

  const { data: biens } = await client.from('biens').select('*')

  const summary = await checkSearch(client, search as SavedSearch, (biens ?? []) as Property[])

  // Scan manuel : l'utilisateur regarde déjà l'écran, pas de notification.
  if (summary.erreur) {
    throw createError({ statusCode: 422, statusMessage: summary.erreur })
  }

  return summary
})

import {
  checkRateLimitForEvent,
  createRateLimitError,
  setRateLimitHeaders,
  QUOTAS
} from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const path = event.path ?? event.node.req.url ?? ''

  // On ne protège que les routes API. Les assets, les pages Nuxt et le service
  // worker ne passent pas ici.
  if (!path.startsWith('/api/')) return

  // Les routes cron ont leur propre authentification par secret ; un rate limit
  // global par IP bloquerait les appels internes du service cron.
  if (path.startsWith('/api/cron/')) return

  const result = checkRateLimitForEvent(event, QUOTAS.global)
  setRateLimitHeaders(event, result, QUOTAS.global)

  if (!result.ok) {
    throw createRateLimitError(result.resetAt, 'Trop de requêtes. Réessaie dans une minute.')
  }
})

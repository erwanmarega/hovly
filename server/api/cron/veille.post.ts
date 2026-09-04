import type { Property, SavedSearch } from '~/types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { needsCheck, notifyWatch, purgeProcessedResults, checkSearch } from '../../utils/veille'

/** Plafond par exécution : un cron ne doit pas partir en scan de plusieurs heures. */
const MAX_SEARCHES_PER_RUN = 25

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const auth = getHeader(event, 'authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorisé' })
  }

  const service = serverSupabaseServiceRole(event)

  const { data: recherches, error } = await service
    .from('recherches')
    .select('*')
    .eq('active', true)
    .order('derniere_verif', { ascending: true, nullsFirst: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const now = new Date()
  const due = ((recherches ?? []) as SavedSearch[])
    .filter((r) => needsCheck(r, now))
    .slice(0, MAX_SEARCHES_PER_RUN)

  // Les biens déjà suivis servent à écarter les annonces multi-diffusées :
  // une lecture par utilisateur, pas une par veille.
  const propertiesByUser = new Map<string, Property[]>()
  async function propertiesFor(userId: string): Promise<Property[]> {
    const cached = propertiesByUser.get(userId)
    if (cached) return cached

    const { data } = await service.from('biens').select('*').eq('user_id', userId)
    const list = (data ?? []) as Property[]
    propertiesByUser.set(userId, list)
    return list
  }

  const emails = new Map<string, string | null>()
  async function emailFor(userId: string): Promise<string | null> {
    if (emails.has(userId)) return emails.get(userId)!

    const { data } = await service.auth.admin.getUserById(userId)
    const email = data?.user?.email ?? null
    emails.set(userId, email)
    return email
  }

  let newCount = 0
  let errorCount = 0
  let sent = 0
  let failed = 0

  for (const search of due) {
    const summary = await checkSearch(
      service,
      search,
      await propertiesFor(search.user_id),
      now
    )

    if (summary.erreur) {
      errorCount++
      continue
    }
    if (!summary.nouvelles.length) continue

    newCount += summary.nouvelles.length
    const notifyResult = await notifyWatch(
      service,
      search.user_id,
      await emailFor(search.user_id),
      summary
    )
    sent += notifyResult.sent
    failed += notifyResult.failed
  }

  const purged = await purgeProcessedResults(service)

  return {
    ok: true,
    actives: recherches?.length ?? 0,
    scannees: due.length,
    nouvelles: newCount,
    erreurs: errorCount,
    notifications: { envoyes: sent, echecs: failed },
    purges: purged
  }
})

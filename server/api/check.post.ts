import type { Property } from '~/types'
import { checkProperties, notify, notifyPush } from '../utils/check'
import { assertRateLimitForUser, QUOTAS } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.check, QUOTAS.checkPerHour)
  const service = serviceDb(event)

  const { data: biens, error } = await service
    .from('biens')
    .select('*')
    .eq('user_id', user.id)
    .eq('actif', true)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const summary = await checkProperties(service, (biens ?? []) as Property[])
  const emails = await notify(user.email ?? null, summary)
  const push = await notifyPush(service, user.id, summary)

  return { ...summary, emails, push }
})

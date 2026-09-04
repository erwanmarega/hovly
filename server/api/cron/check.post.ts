import type { Property } from '~/types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { checkProperties, notify, notifyPush } from '../../utils/check'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const auth = getHeader(event, 'authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorisé' })
  }

  const service = serverSupabaseServiceRole(event)

  const { data: biens, error } = await service
    .from('biens')
    .select('*')
    .eq('actif', true)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const byUser = new Map<string, Property[]>()
  for (const b of (biens ?? []) as Property[]) {
    const list = byUser.get(b.user_id) ?? []
    list.push(b)
    byUser.set(b.user_id, list)
  }

  let totalAlerts = 0
  let emailsSent = 0
  let emailsFailed = 0
  let pushSent = 0
  let pushFailed = 0
  for (const [userId, list] of byUser) {
    const summary = await checkProperties(service, list)
    totalAlerts += summary.alerts.length
    if (summary.alerts.length) {
      const { data } = await service.auth.admin.getUserById(userId)
      const emailResult = await notify(data?.user?.email ?? null, summary)
      emailsSent += emailResult.sent
      emailsFailed += emailResult.failed

      const push = await notifyPush(service, userId, summary)
      pushSent += push.sent
      pushFailed += push.failed
    }
  }

  return {
    ok: true,
    users: byUser.size,
    biens: biens?.length ?? 0,
    alertes: totalAlerts,
    emails: { envoyes: emailsSent, echecs: emailsFailed },
    push: { envoyes: pushSent, echecs: pushFailed }
  }
})

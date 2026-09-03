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

  const parUser = new Map<string, Property[]>()
  for (const b of (biens ?? []) as Property[]) {
    const list = parUser.get(b.user_id) ?? []
    list.push(b)
    parUser.set(b.user_id, list)
  }

  let totalAlertes = 0
  let emailsEnvoyes = 0
  let emailsEchoues = 0
  let pushEnvoyes = 0
  let pushEchoues = 0
  for (const [userId, liste] of parUser) {
    const resume = await checkProperties(service, liste)
    totalAlertes += resume.alerts.length
    if (resume.alerts.length) {
      const { data } = await service.auth.admin.getUserById(userId)
      const envois = await notify(data?.user?.email ?? null, resume)
      emailsEnvoyes += envois.sent
      emailsEchoues += envois.failed

      const push = await notifyPush(service, userId, resume)
      pushEnvoyes += push.sent
      pushEchoues += push.failed
    }
  }

  return {
    ok: true,
    users: parUser.size,
    biens: biens?.length ?? 0,
    alertes: totalAlertes,
    emails: { envoyes: emailsEnvoyes, echecs: emailsEchoues },
    push: { envoyes: pushEnvoyes, echecs: pushEchoues }
  }
})

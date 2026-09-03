import type { Property } from '~/types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { sendReminders } from '../../utils/rappels'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const auth = getHeader(event, 'authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorisé' })
  }

  const service = serverSupabaseServiceRole(event)
  const now = new Date()

  const { data, error } = await service
    .from('biens')
    .select('*')
    .eq('actif', true)
    .is('rappel_envoye_le', null)
    .not('visite_le', 'is', null)
    .gt('visite_le', now.toISOString())
    .lt('visite_le', new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString())

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const byUser = new Map<string, Property[]>()
  for (const b of (data ?? []) as Property[]) {
    const list = byUser.get(b.user_id) ?? []
    list.push(b)
    byUser.set(b.user_id, list)
  }

  let sent = 0
  let failed = 0
  const reasons: string[] = []

  for (const [userId, list] of byUser) {
    const { data: account } = await service.auth.admin.getUserById(userId)
    const summary = await sendReminders(
      service,
      list,
      account?.user?.email ?? null,
      now
    )
    sent += summary.envoyes
    failed += summary.echecs
    for (const r of summary.raisons) if (!reasons.includes(r)) reasons.push(r)
  }

  return { ok: true, users: byUser.size, candidats: data?.length ?? 0, envoyes: sent, echecs: failed, raisons: reasons }
})

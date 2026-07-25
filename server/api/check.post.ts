import type { Bien } from '~/types'
import { verifierBiens, notifier, notifierPush } from '../utils/check'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const service = serviceDb(event)

  const { data: biens, error } = await service
    .from('biens')
    .select('*')
    .eq('user_id', user.id)
    .eq('actif', true)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const resume = await verifierBiens(service, (biens ?? []) as Bien[])
  const envois = await notifier(user.email ?? null, resume)
  const push = await notifierPush(service, user.id, resume)

  return { ...resume, envois, push }
})

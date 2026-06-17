import type { Bien } from '~/types'
import { verifierBiens, notifier } from '../utils/check'

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
  await notifier(user.email ?? null, resume)

  return resume
})

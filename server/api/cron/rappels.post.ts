import type { Bien } from '~/types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { envoyerRappels } from '../../utils/rappels'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const auth = getHeader(event, 'authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorisé' })
  }

  const service = serverSupabaseServiceRole(event)
  const maintenant = new Date()

  const { data, error } = await service
    .from('biens')
    .select('*')
    .eq('actif', true)
    .is('rappel_envoye_le', null)
    .not('visite_le', 'is', null)
    .gt('visite_le', maintenant.toISOString())
    .lt('visite_le', new Date(maintenant.getTime() + 24 * 60 * 60 * 1000).toISOString())

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const parUser = new Map<string, Bien[]>()
  for (const b of (data ?? []) as Bien[]) {
    const liste = parUser.get(b.user_id) ?? []
    liste.push(b)
    parUser.set(b.user_id, liste)
  }

  let envoyes = 0
  let echecs = 0
  const raisons: string[] = []

  for (const [userId, liste] of parUser) {
    const { data: compte } = await service.auth.admin.getUserById(userId)
    const resume = await envoyerRappels(
      service,
      liste,
      compte?.user?.email ?? null,
      maintenant
    )
    envoyes += resume.envoyes
    echecs += resume.echecs
    for (const r of resume.raisons) if (!raisons.includes(r)) raisons.push(r)
  }

  return { ok: true, users: parUser.size, candidats: data?.length ?? 0, envoyes, echecs, raisons }
})

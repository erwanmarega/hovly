import { currentStatus } from '~/utils/applications'
import type { ApplicationStep } from '~/types'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = requireRouterParam(event)

  // La RLS limite la lecture aux étapes des biens de l'utilisateur.
  const { data: step } = await client
    .from('demarches')
    .select('id, bien_id')
    .eq('id', id)
    .maybeSingle()
  if (!step) {
    throw createError({ statusCode: 404, statusMessage: 'Démarche introuvable' })
  }

  const { error } = await client.from('demarches').delete().eq('id', step.id)
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const { data: remaining, error: loadError } = await client
    .from('demarches')
    .select('type, fait_le, created_at')
    .eq('bien_id', step.bien_id)
  if (loadError) {
    throw createError({ statusCode: 500, statusMessage: loadError.message })
  }

  // `type` est une colonne `text` en base : on la ramène au type d'étape de l'application
  const steps = (remaining ?? []) as Pick<ApplicationStep, 'type' | 'fait_le' | 'created_at'>[]
  const statut = currentStatus(steps, 'visite')
  const { error: updateError } = await client.from('biens').update({ statut }).eq('id', step.bien_id)
  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }
  return { statut }
})

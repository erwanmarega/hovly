import { assertBodySize } from '../../../utils/validation'
import { statusAfterStep, validateStep } from '~/utils/applications'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  assertBodySize(event)
  const client = await db(event)
  const id = requireRouterParam(event)
  const body = await readBody(event)

  // La RLS limite la lecture aux biens de l'utilisateur : preuve d'appartenance.
  const { data: bien } = await client
    .from('biens')
    .select('id, transaction')
    .eq('id', id)
    .maybeSingle()
  if (!bien) {
    throw createError({ statusCode: 404, statusMessage: 'Bien introuvable' })
  }

  let payload
  try {
    payload = validateStep(body, bien.transaction)
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: (e as Error).message })
  }

  const { data: step, error } = await client
    .from('demarches')
    .insert({ bien_id: bien.id, ...payload })
    .select()
    .single()
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const statut = statusAfterStep(payload.type)
  const { error: updateError } = await client.from('biens').update({ statut }).eq('id', bien.id)
  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }
  return { step, statut }
})

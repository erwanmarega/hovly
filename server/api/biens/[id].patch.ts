import { assertBodySize } from '../../utils/validation'
import type { TablesUpdate } from '~/types/database.types'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  assertBodySize(event)
  const client = await db(event)
  const id = requireRouterParam(event)
  const body = await readBody(event)

  if (body?.statut && !VALID_STATUSES.includes(body.statut)) {
    throw createError({ statusCode: 400, statusMessage: 'Statut invalide' })
  }

  if (body?.transaction && !['location', 'achat'].includes(body.transaction)) {
    throw createError({ statusCode: 400, statusMessage: 'Transaction invalide' })
  }

  if (body?.visite_le != null && Number.isNaN(new Date(body.visite_le).getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Date de visite invalide' })
  }

  const patch: Record<string, unknown> = {}
  for (const field of EDITABLE_FIELDS) {
    if (field in body) patch[field] = body[field]
  }

  if ('visite_le' in patch) patch.rappel_envoye_le = null
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun champ à mettre à jour' })
  }

  const { data, error } = await client
    .from('biens')
    // Construit depuis la liste blanche EDITABLE_FIELDS et validé plus haut
    .update(patch as TablesUpdate<'biens'>)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

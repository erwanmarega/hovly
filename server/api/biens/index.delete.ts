import { MAX_BULK_DELETE } from '../../utils/properties'
import { assertRateLimitForUser, QUOTAS } from '../../utils/rate-limit'
import { assertBodySize } from '../../utils/validation'

function validIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || !id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length > MAX_BULK_DELETE) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.bulkDelete, QUOTAS.bulkDeletePerHour)
  assertBodySize(event)

  const body = await readBody<{ ids?: unknown }>(event)
  const ids = validIds(body?.ids)

  if (ids.length === 0 || ids.length > MAX_BULK_DELETE) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Sélection invalide',
      message: `Sélectionne entre 1 et ${MAX_BULK_DELETE} biens pour supprimer en masse.`
    })
  }

  const client = await db(event)

  // Le client scopé RLS (pas service-role) : `.in` ne supprime que les lignes
  // dont la policy autorise l'accès, donc jamais un bien d'un autre utilisateur
  // même si son id figure dans `ids`. `select('id')` renvoie les lignes
  // réellement supprimées pour que le client réconcilie son état optimiste.
  const { data, error } = await client.from('biens').delete().in('id', ids).select('id')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { deleted: (data ?? []).map((r: { id: string }) => r.id) }
})

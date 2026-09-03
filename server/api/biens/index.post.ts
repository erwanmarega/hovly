import { MAX_ACTIVE_PROPERTIES } from '../../utils/properties'
import { assertBodySize, validateSourceUrl } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertBodySize(event)
  const client = await db(event)
  const body = await readBody(event)

  body.url_source = validateSourceUrl(body?.url_source)

  const { count, error: errCount } = await client
    .from('biens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('actif', true)

  if (errCount) {
    throw createError({ statusCode: 500, statusMessage: errCount.message })
  }

  if ((count ?? 0) >= MAX_ACTIVE_PROPERTIES) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Trop de biens',
      message: `Maximum ${MAX_ACTIVE_PROPERTIES} biens actifs. Supprime ou archive un bien pour en ajouter un nouveau.`
    })
  }

  return createProperty(client, user.id, body)
})

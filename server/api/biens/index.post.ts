import { MAX_BIENS_ACTIFS } from '../../utils/biens'
import { assertTailleCorps, validerUrlSource } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertTailleCorps(event)
  const client = await db(event)
  const body = await readBody(event)

  body.url_source = validerUrlSource(body?.url_source)

  const { count, error: errCount } = await client
    .from('biens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('actif', true)

  if (errCount) {
    throw createError({ statusCode: 500, statusMessage: errCount.message })
  }

  if ((count ?? 0) >= MAX_BIENS_ACTIFS) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Trop de biens',
      message: `Maximum ${MAX_BIENS_ACTIFS} biens actifs. Supprime ou archive un bien pour en ajouter un nouveau.`
    })
  }

  return creerBien(client, user.id, body)
})

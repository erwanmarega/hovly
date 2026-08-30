import { assertRateLimitForUser, QUOTAS } from '../../utils/rate-limit'
import { assertTailleCorps, nettoyerTexte } from '../../utils/validation'
import { genererTokenPartage, MAX_BIENS_PARTAGE } from '../../utils/partages'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.partage, QUOTAS.partageHeure)
  assertTailleCorps(event)
  const client = await db(event)
  const body = await readBody(event)

  const bienIds = Array.isArray(body?.bien_ids)
    ? [...new Set(body.bien_ids.filter((id: unknown): id is string => typeof id === 'string'))]
    : []

  if (!bienIds.length || bienIds.length > MAX_BIENS_PARTAGE) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Sélection invalide',
      message: `Sélectionne entre 1 et ${MAX_BIENS_PARTAGE} biens à partager.`
    })
  }

  const titre = nettoyerTexte(body?.titre, 80)
  const token = genererTokenPartage()

  const { data: partage, error } = await client
    .from('partages')
    .insert({ user_id: user.id, token, titre })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const { error: errLiens } = await client
    .from('partage_biens')
    .insert(bienIds.map((bien_id) => ({ partage_id: partage.id, bien_id })))

  if (errLiens) {
    // La policy RLS rejette un bien qui n'appartient pas à l'utilisateur (ou
    // qui n'existe pas) : on annule le partage plutôt que de laisser un lien
    // à moitié rempli.
    await client.from('partages').delete().eq('id', partage.id)
    throw createError({
      statusCode: 422,
      statusMessage: 'Sélection invalide',
      message: "Un des biens sélectionnés n'existe pas ou ne t'appartient pas."
    })
  }

  return { ...partage, nb_biens: bienIds.length }
})

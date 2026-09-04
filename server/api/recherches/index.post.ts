import { LISTING_PATTERN } from '../../utils/scrape/listing'
import { detecterSource } from '../../utils/scrape/source'
import { assertBodySize, validateSourceUrl } from '../../utils/validation'

export const MAX_SEARCHES = 10

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertBodySize(event)
  const client = await db(event)
  const body = await readBody(event)

  const url = validateSourceUrl(body?.url)

  const source = detecterSource(url)
  if (!source) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Source non supportee',
      message:
        'Source non supportée. Sites gérés : SeLoger, Leboncoin, PAP, Logic-Immo, Bien’ici, Century 21.'
    })
  }

  const path = new URL(url).pathname

  if (LISTING_PATTERN[source].test(path)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Annonce, pas une liste',
      message:
        "Cette URL est une annonce, pas une page de résultats. Ajoute-la comme bien depuis « Ajouter »."
    })
  }

  const { count } = await client
    .from('recherches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_SEARCHES) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Trop de veilles',
      message: `Maximum ${MAX_SEARCHES} veilles. Supprimes-en une pour en créer une nouvelle.`
    })
  }

  const { data, error } = await client
    .from('recherches')
    .insert({
      ...watchFields(body),
      user_id: user.id,
      label: String(body?.label ?? '').trim().slice(0, 60) || `Veille ${source}`,
      url,
      site_source: source
    })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }
  return data
})

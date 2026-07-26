import { MOTIF_FICHE } from '../../utils/scrape/liste'
import { detecterSource } from '../../utils/scrape/source'

export const MAX_RECHERCHES = 10

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)
  const body = await readBody(event)

  const url = String(body?.url ?? '').trim()
  if (!url) {
    throw createError({ statusCode: 400, statusMessage: 'url requise' })
  }

  const source = detecterSource(url)
  if (!source) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Source non supportée. Sites gérés : SeLoger, Leboncoin, PAP, Logic-Immo, Bien’ici, Century 21.'
    })
  }

  let chemin: string
  try {
    chemin = new URL(url).pathname
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'URL invalide' })
  }

  if (MOTIF_FICHE[source].test(chemin)) {
    throw createError({
      statusCode: 422,
      statusMessage:
        "Cette URL est une annonce, pas une page de résultats. Ajoute-la comme bien depuis « Ajouter »."
    })
  }

  const { count } = await client
    .from('recherches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= MAX_RECHERCHES) {
    throw createError({
      statusCode: 422,
      statusMessage: `Maximum ${MAX_RECHERCHES} veilles. Supprimes-en une pour en créer une nouvelle.`
    })
  }

  const { data, error } = await client
    .from('recherches')
    .insert({
      ...champsVeille(body),
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

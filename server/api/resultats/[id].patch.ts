import type { ResultatVeille } from '~/types'
import { scrapeUrl } from '../../utils/scrape'
import { detecterSource } from '../../utils/scrape/source'

/** Ce que la carte de résultat nous a déjà appris, si la fiche est illisible. */
function depuisResultat(r: ResultatVeille) {
  return {
    url_source: r.url,
    site_source: detecterSource(r.url),
    titre: r.titre || 'Annonce sans titre',
    prix: r.prix,
    surface: r.surface,
    nb_pieces: r.nb_pieces,
    ville: r.ville,
    code_postal: r.code_postal,
    photos: r.photo ? [r.photo] : []
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const etat = body?.etat

  if (etat !== 'garde' && etat !== 'ignore') {
    throw createError({ statusCode: 400, statusMessage: 'État invalide' })
  }

  const { data: resultat, error } = await client
    .from('recherche_resultats')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !resultat) {
    throw createError({ statusCode: 404, statusMessage: 'Résultat introuvable' })
  }
  const r = resultat as ResultatVeille

  if (etat === 'ignore') {
    const { data, error: errMaj } = await client
      .from('recherche_resultats')
      .update({ etat: 'ignore' })
      .eq('id', id)
      .select()
      .single()

    if (errMaj) throw createError({ statusCode: 500, statusMessage: errMaj.message })
    return { resultat: data, bien: null }
  }

  if (r.bien_id) {
    throw createError({ statusCode: 409, statusMessage: 'Résultat déjà converti en bien' })
  }

  // La fiche complète vaut mieux que la carte, mais un anti-bot ne doit pas
  // faire perdre l'annonce : on retombe sur ce que le scan avait extrait.
  let payload = depuisResultat(r)
  try {
    const { data: extrait, indisponible } = await scrapeUrl(r.url)
    if (indisponible) {
      throw createError({ statusCode: 422, statusMessage: "L'annonce n'est plus en ligne." })
    }
    payload = { ...payload, ...extrait, url_source: r.url }
  } catch (e: any) {
    if (e?.statusCode === 422) throw e
  }

  const bien = await creerBien(client, user.id, payload)

  const { data, error: errMaj } = await client
    .from('recherche_resultats')
    .update({ etat: 'garde', bien_id: bien.id })
    .eq('id', id)
    .select()
    .single()

  if (errMaj) throw createError({ statusCode: 500, statusMessage: errMaj.message })
  return { resultat: data, bien }
})

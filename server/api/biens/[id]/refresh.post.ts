import type { Bien } from '~/types'
import { scrapeUrl } from '../../../utils/scrape'
import { geocoder } from '../../../utils/geocode'
import { prixPlausible } from '../../../utils/check'

const CHAMPS_RAFRAICHIS = [
  'titre',
  'prix',
  'surface',
  'nb_pieces',
  'etage',
  'charges',
  'dpe',
  'adresse',
  'ville',
  'code_postal',
  'photos',
  'description'
] as const

type ChampRafraichi = (typeof CHAMPS_RAFRAICHIS)[number]

export interface Changement {
  champ: ChampRafraichi
  avant: unknown
  apres: unknown
}

function aChange(avant: unknown, apres: unknown): boolean {
  if (Array.isArray(avant) && Array.isArray(apres)) {
    return avant.length !== apres.length || avant.some((v, i) => v !== apres[i])
  }
  return avant !== apres
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data: bien, error } = await client.from('biens').select('*').eq('id', id).single()
  if (error || !bien) {
    throw createError({ statusCode: 404, statusMessage: 'Bien introuvable' })
  }
  const actuel = bien as Bien

  const { data: extrait, indisponible } = await scrapeUrl(actuel.url_source)

  if (indisponible) {
    await client.from('biens').update({ actif: false }).eq('id', id)
    await client.from('alertes').insert({
      bien_id: id,
      type: 'annonce_supprimee',
      ancien_prix: actuel.prix,
      nouveau_prix: null
    })
    return { indisponible: true, changements: [], bien: { ...actuel, actif: false } }
  }

  const maj: Record<string, unknown> = {}
  const changements: Changement[] = []

  for (const champ of CHAMPS_RAFRAICHIS) {
    const valeur = extrait[champ]
    if (valeur == null || valeur === '') continue
    if (Array.isArray(valeur) && valeur.length === 0) continue
    if (!aChange(actuel[champ], valeur)) continue

    maj[champ] = valeur
    changements.push({ champ, avant: actuel[champ], apres: valeur })
  }

  // Un re-scrape peut produire un prix aberrant : on le retire de la mise à
  // jour plutôt que d'écraser un prix correct (même garde-fou que le cron).
  if (typeof maj.prix === 'number' && !prixPlausible(actuel.prix, maj.prix as number)) {
    console.warn('[refresh] prix aberrant ignoré', { id, ancien: actuel.prix, nouveau: maj.prix })
    delete maj.prix
    const i = changements.findIndex((c) => c.champ === 'prix')
    if (i >= 0) changements.splice(i, 1)
  }

  const nouveauPrix = typeof maj.prix === 'number' ? maj.prix : null
  if (nouveauPrix != null) {
    await client.from('prix_historique').insert({ bien_id: id, prix: nouveauPrix })
    if (nouveauPrix < actuel.prix) {
      await client.from('alertes').insert({
        bien_id: id,
        type: 'baisse_prix',
        ancien_prix: actuel.prix,
        nouveau_prix: nouveauPrix
      })
    }
  }

  const adresseChangee = changements.some((c) =>
    ['adresse', 'ville', 'code_postal'].includes(c.champ)
  )
  if (adresseChangee || actuel.lat == null) {
    const loc = await geocoder({
      adresse: (maj.adresse as string) ?? actuel.adresse,
      ville: (maj.ville as string) ?? actuel.ville,
      code_postal: (maj.code_postal as string) ?? actuel.code_postal
    })
    if (loc) {
      maj.lat = loc.lat
      maj.lon = loc.lon
      maj.geo_precision = loc.precision
      maj.geocode_le = new Date().toISOString()
    }
  }

  if (!Object.keys(maj).length) {
    return { indisponible: false, changements: [], bien: actuel }
  }

  const { data: apres, error: errMaj } = await client
    .from('biens')
    .update(maj)
    .eq('id', id)
    .select()
    .single()

  if (errMaj) {
    throw createError({ statusCode: 500, statusMessage: errMaj.message })
  }

  return { indisponible: false, changements, bien: apres }
})

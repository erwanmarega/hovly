import type { Property } from '~/types'
import { scrapeUrl } from '../../../utils/scrape'
import { geocoder } from '../../../utils/geocode'
import { isPricePlausible } from '../../../utils/check'
import { assertRateLimitForUser, QUOTAS } from '../../../utils/rate-limit'
import { DEFAULT_PHOTO } from '../../../utils/properties'

const REFRESHED_FIELDS = [
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
  'description',
  'type_bien'
] as const

type RefreshedField = (typeof REFRESHED_FIELDS)[number]

export interface Change {
  field: RefreshedField
  before: unknown
  after: unknown
}

function hasChanged(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length !== after.length || before.some((v, i) => v !== after[i])
  }
  return before !== after
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.refresh, QUOTAS.refreshPerHour)
  const client = await db(event)
  const id = getRouterParam(event, 'id')

  const { data: bien, error } = await client.from('biens').select('*').eq('id', id).single()
  if (error || !bien) {
    throw createError({ statusCode: 404, statusMessage: 'Bien introuvable' })
  }
  const current = bien as Property

  const { data: extracted, indisponible } = await scrapeUrl(current.url_source)

  if (indisponible) {
    await client.from('biens').update({ actif: false }).eq('id', id)
    await client.from('alertes').insert({
      bien_id: id,
      type: 'annonce_supprimee',
      ancien_prix: current.prix,
      nouveau_prix: null
    })
    return { indisponible: true, changements: [], bien: { ...current, actif: false } }
  }

  const update: Record<string, unknown> = {}
  const changes: Change[] = []

  for (const field of REFRESHED_FIELDS) {
    const value = extracted[field]
    if (value == null || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    if (!hasChanged(current[field], value)) continue

    update[field] = value
    changes.push({ field, before: current[field], after: value })
  }

  // Un bien créé avant l'introduction de la photo de repli, toujours sans
  // photo après ce re-scrape : on l'applique maintenant plutôt que d'attendre
  // indéfiniment une image que le scraping ne trouvera peut-être jamais.
  if (!current.photos?.length && !update.photos) {
    update.photos = [DEFAULT_PHOTO]
    changes.push({ field: 'photos', before: current.photos, after: update.photos })
  }

  // Un re-scrape peut produire un prix aberrant : on le retire de la mise à
  // jour plutôt que d'écraser un prix correct (même garde-fou que le cron).
  if (typeof update.prix === 'number' && !isPricePlausible(current.prix, update.prix as number)) {
    console.warn('[refresh] prix aberrant ignoré', { id, ancien: current.prix, nouveau: update.prix })
    delete update.prix
    const i = changes.findIndex((c) => c.field === 'prix')
    if (i >= 0) changes.splice(i, 1)
  }

  const newPrice = typeof update.prix === 'number' ? update.prix : null
  if (newPrice != null) {
    await client.from('prix_historique').insert({ bien_id: id, prix: newPrice })
    if (newPrice < current.prix) {
      await client.from('alertes').insert({
        bien_id: id,
        type: 'baisse_prix',
        ancien_prix: current.prix,
        nouveau_prix: newPrice
      })
    }
  }

  const addressChanged = changes.some((c) =>
    ['adresse', 'ville', 'code_postal'].includes(c.field)
  )
  if (addressChanged || current.lat == null) {
    const loc = await geocoder({
      adresse: (update.adresse as string) ?? current.adresse,
      ville: (update.ville as string) ?? current.ville,
      code_postal: (update.code_postal as string) ?? current.code_postal
    })
    if (loc) {
      update.lat = loc.lat
      update.lon = loc.lon
      update.geo_precision = loc.precision
      update.geocode_le = new Date().toISOString()
    }
  }

  if (!Object.keys(update).length) {
    return { indisponible: false, changements: [], bien: current }
  }

  const { data: after, error: errUpdate } = await client
    .from('biens')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (errUpdate) {
    throw createError({ statusCode: 500, statusMessage: errUpdate.message })
  }

  return { indisponible: false, changements: changes, bien: after }
})

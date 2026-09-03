import type { Anchor, Property, TravelMode, Commute } from '~/types'
import { durationsToAnchor, batches, routingAvailable } from '../../utils/routage'
import { assertRateLimitForUser, QUOTAS } from '../../utils/rate-limit'
import { assertBodySize } from '../../utils/validation'
import { MAX_ANCHORS } from '~/composables/usePreferences'

const MODES: TravelMode[] = ['voiture', 'velo', 'marche', 'transport']

function validAnchors(raw: unknown): Anchor[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (a): a is Anchor =>
      !!a &&
      typeof a.id === 'string' &&
      typeof a.lat === 'number' &&
      typeof a.lon === 'number' &&
      MODES.includes(a.mode)
  )
}

const samePoint = (a: number, b: number) => Math.abs(a - b) < 0.00001

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.commutes, QUOTAS.commutesPerHour)
  assertBodySize(event)

  const body = await readBody<{ ancres?: unknown }>(event)
  const anchors = validAnchors(body?.ancres)

  if (anchors.length > MAX_ANCHORS) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Trop de points d’ancrage',
      message: `Maximum ${MAX_ANCHORS} points d'ancrage par calcul.`
    })
  }

  const client = await db(event)

  const { data: rawProperties, error: propertiesError } = await client
    .from('biens')
    .select('id, lat, lon')
    .eq('user_id', user.id)
    .eq('actif', true)
    .not('lat', 'is', null)

  if (propertiesError) throw createError({ statusCode: 500, statusMessage: propertiesError.message })

  const properties = (rawProperties ?? []) as Pick<Property, 'id' | 'lat' | 'lon'>[]

  if (anchors.length === 0) {
    await client.from('trajets').delete().not('id', 'is', null)
    return { ancres: 0, biens: properties.length, calcules: 0, ignores: 0, echecs: 0 }
  }
  await client
    .from('trajets')
    .delete()
    .not('ancre', 'in', `(${anchors.map((a) => `"${a.id}"`).join(',')})`)

  const { data: rawExisting } = await client.from('trajets').select('*')
  const existing = (rawExisting ?? []) as Commute[]

  const key = (propertyId: string, anchorId: string, mode: string) => `${propertyId}|${anchorId}|${mode}`
  const known = new Map(existing.map((t) => [key(t.bien_id, t.ancre, t.mode), t]))

  const summary = {
    ancres: anchors.length,
    biens: properties.length,
    calcules: 0,
    ignores: 0,
    echecs: 0,
    indisponibles: [] as string[]
  }
  const now = new Date().toISOString()

  for (const anchor of anchors) {
    if (!routingAvailable(anchor.mode)) {
      summary.indisponibles.push(anchor.id)
      continue
    }

    const toDo = properties.filter((b) => {
      const t = known.get(key(b.id, anchor.id, anchor.mode))
      if (!t) return true
      return !samePoint(t.ancre_lat, anchor.lat) || !samePoint(t.ancre_lon, anchor.lon)
    })
    summary.ignores += properties.length - toDo.length
    if (!toDo.length) continue

    for (const batch of batches(toDo)) {
      let durations
      try {
        durations = await durationsToAnchor(
          batch.map((b) => ({ lat: b.lat!, lon: b.lon! })),
          { lat: anchor.lat, lon: anchor.lon },
          anchor.mode
        )
      } catch {
        summary.echecs += batch.length
        continue
      }

      const rows = batch.map((b, i) => ({
        bien_id: b.id,
        ancre: anchor.id,
        mode: anchor.mode,
        ancre_lat: anchor.lat,
        ancre_lon: anchor.lon,
        duree_s: durations[i]?.duree_s ?? null,
        distance_m: durations[i]?.distance_m ?? null,
        calcule_le: now
      }))

      const { error } = await client
        .from('trajets')
        .upsert(rows, { onConflict: 'bien_id,ancre,mode' })

      if (error) summary.echecs += rows.length
      else summary.calcules += rows.length
    }
  }

  return summary
})

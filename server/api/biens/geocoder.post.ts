import type { Property } from '~/types'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const client = await db(event)

  const { data: biens, error } = await client
    .from('biens')
    .select('id, adresse, ville, code_postal')
    .eq('user_id', user.id)
    .is('lat', null)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const summary = { processed: 0, geocoded: 0, failed: 0 }

  for (const bien of (biens ?? []) as Pick<Property, 'id' | 'adresse' | 'ville' | 'code_postal'>[]) {
    summary.processed++
    const loc = await geocoder(bien)
    if (!loc) {
      summary.failed++
      continue
    }
    await client
      .from('biens')
      .update({
        lat: loc.lat,
        lon: loc.lon,
        geo_precision: loc.precision,
        geocode_le: new Date().toISOString()
      })
      .eq('id', bien.id)
    summary.geocoded++
  }

  return summary
})

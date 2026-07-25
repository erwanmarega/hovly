import type { Bien } from '~/types'

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

  const resume = { traites: 0, localises: 0, echecs: 0 }

  for (const bien of (biens ?? []) as Pick<Bien, 'id' | 'adresse' | 'ville' | 'code_postal'>[]) {
    resume.traites++
    const loc = await geocoder(bien)
    if (!loc) {
      resume.echecs++
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
    resume.localises++
  }

  return resume
})

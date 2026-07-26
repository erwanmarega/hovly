export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { adresse } = await readBody<{ adresse?: string }>(event)

  if (!adresse?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse manquante' })
  }

  const loc = await geocoder({ adresse: adresse.trim() })
  if (!loc) {
    throw createError({ statusCode: 404, statusMessage: 'Adresse introuvable' })
  }

  return { lat: loc.lat, lon: loc.lon, label: loc.label, precision: loc.precision }
})

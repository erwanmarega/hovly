import type { MarcheQuartier } from '~/types'

const JOUR_MS = 24 * 3600 * 1000
const TTL_DONNEES = 30 * JOUR_MS // DVF bouge lentement
const TTL_VIDE = 3 * JOUR_MS // API en panne ou échantillon faible : on retente vite

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const q = getQuery(event)
  const lat = Number(q.lat)
  const lon = Number(q.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw createError({ statusCode: 400, statusMessage: 'Coordonnées invalides' })
  }

  const client = serviceDb(event)
  const cle = cleCache(lat, lon)

  const { data: cache } = await client
    .from('marche_quartier')
    .select('donnees, calcule_le')
    .eq('cle', cle)
    .maybeSingle()

  if (cache) {
    const age = Date.now() - +new Date(cache.calcule_le)
    const ttl = cache.donnees ? TTL_DONNEES : TTL_VIDE
    if (age < ttl) return { marche: cache.donnees as MarcheQuartier | null }
  }

  const ventes = await ventesProches(lat, lon)
  const marche = statistiquesMarche(ventes)

  await client
    .from('marche_quartier')
    .upsert({ cle, donnees: marche, calcule_le: new Date().toISOString() })

  return { marche }
})

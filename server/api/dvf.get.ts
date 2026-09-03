import type { NeighborhoodMarket } from '~/types'
import type { TypeLocalDvf } from '../utils/dvf'

const DAY_MS = 24 * 3600 * 1000
const DATA_TTL = 30 * DAY_MS // DVF bouge lentement
const EMPTY_TTL = 3 * DAY_MS // API en panne ou échantillon faible : on retente vite

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const q = getQuery(event)
  const lat = Number(q.lat)
  const lon = Number(q.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw createError({ statusCode: 400, statusMessage: 'Coordonnées invalides' })
  }
  const localType: TypeLocalDvf = q.type === 'maison' ? 'Maison' : 'Appartement'

  const client = serviceDb(event)
  const key = cleCache(lat, lon, localType)

  const { data: cache } = await client
    .from('marche_quartier')
    .select('donnees, calcule_le')
    .eq('cle', key)
    .maybeSingle()

  if (cache) {
    const age = Date.now() - +new Date(cache.calcule_le)
    const ttl = cache.donnees ? DATA_TTL : EMPTY_TTL
    if (age < ttl) return { market: cache.donnees as NeighborhoodMarket | null }
  }

  const ventes = await ventesProches(lat, lon, localType)
  const market = statistiquesMarche(ventes)

  await client
    .from('marche_quartier')
    .upsert({ cle: key, donnees: market, calcule_le: new Date().toISOString() })

  return { market }
})

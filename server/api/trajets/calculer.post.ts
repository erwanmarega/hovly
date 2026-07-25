import type { Ancre, Bien, ModeTrajet, Trajet } from '~/types'
import { dureesVersAncre, paquets, routageDisponible } from '../../utils/routage'

const MODES: ModeTrajet[] = ['voiture', 'velo', 'marche', 'transport']

function ancresValides(brut: unknown): Ancre[] {
  if (!Array.isArray(brut)) return []
  return brut.filter(
    (a): a is Ancre =>
      !!a &&
      typeof a.id === 'string' &&
      typeof a.lat === 'number' &&
      typeof a.lon === 'number' &&
      MODES.includes(a.mode)
  )
}

/** Deux positions sont « les mêmes » à ~1 m près. */
const memePoint = (a: number, b: number) => Math.abs(a - b) < 0.00001

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  if (!routageDisponible()) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Temps de trajet non configurés sur le serveur (ORS_API_KEY / NAVITIA_TOKEN absents)'
    })
  }

  const body = await readBody<{ ancres?: unknown }>(event)
  const ancres = ancresValides(body?.ancres)
  const client = await db(event)

  const { data: biensBruts, error: erreurBiens } = await client
    .from('biens')
    .select('id, lat, lon')
    .eq('user_id', user.id)
    .eq('actif', true)
    .not('lat', 'is', null)

  if (erreurBiens) throw createError({ statusCode: 500, statusMessage: erreurBiens.message })

  const biens = (biensBruts ?? []) as Pick<Bien, 'id' | 'lat' | 'lon'>[]

  // Une ancre supprimée côté préférences laisse des lignes orphelines.
  if (ancres.length === 0) {
    await client.from('trajets').delete().not('id', 'is', null)
    return { ancres: 0, biens: biens.length, calcules: 0, ignores: 0, echecs: 0 }
  }
  await client
    .from('trajets')
    .delete()
    .not('ancre', 'in', `(${ancres.map((a) => `"${a.id}"`).join(',')})`)

  const { data: existantsBruts } = await client.from('trajets').select('*')
  const existants = (existantsBruts ?? []) as Trajet[]

  const cle = (bienId: string, ancreId: string, mode: string) => `${bienId}|${ancreId}|${mode}`
  const connus = new Map(existants.map((t) => [cle(t.bien_id, t.ancre, t.mode), t]))

  const resume = {
    ancres: ancres.length,
    biens: biens.length,
    calcules: 0,
    ignores: 0,
    echecs: 0,
    /** Ancres laissées de côté faute de clé pour leur mode. */
    indisponibles: [] as string[]
  }
  const maintenant = new Date().toISOString()

  for (const ancre of ancres) {
    // Chaque mode a sa source : voiture/vélo/marche via ORS, transports via Navitia.
    if (!routageDisponible(ancre.mode)) {
      resume.indisponibles.push(ancre.id)
      continue
    }

    // On ne recalcule que ce qui manque ou dont l'ancre a bougé.
    const aFaire = biens.filter((b) => {
      const t = connus.get(cle(b.id, ancre.id, ancre.mode))
      if (!t) return true
      return !memePoint(t.ancre_lat, ancre.lat) || !memePoint(t.ancre_lon, ancre.lon)
    })
    resume.ignores += biens.length - aFaire.length
    if (!aFaire.length) continue

    for (const lot of paquets(aFaire)) {
      let durees
      try {
        durees = await dureesVersAncre(
          lot.map((b) => ({ lat: b.lat!, lon: b.lon! })),
          { lat: ancre.lat, lon: ancre.lon },
          ancre.mode
        )
      } catch {
        resume.echecs += lot.length
        continue
      }

      const lignes = lot.map((b, i) => ({
        bien_id: b.id,
        ancre: ancre.id,
        mode: ancre.mode,
        ancre_lat: ancre.lat,
        ancre_lon: ancre.lon,
        duree_s: durees[i]?.duree_s ?? null,
        distance_m: durees[i]?.distance_m ?? null,
        calcule_le: maintenant
      }))

      const { error } = await client
        .from('trajets')
        .upsert(lignes, { onConflict: 'bien_id,ancre,mode' })

      if (error) resume.echecs += lignes.length
      else resume.calcules += lignes.length
    }
  }

  return resume
})

import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'

export async function requireUser(event: H3Event) {
  const claims = await serverSupabaseUser(event)
  const id = (claims as any)?.sub
  if (!id) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }
  return { id, ...(claims as any) }
}

export async function db(event: H3Event) {
  return serverSupabaseClient(event)
}

export function serviceDb(event: H3Event) {
  return serverSupabaseServiceRole(event)
}

export const CHAMPS_MODIFIABLES = [
  'titre', 'prix', 'surface', 'nb_pieces', 'etage', 'charges',
  'dpe', 'adresse', 'ville', 'code_postal', 'photos', 'description',
  'statut', 'transaction', 'note_perso', 'actif',
  'visite_le', 'compte_rendu', 'checklist'
] as const

export const STATUTS_VALIDES = [
  'a_visiter', 'planifie', 'visite', 'elimine', 'coup_de_coeur'
] as const

/**
 * Insère un bien, amorce son historique de prix et le géocode.
 * Partagé par l'ajout manuel et la conversion d'un résultat de veille.
 */
export async function creerBien(
  client: any,
  userId: string,
  body: Record<string, any>
) {
  const payload: Record<string, unknown> = { user_id: userId }
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) payload[champ] = body[champ]
  }
  payload.url_source = body.url_source
  payload.site_source = body.site_source ?? null

  const { data, error } = await client.from('biens').insert(payload).select().single()
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  if (data?.prix != null) {
    await client.from('prix_historique').insert({ bien_id: data.id, prix: data.prix })
  }

  const loc = await geocoder(data)
  if (loc) {
    const { error: errGeo } = await client
      .from('biens')
      .update({
        lat: loc.lat,
        lon: loc.lon,
        geo_precision: loc.precision,
        geocode_le: new Date().toISOString()
      })
      .eq('id', data.id)

    if (!errGeo) {
      Object.assign(data, { lat: loc.lat, lon: loc.lon, geo_precision: loc.precision })
    }
  }

  return data
}

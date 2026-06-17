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
  'statut', 'note_perso', 'actif'
] as const

export const STATUTS_VALIDES = [
  'a_visiter', 'planifie', 'visite', 'elimine', 'coup_de_coeur'
] as const

import { randomBytes } from 'node:crypto'

/** Une sélection à partager reste une sélection, pas un export complet du dashboard. */
export const MAX_SHARED_PROPERTIES = 12

/**
 * Champs de `biens` exposés sur la page de partage publique. Liste blanche
 * volontairement étroite : jamais `url_source`, `note_perso`, `statut`,
 * `charges`, `description` ou tout champ interne ajouté plus tard.
 */
export const PUBLIC_PROPERTY_FIELDS = [
  'id',
  'titre',
  'prix',
  'surface',
  'nb_pieces',
  'etage',
  'dpe',
  'ville',
  'code_postal',
  'lat',
  'lon',
  'geo_precision',
  'photos',
  'transaction'
] as const

export const PUBLIC_PROPERTY_SELECT = PUBLIC_PROPERTY_FIELDS.join(', ')

export function generateShareToken(): string {
  return randomBytes(18).toString('base64url')
}

export function isShareExpired(expireLe: string | null): boolean {
  return expireLe != null && new Date(expireLe).getTime() < Date.now()
}

import { randomBytes } from 'node:crypto'

/** Une sélection à partager reste une sélection, pas un export complet du dashboard. */
export const MAX_BIENS_PARTAGE = 12

/**
 * Champs de `biens` exposés sur la page de partage publique. Liste blanche
 * volontairement étroite : jamais `url_source`, `note_perso`, `statut`,
 * `charges`, `description` ou tout champ interne ajouté plus tard.
 */
export const CHAMPS_PUBLICS_BIEN = [
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

export const SELECT_PUBLIC_BIEN = CHAMPS_PUBLICS_BIEN.join(', ')

export function genererTokenPartage(): string {
  return randomBytes(18).toString('base64url')
}

export function partageExpire(expireLe: string | null): boolean {
  return expireLe != null && new Date(expireLe).getTime() < Date.now()
}

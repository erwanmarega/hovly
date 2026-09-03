// Détermine si une annonce est une maison ou un appartement, d'après son
// titre. Aucune source n'expose de champ de type déjà parsé (leboncoin,
// century21, orpi inclus) : le titre commence systématiquement par le type
// du bien sur les 7 sources, signal déjà exploité par `MOTS_NON_VILLE`
// (`extract.ts`). Studio/duplex/loft comptent comme appartement côté DVF
// (`type_local`) ; villa comme maison. Terrain/immeuble/inconnu → null, on
// ne devine pas.

import type { TypeBien } from '~/types'

const MOTS_MAISON = ['maison', 'villa']
const MOTS_APPARTEMENT = ['appartement', 'appart', 'studio', 'duplex', 'loft']

export function detecterTypeBien(titre: string): TypeBien | null {
  const t = titre.toLowerCase()
  if (MOTS_MAISON.some((m) => t.includes(m))) return 'maison'
  if (MOTS_APPARTEMENT.some((m) => t.includes(m))) return 'appartement'
  return null
}

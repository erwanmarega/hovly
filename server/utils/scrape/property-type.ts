// Détermine si une annonce est une maison ou un appartement, d'après son
// titre. Aucune source n'expose de champ de type déjà parsé (leboncoin,
// century21, orpi inclus) : le titre commence systématiquement par le type
// du bien sur les 7 sources, signal déjà exploité par `MOTS_NON_VILLE`
// (`extract.ts`). Studio/duplex/loft comptent comme appartement côté DVF
// (`type_local`) ; villa comme maison. Terrain/immeuble/inconnu → null, on
// ne devine pas.

import type { PropertyType } from '~/types'

const HOUSE_WORDS = ['maison', 'villa']
const APARTMENT_WORDS = ['appartement', 'appart', 'studio', 'duplex', 'loft']

export function detectPropertyType(titre: string): PropertyType | null {
  const t = titre.toLowerCase()
  if (HOUSE_WORDS.some((m) => t.includes(m))) return 'maison'
  if (APARTMENT_WORDS.some((m) => t.includes(m))) return 'appartement'
  return null
}

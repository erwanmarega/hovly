// Détermine si une annonce est une location ou une vente, d'après son URL.
// Chaque source a un motif stable ; à défaut on replie sur le prix (aucun
// loyer réel n'atteint 50 000 €/mois). Le champ reste éditable à la main.

import type { Transaction } from '~/types'
import { SEUIL_PRIX_VENTE_EUROS } from '~/types'

const MOTIFS_ACHAT = [
  /\/ad\/ventes_immobilieres\//i, // leboncoin
  /\/annonce\/vente\//i, // bienici
  /\/annonces\/achat\//i, // seloger
  /detail-vente/i, // logic-immo
  /\/acheter\//i // century21
]

const MOTIFS_LOCATION = [
  /\/ad\/locations\//i, // leboncoin
  /\/annonce\/(?:location|colocation)\//i, // bienici
  /\/annonces\/location\//i, // seloger
  /detail-location/i, // logic-immo
  /\/louer\//i // century21
]

export function detecterTransaction(url: string, prixCentimes: number | null): Transaction {
  if (MOTIFS_ACHAT.some((m) => m.test(url))) return 'achat'
  if (MOTIFS_LOCATION.some((m) => m.test(url))) return 'location'
  return prixCentimes != null && prixCentimes / 100 >= SEUIL_PRIX_VENTE_EUROS
    ? 'achat'
    : 'location'
}

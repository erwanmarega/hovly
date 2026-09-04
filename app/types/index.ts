export type Status = 'a_visiter' | 'planifie' | 'visite' | 'elimine' | 'coup_de_coeur'

export type Transaction = 'location' | 'achat'

export type PropertyType = 'maison' | 'appartement'

// Au-delà de ce prix, une annonce sans transaction connue est traitée comme
// une vente (repli utilisé par la détection au scraping et par la carte DVF).
export const SALE_PRICE_THRESHOLD_EUROS = 50_000

// Photo de repli quand le scraping n'a trouvé aucune image. Partagé
// client/serveur : le serveur l'écrit dans `photos`, le client compare
// `photo === DEFAULT_PHOTO` pour l'afficher en entier (object-contain)
// plutôt qu'en cover comme une vraie photo.
export const DEFAULT_PHOTO = '/Icon_no_photo.svg'

export type DPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type GeoPrecision = 'exacte' | 'rue' | 'ville'

export type TravelMode = 'voiture' | 'velo' | 'marche' | 'transport'

export interface Anchor {
  id: string
  label: string
  adresse: string
  lat: number
  lon: number
  mode: TravelMode
  maxMinutes: number | null
}

export interface Commute {
  id: string
  bien_id: string
  ancre: string
  mode: TravelMode
  ancre_lat: number
  ancre_lon: number
  duree_s: number | null
  distance_m: number | null
  calcule_le: string
}

export interface Preferences {
  budgetMax: number | null
  surfaceMin: number | null
  piecesMin: number | null
  dpeMin: DPE | null
  poidsPrix: number
  poidsDpe: number
  poidsCharges: number
  prixKwh: number | null
  chauffageDansCharges: boolean
  budgetAchatMax: number | null
  apport: number | null
  tauxEmprunt: number | null // % annuel (ex. 3,5)
  dureeEmpruntAns: number | null
  ancres: Anchor[]
}

export type SiteSource =
  | 'seloger'
  | 'leboncoin'
  | 'pap'
  | 'logic-immo'
  | 'bienici'
  | 'century21'
  | 'orpi'

export const SOURCE_LABELS: Record<SiteSource, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici',
  century21: 'Century 21',
  orpi: 'Orpi'
}

export type VisitRating = 'bon' | 'moyen' | 'mauvais'

export interface Checklist {
  notes: Record<string, VisitRating>
  questions: string[]
}

export interface Property {
  id: string
  user_id: string
  url_source: string
  site_source: SiteSource
  titre: string
  prix: number
  surface: number
  nb_pieces: number
  etage: number | null
  charges: number | null
  dpe: DPE | null
  adresse: string | null
  ville: string
  code_postal: string
  lat: number | null
  lon: number | null
  geo_precision: GeoPrecision | null
  geocode_le: string | null
  photos: string[]
  description: string | null
  statut: Status
  transaction: Transaction
  type_bien: PropertyType | null
  note_perso: string | null
  visite_le: string | null
  compte_rendu: string | null
  checklist: Partial<Checklist> | null
  rappel_envoye_le: string | null
  actif: boolean
  created_at: string
}

export type ResultState = 'nouveau' | 'garde' | 'ignore'

export interface SavedSearch {
  id: string
  user_id: string
  label: string
  url: string
  site_source: SiteSource | null
  active: boolean
  prix_max: number | null
  prix_min: number | null
  surface_min: number | null
  pieces_min: number | null
  frequence_min: number
  derniere_verif: string | null
  derniere_erreur: string | null
  echecs_consecutifs: number
  created_at: string
  nouveaux?: number
}

export interface WatchResult {
  id: string
  recherche_id: string
  url: string
  titre: string | null
  prix: number | null
  surface: number | null
  nb_pieces: number | null
  photo: string | null
  ville: string | null
  code_postal: string | null
  etat: ResultState
  bien_id: string | null
  trouve_le: string
}

export interface NeighborhoodMarket {
  mediane: number // €/m² médian des ventes comparables
  q1: number
  q3: number
  min: number
  max: number
  nbVentes: number
  barres: number[] // histogramme des prix au m², de min à max
  du: string // date de la vente la plus ancienne
  au: string // date de la plus récente
  maj: string // statistiques calculées le
}

export interface Share {
  id: string
  user_id: string
  token: string
  titre: string | null
  cree_le: string
  expire_le: string | null
  nb_biens: number
}

/** Champs d'un bien exposés sur la page de partage publique — jamais `Property` en entier. */
export type SharedProperty = Pick<
  Property,
  | 'id'
  | 'titre'
  | 'prix'
  | 'surface'
  | 'nb_pieces'
  | 'etage'
  | 'dpe'
  | 'ville'
  | 'code_postal'
  | 'lat'
  | 'lon'
  | 'geo_precision'
  | 'photos'
  | 'transaction'
>

export interface PublicShare {
  titre: string | null
  cree_le: string
  biens: SharedProperty[]
}

export type AlertType = 'baisse_prix' | 'annonce_supprimee'

export interface Alert {
  id: string
  bien_id: string
  type: AlertType
  ancien_prix: number | null
  nouveau_prix: number | null
  envoyee_le: string
  vue: boolean
  biens?: Pick<Property, 'titre' | 'ville' | 'photos'> | null
}

export type Statut = 'a_visiter' | 'planifie' | 'visite' | 'elimine' | 'coup_de_coeur'

export type DPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type GeoPrecision = 'exacte' | 'rue' | 'ville'

export type ModeTrajet = 'voiture' | 'velo' | 'marche' | 'transport'

export interface Ancre {
  id: string
  label: string
  adresse: string
  lat: number
  lon: number
  mode: ModeTrajet
  maxMinutes: number | null
}

export interface Trajet {
  id: string
  bien_id: string
  ancre: string
  mode: ModeTrajet
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
  ancres: Ancre[]
}

export type SiteSource =
  | 'seloger'
  | 'leboncoin'
  | 'pap'
  | 'logic-immo'
  | 'bienici'
  | 'century21'

export type AvisVisite = 'bon' | 'moyen' | 'mauvais'

export interface Checklist {
  notes: Record<string, AvisVisite>
  questions: string[]
}

export interface Bien {
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
  statut: Statut
  note_perso: string | null
  visite_le: string | null
  compte_rendu: string | null
  checklist: Partial<Checklist> | null
  rappel_envoye_le: string | null
  actif: boolean
  created_at: string
}

export type TypeAlerte = 'baisse_prix' | 'annonce_supprimee'

export interface Alerte {
  id: string
  bien_id: string
  type: TypeAlerte
  ancien_prix: number | null
  nouveau_prix: number | null
  envoyee_le: string
  vue: boolean
  biens?: Pick<Bien, 'titre' | 'ville' | 'photos'> | null
}

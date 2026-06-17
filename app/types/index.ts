export type Statut = 'a_visiter' | 'planifie' | 'visite' | 'elimine' | 'coup_de_coeur'

export type DPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export type SiteSource =
  | 'seloger'
  | 'leboncoin'
  | 'pap'
  | 'logic-immo'
  | 'bienici'

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
  photos: string[]
  description: string | null
  statut: Statut
  note_perso: string | null
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

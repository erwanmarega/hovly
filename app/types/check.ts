import type { TypeAlerte } from './index'

export interface AlerteCreee {
  bien_id: string
  type: TypeAlerte
  ancien_prix: number | null
  nouveau_prix: number | null
  titre: string
}

export interface ResumeEnvois {
  envoyes: number
  echecs: number
  raisons: string[]
}

export interface CheckResume {
  verifies: number
  baisses: number
  supprimes: number
  erreurs: number
  alertes: AlerteCreee[]
  envois?: ResumeEnvois
  push?: ResumeEnvois
}

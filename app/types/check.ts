import type { AlertType } from './index'

export interface CreatedAlert {
  bien_id: string
  type: AlertType
  ancien_prix: number | null
  nouveau_prix: number | null
  titre: string
}

export interface SendSummary {
  sent: number
  failed: number
  reasons: string[]
}

export interface CheckSummary {
  checked: number
  priceDrops: number
  removed: number
  errors: number
  alerts: CreatedAlert[]
  emails?: SendSummary
  push?: SendSummary
}

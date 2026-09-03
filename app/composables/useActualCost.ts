import type { Property, DPE, Preferences } from '~/types'

export const KWH_EP_BY_DPE: Record<DPE, number> = {
  A: 50,
  B: 90,
  C: 145,
  D: 215,
  E: 290,
  F: 375,
  G: 470
}

export const FINAL_ENERGY_COEF = 0.65

export const DEFAULT_KWH_PRICE = 16

export const FIXED_INSURANCE_YEAR = 6000
export const INSURANCE_PER_SQM_YEAR = 160

export const DEFAULT_RATE = 3.5 // % annuel
export const DEFAULT_DURATION_YEARS = 20
export const NOTARY_FEES = 0.075

export interface CostItem {
  key: 'loyer' | 'credit' | 'charges' | 'energie' | 'assurance'
  label: string
  amount: number | null
  detail: string
}

export interface ActualCost {
  items: CostItem[]
  total: number
  displayed: number
  overagePercent: number
  incomplete: boolean
  assumptions: string[]
}

export interface CostOptions {
  prixKwh?: number
  chauffageDansCharges?: boolean
  apport?: number // €
  tauxEmprunt?: number // % annuel
  dureeEmpruntAns?: number
}

/** Mensualité d'un emprunt à amortissement constant, en centimes. */
export function monthlyLoanPayment(principalCents: number, ratePct: number, years: number): number {
  const n = Math.round(years * 12)
  if (principalCents <= 0 || n <= 0) return 0
  const rate = ratePct / 100 / 12
  if (rate === 0) return Math.round(principalCents / n)
  return Math.round((principalCents * rate) / (1 - Math.pow(1 + rate, -n)))
}

export function monthlyEnergyCost(
  bien: Property,
  kwhPrice = DEFAULT_KWH_PRICE
): number | null {
  if (!bien.dpe || !bien.surface) return null
  const finalKwhPerSqm = KWH_EP_BY_DPE[bien.dpe] * FINAL_ENERGY_COEF
  return Math.round((finalKwhPerSqm * bien.surface * kwhPrice) / 12)
}

export function monthlyInsuranceCost(bien: Property): number {
  return Math.round((FIXED_INSURANCE_YEAR + INSURANCE_PER_SQM_YEAR * (bien.surface || 0)) / 12)
}

export function actualCost(bien: Property, options: CostOptions = {}): ActualCost {
  const kwhPrice = options.prixKwh && options.prixKwh > 0 ? options.prixKwh : DEFAULT_KWH_PRICE
  const heatingIncluded = options.chauffageDansCharges ?? false

  const charges = bien.charges ?? 0
  const insurance = monthlyInsuranceCost(bien)
  const rawEnergyCost = monthlyEnergyCost(bien, kwhPrice)
  const energy = heatingIncluded ? 0 : rawEnergyCost

  const feesDetail =
    bien.charges == null ? 'Non renseignées dans l’annonce' : 'Provision mensuelle'
  const energyDetail = heatingIncluded
    ? 'Comptée dans les charges'
    : bien.dpe
      ? `Estimée depuis le DPE ${bien.dpe} et ${bien.surface} m²`
      : 'DPE absent — non estimable'

  const commonAssumptions = [
    `Énergie : ${kwhPrice / 100} €/kWh, conversion énergie primaire ×${FINAL_ENERGY_COEF}`,
    `Assurance : ${FIXED_INSURANCE_YEAR / 100} € par an + ${INSURANCE_PER_SQM_YEAR / 100} € par m² et par an`
  ]

  if (bien.transaction === 'achat') {
    const rate =
      options.tauxEmprunt != null && options.tauxEmprunt >= 0 ? options.tauxEmprunt : DEFAULT_RATE
    const duration =
      options.dureeEmpruntAns && options.dureeEmpruntAns > 0
        ? options.dureeEmpruntAns
        : DEFAULT_DURATION_YEARS
    const downPayment = options.apport && options.apport > 0 ? options.apport : 0

    const borrowed = Math.round(bien.prix * (1 + NOTARY_FEES)) - Math.round(downPayment * 100)
    const monthlyPayment = monthlyLoanPayment(borrowed, rate, duration)

    const items: CostItem[] = [
      {
        key: 'credit',
        label: 'Mensualité estimée',
        amount: monthlyPayment,
        detail: `${rate} % sur ${duration} ans, frais de notaire inclus`
      },
      { key: 'charges', label: 'Charges de copropriété', amount: charges, detail: feesDetail },
      { key: 'energie', label: 'Énergie', amount: energy, detail: energyDetail },
      {
        key: 'assurance',
        label: 'Assurance habitation',
        amount: insurance,
        detail: 'Estimation multirisque habitation'
      }
    ]

    const total = items.reduce((s, p) => s + (p.amount ?? 0), 0)
    const assumptions = [
      `Emprunt : ${rate} % sur ${duration} ans, frais de notaire ${NOTARY_FEES * 100} %` +
        (downPayment ? `, apport ${downPayment.toLocaleString('fr-FR')} €` : ', sans apport'),
      ...commonAssumptions
    ]

    return {
      items,
      total,
      displayed: monthlyPayment,
      overagePercent: monthlyPayment ? Math.round(((total - monthlyPayment) / monthlyPayment) * 100) : 0,
      incomplete: bien.charges == null || (!heatingIncluded && rawEnergyCost == null),
      assumptions
    }
  }

  const rent = bien.prix ?? 0

  const items: CostItem[] = [
    {
      key: 'loyer',
      label: 'Loyer hors charges',
      amount: rent,
      detail: 'Montant affiché dans l’annonce'
    },
    { key: 'charges', label: 'Charges', amount: charges, detail: feesDetail },
    { key: 'energie', label: 'Énergie', amount: energy, detail: energyDetail },
    {
      key: 'assurance',
      label: 'Assurance habitation',
      amount: insurance,
      detail: 'Estimation multirisque habitation'
    }
  ]

  const total = items.reduce((s, p) => s + (p.amount ?? 0), 0)
  const displayed = rent + charges
  const incomplete = bien.charges == null || (!heatingIncluded && rawEnergyCost == null)

  return {
    items,
    total,
    displayed,
    overagePercent: displayed ? Math.round(((total - displayed) / displayed) * 100) : 0,
    incomplete,
    assumptions: commonAssumptions
  }
}

export function optionsFromPreferences(p: Preferences): CostOptions {
  return {
    prixKwh: p.prixKwh ?? DEFAULT_KWH_PRICE,
    chauffageDansCharges: p.chauffageDansCharges ?? false,
    apport: p.apport ?? undefined,
    tauxEmprunt: p.tauxEmprunt ?? undefined,
    dureeEmpruntAns: p.dureeEmpruntAns ?? undefined
  }
}

export function useActualCost() {
  const { preferences } = usePreferences()

  const options = computed(() => optionsFromPreferences(preferences.value))
  const calculate = (bien: Property) => actualCost(bien, options.value)

  return { options, calculate }
}

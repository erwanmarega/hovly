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
  cle: 'loyer' | 'credit' | 'charges' | 'energie' | 'assurance'
  label: string
  montant: number | null
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

export interface OptionsCout {
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
  prixKwh = DEFAULT_KWH_PRICE
): number | null {
  if (!bien.dpe || !bien.surface) return null
  const kwhFinalParM2 = KWH_EP_BY_DPE[bien.dpe] * FINAL_ENERGY_COEF
  return Math.round((kwhFinalParM2 * bien.surface * prixKwh) / 12)
}

export function monthlyInsuranceCost(bien: Property): number {
  return Math.round((FIXED_INSURANCE_YEAR + INSURANCE_PER_SQM_YEAR * (bien.surface || 0)) / 12)
}

export function actualCost(bien: Property, options: OptionsCout = {}): ActualCost {
  const prixKwh = options.prixKwh && options.prixKwh > 0 ? options.prixKwh : DEFAULT_KWH_PRICE
  const chauffageDansCharges = options.chauffageDansCharges ?? false

  const charges = bien.charges ?? 0
  const assurance = monthlyInsuranceCost(bien)
  const energieBrute = monthlyEnergyCost(bien, prixKwh)
  const energie = chauffageDansCharges ? 0 : energieBrute

  const detailCharges =
    bien.charges == null ? 'Non renseignées dans l’annonce' : 'Provision mensuelle'
  const detailEnergie = chauffageDansCharges
    ? 'Comptée dans les charges'
    : bien.dpe
      ? `Estimée depuis le DPE ${bien.dpe} et ${bien.surface} m²`
      : 'DPE absent — non estimable'

  const commonAssumptions = [
    `Énergie : ${prixKwh / 100} €/kWh, conversion énergie primaire ×${FINAL_ENERGY_COEF}`,
    `Assurance : ${FIXED_INSURANCE_YEAR / 100} € par an + ${INSURANCE_PER_SQM_YEAR / 100} € par m² et par an`
  ]

  if (bien.transaction === 'achat') {
    const taux =
      options.tauxEmprunt != null && options.tauxEmprunt >= 0 ? options.tauxEmprunt : DEFAULT_RATE
    const duree =
      options.dureeEmpruntAns && options.dureeEmpruntAns > 0
        ? options.dureeEmpruntAns
        : DEFAULT_DURATION_YEARS
    const apport = options.apport && options.apport > 0 ? options.apport : 0

    const emprunte = Math.round(bien.prix * (1 + NOTARY_FEES)) - Math.round(apport * 100)
    const mensualite = monthlyLoanPayment(emprunte, taux, duree)

    const items: CostItem[] = [
      {
        cle: 'credit',
        label: 'Mensualité estimée',
        montant: mensualite,
        detail: `${taux} % sur ${duree} ans, frais de notaire inclus`
      },
      { cle: 'charges', label: 'Charges de copropriété', montant: charges, detail: detailCharges },
      { cle: 'energie', label: 'Énergie', montant: energie, detail: detailEnergie },
      {
        cle: 'assurance',
        label: 'Assurance habitation',
        montant: assurance,
        detail: 'Estimation multirisque habitation'
      }
    ]

    const total = items.reduce((s, p) => s + (p.montant ?? 0), 0)
    const assumptions = [
      `Emprunt : ${taux} % sur ${duree} ans, frais de notaire ${NOTARY_FEES * 100} %` +
        (apport ? `, apport ${apport.toLocaleString('fr-FR')} €` : ', sans apport'),
      ...commonAssumptions
    ]

    return {
      items,
      total,
      displayed: mensualite,
      overagePercent: mensualite ? Math.round(((total - mensualite) / mensualite) * 100) : 0,
      incomplete: bien.charges == null || (!chauffageDansCharges && energieBrute == null),
      assumptions
    }
  }

  const loyer = bien.prix ?? 0

  const items: CostItem[] = [
    {
      cle: 'loyer',
      label: 'Loyer hors charges',
      montant: loyer,
      detail: 'Montant affiché dans l’annonce'
    },
    { cle: 'charges', label: 'Charges', montant: charges, detail: detailCharges },
    { cle: 'energie', label: 'Énergie', montant: energie, detail: detailEnergie },
    {
      cle: 'assurance',
      label: 'Assurance habitation',
      montant: assurance,
      detail: 'Estimation multirisque habitation'
    }
  ]

  const total = items.reduce((s, p) => s + (p.montant ?? 0), 0)
  const displayed = loyer + charges
  const incomplete = bien.charges == null || (!chauffageDansCharges && energieBrute == null)

  return {
    items,
    total,
    displayed,
    overagePercent: displayed ? Math.round(((total - displayed) / displayed) * 100) : 0,
    incomplete,
    assumptions: commonAssumptions
  }
}

export function optionsFromPreferences(p: Preferences): OptionsCout {
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

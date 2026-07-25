import type { Bien, DPE, Preferences } from '~/types'

/**
 * Le prix affiché dans une annonce ment : il ignore l'énergie, l'assurance, et
 * parfois les charges. On reconstitue ce que le logement coûte vraiment par mois.
 * Tout est en centimes, comme en base.
 */

/** Consommation d'énergie primaire retenue par classe DPE (kWh EP/m²/an, milieu de plage). */
export const KWH_EP_PAR_DPE: Record<DPE, number> = {
  A: 50,
  B: 90,
  C: 145,
  D: 215,
  E: 290,
  F: 375,
  G: 470
}

/** Énergie primaire → énergie finale facturée (mix gaz/électricité du parc français). */
export const COEF_ENERGIE_FINALE = 0.65

/** Prix moyen du kWh, en centimes. Mix gaz ~12 c€ / électricité ~25 c€. */
export const PRIX_KWH_DEFAUT = 16

/** Assurance habitation : une part fixe + une part à la surface, en centimes par an. */
export const ASSURANCE_FIXE_AN = 6000
export const ASSURANCE_PAR_M2_AN = 160

export interface PosteCout {
  cle: 'loyer' | 'charges' | 'energie' | 'assurance'
  label: string
  /** Centimes par mois. `null` = non estimable (DPE absent, par exemple). */
  montant: number | null
  detail: string
}

export interface CoutReel {
  postes: PosteCout[]
  /** Centimes par mois, postes estimables uniquement. */
  total: number
  /** Loyer + charges, ce que l'annonce laisse croire. */
  affiche: number
  /** Écart en % entre le coût réel et le prix affiché. */
  ecartPourcent: number
  /** Vrai si un poste manque faute de donnée : le total est alors un plancher. */
  incomplet: boolean
  hypotheses: string[]
}

export interface OptionsCout {
  prixKwh?: number
  /** Le chauffage est déjà facturé dans les charges : on ne le compte pas deux fois. */
  chauffageDansCharges?: boolean
}

export function coutEnergieMensuel(
  bien: Bien,
  prixKwh = PRIX_KWH_DEFAUT
): number | null {
  if (!bien.dpe || !bien.surface) return null
  const kwhFinalParM2 = KWH_EP_PAR_DPE[bien.dpe] * COEF_ENERGIE_FINALE
  return Math.round((kwhFinalParM2 * bien.surface * prixKwh) / 12)
}

export function coutAssuranceMensuel(bien: Bien): number {
  return Math.round((ASSURANCE_FIXE_AN + ASSURANCE_PAR_M2_AN * (bien.surface || 0)) / 12)
}

export function coutReel(bien: Bien, options: OptionsCout = {}): CoutReel {
  const prixKwh = options.prixKwh && options.prixKwh > 0 ? options.prixKwh : PRIX_KWH_DEFAUT
  const chauffageDansCharges = options.chauffageDansCharges ?? false

  const loyer = bien.prix ?? 0
  const charges = bien.charges ?? 0
  const assurance = coutAssuranceMensuel(bien)
  const energieBrute = coutEnergieMensuel(bien, prixKwh)
  const energie = chauffageDansCharges ? 0 : energieBrute

  const postes: PosteCout[] = [
    {
      cle: 'loyer',
      label: 'Loyer hors charges',
      montant: loyer,
      detail: 'Montant affiché dans l’annonce'
    },
    {
      cle: 'charges',
      label: 'Charges',
      montant: charges,
      detail: bien.charges == null ? 'Non renseignées dans l’annonce' : 'Provision mensuelle'
    },
    {
      cle: 'energie',
      label: 'Énergie',
      montant: energie,
      detail: chauffageDansCharges
        ? 'Comptée dans les charges'
        : bien.dpe
          ? `Estimée depuis le DPE ${bien.dpe} et ${bien.surface} m²`
          : 'DPE absent — non estimable'
    },
    {
      cle: 'assurance',
      label: 'Assurance habitation',
      montant: assurance,
      detail: 'Estimation multirisque habitation'
    }
  ]

  const total = postes.reduce((s, p) => s + (p.montant ?? 0), 0)
  const affiche = loyer + charges
  const incomplet = bien.charges == null || (!chauffageDansCharges && energieBrute == null)

  const hypotheses = [
    `Énergie : ${prixKwh / 100} €/kWh, conversion énergie primaire ×${COEF_ENERGIE_FINALE}`,
    `Assurance : ${ASSURANCE_FIXE_AN / 100} € par an + ${ASSURANCE_PAR_M2_AN / 100} € par m² et par an`
  ]

  return {
    postes,
    total,
    affiche,
    ecartPourcent: affiche ? Math.round(((total - affiche) / affiche) * 100) : 0,
    incomplet,
    hypotheses
  }
}

/** Options de calcul dérivées des préférences de l'utilisateur. */
export function optionsDepuisPreferences(p: Preferences): OptionsCout {
  return {
    prixKwh: p.prixKwh ?? PRIX_KWH_DEFAUT,
    chauffageDansCharges: p.chauffageDansCharges ?? false
  }
}

export function useCoutReel() {
  const { preferences } = usePreferences()

  const options = computed(() => optionsDepuisPreferences(preferences.value))
  const calculer = (bien: Bien) => coutReel(bien, options.value)

  return { options, calculer }
}

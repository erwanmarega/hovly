import type { Bien, DPE, Preferences } from '~/types'

export const KWH_EP_PAR_DPE: Record<DPE, number> = {
  A: 50,
  B: 90,
  C: 145,
  D: 215,
  E: 290,
  F: 375,
  G: 470
}

export const COEF_ENERGIE_FINALE = 0.65

export const PRIX_KWH_DEFAUT = 16

export const ASSURANCE_FIXE_AN = 6000
export const ASSURANCE_PAR_M2_AN = 160

export const TAUX_DEFAUT = 3.5 // % annuel
export const DUREE_DEFAUT_ANS = 20
export const FRAIS_NOTAIRE = 0.075

export interface PosteCout {
  cle: 'loyer' | 'credit' | 'charges' | 'energie' | 'assurance'
  label: string
  montant: number | null
  detail: string
}

export interface CoutReel {
  postes: PosteCout[]
  total: number
  affiche: number
  ecartPourcent: number
  incomplet: boolean
  hypotheses: string[]
}

export interface OptionsCout {
  prixKwh?: number
  chauffageDansCharges?: boolean
  apport?: number // €
  tauxEmprunt?: number // % annuel
  dureeEmpruntAns?: number
}

/** Mensualité d'un emprunt à amortissement constant, en centimes. */
export function mensualiteCredit(capitalCentimes: number, tauxPct: number, dureeAns: number): number {
  const n = Math.round(dureeAns * 12)
  if (capitalCentimes <= 0 || n <= 0) return 0
  const taux = tauxPct / 100 / 12
  if (taux === 0) return Math.round(capitalCentimes / n)
  return Math.round((capitalCentimes * taux) / (1 - Math.pow(1 + taux, -n)))
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

  const charges = bien.charges ?? 0
  const assurance = coutAssuranceMensuel(bien)
  const energieBrute = coutEnergieMensuel(bien, prixKwh)
  const energie = chauffageDansCharges ? 0 : energieBrute

  const detailCharges =
    bien.charges == null ? 'Non renseignées dans l’annonce' : 'Provision mensuelle'
  const detailEnergie = chauffageDansCharges
    ? 'Comptée dans les charges'
    : bien.dpe
      ? `Estimée depuis le DPE ${bien.dpe} et ${bien.surface} m²`
      : 'DPE absent — non estimable'

  const hypothesesCommunes = [
    `Énergie : ${prixKwh / 100} €/kWh, conversion énergie primaire ×${COEF_ENERGIE_FINALE}`,
    `Assurance : ${ASSURANCE_FIXE_AN / 100} € par an + ${ASSURANCE_PAR_M2_AN / 100} € par m² et par an`
  ]

  if (bien.transaction === 'achat') {
    const taux =
      options.tauxEmprunt != null && options.tauxEmprunt >= 0 ? options.tauxEmprunt : TAUX_DEFAUT
    const duree =
      options.dureeEmpruntAns && options.dureeEmpruntAns > 0
        ? options.dureeEmpruntAns
        : DUREE_DEFAUT_ANS
    const apport = options.apport && options.apport > 0 ? options.apport : 0

    const emprunte = Math.round(bien.prix * (1 + FRAIS_NOTAIRE)) - Math.round(apport * 100)
    const mensualite = mensualiteCredit(emprunte, taux, duree)

    const postes: PosteCout[] = [
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

    const total = postes.reduce((s, p) => s + (p.montant ?? 0), 0)
    const hypotheses = [
      `Emprunt : ${taux} % sur ${duree} ans, frais de notaire ${FRAIS_NOTAIRE * 100} %` +
        (apport ? `, apport ${apport.toLocaleString('fr-FR')} €` : ', sans apport'),
      ...hypothesesCommunes
    ]

    return {
      postes,
      total,
      affiche: mensualite,
      ecartPourcent: mensualite ? Math.round(((total - mensualite) / mensualite) * 100) : 0,
      incomplet: bien.charges == null || (!chauffageDansCharges && energieBrute == null),
      hypotheses
    }
  }

  const loyer = bien.prix ?? 0

  const postes: PosteCout[] = [
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

  const total = postes.reduce((s, p) => s + (p.montant ?? 0), 0)
  const affiche = loyer + charges
  const incomplet = bien.charges == null || (!chauffageDansCharges && energieBrute == null)

  return {
    postes,
    total,
    affiche,
    ecartPourcent: affiche ? Math.round(((total - affiche) / affiche) * 100) : 0,
    incomplet,
    hypotheses: hypothesesCommunes
  }
}

export function optionsDepuisPreferences(p: Preferences): OptionsCout {
  return {
    prixKwh: p.prixKwh ?? PRIX_KWH_DEFAUT,
    chauffageDansCharges: p.chauffageDansCharges ?? false,
    apport: p.apport ?? undefined,
    tauxEmprunt: p.tauxEmprunt ?? undefined,
    dureeEmpruntAns: p.dureeEmpruntAns ?? undefined
  }
}

export function useCoutReel() {
  const { preferences } = usePreferences()

  const options = computed(() => optionsDepuisPreferences(preferences.value))
  const calculer = (bien: Bien) => coutReel(bien, options.value)

  return { options, calculer }
}

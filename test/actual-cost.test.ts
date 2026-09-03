import { describe, it, expect } from 'vitest'
import type { Property } from '../app/types'
import {
  FIXED_INSURANCE_YEAR,
  INSURANCE_PER_SQM_YEAR,
  FINAL_ENERGY_COEF,
  DEFAULT_DURATION_YEARS,
  NOTARY_FEES,
  KWH_EP_BY_DPE,
  DEFAULT_KWH_PRICE,
  DEFAULT_RATE,
  monthlyInsuranceCost,
  monthlyEnergyCost,
  actualCost,
  monthlyLoanPayment,
  optionsFromPreferences
} from '../app/composables/useActualCost'
import { DEFAULT_PREFERENCES } from '../app/composables/useScore'

function bien(over: Partial<Property> = {}): Property {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.pap.fr/annonces/1',
    site_source: 'pap',
    titre: 'T2 Cachan',
    prix: 95000,
    surface: 45,
    nb_pieces: 2,
    etage: null,
    charges: 8000,
    dpe: 'D',
    adresse: null,
    ville: 'Cachan',
    code_postal: '94230',
    lat: null,
    lon: null,
    geo_precision: null,
    geocode_le: null,
    photos: [],
    description: null,
    statut: 'a_visiter',
    note_perso: null,
    visite_le: null,
    compte_rendu: null,
    checklist: null,
    rappel_envoye_le: null,
    actif: true,
    created_at: '2026-07-01T10:00:00.000Z',
    transaction: 'location',
    ...over
  }
}

const poste = (c: ReturnType<typeof actualCost>, cle: string) =>
  c.items.find((p) => p.cle === cle)!

describe('monthlyEnergyCost', () => {
  it('suit la formule DPE × surface × prix du kWh', () => {
    const attendu = Math.round(
      (KWH_EP_BY_DPE.D * FINAL_ENERGY_COEF * 45 * DEFAULT_KWH_PRICE) / 12
    )
    expect(monthlyEnergyCost(bien())).toBe(attendu)
  })

  it('coûte plus cher quand la classe est mauvaise', () => {
    const a = monthlyEnergyCost(bien({ dpe: 'A' }))!
    const g = monthlyEnergyCost(bien({ dpe: 'G' }))!
    expect(g).toBeGreaterThan(a * 5)
  })

  it('n’estime rien sans DPE ni sans surface', () => {
    expect(monthlyEnergyCost(bien({ dpe: null }))).toBeNull()
    expect(monthlyEnergyCost(bien({ surface: 0 }))).toBeNull()
  })

  it('suit le prix du kWh fourni', () => {
    const base = monthlyEnergyCost(bien(), 16)!
    expect(monthlyEnergyCost(bien(), 32)).toBe(base * 2)
  })
})

describe('monthlyInsuranceCost', () => {
  it('additionne part fixe et part surface', () => {
    expect(monthlyInsuranceCost(bien())).toBe(
      Math.round((FIXED_INSURANCE_YEAR + INSURANCE_PER_SQM_YEAR * 45) / 12)
    )
  })
})

describe('actualCost', () => {
  it('additionne loyer, charges, énergie et assurance', () => {
    const c = actualCost(bien())
    const somme =
      95000 + 8000 + monthlyEnergyCost(bien())! + monthlyInsuranceCost(bien())
    expect(c.total).toBe(somme)
    expect(c.displayed).toBe(103000)
  })

  it('mesure l’écart avec le prix affiché', () => {
    const c = actualCost(bien())
    expect(c.overagePercent).toBe(Math.round(((c.total - c.displayed) / c.displayed) * 100))
    expect(c.overagePercent).toBeGreaterThan(0)
  })

  it('ne compte pas l’énergie deux fois quand elle est dans les charges', () => {
    const avec = actualCost(bien(), { chauffageDansCharges: true })
    expect(poste(avec, 'energie').montant).toBe(0)
    expect(poste(avec, 'energie').detail).toContain('charges')
    expect(avec.total).toBe(actualCost(bien()).total - monthlyEnergyCost(bien())!)
  })

  it('signale une estimation basse quand le DPE manque', () => {
    const c = actualCost(bien({ dpe: null }))
    expect(poste(c, 'energie').montant).toBeNull()
    expect(c.incomplete).toBe(true)
    expect(c.total).toBe(95000 + 8000 + monthlyInsuranceCost(bien()))
  })

  it('signale aussi une estimation basse sans charges renseignées', () => {
    const c = actualCost(bien({ charges: null }))
    expect(c.incomplete).toBe(true)
    expect(poste(c, 'charges').detail).toContain('Non renseignées')
    expect(c.displayed).toBe(95000)
  })

  it('reste complet quand tout est connu', () => {
    expect(actualCost(bien()).incomplete).toBe(false)
  })

  it('ignore un prix du kWh absurde et retombe sur la valeur par défaut', () => {
    expect(actualCost(bien(), { prixKwh: 0 }).total).toBe(actualCost(bien()).total)
    expect(actualCost(bien(), { prixKwh: -5 }).total).toBe(actualCost(bien()).total)
  })

  it('ne divise pas par zéro sur un bien sans prix', () => {
    const c = actualCost(bien({ prix: 0, charges: 0 }))
    expect(c.overagePercent).toBe(0)
  })
})

describe('optionsFromPreferences', () => {
  it('retombe sur les valeurs par défaut', () => {
    expect(optionsFromPreferences(DEFAULT_PREFERENCES)).toEqual({
      prixKwh: DEFAULT_KWH_PRICE,
      chauffageDansCharges: false
    })
  })

  it('reprend les réglages de l’utilisateur', () => {
    expect(
      optionsFromPreferences({
        ...DEFAULT_PREFERENCES,
        prixKwh: 22,
        chauffageDansCharges: true
      })
    ).toEqual({ prixKwh: 22, chauffageDansCharges: true })
  })
})

describe('monthlyLoanPayment', () => {
  it('taux zéro : simple division du capital par les mensualités', () => {
    expect(monthlyLoanPayment(24000000, 0, 20)).toBe(100000) // 240 000 € / 240 mois
  })

  it('un taux positif alourdit la mensualité', () => {
    const m0 = monthlyLoanPayment(24000000, 0, 20)
    const m = monthlyLoanPayment(24000000, DEFAULT_RATE, DEFAULT_DURATION_YEARS)
    expect(m).toBeGreaterThan(m0)
  })

  it('vaut zéro sans capital', () => {
    expect(monthlyLoanPayment(0, DEFAULT_RATE, 20)).toBe(0)
    expect(monthlyLoanPayment(-100, DEFAULT_RATE, 20)).toBe(0)
  })
})

describe('actualCost — bien en achat', () => {
  const achat = (over: Partial<Property> = {}) =>
    bien({ transaction: 'achat', prix: 20000000, charges: 15000, ...over })

  it('remplace le loyer par une mensualité estimée', () => {
    const c = actualCost(achat(), { tauxEmprunt: 0, dureeEmpruntAns: 20 })
    const attendu = Math.round(Math.round(20000000 * (1 + NOTARY_FEES)) / 240)
    const credit = poste(c, 'credit')
    expect(credit.label).toBe('Mensualité estimée')
    expect(credit.montant).toBe(attendu)
    expect(c.displayed).toBe(attendu)
    expect(poste(c, 'loyer')).toBeUndefined()
  })

  it('déduit l’apport du capital emprunté', () => {
    const sansApport = actualCost(achat(), { tauxEmprunt: 0 })
    const avec = actualCost(achat(), { tauxEmprunt: 0, apport: 20000 })
    expect(poste(sansApport, 'credit').montant! - poste(avec, 'credit').montant!).toBe(
      Math.round(2000000 / 240)
    )
  })

  it('libelle les charges en copropriété et documente les hypothèses', () => {
    const c = actualCost(achat())
    expect(poste(c, 'charges').label).toBe('Charges de copropriété')
    expect(c.assumptions.join(' ')).toContain('notaire')
    expect(c.assumptions.join(' ')).toContain(`${DEFAULT_RATE} % sur ${DEFAULT_DURATION_YEARS} ans`)
  })

  it('garde énergie et assurance, et mesure l’écart avec la mensualité', () => {
    const c = actualCost(achat())
    expect(poste(c, 'energie').montant).toBe(monthlyEnergyCost(achat()))
    expect(poste(c, 'assurance').montant).toBe(monthlyInsuranceCost(achat()))
    const credit = poste(c, 'credit').montant!
    expect(c.total).toBe(credit + 15000 + monthlyEnergyCost(achat())! + monthlyInsuranceCost(achat()))
    expect(c.overagePercent).toBe(Math.round(((c.total - credit) / credit) * 100))
  })
})

import { describe, it, expect } from 'vitest'
import type { Bien } from '../app/types'
import {
  ASSURANCE_FIXE_AN,
  ASSURANCE_PAR_M2_AN,
  COEF_ENERGIE_FINALE,
  DUREE_DEFAUT_ANS,
  FRAIS_NOTAIRE,
  KWH_EP_PAR_DPE,
  PRIX_KWH_DEFAUT,
  TAUX_DEFAUT,
  coutAssuranceMensuel,
  coutEnergieMensuel,
  coutReel,
  mensualiteCredit,
  optionsDepuisPreferences
} from '../app/composables/useCoutReel'
import { PREFERENCES_DEFAUT } from '../app/composables/useScore'

function bien(over: Partial<Bien> = {}): Bien {
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

const poste = (c: ReturnType<typeof coutReel>, cle: string) =>
  c.postes.find((p) => p.cle === cle)!

describe('coutEnergieMensuel', () => {
  it('suit la formule DPE × surface × prix du kWh', () => {
    const attendu = Math.round(
      (KWH_EP_PAR_DPE.D * COEF_ENERGIE_FINALE * 45 * PRIX_KWH_DEFAUT) / 12
    )
    expect(coutEnergieMensuel(bien())).toBe(attendu)
  })

  it('coûte plus cher quand la classe est mauvaise', () => {
    const a = coutEnergieMensuel(bien({ dpe: 'A' }))!
    const g = coutEnergieMensuel(bien({ dpe: 'G' }))!
    expect(g).toBeGreaterThan(a * 5)
  })

  it('n’estime rien sans DPE ni sans surface', () => {
    expect(coutEnergieMensuel(bien({ dpe: null }))).toBeNull()
    expect(coutEnergieMensuel(bien({ surface: 0 }))).toBeNull()
  })

  it('suit le prix du kWh fourni', () => {
    const base = coutEnergieMensuel(bien(), 16)!
    expect(coutEnergieMensuel(bien(), 32)).toBe(base * 2)
  })
})

describe('coutAssuranceMensuel', () => {
  it('additionne part fixe et part surface', () => {
    expect(coutAssuranceMensuel(bien())).toBe(
      Math.round((ASSURANCE_FIXE_AN + ASSURANCE_PAR_M2_AN * 45) / 12)
    )
  })
})

describe('coutReel', () => {
  it('additionne loyer, charges, énergie et assurance', () => {
    const c = coutReel(bien())
    const somme =
      95000 + 8000 + coutEnergieMensuel(bien())! + coutAssuranceMensuel(bien())
    expect(c.total).toBe(somme)
    expect(c.affiche).toBe(103000)
  })

  it('mesure l’écart avec le prix affiché', () => {
    const c = coutReel(bien())
    expect(c.ecartPourcent).toBe(Math.round(((c.total - c.affiche) / c.affiche) * 100))
    expect(c.ecartPourcent).toBeGreaterThan(0)
  })

  it('ne compte pas l’énergie deux fois quand elle est dans les charges', () => {
    const avec = coutReel(bien(), { chauffageDansCharges: true })
    expect(poste(avec, 'energie').montant).toBe(0)
    expect(poste(avec, 'energie').detail).toContain('charges')
    expect(avec.total).toBe(coutReel(bien()).total - coutEnergieMensuel(bien())!)
  })

  it('signale une estimation basse quand le DPE manque', () => {
    const c = coutReel(bien({ dpe: null }))
    expect(poste(c, 'energie').montant).toBeNull()
    expect(c.incomplet).toBe(true)
    expect(c.total).toBe(95000 + 8000 + coutAssuranceMensuel(bien()))
  })

  it('signale aussi une estimation basse sans charges renseignées', () => {
    const c = coutReel(bien({ charges: null }))
    expect(c.incomplet).toBe(true)
    expect(poste(c, 'charges').detail).toContain('Non renseignées')
    expect(c.affiche).toBe(95000)
  })

  it('reste complet quand tout est connu', () => {
    expect(coutReel(bien()).incomplet).toBe(false)
  })

  it('ignore un prix du kWh absurde et retombe sur la valeur par défaut', () => {
    expect(coutReel(bien(), { prixKwh: 0 }).total).toBe(coutReel(bien()).total)
    expect(coutReel(bien(), { prixKwh: -5 }).total).toBe(coutReel(bien()).total)
  })

  it('ne divise pas par zéro sur un bien sans prix', () => {
    const c = coutReel(bien({ prix: 0, charges: 0 }))
    expect(c.ecartPourcent).toBe(0)
  })
})

describe('optionsDepuisPreferences', () => {
  it('retombe sur les valeurs par défaut', () => {
    expect(optionsDepuisPreferences(PREFERENCES_DEFAUT)).toEqual({
      prixKwh: PRIX_KWH_DEFAUT,
      chauffageDansCharges: false
    })
  })

  it('reprend les réglages de l’utilisateur', () => {
    expect(
      optionsDepuisPreferences({
        ...PREFERENCES_DEFAUT,
        prixKwh: 22,
        chauffageDansCharges: true
      })
    ).toEqual({ prixKwh: 22, chauffageDansCharges: true })
  })
})

describe('mensualiteCredit', () => {
  it('taux zéro : simple division du capital par les mensualités', () => {
    expect(mensualiteCredit(24000000, 0, 20)).toBe(100000) // 240 000 € / 240 mois
  })

  it('un taux positif alourdit la mensualité', () => {
    const m0 = mensualiteCredit(24000000, 0, 20)
    const m = mensualiteCredit(24000000, TAUX_DEFAUT, DUREE_DEFAUT_ANS)
    expect(m).toBeGreaterThan(m0)
  })

  it('vaut zéro sans capital', () => {
    expect(mensualiteCredit(0, TAUX_DEFAUT, 20)).toBe(0)
    expect(mensualiteCredit(-100, TAUX_DEFAUT, 20)).toBe(0)
  })
})

describe('coutReel — bien en achat', () => {
  const achat = (over: Partial<Bien> = {}) =>
    bien({ transaction: 'achat', prix: 20000000, charges: 15000, ...over })

  it('remplace le loyer par une mensualité estimée', () => {
    const c = coutReel(achat(), { tauxEmprunt: 0, dureeEmpruntAns: 20 })
    const attendu = Math.round(Math.round(20000000 * (1 + FRAIS_NOTAIRE)) / 240)
    const credit = poste(c, 'credit')
    expect(credit.label).toBe('Mensualité estimée')
    expect(credit.montant).toBe(attendu)
    expect(c.affiche).toBe(attendu)
    expect(poste(c, 'loyer')).toBeUndefined()
  })

  it('déduit l’apport du capital emprunté', () => {
    const sansApport = coutReel(achat(), { tauxEmprunt: 0 })
    const avec = coutReel(achat(), { tauxEmprunt: 0, apport: 20000 })
    expect(poste(sansApport, 'credit').montant! - poste(avec, 'credit').montant!).toBe(
      Math.round(2000000 / 240)
    )
  })

  it('libelle les charges en copropriété et documente les hypothèses', () => {
    const c = coutReel(achat())
    expect(poste(c, 'charges').label).toBe('Charges de copropriété')
    expect(c.hypotheses.join(' ')).toContain('notaire')
    expect(c.hypotheses.join(' ')).toContain(`${TAUX_DEFAUT} % sur ${DUREE_DEFAUT_ANS} ans`)
  })

  it('garde énergie et assurance, et mesure l’écart avec la mensualité', () => {
    const c = coutReel(achat())
    expect(poste(c, 'energie').montant).toBe(coutEnergieMensuel(achat()))
    expect(poste(c, 'assurance').montant).toBe(coutAssuranceMensuel(achat()))
    const credit = poste(c, 'credit').montant!
    expect(c.total).toBe(credit + 15000 + coutEnergieMensuel(achat())! + coutAssuranceMensuel(achat()))
    expect(c.ecartPourcent).toBe(Math.round(((c.total - credit) / credit) * 100))
  })
})

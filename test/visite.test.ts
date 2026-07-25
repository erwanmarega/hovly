import { describe, it, expect } from 'vitest'
import type { Bien } from '../app/types'
import {
  CRITERES_VISITE,
  bilanVisite,
  creneauxRapides,
  depuisInputLocal,
  etatVisite,
  joursAvant,
  libelleVisite,
  normaliserChecklist,
  prochainesVisites,
  versInputLocal
} from '../app/composables/useVisite'

const MAINTENANT = new Date('2026-07-25T09:00:00')

function bien(over: Partial<Bien> = {}): Bien {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.pap.fr/annonces/1',
    site_source: 'pap',
    titre: 'T2 Cachan',
    prix: 100000,
    surface: 45,
    nb_pieces: 2,
    etage: null,
    charges: null,
    dpe: null,
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
    ...over
  }
}

describe('normaliserChecklist', () => {
  it('accepte null et rend une structure vide exploitable', () => {
    expect(normaliserChecklist(null)).toEqual({ notes: {}, questions: [] })
  })

  it('ignore des champs mal typés venus de la base', () => {
    expect(normaliserChecklist({ notes: undefined, questions: 'oui' } as never)).toEqual({
      notes: {},
      questions: []
    })
  })

  it('copie les valeurs sans partager la référence', () => {
    const source = { notes: { bruit: 'bon' as const }, questions: ['charges'] }
    const copie = normaliserChecklist(source)
    copie.notes.bruit = 'mauvais'
    copie.questions.push('travaux')
    expect(source.notes.bruit).toBe('bon')
    expect(source.questions).toEqual(['charges'])
  })
})

describe('bilanVisite', () => {
  it('ne note que les critères renseignés', () => {
    const b = bilanVisite({ notes: { bruit: 'bon', humidite: 'mauvais' }, questions: [] })
    expect(b.remplis).toBe(2)
    expect(b.total).toBe(CRITERES_VISITE.length)
    expect(b.note).toBe(50)
  })

  it('compte un « moyen » pour une demi-note', () => {
    expect(bilanVisite({ notes: { bruit: 'moyen' } }).note).toBe(50)
  })

  it('renvoie une note nulle quand rien n’est jugé', () => {
    expect(bilanVisite(null).note).toBeNull()
  })

  it('liste les points noirs', () => {
    const b = bilanVisite({ notes: { humidite: 'mauvais', bruit: 'mauvais' } })
    expect(b.mauvais).toEqual(['Bruit', 'Humidité'])
  })

  it('ignore un critère inconnu resté en base', () => {
    expect(bilanVisite({ notes: { ascenseur: 'bon' } as never }).remplis).toBe(0)
  })
})

describe('etatVisite', () => {
  it('distingue à venir, aujourd’hui et passée', () => {
    expect(etatVisite(bien(), MAINTENANT)).toBe('aucune')
    expect(etatVisite(bien({ visite_le: '2026-07-28T18:00:00' }), MAINTENANT)).toBe('a_venir')
    expect(etatVisite(bien({ visite_le: '2026-07-25T18:00:00' }), MAINTENANT)).toBe('aujourdhui')
    expect(etatVisite(bien({ visite_le: '2026-07-24T18:00:00' }), MAINTENANT)).toBe('passee')
  })

  it('traite une date illisible comme absente', () => {
    expect(etatVisite(bien({ visite_le: 'bientôt' }), MAINTENANT)).toBe('aucune')
  })
})

describe('joursAvant et libelleVisite', () => {
  it('compte en jours calendaires, pas en tranches de 24 h', () => {
    // 23 h d'écart mais on change de jour : c'est bien « demain ».
    expect(joursAvant('2026-07-26T08:00:00', MAINTENANT)).toBe(1)
    expect(joursAvant('2026-07-25T23:00:00', MAINTENANT)).toBe(0)
  })

  it('nomme les repères proches', () => {
    expect(libelleVisite('2026-07-25T18:30:00', MAINTENANT)).toMatch(/^Aujourd’hui 18:30$/)
    expect(libelleVisite('2026-07-26T18:00:00', MAINTENANT)).toMatch(/^Demain 18:00$/)
    expect(libelleVisite('2026-07-24T18:00:00', MAINTENANT)).toMatch(/^Hier 18:00$/)
  })

  it('donne le jour de la semaine dans les 7 jours', () => {
    expect(libelleVisite('2026-07-29T10:00:00', MAINTENANT)).toBe('mercredi 10:00')
  })

  it('repasse à une date courte au-delà', () => {
    expect(libelleVisite('2026-09-02T10:00:00', MAINTENANT)).toContain('sept')
  })
})

describe('conversions input datetime-local', () => {
  it('fait l’aller-retour sans dériver', () => {
    const iso = new Date('2026-08-03T14:30:00').toISOString()
    expect(depuisInputLocal(versInputLocal(iso))).toBe(iso)
  })

  it('gère le vide et l’invalide', () => {
    expect(versInputLocal(null)).toBe('')
    expect(depuisInputLocal('')).toBeNull()
    expect(depuisInputLocal('jamais')).toBeNull()
  })
})

describe('creneauxRapides', () => {
  it('écarte les créneaux déjà passés dans la journée', () => {
    const soir = creneauxRapides(new Date('2026-07-25T20:00:00'))
    expect(soir.some((c) => c.label === 'Ce soir 18 h')).toBe(false)
    expect(soir.some((c) => c.label === 'Demain 18 h')).toBe(true)
  })

  it('vise toujours un samedi futur', () => {
    // 25/07/2026 est un samedi : le créneau doit pointer sur le suivant.
    const samedi = creneauxRapides(MAINTENANT).find((c) => c.label === 'Samedi 10 h')!
    const d = new Date(samedi.iso)
    expect(d.getDay()).toBe(6)
    expect(d.getTime()).toBeGreaterThan(MAINTENANT.getTime())
  })
})

describe('prochainesVisites', () => {
  it('trie par imminence et exclut passées, archivées et non planifiées', () => {
    const liste = [
      bien({ id: 'tard', visite_le: '2026-07-30T10:00:00' }),
      bien({ id: 'passee', visite_le: '2026-07-20T10:00:00' }),
      bien({ id: 'tot', visite_le: '2026-07-26T10:00:00' }),
      bien({ id: 'archive', visite_le: '2026-07-27T10:00:00', actif: false }),
      bien({ id: 'sans-date' })
    ]
    expect(prochainesVisites(liste, MAINTENANT).map((b) => b.id)).toEqual(['tot', 'tard'])
  })
})

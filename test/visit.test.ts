import { describe, it, expect } from 'vitest'
import type { Property } from '../app/types'
import {
  VISIT_CRITERIA,
  visitSummary,
  quickSlots,
  fromLocalInput,
  visitState,
  daysUntil,
  visitLabel,
  normalizeChecklist,
  upcomingVisits,
  toLocalInput
} from '../app/composables/useVisit'

const MAINTENANT = new Date('2026-07-25T09:00:00')

function bien(over: Partial<Property> = {}): Property {
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

describe('normalizeChecklist', () => {
  it('accepte null et rend une structure vide exploitable', () => {
    expect(normalizeChecklist(null)).toEqual({ notes: {}, questions: [] })
  })

  it('ignore des champs mal typés venus de la base', () => {
    expect(normalizeChecklist({ notes: undefined, questions: 'oui' } as never)).toEqual({
      notes: {},
      questions: []
    })
  })

  it('copie les valeurs sans partager la référence', () => {
    const source = { notes: { bruit: 'bon' as const }, questions: ['charges'] }
    const copie = normalizeChecklist(source)
    copie.notes.bruit = 'mauvais'
    copie.questions.push('travaux')
    expect(source.notes.bruit).toBe('bon')
    expect(source.questions).toEqual(['charges'])
  })
})

describe('visitSummary', () => {
  it('ne note que les critères renseignés', () => {
    const b = visitSummary({ notes: { bruit: 'bon', humidite: 'mauvais' }, questions: [] })
    expect(b.remplis).toBe(2)
    expect(b.total).toBe(VISIT_CRITERIA.length)
    expect(b.note).toBe(50)
  })

  it('compte un « moyen » pour une demi-note', () => {
    expect(visitSummary({ notes: { bruit: 'moyen' } }).note).toBe(50)
  })

  it('renvoie une note nulle quand rien n’est jugé', () => {
    expect(visitSummary(null).note).toBeNull()
  })

  it('liste les points noirs', () => {
    const b = visitSummary({ notes: { humidite: 'mauvais', bruit: 'mauvais' } })
    expect(b.mauvais).toEqual(['Bruit', 'Humidité'])
  })

  it('ignore un critère inconnu resté en base', () => {
    expect(visitSummary({ notes: { ascenseur: 'bon' } as never }).remplis).toBe(0)
  })
})

describe('visitState', () => {
  it('distingue à venir, aujourd’hui et passée', () => {
    expect(visitState(bien(), MAINTENANT)).toBe('aucune')
    expect(visitState(bien({ visite_le: '2026-07-28T18:00:00' }), MAINTENANT)).toBe('a_venir')
    expect(visitState(bien({ visite_le: '2026-07-25T18:00:00' }), MAINTENANT)).toBe('aujourdhui')
    expect(visitState(bien({ visite_le: '2026-07-24T18:00:00' }), MAINTENANT)).toBe('passee')
  })

  it('traite une date illisible comme absente', () => {
    expect(visitState(bien({ visite_le: 'bientôt' }), MAINTENANT)).toBe('aucune')
  })
})

describe('daysUntil et visitLabel', () => {
  it('compte en jours calendaires, pas en tranches de 24 h', () => {
    expect(daysUntil('2026-07-26T08:00:00', MAINTENANT)).toBe(1)
    expect(daysUntil('2026-07-25T23:00:00', MAINTENANT)).toBe(0)
  })

  it('nomme les repères proches', () => {
    expect(visitLabel('2026-07-25T18:30:00', MAINTENANT)).toMatch(/^Aujourd’hui 18:30$/)
    expect(visitLabel('2026-07-26T18:00:00', MAINTENANT)).toMatch(/^Demain 18:00$/)
    expect(visitLabel('2026-07-24T18:00:00', MAINTENANT)).toMatch(/^Hier 18:00$/)
  })

  it('donne le jour de la semaine dans les 7 jours', () => {
    expect(visitLabel('2026-07-29T10:00:00', MAINTENANT)).toBe('mercredi 10:00')
  })

  it('repasse à une date courte au-delà', () => {
    expect(visitLabel('2026-09-02T10:00:00', MAINTENANT)).toContain('sept')
  })
})

describe('conversions input datetime-local', () => {
  it('fait l’aller-retour sans dériver', () => {
    const iso = new Date('2026-08-03T14:30:00').toISOString()
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  })

  it('gère le vide et l’invalide', () => {
    expect(toLocalInput(null)).toBe('')
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('jamais')).toBeNull()
  })
})

describe('quickSlots', () => {
  it('écarte les créneaux déjà passés dans la journée', () => {
    const soir = quickSlots(new Date('2026-07-25T20:00:00'))
    expect(soir.some((c) => c.label === 'Ce soir 18 h')).toBe(false)
    expect(soir.some((c) => c.label === 'Demain 18 h')).toBe(true)
  })

  it('vise toujours un samedi futur', () => {
    const samedi = quickSlots(MAINTENANT).find((c) => c.label === 'Samedi 10 h')!
    const d = new Date(samedi.iso)
    expect(d.getDay()).toBe(6)
    expect(d.getTime()).toBeGreaterThan(MAINTENANT.getTime())
  })
})

describe('upcomingVisits', () => {
  it('trie par imminence et exclut passées, archivées et non planifiées', () => {
    const liste = [
      bien({ id: 'tard', visite_le: '2026-07-30T10:00:00' }),
      bien({ id: 'passee', visite_le: '2026-07-20T10:00:00' }),
      bien({ id: 'tot', visite_le: '2026-07-26T10:00:00' }),
      bien({ id: 'archive', visite_le: '2026-07-27T10:00:00', actif: false }),
      bien({ id: 'sans-date' })
    ]
    expect(upcomingVisits(liste, MAINTENANT).map((b) => b.id)).toEqual(['tot', 'tard'])
  })
})

import { describe, it, expect } from 'vitest'
import type { Ancre, Trajet } from '../app/types'
import {
  cleTrajet,
  formatDistance,
  formatDuree,
  indexer,
  nbDepassements,
  trajetLePlusLong,
  trajetPourAncre,
  trajetRetenu,
  trajetsDuBien
} from '../app/composables/useTrajets'
import {
  dureeDepuisItineraires,
  paquets,
  prochainMardi8h30
} from '../server/utils/routage'

function ancre(over: Partial<Ancre> = {}): Ancre {
  return {
    id: 'boulot',
    label: 'Boulot',
    adresse: '12 rue de Rivoli, Paris',
    lat: 48.85,
    lon: 2.35,
    mode: 'voiture',
    maxMinutes: null,
    ...over
  }
}

function trajet(over: Partial<Trajet> = {}): Trajet {
  return {
    id: 't1',
    bien_id: 'b1',
    ancre: 'boulot',
    mode: 'voiture',
    ancre_lat: 48.85,
    ancre_lon: 2.35,
    duree_s: 900,
    distance_m: 6200,
    calcule_le: '2026-07-25T09:00:00.000Z',
    ...over
  }
}

describe('formatDuree', () => {
  it('reste en minutes sous une heure', () => {
    expect(formatDuree(480)).toBe('8 min')
    expect(formatDuree(0)).toBe('0 min')
  })

  it('passe en heures au-delà, minutes sur deux chiffres', () => {
    expect(formatDuree(3900)).toBe('1 h 05')
    expect(formatDuree(7200)).toBe('2 h 00')
  })

  it('affiche un tiret quand rien n’est calculé', () => {
    expect(formatDuree(null)).toBe('—')
  })
})

describe('formatDistance', () => {
  it('passe des mètres aux kilomètres', () => {
    expect(formatDistance(650)).toBe('650 m')
    expect(formatDistance(6200)).toBe('6,2 km')
    expect(formatDistance(null)).toBe('—')
  })
})

describe('trajetsDuBien', () => {
  const ancres = [ancre(), ancre({ id: 'ecole', label: 'École', mode: 'marche', maxMinutes: 15 })]

  it('rend une entrée par ancre, dans l’ordre des préférences', () => {
    const index = indexer([trajet()])
    const liste = trajetsDuBien('b1', ancres, index)

    expect(liste.map((t) => t.ancre.id)).toEqual(['boulot', 'ecole'])
    expect(liste[0]!.calcule).toBe(true)
    expect(liste[0]!.duree_s).toBe(900)
    expect(liste[1]!.calcule).toBe(false)
    expect(liste[1]!.duree_s).toBeNull()
  })

  it('ne rattache pas un trajet calculé pour un autre mode', () => {
    const index = indexer([trajet({ ancre: 'ecole', mode: 'velo' })])
    expect(trajetsDuBien('b1', ancres, index)[1]!.calcule).toBe(false)
  })

  it('signale le dépassement de la durée maximale', () => {
    const court = indexer([trajet({ ancre: 'ecole', mode: 'marche', duree_s: 600 })])
    const long = indexer([trajet({ ancre: 'ecole', mode: 'marche', duree_s: 1200 })])

    expect(trajetsDuBien('b1', ancres, court)[1]!.depasse).toBe(false)
    expect(trajetsDuBien('b1', ancres, long)[1]!.depasse).toBe(true)
  })

  it('ne dépasse jamais quand aucune limite n’est fixée', () => {
    const index = indexer([trajet({ duree_s: 99999 })])
    expect(trajetsDuBien('b1', ancres, index)[0]!.depasse).toBe(false)
  })
})

describe('trajetLePlusLong', () => {
  const ancres = [ancre(), ancre({ id: 'gare', label: 'Gare', mode: 'velo' })]

  it('retient le trajet le plus long', () => {
    const index = indexer([
      trajet({ duree_s: 900 }),
      trajet({ id: 't2', ancre: 'gare', mode: 'velo', duree_s: 1500 })
    ])
    expect(trajetLePlusLong(trajetsDuBien('b1', ancres, index))?.ancre.id).toBe('gare')
  })

  it('ignore les trajets non calculés', () => {
    const index = indexer([trajet({ duree_s: 900 })])
    expect(trajetLePlusLong(trajetsDuBien('b1', ancres, index))?.ancre.id).toBe('boulot')
  })

  it('rend null quand rien n’est calculé', () => {
    expect(trajetLePlusLong(trajetsDuBien('b1', ancres, new Map()))).toBeNull()
  })
})

describe('trajetPourAncre', () => {
  const ancres = [ancre(), ancre({ id: 'gare', label: 'Gare', mode: 'transport' })]

  it('rend le trajet de l’ancre demandée, pas le plus long', () => {
    const index = indexer([
      trajet({ duree_s: 900 }),
      trajet({ id: 't2', ancre: 'gare', mode: 'transport', duree_s: 2400 })
    ])
    const liste = trajetsDuBien('b1', ancres, index)

    expect(trajetPourAncre(liste, 'boulot')?.duree_s).toBe(900)
    expect(trajetPourAncre(liste, 'gare')?.duree_s).toBe(2400)
  })

  it('rend null quand l’ancre n’est pas calculée ou n’existe pas', () => {
    const liste = trajetsDuBien('b1', ancres, indexer([trajet({ duree_s: 900 })]))

    expect(trajetPourAncre(liste, 'gare')).toBeNull()
    expect(trajetPourAncre(liste, 'inconnue')).toBeNull()
  })
})

describe('trajetRetenu', () => {
  const ancres = [ancre(), ancre({ id: 'gare', label: 'Gare', mode: 'transport' })]
  const index = indexer([
    trajet({ duree_s: 900 }),
    trajet({ id: 't2', ancre: 'gare', mode: 'transport', duree_s: 2400 })
  ])
  const liste = trajetsDuBien('b1', ancres, index)

  it('retombe sur le plus long sans ancre choisie', () => {
    expect(trajetRetenu(liste, null)?.ancre.id).toBe('gare')
  })

  it('respecte l’ancre choisie même si elle n’est pas la plus longue', () => {
    expect(trajetRetenu(liste, 'boulot')?.ancre.id).toBe('boulot')
  })

  it('rend null plutôt que de retomber sur une autre ancre', () => {
    const partiel = trajetsDuBien('b1', ancres, indexer([trajet({ duree_s: 900 })]))
    expect(trajetRetenu(partiel, 'gare')).toBeNull()
  })
})

describe('nbDepassements', () => {
  it('compte les ancres hors limite', () => {
    const ancres = [
      ancre({ maxMinutes: 10 }),
      ancre({ id: 'gare', mode: 'velo', maxMinutes: 30 })
    ]
    const index = indexer([
      trajet({ duree_s: 900 }),
      trajet({ id: 't2', ancre: 'gare', mode: 'velo', duree_s: 600 })
    ])
    expect(nbDepassements(trajetsDuBien('b1', ancres, index))).toBe(1)
  })
})

describe('cleTrajet', () => {
  it('distingue bien, ancre et mode', () => {
    expect(cleTrajet('b1', 'boulot', 'velo')).not.toBe(cleTrajet('b1', 'boulot', 'marche'))
    expect(cleTrajet('b1', 'boulot', 'velo')).not.toBe(cleTrajet('b2', 'boulot', 'velo'))
  })
})

describe('paquets', () => {
  it('découpe pour ne pas dépasser la limite de l’API', () => {
    expect(paquets([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('rend une liste vide telle quelle', () => {
    expect(paquets([], 40)).toEqual([])
  })
})

describe('dureeDepuisItineraires', () => {
  const metro = [{ mode: 'WALK' }, { mode: 'SUBWAY' }, { mode: 'WALK' }]

  it('retient le trajet le plus court', () => {
    expect(
      dureeDepuisItineraires({
        itineraries: [
          { duration: 2400, legs: metro },
          { duration: 1800, legs: metro }
        ]
      })
    ).toBe(1800)
  })

  it('écarte un itinéraire sans aucun transport en commun', () => {
    expect(
      dureeDepuisItineraires({
        itineraries: [
          { duration: 5400, legs: [{ mode: 'WALK' }] },
          { duration: 1500, legs: metro }
        ]
      })
    ).toBe(1500)
  })

  it('accepte une durée sans détail des tronçons', () => {
    expect(dureeDepuisItineraires({ itineraries: [{ duration: 1200 }] })).toBe(1200)
  })

  it('rend null quand aucune solution n’est exploitable', () => {
    expect(dureeDepuisItineraires({})).toBeNull()
    expect(dureeDepuisItineraires({ itineraries: [] })).toBeNull()
    expect(dureeDepuisItineraires({ itineraries: [{ duration: 0, legs: metro }] })).toBeNull()
    expect(
      dureeDepuisItineraires({ itineraries: [{ duration: 900, legs: [{ mode: 'BIKE' }] }] })
    ).toBeNull()
  })
})

describe('prochainMardi8h30', () => {
  it('vise toujours un mardi 8 h 30 à venir, heure de Paris', () => {
    expect(prochainMardi8h30(new Date('2026-07-25T09:00:00Z'))).toBe('2026-07-28T08:30:00+02:00')
  })

  it('saute au mardi suivant si on est déjà mardi', () => {
    expect(prochainMardi8h30(new Date('2026-07-28T07:00:00Z'))).toBe('2026-08-04T08:30:00+02:00')
  })

  it('suit l’heure d’hiver', () => {
    expect(prochainMardi8h30(new Date('2026-01-15T09:00:00Z'))).toBe('2026-01-20T08:30:00+01:00')
  })

  it('lit la date à Paris, pas en UTC', () => {
    expect(prochainMardi8h30(new Date('2026-07-27T23:30:00Z'))).toBe('2026-08-04T08:30:00+02:00')
  })
})

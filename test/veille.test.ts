import { describe, it, expect, vi } from 'vitest'
import type { Property, SavedSearch } from '../app/types'
import type { ListingAd } from '../server/utils/scrape/listing'

const scrapeListing = vi.fn()

vi.mock('../server/utils/scrape/listing', () => ({
  scrapeListing: (...a: any[]) => scrapeListing(...a)
}))
vi.mock('../server/utils/email', () => ({ sendWatchEmail: vi.fn() }))
vi.mock('../server/utils/push', () => ({ sendPush: vi.fn(), pushAvailable: () => false }))

const {
  matches,
  isKnown,
  needsCheck,
  nextCheck,
  watchFields,
  checkSearch,
  purgeProcessedResults
} = await import('../server/utils/veille')

function recherche(over: Partial<SavedSearch> = {}): SavedSearch {
  return {
    id: 'r1',
    user_id: 'u1',
    label: 'Paris 11e',
    url: 'https://www.seloger.com/list.htm?ci=750111',
    site_source: 'seloger',
    active: true,
    prix_max: null,
    prix_min: null,
    surface_min: null,
    pieces_min: null,
    frequence_min: 60,
    derniere_verif: null,
    derniere_erreur: null,
    echecs_consecutifs: 0,
    created_at: '2026-07-01T10:00:00.000Z',
    ...over
  }
}

function annonce(over: Partial<ListingAd> = {}): ListingAd {
  return {
    url: 'https://www.seloger.com/annonces/locations/appartement/paris/x/123456789.htm',
    titre: 'T2 refait à neuf',
    prix: 110000,
    surface: 42,
    nb_pieces: 2,
    photo: null,
    ville: 'Paris',
    code_postal: '75011',
    ...over
  }
}

function bien(over: Partial<Property> = {}): Property {
  return {
    id: 'b1',
    user_id: 'u1',
    url_source: 'https://www.pap.fr/annonces/t2-paris-r123456789',
    site_source: 'pap',
    titre: 'T2 refait à neuf',
    prix: 110000,
    surface: 42,
    nb_pieces: 2,
    ville: 'Paris',
    code_postal: '75011',
    created_at: '2026-07-01T10:00:00.000Z',
    ...over
  } as Property
}

describe('matches', () => {
  it('accepte une annonce dans les clous', () => {
    expect(matches(annonce(), recherche({ prix_max: 120000, surface_min: 40 }))).toBe(true)
  })

  it('écarte au-dessus du loyer max et sous la surface min', () => {
    expect(matches(annonce(), recherche({ prix_max: 100000 }))).toBe(false)
    expect(matches(annonce(), recherche({ surface_min: 50 }))).toBe(false)
    expect(matches(annonce(), recherche({ pieces_min: 3 }))).toBe(false)
    expect(matches(annonce(), recherche({ prix_min: 150000 }))).toBe(false)
  })

  it('laisse passer une carte illisible plutôt que de la perdre', () => {
    const inconnue = annonce({ prix: null, surface: null, nb_pieces: null })
    expect(matches(inconnue, recherche({ prix_max: 50000, surface_min: 200 }))).toBe(true)
  })
})

describe('isKnown', () => {
  it('reconnaît une URL déjà suivie', () => {
    const a = annonce()
    expect(isKnown(a, [bien({ url_source: a.url })], new Set())).toBe(true)
  })

  it('reconnaît une URL déjà remontée par une autre veille', () => {
    const a = annonce()
    expect(isKnown(a, [], new Set([a.url]))).toBe(true)
  })

  it('reconnaît le même logement rediffusé sur un autre site', () => {
    expect(isKnown(annonce(), [bien()], new Set())).toBe(true)
  })

  it('laisse passer un logement différent dans la même ville', () => {
    const autre = annonce({ prix: 250000, surface: 90, nb_pieces: 4, titre: 'Grand T4 terrasse' })
    expect(isKnown(autre, [bien()], new Set())).toBe(false)
  })

  it('ne compare pas une carte trop pauvre — elle passera pour nouvelle', () => {
    const pauvre = annonce({ prix: null, surface: null, ville: null, code_postal: null })
    expect(isKnown(pauvre, [bien()], new Set())).toBe(false)
  })
})

describe('planification', () => {
  const t0 = new Date('2026-07-26T12:00:00.000Z')

  it('scanne une veille jamais vérifiée', () => {
    expect(needsCheck(recherche(), t0)).toBe(true)
  })

  it('ignore une veille en pause', () => {
    expect(needsCheck(recherche({ active: false }), t0)).toBe(false)
  })

  it('attend la fréquence choisie', () => {
    const r = recherche({ frequence_min: 60, derniere_verif: '2026-07-26T11:30:00.000Z' })
    expect(needsCheck(r, t0)).toBe(false)
    expect(needsCheck({ ...r, derniere_verif: '2026-07-26T10:59:00.000Z' }, t0)).toBe(true)
  })

  it('relève le plancher de fréquence', () => {
    expect(nextCheck(recherche({ frequence_min: 5 }))).toBe(30)
  })

  it('espace les scans après des échecs, avec un plafond', () => {
    expect(nextCheck(recherche({ echecs_consecutifs: 2 }))).toBe(240)
    expect(nextCheck(recherche({ echecs_consecutifs: 99 }))).toBe(
      nextCheck(recherche({ echecs_consecutifs: 4 }))
    )
  })
})

describe('watchFields', () => {
  it('assainit les nombres et borne la fréquence', () => {
    expect(
      watchFields({ prix_max: '120000', surface_min: -5, pieces_min: 2.4, frequence_min: 1 })
    ).toEqual({ prix_max: 120000, surface_min: null, pieces_min: 2, frequence_min: 30 })
  })

  it('ne laisse pas passer de champ non déclaré', () => {
    expect(watchFields({ user_id: 'autre', url: 'https://evil.example', active: true })).toEqual({
      active: true
    })
  })

  it('ne renvoie que les champs présents', () => {
    expect(watchFields({})).toEqual({})
  })
})

/** Client Supabase minimal : enregistre les écritures et rejoue des lectures figées. */
function clientFactice(options: { dejaVues?: string[]; inseres?: any[] } = {}) {
  const majRecherches: any[] = []
  let upserted: any[] = []

  const client = {
    majRecherches,
    upserted: () => upserted,
    from(table: string) {
      if (table === 'recherches') {
        return {
          update(patch: any) {
            majRecherches.push(patch)
            return { eq: () => Promise.resolve({ error: null }) }
          }
        }
      }
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({ data: (options.dejaVues ?? []).map((url) => ({ url })), error: null })
        }),
        upsert(rows: any[]) {
          upserted = rows
          return {
            select: () =>
              Promise.resolve({
                data: options.inseres ?? rows.map((r, i) => ({ id: `res${i}`, ...r })),
                error: null
              })
          }
        }
      }
    }
  }
  return client
}

describe('checkSearch', () => {
  const t0 = new Date('2026-07-26T12:00:00.000Z')

  it('n’enregistre que les annonces neuves et dans les filtres', async () => {
    const neuve = annonce({ url: 'https://www.seloger.com/annonces/x/y/111111111.htm' })
    const chere = annonce({ url: 'https://www.seloger.com/annonces/x/y/222222222.htm', prix: 300000 })
    const connue = annonce({ url: 'https://www.seloger.com/annonces/x/y/333333333.htm' })

    scrapeListing.mockResolvedValue({ source: 'seloger', ads: [neuve, chere, connue] })
    const client = clientFactice({ dejaVues: [connue.url] })

    const resume = await checkSearch(
      client as any,
      recherche({ prix_max: 150000 }),
      [],
      t0
    )

    expect(resume.trouvees).toBe(3)
    expect(resume.filtrees).toBe(1)
    expect(resume.connues).toBe(1)
    expect(client.upserted()).toHaveLength(1)
    expect(client.upserted()[0].url).toBe(neuve.url)
    expect(resume.nouvelles).toHaveLength(1)
  })

  it('remet le compteur d’échecs à zéro après un scan réussi', async () => {
    scrapeListing.mockResolvedValue({ source: 'seloger', ads: [annonce()] })
    const client = clientFactice()

    await checkSearch(client as any, recherche({ echecs_consecutifs: 3 }), [], t0)

    expect(client.majRecherches.at(-1)).toMatchObject({
      echecs_consecutifs: 0,
      derniere_erreur: null,
      derniere_verif: t0.toISOString()
    })
  })

  // `createError` met le texte lisible dans `message` ; `statusMessage` n'est
  // plus qu'un code court, et h3 le sanitisera à terme.
  it('compte l’échec et laisse la veille active tant que le plafond n’est pas atteint', async () => {
    scrapeListing.mockImplementation(() => {
      throw Object.assign(new Error('Page de résultats bloquée par un anti-bot.'), {
        statusMessage: 'Anti-bot'
      })
    })
    const client = clientFactice()

    const resume = await checkSearch(
      client as any,
      recherche({ echecs_consecutifs: 2 }),
      [],
      t0
    )

    expect(resume.erreur).toBe('Page de résultats bloquée par un anti-bot.')
    expect(resume.nouvelles).toEqual([])
    expect(client.majRecherches[0]).toMatchObject({ echecs_consecutifs: 3, active: true })
  })

  it('met la veille en pause après trop d’échecs d’affilée', async () => {
    scrapeListing.mockImplementation(() => {
      throw new Error('URL morte')
    })
    const client = clientFactice()

    await checkSearch(client as any, recherche({ echecs_consecutifs: 7 }), [], t0)

    expect(client.majRecherches[0]).toMatchObject({ echecs_consecutifs: 8, active: false })
  })
  it('retombe sur statusMessage quand l’erreur n’a pas de message', async () => {
    scrapeListing.mockImplementation(() => {
      throw { statusMessage: 'Anti-bot' }
    })

    const resume = await checkSearch(clientFactice() as any, recherche(), [], t0)
    expect(resume.erreur).toBe('Anti-bot')
  })
})

describe('purgeProcessedResults', () => {
  function clientPurge(reponse: { data: any; error: any }) {
    return {
      from: () => ({
        delete: () => ({
          in: () => ({
            lt: () => ({
              select: () => Promise.resolve(reponse)
            })
          })
        })
      })
    }
  }

  it('retourne le nombre de résultats supprimés', async () => {
    const client = clientPurge({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    expect(await purgeProcessedResults(client as any)).toBe(2)
  })

  it('retourne 0 en cas d’erreur', async () => {
    const client = clientPurge({ data: null, error: { message: 'boom' } })
    expect(await purgeProcessedResults(client as any)).toBe(0)
  })
})

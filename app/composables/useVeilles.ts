import type { Bien, EtatResultat, Recherche, ResultatVeille } from '~/types'

export interface ResumeScan {
  recherche_id: string
  label: string
  trouvees: number
  filtrees: number
  connues: number
  nouvelles: ResultatVeille[]
  erreur: string | null
}

/** Le champ `prix` d'un bien est en centimes ; les filtres d'une veille suivent la même unité. */
export const enCentimes = (euros: number | null) =>
  euros == null || !Number.isFinite(euros) ? null : Math.round(euros * 100)

export const enEuros = (centimes: number | null) =>
  centimes == null ? null : Math.round(centimes / 100)

export function useVeilles() {
  const recherches = useState<Recherche[]>('recherches', () => [])
  const resultats = useState<Record<string, ResultatVeille[]>>('veille-resultats', () => ({}))

  const nouveaux = computed(() =>
    recherches.value.reduce((total, r) => total + (r.nouveaux ?? 0), 0)
  )

  function majCompteur(rechercheId: string, delta: number) {
    const r = recherches.value.find((x) => x.id === rechercheId)
    if (r) r.nouveaux = Math.max(0, (r.nouveaux ?? 0) + delta)
  }

  async function refresh() {
    recherches.value = await $fetch<Recherche[]>('/api/recherches')
    return recherches.value
  }

  async function creer(payload: Partial<Recherche>): Promise<Recherche> {
    const row = await $fetch<Recherche>('/api/recherches', { method: 'POST', body: payload })
    recherches.value = [{ ...row, nouveaux: 0 }, ...recherches.value]
    return row
  }

  async function modifier(id: string, patch: Partial<Recherche>) {
    const r = recherches.value.find((x) => x.id === id)
    const avant = r ? { ...r } : null
    if (r) Object.assign(r, patch)
    try {
      await $fetch(`/api/recherches/${id}`, { method: 'PATCH', body: patch })
    } catch (e) {
      if (r && avant) Object.assign(r, avant)
      throw e
    }
  }

  async function supprimer(id: string) {
    const snapshot = recherches.value
    recherches.value = recherches.value.filter((x) => x.id !== id)
    try {
      await $fetch(`/api/recherches/${id}`, { method: 'DELETE' })
      const { [id]: _supprime, ...reste } = resultats.value
      resultats.value = reste
    } catch (e) {
      recherches.value = snapshot
      throw e
    }
  }

  async function scanner(id: string): Promise<ResumeScan> {
    const resume = await $fetch<ResumeScan>(`/api/recherches/${id}/scan`, { method: 'POST' })

    const r = recherches.value.find((x) => x.id === id)
    if (r) {
      r.derniere_verif = new Date().toISOString()
      r.derniere_erreur = null
      r.echecs_consecutifs = 0
      r.nouveaux = (r.nouveaux ?? 0) + resume.nouvelles.length
    }
    if (resume.nouvelles.length) {
      resultats.value[id] = [...resume.nouvelles, ...(resultats.value[id] ?? [])]
    }
    return resume
  }

  async function chargerResultats(id: string, etat?: EtatResultat) {
    const liste = await $fetch<ResultatVeille[]>(`/api/recherches/${id}/resultats`, {
      query: etat ? { etat } : undefined
    })
    resultats.value[id] = liste
    return liste
  }

  function retirer(rechercheId: string, resultatId: string) {
    const liste = resultats.value[rechercheId]
    if (liste) resultats.value[rechercheId] = liste.filter((r) => r.id !== resultatId)
  }

  async function ignorer(rechercheId: string, resultatId: string) {
    await $fetch(`/api/resultats/${resultatId}`, { method: 'PATCH', body: { etat: 'ignore' } })
    retirer(rechercheId, resultatId)
    majCompteur(rechercheId, -1)
  }

  /** Scrape la fiche complète et crée le bien. Plus lent qu'« ignorer » : prévoir un état de chargement. */
  async function garder(rechercheId: string, resultatId: string): Promise<Bien> {
    const { bien } = await $fetch<{ bien: Bien }>(`/api/resultats/${resultatId}`, {
      method: 'PATCH',
      body: { etat: 'garde' }
    })
    retirer(rechercheId, resultatId)
    majCompteur(rechercheId, -1)
    return bien
  }

  return {
    recherches,
    resultats,
    nouveaux,
    refresh,
    creer,
    modifier,
    supprimer,
    scanner,
    chargerResultats,
    garder,
    ignorer
  }
}

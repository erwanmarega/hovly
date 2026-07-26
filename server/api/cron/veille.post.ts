import type { Bien, Recherche } from '~/types'
import { serverSupabaseServiceRole } from '#supabase/server'
import { aVerifier, notifierVeille, verifierRecherche } from '../../utils/veille'

/** Plafond par exécution : un cron ne doit pas partir en scan de plusieurs heures. */
const MAX_RECHERCHES_PAR_RUN = 25

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  const auth = getHeader(event, 'authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Non autorisé' })
  }

  const service = serverSupabaseServiceRole(event)

  const { data: recherches, error } = await service
    .from('recherches')
    .select('*')
    .eq('active', true)
    .order('derniere_verif', { ascending: true, nullsFirst: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  const maintenant = new Date()
  const dues = ((recherches ?? []) as Recherche[])
    .filter((r) => aVerifier(r, maintenant))
    .slice(0, MAX_RECHERCHES_PAR_RUN)

  // Les biens déjà suivis servent à écarter les annonces multi-diffusées :
  // une lecture par utilisateur, pas une par veille.
  const biensParUser = new Map<string, Bien[]>()
  async function biensDe(userId: string): Promise<Bien[]> {
    const cache = biensParUser.get(userId)
    if (cache) return cache

    const { data } = await service.from('biens').select('*').eq('user_id', userId)
    const liste = (data ?? []) as Bien[]
    biensParUser.set(userId, liste)
    return liste
  }

  const emails = new Map<string, string | null>()
  async function emailDe(userId: string): Promise<string | null> {
    if (emails.has(userId)) return emails.get(userId)!

    const { data } = await service.auth.admin.getUserById(userId)
    const adresse = data?.user?.email ?? null
    emails.set(userId, adresse)
    return adresse
  }

  let nouvelles = 0
  let erreurs = 0
  let envoyes = 0
  let echecs = 0

  for (const recherche of dues) {
    const resume = await verifierRecherche(
      service,
      recherche,
      await biensDe(recherche.user_id),
      maintenant
    )

    if (resume.erreur) {
      erreurs++
      continue
    }
    if (!resume.nouvelles.length) continue

    nouvelles += resume.nouvelles.length
    const envois = await notifierVeille(
      service,
      recherche.user_id,
      await emailDe(recherche.user_id),
      resume
    )
    envoyes += envois.envoyes
    echecs += envois.echecs
  }

  return {
    ok: true,
    actives: recherches?.length ?? 0,
    scannees: dues.length,
    nouvelles,
    erreurs,
    notifications: { envoyes, echecs }
  }
})

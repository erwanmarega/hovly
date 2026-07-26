import type { Bien, Recherche, ResultatVeille } from '~/types'
import type { ResumeEnvois } from '~/types/check'
import { similarite, SEUIL_DOUBLON } from '~/composables/useDoublons'
import { scrapeListe, type AnnonceListe } from './scrape/liste'
import { detecterSource } from './scrape/source'
import { envoyerVeilleEmail } from './email'
import { envoyerPush, pushDisponible } from './push'

export interface ResumeVeille {
  recherche_id: string
  label: string
  trouvees: number
  filtrees: number
  connues: number
  nouvelles: ResultatVeille[]
  erreur: string | null
}

export const FREQUENCE_MIN_PLANCHER = 30
export const MAX_ECHECS_BACKOFF = 4
/** Une veille désactivée d'office après trop d'échecs d'affilée (site qui a changé, URL morte). */
export const MAX_ECHECS_AVANT_PAUSE = 8

const entierPositif = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** Champs d'une veille modifiables par le client, assainis. Ne touche jamais à l'URL ni au user_id. */
export function champsVeille(body: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const champ of ['prix_max', 'prix_min', 'surface_min', 'pieces_min'] as const) {
    if (champ in body) patch[champ] = entierPositif(body[champ])
  }
  if ('label' in body) {
    patch.label = String(body.label ?? '').trim().slice(0, 60) || 'Veille'
  }
  if ('active' in body) patch.active = body.active === true
  if ('frequence_min' in body) {
    patch.frequence_min = Math.max(
      entierPositif(body.frequence_min) ?? FREQUENCE_MIN_PLANCHER,
      FREQUENCE_MIN_PLANCHER
    )
  }

  return patch
}

/** Assez de signal pour comparer sérieusement une annonce à un bien déjà suivi. */
function assezDeSignal(a: AnnonceListe): boolean {
  return a.surface != null && a.prix != null && (a.ville != null || a.code_postal != null)
}

/**
 * Un filtre ne s'applique qu'aux annonces dont on a extrait la valeur : une carte
 * illisible passe et sera filtrée à la main plutôt que perdue silencieusement.
 */
export function correspond(a: AnnonceListe, r: Recherche): boolean {
  if (r.prix_max != null && a.prix != null && a.prix > r.prix_max) return false
  if (r.prix_min != null && a.prix != null && a.prix < r.prix_min) return false
  if (r.surface_min != null && a.surface != null && a.surface < r.surface_min) return false
  if (r.pieces_min != null && a.nb_pieces != null && a.nb_pieces < r.pieces_min) return false
  return true
}

function commeBien(a: AnnonceListe): Bien {
  return {
    id: `annonce:${a.url}`,
    url_source: a.url,
    titre: a.titre ?? '',
    prix: a.prix ?? 0,
    surface: a.surface ?? 0,
    nb_pieces: a.nb_pieces ?? 0,
    ville: a.ville ?? '',
    code_postal: a.code_postal ?? ''
  } as Bien
}

/**
 * Écarte ce que l'utilisateur suit déjà : même URL, ou même logement reposté
 * ailleurs (multi-diffusion agence), détecté par `similarite`.
 */
export function estConnu(a: AnnonceListe, biens: Bien[], urlsVues: Set<string>): boolean {
  if (urlsVues.has(a.url)) return true
  if (biens.some((b) => b.url_source === a.url)) return true
  if (!assezDeSignal(a)) return false

  const candidate = commeBien(a)
  return biens.some((b) => similarite(candidate, b).score >= SEUIL_DOUBLON)
}

/** Backoff exponentiel : un site qui répond mal n'est pas martelé toutes les heures. */
export function prochaineVerif(r: Recherche): number {
  const base = Math.max(r.frequence_min, FREQUENCE_MIN_PLANCHER)
  const facteur = 2 ** Math.min(r.echecs_consecutifs, MAX_ECHECS_BACKOFF)
  return base * facteur
}

export function aVerifier(r: Recherche, maintenant = new Date()): boolean {
  if (!r.active) return false
  if (!r.derniere_verif) return true

  const derniere = new Date(r.derniere_verif).getTime()
  if (Number.isNaN(derniere)) return true

  return maintenant.getTime() - derniere >= prochaineVerif(r) * 60 * 1000
}

function ligne(a: AnnonceListe, rechercheId: string) {
  return {
    recherche_id: rechercheId,
    url: a.url,
    titre: a.titre,
    prix: a.prix,
    surface: a.surface,
    nb_pieces: a.nb_pieces,
    photo: a.photo,
    ville: a.ville,
    code_postal: a.code_postal
  }
}

/**
 * Scanne une recherche et n'enregistre que ce qui est nouveau.
 * Le diff s'appuie sur `unique (recherche_id, url)` : l'insert ignore les
 * doublons et ne renvoie que les lignes réellement créées — pas de course
 * possible entre deux scans concurrents.
 */
export async function verifierRecherche(
  client: any,
  recherche: Recherche,
  biens: Bien[],
  maintenant = new Date()
): Promise<ResumeVeille> {
  const resume: ResumeVeille = {
    recherche_id: recherche.id,
    label: recherche.label,
    trouvees: 0,
    filtrees: 0,
    connues: 0,
    nouvelles: [],
    erreur: null
  }

  let annonces: AnnonceListe[]
  try {
    annonces = (await scrapeListe(recherche.url)).annonces
  } catch (e: any) {
    resume.erreur = e?.statusMessage || e?.message || 'erreur inconnue'
    const echecs = recherche.echecs_consecutifs + 1
    await client
      .from('recherches')
      .update({
        derniere_verif: maintenant.toISOString(),
        derniere_erreur: resume.erreur,
        echecs_consecutifs: echecs,
        active: echecs < MAX_ECHECS_AVANT_PAUSE
      })
      .eq('id', recherche.id)
    return resume
  }

  resume.trouvees = annonces.length

  const retenues = annonces.filter((a) => correspond(a, recherche))
  resume.filtrees = annonces.length - retenues.length

  // Une annonce déjà remontée par une autre veille du même utilisateur ne doit
  // pas notifier deux fois.
  const { data: dejaVues } = await client
    .from('recherche_resultats')
    .select('url, recherches!inner(user_id)')
    .eq('recherches.user_id', recherche.user_id)

  const urlsVues = new Set<string>((dejaVues ?? []).map((r: { url: string }) => r.url))

  const candidates = retenues.filter((a) => !estConnu(a, biens, urlsVues))
  resume.connues = retenues.length - candidates.length

  if (candidates.length) {
    const { data, error } = await client
      .from('recherche_resultats')
      .upsert(
        candidates.map((a) => ligne(a, recherche.id)),
        { onConflict: 'recherche_id,url', ignoreDuplicates: true }
      )
      .select()

    if (error) resume.erreur = error.message
    else resume.nouvelles = (data ?? []) as ResultatVeille[]
  }

  await client
    .from('recherches')
    .update({
      derniere_verif: maintenant.toISOString(),
      derniere_erreur: null,
      echecs_consecutifs: 0,
      site_source: recherche.site_source ?? detecterSource(recherche.url)
    })
    .eq('id', recherche.id)

  return resume
}

const eur = (centimes: number | null) =>
  centimes == null ? '' : Math.round(centimes / 100).toLocaleString('fr-FR') + ' €'

export function resumeCourt(r: ResultatVeille): string {
  return (
    [eur(r.prix), r.surface ? `${r.surface} m²` : '', r.nb_pieces ? `T${r.nb_pieces}` : '']
      .filter(Boolean)
      .join(' · ') ||
    r.titre ||
    'Nouvelle annonce'
  )
}

/** Une notification par veille, pas une par annonce — sinon c'est du spam. */
export async function notifierVeille(
  client: any,
  userId: string,
  email: string | null,
  resume: ResumeVeille
): Promise<ResumeEnvois> {
  const envois: ResumeEnvois = { envoyes: 0, echecs: 0, raisons: [] }
  if (!resume.nouvelles.length) return envois

  const n = resume.nouvelles.length

  if (pushDisponible()) {
    const push = await envoyerPush(client, userId, {
      titre: n === 1 ? `Nouveau bien — ${resume.label}` : `${n} nouveaux biens — ${resume.label}`,
      corps: resume.nouvelles.slice(0, 3).map(resumeCourt).join(' | '),
      url: `/veilles?recherche=${resume.recherche_id}`,
      tag: `veille-${resume.recherche_id}`
    }).catch((e: Error) => ({ envoyes: 0, echecs: 1, raisons: [e.message] }))

    envois.envoyes += push.envoyes
    envois.echecs += push.echecs
    for (const r of push.raisons) if (!envois.raisons.includes(r)) envois.raisons.push(r)
  }

  const mail = await envoyerVeilleEmail(email, resume.label, resume.nouvelles).catch(
    (e: Error) => ({ envoye: false, raison: e.message })
  )
  if (mail.envoye) envois.envoyes++
  else if (mail.raison && !envois.raisons.includes(mail.raison)) envois.raisons.push(mail.raison)

  return envois
}

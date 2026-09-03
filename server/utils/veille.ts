import type { Property, SavedSearch, WatchResult } from '~/types'
import type { SendSummary } from '~/types/check'
import { similarity, DUPLICATE_THRESHOLD } from '~/composables/useDuplicates'
import { scrapeListe, type AnnonceListe } from './scrape/liste'
import { detecterSource } from './scrape/source'
import { formatPrice } from './price'
import { sendWatchEmail } from './email'
import { sendPush, pushAvailable } from './push'

export interface WatchSummary {
  recherche_id: string
  label: string
  trouvees: number
  filtrees: number
  connues: number
  nouvelles: WatchResult[]
  erreur: string | null
}

export const MIN_FREQUENCY_FLOOR = 30
export const MAX_BACKOFF_FAILURES = 4
/** Une veille désactivée d'office après trop d'échecs d'affilée (site qui a changé, URL morte). */
export const MAX_FAILURES_BEFORE_PAUSE = 8
/** Un résultat traité (gardé ou ignoré) n'est plus jamais affiché : pas besoin de le garder en base indéfiniment. */
export const PURGE_RESULTS_DAYS = 30

const positiveInteger = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** Champs d'une veille modifiables par le client, assainis. Ne touche jamais à l'URL ni au user_id. */
export function watchFields(body: Record<string, any>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  for (const champ of ['prix_max', 'prix_min', 'surface_min', 'pieces_min'] as const) {
    if (champ in body) patch[champ] = positiveInteger(body[champ])
  }
  if ('label' in body) {
    patch.label = String(body.label ?? '').trim().slice(0, 60) || 'Veille'
  }
  if ('active' in body) patch.active = body.active === true
  if ('frequence_min' in body) {
    patch.frequence_min = Math.max(
      positiveInteger(body.frequence_min) ?? MIN_FREQUENCY_FLOOR,
      MIN_FREQUENCY_FLOOR
    )
  }

  return patch
}

/** Assez de signal pour comparer sérieusement une annonce à un bien déjà suivi. */
function hasEnoughSignal(a: AnnonceListe): boolean {
  return a.surface != null && a.prix != null && (a.ville != null || a.code_postal != null)
}

/**
 * Un filtre ne s'applique qu'aux annonces dont on a extrait la valeur : une carte
 * illisible passe et sera filtrée à la main plutôt que perdue silencieusement.
 */
export function matches(a: AnnonceListe, r: SavedSearch): boolean {
  if (r.prix_max != null && a.prix != null && a.prix > r.prix_max) return false
  if (r.prix_min != null && a.prix != null && a.prix < r.prix_min) return false
  if (r.surface_min != null && a.surface != null && a.surface < r.surface_min) return false
  if (r.pieces_min != null && a.nb_pieces != null && a.nb_pieces < r.pieces_min) return false
  return true
}

function asProperty(a: AnnonceListe): Property {
  return {
    id: `annonce:${a.url}`,
    url_source: a.url,
    titre: a.titre ?? '',
    prix: a.prix ?? 0,
    surface: a.surface ?? 0,
    nb_pieces: a.nb_pieces ?? 0,
    ville: a.ville ?? '',
    code_postal: a.code_postal ?? ''
  } as Property
}

/**
 * Écarte ce que l'utilisateur suit déjà : même URL, ou même logement reposté
 * ailleurs (multi-diffusion agence), détecté par `similarity`.
 */
export function isKnown(a: AnnonceListe, biens: Property[], urlsVues: Set<string>): boolean {
  if (urlsVues.has(a.url)) return true
  if (biens.some((b) => b.url_source === a.url)) return true
  if (!hasEnoughSignal(a)) return false

  const candidate = asProperty(a)
  return biens.some((b) => similarity(candidate, b).score >= DUPLICATE_THRESHOLD)
}

/** Backoff exponentiel : un site qui répond mal n'est pas martelé toutes les heures. */
export function nextCheck(r: SavedSearch): number {
  const base = Math.max(r.frequence_min, MIN_FREQUENCY_FLOOR)
  const facteur = 2 ** Math.min(r.echecs_consecutifs, MAX_BACKOFF_FAILURES)
  return base * facteur
}

export function needsCheck(r: SavedSearch, maintenant = new Date()): boolean {
  if (!r.active) return false
  if (!r.derniere_verif) return true

  const derniere = new Date(r.derniere_verif).getTime()
  if (Number.isNaN(derniere)) return true

  return maintenant.getTime() - derniere >= nextCheck(r) * 60 * 1000
}

function row(a: AnnonceListe, rechercheId: string) {
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
export async function checkSearch(
  client: any,
  recherche: SavedSearch,
  biens: Property[],
  maintenant = new Date()
): Promise<WatchSummary> {
  const summary: WatchSummary = {
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
    summary.erreur = e?.message || e?.statusMessage || 'erreur inconnue'
    const echecs = recherche.echecs_consecutifs + 1
    await client
      .from('recherches')
      .update({
        derniere_verif: maintenant.toISOString(),
        derniere_erreur: summary.erreur,
        echecs_consecutifs: echecs,
        active: echecs < MAX_FAILURES_BEFORE_PAUSE
      })
      .eq('id', recherche.id)
    return summary
  }

  summary.trouvees = annonces.length

  const retenues = annonces.filter((a) => matches(a, recherche))
  summary.filtrees = annonces.length - retenues.length

  // Une annonce déjà remontée par une autre veille du même utilisateur ne doit
  // pas notifier deux fois.
  const { data: dejaVues } = await client
    .from('recherche_resultats')
    .select('url, recherches!inner(user_id)')
    .eq('recherches.user_id', recherche.user_id)

  const urlsVues = new Set<string>((dejaVues ?? []).map((r: { url: string }) => r.url))

  const candidates = retenues.filter((a) => !isKnown(a, biens, urlsVues))
  summary.connues = retenues.length - candidates.length

  if (candidates.length) {
    const { data, error } = await client
      .from('recherche_resultats')
      .upsert(
        candidates.map((a) => row(a, recherche.id)),
        { onConflict: 'recherche_id,url', ignoreDuplicates: true }
      )
      .select()

    if (error) summary.erreur = error.message
    else summary.nouvelles = (data ?? []) as WatchResult[]
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

  return summary
}

/**
 * Supprime les résultats de veille traités (gardés ou ignorés) de plus de
 * `PURGE_RESULTS_DAYS` jours. Un résultat `garde` est de toute façon
 * dupliqué dans `biens` au moment de la conversion — rien n'est perdu.
 */
export async function purgeProcessedResults(client: any): Promise<number> {
  const seuil = new Date(Date.now() - PURGE_RESULTS_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('recherche_resultats')
    .delete()
    .in('etat', ['garde', 'ignore'])
    .lt('trouve_le', seuil)
    .select('id')

  if (error) return 0
  return data?.length ?? 0
}

export function shortSummary(r: WatchResult): string {
  return (
    [formatPrice(r.prix), r.surface ? `${r.surface} m²` : '', r.nb_pieces ? `T${r.nb_pieces}` : '']
      .filter(Boolean)
      .join(' · ') ||
    r.titre ||
    'Nouvelle annonce'
  )
}

/** Une notification par veille, pas une par annonce — sinon c'est du spam. */
export async function notifyWatch(
  client: any,
  userId: string,
  email: string | null,
  summary: WatchSummary
): Promise<SendSummary> {
  const emails: SendSummary = { sent: 0, failed: 0, reasons: [] }
  if (!summary.nouvelles.length) return emails

  const n = summary.nouvelles.length

  if (pushAvailable()) {
    const push = await sendPush(client, userId, {
      titre: n === 1 ? `Nouveau bien — ${summary.label}` : `${n} nouveaux biens — ${summary.label}`,
      corps: summary.nouvelles.slice(0, 3).map(shortSummary).join(' | '),
      url: `/veilles?recherche=${summary.recherche_id}`,
      tag: `veille-${summary.recherche_id}`
    }).catch((e: Error) => ({ sent: 0, failed: 1, reasons: [e.message] }))

    emails.sent += push.sent
    emails.failed += push.failed
    for (const r of push.reasons) if (!emails.reasons.includes(r)) emails.reasons.push(r)
  }

  const mail = await sendWatchEmail(email, summary.label, summary.nouvelles).catch(
    (e: Error) => ({ envoye: false, raison: e.message })
  )
  if (mail.envoye) emails.sent++
  else if (mail.raison && !emails.reasons.includes(mail.raison)) emails.reasons.push(mail.raison)

  return emails
}

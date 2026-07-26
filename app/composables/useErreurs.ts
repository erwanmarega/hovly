/**
 * Lecture des erreurs renvoyées par `$fetch`.
 *
 * Un `createError()` serveur transmet son texte dans le corps JSON de la réponse,
 * qu'ofetch expose sous `data`. `statusMessage` ne sert que de repli : il finit
 * dans la ligne de statut HTTP, qui doit rester ASCII, et h3 annonce qu'il le
 * sanitisera. On ne lit jamais `err.message` d'une erreur de fetch : il vaut
 * « [POST] "/api/scrape": 423 Anti-bot », inutilisable en interface.
 */
interface ErreurFetch {
  statusCode?: number
  statusMessage?: string
  data?: {
    statusCode?: number
    statusMessage?: string
    message?: string
    data?: Record<string, unknown>
  }
}

export function messageErreur(e: unknown, defaut: string): string {
  const err = e as ErreurFetch
  return err?.data?.message || err?.data?.statusMessage || err?.statusMessage || defaut
}

export function codeErreur(e: unknown): number | null {
  const err = e as ErreurFetch
  return err?.statusCode ?? err?.data?.statusCode ?? null
}

/** Charge utile posée par le serveur via `createError({ data })`. */
export function donneesErreur(e: unknown): Record<string, unknown> | null {
  return (e as ErreurFetch)?.data?.data ?? null
}

/**
 * Lecture des erreurs renvoyées par `$fetch`.
 *
 * Un `createError()` serveur transmet son texte dans le corps JSON de la réponse,
 * qu'ofetch expose sous `data`. `statusMessage` ne sert que de repli : il finit
 * dans la ligne de statut HTTP, qui doit rester ASCII, et h3 annonce qu'il le
 * sanitisera. On ne lit jamais `err.message` d'une erreur de fetch : il vaut
 * « [POST] "/api/scrape": 423 Anti-bot », inutilisable en interface.
 */
interface FetchError {
  statusCode?: number
  statusMessage?: string
  data?: {
    statusCode?: number
    statusMessage?: string
    message?: string
    data?: Record<string, unknown>
  }
}

export function errorMessage(e: unknown, fallback: string): string {
  const err = e as FetchError
  return err?.data?.message || err?.data?.statusMessage || err?.statusMessage || fallback
}

export function errorCode(e: unknown): number | null {
  const err = e as FetchError
  return err?.statusCode ?? err?.data?.statusCode ?? null
}

/** Charge utile posée par le serveur via `createError({ data })`. */
export function errorData(e: unknown): Record<string, unknown> | null {
  return (e as FetchError)?.data?.data ?? null
}

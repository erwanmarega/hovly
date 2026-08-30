import type { BienPartage, PartagePublic } from '~/types'
import { partageExpire, SELECT_PUBLIC_BIEN } from '../../utils/partages'

// Route publique : pas de requireUser. N'expose jamais `select('*')` sur
// `biens` ici — seuls les champs de `SELECT_PUBLIC_BIEN` sont utiles à un
// visiteur sans compte.

export default defineEventHandler(async (event): Promise<PartagePublic> => {
  const token = getRouterParam(event, 'token')
  const client = serviceDb(event)

  const { data: partage, error: lookupError } = await client
    .from('partages')
    .select('id, titre, cree_le, expire_le')
    .eq('token', token)
    .maybeSingle()

  if (lookupError) {
    console.error('[partages] lecture du token échouée', lookupError.message)
  }

  // Un token expiré renvoie la même erreur qu'un token inexistant : ne pas
  // donner à un attaquant qui bruteforce un signal sur l'existence passée.
  if (!partage || partageExpire(partage.expire_le)) {
    throw createError({ statusCode: 404, statusMessage: 'Lien introuvable' })
  }

  const { data: liens, error: linksError } = await client
    .from('partage_biens')
    .select(`biens (${SELECT_PUBLIC_BIEN})`)
    .eq('partage_id', partage.id)

  if (linksError) {
    console.error('[partages] lecture des biens échouée', linksError.message)
  }

  const biens = ((liens ?? []) as unknown as { biens: BienPartage | null }[])
    .map((l) => l.biens)
    .filter((b): b is BienPartage => b != null)

  return { titre: partage.titre, cree_le: partage.cree_le, biens }
})

import type { SharedProperty, PublicShare } from '~/types'
import { isShareExpired, PUBLIC_PROPERTY_SELECT } from '../../utils/partages'

// Route publique : pas de requireUser. N'expose jamais `select('*')` sur
// `biens` ici — seuls les champs de `PUBLIC_PROPERTY_SELECT` sont utiles à un
// visiteur sans compte.

export default defineEventHandler(async (event): Promise<PublicShare> => {
  // Le fichier utilise le param `id` (et non `token`) car Nitro fusionne les
  // routes d'un même segment de chemin : `[id].delete.ts` dans ce même dossier
  // impose le nom de param `id` pour tout `/api/partages/:param`, quelle que
  // soit la méthode HTTP du fichier qui le dessert.
  const token = getRouterParam(event, 'id')
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
  if (!partage || isShareExpired(partage.expire_le)) {
    throw createError({ statusCode: 404, statusMessage: 'Lien introuvable' })
  }

  const { data: links, error: linksError } = await client
    .from('partage_biens')
    .select(`biens (${PUBLIC_PROPERTY_SELECT})`)
    .eq('partage_id', partage.id)

  if (linksError) {
    console.error('[partages] lecture des biens échouée', linksError.message)
  }

  const biens = ((links ?? []) as unknown as { biens: SharedProperty | null }[])
    .map((l) => l.biens)
    .filter((b): b is SharedProperty => b != null)

  return { titre: partage.titre, cree_le: partage.cree_le, biens }
})

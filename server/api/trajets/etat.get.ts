import { routageDisponible } from '../../utils/routage'

/** Quels modes de trajet le serveur sait calculer (une clé par source). */
export default defineEventHandler(async (event) => {
  await requireUser(event)

  return {
    voiture: routageDisponible('voiture'),
    velo: routageDisponible('velo'),
    marche: routageDisponible('marche'),
    transport: routageDisponible('transport')
  }
})

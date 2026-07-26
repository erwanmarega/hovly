import { routageDisponible } from '../../utils/routage'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  return {
    voiture: routageDisponible('voiture'),
    velo: routageDisponible('velo'),
    marche: routageDisponible('marche'),
    transport: routageDisponible('transport')
  }
})

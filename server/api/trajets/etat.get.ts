import { routingAvailable } from '../../utils/routage'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  return {
    voiture: routingAvailable('voiture'),
    velo: routingAvailable('velo'),
    marche: routingAvailable('marche'),
    transport: routingAvailable('transport')
  }
})

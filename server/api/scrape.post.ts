import { scrapeUrl } from '../utils/scrape'
import { assertRateLimitForUser, QUOTAS } from '../utils/rate-limit'
import { assertTailleCorps, validerUrlSource } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.scrape, QUOTAS.scrapeHeure)
  assertTailleCorps(event)

  const { url } = await readBody(event)
  const urlValidee = validerUrlSource(url)

  try {
    const { data } = await scrapeUrl(urlValidee)
    return data
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({
      statusCode: 502,
      statusMessage: 'Scraping impossible',
      message: "Échec du scraping. L'annonce est peut-être protégée — saisis les infos manuellement."
    })
  }
})

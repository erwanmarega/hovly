import { scrapeUrl } from '../utils/scrape'
import { assertRateLimitForUser, QUOTAS } from '../utils/rate-limit'
import { assertBodySize, validateSourceUrl } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.scrape, QUOTAS.scrapePerHour)
  assertBodySize(event)

  const { url } = await readBody(event)
  const validatedUrl = validateSourceUrl(url)

  try {
    const { data } = await scrapeUrl(validatedUrl)
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

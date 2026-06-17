import { scrapeUrl } from '../utils/scrape'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { url } = await readBody(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'url requise' })
  }

  try {
    const { data } = await scrapeUrl(url)
    return data
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({
      statusCode: 502,
      statusMessage: "Échec du scraping. L'annonce est peut-être protégée — saisis les infos manuellement."
    })
  }
})

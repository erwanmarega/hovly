export interface ApiResult {
  html: string
  status: number
}

export function apiKey(): string | null {
  return (useRuntimeConfig().scrapingbeeKey as string) || process.env.SCRAPINGBEE_API_KEY || null
}

export async function scrapeViaApi(url: string): Promise<ApiResult> {
  const key = apiKey()
  if (!key) {
    throw createError({
      statusCode: 423,
      statusMessage:
        "Annonce protégée par un anti-bot. Configure SCRAPINGBEE_API_KEY ou saisis les infos manuellement."
    })
  }

  const res = await $fetch.raw('https://app.scrapingbee.com/api/v1/', {
    query: {
      api_key: key,
      url,
      render_js: 'true',
      stealth_proxy: 'true',
      country_code: 'fr',
      block_resources: 'false'
    },
    timeout: 75000,
    ignoreResponseError: true
  })

  const html = typeof res._data === 'string' ? res._data : String(res._data ?? '')
  return { html, status: res.status }
}

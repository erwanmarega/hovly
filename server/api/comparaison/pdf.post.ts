import type { Property } from '~/types'
import { compare, MAX_COMPARISON } from '~/composables/useComparator'
import { scoreProperty } from '~/composables/useScore'
import { representatives } from '~/composables/useDuplicates'
import { optionsFromPreferences } from '~/composables/useActualCost'
import { normalize } from '~/composables/usePreferences'
import { assertRateLimitForUser, QUOTAS } from '../../utils/rate-limit'
import { assertBodySize } from '../../utils/validation'
import { renderComparisonPdf } from '../../utils/comparaison-pdf'

function validIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || !id) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length > MAX_COMPARISON) break
  }
  return out
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  assertRateLimitForUser(event, user.id, QUOTAS.pdfExport, QUOTAS.pdfExportPerHour)
  assertBodySize(event)

  const body = await readBody<{ ids?: unknown }>(event)
  const ids = validIds(body?.ids)

  if (ids.length < 2 || ids.length > MAX_COMPARISON) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Sélection invalide',
      message: `Sélectionne entre 2 et ${MAX_COMPARISON} biens pour générer un PDF.`
    })
  }

  const client = await db(event)
  const { data: rawBiens, error } = await client.from('biens').select('*')
  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  const allBiens = (rawBiens ?? []) as Property[]
  const selected = ids.map((id) => allBiens.find((b) => b.id === id))
  if (selected.some((b) => !b)) {
    throw createError({ statusCode: 404, statusMessage: 'Bien introuvable' })
  }
  const properties = selected as Property[]

  const preferences = normalize(user.user_metadata?.preferences)
  const context = representatives(allBiens)
  const scores = properties.map((b) => scoreProperty(b, context, preferences))
  const rows = compare(properties, scores, optionsFromPreferences(preferences))

  const pdf = await renderComparisonPdf({ properties, rows, scores })

  setResponseHeaders(event, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="comparaison-hovly-${Date.now()}.pdf"`,
    'Content-Length': String(pdf.length)
  })
  return pdf
})

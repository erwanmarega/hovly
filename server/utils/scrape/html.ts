import { parseHTML } from 'linkedom'
import type { PageData } from './extract'

function plusGrande(srcset: string): string {
  const parts = srcset
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0])
  if (!parts.length) return ''
  parts.sort((a, b) => (parseInt(b[1] || '0', 10) || 0) - (parseInt(a[1] || '0', 10) || 0))
  return parts[0][0]
}

export function htmlToPageData(html: string): PageData {
  const { document } = parseHTML(html)

  const meta = (p: string) =>
    document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ||
    document.querySelector(`meta[name="${p}"]`)?.getAttribute('content') ||
    ''

  const ogImages = Array.from(document.querySelectorAll('meta[property="og:image"]')).map(
    (m: any) => m.getAttribute('content') || ''
  )

  const domImages: string[] = []
  document.querySelectorAll('img').forEach((el: any) => {
    const cand =
      el.getAttribute('src') ||
      el.getAttribute('data-src') ||
      el.getAttribute('data-lazy-src') ||
      el.getAttribute('data-original') ||
      plusGrande(el.getAttribute('srcset') || '') ||
      ''
    if (cand) domImages.push(cand)
  })
  document.querySelectorAll('source[srcset]').forEach((s: any) => {
    const u = plusGrande(s.getAttribute('srcset') || '')
    if (u) domImages.push(u)
  })

  const scriptImages: string[] = []
  const reImg = /https?:\\?\/\\?\/[^"'\\\s]+?\.(?:jpe?g|webp|png)(?:\?[^"'\\\s]*)?/gi
  document.querySelectorAll('script').forEach((s: any) => {
    const t = s.textContent || ''
    if (t.length > 200000) return
    const found = t.match(reImg)
    if (found) scriptImages.push(...found.map((u: string) => u.replace(/\\\//g, '/')))
  })

  const jsonLd: any[] = []
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s: any) => {
    try {
      jsonLd.push(JSON.parse(s.textContent || 'null'))
    } catch {
    }
  })

  return {
    title: document.title || '',
    ogTitle: meta('og:title'),
    ogImages,
    domImages,
    scriptImages,
    jsonLd,
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    bodyText: (document.body?.textContent || '').replace(/\s+/g, ' ').slice(0, 20000),
    nextData: document.querySelector('#__NEXT_DATA__')?.textContent || ''
  }
}

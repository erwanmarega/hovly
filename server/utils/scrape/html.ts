import { parseHTML } from 'linkedom'
import type { CardLink, PageData } from './extract'

export const MAX_LINKS = 600

function largestSrc(srcset: string): string {
  const parts = srcset
    .split(',')
    .map((p) => p.trim().split(/\s+/))
    .filter((p) => p[0])
  if (!parts.length) return ''
  parts.sort((a, b) => (parseInt(b[1] || '0', 10) || 0) - (parseInt(a[1] || '0', 10) || 0))
  return parts[0][0]
}

/**
 * Remonte de l'ancre vers la carte qui la contient.
 *
 * Certains sites (SeLoger) utilisent un « lien étiré » : l'ancre est vide et
 * recouvre une carte dont le contenu vit chez un ancêtre. On monte tant que le
 * sous-arbre ne décrit qu'une seule annonce ; dès qu'il en contient plusieurs,
 * on est arrivé au conteneur de liste et on s'arrête au niveau précédent.
 */
function cardFrom(anchor: any, listingPattern: RegExp | null): any {
  if (!listingPattern) return anchor
  // Une ancre qui ne pointe pas vers une fiche (navigation, footer) n'a pas de
  // carte : sans ce garde-fou, chacune des ~600 ancres d'une page remonterait
  // 5 niveaux en balayant des sous-arbres de plus en plus gros pour rien.
  if (!listingPattern.test(anchor.getAttribute('href') || '')) return anchor

  let current = anchor
  let card = anchor

  for (let i = 0; i < 5 && current.parentElement; i++) {
    current = current.parentElement

    // Clé = la portion d'URL qui identifie l'annonce, pas le href brut. Une
    // carte contient souvent deux liens vers la même fiche (l'ancre étirée et un
    // bouton « Voir le détail »), l'un relatif et l'autre absolu : comparer les
    // href bruts les compterait comme deux annonces et stopperait la remontée
    // avant d'atteindre la carte.
    const listings = new Set<string>()
    current.querySelectorAll('a[href]').forEach((a: any) => {
      const match = (a.getAttribute('href') || '').match(listingPattern)
      if (match) listings.add(match[0])
    })

    if (listings.size > 1) break
    card = current
  }

  return card
}

export const MIN_PHOTO_WIDTH = 200
export const MIN_PHOTO_HEIGHT = 150

/**
 * Une carte d'annonce commence souvent par le logo de l'agence, servi depuis le
 * même CDN que les photos — seule sa taille le trahit. SeLoger le demande en
 * `&h=50` là où les photos sont en `w=525&h=394`.
 */
export function thumbnailTooSmall(url: string, width?: unknown, height?: unknown): boolean {
  const number = (v: unknown) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const l = number(url.match(/[?&](?:w|width)=(\d+)/i)?.[1]) ?? number(width)
  const h = number(url.match(/[?&](?:h|height)=(\d+)/i)?.[1]) ?? number(height)

  return (l !== null && l < MIN_PHOTO_WIDTH) || (h !== null && h < MIN_PHOTO_HEIGHT)
}

const firstImage = (el: any): string => {
  for (const img of [...el.querySelectorAll('img')].slice(0, 8) as any[]) {
    const cand =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-original') ||
      largestSrc(img.getAttribute('srcset') || '')

    if (!cand || !/^https?:\/\//i.test(cand)) continue
    if (thumbnailTooSmall(cand, img.getAttribute('width'), img.getAttribute('height'))) continue
    return cand
  }
  return ''
}

export function htmlToPageData(html: string, listingPattern: RegExp | null = null): PageData {
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
      largestSrc(el.getAttribute('srcset') || '') ||
      ''
    if (cand) domImages.push(cand)
  })
  document.querySelectorAll('source[srcset]').forEach((s: any) => {
    const u = largestSrc(s.getAttribute('srcset') || '')
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

  const links: CardLink[] = []
  document.querySelectorAll('a[href]').forEach((a: any) => {
    if (links.length >= MAX_LINKS) return
    const href = a.getAttribute('href') || ''
    if (!href) return

    // L'ancre porte parfois tout (PAP), parfois rien (SeLoger), parfois un
    // simple badge trompeur (« Exclusivité » chez Century 21). On remonte les
    // deux textes sans arbitrer ici : c'est annoncesDepuisLiens qui garde celui
    // qui produit le plus de signal, car lui seul sait parser une carte.
    const clean = (a.textContent || '').replace(/\s+/g, ' ').trim()
    const card = cardFrom(a, listingPattern)
    const cardText =
      card === a ? '' : (card.textContent || '').replace(/\s+/g, ' ').trim()

    links.push({
      href,
      text: clean.slice(0, 300),
      ...(cardText && cardText !== clean ? { cardText: cardText.slice(0, 400) } : {}),
      image: firstImage(card)
    })
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
    nextData: document.querySelector('#__NEXT_DATA__')?.textContent || '',
    estateData: document.querySelector('[data-estate]')?.getAttribute('data-estate') || '',
    links
  }
}

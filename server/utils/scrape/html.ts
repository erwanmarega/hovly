import { parseHTML } from 'linkedom'
import type { LienCarte, PageData } from './extract'

export const MAX_LIENS = 600

function plusGrande(srcset: string): string {
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
function carteDe(ancre: any, motifFiche: RegExp | null): any {
  if (!motifFiche) return ancre
  // Une ancre qui ne pointe pas vers une fiche (navigation, footer) n'a pas de
  // carte : sans ce garde-fou, chacune des ~600 ancres d'une page remonterait
  // 5 niveaux en balayant des sous-arbres de plus en plus gros pour rien.
  if (!motifFiche.test(ancre.getAttribute('href') || '')) return ancre

  let courant = ancre
  let carte = ancre

  for (let i = 0; i < 5 && courant.parentElement; i++) {
    courant = courant.parentElement

    // Clé = la portion d'URL qui identifie l'annonce, pas le href brut. Une
    // carte contient souvent deux liens vers la même fiche (l'ancre étirée et un
    // bouton « Voir le détail »), l'un relatif et l'autre absolu : comparer les
    // href bruts les compterait comme deux annonces et stopperait la remontée
    // avant d'atteindre la carte.
    const annonces = new Set<string>()
    courant.querySelectorAll('a[href]').forEach((a: any) => {
      const cible = (a.getAttribute('href') || '').match(motifFiche)
      if (cible) annonces.add(cible[0])
    })

    if (annonces.size > 1) break
    carte = courant
  }

  return carte
}

export const LARGEUR_PHOTO_MIN = 200
export const HAUTEUR_PHOTO_MIN = 150

/**
 * Une carte d'annonce commence souvent par le logo de l'agence, servi depuis le
 * même CDN que les photos — seule sa taille le trahit. SeLoger le demande en
 * `&h=50` là où les photos sont en `w=525&h=394`.
 */
export function vignetteTropPetite(url: string, largeur?: unknown, hauteur?: unknown): boolean {
  const nombre = (v: unknown) => {
    const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  }

  const l = nombre(url.match(/[?&](?:w|width)=(\d+)/i)?.[1]) ?? nombre(largeur)
  const h = nombre(url.match(/[?&](?:h|height)=(\d+)/i)?.[1]) ?? nombre(hauteur)

  return (l !== null && l < LARGEUR_PHOTO_MIN) || (h !== null && h < HAUTEUR_PHOTO_MIN)
}

const premiereImage = (el: any): string => {
  for (const img of [...el.querySelectorAll('img')].slice(0, 8) as any[]) {
    const cand =
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-original') ||
      plusGrande(img.getAttribute('srcset') || '')

    if (!cand || !/^https?:\/\//i.test(cand)) continue
    if (vignetteTropPetite(cand, img.getAttribute('width'), img.getAttribute('height'))) continue
    return cand
  }
  return ''
}

export function htmlToPageData(html: string, motifFiche: RegExp | null = null): PageData {
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

  const liens: LienCarte[] = []
  document.querySelectorAll('a[href]').forEach((a: any) => {
    if (liens.length >= MAX_LIENS) return
    const href = a.getAttribute('href') || ''
    if (!href) return

    // L'ancre porte parfois tout (PAP), parfois rien (SeLoger), parfois un
    // simple badge trompeur (« Exclusivité » chez Century 21). On remonte les
    // deux textes sans arbitrer ici : c'est annoncesDepuisLiens qui garde celui
    // qui produit le plus de signal, car lui seul sait parser une carte.
    const propre = (a.textContent || '').replace(/\s+/g, ' ').trim()
    const carte = carteDe(a, motifFiche)
    const texteCarte =
      carte === a ? '' : (carte.textContent || '').replace(/\s+/g, ' ').trim()

    liens.push({
      href,
      texte: propre.slice(0, 300),
      ...(texteCarte && texteCarte !== propre ? { texteCarte: texteCarte.slice(0, 400) } : {}),
      image: premiereImage(carte)
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
    liens
  }
}

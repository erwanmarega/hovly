import { describe, it, expect } from 'vitest'
import { htmlToPageData } from '../server/utils/scrape/html'

const page = (body: string, head = '') =>
  htmlToPageData(`<html><head>${head}</head><body>${body}</body></html>`)

describe('htmlToPageData — métadonnées', () => {
  it('lit title, og:title et h1', () => {
    const d = page(
      '<h1>  T3 avec balcon  </h1>',
      '<title>Annonce</title><meta property="og:title" content="T3 Lyon 3e">'
    )
    expect(d.title).toBe('Annonce')
    expect(d.ogTitle).toBe('T3 Lyon 3e')
    expect(d.h1).toBe('T3 avec balcon')
  })

  it('accepte les meta en name= faute de property=', () => {
    const d = page('', '<meta name="og:title" content="Fallback">')
    expect(d.ogTitle).toBe('Fallback')
  })

  it('retourne des valeurs vides quand rien n’est présent', () => {
    const d = page('')
    expect(d).toMatchObject({ title: '', ogTitle: '', h1: '', ogImages: [], jsonLd: [] })
  })

  it('normalise les espaces du bodyText', () => {
    const d = page('<p>Beau   T2\n\n  proche métro</p>')
    expect(d.bodyText).toBe('Beau T2 proche métro')
  })
})

describe('htmlToPageData — images', () => {
  it('collecte toutes les og:image', () => {
    const d = page('', '<meta property="og:image" content="a.jpg"><meta property="og:image" content="b.jpg">')
    expect(d.ogImages).toEqual(['a.jpg', 'b.jpg'])
  })

  it('prend src en priorité puis les attributs lazy', () => {
    const d = page(
      '<img src="1.jpg"><img data-src="2.jpg"><img data-lazy-src="3.jpg"><img data-original="4.jpg">'
    )
    expect(d.domImages).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg'])
  })

  it('choisit la plus grande largeur d’un srcset', () => {
    const d = page('<img srcset="petit.jpg 320w, grand.jpg 1200w, moyen.jpg 640w">')
    expect(d.domImages).toEqual(['grand.jpg'])
  })

  it('lit aussi les source[srcset]', () => {
    const d = page('<picture><source srcset="s-480.webp 480w, s-960.webp 960w"></picture>')
    expect(d.domImages).toEqual(['s-960.webp'])
  })

  it('ignore les img sans source exploitable', () => {
    const d = page('<img alt="vide"><img src="ok.jpg">')
    expect(d.domImages).toEqual(['ok.jpg'])
  })

  it('extrait les URLs d’images des scripts et déséchappe les slashs du protocole', () => {
    const d = page(
      '<script>var p = ["https:\\/\\/cdn.test/photo-1.jpg?w=800","https://cdn.test/photo-2.webp"]</script>'
    )
    expect(d.scriptImages).toEqual([
      'https://cdn.test/photo-1.jpg?w=800',
      'https://cdn.test/photo-2.webp'
    ])
  })

  it('ignore les extensions non image', () => {
    const d = page('<script>var u = "https://cdn.test/app.js"</script>')
    expect(d.scriptImages).toEqual([])
  })

  it('ignore les scripts trop gros', () => {
    const d = page(`<script>${'x'.repeat(200001)}https://cdn.test/a.jpg</script>`)
    expect(d.scriptImages).toEqual([])
  })
})

describe('htmlToPageData — JSON embarqué', () => {
  it('parse les blocs ld+json', () => {
    const d = page('<script type="application/ld+json">{"@type":"Product","name":"T2"}</script>')
    expect(d.jsonLd).toEqual([{ '@type': 'Product', name: 'T2' }])
  })

  it('ignore un ld+json invalide sans lever', () => {
    const d = page(
      '<script type="application/ld+json">{oops}</script>' +
        '<script type="application/ld+json">{"ok":true}</script>'
    )
    expect(d.jsonLd).toEqual([{ ok: true }])
  })

  it('récupère le contenu brut de #__NEXT_DATA__', () => {
    const d = page('<script id="__NEXT_DATA__" type="application/json">{"props":{"a":1}}</script>')
    expect(d.nextData).toBe('{"props":{"a":1}}')
  })

  it('retourne une chaîne vide sans __NEXT_DATA__', () => {
    expect(page('<script>var a = 1</script>').nextData).toBe('')
  })
})

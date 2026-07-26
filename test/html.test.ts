import { describe, it, expect } from 'vitest'
import { htmlToPageData, vignetteTropPetite } from '../server/utils/scrape/html'

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

describe('htmlToPageData — liens de cartes', () => {
  const MOTIF = /\/annonces\/[^?#]+\/\d{6,}\.htm/i

  // Reproduit la structure SeLoger : ancre vide étirée sur la carte, dont le
  // contenu (prix, surface, photo) vit chez un ancêtre.
  const carte = (id: string, texte: string, img: string) =>
    `<div class="carte">
       <div class="media"><img src="${img}"></div>
       <a href="/annonces/locations/appartement/paris-12eme-75/x/${id}.htm?serp_view=list"></a>
       <div class="infos">${texte}</div>
     </div>`

  const liste = (...cartes: string[]) => `<div class="liste">${cartes.join('')}</div>`

  it('remonte à la carte quand l’ancre est vide', () => {
    const d = htmlToPageData(
      `<html><body>${liste(
        carte('274651193', '1 517 € /mois · 41 m² · 2 pièces', 'https://mms.seloger.com/a.jpg')
      )}</body></html>`,
      MOTIF
    )

    const lien = d.liens!.find((l) => l.href.includes('274651193'))!
    expect(lien.texte).toBe('')
    expect(lien.texteCarte).toContain('1 517 €')
    expect(lien.texteCarte).toContain('41 m²')
    expect(lien.image).toBe('https://mms.seloger.com/a.jpg')
  })

  it('s’arrête avant le conteneur de liste', () => {
    const d = htmlToPageData(
      `<html><body>${liste(
        carte('111111111', '1 000 € · 30 m²', 'https://mms.seloger.com/a.jpg'),
        carte('222222222', '2 000 € · 60 m²', 'https://mms.seloger.com/b.jpg')
      )}</body></html>`,
      MOTIF
    )

    const premier = d.liens!.find((l) => l.href.includes('111111111'))!
    expect(premier.texteCarte).toContain('1 000 €')
    expect(premier.texteCarte).not.toContain('2 000 €')
    expect(premier.image).toBe('https://mms.seloger.com/a.jpg')
  })

  it('laisse intacte une ancre qui porte déjà son texte', () => {
    const d = htmlToPageData(
      '<html><body><div class="bruit">Trier par prix</div>' +
        '<a href="/annonces/x/y/333333333.htm">Appartement 3 pièces 62 m²</a>' +
        '</body></html>',
      MOTIF
    )

    const lien = d.liens!.find((l) => l.href.includes('333333333'))!
    expect(lien.texte).toBe('Appartement 3 pièces 62 m²')
    expect(lien.texte).not.toContain('Trier')
  })

  it('sans motif fourni, ne remonte jamais (chemin fiche inchangé)', () => {
    const d = htmlToPageData(
      `<html><body>${carte('444444444', '900 € · 20 m²', 'https://x.fr/a.jpg')}</body></html>`
    )

    expect(d.liens!.find((l) => l.href.includes('444444444'))!.texte).toBe('')
  })
})

describe('vignetteTropPetite', () => {
  it('écarte un logo d’agence servi par le CDN des photos', () => {
    expect(vignetteTropPetite('https://mms.seloger.com/abc.jpg?c=1&h=50')).toBe(true)
  })

  it('garde une vraie photo d’annonce', () => {
    expect(vignetteTropPetite('https://mms.seloger.com/abc.jpg?w=525&h=394')).toBe(false)
  })

  it('retombe sur les attributs quand l’URL ne dit rien', () => {
    expect(vignetteTropPetite('https://x.fr/a.jpg', '80', '60')).toBe(true)
    expect(vignetteTropPetite('https://x.fr/a.jpg', '600', '400')).toBe(false)
  })

  it('garde une image de taille inconnue plutôt que de la perdre', () => {
    expect(vignetteTropPetite('https://x.fr/a.jpg')).toBe(false)
  })
})

describe('htmlToPageData — logo d’agence en tête de carte', () => {
  const MOTIF = /\/annonces\/[^?#]+\/\d{6,}\.htm/i

  it('saute le logo et prend la première vraie photo', () => {
    const d = htmlToPageData(
      `<html><body><div class="liste"><div class="carte">
         <img src="https://mms.seloger.com/logo.jpg?c=1&h=50">
         <img src="https://mms.seloger.com/photo.jpg?w=525&h=394" loading="lazy">
         <a href="/annonces/x/y/555555555.htm"></a>
         <div>1 200 € /mois · 35 m² · 2 pièces</div>
       </div></div></body></html>`,
      MOTIF
    )

    const lien = d.liens!.find((l) => l.href.includes('555555555'))!
    expect(lien.image).toBe('https://mms.seloger.com/photo.jpg?w=525&h=394')
  })
})

describe('htmlToPageData — deux liens vers la même fiche', () => {
  const MOTIF = /\/trouver_logement\/detail\/\d{4,}/i

  // Structure Century 21 : l'ancre étirée est vide, un bouton « Voir le détail »
  // pointe vers la même fiche, l'un en relatif et l'autre en absolu. Comparer les
  // href bruts comptait deux annonces et bloquait la remontée sur le badge.
  const carteC21 = (id: string, texte: string) =>
    `<div class="carte">
       <div class="badge"><a href="/trouver_logement/detail/${id}/"></a>Exclusivité</div>
       <div class="infos">${texte}</div>
       <a class="bouton" href="https://www.century21.fr/trouver_logement/detail/${id}/?utm=x">Voir le détail du bien</a>
     </div>`

  it('remonte à la carte malgré le lien dupliqué', () => {
    const d = htmlToPageData(
      `<html><body><div class="liste">${carteC21(
        '14920340077',
        'SERRIS 77 62,93 m2, 3 pièces Appartement F3 à louer 1 620 € par mois'
      )}${carteC21('15848211918', 'CHESSY 77 45 m2, 2 pièces Appartement F2 à louer 980 € par mois')}
      </div></body></html>`,
      MOTIF
    )

    const badge = d.liens!.find((l) => l.texte === '' && l.href.includes('14920340077'))!
    expect(badge.texteCarte).toContain('1 620 €')
    expect(badge.texteCarte).toContain('62,93 m2')
    expect(badge.texteCarte).not.toContain('980 €')
  })
})

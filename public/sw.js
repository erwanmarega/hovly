/* Service worker Hovly — mise en cache prudente : rien d'authentifié n'est stocké. */

const VERSION = 'v2'
const CACHE_COQUE = `hovly-coque-${VERSION}`
const CACHE_STATIQUE = `hovly-statique-${VERSION}`
const CACHE_IMAGES = `hovly-images-${VERSION}`
const CACHE_TUILES = `hovly-tuiles-${VERSION}`

const PAGE_HORS_LIGNE = '/hors-ligne.html'

const COQUE = [PAGE_HORS_LIGNE, '/icons/icon-192.png', '/manifest.webmanifest']

const MAX_IMAGES = 120
const MAX_TUILES = 300

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_COQUE).then((c) => c.addAll(COQUE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  const garder = [CACHE_COQUE, CACHE_STATIQUE, CACHE_IMAGES, CACHE_TUILES]
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !garder.includes(c)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

/* ---------- Notifications push ---------- */

self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { corps: e.data ? e.data.text() : '' }
  }

  const titre = d.titre || 'Hovly'

  // Les onglets ouverts rafraîchissent leur liste d'alertes.
  const prevenirClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((fenetres) => fenetres.forEach((f) => f.postMessage({ type: 'PUSH_ALERTE' })))

  e.waitUntil(
    prevenirClients.then(() =>
      self.registration.showNotification(titre, {
        body: d.corps || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: d.tag || undefined,
        renotify: !!d.tag,
        data: { url: d.url || '/alertes' }
      })
    )
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const cible = new URL(e.notification.data?.url || '/alertes', self.location.origin)

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if (new URL(f.url).pathname === cible.pathname) return f.focus()
      }
      const ouverte = fenetres[0]
      if (ouverte && 'navigate' in ouverte) return ouverte.navigate(cible.href).then((f) => f?.focus())
      return self.clients.openWindow(cible.href)
    })
  )
})

/* ---------- Cache ---------- */

// En développement, le service worker sert uniquement au push : aucun cache,
// sinon le HMR et les fichiers du build seraient servis périmés.
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname)

async function limiter(nom, max) {
  const cache = await caches.open(nom)
  const cles = await cache.keys()
  if (cles.length <= max) return
  await Promise.all(cles.slice(0, cles.length - max).map((k) => cache.delete(k)))
}

async function depuisCache(requete, nom, max) {
  const cache = await caches.open(nom)
  const enCache = await cache.match(requete)
  if (enCache) return enCache

  const reponse = await fetch(requete)
  if (reponse.ok || reponse.type === 'opaque') {
    await cache.put(requete, reponse.clone())
    if (max) limiter(nom, max)
  }
  return reponse
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (DEV || request.method !== 'GET') return

  const url = new URL(request.url)

  // Jamais de cache pour l'API ni pour l'authentification.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/confirm')) return

  // Les pages ne sont pas mises en cache (contenu personnel) : réseau, puis page hors ligne.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(PAGE_HORS_LIGNE)))
    return
  }

  // Fichiers versionnés du build et ressources locales.
  if (
    url.origin === self.location.origin &&
    /^\/(_nuxt|icons|logos)\//.test(url.pathname + '/')
  ) {
    e.respondWith(depuisCache(request, CACHE_STATIQUE))
    return
  }

  // Fonds de carte.
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith(depuisCache(request, CACHE_TUILES, MAX_TUILES))
    return
  }

  // Photos d'annonces.
  if (request.destination === 'image') {
    e.respondWith(depuisCache(request, CACHE_IMAGES, MAX_IMAGES))
  }
})

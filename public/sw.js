/* Service worker Hovly — mise en cache prudente : rien d'authentifié n'est stocké. */

const VERSION = 'v2'
const CACHE_SHELL = `hovly-coque-${VERSION}`
const CACHE_STATIC = `hovly-statique-${VERSION}`
const CACHE_IMAGES = `hovly-images-${VERSION}`
const CACHE_TILES = `hovly-tuiles-${VERSION}`

const OFFLINE_PAGE = '/hors-ligne.html'

const SHELL = [OFFLINE_PAGE, '/icons/icon-192.png', '/manifest.webmanifest']

const MAX_IMAGES = 120
const MAX_TILES = 300

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_SHELL).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  const keep = [CACHE_SHELL, CACHE_STATIC, CACHE_IMAGES, CACHE_TILES]
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((c) => !keep.includes(c)).map((c) => caches.delete(c))))
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

  const title = d.titre || 'Hovly'

  // Les onglets ouverts rafraîchissent leur liste d'alertes.
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windows) => windows.forEach((f) => f.postMessage({ type: 'PUSH_ALERT' })))

  e.waitUntil(
    notifyClients.then(() =>
      self.registration.showNotification(title, {
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
  const target = new URL(e.notification.data?.url || '/alertes', self.location.origin)

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const f of windows) {
        if (new URL(f.url).pathname === target.pathname) return f.focus()
      }
      const openClient = windows[0]
      if (openClient && 'navigate' in openClient) return openClient.navigate(target.href).then((f) => f?.focus())
      return self.clients.openWindow(target.href)
    })
  )
})

/* ---------- Cache ---------- */

// En développement, le service worker sert uniquement au push : aucun cache,
// sinon le HMR et les fichiers du build seraient servis périmés.
const DEV = ['localhost', '127.0.0.1'].includes(self.location.hostname)

async function trim(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

async function fromCache(request, name, max) {
  const cache = await caches.open(name)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
    if (max) trim(name, max)
  }
  return response
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (DEV || request.method !== 'GET') return

  const url = new URL(request.url)

  // Jamais de cache pour l'API ni pour l'authentification.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/confirm')) return

  // Les pages ne sont pas mises en cache (contenu personnel) : réseau, puis page hors ligne.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)))
    return
  }

  // Fichiers versionnés du build et ressources locales.
  if (
    url.origin === self.location.origin &&
    /^\/(_nuxt|icons|logos)\//.test(url.pathname + '/')
  ) {
    e.respondWith(fromCache(request, CACHE_STATIC))
    return
  }

  // Fonds de carte.
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith(fromCache(request, CACHE_TILES, MAX_TILES))
    return
  }

  // Photos d'annonces.
  if (request.destination === 'image') {
    e.respondWith(fromCache(request, CACHE_IMAGES, MAX_IMAGES))
  }
})

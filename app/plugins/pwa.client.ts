export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  // Le service worker est aussi enregistré en développement : sans lui, pas de
  // notifications push testables en local. Il n'y met rien en cache (voir sw.js).

  async function enregistrer() {
    try {
      const enregistrement = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      // Recharge une fois quand une nouvelle version prend la main.
      let rechargement = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (rechargement) return
        rechargement = true
        window.location.reload()
      })

      enregistrement.addEventListener('updatefound', () => {
        const nouveau = enregistrement.installing
        nouveau?.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            nouveau.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    } catch {
      // Un service worker indisponible ne doit jamais casser l'application.
    }
  }

  if (document.readyState === 'complete') enregistrer()
  else window.addEventListener('load', enregistrer)
})

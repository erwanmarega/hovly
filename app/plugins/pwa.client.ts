export default defineNuxtPlugin(() => {
  if (!import.meta.client || !('serviceWorker' in navigator)) return

  async function enregistrer() {
    try {
      const enregistrement = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

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
    }
  }

  if (document.readyState === 'complete') enregistrer()
  else window.addEventListener('load', enregistrer)
})

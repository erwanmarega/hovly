export default defineNuxtPlugin(() => {
  if (!import.meta.client) return

  const deferredPrompt = useState<Event | null>('install-prompt-event', () => null)
  const installed = useState('install-app-installed', () => false)

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true

  installed.value = isStandalone()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt.value = e
  })

  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferredPrompt.value = null
  })
})

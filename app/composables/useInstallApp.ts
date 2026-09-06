export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'unavailable' | 'ios' | 'available' | 'installed'

export function useInstallApp() {
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('install-prompt-event', () => null)
  const installed = useState('install-app-installed', () => false)

  const isIos = computed(() => {
    if (typeof navigator === 'undefined') return false
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
  })

  const state = computed<InstallState>(() => {
    if (installed.value) return 'installed'
    if (deferredPrompt.value) return 'available'
    if (isIos.value) return 'ios'
    return 'unavailable'
  })

  async function install(): Promise<boolean> {
    const prompt = deferredPrompt.value
    if (!prompt) return false
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.value = null
    return outcome === 'accepted'
  }

  return { state, install }
}

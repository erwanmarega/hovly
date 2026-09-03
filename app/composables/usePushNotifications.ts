export type PushState = 'unknown' | 'unsupported' | 'not_configured' | 'denied' | 'inactive' | 'active'

export function base64UrlToBytes(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function usePushNotifications() {
  const key = useRuntimeConfig().public.vapidPublicKey as string

  const state = useState<PushState>('push-etat', () => 'unknown')
  const busy = useState('push-occupe', () => false)
  const error = useState<string>('push-erreur', () => '')
  const initialized = useState('push-initialise', () => false)

  const supported = computed(() => state.value !== 'unsupported' && state.value !== 'not_configured')
  const active = computed(() => state.value === 'active')

  function isAvailable(): boolean {
    return (
      import.meta.client &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  async function currentSubscription(): Promise<PushSubscription | null> {
    const sw = await navigator.serviceWorker.ready
    return sw.pushManager.getSubscription()
  }

  async function init() {
    if (!import.meta.client || initialized.value) return
    initialized.value = true

    if (!isAvailable()) {
      state.value = 'unsupported'
      return
    }
    if (!key) {
      state.value = 'not_configured'
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'denied'
      return
    }

    try {
      state.value = (await currentSubscription()) ? 'active' : 'inactive'
    } catch {
      state.value = 'inactive'
    }
  }

  async function enable(): Promise<boolean> {
    if (!isAvailable() || !key) return false

    busy.value = true
    error.value = ''
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        state.value = permission === 'denied' ? 'denied' : 'inactive'
        return false
      }

      const sw = await navigator.serviceWorker.ready
      const subscription =
        (await sw.pushManager.getSubscription()) ??
        (await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key)
        }))

      await $fetch('/api/push/abonner', { method: 'POST', body: subscription.toJSON() })
      state.value = 'active'
      return true
    } catch (e: unknown) {
      error.value = (e as Error)?.message || 'Activation impossible'
      return false
    } finally {
      busy.value = false
    }
  }

  async function disable(): Promise<boolean> {
    if (!isAvailable()) return false

    busy.value = true
    error.value = ''
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await $fetch('/api/push/desabonner', {
          method: 'POST',
          body: { endpoint: subscription.endpoint }
        })
        await subscription.unsubscribe()
      }
      state.value = 'inactive'
      return true
    } catch (e: unknown) {
      error.value = (e as Error)?.message || 'Désactivation impossible'
      return false
    } finally {
      busy.value = false
    }
  }

  async function test(): Promise<boolean> {
    busy.value = true
    error.value = ''
    try {
      const r = await $fetch<{ ok: boolean; failed: number; reasons: string[] }>('/api/push/test', {
        method: 'POST'
      })
      if (!r.ok) error.value = r.reasons.join(', ') || 'Aucun appareil abonné'
      return r.ok
    } catch (e: unknown) {
      error.value = errorMessage(e, 'Envoi impossible')
      return false
    } finally {
      busy.value = false
    }
  }

  return { state, supported, active, busy, error, init, enable, disable, test }
}

export type PushState = 'inconnu' | 'non_supporte' | 'non_configure' | 'refuse' | 'inactif' | 'actif'

export function base64UrlToBytes(base64: string): Uint8Array {
  const remplissage = '='.repeat((4 - (base64.length % 4)) % 4)
  const brut = atob((base64 + remplissage).replace(/-/g, '+').replace(/_/g, '/'))
  const octets = new Uint8Array(brut.length)
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

export function usePushNotifications() {
  const key = useRuntimeConfig().public.vapidPublicKey as string

  const state = useState<PushState>('push-etat', () => 'inconnu')
  const busy = useState('push-occupe', () => false)
  const error = useState<string>('push-erreur', () => '')
  const initialized = useState('push-initialise', () => false)

  const supported = computed(() => state.value !== 'non_supporte' && state.value !== 'non_configure')
  const active = computed(() => state.value === 'actif')

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
      state.value = 'non_supporte'
      return
    }
    if (!key) {
      state.value = 'non_configure'
      return
    }
    if (Notification.permission === 'denied') {
      state.value = 'refuse'
      return
    }

    try {
      state.value = (await currentSubscription()) ? 'actif' : 'inactif'
    } catch {
      state.value = 'inactif'
    }
  }

  async function enable(): Promise<boolean> {
    if (!isAvailable() || !key) return false

    busy.value = true
    error.value = ''
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        state.value = permission === 'denied' ? 'refuse' : 'inactif'
        return false
      }

      const sw = await navigator.serviceWorker.ready
      const abonnement =
        (await sw.pushManager.getSubscription()) ??
        (await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key)
        }))

      await $fetch('/api/push/abonner', { method: 'POST', body: abonnement.toJSON() })
      state.value = 'actif'
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
      const abonnement = await currentSubscription()
      if (abonnement) {
        await $fetch('/api/push/desabonner', {
          method: 'POST',
          body: { endpoint: abonnement.endpoint }
        })
        await abonnement.unsubscribe()
      }
      state.value = 'inactif'
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

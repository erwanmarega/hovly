export type EtatPush = 'inconnu' | 'non_supporte' | 'non_configure' | 'refuse' | 'inactif' | 'actif'

export function base64UrlVersOctets(base64: string): Uint8Array {
  const remplissage = '='.repeat((4 - (base64.length % 4)) % 4)
  const brut = atob((base64 + remplissage).replace(/-/g, '+').replace(/_/g, '/'))
  const octets = new Uint8Array(brut.length)
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i)
  return octets
}

export function useNotificationsPush() {
  const cle = useRuntimeConfig().public.vapidPublicKey as string

  const etat = useState<EtatPush>('push-etat', () => 'inconnu')
  const occupe = useState('push-occupe', () => false)
  const erreur = useState<string>('push-erreur', () => '')
  const initialise = useState('push-initialise', () => false)

  const supporte = computed(() => etat.value !== 'non_supporte' && etat.value !== 'non_configure')
  const actif = computed(() => etat.value === 'actif')

  function possible(): boolean {
    return (
      import.meta.client &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  async function abonnementCourant(): Promise<PushSubscription | null> {
    const sw = await navigator.serviceWorker.ready
    return sw.pushManager.getSubscription()
  }

  async function init() {
    if (!import.meta.client || initialise.value) return
    initialise.value = true

    if (!possible()) {
      etat.value = 'non_supporte'
      return
    }
    if (!cle) {
      etat.value = 'non_configure'
      return
    }
    if (Notification.permission === 'denied') {
      etat.value = 'refuse'
      return
    }

    try {
      etat.value = (await abonnementCourant()) ? 'actif' : 'inactif'
    } catch {
      etat.value = 'inactif'
    }
  }

  async function activer(): Promise<boolean> {
    if (!possible() || !cle) return false

    occupe.value = true
    erreur.value = ''
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        etat.value = permission === 'denied' ? 'refuse' : 'inactif'
        return false
      }

      const sw = await navigator.serviceWorker.ready
      const abonnement =
        (await sw.pushManager.getSubscription()) ??
        (await sw.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlVersOctets(cle)
        }))

      await $fetch('/api/push/abonner', { method: 'POST', body: abonnement.toJSON() })
      etat.value = 'actif'
      return true
    } catch (e: unknown) {
      erreur.value = (e as Error)?.message || 'Activation impossible'
      return false
    } finally {
      occupe.value = false
    }
  }

  async function desactiver(): Promise<boolean> {
    if (!possible()) return false

    occupe.value = true
    erreur.value = ''
    try {
      const abonnement = await abonnementCourant()
      if (abonnement) {
        await $fetch('/api/push/desabonner', {
          method: 'POST',
          body: { endpoint: abonnement.endpoint }
        })
        await abonnement.unsubscribe()
      }
      etat.value = 'inactif'
      return true
    } catch (e: unknown) {
      erreur.value = (e as Error)?.message || 'Désactivation impossible'
      return false
    } finally {
      occupe.value = false
    }
  }

  async function tester(): Promise<boolean> {
    occupe.value = true
    erreur.value = ''
    try {
      const r = await $fetch<{ ok: boolean; echecs: number; raisons: string[] }>('/api/push/test', {
        method: 'POST'
      })
      if (!r.ok) erreur.value = r.raisons.join(', ') || 'Aucun appareil abonné'
      return r.ok
    } catch (e: unknown) {
      const err = e as { statusMessage?: string; message?: string }
      erreur.value = err.statusMessage || err.message || 'Envoi impossible'
      return false
    } finally {
      occupe.value = false
    }
  }

  return { etat, supporte, actif, occupe, erreur, init, activer, desactiver, tester }
}

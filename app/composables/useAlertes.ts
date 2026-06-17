import type { Alerte } from '~/types'
import type { CheckResume } from '~/types/check'

export function useAlertes() {
  const alertes = useState<Alerte[]>('alertes', () => [])

  const nonVues = computed(() => alertes.value.filter((a) => !a.vue).length)

  async function refresh() {
    alertes.value = await $fetch<Alerte[]>('/api/alertes')
  }

  async function marquerLues() {
    if (nonVues.value === 0) return
    alertes.value = alertes.value.map((a) => ({ ...a, vue: true }))
    await $fetch('/api/alertes', { method: 'PATCH' })
  }

  async function verifierMaintenant(): Promise<CheckResume> {
    const resume = await $fetch<CheckResume>('/api/check', { method: 'POST' })
    await refresh()
    return resume
  }

  return { alertes, nonVues, refresh, marquerLues, verifierMaintenant }
}

import type { Alert } from '~/types'
import type { CheckSummary } from '~/types/check'

export function useAlertes() {
  const alertes = useState<Alert[]>('alertes', () => [])

  const nonVues = computed(() => alertes.value.filter((a) => !a.vue).length)

  async function refresh() {
    alertes.value = await $fetch<Alert[]>('/api/alertes')
  }

  async function marquerLues() {
    if (nonVues.value === 0) return
    alertes.value = alertes.value.map((a) => ({ ...a, vue: true }))
    await $fetch('/api/alertes', { method: 'PATCH' })
  }

  async function marquerLue(id: string) {
    const alerte = alertes.value.find((a) => a.id === id)
    if (!alerte || alerte.vue) return
    alerte.vue = true
    await $fetch(`/api/alertes/${id}`, { method: 'PATCH' }).catch(() => {
      alerte.vue = false
    })
  }

  async function verifierMaintenant(): Promise<CheckSummary> {
    const resume = await $fetch<CheckSummary>('/api/check', { method: 'POST' })
    await refresh()
    return resume
  }

  return { alertes, nonVues, refresh, marquerLues, marquerLue, verifierMaintenant }
}

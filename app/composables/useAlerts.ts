import type { Alert } from '~/types'
import type { CheckSummary } from '~/types/check'

export function useAlerts() {
  const alerts = useState<Alert[]>('alertes', () => [])

  const unread = computed(() => alerts.value.filter((a) => !a.vue).length)

  async function refresh() {
    alerts.value = await $fetch<Alert[]>('/api/alertes')
  }

  async function markAllRead() {
    if (unread.value === 0) return
    alerts.value = alerts.value.map((a) => ({ ...a, vue: true }))
    await $fetch('/api/alertes', { method: 'PATCH' })
  }

  async function markRead(id: string) {
    const alert = alerts.value.find((a) => a.id === id)
    if (!alert || alert.vue) return
    alert.vue = true
    await $fetch(`/api/alertes/${id}`, { method: 'PATCH' }).catch(() => {
      alert.vue = false
    })
  }

  async function checkNow(): Promise<CheckSummary> {
    const summary = await $fetch<CheckSummary>('/api/check', { method: 'POST' })
    await refresh()
    return summary
  }

  return { alerts, unread, refresh, markAllRead, markRead, checkNow }
}

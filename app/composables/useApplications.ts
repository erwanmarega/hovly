import type { ApplicationStep, ApplicationStepType, Status } from '~/types'

export interface ApplicationStepInput {
  type: ApplicationStepType
  montant?: number | null
  note?: string | null
  fait_le?: string
}

export function useApplications() {
  // bien_id → étapes de la démarche, triées par date croissante
  const steps = useState<Record<string, ApplicationStep[]>>('application-steps', () => ({}))
  const { biens } = useProperties()

  function stepsFor(bienId: string): ApplicationStep[] {
    return steps.value[bienId] ?? []
  }

  /** Reporte le statut calculé par le serveur sur le bien de l'état partagé. */
  function syncStatus(bienId: string, statut: Status) {
    const b = biens.value.find((x) => x.id === bienId)
    if (b) b.statut = statut
  }

  const byDate = (a: ApplicationStep, b: ApplicationStep) =>
    Date.parse(a.fait_le) - Date.parse(b.fait_le) || Date.parse(a.created_at) - Date.parse(b.created_at)

  async function load(bienId: string): Promise<ApplicationStep[]> {
    const rows = await $fetch<ApplicationStep[]>(`/api/biens/${bienId}/demarches`)
    steps.value = { ...steps.value, [bienId]: rows }
    return rows
  }

  async function add(bienId: string, input: ApplicationStepInput): Promise<Status> {
    const { step, statut } = await $fetch<{ step: ApplicationStep; statut: Status }>(
      `/api/biens/${bienId}/demarches`,
      { method: 'POST', body: input }
    )
    steps.value = { ...steps.value, [bienId]: [...stepsFor(bienId), step].sort(byDate) }
    syncStatus(bienId, statut)
    return statut
  }

  async function remove(step: ApplicationStep): Promise<Status> {
    const { statut } = await $fetch<{ statut: Status }>(`/api/demarches/${step.id}`, {
      method: 'DELETE'
    })
    steps.value = {
      ...steps.value,
      [step.bien_id]: stepsFor(step.bien_id).filter((s) => s.id !== step.id)
    }
    syncStatus(step.bien_id, statut)
    return statut
  }

  return { steps, stepsFor, load, add, remove }
}

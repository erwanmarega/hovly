import type { Property, Transaction } from '~/types'
import { MAX_COMPARISON } from '~/utils/comparator'
import { useProperties } from '~/composables/useProperties'

export function useComparator() {
  const { biens } = useProperties()
  const selection = useState<string[]>('comparateur', () => [])

  const full = computed(() => selection.value.length >= MAX_COMPARISON)
  const count = computed(() => selection.value.length)
  const comparable = computed(() => selection.value.length >= 2)
  const activeTransaction = computed<Transaction | null>(
    () => biens.value.find((b) => b.id === selection.value[0])?.transaction ?? null
  )

  const isSelected = (id: string) => selection.value.includes(id)
  const incompatible = (bien: Pick<Property, 'transaction'>) =>
    activeTransaction.value != null && bien.transaction !== activeTransaction.value

  function toggle(bien: Pick<Property, 'id' | 'transaction'>) {
    if (isSelected(bien.id)) {
      selection.value = selection.value.filter((x) => x !== bien.id)
      return true
    }
    if (full.value || incompatible(bien)) return false
    selection.value = [...selection.value, bien.id]
    return true
  }

  function remove(id: string) {
    selection.value = selection.value.filter((x) => x !== id)
  }

  function clear() {
    selection.value = []
  }

  return {
    selection,
    count,
    full,
    comparable,
    activeTransaction,
    isSelected,
    incompatible,
    toggle,
    remove,
    clear
  }
}

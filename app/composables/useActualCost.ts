import type { Property } from '~/types'
import { actualCost, optionsFromPreferences } from '~/utils/actual-cost'
import { usePreferences } from '~/composables/usePreferences'

export function useActualCost() {
  const { preferences } = usePreferences()

  const options = computed(() => optionsFromPreferences(preferences.value))
  const calculate = (bien: Property) => actualCost(bien, options.value)

  return { options, calculate }
}

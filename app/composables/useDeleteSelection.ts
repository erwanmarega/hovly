/** Sélection multi dédiée à la suppression en masse — état séparé du
 *  comparateur (`useComparator`) : actions et contraintes distinctes. */
export function useDeleteSelection() {
  const active = useState('suppression-masse-active', () => false)
  const selection = useState<string[]>('suppression-masse-selection', () => [])

  const count = computed(() => selection.value.length)

  const isSelected = (id: string) => selection.value.includes(id)

  function toggle(id: string) {
    selection.value = isSelected(id)
      ? selection.value.filter((x) => x !== id)
      : [...selection.value, id]
  }

  function clear() {
    selection.value = []
  }

  function enable() {
    active.value = true
  }

  function disable() {
    active.value = false
    clear()
  }

  return { active, selection, count, isSelected, toggle, clear, enable, disable }
}

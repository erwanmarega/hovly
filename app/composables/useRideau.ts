export const DUREE_RIDEAU_ENTREE = 220

export function useRideau() {
  const visible = useState('rideau-visible', () => false)

  const animationReduite = () =>
    import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  async function couvrir(action: () => Promise<void> | void) {
    if (animationReduite()) {
      await action()
      return
    }

    visible.value = true
    await new Promise((r) => setTimeout(r, DUREE_RIDEAU_ENTREE))

    try {
      await action()
    } finally {
      visible.value = false
    }
  }

  return { visible, couvrir }
}

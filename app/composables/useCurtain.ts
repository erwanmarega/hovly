export const CURTAIN_ENTER_DURATION = 220

export function useCurtain() {
  const visible = useState('rideau-visible', () => false)

  const reducedMotion = () =>
    import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  async function cover(action: () => Promise<void> | void) {
    if (reducedMotion()) {
      await action()
      return
    }

    visible.value = true
    await new Promise((r) => setTimeout(r, CURTAIN_ENTER_DURATION))

    try {
      await action()
    } finally {
      visible.value = false
    }
  }

  return { visible, cover }
}

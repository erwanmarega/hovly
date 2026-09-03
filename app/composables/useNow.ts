export function useNow() {
  const now = useState('now', () => new Date())

  if (import.meta.client) {
    const timer = setInterval(() => {
      now.value = new Date()
    }, 60_000)
    onScopeDispose(() => clearInterval(timer))
  }

  return now
}

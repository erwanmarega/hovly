export function useMaintenant() {
  const maintenant = useState('maintenant', () => new Date())

  if (import.meta.client) {
    const minuterie = setInterval(() => {
      maintenant.value = new Date()
    }, 60_000)
    onScopeDispose(() => clearInterval(minuterie))
  }

  return maintenant
}

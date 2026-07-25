/**
 * Horloge partagée, rafraîchie chaque minute côté client.
 * Évite que « Demain 18 h » reste faux sur un onglet laissé ouvert, et garantit
 * que tous les composants d'une page datent depuis le même instant.
 */
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

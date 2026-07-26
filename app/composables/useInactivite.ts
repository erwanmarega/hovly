const DELAI = 15 * 60_000

const PERIODE_VERIF = 30_000

const THROTTLE_ECRITURE = 5_000

const CLE = 'hovly:derniere-activite'

const EVENEMENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'scroll',
  'click'
] as const

export function useInactivite() {
  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  let derniereEcriture = 0
  let verif: ReturnType<typeof setInterval> | null = null
  let actif = false

  function lire(): number {
    const brut = localStorage.getItem(CLE)
    const valeur = brut ? Number(brut) : NaN
    return Number.isFinite(valeur) ? valeur : 0
  }

  function marquer(force = false) {
    const maintenant = Date.now()
    if (!force && maintenant - derniereEcriture < THROTTLE_ECRITURE) return
    derniereEcriture = maintenant
    localStorage.setItem(CLE, String(maintenant))
  }

  async function deconnecter() {
    arreter()
    localStorage.removeItem(CLE)
    await supabase.auth.signOut()
    await navigateTo('/login?raison=inactivite')
  }

  function verifier() {
    const derniere = lire()
    if (!derniere) {
      marquer(true)
      return
    }
    if (Date.now() - derniere >= DELAI) deconnecter()
  }

  function surActivite() {
    marquer()
  }

  function surVisibilite() {
    if (document.visibilityState !== 'visible') return
    verifier()
    if (actif) marquer()
  }

  function demarrer() {
    if (actif) return
    actif = true
    marquer(true)
    for (const evenement of EVENEMENTS) {
      window.addEventListener(evenement, surActivite, { passive: true })
    }
    document.addEventListener('visibilitychange', surVisibilite)
    verif = setInterval(verifier, PERIODE_VERIF)
  }

  function arreter() {
    if (!actif) return
    actif = false
    for (const evenement of EVENEMENTS) {
      window.removeEventListener(evenement, surActivite)
    }
    document.removeEventListener('visibilitychange', surVisibilite)
    if (verif) clearInterval(verif)
    verif = null
  }

  watch(
    user,
    (u) => {
      if (u) demarrer()
      else arreter()
    },
    { immediate: true }
  )

  return { demarrer, arreter, delai: DELAI }
}

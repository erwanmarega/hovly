const DELAY = 15 * 60_000

const CHECK_PERIOD = 30_000

const WRITE_THROTTLE = 5_000

const KEY = 'hovly:derniere-activite'

const EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'scroll',
  'click'
] as const

export function useInactivity() {
  if (import.meta.server) return

  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  let lastWrite = 0
  let checkInterval: ReturnType<typeof setInterval> | null = null
  let active = false

  function read(): number {
    const raw = localStorage.getItem(KEY)
    const value = raw ? Number(raw) : NaN
    return Number.isFinite(value) ? value : 0
  }

  function mark(force = false) {
    const now = Date.now()
    if (!force && now - lastWrite < WRITE_THROTTLE) return
    lastWrite = now
    localStorage.setItem(KEY, String(now))
  }

  async function signOut() {
    stop()
    localStorage.removeItem(KEY)
    await supabase.auth.signOut()
    await navigateTo('/login?raison=inactivite')
  }

  function check() {
    const last = read()
    if (!last) {
      mark(true)
      return
    }
    if (Date.now() - last >= DELAY) signOut()
  }

  function onActivity() {
    mark()
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return
    check()
    if (active) mark()
  }

  function start() {
    if (active) return
    active = true
    mark(true)
    for (const event of EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    checkInterval = setInterval(check, CHECK_PERIOD)
  }

  function stop() {
    if (!active) return
    active = false
    for (const event of EVENTS) {
      window.removeEventListener(event, onActivity)
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (checkInterval) clearInterval(checkInterval)
    checkInterval = null
  }

  watch(
    user,
    (u) => {
      if (u) start()
      else stop()
    },
    { immediate: true }
  )

  return { start, stop, delay: DELAY }
}

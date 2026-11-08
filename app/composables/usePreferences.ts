import type { Preferences } from '~/types'
import { DEFAULT_PREFERENCES, isCustomized } from '~/composables/useScore'
import { normalize, shouldSync } from '~/utils/preferences'

export function usePreferences() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const preferences = useState<Preferences>('preferences', () => ({ ...DEFAULT_PREFERENCES }))
  const saving = useState('preferences-saving', () => false)
  const expected = useState('preferences-attendu', () => '')
  const hydrated = useState('preferences-hydratees', () => false)

  watchEffect(() => {
    const remote = normalize(user.value?.user_metadata?.preferences)
    if (!shouldSync(remote, expected.value)) return
    expected.value = ''
    preferences.value = remote
  })

  async function hydrate() {
    if (hydrated.value) return
    hydrated.value = true

    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return

    const remote = normalize(data.user.user_metadata?.preferences)
    if (!shouldSync(remote, expected.value)) return

    expected.value = JSON.stringify(remote)
    preferences.value = remote
  }

  if (import.meta.client && user.value) hydrate()

  const customized = computed(() => isCustomized(preferences.value))

  async function save(values: Preferences): Promise<boolean> {
    saving.value = true
    const clean = normalize(values)
    const { error } = await supabase.auth.updateUser({ data: { preferences: clean } })
    saving.value = false
    if (error) return false

    expected.value = JSON.stringify(clean)
    preferences.value = clean

    await supabase.auth.refreshSession()
    return true
  }

  async function reset(): Promise<boolean> {
    return save({ ...DEFAULT_PREFERENCES })
  }

  return { preferences, customized, saving, save, reset }
}

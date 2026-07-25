import type { Preferences } from '~/types'

function normaliser(brut: unknown): Preferences {
  const p = (brut ?? {}) as Partial<Preferences>
  const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

  return {
    budgetMax: nombre(p.budgetMax),
    surfaceMin: nombre(p.surfaceMin),
    piecesMin: nombre(p.piecesMin),
    dpeMin: p.dpeMin ?? null,
    poidsPrix: p.poidsPrix ?? PREFERENCES_DEFAUT.poidsPrix,
    poidsDpe: p.poidsDpe ?? PREFERENCES_DEFAUT.poidsDpe,
    poidsCharges: p.poidsCharges ?? PREFERENCES_DEFAUT.poidsCharges
  }
}

export function usePreferences() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const preferences = useState<Preferences>('preferences', () => ({ ...PREFERENCES_DEFAUT }))
  const enregistrement = useState('preferences-saving', () => false)

  watchEffect(() => {
    preferences.value = normaliser(user.value?.user_metadata?.preferences)
  })

  const personnalise = computed(() => estPersonnalise(preferences.value))

  async function enregistrer(valeurs: Preferences): Promise<boolean> {
    enregistrement.value = true
    const propres = normaliser(valeurs)
    const { error } = await supabase.auth.updateUser({ data: { preferences: propres } })
    enregistrement.value = false
    if (error) return false
    preferences.value = propres
    return true
  }

  async function reinitialiser(): Promise<boolean> {
    return enregistrer({ ...PREFERENCES_DEFAUT })
  }

  return { preferences, personnalise, enregistrement, enregistrer, reinitialiser }
}

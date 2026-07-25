import type { Ancre, ModeTrajet, Preferences } from '~/types'

const MODES: ModeTrajet[] = ['voiture', 'velo', 'marche', 'transport']

export const MAX_ANCRES = 5

/** L'identifiant part dans une requête PostgREST : on le garde alphanumérique. */
const idPropre = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[^a-z0-9-]/gi, '').slice(0, 32) : ''

function ancresValides(brut: unknown): Ancre[] {
  if (!Array.isArray(brut)) return []

  const vues = new Set<string>()
  const out: Ancre[] = []

  for (const a of brut) {
    const id = idPropre(a?.id)
    if (!id || vues.has(id)) continue
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue

    vues.add(id)
    out.push({
      id,
      label: String(a.label ?? '').slice(0, 40) || 'Ancre',
      adresse: String(a.adresse ?? '').slice(0, 200),
      lat: a.lat,
      lon: a.lon,
      mode: MODES.includes(a.mode) ? a.mode : 'voiture',
      maxMinutes:
        typeof a.maxMinutes === 'number' && Number.isFinite(a.maxMinutes) && a.maxMinutes > 0
          ? Math.round(a.maxMinutes)
          : null
    })
    if (out.length >= MAX_ANCRES) break
  }

  return out
}

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
    poidsCharges: p.poidsCharges ?? PREFERENCES_DEFAUT.poidsCharges,
    prixKwh: nombre(p.prixKwh),
    chauffageDansCharges: p.chauffageDansCharges === true,
    ancres: ancresValides(p.ancres)
  }
}

/**
 * Après `updateUser`, le ref `user` peut encore porter les anciennes métadonnées.
 * Tant qu'il n'a pas rattrapé notre dernière écriture, on ne resynchronise pas :
 * sinon la valeur fraîchement enregistrée serait écrasée à l'écran.
 */
export function doitSynchroniser(distant: Preferences, attendu: string): boolean {
  return !attendu || JSON.stringify(distant) === attendu
}

export function usePreferences() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  const preferences = useState<Preferences>('preferences', () => ({ ...PREFERENCES_DEFAUT }))
  const enregistrement = useState('preferences-saving', () => false)
  /** Signature de la dernière valeur de référence, en attente côté `user`. */
  const attendu = useState('preferences-attendu', () => '')
  const hydratees = useState('preferences-hydratees', () => false)

  // `useSupabaseUser()` expose les claims du JWT : une photo prise à l'émission
  // du token, pas l'état courant du compte. Elle sert de valeur de départ.
  watchEffect(() => {
    const distant = normaliser(user.value?.user_metadata?.preferences)
    if (!doitSynchroniser(distant, attendu.value)) return
    attendu.value = ''
    preferences.value = distant
  })

  /**
   * Le JWT n'est réémis qu'au rafraîchissement du token : après un
   * enregistrement, un rechargement de page relirait des préférences périmées.
   * On interroge donc une fois le compte lui-même, qui fait autorité.
   */
  async function hydrater() {
    if (hydratees.value) return
    hydratees.value = true

    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return

    const distant = normaliser(data.user.user_metadata?.preferences)
    if (!doitSynchroniser(distant, attendu.value)) return

    // Fait aussi barrage aux claims périmés jusqu'à ce qu'ils rattrapent.
    attendu.value = JSON.stringify(distant)
    preferences.value = distant
  }

  if (import.meta.client && user.value) hydrater()

  const personnalise = computed(() => estPersonnalise(preferences.value))

  async function enregistrer(valeurs: Preferences): Promise<boolean> {
    enregistrement.value = true
    const propres = normaliser(valeurs)
    const { error } = await supabase.auth.updateUser({ data: { preferences: propres } })
    enregistrement.value = false
    if (error) return false

    attendu.value = JSON.stringify(propres)
    preferences.value = propres

    // Sans nouveau token, le prochain chargement relirait les anciennes valeurs.
    await supabase.auth.refreshSession()
    return true
  }

  async function reinitialiser(): Promise<boolean> {
    return enregistrer({ ...PREFERENCES_DEFAUT })
  }

  return { preferences, personnalise, enregistrement, enregistrer, reinitialiser }
}

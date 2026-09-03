import type { Anchor, TravelMode, Preferences } from '~/types'

const MODES: TravelMode[] = ['voiture', 'velo', 'marche', 'transport']

export const MAX_ANCHORS = 5

const cleanId = (v: unknown) =>
  typeof v === 'string' ? v.replace(/[^a-z0-9-]/gi, '').slice(0, 32) : ''

function validAnchors(raw: unknown): Anchor[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const out: Anchor[] = []

  for (const a of raw) {
    const id = cleanId(a?.id)
    if (!id || seen.has(id)) continue
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') continue
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue

    seen.add(id)
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
    if (out.length >= MAX_ANCHORS) break
  }

  return out
}

function normalize(raw: unknown): Preferences {
  const p = (raw ?? {}) as Partial<Preferences>
  const number = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

  return {
    budgetMax: number(p.budgetMax),
    surfaceMin: number(p.surfaceMin),
    piecesMin: number(p.piecesMin),
    dpeMin: p.dpeMin ?? null,
    poidsPrix: p.poidsPrix ?? DEFAULT_PREFERENCES.poidsPrix,
    poidsDpe: p.poidsDpe ?? DEFAULT_PREFERENCES.poidsDpe,
    poidsCharges: p.poidsCharges ?? DEFAULT_PREFERENCES.poidsCharges,
    prixKwh: number(p.prixKwh),
    chauffageDansCharges: p.chauffageDansCharges === true,
    budgetAchatMax: number(p.budgetAchatMax),
    apport: number(p.apport),
    tauxEmprunt: number(p.tauxEmprunt),
    dureeEmpruntAns: number(p.dureeEmpruntAns),
    ancres: validAnchors(p.ancres)
  }
}

export function shouldSync(remote: Preferences, expected: string): boolean {
  return !expected || JSON.stringify(remote) === expected
}

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

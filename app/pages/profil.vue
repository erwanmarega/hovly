<script setup lang="ts">
useHead({ title: 'Mon profil — Hovly' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { biens, refresh } = useBiens()

useAsyncData('biens', () => refresh(), { server: false })

const email = computed(() => user.value?.email ?? '')
const provider = computed(() => user.value?.app_metadata?.provider ?? 'email')
const initiale = computed(() => (fullName.value || email.value || '?').charAt(0).toUpperCase())
const membreDepuis = computed(() => {
  const d = user.value?.created_at
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
})

const nbBiens = computed(() => biens.value.length)
const coups = computed(() => biens.value.filter((b) => b.statut === 'coup_de_coeur').length)

const fullName = ref('')
watchEffect(() => {
  fullName.value = (user.value?.user_metadata?.full_name as string) ?? ''
})

const savingName = ref(false)
const nameMsg = ref('')
async function saveName() {
  nameMsg.value = ''
  savingName.value = true
  const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.value } })
  savingName.value = false
  nameMsg.value = error ? 'Erreur. Réessaie.' : 'Nom mis à jour ✓'
}

const newPassword = ref('')
const savingPwd = ref(false)
const pwdMsg = ref('')
const pwdErr = ref(false)
async function savePassword() {
  pwdMsg.value = ''
  if (newPassword.value.length < 6) {
    pwdErr.value = true
    pwdMsg.value = '6 caractères minimum.'
    return
  }
  savingPwd.value = true
  const { error } = await supabase.auth.updateUser({ password: newPassword.value })
  savingPwd.value = false
  pwdErr.value = !!error
  pwdMsg.value = error ? error.message : 'Mot de passe modifié ✓'
  if (!error) newPassword.value = ''
}

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const labelCls = 'block text-sm font-medium text-ink mb-1.5'
const inputCls =
  'h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition'
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">

    <header class="sticky top-0 z-20 border-b border-hairline bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <HovlyLink />
        <NuxtLink
          to="/dashboard"
          class="rounded-full border border-hairline bg-white px-4 py-2 text-sm font-medium text-steel hover:bg-surface transition"
        >
          ← Mes biens
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-6 py-10">

      <div class="flex items-center gap-4">
        <div class="grid size-16 place-items-center rounded-full bg-brand text-2xl font-bold text-ink">
          {{ initiale }}
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink-deep">
            {{ fullName || 'Mon profil' }}
          </h1>
          <p class="text-slate">{{ email }}</p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-3 gap-4">
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Biens suivis</p>
          <p class="mt-2 text-2xl font-bold tracking-tight">{{ nbBiens }}</p>
        </div>
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Coups de cœur</p>
          <p class="mt-2 text-2xl font-bold tracking-tight">{{ coups }}</p>
        </div>
        <div class="rounded-2xl border border-hairline-soft bg-white p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">Connexion</p>
          <p class="mt-2 text-2xl font-bold tracking-tight capitalize">{{ provider }}</p>
        </div>
      </div>

      <div class="mt-8 rounded-2xl border border-hairline bg-white p-6">
        <h2 class="text-lg font-semibold">Informations</h2>
        <div class="mt-4 space-y-4">
          <div>
            <label :class="labelCls">Nom affiché</label>
            <div class="flex gap-3">
              <input v-model="fullName" type="text" placeholder="Ton nom" :class="inputCls + ' flex-1'" />
              <button
                @click="saveName"
                :disabled="savingName"
                class="h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-black transition disabled:opacity-60"
              >
                {{ savingName ? '…' : 'Enregistrer' }}
              </button>
            </div>
            <p v-if="nameMsg" class="mt-2 text-sm font-medium text-success">{{ nameMsg }}</p>
          </div>

          <div>
            <label :class="labelCls">Email</label>
            <input :value="email" type="email" disabled :class="inputCls + ' bg-surface text-steel'" />
            <p class="mt-1.5 text-xs text-stone">Membre depuis le {{ membreDepuis }}.</p>
          </div>
        </div>
      </div>

      <div v-if="provider === 'email'" class="mt-6 rounded-2xl border border-hairline bg-white p-6">
        <h2 class="text-lg font-semibold">Sécurité</h2>
        <div class="mt-4">
          <label :class="labelCls">Nouveau mot de passe</label>
          <div class="flex gap-3">
            <input
              v-model="newPassword"
              type="password"
              autocomplete="new-password"
              placeholder="••••••••"
              :class="inputCls + ' flex-1'"
            />
            <button
              @click="savePassword"
              :disabled="savingPwd"
              class="h-11 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-white hover:bg-black transition disabled:opacity-60"
            >
              {{ savingPwd ? '…' : 'Changer' }}
            </button>
          </div>
          <p v-if="pwdMsg" class="mt-2 text-sm font-medium" :class="pwdErr ? 'text-coral-soft' : 'text-success'">
            {{ pwdMsg }}
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end">
        <button
          @click="logout"
          class="flex items-center gap-2 rounded-full border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-steel hover:bg-surface hover:text-ink transition"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
          </svg>
          Se déconnecter
        </button>
      </div>
    </main>
  </div>
</template>

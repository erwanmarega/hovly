<script setup lang="ts">
useHead({ title: 'Connexion — Hovly' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})

const email = ref('')
const password = ref('')
const loading = ref(false)
const envoiLien = ref(false)
const error = ref('')
const info = ref('')

const route = useRoute()
const inactivite = computed(() => route.query.raison === 'inactivite')

const occupe = computed(() => loading.value || envoiLien.value)

function reinitialiserMessages() {
  error.value = ''
  info.value = ''
}

async function handleLogin() {
  reinitialiserMessages()
  if (!email.value || !password.value) {
    error.value = 'Renseigne ton email et ton mot de passe.'
    return
  }

  loading.value = true
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  loading.value = false

  if (err) {
    error.value = 'Email ou mot de passe incorrect.'
    return
  }
  await navigateTo('/dashboard')
}

async function motDePasseOublie() {
  reinitialiserMessages()
  if (!email.value) {
    error.value = 'Renseigne ton email, on t’envoie un lien de réinitialisation.'
    return
  }

  envoiLien.value = true
  const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: `${window.location.origin}/confirm`
  })
  envoiLien.value = false

  if (err) {
    error.value = 'Envoi impossible pour le moment. Réessaie dans un instant.'
    return
  }
  info.value = 'Lien envoyé. Regarde ta boîte mail, puis change ton mot de passe depuis ton profil.'
}
</script>

<template>
  <div class="flex min-h-screen bg-white text-ink antialiased">
    <div class="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-1/2">
      <header class="mx-auto w-full max-w-sm">
        <HovlyLink />
      </header>

      <div class="flex flex-1 items-center justify-center py-10">
        <div class="w-full max-w-sm">
          <h1 class="text-4xl font-light tracking-tight text-ink-deep">Bon retour</h1>
          <p class="mt-2 text-slate">Connecte-toi pour retrouver tes biens.</p>

          <p
            v-if="inactivite"
            class="mt-6 flex items-start gap-2.5 rounded-xl bg-surface-yellow px-4 py-3 text-sm text-ink-deep/70"
          >
            <svg
              class="mt-0.5 size-4 shrink-0 text-brand-deep"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            Tu as été déconnecté après 15 minutes d’inactivité.
          </p>

          <BoutonGoogle
            class="mt-8"
            :disabled="occupe"
            @erreur="error = $event"
          />

          <div class="my-7 flex items-center gap-4">
            <span class="h-px flex-1 bg-hairline" />
            <span class="text-xs uppercase tracking-wider text-stone">ou</span>
            <span class="h-px flex-1 bg-hairline" />
          </div>

          <form class="space-y-4" @submit.prevent="handleLogin">
            <ChampTexte
              id="email"
              v-model="email"
              label="Email"
              type="email"
              autocomplete="email"
              placeholder="toi@exemple.com"
              autofocus
              :invalide="!!error"
            />

            <ChampTexte
              id="password"
              v-model="password"
              label="Mot de passe"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              :invalide="!!error"
            >
              <template #action>
                <button
                  type="button"
                  class="text-xs font-medium text-blue transition hover:underline disabled:opacity-60"
                  :disabled="occupe"
                  @click="motDePasseOublie"
                >
                  {{ envoiLien ? 'Envoi…' : 'Oublié ?' }}
                </button>
              </template>
            </ChampTexte>

            <p
              v-if="error"
              role="alert"
              class="flex items-start gap-2 rounded-xl bg-coral/60 px-4 py-3 text-sm font-medium text-[#600000]"
            >
              <svg
                class="mt-0.5 size-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {{ error }}
            </p>

            <p
              v-else-if="info"
              role="status"
              class="rounded-xl bg-teal/50 px-4 py-3 text-sm font-medium text-[#0a4a42]"
            >
              {{ info }}
            </p>

            <button
              type="submit"
              :disabled="occupe"
              class="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-white transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-ink-deep/20 disabled:opacity-60"
            >
              <span
                v-if="loading"
                class="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              />
              {{ loading ? 'Connexion…' : 'Se connecter' }}
            </button>
          </form>

          <p class="mt-8 text-center text-sm text-slate">
            Pas encore de compte ?
            <NuxtLink to="/signup" class="font-medium text-blue hover:underline">
              Créer un compte
            </NuxtLink>
          </p>
        </div>
      </div>

      <p class="mx-auto w-full max-w-sm text-center text-xs text-stone">
        Hovly ne publie rien et ne contacte aucune agence à ta place.
      </p>
    </div>

    <PanneauMarque />
  </div>
</template>

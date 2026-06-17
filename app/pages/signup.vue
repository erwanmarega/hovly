<script setup lang="ts">
useHead({ title: 'Créer un compte — Hovly' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

watchEffect(() => {
  if (user.value) navigateTo('/dashboard')
})

const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const info = ref('')

async function handleSignup() {
  error.value = ''
  info.value = ''
  if (!email.value || !password.value) {
    error.value = 'Renseigne ton email et ton mot de passe.'
    return
  }
  if (password.value.length < 6) {
    error.value = 'Mot de passe : 6 caractères minimum.'
    return
  }
  loading.value = true
  const { data, error: err } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: { full_name: name.value },
      emailRedirectTo: `${window.location.origin}/confirm`
    }
  })
  loading.value = false
  if (err) {
    error.value = err.message
    return
  }
  if (data.session) {
    await navigateTo('/dashboard')
  } else {
    info.value = 'Vérifie ta boîte mail pour confirmer ton compte.'
  }
}

async function handleGoogle() {
  error.value = ''
  const { error: err } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` }
  })
  if (err) error.value = 'Connexion Google impossible.'
}
</script>

<template>
  <div class="min-h-screen flex bg-white text-ink antialiased">
    <div class="flex w-full lg:w-1/2 flex-col px-6 py-8">
      <header class="mx-auto w-full max-w-sm">
        <HovlyLink />
      </header>

      <div class="flex flex-1 items-center justify-center">
        <div class="w-full max-w-sm">
          <h1 class="text-3xl font-bold tracking-tight text-ink-deep">Crée ton compte</h1>
          <p class="mt-2 text-slate">Centralise tous tes biens en un seul endroit.</p>

          <button
            type="button"
            @click="handleGoogle"
            class="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-hairline-strong bg-white px-5 py-3 text-sm font-medium hover:bg-surface transition"
          >
            <svg class="size-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continuer avec Google
          </button>

          <div class="my-6 flex items-center gap-4">
            <span class="h-px flex-1 bg-hairline"></span>
            <span class="text-xs text-stone">ou</span>
            <span class="h-px flex-1 bg-hairline"></span>
          </div>

          <form @submit.prevent="handleSignup" class="space-y-4">
            <div>
              <label for="name" class="block text-sm font-medium text-ink mb-1.5">Prénom et Nom</label>
              <input
                id="name"
                v-model="name"
                type="text"
                autocomplete="name"
                placeholder="Ousmane Dembélé"
                class="h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
              />
            </div>
            <div>
              <label for="email" class="block text-sm font-medium text-ink mb-1.5">Email</label>
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                placeholder="toi@exemple.com"
                class="h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
              />
            </div>
            <div>
              <label for="password" class="block text-sm font-medium text-ink mb-1.5">Mot de passe</label>
              <input
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                placeholder="••••••••"
                class="h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
              />
            </div>

            <p v-if="error" class="text-sm text-coral-soft font-medium">{{ error }}</p>
            <p v-if="info" class="text-sm text-success font-medium">{{ info }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="h-11 w-full rounded-full bg-ink text-white text-sm font-medium hover:bg-black transition disabled:opacity-60"
            >
              {{ loading ? 'Création…' : 'Créer mon compte' }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate">
            Tu as déjà un compte ?
            <NuxtLink to="/login" class="font-medium text-blue hover:underline">Se connecter</NuxtLink>
          </p>
        </div>
      </div>
    </div>

    <div class="hidden lg:flex lg:w-1/2 items-center justify-center bg-brand relative overflow-hidden">
    </div>
  </div>
</template>

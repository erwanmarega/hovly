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

          <BoutonGoogle class="mt-8" :disabled="loading" @erreur="error = $event" />

          <div class="my-6 flex items-center gap-4">
            <span class="h-px flex-1 bg-hairline"/>
            <span class="text-xs text-stone">ou</span>
            <span class="h-px flex-1 bg-hairline"/>
          </div>

          <form class="space-y-4" @submit.prevent="handleSignup">
            <div>
              <label for="name" class="block text-sm font-medium text-ink mb-1.5">Prénom et Nom</label>
              <input
                id="name"
                v-model="name"
                type="text"
                autocomplete="name"
                placeholder="Ousmane Dembélé"
                class="h-11 w-full rounded-lg border border-hairline-strong bg-white px-4 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
              >
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
              >
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
              >
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

    <PanneauMarque
      titre="Arrête de jongler entre douze onglets."
      accroche="Un seul tableau pour tous tes biens : score, coût réel, temps de trajet, historique des prix."
    />
  </div>
</template>

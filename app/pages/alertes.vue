<script setup lang="ts">
import type { Alerte } from '~/types'

useHead({ title: 'Alertes — Hovly' })

const { alertes, nonVues, refresh, marquerLues, verifierMaintenant } = useAlertes()

const { pending } = useAsyncData('alertes', () => refresh(), { server: false })

const checking = ref(false)
const checkMsg = ref('')
async function lancerVerif() {
  checking.value = true
  checkMsg.value = ''
  try {
    const r = await verifierMaintenant()
    checkMsg.value =
      r.alertes.length > 0
        ? `${r.baisses} baisse(s), ${r.supprimes} supprimée(s) sur ${r.verifies} bien(s).`
        : `Aucun changement (${r.verifies} bien(s) vérifié(s)).`
  } catch {
    checkMsg.value = 'Vérification impossible (clé service Supabase manquante ?).'
  }
  checking.value = false
}

const eur = (c: number | null) => (c == null ? '—' : Math.round(c / 100).toLocaleString('fr-FR') + ' €')

function dateRel(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function libelle(a: Alerte) {
  return a.type === 'baisse_prix' ? 'Baisse de prix' : 'Annonce supprimée'
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">

    <header class="sticky top-0 z-20 border-b border-hairline bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
        <div class="flex items-center gap-8">
          <HovlyLink />
          <nav class="hidden md:flex items-center gap-1 text-sm font-medium text-steel">
            <NuxtLink to="/dashboard" class="rounded-full px-3.5 py-1.5 hover:bg-surface">Mes biens</NuxtLink>
            <span class="rounded-full bg-ink px-3.5 py-1.5 text-white">Alertes</span>
          </nav>
        </div>
        <button
          @click="lancerVerif"
          :disabled="checking"
          class="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-black transition disabled:opacity-60"
        >
          <span v-if="checking" class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
          {{ checking ? 'Vérification…' : 'Vérifier maintenant' }}
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-4xl px-6 py-8">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-3xl font-light tracking-tight text-ink-deep">Alertes</h1>
          <p class="mt-1 text-slate">Baisses de prix et annonces disparues.</p>
        </div>
        <button
          v-if="nonVues > 0"
          @click="marquerLues"
          class="text-sm font-medium text-blue hover:underline"
        >
          Tout marquer comme lu
        </button>
      </div>

      <p v-if="checkMsg" class="mt-4 rounded-xl bg-white border border-hairline px-4 py-3 text-sm text-slate">
        {{ checkMsg }}
      </p>

      <div v-if="pending" class="py-20 text-center">
        <div class="mx-auto size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"></div>
      </div>

      <div v-else-if="alertes.length === 0" class="mt-8 rounded-2xl border border-hairline bg-white py-16 text-center">
        <p class="text-slate">Aucune alerte pour l'instant.</p>
        <p class="mt-1 text-sm text-stone">Lance une vérification pour scanner tes biens.</p>
      </div>

      <div v-else class="mt-6 space-y-3">
        <NuxtLink
          v-for="a in alertes"
          :key="a.id"
          :to="`/bien/${a.bien_id}`"
          class="flex items-center gap-4 rounded-2xl border bg-white p-4 transition hover:border-hairline-strong"
          :class="a.vue ? 'border-hairline-soft' : 'border-blue/40 ring-1 ring-blue/10'"
        >
          <div
            class="grid size-11 shrink-0 place-items-center rounded-xl text-lg"
            :class="a.type === 'baisse_prix' ? 'bg-teal' : 'bg-coral'"
          >
            {{ a.type === 'baisse_prix' ? '📉' : '⚠️' }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">{{ libelle(a) }}</span>
              <span v-if="!a.vue" class="size-2 rounded-full bg-blue"></span>
            </div>
            <p class="truncate text-sm text-slate">{{ a.biens?.titre ?? 'Bien' }}</p>
          </div>
          <div class="text-right">
            <p v-if="a.type === 'baisse_prix'" class="text-sm font-semibold">
              <s class="text-stone font-normal">{{ eur(a.ancien_prix) }}</s>
              → <span class="text-success">{{ eur(a.nouveau_prix) }}</span>
            </p>
            <p class="mt-0.5 text-xs text-stone">{{ dateRel(a.envoyee_le) }}</p>
          </div>
        </NuxtLink>
      </div>
    </main>
  </div>
</template>

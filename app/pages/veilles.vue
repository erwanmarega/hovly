<script setup lang="ts">
import type { SavedSearch } from '~/types'

useHead({ title: 'Veilles — Hovly' })

const route = useRoute()
const {
  searches,
  results,
  newCount,
  refresh,
  create,
  update,
  remove,
  scan,
  loadResults,
  keep,
  ignore
} = useWatches()

const { pending } = useAsyncData('veilles', () => refresh(), { server: false })

const formOpen = ref(false)
const initialUrl = ref(String(route.query.url ?? ''))
const creating = ref(false)
const createError = ref('')

const open = ref<string | null>(String(route.query.recherche ?? '') || null)
const scanning = ref<string | null>(null)
const busyResult = ref<string | null>(null)
const message = ref('')
const messageIsError = ref(false)

if (initialUrl.value) formOpen.value = true

function announce(text: string, error = false) {
  message.value = text
  messageIsError.value = error
}

const readableError = (e: unknown) => errorMessage(e, 'Une erreur est survenue.')

async function toggle(id: string) {
  if (open.value === id) {
    open.value = null
    return
  }
  open.value = id
  if (!results.value[id]) {
    await loadResults(id, 'nouveau').catch(() => announce('Chargement impossible.', true))
  }
}

async function createWatch(payload: Partial<SavedSearch>) {
  creating.value = true
  createError.value = ''
  try {
    const r = await create(payload)
    formOpen.value = false
    initialUrl.value = ''
    announce(`Veille « ${r.label} » créée. Premier scan en cours…`)
    await runScan(r.id)
  } catch (e) {
    createError.value = readableError(e)
  }
  creating.value = false
}

async function runScan(id: string) {
  scanning.value = id
  try {
    const summary = await scan(id)
    open.value = id
    announce(
      summary.nouvelles.length
        ? `${summary.nouvelles.length} nouveauté(s) sur ${summary.trouvees} annonce(s) lues.`
        : `Aucune nouveauté — ${summary.trouvees} annonce(s) lues, ${summary.connues} déjà connue(s), ${summary.filtrees} hors filtres.`
    )
  } catch (e) {
    await refresh()
    announce(readableError(e), true)
  }
  scanning.value = null
}

async function togglePause(id: string, active: boolean) {
  await update(id, { active }).catch(() => announce('Modification impossible.', true))
}

const searchToDelete = ref<SavedSearch | null>(null)
const deleting = ref(false)

function requestDelete(id: string) {
  searchToDelete.value = searches.value.find((x) => x.id === id) ?? null
}

async function confirmDelete() {
  const r = searchToDelete.value
  if (!r) return
  deleting.value = true
  await remove(r.id).catch(() => announce('Suppression impossible.', true))
  deleting.value = false
  searchToDelete.value = null
}

async function keepResult(searchId: string, resultId: string) {
  busyResult.value = resultId
  try {
    const bien = await keep(searchId, resultId)
    announce(`« ${bien.titre} » ajouté à tes biens.`)
  } catch (e) {
    announce(readableError(e), true)
  }
  busyResult.value = null
}

async function ignoreResult(searchId: string, resultId: string) {
  busyResult.value = resultId
  await ignore(searchId, resultId).catch(() => announce('Action impossible.', true))
  busyResult.value = null
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-6 py-8">
      <BreadcrumbTrail
        class="mb-5"
        :items="[{ label: 'Mes biens', to: '/dashboard' }, { label: 'Veilles' }]"
      />

      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 md:px-10 md:py-10"
      >
        <span
          class="halo pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-white/50 blur-3xl"
        />
        <LogoWatermark />

        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
              Recherche automatique
            </p>
            <h1 class="mt-2 text-4xl font-light tracking-tight text-ink md:text-5xl">Veilles</h1>
            <p class="mt-2 max-w-sm text-ink/60">
              Hovly rescanne tes pages de résultats et te prévient dès qu'une annonce
              correspond.
            </p>
          </div>

          <button
            v-if="!formOpen"
            class="action flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
            @click="formOpen = true"
          >
            <span class="text-base leading-none">+</span>
            Nouvelle veille
          </button>
        </div>

        <div v-if="searches.length" class="relative mt-7 flex flex-wrap gap-6 text-ink">
          <p>
            <span class="text-2xl font-semibold tabular-nums">{{ searches.length }}</span>
            <span class="ml-1.5 text-sm text-ink/60">veille(s)</span>
          </p>
          <p>
            <span class="text-2xl font-semibold tabular-nums">{{ newCount }}</span>
            <span class="ml-1.5 text-sm text-ink/60">nouveauté(s) en attente</span>
          </p>
        </div>
      </section>

      <p
        v-if="message"
        class="mt-5 rounded-xl px-4 py-3 text-sm"
        :class="messageIsError ? 'bg-coral/20 text-[#600000]' : 'bg-teal/30 text-[#0a4a42]'"
      >
        {{ message }}
      </p>

      <WatchForm
        v-if="formOpen"
        class="mt-5"
        :initial-url="initialUrl"
        :loading="creating"
        :error="createError"
        @submit="createWatch"
        @cancel="formOpen = false"
      />

      <div v-if="pending" class="mt-6 space-y-3">
        <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-2xl bg-white" />
      </div>

      <div
        v-else-if="!searches.length && !formOpen"
        class="mt-6 rounded-2xl border border-dashed border-hairline-strong bg-white p-10 text-center"
      >
        <h2 class="font-medium text-ink">Aucune veille pour l'instant</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-slate">
          En location, la vitesse fait tout. Colle l'URL d'une page de résultats SeLoger,
          Leboncoin ou PAP : Hovly la surveille pour toi et te notifie des nouvelles annonces.
        </p>
        <button
          class="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
          @click="formOpen = true"
        >
          Créer ma première veille
        </button>
      </div>

      <div v-else class="mt-6 space-y-3">
        <WatchCard
          v-for="r in searches"
          :key="r.id"
          :search="r"
          :open="open === r.id"
          :scanning="scanning === r.id"
          @toggle="toggle"
          @scan="runScan"
          @pause="togglePause"
          @remove="requestDelete"
        >
          <div v-if="!results[r.id]" class="h-16 animate-pulse rounded-xl bg-white" />

          <p v-else-if="!results[r.id]?.length" class="px-1 py-3 text-center text-sm text-stone">
            Rien en attente. Le prochain scan te préviendra.
          </p>

          <div v-else class="space-y-2.5">
            <ResultCard
              v-for="res in results[r.id]"
              :key="res.id"
              :result="res"
              :busy="busyResult === res.id"
              @keep="keepResult(r.id, $event)"
              @ignore="ignoreResult(r.id, $event)"
            />
          </div>
        </WatchCard>
      </div>

      <DeleteConfirmationModal
        :open="searchToDelete !== null"
        title="Supprimer cette veille ?"
        :name="searchToDelete?.label"
        message="La veille et ses résultats en attente seront définitivement supprimés."
        :loading="deleting"
        @cancel="searchToDelete = null"
        @confirm="confirmDelete"
      />
    </main>
  </div>
</template>

<style scoped>
.action {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease;
}
.action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgb(5 0 56 / 12%);
}

@media (prefers-reduced-motion: reduce) {
  .action:hover:not(:disabled) {
    transform: none;
  }
}
</style>

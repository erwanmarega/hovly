<script setup lang="ts">
import type { SavedSearch } from '~/types'

const props = withDefaults(
  defineProps<{
    initialUrl?: string
    loading?: boolean
    error?: string
  }>(),
  { initialUrl: '', loading: false, error: '' }
)

const emit = defineEmits<{
  submit: [payload: Partial<SavedSearch>]
  cancel: []
}>()

const url = ref(props.initialUrl)
const label = ref('')
const prixMax = ref<number | null>(null)
const prixMin = ref<number | null>(null)
const surfaceMin = ref<number | null>(null)
const piecesMin = ref<number | null>(null)
const frequency = ref(60)

watch(
  () => props.initialUrl,
  (v) => {
    if (v) url.value = v
  }
)

const FREQUENCIES = [
  { value: 30, label: 'Toutes les 30 min' },
  { value: 60, label: 'Toutes les heures' },
  { value: 180, label: 'Toutes les 3 h' },
  { value: 720, label: 'Deux fois par jour' },
  { value: 1440, label: 'Une fois par jour' }
]

const source = computed(() => (url.value ? detecterSource(url.value) : null))
const validUrl = computed(() => !url.value || !!source.value)

function submit() {
  if (!url.value || !validUrl.value) return

  emit('submit', {
    url: url.value.trim(),
    label: label.value.trim(),
    prix_max: toCents(prixMax.value),
    prix_min: toCents(prixMin.value),
    surface_min: surfaceMin.value,
    pieces_min: piecesMin.value,
    frequence_min: frequency.value
  })
}
</script>

<template>
  <form
    class="rounded-2xl border border-hairline-soft bg-white p-5"
    @submit.prevent="submit"
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="font-medium text-ink">Nouvelle veille</h2>
        <p class="mt-1 text-sm text-slate">
          Fais ta recherche sur le site (ville, budget, filtres), puis colle l'URL de la page
          de résultats. Hovly la rescanne et te prévient dès qu'une annonce apparaît.
        </p>
      </div>
      <SourceLogo v-if="source" :source="source" :with-name="false" :size="28" />
    </div>

    <div class="mt-4 space-y-4">
      <TextField
        id="veille-url"
        v-model="url"
        label="URL de la page de résultats"
        type="url"
        placeholder="https://www.seloger.com/list.htm?..."
        :invalid="!validUrl"
      />
      <p v-if="!validUrl" class="-mt-3 text-xs text-[#600000]">
        Site non supporté. Sites gérés : SeLoger, Leboncoin, PAP, Logic-Immo, Bien’ici,
        Century 21.
      </p>

      <LeboncoinNotice v-if="source === 'leboncoin'" context="veille" class="-mt-1" />

      <TextField
        id="veille-label"
        v-model="label"
        label="Nom de la veille"
        placeholder="Paris 11e — T2 sous 1 200 €"
      />

      <fieldset>
        <legend class="mb-1.5 text-sm font-medium text-ink">
          Filtres
          <span class="font-normal text-stone">(optionnels, en plus de ceux du site)</span>
        </legend>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label class="block">
            <span class="text-xs text-stone">Prix min (€)</span>
            <input
              v-model.number="prixMin"
              type="number"
              min="0"
              class="mt-1 h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm tabular-nums outline-none transition focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
            >
          </label>
          <label class="block">
            <span class="text-xs text-stone">Prix max (€)</span>
            <input
              v-model.number="prixMax"
              type="number"
              min="0"
              class="mt-1 h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm tabular-nums outline-none transition focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
            >
          </label>
          <label class="block">
            <span class="text-xs text-stone">Surface min (m²)</span>
            <input
              v-model.number="surfaceMin"
              type="number"
              min="0"
              class="mt-1 h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm tabular-nums outline-none transition focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
            >
          </label>
          <label class="block">
            <span class="text-xs text-stone">Pièces min</span>
            <input
              v-model.number="piecesMin"
              type="number"
              min="0"
              class="mt-1 h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm tabular-nums outline-none transition focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
            >
          </label>
        </div>
      </fieldset>

      <label class="block">
        <span class="mb-1.5 block text-sm font-medium text-ink">Fréquence</span>
        <select
          v-model.number="frequency"
          class="h-11 w-full rounded-xl border border-hairline-strong bg-white px-3 text-sm outline-none transition focus:border-ink-deep focus:ring-4 focus:ring-ink-deep/10"
        >
          <option v-for="f in FREQUENCIES" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="mt-4 rounded-xl bg-coral/20 px-3 py-2 text-sm text-[#600000]">
      {{ error }}
    </p>

    <div class="mt-5 flex items-center justify-end gap-2">
      <button
        type="button"
        class="rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-steel transition hover:bg-surface"
        @click="emit('cancel')"
      >
        Annuler
      </button>
      <button
        type="submit"
        :disabled="!url || !validUrl || loading"
        class="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
      >
        <span
          v-if="loading"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
        Créer la veille
      </button>
    </div>
  </form>
</template>

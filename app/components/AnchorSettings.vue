<script setup lang="ts">
import type { Anchor, TravelMode } from '~/types'

const props = defineProps<{ anchors: Anchor[] }>()
const emit = defineEmits<{ 'update:anchors': [anchors: Anchor[]] }>()

const MODES: { value: TravelMode; label: string }[] = [
  { value: 'transport', label: 'Transports' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'velo', label: 'Vélo' },
  { value: 'marche', label: 'À pied' }
]

const label = ref('')
const address = ref('')
const mode = ref<TravelMode>('transport')
const maxMinutes = ref<number | null>(null)
const searching = ref(false)
const error = ref('')

const full = computed(() => props.anchors.length >= MAX_ANCHORS)

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-stone mb-1.5'
const inputCls =
  'w-full rounded-lg border border-hairline-strong bg-white px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20'

async function add() {
  error.value = ''
  if (!address.value.trim()) {
    error.value = 'Renseigne une adresse.'
    return
  }

  searching.value = true
  try {
    const loc = await $fetch<{ lat: number; lon: number; label: string }>(
      '/api/ancres/geocoder',
      { method: 'POST', body: { adresse: address.value } }
    )

    const anchor: Anchor = {
      id: `a${Date.now().toString(36)}`,
      label: label.value.trim() || loc.label.split(' ').slice(0, 3).join(' ') || 'Ancre',
      adresse: loc.label || address.value.trim(),
      lat: loc.lat,
      lon: loc.lon,
      mode: mode.value,
      maxMinutes: maxMinutes.value && maxMinutes.value > 0 ? maxMinutes.value : null
    }

    emit('update:anchors', [...props.anchors, anchor])
    label.value = ''
    address.value = ''
    maxMinutes.value = null
  } catch (e: unknown) {
    error.value = errorMessage(e, 'Adresse introuvable.')
  } finally {
    searching.value = false
  }
}

function remove(id: string) {
  emit(
    'update:anchors',
    props.anchors.filter((a) => a.id !== id)
  )
}

function changeMode(id: string, m: TravelMode) {
  emit(
    'update:anchors',
    props.anchors.map((a) => (a.id === id ? { ...a, mode: m } : a))
  )
}
</script>

<template>
  <div>
    <ul v-if="anchors.length" class="space-y-2">
      <li
        v-for="a in anchors"
        :key="a.id"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-hairline-soft bg-surface-soft px-3 py-2.5"
      >
        <ModeIcon :mode="a.mode" class="text-steel" />
        <div class="min-w-[8rem] flex-1">
          <p class="truncate text-sm font-medium text-ink">{{ a.label }}</p>
          <p class="truncate text-xs text-stone">
            {{ a.adresse }}
            <template v-if="a.maxMinutes"> · objectif {{ a.maxMinutes }} min</template>
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-1">
          <button
            v-for="m in MODES"
            :key="m.value"
            class="rounded-full px-2.5 py-1 text-xs font-medium transition"
            :class="
              a.mode === m.value
                ? 'bg-ink text-white'
                : 'border border-hairline bg-white text-steel hover:bg-surface'
            "
            @click="changeMode(a.id, m.value)"
          >
            {{ m.label }}
          </button>
          <button
            class="ml-1 grid size-7 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
            :aria-label="`Retirer ${a.label}`"
            @click="remove(a.id)"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </li>
    </ul>

    <div v-if="!full" class="mt-4">
      <p :class="labelCls">Mode de déplacement</p>
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="m in MODES"
          :key="m.value"
          class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
          :class="
            mode === m.value
              ? 'bg-ink text-white'
              : 'border border-hairline bg-white text-steel hover:bg-surface'
          "
          @click="mode = m.value"
        >
          <ModeIcon :mode="m.value" class="size-3.5" />
          {{ m.label }}
        </button>
      </div>
    </div>

    <div v-if="!full" class="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
      <div>
        <label :class="labelCls">Nom</label>
        <input v-model="label" type="text" placeholder="Boulot" :class="inputCls">
      </div>
      <div>
        <label :class="labelCls">Adresse</label>
        <input
          v-model="address"
          type="text"
          placeholder="12 rue de Rivoli, Paris"
          :class="inputCls"
          @keyup.enter="add"
        >
      </div>
      <div>
        <label :class="labelCls">Max (min)</label>
        <input
          v-model.number="maxMinutes"
          type="number"
          min="1"
          placeholder="—"
          :class="[inputCls, 'w-24']"
        >
      </div>
      <div class="flex items-end">
        <button
          :disabled="searching"
          class="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="add"
        >
          {{ searching ? '…' : 'Ajouter' }}
        </button>
      </div>
    </div>

    <p v-else class="mt-3 text-xs text-stone">
      Maximum {{ MAX_ANCHORS }} points d’ancrage.
    </p>

    <p v-if="error" class="mt-2 text-xs text-[#600000]">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import type { Ancre, ModeTrajet } from '~/types'

const props = defineProps<{ ancres: Ancre[] }>()
const emit = defineEmits<{ 'update:ancres': [ancres: Ancre[]] }>()

const MODES: { value: ModeTrajet; label: string }[] = [
  { value: 'transport', label: 'Transports' },
  { value: 'voiture', label: 'Voiture' },
  { value: 'velo', label: 'Vélo' },
  { value: 'marche', label: 'À pied' }
]

const label = ref('')
const adresse = ref('')
const mode = ref<ModeTrajet>('transport')
const maxMinutes = ref<number | null>(null)
const recherche = ref(false)
const erreur = ref('')

const complet = computed(() => props.ancres.length >= MAX_ANCRES)

const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-stone mb-1.5'
const inputCls =
  'w-full rounded-lg border border-hairline-strong bg-white px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20'

async function ajouter() {
  erreur.value = ''
  if (!adresse.value.trim()) {
    erreur.value = 'Renseigne une adresse.'
    return
  }

  recherche.value = true
  try {
    const loc = await $fetch<{ lat: number; lon: number; label: string }>(
      '/api/ancres/geocoder',
      { method: 'POST', body: { adresse: adresse.value } }
    )

    const ancre: Ancre = {
      id: `a${Date.now().toString(36)}`,
      label: label.value.trim() || loc.label.split(' ').slice(0, 3).join(' ') || 'Ancre',
      adresse: loc.label || adresse.value.trim(),
      lat: loc.lat,
      lon: loc.lon,
      mode: mode.value,
      maxMinutes: maxMinutes.value && maxMinutes.value > 0 ? maxMinutes.value : null
    }

    emit('update:ancres', [...props.ancres, ancre])
    label.value = ''
    adresse.value = ''
    maxMinutes.value = null
  } catch (e: unknown) {
    erreur.value = messageErreur(e, 'Adresse introuvable.')
  } finally {
    recherche.value = false
  }
}

function retirer(id: string) {
  emit(
    'update:ancres',
    props.ancres.filter((a) => a.id !== id)
  )
}

function changerMode(id: string, m: ModeTrajet) {
  emit(
    'update:ancres',
    props.ancres.map((a) => (a.id === id ? { ...a, mode: m } : a))
  )
}
</script>

<template>
  <div>
    <ul v-if="ancres.length" class="space-y-2">
      <li
        v-for="a in ancres"
        :key="a.id"
        class="flex flex-wrap items-center gap-3 rounded-xl border border-hairline-soft bg-surface-soft px-3 py-2.5"
      >
        <IconeMode :mode="a.mode" class="text-steel" />
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
            @click="changerMode(a.id, m.value)"
          >
            {{ m.label }}
          </button>
          <button
            class="ml-1 grid size-7 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
            :aria-label="`Retirer ${a.label}`"
            @click="retirer(a.id)"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </li>
    </ul>

    <div v-if="!complet" class="mt-4">
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
          <IconeMode :mode="m.value" class="size-3.5" />
          {{ m.label }}
        </button>
      </div>
    </div>

    <div v-if="!complet" class="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
      <div>
        <label :class="labelCls">Nom</label>
        <input v-model="label" type="text" placeholder="Boulot" :class="inputCls">
      </div>
      <div>
        <label :class="labelCls">Adresse</label>
        <input
          v-model="adresse"
          type="text"
          placeholder="12 rue de Rivoli, Paris"
          :class="inputCls"
          @keyup.enter="ajouter"
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
          :disabled="recherche"
          class="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="ajouter"
        >
          {{ recherche ? '…' : 'Ajouter' }}
        </button>
      </div>
    </div>

    <p v-else class="mt-3 text-xs text-stone">
      Maximum {{ MAX_ANCRES }} points d’ancrage.
    </p>

    <p v-if="erreur" class="mt-2 text-xs text-[#600000]">{{ erreur }}</p>
  </div>
</template>

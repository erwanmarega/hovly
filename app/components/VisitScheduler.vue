<script setup lang="ts">
import type { Property } from '~/types'

const props = defineProps<{ bien: Property }>()

const emit = defineEmits<{ maj: [patch: Partial<Property>] }>()

const { schedule } = useVisit()
const { setStatus } = useProperties()
const now = useNow()

const draft = ref(toLocalInput(props.bien.visite_le))
const editing = ref(!props.bien.visite_le)
const busy = ref(false)
const error = ref('')

watch(
  () => props.bien.visite_le,
  (v) => {
    draft.value = toLocalInput(v)
    editing.value = !v
  }
)

const state = computed(() => visitState(props.bien, now.value))
const slots = computed(() => quickSlots(now.value))

const minimum = computed(() => toLocalInput(now.value.toISOString()))

async function save(iso: string | null) {
  busy.value = true
  error.value = ''
  try {
    await schedule(props.bien.id, iso)
    emit('maj', iso ? { visite_le: iso, statut: 'planifie' } : { visite_le: null })
    editing.value = !iso
  } catch {
    error.value = 'Enregistrement impossible.'
  } finally {
    busy.value = false
  }
}

function submit() {
  const iso = fromLocalInput(draft.value)
  if (!iso) {
    error.value = 'Choisis une date et une heure.'
    return
  }
  save(iso)
}

async function markVisited() {
  busy.value = true
  try {
    await setStatus(props.bien.id, 'visite')
    emit('maj', { statut: 'visite' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Visite</h2>
      <VisitBadge :visite-le="bien.visite_le" />
    </div>

    <template v-if="bien.visite_le && !editing">
      <p class="mt-3 text-sm text-ink">
        {{ longVisitDate(bien.visite_le) }}
      </p>
      <p v-if="state === 'past'" class="mt-1 text-xs text-stone">
        Visite passée — remplis la checklist tant que c’est frais.
      </p>
      <p v-else class="mt-1 text-xs text-stone">
        Rappel envoyé automatiquement 24 h avant, par email et notification.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-if="state === 'past' && bien.statut !== 'visite'"
          :disabled="busy"
          class="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="markVisited"
        >
          Marquer comme visité
        </button>
        <button
          :disabled="busy"
          class="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
          @click="editing = true"
        >
          Replanifier
        </button>
        <button
          :disabled="busy"
          class="rounded-full px-3 py-2 text-xs font-medium text-stone transition hover:text-[#600000] disabled:opacity-50"
          @click="save(null)"
        >
          Annuler la visite
        </button>
      </div>
    </template>

    <template v-else>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="c in slots"
          :key="c.iso"
          :disabled="busy"
          class="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
          @click="save(c.iso)"
        >
          {{ c.label }}
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <input
          v-model="draft"
          type="datetime-local"
          :min="minimum"
          class="min-w-[13rem] flex-1 rounded-lg border border-hairline-strong bg-white px-3 py-2 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
        >
        <button
          :disabled="busy"
          class="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-50"
          @click="submit"
        >
          {{ busy ? '…' : 'Planifier' }}
        </button>
        <button
          v-if="bien.visite_le"
          class="rounded-full px-3 py-2 text-xs font-medium text-stone transition hover:text-ink"
          @click="editing = false"
        >
          Annuler
        </button>
      </div>

      <p v-if="error" class="mt-2 text-xs text-[#600000]">{{ error }}</p>
    </template>
  </section>
</template>

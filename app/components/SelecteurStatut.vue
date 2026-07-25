<script setup lang="ts">
import type { Statut } from '~/types'
import { STATUTS } from '~/composables/useBiens'

const props = defineProps<{
  statut: Statut
  /** Ouvre le menu vers le haut (utile en bas de liste). */
  versLeHaut?: boolean
}>()

const emit = defineEmits<{ change: [statut: Statut] }>()

const ouvert = ref(false)

function choisir(s: Statut) {
  ouvert.value = false
  if (s !== props.statut) emit('change', s)
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      :aria-expanded="ouvert"
      aria-label="Changer le statut"
      @click="ouvert = !ouvert"
    >
      <BadgeStatut :statut="statut" />
    </button>

    <template v-if="ouvert">
      <button
        class="fixed inset-0 z-20 cursor-default"
        tabindex="-1"
        aria-label="Fermer le menu"
        @click="ouvert = false"
      />
      <div
        class="absolute z-30 w-44 rounded-xl border border-hairline bg-white p-1 shadow-lg"
        :class="versLeHaut ? 'bottom-full mb-1' : 'mt-1'"
      >
        <button
          v-for="s in STATUTS"
          :key="s.value"
          class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface"
          :class="statut === s.value ? 'font-semibold text-ink' : 'text-slate'"
          @click="choisir(s.value)"
        >
          {{ s.label }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Statut } from '~/types'

defineProps<{ statut: Statut }>()

const map: Record<Statut, { label: string; cls: string }> = {
  a_visiter: { label: 'À visiter', cls: 'bg-surface-yellow text-[#746019]' },
  planifie: { label: 'Planifié', cls: 'bg-[#eef0ff] text-blue' },
  visite: { label: 'Visité', cls: 'bg-teal text-[#187574]' },
  coup_de_coeur: { label: 'Coup de cœur', cls: 'bg-rose text-[#9d1d6a]' },
  elimine: { label: 'Éliminé', cls: 'bg-surface text-steel line-through' }
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
    :class="map[statut].cls"
  >
    {{ map[statut].label }}
  </span>
</template>

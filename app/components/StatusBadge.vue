<script setup lang="ts">
import type { Status, Transaction } from '~/types'
import { stepLabel } from '~/utils/applications'

const props = defineProps<{ status: Status; transaction?: Transaction }>()

const map: Record<Status, { label: string; cls: string }> = {
  a_visiter: { label: 'À visiter', cls: 'bg-surface-yellow text-[#746019]' },
  planifie: { label: 'Planifié', cls: 'bg-[#eef0ff] text-blue' },
  visite: { label: 'Visité', cls: 'bg-teal text-[#187574]' },
  coup_de_coeur: { label: 'Coup de cœur', cls: 'bg-rose text-[#9d1d6a]' },
  en_attente: { label: 'En attente de réponse', cls: 'bg-[#fff0d6] text-[#8a5a00]' },
  accepte: { label: 'Accepté', cls: 'bg-[#dff5e3] text-[#1f6b34]' },
  refuse: { label: 'Refusé', cls: 'bg-surface text-steel' },
  elimine: { label: 'Éliminé', cls: 'bg-surface text-steel line-through' }
}

// En attente : le libellé précis dépend du type de transaction (dossier / offre).
const label = computed(() =>
  props.status === 'en_attente' && props.transaction
    ? stepLabel('candidature', props.transaction)
    : map[props.status].label
)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
    :class="map[status].cls"
  >
    {{ label }}
  </span>
</template>

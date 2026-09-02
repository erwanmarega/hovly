<script setup lang="ts">
import type { DPE } from '~/types'

const props = withDefaults(
  defineProps<{
    surface?: number | null
    nbPieces?: number | null
    piecesLabel?: string
    etage?: number | null
    prixM2?: number | null
    dpe?: DPE | null
    taille?: 'sm' | 'md'
  }>(),
  { piecesLabel: 'pièces', taille: 'sm' }
)

const classePastille = computed(() =>
  props.taille === 'md'
    ? 'rounded-full bg-surface px-3 py-1 font-medium tabular-nums text-steel'
    : 'rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel'
)
</script>

<template>
  <slot name="avant" />
  <span v-if="surface" :class="classePastille">{{ surface }} m²</span>
  <span v-if="nbPieces" :class="classePastille">{{ nbPieces }} {{ piecesLabel }}</span>
  <span v-if="etage != null" :class="classePastille">Étage {{ etage }}</span>
  <span v-if="prixM2 != null" :class="classePastille">{{ formaterNombre(prixM2) }} €/m²</span>
  <BadgeDPE v-if="dpe !== undefined" :dpe="dpe" />
  <slot />
</template>

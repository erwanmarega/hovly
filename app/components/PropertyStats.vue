<script setup lang="ts">
import type { DPE } from '~/types'

const props = withDefaults(
  defineProps<{
    surface?: number | null
    rooms?: number | null
    roomsLabel?: string
    etage?: number | null
    pricePerSqm?: number | null
    dpe?: DPE | null
    size?: 'sm' | 'md'
  }>(),
  { roomsLabel: 'pièces', size: 'sm' }
)

const pillClass = computed(() =>
  props.size === 'md'
    ? 'rounded-full bg-surface px-3 py-1 font-medium tabular-nums text-steel'
    : 'rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel'
)
</script>

<template>
  <slot name="before" />
  <span v-if="surface" :class="pillClass">{{ surface }} m²</span>
  <span v-if="rooms" :class="pillClass">{{ rooms }} {{ roomsLabel }}</span>
  <span v-if="etage != null" :class="pillClass">Étage {{ etage }}</span>
  <span v-if="pricePerSqm != null" :class="pillClass">{{ formatNumber(pricePerSqm) }} €/m²</span>
  <BadgeDPE v-if="dpe !== undefined" :dpe="dpe" />
  <slot />
</template>

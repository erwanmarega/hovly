<script setup lang="ts">
import type { SiteSource } from '~/types'

withDefaults(
  defineProps<{
    source: SiteSource
    withName?: boolean
    size?: number
  }>(),
  { withName: true, size: 24 }
)

const LABELS: Record<SiteSource, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici',
  century21: 'Century 21',
  orpi: 'Orpi'
}
</script>

<template>
  <span class="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
    <img
      :src="`/logos/${source}.png`"
      :alt="LABELS[source]"
      :width="size"
      :height="size"
      :style="{ width: `${size}px`, height: `${size}px` }"
      class="shrink-0 rounded object-contain"
      loading="lazy"
      decoding="async"
    >
    <span v-if="withName" class="text-lg font-semibold text-steel">{{ LABELS[source] }}</span>
  </span>
</template>

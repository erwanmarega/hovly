<script setup lang="ts">
import type { SiteSource } from '~/types'

withDefaults(
  defineProps<{
    source: SiteSource
    avecNom?: boolean
    taille?: number
  }>(),
  { avecNom: true, taille: 24 }
)

const LABELS: Record<SiteSource, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici',
  century21: 'Century 21'
}
</script>

<template>
  <span class="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
    <img
      :src="`/logos/${source}.png`"
      :alt="LABELS[source]"
      :width="taille"
      :height="taille"
      :style="{ width: `${taille}px`, height: `${taille}px` }"
      class="shrink-0 rounded object-contain"
      loading="lazy"
      decoding="async"
    >
    <span v-if="avecNom" class="text-lg font-semibold text-steel">{{ LABELS[source] }}</span>
  </span>
</template>

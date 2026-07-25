<script setup lang="ts">
import type { ModeTrajet } from '~/types'

defineProps<{ mode: ModeTrajet }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="size-4 shrink-0"
  >
    <template v-if="mode === 'voiture'">
      <path d="M5 17h14M6.5 17V9.5l1.7-3.2a2 2 0 0 1 1.8-1h4a2 2 0 0 1 1.8 1L17.5 9.5V17" />
      <path d="M4 12h16" />
      <circle cx="8" cy="17" r="1.6" />
      <circle cx="16" cy="17" r="1.6" />
    </template>
    <template v-else-if="mode === 'velo'">
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M9 17 12 8h3M12 8 9.5 5.5M15 8l3.5 9M8 17h4" />
    </template>
    <template v-else-if="mode === 'marche'">
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="m9 21 2.5-5.5L9 12l1-4 3 2 3 1" />
      <path d="M11.5 15.5 15 21M10 8 7 9.5" />
    </template>
    <template v-else>
      <rect x="5" y="3" width="14" height="13" rx="2.5" />
      <path d="M5 9h14" />
      <path d="M8 19.5 6.5 22M16 19.5 17.5 22" />
      <path d="M8 16h.01M16 16h.01" />
    </template>
  </svg>
</template>

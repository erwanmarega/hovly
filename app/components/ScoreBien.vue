<script setup lang="ts">
import type { Score } from '~/composables/useScore'

defineProps<{ score: Score }>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold"
    :class="[score.tint, score.couleur]"
    :title="score.label"
  >
    <span class="grid size-5 place-items-center rounded-full bg-white/70 text-[11px] font-bold tabular-nums">
      {{ score.total }}
    </span>
    {{ score.label }}
  </span>
</template>

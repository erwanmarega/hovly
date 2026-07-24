<script setup lang="ts">
import type { Score } from '~/composables/useScore'

defineProps<{ score: Score }>()
</script>

<template>
  <div class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Score Hovly</h2>
      <ScoreBien :score="score" />
    </div>
    <div class="mt-3 flex items-baseline gap-1">
      <span class="text-4xl font-bold tracking-tight">{{ score.total }}</span>
      <span class="text-lg text-stone">/100</span>
    </div>
    <div class="mt-5 space-y-3">
      <div v-for="p in score.parts" :key="p.label">
        <div class="flex justify-between text-sm">
          <span class="text-steel">{{ p.label }}</span>
          <span class="font-semibold tabular-nums">{{ p.points }}/{{ p.max }}</span>
        </div>
        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
          <div class="h-full rounded-full bg-ink transition-all" :style="{ width: `${(p.points / p.max) * 100}%` }"></div>
        </div>
        <p class="mt-1 text-xs text-stone">{{ p.hint }}</p>
      </div>
    </div>
    <p class="mt-4 text-xs text-stone">
      Estimation indicative : prix au m² local, DPE et charges. Plus tu ajoutes de biens dans la même ville, plus c'est précis.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { Score } from '~/composables/useScore'

defineProps<{ score: Score }>()
</script>

<template>
  <div class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">
        {{ score.personnalise ? 'Mon score' : 'Score Hovly' }}
      </h2>
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
          <div class="h-full rounded-full bg-ink transition-all" :style="{ width: `${(p.points / p.max) * 100}%` }"/>
        </div>
        <p class="mt-1 text-xs text-stone">{{ p.hint }}</p>
      </div>
    </div>
    <div v-if="score.criteres.length" class="mt-5 border-t border-hairline-soft pt-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-stone">Mes critères</p>
      <ul class="mt-2.5 space-y-1.5">
        <li
          v-for="c in score.criteres"
          :key="c.label"
          class="flex items-center gap-2 text-sm"
          :class="c.ok ? 'text-slate' : 'text-[#600000]'"
        >
          <span
            class="grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold"
            :class="c.ok ? 'bg-teal/60 text-[#0a4a42]' : 'bg-coral/60'"
          >{{ c.ok ? '✓' : '✕' }}</span>
          <span class="font-medium">{{ c.label }}</span>
          <span class="ml-auto text-xs text-stone">{{ c.detail }}</span>
        </li>
      </ul>
      <p v-if="score.criteres.some((c) => !c.ok)" class="mt-2.5 text-xs text-stone">
        −12 points par critère non respecté.
      </p>
    </div>

    <p class="mt-4 text-xs text-stone">
      <template v-if="score.personnalise">
        Pondéré selon tes critères, réglables depuis ton profil.
      </template>
      <template v-else>
        Estimation indicative : prix au m² local, DPE et charges. Règle tes propres critères depuis
        ton profil.
      </template>
    </p>
  </div>
</template>

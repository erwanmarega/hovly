<script setup lang="ts">
const LIGNES = [
  {
    titre: 'Studio · Clichy',
    detail: '67 m² · 28 €/m²',
    prix: '1 900 €',
    score: 82,
    teinte: 'bg-teal text-[#0a4a42]',
    trajet: '22 min',
    depasse: false
  },
  {
    titre: 'T2 · Bussy-Saint-Georges',
    detail: '44 m² · 25 €/m²',
    prix: '1 100 €',
    score: 74,
    teinte: 'bg-teal text-[#0a4a42]',
    trajet: '38 min',
    depasse: false
  },
  {
    titre: 'T3 · Meaux',
    detail: '81 m² · 13 €/m²',
    prix: '1 260 €',
    score: 61,
    teinte: 'bg-brand-light text-[#8a6d1c]',
    trajet: '52 min',
    depasse: true
  }
]
</script>

<template>
  <div
    class="fenetre overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_30px_80px_rgba(5,0,56,0.16)]"
  >
    <div class="flex items-center gap-3 border-b border-hairline-soft bg-surface-soft px-4 py-3">
      <span class="flex gap-1.5">
        <span class="size-2.5 rounded-full bg-coral-soft" />
        <span class="size-2.5 rounded-full bg-brand" />
        <span class="size-2.5 rounded-full bg-teal-deep/60" />
      </span>
      <span
        class="ml-1 flex-1 truncate rounded-full bg-white px-3 py-1 text-[11px] text-stone shadow-inner"
      >
        hovly.app/dashboard
      </span>
    </div>

    <div class="px-4 py-4 sm:px-5">
      <div class="flex items-baseline justify-between">
        <p class="text-sm font-semibold text-ink-deep">Mes biens</p>
        <span class="text-[11px] text-stone">3 actifs</span>
      </div>

      <ul class="mt-3 space-y-2">
        <li
          v-for="(l, i) in LIGNES"
          :key="l.titre"
          class="ligne flex items-center gap-3 rounded-xl border border-hairline-soft px-3 py-2.5"
          :style="{ animationDelay: `${0.25 + i * 0.14}s` }"
        >
          <span class="size-9 shrink-0 rounded-lg bg-surface" />

          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13px] font-medium text-ink">{{ l.titre }}</span>
            <span class="block truncate text-[11px] text-stone">{{ l.detail }}</span>
          </span>

          <span class="shrink-0 text-[13px] font-semibold tabular-nums text-ink">{{ l.prix }}</span>

          <span
            class="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums"
            :class="l.teinte"
          >
            {{ l.score }}
          </span>

          <span
            class="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums sm:block"
            :class="l.depasse ? 'bg-coral text-[#600000]' : 'bg-surface text-steel'"
          >
            {{ l.trajet }}
          </span>
        </li>
      </ul>
    </div>

    <div
      class="alerte flex items-center gap-2 border-t border-hairline-soft bg-surface-yellow px-4 py-2.5 text-[11px] font-medium text-[#8a6d1c]"
    >
      <span class="size-1.5 shrink-0 rounded-full bg-brand-deep" />
      Baisse de 150 € détectée sur « Studio · Clichy »
    </div>
  </div>
</template>

<style scoped>
.fenetre {
  opacity: 0;
  animation: apparaitre 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
}

.ligne {
  opacity: 0;
  animation: glisser 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.alerte {
  opacity: 0;
  animation: glisser 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.95s forwards;
}

@keyframes apparaitre {
  from {
    opacity: 0;
    transform: translateY(24px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes glisser {
  from {
    opacity: 0;
    transform: translateX(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fenetre,
  .ligne,
  .alerte {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>

<script setup lang="ts">
import type { Property } from "~/types";
import type { Score } from "~/composables/useScore";

const props = withDefaults(
  defineProps<{
    biens: Property[];
    score: (b: Property) => Score;
    monthlyPrice: (b: Property) => number;
    pricePerSqm: (b: Property) => number;
    page: number;
    total: number;
    parPage: number;
    compact?: boolean;
  }>(),
  { compact: false }
);

const emit = defineEmits<{
  supprimer: [id: string];
  "update:page": [page: number];
  survole: [id: string | null];
}>();
</script>

<template>
  <div>
    <div
      class="grille grid gap-5"
      :class="compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'"
    >
      <CarteBien
        v-for="(b, i) in biens"
        :key="b.id"
        :bien="b"
        :score="props.score(b)"
        :monthly-price="props.monthlyPrice(b)"
        :price-per-sqm="props.pricePerSqm(b)"
        :style="{ '--i': i }"
        @supprimer="emit('supprimer', $event)"
        @mouseenter="emit('survole', b.id)"
        @mouseleave="emit('survole', null)"
      />
    </div>

    <PaginationListe
      class="mt-5 rounded-2xl border border-hairline-soft bg-white"
      :page="page"
      :total="total"
      :par-page="parPage"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>

<style scoped>
.grille > * {
  opacity: 0;
  animation: monter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i) * 0.05s);
}

@keyframes monter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .grille > * {
    opacity: 1;
    animation: none;
  }
}
</style>


<script setup lang="ts">
import type { Property } from '~/types'

const props = defineProps<{ bien: Property }>()

const { calculate } = useActualCost()

const cost = computed(() => calculate(props.bien))
const eur = (centimes: number) => formatNumber(Math.round(centimes / 100))

const detailsOpen = ref(false)

const parts = computed(() =>
  cost.value.items
    .filter((p) => (p.amount ?? 0) > 0)
    .map((p) => ({
      ...p,
      percent: cost.value.total ? ((p.amount ?? 0) / cost.value.total) * 100 : 0
    }))
)

const TINTS: Record<string, string> = {
  loyer: 'bg-ink',
  credit: 'bg-ink',
  charges: 'bg-steel',
  energie: 'bg-brand-deep',
  assurance: 'bg-stone'
}

const purchase = computed(() => props.bien.transaction === 'achat')
const overageTitle = computed(() =>
  purchase.value
    ? 'Écart avec la mensualité estimée'
    : 'Écart avec le loyer charges comprises affiché dans l’annonce'
)
const displayedLabel = computed(() =>
  purchase.value ? 'Mensualité estimée' : 'Annonce : loyer charges compris'
)
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Coût réel</h2>
      <span
        v-if="cost.overagePercent > 0"
        class="rounded-full bg-coral px-2.5 py-1 text-xs font-bold text-[#600000]"
        :title="overageTitle"
      >
        +{{ cost.overagePercent }} %
      </span>
    </div>

    <p class="mt-2 text-3xl font-bold tracking-tight">
      {{ eur(cost.total) }} €<span class="text-base font-medium text-stone">/mois</span>
    </p>
    <p class="mt-1 text-xs text-stone">
      {{ displayedLabel }} : {{ eur(cost.displayed) }} €
    </p>

    <div class="mt-4 flex h-2 overflow-hidden rounded-full bg-surface">
      <span
        v-for="p in parts"
        :key="p.key"
        :class="TINTS[p.key]"
        :style="{ width: `${p.percent}%` }"
        :title="`${p.label} — ${eur(p.amount ?? 0)} €`"
      />
    </div>

    <ul class="mt-4 space-y-2 text-sm">
      <li v-for="p in cost.items" :key="p.key" class="flex items-center justify-between gap-3">
        <span class="flex min-w-0 items-center gap-2">
          <span class="size-2 shrink-0 rounded-full" :class="TINTS[p.key]" />
          <span class="truncate text-steel">{{ p.label }}</span>
        </span>
        <span class="shrink-0 font-semibold tabular-nums">
          <template v-if="p.amount == null">—</template>
          <template v-else>{{ eur(p.amount) }} €</template>
        </span>
      </li>
    </ul>

    <p v-if="cost.incomplete" class="mt-3 text-xs text-stone">
      Estimation basse : une donnée manque
      <template v-if="bien.charges == null">(charges non renseignées)</template>
      <template v-else>(DPE non renseigné)</template>.
    </p>

    <button
      class="mt-3 text-xs font-medium text-blue hover:underline"
      @click="detailsOpen = !detailsOpen"
    >
      {{ detailsOpen ? 'Masquer les hypothèses' : 'Comment c’est calculé ?' }}
    </button>

    <div v-if="detailsOpen" class="mt-2 space-y-1.5 rounded-xl bg-surface px-3 py-2.5">
      <p v-for="p in cost.items" :key="p.key" class="text-xs text-stone">
        <span class="font-medium text-steel">{{ p.label }}</span> — {{ p.detail }}
      </p>
      <p v-for="h in cost.assumptions" :key="h" class="text-xs text-stone">{{ h }}</p>
      <NuxtLink to="/profil" class="block text-xs font-medium text-blue hover:underline">
        Ajuster depuis mon profil
      </NuxtLink>
    </div>
  </section>
</template>

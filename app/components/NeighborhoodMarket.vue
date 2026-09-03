<script setup lang="ts">
import type { NeighborhoodMarket } from '~/types'

const props = defineProps<{
  market: NeighborhoodMarket | null
  pricePerSqm: number | null
}>()

const PAD_X = 12
const W = 600
const H = 120
const TOP = 20
const BOTTOM = 96

const fmtMonth = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })

const gap = computed(() =>
  props.market && props.pricePerSqm ? gapPercent(props.pricePerSqm, props.market) : null
)

const barCount = computed(() => props.market?.barres.length ?? 0)
const barWidth = computed(() => (W - PAD_X * 2) / (barCount.value || 1))
const maxHeight = computed(() => Math.max(...(props.market?.barres ?? [1])))

function barHeight(count: number): number {
  return Math.round((count / maxHeight.value) * (BOTTOM - TOP))
}

/** Prix au m² → abscisse SVG, bornée à la plage affichée. */
function xPosition(pricePerSqm: number): number {
  const m = props.market!
  const t = (pricePerSqm - m.min) / (m.max - m.min || 1)
  return PAD_X + Math.min(1, Math.max(0, t)) * (W - PAD_X * 2)
}

const xMedian = computed(() => (props.market ? xPosition(props.market.mediane) : 0))
const xProperty = computed(() => (props.pricePerSqm && props.market ? xPosition(props.pricePerSqm) : null))

const propertyBarIndex = computed(() => {
  if (!props.pricePerSqm || !props.market) return -1
  const m = props.market
  const t = (props.pricePerSqm - m.min) / (m.max - m.min || 1)
  if (t < 0 || t > 1) return -1
  return Math.min(barCount.value - 1, Math.floor(t * barCount.value))
})
</script>

<template>
  <div v-if="market" class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Marché du quartier</h2>
      <span
        v-if="gap !== null"
        class="rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="gap <= 0 ? 'bg-teal/40 text-[#0a4a42]' : 'bg-coral/40 text-[#600000]'"
      >
        {{ gap <= 0 ? '▼' : '▲' }} {{ Math.abs(gap) }} %
        {{ gap <= 0 ? 'sous la médiane' : 'au-dessus' }}
      </span>
    </div>

    <div class="mt-2 flex items-baseline gap-2">
      <span class="text-2xl font-bold tracking-tight">{{ formatNumber(market.mediane) }} €/m²</span>
      <span class="text-xs text-stone">médiane des ventes DVF</span>
    </div>

    <svg :viewBox="`0 0 ${W} ${H}`" class="mt-3 h-28 w-full" preserveAspectRatio="none">
      <g v-for="(count, i) in market.barres" :key="i">
        <rect
          :x="PAD_X + i * barWidth + 1"
          :y="BOTTOM - barHeight(count)"
          :width="Math.max(barWidth - 2, 1)"
          :height="barHeight(count)"
          rx="2"
          :fill="i === propertyBarIndex ? '#ffd02f' : '#e7e4de'"
        />
      </g>
      <line
        :x1="xMedian"
        :y1="TOP - 4"
        :x2="xMedian"
        :y2="BOTTOM + 2"
        stroke="#a8a29e"
        stroke-width="2"
        stroke-dasharray="4 3"
        vector-effect="non-scaling-stroke"
      />
      <template v-if="xProperty !== null">
        <line
          :x1="xProperty"
          :y1="TOP - 4"
          :x2="xProperty"
          :y2="BOTTOM + 2"
          stroke="#1a1a1a"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          :points="`${xProperty - 5},${TOP - 14} ${xProperty + 5},${TOP - 14} ${xProperty},${TOP - 5}`"
          fill="#1a1a1a"
        />
      </template>
    </svg>

    <div class="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-stone">
      <span class="whitespace-nowrap">{{ formatNumber(market.min) }} €/m²</span>
      <span v-if="pricePerSqm" class="whitespace-nowrap font-medium text-slate">
        ▲ ce bien · {{ formatNumber(pricePerSqm) }} €/m²
      </span>
      <span class="whitespace-nowrap">{{ formatNumber(market.max) }} €/m²</span>
    </div>

    <p class="mt-3 border-t border-hairline-soft pt-3 text-xs text-stone">
      {{ market.nbVentes }} ventes d'appartements à moins de 500 m<template
        v-if="market.du && market.au"
      >, entre {{ fmtMonth(market.du) }} et {{ fmtMonth(market.au) }}</template>.
      Source : DVF (DGFiP).
    </p>
  </div>
</template>

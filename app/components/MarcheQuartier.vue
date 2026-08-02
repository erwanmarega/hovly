<script setup lang="ts">
import type { MarcheQuartier } from '~/types'

const props = defineProps<{
  marche: MarcheQuartier | null
  prixM2: number | null
}>()

const PAD_X = 12
const W = 600
const H = 120
const HAUT = 20
const BAS = 96

const fmt = (n: number) => n.toLocaleString('fr-FR')
const fmtMois = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })

const ecart = computed(() =>
  props.marche && props.prixM2 ? ecartPct(props.prixM2, props.marche) : null
)

const nbBarres = computed(() => props.marche?.barres.length ?? 0)
const largeurBarre = computed(() => (W - PAD_X * 2) / (nbBarres.value || 1))
const hauteurMax = computed(() => Math.max(...(props.marche?.barres ?? [1])))

function hauteurBarre(count: number): number {
  return Math.round((count / hauteurMax.value) * (BAS - HAUT))
}

/** Prix au m² → abscisse SVG, bornée à la plage affichée. */
function abscisse(prixM2: number): number {
  const m = props.marche!
  const t = (prixM2 - m.min) / (m.max - m.min || 1)
  return PAD_X + Math.min(1, Math.max(0, t)) * (W - PAD_X * 2)
}

const xMediane = computed(() => (props.marche ? abscisse(props.marche.mediane) : 0))
const xBien = computed(() => (props.prixM2 && props.marche ? abscisse(props.prixM2) : null))

const barreDuBien = computed(() => {
  if (!props.prixM2 || !props.marche) return -1
  const m = props.marche
  const t = (props.prixM2 - m.min) / (m.max - m.min || 1)
  if (t < 0 || t > 1) return -1
  return Math.min(nbBarres.value - 1, Math.floor(t * nbBarres.value))
})
</script>

<template>
  <div v-if="marche" class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Marché du quartier</h2>
      <span
        v-if="ecart !== null"
        class="rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="ecart <= 0 ? 'bg-teal/40 text-[#0a4a42]' : 'bg-coral/40 text-[#600000]'"
      >
        {{ ecart <= 0 ? '▼' : '▲' }} {{ Math.abs(ecart) }} %
        {{ ecart <= 0 ? 'sous la médiane' : 'au-dessus' }}
      </span>
    </div>

    <div class="mt-2 flex items-baseline gap-2">
      <span class="text-2xl font-bold tracking-tight">{{ fmt(marche.mediane) }} €/m²</span>
      <span class="text-xs text-stone">médiane des ventes DVF</span>
    </div>

    <svg :viewBox="`0 0 ${W} ${H}`" class="mt-3 h-28 w-full" preserveAspectRatio="none">
      <g v-for="(count, i) in marche.barres" :key="i">
        <rect
          :x="PAD_X + i * largeurBarre + 1"
          :y="BAS - hauteurBarre(count)"
          :width="Math.max(largeurBarre - 2, 1)"
          :height="hauteurBarre(count)"
          rx="2"
          :fill="i === barreDuBien ? '#ffd02f' : '#e7e4de'"
        />
      </g>
      <line
        :x1="xMediane"
        :y1="HAUT - 4"
        :x2="xMediane"
        :y2="BAS + 2"
        stroke="#a8a29e"
        stroke-width="2"
        stroke-dasharray="4 3"
        vector-effect="non-scaling-stroke"
      />
      <template v-if="xBien !== null">
        <line
          :x1="xBien"
          :y1="HAUT - 4"
          :x2="xBien"
          :y2="BAS + 2"
          stroke="#1a1a1a"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          :points="`${xBien - 5},${HAUT - 14} ${xBien + 5},${HAUT - 14} ${xBien},${HAUT - 5}`"
          fill="#1a1a1a"
        />
      </template>
    </svg>

    <div class="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-stone">
      <span class="whitespace-nowrap">{{ fmt(marche.min) }} €/m²</span>
      <span v-if="prixM2" class="whitespace-nowrap font-medium text-slate">
        ▲ ce bien · {{ fmt(prixM2) }} €/m²
      </span>
      <span class="whitespace-nowrap">{{ fmt(marche.max) }} €/m²</span>
    </div>

    <p class="mt-3 border-t border-hairline-soft pt-3 text-xs text-stone">
      {{ marche.nbVentes }} ventes d'appartements à moins de 500 m<template
        v-if="marche.du && marche.au"
      >, entre {{ fmtMois(marche.du) }} et {{ fmtMois(marche.au) }}</template>.
      Source : DVF (DGFiP).
    </p>
  </div>
</template>

<script setup lang="ts">
interface Point {
  prix: number
  controle_le: string
}

const props = defineProps<{ points: Point[] }>()

const PAD_X = 12
const PAD_Y = 16
const W = 600
const H = 200

const euros = (centimes: number) => Math.round(centimes / 100)
const fmt = (centimes: number) => euros(centimes).toLocaleString('fr-FR')
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })

const valides = computed(() =>
  [...props.points]
    .filter((p) => p.prix != null)
    .sort((a, b) => +new Date(a.controle_le) - +new Date(b.controle_le))
)

const assez = computed(() => valides.value.length >= 2)

const prixMin = computed(() => Math.min(...valides.value.map((p) => p.prix)))
const prixMax = computed(() => Math.max(...valides.value.map((p) => p.prix)))

const coords = computed(() => {
  const pts = valides.value
  if (pts.length === 0) return []
  const t0 = +new Date(pts[0].controle_le)
  const t1 = +new Date(pts[pts.length - 1].controle_le)
  const dt = t1 - t0 || 1
  const min = prixMin.value
  const max = prixMax.value
  const dp = max - min || 1
  return pts.map((p, i) => {
    const x = pts.length === 1 ? W / 2 : PAD_X + ((+new Date(p.controle_le) - t0) / dt) * (W - PAD_X * 2)
    const y = PAD_Y + (1 - (p.prix - min) / dp) * (H - PAD_Y * 2)
    return { x, y, prix: p.prix, date: p.controle_le, i }
  })
})

const linePath = computed(() => coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' '))
const areaPath = computed(() => {
  const c = coords.value
  if (!c.length) return ''
  return `M${c[0].x},${H - PAD_Y} ${c.map((p) => `L${p.x},${p.y}`).join(' ')} L${c[c.length - 1].x},${H - PAD_Y} Z`
})

const premier = computed(() => valides.value[0]?.prix ?? 0)
const dernier = computed(() => valides.value[valides.value.length - 1]?.prix ?? 0)
const delta = computed(() => dernier.value - premier.value)
const deltaPct = computed(() => (premier.value ? Math.round((delta.value / premier.value) * 1000) / 10 : 0))

const survol = ref<number | null>(null)
</script>

<template>
  <div class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Historique du prix</h2>
      <span
        v-if="assez && delta !== 0"
        class="rounded-full px-2.5 py-1 text-xs font-semibold"
        :class="delta < 0 ? 'bg-teal/40 text-[#0a4a42]' : 'bg-coral/40 text-[#600000]'"
      >
        {{ delta < 0 ? '▼' : '▲' }} {{ fmt(Math.abs(delta)) }} € ({{ deltaPct > 0 ? '+' : '' }}{{ deltaPct }} %)
      </span>
    </div>

    <div v-if="!assez" class="mt-6 grid place-items-center py-8 text-center">
      <p class="text-sm text-slate">Pas encore assez de données.</p>
      <p class="mt-1 text-xs text-stone">La courbe se construit à chaque vérification du prix.</p>
    </div>

    <div v-else class="mt-4">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" preserveAspectRatio="none" style="height: 180px">
        <defs>
          <linearGradient id="prixFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffd02f" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#ffd02f" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="areaPath" fill="url(#prixFill)" />
        <path :d="linePath" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        <g v-for="c in coords" :key="c.i">
          <circle
            :cx="c.x"
            :cy="c.y"
            :r="survol === c.i ? 6 : 4"
            fill="#fff"
            stroke="#1a1a1a"
            stroke-width="2"
            vector-effect="non-scaling-stroke"
            class="cursor-pointer transition-all"
            @mouseenter="survol = c.i"
            @mouseleave="survol = null"
          />
        </g>
      </svg>

      <div class="mt-3 flex items-center justify-between text-xs">
        <span class="text-stone">{{ fmtDate(valides[0].controle_le) }}</span>
        <span
          v-if="survol !== null"
          class="rounded-full bg-ink px-2.5 py-1 font-semibold text-white"
        >
          {{ fmt(coords[survol].prix) }} € · {{ fmtDate(coords[survol].date) }}
        </span>
        <span v-else class="text-stone">
          min {{ fmt(prixMin) }} € · max {{ fmt(prixMax) }} €
        </span>
        <span class="text-stone">{{ fmtDate(valides[valides.length - 1].controle_le) }}</span>
      </div>
    </div>
  </div>
</template>

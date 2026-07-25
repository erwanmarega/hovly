<script setup lang="ts">
const EXEMPLES = [
  'pap.fr/annonces/appartement-marseille-8e…',
  'seloger.com/annonces/locations/appartement…',
  'leboncoin.fr/ad/locations/…',
  'bienici.com/annonce/location/lyon-6e…'
]

const url = ref('')
const indice = ref(0)
let minuteur: ReturnType<typeof setInterval> | undefined

const source = computed(() => (url.value.trim() ? detecterSource(url.value.trim()) : null))
const invalide = computed(() => url.value.trim().length > 8 && !source.value)

const LABELS: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici'
}

const reperes = [
  { classe: 'left-[4%] top-[22%]', delai: '0s', valeur: '1 900 €', detail: 'Clichy · 67 m²' },
  { classe: 'right-[5%] top-[30%]', delai: '1.6s', valeur: '82', detail: 'Score Hovly' },
  { classe: 'right-[9%] bottom-[18%]', delai: '2.8s', valeur: '−150 €', detail: 'Baisse détectée' }
]

onMounted(() => {
  minuteur = setInterval(() => {
    if (!url.value) indice.value = (indice.value + 1) % EXEMPLES.length
  }, 3200)
})
onBeforeUnmount(() => clearInterval(minuteur))

function analyser() {
  const v = url.value.trim()
  if (!v) return navigateTo('/ajouter')
  return navigateTo(`/ajouter?url=${encodeURIComponent(v)}`)
}
</script>

<template>
  <section
    class="relative flex min-h-[86vh] items-center overflow-hidden bg-brand px-4 py-16 sm:px-6 md:h-[640px] md:py-0"
  >
    <img
      src="/hero-immeuble.jpg"
      alt=""
      width="1920"
      height="1080"
      fetchpriority="high"
      class="fond absolute inset-0 size-full object-cover"
    >
    <div
      class="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-deep/25 via-transparent to-ink-deep/30"
    />

    <div
      class="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-teal/40 blur-3xl animate-float"
    />
    <div
      class="pointer-events-none absolute -right-20 top-10 size-72 rounded-full bg-coral/40 blur-3xl animate-float"
      style="animation-delay: 2s"
    />

    <span
      v-for="r in reperes"
      :key="r.valeur"
      class="repere pointer-events-none absolute hidden rounded-2xl bg-white/90 px-3.5 py-2 text-left shadow-[0_10px_30px_rgba(5,0,56,0.16)] backdrop-blur-sm lg:block"
      :class="r.classe"
      :style="{ animationDelay: r.delai }"
    >
      <span class="block text-sm font-bold text-ink-deep">{{ r.valeur }}</span>
      <span class="block text-[11px] text-steel">{{ r.detail }}</span>
    </span>

    <div
      class="carte relative mx-auto w-full max-w-xl rounded-3xl bg-white/95 px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-md"
    >
      <span
        class="animate-fade-up mb-7 inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-ink-deep"
      >
        <span class="etoile">✦</span>
        5 sites, un seul tableau
      </span>

      <h1
        class="animate-fade-up mx-auto max-w-lg text-4xl font-light leading-[1.08] tracking-tight text-ink-deep sm:text-5xl md:text-6xl"
        style="animation-delay: 0.04s"
      >
        Tous tes biens.<br>
        <span class="relative inline-block">
          Un seul{{ ' ' }}
          <span class="relative" aria-label="endroit.">
            <span
              v-for="(c, i) in 'endroit.'.split('')"
              :key="i"
              class="wave-letter"
              :style="{ animationDelay: `${i * 0.08}s` }"
              aria-hidden="true"
            >{{ c }}</span>
            <span class="souligne absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-brand" />
          </span>
        </span>
      </h1>

      <p
        class="animate-fade-up mx-auto mt-5 max-w-sm text-base leading-relaxed text-slate"
        style="animation-delay: 0.12s"
      >
        Colle une URL d’annonce, Hovly extrait tout automatiquement. Compare, suis les prix, décide.
      </p>

      <form
        class="animate-fade-up mt-8 w-full overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] transition focus-within:shadow-[0_12px_50px_rgba(0,0,0,0.2)]"
        style="animation-delay: 0.24s"
        @submit.prevent="analyser"
      >
        <div class="relative px-5 pb-4 pt-5 text-left">
          <input
            v-model="url"
            type="url"
            inputmode="url"
            aria-label="URL d’une annonce"
            class="w-full bg-transparent text-sm text-ink outline-none placeholder:text-transparent"
            placeholder="Colle une URL d’annonce…"
          >
          <span
            v-if="!url"
            class="pointer-events-none absolute left-5 top-5 flex items-center text-sm text-stone"
          >
            <Transition name="exemple" mode="out-in">
              <span :key="indice" class="truncate">{{ EXEMPLES[indice] }}</span>
            </Transition>
            <span class="curseur ml-0.5 inline-block h-4 w-px bg-stone" />
          </span>
        </div>

        <div class="flex items-center justify-between gap-2 px-3 pb-3">
          <Transition name="etat" mode="out-in">
            <span
              v-if="source"
              key="ok"
              class="inline-flex items-center gap-1.5 rounded-full border border-teal-deep/30 bg-teal/40 px-3 py-1.5 text-xs font-semibold text-[#0a4a42]"
            >
              <svg
                class="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
              {{ LABELS[source] }} reconnu
            </span>
            <span
              v-else-if="invalide"
              key="ko"
              class="inline-flex items-center rounded-full border border-hairline bg-coral/30 px-3 py-1.5 text-xs text-[#600000]"
            >
              Source non supportée
            </span>
            <span
              v-else
              key="neutre"
              class="inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs text-slate"
            >
              SeLoger · Leboncoin · PAP
            </span>
          </Transition>

          <button
            type="submit"
            aria-label="Analyser l’annonce"
            class="fleche-btn flex size-9 items-center justify-center rounded-full bg-ink text-white transition hover:bg-ink-deep active:scale-95"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>

    <span class="souris pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 md:block">
      <span class="block h-9 w-5 rounded-full border-2 border-white/70">
        <span class="roulette mx-auto mt-1.5 block h-1.5 w-0.5 rounded-full bg-white/80" />
      </span>
    </span>
  </section>
</template>

<style scoped>
.fond {
  animation: zoom-lent 26s ease-in-out infinite alternate;
}
@keyframes zoom-lent {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.09);
  }
}

.carte {
  animation: fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.repere {
  animation: deriver 7.5s ease-in-out infinite;
}
@keyframes deriver {
  0%,
  100% {
    transform: translateY(0) rotate(-2deg);
  }
  50% {
    transform: translateY(-14px) rotate(2deg);
  }
}

.etoile {
  display: inline-block;
  animation: pivoter 5s linear infinite;
}
@keyframes pivoter {
  to {
    transform: rotate(1turn);
  }
}

.souligne {
  transform-origin: left;
  animation: tracer 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both;
}
@keyframes tracer {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.curseur {
  animation: clignoter 1.1s steps(2, start) infinite;
}
@keyframes clignoter {
  50% {
    opacity: 0;
  }
}

.exemple-enter-active,
.exemple-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.exemple-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.exemple-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.etat-enter-active,
.etat-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.etat-enter-from,
.etat-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.fleche-btn {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease;
}
.fleche-btn:hover {
  transform: scale(1.08) translateX(2px);
}

.roulette {
  animation: descendre 1.8s ease-in-out infinite;
}
@keyframes descendre {
  0%,
  100% {
    transform: translateY(0);
    opacity: 1;
  }
  50% {
    transform: translateY(9px);
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fond,
  .repere,
  .etoile,
  .curseur,
  .roulette {
    animation: none;
  }
  .carte,
  .souligne {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .fleche-btn:hover {
    transform: none;
  }
}
</style>

<script setup lang="ts">
import type { SiteSource } from '~/types'

const SOURCES: SiteSource[] = ['seloger', 'leboncoin', 'pap', 'logic-immo', 'bienici', 'century21']

const EXEMPLES = [
  'pap.fr/annonces/appartement-marseille-8e…',
  'seloger.com/annonces/locations/appartement…',
  'leboncoin.fr/ad/locations/…',
  'bienici.com/annonce/location/lyon-6e…'
]

const LABELS: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici',
  century21: 'Century 21'
}

const url = ref('')
const indice = ref(0)
let minuteur: ReturnType<typeof setInterval> | undefined

const source = computed(() => (url.value.trim() ? detecterSource(url.value.trim()) : null))
const invalide = computed(() => url.value.trim().length > 8 && !source.value)

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
  <section class="relative isolate overflow-hidden bg-white">
    <span
      class="halo pointer-events-none absolute -left-40 top-10 size-[30rem] rounded-full bg-brand/25 blur-3xl"
    />
    <span
      class="halo pointer-events-none absolute -right-32 -top-24 size-[26rem] rounded-full bg-teal/30 blur-3xl"
      style="animation-delay: 3s"
    />

    <div class="relative mx-auto max-w-6xl px-6 pb-12 pt-10 lg:pb-16 lg:pt-14">
      <div class="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end lg:gap-14">
        <div class="lg:pb-2">
          <span
            class="animate-fade-up inline-flex items-center gap-2 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-ink-deep"
          >
            <span class="etoile">✦</span>
            6 sites, un seul tableau
          </span>

          <h1
            class="animate-fade-up mt-6 text-5xl font-light leading-[1.05] tracking-tight text-ink-deep sm:text-6xl"
            style="animation-delay: 0.06s"
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
            class="animate-fade-up mt-5 max-w-md text-base leading-relaxed text-slate"
            style="animation-delay: 0.14s"
          >
            Colle une URL d’annonce, Hovly extrait tout automatiquement. Compare, suis les prix,
            décide.
          </p>

          <form
            class="animate-fade-up mt-8 overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_10px_40px_rgba(5,0,56,0.08)] transition focus-within:border-hairline-strong focus-within:shadow-[0_14px_50px_rgba(5,0,56,0.14)]"
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
                  <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
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

        <div>
          <ApercuDashboard />

          <div class="mt-4 flex items-center justify-between gap-4 text-xs text-stone">
            <span class="rounded-full bg-surface px-3 py-1">Aperçu du tableau de bord</span>
            <span class="hidden rounded-full bg-surface px-3 py-1 sm:block">Données d’exemple</span>
          </div>
        </div>
      </div>

      <div id="sources" class="mt-16 scroll-mt-24 lg:mt-20">
        <p class="text-center text-xs font-semibold uppercase tracking-wider text-stone">
          Fonctionne avec tes sites préférés
        </p>
        <ul class="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
          <li
            v-for="(s, i) in SOURCES"
            :key="s"
            class="tuile grid aspect-[4/3] place-items-center rounded-xl border border-hairline-soft bg-surface-soft transition hover:border-hairline hover:bg-white sm:aspect-square"
            :style="{ animationDelay: `${0.4 + i * 0.06}s` }"
            :title="LABELS[s]"
          >
            <LogoSource :source="s" :taille="30" class="opacity-70 transition hover:opacity-100" />
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.halo {
  animation: respirer 11s ease-in-out infinite;
}

@keyframes respirer {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(-20px, 18px) scale(1.07);
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

.tuile {
  opacity: 0;
  animation: fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
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

@media (prefers-reduced-motion: reduce) {
  .halo,
  .etoile,
  .curseur {
    animation: none;
  }
  .souligne,
  .tuile {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .fleche-btn:hover {
    transform: none;
  }
}
</style>

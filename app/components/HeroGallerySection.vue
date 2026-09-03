<script setup lang="ts">
import type { SiteSource } from "~/types";

interface Showcase {
  source: SiteSource;
  label: string;
  titre: string;
  lieu: string;
  prix: string;
  surface: string;
  dpe: string;
  score: number;
}

const SHOWCASES: Showcase[] = [
  {
    source: "seloger",
    label: "SeLoger",
    titre: "Appartement 3 pièces",
    lieu: "Paris 11e",
    prix: "1 890 €",
    surface: "62 m²",
    dpe: "C",
    score: 84,
  },
  {
    source: "leboncoin",
    label: "Leboncoin",
    titre: "Studio meublé",
    lieu: "Lyon 6e",
    prix: "780 €",
    surface: "28 m²",
    dpe: "D",
    score: 71,
  },
  {
    source: "pap",
    label: "PAP",
    titre: "T2 avec balcon",
    lieu: "Marseille 8e",
    prix: "950 €",
    surface: "45 m²",
    dpe: "C",
    score: 77,
  },
  {
    source: "logic-immo",
    label: "Logic-Immo",
    titre: "T4 familial",
    lieu: "Bordeaux",
    prix: "1 450 €",
    surface: "88 m²",
    dpe: "B",
    score: 88,
  },
  {
    source: "bienici",
    label: "Bien’ici",
    titre: "Loft atypique",
    lieu: "Nantes",
    prix: "1 200 €",
    surface: "70 m²",
    dpe: "E",
    score: 65,
  },
  {
    source: "century21",
    label: "Century 21",
    titre: "T3 rénové",
    lieu: "Meaux",
    prix: "1 260 €",
    surface: "81 m²",
    dpe: "—",
    score: 61,
  },
];

const AUTO_DURATION = 4200;

const active = ref(0);
const manual = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

const current = computed(() => SHOWCASES[active.value]!);
const next = computed(() => SHOWCASES[(active.value + 1) % SHOWCASES.length]!);
const number = (i: number) => String(i + 1).padStart(2, "0");

function select(i: number) {
  manual.value = true;
  active.value = i;
  clearInterval(timer);
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => {
    if (!manual.value) active.value = (active.value + 1) % SHOWCASES.length;
  }, AUTO_DURATION);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto max-w-6xl px-6 pb-10 pt-8 lg:pb-14">
      <a
        href="#how"
        class="text-[11px] font-bold uppercase tracking-[0.12em] text-ink underline underline-offset-4 transition hover:text-blue"
      >
        Comment ça marche
      </a>

      <div
        class="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:items-end lg:gap-12"
      >
        <div>
          <p class="flex items-baseline gap-3 text-sm font-bold tabular-nums">
            <span class="text-ink">{{ number(active) }}</span>
            <span class="text-hairline-strong">/</span>
            <span class="text-stone">{{ number(SHOWCASES.length - 1) }}</span>
          </p>

          <h1
            class="titre mt-5 text-[clamp(2.75rem,7.5vw,5.5rem)] font-light uppercase leading-[0.86] tracking-[-0.03em] text-ink"
          >
            Tous tes<br >
            biens.<br >
            Un seul<br >
            endroit.
          </h1>
        </div>

        <div>
          <Transition name="vitrine" mode="out-in">
            <article
              :key="current.source"
              class="overflow-hidden rounded-sm border border-hairline-soft bg-white"
            >
              <div class="relative aspect-[5/4] overflow-hidden bg-surface">
                <img
                  :src="`/logements/${current.source}.jpg`"
                  :alt="`${current.titre} à ${current.lieu}`"
                  width="900"
                  height="720"
                  fetchpriority="high"
                  class="size-full object-cover"
                >

                <span
                  class="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 py-1 pl-1.5 pr-3 text-[10px] font-bold uppercase tracking-wider text-ink shadow-sm backdrop-blur"
                >
                  <SourceLogo :source="current.source" :taille="16" />
                  Importé de {{ current.label }}
                </span>

                <span
                  class="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-ink text-sm font-bold tabular-nums text-white"
                  :title="`Score Hovly ${current.score}/100`"
                >
                  {{ current.score }}
                </span>
              </div>

              <div class="px-5 py-4">
                <p class="text-lg font-semibold tracking-tight text-ink-deep">
                  {{ current.titre }}
                </p>
                <p class="mt-0.5 text-sm text-stone">{{ current.lieu }}</p>

                <dl
                  class="mt-4 grid grid-cols-3 gap-3 border-t border-hairline-soft pt-4 text-sm"
                >
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      Loyer
                    </dt>
                    <dd class="mt-0.5 font-semibold tabular-nums text-ink">
                      {{ current.prix }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      Surface
                    </dt>
                    <dd class="mt-0.5 font-semibold tabular-nums text-ink">
                      {{ current.surface }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      DPE
                    </dt>
                    <dd class="mt-0.5 font-semibold text-ink">
                      {{ current.dpe }}
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          </Transition>

          <img
            :src="`/logements/${next.source}.jpg`"
            alt=""
            width="1"
            height="1"
            aria-hidden="true"
            class="sr-only"
          >

          <div class="mt-4 flex items-center justify-between gap-6">
            <p
              class="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-ink"
            >
              {{ current.label }}
              <span class="mx-1.5 text-hairline-strong">/</span>
              <span class="font-medium text-stone">{{ current.titre }}</span>
            </p>

            <NuxtLink
              to="/ajouter"
              class="shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.12em] text-ink underline underline-offset-4 transition hover:text-blue"
            >
              Commencer →
            </NuxtLink>
          </div>
        </div>
      </div>

      <div id="sources" class="mt-12 scroll-mt-24 lg:mt-16">
        <ul class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6">
          <li v-for="(v, i) in SHOWCASES" :key="v.source">
            <button
              type="button"
              class="block w-full text-left transition"
              :aria-current="i === active"
              :aria-label="`Voir un bien importé de ${v.label}`"
              @click="select(i)"
            >
              <span
                class="block text-[11px] font-bold tabular-nums transition"
                :class="i === active ? 'text-ink' : 'text-hairline-strong'"
              >
                {{ number(i) }}
              </span>

              <span
                class="relative mt-2 block aspect-[4/3] overflow-hidden rounded-sm bg-surface transition duration-300"
                :class="
                  i === active
                    ? 'opacity-100 ring-2 ring-ink'
                    : 'opacity-45 grayscale hover:opacity-80 hover:grayscale-0'
                "
              >
                <img
                  :src="`/logements/${v.source}-vignette.jpg`"
                  alt=""
                  width="280"
                  height="210"
                  loading="lazy"
                  class="size-full object-cover"
                >
                <span
                  class="absolute bottom-1 left-1 grid size-6 place-items-center rounded-sm bg-white/90 backdrop-blur"
                >
                  <SourceLogo :source="v.source" :taille="14" />
                </span>
              </span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.titre {
  animation: fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.vitrine-enter-active,
.vitrine-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.vitrine-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.vitrine-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .titre {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .vitrine-enter-active,
  .vitrine-leave-active {
    transition: none;
  }
}
</style>

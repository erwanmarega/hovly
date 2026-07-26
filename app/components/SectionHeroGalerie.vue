<script setup lang="ts">
import type { SiteSource } from "~/types";

interface Vitrine {
  source: SiteSource;
  label: string;
  titre: string;
  lieu: string;
  prix: string;
  surface: string;
  dpe: string;
  score: number;
  teinte: string;
}

const VITRINES: Vitrine[] = [
  {
    source: "seloger",
    label: "SeLoger",
    titre: "Appartement 3 pièces",
    lieu: "Paris 11e",
    prix: "1 890 €",
    surface: "62 m²",
    dpe: "C",
    score: 84,
    teinte: "from-[#ffe9e9] to-[#ffd0d0]",
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
    teinte: "from-[#ffeede] to-[#ffdcc0]",
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
    teinte: "from-[#e6ecff] to-[#cfd9ff]",
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
    teinte: "from-[#e2f7f4] to-[#c3faf5]",
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
    teinte: "from-[#fdeaf5] to-[#fde0f0]",
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
    teinte: "from-[#fff6d8] to-[#fff4c4]",
  },
];

const DUREE_AUTO = 4200;

const actif = ref(0);
const manuel = ref(false);
let minuteur: ReturnType<typeof setInterval> | undefined;

const vitrine = computed(() => VITRINES[actif.value]!);
const numero = (i: number) => String(i + 1).padStart(2, "0");

function choisir(i: number) {
  manuel.value = true;
  actif.value = i;
  clearInterval(minuteur);
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  minuteur = setInterval(() => {
    if (!manuel.value) actif.value = (actif.value + 1) % VITRINES.length;
  }, DUREE_AUTO);
});

onBeforeUnmount(() => clearInterval(minuteur));
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
            <span class="text-ink">{{ numero(actif) }}</span>
            <span class="text-hairline-strong">/</span>
            <span class="text-stone">{{ numero(VITRINES.length - 1) }}</span>
          </p>

          <h1
            class="titre mt-5 text-[clamp(2.75rem,7.5vw,5.5rem)] font-light uppercase leading-[0.86] tracking-[-0.03em] text-ink"
          >
            Tous tes<br />
            biens.<br />
            Un seul<br />
            endroit.
          </h1>
        </div>

        <div>
          <Transition name="vitrine" mode="out-in">
            <article
              :key="vitrine.source"
              class="overflow-hidden rounded-sm border border-hairline-soft bg-white"
            >
              <div
                class="relative grid aspect-[5/4] place-items-center bg-gradient-to-br"
                :class="vitrine.teinte"
              >
                <LogoSource
                  :source="vitrine.source"
                  :taille="64"
                  class="opacity-25"
                />

                <span
                  class="absolute left-4 top-4 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink backdrop-blur"
                >
                  Importé de {{ vitrine.label }}
                </span>

                <span
                  class="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-ink text-sm font-bold tabular-nums text-white"
                  :title="`Score Hovly ${vitrine.score}/100`"
                >
                  {{ vitrine.score }}
                </span>
              </div>

              <div class="px-5 py-4">
                <p class="text-lg font-semibold tracking-tight text-ink-deep">
                  {{ vitrine.titre }}
                </p>
                <p class="mt-0.5 text-sm text-stone">{{ vitrine.lieu }}</p>

                <dl
                  class="mt-4 grid grid-cols-3 gap-3 border-t border-hairline-soft pt-4 text-sm"
                >
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      Loyer
                    </dt>
                    <dd class="mt-0.5 font-semibold tabular-nums text-ink">
                      {{ vitrine.prix }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      Surface
                    </dt>
                    <dd class="mt-0.5 font-semibold tabular-nums text-ink">
                      {{ vitrine.surface }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[10px] uppercase tracking-wider text-stone">
                      DPE
                    </dt>
                    <dd class="mt-0.5 font-semibold text-ink">
                      {{ vitrine.dpe }}
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          </Transition>

          <div class="mt-4 flex items-center justify-between gap-6">
            <p
              class="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-ink"
            >
              {{ vitrine.label }}
              <span class="mx-1.5 text-hairline-strong">/</span>
              <span class="font-medium text-stone">{{ vitrine.titre }}</span>
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
          <li v-for="(v, i) in VITRINES" :key="v.source">
            <button
              type="button"
              class="block w-full text-left transition"
              :aria-current="i === actif"
              :aria-label="`Voir un bien importé de ${v.label}`"
              @click="choisir(i)"
            >
              <span
                class="block text-[11px] font-bold tabular-nums transition"
                :class="i === actif ? 'text-ink' : 'text-hairline-strong'"
              >
                {{ numero(i) }}
              </span>

              <span
                class="mt-2 grid aspect-[4/3] place-items-center rounded-sm bg-gradient-to-br transition duration-300"
                :class="[
                  v.teinte,
                  i === actif
                    ? 'opacity-100 ring-2 ring-ink'
                    : 'opacity-40 grayscale hover:opacity-75 hover:grayscale-0',
                ]"
              >
                <LogoSource :source="v.source" :taille="26" />
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

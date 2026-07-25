<script setup lang="ts">
import type { SiteSource } from "~/types";

const SOURCES: SiteSource[] = ["seloger", "leboncoin", "pap"];

const etapes = [
  {
    n: "1",
    visuel: "sources",
    titre: "Trouve une annonce",
    texte: "Sur SeLoger, Leboncoin, PAP… n’importe quelle source.",
  },
  {
    n: "2",
    visuel: "url",
    titre: "Colle l’URL",
    texte: "Hovly extrait toutes les infos en quelques secondes.",
  },
  {
    n: "3",
    visuel: "tableau",
    titre: "Compare et décide",
    texte: "Tout dans un tableau. Note, filtre, suis les prix.",
  },
] as const;

const champs = [
  { label: "62 m²", tint: "bg-teal" },
  { label: "3 pièces", tint: "bg-brand-light" },
  { label: "DPE C", tint: "bg-rose" },
];

const lignes = [
  { largeur: "w-full", score: 82, tint: "bg-teal" },
  { largeur: "w-4/5", score: 61, tint: "bg-brand" },
  { largeur: "w-3/5", score: 34, tint: "bg-coral" },
];
</script>

<template>
  <section id="how" class="relative overflow-hidden bg-surface">
    <div
      class="pointer-events-none absolute -left-32 top-16 size-80 rounded-full bg-teal/30 blur-3xl animate-float"
    />
    <div
      class="pointer-events-none absolute -right-28 bottom-10 size-80 rounded-full bg-brand/25 blur-3xl animate-float"
      style="animation-delay: 3s"
    />

    <div class="relative mx-auto max-w-6xl px-6 py-24">
      <div v-reveal class="text-center">
        <h2
          class="mx-auto mt-5 max-w-xl text-4xl md:text-5xl font-light tracking-tight text-ink-deep"
        >
          Trois étapes, c’est tout
        </h2>
        <p class="mx-auto mt-4 max-w-md text-lg text-slate">
          De l’annonce repérée à la décision, sans ressaisir une ligne.
        </p>
      </div>

      <ol
        v-reveal.groupe
        class="parcours relative mt-16 grid gap-8 md:grid-cols-3"
      >
        <div
          class="ligne pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px origin-left bg-gradient-to-r from-hairline via-ink/30 to-hairline md:block"
        />

        <li
          v-for="(e, i) in etapes"
          :key="e.n"
          class="etape relative"
          :style="{ '--retard': `${i * 0.14}s` }"
        >
          <div
            class="carte relative h-full overflow-hidden rounded-feature border border-hairline-soft bg-white p-7 text-center"
          >
            <span class="brillance pointer-events-none absolute inset-0" />

            <span
              class="badge relative z-10 mx-auto flex size-12 items-center justify-center rounded-full bg-ink text-lg font-bold text-white"
            >
              {{ e.n }}
            </span>

            <div class="visuel mt-7 grid h-24 place-items-center">
              <div
                v-if="e.visuel === 'sources'"
                class="flex items-center gap-3"
              >
                <span
                  v-for="(s, j) in SOURCES"
                  :key="s"
                  class="jeton grid size-12 place-items-center rounded-2xl border border-hairline-soft bg-surface-soft"
                  :style="{ animationDelay: `${j * 0.25}s` }"
                >
                  <LogoSource :source="s" :avec-nom="false" :taille="24" />
                </span>
              </div>

              <div v-else-if="e.visuel === 'url'" class="w-full max-w-[15rem]">
                <div
                  class="flex items-center gap-2 rounded-full border border-hairline bg-surface-soft px-3.5 py-2 text-left"
                >
                  <span class="size-1.5 shrink-0 rounded-full bg-teal-deep" />
                  <span class="truncate text-xs text-steel"
                    >seloger.com/annonces…</span
                  >
                  <span class="curseur h-3.5 w-px shrink-0 bg-ink" />
                </div>
                <div class="mt-3 flex flex-wrap justify-center gap-1.5">
                  <span
                    v-for="(c, j) in champs"
                    :key="c.label"
                    class="champ rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-deep"
                    :class="c.tint"
                    :style="{ animationDelay: `${0.5 + j * 0.18}s` }"
                  >
                    {{ c.label }}
                  </span>
                </div>
              </div>

              <div v-else class="w-full max-w-[15rem] space-y-2">
                <div
                  v-for="(l, j) in lignes"
                  :key="j"
                  class="rangee flex items-center gap-2.5"
                  :style="{ animationDelay: `${j * 0.16}s` }"
                >
                  <span class="size-6 shrink-0 rounded-md bg-surface" />
                  <span
                    class="h-2 rounded-full bg-hairline"
                    :class="l.largeur"
                  />
                  <span
                    class="ml-auto grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-ink-deep"
                    :class="[l.tint, j === 0 && 'pastille']"
                  >
                    {{ l.score }}
                  </span>
                </div>
              </div>
            </div>

            <h3 class="mt-6 text-xl font-light text-ink-deep">{{ e.titre }}</h3>
            <p class="mt-2 text-slate">{{ e.texte }}</p>
          </div>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.ligne {
  transform: scaleX(0);
  transition: transform 1.1s cubic-bezier(0.22, 1, 0.36, 1) 0.25s;
}
.parcours.is-visible .ligne {
  transform: scaleX(1);
}

.etape {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) var(--retard),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) var(--retard);
}
.parcours.is-visible .etape {
  opacity: 1;
  transform: translateY(0);
}

.carte {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.4s ease, border-color 0.4s ease;
}
.carte:hover {
  transform: translateY(-6px);
  border-color: var(--color-hairline);
  box-shadow: 0 18px 40px rgb(5 0 56 / 8%);
}

.badge {
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.carte:hover .badge {
  transform: rotate(-8deg) scale(1.12);
}

.brillance {
  background: linear-gradient(
    115deg,
    transparent 40%,
    rgb(255 255 255 / 65%) 50%,
    transparent 60%
  );
  transform: translateX(-120%);
}
.carte:hover .brillance {
  animation: balayage 0.9s ease-out;
}
@keyframes balayage {
  to {
    transform: translateX(120%);
  }
}

.jeton {
  animation: flotter 3.6s ease-in-out infinite;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.carte:hover .jeton {
  transform: translateY(-4px) scale(1.06);
}
@keyframes flotter {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-7px);
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

.champ {
  opacity: 0;
  animation: surgir 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes surgir {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.rangee {
  opacity: 0;
  animation: glisser 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes glisser {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.pastille {
  animation: battre 2.4s ease-in-out infinite;
}
@keyframes battre {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ligne,
  .etape {
    transition: none;
    opacity: 1;
    transform: none;
  }
  .carte:hover {
    transform: none;
  }
  .jeton,
  .curseur,
  .champ,
  .rangee,
  .pastille,
  .brillance {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>

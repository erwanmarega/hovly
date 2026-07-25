<script setup lang="ts">
import type { SiteSource } from '~/types'

const SOURCES: SiteSource[] = ['seloger', 'leboncoin', 'pap', 'logic-immo', 'bienici']

const titre = ['Arrête', 'de', 'jongler.', 'Commence', 'à', 'comparer.']

const gages = ['Gratuit', 'Sans carte bancaire', '5 sites supportés']

const cartesFlottantes = [
  { classe: 'left-[6%] top-[18%]', delai: '0s', label: '1 240 €', detail: '48 m² · Lyon 6e' },
  { classe: 'right-[7%] top-[26%]', delai: '1.4s', label: '82', detail: 'Score Hovly' },
  { classe: 'left-[11%] bottom-[16%]', delai: '2.6s', label: '−150 €', detail: 'Baisse détectée' }
]
</script>

<template>
  <section class="mx-auto max-w-6xl px-6 py-24">
    <div
      v-reveal.groupe
      class="panneau relative isolate overflow-hidden rounded-feature bg-brand px-8 py-16 text-center md:py-24"
    >
      <span class="halo pointer-events-none absolute -inset-1/2" />
      <span class="grille pointer-events-none absolute inset-0" />

      <span
        v-for="c in cartesFlottantes"
        :key="c.label"
        class="fiche pointer-events-none absolute hidden rounded-2xl bg-white/85 px-3.5 py-2 text-left shadow-[0_8px_24px_rgba(5,0,56,0.10)] backdrop-blur-sm lg:block"
        :class="c.classe"
        :style="{ animationDelay: c.delai }"
      >
        <span class="block text-sm font-bold text-ink-deep">{{ c.label }}</span>
        <span class="block text-[11px] text-steel">{{ c.detail }}</span>
      </span>

      <h2
        class="relative mx-auto max-w-2xl text-4xl md:text-5xl font-light tracking-tight text-ink"
      >
        <span
          v-for="(mot, i) in titre"
          :key="i"
          class="mot inline-block"
          :style="{ '--retard': `${0.05 + i * 0.07}s` }"
        >
          {{ mot }}&nbsp;
        </span>
      </h2>

      <p class="sous-titre relative mx-auto mt-4 max-w-lg text-lg text-ink/70">
        Crée ton tableau de bord immobilier en moins d’une minute.
      </p>

      <div class="action relative mt-9">
        <a
          href="/login"
          class="bouton group inline-flex items-center gap-2.5 rounded-full bg-ink px-8 py-3.5 font-medium text-white transition hover:bg-black active:scale-95"
        >
          <span class="reflet pointer-events-none absolute inset-0 rounded-full" />
          Commencer gratuitement
          <svg
            class="fleche size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </a>
      </div>

      <ul class="gages relative mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <li
          v-for="(g, i) in gages"
          :key="g"
          class="flex items-center gap-1.5 text-sm font-medium text-ink/60"
        >
          <span v-if="i > 0" class="mr-3 hidden size-1 rounded-full bg-ink/25 sm:block" />
          <svg
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
          {{ g }}
        </li>
      </ul>

      <div class="logos relative mt-8 flex flex-wrap items-center justify-center gap-5">
        <LogoSource
          v-for="s in SOURCES"
          :key="s"
          :source="s"
          :avec-nom="false"
          :taille="26"
          class="logo opacity-45 transition hover:opacity-100"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.halo {
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgb(255 255 255 / 55%) 60deg,
    transparent 140deg,
    rgb(255 255 255 / 35%) 240deg,
    transparent 330deg
  );
  animation: tourner 22s linear infinite;
  opacity: 0.5;
}
@keyframes tourner {
  to {
    transform: rotate(1turn);
  }
}

.grille {
  background-image:
    linear-gradient(to right, rgb(5 0 56 / 6%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(5 0 56 / 6%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 50% 45%, black, transparent 72%);
}

.fiche {
  animation: deriver 7s ease-in-out infinite;
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

.mot {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--retard),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) var(--retard);
}
.panneau.is-visible .mot {
  opacity: 1;
  transform: none;
}

.sous-titre,
.action,
.gages,
.logos {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.panneau.is-visible .sous-titre {
  transition-delay: 0.5s;
}
.panneau.is-visible .action {
  transition-delay: 0.6s;
}
.panneau.is-visible .gages {
  transition-delay: 0.7s;
}
.panneau.is-visible .logos {
  transition-delay: 0.8s;
}
.panneau.is-visible .sous-titre,
.panneau.is-visible .action,
.panneau.is-visible .gages,
.panneau.is-visible .logos {
  opacity: 1;
  transform: none;
}

.bouton {
  position: relative;
  overflow: hidden;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease,
    box-shadow 0.35s ease;
}
.bouton:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 14px 30px rgb(5 0 56 / 22%);
}

.reflet {
  background: linear-gradient(115deg, transparent 42%, rgb(255 255 255 / 30%) 50%, transparent 58%);
  transform: translateX(-130%);
}
.bouton:hover .reflet {
  animation: balayer 0.85s ease-out;
}
@keyframes balayer {
  to {
    transform: translateX(130%);
  }
}

.fleche {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.bouton:hover .fleche {
  transform: translateX(4px);
}

.logo:hover {
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .halo,
  .fiche {
    animation: none;
  }
  .mot,
  .sous-titre,
  .action,
  .gages,
  .logos {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .bouton:hover,
  .logo:hover {
    transform: none;
  }
  .reflet {
    display: none;
  }
}
</style>

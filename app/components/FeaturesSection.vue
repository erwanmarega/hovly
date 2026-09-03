<script setup lang="ts">
const features = [
  {
    cle: 'url',
    tint: 'bg-brand',
    span: 'md:col-span-3',
    titre: 'Ajout par URL',
    texte:
      'Colle le lien d’une annonce. Hovly scrape et extrait prix, surface, pièces, DPE et photos automatiquement.'
  },
  {
    cle: 'tableau',
    tint: 'bg-teal',
    span: 'md:col-span-2',
    titre: 'Tableau comparatif',
    texte: 'Tous tes biens côte à côte : prix, €/m², surface, étage, DPE. Trie et filtre comme tu veux.'
  },
  {
    cle: 'alertes',
    tint: 'bg-coral',
    span: 'md:col-span-2',
    titre: 'Alertes de prix',
    texte: 'Notifié dès qu’une annonce baisse ou disparaît. Plus besoin de rafraîchir 4 onglets.'
  },
  {
    cle: 'ia',
    tint: 'bg-rose',
    span: 'md:col-span-3',
    badge: 'Prochainement',
    titre: 'Analyse IA',
    texte:
      'Une synthèse par l’IA sur chaque bien : points forts, points faibles, cohérence du prix.'
  }
] as const

const colonnes = [
  { w: 'w-full', score: 'bg-teal' },
  { w: 'w-5/6', score: 'bg-brand' },
  { w: 'w-2/3', score: 'bg-coral' }
]
</script>

<template>
  <section id="features" class="mx-auto max-w-6xl px-6 py-24">
    <div v-reveal class="max-w-2xl mb-14">
      <span
        class="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-steel"
      >
        <span class="size-1.5 rounded-full bg-teal-deep" />
        Fonctionnalités
      </span>
      <h2 class="mt-5 text-4xl md:text-5xl font-light tracking-tight text-ink-deep">
        Tout ce qu’il faut pour choisir
      </h2>
      <p class="mt-4 text-lg text-slate">
        De l’ajout d’une annonce à la décision finale, sans changer d’onglet.
      </p>
    </div>

    <div v-reveal.groupe class="bento grid gap-5 md:grid-cols-5">
      <article
        v-for="(f, i) in features"
        :key="f.cle"
        class="tuile group relative overflow-hidden rounded-[28px] border border-hairline-soft bg-white p-8"
        :class="f.span"
        :style="{ '--retard': `${i * 0.1}s` }"
      >
        <span class="lueur pointer-events-none absolute -right-16 -top-16 size-48 rounded-full" :class="f.tint" />
        <span class="reflet pointer-events-none absolute inset-0" />

        <div class="relative flex items-start justify-between gap-4">
          <div
            class="icone inline-flex size-14 items-center justify-center rounded-2xl text-ink-deep"
            :class="f.tint"
          >
            <svg
              v-if="f.cle === 'url'"
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19" />
            </svg>
            <svg
              v-else-if="f.cle === 'tableau'"
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 10h18M9 10v10" />
            </svg>
            <svg
              v-else-if="f.cle === 'alertes'"
              class="cloche size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
            <svg
              v-else
              class="size-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
            </svg>
          </div>

          <span
            v-if="f.badge"
            class="rounded-full border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-steel"
          >
            {{ f.badge }}
          </span>
        </div>

        <h3 class="relative mt-5 text-xl font-bold text-ink-deep">{{ f.titre }}</h3>
        <p class="relative mt-2 text-slate leading-relaxed">{{ f.texte }}</p>

        <div class="apercu relative mt-6 h-16">
          <div
            v-if="f.cle === 'url'"
            class="flex items-center gap-2 rounded-full border border-hairline bg-surface-soft px-4 py-2.5"
          >
            <span class="truncate text-xs text-steel">pap.fr/annonces/appartement-…</span>
            <span class="ml-auto shrink-0 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">
              Analyser
            </span>
          </div>

          <div v-else-if="f.cle === 'tableau'" class="space-y-2">
            <div v-for="(c, j) in colonnes" :key="j" class="barre flex items-center gap-2" :style="{ '--i': j }">
              <span class="h-2 rounded-full bg-hairline transition-all duration-500" :class="c.w" />
              <span class="ml-auto size-2.5 shrink-0 rounded-full" :class="c.score" />
            </div>
          </div>

          <div v-else-if="f.cle === 'alertes'" class="flex items-end gap-3">
            <svg class="courbe h-14 flex-1" viewBox="0 0 120 48" fill="none" preserveAspectRatio="none">
              <path
                d="M2 12 L30 14 L58 13 L86 30 L118 34"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                class="trace text-ink"
              />
            </svg>
            <span class="shrink-0 rounded-full bg-teal px-2.5 py-1 text-[11px] font-bold text-[#0a4a42]">
              −8 %
            </span>
          </div>

          <div v-else class="space-y-2">
            <span class="squelette block h-2.5 w-4/5 rounded-full" />
            <span class="squelette block h-2.5 w-3/5 rounded-full" style="animation-delay: 0.25s" />
            <span class="squelette block h-2.5 w-2/3 rounded-full" style="animation-delay: 0.5s" />
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.tuile {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) var(--retard),
    transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) var(--retard),
    box-shadow 0.4s ease,
    border-color 0.4s ease;
}
.bento.is-visible .tuile {
  opacity: 1;
  transform: none;
}
.bento.is-visible .tuile:hover {
  transform: translateY(-6px);
  border-color: var(--color-hairline);
  box-shadow: 0 20px 44px rgb(5 0 56 / 9%);
}

.lueur {
  opacity: 0;
  filter: blur(48px);
  transition: opacity 0.5s ease;
}
.tuile:hover .lueur {
  opacity: 0.5;
}

.reflet {
  background: linear-gradient(115deg, transparent 42%, rgb(255 255 255 / 55%) 50%, transparent 58%);
  transform: translateX(-130%);
}
.tuile:hover .reflet {
  animation: balayer 0.9s ease-out;
}
@keyframes balayer {
  to {
    transform: translateX(130%);
  }
}

.icone {
  transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.tuile:hover .icone {
  transform: rotate(-8deg) scale(1.08);
}

.tuile:hover .cloche {
  animation: sonner 0.7s ease-in-out;
  transform-origin: top center;
}
@keyframes sonner {
  0%,
  100% {
    transform: rotate(0);
  }
  20% {
    transform: rotate(14deg);
  }
  40% {
    transform: rotate(-10deg);
  }
  60% {
    transform: rotate(6deg);
  }
  80% {
    transform: rotate(-4deg);
  }
}

.tuile:hover .barre span:first-child {
  width: 100%;
  transition-delay: calc(var(--i) * 0.08s);
}

.trace {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1);
}
.bento.is-visible .trace {
  stroke-dashoffset: 0;
}

.squelette {
  background: linear-gradient(
    90deg,
    var(--color-hairline-soft) 0%,
    var(--color-hairline) 40%,
    var(--color-hairline-soft) 80%
  );
  background-size: 200% 100%;
  animation: scintiller 2.2s ease-in-out infinite;
}
@keyframes scintiller {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tuile {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .bento.is-visible .tuile:hover,
  .tuile:hover .icone {
    transform: none;
  }
  .reflet,
  .lueur {
    display: none;
  }
  .cloche,
  .squelette {
    animation: none;
  }
  .trace {
    stroke-dashoffset: 0;
    transition: none;
  }
}
</style>

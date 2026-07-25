<script setup lang="ts">
import type { SiteSource } from '~/types'

useHead({
  title: 'Hovly — Tous tes biens immobiliers en un seul endroit',
  meta: [
    { name: 'description', content: 'Colle une URL d\'annonce, Hovly extrait tout automatiquement. Compare, suis les prix, prends ta décision.' }
  ]
})

const sources: SiteSource[] = [
  'seloger',
  'leboncoin',
  'pap',
  'logic-immo',
  'bienici',
  'century21'
]


</script>

<template>
  <div class="min-h-screen bg-white text-ink antialiased">
    <TheNavbar show-links />

    <SectionHero />

    <section id="sources" class="border-y border-hairline-soft bg-surface-soft">
      <div class="mx-auto max-w-6xl px-6 py-10">
        <p class="text-center text-xs font-semibold uppercase tracking-wider text-stone mb-6">
          Fonctionne avec tes sites préférés
        </p>
        <div class="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div
            class="flex w-max items-center gap-10 animate-marquee group-hover:[animation-play-state:paused]"
          >
            <LogoSource
              v-for="(s, i) in [...sources, ...sources, ...sources, ...sources]"
              :key="i"
              :source="s"
              :taille="28"
              class="opacity-70 transition hover:opacity-100"
            />
          </div>
        </div>
      </div>
    </section>

    <SectionFeatures />

    <SectionEtapes />

    <SectionCta />

    <footer class="bg-ink text-white">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <p class="text-xl font-bold">Hovly</p>
            <p class="mt-2 text-sm text-stone max-w-xs">
              L'agrégateur de biens immobiliers. Tous tes favoris, un seul tableau.
            </p>
          </div>
          <div class="flex gap-16 text-sm">
            <div class="space-y-3">
              <p class="font-semibold text-stone">Produit</p>
              <a href="#features" class="block text-white/70 hover:text-white transition">Fonctionnalités</a>
              <a href="#how" class="block text-white/70 hover:text-white transition">Comment ça marche</a>
            </div>
            <div class="space-y-3">
              <p class="font-semibold text-stone">Légal</p>
              <a href="#" class="block text-white/70 hover:text-white transition">Confidentialité</a>
              <a href="#" class="block text-white/70 hover:text-white transition">CGU</a>
            </div>
          </div>
        </div>
        <div class="mt-12 pt-6 border-t border-white/10 text-xs text-stone">
          © 2026 Hovly. Tous droits réservés.
        </div>
      </div>
    </footer>
  </div>
</template>

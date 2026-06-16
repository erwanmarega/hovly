<script setup lang="ts">
useHead({
  title: 'Hovly — Tous tes biens immobiliers en un seul endroit',
  meta: [
    { name: 'description', content: 'Colle une URL d\'annonce, Hovly extrait tout automatiquement. Compare, suis les prix, prends ta décision.' }
  ]
})

const sources = ['SeLoger', 'Leboncoin', 'PAP', 'Logic-Immo', 'BienIci']

const features = [
  {
    tint: 'bg-brand',
    emoji: '',
    title: 'Ajout par URL',
    text: 'Colle le lien d\'une annonce. Hovly scrape et extrait prix, surface, pièces, DPE et photos automatiquement.'
  },
  {
    tint: 'bg-teal',
    emoji: '',
    title: 'Tableau comparatif',
    text: 'Tous tes biens côte à côte : prix, €/m², surface, étage, DPE. Trie et filtre comme tu veux.'
  },
  {
    tint: 'bg-coral',
    emoji: '',
    title: 'Alertes de prix',
    text: 'Notifié dès qu\'une annonce baisse ou disparaît. Plus besoin de rafraîchir 4 onglets.'
  },
  {
    tint: 'bg-rose',
    emoji: '',
    title: 'Analyse IA',
    text: 'Une synthèse par l\'IA sur chaque bien : points forts, points faibles, cohérence du prix.'
  }
]

const steps = [
  { n: '1', title: 'Trouve une annonce', text: 'Sur SeLoger, Leboncoin, PAP… n\'importe quelle source.' },
  { n: '2', title: 'Colle l\'URL', text: 'Hovly extrait toutes les infos en quelques secondes.' },
  { n: '3', title: 'Compare et décide', text: 'Tout dans un tableau. Note, filtre, suis les prix.' }
]

// Reveal au scroll : ajoute .is-visible quand l'élément entre dans le viewport
const vReveal = {
  mounted(el: HTMLElement, binding: { value?: string }) {
    el.classList.add('reveal')
    if (binding.value) el.style.transitionDelay = binding.value
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          io.unobserve(el)
        }
      },
      { threshold: 0.15 }
    )
    io.observe(el)
  }
}
</script>

<template>
  <div class="min-h-screen bg-white text-ink antialiased">
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-hairline-soft">
      <nav class="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <a href="#" class="text-xl font-bold tracking-tight">Hovly</a>
        <div class="hidden md:flex items-center gap-8 text-sm text-slate">
          <a href="#features" class="hover:text-ink transition">Fonctionnalités</a>
          <a href="#how" class="hover:text-ink transition">Comment ça marche</a>
          <a href="#sources" class="hover:text-ink transition">Sources</a>
        </div>
        <div class="flex items-center gap-3">
          <a href="/login" class="hidden sm:inline text-sm font-medium hover:text-slate transition">Se connecter</a>
          <a href="#" class="rounded-full bg-ink text-white text-sm font-medium px-5 py-2.5 hover:bg-black transition">
            Commencer
          </a>
        </div>
      </nav>
    </header>

    <section class="relative bg-brand overflow-hidden">
      <div class="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center">
        <h1 class="animate-fade-up mx-auto max-w-3xl text-5xl md:text-7xl font-light tracking-tight leading-[1.05] text-ink-deep">
          Tous tes biens.<br>
          <span class="relative inline-block">
            <span class="relative z-10">Un seul</span>{{ ' ' }}
            <span class="relative z-10 text-white" aria-label="endroit.">
              <span
                v-for="(c, i) in 'endroit.'.split('')"
                :key="i"
                class="wave-letter"
                :style="{ animationDelay: `${i * 0.08}s` }"
                aria-hidden="true"
              >{{ c }}</span>
            </span>
            <span class="absolute inset-x-56 top-2 right-2 h-16 bg-black z-0 -skew-y-1 -skew-x-2"></span>
          </span>
        </h1>
        <p class="animate-fade-up mx-auto mt-6 max-w-xl text-lg text-slate leading-relaxed" style="animation-delay: 0.12s">
          Fini de jongler entre SeLoger, Leboncoin et PAP. Colle une URL, Hovly extrait tout
          et l'ajoute à ton tableau de bord. Compare, suis les prix, décide.
        </p>

        <div class="animate-fade-up mx-auto mt-10 flex max-w-xl flex-col sm:flex-row gap-3" style="animation-delay: 0.24s">
          <input
            type="text"
            placeholder="https://www.seloger.com/annonces/..."
            class="flex-1 h-12 rounded-full border border-hairline-strong bg-white px-5 text-sm outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition"
          />
          <button class="h-12 rounded-full bg-ink text-white text-sm font-medium px-7 hover:bg-black hover:scale-[1.03] active:scale-95 transition whitespace-nowrap">
            Ajouter le bien →
          </button>
        </div>
        <p class="animate-fade-up mt-3 text-xs text-ink" style="animation-delay: 0.36s">Gratuit. Sans carte bancaire.</p>
      </div>

      <div class="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-teal/40 blur-3xl animate-float"></div>
      <div class="pointer-events-none absolute top-10 -right-20 size-72 rounded-full bg-coral/40 blur-3xl animate-float" style="animation-delay: 2s"></div>
    </section>

    <section id="sources" class="border-y border-hairline-soft bg-surface-soft">
      <div class="mx-auto max-w-6xl px-6 py-10">
        <p class="text-center text-xs font-semibold uppercase tracking-wider text-stone mb-6">
          Fonctionne avec tes sites préférés
        </p>
        <div class="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div class="flex w-max gap-10 animate-marquee group-hover:[animation-play-state:paused]">
            <span
              v-for="(s, i) in [...sources, ...sources, ...sources, ...sources]"
              :key="i"
              class="shrink-0 text-lg font-semibold text-steel whitespace-nowrap"
            >{{ s }}</span>
          </div>
        </div>
      </div>
    </section>

    <section id="features" class="mx-auto max-w-6xl px-6 py-24">
      <div v-reveal class="max-w-2xl mb-14">
        <h2 class="text-4xl md:text-5xl font-bold tracking-tight text-ink-deep">
          Tout ce qu'il faut pour choisir
        </h2>
        <p class="mt-4 text-lg text-slate">
          De l'ajout d'une annonce à la décision finale, sans changer d'onglet.
        </p>
      </div>
      <div class="grid sm:grid-cols-2 gap-5">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          v-reveal="`${i * 0.1}s`"
          class="rounded-[28px] border border-hairline-soft p-8 hover:shadow-lg hover:-translate-y-1 transition duration-300"
        >
          <div :class="['inline-flex size-14 items-center justify-center rounded-2xl text-2xl', f.tint]">
            {{ f.emoji }}
          </div>
          <h3 class="mt-5 text-xl font-bold text-ink-deep">{{ f.title }}</h3>
          <p class="mt-2 text-slate leading-relaxed">{{ f.text }}</p>
        </div>
      </div>
    </section>

    <section id="how" class="bg-surface">
      <div class="mx-auto max-w-6xl px-6 py-24">
        <h2 v-reveal class="text-center text-4xl md:text-5xl font-bold tracking-tight text-ink-deep mb-16">
          Trois étapes, c'est tout
        </h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div v-for="(s, i) in steps" :key="s.n" v-reveal="`${i * 0.12}s`" class="text-center">
            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-ink text-white text-lg font-bold">
              {{ s.n }}
            </div>
            <h3 class="mt-5 text-xl font-bold text-ink-deep">{{ s.title }}</h3>
            <p class="mt-2 text-slate">{{ s.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 py-24">
      <div v-reveal class="relative overflow-hidden rounded-feature bg-brand px-8 py-16 md:py-20 text-center">
        <h2 class="mx-auto max-w-2xl text-4xl md:text-5xl font-bold tracking-tight text-ink">
          Arrête de jongler. Commence à comparer.
        </h2>
        <p class="mx-auto mt-4 max-w-lg text-ink/70 text-lg">
          Crée ton tableau de bord immobilier en moins d'une minute.
        </p>
        <a href="#" class="mt-8 inline-block rounded-full bg-ink text-white font-medium px-8 py-3.5 hover:bg-black hover:scale-[1.03] active:scale-95 transition">
          Commencer gratuitement
        </a>
      </div>
    </section>

    <footer class="bg-ink text-white">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex flex-col md:flex-row justify-between gap-8">
          <div>
            <p class="text-xl font-bold">🏠 Hovly</p>
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

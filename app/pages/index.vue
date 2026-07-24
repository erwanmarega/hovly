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
    title: 'Analyse IA - (prochainement)',
    text: 'Une synthèse par l\'IA sur chaque bien : points forts, points faibles, cohérence du prix.'
  }
]

const steps = [
  { n: '1', title: 'Trouve une annonce', text: 'Sur SeLoger, Leboncoin, PAP… n\'importe quelle source.' },
  { n: '2', title: 'Colle l\'URL', text: 'Hovly extrait toutes les infos en quelques secondes.' },
  { n: '3', title: 'Compare et décide', text: 'Tout dans un tableau. Note, filtre, suis les prix.' }
]

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
    <TheNavbar show-links />

    <section class="relative flex items-center min-h-[80vh] md:h-[600px] bg-brand overflow-hidden px-4 sm:px-6 py-16 md:py-0">
      <img
        src="https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?w=1920&q=80"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />
      <div class="relative mx-auto w-full max-w-xl bg-white/95 backdrop-blur-md rounded-3xl px-8 py-12 text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div class="animate-fade-up inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1 text-xs font-semibold text-ink-deep mb-7">
          <span>✦</span> 
        </div>

        <h1 class="animate-fade-up mx-auto max-w-lg text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.08] text-ink-deep" style="animation-delay: 0.04s">
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
              <span class="absolute -bottom-1 left-0 right-0 h-[3px] bg-brand rounded-full"></span>
            </span>
          </span>
        </h1>

        <p class="animate-fade-up mx-auto mt-5 max-w-sm text-base text-slate leading-relaxed" style="animation-delay: 0.12s">
          Colle une URL d'annonce, Hovly extrait tout automatiquement. Compare, suis les prix, décide.
        </p>

        <div class="animate-fade-up mt-8 w-full rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] overflow-hidden" style="animation-delay: 0.24s">
          <div class="px-5 pt-5 pb-4">
            <input
              type="text"
              placeholder="Colle une URL d'annonce…"
              class="w-full bg-transparent text-sm text-ink outline-none placeholder:text-stone"
            />
          </div>
          <div class="flex items-center justify-between gap-2 px-3 pb-3">
            <span class="inline-flex items-center rounded-full bg-surface border border-hairline px-3 py-1.5 text-xs text-slate">
              SeLoger · Leboncoin · PAP
            </span>
            <button class="flex items-center justify-center size-9 rounded-full bg-ink text-white hover:bg-ink-deep hover:scale-[1.05] active:scale-95 transition">
              <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>
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
        <h2 class="text-4xl md:text-5xl font-light tracking-tight text-ink-deep">
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
        <h2 v-reveal class="text-center text-4xl md:text-5xl font-light tracking-tight text-ink-deep mb-16">
          Trois étapes, c'est tout
        </h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div v-for="(s, i) in steps" :key="s.n" v-reveal="`${i * 0.12}s`" class="text-center">
            <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-ink text-white text-lg font-bold">
              {{ s.n }}
            </div>
            <h3 class="mt-5 text-xl font-light text-ink-deep">{{ s.title }}</h3>
            <p class="mt-2 text-slate">{{ s.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-6 py-24">
      <div v-reveal class="relative overflow-hidden rounded-feature bg-brand px-8 py-16 md:py-20 text-center">
        <h2 class="mx-auto max-w-2xl text-4xl md:text-5xl font-light tracking-tight text-ink">
          Arrête de jongler. Commence à comparer.
        </h2>
        <p class="mx-auto mt-4 max-w-lg text-ink/70 text-lg">
          Crée ton tableau de bord immobilier en moins d'une minute.
        </p>
        <a href="/login" class="mt-8 inline-block rounded-full bg-ink text-white font-medium px-8 py-3.5 hover:bg-black hover:scale-[1.03] active:scale-95 transition">
          Commencer gratuitement
        </a>
      </div>
    </section>

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

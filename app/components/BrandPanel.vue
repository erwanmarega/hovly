<script setup lang="ts">
withDefaults(
  defineProps<{
    titre?: string
    accroche?: string
  }>(),
  {
    titre: 'Tes annonces, enfin au même endroit.',
    accroche: 'Colle une URL, Hovly extrait tout : prix, surface, DPE, photos. Puis compare et suis les baisses.'
  }
)

const CARTES = [
  { valeur: '82', detail: 'Score Hovly', teinte: 'bg-teal text-[#0a4a42]', decalage: 'ml-0', delai: '0s' },
  { valeur: '−150 €', detail: 'Baisse détectée', teinte: 'bg-coral text-[#600000]', decalage: 'ml-10', delai: '1.4s' },
  { valeur: '22 min', detail: 'Boulot, en transports', teinte: 'bg-white text-ink', decalage: 'ml-4', delai: '2.6s' }
]
</script>

<template>
  <div class="relative isolate hidden overflow-hidden bg-brand lg:flex lg:w-1/2 lg:flex-col lg:justify-center">
    <span
      class="halo pointer-events-none absolute -right-28 -top-32 size-[28rem] rounded-full bg-white/50 blur-3xl"
    />
    <span
      class="halo pointer-events-none absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-brand-deep/40 blur-3xl"
      style="animation-delay: 3s"
    />
    <span class="quadrillage pointer-events-none absolute inset-0" />

    <div class="relative px-12 xl:px-16">
      <img
        src="/abeille.png"
        alt=""
        class="animate-float size-16 drop-shadow-[0_10px_24px_rgba(5,0,56,0.18)]"
      >

      <h2 class="mt-8 max-w-md text-4xl font-light leading-tight tracking-tight text-ink-deep">
        {{ titre }}
      </h2>
      <p class="mt-4 max-w-sm text-ink-deep/60">{{ accroche }}</p>

      <ul class="mt-12 space-y-3">
        <li
          v-for="c in CARTES"
          :key="c.detail"
          class="carte flex w-fit items-center gap-3 rounded-2xl bg-white/70 py-2.5 pl-2.5 pr-5 shadow-[0_8px_28px_rgba(5,0,56,0.08)] backdrop-blur"
          :class="c.decalage"
          :style="{ animationDelay: c.delai }"
        >
          <span
            class="grid h-10 min-w-14 place-items-center rounded-xl px-2 text-sm font-bold tabular-nums"
            :class="c.teinte"
          >
            {{ c.valeur }}
          </span>
          <span class="text-sm font-medium text-ink-deep/70">{{ c.detail }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.halo {
  animation: respirer 9s ease-in-out infinite;
}

@keyframes respirer {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.9;
  }
  50% {
    transform: translate(-18px, 16px) scale(1.08);
    opacity: 1;
  }
}

.quadrillage {
  background-image: linear-gradient(to right, rgb(5 0 56 / 8%) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(5 0 56 / 8%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 20% 0%, black, transparent 80%);
}

.carte {
  opacity: 0;
  animation: monter 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes monter {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .halo,
  .carte {
    animation: none;
  }
  .carte {
    opacity: 1;
  }
}
</style>

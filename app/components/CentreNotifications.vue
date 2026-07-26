<script setup lang="ts">
const MAX_APERCU = 5

const { alertes, nonVues, refresh, marquerLues } = useAlertes()

const ouvert = ref(false)
const chargement = ref(false)

const recentes = computed(() => alertes.value.slice(0, MAX_APERCU))

async function charger() {
  chargement.value = true
  try {
    await refresh()
  } finally {
    chargement.value = false
  }
}

async function basculer() {
  ouvert.value = !ouvert.value
  if (ouvert.value) await charger()
}

function surTouche(e: KeyboardEvent) {
  if (e.key === 'Escape') ouvert.value = false
}

function surMessageSw(e: MessageEvent) {
  if (e.data?.type === 'PUSH_ALERTE') charger()
}

onMounted(() => {
  document.addEventListener('keydown', surTouche)
  navigator.serviceWorker?.addEventListener('message', surMessageSw)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', surTouche)
  navigator.serviceWorker?.removeEventListener('message', surMessageSw)
})
</script>

<template>
  <div class="relative">
    <button
      class="relative grid size-9 place-items-center rounded-full border border-hairline bg-white text-stone transition hover:bg-surface hover:text-ink"
      :class="ouvert && 'bg-surface text-ink'"
      :aria-expanded="ouvert"
      aria-label="Notifications"
      @click="basculer"
    >
      <svg
        class="cloche size-4"
        :class="nonVues > 0 && 'sonne'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      <span
        v-if="nonVues > 0"
        class="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-coral-soft px-1 text-[10px] font-bold text-white ring-2 ring-white"
      >
        {{ nonVues > 9 ? '9+' : nonVues }}
      </span>
    </button>

    <template v-if="ouvert">
      <button
        class="fixed inset-0 z-40 cursor-default"
        tabindex="-1"
        aria-label="Fermer les notifications"
        @click="ouvert = false"
      />

      <div
        class="panneau absolute right-0 z-50 mt-2 w-[21rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_16px_48px_rgba(5,0,56,0.16)]"
      >
        <div class="flex items-center gap-2 border-b border-hairline-soft px-3 py-2.5">
          <p class="text-sm font-semibold">Notifications</p>
          <span v-if="nonVues > 0" class="text-xs text-stone">{{ nonVues }} non lue{{ nonVues > 1 ? 's' : '' }}</span>
          <button
            v-if="nonVues > 0"
            class="ml-auto text-xs font-medium text-blue hover:underline"
            @click="marquerLues"
          >
            Tout marquer lu
          </button>
        </div>

        <ReglagePush variante="ligne" />

        <div v-if="chargement && !alertes.length" class="space-y-2 p-3">
          <span
            v-for="n in 3"
            :key="n"
            class="squelette block h-12 rounded-xl"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
        </div>

        <p v-else-if="!recentes.length" class="px-3 py-8 text-center text-sm text-stone">
          Aucune alerte pour l’instant.
        </p>

        <ul v-else class="max-h-[22rem] space-y-1.5 overflow-y-auto p-2">
          <li v-for="a in recentes" :key="a.id">
            <LigneAlerte :alerte="a" compact @click="ouvert = false" />
          </li>
        </ul>

        <NuxtLink
          to="/alertes"
          class="block border-t border-hairline-soft px-3 py-2.5 text-center text-sm font-medium text-steel transition hover:bg-surface hover:text-ink"
          @click="ouvert = false"
        >
          Voir toutes les alertes
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panneau {
  animation: descendre 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top right;
}
@keyframes descendre {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
}

.sonne {
  animation: sonner 2.4s ease-in-out infinite;
  transform-origin: 50% 15%;
}
@keyframes sonner {
  0%,
  70%,
  100% {
    transform: rotate(0);
  }
  76% {
    transform: rotate(9deg);
  }
  82% {
    transform: rotate(-7deg);
  }
  88% {
    transform: rotate(4deg);
  }
}

.squelette {
  background: linear-gradient(
    90deg,
    var(--color-hairline-soft) 0%,
    var(--color-hairline) 40%,
    var(--color-hairline-soft) 80%
  );
  background-size: 200% 100%;
  animation: scintiller 1.6s ease-in-out infinite;
}
@keyframes scintiller {
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panneau,
  .sonne,
  .squelette {
    animation: none;
  }
}
</style>

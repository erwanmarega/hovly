<script setup lang="ts">
const route = useRoute()
const { nonVues } = useAlertes()

const onglets = [
  { to: '/dashboard', label: 'Mes biens' },
  { to: '/comparer', label: 'Comparer' },
  { to: '/alertes', label: 'Alertes' },
  { to: '/profil', label: 'Profil' }
]

const actif = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <nav
    class="nav-mobile fixed inset-x-0 bottom-0 z-40 border-t border-hairline-soft bg-white/95 backdrop-blur-xl md:hidden"
    aria-label="Navigation principale"
  >
    <ul class="mx-auto flex max-w-md items-stretch">
      <li v-for="o in onglets" :key="o.to" class="flex-1">
        <NuxtLink
          :to="o.to"
          class="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition"
          :class="actif(o.to) ? 'text-ink' : 'text-stone'"
        >
          <span
            class="grid size-6 place-items-center rounded-full transition"
            :class="actif(o.to) && 'bg-brand'"
          >
            <svg
              v-if="o.to === '/dashboard'"
              class="size-4"
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
              v-else-if="o.to === '/comparer'"
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M12 3v18M3 7h6l-3 6a3 3 0 0 0 6 0l-3-6M15 7h6l-3 6a3 3 0 0 0 6 0l-3-6" />
            </svg>
            <svg
              v-else-if="o.to === '/alertes'"
              class="size-4"
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
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </span>

          {{ o.label }}

          <span
            v-if="o.to === '/alertes' && nonVues > 0"
            class="absolute right-[22%] top-1 grid min-w-4 place-items-center rounded-full bg-coral-soft px-1 text-[10px] font-bold text-white"
          >
            {{ nonVues }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav-mobile {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>

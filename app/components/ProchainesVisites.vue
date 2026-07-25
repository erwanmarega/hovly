<script setup lang="ts">
import type { Bien } from '~/types'

const props = withDefaults(defineProps<{ biens: Bien[]; max?: number }>(), { max: 3 })

const maintenant = useMaintenant()

const visites = computed(() =>
  prochainesVisites(props.biens, maintenant.value).slice(0, props.max)
)

const restantes = computed(
  () => Math.max(0, prochainesVisites(props.biens, maintenant.value).length - props.max)
)
</script>

<template>
  <section
    v-if="visites.length"
    class="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline-soft bg-white px-4 py-3"
  >
    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-light text-[#8a6d1c]">
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </svg>
    </span>

    <p class="text-sm font-semibold text-ink">
      {{ visites.length }} visite{{ visites.length > 1 ? 's' : '' }} à venir
    </p>

    <ul class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <li v-for="b in visites" :key="b.id" class="min-w-0">
        <NuxtLink
          :to="`/bien/${b.id}`"
          class="flex max-w-full items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-xs transition hover:bg-surface"
        >
          <span class="truncate font-medium text-ink">{{ b.titre }}</span>
          <BadgeVisite :visite-le="b.visite_le" compact />
        </NuxtLink>
      </li>
      <li v-if="restantes" class="text-xs text-stone">+{{ restantes }} autre{{ restantes > 1 ? 's' : '' }}</li>
    </ul>
  </section>
</template>

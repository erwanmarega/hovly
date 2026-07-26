<script setup lang="ts">
export interface Miette {
  label: string
  to?: string
}

defineProps<{ items: Miette[] }>()
</script>

<template>
  <nav aria-label="Fil d’Ariane">
    <ol class="flex min-w-0 items-center gap-1.5 text-sm text-stone">
      <li v-for="(m, i) in items" :key="m.label" class="flex min-w-0 items-center gap-1.5">
        <NuxtLink
          v-if="m.to"
          :to="m.to"
          class="whitespace-nowrap font-medium transition hover:text-ink"
        >
          {{ m.label }}
        </NuxtLink>
        <span v-else class="truncate text-slate" aria-current="page">{{ m.label }}</span>

        <span v-if="i < items.length - 1" aria-hidden="true" class="text-hairline-strong">/</span>
      </li>
    </ol>
  </nav>
</template>

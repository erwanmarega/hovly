<script setup lang="ts">
import type { WatchResult } from '~/types'

const props = defineProps<{
  result: WatchResult
  busy?: boolean
}>()

const emit = defineEmits<{
  keep: [id: string]
  ignore: [id: string]
}>()

const source = computed(() => detecterSource(props.result.url))

const pricePerSqm = computed(() => {
  const { prix, surface } = props.result
  if (!prix || !surface) return null
  return Math.round(prix / 100 / surface)
})

const titre = computed(() => props.result.titre?.trim() || 'Annonce sans titre')

const lieu = computed(() =>
  [props.result.ville, props.result.code_postal].filter(Boolean).join(' ')
)

const quand = computed(() =>
  new Date(props.result.trouve_le).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
)
</script>

<template>
  <article
    class="flex flex-col gap-3 rounded-2xl border border-hairline-soft bg-white p-3.5 sm:flex-row sm:items-center"
  >
    <img
      v-if="result.photo"
      :src="result.photo"
      :alt="titre"
      loading="lazy"
      class="h-28 w-full shrink-0 rounded-xl bg-surface object-cover sm:size-16"
    >
    <div v-else class="hidden size-16 shrink-0 rounded-xl bg-surface sm:block" />

    <div class="min-w-0 flex-1">
      <a
        :href="result.url"
        target="_blank"
        rel="noopener"
        class="line-clamp-2 font-medium text-ink hover:underline"
      >
        {{ titre }}
      </a>

      <p class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone">
        <SourceLogo v-if="source" :source="source" :with-name="false" :size="14" />
        <span v-if="lieu" class="truncate">{{ lieu }}</span>
        <span class="shrink-0">· {{ quand }}</span>
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <PropertyStats
          :surface="result.surface"
          :nb-pieces="result.nb_pieces"
          pieces-label="p"
          :price-per-sqm="pricePerSqm"
        >
          <template #avant>
            <span
              v-if="formatPrice(result.prix)"
              class="rounded-full bg-ink px-2 py-0.5 font-semibold tabular-nums text-white"
            >
              {{ formatPrice(result.prix) }}
            </span>
          </template>
        </PropertyStats>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        :disabled="busy"
        class="rounded-full border border-hairline px-3.5 py-2 text-sm font-medium text-steel transition hover:bg-surface hover:text-ink disabled:opacity-50"
        @click="emit('ignore', result.id)"
      >
        Ignorer
      </button>
      <button
        :disabled="busy"
        class="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
        @click="emit('keep', result.id)"
      >
        <span
          v-if="busy"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
        Garder
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ResultatVeille } from '~/types'

const props = defineProps<{
  resultat: ResultatVeille
  occupe?: boolean
}>()

const emit = defineEmits<{
  garder: [id: string]
  ignorer: [id: string]
}>()

const source = computed(() => detecterSource(props.resultat.url))

const prixM2 = computed(() => {
  const { prix, surface } = props.resultat
  if (!prix || !surface) return null
  return Math.round(prix / 100 / surface)
})

const titre = computed(() => props.resultat.titre?.trim() || 'Annonce sans titre')

const lieu = computed(() =>
  [props.resultat.ville, props.resultat.code_postal].filter(Boolean).join(' ')
)

const quand = computed(() =>
  new Date(props.resultat.trouve_le).toLocaleString('fr-FR', {
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
      v-if="resultat.photo"
      :src="resultat.photo"
      :alt="titre"
      loading="lazy"
      class="h-28 w-full shrink-0 rounded-xl bg-surface object-cover sm:size-16"
    >
    <div v-else class="hidden size-16 shrink-0 rounded-xl bg-surface sm:block" />

    <div class="min-w-0 flex-1">
      <a
        :href="resultat.url"
        target="_blank"
        rel="noopener"
        class="line-clamp-2 font-medium text-ink hover:underline"
      >
        {{ titre }}
      </a>

      <p class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone">
        <LogoSource v-if="source" :source="source" :avec-nom="false" :taille="14" />
        <span v-if="lieu" class="truncate">{{ lieu }}</span>
        <span class="shrink-0">· {{ quand }}</span>
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <StatsBien
          :surface="resultat.surface"
          :nb-pieces="resultat.nb_pieces"
          pieces-label="p"
          :prix-m2="prixM2"
        >
          <template #avant>
            <span
              v-if="formaterPrix(resultat.prix)"
              class="rounded-full bg-ink px-2 py-0.5 font-semibold tabular-nums text-white"
            >
              {{ formaterPrix(resultat.prix) }}
            </span>
          </template>
        </StatsBien>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <button
        :disabled="occupe"
        class="rounded-full border border-hairline px-3.5 py-2 text-sm font-medium text-steel transition hover:bg-surface hover:text-ink disabled:opacity-50"
        @click="emit('ignorer', resultat.id)"
      >
        Ignorer
      </button>
      <button
        :disabled="occupe"
        class="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:opacity-60"
        @click="emit('garder', resultat.id)"
      >
        <span
          v-if="occupe"
          class="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
        Garder
      </button>
    </div>
  </article>
</template>

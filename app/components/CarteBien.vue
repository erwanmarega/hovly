<script setup lang="ts">
import type { Bien } from '~/types'
import type { Score } from '~/composables/useScore'

defineProps<{
  bien: Bien
  score: Score
  prixMensuel: number
  prixM2: number
}>()

const emit = defineEmits<{ supprimer: [id: string] }>()

const eur = (n: number) => n.toLocaleString('fr-FR')
</script>

<template>
  <article
    class="carte group relative flex flex-col overflow-hidden rounded-feature border border-hairline-soft bg-white"
  >
    <NuxtLink :to="`/bien/${bien.id}`" class="relative block aspect-[4/3] overflow-hidden bg-surface">
      <img
        v-if="bien.photos?.[0]"
        :src="bien.photos[0]"
        :alt="bien.titre"
        loading="lazy"
        class="photo size-full object-cover"
      >
      <span v-else class="grid size-full place-items-center text-sm text-stone">Aucune photo</span>

      <span class="absolute left-3 top-3">
        <BadgeStatut :statut="bien.statut" />
      </span>
      <span class="absolute right-3 top-3">
        <ScoreBien :score="score" />
      </span>
    </NuxtLink>

    <div class="flex flex-1 flex-col p-5">
      <NuxtLink :to="`/bien/${bien.id}`" class="min-w-0">
        <h3 class="truncate font-medium text-ink transition group-hover:text-blue">
          {{ bien.titre }}
        </h3>
      </NuxtLink>
      <p class="mt-1 truncate text-xs text-stone">
        {{ [bien.ville, bien.code_postal].filter(Boolean).join(' ') || 'Localisation inconnue' }}
      </p>

      <p class="mt-3 text-2xl font-light tracking-tight">
        {{ eur(prixMensuel) }} €<span class="text-sm text-stone">/mois</span>
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="rounded-full bg-surface px-2.5 py-1 font-medium text-steel">
          {{ bien.surface }} m²
        </span>
        <span class="rounded-full bg-surface px-2.5 py-1 font-medium text-steel">
          {{ bien.nb_pieces }} pièces
        </span>
        <span class="rounded-full bg-surface px-2.5 py-1 font-medium text-steel">
          {{ eur(prixM2) }} €/m²
        </span>
        <BadgeDPE :dpe="bien.dpe" />
      </div>

      <div class="mt-auto flex items-center gap-1 pt-4">
        <a
          :href="bien.url_source"
          target="_blank"
          rel="noopener"
          title="Voir l’annonce"
          class="grid size-8 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
          </svg>
        </a>
        <button
          title="Supprimer"
          class="grid size-8 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
          @click="emit('supprimer', bien.id)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
        <NuxtLink
          :to="`/bien/${bien.id}`"
          class="ml-auto text-xs font-medium text-blue hover:underline"
        >
          Détails
        </NuxtLink>
      </div>
    </div>
  </article>
</template>

<style scoped>
.carte {
  transition:
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.35s ease,
    border-color 0.35s ease;
}
.carte:hover {
  transform: translateY(-4px);
  border-color: var(--color-hairline);
  box-shadow: 0 16px 36px rgb(5 0 56 / 9%);
}

.photo {
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.carte:hover .photo {
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .carte:hover,
  .carte:hover .photo {
    transform: none;
  }
}
</style>

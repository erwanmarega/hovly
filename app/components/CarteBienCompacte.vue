<script setup lang="ts">
import type { Bien, Statut } from "~/types";
import type { Score } from "~/composables/useScore";

defineProps<{
  bien: Bien;
  score: Score;
  prixMensuel: number;
  prixM2: number;
  doublons?: number;
  selectionne?: boolean;
  selectionBloquee?: boolean;
}>();

const emit = defineEmits<{
  basculer: [id: string];
  supprimer: [id: string];
  statut: [id: string, statut: Statut];
}>();

const eur = (n: number) => n.toLocaleString("fr-FR");
</script>

<template>
  <article class="flex gap-3 px-4 py-3.5">
    <label class="flex shrink-0 items-start pt-0.5">
      <input
        type="checkbox"
        class="size-5 cursor-pointer accent-ink"
        :checked="selectionne"
        :disabled="!selectionne && selectionBloquee"
        :aria-label="`Comparer ${bien.titre}`"
        @change="emit('basculer', bien.id)"
      />
    </label>

    <div class="min-w-0 flex-1">
      <NuxtLink :to="`/bien/${bien.id}`" class="flex gap-3">
        <img
          v-if="bien.photos?.[0]"
          :src="bien.photos[0]"
          :alt="bien.titre"
          class="size-14 shrink-0 rounded-lg bg-surface object-cover"
          loading="lazy"
        />
        <div v-else class="size-14 shrink-0 rounded-lg bg-surface" />

        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-ink">{{ bien.titre }}</p>
          <p
            class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-stone"
          >
            <span class="truncate">{{ bien.ville }}</span>
            <LogoSource
              :source="bien.site_source"
              :avec-nom="false"
              :taille="14"
            />
            <span
              v-if="doublons"
              class="shrink-0 rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d1c]"
              >×{{ doublons }}</span
            >
          </p>
          <p class="mt-1 text-base font-semibold tabular-nums">
            {{ eur(prixMensuel) }} €<span class="text-xs font-normal text-stone"
              >/mois</span
            >
          </p>
        </div>

        <ScoreBien :score="score" class="shrink-0 self-start" />
      </NuxtLink>

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          {{ bien.surface }} m²
        </span>
        <span
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          {{ bien.nb_pieces }} p
        </span>
        <span
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          {{ eur(prixM2) }} €/m²
        </span>
        <BadgeDPE :dpe="bien.dpe" />
        <BadgeVisite :visite-le="bien.visite_le" compact />
      </div>

      <div class="mt-2.5 flex items-center gap-2">
        <SelecteurStatut
          :statut="bien.statut"
          @change="emit('statut', bien.id, $event)"
        />

        <p
          v-if="bien.note_perso"
          class="min-w-0 flex-1 truncate text-xs text-slate"
          :title="bien.note_perso"
        >
          {{ bien.note_perso }}
        </p>

        <div class="ml-auto flex shrink-0 items-center gap-1">
          <a
            :href="bien.url_source"
            target="_blank"
            rel="noopener"
            title="Voir l'annonce"
            class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
              />
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
            </svg>
          </a>
          <button
            title="Supprimer"
            class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
            @click="emit('supprimer', bien.id)"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { BienPartage } from "~/types";

const props = defineProps<{ bien: BienPartage }>();

const eur = (n: number) => n.toLocaleString("fr-FR");
const estAchatPartage = computed(() => props.bien.transaction === "achat");
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-hairline bg-white">
    <img
      v-if="bien.photos?.[0]"
      :src="bien.photos[0]"
      :alt="bien.titre ?? ''"
      class="h-40 w-full object-cover"
      loading="lazy"
    />
    <div v-else class="grid h-40 w-full place-items-center bg-surface text-stone">
      <svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.6V20h14V9.6" />
      </svg>
    </div>

    <div class="p-4">
      <p class="truncate font-medium text-ink">{{ bien.titre || "Sans titre" }}</p>
      <p class="mt-0.5 truncate text-xs text-stone">
        {{ [bien.ville, bien.code_postal].filter(Boolean).join(" ") || "Ville inconnue" }}
      </p>

      <p class="mt-2 text-lg font-semibold tabular-nums">
        <template v-if="bien.prix != null">
          {{ eur(Math.round(bien.prix / 100)) }} €<span
            v-if="!estAchatPartage"
            class="text-xs font-normal text-stone"
            >/mois</span
          >
        </template>
        <span v-else class="text-sm font-normal text-stone">Prix inconnu</span>
      </p>

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          v-if="bien.surface"
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          {{ bien.surface }} m²
        </span>
        <span
          v-if="bien.nb_pieces"
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          {{ bien.nb_pieces }} p
        </span>
        <span
          v-if="bien.etage != null"
          class="rounded-full bg-surface px-2 py-0.5 font-medium tabular-nums text-steel"
        >
          Étage {{ bien.etage }}
        </span>
        <BadgeDPE :dpe="bien.dpe" />
      </div>
    </div>
  </article>
</template>

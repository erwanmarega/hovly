<script setup lang="ts">
import type { SharedProperty } from "~/types";

const props = defineProps<{ bien: SharedProperty; token: string }>();

const estAchatPartage = computed(() => isPurchase(props.bien));
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-hairline bg-white">
    <NuxtLink :to="`/partage/${token}/bien/${bien.id}`">
      <img
        v-if="bien.photos?.[0]"
        :src="bien.photos[0]"
        :alt="bien.titre ?? ''"
        class="h-40 w-full bg-surface"
        :class="isDefaultPhoto(bien.photos[0]) ? 'object-contain' : 'object-cover'"
        loading="lazy"
      />
      <div v-else class="grid h-40 w-full place-items-center bg-surface text-stone">
        <svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.6V20h14V9.6" />
        </svg>
      </div>
    </NuxtLink>

    <div class="p-4">
      <NuxtLink :to="`/partage/${token}/bien/${bien.id}`" class="block truncate font-medium text-ink hover:underline">
        {{ bien.titre || "Sans titre" }}
      </NuxtLink>
      <p class="mt-0.5 truncate text-xs text-stone">
        {{ [bien.ville, bien.code_postal].filter(Boolean).join(" ") || "Ville inconnue" }}
      </p>

      <p class="mt-2 text-lg font-semibold tabular-nums">
        <template v-if="bien.prix != null">
          {{ formatNumber(Math.round(bien.prix / 100)) }} €<span
            v-if="!estAchatPartage"
            class="text-xs font-normal text-stone"
            >/mois</span
          >
        </template>
        <span v-else class="text-sm font-normal text-stone">Prix inconnu</span>
      </p>

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <PropertyStats
          :surface="bien.surface"
          :nb-pieces="bien.nb_pieces"
          pieces-label="p"
          :etage="bien.etage"
          :dpe="bien.dpe"
        />
      </div>

      <NuxtLink
        :to="`/partage/${token}/bien/${bien.id}`"
        class="mt-3 inline-block text-xs font-medium text-blue hover:underline"
      >
        Détails
      </NuxtLink>
    </div>
  </article>
</template>

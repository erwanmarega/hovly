<script setup lang="ts">
import type { PartagePublic } from "~/types";

const route = useRoute();
const token = route.params.token as string;
const id = route.params.id as string;

const {
  data: partage,
  pending,
  error,
} = await useAsyncData(
  `partage-${token}`,
  () => $fetch<PartagePublic>(`/api/partages/${token}`),
  {
    server: false,
  }
);

const bien = computed(
  () => partage.value?.biens.find((b) => b.id === id) ?? null
);

const achat = computed(() => bien.value != null && estAchat(bien.value));

useHead({
  title: () =>
    bien.value
      ? `${bien.value.titre || "Bien"} — Hovly`
      : "Bien introuvable — Hovly",
});
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div v-if="pending" class="py-24 text-center">
        <div
          class="mx-auto size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"
        />
      </div>

      <div v-else-if="error || !partage || !bien" class="py-24 text-center">
        <p class="text-slate">Ce bien n'existe pas ou n'est plus partagé.</p>
        <NuxtLink
          :to="`/partage/${token}`"
          class="mt-3 inline-block text-sm font-medium text-blue hover:underline"
        >
          Retour à la sélection
        </NuxtLink>
      </div>

      <template v-else>
        <NuxtLink
          :to="`/partage/${token}`"
          class="text-sm font-medium text-blue hover:underline"
        >
          ← Retour à la sélection
        </NuxtLink>

        <h1
          class="mt-4 text-2xl font-light tracking-tight text-ink-deep md:text-3xl"
        >
          {{ bien.titre || "Sans titre" }}
        </h1>
        <p class="mt-1 text-sm text-slate">
          {{
            [bien.ville, bien.code_postal].filter(Boolean).join(" ") ||
            "Ville inconnue"
          }}
        </p>

        <div
          v-if="bien.photos?.length"
          class="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          <img
            v-for="(photo, i) in bien.photos"
            :key="i"
            :src="photo"
            :alt="bien.titre ?? ''"
            class="aspect-[4/3] w-full rounded-xl object-cover"
            loading="lazy"
          />
        </div>
        <div
          v-else
          class="mt-6 grid h-48 w-full place-items-center rounded-2xl bg-white text-stone"
        >
          <svg
            class="size-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.6V20h14V9.6" />
          </svg>
        </div>

        <div class="mt-6 rounded-2xl border border-hairline bg-white p-5">
          <p class="text-2xl font-semibold tabular-nums">
            <template v-if="bien.prix != null">
              {{ formaterNombre(Math.round(bien.prix / 100)) }} €<span
                v-if="!achat"
                class="text-sm font-normal text-stone"
                >/mois</span
              >
            </template>
            <span v-else class="text-base font-normal text-stone"
              >Prix inconnu</span
            >
          </p>

          <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <StatsBien
              taille="md"
              :surface="bien.surface"
              :nb-pieces="bien.nb_pieces"
              :pieces-label="bien.nb_pieces && bien.nb_pieces > 1 ? 'pièces' : 'pièce'"
              :etage="bien.etage"
              :dpe="bien.dpe"
            />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

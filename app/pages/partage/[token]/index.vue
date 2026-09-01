<script setup lang="ts">
import type { PartagePublic } from "~/types";

const route = useRoute();
const token = route.params.token as string;

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

useHead({
  title: () =>
    partage.value
      ? `${partage.value.titre || "Sélection partagée"} — Hovly`
      : "Lien introuvable — Hovly",
});
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div v-if="pending" class="py-24 text-center">
        <div
          class="mx-auto size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"
        />
      </div>

      <div v-else-if="error || !partage" class="py-24 text-center">
        <p class="text-slate">Ce lien n'existe pas ou n'est plus actif.</p>
        <NuxtLink
          to="/"
          class="mt-3 inline-block text-sm font-medium text-blue hover:underline"
        >
          Retour à l'accueil
        </NuxtLink>
      </div>

      <template v-else>
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-stone">
          Sélection partagée
        </p>
        <h1
          class="mt-2 text-3xl font-light tracking-tight text-ink-deep md:text-4xl"
        >
          {{ partage.titre || "Biens partagés" }}
        </h1>
        <p class="mt-2 text-sm text-slate">
          {{ partage.biens.length }} bien{{
            partage.biens.length > 1 ? "s" : ""
          }}
          — lecture seule.
        </p>

        <div v-if="!partage.biens.length" class="mt-10 text-center text-slate">
          Ce partage ne contient plus aucun bien.
        </div>
        <div v-else class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <CarteBienPartage
            v-for="b in partage.biens"
            :key="b.id"
            :bien="b"
            :token="token"
          />
        </div>
      </template>
    </main>
  </div>
</template>

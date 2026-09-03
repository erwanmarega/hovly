<script setup lang="ts">
import type { BienPartage } from "~/types";
import { comparerPublic } from "~/composables/useComparateur";

const props = defineProps<{ biens: BienPartage[]; token: string }>();

const lignes = computed(() => comparerPublic(props.biens));
</script>

<template>
  <div class="overflow-x-auto rounded-feature border border-hairline-soft bg-white">
    <table class="w-full min-w-[560px] border-collapse text-sm">
      <thead>
        <tr>
          <th class="sticky left-0 z-10 w-28 bg-white p-3 text-left align-bottom sm:w-40 sm:p-4">
            <span class="text-xs font-semibold uppercase tracking-wide text-stone">
              {{ biens.length }} bien{{ biens.length > 1 ? "s" : "" }}
            </span>
          </th>
          <th
            v-for="b in biens"
            :key="b.id"
            class="border-l border-hairline-soft p-4 text-left align-top"
          >
            <NuxtLink :to="`/partage/${token}/bien/${b.id}`" class="group block">
              <img
                v-if="b.photos?.[0]"
                :src="b.photos[0]"
                :alt="b.titre ?? ''"
                loading="lazy"
                class="aspect-[4/3] w-full rounded-xl bg-surface"
                :class="estPhotoParDefaut(b.photos[0]) ? 'object-contain' : 'object-cover'"
              >
              <div
                v-else
                class="grid aspect-[4/3] w-full place-items-center rounded-xl bg-surface text-xs text-stone"
              >
                Aucune photo
              </div>

              <p class="mt-3 line-clamp-2 font-medium text-ink transition group-hover:text-blue">
                {{ b.titre || "Sans titre" }}
              </p>
            </NuxtLink>

            <p class="mt-1 text-xs font-normal text-stone">
              {{ [b.ville, b.code_postal].filter(Boolean).join(" ") || "Ville inconnue" }}
            </p>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          v-for="l in lignes"
          :key="l.cle"
          class="border-t border-hairline-soft transition hover:bg-surface-soft"
        >
          <th
            class="sticky left-0 z-10 bg-white p-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-stone"
          >
            {{ l.label }}
            <span v-if="l.sens" class="ml-1 font-normal normal-case text-stone/70">
              {{ l.sens === "min" ? "↓ mieux" : "↑ mieux" }}
            </span>
          </th>
          <td
            v-for="(valeur, i) in l.affichage"
            :key="i"
            class="border-l border-hairline-soft p-4 align-middle tabular-nums"
            :class="l.meilleurs.includes(i) ? 'font-semibold text-[#0a4a42]' : 'text-slate'"
          >
            <span
              v-if="l.meilleurs.includes(i)"
              class="mr-1.5 inline-block rounded-full bg-teal/60 px-1.5 py-0.5 text-[10px] font-bold"
            >★</span>
            {{ valeur }}
          </td>
        </tr>

        <tr class="border-t border-hairline-soft">
          <th class="sticky left-0 z-10 bg-white p-4" />
          <td v-for="b in biens" :key="b.id" class="border-l border-hairline-soft p-4">
            <NuxtLink
              :to="`/partage/${token}/bien/${b.id}`"
              class="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-black"
            >
              Détails
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

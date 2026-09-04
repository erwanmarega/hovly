<script setup lang="ts">
import type { Alert } from "~/types";

const props = withDefaults(
  defineProps<{
    alert: Alert;
    compact?: boolean;
  }>(),
  { compact: false }
);

const eur = (c: number | null) => (c == null ? "—" : formatPrice(c));

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

const isDrop = computed(() => props.alert.type === "baisse_prix");

const gapPercent = computed(() => {
  const { ancien_prix: previous, nouveau_prix: updated } = props.alert;
  if (!isDrop.value || !previous || !updated) return null;
  return Math.round(((updated - previous) / previous) * 100);
});

const label = computed(() =>
  isDrop.value ? "Baisse de prix" : "Annonce supprimée"
);

const { markRead } = useAlerts();
</script>

<template>
  <NuxtLink
    :to="`/bien/${alert.bien_id}`"
    class="carte flex items-center gap-4 border bg-white"
    @click="markRead(alert.id)"
    :class="[
      compact ? 'gap-3 rounded-xl p-2.5' : 'rounded-2xl p-4',
      alert.vue
        ? 'border-hairline-soft'
        : 'border-blue/40 ring-1 ring-blue/10',
    ]"
  >
    <div class="relative shrink-0">
      <img
        v-if="alert.biens?.photos?.[0]"
        :src="alert.biens.photos[0]"
        alt=""
        loading="lazy"
        class="rounded-xl bg-surface"
        :class="[
          compact ? 'size-10' : 'size-12',
          isDefaultPhoto(alert.biens.photos[0]) ? 'object-contain' : 'object-cover',
        ]"
      />
      <div
        v-else
        class="grid place-items-center rounded-xl"
        :class="[
          compact ? 'size-10' : 'size-12',
          isDrop ? 'bg-teal text-[#0a4a42]' : 'bg-coral text-[#600000]',
        ]"
      >
        <svg
          :class="compact ? 'size-4' : 'size-5'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="isDrop">
            <path d="M22 17 13.5 8.5 8.5 13.5 2 7" />
            <path d="M16 17h6v-6" />
          </template>
          <template v-else>
            <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </template>
        </svg>
      </div>
      <span
        class="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-white"
        :class="isDrop ? 'bg-teal text-[#0a4a42]' : 'bg-coral text-[#600000]'"
      >
        <svg
          class="size-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <template v-if="isDrop">
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </template>
          <template v-else>
            <path d="M12 6v7" />
            <path d="M12 18h.01" />
          </template>
        </svg>
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold">{{ label }}</span>
        <span v-if="!alert.vue" class="size-2 shrink-0 rounded-full bg-blue" />
      </div>
      <p class="truncate text-sm text-slate">
        {{ alert.biens?.titre ?? "Bien" }}
      </p>
      <p
        v-if="alert.biens?.ville && !compact"
        class="truncate text-xs text-stone"
      >
        {{ alert.biens.ville }}
      </p>
      <p
        v-if="compact"
        class="mt-0.5 flex items-center gap-1.5 text-xs text-stone"
      >
        <template v-if="isDrop">
          <s>{{ eur(alert.ancien_prix) }}</s>
          <span class="font-semibold text-ink">{{
            eur(alert.nouveau_prix)
          }}</span>
          <span
            v-if="gapPercent !== null"
            class="rounded-full bg-teal/50 px-1.5 font-bold text-[#0a4a42]"
            >{{ gapPercent }} %</span
          >
        </template>
        <span v-else class="font-medium text-[#600000]">Plus disponible</span>
        · {{ time(alert.envoyee_le) }}
      </p>
    </div>

    <div v-if="!compact" class="shrink-0 text-right">
      <p v-if="isDrop" class="flex items-center justify-end gap-2">
        <s class="text-xs font-normal text-stone">{{
          eur(alert.ancien_prix)
        }}</s>
        <span class="text-sm font-semibold">{{
          eur(alert.nouveau_prix)
        }}</span>
        <span
          v-if="gapPercent !== null"
          class="rounded-full bg-teal/50 px-2 py-0.5 text-[11px] font-bold text-[#0a4a42]"
          >{{ gapPercent }} %</span
        >
      </p>
      <p v-else class="text-sm font-medium text-[#600000]">Plus disponible</p>
      <p class="mt-1 text-xs text-stone">{{ time(alert.envoyee_le) }}</p>
    </div>
  </NuxtLink>
</template>

<style scoped>
.carte {
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.3s ease, box-shadow 0.3s ease;
}
.carte:hover {
  transform: translateX(3px);
  border-color: var(--color-hairline-strong);
  box-shadow: 0 10px 26px rgb(5 0 56 / 7%);
}

@media (prefers-reduced-motion: reduce) {
  .carte:hover {
    transform: none;
  }
}
</style>

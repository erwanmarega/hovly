<script setup lang="ts">
import type { Property } from '~/types'

const props = defineProps<{ bien: Property }>()

const { ancres, active, calculable, isAvailable, calculating, error, forProperty, calculate, loadModesState } =
  useCommutes()

onMounted(loadModesState)

const list = computed(() => forProperty(props.bien.id))
const missing = computed(() =>
  list.value.filter((t) => !t.calcule && isAvailable(t.ancre.mode)).length
)
const located = computed(() => props.bien.lat != null && props.bien.lon != null)

const missingModes = computed(() => [
  ...new Set(ancres.value.filter((a) => !isAvailable(a.mode)).map((a) => MODE_LABELS[a.mode]))
])

const hasTransit = computed(() => ancres.value.some((a) => a.mode === 'transport'))
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-5 sm:p-6">
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Trajets</h2>
      <button
        v-if="active && located && missing && calculable"
        :disabled="calculating"
        class="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
        @click="calculate"
      >
        {{ calculating ? 'Calcul…' : 'Calculer' }}
      </button>
    </div>

    <p v-if="!active" class="mt-3 text-xs text-stone">
      Aucun point d’ancrage.
      <NuxtLink to="/profil" class="font-medium text-blue hover:underline">
        Ajoute ton boulot, une école ou une gare
      </NuxtLink>
      pour voir le temps de trajet depuis chaque bien.
    </p>

    <p v-else-if="!located" class="mt-3 text-xs text-stone">
      Ce bien n’a pas de position exacte : l’annonce ne donne pas d’adresse assez précise.
    </p>

    <ul v-else class="mt-3 space-y-2.5">
      <li
        v-for="t in list"
        :key="t.ancre.id"
        class="flex items-center justify-between gap-3 text-sm"
      >
        <span class="flex min-w-0 items-center gap-2">
          <ModeIcon :mode="t.ancre.mode" class="text-stone" />
          <span class="min-w-0">
            <span class="block truncate font-medium text-ink">{{ t.ancre.label }}</span>
            <span class="block truncate text-xs text-stone">
              {{ MODE_LABELS[t.ancre.mode] }}
              <template v-if="t.distance_m != null"> · {{ formatDistance(t.distance_m) }}</template>
            </span>
          </span>
        </span>

        <span
          class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
          :class="
            !t.calcule
              ? 'bg-surface text-stone'
              : t.depasse
                ? 'bg-coral text-[#600000]'
                : 'bg-teal text-[#0a4a42]'
          "
          :title="t.ancre.maxMinutes ? `Objectif : ${t.ancre.maxMinutes} min` : undefined"
        >
          <template v-if="t.calcule">{{ formatDuration(t.duree_s) }}</template>
          <template v-else-if="!isAvailable(t.ancre.mode)">non configuré</template>
          <template v-else>à calculer</template>
        </span>
      </li>
    </ul>

    <p v-if="error" class="mt-3 text-xs text-[#600000]">{{ error }}</p>

    <p v-else-if="active && located && missingModes.length" class="mt-3 text-xs text-stone">
      Trajets {{ missingModes.join(' et ') }} indisponibles : la clé d’API correspondante
      n’est pas configurée sur le serveur.
    </p>

    <p v-else-if="active && ancres.length" class="mt-3 text-xs text-stone">
      Itinéraires porte à porte, hors trafic.
    </p>

    <TransitousNotice v-if="active && located && hasTransit" class="mt-2" />
  </section>
</template>

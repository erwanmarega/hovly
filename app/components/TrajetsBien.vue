<script setup lang="ts">
import type { Bien } from '~/types'

const props = defineProps<{ bien: Bien }>()

const { ancres, actif, calculable, disponible, calcul, erreur, pour, calculer, chargerEtat } =
  useTrajets()

onMounted(chargerEtat)

const liste = computed(() => pour(props.bien.id))
const manquants = computed(() =>
  liste.value.filter((t) => !t.calcule && disponible(t.ancre.mode)).length
)
const localise = computed(() => props.bien.lat != null && props.bien.lon != null)

const modesManquants = computed(() => [
  ...new Set(ancres.value.filter((a) => !disponible(a.mode)).map((a) => LIBELLES_MODE[a.mode]))
])

const aTransport = computed(() => ancres.value.some((a) => a.mode === 'transport'))
</script>

<template>
  <section class="rounded-2xl border border-hairline bg-white p-6">
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">Trajets</h2>
      <button
        v-if="actif && localise && manquants && calculable"
        :disabled="calcul"
        class="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-steel transition hover:bg-surface disabled:opacity-50"
        @click="calculer"
      >
        {{ calcul ? 'Calcul…' : 'Calculer' }}
      </button>
    </div>

    <p v-if="!actif" class="mt-3 text-xs text-stone">
      Aucun point d’ancrage.
      <NuxtLink to="/profil" class="font-medium text-blue hover:underline">
        Ajoute ton boulot, une école ou une gare
      </NuxtLink>
      pour voir le temps de trajet depuis chaque bien.
    </p>

    <p v-else-if="!localise" class="mt-3 text-xs text-stone">
      Ce bien n’a pas de position exacte : l’annonce ne donne pas d’adresse assez précise.
    </p>

    <ul v-else class="mt-3 space-y-2.5">
      <li
        v-for="t in liste"
        :key="t.ancre.id"
        class="flex items-center justify-between gap-3 text-sm"
      >
        <span class="flex min-w-0 items-center gap-2">
          <IconeMode :mode="t.ancre.mode" class="text-stone" />
          <span class="min-w-0">
            <span class="block truncate font-medium text-ink">{{ t.ancre.label }}</span>
            <span class="block truncate text-xs text-stone">
              {{ LIBELLES_MODE[t.ancre.mode] }}
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
          <template v-if="t.calcule">{{ formatDuree(t.duree_s) }}</template>
          <template v-else-if="!disponible(t.ancre.mode)">non configuré</template>
          <template v-else>à calculer</template>
        </span>
      </li>
    </ul>

    <p v-if="erreur" class="mt-3 text-xs text-[#600000]">{{ erreur }}</p>

    <p v-else-if="actif && localise && modesManquants.length" class="mt-3 text-xs text-stone">
      Trajets {{ modesManquants.join(' et ') }} indisponibles : la clé d’API correspondante
      n’est pas configurée sur le serveur.
    </p>

    <p v-else-if="actif && ancres.length" class="mt-3 text-xs text-stone">
      Itinéraires porte à porte, hors trafic.
    </p>

    <MentionTransitous v-if="actif && localise && aTransport" class="mt-2" />
  </section>
</template>

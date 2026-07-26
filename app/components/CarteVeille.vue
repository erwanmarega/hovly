<script setup lang="ts">
import type { Recherche } from '~/types'

const props = defineProps<{
  recherche: Recherche
  ouverte?: boolean
  scanEnCours?: boolean
}>()

const emit = defineEmits<{
  basculer: [id: string]
  scanner: [id: string]
  pause: [id: string, active: boolean]
  supprimer: [id: string]
}>()

const eur = (c: number | null) =>
  c == null ? '' : Math.round(c / 100).toLocaleString('fr-FR') + ' €'

const criteres = computed(() => {
  const r = props.recherche
  return [
    r.prix_min && r.prix_max
      ? `${eur(r.prix_min)}–${eur(r.prix_max)}`
      : r.prix_max
        ? `≤ ${eur(r.prix_max)}`
        : r.prix_min
          ? `≥ ${eur(r.prix_min)}`
          : '',
    r.surface_min ? `≥ ${r.surface_min} m²` : '',
    r.pieces_min ? `≥ ${r.pieces_min} p` : ''
  ].filter(Boolean)
})

const derniere = computed(() => {
  const iso = props.recherche.derniere_verif
  if (!iso) return 'jamais scannée'

  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  return `il y a ${Math.round(heures / 24)} j`
})

const enPause = computed(() => !props.recherche.active)
</script>

<template>
  <article
    class="overflow-hidden rounded-2xl border bg-white transition"
    :class="
      recherche.nouveaux
        ? 'border-blue/40 ring-1 ring-blue/10'
        : 'border-hairline-soft'
    "
  >
    <div class="flex flex-wrap items-center gap-3 p-4">
      <button
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
        :aria-expanded="ouverte"
        @click="emit('basculer', recherche.id)"
      >
        <LogoSource
          v-if="recherche.site_source"
          :source="recherche.site_source"
          :avec-nom="false"
          :taille="28"
        />

        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="truncate font-medium text-ink">{{ recherche.label }}</span>
            <span
              v-if="recherche.nouveaux"
              class="grid min-w-5 shrink-0 place-items-center rounded-full bg-blue px-1.5 text-xs font-bold text-white"
            >
              {{ recherche.nouveaux }}
            </span>
            <span
              v-if="enPause"
              class="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-stone"
            >
              En pause
            </span>
          </span>

          <span class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone">
            <span v-for="c in criteres" :key="c" class="rounded-full bg-surface px-2 py-0.5">
              {{ c }}
            </span>
            <span>Scannée {{ derniere }}</span>
          </span>
        </span>

        <svg
          class="size-4 shrink-0 text-stone transition"
          :class="ouverte && 'rotate-180'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div class="flex shrink-0 items-center gap-1">
        <button
          :disabled="scanEnCours"
          title="Scanner maintenant"
          class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink disabled:opacity-50"
          @click="emit('scanner', recherche.id)"
        >
          <span
            v-if="scanEnCours"
            class="size-4 animate-spin rounded-full border-2 border-stone/40 border-t-ink"
          />
          <svg
            v-else
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.4" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>

        <button
          :title="enPause ? 'Reprendre la veille' : 'Mettre en pause'"
          class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink"
          @click="emit('pause', recherche.id, enPause)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <template v-if="enPause">
              <path d="m6 3 14 9-14 9V3Z" />
            </template>
            <template v-else>
              <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
            </template>
          </svg>
        </button>

        <a
          :href="recherche.url"
          target="_blank"
          rel="noopener"
          title="Ouvrir la recherche sur le site"
          class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
          </svg>
        </a>

        <button
          title="Supprimer la veille"
          class="grid size-9 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
          @click="emit('supprimer', recherche.id)"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>

    <p
      v-if="recherche.derniere_erreur"
      class="border-t border-hairline-soft bg-coral/20 px-4 py-2.5 text-xs text-[#600000]"
    >
      Dernier scan en échec : {{ recherche.derniere_erreur }}
      <template v-if="enPause">
        — veille mise en pause automatiquement, vérifie que l'URL est toujours valide.
      </template>
    </p>

    <div v-if="ouverte" class="border-t border-hairline-soft bg-surface/50 p-3">
      <slot />
    </div>
  </article>
</template>

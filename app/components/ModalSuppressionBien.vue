<script setup lang="ts">
import type { Bien } from '~/types'

const props = defineProps<{
  ouvert: boolean
  bien: Pick<Bien, 'titre' | 'ville'> | null
  enCours?: boolean
}>()

const emit = defineEmits<{ annuler: []; confirmer: [] }>()

function surTouche(e: KeyboardEvent) {
  if (e.key === 'Escape' && !props.enCours) emit('annuler')
}

watch(
  () => props.ouvert,
  (o) => {
    if (o) window.addEventListener('keydown', surTouche)
    else window.removeEventListener('keydown', surTouche)
  }
)
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))
</script>

<template>
  <Teleport to="body">
    <Transition name="modale">
      <div
        v-if="ouvert"
        class="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-suppression-bien"
        @click.self="!enCours && emit('annuler')"
      >
        <div
          class="w-full max-w-md rounded-feature border border-hairline-soft bg-white p-8 shadow-[0_16px_48px_-8px_rgba(5,0,56,0.12)]"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-ink"
            >
              <svg
                class="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </span>
            <p class="text-xs font-semibold uppercase tracking-wide text-stone">Suppression</p>
          </div>

          <h2
            id="titre-suppression-bien"
            class="mt-4 text-[22px] font-medium leading-snug tracking-tight text-ink-deep"
          >
            Supprimer ce bien ?
          </h2>

          <div class="mt-4 rounded-2xl bg-surface px-4 py-3">
            <p class="break-words text-sm font-medium text-ink">{{ bien?.titre }}</p>
            <p v-if="bien?.ville" class="mt-0.5 text-xs text-stone">{{ bien.ville }}</p>
          </div>

          <p class="mt-4 text-sm text-slate">
            Le bien et son historique seront définitivement supprimés.
          </p>

          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              :disabled="enCours"
              class="rounded-full border border-hairline-strong bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-60"
              @click="emit('annuler')"
            >
              Annuler
            </button>
            <button
              :disabled="enCours"
              class="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:bg-brand-deep disabled:opacity-60"
              @click="emit('confirmer')"
            >
              <span
                v-if="enCours"
                class="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
              />
              {{ enCours ? 'Suppression…' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modale-enter-active,
.modale-leave-active {
  transition:
    opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.modale-enter-from,
.modale-leave-to {
  opacity: 0;
  transform: translateY(14px);
}
@media (prefers-reduced-motion: reduce) {
  .modale-enter-active,
  .modale-leave-active {
    transition: none;
  }
}
</style>

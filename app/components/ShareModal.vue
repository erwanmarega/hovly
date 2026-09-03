<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    propertyCount: number;
    loading?: boolean;
    error?: string;
    link?: string | null;
  }>(),
  { loading: false, error: "", link: null }
);

const emit = defineEmits<{ create: [titre: string]; close: [] }>();

const titre = ref("");
const copied = ref(false);

watch(
  () => props.open,
  (o) => {
    if (o) {
      titre.value = "";
      copied.value = false;
    }
  }
);

async function copy() {
  if (!props.link) return;
  await navigator.clipboard.writeText(props.link);
  copied.value = true;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape" && !props.loading) emit("close");
}

watch(
  () => props.open,
  (o) => {
    if (o) window.addEventListener("keydown", onKey);
    else window.removeEventListener("keydown", onKey);
  }
);
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="modale">
      <div
        v-if="open"
        class="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-partage"
        @click.self="!loading && emit('close')"
      >
        <div
          class="w-full max-w-md rounded-feature border border-hairline-soft bg-white p-8 shadow-[0_16px_48px_-8px_rgba(5,0,56,0.12)]"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-stone">
            Partage
          </p>
          <h2
            id="titre-partage"
            class="mt-2 text-[22px] font-medium leading-snug tracking-tight text-ink-deep"
          >
            {{ link ? "Lien créé" : "Partager cette sélection" }}
          </h2>

          <template v-if="!link">
            <p class="mt-3 text-sm text-slate">
              {{ propertyCount }} bien{{ propertyCount > 1 ? "s" : "" }} — n'importe qui
              avec le lien pourra les consulter, sans avoir besoin de compte.
            </p>

            <label class="mt-5 block text-sm font-medium text-ink">
              Nom du partage (optionnel)
              <input
                v-model="titre"
                type="text"
                maxlength="80"
                placeholder="Ex. Sélection pour Marie"
                class="mt-1.5 w-full rounded-xl border border-hairline-strong bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-stone focus:border-ink focus:outline-none"
              />
            </label>

            <p v-if="error" class="mt-3 rounded-xl bg-coral/20 px-3 py-2 text-sm text-[#600000]">
              {{ error }}
            </p>

            <div class="mt-6 flex items-center justify-end gap-3">
              <button
                :disabled="loading"
                class="rounded-full border border-hairline-strong bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-60"
                @click="emit('close')"
              >
                Annuler
              </button>
              <button
                :disabled="loading"
                class="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:bg-brand-deep disabled:opacity-60"
                @click="emit('create', titre.trim())"
              >
                <span
                  v-if="loading"
                  class="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
                />
                {{ loading ? "Création…" : "Créer le lien" }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="mt-3 text-sm text-slate">
              Ce lien reste actif jusqu'à ce que tu le révoques, depuis
              « Mes partages » sur ton profil.
            </p>

            <div
              class="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3"
            >
              <input
                :value="link"
                readonly
                class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                class="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black"
                @click="copy"
              >
                {{ copied ? "Copié !" : "Copier" }}
              </button>
            </div>

            <div class="mt-6 flex justify-end">
              <button
                class="rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:bg-brand-deep"
                @click="emit('close')"
              >
                Fermer
              </button>
            </div>
          </template>
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

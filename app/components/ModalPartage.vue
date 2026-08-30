<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    ouvert: boolean;
    nbBiens: number;
    enCours?: boolean;
    erreur?: string;
    lien?: string | null;
  }>(),
  { enCours: false, erreur: "", lien: null }
);

const emit = defineEmits<{ creer: [titre: string]; fermer: [] }>();

const titre = ref("");
const copie = ref(false);

watch(
  () => props.ouvert,
  (o) => {
    if (o) {
      titre.value = "";
      copie.value = false;
    }
  }
);

async function copier() {
  if (!props.lien) return;
  await navigator.clipboard.writeText(props.lien);
  copie.value = true;
}

function surTouche(e: KeyboardEvent) {
  if (e.key === "Escape" && !props.enCours) emit("fermer");
}

watch(
  () => props.ouvert,
  (o) => {
    if (o) window.addEventListener("keydown", surTouche);
    else window.removeEventListener("keydown", surTouche);
  }
);
onBeforeUnmount(() => window.removeEventListener("keydown", surTouche));
</script>

<template>
  <Teleport to="body">
    <Transition name="modale">
      <div
        v-if="ouvert"
        class="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-partage"
        @click.self="!enCours && emit('fermer')"
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
            {{ lien ? "Lien créé" : "Partager cette sélection" }}
          </h2>

          <template v-if="!lien">
            <p class="mt-3 text-sm text-slate">
              {{ nbBiens }} bien{{ nbBiens > 1 ? "s" : "" }} — n'importe qui
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

            <p v-if="erreur" class="mt-3 rounded-xl bg-coral/20 px-3 py-2 text-sm text-[#600000]">
              {{ erreur }}
            </p>

            <div class="mt-6 flex items-center justify-end gap-3">
              <button
                :disabled="enCours"
                class="rounded-full border border-hairline-strong bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-surface disabled:opacity-60"
                @click="emit('fermer')"
              >
                Annuler
              </button>
              <button
                :disabled="enCours"
                class="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:bg-brand-deep disabled:opacity-60"
                @click="emit('creer', titre.trim())"
              >
                <span
                  v-if="enCours"
                  class="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink"
                />
                {{ enCours ? "Création…" : "Créer le lien" }}
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
                :value="lien"
                readonly
                class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
                @focus="($event.target as HTMLInputElement).select()"
              />
              <button
                class="shrink-0 rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-white transition hover:bg-black"
                @click="copier"
              >
                {{ copie ? "Copié !" : "Copier" }}
              </button>
            </div>

            <div class="mt-6 flex justify-end">
              <button
                class="rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink transition hover:bg-brand-deep"
                @click="emit('fermer')"
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

<script setup lang="ts">
import type { Statut } from "~/types";
import { STATUTS } from "~/composables/useBiens";

const props = defineProps<{
  statut: Statut;
  versLeHaut?: boolean;
}>();

const emit = defineEmits<{ change: [statut: Statut] }>();

const LARGEUR = 176; // w-44
const MARGE = 8;
const ECART = 4;

const ouvert = ref(false);
const place = ref(false);
const declencheur = ref<HTMLElement | null>(null);
const menu = ref<HTMLElement | null>(null);
const position = ref({ top: 0, left: 0 });

function placer() {
  const el = declencheur.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const hauteur = menu.value?.offsetHeight ?? 0;
  position.value = {
    top: props.versLeHaut ? r.top - hauteur - ECART : r.bottom + ECART,
    left: Math.max(
      MARGE,
      Math.min(r.left, window.innerWidth - LARGEUR - MARGE)
    ),
  };
  place.value = true;
}

async function basculer() {
  if (ouvert.value) return fermer();
  ouvert.value = true;
  await nextTick();
  placer();
}

function fermer() {
  ouvert.value = false;
  place.value = false;
}

function choisir(s: Statut) {
  fermer();
  if (s !== props.statut) emit("change", s);
}

function ecouter(actif: boolean) {
  const methode = actif ? "addEventListener" : "removeEventListener";
  window[methode]("scroll", placer, true);
  window[methode]("resize", placer);
}

watch(ouvert, ecouter);
onBeforeUnmount(() => ecouter(false));
</script>
<template>
  <div class="relative">
    <button
      ref="declencheur"
      type="button"
      :aria-expanded="ouvert"
      aria-label="Changer le statut"
      @click="basculer"
    >
      <BadgeStatut :statut="statut" />
    </button>

    <Teleport to="body">
      <template v-if="ouvert">
        <button
          class="fixed inset-0 z-20 cursor-default"
          tabindex="-1"
          aria-label="Fermer le menu"
          @click="fermer"
        />
        <div
          ref="menu"
          class="fixed z-30 w-44 rounded-xl border border-hairline bg-white p-1 shadow-lg"
          :style="{
            top: `${position.top}px`,
            left: `${position.left}px`,
            visibility: place ? 'visible' : 'hidden',
          }"
        >
          <button
            v-for="s in STATUTS"
            :key="s.value"
            class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface"
            :class="
              statut === s.value ? 'font-semibold text-ink' : 'text-slate'
            "
            @click="choisir(s.value)"
          >
            {{ s.label }}
          </button>
        </div>
      </template>
    </Teleport>
  </div>
</template>

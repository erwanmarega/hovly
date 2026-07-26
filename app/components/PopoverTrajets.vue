<script setup lang="ts">
const props = defineProps<{ bienId: string }>()

const { pour, retenu, ancreChoisie, choisirAncre } = useTrajets()

const ouvert = ref(false)
const declencheur = ref<HTMLElement | null>(null)
const coord = ref<{ left: number, top?: number, bottom?: number }>({ left: 0, top: 0 })

const liste = computed(() => pour(props.bienId))
const affiche = computed(() => retenu(props.bienId))

const LARGEUR = 256
const HAUTEUR_ESTIMEE = 280
const MARGE = 8

function basculer() {
  if (ouvert.value) {
    ouvert.value = false
    return
  }

  const r = declencheur.value?.getBoundingClientRect()
  if (!r) return

  const placeEnBas = window.innerHeight - r.bottom
  const versLeHaut = placeEnBas < HAUTEUR_ESTIMEE && r.top > placeEnBas

  coord.value = {
    left: Math.max(MARGE, Math.min(r.left, window.innerWidth - LARGEUR - MARGE)),
    top: versLeHaut ? undefined : r.bottom + 4,
    bottom: versLeHaut ? window.innerHeight - r.top + 4 : undefined
  }
  ouvert.value = true
}

const style = computed(() => ({
  left: `${coord.value.left}px`,
  top: coord.value.top != null ? `${coord.value.top}px` : undefined,
  bottom: coord.value.bottom != null ? `${coord.value.bottom}px` : undefined
}))

function fermer() {
  ouvert.value = false
}

watch(ouvert, (o) => {
  if (o) window.addEventListener('scroll', fermer, { passive: true, capture: true })
  else window.removeEventListener('scroll', fermer, { capture: true })
})

onScopeDispose(() => window.removeEventListener('scroll', fermer, { capture: true }))

function afficherDansLaColonne(ancreId: string | null) {
  ouvert.value = false
  choisirAncre(ancreId)
}
</script>

<template>
  <div class="relative" @keydown.escape="fermer">
    <button
      ref="declencheur"
      type="button"
      class="rounded-full transition hover:opacity-80"
      :aria-expanded="ouvert"
      aria-label="Voir tous les trajets de ce bien"
      @click="basculer"
    >
      <span
        v-if="affiche"
        class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="affiche.depasse ? 'bg-coral text-[#600000]' : 'bg-teal text-[#0a4a42]'"
        :title="`${affiche.ancre.label} ${LIBELLES_MODE[affiche.ancre.mode]}`"
      >
        <IconeMode :mode="affiche.ancre.mode" class="size-3" />
        {{ formatDuree(affiche.duree_s) }}
      </span>
      <span v-else class="text-stone">—</span>
    </button>

    <Teleport to="body">
      <template v-if="ouvert">
        <button
          class="fixed inset-0 z-40 cursor-default"
          tabindex="-1"
          aria-label="Fermer"
          @click="fermer"
        />
        <div
          class="fixed z-50 w-64 rounded-xl border border-hairline bg-white p-1 text-left shadow-lg"
          :style="style"
          @keydown.escape="fermer"
        >
          <p class="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-stone">
            Afficher dans la colonne
          </p>

          <button
            v-for="t in liste"
            :key="t.ancre.id"
            class="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition hover:bg-surface"
            :class="ancreChoisie?.id === t.ancre.id ? 'bg-surface-soft' : ''"
            @click="afficherDansLaColonne(t.ancre.id)"
          >
            <IconeMode :mode="t.ancre.mode" class="size-3.5 shrink-0 text-stone" />
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-left"
                :class="ancreChoisie?.id === t.ancre.id ? 'font-semibold text-ink' : 'text-slate'"
              >{{ t.ancre.label }}</span>
              <span class="block truncate text-left text-[11px] text-stone">
                {{ LIBELLES_MODE[t.ancre.mode] }}
              </span>
            </span>
            <span
              class="shrink-0 text-xs font-semibold tabular-nums"
              :class="t.depasse ? 'text-[#600000]' : 'text-steel'"
            >
              {{ formatDuree(t.duree_s) }}
            </span>
          </button>

          <div class="my-1 h-px bg-hairline-soft" />

          <button
            class="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm transition hover:bg-surface"
            :class="ancreChoisie ? 'text-slate' : 'bg-surface-soft font-semibold text-ink'"
            @click="afficherDansLaColonne(null)"
          >
            Le plus long
            <span class="text-[11px] font-normal text-stone">par défaut</span>
          </button>

          <NuxtLink
            :to="`/bien/${bienId}`"
            class="block rounded-lg px-3 py-1.5 text-sm font-medium text-blue transition hover:bg-surface"
          >
            Voir ce bien →
          </NuxtLink>
        </div>
      </template>
    </Teleport>
  </div>
</template>

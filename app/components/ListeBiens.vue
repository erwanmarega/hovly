<script setup lang="ts">
import type { Bien, Statut } from '~/types'
import type { Score } from '~/composables/useScore'

type Clef =
  | 'date'
  | 'prix'
  | 'surface'
  | 'prix_m2'
  | 'score'
  | 'visite'
  | 'cout_reel'
  | 'trajet'

const props = defineProps<{
  biens: Bien[]
  score: (bien: Bien) => Score
  doublons: Map<string, number>
  triClef: Clef
  triAsc: boolean
  page: number
  total: number
  parPage: number
}>()

const emit = defineEmits<{
  tri: [clef: Clef]
  'update:page': [page: number]
  supprimer: [id: string]
  statut: [id: string, statut: Statut]
}>()

const { prixMensuel, prixM2 } = useBiens()
const { calculer: coutDe } = useCoutReel()
const { actif: trajetsActifs, ancreChoisie } = useTrajets()

const couts = computed(() => new Map(props.biens.map((b) => [b.id, coutDe(b)])))

const { complet: selectionComplete, estSelectionne, basculer } = useComparateur()

const TRIS = computed<{ value: Clef, label: string }[]>(() => {
  const tris: { value: Clef, label: string }[] = [
    { value: 'date' as const, label: 'Date d’ajout' },
    { value: 'prix' as const, label: 'Prix' },
    { value: 'surface' as const, label: 'Surface' },
    { value: 'prix_m2' as const, label: '€/m²' },
    { value: 'cout_reel' as const, label: 'Coût réel' }
  ]
  if (trajetsActifs.value) {
    tris.push({
      value: 'trajet' as const,
      label: ancreChoisie.value ? `Trajet — ${ancreChoisie.value.label}` : 'Trajet le plus long'
    })
  }
  tris.push(
    { value: 'score' as const, label: 'Score' },
    { value: 'visite' as const, label: 'Date de visite' }
  )
  return tris
})

const eur = (n: number) => n.toLocaleString('fr-FR')

const versLeHaut = (i: number) => props.biens.length > 3 && i >= props.biens.length - 2
</script>

<template>
  <div>
    <!-- Mobile : sélecteur de tri + cartes compactes -->
    <div
      class="overflow-hidden rounded-feature border border-hairline-soft bg-white shadow-[0_1px_2px_rgba(5,0,56,0.04)] md:hidden"
    >
      <div class="flex items-center gap-2 border-b border-hairline-soft px-4 py-2.5">
        <label class="text-xs font-medium text-stone" for="tri-liste">Trier par</label>
        <select
          id="tri-liste"
          class="min-w-0 flex-1 rounded-full border border-hairline bg-surface-soft px-3 py-1.5 text-sm outline-none focus:border-blue"
          :value="triClef"
          @change="emit('tri', ($event.target as HTMLSelectElement).value as Clef)"
        >
          <option v-for="t in TRIS" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <button
          class="grid size-9 shrink-0 place-items-center rounded-lg border border-hairline text-steel transition hover:bg-surface"
          :aria-label="triAsc ? 'Ordre croissant' : 'Ordre décroissant'"
          @click="emit('tri', triClef)"
        >
          {{ triAsc ? '↑' : '↓' }}
        </button>
      </div>

      <div class="divide-y divide-hairline-soft">
        <CarteBienCompacte
          v-for="b in biens"
          :key="b.id"
          :bien="b"
          :score="score(b)"
          :prix-mensuel="prixMensuel(b)"
          :prix-m2="prixM2(b)"
          :doublons="doublons.get(b.id)"
          :selectionne="estSelectionne(b.id)"
          :selection-bloquee="selectionComplete"
          @basculer="basculer"
          @supprimer="emit('supprimer', $event)"
          @statut="(id, s) => emit('statut', id, s)"
        />
      </div>
    </div>

    <!-- Desktop : tri en pilules + lignes-cartes -->
    <div class="hidden md:block">
      <div class="filtres -mx-1 mb-3 flex items-center gap-2 overflow-x-auto px-1 py-0.5">
        <span
          class="shrink-0 pl-1 text-[11px] font-semibold uppercase tracking-wider text-stone"
        >Trier</span>
        <button
          v-for="t in TRIS"
          :key="t.value"
          class="filtre flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
          :class="
            triClef === t.value
              ? 'bg-ink text-white'
              : 'border border-hairline bg-white text-steel hover:bg-surface'
          "
          @click="emit('tri', t.value)"
        >
          {{ t.label }}
          <span v-if="triClef === t.value" class="text-[11px]">{{ triAsc ? '↑' : '↓' }}</span>
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(b, i) in biens"
          :key="b.id"
          class="ligne flex items-center gap-3 rounded-2xl border border-hairline-soft bg-white px-4 py-3 shadow-[0_1px_2px_rgba(5,0,56,0.04)] transition hover:border-hairline hover:shadow-[0_4px_12px_rgba(5,0,56,0.06)]"
          :style="{ '--i': i }"
        >
          <input
            type="checkbox"
            class="size-4 shrink-0 cursor-pointer accent-ink"
            :checked="estSelectionne(b.id)"
            :disabled="!estSelectionne(b.id) && selectionComplete"
            :aria-label="`Comparer ${b.titre}`"
            @change="basculer(b.id)"
          >

          <NuxtLink :to="`/bien/${b.id}`" class="group flex min-w-0 flex-1 items-center gap-3.5">
            <img
              v-if="b.photos?.[0]"
              :src="b.photos[0]"
              :alt="b.titre"
              class="size-14 shrink-0 rounded-xl bg-surface object-cover"
              loading="lazy"
            >
            <div v-else class="size-14 shrink-0 rounded-xl bg-surface" />
            <div class="min-w-0">
              <p class="truncate font-medium text-ink transition group-hover:text-blue">
                {{ b.titre }}
              </p>
              <p class="mt-0.5 flex items-center gap-1.5 text-xs text-stone">
                <span class="truncate">{{ b.ville }}</span>
                <LogoSource :source="b.site_source" :avec-nom="false" :taille="14" />
                <span
                  v-if="doublons.get(b.id)"
                  class="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d1c]"
                  :title="`Ce bien apparaît sur ${doublons.get(b.id)} annonces`"
                >×{{ doublons.get(b.id) }}</span>
                <svg
                  v-if="b.note_perso"
                  class="size-3 shrink-0 text-steel"
                  :aria-label="b.note_perso"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <title>{{ b.note_perso }}</title>
                  <path d="M4 6h16M4 12h16M4 18h9" />
                </svg>
              </p>
            </div>
          </NuxtLink>

          <div class="hidden w-28 shrink-0 text-right tabular-nums lg:block">
            <p class="font-semibold">
              {{ eur(prixMensuel(b)) }} €<span v-if="!estAchat(b)" class="text-xs font-normal text-stone">/mois</span>
            </p>
            <p class="text-xs text-stone">
              réel {{ eur(Math.round((couts.get(b.id)?.total ?? 0) / 100)) }} €
            </p>
          </div>

          <div class="hidden w-24 shrink-0 text-right tabular-nums xl:block">
            <p class="text-sm text-slate">{{ b.surface }} m²</p>
            <p class="text-xs text-stone">{{ b.nb_pieces }} p · {{ eur(prixM2(b)) }} €/m²</p>
          </div>

          <div class="hidden w-10 shrink-0 xl:block"><BadgeDPE :dpe="b.dpe" /></div>

          <div class="w-20 shrink-0"><ScoreBien :score="score(b)" /></div>

          <div v-if="trajetsActifs" class="hidden w-16 shrink-0 lg:block">
            <PopoverTrajets :bien-id="b.id" />
          </div>

          <div class="hidden w-24 shrink-0 xl:block">
            <BadgeVisite v-if="b.visite_le" :visite-le="b.visite_le" compact />
            <span v-else class="text-sm text-stone">—</span>
          </div>

          <div class="hidden shrink-0 sm:block">
            <SelecteurStatut
              :statut="b.statut"
              :vers-le-haut="versLeHaut(i)"
              @change="emit('statut', b.id, $event)"
            />
          </div>

          <div class="flex shrink-0 items-center justify-end gap-1">
            <a
              :href="b.url_source"
              target="_blank"
              rel="noopener"
              class="grid size-8 place-items-center rounded-lg text-stone transition hover:bg-surface hover:text-ink"
              title="Voir l'annonce"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
              </svg>
            </a>
            <button
              class="grid size-8 place-items-center rounded-lg text-stone transition hover:bg-coral hover:text-[#600000]"
              title="Supprimer"
              @click="emit('supprimer', b.id)"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <PaginationListe
      class="mt-4"
      :page="page"
      :total="total"
      :par-page="parPage"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>

<style scoped>
.ligne {
  opacity: 0;
  animation: apparaitre 0.4s ease forwards;
  animation-delay: calc(var(--i) * 0.03s);
}
@keyframes apparaitre {
  to {
    opacity: 1;
  }
}

.filtre:hover {
  transform: translateY(-1px);
}

.filtres {
  scrollbar-width: none;
}
.filtres::-webkit-scrollbar {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .ligne {
    opacity: 1;
    animation: none;
  }
  .filtre:hover {
    transform: none;
  }
}
</style>

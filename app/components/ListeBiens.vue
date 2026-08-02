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

const libelleTrajet = computed(() => ancreChoisie.value?.label ?? 'Trajet')
const { complet: selectionComplete, estSelectionne, basculer } = useComparateur()

const TRIS = computed<{ value: Clef, label: string }[]>(() => [
  { value: 'date', label: 'Date d’ajout' },
  { value: 'prix', label: 'Prix' },
  { value: 'surface', label: 'Surface' },
  { value: 'prix_m2', label: '€/m²' },
  { value: 'cout_reel', label: 'Coût réel' },
  {
    value: 'trajet',
    label: ancreChoisie.value ? `Trajet — ${ancreChoisie.value.label}` : 'Trajet le plus long'
  },
  { value: 'score', label: 'Score' },
  { value: 'visite', label: 'Date de visite' }
])

const SOURCES: Record<string, string> = {
  seloger: 'SeLoger',
  leboncoin: 'Leboncoin',
  pap: 'PAP',
  'logic-immo': 'Logic-Immo',
  bienici: 'Bien’ici',
  century21: 'Century 21'
}

const eur = (n: number) => n.toLocaleString('fr-FR')

const versLeHaut = (i: number) => props.biens.length > 3 && i >= props.biens.length - 2
</script>

<template>
  <div
    class="overflow-hidden rounded-feature border border-hairline-soft bg-white shadow-[0_1px_2px_rgba(5,0,56,0.04)]"
  >
    <div class="flex items-center gap-2 border-b border-hairline-soft px-4 py-2.5 xl:hidden">
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

    <div class="divide-y divide-hairline-soft md:hidden">
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

    <div class="hidden overflow-x-auto md:block">
      <table class="w-full text-left text-sm">
        <thead class="bg-surface-soft">
          <tr
            class="border-b border-hairline-soft text-[11px] font-semibold uppercase tracking-wider text-stone [&>th]:px-3 [&>th]:py-3 2xl:[&>th]:px-4"
          >
            <th class="w-10" />
            <th class="font-semibold">Bien</th>
            <th class="font-semibold">
              <button class="transition hover:text-ink" @click="emit('tri', 'prix')">
                Prix <span v-if="triClef === 'prix'">{{ triAsc ? '↑' : '↓' }}</span>
              </button>
              <span class="px-1 text-hairline-strong">/</span>
              <button
                class="font-normal transition hover:text-ink"
                title="Prix + charges + énergie estimée + assurance"
                @click="emit('tri', 'cout_reel')"
              >
                réel <span v-if="triClef === 'cout_reel'">{{ triAsc ? '↑' : '↓' }}</span>
              </button>
            </th>
            <th class="font-semibold">
              <button class="transition hover:text-ink" @click="emit('tri', 'surface')">
                m² <span v-if="triClef === 'surface'">{{ triAsc ? '↑' : '↓' }}</span>
              </button>
              <span class="px-1 text-hairline-strong">/</span>
              <button class="font-normal transition hover:text-ink" @click="emit('tri', 'prix_m2')">
                €/m² <span v-if="triClef === 'prix_m2'">{{ triAsc ? '↑' : '↓' }}</span>
              </button>
            </th>
            <th class="hidden font-semibold lg:table-cell">DPE</th>
            <th class="cursor-pointer font-semibold hover:text-ink" @click="emit('tri', 'score')">
              Score <span v-if="triClef === 'score'">{{ triAsc ? '↑' : '↓' }}</span>
            </th>
            <th
              v-if="trajetsActifs"
              class="hidden max-w-[9rem] cursor-pointer truncate font-semibold hover:text-ink lg:table-cell"
              :title="
                ancreChoisie
                  ? `Temps de trajet vers ${ancreChoisie.label}`
                  : 'Temps de trajet le plus long vers tes points d’ancrage'
              "
              @click="emit('tri', 'trajet')"
            >
              {{ libelleTrajet }} <span v-if="triClef === 'trajet'">{{ triAsc ? '↑' : '↓' }}</span>
            </th>
            <th
              class="hidden cursor-pointer font-semibold hover:text-ink xl:table-cell"
              @click="emit('tri', 'visite')"
            >
              Visite <span v-if="triClef === 'visite'">{{ triAsc ? '↑' : '↓' }}</span>
            </th>
            <th class="font-semibold">Statut</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(b, i) in biens"
            :key="b.id"
            class="ligne border-b border-hairline-soft transition last:border-0 hover:bg-surface-soft [&>td]:px-3 [&>td]:py-3 2xl:[&>td]:px-4"
            :style="{ '--i': i }"
          >
            <td>
              <input
                type="checkbox"
                class="size-4 cursor-pointer accent-ink"
                :checked="estSelectionne(b.id)"
                :disabled="!estSelectionne(b.id) && selectionComplete"
                :aria-label="`Comparer ${b.titre}`"
                @change="basculer(b.id)"
              >
            </td>
            <td>
              <NuxtLink :to="`/bien/${b.id}`" class="group flex items-center gap-3">
                <img
                  v-if="b.photos?.[0]"
                  :src="b.photos[0]"
                  :alt="b.titre"
                  class="size-11 shrink-0 rounded-lg bg-surface object-cover"
                  loading="lazy"
                >
                <div v-else class="size-11 shrink-0 rounded-lg bg-surface" />
                <div class="min-w-0">
                  <p
                    class="max-w-[150px] truncate font-medium text-ink transition group-hover:text-blue xl:max-w-[200px]"
                  >
                    {{ b.titre }}
                  </p>
                  <p class="flex items-center gap-1.5 text-xs text-stone">
                    <span class="truncate">{{ b.ville }}</span>
                    <span class="text-steel">{{ SOURCES[b.site_source] }}</span>
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
            </td>
            <td class="whitespace-nowrap tabular-nums">
              <p class="font-semibold">
                {{ eur(prixMensuel(b)) }} €<span v-if="!estAchat(b)" class="text-xs font-normal text-stone">/mois</span>
              </p>
              <p class="text-xs text-stone">
                réel {{ eur(Math.round((couts.get(b.id)?.total ?? 0) / 100)) }} €
              </p>
            </td>
            <td class="whitespace-nowrap tabular-nums">
              <p class="text-slate">{{ b.surface }} m²</p>
              <p class="text-xs text-stone">{{ b.nb_pieces }} p · {{ eur(prixM2(b)) }} €/m²</p>
            </td>
            <td class="hidden lg:table-cell"><BadgeDPE :dpe="b.dpe" /></td>
            <td class="whitespace-nowrap"><ScoreBien :score="score(b)" /></td>
            <td v-if="trajetsActifs" class="hidden whitespace-nowrap lg:table-cell">
              <PopoverTrajets :bien-id="b.id" />
            </td>
            <td class="hidden whitespace-nowrap xl:table-cell">
              <BadgeVisite v-if="b.visite_le" :visite-le="b.visite_le" compact />
              <span v-else class="text-stone">—</span>
            </td>
            <td>
              <SelecteurStatut
                :statut="b.statut"
                :vers-le-haut="versLeHaut(i)"
                @change="emit('statut', b.id, $event)"
              />
            </td>
            <td class="text-right">
              <div class="flex items-center justify-end gap-1">
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
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <PaginationListe
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

@media (prefers-reduced-motion: reduce) {
  .ligne {
    opacity: 1;
    animation: none;
  }
}
</style>

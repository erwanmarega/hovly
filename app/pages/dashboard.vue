<script setup lang="ts">
import type { Property, Status } from "~/types";
import type { Score } from "~/composables/useScore";
import { STATUSES } from "~/composables/useProperties";

useHead({ title: "Mes biens — Hovly" });

const { biens, refresh, monthlyPrice, pricePerSqm, setStatus, remove } =
  useProperties();

const propertyToDelete = ref<Property | null>(null);
const deleting = ref(false);
const { announce } = useToast();

function requestDelete(id: string) {
  propertyToDelete.value = biens.value.find((b) => b.id === id) ?? null;
}

async function confirmDelete() {
  const b = propertyToDelete.value;
  if (!b) return;
  deleting.value = true;
  await remove(b.id);
  deleting.value = false;
  propertyToDelete.value = null;

  if (biens.value.some((x) => x.id === b.id)) {
    announce("Suppression impossible. Réessaie.", "erreur");
  } else {
    announce(`« ${b.titre} » supprimé.`);
  }
}

const { pending } = useAsyncData("biens", () => refresh(), { server: false });

const VIEWS = [
  { value: "list", label: "Liste" },
  { value: "grid", label: "Grille" },
  { value: "map", label: "Carte" },
] as const;

const viewMode = ref<(typeof VIEWS)[number]["value"]>("list");
const selection = ref<string | null>(null);
const hoveredId = ref<string | null>(null);

const statusFilter = ref<Status | "tous">("tous");
const search = ref("");
const sortKey = ref<
  | "date"
  | "prix"
  | "surface"
  | "prix_m2"
  | "score"
  | "visite"
  | "cout_reel"
  | "trajet"
>("date");
const sortAsc = ref(false);

const { preferences } = usePreferences();

const { calculate: costOf } = useActualCost();
const { selected: commuteFor, refresh: refreshCommutes } = useCommutes();
useAsyncData("trajets-dashboard", () => refreshCommutes(), { server: false });

const commuteSeconds = (b: Property) =>
  commuteFor(b.id)?.duree_s ?? Number.POSITIVE_INFINITY;

const scoreContext = computed(() => representatives(biens.value));
const scoreOf = (b: Property) =>
  scoreProperty(b, scoreContext.value, preferences.value);

const duplicateGroups = computed(() =>
  groupDuplicates(biens.value.filter((b) => b.actif))
);

const {
  selection: comparisonSelection,
  count: compareCount,
  full: selectionComplete,
  comparable,
  clear: clearComparison,
} = useComparator();

const { create: createShare } = useShares();
const shareOpen = ref(false);
const sharing = ref(false);
const shareError = ref("");
const shareLink = ref<string | null>(null);

async function createShareLink(title: string) {
  sharing.value = true;
  shareError.value = "";
  try {
    const share = await createShare(
      comparisonSelection.value,
      title || undefined
    );
    shareLink.value = `${window.location.origin}/partage/${share.token}`;
  } catch {
    shareError.value = "Impossible de créer le lien. Réessaie.";
  } finally {
    sharing.value = false;
  }
}

function closeShare() {
  const hadLink = shareLink.value !== null;
  shareOpen.value = false;
  shareLink.value = null;
  if (hadLink) clearComparison();
}
const duplicatesById = computed(() => {
  const map = new Map<string, number>();
  for (const group of duplicateGroups.value) {
    for (const b of group) map.set(b.id, group.length);
  }
  return map;
});

const { zone, inZone, clear: clearZone } = useMapZone();

const displayedProperties = computed(() => {
  let list = biens.value.filter((b) => b.actif);

  if (statusFilter.value !== "tous") {
    list = list.filter((b) => b.statut === statusFilter.value);
  }

  if (zone.value) {
    list = list.filter(inZone);
  }

  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (b) =>
        b.titre.toLowerCase().includes(q) ||
        b.ville.toLowerCase().includes(q) ||
        (b.adresse ?? "").toLowerCase().includes(q)
    );
  }

  const dir = sortAsc.value ? 1 : -1;

  if (sortKey.value === "trajet") {
    const withCommute = list.filter((b) => Number.isFinite(commuteSeconds(b)));
    const without = list.filter((b) => !Number.isFinite(commuteSeconds(b)));
    withCommute.sort((a, b) => (commuteSeconds(a) - commuteSeconds(b)) * dir);
    return [...withCommute, ...without];
  }

  if (sortKey.value === "visite") {
    const withVisit = list.filter((b) => b.visite_le);
    const without = list.filter((b) => !b.visite_le);
    withVisit.sort(
      (a, b) =>
        (new Date(a.visite_le!).getTime() - new Date(b.visite_le!).getTime()) *
        dir
    );
    return [...withVisit, ...without];
  }

  return [...list].sort((a, b) => {
    let va: number;
    let vb: number;
    switch (sortKey.value) {
      case "prix":
        va = a.prix;
        vb = b.prix;
        break;
      case "surface":
        va = a.surface;
        vb = b.surface;
        break;
      case "prix_m2":
        va = pricePerSqm(a);
        vb = pricePerSqm(b);
        break;
      case "score":
        va = scoreOf(a).total;
        vb = scoreOf(b).total;
        break;
      case "cout_reel":
        va = costOf(a).total;
        vb = costOf(b).total;
        break;
      default:
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
    }
    return (va - vb) * dir;
  });
});

const PER_PAGE = 12;
const page = ref(1);

const pagedProperties = computed(() =>
  displayedProperties.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE)
);

watch([search, statusFilter, sortKey, sortAsc, zone], () => {
  page.value = 1;
});

watch(displayedProperties, (list) => {
  const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (page.value > pageCount) page.value = pageCount;
});

const stats = computed(() => {
  const active = biens.value.filter((b) => b.actif);
  // La fourchette ne mélange pas loyers et prix de vente : locations en
  // priorité, achats seulement si la liste n'en contient que ça.
  const rentals = active.filter((b) => !isPurchase(b));
  const group = rentals.length ? rentals : active;
  const prices = group.map(monthlyPrice).filter((p) => p > 0);
  const best = active.reduce<{ score: Score; bien: Property } | null>(
    (top, b) => {
      const score = scoreOf(b);
      return !top || score.total > top.score.total
        ? { score, bien: b }
        : top;
    },
    null
  );

  return {
    total: active.length,
    priceMin: prices.length ? Math.min(...prices) : 0,
    priceMax: prices.length ? Math.max(...prices) : 0,
    rangeLabel: rentals.length ? "locations" : "achats",
    best,
    favorites: active.filter((b) => b.statut === "coup_de_coeur").length,
  };
});

const counts = computed(() => {
  const active = biens.value.filter((b) => b.actif);
  const byStatus = Object.fromEntries(
    STATUSES.map((s) => [s.value, 0])
  ) as Record<Status, number>;
  for (const b of active) byStatus[b.statut]++;
  return { tous: active.length, ...byStatus };
});

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = false;
  }
}

</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 md:px-10 md:py-10"
      >
        <span class="quadrillage pointer-events-none absolute inset-0" />
        <LogoWatermark />

        <div class="relative flex flex-wrap items-center gap-5">
          <div class="min-w-0">
            <p
              class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50"
            >
              Tableau de bord
            </p>
            <h1
              class="mt-1.5 text-3xl font-light tracking-tight text-ink md:text-4xl"
            >
              Mes biens
            </h1>
            <p class="mt-1 text-ink/60">
              Compare, suis les prix, prends ta décision.
            </p>
          </div>
        </div>

        <dl class="relative mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div class="tuile rounded-2xl bg-white px-5 py-4" style="--i: 0">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-stone"
            >
              Biens suivis
            </dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">
              {{ stats.total }}
            </dd>
          </div>

          <div class="tuile rounded-2xl bg-white px-5 py-4" style="--i: 1">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-stone"
            >
              Fourchette
              <span class="font-normal normal-case"
                >({{ stats.rangeLabel }})</span
              >
            </dt>
            <dd
              v-if="stats.priceMax"
              class="mt-1.5 text-2xl font-light tabular-nums"
            >
              {{ formatNumber(stats.priceMin) }} – {{ formatNumber(stats.priceMax) }}
              <span class="text-base text-stone">€</span>
            </dd>
            <dd v-else class="mt-1.5 text-3xl font-light text-stone">—</dd>
          </div>

          <component
            :is="stats.best ? 'NuxtLink' : 'div'"
            :to="stats.best ? `/bien/${stats.best.bien.id}` : undefined"
            class="tuile group block rounded-2xl bg-white px-5 py-4"
            style="--i: 2"
          >
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-stone"
            >
              Meilleur score
            </dt>
            <dd v-if="stats.best" class="mt-1.5 flex items-baseline gap-2">
              <span class="text-3xl font-light tabular-nums">{{
                stats.best.score.total
              }}</span>
              <span
                class="text-sm font-medium"
                :class="stats.best.score.color"
                >{{ stats.best.score.label }}</span
              >
            </dd>
            <dd v-else class="mt-1.5 text-3xl font-light text-stone">—</dd>
            <p
              v-if="stats.best"
              class="truncate text-xs text-stone transition group-hover:text-ink"
            >
              {{ stats.best.bien.titre }}
            </p>
          </component>

          <div class="tuile rounded-2xl bg-white px-5 py-4" style="--i: 3">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-stone"
            >
              Coups de cœur
            </dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">
              {{ stats.favorites }}
            </dd>
          </div>
        </dl>
      </section>

      <UpcomingVisits :biens="biens" class="mt-6" />

      <div
        v-if="duplicateGroups.length"
        class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-deep/30 bg-brand-light px-4 py-3"
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-sm"
          >⧉</span
        >
        <p class="text-sm text-ink">
          <span class="font-semibold">
            {{ duplicateGroups.length }}
            bien{{ duplicateGroups.length > 1 ? "s" : "" }} en double
          </span>
          — la même annonce publiée sur plusieurs sites. Elles ne comptent
          qu’une fois dans le calcul du prix médian.
        </p>
      </div>

      <div
        class="barre sticky top-[4.5rem] z-20 mt-6 rounded-2xl border border-hairline-soft bg-white/85 backdrop-blur-xl md:top-3"
      >
        <div class="flex flex-wrap items-center gap-3 p-3">
          <div class="relative min-w-[200px] flex-1">
            <input
              v-model="search"
              type="search"
              placeholder="Rechercher un bien, une ville…"
              class="h-10 w-full rounded-full border border-hairline bg-surface-soft pl-10 pr-9 text-sm outline-none transition focus:border-blue focus:bg-white focus:ring-2 focus:ring-blue/20"
            />
            <svg
              class="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <button
              v-if="search"
              class="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-stone transition hover:bg-surface hover:text-ink"
              aria-label="Effacer la recherche"
              @click="search = ''"
            >
              ×
            </button>
          </div>

          <div
            class="segments relative flex w-full items-center rounded-full bg-surface p-1 sm:w-auto"
          >
            <span
              class="pastille absolute inset-y-1 rounded-full bg-ink"
              :style="{
                width: `calc((100% - 0.5rem) / ${VIEWS.length})`,
                transform: `translateX(calc(${VIEWS.findIndex(
                  (v) => v.value === viewMode
                )} * 100%))`,
              }"
            />
            <button
              v-for="v in VIEWS"
              :key="v.value"
              class="relative z-10 flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition"
              :class="
                viewMode === v.value ? 'text-white' : 'text-steel hover:text-ink'
              "
              @click="viewMode = v.value"
            >
              {{ v.label }}
            </button>
          </div>
        </div>

        <div
          class="flex flex-wrap items-center gap-3 border-t border-hairline-soft px-3 py-2.5"
        >
          <div
            class="filtres -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5"
          >
            <button
              class="filtre flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              :class="
                statusFilter === 'tous'
                  ? 'bg-ink text-white'
                  : 'border border-hairline bg-white text-steel hover:bg-surface'
              "
              @click="statusFilter = 'tous'"
            >
              Tous
              <span
                class="rounded-full px-1.5 text-[11px] tabular-nums"
                :class="statusFilter === 'tous' ? 'bg-white/20' : 'bg-surface'"
                >{{ counts.tous }}</span
              >
            </button>
            <button
              v-for="s in STATUSES"
              :key="s.value"
              class="filtre flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              :class="
                statusFilter === s.value
                  ? 'bg-ink text-white'
                  : 'border border-hairline bg-white text-steel hover:bg-surface'
              "
              @click="statusFilter = s.value"
            >
              {{ s.label }}
              <span
                class="rounded-full px-1.5 text-[11px] tabular-nums"
                :class="statusFilter === s.value ? 'bg-white/20' : 'bg-surface'"
                >{{ counts[s.value] }}</span
              >
            </button>
          </div>

          <button
            v-if="zone"
            class="filtre flex items-center gap-1.5 whitespace-nowrap rounded-full border border-blue/30 bg-blue/10 px-3.5 py-1.5 text-sm font-medium text-blue transition hover:bg-blue/15"
            @click="clearZone"
          >
            Zone de la carte active
            <span class="text-blue/70">✕</span>
          </button>

          <CommuteAnchorPicker class="ml-auto" />
        </div>
      </div>

      <div
        v-if="pending"
        class="mt-5 overflow-hidden rounded-2xl border border-hairline bg-white"
      >
        <div
          v-for="n in 6"
          :key="n"
          class="flex items-center gap-4 border-b border-hairline-soft px-5 py-4 last:border-0"
        >
          <span
            class="squelette size-11 shrink-0 rounded-lg"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
          <span
            class="squelette h-3 w-full max-w-48 rounded-full"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
          <span
            class="squelette ml-auto hidden h-3 w-20 rounded-full sm:block"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
          <span
            class="squelette h-6 w-16 shrink-0 rounded-full"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
        </div>
      </div>

      <div
        v-else-if="!counts.tous"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-20 text-center"
      >
        <div
          class="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-light text-ink"
        >
          <svg
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.6V20h14V9.6" />
            <path d="M10 20v-6h4v6" />
          </svg>
        </div>
        <p class="mt-4 text-lg font-medium text-ink-deep">
          Aucun bien pour l’instant
        </p>
        <p class="mx-auto mt-1 max-w-xs text-sm text-slate">
          Colle l’URL d’une annonce, Hovly extrait le reste automatiquement.
        </p>
        <NuxtLink
          to="/ajouter"
          class="mt-5 inline-flex rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          Ajouter mon premier bien
        </NuxtLink>
      </div>

      <div
        v-else-if="!displayedProperties.length"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-16 text-center"
      >
        <p class="text-slate">Aucun bien ne correspond à ce filtre.</p>
        <button
          class="mt-3 text-sm font-medium text-blue hover:underline"
          @click="
            search = '';
            statusFilter = 'tous';
            clearZone();
          "
        >
          Réinitialiser les filtres
        </button>
      </div>

      <div
        v-else-if="viewMode === 'map'"
        class="mt-5 flex flex-col gap-5 lg:flex-row lg:items-stretch"
      >
        <div class="min-w-0 lg:flex-1">
          <ClientOnly>
            <PropertyMap
              class="h-[70vh]"
              height="100%"
              :biens="displayedProperties"
              :selection="selection"
              :survole="hoveredId"
              :zone="zone"
              @select="selection = $event"
              @zone-changed="zone = $event"
            />
            <template #fallback>
              <div
                class="h-[70vh] animate-pulse rounded-2xl border border-hairline bg-white"
              />
            </template>
          </ClientOnly>
        </div>

        <PropertyGrid
          class="lg:h-[70vh] lg:w-[360px] lg:shrink-0 lg:overflow-y-auto"
          compact
          :biens="pagedProperties"
          :score="scoreOf"
          :monthly-price="monthlyPrice"
          :price-per-sqm="pricePerSqm"
          :page="page"
          :total="displayedProperties.length"
          :per-page="PER_PAGE"
          @update:page="page = $event"
          @supprimer="requestDelete"
          @survole="hoveredId = $event"
        />
      </div>

      <PropertyGrid
        v-else-if="viewMode === 'grid'"
        class="mt-5"
        :biens="pagedProperties"
        :score="scoreOf"
        :monthly-price="monthlyPrice"
        :price-per-sqm="pricePerSqm"
        :page="page"
        :total="displayedProperties.length"
        :per-page="PER_PAGE"
        @update:page="page = $event"
        @supprimer="requestDelete"
      />

      <PropertyList
        v-else
        class="mt-5"
        :biens="pagedProperties"
        :score="scoreOf"
        :doublons="duplicatesById"
        :sort-key="sortKey"
        :sort-asc="sortAsc"
        :page="page"
        :total="displayedProperties.length"
        :per-page="PER_PAGE"
        @sort="toggleSort"
        @update:page="page = $event"
        @supprimer="requestDelete"
        @statut="setStatus"
      />

      <Transition name="barre-cmp">
        <div
          v-if="compareCount"
          class="barre-cmp fixed inset-x-0 z-30 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-3 rounded-full border border-hairline bg-white/95 px-4 py-2.5 shadow-[0_12px_40px_rgba(5,0,56,0.16)] backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-3"
        >
          <span class="text-sm font-medium">
            {{ compareCount }} bien{{ compareCount > 1 ? "s" : "" }} sélectionné{{
              compareCount > 1 ? "s" : ""
            }}
            <span v-if="selectionComplete" class="text-stone"
              >(max atteint)</span
            >
          </span>
          <button
            class="text-sm font-medium text-steel transition hover:text-ink"
            @click="clearComparison"
          >
            Vider
          </button>
          <button
            class="rounded-full border border-hairline px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface"
            @click="shareOpen = true"
          >
            Partager
          </button>
          <NuxtLink
            :to="comparable ? '/comparer' : ''"
            class="rounded-full px-4 py-2 text-sm font-medium transition"
            :class="
              comparable
                ? 'bg-ink text-white hover:bg-black'
                : 'pointer-events-none bg-surface text-stone'
            "
          >
            Comparer
          </NuxtLink>
        </div>
      </Transition>

      <DeleteConfirmationModal
        :open="propertyToDelete !== null"
        title="Supprimer ce bien ?"
        :name="propertyToDelete?.titre"
        :subline="propertyToDelete?.ville"
        message="Le bien et son historique seront définitivement supprimés."
        :loading="deleting"
        @cancel="propertyToDelete = null"
        @confirm="confirmDelete"
      />

      <ShareModal
        :open="shareOpen"
        :property-count="compareCount"
        :loading="sharing"
        :error="shareError"
        :link="shareLink"
        @create="createShareLink"
        @close="closeShare"
      />
    </main>
  </div>
</template>

<style scoped>
.bandeau {
  opacity: 0;
  animation: monter 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.quadrillage {
  background-image: linear-gradient(
      to right,
      rgb(5 0 56 / 8%) 1px,
      transparent 1px
    ),
    linear-gradient(to bottom, rgb(5 0 56 / 8%) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: radial-gradient(circle at 20% 0%, black, transparent 80%);
}

.barre {
  box-shadow: 0 6px 24px rgb(5 0 56 / 5%);
}

.segments {
  min-width: 15rem;
}
.pastille {
  left: 0.25rem;
  transition: transform 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);
}

@keyframes monter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.tuile {
  opacity: 0;
  animation: monter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(0.15s + var(--i) * 0.07s);
}

.filtre:hover {
  transform: translateY(-1px);
}

.ajouter {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.3s ease;
}
.ajouter:hover {
  transform: translateY(-2px);
  background: #000;
}

.filtres {
  scrollbar-width: none;
}
.filtres::-webkit-scrollbar {
  display: none;
}

.squelette {
  display: block;
  background: linear-gradient(
    90deg,
    var(--color-hairline-soft) 0%,
    var(--color-hairline) 40%,
    var(--color-hairline-soft) 80%
  );
  background-size: 200% 100%;
  animation: scintiller 1.6s ease-in-out infinite;
}
@keyframes scintiller {
  to {
    background-position: -200% 0;
  }
}

.barre-cmp {
  bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
}
@media (min-width: 768px) {
  .barre-cmp {
    bottom: 1.5rem;
  }
}

.barre-cmp-enter-active,
.barre-cmp-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.barre-cmp-enter-from,
.barre-cmp-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .bandeau,
  .tuile {
    opacity: 1;
    animation: none;
  }
  .squelette {
    animation: none;
  }
  .pastille {
    transition: none;
  }
  .ajouter:hover,
  .filtre:hover {
    transform: none;
  }
}
</style>

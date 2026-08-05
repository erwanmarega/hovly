<script setup lang="ts">
import type { Bien, Statut } from "~/types";
import type { Score } from "~/composables/useScore";
import { STATUTS } from "~/composables/useBiens";

useHead({ title: "Mes biens — Hovly" });

const { biens, refresh, prixMensuel, prixM2, setStatut, supprimer } =
  useBiens();

const bienASupprimer = ref<Bien | null>(null);
const suppressionEnCours = ref(false);
const { annoncer: annoncerToast } = useToast();

function demanderSuppression(id: string) {
  bienASupprimer.value = biens.value.find((b) => b.id === id) ?? null;
}

async function confirmerSuppression() {
  const b = bienASupprimer.value;
  if (!b) return;
  suppressionEnCours.value = true;
  await supprimer(b.id);
  suppressionEnCours.value = false;
  bienASupprimer.value = null;
  // useBiens.supprimer restaure la liste en cas d'échec : si le bien est
  // encore là, la suppression a échoué.
  if (biens.value.some((x) => x.id === b.id)) {
    annoncerToast('Suppression impossible. Réessaie.', 'erreur');
  } else {
    annoncerToast(`« ${b.titre} » supprimé.`);
  }
}

const { pending } = useAsyncData("biens", () => refresh(), { server: false });

const VUES = [
  { value: "liste", label: "Liste" },
  { value: "grille", label: "Grille" },
  { value: "carte", label: "Carte" },
] as const;

const vue = ref<(typeof VUES)[number]["value"]>("liste");
const selection = ref<string | null>(null);

const filtreStatut = ref<Statut | "tous">("tous");
const recherche = ref("");
const triClef = ref<
  | "date"
  | "prix"
  | "surface"
  | "prix_m2"
  | "score"
  | "visite"
  | "cout_reel"
  | "trajet"
>("date");
const triAsc = ref(false);

const { preferences } = usePreferences();

const { calculer: coutDe } = useCoutReel();
const { retenu: trajetDe, refresh: refreshTrajets } = useTrajets();
useAsyncData("trajets-dashboard", () => refreshTrajets(), { server: false });

const trajetSec = (b: Bien) =>
  trajetDe(b.id)?.duree_s ?? Number.POSITIVE_INFINITY;

const contexteScore = computed(() => representants(biens.value));
const scoreDe = (b: Bien) => scoreBien(b, contexteScore.value, preferences.value);

const groupesDoublons = computed(() => grouperDoublons(biens.value.filter((b) => b.actif)));

const {
  nombre: nbCompares,
  complet: selectionComplete,
  comparable,
  vider: viderComparaison
} = useComparateur();
const doublonsParId = computed(() => {
  const map = new Map<string, number>();
  for (const groupe of groupesDoublons.value) {
    for (const b of groupe) map.set(b.id, groupe.length);
  }
  return map;
});

const biensAffiches = computed(() => {
  let list = biens.value.filter((b) => b.actif);

  if (filtreStatut.value !== "tous") {
    list = list.filter((b) => b.statut === filtreStatut.value);
  }

  const q = recherche.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (b) =>
        b.titre.toLowerCase().includes(q) ||
        b.ville.toLowerCase().includes(q) ||
        (b.adresse ?? "").toLowerCase().includes(q)
    );
  }

  const dir = triAsc.value ? 1 : -1;

  if (triClef.value === "trajet") {
    const avec = list.filter((b) => Number.isFinite(trajetSec(b)));
    const sans = list.filter((b) => !Number.isFinite(trajetSec(b)));
    avec.sort((a, b) => (trajetSec(a) - trajetSec(b)) * dir);
    return [...avec, ...sans];
  }

  if (triClef.value === "visite") {
    const avec = list.filter((b) => b.visite_le);
    const sans = list.filter((b) => !b.visite_le);
    avec.sort(
      (a, b) =>
        (new Date(a.visite_le!).getTime() - new Date(b.visite_le!).getTime()) *
        dir
    );
    return [...avec, ...sans];
  }

  return [...list].sort((a, b) => {
    let va: number;
    let vb: number;
    switch (triClef.value) {
      case "prix":
        va = a.prix;
        vb = b.prix;
        break;
      case "surface":
        va = a.surface;
        vb = b.surface;
        break;
      case "prix_m2":
        va = prixM2(a);
        vb = prixM2(b);
        break;
      case "score":
        va = scoreDe(a).total;
        vb = scoreDe(b).total;
        break;
      case "cout_reel":
        va = coutDe(a).total;
        vb = coutDe(b).total;
        break;
      default:
        va = new Date(a.created_at).getTime();
        vb = new Date(b.created_at).getTime();
    }
    return (va - vb) * dir;
  });
});

const PAR_PAGE = 12;
const page = ref(1);

const biensPage = computed(() =>
  biensAffiches.value.slice((page.value - 1) * PAR_PAGE, page.value * PAR_PAGE)
);

watch([recherche, filtreStatut, triClef, triAsc], () => {
  page.value = 1;
});

watch(biensAffiches, (liste) => {
  const nbPages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
  if (page.value > nbPages) page.value = nbPages;
});

const stats = computed(() => {
  const actifs = biens.value.filter((b) => b.actif);
  // La fourchette ne mélange pas loyers et prix de vente : locations en
  // priorité, achats seulement si la liste n'en contient que ça.
  const locations = actifs.filter((b) => !estAchat(b));
  const groupe = locations.length ? locations : actifs;
  const prix = groupe.map(prixMensuel).filter((p) => p > 0);
  const meilleur = actifs.reduce<{ score: Score; bien: Bien } | null>(
    (best, b) => {
      const score = scoreDe(b);
      return !best || score.total > best.score.total
        ? { score, bien: b }
        : best;
    },
    null
  );

  return {
    total: actifs.length,
    prixMin: prix.length ? Math.min(...prix) : 0,
    prixMax: prix.length ? Math.max(...prix) : 0,
    fourchetteLabel: locations.length ? "locations" : "achats",
    meilleur,
    coups: actifs.filter((b) => b.statut === "coup_de_coeur").length,
  };
});

const compteurs = computed(() => {
  const actifs = biens.value.filter((b) => b.actif);
  const parStatut = Object.fromEntries(
    STATUTS.map((s) => [s.value, 0])
  ) as Record<Statut, number>;
  for (const b of actifs) parStatut[b.statut]++;
  return { tous: actifs.length, ...parStatut };
});

function toggleTri(clef: typeof triClef.value) {
  if (triClef.value === clef) {
    triAsc.value = !triAsc.value;
  } else {
    triClef.value = clef;
    triAsc.value = false;
  }
}

const eur = (n: number) => n.toLocaleString("fr-FR");
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section
        class="bandeau relative isolate overflow-hidden rounded-feature bg-brand px-7 py-8 text-black md:px-10 md:py-10"
      >
        <span
          class="halo pointer-events-none absolute -right-24 -top-32 size-96 rounded-full bg-white/50 blur-3xl"
        />
        <span
          class="halo pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-brand-deep/40 blur-3xl"
          style="animation-delay: 3s"
        />
        <span class="quadrillage pointer-events-none absolute inset-0" />

        <div class="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p
              class="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50"
            >
              Tableau de bord
            </p>
            <h1 class="mt-2 text-4xl font-light tracking-tight md:text-5xl">
              Mes biens
            </h1>
            <p class="mt-2 max-w-sm text-ink/60">
              Compare, suis les prix, prends ta décision.
            </p>
          </div>
        </div>

        <dl
          class="tuiles relative mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink/10 lg:grid-cols-4"
        >
          <div class="tuile bg-white px-5 py-4" style="--i: 0">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              Biens suivis
            </dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">
              {{ stats.total }}
            </dd>
          </div>

          <div class="tuile bg-white px-5 py-4" style="--i: 1">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              Fourchette <span class="font-normal normal-case">({{ stats.fourchetteLabel }})</span>
            </dt>
            <dd
              v-if="stats.prixMax"
              class="mt-1.5 text-3xl font-light tabular-nums"
            >
              {{ eur(stats.prixMin) }}<span class="text-black"> – </span
              >{{ eur(stats.prixMax) }}
              <span class="text-lg text-black">€</span>
            </dd>
            <dd v-else class="mt-1.5 text-3xl font-light text-black">—</dd>
          </div>

          <component
            :is="stats.meilleur ? 'NuxtLink' : 'div'"
            :to="stats.meilleur ? `/bien/${stats.meilleur.bien.id}` : undefined"
            class="tuile group block bg-white px-5 py-4"
            style="--i: 2"
          >
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              Meilleur score
            </dt>
            <dd v-if="stats.meilleur" class="mt-1.5 flex items-baseline gap-2">
              <span class="text-3xl font-light tabular-nums">{{
                stats.meilleur.score.total
              }}</span>
              <span
                class="text-sm font-medium"
                :class="stats.meilleur.score.couleur"
                >{{ stats.meilleur.score.label }}</span
              >
            </dd>
            <dd v-else class="mt-1.5 text-3xl font-light text-stone">—</dd>
            <p
              v-if="stats.meilleur"
              class="truncate text-xs text-stone transition group-hover:text-ink"
            >
              {{ stats.meilleur.bien.titre }}
            </p>
          </component>

          <div class="tuile bg-white px-5 py-4" style="--i: 3">
            <dt
              class="text-[11px] font-semibold uppercase tracking-wider text-black"
            >
              Coups de cœur
            </dt>
            <dd class="mt-1.5 text-3xl font-light tabular-nums">
              {{ stats.coups }}
            </dd>
          </div>
        </dl>
      </section>

      <ProchainesVisites :biens="biens" class="mt-6" />

      <div
        v-if="groupesDoublons.length"
        class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-deep/30 bg-brand-light px-4 py-3"
      >
        <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-sm">⧉</span>
        <p class="text-sm text-ink">
          <span class="font-semibold">
            {{ groupesDoublons.length }}
            bien{{ groupesDoublons.length > 1 ? 's' : '' }} en double
          </span>
          — la même annonce publiée sur plusieurs sites. Elles ne comptent qu’une fois dans le
          calcul du prix médian.
        </p>
      </div>

      <div
        class="barre sticky top-[4.5rem] z-20 mt-6 md:top-3 flex flex-wrap items-center gap-3 rounded-2xl border border-hairline-soft bg-white/85 p-3 backdrop-blur-xl"
      >
        <div class="relative min-w-[200px] flex-1">
          <input
            v-model="recherche"
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
            v-if="recherche"
            class="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-stone transition hover:bg-surface hover:text-ink"
            aria-label="Effacer la recherche"
            @click="recherche = ''"
          >
            ×
          </button>
        </div>

        <div class="filtres -mx-1 flex w-full items-center gap-2 overflow-x-auto px-1 py-0.5 sm:w-auto">
          <button
            class="filtre flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
            :class="
              filtreStatut === 'tous'
                ? 'bg-ink text-white'
                : 'border border-hairline bg-white text-steel hover:bg-surface'
            "
            @click="filtreStatut = 'tous'"
          >
            Tous
            <span
              class="rounded-full px-1.5 text-[11px] tabular-nums"
              :class="filtreStatut === 'tous' ? 'bg-white/20' : 'bg-surface'"
              >{{ compteurs.tous }}</span
            >
          </button>
          <button
            v-for="s in STATUTS"
            :key="s.value"
            class="filtre flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
            :class="
              filtreStatut === s.value
                ? 'bg-ink text-white'
                : 'border border-hairline bg-white text-steel hover:bg-surface'
            "
            @click="filtreStatut = s.value"
          >
            {{ s.label }}
            <span
              class="rounded-full px-1.5 text-[11px] tabular-nums"
              :class="filtreStatut === s.value ? 'bg-white/20' : 'bg-surface'"
              >{{ compteurs[s.value] }}</span
            >
          </button>
        </div>

        <SelecteurAncreTrajet />

        <div
          class="segments relative flex w-full items-center rounded-full bg-surface p-1 sm:ml-auto sm:w-auto"
        >
          <span
            class="pastille absolute inset-y-1 rounded-full bg-ink"
            :style="{
              width: `calc((100% - 0.5rem) / ${VUES.length})`,
              transform: `translateX(calc(${VUES.findIndex(
                (v) => v.value === vue
              )} * 100%))`,
            }"
          />
          <button
            v-for="v in VUES"
            :key="v.value"
            class="relative z-10 flex-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition"
            :class="
              vue === v.value ? 'text-white' : 'text-steel hover:text-ink'
            "
            @click="vue = v.value"
          >
            {{ v.label }}
          </button>
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
        v-else-if="!compteurs.tous"
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
        v-else-if="!biensAffiches.length"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-16 text-center"
      >
        <p class="text-slate">Aucun bien ne correspond à ce filtre.</p>
        <button
          class="mt-3 text-sm font-medium text-blue hover:underline"
          @click="
            recherche = '';
            filtreStatut = 'tous';
          "
        >
          Réinitialiser les filtres
        </button>
      </div>

      <ClientOnly v-else-if="vue === 'carte'">
        <CarteBiens
          class="mt-5"
          :biens="biensAffiches"
          :selection="selection"
          @select="selection = $event"
        />
        <template #fallback>
          <div
            class="mt-5 h-[32rem] animate-pulse rounded-2xl border border-hairline bg-white"
          />
        </template>
      </ClientOnly>

      <div v-else-if="vue === 'grille'" class="mt-5">
        <div class="grille grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <CarteBien
            v-for="(b, i) in biensPage"
            :key="b.id"
            :bien="b"
            :score="scoreDe(b)"
            :prix-mensuel="prixMensuel(b)"
            :prix-m2="prixM2(b)"
            :style="{ '--i': i }"
            @supprimer="demanderSuppression"
          />
        </div>

        <PaginationListe
          class="mt-5 rounded-2xl border border-hairline-soft bg-white"
          :page="page"
          :total="biensAffiches.length"
          :par-page="PAR_PAGE"
          @update:page="page = $event"
        />
      </div>

      <ListeBiens
        v-else
        class="mt-5"
        :biens="biensPage"
        :score="scoreDe"
        :doublons="doublonsParId"
        :tri-clef="triClef"
        :tri-asc="triAsc"
        :page="page"
        :total="biensAffiches.length"
        :par-page="PAR_PAGE"
        @tri="toggleTri"
        @update:page="page = $event"
        @supprimer="demanderSuppression"
        @statut="setStatut"
      />

      <Transition name="barre-cmp">
        <div
          v-if="nbCompares"
          class="barre-cmp fixed inset-x-0 z-30 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-3 rounded-full border border-hairline bg-white/95 px-4 py-2.5 shadow-[0_12px_40px_rgba(5,0,56,0.16)] backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-3"
        >
          <span class="text-sm font-medium">
            {{ nbCompares }} bien{{ nbCompares > 1 ? 's' : '' }} sélectionné{{ nbCompares > 1 ? 's' : '' }}
            <span v-if="selectionComplete" class="text-stone">(max atteint)</span>
          </span>
          <button
            class="text-sm font-medium text-steel transition hover:text-ink"
            @click="viderComparaison"
          >
            Vider
          </button>
          <NuxtLink
            :to="comparable ? '/comparer' : ''"
            class="rounded-full px-4 py-2 text-sm font-medium transition"
            :class="comparable ? 'bg-ink text-white hover:bg-black' : 'pointer-events-none bg-surface text-stone'"
          >
            Comparer
          </NuxtLink>
        </div>
      </Transition>

      <ModalSuppressionBien
        :ouvert="bienASupprimer !== null"
        :bien="bienASupprimer"
        :en-cours="suppressionEnCours"
        @annuler="bienASupprimer = null"
        @confirmer="confirmerSuppression"
      />
    </main>
  </div>
</template>

<style scoped>
.bandeau {
  opacity: 0;
  animation: monter 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.halo {
  animation: respirer 9s ease-in-out infinite;
}
@keyframes respirer {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.9;
  }
  50% {
    transform: translate(-18px, 16px) scale(1.08);
    opacity: 1;
  }
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

.filtre:hover {
  transform: translateY(-1px);
}

.grille > * {
  opacity: 0;
  animation: monter 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--i) * 0.05s);
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
  transition:
    opacity 0.3s ease,
    transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.barre-cmp-enter-from,
.barre-cmp-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

@media (prefers-reduced-motion: reduce) {
  .bandeau,
  .tuile,
  .grille > * {
    opacity: 1;
    animation: none;
  }
  .halo,
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

<script setup lang="ts">
import type { Bien, Statut } from "~/types";
import type { Score } from "~/composables/useScore";
import { STATUTS } from "~/composables/useBiens";

useHead({ title: "Mes biens — Hovly" });

const { biens, refresh, prixMensuel, prixM2, setStatut, supprimer } =
  useBiens();

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
const triClef = ref<"date" | "prix" | "surface" | "prix_m2" | "score">("date");
const triAsc = ref(false);

const { preferences } = usePreferences();

const contexteScore = computed(() => representants(biens.value));
const scoreDe = (b: Bien) => scoreBien(b, contexteScore.value, preferences.value);

const groupesDoublons = computed(() => grouperDoublons(biens.value.filter((b) => b.actif)));

const {
  nombre: nbCompares,
  complet: selectionComplete,
  comparable,
  estSelectionne,
  basculer,
  vider: viderComparaison
} = useComparateur();
const doublonsParId = computed(() => {
  const map = new Map<string, number>();
  for (const groupe of groupesDoublons.value) {
    for (const b of groupe) map.set(b.id, groupe.length);
  }
  return map;
});

const sourceLabels: Record<string, string> = {
  seloger: "SeLoger",
  leboncoin: "Leboncoin",
  pap: "PAP",
  "logic-immo": "Logic-Immo",
  bienici: "BienIci",
};

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
  const loyers = actifs.map(prixMensuel).filter((p) => p > 0);
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
    loyerMin: loyers.length ? Math.min(...loyers) : 0,
    loyerMax: loyers.length ? Math.max(...loyers) : 0,
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

const menuOuvert = ref<string | null>(null);
function choisirStatut(id: string, s: Statut) {
  setStatut(id, s);
  menuOuvert.value = null;
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-7xl px-6 py-8">
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
              Fourchette
            </dt>
            <dd
              v-if="stats.loyerMax"
              class="mt-1.5 text-3xl font-light tabular-nums"
            >
              {{ eur(stats.loyerMin) }}<span class="text-black"> – </span
              >{{ eur(stats.loyerMax) }}
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
        class="barre sticky top-3 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-hairline-soft bg-white/85 p-3 backdrop-blur-xl"
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

        <div class="flex items-center gap-2 overflow-x-auto">
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

        <div
          class="segments relative ml-auto flex items-center rounded-full bg-surface p-1"
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
            class="squelette h-3 w-48 rounded-full"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
          <span
            class="squelette ml-auto h-3 w-20 rounded-full"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
          <span
            class="squelette h-6 w-16 rounded-full"
            :style="{ animationDelay: `${n * 0.1}s` }"
          />
        </div>
      </div>

      <div
        v-else-if="!compteurs.tous"
        class="mt-5 rounded-feature border border-hairline-soft bg-white py-20 text-center"
      >
        <div
          class="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-light text-2xl"
        >
          🏠
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
            @supprimer="supprimer"
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

      <div
        v-else
        class="mt-5 overflow-hidden rounded-feature border border-hairline-soft bg-white shadow-[0_1px_2px_rgba(5,0,56,0.04)]"
      >
        <div class="overflow-x-auto">
          <table class="w-full min-w-[920px] text-left text-sm">
            <thead class="bg-surface-soft">
              <tr
                class="border-b border-hairline-soft text-[11px] font-semibold uppercase tracking-wider text-stone"
              >
                <th class="w-10 px-5 py-3" />
                <th class="px-5 py-3 font-semibold">Bien</th>
                <th
                  class="cursor-pointer px-5 py-3 font-semibold hover:text-ink"
                  @click="toggleTri('prix')"
                >
                  Loyer
                  <span v-if="triClef === 'prix'">{{
                    triAsc ? "↑" : "↓"
                  }}</span>
                </th>
                <th
                  class="cursor-pointer px-5 py-3 font-semibold hover:text-ink"
                  @click="toggleTri('surface')"
                >
                  m²
                  <span v-if="triClef === 'surface'">{{
                    triAsc ? "↑" : "↓"
                  }}</span>
                </th>
                <th
                  class="cursor-pointer px-5 py-3 font-semibold hover:text-ink"
                  @click="toggleTri('prix_m2')"
                >
                  €/m²
                  <span v-if="triClef === 'prix_m2'">{{
                    triAsc ? "↑" : "↓"
                  }}</span>
                </th>
                <th class="px-5 py-3 font-semibold">Pièces</th>
                <th class="px-5 py-3 font-semibold">DPE</th>
                <th
                  class="cursor-pointer px-5 py-3 font-semibold hover:text-ink"
                  @click="toggleTri('score')"
                >
                  Score
                  <span v-if="triClef === 'score'">{{
                    triAsc ? "↑" : "↓"
                  }}</span>
                </th>
                <th class="px-5 py-3 font-semibold">Statut</th>
                <th class="px-5 py-3 font-semibold">Note</th>
                <th class="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(b, i) in biensPage"
                :key="b.id"
                class="ligne border-b border-hairline-soft transition last:border-0 hover:bg-surface-soft"
                :style="{ '--i': i }"
              >
                <td class="px-5 py-3">
                  <input
                    type="checkbox"
                    class="size-4 cursor-pointer accent-ink"
                    :checked="estSelectionne(b.id)"
                    :disabled="!estSelectionne(b.id) && selectionComplete"
                    :aria-label="`Comparer ${b.titre}`"
                    @change="basculer(b.id)"
                  >
                </td>
                <td class="px-5 py-3">
                  <NuxtLink
                    :to="`/bien/${b.id}`"
                    class="flex items-center gap-3 group"
                  >
                    <img
                      v-if="b.photos?.[0]"
                      :src="b.photos[0]"
                      :alt="b.titre"
                      class="size-11 shrink-0 rounded-lg object-cover bg-surface"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="size-11 shrink-0 rounded-lg bg-surface"
                    />
                    <div class="min-w-0">
                      <p
                        class="truncate font-medium text-ink max-w-[220px] group-hover:text-blue transition"
                      >
                        {{ b.titre }}
                      </p>
                      <p class="flex items-center gap-1.5 text-xs text-stone">
                        {{ b.ville }} ·
                        <span class="text-steel">{{
                          sourceLabels[b.site_source]
                        }}</span>
                        <span
                          v-if="doublonsParId.get(b.id)"
                          class="rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d1c]"
                          :title="`Ce bien apparaît sur ${doublonsParId.get(b.id)} annonces`"
                        >
                          ×{{ doublonsParId.get(b.id) }}
                        </span>
                      </p>
                    </div>
                  </NuxtLink>
                </td>
                <td
                  class="whitespace-nowrap px-5 py-3 font-semibold tabular-nums"
                >
                  {{ eur(prixMensuel(b)) }} €
                </td>
                <td class="whitespace-nowrap px-5 py-3 tabular-nums text-slate">
                  {{ b.surface }} m²
                </td>
                <td class="whitespace-nowrap px-5 py-3 tabular-nums text-slate">
                  {{ eur(prixM2(b)) }} €
                </td>
                <td class="whitespace-nowrap px-5 py-3 tabular-nums text-slate">
                  {{ b.nb_pieces }}p
                </td>
                <td class="px-5 py-3"><BadgeDPE :dpe="b.dpe" /></td>
                <td class="px-5 py-3 whitespace-nowrap">
                  <ScoreBien :score="scoreDe(b)" />
                </td>
                <td class="px-5 py-3">
                  <div class="relative">
                    <button
                      @click="menuOuvert = menuOuvert === b.id ? null : b.id"
                    >
                      <BadgeStatut :statut="b.statut" />
                    </button>
                    <div
                      v-if="menuOuvert === b.id"
                      class="absolute z-10 mt-1 w-44 rounded-xl border border-hairline bg-white p-1 shadow-lg"
                    >
                      <button
                        v-for="s in STATUTS"
                        :key="s.value"
                        class="block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-surface"
                        :class="
                          b.statut === s.value
                            ? 'font-semibold text-ink'
                            : 'text-slate'
                        "
                        @click="choisirStatut(b.id, s.value)"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3">
                  <span
                    class="block max-w-[160px] truncate text-slate"
                    :title="b.note_perso ?? ''"
                  >
                    {{ b.note_perso || "—" }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <a
                      :href="b.url_source"
                      target="_blank"
                      rel="noopener"
                      class="grid size-8 place-items-center rounded-lg text-stone hover:bg-surface hover:text-ink transition"
                      title="Voir l'annonce"
                    >
                      <svg
                        class="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                        />
                        <path d="M15 3h6v6" />
                        <path d="M10 14 21 3" />
                      </svg>
                    </a>
                    <button
                      class="grid size-8 place-items-center rounded-lg text-stone hover:bg-coral hover:text-[#600000] transition"
                      title="Supprimer"
                      @click="supprimer(b.id)"
                    >
                      <svg
                        class="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <path
                          d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                        />
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
          :total="biensAffiches.length"
          :par-page="PAR_PAGE"
          @update:page="page = $event"
        />
      </div>
      <Transition name="barre-cmp">
        <div
          v-if="nbCompares"
          class="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-fit items-center gap-4 rounded-full border border-hairline bg-white/95 px-5 py-3 shadow-[0_12px_40px_rgba(5,0,56,0.16)] backdrop-blur-xl"
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
  .grille > *,
  .ligne {
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

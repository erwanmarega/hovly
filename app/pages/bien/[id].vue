<script setup lang="ts">
import type { Bien, Statut } from "~/types";
import { STATUTS } from "~/composables/useBiens";

const route = useRoute();
const id = route.params.id as string;

const {
  data: bien,
  pending,
  error,
} = await useAsyncData(`bien-${id}`, () => $fetch<Bien>(`/api/biens/${id}`), {
  server: false,
});

const { data: historique } = await useAsyncData(
  `historique-${id}`,
  () =>
    $fetch<{ prix: number; controle_le: string }[]>(
      `/api/biens/${id}/historique`
    ),
  { server: false, default: () => [] }
);

useHead({
  title: () => (bien.value ? `${bien.value.titre} — Hovly` : "Bien — Hovly"),
});

const sourceLabels: Record<string, string> = {
  seloger: "SeLoger",
  leboncoin: "Leboncoin",
  pap: "PAP",
  "logic-immo": "Logic-Immo",
  bienici: "BienIci",
  century21: "Century 21",
};

const { biens, refresh: refreshBiens } = useBiens();
const { preferences } = usePreferences();
useAsyncData("biens-ctx", () => refreshBiens(), { server: false });

const { refresh: refreshTrajets } = useTrajets();
useAsyncData("trajets-bien", () => refreshTrajets(), { server: false });
const score = computed(() =>
  bien.value
    ? scoreBien(bien.value, representants(biens.value), preferences.value)
    : null
);

const doublons = computed(() =>
  bien.value ? doublonsDe(bien.value, biens.value) : []
);

const filAriane = computed(() => [
  { label: "Mes biens", to: "/dashboard" },
  { label: bien.value?.titre ?? "Bien" },
]);

const photoActive = ref(0);

const prixMensuel = computed(() =>
  bien.value ? Math.round(bien.value.prix / 100) : 0
);
const charges = computed(() =>
  bien.value?.charges ? Math.round(bien.value.charges / 100) : 0
);
const prixM2 = computed(() =>
  bien.value?.surface
    ? Math.round(bien.value.prix / 100 / bien.value.surface)
    : 0
);
const eur = (n: number) => n.toLocaleString("fr-FR");

const dateAjout = computed(() =>
  bien.value
    ? new Date(bien.value.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : ""
);

function patcher(patch: Partial<Bien>) {
  if (bien.value) bien.value = { ...bien.value, ...patch };
}

const menuStatut = ref(false);
async function setStatut(s: Statut) {
  menuStatut.value = false;
  if (!bien.value) return;
  const prev = bien.value.statut;
  patcher({ statut: s });
  try {
    await $fetch(`/api/biens/${id}`, { method: "PATCH", body: { statut: s } });
  } catch {
    patcher({ statut: prev });
  }
}

const appliquerVisite = patcher;

const afficherChecklist = computed(() => {
  const b = bien.value;
  if (!b) return false;
  return (
    !!b.visite_le ||
    b.statut === "visite" ||
    b.statut === "planifie" ||
    !!b.compte_rendu ||
    bilanVisite(b.checklist).remplis > 0
  );
});

const blocChecklist = ref<HTMLElement | null>(null);
watch(afficherChecklist, (visible, avant) => {
  if (!visible || avant) return;
  nextTick(() => {
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    blocChecklist.value?.scrollIntoView({
      behavior: doux ? "smooth" : "auto",
      block: "start",
    });
  });
});

const noteDraft = ref("");
watchEffect(() => {
  noteDraft.value = bien.value?.note_perso ?? "";
});
const noteSaved = ref(false);
async function saveNote() {
  if (!bien.value || noteDraft.value === (bien.value.note_perso ?? "")) return;
  await $fetch(`/api/biens/${id}`, {
    method: "PATCH",
    body: { note_perso: noteDraft.value },
  });
  patcher({ note_perso: noteDraft.value });
  noteSaved.value = true;
  setTimeout(() => (noteSaved.value = false), 1500);
}

const LIBELLES_CHAMPS: Record<string, string> = {
  titre: "titre",
  prix: "loyer",
  surface: "surface",
  nb_pieces: "pièces",
  etage: "étage",
  charges: "charges",
  dpe: "DPE",
  adresse: "adresse",
  ville: "ville",
  code_postal: "code postal",
  photos: "photos",
  description: "description",
};

const rafraichissement = ref(false);
const messageRefresh = ref("");
const refreshErreur = ref(false);

async function rafraichir() {
  rafraichissement.value = true;
  messageRefresh.value = "";
  refreshErreur.value = false;
  try {
    const r = await $fetch<{
      indisponible: boolean;
      changements: { champ: string; avant: unknown; apres: unknown }[];
      bien: Bien;
    }>(`/api/biens/${id}/refresh`, { method: "POST" });

    bien.value = r.bien;
    if (r.indisponible) {
      refreshErreur.value = true;
      messageRefresh.value = "L’annonce n’est plus en ligne — bien archivé.";
    } else if (!r.changements.length) {
      messageRefresh.value = "Aucun changement : les données étaient à jour.";
    } else {
      const noms = r.changements.map((c) => LIBELLES_CHAMPS[c.champ] ?? c.champ);
      messageRefresh.value = `Mis à jour : ${noms.join(", ")}.`;
    }
  } catch (e: unknown) {
    refreshErreur.value = true;
    messageRefresh.value = messageErreur(e, "Rafraîchissement impossible.");
  } finally {
    rafraichissement.value = false;
  }
}

const deleting = ref(false);
async function supprimer() {
  if (!confirm("Supprimer ce bien ?")) return;
  deleting.value = true;
  await $fetch(`/api/biens/${id}`, { method: "DELETE" });
  await navigateTo("/dashboard");
}
</script>

<template>
  <div class="min-h-screen bg-surface text-ink antialiased">
    <TheNavbar width="max-w-7xl" />

    <main class="mx-auto max-w-5xl px-6 py-8">
      <FilAriane class="mb-5" :items="filAriane" />

      <div v-if="pending" class="py-24 text-center">
        <div
          class="mx-auto size-7 animate-spin rounded-full border-2 border-hairline border-t-ink"
        />
      </div>

      <div v-else-if="error || !bien" class="py-24 text-center">
        <p class="text-slate">Bien introuvable.</p>
        <NuxtLink
          to="/dashboard"
          class="mt-3 inline-block text-sm font-medium text-blue hover:underline"
        >
          Retour au tableau
        </NuxtLink>
      </div>

      <template v-else>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-3">
              <BadgeStatut :statut="bien.statut" />
              <span class="text-xs font-medium text-stone">
                {{ sourceLabels[bien.site_source] }} · ajouté le {{ dateAjout }}
              </span>
            </div>
            <h1 class="mt-2 text-3xl font-bold tracking-tight text-ink-deep">
              {{ bien.titre }}
            </h1>
            <p class="mt-1 text-slate">
              {{
                [bien.adresse, bien.ville, bien.code_postal]
                  .filter(Boolean)
                  .join(", ")
              }}
            </p>
          </div>
          <div class="flex w-full shrink-0 flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
            <a
              :href="bien.url_source"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black transition"
            >
              Voir l'annonce
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
              :disabled="rafraichissement"
              class="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-steel hover:bg-surface hover:text-ink transition disabled:opacity-60"
              title="Relancer l’extraction depuis l’annonce"
              @click="rafraichir"
            >
              <span
                v-if="rafraichissement"
                class="size-4 animate-spin rounded-full border-2 border-hairline border-t-ink"
              />
              <svg
                v-else
                class="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
              {{ rafraichissement ? "Rafraîchissement…" : "Rafraîchir" }}
            </button>
            <button
              :disabled="deleting"
              class="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-white px-5 py-2.5 text-sm font-medium text-steel hover:bg-coral hover:text-[#600000] transition disabled:opacity-60"
              @click="supprimer"
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
                <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              {{ deleting ? "Suppression…" : "Supprimer ce bien" }}
            </button>
          </div>
        </div>

        <Transition name="msg">
          <p
            v-if="messageRefresh"
            class="mt-4 rounded-2xl border px-4 py-3 text-sm"
            :class="
              refreshErreur
                ? 'border-coral bg-coral/20 text-[#600000]'
                : 'border-teal-deep/30 bg-teal/30 text-[#0a4a42]'
            "
          >
            {{ messageRefresh }}
          </p>
        </Transition>

        <div class="mt-6 grid items-stretch gap-6 lg:grid-cols-5">
          <div class="flex flex-col lg:col-span-3">
            <div
              v-if="bien.photos.length"
              class="overflow-hidden rounded-2xl border border-hairline bg-white"
            >
              <img
                :src="bien.photos[photoActive]"
                :alt="bien.titre"
                class="aspect-[4/3] w-full object-cover"
              >
              <div
                v-if="bien.photos.length > 1"
                class="flex gap-2 overflow-x-auto p-3"
              >
                <button
                  v-for="(p, i) in bien.photos"
                  :key="i"
                  class="size-16 shrink-0 overflow-hidden rounded-lg border-2 transition"
                  :class="
                    i === photoActive
                      ? 'border-ink'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  "
                  @click="photoActive = i"
                >
                  <img :src="p" alt="" class="size-full object-cover" >
                </button>
              </div>
            </div>
            <div
              v-else
              class="grid aspect-[4/3] place-items-center rounded-2xl border border-hairline bg-white text-stone"
            >
              Aucune photo
            </div>

            <div class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  Surface
                </p>
                <p class="mt-1 text-xl font-bold">{{ bien.surface }} m²</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  Pièces
                </p>
                <p class="mt-1 text-xl font-bold">{{ bien.nb_pieces }}</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  Étage
                </p>
                <p class="mt-1 text-xl font-bold">{{ bien.etage ?? "—" }}</p>
              </div>
              <div class="rounded-2xl border border-hairline-soft bg-white p-4">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-stone"
                >
                  DPE
                </p>
                <div class="mt-1"><BadgeDPE :dpe="bien.dpe" /></div>
              </div>
            </div>

            <div
              v-if="bien.lat != null && bien.lon != null"
              class="mt-6 flex min-h-0 flex-col rounded-2xl border border-hairline bg-white p-6"
              :class="bien.description ? '' : 'flex-1'"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold">Situation</h2>
                <span v-if="bien.geo_precision === 'ville'" class="text-xs text-stone">
                  Position approximative
                </span>
              </div>
              <ClientOnly>
                <div class="mt-3 min-h-64 flex-1">
                  <CarteBiens class="h-full" :biens="[bien]" hauteur="100%" />
                </div>
                <template #fallback>
                  <div
                    class="mt-3 min-h-64 flex-1 animate-pulse rounded-2xl border border-hairline bg-surface"
                  />
                </template>
              </ClientOnly>
            </div>

            <div
              v-if="bien.description"
              class="mt-6 flex-1 rounded-2xl border border-hairline bg-white p-6"
            >
              <h2 class="text-lg font-semibold">Description</h2>
              <p
                class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate"
              >
                {{ bien.description }}
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-6 lg:col-span-2">
            <div class="rounded-2xl border border-hairline bg-white p-6">
              <p class="text-3xl font-bold tracking-tight">
                {{ eur(prixMensuel) }} €<span
                  class="text-base font-medium text-stone"
                >
                  /mois</span
                >
              </p>
              <div class="mt-4 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-steel">Prix au m²</span>
                  <span class="font-semibold">{{ eur(prixM2) }} €</span>
                </div>
                <div v-if="charges" class="flex justify-between">
                  <span class="text-steel">Charges</span>
                  <span class="font-semibold">{{ eur(charges) }} €</span>
                </div>
              </div>
            </div>

            <CoutReel :bien="bien" />

            <TrajetsBien :bien="bien" />

            <ScoreBreakdown v-if="score" :score="score" />

            <div
              v-if="doublons.length"
              class="rounded-2xl border border-brand-deep/30 bg-brand-light p-6"
            >
              <h2 class="text-sm font-semibold uppercase tracking-wide text-[#8a6d1c]">
                Aussi publié ailleurs
              </h2>
              <p class="mt-1 text-xs text-ink/60">
                Hovly a repéré {{ doublons.length }} autre{{ doublons.length > 1 ? 's' : '' }}
                annonce{{ doublons.length > 1 ? 's' : '' }} du même bien.
              </p>
              <ul class="mt-4 space-y-2">
                <li v-for="d in doublons" :key="d.id">
                  <NuxtLink
                    :to="`/bien/${d.id}`"
                    class="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 transition hover:bg-white"
                  >
                    <LogoSource :source="d.site_source" :avec-nom="false" :taille="20" />
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-ink">
                        {{ sourceLabels[d.site_source] }}
                      </span>
                      <span class="block truncate text-xs text-stone">{{ d.titre }}</span>
                    </span>
                    <span class="shrink-0 text-sm font-semibold tabular-nums">
                      {{ eur(Math.round(d.prix / 100)) }} €
                      <span
                        v-if="d.prix < bien.prix"
                        class="ml-1 rounded-full bg-teal/60 px-1.5 py-0.5 text-[10px] font-bold text-[#0a4a42]"
                      >moins cher</span>
                    </span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <PlanificateurVisite :bien="bien" @maj="appliquerVisite" />

            <div class="rounded-2xl border border-hairline bg-white p-6">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">
                Statut
              </h2>
              <div class="relative mt-3">
                <button
                  class="flex w-full items-center justify-between rounded-lg border border-hairline px-4 py-2.5 text-left transition hover:bg-surface"
                  @click="menuStatut = !menuStatut"
                >
                  <BadgeStatut :statut="bien.statut" />
                  <svg
                    class="size-4 text-stone"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  v-if="menuStatut"
                  class="absolute z-10 mt-1 w-full rounded-xl border border-hairline bg-white p-1 shadow-lg"
                >
                  <button
                    v-for="s in STATUTS"
                    :key="s.value"
                    class="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface"
                    :class="
                      bien.statut === s.value ? 'font-semibold text-ink' : 'text-slate'
                    "
                    @click="setStatut(s.value)"
                  >
                    {{ s.label }}
                  </button>
                </div>
              </div>
            </div>

            <div
              class="flex flex-1 flex-col rounded-2xl border border-hairline bg-white p-6"
            >
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-stone">
                  Ma note
                </h2>
                <span v-if="noteSaved" class="text-xs font-medium text-success">
                  Enregistré
                </span>
              </div>
              <textarea
                v-model="noteDraft"
                rows="4"
                placeholder="Quartier, points forts, points faibles…"
                class="mt-3 min-h-24 w-full flex-1 resize-none rounded-lg border border-hairline-strong bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/20"
                @blur="saveNote"
              />
            </div>
          </div>
        </div>

        <PrixHistorique :points="historique" class="mt-6" />

        <Transition name="bloc">
          <div v-if="afficherChecklist" ref="blocChecklist" class="scroll-mt-24">
            <ChecklistVisite :bien="bien" class="mt-6" @maj="appliquerVisite" />
          </div>
        </Transition>
      </template>
    </main>
  </div>
</template>

<style scoped>
.bloc-enter-active,
.bloc-leave-active {
  transition:
    opacity 0.35s ease,
    transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}
.bloc-enter-from,
.bloc-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.msg-enter-active,
.msg-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.msg-enter-from,
.msg-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .msg-enter-active,
  .msg-leave-active,
  .bloc-enter-active,
  .bloc-leave-active {
    transition: none;
  }
}
</style>

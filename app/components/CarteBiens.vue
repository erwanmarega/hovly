<script setup lang="ts">
import "leaflet/dist/leaflet.css";
import type {
  Circle,
  CircleMarker,
  LatLng,
  LeafletMouseEvent,
  Map as LeafletMap,
} from "leaflet";
import type { Bien } from "~/types";
import type { ZoneCarte } from "~/composables/useZoneCarte";

const props = withDefaults(
  defineProps<{
    biens: Bien[];
    selection?: string | null;
    survole?: string | null;
    hauteur?: string;
    zoomBien?: number;
    zone?: ZoneCarte | null;
  }>(),
  { selection: null, survole: null, hauteur: "32rem", zoomBien: 15, zone: null }
);

const emit = defineEmits<{
  select: [id: string];
  "zone-changee": [zone: ZoneCarte | null];
}>();

const conteneur = ref<HTMLElement | null>(null);
const { biens: contexte } = useBiens();

let carte: LeafletMap | null = null;
let observateur: ResizeObserver | null = null;
let couche: (CircleMarker | Circle)[] = [];
const marqueurs = new Map<string, CircleMarker>();

const RAYON_BASE = 9;
const RAYON_SURVOLE = 14;

const modeDessin = ref(false);
let cercleZone: Circle | null = null;
let debutDessin: LatLng | null = null;
/** En dessous, le rayon est trop petit pour être une zone voulue — on l'ignore. */
const RAYON_MIN_M = 50;

const localises = computed(() =>
  props.biens.filter((b) => b.lat != null && b.lon != null)
);
const sansPosition = computed(
  () => props.biens.length - localises.value.length
);

const SENSIBILITE_ZOOM = 0.2;
const ZOOM_MAX_PAR_EVENEMENT = 1.2;
const PIXELS_PAR_LIGNE = 16;

function zoomerAuPincement(e: WheelEvent) {
  if (!carte || !e.ctrlKey) return;

  e.preventDefault();

  const pixels = e.deltaMode === 1 ? e.deltaY * PIXELS_PAR_LIGNE : e.deltaY;
  const variation = Math.max(
    -ZOOM_MAX_PAR_EVENEMENT,
    Math.min(ZOOM_MAX_PAR_EVENEMENT, pixels * SENSIBILITE_ZOOM)
  );
  const point = carte.mouseEventToContainerPoint(e);

  carte.setZoomAround(
    carte.containerPointToLatLng(point),
    carte.getZoom() - variation
  );
}

function echapper(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );
}

function popup(b: Bien): string {
  const prix = b.prix
    ? `${formaterNombre(Math.round(b.prix / 100))} €${estAchat(b) ? "" : "/mois"}`
    : "Prix inconnu";
  const m2 = prixAuM2(b) ? ` · ${formaterNombre(prixAuM2(b)!)} €/m²` : "";
  const approx =
    b.geo_precision === "ville"
      ? '<div class="mt-1 text-stone">Position approximative</div>'
      : "";
  return `
    <div class="text-sm">
      <a href="/bien/${
        b.id
      }" class="font-semibold text-ink hover:underline">${echapper(
    b.titre ?? "Sans titre"
  )}</a>
      <div class="mt-1 text-slate">${prix}${m2}</div>
      <div class="text-stone">${echapper(
        [b.ville, b.code_postal].filter(Boolean).join(" ")
      )}</div>
      ${approx}
    </div>`;
}

async function dessiner() {
  if (!carte) return;
  const L = await import("leaflet");

  couche.forEach((c) => c.remove());
  couche = [];
  marqueurs.clear();

  for (const b of localises.value) {
    const total = scoreBien(b, contexte.value).total;
    const couleur = couleurScore(total);

    if (b.geo_precision === "ville") {
      couche.push(
        L.circle([b.lat!, b.lon!], {
          radius: 700,
          color: couleur,
          weight: 1,
          dashArray: "4 4",
          fillColor: couleur,
          fillOpacity: 0.08,
        }).addTo(carte)
      );
    }

    const m = L.circleMarker([b.lat!, b.lon!], {
      radius: RAYON_BASE,
      color: "#ffffff",
      weight: 2,
      fillColor: couleur,
      fillOpacity: 0.95,
    })
      .bindPopup(popup(b))
      .addTo(carte);

    m.on("click", () => emit("select", b.id));
    marqueurs.set(b.id, m);
    couche.push(m);
  }

  if (props.survole) marqueurs.get(props.survole)?.setRadius(RAYON_SURVOLE);

  if (localises.value.length === 1) {
    const seul = localises.value[0]!;
    carte.setView([seul.lat!, seul.lon!], props.zoomBien);
  } else if (localises.value.length > 1) {
    carte.fitBounds(
      L.latLngBounds(
        localises.value.map((b) => [b.lat!, b.lon!] as [number, number])
      ),
      { padding: [40, 40], maxZoom: 14 }
    );
  }
}

async function dessinerZone() {
  if (!carte) return;
  const L = await import("leaflet");

  cercleZone?.remove();
  cercleZone = null;
  if (!props.zone) return;

  cercleZone = L.circle([props.zone.lat, props.zone.lon], {
    radius: props.zone.rayonM,
    color: "#2563eb",
    weight: 2,
    fillColor: "#2563eb",
    fillOpacity: 0.08,
  }).addTo(carte);
}

function annulerDessin() {
  window.removeEventListener("mouseup", surRelacheGlobale);
  carte?.dragging.enable();
  debutDessin = null;
}

async function surRelacheGlobale() {
  // Le relâchement a eu lieu hors de la carte : le mouseup de Leaflet ne
  // s'est jamais déclenché. On annule le tracé et on réaffiche la zone active
  // (ou son absence) telle qu'elle était avant ce geste avorté.
  if (!debutDessin) return;
  modeDessin.value = false;
  annulerDessin();
  await dessinerZone();
}

async function surAppui(e: LeafletMouseEvent) {
  if (!modeDessin.value || !carte) return;
  const L = await import("leaflet");

  debutDessin = e.latlng;
  cercleZone?.remove();
  cercleZone = L.circle(e.latlng, {
    radius: 0,
    color: "#2563eb",
    weight: 2,
    fillColor: "#2563eb",
    fillOpacity: 0.08,
  }).addTo(carte);
  carte.dragging.disable();
  window.addEventListener("mouseup", surRelacheGlobale);
}

function surDeplacement(e: LeafletMouseEvent) {
  if (!debutDessin || !carte || !cercleZone) return;
  cercleZone.setRadius(carte.distance(debutDessin, e.latlng));
}

function surRelache(e: LeafletMouseEvent) {
  if (!debutDessin || !carte || !cercleZone) return;
  const rayon = carte.distance(debutDessin, e.latlng);
  const zoneFinale: ZoneCarte | null =
    rayon >= RAYON_MIN_M
      ? { lat: debutDessin.lat, lon: debutDessin.lng, rayonM: Math.round(rayon) }
      : null;

  if (!zoneFinale) {
    cercleZone.remove();
    cercleZone = null;
  }
  modeDessin.value = false;
  annulerDessin();
  emit("zone-changee", zoneFinale);
}

onMounted(async () => {
  if (!conteneur.value) return;
  const L = await import("leaflet");

  carte = L.map(conteneur.value, {
    scrollWheelZoom: false,
    zoomSnap: 0,
    attributionControl: true,
  }).setView([46.6, 2.4], 5);

  conteneur.value.addEventListener("wheel", zoomerAuPincement, {
    passive: false,
  });

  // Tuiles OSM standard : gratuites, sans clé, mais soumises à la politique
  // d'usage OSM (trafic modéré) — https://operations.osmfoundation.org/policies/tiles/
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(carte);

  observateur = new ResizeObserver(() => carte?.invalidateSize());
  observateur.observe(conteneur.value);

  carte.on("mousedown", surAppui);
  carte.on("mousemove", surDeplacement);
  carte.on("mouseup", surRelache);

  await dessiner();
  await dessinerZone();
});

onBeforeUnmount(() => {
  conteneur.value?.removeEventListener("wheel", zoomerAuPincement);
  window.removeEventListener("mouseup", surRelacheGlobale);
  observateur?.disconnect();
  observateur = null;
  carte?.remove();
  carte = null;
});

watch(() => props.biens, dessiner, { deep: true });
watch(() => props.zone, dessinerZone);

watch(
  () => props.selection,
  (id) => {
    if (!id || !carte) return;
    const m = marqueurs.get(id);
    if (!m) return;
    carte.panTo(m.getLatLng());
    m.openPopup();
  }
);

watch(
  () => props.survole,
  (id, ancien) => {
    if (ancien) marqueurs.get(ancien)?.setRadius(RAYON_BASE);
    if (id) marqueurs.get(id)?.setRadius(RAYON_SURVOLE);
  }
);
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div
      class="relative isolate z-0 w-full overflow-hidden rounded-2xl border border-hairline bg-white"
      :class="hauteur === '100%' && 'min-h-0 flex-1'"
      :style="hauteur === '100%' ? undefined : { height: hauteur }"
    >
      <div ref="conteneur" class="size-full" />

      <button
        type="button"
        class="absolute right-3 top-3 z-[1000] rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface"
        :class="modeDessin && 'bg-blue text-white hover:bg-blue'"
        @click="modeDessin = !modeDessin"
      >
        {{
          modeDessin
            ? "Clique-glisse pour dessiner…"
            : zone
              ? "Redessiner la zone"
              : "Dessiner une zone"
        }}
      </button>

      <button
        v-if="zone"
        type="button"
        class="absolute right-3 top-11 z-[1000] rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-slate shadow-sm transition hover:bg-surface"
        @click="emit('zone-changee', null)"
      >
        Effacer la zone
      </button>
    </div>

    <p v-if="sansPosition > 0" class="mt-2 text-xs text-stone">
      {{ sansPosition }} bien{{ sansPosition > 1 ? "s" : "" }} sans localisation
      — adresse trop imprécise dans l’annonce.
    </p>
  </div>
</template>

<style scoped>
:deep(.leaflet-container) {
  font: inherit;
  background: var(--color-surface);
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
}

:deep(.leaflet-popup-content) {
  margin: 0.75rem 1rem;
}
</style>

<script setup lang="ts">
import "leaflet/dist/leaflet.css";
import type {
  Circle,
  CircleMarker,
  LatLng,
  LeafletMouseEvent,
  Map as LeafletMap,
} from "leaflet";
import type { Property } from "~/types";
import type { MapZone } from "~/composables/useMapZone";

const props = withDefaults(
  defineProps<{
    biens: Property[];
    selection?: string | null;
    survole?: string | null;
    height?: string;
    zoomLevel?: number;
    zone?: MapZone | null;
  }>(),
  { selection: null, survole: null, height: "32rem", zoomLevel: 15, zone: null }
);

const emit = defineEmits<{
  select: [id: string];
  "zone-changed": [zone: MapZone | null];
}>();

const container = ref<HTMLElement | null>(null);
const { biens: context } = useProperties();

let map: LeafletMap | null = null;
let resizeObserver: ResizeObserver | null = null;
let layers: (CircleMarker | Circle)[] = [];
const markers = new Map<string, CircleMarker>();

const BASE_RADIUS = 9;
const HOVER_RADIUS = 14;

const drawMode = ref(false);
let zoneCircle: Circle | null = null;
let drawStart: LatLng | null = null;
/** En dessous, le rayon est trop petit pour être une zone voulue — on l'ignore. */
const MIN_RADIUS_M = 50;

const located = computed(() =>
  props.biens.filter((b) => b.lat != null && b.lon != null)
);
const unlocated = computed(
  () => props.biens.length - located.value.length
);

const ZOOM_SENSITIVITY = 0.2;
const MAX_ZOOM_PER_EVENT = 1.2;
const PIXELS_PER_LINE = 16;

function zoomOnPinch(e: WheelEvent) {
  if (!map || !e.ctrlKey) return;

  e.preventDefault();

  const pixels = e.deltaMode === 1 ? e.deltaY * PIXELS_PER_LINE : e.deltaY;
  const delta = Math.max(
    -MAX_ZOOM_PER_EVENT,
    Math.min(MAX_ZOOM_PER_EVENT, pixels * ZOOM_SENSITIVITY)
  );
  const point = map.mouseEventToContainerPoint(e);

  map.setZoomAround(
    map.containerPointToLatLng(point),
    map.getZoom() - delta
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );
}

function popup(b: Property): string {
  const price = b.prix
    ? `${formatNumber(Math.round(b.prix / 100))} €${isPurchase(b) ? "" : "/mois"}`
    : "Prix inconnu";
  const pricePerSqmText = pricePerSqm(b) ? ` · ${formatNumber(pricePerSqm(b)!)} €/m²` : "";
  const approx =
    b.geo_precision === "ville"
      ? '<div class="mt-1 text-stone">Position approximative</div>'
      : "";
  return `
    <div class="text-sm">
      <a href="/bien/${
        b.id
      }" class="font-semibold text-ink hover:underline">${escapeHtml(
    b.titre ?? "Sans titre"
  )}</a>
      <div class="mt-1 text-slate">${price}${pricePerSqmText}</div>
      <div class="text-stone">${escapeHtml(
        [b.ville, b.code_postal].filter(Boolean).join(" ")
      )}</div>
      ${approx}
    </div>`;
}

async function draw() {
  if (!map) return;
  const L = await import("leaflet");

  layers.forEach((c) => c.remove());
  layers = [];
  markers.clear();

  for (const b of located.value) {
    const total = scoreProperty(b, context.value).total;
    const color = scoreColor(total);

    if (b.geo_precision === "ville") {
      layers.push(
        L.circle([b.lat!, b.lon!], {
          radius: 700,
          color: color,
          weight: 1,
          dashArray: "4 4",
          fillColor: color,
          fillOpacity: 0.08,
        }).addTo(map)
      );
    }

    const m = L.circleMarker([b.lat!, b.lon!], {
      radius: BASE_RADIUS,
      color: "#ffffff",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.95,
    })
      .bindPopup(popup(b))
      .addTo(map);

    m.on("click", () => emit("select", b.id));
    markers.set(b.id, m);
    layers.push(m);
  }

  if (props.survole) markers.get(props.survole)?.setRadius(HOVER_RADIUS);

  if (located.value.length === 1) {
    const only = located.value[0]!;
    map.setView([only.lat!, only.lon!], props.zoomLevel);
  } else if (located.value.length > 1) {
    map.fitBounds(
      L.latLngBounds(
        located.value.map((b) => [b.lat!, b.lon!] as [number, number])
      ),
      { padding: [40, 40], maxZoom: 14 }
    );
  }
}

async function drawZone() {
  if (!map) return;
  const L = await import("leaflet");

  zoneCircle?.remove();
  zoneCircle = null;
  if (!props.zone) return;

  zoneCircle = L.circle([props.zone.lat, props.zone.lon], {
    radius: props.zone.radiusM,
    color: "#2563eb",
    weight: 2,
    fillColor: "#2563eb",
    fillOpacity: 0.08,
  }).addTo(map);
}

function cancelDraw() {
  window.removeEventListener("mouseup", onGlobalMouseUp);
  map?.dragging.enable();
  drawStart = null;
}

async function onGlobalMouseUp() {
  // Le relâchement a eu lieu hors de la carte : le mouseup de Leaflet ne
  // s'est jamais déclenché. On annule le tracé et on réaffiche la zone active
  // (ou son absence) telle qu'elle était avant ce geste avorté.
  if (!drawStart) return;
  drawMode.value = false;
  cancelDraw();
  await drawZone();
}

async function onMouseDown(e: LeafletMouseEvent) {
  if (!drawMode.value || !map) return;
  const L = await import("leaflet");

  drawStart = e.latlng;
  zoneCircle?.remove();
  zoneCircle = L.circle(e.latlng, {
    radius: 0,
    color: "#2563eb",
    weight: 2,
    fillColor: "#2563eb",
    fillOpacity: 0.08,
  }).addTo(map);
  map.dragging.disable();
  window.addEventListener("mouseup", onGlobalMouseUp);
}

function onMouseMove(e: LeafletMouseEvent) {
  if (!drawStart || !map || !zoneCircle) return;
  zoneCircle.setRadius(map.distance(drawStart, e.latlng));
}

function onMouseUp(e: LeafletMouseEvent) {
  if (!drawStart || !map || !zoneCircle) return;
  const radius = map.distance(drawStart, e.latlng);
  const finalZone: MapZone | null =
    radius >= MIN_RADIUS_M
      ? { lat: drawStart.lat, lon: drawStart.lng, radiusM: Math.round(radius) }
      : null;

  if (!finalZone) {
    zoneCircle.remove();
    zoneCircle = null;
  }
  drawMode.value = false;
  cancelDraw();
  emit("zone-changed", finalZone);
}

onMounted(async () => {
  if (!container.value) return;
  const L = await import("leaflet");

  map = L.map(container.value, {
    scrollWheelZoom: false,
    zoomSnap: 0,
    attributionControl: true,
  }).setView([46.6, 2.4], 5);

  container.value.addEventListener("wheel", zoomOnPinch, {
    passive: false,
  });

  // Tuiles OSM standard : gratuites, sans clé, mais soumises à la politique
  // d'usage OSM (trafic modéré) — https://operations.osmfoundation.org/policies/tiles/
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  resizeObserver = new ResizeObserver(() => map?.invalidateSize());
  resizeObserver.observe(container.value);

  map.on("mousedown", onMouseDown);
  map.on("mousemove", onMouseMove);
  map.on("mouseup", onMouseUp);

  await draw();
  await drawZone();
});

onBeforeUnmount(() => {
  container.value?.removeEventListener("wheel", zoomOnPinch);
  window.removeEventListener("mouseup", onGlobalMouseUp);
  resizeObserver?.disconnect();
  resizeObserver = null;
  map?.remove();
  map = null;
});

watch(() => props.biens, draw, { deep: true });
watch(() => props.zone, drawZone);

watch(
  () => props.selection,
  (id) => {
    if (!id || !map) return;
    const m = markers.get(id);
    if (!m) return;
    map.panTo(m.getLatLng());
    m.openPopup();
  }
);

watch(
  () => props.survole,
  (id, previous) => {
    if (previous) markers.get(previous)?.setRadius(BASE_RADIUS);
    if (id) markers.get(id)?.setRadius(HOVER_RADIUS);
  }
);
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div
      class="relative isolate z-0 w-full overflow-hidden rounded-2xl border border-hairline bg-white"
      :class="height === '100%' && 'min-h-0 flex-1'"
      :style="height === '100%' ? undefined : { height: height }"
    >
      <div ref="container" class="size-full" />

      <button
        type="button"
        class="absolute right-3 top-3 z-[1000] rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-surface"
        :class="drawMode && 'bg-blue text-white hover:bg-blue'"
        @click="drawMode = !drawMode"
      >
        {{
          drawMode
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
        @click="emit('zone-changed', null)"
      >
        Effacer la zone
      </button>
    </div>

    <p v-if="unlocated > 0" class="mt-2 text-xs text-stone">
      {{ unlocated }} bien{{ unlocated > 1 ? "s" : "" }} sans localisation
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

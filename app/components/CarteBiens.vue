<script setup lang="ts">
import "leaflet/dist/leaflet.css";
import type { Circle, CircleMarker, Map as LeafletMap } from "leaflet";
import type { Bien } from "~/types";

const props = withDefaults(
  defineProps<{
    biens: Bien[];
    selection?: string | null;
    hauteur?: string;
    zoomBien?: number;
  }>(),
  { selection: null, hauteur: "32rem", zoomBien: 15 }
);

const emit = defineEmits<{ select: [id: string] }>();

const conteneur = ref<HTMLElement | null>(null);
const { biens: contexte } = useBiens();

let carte: LeafletMap | null = null;
let observateur: ResizeObserver | null = null;
let couche: (CircleMarker | Circle)[] = [];
const marqueurs = new Map<string, CircleMarker>();

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

const eur = (n: number) => n.toLocaleString("fr-FR");

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
    ? `${eur(Math.round(b.prix / 100))} €${estAchat(b) ? "" : "/mois"}`
    : "Prix inconnu";
  const m2 = b.surface
    ? ` · ${eur(Math.round(b.prix / 100 / b.surface))} €/m²`
    : "";
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
      radius: 9,
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

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }
  ).addTo(carte);

  observateur = new ResizeObserver(() => carte?.invalidateSize());
  observateur.observe(conteneur.value);

  await dessiner();
});

onBeforeUnmount(() => {
  conteneur.value?.removeEventListener("wheel", zoomerAuPincement);
  observateur?.disconnect();
  observateur = null;
  carte?.remove();
  carte = null;
});

watch(() => props.biens, dessiner, { deep: true });

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
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div
      ref="conteneur"
      class="relative isolate z-0 w-full overflow-hidden rounded-2xl border border-hairline bg-white"
      :class="hauteur === '100%' && 'min-h-0 flex-1'"
      :style="hauteur === '100%' ? undefined : { height: hauteur }"
    />

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

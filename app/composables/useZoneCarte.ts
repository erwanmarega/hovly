import type { Bien } from "~/types";

export interface ZoneCarte {
  lat: number;
  lon: number;
  rayonM: number;
}

const RAYON_TERRE_M = 6_371_000;

/** Distance à vol d'oiseau entre deux points, en mètres. */
export function distanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE_M * Math.asin(Math.sqrt(h));
}

export function useZoneCarte() {
  const zone = useState<ZoneCarte | null>("zone-carte", () => null);

  function dansZone(bien: Bien): boolean {
    if (!zone.value || bien.lat == null || bien.lon == null) return !zone.value;
    return distanceM(zone.value, { lat: bien.lat, lon: bien.lon }) <= zone.value.rayonM;
  }

  function effacer() {
    zone.value = null;
  }

  return { zone, dansZone, effacer };
}

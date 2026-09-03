import type { Property } from "~/types";

export interface MapZone {
  lat: number;
  lon: number;
  radiusM: number;
}

const EARTH_RADIUS_M = 6_371_000;

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
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function useMapZone() {
  const zone = useState<MapZone | null>("map-zone", () => null);

  function inZone(bien: Property): boolean {
    if (!zone.value || bien.lat == null || bien.lon == null) return !zone.value;
    return distanceM(zone.value, { lat: bien.lat, lon: bien.lon }) <= zone.value.radiusM;
  }

  function clear() {
    zone.value = null;
  }

  return { zone, inZone, clear };
}

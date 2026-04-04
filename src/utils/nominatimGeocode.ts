/**
 * OpenStreetMap Nominatim search — free place lookup (usage policy: max ~1 req/sec, identify app).
 * https://operations.osmfoundation.org/policies/nominatim/
 */

export type NominatimAddress = {
  country?: string;
  state?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  /** Common in EU / Americas when `city` is missing */
  municipality?: string;
  locality?: string;
  city_district?: string;
  /** Often the primary place label when not a street address */
  name?: string;
  national_park?: string;
  tourism?: string;
  [key: string]: string | undefined;
};

export type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  type?: string;
  class?: string;
};

const USER_AGENT = 'Couplix/1.0 (couples app; contact via app support)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

export async function searchPlaces(query: string): Promise<NominatimHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastRequestAt);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=10`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[];
  return Array.isArray(data) ? data : [];
}

export function pickCity(addr?: NominatimAddress): string | undefined {
  if (!addr) return undefined;
  return (
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.village ||
    addr.hamlet ||
    addr.locality ||
    addr.city_district ||
    addr.suburb ||
    addr.county
  );
}

/**
 * When Nominatim omits structured city fields, infer a locality from `display_name`
 * (usually "Place, City, Region, Country" or "City, State, Country").
 */
/** Call only when `pickCity(address)` is empty — infers locality from POI name or `display_name`. */
export function deriveCityFromHit(hit: NominatimHit): string | undefined {
  const a = hit.address;
  if (a?.name?.trim() && !a?.road && !a?.house_number) {
    return a.name.trim();
  }

  const parts = hit.display_name
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 1) {
    const p = parts[0];
    if (p && p.length < 56) return p;
    return undefined;
  }

  const country = a?.country?.toLowerCase();
  if (country) {
    const last = parts[parts.length - 1]?.toLowerCase() ?? '';
    if (last.includes(country) || country.includes(last)) {
      const before = parts[parts.length - 2];
      if (before && before.length < 48) return before;
    }
  }

  if (parts.length >= 3) {
    const mid = parts[parts.length - 2];
    if (mid && mid.length < 56) return mid;
  }

  // "City, Country" — first segment is the locality, not the country
  if (parts.length === 2) {
    const first = parts[0];
    if (first && first.length < 56) return first;
  }

  return undefined;
}

export function deriveCountryFromHit(hit: NominatimHit): string | undefined {
  const c = hit.address?.country?.trim();
  if (c) return c;

  const parts = hit.display_name
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  const last = parts[parts.length - 1];
  if (last && last.length < 64) return last;
  return undefined;
}

export function labelFromHit(hit: NominatimHit): string {
  return hit.display_name || `${hit.lat},${hit.lon}`;
}

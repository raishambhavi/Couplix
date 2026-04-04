export function placeLabelSegments(placeLabel: string): string[] {
  return placeLabel.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Best-effort city name for display/stats from a free-text place label.
 * Handles: "City", "City, Country", "POI, City, Region, Country", single-segment names.
 */
export function inferCityFromPlaceLabel(placeLabel: string): string | undefined {
  const parts = placeLabelSegments(placeLabel);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) {
    const p = parts[0];
    return p.length > 0 && p.length < 80 ? p : undefined;
  }
  if (parts.length === 2) {
    const first = parts[0];
    return first.length > 0 && first.length < 80 ? first : undefined;
  }
  const mid = parts[parts.length - 2];
  return mid && mid.length < 80 ? mid : parts[0];
}

export function inferCountryFromPlaceLabel(placeLabel: string): string | undefined {
  const parts = placeLabelSegments(placeLabel);
  if (parts.length === 0) return undefined;
  const last = parts[parts.length - 1];
  return last && last.length < 80 ? last : undefined;
}

/** City for Our Trips stats: prefer structured field, else parse placeLabel. */
export function cityLabelForTripStats(t: { city?: string; placeLabel: string }): string {
  const c = t.city?.trim();
  if (c) return c;
  return inferCityFromPlaceLabel(t.placeLabel) ?? '';
}

/** Country for Our Trips stats: prefer structured field, else last segment of placeLabel. */
export function countryLabelForTripStats(t: { country?: string; placeLabel: string }): string {
  const c = t.country?.trim();
  if (c) return c;
  return inferCountryFromPlaceLabel(t.placeLabel) ?? '';
}

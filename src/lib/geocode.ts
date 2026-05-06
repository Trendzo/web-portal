/**
 * Wrapper around Nominatim (OpenStreetMap's free geocoder). Returns the first match's
 * coordinates for a free-text query. No API key required.
 *
 * Usage policy: max ~1 req/sec, attribute back to OSM. Fine for our occasional
 * "city center on PIN lookup" call. Throws on network failure; returns null when
 * no match is found.
 */
export async function geocodeLocation(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);

  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  const first = arr[0];
  if (!first) return null;

  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

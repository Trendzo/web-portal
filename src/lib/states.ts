/**
 * Indian GST state codes — 2-digit prefix used in GSTIN and "place of supply" rules.
 * Keyed by the state's official English name as returned by api.postalpincode.in.
 */
const GST_STATE_CODES: Record<string, string> = {
  'Jammu and Kashmir': '01',
  'Himachal Pradesh': '02',
  'Punjab': '03',
  'Chandigarh': '04',
  'Uttarakhand': '05',
  'Haryana': '06',
  'Delhi': '07',
  'Rajasthan': '08',
  'Uttar Pradesh': '09',
  'Bihar': '10',
  'Sikkim': '11',
  'Arunachal Pradesh': '12',
  'Nagaland': '13',
  'Manipur': '14',
  'Mizoram': '15',
  'Tripura': '16',
  'Meghalaya': '17',
  'Assam': '18',
  'West Bengal': '19',
  'Jharkhand': '20',
  'Odisha': '21',
  'Chhattisgarh': '22',
  'Madhya Pradesh': '23',
  'Gujarat': '24',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Maharashtra': '27',
  'Karnataka': '29',
  'Goa': '30',
  'Lakshadweep': '31',
  'Kerala': '32',
  'Tamil Nadu': '33',
  'Puducherry': '34',
  'Andaman and Nicobar Islands': '35',
  'Telangana': '36',
  'Andhra Pradesh': '37',
  'Ladakh': '38',
};

/** Resolve a state name (case-insensitive) to its 2-digit GST code, or null. */
export function gstStateCodeFor(stateName: string): string | null {
  const direct = GST_STATE_CODES[stateName];
  if (direct) return direct;
  const lower = stateName.toLowerCase();
  for (const [k, v] of Object.entries(GST_STATE_CODES)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

/** Reverse map: 2-digit GST code → state name. Built once from GST_STATE_CODES. */
const GST_STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(GST_STATE_CODES).map(([name, code]) => [code, name]),
);

/**
 * Resolve a 2-digit GST state code to its state name, or null if unknown.
 * Accepts a leading-zero or bare code (e.g. '7' or '07' → 'Delhi').
 */
export function gstStateNameFor(code: string | number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  const raw = String(code).trim();
  if (!raw) return null;
  return GST_STATE_NAMES[raw] ?? GST_STATE_NAMES[raw.padStart(2, '0')] ?? null;
}

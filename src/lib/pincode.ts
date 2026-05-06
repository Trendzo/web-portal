import { gstStateCodeFor } from './states';

/**
 * Resolved location for an Indian 6-digit PIN code. `stateCode` is the 2-digit GST
 * state code derived from the state name (or null if we don't know it — the form
 * should fail validation in that case).
 */
export type PincodeLookup = {
  city: string;
  state: string;
  country: string;
  stateCode: string | null;
};

type PostOffice = {
  Name: string;
  District: string;
  State: string;
  Country: string;
  Pincode: string;
};

type ApiResponse = {
  Message: string;
  Status: 'Success' | 'Error' | '404';
  PostOffice: PostOffice[] | null;
};

/**
 * Look up an Indian PIN code via the public postalpincode.in API. Returns a single
 * resolved location (we use the first post office's district/state — they're
 * consistent across post offices for a given PIN).
 *
 * Throws on network errors. Returns null if the PIN is unknown.
 */
export async function lookupPincode(pin: string): Promise<PincodeLookup | null> {
  if (!/^\d{6}$/.test(pin)) return null;

  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
  if (!res.ok) throw new Error(`PIN lookup HTTP ${res.status}`);

  const data = (await res.json()) as ApiResponse[];
  const first = data[0];
  if (!first || first.Status !== 'Success' || !first.PostOffice?.length) {
    return null;
  }

  const po = first.PostOffice[0];
  if (!po) return null;

  return {
    city: po.District,
    state: po.State,
    country: po.Country,
    stateCode: gstStateCodeFor(po.State),
  };
}

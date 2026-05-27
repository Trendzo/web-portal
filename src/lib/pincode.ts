import { gstStateCodeFor } from './states';
import { BASE } from './api';

export type PincodeLookup = {
  city: string;
  state: string;
  country: string;
  stateCode: string | null;
};

export async function lookupPincode(pin: string): Promise<PincodeLookup | null> {
  if (!/^\d{6}$/.test(pin)) return null;

  const res = await fetch(`${BASE}/pincode/${pin}`);
  if (!res.ok) throw new Error(`PIN lookup HTTP ${res.status}`);

  const json = (await res.json()) as { success: boolean; data: { city: string; state: string; country: string } | null };
  if (!json.success || !json.data) return null;

  return {
    city: json.data.city,
    state: json.data.state,
    country: json.data.country,
    stateCode: gstStateCodeFor(json.data.state),
  };
}

/**
 * Indian mobile validation. Accepts the digits in many shapes — with or without
 * `+91`, with spaces or hyphens between groups — and normalises to the canonical
 * `+91XXXXXXXXXX` form the backend expects. Numbers must start with 6, 7, 8 or 9.
 */
export function normaliseIndianMobile(raw: string): string | null {
  // Strip whitespace, hyphens, parens, dots — keep digits and a leading '+'.
  const cleaned = raw.replace(/[\s\-().]+/g, '');
  // Strip an optional leading '+' or '+91' / '91'.
  let digits = cleaned;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('+')) digits = digits.slice(1);

  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export const INDIAN_MOBILE_HINT = 'e.g. 9876543210';
export const INDIAN_MOBILE_ERROR = 'Use 10 digits starting with 6, 7, 8 or 9';

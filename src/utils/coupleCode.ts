/**
 * Normalize user-entered or stored couple id for Firestore paths.
 * - New format: exactly 6 digits.
 * - Legacy: 6 chars A–Z (no I/O) and 2–9 only.
 */
export function parseCoupleCodeInput(raw: string | null): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 6) return digits;
  const alnum = raw.replace(/\s/g, '').toUpperCase();
  if (alnum.length === 6 && /^[A-HJ-NP-Z2-9]{6}$/.test(alnum)) return alnum;
  return null;
}

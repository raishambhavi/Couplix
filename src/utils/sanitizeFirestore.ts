/** Firestore rejects `undefined` anywhere in document data. */
export function omitUndefinedDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'object' && v !== null ? omitUndefinedDeep(v) : v;
  }
  return out as T;
}

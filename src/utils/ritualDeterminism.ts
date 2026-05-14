/** UTC calendar date `YYYY-MM-DD` — same key for both partners worldwide for a given calendar day. */
export function utcCalendarDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Saturday & Sunday (UTC) = weekend rhythm; Mon–Fri = lighter weekday dares. */
export function isWeekendUtc(d = new Date()): boolean {
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)!;
  }
  return h >>> 0;
}

/** Deterministic index in `[0, length)` for the same inputs on both devices. */
export function syncedPoolIndex(poolLength: number, salt: string, coupleCode: string, dateKey: string): number {
  if (poolLength <= 0) return 0;
  const h = djb2(`${salt}|${coupleCode}|${dateKey}`);
  return h % poolLength;
}

/** Whole UTC days since Unix epoch — stable for a given `YYYY-MM-DD` key. */
export function utcDayOrdinalFromKey(dateKey: string): number {
  const t = Date.parse(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return 0;
  return Math.floor(t / 86_400_000);
}

/** Fisher–Yates shuffle order seeded by string — same seed ⇒ same permutation. */
function seededShuffleOrder(n: number, seed: string): number[] {
  const out = Array.from({ length: n }, (_, i) => i);
  let h = djb2(seed);
  for (let i = n - 1; i > 0; i--) {
    h = (Math.imul(h, 1_664_525) + 1_013_904_223) >>> 0;
    const j = h % (i + 1);
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * Picks a pool index so each entry appears once per full cycle of `poolLength` UTC days
 * (no repeats within the cycle), while staying identical on both partners' devices.
 */
export function permutedPoolIndex(
  poolLength: number,
  salt: string,
  coupleCode: string,
  dateKey: string,
): number {
  if (poolLength <= 0) return 0;
  const ord = utcDayOrdinalFromKey(dateKey);
  const order = seededShuffleOrder(poolLength, `${salt}|${coupleCode}`);
  const slot = ((ord % poolLength) + poolLength) % poolLength;
  return order[slot] ?? 0;
}

/** Full days between met date (local midnight) and today. */
export function fullDaysTogether(metAtMs: number | null): number | null {
  if (metAtMs == null || !Number.isFinite(metAtMs)) return null;
  const start = new Date(metAtMs);
  const now = new Date();
  const s = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((n - s) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function daysInMonth(month1to12: number, year: number): number {
  if (month1to12 < 1 || month1to12 > 12) return 31;
  return new Date(year, month1to12, 0).getDate();
}

/** Live elapsed time since `metAtMs` (use `nowMs` = Date.now() updated every second). */
export function elapsedSinceMet(metAtMs: number | null, nowMs: number): {
  totalDays: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  if (metAtMs == null || !Number.isFinite(metAtMs)) return null;
  let elapsed = Math.max(0, nowMs - metAtMs);
  const totalDays = Math.floor(elapsed / 86400000);
  elapsed %= 86400000;
  const hours = Math.floor(elapsed / 3600000);
  elapsed %= 3600000;
  const minutes = Math.floor(elapsed / 60000);
  elapsed %= 60000;
  const seconds = Math.floor(elapsed / 1000);
  return { totalDays, hours, minutes, seconds };
}

export function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

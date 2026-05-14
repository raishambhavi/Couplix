export type BusyBlock = { startMs: number; endMs: number };

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic demo busy blocks (shown as Busy only — no titles). */
export function generateDemoBusy(
  myEmail: string,
  partnerEmail: string | null,
  anchor: Date
): { my: BusyBlock[]; partner: BusyBlock[] } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const seed = hashString(myEmail || 'me');
  const my: BusyBlock[] = [];
  for (let d = 3; d < 29; d += 4) {
    const day = ((d + (seed % 3)) % 28) + 1;
    const start = new Date(y, m, day, 9 + (seed % 4), 0, 0, 0);
    const end = new Date(y, m, day, 10 + (seed % 3), 30, 0, 0);
    my.push({ startMs: start.getTime(), endMs: end.getTime() });
  }
  const partner: BusyBlock[] = [];
  if (partnerEmail?.trim()) {
    const s2 = hashString(partnerEmail + 'x');
    for (let d = 5; d < 29; d += 5) {
      const day = ((d + (s2 % 5)) % 27) + 1;
      const start = new Date(y, m, day, 14 + (s2 % 2), 0, 0, 0);
      const end = new Date(y, m, day, 16 + (s2 % 2), 0, 0, 0);
      partner.push({ startMs: start.getTime(), endMs: end.getTime() });
    }
  }
  return { my, partner };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function dayHasBusy(day: Date, blocks: BusyBlock[]) {
  const s0 = startOfDay(day).getTime();
  const e0 = s0 + 86400000;
  return blocks.some((b) => b.startMs < e0 && b.endMs > s0);
}

export function blocksForDay(day: Date, blocks: BusyBlock[]) {
  const s0 = startOfDay(day).getTime();
  const e0 = s0 + 86400000;
  return blocks.filter((b) => b.startMs < e0 && b.endMs > s0);
}

export function startOfWeekMonday(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = x.getDay(); // 0 Sun
  const diff = wd === 0 ? -6 : 1 - wd;
  x.setDate(x.getDate() + diff);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

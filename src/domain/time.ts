import { divideRounded, type Cents } from "./money";

/** All times are milliseconds since 1970 (UTC). */
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Longest single shift or break, to catch a forgotten clock-out or a wrong day. */
export const MAX_SPAN = 24 * HOUR;
/** Phones' clocks drift a little; allow times this far "in the future". */
export const CLOCK_SKEW = 2 * MINUTE;

/** A stretch of time. `end` null = still going. */
export interface Span {
  start: number;
  end: number | null;
}

/**
 * Checks a start/end pair. Returns a plain-language problem, or null if it's fine.
 * `allowOpen`: an entry that's still running (no end yet) is OK.
 */
export function timeProblem(span: Span, now: number, allowOpen = false): string | null {
  const { start, end } = span;
  if (!Number.isSafeInteger(start)) return "The start time is missing.";
  if (start > now + CLOCK_SKEW) return "The start time can't be in the future.";
  if (end === null) return allowOpen ? null : "The end time is missing.";
  if (!Number.isSafeInteger(end)) return "The end time isn't valid.";
  if (end <= start) return "The end time has to be after the start.";
  if (end - start > MAX_SPAN) return "A shift or break can't be longer than 24 hours.";
  if (end > now + CLOCK_SKEW) return "The end time can't be in the future.";
  return null;
}

/** Do two spans share any time? Running spans count as going on forever. */
export function overlaps(a: Span, b: Span): boolean {
  const aEnd = a.end ?? Infinity;
  const bEnd = b.end ?? Infinity;
  return a.start < bEnd && b.start < aEnd;
}

/** Joins overlapping or touching spans, so no time is counted twice. `end` must be set. */
function merge(spans: { start: number; end: number }[]): { start: number; end: number }[] {
  const sorted = [...spans].filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const out: { start: number; end: number }[] = [];
  for (const s of sorted) {
    const last = out.at(-1);
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

const closeAt = (now: number) => (s: Span) => ({ start: s.start, end: s.end ?? now });

/**
 * Paid working time: time on the clock minus breaks. Breaks are unpaid. A break only
 * counts while the person is on the clock, and overlapping entries never double count.
 * Anything still running is counted up to `now`.
 */
export function workedMs(work: readonly Span[], breaks: readonly Span[], now: number): number {
  const on = merge(work.map(closeAt(now)));
  const off = merge(breaks.map(closeAt(now)));
  let total = 0;
  for (const w of on) {
    let worked = w.end - w.start;
    for (const b of off) {
      const overlap = Math.min(w.end, b.end) - Math.max(w.start, b.start);
      if (overlap > 0) worked -= overlap;
    }
    total += worked;
  }
  return total;
}

/** Hourly pay for an amount of time, rounded to the nearest cent. */
export function hourlyPay(hourly: Cents, ms: number): Cents {
  if (!Number.isSafeInteger(ms) || ms < 0) throw new RangeError("Time worked must be ≥ 0");
  return divideRounded(hourly * ms, HOUR);
}

/** "7h 05m", rounded down to the minute. */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / MINUTE);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

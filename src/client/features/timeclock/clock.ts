import type { ShowEvent } from "@shared/entities/event";
import type { TimeEntry } from "@shared/entities/time";

/** Today's date on this device, "2027-06-05". */
export function localDay(ms: number = Date.now()): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d.getTime());
}

/**
 * Events someone can clock in for today: ones they're working that aren't locked,
 * from the day before (setup) to the day after (teardown).
 */
export function clockableEvents(events: ShowEvent[], workingIds: Set<string>, today = localDay()) {
  return events
    .filter((e) => workingIds.has(e.id) && e.status !== "locked")
    .filter((e) => addDays(e.startDate, -1) <= today && today <= addDays(e.endDate, 1))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Entries that count (not removed or replaced). */
export const live = (entries: TimeEntry[]) => entries.filter((e) => e.voidedAt === null);

/** What someone is doing right now, from their entries. */
export function clockState(entries: TimeEntry[], staffId: string) {
  const mine = live(entries).filter((e) => e.staffId === staffId && e.endAt === null);
  return {
    shift: mine.find((e) => e.kind === "work") ?? null,
    onBreak: mine.find((e) => e.kind === "break") ?? null,
  };
}

/** ms → value for an <input type="datetime-local"> in this device's time zone. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${localDay(ms)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ms, or null if blank/invalid. */
export function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

/** "10:02 AM" */
export const formatTime = (ms: number) => timeFmt.format(ms);
/** "Sat, Jun 5" */
export const formatDay = (ms: number) => dayFmt.format(ms);

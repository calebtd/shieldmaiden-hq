import { formatCents, formatPercent, type Bps, type Cents } from "@domain/money";

/** "$5.00/hr · 20% commission · keeps 100% of tips" */
export function describePay(r: {
  hourlyCents: number;
  commissionBps: number;
  tipShareBps: number;
}): string {
  return [
    `${formatCents(r.hourlyCents as Cents)}/hr`,
    `${formatPercent(r.commissionBps as Bps)} commission`,
    `keeps ${formatPercent(r.tipShareBps as Bps)} of tips`,
  ].join(" · ");
}

/** Cents → "5.00" for a form field, or "" when not set. */
export function centsField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

/** Basis points → "8.25" for a form field, or "" when not set. */
export function percentField(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value / 100);
}

const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Apr 10–11, 2027", "Apr 30 – May 2, 2027", or "Apr 10, 2027". */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (startDate === endDate) return fullDate.format(start);
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    return `${monthDay.format(start)}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  if (startDate.slice(0, 4) === endDate.slice(0, 4)) {
    return `${monthDay.format(start)} – ${fullDate.format(end)}`;
  }
  return `${fullDate.format(start)} – ${fullDate.format(end)}`;
}

import { describe, expect, it } from "vitest";
import { cents } from "./money";
import { formatDuration, HOUR, hourlyPay, MINUTE, overlaps, timeProblem, workedMs } from "./time";

const T = Date.UTC(2027, 5, 5, 16, 0); // 10:00 Boise time
const at = (h: number, m = 0) => T + h * HOUR + m * MINUTE;

describe("timeProblem", () => {
  const now = at(12);
  it("accepts a normal shift and a running one", () => {
    expect(timeProblem({ start: at(0), end: at(8) }, at(9))).toBeNull();
    expect(timeProblem({ start: at(0), end: null }, now, true)).toBeNull();
  });

  it.each([
    [{ start: at(13), end: null }, true, /future/],
    [{ start: at(0), end: null }, false, /end time is missing/],
    [{ start: at(2), end: at(1) }, false, /after the start/],
    [{ start: at(2), end: at(2) }, false, /after the start/],
    [{ start: at(-20), end: at(11) }, false, /24 hours/],
    [{ start: at(10), end: at(14) }, false, /future/],
  ])("%o → problem", (span, open, message) => {
    expect(timeProblem(span, now, open)).toMatch(message);
  });

  it("allows a phone clock that's a minute fast", () => {
    expect(timeProblem({ start: now + MINUTE, end: null }, now, true)).toBeNull();
  });
});

describe("overlaps", () => {
  it("touching spans don't overlap", () => {
    expect(overlaps({ start: at(0), end: at(4) }, { start: at(4), end: at(8) })).toBe(false);
  });
  it("a running span overlaps anything after its start", () => {
    expect(overlaps({ start: at(0), end: null }, { start: at(9), end: at(10) })).toBe(true);
    expect(overlaps({ start: at(5), end: null }, { start: at(0), end: at(4) })).toBe(false);
  });
});

describe("workedMs", () => {
  it("subtracts breaks", () => {
    const work = [{ start: at(0), end: at(8) }];
    const breaks = [{ start: at(3), end: at(3, 30) }];
    expect(workedMs(work, breaks, at(9))).toBe(7.5 * HOUR);
  });

  it("adds up several shifts in a day (out for lunch, back in)", () => {
    const work = [
      { start: at(0), end: at(4) },
      { start: at(5), end: at(9) },
    ];
    expect(workedMs(work, [], at(10))).toBe(8 * HOUR);
  });

  it("only takes off the part of a break that was on the clock", () => {
    const work = [{ start: at(0), end: at(4) }];
    const breaks = [{ start: at(3, 30), end: at(5) }];
    expect(workedMs(work, breaks, at(6))).toBe(3.5 * HOUR);
  });

  it("never counts time twice when entries overlap", () => {
    const work = [
      { start: at(0), end: at(4) },
      { start: at(2), end: at(6) },
    ];
    const breaks = [
      { start: at(1), end: at(2) },
      { start: at(1, 30), end: at(2, 30) },
    ];
    expect(workedMs(work, breaks, at(7))).toBe(4.5 * HOUR);
  });

  it("counts a running shift and break up to now", () => {
    const work = [{ start: at(0), end: null }];
    const breaks = [{ start: at(2), end: null }];
    expect(workedMs(work, breaks, at(2, 15))).toBe(2 * HOUR);
  });

  it("is zero with nothing on the clock", () => {
    expect(workedMs([], [{ start: at(0), end: at(1) }], at(2))).toBe(0);
  });
});

describe("hourlyPay", () => {
  it("pays by the hour, to the cent", () => {
    expect(hourlyPay(cents(500), 8 * HOUR)).toBe(4000);
    expect(hourlyPay(cents(1500), 7.5 * HOUR)).toBe(11250);
  });

  it("rounds odd minutes to the nearest cent", () => {
    expect(hourlyPay(cents(500), 7 * MINUTE)).toBe(58); // 58.33¢
    expect(hourlyPay(cents(1250), 1 * MINUTE)).toBe(21); // 20.83¢
    expect(hourlyPay(cents(500), 6 * MINUTE)).toBe(50);
  });

  it("$0/hr pays nothing", () => {
    expect(hourlyPay(cents(0), 8 * HOUR)).toBe(0);
  });
});

describe("formatDuration", () => {
  it("shows hours and minutes", () => {
    expect(formatDuration(7 * HOUR + 5 * MINUTE + 59_000)).toBe("7h 05m");
    expect(formatDuration(0)).toBe("0h 00m");
  });
});

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { formatCents, type Bps, type Cents } from "@domain/money";
import { resolvePayRates } from "@domain/pay";
import { formatDuration, hourlyPay, workedMs } from "@domain/time";
import type { EventStaff } from "@shared/entities/event";
import type { PayProfile } from "@shared/entities/pay";
import type { Staff } from "@shared/entities/staff";
import type { TimeEntry } from "@shared/entities/time";
import { newId } from "@shared/ids";
import { useDb, useSyncEngine } from "../../app/sync";
import { formatDateRange } from "../../components/format";
import { RejectedChanges } from "../../components/RejectedChanges";
import { clockState, formatTime, live, localDay } from "./clock";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";
import { useNow } from "./MyShiftPage";

/** Owner view: everyone's time at one event, with fixes. */
export function TimesheetsPage() {
  const db = useDb();
  const now = useNow();
  const [picked, setPicked] = useState<string | null>(null);
  const data = useLiveQuery(async () => {
    const [events, staff, crew, entries, pay] = await Promise.all([
      db.events.orderBy("startDate").reverse().toArray(),
      db.staff.toArray(),
      db.eventStaff.toArray(),
      db.timeEntries.toArray(),
      db.payProfiles.toArray(),
    ]);
    return { events, staff, crew, entries, pay: new Map(pay.map((p) => [p.staffId, p])) };
  }, [db]);
  if (!data) return null;

  const { events, staff, crew, entries, pay } = data;
  // Default: the most recent event that has started.
  const today = localDay();
  const event =
    events.find((e) => e.id === picked) ?? events.find((e) => e.startDate <= today) ?? events[0];
  if (!event) {
    return (
      <>
        <h1>Timesheets</h1>
        <p className="empty">No events yet.</p>
      </>
    );
  }

  const names = new Map(staff.map((s) => [s.id, s.name]));
  const here = entries.filter((e) => e.eventId === event.id);
  const crewHere = crew.filter((c) => c.eventId === event.id);
  // Everyone on the crew, plus anyone with time here who was later taken off.
  const people = staff
    .filter(
      (s) =>
        crewHere.some((c) => c.staffId === s.id && c.working) ||
        here.some((e) => e.staffId === s.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const locked = event.status === "locked";

  return (
    <>
      <h1>Timesheets</h1>
      <RejectedChanges />
      <label>
        Event
        <select value={event.id} onChange={(e) => setPicked(e.target.value)}>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {formatDateRange(e.startDate, e.endDate)}
            </option>
          ))}
        </select>
      </label>
      {people.length === 0 && <p className="empty">No one is on this event&apos;s crew yet.</p>}
      {people.map((p) => (
        <PersonTime
          key={p.id}
          person={p}
          eventId={event.id}
          entries={here.filter((e) => e.staffId === p.id)}
          allEntries={entries}
          profile={pay.get(p.id)}
          override={crewHere.find((c) => c.staffId === p.id)}
          locked={locked}
          names={names}
          now={now}
        />
      ))}
    </>
  );
}

function PersonTime(props: {
  person: Staff;
  eventId: string;
  entries: TimeEntry[];
  allEntries: TimeEntry[];
  profile: PayProfile | undefined;
  override: EventStaff | undefined;
  locked: boolean;
  names: Map<string, string>;
  now: number;
}) {
  const { person, eventId, entries, profile, override, locked, names, now } = props;
  const engine = useSyncEngine();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const counted = live(entries);
  const spans = (kind: TimeEntry["kind"]) =>
    counted.filter((e) => e.kind === kind).map((e) => ({ start: e.startAt, end: e.endAt }));
  const worked = workedMs(spans("work"), spans("break"), now);
  const breaks = workedMs(spans("break"), [], now);
  const rates = resolvePayRates(
    profile
      ? {
          hourly: profile.hourlyCents as Cents,
          commission: profile.commissionBps as Bps,
          tipShare: profile.tipShareBps as Bps,
        }
      : null,
    override
      ? {
          hourly: override.hourlyCents as Cents | null,
          commission: override.commissionBps as Bps | null,
          tipShare: override.tipShareBps as Bps | null,
        }
      : null,
  );
  const { shift, onBreak } = clockState(props.allEntries, person.id);
  const shiftHere = shift?.eventId === eventId ? shift : null;
  const changes = entries.filter((e) => e.reason !== null).length;

  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{person.name}</strong>
          {shiftHere && (
            <span className="chip info">
              {onBreak ? "On break" : `On the clock since ${formatTime(shiftHere.startAt)}`}
            </span>
          )}
          {changes > 0 && <span className="chip warn">{changes} fixed or added by hand</span>}
        </div>
        <button type="button" className="compact" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Details"}
        </button>
      </div>
      <p className="small">
        Worked {formatDuration(worked)} · breaks {formatDuration(breaks)} ·{" "}
        {rates ? `hourly pay ${formatCents(hourlyPay(rates.hourly, worked))}` : "no pay set"}
      </p>
      {open && (
        <div className="stack">
          {!locked && (
            <div className="row">
              {!shift ? (
                <button
                  type="button"
                  className="compact"
                  onClick={() =>
                    void engine.mutate("time.clockIn", {
                      id: newId(),
                      eventId,
                      staffId: person.id,
                      at: Date.now(),
                    })
                  }
                >
                  Clock them in
                </button>
              ) : (
                shiftHere && (
                  <button
                    type="button"
                    className="compact"
                    onClick={() =>
                      void engine.mutate("time.clockOut", { entryId: shiftHere.id, at: Date.now() })
                    }
                  >
                    Clock them out
                  </button>
                )
              )}
              <button type="button" className="compact" onClick={() => setAdding(true)}>
                Add missed time
              </button>
            </div>
          )}
          {adding && (
            <EntryForm
              mode="add"
              eventId={eventId}
              staffId={person.id}
              onDone={() => setAdding(false)}
            />
          )}
          <EntryList entries={entries} locked={locked} names={names} />
        </div>
      )}
    </article>
  );
}

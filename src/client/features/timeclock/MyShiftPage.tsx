import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { formatDuration, workedMs } from "@domain/time";
import type { ShowEvent } from "@shared/entities/event";
import type { TimeEntry } from "@shared/entities/time";
import { newId } from "@shared/ids";
import { useDb, useSyncEngine } from "../../app/sync";
import { formatDateRange } from "../../components/format";
import { RejectedChanges } from "../../components/RejectedChanges";
import { useSession } from "../../session/session";
import { clockableEvents, clockState, formatTime, live } from "./clock";
import { EntryForm } from "./EntryForm";
import { EntryList } from "./EntryList";

/** When a clock button was tapped. */
const at = () => Date.now();

/** Re-renders every `ms` so running times stay current. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Clock in/out and breaks for the signed-in person. Works with no signal. */
export function MyShiftPage() {
  const db = useDb();
  const { staffId } = useSession();
  const now = useNow();
  const [pickedId, setPickedId] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const [events, crew, entries, staff] = await Promise.all([
      db.events.toArray(),
      db.eventStaff.where("staffId").equals(staffId).toArray(),
      db.timeEntries.where("staffId").equals(staffId).toArray(),
      db.staff.toArray(),
    ]);
    const working = new Set(crew.filter((c) => c.working).map((c) => c.eventId));
    return { events, working, entries, names: new Map(staff.map((s) => [s.id, s.name])) };
  }, [db, staffId]);
  if (!data) return null;

  const { events, working, entries, names } = data;
  const state = clockState(entries, staffId);
  const today = clockableEvents(events, working);
  // While on the clock, show that event even if it's no longer "today".
  const current =
    events.find((e) => e.id === state.shift?.eventId) ??
    today.find((e) => e.id === pickedId) ??
    today[0] ??
    null;

  return (
    <>
      <h1>My shift</h1>
      <RejectedChanges />
      {!current ? (
        <NoEventToday events={events} working={working} />
      ) : (
        <>
          {today.length > 1 && !state.shift && (
            <label>
              Event
              <select value={current.id} onChange={(e) => setPickedId(e.target.value)}>
                {today.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ClockPanel event={current} entries={entries} staffId={staffId} now={now} />
          <section className="stack" aria-label="My time at this event">
            <h2>My time at {current.name}</h2>
            <MissedTime
              eventId={current.id}
              staffId={staffId}
              locked={current.status === "locked"}
            />
            <EntryList
              entries={entries.filter((e) => e.eventId === current.id)}
              locked={current.status === "locked"}
              names={names}
            />
          </section>
        </>
      )}
    </>
  );
}

function ClockPanel({
  event,
  entries,
  staffId,
  now,
}: {
  event: ShowEvent;
  entries: TimeEntry[];
  staffId: string;
  now: number;
}) {
  const engine = useSyncEngine();
  const { shift, onBreak } = clockState(entries, staffId);
  const here = live(entries).filter((e) => e.eventId === event.id);
  const worked = workedMs(
    here.filter((e) => e.kind === "work").map((e) => ({ start: e.startAt, end: e.endAt })),
    here.filter((e) => e.kind === "break").map((e) => ({ start: e.startAt, end: e.endAt })),
    now,
  );
  const clockIn = () =>
    void engine.mutate("time.clockIn", { id: newId(), eventId: event.id, staffId, at: at() });
  const startBreak = () =>
    void engine.mutate("time.startBreak", { id: newId(), eventId: event.id, staffId, at: at() });
  const endBreak = (id: string) => () =>
    void engine.mutate("time.endBreak", { entryId: id, at: at() });
  const clockOut = (id: string) => () =>
    void engine.mutate("time.clockOut", { entryId: id, at: at() });

  return (
    <section className="panel clock-panel" aria-label="Clock">
      <p className="small muted">
        {event.name} · {event.city} · {formatDateRange(event.startDate, event.endDate)}
      </p>
      <p className="clock-status" role="status">
        {onBreak
          ? `On break since ${formatTime(onBreak.startAt)}`
          : shift
            ? `On the clock since ${formatTime(shift.startAt)}`
            : "Not clocked in"}
      </p>
      <p className="small">Worked here: {formatDuration(worked)} (breaks not counted)</p>
      <div className="clock-buttons">
        {!shift && (
          <button type="button" className="primary big" onClick={clockIn}>
            Clock in
          </button>
        )}
        {shift && !onBreak && (
          <button type="button" className="big" onClick={startBreak}>
            Start break
          </button>
        )}
        {onBreak && (
          <button type="button" className="primary big" onClick={endBreak(onBreak.id)}>
            End break
          </button>
        )}
        {shift && (
          <button type="button" className="danger big" onClick={clockOut(shift.id)}>
            Clock out
          </button>
        )}
      </div>
    </section>
  );
}

function MissedTime({
  eventId,
  staffId,
  locked,
}: {
  eventId: string;
  staffId: string;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (locked) return null;
  if (open)
    return (
      <EntryForm mode="add" eventId={eventId} staffId={staffId} onDone={() => setOpen(false)} />
    );
  return (
    <div>
      <button type="button" className="compact" onClick={() => setOpen(true)}>
        Add missed time
      </button>
    </div>
  );
}

function NoEventToday({ events, working }: { events: ShowEvent[]; working: Set<string> }) {
  const upcoming = events
    .filter((e) => working.has(e.id) && e.status !== "locked")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (
    <section className="panel">
      <p>You&apos;re not on an event today, so there&apos;s nothing to clock in to.</p>
      {upcoming.length > 0 ? (
        <p className="small">
          Next: {upcoming[0]?.name} ·{" "}
          {formatDateRange(upcoming[0]?.startDate ?? "", upcoming[0]?.endDate ?? "")}
        </p>
      ) : (
        <p className="small muted">Ask the owner to add you to an event.</p>
      )}
    </section>
  );
}

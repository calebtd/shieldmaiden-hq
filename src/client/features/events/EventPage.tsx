import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { formatPercent, type Bps } from "@domain/money";
import { EVENT_STATUS_LABELS } from "@shared/entities/event";
import { useDb } from "../../app/sync";
import { formatDateRange } from "../../components/format";
import { RejectedChanges } from "../../components/RejectedChanges";
import { CrewRow } from "./CrewRow";
import { EventForm } from "./EventForm";
import { EventMenuPrices } from "./EventMenuPrices";

/** One event: its details, who's working, and their pay there. */
export function EventPage() {
  const { eventId = "" } = useParams();
  const db = useDb();
  const [editing, setEditing] = useState(false);
  const data = useLiveQuery(async () => {
    const [event, staff, crew, pay] = await Promise.all([
      db.events.get(eventId),
      db.staff.toArray(),
      db.eventStaff.where("eventId").equals(eventId).toArray(),
      db.payProfiles.toArray(),
    ]);
    return {
      event,
      staff,
      crew: new Map(crew.map((c) => [c.staffId, c])),
      pay: new Map(pay.map((p) => [p.staffId, p])),
    };
  }, [db, eventId]);

  if (!data) return null;
  const { event, staff, crew, pay } = data;
  if (!event) {
    return (
      <>
        <h1>Event not found</h1>
        <p>
          <Link to="/events">Back to events</Link>
        </p>
      </>
    );
  }

  const locked = event.status === "locked";
  // Everyone active, plus anyone turned off who was already on this event.
  const people = staff
    .filter((s) => s.active || crew.get(s.id)?.working)
    .sort((a, b) => a.name.localeCompare(b.name));
  const working = people.filter((s) => crew.get(s.id)?.working);
  const notWorking = people.filter((s) => !crew.get(s.id)?.working);

  return (
    <>
      <p className="small">
        <Link to="/events">← All events</Link>
      </p>
      <h1>{event.name}</h1>
      <RejectedChanges />
      {editing ? (
        <EventForm event={event} onDone={() => setEditing(false)} />
      ) : (
        <section className="panel" aria-label="Event details">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <span className="chip">{EVENT_STATUS_LABELS[event.status]}</span>
              <span>
                {event.city} · {formatDateRange(event.startDate, event.endDate)}
              </span>
            </div>
            {!locked && (
              <button type="button" className="compact" onClick={() => setEditing(true)}>
                Edit details
              </button>
            )}
          </div>
          <p>Sales tax: {formatPercent(event.taxRateBps as Bps)}</p>
        </section>
      )}

      <EventMenuPrices eventId={event.id} locked={locked} />

      <section className="stack" aria-label="Working this event">
        <h2>Working ({working.length})</h2>
        {working.length === 0 && <p className="empty">No one yet. Add people below.</p>}
        {working.map((s) => (
          <CrewRow
            key={s.id}
            eventId={event.id}
            person={s}
            entry={crew.get(s.id)}
            profile={pay.get(s.id)}
            locked={locked}
          />
        ))}
      </section>

      {!locked && notWorking.length > 0 && (
        <section className="stack" aria-label="Not working this event">
          <h2>Not working</h2>
          {notWorking.map((s) => (
            <CrewRow
              key={s.id}
              eventId={event.id}
              person={s}
              entry={crew.get(s.id)}
              profile={pay.get(s.id)}
              locked={locked}
            />
          ))}
        </section>
      )}
    </>
  );
}

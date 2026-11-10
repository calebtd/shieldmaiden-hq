import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router";
import type { Bps } from "@domain/money";
import { formatPercent } from "@domain/money";
import { EVENT_STATUS_LABELS, type ShowEvent } from "@shared/entities/event";
import { useDb } from "../../app/sync";
import { formatDateRange } from "../../components/format";
import { RejectedChanges } from "../../components/RejectedChanges";
import { EventForm } from "./EventForm";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function EventsPage() {
  const db = useDb();
  const events = useLiveQuery(() => db.events.orderBy("startDate").toArray(), [db]);
  const crewCounts = useLiveQuery(async () => {
    const counts = new Map<string, number>();
    for (const r of await db.eventStaff.toArray()) {
      if (r.working) counts.set(r.eventId, (counts.get(r.eventId) ?? 0) + 1);
    }
    return counts;
  }, [db]);

  const now = today();
  const upcoming = events?.filter((e) => e.endDate >= now) ?? [];
  const past = events?.filter((e) => e.endDate < now).reverse() ?? [];

  return (
    <>
      <h1>Events</h1>
      <RejectedChanges />
      <EventForm />
      <section className="stack" aria-label="Upcoming events">
        <h2>Upcoming ({upcoming.length})</h2>
        {events && upcoming.length === 0 && (
          <p className="empty">No upcoming events. Add one above.</p>
        )}
        {upcoming.map((e) => (
          <EventCard key={e.id} event={e} crew={crewCounts?.get(e.id) ?? 0} />
        ))}
      </section>
      {past.length > 0 && (
        <section className="stack" aria-label="Past events">
          <h2>Past ({past.length})</h2>
          {past.map((e) => (
            <EventCard key={e.id} event={e} crew={crewCounts?.get(e.id) ?? 0} />
          ))}
        </section>
      )}
    </>
  );
}

function EventCard({ event, crew }: { event: ShowEvent; crew: number }) {
  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{event.name}</strong>
          <span className="chip">{EVENT_STATUS_LABELS[event.status]}</span>
          {event.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        <Link className="btn compact" to={`/events/${event.id}`}>
          Open
        </Link>
      </div>
      <p className="small muted">
        {event.city} · {formatDateRange(event.startDate, event.endDate)} · tax{" "}
        {formatPercent(event.taxRateBps as Bps)} · {crew} working
      </p>
    </article>
  );
}

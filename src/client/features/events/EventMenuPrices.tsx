import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { priceAtEvent } from "@domain/menu";
import type { Cents } from "@domain/money";
import { MENU_KIND_LABELS, MENU_KINDS, type EventMenu, type MenuItem } from "@shared/entities/menu";
import { optionalDollarsInput } from "@shared/entities/money";
import { useDb, useSyncEngine } from "../../app/sync";
import { centsField } from "../../components/format";
import { describePrice } from "../menu/MenuPage";

/**
 * Event-specific menu: a different price for an item at this event (leave blank for
 * the usual price), or leave it off this event's menu.
 */
export function EventMenuPrices({ eventId, locked }: { eventId: string; locked: boolean }) {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const data = useLiveQuery(async () => {
    const [items, changes] = await Promise.all([
      db.menuItems.toArray(),
      db.eventMenu.where("eventId").equals(eventId).toArray(),
    ]);
    return {
      items: items.filter((i) => i.active).sort((a, b) => a.name.localeCompare(b.name)),
      changes: new Map(changes.map((c) => [c.menuItemId, c])),
    };
  }, [db, eventId]);
  if (!data) return null;
  const { items, changes } = data;
  const changed = [...changes.values()].filter((c) => c.priceCents !== null || !c.offered).length;

  return (
    <section className="panel" aria-label="Prices at this event">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Prices at this event</h2>
        <button type="button" className="compact" onClick={() => setOpen(!open)}>
          {open ? "Hide" : changed ? `Show (${changed} changed)` : "Show"}
        </button>
      </div>
      {!open && (
        <p className="small muted">
          {changed
            ? `${changed} ${changed === 1 ? "item differs" : "items differ"} from the usual menu.`
            : "Same as the usual menu."}
        </p>
      )}
      {open &&
        MENU_KINDS.map((kind) => {
          const list = items.filter((i) => i.kind === kind);
          if (list.length === 0) return null;
          return (
            <div key={kind} className="stack">
              <h3 className="small">{MENU_KIND_LABELS[kind]}</h3>
              {list.map((i) => (
                <PriceRow
                  key={i.id}
                  eventId={eventId}
                  item={i}
                  change={changes.get(i.id)}
                  locked={locked}
                />
              ))}
            </div>
          );
        })}
    </section>
  );
}

function PriceRow({
  eventId,
  item,
  change,
  locked,
}: {
  eventId: string;
  item: MenuItem;
  change: EventMenu | undefined;
  locked: boolean;
}) {
  const engine = useSyncEngine();
  const [text, setText] = useState(centsField(change?.priceCents));
  const [error, setError] = useState<string | null>(null);
  const offered = change?.offered ?? true;
  const current = priceAtEvent(
    item,
    change ? { price: change.priceCents as Cents | null, offered } : null,
  );

  const save = (priceCents: number | null, nextOffered: boolean) =>
    void engine.mutate("event.setMenuItem", {
      eventId,
      menuItemId: item.id,
      priceCents,
      offered: nextOffered,
    });

  function commitPrice() {
    const parsed = optionalDollarsInput.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the price");
      return;
    }
    setError(null);
    if (parsed.data !== (change?.priceCents ?? null)) save(parsed.data, offered);
  }

  return (
    <div className="row" style={{ justifyContent: "space-between", opacity: offered ? 1 : 0.6 }}>
      <label className="row small" style={{ alignItems: "center", gap: 6, flex: 1 }}>
        <input
          type="checkbox"
          checked={offered}
          disabled={locked}
          onChange={() => save(change?.priceCents ?? null, !offered)}
          style={{ width: "auto" }}
        />
        {item.name}
        <span className="muted">· usual {describePrice(item)}</span>
      </label>
      <div className="small" style={{ width: 140 }}>
        <input
          inputMode="decimal"
          aria-label={`Price at this event for ${item.name}`}
          placeholder={current.price === null ? "At checkout" : "Usual"}
          value={text}
          disabled={locked || !offered}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={(e) => e.key === "Enter" && commitPrice()}
        />
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  );
}

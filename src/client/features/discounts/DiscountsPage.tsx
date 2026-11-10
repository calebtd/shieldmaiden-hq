import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { formatCents, formatPercent, type Bps, type Cents } from "@domain/money";
import type { DiscountType } from "@shared/entities/discount";
import { useDb, useSyncEngine } from "../../app/sync";
import { RejectedChanges } from "../../components/RejectedChanges";
import { DiscountForm } from "./DiscountForm";

export function DiscountsPage() {
  const db = useDb();
  const discounts = useLiveQuery(() => db.discountTypes.toArray(), [db]);
  const sorted = [...(discounts ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const active = sorted.filter((d) => d.active);
  const off = sorted.filter((d) => !d.active);

  return (
    <>
      <h1>Discounts</h1>
      <RejectedChanges />
      <DiscountForm />
      <section className="stack" aria-label="Discounts in use">
        <h2>In use ({active.length})</h2>
        {discounts && active.length === 0 && (
          <p className="empty">
            No discounts yet. Add Friends &amp; Family, Referral, or Comp above.
          </p>
        )}
        {active.map((d) => (
          <DiscountRow key={d.id} discount={d} />
        ))}
      </section>
      {off.length > 0 && (
        <section className="stack" aria-label="Turned off discounts">
          <h2>Turned off ({off.length})</h2>
          {off.map((d) => (
            <DiscountRow key={d.id} discount={d} />
          ))}
        </section>
      )}
    </>
  );
}

export function describeDiscount(d: DiscountType): string {
  return d.kind === "percent"
    ? `${formatPercent((d.percentBps ?? 0) as Bps)} off`
    : `${formatCents((d.amountCents ?? 0) as Cents)} off`;
}

function DiscountRow({ discount }: { discount: DiscountType }) {
  const engine = useSyncEngine();
  const [editing, setEditing] = useState(false);
  if (editing) return <DiscountForm discount={discount} onDone={() => setEditing(false)} />;

  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{discount.name}</strong>
          <span className="chip">{describeDiscount(discount)}</span>
          {discount.reducesCommission && <span className="chip warn">Lowers commission</span>}
          {discount.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        <div className="row">
          <button type="button" className="compact" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className={discount.active ? "danger compact" : "compact"}
            onClick={() =>
              void engine.mutate("discount.update", {
                id: discount.id,
                active: !discount.active,
              })
            }
          >
            {discount.active ? "Turn off" : "Turn back on"}
          </button>
        </div>
      </div>
    </article>
  );
}

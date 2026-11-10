import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { canDo } from "@domain/menu";
import { formatCents, type Cents } from "@domain/money";
import { MENU_KIND_LABELS, MENU_KINDS, type MenuItem, type Skill } from "@shared/entities/menu";
import type { Staff } from "@shared/entities/staff";
import { useDb, useSyncEngine } from "../../app/sync";
import { RejectedChanges } from "../../components/RejectedChanges";
import { loadStarterMenu } from "./loadStarter";
import { MenuItemForm } from "./MenuItemForm";
import { STARTER_MENU } from "./starterMenu";

const starterCount = (kind: string) => STARTER_MENU.filter((i) => i.kind === kind).length;

export function describePrice(item: { priceCents: number; openPrice: boolean }): string {
  return item.openPrice ? "Price at checkout" : formatCents(item.priceCents as Cents);
}

export function MenuPage() {
  const db = useDb();
  const data = useLiveQuery(async () => {
    const [items, skills, staff, staffSkills] = await Promise.all([
      db.menuItems.toArray(),
      db.skills.toArray(),
      db.staff.toArray(),
      db.staffSkills.toArray(),
    ]);
    const skillsOf = new Map<string, Set<string>>();
    for (const r of staffSkills) {
      if (!r.has) continue;
      const set = skillsOf.get(r.staffId) ?? new Set<string>();
      set.add(r.skillId);
      skillsOf.set(r.staffId, set);
    }
    const braiders = staff.filter((s) => s.active && s.role !== "checkout");
    return { items, skills: skills.filter((s) => s.active), braiders, skillsOf };
  }, [db]);
  if (!data) return null;
  const { items, skills, braiders, skillsOf } = data;
  const whoCanDo = (item: MenuItem) =>
    braiders.filter((b) => canDo(skillsOf.get(b.id) ?? new Set(), item.skillIds));

  return (
    <>
      <h1>Menu</h1>
      <p className="muted">Prices include sales tax, just like the price board.</p>
      <RejectedChanges />
      {/* A brand-new (or demo) menu: offer the real one. */}
      {items.length < 10 && <StarterPanel />}
      <MenuItemForm skills={skills} />
      {MENU_KINDS.map((kind) => {
        const list = items
          .filter((i) => i.kind === kind)
          .sort((a, b) => a.name.localeCompare(b.name));
        const off = list.filter((i) => !i.active);
        return (
          <section key={kind} className="stack" aria-label={MENU_KIND_LABELS[kind]}>
            <h2>
              {MENU_KIND_LABELS[kind]} ({list.length - off.length})
            </h2>
            {list.length === 0 && <p className="empty">Nothing here yet.</p>}
            {[...list.filter((i) => i.active), ...off].map((i) => (
              <MenuRow
                key={i.id}
                item={i}
                skills={skills}
                canDo={i.skillIds.length ? whoCanDo(i) : null}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}

function StarterPanel() {
  const db = useDb();
  const engine = useSyncEngine();
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel banner warn" aria-label="Load the menu">
      <p>
        Load the menu from Square and the price board (Nov 10): {starterCount("braid")} braids,{" "}
        {starterCount("addon")} add-ons, {starterCount("retail")} retail items. You can change
        anything afterwards. Anything already on the menu is skipped.
      </p>
      <div>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void loadStarterMenu(db, engine).finally(() => setBusy(false));
          }}
        >
          {busy ? "Loading…" : "Load our current menu"}
        </button>
      </div>
    </section>
  );
}

function MenuRow({
  item,
  skills,
  canDo,
}: {
  item: MenuItem;
  skills: Skill[];
  canDo: Staff[] | null;
}) {
  const engine = useSyncEngine();
  const [editing, setEditing] = useState(false);
  if (editing) return <MenuItemForm item={item} skills={skills} onDone={() => setEditing(false)} />;
  const needs = item.skillIds.map((id) => skills.find((s) => s.id === id)?.name ?? "?");

  return (
    <article className="panel" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{item.name}</strong>
          <span className="chip">{describePrice(item)}</span>
          {item.minutes !== null && <span className="chip muted">{item.minutes} min</span>}
          {!item.active && <span className="chip muted">Turned off</span>}
          {item.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        <div className="row">
          <button type="button" className="compact" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            type="button"
            className={item.active ? "danger compact" : "compact"}
            onClick={() => void engine.mutate("menu.update", { id: item.id, active: !item.active })}
          >
            {item.active ? "Turn off" : "Turn back on"}
          </button>
        </div>
      </div>
      {item.description && <p className="small muted">{item.description}</p>}
      {canDo && (
        <p className="small">
          Needs {needs.join(" + ")} ·{" "}
          {canDo.length
            ? `Can do it: ${canDo.map((b) => b.name).join(", ")}`
            : "No one has this skill yet"}
        </p>
      )}
    </article>
  );
}

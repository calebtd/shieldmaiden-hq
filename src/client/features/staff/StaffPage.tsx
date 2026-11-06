import { useLiveQuery } from "dexie-react-hooks";
import { useState, type SyntheticEvent } from "react";
import type { Staff } from "@shared/entities/staff";
import { newId } from "@shared/ids";
import { ROLE_LABELS, ROLES, type Role } from "@shared/roles";
import { useDb, useSyncEngine } from "../../app/sync";
import { fieldErrors } from "../../components/forms";
import { RejectedChanges } from "../../components/RejectedChanges";

function formatPhone(digits: string | null): string {
  if (!digits || digits.length !== 10) return digits ?? "";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function StaffPage() {
  const db = useDb();
  const staff = useLiveQuery(() => db.staff.orderBy("id").toArray(), [db]);
  const active = staff?.filter((s) => s.active).sort(byName) ?? [];
  const inactive = staff?.filter((s) => !s.active).sort(byName) ?? [];

  return (
    <>
      <h1>Staff</h1>
      <RejectedChanges />
      <AddStaffForm />
      <section className="stack" aria-label="Active staff">
        <h2>Active ({active.length})</h2>
        {staff && active.length === 0 && <p className="empty">No one yet. Add your team above.</p>}
        {active.map((s) => (
          <StaffRow key={s.id} person={s} />
        ))}
      </section>
      {inactive.length > 0 && (
        <section className="stack" aria-label="Turned off">
          <h2>Turned off ({inactive.length})</h2>
          {inactive.map((s) => (
            <StaffRow key={s.id} person={s} />
          ))}
        </section>
      )}
    </>
  );
}

const byName = (a: Staff, b: Staff) => a.name.localeCompare(b.name);

function AddStaffForm() {
  const engine = useSyncEngine();
  const [form, setForm] = useState({ name: "", role: "braider" as Role, email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await engine.mutate("staff.create", { id: newId(), ...form });
      setForm({ name: "", role: form.role, email: "", phone: "" });
      setErrors({});
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form className="panel" onSubmit={(e) => void submit(e)} noValidate>
      <h2>Add someone</h2>
      <div className="staff-grid">
        <label>
          Name
          <input
            value={form.name}
            onChange={set("name")}
            autoCapitalize="words"
            autoComplete="off"
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <label>
          Role
          <select value={form.role} onChange={set("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Email (used to sign in)
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            autoComplete="off"
            inputMode="email"
          />
          {errors.email && <span className="error">{errors.email}</span>}
        </label>
        <label>
          Phone
          <input
            type="tel"
            value={form.phone}
            onChange={set("phone")}
            autoComplete="off"
            inputMode="tel"
          />
          {errors.phone && <span className="error">{errors.phone}</span>}
        </label>
      </div>
      {errors._form && <p className="error">{errors._form}</p>}
      <div>
        <button type="submit" className="primary">
          Add to staff
        </button>
      </div>
    </form>
  );
}

function StaffRow({ person }: { person: Staff }) {
  const engine = useSyncEngine();
  const [error, setError] = useState<string | null>(null);

  async function update(changes: { role?: Role; active?: boolean }) {
    try {
      await engine.mutate("staff.update", { id: person.id, ...changes });
      setError(null);
    } catch (err) {
      setError(fieldErrors(err)._form ?? "Couldn't save that change.");
    }
  }

  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{person.name}</strong>
          <span className="chip">{ROLE_LABELS[person.role]}</span>
          {person.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        <div className="row">
          <select
            aria-label={`Role for ${person.name}`}
            value={person.role}
            onChange={(e) => void update({ role: e.target.value as Role })}
            style={{ width: "auto", minHeight: 40 }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={person.active ? "danger compact" : "compact"}
            onClick={() => void update({ active: !person.active })}
          >
            {person.active ? "Turn off" : "Turn back on"}
          </button>
        </div>
      </div>
      {(person.email || person.phone) && (
        <p className="small muted">
          {[person.email, formatPhone(person.phone)].filter(Boolean).join(" · ")}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}

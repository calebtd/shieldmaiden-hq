import { useState, type SyntheticEvent } from "react";
import type { PayProfile } from "@shared/entities/pay";
import type { Staff } from "@shared/entities/staff";
import { ROLE_LABELS, ROLES, type Role } from "@shared/roles";
import { useSyncEngine } from "../../app/sync";
import { fieldErrors } from "../../components/forms";
import { useSession } from "../../session/session";
import { PayLine } from "./PayEditor";

export function formatPhone(digits: string | null): string {
  if (!digits || digits.length !== 10) return digits ?? "";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** One staff member: their details, pay, role, on/off, and an edit form. */
export function StaffRow({ person, pay }: { person: Staff; pay: PayProfile | undefined }) {
  const engine = useSyncEngine();
  const isMe = useSession().staffId === person.id;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(changes: { role?: Role; active?: boolean }) {
    try {
      await engine.mutate("staff.update", { id: person.id, ...changes });
      setError(null);
    } catch (err) {
      setError(fieldErrors(err)._form ?? "Couldn't save that change.");
    }
  }

  if (editing) return <EditStaff person={person} onDone={() => setEditing(false)} />;

  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{person.name}</strong>
          {isMe && <span className="chip muted">You</span>}
          <span className="chip">{ROLE_LABELS[person.role]}</span>
          {person.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        <div className="row">
          <button type="button" className="compact" onClick={() => setEditing(true)}>
            Edit
          </button>
          {!isMe && (
            <>
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
            </>
          )}
        </div>
      </div>
      {(person.email || person.phone) && (
        <p className="small muted">
          {[person.email, formatPhone(person.phone)].filter(Boolean).join(" · ")}
        </p>
      )}
      {person.active && (
        <PayLine staffId={person.id} name={person.name} role={person.role} profile={pay} />
      )}
      {error && <p className="error">{error}</p>}
    </article>
  );
}

function EditStaff({ person, onDone }: { person: Staff; onDone: () => void }) {
  const engine = useSyncEngine();
  const [form, setForm] = useState({
    name: person.name,
    email: person.email ?? "",
    phone: formatPhone(person.phone),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await engine.mutate("staff.update", { id: person.id, ...form });
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form className="panel" onSubmit={(e) => void save(e)} noValidate>
      <h2>Edit {person.name}</h2>
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
      <div className="row">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

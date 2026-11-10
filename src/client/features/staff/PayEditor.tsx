import { useState, type SyntheticEvent } from "react";
import { z } from "zod";
import { PAY_PRESETS } from "@domain/pay";
import { dollarsInput, percentInput } from "@shared/entities/money";
import type { PayProfile } from "@shared/entities/pay";
import type { Role } from "@shared/roles";
import { useSyncEngine } from "../../app/sync";
import { centsField, describePay, percentField } from "../../components/format";
import { fieldErrors } from "../../components/forms";

const payForm = z.object({
  hourlyCents: dollarsInput,
  commissionBps: percentInput,
  tipShareBps: percentInput,
});

const PRESETS = [
  { label: "Braider", rates: PAY_PRESETS.braider },
  { label: "Checkout", rates: PAY_PRESETS.checkout },
  { label: "Family (tips only)", rates: PAY_PRESETS.family },
] as const;

function toFields(r: { hourly: number | null; commission: number; tipShare: number }) {
  return {
    hourlyCents: centsField(r.hourly),
    commissionBps: percentField(r.commission),
    tipShareBps: percentField(r.tipShare),
  };
}

/** One line showing someone's usual pay, with a form to change it. */
export function PayLine({
  staffId,
  name,
  role,
  profile,
}: {
  staffId: string;
  name: string;
  role: Role;
  profile: PayProfile | undefined;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <PayForm
        staffId={staffId}
        name={name}
        role={role}
        profile={profile}
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <div className="row" style={{ justifyContent: "space-between" }}>
      <span className={profile ? "small" : "small error"}>
        {profile ? describePay(profile) : "No pay set yet"}
      </span>
      <button type="button" className="compact" onClick={() => setEditing(true)}>
        {profile ? "Change pay" : "Set pay"}
      </button>
    </div>
  );
}

function PayForm({
  staffId,
  name,
  role,
  profile,
  onDone,
}: {
  staffId: string;
  name: string;
  role: Role;
  profile: PayProfile | undefined;
  onDone: () => void;
}) {
  const engine = useSyncEngine();
  const [form, setForm] = useState(
    profile
      ? toFields({
          hourly: profile.hourlyCents,
          commission: profile.commissionBps,
          tipShare: profile.tipShareBps,
        })
      : toFields(role === "checkout" ? PAY_PRESETS.checkout : PAY_PRESETS.braider),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await engine.mutate("pay.set", { staffId, ...payForm.parse(form) });
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <form
      className="stack"
      onSubmit={(e) => void save(e)}
      noValidate
      aria-label={`Pay for ${name}`}
    >
      <div className="row small">
        Start from:
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="ghost compact"
            onClick={() => setForm(toFields(p.rates))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="staff-grid">
        <label>
          Hourly ($)
          <input inputMode="decimal" value={form.hourlyCents} onChange={set("hourlyCents")} />
          {errors.hourlyCents && <span className="error">{errors.hourlyCents}</span>}
        </label>
        <label>
          Commission (%)
          <input inputMode="decimal" value={form.commissionBps} onChange={set("commissionBps")} />
          {errors.commissionBps && <span className="error">{errors.commissionBps}</span>}
        </label>
        <label>
          Keeps this much of tips (%)
          <input inputMode="decimal" value={form.tipShareBps} onChange={set("tipShareBps")} />
          {errors.tipShareBps && <span className="error">{errors.tipShareBps}</span>}
        </label>
      </div>
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          Save pay
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

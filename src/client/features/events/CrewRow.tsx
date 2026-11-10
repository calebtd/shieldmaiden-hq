import { useState, type SyntheticEvent } from "react";
import { z } from "zod";
import type { Bps, Cents } from "@domain/money";
import { isEmptyOverride, resolvePayRates, type PayOverride } from "@domain/pay";
import type { EventStaff } from "@shared/entities/event";
import { optionalDollarsInput, optionalPercentInput } from "@shared/entities/money";
import type { PayProfile } from "@shared/entities/pay";
import type { Staff } from "@shared/entities/staff";
import { ROLE_LABELS } from "@shared/roles";
import { useSyncEngine } from "../../app/sync";
import { centsField, describePay, percentField } from "../../components/format";
import { fieldErrors } from "../../components/forms";

const overrideForm = z.object({
  hourlyCents: optionalDollarsInput,
  commissionBps: optionalPercentInput,
  tipShareBps: optionalPercentInput,
  note: z.string(),
});

function toOverride(entry: EventStaff | undefined): PayOverride | null {
  if (!entry) return null;
  return {
    hourly: entry.hourlyCents as Cents | null,
    commission: entry.commissionBps as Bps | null,
    tipShare: entry.tipShareBps as Bps | null,
  };
}

function toRates(p: PayProfile | undefined) {
  return p
    ? {
        hourly: p.hourlyCents as Cents,
        commission: p.commissionBps as Bps,
        tipShare: p.tipShareBps as Bps,
      }
    : null;
}

/** One person on an event's page: whether they're working, and their pay there. */
export function CrewRow({
  eventId,
  person,
  entry,
  profile,
  locked,
}: {
  eventId: string;
  person: Staff;
  entry: EventStaff | undefined;
  profile: PayProfile | undefined;
  locked: boolean;
}) {
  const engine = useSyncEngine();
  const [editing, setEditing] = useState(false);
  const working = entry?.working ?? false;
  const override = toOverride(entry);
  const rates = resolvePayRates(toRates(profile), override);
  const special = !isEmptyOverride(override);

  const setWorking = (value: boolean) =>
    void engine.mutate("event.setWorking", { eventId, staffId: person.id, working: value });

  return (
    <article className="panel" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <strong>{person.name}</strong>
          <span className="chip">{ROLE_LABELS[person.role]}</span>
          {working && special && <span className="chip info">Special pay</span>}
        </div>
        {!locked && (
          <button
            type="button"
            className={working ? "compact" : "primary compact"}
            onClick={() => setWorking(!working)}
          >
            {working ? "Take off event" : "Add to event"}
          </button>
        )}
      </div>
      {working && !editing && (
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className={rates ? "small" : "small error"}>
            {rates
              ? describePay({
                  hourlyCents: rates.hourly,
                  commissionBps: rates.commission,
                  tipShareBps: rates.tipShare,
                })
              : "No pay set yet. Set it on the Staff screen."}
            {entry?.note && ` · ${entry.note}`}
          </span>
          {!locked && (
            <button type="button" className="compact" onClick={() => setEditing(true)}>
              Pay at this event
            </button>
          )}
        </div>
      )}
      {working && editing && (
        <OverrideForm
          eventId={eventId}
          person={person}
          entry={entry}
          profile={profile}
          onDone={() => setEditing(false)}
        />
      )}
    </article>
  );
}

function OverrideForm({
  eventId,
  person,
  entry,
  profile,
  onDone,
}: {
  eventId: string;
  person: Staff;
  entry: EventStaff | undefined;
  profile: PayProfile | undefined;
  onDone: () => void;
}) {
  const engine = useSyncEngine();
  const [form, setForm] = useState({
    hourlyCents: centsField(entry?.hourlyCents),
    commissionBps: percentField(entry?.commissionBps),
    tipShareBps: percentField(entry?.tipShareBps),
    note: entry?.note ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await engine.mutate("event.setPayOverride", {
        eventId,
        staffId: person.id,
        ...overrideForm.parse(form),
      });
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  async function resetToUsual() {
    await engine.mutate("event.setPayOverride", {
      eventId,
      staffId: person.id,
      hourlyCents: null,
      commissionBps: null,
      tipShareBps: null,
      note: null,
    });
    onDone();
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });
  const usual = (value: string, suffix: string) => (value ? `Usual: ${value}${suffix}` : "Usual");

  return (
    <form
      className="stack"
      onSubmit={(e) => void save(e)}
      noValidate
      aria-label={`Pay for ${person.name} at this event`}
    >
      <p className="small muted">
        Fill in only what&apos;s different at this event. Leave a box empty to use their usual rate.
        For a one-off bonus, add an adjustment at close-out instead.
      </p>
      <div className="staff-grid">
        <label>
          Hourly ($)
          <input
            inputMode="decimal"
            placeholder={usual(centsField(profile?.hourlyCents), "")}
            value={form.hourlyCents}
            onChange={set("hourlyCents")}
          />
          {errors.hourlyCents && <span className="error">{errors.hourlyCents}</span>}
        </label>
        <label>
          Commission (%)
          <input
            inputMode="decimal"
            placeholder={usual(percentField(profile?.commissionBps), "%")}
            value={form.commissionBps}
            onChange={set("commissionBps")}
          />
          {errors.commissionBps && <span className="error">{errors.commissionBps}</span>}
        </label>
        <label>
          Keeps this much of tips (%)
          <input
            inputMode="decimal"
            placeholder={usual(percentField(profile?.tipShareBps), "%")}
            value={form.tipShareBps}
            onChange={set("tipShareBps")}
          />
          {errors.tipShareBps && <span className="error">{errors.tipShareBps}</span>}
        </label>
        <label>
          Why (optional)
          <input placeholder="e.g. Training day" value={form.note} onChange={set("note")} />
          {errors.note && <span className="error">{errors.note}</span>}
        </label>
      </div>
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={() => void resetToUsual()}>
          Use usual pay
        </button>
        <button type="button" className="ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

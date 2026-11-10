import { useState, type SyntheticEvent } from "react";
import { z } from "zod";
import type { ShowEvent } from "@shared/entities/event";
import { percentInput } from "@shared/entities/money";
import { newId } from "@shared/ids";
import { useSyncEngine } from "../../app/sync";
import { percentField } from "../../components/format";
import { fieldErrors } from "../../components/forms";

const taxField = z.object({ taxRateBps: percentInput });

const blank = { name: "", city: "", startDate: "", endDate: "", taxRateBps: "" };

/** Adds a new event, or edits one when `event` is given. */
export function EventForm({ event, onDone }: { event?: ShowEvent; onDone?: () => void }) {
  const engine = useSyncEngine();
  const [form, setForm] = useState(
    event
      ? {
          name: event.name,
          city: event.city,
          startDate: event.startDate,
          endDate: event.endDate,
          taxRateBps: percentField(event.taxRateBps),
        }
      : blank,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      const fields = { ...form, ...taxField.parse({ taxRateBps: form.taxRateBps }) };
      if (event) {
        await engine.mutate("event.update", { id: event.id, ...fields });
      } else {
        await engine.mutate("event.create", { id: newId(), ...fields });
        setForm(blank);
      }
      setErrors({});
      onDone?.();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    const next = { ...form, [key]: e.target.value };
    // Most events are a weekend: fill the end date in when the start is picked.
    if (key === "startDate" && (!form.endDate || form.endDate < e.target.value)) {
      next.endDate = e.target.value;
    }
    setForm(next);
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)} noValidate>
      <h2>{event ? `Edit ${event.name}` : "Add an event"}</h2>
      <div className="staff-grid">
        <label>
          Event name
          <input value={form.name} onChange={set("name")} autoComplete="off" />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <label>
          City
          <input value={form.city} onChange={set("city")} autoComplete="off" />
          {errors.city && <span className="error">{errors.city}</span>}
        </label>
        <label>
          First day
          <input type="date" value={form.startDate} onChange={set("startDate")} />
          {errors.startDate && <span className="error">{errors.startDate}</span>}
        </label>
        <label>
          Last day
          <input type="date" value={form.endDate} onChange={set("endDate")} />
          {errors.endDate && <span className="error">{errors.endDate}</span>}
        </label>
        <label>
          Sales tax (%)
          <input
            inputMode="decimal"
            placeholder="e.g. 6"
            value={form.taxRateBps}
            onChange={set("taxRateBps")}
          />
          {errors.taxRateBps && <span className="error">{errors.taxRateBps}</span>}
        </label>
      </div>
      <p className="small muted">
        Use the combined rate for the event&apos;s city (state + local). Prices already include it.
      </p>
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          {event ? "Save" : "Add event"}
        </button>
        {onDone && event && (
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

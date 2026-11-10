import { useState, type SyntheticEvent } from "react";
import { z } from "zod";
import {
  MENU_KIND_LABELS,
  MENU_KINDS,
  type MenuItem,
  type MenuKind,
  type Skill,
} from "@shared/entities/menu";
import { dollarsInput } from "@shared/entities/money";
import { newId } from "@shared/ids";
import { useSyncEngine } from "../../app/sync";
import { centsField } from "../../components/format";
import { fieldErrors } from "../../components/forms";

const minutesInput = z
  .string()
  .trim()
  .transform((t, ctx) => {
    if (t === "") return null;
    if (!/^\d+$/.test(t)) {
      ctx.addIssue({ code: "custom", message: "Whole minutes, like 15" });
      return z.NEVER;
    }
    return Number(t);
  });

const SINGULAR: Record<MenuKind, string> = { braid: "Braid", addon: "Add-on", retail: "Retail" };

/** Adds a menu item, or edits one when `item` is given. */
export function MenuItemForm({
  item,
  skills,
  onDone,
}: {
  item?: MenuItem;
  skills: Skill[];
  onDone?: () => void;
}) {
  const engine = useSyncEngine();
  const blank = {
    kind: item?.kind ?? "braid",
    name: item?.name ?? "",
    price: item && !item.openPrice ? centsField(item.priceCents) : "",
    openPrice: item?.openPrice ?? false,
    minutes: item?.minutes?.toString() ?? "",
    description: item?.description ?? "",
    skillIds: item?.skillIds ?? [],
  };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      const priceCents = form.openPrice ? 0 : z.object({ price: dollarsInput }).parse(form).price;
      const minutes =
        form.kind === "retail" ? null : z.object({ minutes: minutesInput }).parse(form).minutes;
      const fields = {
        name: form.name,
        priceCents,
        openPrice: form.openPrice,
        minutes,
        description: form.description,
        skillIds: form.kind === "braid" ? form.skillIds : [],
      };
      if (item) await engine.mutate("menu.update", { id: item.id, ...fields });
      else await engine.mutate("menu.create", { id: newId(), kind: form.kind, ...fields });
      if (!item) setForm({ ...blank, kind: form.kind });
      setErrors({});
      onDone?.();
    } catch (err) {
      const errs = fieldErrors(err);
      if (errs.priceCents) errs.price = errs.priceCents;
      setErrors(errs);
    }
  }

  const set =
    (k: "name" | "price" | "minutes" | "description") => (e: { target: { value: string } }) =>
      setForm({ ...form, [k]: e.target.value });
  const toggleSkill = (id: string) =>
    setForm({
      ...form,
      skillIds: form.skillIds.includes(id)
        ? form.skillIds.filter((s) => s !== id)
        : [...form.skillIds, id],
    });

  return (
    <form className="panel" onSubmit={(e) => void submit(e)} noValidate>
      <h2>{item ? `Edit ${item.name}` : "Add to the menu"}</h2>
      <div className="staff-grid">
        {!item && (
          <label>
            Section
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as MenuKind })}
            >
              {MENU_KINDS.map((k) => (
                <option key={k} value={k}>
                  {MENU_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Name
          <input value={form.name} onChange={set("name")} autoComplete="off" />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <label>
          Price with tax ($)
          <input
            inputMode="decimal"
            value={form.price}
            onChange={set("price")}
            disabled={form.openPrice}
          />
          {errors.price && <span className="error">{errors.price}</span>}
        </label>
        {form.kind !== "retail" && (
          <label>
            {form.kind === "braid" ? "About how long (minutes)" : "Extra time (minutes)"}
            <input inputMode="numeric" value={form.minutes} onChange={set("minutes")} />
            {errors.minutes && <span className="error">{errors.minutes}</span>}
          </label>
        )}
      </div>
      <label className="row" style={{ alignItems: "center" }}>
        <input
          type="checkbox"
          checked={form.openPrice}
          onChange={(e) => setForm({ ...form, openPrice: e.target.checked })}
          style={{ width: "auto" }}
        />
        Price is decided at checkout
      </label>
      <label>
        Notes (optional)
        <input value={form.description} onChange={set("description")} />
      </label>
      {form.kind === "braid" && skills.length > 0 && (
        <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small">
            Only braiders with these skills can do it (none = anyone)
          </legend>
          {skills.map((s) => (
            <label key={s.id} className="row small" style={{ alignItems: "center", gap: 4 }}>
              <input
                type="checkbox"
                checked={form.skillIds.includes(s.id)}
                onChange={() => toggleSkill(s.id)}
                style={{ width: "auto" }}
              />
              {s.name}
            </label>
          ))}
        </fieldset>
      )}
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          {item ? "Save" : `Add ${SINGULAR[form.kind].toLowerCase()}`}
        </button>
        {item && onDone && (
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

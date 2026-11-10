import { useState, type SyntheticEvent } from "react";
import type { DiscountType } from "@shared/entities/discount";
import { dollarsInput, percentInput } from "@shared/entities/money";
import { newId } from "@shared/ids";
import { useSyncEngine } from "../../app/sync";
import { centsField, percentField } from "../../components/format";
import { fieldErrors } from "../../components/forms";

type Kind = "percent" | "amount";

/** Adds a discount type, or edits one when `discount` is given. */
export function DiscountForm({
  discount,
  onDone,
}: {
  discount?: DiscountType;
  onDone?: () => void;
}) {
  const engine = useSyncEngine();
  const initial = {
    name: discount?.name ?? "",
    kind: discount?.kind ?? "percent",
    value:
      discount?.kind === "amount"
        ? centsField(discount.amountCents)
        : percentField(discount?.percentBps),
    reducesCommission: discount?.reducesCommission ?? false,
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      const parsed = (form.kind === "percent" ? percentInput : dollarsInput).safeParse(form.value);
      if (!parsed.success) {
        setErrors({ value: parsed.error.issues[0]?.message ?? "Check the amount" });
        return;
      }
      const rule =
        form.kind === "percent"
          ? { kind: "percent" as const, percentBps: parsed.data }
          : { kind: "amount" as const, amountCents: parsed.data };
      const args = { name: form.name, rule, reducesCommission: form.reducesCommission };
      if (discount) await engine.mutate("discount.update", { id: discount.id, ...args });
      else await engine.mutate("discount.create", { id: newId(), ...args });
      if (!discount) setForm({ ...initial, kind: form.kind });
      setErrors({});
      onDone?.();
    } catch (err) {
      // Errors on the rule (e.g. over 100%) belong next to the amount box.
      const errs = fieldErrors(err);
      if (errs.rule) errs.value = errs.rule;
      setErrors(errs);
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void submit(e)} noValidate>
      <h2>{discount ? `Edit ${discount.name}` : "Add a discount"}</h2>
      <div className="staff-grid">
        <label>
          Name
          <input
            value={form.name}
            placeholder="e.g. Friends & Family"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoComplete="off"
          />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>
        <label>
          Type
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Kind, value: "" })}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Dollars off</option>
          </select>
        </label>
        <label>
          {form.kind === "percent" ? "Percent off (%)" : "Dollars off ($)"}
          <input
            inputMode="decimal"
            value={form.value}
            placeholder={form.kind === "percent" ? "e.g. 20" : "e.g. 10"}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
          {errors.value && <span className="error">{errors.value}</span>}
        </label>
      </div>
      <label className="row" style={{ alignItems: "center" }}>
        <input
          type="checkbox"
          checked={form.reducesCommission}
          onChange={(e) => setForm({ ...form, reducesCommission: e.target.checked })}
          style={{ width: "auto" }}
        />
        Lowers the braider&apos;s commission
      </label>
      <p className="small muted">
        Usually off: braiders earn commission on the full price, and the business covers the
        discount. Turn on for discounts the braider agrees to share, like a comp for a redo.
      </p>
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          {discount ? "Save" : "Add discount"}
        </button>
        {discount && onDone && (
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

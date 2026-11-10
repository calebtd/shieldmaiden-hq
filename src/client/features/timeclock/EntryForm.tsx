import { useState, type SyntheticEvent } from "react";
import { timeProblem } from "@domain/time";
import type { TimeEntry, TimeKind } from "@shared/entities/time";
import { newId } from "@shared/ids";
import { useSyncEngine } from "../../app/sync";
import { fieldErrors } from "../../components/forms";
import { fromLocalInput, toLocalInput } from "./clock";

type Props =
  | { mode: "fix"; entry: TimeEntry; onDone: () => void }
  | { mode: "add"; eventId: string; staffId: string; onDone: () => void };

/** Fix an entry's times, or add one that was missed. Both need a reason. */
export function EntryForm(props: Props) {
  const engine = useSyncEngine();
  const fixing = props.mode === "fix" ? props.entry : null;
  const running = fixing !== null && fixing.endAt === null;
  const [kind, setKind] = useState<TimeKind>(fixing?.kind ?? "work");
  const [start, setStart] = useState(fixing ? toLocalInput(fixing.startAt) : "");
  const [end, setEnd] = useState(fixing?.endAt ? toLocalInput(fixing.endAt) : "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    const startAt = fromLocalInput(start);
    const endAt = fromLocalInput(end);
    if (startAt === null) return setErrors({ start: "Pick the start time" });
    // A running shift can be fixed without ending it.
    const problem = timeProblem({ start: startAt, end: endAt }, Date.now(), running);
    if (problem) return setErrors({ [/end/i.test(problem) ? "end" : "start"]: problem });
    try {
      if (fixing) {
        await engine.mutate("time.correct", {
          id: newId(),
          replacesId: fixing.id,
          startAt,
          endAt,
          reason,
        });
      } else if (props.mode === "add" && endAt !== null) {
        const { eventId, staffId } = props;
        await engine.mutate("time.add", {
          id: newId(),
          eventId,
          staffId,
          kind,
          startAt,
          endAt,
          reason,
        });
      }
      props.onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
    }
  }

  return (
    <form
      className="panel"
      onSubmit={(e) => void submit(e)}
      noValidate
      aria-label={fixing ? "Fix times" : "Add missed time"}
    >
      <h2>
        {fixing ? `Fix this ${fixing.kind === "work" ? "shift" : "break"}` : "Add missed time"}
      </h2>
      {!fixing && (
        <label>
          What
          <select value={kind} onChange={(e) => setKind(e.target.value as TimeKind)}>
            <option value="work">Shift</option>
            <option value="break">Break</option>
          </select>
        </label>
      )}
      <div className="staff-grid">
        <label>
          Started
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          {errors.start && <span className="error">{errors.start}</span>}
        </label>
        <label>
          {running ? "Ended (leave empty if still working)" : "Ended"}
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          {errors.end && <span className="error">{errors.end}</span>}
        </label>
      </div>
      <label>
        Why
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Forgot to clock out"
        />
        {errors.reason && <span className="error">{errors.reason}</span>}
      </label>
      {errors._form && <p className="error">{errors._form}</p>}
      <div className="row">
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={props.onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

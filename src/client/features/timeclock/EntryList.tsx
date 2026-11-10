import { useState } from "react";
import { formatDuration } from "@domain/time";
import type { TimeEntry } from "@shared/entities/time";
import { useSyncEngine } from "../../app/sync";
import { fieldErrors } from "../../components/forms";
import { formatDay, formatTime } from "./clock";
import { EntryForm } from "./EntryForm";

/**
 * Someone's shifts and breaks at one event, newest first, with Fix and Remove.
 * Replaced and removed entries stay listed (crossed out) when "Show changes" is on.
 */
export function EntryList({
  entries,
  locked,
  names,
}: {
  entries: TimeEntry[];
  locked: boolean;
  /** staffId → name, for "changed by". */
  names: Map<string, string>;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const changed = entries.filter((e) => e.voidedAt !== null).length;
  const shown = entries
    .filter((e) => showChanges || e.voidedAt === null)
    .sort((a, b) => b.startAt - a.startAt);

  return (
    <div className="stack">
      {shown.length === 0 && <p className="empty">No time yet.</p>}
      {shown.map((e) => (
        <EntryRow key={e.id} entry={e} locked={locked} names={names} />
      ))}
      {changed > 0 && (
        <div>
          <button
            type="button"
            className="ghost compact"
            onClick={() => setShowChanges(!showChanges)}
          >
            {showChanges ? "Hide changes" : `Show changes (${changed})`}
          </button>
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  locked,
  names,
}: {
  entry: TimeEntry;
  locked: boolean;
  names: Map<string, string>;
}) {
  const engine = useSyncEngine();
  const [mode, setMode] = useState<"view" | "fix" | "remove">("view");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const gone = entry.voidedAt !== null;

  if (mode === "fix") return <EntryForm mode="fix" entry={entry} onDone={() => setMode("view")} />;

  async function remove() {
    try {
      await engine.mutate("time.void", { entryId: entry.id, reason });
      setMode("view");
    } catch (err) {
      setError(fieldErrors(err).reason ?? "Couldn't remove that.");
    }
  }

  const label = entry.kind === "work" ? "Shift" : "Break";
  const span = `${formatTime(entry.startAt)} – ${entry.endAt ? formatTime(entry.endAt) : "now"}`;
  const by = names.get(entry.createdBy);

  return (
    <article className="panel" style={{ gap: 6, opacity: gone ? 0.6 : 1 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          <span className={entry.kind === "work" ? "chip" : "chip muted"}>{label}</span>
          <span style={{ textDecoration: gone ? "line-through" : "none" }}>
            {formatDay(entry.startAt)} · {span}
          </span>
          {entry.endAt !== null && (
            <span className="small muted">{formatDuration(entry.endAt - entry.startAt)}</span>
          )}
          {entry.version === 0 && <span className="chip warn">Not synced yet</span>}
        </div>
        {!gone && !locked && mode === "view" && (
          <div className="row">
            <button type="button" className="compact" onClick={() => setMode("fix")}>
              Fix
            </button>
            <button type="button" className="ghost compact" onClick={() => setMode("remove")}>
              Remove
            </button>
          </div>
        )}
      </div>
      {entry.reason && (
        <p className="small muted">
          {entry.replacesId ? "Fixed" : "Added by hand"}
          {by ? ` by ${by}` : ""}: {entry.reason}
        </p>
      )}
      {gone && (
        <p className="small muted">
          {entry.voidReason ? `Changed: ${entry.voidReason}` : "Changed"}
        </p>
      )}
      {mode === "remove" && (
        <div className="row" style={{ alignItems: "end" }}>
          <label style={{ flex: 1 }}>
            Why remove it?
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Tapped by mistake"
            />
            {error && <span className="error">{error}</span>}
          </label>
          <button type="button" className="danger" onClick={() => void remove()}>
            Remove
          </button>
          <button type="button" onClick={() => setMode("view")}>
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}

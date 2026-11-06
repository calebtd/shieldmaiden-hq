import { useSyncEngine, useSyncState } from "../app/sync";

/** Always-visible answer to "did that save?" */
export function SyncBadge() {
  const engine = useSyncEngine();
  const { status, pending, error } = useSyncState();

  const waiting = pending === 1 ? "1 change waiting" : `${pending} changes waiting`;
  let label: string;
  let tone: "" | "warn" | "info" | "danger" = "";

  switch (status) {
    case "offline":
      label = pending ? `Offline · ${waiting}` : "Offline";
      tone = "warn";
      break;
    case "signed-out":
      label = pending ? `Signed out · ${waiting}` : "Signed out";
      tone = "danger";
      break;
    case "error":
      label = pending ? `Not saved · ${waiting}` : "Sync problem";
      tone = "danger";
      break;
    case "syncing":
      label = pending ? `Saving · ${waiting}` : "Syncing…";
      tone = "info";
      break;
    default:
      label = pending ? waiting : "All saved";
  }

  const onClick = () => {
    if (status === "signed-out") window.location.reload();
    else void engine.sync();
  };

  return (
    <button
      type="button"
      className={`chip ${tone}`}
      style={{ minHeight: 32, border: "none" }}
      onClick={onClick}
      title={error ?? (status === "signed-out" ? "Tap to sign in again" : "Tap to sync now")}
      aria-live="polite"
    >
      {label}
    </button>
  );
}

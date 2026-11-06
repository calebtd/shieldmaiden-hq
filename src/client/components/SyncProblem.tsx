import { useSyncEngine, useSyncState } from "../app/sync";

/**
 * Says plainly why changes aren't saving (e.g. "Your account has been turned off"),
 * so a problem is never hidden behind a small status chip.
 */
export function SyncProblem() {
  const engine = useSyncEngine();
  const { status, error, pending } = useSyncState();
  if (status !== "error" && status !== "signed-out") return null;

  const waiting =
    pending > 0
      ? ` ${pending === 1 ? "1 change is" : `${pending} changes are`} kept on this device until it's fixed.`
      : "";

  return (
    <div className="banner danger row" role="alert" style={{ justifyContent: "space-between" }}>
      <span>
        <strong>Not saving.</strong> {error ?? "The server couldn't be reached."}
        {waiting}
      </span>
      {status === "signed-out" ? (
        <button type="button" className="compact" onClick={() => window.location.reload()}>
          Sign in
        </button>
      ) : (
        <button type="button" className="compact" onClick={() => void engine.sync()}>
          Try again
        </button>
      )}
    </div>
  );
}

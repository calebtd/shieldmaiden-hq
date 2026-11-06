import { useCallback, useEffect, useState } from "react";
import { accessListResponseSchema, type AccessListResponse } from "@shared/accessList";
import { useSyncState } from "../../app/sync";
import { apiFetch } from "../../sync/transport";

const REFRESH_MS = 15_000;

function ago(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} hr ago` : new Date(at).toLocaleDateString();
}

/**
 * Shows whether Cloudflare's sign-in list matches the staff list. Staff changes update
 * it automatically; this is here so a problem is visible and can be retried.
 */
export function AccessListPanel() {
  const [data, setData] = useState<AccessListResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { pending } = useSyncState();

  const load = useCallback(async (path: string, init?: RequestInit) => {
    try {
      setData(accessListResponseSchema.parse(await apiFetch(path, init)));
      setProblem(null);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Re-check after local staff changes reach the server, and every so often.
  useEffect(() => {
    if (pending > 0) return;
    const first = setTimeout(() => void load("/api/access-list"), 2000);
    const timer = setInterval(() => void load("/api/access-list"), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load, pending]);

  if (!data?.managed) return null;
  const s = data.status;

  async function updateNow() {
    setBusy(true);
    await load("/api/access-list/sync", { method: "POST" });
    setBusy(false);
  }

  return (
    <section className={`panel ${s && !s.ok ? "banner danger" : ""}`} aria-label="Sign-in list">
      <h2>Sign-in list</h2>
      <p className="small">
        Everyone active here with an email can sign in. Turning someone off removes them.
      </p>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="small">
          {!s && "Not updated yet."}
          {s?.ok && `Up to date · ${s.emails} emails · checked ${ago(s.at)}`}
          {s && !s.ok && `Couldn't update (${ago(s.at)}): ${s.error ?? "unknown error"}`}
          {problem && ` · ${problem}`}
        </span>
        <button type="button" className="compact" disabled={busy} onClick={() => void updateNow()}>
          {busy ? "Updating…" : "Update now"}
        </button>
      </div>
    </section>
  );
}

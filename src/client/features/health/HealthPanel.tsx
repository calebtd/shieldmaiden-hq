import { useCallback, useEffect, useState } from "react";
import { healthResponseSchema, type HealthResponse } from "@shared/ops";
import { apiFetch } from "../../sync/transport";

const REFRESH_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A nightly backup older than this means a night was missed. */
const BACKUP_LATE_MS = 26 * 60 * 60 * 1000;
/** Server problems older than this stop showing. */
const PROBLEM_SHOWN_MS = 7 * DAY_MS;

function ago(at: number): string {
  const mins = Math.round((Date.now() - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} hr ago` : new Date(at).toLocaleDateString();
}

function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Line {
  ok: boolean;
  text: string;
}

function backupLine(b: HealthResponse["backups"]): Line {
  if (!b.enabled) return { ok: true, text: "Backups: not connected on this site yet." };
  const s = b.status;
  if (!s) return { ok: true, text: "Backups: first copy tonight." };
  if (!s.ok) return { ok: false, text: `Backup failed (${ago(s.at)}): ${s.error ?? "unknown"}` };
  if (Date.now() - s.at > BACKUP_LATE_MS) {
    return { ok: false, text: `Backup missed: the last copy was ${ago(s.at)}.` };
  }
  return {
    ok: true,
    text: `Backed up ${ago(s.at)} · ${sizeLabel(s.bytes)} · ${b.keepDays} days kept`,
  };
}

function lines(h: HealthResponse): Line[] {
  const out = [backupLine(h.backups)];
  const a = h.accessList;
  if (a.managed && a.status && !a.status.ok) {
    out.push({ ok: false, text: `Sign-in list couldn't update: ${a.status.error ?? "unknown"}` });
  }
  const p = h.lastProblem;
  if (p && Date.now() - p.at < PROBLEM_SHOWN_MS) {
    out.push({ ok: false, text: `Server problem ${ago(p.at)} (${p.where}): ${p.message}` });
  }
  return out;
}

/** Owners only: is the behind-the-scenes stuff (backups, sign-in list) working? */
export function HealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(healthResponseSchema.parse(await apiFetch("/api/ops/health")));
      setProblem(null);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!data) return null;
  const all = lines(data);
  const healthy = all.every((l) => l.ok);

  async function backUpNow() {
    setBusy(true);
    try {
      await apiFetch("/api/ops/backup", { method: "POST" });
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    }
    await load();
    setBusy(false);
  }

  return (
    <section className={`panel ${healthy ? "" : "banner danger"}`} aria-label="System health">
      <h2>{healthy ? "System health: all good" : "System health: needs a look"}</h2>
      {all.map((l) => (
        <p key={l.text} className={`small ${l.ok ? "muted" : ""}`}>
          {l.text}
        </p>
      ))}
      {problem && <p className="error">{problem}</p>}
      {data.backups.enabled && (
        <div className="row">
          <button
            type="button"
            className="compact"
            disabled={busy}
            onClick={() => void backUpNow()}
          >
            {busy ? "Backing up…" : "Back up now"}
          </button>
        </div>
      )}
    </section>
  );
}

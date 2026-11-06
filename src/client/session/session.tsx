import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { sessionSchema, type Session } from "@shared/sync";
import { useDb, useSyncEngine } from "../app/sync";
import type { LocalDb } from "../db/local";
import type { SyncEngine } from "../sync/engine";
import { apiFetch, OfflineError, SignedOutError } from "../sync/transport";

export type SessionState =
  | { kind: "loading" }
  | { kind: "ready"; session: Session; offline: boolean }
  | { kind: "pick-persona" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string };

interface SessionContextValue {
  state: SessionState;
  reload: () => Promise<void>;
  /** Demo/local only: sign out of the chosen persona. */
  switchPerson: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

async function loadSession(db: LocalDb, engine: SyncEngine): Promise<SessionState> {
  const cachedRow = await db.meta.get("session");
  const cached = sessionSchema.safeParse(cachedRow?.value);
  try {
    const fresh = sessionSchema.parse(await apiFetch("/api/session"));
    if (cached.success && cached.data.staffId !== fresh.staffId) await engine.resetLocal();
    await db.meta.put({ key: "session", value: fresh });
    return { kind: "ready", session: fresh, offline: false };
  } catch (err) {
    if (err instanceof SignedOutError && err.code === "pick_persona")
      return { kind: "pick-persona" };
    // Offline or signed out: keep working from this device's copy.
    if (cached.success) return { kind: "ready", session: cached.data, offline: true };
    if (err instanceof SignedOutError) return { kind: "signed-out" };
    if (err instanceof OfflineError) {
      return { kind: "error", message: "Connect to the internet once to sign in on this device." };
    }
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Finds out who is signed in. The last known session is kept on the device so the app
 * still opens with no signal.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const engine = useSyncEngine();
  const [state, setState] = useState<SessionState>({ kind: "loading" });

  const reload = useCallback(async () => {
    setState(await loadSession(db, engine));
  }, [db, engine]);

  const switchPerson = useCallback(async () => {
    await apiFetch("/api/personas/clear", { method: "POST" });
    await engine.resetLocal();
    setState({ kind: "pick-persona" });
  }, [engine]);

  useEffect(() => {
    let cancelled = false;
    void loadSession(db, engine).then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [db, engine]);

  return (
    <SessionContext.Provider value={{ state, reload, switchPerson }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used inside SessionProvider");
  return ctx;
}

/** The signed-in session. Only use below the point where the app has checked it's ready. */
export function useSession(): Session {
  const { state } = useSessionContext();
  if (state.kind !== "ready") throw new Error("useSession called before sign-in finished");
  return state.session;
}

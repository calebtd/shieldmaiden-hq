import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { liveQuery } from "dexie";
import { meSchema, sessionSchema, type Session } from "@shared/sync";
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
  /**
   * Leaves this device signed out and empty, ready for someone else. In demo/local it
   * goes back to the person picker; with Cloudflare Access it ends the sign-in.
   */
  signOut: () => Promise<void>;
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

  const signOut = useCallback(async () => {
    const usesAccess = state.kind === "ready" && state.session.authMode === "access";
    if (!usesAccess) await apiFetch("/api/personas/clear", { method: "POST" }).catch(() => null);
    await engine.resetLocal();
    if (usesAccess) {
      // Cloudflare Access's own sign-out page; it sends the person back to sign in.
      window.location.href = "/cdn-cgi/access/logout";
    } else {
      setState({ kind: "pick-persona" });
    }
  }, [engine, state]);

  // Each sync re-confirms who this is; keep the name and role in step with it.
  useEffect(() => {
    const sub = liveQuery(() => db.meta.get("me")).subscribe((row) => {
      const me = meSchema.safeParse(row?.value);
      if (!me.success) return;
      setState((prev) => {
        if (prev.kind !== "ready") return prev;
        const s = prev.session;
        if (s.staffId === me.data.staffId && s.name === me.data.name && s.role === me.data.role) {
          return prev;
        }
        const session = { ...s, ...me.data };
        void db.meta.put({ key: "session", value: session });
        return { ...prev, session };
      });
    });
    return () => sub.unsubscribe();
  }, [db]);

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
    <SessionContext.Provider value={{ state, reload, signOut }}>{children}</SessionContext.Provider>
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

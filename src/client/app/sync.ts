import { createContext, useContext, useSyncExternalStore } from "react";
import { LocalDb } from "../db/local";
import { SyncEngine, type SyncState } from "../sync/engine";
import { httpTransport } from "../sync/transport";

/** One local database and sync engine for the whole app. */
export const localDb = new LocalDb();
export const syncEngine = new SyncEngine(localDb, httpTransport);

export const SyncContext = createContext<{ db: LocalDb; engine: SyncEngine }>({
  db: localDb,
  engine: syncEngine,
});

export function useDb(): LocalDb {
  return useContext(SyncContext).db;
}

export function useSyncEngine(): SyncEngine {
  return useContext(SyncContext).engine;
}

export function useSyncState(): SyncState {
  const engine = useSyncEngine();
  return useSyncExternalStore(engine.subscribe, engine.getState);
}

const POLL_MS = 5000;

/** Syncs on start, every few seconds while visible, and whenever the connection returns. */
export function startBackgroundSync(engine: SyncEngine): () => void {
  const run = () => {
    if (document.visibilityState === "visible") void engine.sync();
  };
  run();
  const timer = setInterval(run, POLL_MS);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", run);
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", run);
  };
}

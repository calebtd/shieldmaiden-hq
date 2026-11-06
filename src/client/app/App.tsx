import { useEffect, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import type { Role } from "@shared/roles";
import { Layout } from "../components/Layout";
import { HomePage } from "../features/home/HomePage";
import { PersonaPicker } from "../features/personas/PersonaPicker";
import { StaffPage } from "../features/staff/StaffPage";
import { SessionProvider, useSession, useSessionContext } from "../session/session";
import { startBackgroundSync, useSyncEngine } from "./sync";

export function App() {
  return (
    <SessionProvider>
      <SignInGate>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/staff"
                element={
                  <RequireRole roles={["owner"]}>
                    <StaffPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </SignInGate>
    </SessionProvider>
  );
}

/** Shows sign-in screens until we know who this is, then starts syncing. */
function SignInGate({ children }: { children: ReactNode }) {
  const { state, reload } = useSessionContext();

  switch (state.kind) {
    case "loading":
      return (
        <main className="page">
          <p className="muted">Loading…</p>
        </main>
      );
    case "pick-persona":
      return <PersonaPicker onPicked={() => void reload()} />;
    case "signed-out":
      return (
        <main className="page" style={{ maxWidth: 520 }}>
          <h1>Shieldmaiden HQ</h1>
          <section className="panel">
            <p>Your sign-in has expired.</p>
            <div>
              <button type="button" className="primary" onClick={() => window.location.reload()}>
                Sign in
              </button>
            </div>
          </section>
        </main>
      );
    case "error":
      return (
        <main className="page" style={{ maxWidth: 520 }}>
          <h1>Shieldmaiden HQ</h1>
          <section className="panel">
            <p className="error">{state.message}</p>
            <div>
              <button type="button" onClick={() => void reload()}>
                Try again
              </button>
            </div>
          </section>
        </main>
      );
    case "ready":
      return <Syncing key={state.session.staffId}>{children}</Syncing>;
  }
}

function Syncing({ children }: { children: ReactNode }) {
  const engine = useSyncEngine();
  useEffect(() => startBackgroundSync(engine), [engine]);
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const session = useSession();
  return roles.includes(session.role) ? <>{children}</> : <Navigate to="/" replace />;
}

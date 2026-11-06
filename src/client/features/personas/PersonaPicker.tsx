import { useEffect, useState } from "react";
import { z } from "zod";
import { personaSchema, type Persona } from "@shared/sync";
import { ROLE_LABELS } from "@shared/roles";
import { apiFetch } from "../../sync/transport";

/** Demo and local only: choose which staff member to act as. */
export function PersonaPicker({ onPicked }: { onPicked: () => void }) {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/personas")
      .then((body) =>
        setPersonas(z.object({ personas: z.array(personaSchema) }).parse(body).personas),
      )
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  async function pick(staffId: string) {
    try {
      await apiFetch("/api/personas/select", { method: "POST", body: JSON.stringify({ staffId }) });
      onPicked();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="page" style={{ maxWidth: 520 }}>
      <h1>Shieldmaiden HQ</h1>
      <section className="panel">
        <h2>Sign in as</h2>
        <p className="muted small">
          This is a practice copy with made-up data. Pick a person to see the app the way they
          would.
        </p>
        {error && <p className="error">{error}</p>}
        {!personas && !error && <p className="muted">Loading…</p>}
        <div className="stack">
          {personas?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void pick(p.id)}
              style={{ justifyContent: "space-between" }}
            >
              <span>{p.name}</span>
              <span className="chip">{ROLE_LABELS[p.role]}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

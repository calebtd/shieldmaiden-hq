import { useLiveQuery } from "dexie-react-hooks";
import { useState, type SyntheticEvent } from "react";
import { newId } from "@shared/ids";
import { useDb, useSyncEngine } from "../../app/sync";
import { fieldErrors } from "../../components/forms";
import { RejectedChanges } from "../../components/RejectedChanges";
import { loadStarterSkills, type SkillsLoadResult } from "../menu/loadStarter";

/** Who can do what: a checklist of braiders × skills. */
export function SkillsPage() {
  const db = useDb();
  const engine = useSyncEngine();
  const data = useLiveQuery(async () => {
    const [skills, staff, rows] = await Promise.all([
      db.skills.toArray(),
      db.staff.toArray(),
      db.staffSkills.toArray(),
    ]);
    return {
      skills: skills.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name)),
      people: staff
        .filter((s) => s.active && s.role !== "checkout")
        .sort((a, b) => a.name.localeCompare(b.name)),
      has: new Set(rows.filter((r) => r.has).map((r) => `${r.staffId}:${r.skillId}`)),
    };
  }, [db]);
  if (!data) return null;
  const { skills, people, has } = data;

  return (
    <>
      <h1>Skills</h1>
      <p className="muted">
        Tick what each braider can do. A braid that needs a skill (set on the Menu screen) only goes
        to people who have it.
      </p>
      <RejectedChanges />
      <SheetPanel />
      <AddSkill />
      {skills.length > 0 && people.length > 0 && (
        <section className="panel grid-scroll" aria-label="Who can do what">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col">Braider</th>
                {skills.map((s) => (
                  <th key={s.id} scope="col">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  {skills.map((s) => {
                    const checked = has.has(`${p.id}:${s.id}`);
                    return (
                      <td key={s.id}>
                        <input
                          type="checkbox"
                          aria-label={`${p.name}: ${s.name}`}
                          checked={checked}
                          onChange={() =>
                            void engine.mutate("staff.setSkill", {
                              staffId: p.id,
                              skillId: s.id,
                              has: !checked,
                            })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function AddSkill() {
  const engine = useSyncEngine();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    try {
      await engine.mutate("skill.create", { id: newId(), name });
      setName("");
      setError(null);
    } catch (err) {
      setError(fieldErrors(err).name ?? "Couldn't add that skill.");
    }
  }

  return (
    <form className="panel" onSubmit={(e) => void submit(e)} noValidate>
      <div className="row" style={{ alignItems: "end" }}>
        <label style={{ flex: 1 }}>
          New skill
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fishtail"
          />
        </label>
        <button type="submit" className="primary">
          Add skill
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function SheetPanel() {
  const db = useDb();
  const engine = useSyncEngine();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SkillsLoadResult | null>(null);

  return (
    <section className="panel" aria-label="Skills sheet">
      <p className="small">
        Load the skills sheet (Nov 10). It matches people by first name, only adds skills, and can
        be run again after you add someone on the Staff screen.
      </p>
      <div>
        <button
          type="button"
          className="compact"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void loadStarterSkills(db, engine)
              .then(setResult)
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Loading…" : "Load skills sheet"}
        </button>
      </div>
      {result && (
        <p className="small">
          Updated {result.matched} {result.matched === 1 ? "person" : "people"}.
          {result.notFound.length > 0 &&
            ` Not on staff yet: ${result.notFound.join(", ")}. Add them on the Staff screen, then load again.`}
        </p>
      )}
    </section>
  );
}

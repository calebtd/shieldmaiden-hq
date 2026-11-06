import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "../app/sync";

/** Shows changes the server refused, so nothing fails silently. */
export function RejectedChanges() {
  const db = useDb();
  const rejected = useLiveQuery(() => db.rejections.orderBy("at").reverse().toArray(), [db]);
  if (!rejected?.length) return null;

  return (
    <div className="banner danger stack" role="alert">
      <strong>
        {rejected.length === 1
          ? "A change wasn't saved"
          : `${rejected.length} changes weren't saved`}
      </strong>
      <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
        {rejected.map((r) => (
          <li key={r.id}>{r.error}</li>
        ))}
      </ul>
      <div>
        <button type="button" className="compact" onClick={() => void db.rejections.clear()}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

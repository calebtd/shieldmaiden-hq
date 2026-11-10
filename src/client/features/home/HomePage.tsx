import { useSession } from "../../session/session";
import { HealthPanel } from "../health/HealthPanel";

export function HomePage() {
  const session = useSession();
  return (
    <>
      <h1>Hi, {session.name.split(" ")[0]}</h1>
      {session.role === "owner" && <HealthPanel />}
      <section className="panel">
        <h2>Coming next</h2>
        <p className="muted">
          The braid menu, the timeclock, tickets, and payouts are being built in that order. This
          screen will show the current event once the timeclock is ready.
        </p>
      </section>
    </>
  );
}

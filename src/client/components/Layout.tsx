import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { NavLink } from "react-router";
import { ROLE_LABELS, type Role } from "@shared/roles";
import { useSession, useSessionContext } from "../session/session";
import { SyncBadge } from "./SyncBadge";
import { SyncProblem } from "./SyncProblem";
import "./Layout.css";

interface NavItem {
  to: string;
  label: string;
  roles: readonly Role[];
}

interface NavGroup {
  /** Shown above the group; omit for the top group. */
  heading?: string;
  items: NavItem[];
}

const EVERYONE: readonly Role[] = ["owner", "checkout", "braider"];

/** Add a screen here to put it in the sidebar for the roles that can use it. */
const NAV: NavGroup[] = [
  { items: [{ to: "/", label: "Home", roles: EVERYONE }] },
  {
    heading: "Setup",
    items: [
      { to: "/events", label: "Events", roles: ["owner"] },
      { to: "/menu", label: "Braid menu", roles: ["owner"] },
      { to: "/staff", label: "Staff", roles: ["owner"] },
      { to: "/skills", label: "Skills", roles: ["owner"] },
      { to: "/discounts", label: "Discounts", roles: ["owner"] },
    ],
  },
];

const ENV_LABEL = { local: "Local", dev: "Dev", demo: "Demo", production: null } as const;

/**
 * Sidebar on iPad and computer screens. On phones the sidebar slides in from a
 * button in the top bar, and closes when you pick a screen.
 */
export function Layout({ children }: { children: ReactNode }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const phone = useIsPhone();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const envLabel = ENV_LABEL[session.appEnv];
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(session.role)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="shell">
      <header className="phone-bar">
        <button
          type="button"
          className="ghost compact"
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(true)}
        >
          ☰ Screens
        </button>
        <strong>Shieldmaiden HQ</strong>
        {phone && <SyncBadge />}
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="sidebar" className={`sidebar ${open ? "open" : ""}`} aria-label="Screens">
        <div className="brand">
          <strong>Shieldmaiden HQ</strong>
          {envLabel && <span className="chip warn">{envLabel}</span>}
        </div>
        <nav className="side-nav" aria-label="Main">
          {groups.map((g) => (
            <div key={g.heading ?? "top"} className="side-group">
              {g.heading && <span className="side-heading">{g.heading}</span>}
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setOpen(false)}>
                  {n.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <SidebarFooter showSync={!phone} />
      </aside>

      <main className="page">
        <SyncProblem />
        {children}
      </main>
    </div>
  );
}

/** Matches the phone layout in Layout.css (narrower than 768px). */
const PHONE_QUERY = "(max-width: 767px)";

function useIsPhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
  );
}

/** Save status (shown here on bigger screens; in the top bar on phones), who, sign out. */
function SidebarFooter({ showSync }: { showSync: boolean }) {
  const session = useSession();
  const { signOut } = useSessionContext();
  return (
    <div className="side-footer">
      {showSync && <SyncBadge />}
      <span className="small">
        {session.name} · {ROLE_LABELS[session.role]}
      </span>
      <button type="button" className="ghost compact" onClick={() => void signOut()}>
        {session.authMode === "access" ? "Sign out" : "Switch person"}
      </button>
    </div>
  );
}

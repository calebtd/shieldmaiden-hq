import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { ROLE_LABELS, type Role } from "@shared/roles";
import { useSession, useSessionContext } from "../session/session";
import { SyncBadge } from "./SyncBadge";
import "./Layout.css";

interface NavItem {
  to: string;
  label: string;
  roles: readonly Role[];
}

/** Add a screen here to put it in the menu for the roles that can use it. */
const NAV: NavItem[] = [
  { to: "/", label: "Home", roles: ["owner", "checkout", "braider"] },
  { to: "/staff", label: "Staff", roles: ["owner"] },
];

const ENV_LABEL = { local: "Local", dev: "Dev", demo: "Demo", production: null } as const;

export function Layout({ children }: { children: ReactNode }) {
  const session = useSession();
  const { switchPerson } = useSessionContext();
  const envLabel = ENV_LABEL[session.appEnv];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <strong>Shieldmaiden HQ</strong>
            {envLabel && <span className="chip warn">{envLabel}</span>}
          </div>
          <nav className="nav" aria-label="Main">
            {NAV.filter((n) => n.roles.includes(session.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="who">
            <SyncBadge />
            <span className="small muted">
              {session.name} · {ROLE_LABELS[session.role]}
            </span>
            {session.authMode !== "access" && (
              <button type="button" className="ghost compact" onClick={() => void switchPerson()}>
                Switch
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

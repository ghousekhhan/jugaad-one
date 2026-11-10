import Link from "next/link";
import { ArrowUpRight, CircleDashed, List, UserRound } from "lucide-react";
import type { ReactNode } from "react";

export function ApprovedWordmark() {
  return <Link href="/" className="wordmark" aria-label="Jugaad One homepage">Jugaad<span className="wordmark-dot">.</span>One</Link>;
}

const destinations = [
  { id: "jugaad", name: "Jugaad", Icon: CircleDashed },
  { id: "orders", name: "Orders", Icon: List },
  { id: "profile", name: "Profile", Icon: UserRound },
] as const;

export type WorkspaceTab = (typeof destinations)[number]["id"];

export function ApprovedShell({ tab, onTab, name, children }: {
  tab: WorkspaceTab; onTab: (tab: WorkspaceTab) => void; name: string; children: ReactNode;
}) {
  return (
    <div className="workspace approved-workspace">
      <aside className="sidebar">
        <div className="app-wordmark"><ApprovedWordmark /></div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="main-nav" aria-label="Primary navigation">
          {destinations.map(({ id, name, Icon }) => (
            <button key={id} type="button" className={tab === id ? "nav-item active" : "nav-item"} onClick={() => onTab(id)} aria-current={tab === id ? "page" : undefined}>
              <Icon className="nav-icon" size={18} aria-hidden="true" /> {name}
              <ArrowUpRight className="nav-active-mark" size={14} aria-hidden="true" />
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span className="tip-icon" aria-hidden="true">✳</span><strong>One conversation.<br />Everything connected.</strong><p>Explore, compare and approve simulated transactions.</p></div>
          <div className="sidebar-foot"><span className="status-dot" /> Simulated transactions</div>
        </div>
      </aside>
      <div className="app-area">
        <header className="app-header">
          <div className="breadcrumb"><Link className="approved-mobile-home" href="/" aria-label="Jugaad One homepage">Jugaad One</Link> <span className="approved-desktop-crumb">Workspace</span> <span>/</span> <strong>{tab}</strong></div>
          <div className="header-actions"><span className="sandbox-pill"><span className="status-dot" /> Demo mode</span><button type="button" className="header-avatar" onClick={() => onTab("profile")} aria-label="Open profile">{name.slice(0, 1).toUpperCase()}</button></div>
        </header>
        <main className="app-main" id="main">{children}</main>
      </div>
    </div>
  );
}

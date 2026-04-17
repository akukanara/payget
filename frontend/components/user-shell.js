"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/manual-transaction", label: "Manual Transaction" },
  { href: "/secret", label: "Secret" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export default function UserShell({ title, description, children }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("userToken");
    router.push("/login");
  }

  return (
    <main className="shell app-shell">
      <aside className="sidebar panel">
        <div className="stack">
          <div className="badge">User Workspace</div>
          <div>
            <h2 style={{ marginBottom: 8 }}>Kanara Cashier</h2>
            <p className="muted">Menu kasir, profil, secret, dan pengaturan dipisah agar tidak bercampur.</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${active ? "active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer stack">
          <Link className="sidebar-link subtle" href="/playground">
            Playground
          </Link>
          <button className="button ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <section className="content stack">
        <header className="panel page-header stack">
          <div className="badge">Workspace</div>
          <div>
            <h1 style={{ marginBottom: 8 }}>{title}</h1>
            <p className="muted">{description}</p>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

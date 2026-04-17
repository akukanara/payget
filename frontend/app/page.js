import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell stack">
      <section className="hero hero-grid">
        <div className="stack">
          <div className="badge">FastAPI + Midtrans + Supabase</div>
          <h1>Payment workspace yang clean, modular, dan terasa seperti dashboard modern.</h1>
          <p>
            API, dashboard user, admin console, dan playground dipisah jelas. Testing Midtrans sandbox juga
            bisa langsung dari UI tanpa pindah ke Swagger atau Postman.
          </p>
          <div className="nav-links">
            <Link className="button" href="/playground">
              Open Playground
            </Link>
            <Link className="button ghost" href="/dashboard">
              User Dashboard
            </Link>
          </div>
        </div>

        <div className="spotlight-card stack">
          <div className="eyebrow">Workspace</div>
          <div className="stat-row">
            <span className="muted">User area</span>
            <strong>Profile, API key, payment flow</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Admin area</span>
            <strong>Users, approvals, transactions</strong>
          </div>
          <div className="stat-row">
            <span className="muted">API Playground</span>
            <strong>Charge, status, cancel, sandbox</strong>
          </div>
        </div>
      </section>

      <section className="grid three">
        <article className="panel stack">
          <span className="eyebrow">User Area</span>
          <h2>Kelola transaksi pribadi</h2>
          <p>Masuk sebagai user untuk melihat profil, rotate API key, submit charge, dan audit transaksi sendiri.</p>
          <div className="nav-links">
            <Link className="button" href="/login">
              User Login
            </Link>
            <Link className="button ghost" href="/register">
              Register
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <span className="eyebrow">Admin Area</span>
          <h2>Kontrol operasional</h2>
          <p>Monitoring transaksi, approval user, dan admin insight tetap terpisah dari flow payment user.</p>
          <Link className="button secondary" href="/admin/login">
            Admin Login
          </Link>
        </article>

        <article className="panel stack">
          <span className="eyebrow">Playground</span>
          <h2>Uji API dengan cepat</h2>
          <p>Masukkan `X-API-Key`, pilih mode Midtrans, lalu jalankan charge, status, dan cancel dari browser.</p>
          <Link className="button ghost" href="/playground">
            Open Playground
          </Link>
        </article>
      </section>
    </main>
  );
}

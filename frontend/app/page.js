import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell stack">
      <section className="hero">
        <div className="badge">FastAPI + Midtrans + Supabase</div>
        <h1>Payment backend yang dipisah jelas antara user dan admin.</h1>
        <p>
          User login untuk dashboard transaksi sendiri. Admin login untuk melihat semua user dan semua
          transaksi. Endpoint payment tetap memakai API key per user.
        </p>
      </section>

      <section className="grid">
        <article className="panel stack">
          <h2>User Area</h2>
          <p>Masuk sebagai user biasa untuk melihat profil, API key prefix, summary transaksi, dan daftar transaksi.</p>
          <div className="nav-links">
            <Link className="button" href="/login">
              Buka User Login
            </Link>
            <Link className="button ghost" href="/register">
              Register User
            </Link>
          </div>
        </article>

        <article className="panel stack">
          <h2>Admin Area</h2>
          <p>Masuk sebagai admin untuk melihat dashboard keseluruhan, daftar user, dan transaksi terbaru.</p>
          <Link className="button secondary" href="/admin/login">
            Buka Admin Login
          </Link>
        </article>
      </section>
    </main>
  );
}

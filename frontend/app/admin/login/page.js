"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "../../../lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Login admin gagal.");
      }
      localStorage.setItem("adminToken", payload.access_token);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell stack">
      <section className="auth-layout">
        <div className="auth-copy">
          <span className="eyebrow">Admin Access</span>
          <h1>Masuk ke control room operasional.</h1>
          <p>
            Halaman admin dipakai untuk approval user, monitoring transaksi, dan audit aktivitas terbaru
            tanpa bercampur dengan flow payment user.
          </p>
          <div className="nav-links">
            <Link className="button ghost" href="/">
              Home
            </Link>
          </div>
        </div>

        <section className="panel stack auth-card">
          <div className="badge">Admin Login</div>
          <h2>Admin sign in</h2>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            {error ? <p className="danger">{error}</p> : null}
            <button type="submit">Login Admin</button>
          </form>
        </section>
      </section>
    </main>
  );
}

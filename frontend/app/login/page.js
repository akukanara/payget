"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "../../lib/api";

export default function UserLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Login gagal.");
      }

      localStorage.setItem("userToken", payload.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell stack">
      <section className="auth-layout">
        <div className="auth-copy">
          <span className="eyebrow">User Access</span>
          <h1>Masuk ke workspace transaksi pribadi.</h1>
          <p>
            Dashboard user dipakai untuk melihat profil, summary transaksi, rotate API key, dan membuka
            playground request ke API.
          </p>
          <div className="nav-links">
            <Link className="button ghost" href="/register">
              Buat akun
            </Link>
            <Link className="button ghost" href="/playground">
              Lihat playground
            </Link>
          </div>
        </div>

        <section className="panel stack auth-card">
          <div className="badge">User Login</div>
          <h2>Sign in</h2>
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
            <button type="submit" disabled={loading}>
              {loading ? "Memproses..." : "Login"}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

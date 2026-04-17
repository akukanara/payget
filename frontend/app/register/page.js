"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setApiKey("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Register gagal.");
      }
      setApiKey(payload.api_key);
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
          <span className="eyebrow">Registration</span>
          <h1>Buat akun dan dapatkan API key pertama.</h1>
          <p>
            Setelah register, user menunggu approval admin. API key pertama tetap ditampilkan sekali agar bisa
            langsung dipakai di playground atau integrasi lokal.
          </p>
          <div className="nav-links">
            <Link className="button ghost" href="/login">
              Sudah punya akun
            </Link>
            <Link className="button ghost" href="/playground">
              Buka playground
            </Link>
          </div>
        </div>

        <section className="panel stack auth-card">
          <div className="badge">User Register</div>
          <h2>Create account</h2>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>Nama lengkap</span>
              <input
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                required
              />
            </label>
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
              {loading ? "Memproses..." : "Register"}
            </button>
          </form>

          {apiKey ? (
            <div className="card stack">
              <h2>API key berhasil dibuat</h2>
              <p className="danger">Simpan API key ini sekarang. Nilai lengkapnya tidak akan bisa diambil ulang dari server.</p>
              <code style={{ wordBreak: "break-all" }}>{apiKey}</code>
              <div className="nav-links">
                <button className="button" onClick={() => navigator.clipboard.writeText(apiKey)}>
                  Copy API Key
                </button>
                <button className="button ghost" onClick={() => router.push("/login")}>
                  Lanjut ke Login
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

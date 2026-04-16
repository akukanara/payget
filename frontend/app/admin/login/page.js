"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
      <section className="panel stack" style={{ maxWidth: 520 }}>
        <div className="badge">Admin Login</div>
        <h1>Masuk ke admin dashboard</h1>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
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
    </main>
  );
}

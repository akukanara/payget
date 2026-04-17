"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";
import { API_BASE_URL, jsonFetch } from "../../lib/api";
import { getUserToken } from "../../lib/user-workspace";

const DEFAULT_CHARGE_BODY = {
  payment_type: "bank_transfer",
  transaction_details: {
    order_id: `ORDER-${Date.now()}`,
    gross_amount: 150000,
  },
  customer_details: {
    first_name: "Sandbox User",
    email: "sandbox@example.com",
    phone: "08123456789",
  },
  bank_transfer: {
    bank: "bca",
  },
};

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

export default function PlaygroundPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [orderId, setOrderId] = useState("");
  const [mode, setMode] = useState("sandbox");
  const [runtime, setRuntime] = useState(null);
  const [bodyText, setBodyText] = useState(pretty(DEFAULT_CHARGE_BODY));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getUserToken();
    if (!token) {
      router.push("/login");
      return;
    }

    jsonFetch("/api/runtime/midtrans")
      .then((payload) => {
        setRuntime(payload);
        setMode(payload.available_modes.includes("sandbox") ? "sandbox" : payload.default_mode);
        setReady(true);
      })
      .catch((err) => setError(err.message));
  }, [router]);

  if (!ready && !error) {
    return null;
  }

  async function runRequest(method, path, payload) {
    if (!apiKey.trim()) {
      setError("API key wajib diisi untuk playground.");
      return;
    }

    setLoading(`${method} ${path}`);
    setError("");
    setResult(null);

    try {
      const response = await jsonFetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey.trim(),
          "X-Midtrans-Mode": mode,
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      setResult(response);
      if (response.order_id) {
        setOrderId(response.order_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function submitCharge(event) {
    event.preventDefault();
    try {
      const payload = JSON.parse(bodyText);
      await runRequest("POST", "/api/payments/charge", payload);
    } catch {
      setError("Body JSON tidak valid.");
    }
  }

  return (
    <UserShell title="Playground" description="Area teknis khusus untuk request manual ke service backend Midtrans yang terpisah. Frontend tidak memproxy API lewat route Next.js.">
      <section className="hero hero-grid">
        <div className="stack">
          <span className="eyebrow">API Playground</span>
          <h1>Payment console dengan gaya dashboard modern.</h1>
          <p>
            Area ini khusus untuk kebutuhan teknis: request custom, pengecekan status manual, dan skenario
            sandbox atau production. Dashboard kasir tetap difokuskan ke QRIS checkout.
          </p>
          <div className="nav-links">
            <Link className="button" href="/manual-transaction">
              Manual Transaction
            </Link>
          </div>
        </div>

        <div className="spotlight-card stack">
          <div className="stat-row">
            <span className="muted">API Base</span>
            <strong>{API_BASE_URL}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Default mode</span>
            <strong>{runtime?.default_mode || "-"}</strong>
          </div>
          <div className="stat-row">
            <span className="muted">Modes</span>
            <div className="chip-row">
              {(runtime?.available_modes || []).map((item) => (
                <span className="chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}

      <section className="playground-grid">
        <article className="panel stack">
          <div className="section-head">
            <div>
              <span className="eyebrow">Request</span>
              <h2>Compose request</h2>
            </div>
            <span className={`mode-pill ${mode}`}>{mode}</span>
          </div>

          <div className="grid two">
            <label className="field">
              <span>Environment</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                {(runtime?.available_modes || [runtime?.default_mode || "sandbox"]).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Order ID</span>
              <input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="ORDER-12345"
              />
            </label>
          </div>

          <label className="field">
            <span>API Key</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="ak_xxxxxxxxxxxxxxxxx"
            />
          </label>

          <form className="stack" onSubmit={submitCharge}>
            <label className="field">
              <span>Charge Body</span>
              <textarea rows={16} value={bodyText} onChange={(event) => setBodyText(event.target.value)} />
            </label>
            <div className="nav-links">
              <button type="submit" disabled={Boolean(loading)}>
                {loading === "POST /api/payments/charge" ? "Submitting..." : "Run Charge"}
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => setBodyText(pretty(DEFAULT_CHARGE_BODY))}
              >
                Reset Example
              </button>
            </div>
          </form>

          <div className="nav-links">
            <button
              className="button secondary"
              type="button"
              disabled={!orderId || Boolean(loading)}
              onClick={() => runRequest("GET", `/api/payments/${orderId}/status`)}
            >
              {loading === `GET /api/payments/${orderId}/status` ? "Loading..." : "Check Status"}
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={!orderId || Boolean(loading)}
              onClick={() => runRequest("POST", `/api/payments/${orderId}/cancel`)}
            >
              {loading === `POST /api/payments/${orderId}/cancel` ? "Cancelling..." : "Cancel"}
            </button>
          </div>
        </article>

        <article className="panel stack">
          <div className="section-head">
            <div>
              <span className="eyebrow">Response</span>
              <h2>Inspect result</h2>
            </div>
          </div>

          <div className="glass-list">
            <div className="stat-row">
              <span className="muted">Target</span>
              <strong>{API_BASE_URL}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Mode</span>
              <strong>{mode}</strong>
            </div>
            <div className="stat-row">
              <span className="muted">Order ID</span>
              <strong>{orderId || "-"}</strong>
            </div>
          </div>

          <pre className="code-block">{pretty(result || { note: "Belum ada response." })}</pre>
        </article>
      </section>
    </UserShell>
  );
}

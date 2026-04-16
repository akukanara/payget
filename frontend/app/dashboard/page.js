"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function authFetch(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || "Request gagal.");
  }
  return payload;
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    order_id: "",
    gross_amount: "",
    payment_type: "bank_transfer",
    email: "",
    first_name: "",
    phone: "",
    bank: "bca",
  });
  const [apiKey, setApiKey] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [chargeResult, setChargeResult] = useState(null);
  const [error, setError] = useState("");

  async function loadDashboard(token) {
    const [profileData, summaryData, transactionData] = await Promise.all([
      authFetch("/api/auth/me", token),
      authFetch("/api/user/dashboard/summary", token),
      authFetch("/api/user/transactions", token),
    ]);
    setProfile(profileData);
    setSummary(summaryData);
    setTransactions(transactionData);
    setPaymentForm((current) => ({
      ...current,
      email: current.email || profileData.email || "",
      first_name: current.first_name || profileData.full_name || "",
    }));
  }

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
      return;
    }

    loadDashboard(token).catch((err) => {
      setError(err.message);
    });
  }, [router]);

  function logout() {
    localStorage.removeItem("userToken");
    router.push("/login");
  }

  async function rotateApiKey() {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_BASE_URL}/api/auth/api-keys/rotate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Rotate API key gagal.");
      }
      setNewApiKey(payload.api_key);
      setApiKey(payload.api_key);
      await loadDashboard(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitCharge(event) {
    event.preventDefault();
    setError("");
    setChargeResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          payment_type: paymentForm.payment_type,
          transaction_details: {
            order_id: paymentForm.order_id,
            gross_amount: Number(paymentForm.gross_amount),
          },
          customer_details: {
            first_name: paymentForm.first_name,
            email: paymentForm.email,
            phone: paymentForm.phone,
          },
          bank_transfer:
            paymentForm.payment_type === "bank_transfer"
              ? {
                  bank: paymentForm.bank,
                }
              : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Charge gagal.");
      }
      setChargeResult(payload);
      const token = localStorage.getItem("userToken");
      if (token) {
        await loadDashboard(token);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell stack">
      <div className="nav">
        <div>
          <div className="badge">User Dashboard</div>
          <h1 style={{ marginBottom: 0 }}>Transaksi pribadi</h1>
        </div>
        <div className="nav-links">
          <button className="button ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="danger">{error}</p> : null}

      {profile && summary ? (
        <>
          <section className="grid">
            <article className="card">
              <div className="muted">Nama</div>
              <div className="metric" style={{ fontSize: "1.5rem" }}>{profile.full_name}</div>
            </article>
            <article className="card">
              <div className="muted">Total transaksi</div>
              <div className="metric">{summary.total_transactions}</div>
            </article>
            <article className="card">
              <div className="muted">Pending</div>
              <div className="metric">{summary.pending_transactions}</div>
            </article>
            <article className="card">
              <div className="muted">Settled</div>
              <div className="metric">{summary.settled_transactions}</div>
            </article>
          </section>

          <section className="panel stack">
            <div>
              <h2>Informasi akun</h2>
              <p>{profile.email}</p>
              <p>API key prefix aktif: {profile.api_key_prefixes.join(", ") || "-"}</p>
            </div>
            <label>
              API key untuk request payment
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste API key lengkap di sini"
              />
            </label>
            <div className="nav-links">
              <button className="button secondary" onClick={rotateApiKey}>
                Rotate API Key
              </button>
              {newApiKey ? (
                <button className="button ghost" onClick={() => navigator.clipboard.writeText(newApiKey)}>
                  Copy API Key Baru
                </button>
              ) : null}
            </div>
            {newApiKey ? (
              <div className="card stack">
                <div className="muted">API key baru</div>
                <code style={{ wordBreak: "break-all" }}>{newApiKey}</code>
              </div>
            ) : null}
          </section>

          <section className="panel stack">
            <div>
              <h2>Buat payment</h2>
              <p>Charge Midtrans dipanggil lewat backend dan wajib memakai `X-API-Key` user.</p>
            </div>
            <form className="grid" onSubmit={submitCharge}>
              <label>
                Order ID
                <input
                  value={paymentForm.order_id}
                  onChange={(event) => setPaymentForm({ ...paymentForm, order_id: event.target.value })}
                  required
                />
              </label>
              <label>
                Gross Amount
                <input
                  type="number"
                  value={paymentForm.gross_amount}
                  onChange={(event) => setPaymentForm({ ...paymentForm, gross_amount: event.target.value })}
                  required
                />
              </label>
              <label>
                Payment Type
                <input
                  value={paymentForm.payment_type}
                  onChange={(event) => setPaymentForm({ ...paymentForm, payment_type: event.target.value })}
                  required
                />
              </label>
              <label>
                Bank
                <input
                  value={paymentForm.bank}
                  onChange={(event) => setPaymentForm({ ...paymentForm, bank: event.target.value })}
                />
              </label>
              <label>
                Nama customer
                <input
                  value={paymentForm.first_name}
                  onChange={(event) => setPaymentForm({ ...paymentForm, first_name: event.target.value })}
                />
              </label>
              <label>
                Email customer
                <input
                  type="email"
                  value={paymentForm.email}
                  onChange={(event) => setPaymentForm({ ...paymentForm, email: event.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  value={paymentForm.phone}
                  onChange={(event) => setPaymentForm({ ...paymentForm, phone: event.target.value })}
                />
              </label>
              <div style={{ alignSelf: "end" }}>
                <button type="submit">Create Charge</button>
              </div>
            </form>
            {chargeResult ? (
              <div className="card stack">
                <h3 style={{ marginBottom: 0 }}>Hasil charge</h3>
                <p>Status: {chargeResult.transaction_status || chargeResult.status_message || "-"}</p>
                <p>Order ID: {chargeResult.order_id || "-"}</p>
                <p>Payment: {chargeResult.payment_type || "-"}</p>
                {chargeResult.va_numbers?.length ? (
                  <div>
                    <div className="muted">VA Numbers</div>
                    {chargeResult.va_numbers.map((item, index) => (
                      <p key={`${item.bank}-${index}`}>{item.bank}: {item.va_number}</p>
                    ))}
                  </div>
                ) : null}
                {chargeResult.actions?.length ? (
                  <div>
                    <div className="muted">Actions</div>
                    {chargeResult.actions.map((item, index) => (
                      <p key={`${item.name}-${index}`}>{item.name}: {item.url}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="nav">
              <h2 style={{ margin: 0 }}>Daftar transaksi</h2>
              <button
                className="button ghost"
                onClick={async () => {
                  const token = localStorage.getItem("userToken");
                  if (token) {
                    await loadDashboard(token);
                  }
                }}
              >
                Refresh
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id || item.order_id}>
                    <td>{item.order_id}</td>
                    <td>{item.transaction_status || "-"}</td>
                    <td>{item.payment_type || "-"}</td>
                    <td>{item.gross_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <section className="panel">
          <p>Memuat data dashboard...</p>
        </section>
      )}
    </main>
  );
}

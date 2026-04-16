"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function authFetch(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || "Request admin gagal.");
  }
  return payload;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin/login");
      return;
    }
    authFetch("/api/admin/dashboard", token)
      .then((payload) => setDashboard(payload))
      .catch((err) => setError(err.message));
  }, [router]);

  function logout() {
    localStorage.removeItem("adminToken");
    router.push("/admin/login");
  }

  return (
    <main className="shell stack">
      <div className="nav">
        <div>
          <div className="badge">Admin Dashboard</div>
          <h1 style={{ marginBottom: 0 }}>Kontrol transaksi dan user</h1>
        </div>
        <div className="nav-links">
          <Link className="button ghost" href="/admin/users">
            Lihat Users
          </Link>
          <Link className="button ghost" href="/admin/transactions">
            Lihat Transactions
          </Link>
          <button className="button ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {error ? <p className="danger">{error}</p> : null}

      {dashboard ? (
        <>
          <section className="grid">
            <article className="card">
              <div className="muted">Total transaksi</div>
              <div className="metric">{dashboard.summary.total_transactions}</div>
            </article>
            <article className="card">
              <div className="muted">Pending</div>
              <div className="metric">{dashboard.summary.pending_transactions}</div>
            </article>
            <article className="card">
              <div className="muted">Settled</div>
              <div className="metric">{dashboard.summary.settled_transactions}</div>
            </article>
            <article className="card">
              <div className="muted">Total amount</div>
              <div className="metric">{dashboard.summary.total_amount}</div>
            </article>
          </section>

          <section className="panel">
            <h2>User terbaru</h2>
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.is_admin ? "Admin" : "User"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h2>Transaksi terbaru</h2>
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>User ID</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_transactions.map((item) => (
                  <tr key={item.id || item.order_id}>
                    <td>{item.order_id}</td>
                    <td>{item.user_id || "-"}</td>
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
          <p>Memuat data admin dashboard...</p>
        </section>
      )}
    </main>
  );
}

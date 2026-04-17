"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { authFetch, formatCurrency } from "../../../lib/api";

function StatusChart({ points }) {
  const max = Math.max(...points.map((item) => item.value), 1);
  return (
    <div className="chart-bars">
      {points.map((item) => (
        <div className="chart-bar-row" key={item.label}>
          <div className="chart-bar-meta">
            <strong style={{ textTransform: "capitalize" }}>{item.label}</strong>
            <span className="muted">{item.value}</span>
          </div>
          <div className="chart-bar-track">
            <div className="chart-bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueTrend({ points }) {
  const max = Math.max(...points.map((item) => item.value), 1);
  return (
    <div className="trend-chart">
      {points.map((item) => (
        <div className="trend-column" key={item.label}>
          <div className="trend-bar-wrap">
            <div className="trend-bar" style={{ height: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%` }} />
          </div>
          <strong>{formatCurrency(item.value)}</strong>
          <div className="trend-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
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
      <div className="nav nav-panel">
        <div>
          <div className="badge">Admin Dashboard</div>
          <h1 style={{ marginBottom: 0 }}>Control room</h1>
          <p className="muted">Ringkasan transaksi dan user terbaru dalam satu layar yang lebih rapi.</p>
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
          <section className="grid four">
            <article className="card stat-card">
              <div className="muted">Total transaksi</div>
              <div className="metric">{dashboard.summary.total_transactions}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Pending</div>
              <div className="metric">{dashboard.summary.pending_transactions}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Settled</div>
              <div className="metric">{dashboard.summary.settled_transactions}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Total amount</div>
              <div className="metric">{formatCurrency(dashboard.summary.total_amount)}</div>
            </article>
          </section>

          <section className="grid four">
            <article className="card stat-card">
              <div className="muted">Settled revenue</div>
              <div className="metric">{formatCurrency(dashboard.summary.settled_amount)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Admin fee 0.5%</div>
              <div className="metric">{formatCurrency(dashboard.summary.admin_fee_revenue)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Pendapatan bersih</div>
              <div className="metric">{formatCurrency(dashboard.summary.net_revenue)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Approved users</div>
              <div className="metric">{dashboard.users.filter((user) => user.is_approved).length}</div>
            </article>
          </section>

          <section className="chart-grid">
            <article className="panel chart-card">
              <div>
                <span className="eyebrow">Status Chart</span>
                <h2 style={{ marginBottom: 4 }}>Breakdown transaksi</h2>
                <p className="muted">Proporsi status transaksi di seluruh workspace user.</p>
              </div>
              <StatusChart points={dashboard.summary.status_breakdown} />
            </article>

            <article className="panel chart-card">
              <div>
                <span className="eyebrow">Revenue Trend</span>
                <h2 style={{ marginBottom: 4 }}>Revenue 7 hari</h2>
                <p className="muted">Trend harian dari transaksi sukses, termasuk basis untuk fee admin.</p>
              </div>
              <RevenueTrend points={dashboard.summary.daily_revenue} />
            </article>
          </section>

          <section className="panel stack">
            <h2>User terbaru</h2>
            <div className="table-wrap">
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
            </div>
          </section>

          <section className="panel stack">
            <h2>Transaksi terbaru</h2>
            <div className="table-wrap">
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
                      <td><span className="chip">{item.transaction_status || "-"}</span></td>
                      <td>{item.payment_type || "-"}</td>
                      <td>{formatCurrency(item.gross_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

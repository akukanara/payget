"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";
import { formatCurrency } from "../../lib/api";
import { getUserToken, loadUserWorkspace } from "../../lib/user-workspace";

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

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getUserToken();
    if (!token) {
      router.push("/login");
      return;
    }

    loadUserWorkspace(token)
      .then(({ profile: profileData, summary: summaryData, transactions: transactionData }) => {
        setProfile(profileData);
        setSummary(summaryData);
        setTransactions(transactionData);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [router]);

  return (
    <UserShell title="Dashboard" description="Ringkasan singkat workspace user. Operasional kasir dipindah ke Manual Transaction, sedangkan secret dan pengaturan dipisah di menu lain.">
      {error ? <div className="notice error">{error}</div> : null}
      {profile && summary ? (
        <>
          <section className="grid four">
            <article className="card stat-card">
              <div className="muted">Kasir</div>
              <div className="metric" style={{ fontSize: "1.5rem" }}>{profile.full_name}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Transaksi</div>
              <div className="metric">{summary.total_transactions}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Menunggu bayar</div>
              <div className="metric">{summary.pending_transactions}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Berhasil</div>
              <div className="metric">{summary.settled_transactions}</div>
            </article>
          </section>

          <section className="grid four">
            <article className="card stat-card">
              <div className="muted">Total revenue</div>
              <div className="metric">{formatCurrency(summary.total_amount)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Settled revenue</div>
              <div className="metric">{formatCurrency(summary.settled_amount)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Admin fee 0.5%</div>
              <div className="metric">{formatCurrency(summary.admin_fee_revenue)}</div>
            </article>
            <article className="card stat-card">
              <div className="muted">Pendapatan bersih</div>
              <div className="metric">{formatCurrency(summary.net_revenue)}</div>
            </article>
          </section>

          <section className="grid two">
            <article className="panel stack">
              <span className="eyebrow">Quick Overview</span>
              <h2>Ringkasan akun</h2>
              <div className="cashier-inline">
                <div className="muted">Email</div>
                <strong>{profile.email}</strong>
              </div>
              <div className="cashier-inline">
                <div className="muted">API key prefix</div>
                <strong>{profile.api_key_prefixes.join(", ") || "-"}</strong>
              </div>
            </article>

            <article className="panel stack">
              <span className="eyebrow">Cashier Flow</span>
              <h2>Area kerja dipisah</h2>
              <p className="muted">Masuk ke `Manual Transaction` untuk QRIS checkout, ke `Secret` untuk API key, dan ke `Settings` untuk pengaturan workspace.</p>
            </article>
          </section>

          <section className="chart-grid">
            <article className="panel chart-card">
              <div>
                <span className="eyebrow">Status Chart</span>
                <h2 style={{ marginBottom: 4 }}>Breakdown transaksi</h2>
                <p className="muted">Distribusi status transaksi di workspace ini.</p>
              </div>
              <StatusChart points={summary.status_breakdown} />
            </article>

            <article className="panel chart-card">
              <div>
                <span className="eyebrow">Revenue Trend</span>
                <h2 style={{ marginBottom: 4 }}>Pendapatan 7 hari</h2>
                <p className="muted">Hanya menghitung transaksi sukses untuk revenue harian.</p>
              </div>
              <RevenueTrend points={summary.daily_revenue} />
            </article>
          </section>

          <section className="panel stack">
            <div className="section-head">
              <div>
                <span className="eyebrow">History</span>
                <h2 style={{ margin: 0 }}>Transaksi terbaru</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((item) => (
                    <tr key={item.id || item.order_id}>
                      <td>{item.order_id}</td>
                      <td><span className="chip">{item.transaction_status || "-"}</span></td>
                      <td>{formatCurrency(item.gross_amount)}</td>
                      <td>{item.payment_type || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <p>Memuat data dashboard...</p>
        </section>
      )}
    </UserShell>
  );
}

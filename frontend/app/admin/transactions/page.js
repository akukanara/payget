"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      router.push("/admin/login");
      return;
    }

    fetch(`${API_BASE_URL}/api/admin/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.detail || "Gagal memuat transaksi.");
        }
        setTransactions(payload);
      })
      .catch((err) => setError(err.message));
  }, [router]);

  return (
    <main className="shell stack">
      <div className="nav">
        <div>
          <div className="badge">Admin Transactions</div>
          <h1 style={{ marginBottom: 0 }}>Semua transaksi</h1>
        </div>
        <div className="nav-links">
          <Link className="button ghost" href="/admin/dashboard">
            Kembali
          </Link>
        </div>
      </div>
      {error ? <p className="danger">{error}</p> : null}
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>User ID</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Amount</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id || item.order_id}>
                <td>{item.order_id}</td>
                <td>{item.user_id || "-"}</td>
                <td>{item.transaction_status || "-"}</td>
                <td>{item.payment_type || "-"}</td>
                <td>{item.gross_amount}</td>
                <td>{item.customer_email || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

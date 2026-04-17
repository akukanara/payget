"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";
import { API_BASE_URL, formatCurrency } from "../../lib/api";
import { getUserToken, loadUserWorkspace } from "../../lib/user-workspace";

function resolveQrUrl(payload) {
  const action = (payload.actions || []).find((item) => item.name === "generate-qr-code");
  return action?.url || "";
}

export default function ManualTransactionPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({
    orderLabel: "Pembayaran Kasir",
    grossAmount: "150000",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [apiKey, setApiKey] = useState("");
  const [activeCheckout, setActiveCheckout] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getUserToken();
    if (!token) {
      router.push("/login");
      return;
    }

    loadUserWorkspace(token)
      .then(({ profile: profileData }) => {
        setProfile(profileData);
        setCheckoutForm((current) => ({
          ...current,
          customerEmail: current.customerEmail || profileData.email || "",
          customerName: current.customerName || profileData.full_name || "",
        }));
      })
      .catch((err) => setError(err.message));
  }, [router]);

  function buildOrderId() {
    const slug = checkoutForm.orderLabel
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "CHECKOUT";
    return `${slug}-${Date.now()}`;
  }

  async function submitCharge(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    setActiveCheckout(null);

    if (!apiKey.trim()) {
      setError("Masukkan API key aktif di halaman Secret terlebih dulu.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/payments/charge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey.trim(),
        },
        body: JSON.stringify({
          payment_type: "qris",
          transaction_details: {
            order_id: buildOrderId(),
            gross_amount: Number(checkoutForm.grossAmount),
          },
          customer_details: {
            first_name: checkoutForm.customerName,
            email: checkoutForm.customerEmail,
            phone: checkoutForm.customerPhone,
          },
          item_details: [
            {
              id: "POS-CHECKOUT",
              price: Number(checkoutForm.grossAmount),
              quantity: 1,
              name: checkoutForm.orderLabel || "Pembayaran Kasir",
            },
          ],
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Charge gagal.");
      }
      setActiveCheckout({
        ...payload,
        qrUrl: resolveQrUrl(payload),
        grossAmount: Number(checkoutForm.grossAmount),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <UserShell title="Manual Transaction" description="Halaman kasir untuk membuat pembayaran QRIS manual dan menampilkan QR langsung ke pelanggan.">
      {error ? <div className="notice error">{error}</div> : null}

      <section className="cashier-layout">
        <section className="panel stack cashier-main">
          <div className="section-head">
            <div>
              <span className="eyebrow">Checkout</span>
              <h2>Bayar via QRIS</h2>
              <p className="muted">Masukkan nominal dan tampilkan QR secara instan.</p>
            </div>
            <span className="chip">QRIS</span>
          </div>

          <form className="stack" onSubmit={submitCharge}>
            <div className="cashier-amount">
              <label className="field">
                <span>Total belanja</span>
                <input
                  type="number"
                  value={checkoutForm.grossAmount}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, grossAmount: event.target.value })}
                  required
                />
              </label>
              <div className="cashier-total">
                <span className="muted">Ringkasan</span>
                <strong>{formatCurrency(checkoutForm.grossAmount)}</strong>
              </div>
            </div>

            <div className="grid two">
              <label className="field">
                <span>Label transaksi</span>
                <input
                  value={checkoutForm.orderLabel}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, orderLabel: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Nama pelanggan</span>
                <input
                  value={checkoutForm.customerName}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, customerName: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Email pelanggan</span>
                <input
                  type="email"
                  value={checkoutForm.customerEmail}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, customerEmail: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Telepon pelanggan</span>
                <input
                  value={checkoutForm.customerPhone}
                  onChange={(event) => setCheckoutForm({ ...checkoutForm, customerPhone: event.target.value })}
                />
              </label>
            </div>

            <label className="field">
              <span>API Key aktif</span>
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste API key dari menu Secret"
              />
            </label>

            <div className="nav-links">
              <button type="submit" disabled={loading}>
                {loading ? "Membuat QR..." : "Tampilkan QRIS"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack cashier-side">
          <div className="section-head">
            <div>
              <span className="eyebrow">QR Aktif</span>
              <h2>Siap ditampilkan</h2>
            </div>
          </div>

          {activeCheckout ? (
            <div className="stack">
              <div className="cashier-summary">
                <div>
                  <span className="muted">Order ID</span>
                  <strong>{activeCheckout.order_id}</strong>
                </div>
                <div>
                  <span className="muted">Nominal</span>
                  <strong>{formatCurrency(activeCheckout.grossAmount)}</strong>
                </div>
                <div>
                  <span className="muted">Status</span>
                  <strong>{activeCheckout.transaction_status || activeCheckout.status_message || "-"}</strong>
                </div>
              </div>

              {activeCheckout.qrUrl ? (
                <div className="qr-panel">
                  <img src={activeCheckout.qrUrl} alt="QRIS payment" className="qr-image" />
                </div>
              ) : (
                <div className="qr-panel qr-empty">
                  <strong>QR belum tersedia</strong>
                  <span className="muted">Response Midtrans tidak mengembalikan URL QR image.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="qr-panel qr-empty">
              <strong>Belum ada transaksi aktif</strong>
              <span className="muted">QR akan muncul di sini setelah checkout dibuat.</span>
            </div>
          )}
        </section>
      </section>
    </UserShell>
  );
}

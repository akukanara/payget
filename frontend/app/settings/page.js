"use client";

import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";

export default function SettingsPage() {
  const router = useRouter();

  function logout() {
    localStorage.removeItem("userToken");
    router.push("/login");
  }

  return (
    <UserShell title="Settings" description="Pengaturan sederhana untuk workspace user, terpisah dari halaman kasir dan secret.">
      <section className="grid two">
        <article className="panel stack">
          <span className="eyebrow">Session</span>
          <h2>Keluar dari workspace</h2>
          <p className="muted">Hapus sesi lokal user di browser ini.</p>
          <div className="nav-links">
            <button className="button ghost" onClick={logout}>
              Logout
            </button>
          </div>
        </article>
        <article className="panel stack">
          <span className="eyebrow">Architecture</span>
          <h2>Service tetap terpisah</h2>
          <p className="muted">
            Frontend ini memanggil API Midtrans melalui service backend terpisah memakai `NEXT_PUBLIC_API_BASE_URL`.
            Tidak ada route API Next.js yang memproxy request Midtrans.
          </p>
        </article>
      </section>
    </UserShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";
import { getUserToken, loadUserWorkspace, rotateUserApiKey } from "../../lib/user-workspace";

export default function SecretPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getUserToken();
    if (!token) {
      router.push("/login");
      return;
    }

    loadUserWorkspace(token)
      .then(({ profile: profileData }) => setProfile(profileData))
      .catch((err) => setError(err.message));
  }, [router]);

  async function rotate() {
    try {
      const token = getUserToken();
      const payload = await rotateUserApiKey(token);
      setNewApiKey(payload.api_key);
      setApiKey(payload.api_key);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <UserShell title="Secret" description="Semua yang bersifat sensitif dipindah ke sini: API key aktif untuk terminal dan rotasi secret.">
      {error ? <div className="notice error">{error}</div> : null}
      <section className="grid two">
        <section className="panel stack">
          <span className="eyebrow">Terminal Secret</span>
          <h2>Hubungkan terminal kasir</h2>
          <label className="field">
            <span>API key aktif</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Paste API key lengkap di sini"
            />
          </label>
          <div className="cashier-inline">
            <div className="muted">Prefix aktif</div>
            <strong>{profile?.api_key_prefixes.join(", ") || "-"}</strong>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">Rotate</span>
          <h2>Buat secret baru</h2>
          <p className="muted">Gunakan hanya saat terminal lama perlu diganti atau API key terpapar.</p>
          <div className="nav-links">
            <button className="button secondary" type="button" onClick={rotate}>
              Rotate API Key
            </button>
          </div>
          {newApiKey ? <code className="inline-code">{newApiKey}</code> : null}
        </section>
      </section>
    </UserShell>
  );
}

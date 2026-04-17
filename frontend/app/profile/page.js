"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import UserShell from "../../components/user-shell";
import { loadUserWorkspace, getUserToken } from "../../lib/user-workspace";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
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

  return (
    <UserShell title="Profile" description="Informasi akun user dan status akses saat ini.">
      {error ? <div className="notice error">{error}</div> : null}
      {profile ? (
        <section className="grid two">
          <article className="panel stack">
            <span className="eyebrow">Identity</span>
            <h2>{profile.full_name}</h2>
            <p>{profile.email}</p>
          </article>
          <article className="panel stack">
            <span className="eyebrow">Account State</span>
            <div className="cashier-inline">
              <div className="muted">Role</div>
              <strong>{profile.is_admin ? "Admin" : "User"}</strong>
            </div>
            <div className="cashier-inline">
              <div className="muted">Approval</div>
              <strong>{profile.is_approved ? "Approved" : "Pending"}</strong>
            </div>
          </article>
        </section>
      ) : null}
    </UserShell>
  );
}

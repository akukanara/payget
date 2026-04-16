"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || "Request admin gagal.");
  }
  return payload;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    is_admin: false,
  });
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    password: "",
    is_admin: false,
  });
  const [error, setError] = useState("");

  async function loadUsers(currentToken) {
    const payload = await api("/api/admin/users", currentToken, { method: "GET" });
    setUsers(payload);
  }

  async function loadUserDetail(currentToken, userId) {
    const payload = await api(`/api/admin/users/${userId}`, currentToken, { method: "GET" });
    setSelectedUser(payload);
    setEditForm({
      full_name: payload.user.full_name,
      email: payload.user.email,
      password: "",
      is_admin: payload.user.is_admin,
    });
  }

  useEffect(() => {
    const currentToken = localStorage.getItem("adminToken");
    if (!currentToken) {
      router.push("/admin/login");
      return;
    }
    setToken(currentToken);
    loadUsers(currentToken).catch((err) => setError(err.message));
  }, [router]);

  async function createUser(event) {
    event.preventDefault();
    try {
      setError("");
      await api("/api/admin/users", token, {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ full_name: "", email: "", password: "", is_admin: false });
      await loadUsers(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateUser(event) {
    event.preventDefault();
    if (!selectedUser) return;
    try {
      setError("");
      const payload = {
        full_name: editForm.full_name,
        email: editForm.email,
        is_admin: editForm.is_admin,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await api(`/api/admin/users/${selectedUser.user.id}`, token, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadUsers(token);
      await loadUserDetail(token, selectedUser.user.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function approveUser(userId, action) {
    try {
      setError("");
      await api(`/api/admin/users/${userId}/${action}`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadUsers(token);
      if (selectedUser?.user.id === userId) {
        await loadUserDetail(token, userId);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(userId) {
    try {
      setError("");
      await api(`/api/admin/users/${userId}`, token, { method: "DELETE" });
      if (selectedUser?.user.id === userId) {
        setSelectedUser(null);
      }
      await loadUsers(token);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createApiKey(userId) {
    try {
      setError("");
      const payload = await api(`/api/admin/users/${userId}/api-keys`, token, {
        method: "POST",
        body: JSON.stringify({ is_active: true }),
      });
      setNewApiKey(payload.api_key);
      await loadUserDetail(token, userId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function setApiKeyStatus(userId, apiKeyId, isActive) {
    try {
      setError("");
      await api(`/api/admin/users/${userId}/api-keys/${apiKeyId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      await loadUserDetail(token, userId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteApiKey(userId, apiKeyId) {
    try {
      setError("");
      await api(`/api/admin/users/${userId}/api-keys/${apiKeyId}`, token, {
        method: "DELETE",
      });
      await loadUserDetail(token, userId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="shell stack">
      <div className="nav">
        <div>
          <div className="badge">Admin Users</div>
          <h1 style={{ marginBottom: 0 }}>Manajemen user dan API key</h1>
        </div>
        <div className="nav-links">
          <Link className="button ghost" href="/admin/dashboard">
            Kembali
          </Link>
        </div>
      </div>
      {error ? <p className="danger">{error}</p> : null}

      <section className="grid">
        <article className="panel stack">
          <h2>Buat user</h2>
          <form className="stack" onSubmit={createUser}>
            <label>
              Nama
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label>
              Password
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.is_admin}
                onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
                style={{ width: "auto", marginRight: 8 }}
              />
              Buat sebagai admin
            </label>
            <button type="submit">Create User</button>
          </form>
        </article>

        <article className="panel">
          <h2>Daftar user</h2>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Approval</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name}</td>
                  <td>{user.email}</td>
                  <td>{user.is_admin ? "Admin" : "User"}</td>
                  <td>{user.is_approved ? "Approved" : "Pending"}</td>
                  <td>
                    <div className="nav-links">
                      <button className="button ghost" onClick={() => loadUserDetail(token, user.id)}>Detail</button>
                      <button className="button ghost" onClick={() => approveUser(user.id, "approve")}>Approve</button>
                      <button className="button ghost" onClick={() => approveUser(user.id, "reject")}>Reject</button>
                      <button className="button ghost" onClick={() => deleteUser(user.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      {selectedUser ? (
        <section className="panel stack">
          <div className="nav">
            <div>
              <h2 style={{ marginBottom: 0 }}>Detail user</h2>
              <p>{selectedUser.user.email}</p>
            </div>
            <button className="button secondary" onClick={() => createApiKey(selectedUser.user.id)}>
              Generate API Key
            </button>
          </div>

          {newApiKey ? (
            <div className="card stack">
              <div className="muted">API key baru</div>
              <code style={{ wordBreak: "break-all" }}>{newApiKey}</code>
            </div>
          ) : null}

          <form className="grid" onSubmit={updateUser}>
            <label>
              Nama
              <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </label>
            <label>
              Password baru
              <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={editForm.is_admin}
                onChange={(e) => setEditForm({ ...editForm, is_admin: e.target.checked })}
                style={{ width: "auto", marginRight: 8 }}
              />
              Admin
            </label>
            <div style={{ alignSelf: "end" }}>
              <button type="submit">Update User</button>
            </div>
          </form>

          <div>
            <h3>API Keys</h3>
            <table>
              <thead>
                <tr>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {selectedUser.api_keys.map((item) => (
                  <tr key={item.id}>
                    <td>{item.key_prefix}</td>
                    <td>{item.is_active ? "Active" : "Inactive"}</td>
                    <td>{item.created_at || "-"}</td>
                    <td>
                      <div className="nav-links">
                        <button className="button ghost" onClick={() => setApiKeyStatus(selectedUser.user.id, item.id, !item.is_active)}>
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button className="button ghost" onClick={() => deleteApiKey(selectedUser.user.id, item.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}

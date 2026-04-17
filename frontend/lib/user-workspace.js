import { API_BASE_URL, authFetch } from "./api";

export async function loadUserWorkspace(token) {
  const [profile, summary, transactions] = await Promise.all([
    authFetch("/api/auth/me", token),
    authFetch("/api/user/dashboard/summary", token),
    authFetch("/api/user/transactions", token),
  ]);
  return { profile, summary, transactions };
}

export async function rotateUserApiKey(token) {
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
  return payload;
}

export function getUserToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return localStorage.getItem("userToken") || "";
}

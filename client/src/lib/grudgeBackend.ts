/**
 * grudgeBackend.ts — Grudge Studio auth & session integration for DCQ.
 *
 * Handles:
 *   1. SSO token pickup from ?sso_token=... (id.grudge-studio.com redirect)
 *   2. Token / session persistence (localStorage + cookie)
 *   3. getCurrentUser() for display name, grudge ID, etc.
 *   4. Non-blocking auth — guests always play, never hard-redirect.
 */

// ── Constants ────────────────────────────────────────────────────────────────
const AUTH_TOKEN_KEY = "grudge_auth_token";
const SESSION_KEY = "grudge-session";
const GRUDGE_AUTH_URL = "https://id.grudge-studio.com";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// ── SSO token pickup (runs once on module load) ──────────────────────────────
// When id.grudge-studio.com redirects back it appends ?sso_token=...&grudge_id=...
// to the URL. We pick those up, save them, and clean the URL.
(function pickupSsoToken() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get("sso_token");
    if (!ssoToken) return;

    // Save token
    localStorage.setItem(AUTH_TOKEN_KEY, ssoToken);
    setCookie(AUTH_TOKEN_KEY, ssoToken);

    // Save identity fields
    const grudgeId = params.get("grudge_id") || params.get("grudgeId") || "";
    const username = params.get("grudge_username") || params.get("username") || "";
    if (grudgeId) {
      localStorage.setItem("grudge_id", grudgeId);
      setCookie("grudge_id", grudgeId);
    }
    if (username) localStorage.setItem("grudge_username", username);

    // Also handle legacy hash-based tokens (some old links still use #token=)
    // so existing bookmarks don't break.
    params.delete("sso_token");
    params.delete("grudge_id");
    params.delete("grudgeId");
    params.delete("grudge_username");
    params.delete("username");
    const clean = params.toString();
    const newUrl = window.location.pathname + (clean ? `?${clean}` : "") + window.location.hash;
    window.history.replaceState(null, "", newUrl);
  } catch { /* SSR/test guard */ }
})();

// Also handle legacy hash-based tokens (#token=...) for backward compat
(function pickupHashToken() {
  try {
    if (!location.hash || !location.hash.includes("token=")) return;
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get("token");
    if (!token) return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setCookie(AUTH_TOKEN_KEY, token);
    if (hash.get("grudgeId")) {
      localStorage.setItem("grudge_id", hash.get("grudgeId")!);
      setCookie("grudge_id", hash.get("grudgeId")!);
    }
    if (hash.get("name")) localStorage.setItem("grudge_username", hash.get("name")!);
    window.history.replaceState(null, "", location.pathname + location.search);
  } catch { /* guard */ }
})();

// ── Cookie helpers ───────────────────────────────────────────────────────────
function setCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch { /* SSR guard */ }
}

function clearCookie(name: string): void {
  try {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  } catch { /* SSR guard */ }
}

// ── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  setCookie(AUTH_TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  clearCookie(AUTH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, "X-Session-Token": token }
    : {};
}

// ── User info ────────────────────────────────────────────────────────────────
export interface GrudgeUser {
  grudgeId: string;
  username: string;
  token: string;
}

export function getCurrentUser(): GrudgeUser | null {
  const token = getToken();
  if (!token) return null;
  const grudgeId = localStorage.getItem("grudge_id") || "";
  const username = localStorage.getItem("grudge_username") || "Player";
  if (!grudgeId && !username) return null;
  return { grudgeId, username, token };
}

// ── Logout ───────────────────────────────────────────────────────────────────
export function logout(): void {
  clearToken();
  clearCookie("grudge_id");
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("grudge_id");
  localStorage.removeItem("grudge_username");
  localStorage.removeItem("grudge_user_id");
}

// ── Login redirect (user-triggered only, never automatic) ────────────────────
export function getLoginUrl(returnPath?: string): string {
  const returnTo = returnPath || window.location.pathname;
  const origin = window.location.origin;
  const redirectUrl = `${origin}${returnTo}`;
  return `${GRUDGE_AUTH_URL}?redirect=${encodeURIComponent(redirectUrl)}&app=dcq`;
}

// ── Token validation (client-side JWT expiry check) ──────────────────────────
export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        logout();
        return true;
      }
    }
  } catch {
    // Not a JWT — treat any non-empty token as valid (Puter session tokens)
  }
  return false;
}

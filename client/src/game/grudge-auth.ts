/**
 * Grudge Auth — Client-side authentication service
 *
 * Manages the full auth lifecycle:
 *   1. Check for existing JWT on boot
 *   2. Verify token with backend (GET /api/auth/me)
 *   3. Auto-guest-login if no valid session
 *   4. Support Discord OAuth + Puter login upgrades
 *   5. Store session in localStorage for persistence
 *
 * All game systems should use getSession() to get the current player identity.
 * player-account.ts reads the token via getAuthToken().
 */

import { isPuterAvailable } from './puter-cloud';

// ── Types ──────────────────────────────────────────────────────

export interface AuthSession {
  /** JWT token for API calls */
  token: string;
  /** Grudge backend user ID */
  userId: string;
  /** Player's Grudge ID (e.g. GRUDGE_A1B2C3D4E5F6) */
  grudgeId: string;
  /** Display username */
  username: string;
  /** Display name (may differ from username) */
  displayName: string | null;
  /** Email if provided */
  email: string | null;
  /** Avatar URL (Discord/GitHub) */
  avatarUrl: string | null;
  /** Whether this is a guest account */
  isGuest: boolean;
  /** Auth providers linked (e.g. ['discord', 'puter']) */
  providers: string[];
  /** Faction if set */
  faction: string | null;
}

type AuthListener = (session: AuthSession | null) => void;

// ── Constants ──────────────────────────────────────────────────

const TOKEN_KEY = 'grudge_auth_token';
const SESSION_KEY = 'grudge_auth_session';
const AUTH_API = '/api/auth';

// ── State ──────────────────────────────────────────────────────

let _session: AuthSession | null = null;
let _initialized = false;
const _listeners: AuthListener[] = [];

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialize auth. Call once at app boot BEFORE any game system init.
 *
 * 1. Check URL for OAuth callback tokens (Discord redirect)
 * 2. Check localStorage for existing token
 * 3. Verify token with backend
 * 4. If no valid session, auto-login as guest
 *
 * Returns the active session.
 */
export async function initAuth(): Promise<AuthSession | null> {
  if (_initialized) return _session;
  _initialized = true;

  // 1. Check for OAuth callback in URL hash (Discord redirect lands here)
  const callbackSession = consumeOAuthCallback();
  if (callbackSession) {
    _setSession(callbackSession);
    return _session;
  }

  // 2. Try existing token from localStorage
  const savedToken = localStorage.getItem(TOKEN_KEY);
  if (savedToken) {
    const verified = await verifyToken(savedToken);
    if (verified) {
      _setSession(verified);
      return _session;
    }
    // Token expired/invalid — clear it
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  // 3. Try Puter auto-login if available
  if (isPuterAvailable()) {
    try {
      const puterUser = await (window as any).puter?.auth?.getUser?.();
      if (puterUser?.uuid) {
        const puterSession = await loginWithPuter(puterUser.uuid, puterUser.username);
        if (puterSession) return _session;
      }
    } catch { /* puter not signed in — continue */ }
  }

  // 4. Auto-login as guest
  await loginAsGuest();
  return _session;
}

/** Get current session (null if not authenticated) */
export function getSession(): AuthSession | null {
  return _session;
}

/** Get the raw JWT token for API calls */
export function getAuthToken(): string | null {
  return _session?.token || localStorage.getItem(TOKEN_KEY);
}

/** Check if user is authenticated */
export function isAuthenticated(): boolean {
  return _session !== null;
}

/** Check if user is a guest (needs to upgrade to keep data) */
export function isGuest(): boolean {
  return _session?.isGuest ?? true;
}

/** Subscribe to session changes */
export function onAuthChange(listener: AuthListener): () => void {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

// ── Login Methods ──────────────────────────────────────────────

/**
 * Login with Discord — redirects to Discord OAuth.
 * User will be redirected back to the app with a token.
 */
export function loginWithDiscord(): void {
  window.location.href = `${AUTH_API}/discord`;
}

/**
 * Login as guest — creates a new guest account with a Grudge ID.
 * Guest accounts can be upgraded later by linking Discord/Puter.
 */
export async function loginAsGuest(): Promise<AuthSession | null> {
  try {
    const resp = await fetch(`${AUTH_API}/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.token) return null;

    const session = authResponseToSession(data);
    _setSession(session);
    return session;
  } catch {
    return null;
  }
}

/**
 * Login with Puter — links/creates account from Puter ID.
 */
export async function loginWithPuter(puterId: string, displayName?: string): Promise<AuthSession | null> {
  try {
    const resp = await fetch(`${AUTH_API}/puter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puterId, displayName }),
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.token) return null;

    const session = authResponseToSession(data);
    _setSession(session);
    return session;
  } catch {
    return null;
  }
}

/**
 * Logout — clear local session and revoke token on backend.
 */
export async function logout(): Promise<void> {
  const token = _session?.token;

  // Clear local state immediately
  _session = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  _notify();

  // Best-effort revoke on backend
  if (token) {
    try {
      await fetch(`${AUTH_API}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
  }
}

// ── Internal Helpers ───────────────────────────────────────────

/** Verify a JWT with the backend, returns session or null */
async function verifyToken(token: string): Promise<AuthSession | null> {
  try {
    const resp = await fetch(`${AUTH_API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.user) return null;

    return {
      token,
      userId: data.user.id,
      grudgeId: data.user.grudgeId,
      username: data.user.username,
      displayName: data.user.displayName,
      email: data.user.email,
      avatarUrl: data.user.avatarUrl,
      isGuest: data.user.isGuest,
      providers: data.user.providers || [],
      faction: data.user.faction,
    };
  } catch {
    // Backend unreachable — try cached session
    try {
      const cached = localStorage.getItem(SESSION_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as AuthSession;
        if (parsed.token === token) return parsed;
      }
    } catch { /* corrupt cache */ }
    return null;
  }
}

/** Check URL for OAuth callback tokens (from Discord redirect) */
function consumeOAuthCallback(): AuthSession | null {
  const url = new URL(window.location.href);

  // Check for auth_success in query params
  if (url.searchParams.get('auth_success') !== '1') return null;

  // Token is in the URL fragment (#token=xxx&grudgeId=xxx)
  const hash = window.location.hash.substring(1); // remove #
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get('token');
  const grudgeId = params.get('grudgeId');
  const username = params.get('username');
  const provider = params.get('provider');

  if (!token) return null;

  // Clean URL (remove auth params)
  url.searchParams.delete('auth_success');
  window.history.replaceState({}, '', url.pathname + url.search);

  return {
    token,
    userId: '', // will be populated on next verify
    grudgeId: grudgeId || '',
    username: username || 'Player',
    displayName: null,
    email: null,
    avatarUrl: null,
    isGuest: false,
    providers: provider ? [provider] : [],
    faction: null,
  };
}

/** Convert backend auth response to AuthSession */
function authResponseToSession(data: any): AuthSession {
  return {
    token: data.token,
    userId: data.user?.id || '',
    grudgeId: data.user?.grudgeId || '',
    username: data.user?.username || 'Player',
    displayName: data.user?.displayName || null,
    email: data.user?.email || null,
    avatarUrl: data.user?.avatarUrl || null,
    isGuest: data.user?.isGuest ?? true,
    providers: data.user?.providers || [],
    faction: data.user?.faction || null,
  };
}

/** Set session and persist */
function _setSession(session: AuthSession): void {
  _session = session;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Also set grudge_id for backward compat with player-account.ts
  if (session.grudgeId) {
    localStorage.setItem('grudge_id', session.grudgeId);
  }
  _notify();
}

/** Notify listeners of session change */
function _notify(): void {
  for (const listener of _listeners) {
    try { listener(_session); } catch { /* ignore */ }
  }
}

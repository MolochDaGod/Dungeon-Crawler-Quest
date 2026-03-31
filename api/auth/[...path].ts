import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Auth Proxy — Forwards auth requests to Grudge backend.
 *
 * Routes:
 *   GET  /api/auth/discord           → Redirect to Discord OAuth
 *   GET  /api/auth/discord/callback  → Exchange code for JWT, redirect to frontend
 *   POST /api/auth/guest             → Create guest account, return JWT
 *   POST /api/auth/puter             → Puter login, return JWT
 *   GET  /api/auth/me                → Verify token, return user info
 *   POST /api/auth/logout            → Revoke token
 *
 * All routes proxy to api.grudge-studio.com server-side (no CORS issues).
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dungeon-crawler-quest.vercel.app';

async function proxyToBackend(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: any,
): Promise<Response> {
  const url = `${GRUDGE_BACKEND}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }
  return fetch(url, opts);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract sub-path: /api/auth/discord/callback → ["discord", "callback"]
  const pathSegments = (req.query.path as string[]) || [];
  const subPath = pathSegments.join('/');
  const authHeader = req.headers.authorization as string | undefined;
  const fwdHeaders: Record<string, string> = {};
  if (authHeader) fwdHeaders['Authorization'] = authHeader;

  try {
    // ── Discord OAuth Start ────────────────────────────────────
    if (subPath === 'discord' && req.method === 'GET') {
      // Redirect user to backend's Discord OAuth initiation
      // The backend will redirect to Discord, then back to /auth/discord/callback
      const backendAuthUrl = `${GRUDGE_BACKEND}/auth/discord?redirect_uri=${encodeURIComponent(FRONTEND_URL + '/api/auth/discord/callback')}`;
      return res.redirect(302, backendAuthUrl);
    }

    // ── Discord OAuth Callback ─────────────────────────────────
    if (subPath === 'discord/callback' && req.method === 'GET') {
      const code = req.query.code as string;
      if (!code) {
        return res.redirect(302, `${FRONTEND_URL}?auth_error=no_code`);
      }

      // Forward the code to backend for token exchange
      const resp = await proxyToBackend('GET', `/auth/discord/callback?code=${encodeURIComponent(code)}`, fwdHeaders);

      if (!resp.ok) {
        return res.redirect(302, `${FRONTEND_URL}?auth_error=backend_error`);
      }

      const data = await resp.json() as any;

      if (data.token) {
        // Redirect to frontend with token in URL fragment (not query — more secure)
        const params = new URLSearchParams({
          token: data.token,
          grudgeId: data.user?.grudgeId || '',
          username: data.user?.username || '',
          provider: 'discord',
        });
        return res.redirect(302, `${FRONTEND_URL}?auth_success=1#${params.toString()}`);
      }

      return res.redirect(302, `${FRONTEND_URL}?auth_error=no_token`);
    }

    // ── Guest Login ────────────────────────────────────────────
    if (subPath === 'guest' && req.method === 'POST') {
      const resp = await proxyToBackend('POST', '/auth/guest', fwdHeaders, req.body || {});
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    // ── Puter Login ────────────────────────────────────────────
    if (subPath === 'puter' && req.method === 'POST') {
      const { puterId, displayName } = req.body || {};
      if (!puterId) {
        return res.status(400).json({ error: 'puterId is required' });
      }
      const resp = await proxyToBackend('POST', '/auth/puter', fwdHeaders, { puterId, displayName });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    // ── Verify Token (GET /api/auth/me) ────────────────────────
    if (subPath === 'me' && req.method === 'GET') {
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
      }
      const resp = await proxyToBackend('GET', '/auth/me', fwdHeaders);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    // ── Logout ─────────────────────────────────────────────────
    if (subPath === 'logout' && req.method === 'POST') {
      if (!authHeader) {
        return res.status(200).json({ ok: true });
      }
      const resp = await proxyToBackend('POST', '/auth/logout', fwdHeaders);
      const data = await resp.json().catch(() => ({ ok: true }));
      return res.status(resp.status).json(data);
    }

    // ── Fallback: proxy any other auth path to backend ─────────
    const resp = await proxyToBackend(
      req.method || 'GET',
      `/auth/${subPath}`,
      fwdHeaders,
      req.body,
    );
    const data = await resp.json().catch(() => ({}));
    return res.status(resp.status).json(data);

  } catch (error: any) {
    console.error('[auth proxy]', error);
    return res.status(502).json({ error: 'Auth service unavailable', details: error.message });
  }
}

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

// Auth lives on the grudge-id service, NOT game-api
const GRUDGE_AUTH_URL = process.env.GRUDGE_AUTH_URL || 'https://id.grudge-studio.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://dungeon-crawler-quest.vercel.app';

async function proxyToAuth(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: any,
): Promise<Response> {
  const url = `${GRUDGE_AUTH_URL}${path}`;
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
      // Redirect to grudge-id's Discord OAuth with return_to hint
      // grudge-id reads DEFAULT_AUTH_REDIRECT for the post-login redirect.
      // We pass return_to so grudge-id (if it supports it) can redirect back to DCQ.
      const backendAuthUrl = `${GRUDGE_AUTH_URL}/auth/discord?return_to=${encodeURIComponent(FRONTEND_URL)}`;
      return res.redirect(302, backendAuthUrl);
    }

    // ── Discord OAuth Callback ─────────────────────────────────
    // grudge-id handles the Discord callback internally and redirects
    // to DEFAULT_AUTH_REDIRECT with token. If that lands on grudgewarlords.com,
    // the client-side grudge-auth.ts will also check for tokens on page load.
    // For direct DCQ flow, grudge-id needs return_to support.
    if (subPath === 'discord/callback' && req.method === 'GET') {
      const code = req.query.code as string;
      if (!code) {
        return res.redirect(302, `${FRONTEND_URL}?auth_error=no_code`);
      }

      // Forward the code to grudge-id for token exchange
      const resp = await proxyToAuth('GET', `/auth/discord/callback?code=${encodeURIComponent(code)}`, fwdHeaders);

      // grudge-id may redirect (302) rather than return JSON.
      // If we got a redirect, extract the token from the Location header.
      if (resp.redirected && resp.url) {
        try {
          const redirectUrl = new URL(resp.url);
          const token = redirectUrl.searchParams.get('token');
          if (token) {
            const params = new URLSearchParams({ token, provider: 'discord' });
            return res.redirect(302, `${FRONTEND_URL}?auth_success=1#${params.toString()}`);
          }
        } catch { /* parse error — fall through */ }
      }

      if (!resp.ok) {
        return res.redirect(302, `${FRONTEND_URL}?auth_error=backend_error`);
      }

      const data = await resp.json() as any;

      if (data.token) {
        const params = new URLSearchParams({
          token: data.token,
          grudgeId: data.user?.grudgeId || data.grudge_id || '',
          username: data.user?.username || data.name || '',
          provider: 'discord',
        });
        return res.redirect(302, `${FRONTEND_URL}?auth_success=1#${params.toString()}`);
      }

      return res.redirect(302, `${FRONTEND_URL}?auth_error=no_token`);
    }

    // ── Guest Login ────────────────────────────────────────────
    if (subPath === 'guest' && req.method === 'POST') {
      const resp = await proxyToAuth('POST', '/auth/guest', fwdHeaders, req.body || {});
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    // ── Puter Login ────────────────────────────────────────────
    if (subPath === 'puter' && req.method === 'POST') {
      const { puterId, displayName } = req.body || {};
      if (!puterId) {
        return res.status(400).json({ error: 'puterId is required' });
      }
      const resp = await proxyToAuth('POST', '/auth/puter', fwdHeaders, { puterId, displayName });
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    // ── Verify Token (GET /api/auth/me) ────────────────────────
    // grudge-id uses /identity/me for token verification
    if (subPath === 'me' && req.method === 'GET') {
      if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
      }
      const resp = await proxyToAuth('GET', '/identity/me', fwdHeaders);
      if (!resp.ok) {
        return res.status(resp.status).json(await resp.json().catch(() => ({ error: 'Token invalid' })));
      }
      const data = await resp.json();
      // Normalize response to { user: { ... } } shape expected by grudge-auth.ts
      return res.status(200).json({ user: data.user || data });
    }

    // ── Logout ─────────────────────────────────────────────────
    if (subPath === 'logout' && req.method === 'POST') {
      if (!authHeader) {
        return res.status(200).json({ ok: true });
      }
      const resp = await proxyToAuth('POST', '/auth/logout', fwdHeaders);
      const data = await resp.json().catch(() => ({ ok: true }));
      return res.status(resp.status).json(data);
    }

    // ── Fallback: proxy any other auth path to grudge-id ───────
    const resp = await proxyToAuth(
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

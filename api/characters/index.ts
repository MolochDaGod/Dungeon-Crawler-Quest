import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Player Character CRUD API
 *
 * POST   /api/characters          — Create new character
 * GET    /api/characters?account=X — List characters for account
 *
 * Production: proxies to Grudge backend at api.grudge-studio.com
 * Fallback: in-memory store for dev/preview deployments
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';
const USE_BACKEND = process.env.NODE_ENV === 'production' || !!process.env.GRUDGE_BACKEND_URL;

// In-memory fallback for dev/preview (NOT used in production)
const characters = new Map<string, any>();

/** Proxy a request to the Grudge backend */
async function proxyToBackend(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  try {
    const resp = await fetch(`${GRUDGE_BACKEND}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  } catch (err: any) {
    return { status: 502, data: { error: 'Backend unreachable', details: err.message } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── Production: proxy to Grudge backend ──
    if (USE_BACKEND) {
      const accountId = req.query.account as string;
      const queryStr = accountId ? `?account=${accountId}` : '';
      const result = await proxyToBackend(req.method || 'GET', `/api/characters${queryStr}`, req.body);
      return res.status(result.status).json(result.data);
    }

    // ── Dev fallback: in-memory store ──
    switch (req.method) {
      case 'POST': {
        const body = req.body;
        if (!body || !body.customName || !body.race || !body.heroClass) {
          return res.status(400).json({ error: 'Missing required fields: customName, race, heroClass' });
        }
        const charGrudgeId = body.grudgeId || `CHAR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const character = {
          ...body,
          grudgeId: charGrudgeId,
          createdAt: body.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        characters.set(charGrudgeId, character);
        return res.status(201).json(character);
      }
      case 'GET': {
        const accountId = req.query.account as string;
        if (accountId) {
          const accountChars = Array.from(characters.values()).filter(c => c.accountId === accountId);
          return res.json({ characters: accountChars, count: accountChars.length });
        }
        return res.json({ characters: Array.from(characters.values()), count: characters.size });
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[characters API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

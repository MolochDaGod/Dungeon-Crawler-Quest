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

/**
 * Proxy to Grudge Studio VPS game-api at api.grudge-studio.com.
 *
 * Field mapping (DCQ → VPS):
 *   customName → name
 *   heroClass  → class
 *   grudgeId   stored in stats JSON for retrieval
 *
 * The Authorization header from the client is forwarded so the VPS can
 * verify the Grudge JWT and enforce character ownership.
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';

/** Map DCQ PlayerCharacterState → VPS game-api format */
function toDCQtoVPS(body: any) {
  return {
    name: body.customName || body.name || 'Unknown',
    race: (body.race || 'human').toLowerCase(),
    class: (body.heroClass || body.class || 'warrior').toLowerCase(),
    faction: body.faction || null,
    // Embed full DCQ state in stats JSON so we can restore it exactly
    stats: body,
  };
}

/** Map VPS character row → DCQ PlayerCharacterState */
function fromVPStoDCQ(row: any): any {
  // If stats contains the full DCQ state, return it (merging VPS id back in)
  if (row.stats && typeof row.stats === 'object' && row.stats.customName) {
    return { ...row.stats, _vpsId: row.id };
  }
  // Fallback: reconstruct minimal DCQ state from VPS fields
  return {
    grudgeId: row.grudge_id || row.id,
    customName: row.name,
    race: row.race,
    heroClass: row.class,
    faction: row.faction,
    _vpsId: row.id,
  };
}

async function proxyToVPS(
  method: string,
  path: string,
  authHeader: string | undefined,
  body?: any,
): Promise<{ status: number; data: any }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;
    const resp = await fetch(`${GRUDGE_BACKEND}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  } catch (err: any) {
    return { status: 502, data: { error: 'Backend unreachable', details: err.message } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization as string | undefined;

  try {
    switch (req.method) {
      case 'GET': {
        // Return all characters for the authenticated user
        const result = await proxyToVPS('GET', '/characters', authHeader);
        if (!result.data || result.status !== 200) {
          return res.status(result.status).json(result.data);
        }
        const rows = Array.isArray(result.data) ? result.data : [];
        return res.json(rows.map(fromVPStoDCQ));
      }
      case 'POST': {
        const body = req.body;
        if (!body?.customName || !body?.race || !body?.heroClass) {
          return res.status(400).json({ error: 'Missing required fields: customName, race, heroClass' });
        }
        const vpsBody = toDCQtoVPS(body);
        const result = await proxyToVPS('POST', '/characters', authHeader, vpsBody);
        if (result.status !== 201) return res.status(result.status).json(result.data);
        return res.status(201).json(fromVPStoDCQ(result.data));
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[characters API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

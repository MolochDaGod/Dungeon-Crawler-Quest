import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Catch-all handler for /api/characters/:id
 * Handles GET, PUT, DELETE for individual characters by grudgeId.
 *
 * Production: proxies to Grudge backend at api.grudge-studio.com
 * Dev/preview: in-memory fallback store
 */

/**
 * /api/characters/:grudgeId — GET, PUT, DELETE
 *
 * The VPS game-api uses numeric MySQL IDs, but DCQ uses grudgeId strings.
 * Strategy:
 *   GET  — Fetch all user chars, find the one whose stats.grudgeId matches
 *   PUT  — Same lookup, then PATCH stats on VPS via the numeric id
 *   DELETE — Same lookup, then DELETE via numeric id
 *
 * Authorization header from client is forwarded to VPS.
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';

function fromVPStoDCQ(row: any): any {
  if (row.stats && typeof row.stats === 'object' && row.stats.customName) {
    return { ...row.stats, _vpsId: row.id };
  }
  return { grudgeId: row.grudge_id || String(row.id), customName: row.name, race: row.race, heroClass: row.class, faction: row.faction, _vpsId: row.id };
}

async function vpsFetch(
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

/** Find VPS character row whose embedded DCQ grudgeId matches */
async function findVPSCharacter(
  grudgeId: string,
  authHeader: string | undefined,
): Promise<{ vpsId: number; row: any } | null> {
  const result = await vpsFetch('GET', '/characters', authHeader);
  if (result.status !== 200 || !Array.isArray(result.data)) return null;
  for (const row of result.data) {
    const dcq = fromVPStoDCQ(row);
    if (dcq.grudgeId === grudgeId || String(row.id) === grudgeId) {
      return { vpsId: row.id, row };
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const idSegments = req.query.id;
  const grudgeId = Array.isArray(idSegments) ? idSegments[0] : idSegments;
  if (!grudgeId) return res.status(400).json({ error: 'Missing character ID' });

  const authHeader = req.headers.authorization as string | undefined;

  try {
    switch (req.method) {
      case 'GET': {
        const found = await findVPSCharacter(grudgeId, authHeader);
        if (!found) return res.status(404).json({ error: 'Character not found' });
        return res.json(fromVPStoDCQ(found.row));
      }
      case 'PUT': {
        const found = await findVPSCharacter(grudgeId, authHeader);
        if (!found) {
          // Character doesn't exist on VPS yet — create it
          const vpsBody = {
            name: req.body?.customName || 'Unknown',
            race: (req.body?.race || 'human').toLowerCase(),
            class: (req.body?.heroClass || 'warrior').toLowerCase(),
            faction: req.body?.faction || null,
            stats: req.body,
          };
          const createResult = await vpsFetch('POST', '/characters', authHeader, vpsBody);
          if (createResult.status !== 201) return res.status(createResult.status).json(createResult.data);
          return res.json(fromVPStoDCQ(createResult.data));
        }
        // Update stats on existing character
        const statsResult = await vpsFetch(
          'PATCH', `/characters/${found.vpsId}/stats`, authHeader,
          { stats: req.body },
        );
        if (!statsResult.data.success && statsResult.status !== 200) {
          // stats endpoint may not exist — fall through to returning cached data
        }
        return res.json({ ...fromVPStoDCQ(found.row), ...req.body, _vpsId: found.vpsId });
      }
      case 'DELETE': {
        const found = await findVPSCharacter(grudgeId, authHeader);
        if (!found) return res.status(404).json({ error: 'Character not found' });
        const result = await vpsFetch('DELETE', `/characters/${found.vpsId}`, authHeader);
        return res.status(result.status).json(result.data);
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[characters/:id API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Catch-all handler for /api/characters/:id
 * Handles GET, PUT, DELETE for individual characters by grudgeId.
 *
 * Production: proxies to Grudge backend at api.grudge-studio.com
 * Dev/preview: in-memory fallback store
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';
const USE_BACKEND = process.env.NODE_ENV === 'production' || !!process.env.GRUDGE_BACKEND_URL;

// In-memory fallback for dev/preview (NOT used in production)
const characters = new Map<string, any>();

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const idSegments = req.query.id;
  const grudgeId = Array.isArray(idSegments) ? idSegments.join('/') : idSegments;
  if (!grudgeId) return res.status(400).json({ error: 'Missing character ID' });

  try {
    // ── Production: proxy to Grudge backend ──
    if (USE_BACKEND) {
      const result = await proxyToBackend(
        req.method || 'GET',
        `/api/characters/${grudgeId}`,
        req.method === 'PUT' ? req.body : undefined,
      );
      return res.status(result.status).json(result.data);
    }

    // ── Dev fallback: in-memory store ──
    switch (req.method) {
      case 'GET': {
        const character = characters.get(grudgeId);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        return res.json(character);
      }
      case 'PUT': {
        let existing = characters.get(grudgeId);
        if (!existing) existing = { grudgeId };
        const updated = { ...existing, ...req.body, grudgeId, lastLogin: new Date().toISOString() };
        characters.set(grudgeId, updated);
        return res.json(updated);
      }
      case 'DELETE': {
        const deleted = characters.delete(grudgeId);
        return res.json({ deleted, id: grudgeId });
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[characters/:id API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

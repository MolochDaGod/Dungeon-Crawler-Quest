import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Player Character CRUD API
 *
 * POST   /api/characters          — Create new character
 * GET    /api/characters/:id      — Get character by grudgeId
 * PUT    /api/characters/:id      — Update character
 * DELETE /api/characters/:id      — Delete character
 * GET    /api/characters?account=X — List characters for account
 *
 * Data stored in-memory for now (replace with Grudge backend DB).
 * In production, this proxies to the real Grudge backend at grudge-studio.com.
 */

// In-memory store (replace with DB in production)
const characters = new Map<string, any>();

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const grudgeId = Array.isArray(id) ? id[0] : id;

  try {
    switch (req.method) {
      case 'POST': {
        const body = req.body;
        if (!body || !body.customName || !body.race || !body.heroClass) {
          return res.status(400).json({ error: 'Missing required fields: customName, race, heroClass' });
        }

        // Generate grudgeId if not provided
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
        if (grudgeId) {
          const character = characters.get(grudgeId);
          if (!character) return res.status(404).json({ error: 'Character not found' });
          return res.json(character);
        }

        // List by account
        const accountId = req.query.account as string;
        if (accountId) {
          const accountChars = Array.from(characters.values()).filter(c => c.accountId === accountId);
          return res.json({ characters: accountChars, count: accountChars.length });
        }

        // List all (admin)
        return res.json({ characters: Array.from(characters.values()), count: characters.size });
      }

      case 'PUT': {
        if (!grudgeId) return res.status(400).json({ error: 'Missing character ID' });
        const existing = characters.get(grudgeId);
        if (!existing) return res.status(404).json({ error: 'Character not found' });

        const updated = { ...existing, ...req.body, grudgeId, lastLogin: new Date().toISOString() };
        characters.set(grudgeId, updated);
        return res.json(updated);
      }

      case 'DELETE': {
        if (!grudgeId) return res.status(400).json({ error: 'Missing character ID' });
        const deleted = characters.delete(grudgeId);
        return res.json({ deleted, id: grudgeId });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[characters API]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

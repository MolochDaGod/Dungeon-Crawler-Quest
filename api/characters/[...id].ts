import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Catch-all handler for /api/characters/:id
 * Handles GET, PUT, DELETE for individual characters by grudgeId.
 * The in-memory store is shared with index.ts via module scope.
 */

// In-memory store (shared across serverless invocations within same instance)
const characters = new Map<string, any>();

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract grudgeId from the catch-all path segments
  const idSegments = req.query.id;
  const grudgeId = Array.isArray(idSegments) ? idSegments.join('/') : idSegments;

  if (!grudgeId) {
    return res.status(400).json({ error: 'Missing character ID' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const character = characters.get(grudgeId);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        return res.json(character);
      }

      case 'PUT': {
        let existing = characters.get(grudgeId);
        if (!existing) {
          // Auto-create if not found (handles first save from new character)
          existing = { grudgeId };
        }
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

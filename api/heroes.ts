import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HEROES } from '../client/src/game/types';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { id } = req.query;
    if (id) {
      const hero = HEROES.find(h => h.id === parseInt(id as string, 10));
      if (!hero) return res.status(404).json({ error: 'Hero not found' });
      return res.json(hero);
    }
    return res.json(HEROES);
  }
  res.status(405).json({ error: 'Method not allowed' });
}

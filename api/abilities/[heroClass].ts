import type { VercelRequest, VercelResponse } from '@vercel/node';
import { CLASS_ABILITIES } from '../../client/src/game/types';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const heroClass = req.query.heroClass as string;
    const abilities = CLASS_ABILITIES[heroClass];
    if (!abilities) return res.status(404).json({ error: 'Class not found' });
    return res.json(abilities);
  }
  res.status(405).json({ error: 'Method not allowed' });
}

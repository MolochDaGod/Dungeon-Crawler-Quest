import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/mint-status/:actionId
 *
 * Polls Crossmint for the mint action status.
 * Returns: { status: 'pending' | 'success' | 'failed', data?: {...} }
 */

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || '';
const CROSSMINT_ENV = process.env.CROSSMINT_ENV || 'staging';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { actionId } = req.query;
  if (!actionId || !CROSSMINT_API_KEY) {
    return res.status(400).json({ error: 'Missing actionId or API key' });
  }

  try {
    const resp = await fetch(
      `https://${CROSSMINT_ENV}.crossmint.com/api/2022-06-09/actions/${actionId}`,
      { headers: { 'X-API-KEY': CROSSMINT_API_KEY } },
    );
    const data = await resp.json();
    return res.json({
      status: data.status || 'unknown',
      actionId,
      data: data.data || null,
      completedAt: data.completedAt || null,
    });
  } catch (err: any) {
    return res.status(502).json({ error: 'Status check failed', details: err.message });
  }
}

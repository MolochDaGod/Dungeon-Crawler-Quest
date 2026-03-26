import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/gbux-swap
 *
 * Proxies gBux swap requests to the Grudge AI agent at api.grudge-studio.com.
 * The AI agent holds the swap program authority and executes Solana transactions.
 *
 * Body: { direction: 'buy'|'sell', amount: number, walletAddress: string, grudgeId?: string }
 * Response: { success: boolean, txId?: string, amountIn?: number, amountOut?: number }
 */

const GRUDGE_BACKEND = process.env.GRUDGE_BACKEND_URL || 'https://api.grudge-studio.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { direction, amount, walletAddress, grudgeId } = req.body || {};

  if (!direction || !amount || !walletAddress) {
    return res.status(400).json({ error: 'Missing: direction, amount, walletAddress' });
  }

  if (direction !== 'buy' && direction !== 'sell') {
    return res.status(400).json({ error: 'direction must be "buy" or "sell"' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  try {
    const resp = await fetch(`${GRUDGE_BACKEND}/ai/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization as string } : {}),
      },
      body: JSON.stringify({ direction, amount, walletAddress, grudgeId }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({
        success: false,
        error: data.error || 'Swap failed',
        details: data,
      });
    }

    return res.json({
      success: true,
      txId: data.txId,
      amountIn: data.amountIn,
      amountOut: data.amountOut,
    });
  } catch (err: any) {
    return res.status(502).json({ success: false, error: 'AI agent unreachable', details: err.message });
  }
}

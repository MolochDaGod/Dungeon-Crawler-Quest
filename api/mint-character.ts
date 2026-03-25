import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/mint-character
 *
 * Mints a Solana cNFT (compressed NFT) for a new Grudge Warlords character
 * via Crossmint's server-side API.
 *
 * Flow:
 *   1. Client creates character (race, class, name, avatar image URL)
 *   2. Client calls this endpoint with character data
 *   3. This route calls Crossmint to mint cNFT
 *   4. Returns actionId + pending status to client
 *   5. Client polls /api/mint-status/:actionId until success
 *
 * For guests without a wallet:
 *   - cNFT is minted to the AI agent's custodial address
 *   - Player can claim later by linking a wallet (Crossmint wallet or external)
 *
 * Env vars required:
 *   CROSSMINT_API_KEY — server-side key with nfts.create scope
 *   CROSSMINT_COLLECTION_ID — Solana collection (default: "default-solana")
 *   CROSSMINT_ENV — "staging" or "www"
 *   GRUDGE_CUSTODIAL_WALLET — Solana address for AI-held guest NFTs
 */

const CROSSMINT_API_KEY = process.env.CROSSMINT_API_KEY || '';
const CROSSMINT_COLLECTION_ID = process.env.CROSSMINT_COLLECTION_ID || 'default-solana';
const CROSSMINT_ENV = process.env.CROSSMINT_ENV || 'staging';
const CUSTODIAL_WALLET = process.env.GRUDGE_CUSTODIAL_WALLET || '';

const CROSSMINT_BASE = `https://${CROSSMINT_ENV}.crossmint.com/api/2022-06-09`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!CROSSMINT_API_KEY) {
    return res.status(500).json({ error: 'CROSSMINT_API_KEY not configured' });
  }

  const {
    grudgeId,
    characterName,
    race,
    heroClass,
    faction,
    level,
    imageUrl,
    recipientEmail,
    recipientWallet,
  } = req.body || {};

  if (!grudgeId || !characterName || !race || !heroClass) {
    return res.status(400).json({
      error: 'Missing required fields: grudgeId, characterName, race, heroClass',
    });
  }

  // Determine recipient:
  // 1. If player has a Solana wallet address → mint directly to them
  // 2. If player has an email → mint to Crossmint email wallet
  // 3. Otherwise → mint to AI agent's custodial wallet (guest/anon)
  let recipient: string;
  if (recipientWallet) {
    recipient = `solana:${recipientWallet}`;
  } else if (recipientEmail) {
    recipient = `email:${recipientEmail}:solana`;
  } else if (CUSTODIAL_WALLET) {
    recipient = `solana:${CUSTODIAL_WALLET}`;
  } else {
    return res.status(400).json({
      error: 'No recipient: provide recipientEmail, recipientWallet, or configure GRUDGE_CUSTODIAL_WALLET',
    });
  }

  // Build NFT metadata
  const metadata = {
    name: `${characterName} — ${race} ${heroClass}`,
    image: imageUrl || 'https://molochdagod.github.io/ObjectStore/icons/grudge-logo.png',
    description: `Grudge Warlords character: ${characterName}, a ${race} ${heroClass} of the ${faction || 'Unknown'} faction.`,
    attributes: [
      { trait_type: 'Race', value: race },
      { trait_type: 'Class', value: heroClass },
      { trait_type: 'Faction', value: faction || 'Unknown' },
      { trait_type: 'Level', value: String(level || 1) },
      { trait_type: 'GrudgeID', value: grudgeId },
      { trait_type: 'Game', value: 'Grudge Warlords' },
    ],
  };

  try {
    const mintResp = await fetch(
      `${CROSSMINT_BASE}/collections/${CROSSMINT_COLLECTION_ID}/nfts`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'x-api-key': CROSSMINT_API_KEY,
        },
        body: JSON.stringify({
          recipient,
          metadata,
          compressed: true, // cNFT — cheapest on Solana
        }),
      },
    );

    const mintData = await mintResp.json();

    if (!mintResp.ok) {
      console.error('[mint-character] Crossmint error:', mintData);
      return res.status(mintResp.status).json({
        error: 'Crossmint mint failed',
        details: mintData,
      });
    }

    // Return actionId for polling + the NFT id
    return res.status(201).json({
      success: true,
      actionId: mintData.actionId || mintData.id,
      nftId: mintData.id,
      status: mintData.onChain?.status || 'pending',
      recipient,
      grudgeId,
    });
  } catch (err: any) {
    console.error('[mint-character] Error:', err);
    return res.status(502).json({ error: 'Mint request failed', details: err.message });
  }
}

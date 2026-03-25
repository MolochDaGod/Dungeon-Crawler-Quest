/**
 * cNFT Mint Orchestrator — Client-Side
 *
 * Handles the full character→cNFT minting flow:
 *   1. Calls /api/mint-character with character data + avatar image
 *   2. Polls /api/mint-status/:actionId until success or timeout
 *   3. Updates the character list with mint address
 *   4. Falls back gracefully if Crossmint is unavailable
 *
 * For guests (no wallet, no email):
 *   - Character is created locally and playable immediately
 *   - cNFT mint is attempted to the AI agent's custodial wallet
 *   - If Crossmint is down, character works without cNFT
 *   - Player can mint/claim later from the character sheet
 *
 * This is a non-blocking operation — character creation succeeds
 * regardless of whether the cNFT mint succeeds.
 */

import {
  addToCharacterList,
  type CharacterListEntry,
} from './shared-character-state';

// ── Types ──────────────────────────────────────────────────────

export interface MintRequest {
  grudgeId: string;
  characterName: string;
  race: string;
  heroClass: string;
  faction: string;
  level: number;
  imageUrl: string | null;
  /** Player's email (for Crossmint email wallet) */
  recipientEmail?: string;
  /** Player's Solana wallet address (direct delivery) */
  recipientWallet?: string;
}

export interface MintResult {
  success: boolean;
  actionId?: string;
  nftId?: string;
  mintAddress?: string;
  error?: string;
  /** true = Crossmint unavailable, character still playable */
  fallback: boolean;
}

// ── Mint Character as cNFT ─────────────────────────────────────

/**
 * Attempt to mint a character as a Solana cNFT via Crossmint.
 * Non-blocking: returns immediately with pending status.
 * Call pollMintStatus() to check completion.
 */
export async function mintCharacterCNFT(req: MintRequest): Promise<MintResult> {
  try {
    const resp = await fetch('/api/mint-character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('[cNFT] Mint request failed:', err);
      return { success: false, error: err.error, fallback: true };
    }

    const data = await resp.json();
    return {
      success: true,
      actionId: data.actionId,
      nftId: data.nftId,
      fallback: false,
    };
  } catch (err: any) {
    // Network error, Crossmint down, etc. — character still works
    console.warn('[cNFT] Mint unavailable (character still playable):', err.message);
    return { success: false, error: err.message, fallback: true };
  }
}

// ── Poll Mint Status ───────────────────────────────────────────

export interface MintStatusResult {
  status: 'pending' | 'success' | 'failed' | 'unknown';
  mintAddress?: string;
  txId?: string;
}

/**
 * Poll the mint status until success, failure, or timeout.
 * Returns the final status.
 */
export async function pollMintStatus(
  actionId: string,
  maxAttempts = 20,
  intervalMs = 3000,
): Promise<MintStatusResult> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`/api/mint-status/${actionId}`);
      if (!resp.ok) continue;

      const data = await resp.json();

      if (data.status === 'success') {
        return {
          status: 'success',
          mintAddress: data.data?.token?.mintHash || data.data?.token?.id,
          txId: data.data?.txId,
        };
      }

      if (data.status === 'failed') {
        return { status: 'failed' };
      }
    } catch {
      // Network error — continue polling
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { status: 'unknown' };
}

// ── Full Mint Flow (fire-and-forget with callback) ─────────────

/**
 * Full mint flow: mint → poll → update character list.
 * Call this after character creation. It's non-blocking via async.
 *
 * @param req - Character data for minting
 * @param onComplete - Optional callback when mint completes (success or fail)
 */
export async function mintAndTrack(
  req: MintRequest,
  onComplete?: (result: MintResult) => void,
): Promise<void> {
  // Step 1: Request mint
  const mintResult = await mintCharacterCNFT(req);

  if (!mintResult.success || !mintResult.actionId) {
    // Fallback: character works without cNFT
    onComplete?.({ ...mintResult, fallback: true });
    return;
  }

  // Step 2: Poll for completion (background)
  const status = await pollMintStatus(mintResult.actionId);

  if (status.status === 'success' && status.mintAddress) {
    // Step 3: Update character list with mint address
    const entry: CharacterListEntry = {
      grudgeId: req.grudgeId,
      customName: req.characterName,
      race: req.race,
      heroClass: req.heroClass,
      faction: req.faction,
      level: req.level,
      imageUrl: req.imageUrl || undefined,
      mintAddress: status.mintAddress,
      createdAt: new Date().toISOString(),
    };
    addToCharacterList(entry);

    // Store mint address for this character
    localStorage.setItem(`grudge_mint_${req.grudgeId}`, status.mintAddress);

    onComplete?.({
      success: true,
      actionId: mintResult.actionId,
      nftId: mintResult.nftId,
      mintAddress: status.mintAddress,
      fallback: false,
    });
  } else {
    onComplete?.({
      success: false,
      actionId: mintResult.actionId,
      error: `Mint ${status.status}`,
      fallback: true,
    });
  }
}

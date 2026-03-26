/**
 * gBux Token Client — Solana SPL Token Balance + Swap
 *
 * Reads gBux balance from Solana RPC for the player's wallet.
 * Swap requests go through api.grudge-studio.com/ai/swap (AI agent).
 *
 * Wallet source priority:
 *   1. Web3Auth Solana wallet (already configured in project)
 *   2. Crossmint custodial wallet (from cNFT minting)
 *   3. Manually linked wallet address from localStorage
 *
 * This module is UI-framework-agnostic — call from React via useEffect.
 */

// ── Constants ──────────────────────────────────────────────────

/** gBux SPL token mint address on Solana (set to your deployed mint) */
const GBUX_MINT = 'GBUXtokenMintAddressPlaceholder111111111111';

/** Solana RPC endpoint */
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

/** AI agent swap endpoint */
const SWAP_ENDPOINT = '/api/gbux-swap';

/** Cache TTL for balance reads (30 seconds) */
const BALANCE_CACHE_TTL = 30_000;

// ── State ──────────────────────────────────────────────────────

let _cachedBalance: number | null = null;
let _lastBalanceFetch = 0;
let _walletAddress: string | null = null;

// ── Wallet Resolution ──────────────────────────────────────────

/**
 * Get the player's Solana wallet address from available sources.
 */
export function getWalletAddress(): string | null {
  if (_walletAddress) return _walletAddress;

  // 1. Check Web3Auth provider
  try {
    const web3AuthWallet = (window as any).__grudge_solana_wallet;
    if (web3AuthWallet) {
      _walletAddress = web3AuthWallet;
      return _walletAddress;
    }
  } catch {}

  // 2. Check Crossmint custodial from localStorage
  const crossmintWallet = localStorage.getItem('grudge_crossmint_wallet');
  if (crossmintWallet) {
    _walletAddress = crossmintWallet;
    return _walletAddress;
  }

  // 3. Check manually linked wallet
  const linkedWallet = localStorage.getItem('grudge_solana_wallet');
  if (linkedWallet) {
    _walletAddress = linkedWallet;
    return _walletAddress;
  }

  return null;
}

/**
 * Set wallet address manually (e.g. from Web3Auth callback).
 */
export function setWalletAddress(address: string): void {
  _walletAddress = address;
  localStorage.setItem('grudge_solana_wallet', address);
  _cachedBalance = null; // Invalidate cache
}

// ── Balance ────────────────────────────────────────────────────

/**
 * Fetch gBux token balance for the player's wallet.
 * Uses Solana RPC `getTokenAccountsByOwner`.
 * Returns 0 if no wallet or no token account.
 */
export async function fetchGBuxBalance(forceRefresh = false): Promise<number> {
  const now = Date.now();
  if (!forceRefresh && _cachedBalance !== null && now - _lastBalanceFetch < BALANCE_CACHE_TTL) {
    return _cachedBalance;
  }

  const wallet = getWalletAddress();
  if (!wallet) {
    _cachedBalance = 0;
    return 0;
  }

  try {
    const resp = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          wallet,
          { mint: GBUX_MINT },
          { encoding: 'jsonParsed' },
        ],
      }),
    });

    const data = await resp.json();
    const accounts = data?.result?.value || [];

    if (accounts.length === 0) {
      _cachedBalance = 0;
      _lastBalanceFetch = now;
      return 0;
    }

    // Sum all token accounts (should be 1 typically)
    let total = 0;
    for (const acc of accounts) {
      const info = acc?.account?.data?.parsed?.info;
      if (info?.tokenAmount?.uiAmount != null) {
        total += info.tokenAmount.uiAmount;
      }
    }

    _cachedBalance = total;
    _lastBalanceFetch = now;
    return total;
  } catch (err) {
    console.warn('[gBux] Balance fetch failed:', err);
    return _cachedBalance ?? 0;
  }
}

/**
 * Get the cached balance (no network call). Returns null if never fetched.
 */
export function getCachedBalance(): number | null {
  return _cachedBalance;
}

// ── Swap ───────────────────────────────────────────────────────

export interface SwapRequest {
  /** 'buy' gBux with SOL, or 'sell' gBux for SOL */
  direction: 'buy' | 'sell';
  /** Amount of gBux to buy or sell */
  amount: number;
  /** Player's wallet address */
  walletAddress: string;
  /** Player's grudgeId for tracking */
  grudgeId?: string;
}

export interface SwapResult {
  success: boolean;
  txId?: string;
  amountIn?: number;
  amountOut?: number;
  error?: string;
}

/**
 * Request a gBux swap via the AI agent.
 * The AI agent handles the actual Solana transaction.
 *
 * For users with server-side wallets (custodial), the agent signs.
 * For users with client-side wallets (Web3Auth), returns an unsigned
 * transaction for the client to sign and submit.
 */
export async function requestSwap(req: SwapRequest): Promise<SwapResult> {
  try {
    const resp = await fetch(SWAP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: err.error || `HTTP ${resp.status}` };
    }

    const data = await resp.json();
    // Invalidate balance cache after swap
    _cachedBalance = null;
    return {
      success: true,
      txId: data.txId,
      amountIn: data.amountIn,
      amountOut: data.amountOut,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Swap request failed' };
  }
}

// ── Formatting ─────────────────────────────────────────────────

/**
 * Format gBux amount for display (e.g. 1234.56 → "1,234.56 gBux")
 */
export function formatGBux(amount: number): string {
  if (amount === 0) return '0 gBux';
  if (amount < 0.01) return '<0.01 gBux';
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} gBux`;
}

/**
 * Short format for HUD display (e.g. 1234 → "1.2K")
 */
export function formatGBuxShort(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(amount < 10 ? 2 : 0);
}

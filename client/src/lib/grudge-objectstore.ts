/**
 * grudge-objectstore.ts — Cloudflare R2 ObjectStore Client
 *
 * Single client for all asset operations against the Grudge ObjectStore.
 *
 * Primary:  objectstore.grudge-studio.com (CF Worker + R2 storage)
 * Fallback: molochdagod.github.io/ObjectStore (GitHub Pages static CDN)
 * R2 Assets: grudgeassets.grudge.workers.dev (Cube World voxel pack)
 *
 * Provides:
 *   - Authenticated asset fetching with Grudge UUID headers
 *   - JSON API fetching with cache + fallback
 *   - Binary asset upload to R2 (worlds, custom assets)
 *   - World save/load keyed by grudgeId + worldId
 *   - Icon/sprite URL resolution
 */

import { grudgeHeaders, generateGrudgeUUID, getGrudgeId } from './grudge-uuid';

// ── CDN Origins ────────────────────────────────────────────────

/** Primary: CF Worker backed by R2 + D1 */
export const OS_PRIMARY = 'https://objectstore.grudge-studio.com';

/** Fallback: GitHub Pages static mirror */
export const OS_FALLBACK = 'https://molochdagod.github.io/ObjectStore';

/** R2 asset worker for Cube World packs */
export const OS_R2_ASSETS = 'https://grudgeassets.grudge.workers.dev';

// ── Resolved Base URL ──────────────────────────────────────────

let _resolvedBase: string | null = null;
let _resolving = false;

/**
 * Determine which CDN is reachable.
 * Tries the CF Worker first; if it fails, falls back to GitHub Pages.
 * Result is cached for the session.
 */
async function resolveBase(): Promise<string> {
  if (_resolvedBase) return _resolvedBase;
  if (_resolving) {
    // Wait for in-flight resolution
    await new Promise(r => setTimeout(r, 500));
    return _resolvedBase ?? OS_FALLBACK;
  }

  _resolving = true;
  try {
    const resp = await fetch(`${OS_PRIMARY}/api/v1/master-items.json`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      _resolvedBase = OS_PRIMARY;
      console.log('[ObjectStore] Using primary CDN:', OS_PRIMARY);
      return _resolvedBase;
    }
  } catch { /* offline or blocked — try fallback */ }

  _resolvedBase = OS_FALLBACK;
  console.log('[ObjectStore] Using fallback CDN:', OS_FALLBACK);
  _resolving = false;
  return _resolvedBase;
}

/**
 * Get the current base URL (synchronous — returns fallback if not yet resolved).
 * Call `resolveBase()` at app boot for async resolution.
 */
export function getBaseUrl(): string {
  return _resolvedBase ?? OS_FALLBACK;
}

// ── Asset URL Resolution ───────────────────────────────────────

/**
 * Resolve a sprite/icon path to a full CDN URL.
 * Handles both absolute URLs and relative paths.
 *
 * Examples:
 *   '/icons/weapons/swords/blade.png' → 'https://objectstore.grudge-studio.com/icons/weapons/swords/blade.png'
 *   'https://...' → returned as-is
 *   null → null
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${getBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Resolve an icon path — same as resolveAssetUrl but typed for icon lookups.
 * Drop-in replacement for the old getIconUrl in grudge-items.ts.
 */
export function getIconUrl(spritePath: string | null | undefined): string | null {
  return resolveAssetUrl(spritePath);
}

// ── JSON API Fetching ──────────────────────────────────────────

const _jsonCache = new Map<string, { data: unknown; ts: number }>();
const JSON_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a JSON API endpoint with Grudge headers, caching, and fallback.
 *
 * @param path API path relative to base, e.g. '/api/v1/weapons.json'
 * @param skipCache Force fresh fetch
 */
export async function fetchAPI<T>(path: string, skipCache = false): Promise<T | null> {
  const cacheKey = path;

  if (!skipCache) {
    const cached = _jsonCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < JSON_CACHE_TTL) {
      return cached.data as T;
    }
  }

  const base = await resolveBase();
  const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  try {
    const resp = await fetch(url, {
      headers: {
        ...grudgeHeaders(),
        'Accept': 'application/json',
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json() as T;
    _jsonCache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    // If primary failed, try fallback
    if (base !== OS_FALLBACK) {
      try {
        const fbUrl = `${OS_FALLBACK}${path.startsWith('/') ? '' : '/'}${path}`;
        const resp = await fetch(fbUrl);
        if (resp.ok) {
          const data = await resp.json() as T;
          _jsonCache.set(cacheKey, { data, ts: Date.now() });
          return data;
        }
      } catch { /* both failed */ }
    }
    console.warn(`[ObjectStore] fetchAPI failed: ${path}`, err);
    return null;
  }
}

// ── Binary Asset Upload (R2) ───────────────────────────────────

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Upload a file to R2 via the CF Worker.
 * Requires authentication (grudge_auth_token).
 *
 * @param path R2 key path, e.g. 'worlds/CHAR-xxx/WRLD-xxx.json'
 * @param data File content (JSON string, ArrayBuffer, Blob)
 * @param contentType MIME type
 */
export async function uploadToR2(
  path: string,
  data: string | ArrayBuffer | Blob,
  contentType = 'application/json',
): Promise<UploadResult> {
  try {
    const resp = await fetch(`${OS_PRIMARY}/r2/upload`, {
      method: 'PUT',
      headers: {
        ...grudgeHeaders(),
        'Content-Type': contentType,
        'X-R2-Key': path,
      },
      body: data,
    });

    if (!resp.ok) {
      return { success: false, error: `HTTP ${resp.status}` };
    }

    const result = await resp.json().catch(() => ({})) as any;
    return {
      success: true,
      key: result.key ?? path,
      url: result.url ?? `${OS_PRIMARY}/r2/${path}`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Upload failed' };
  }
}

/**
 * Download a file from R2 via the CF Worker.
 */
export async function downloadFromR2(path: string): Promise<Response | null> {
  try {
    const resp = await fetch(`${OS_PRIMARY}/r2/${path}`, {
      headers: grudgeHeaders(),
    });
    if (!resp.ok) return null;
    return resp;
  } catch {
    return null;
  }
}

// ── World Save / Load ──────────────────────────────────────────

export interface WorldSaveData {
  worldId: string;
  grudgeId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  gameMode: 'sandbox' | 'arena' | 'dungeon3d' | 'genesis';
  data: unknown; // serialized world state
}

/**
 * Save a world to R2, keyed by grudgeId and worldId.
 */
export async function saveWorld(worldData: WorldSaveData): Promise<UploadResult> {
  const grudgeId = getGrudgeId() ?? 'guest';
  const key = `worlds/${grudgeId}/${worldData.worldId}.json`;

  worldData.grudgeId = grudgeId;
  worldData.updatedAt = new Date().toISOString();

  return uploadToR2(key, JSON.stringify(worldData));
}

/**
 * Load a world from R2 by worldId.
 */
export async function loadWorld(worldId: string): Promise<WorldSaveData | null> {
  const grudgeId = getGrudgeId() ?? 'guest';
  const key = `worlds/${grudgeId}/${worldId}.json`;

  const resp = await downloadFromR2(key);
  if (!resp) return null;

  try {
    return await resp.json() as WorldSaveData;
  } catch {
    return null;
  }
}

/**
 * List all saved worlds for the current player.
 */
export async function listWorlds(): Promise<WorldSaveData[]> {
  const grudgeId = getGrudgeId() ?? 'guest';
  try {
    const resp = await fetch(`${OS_PRIMARY}/r2/list?prefix=worlds/${grudgeId}/`, {
      headers: grudgeHeaders(),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { objects?: { key: string }[] };
    return (data.objects ?? []).map(o => ({
      worldId: o.key.split('/').pop()?.replace('.json', '') ?? '',
      grudgeId,
      name: '',
      createdAt: '',
      updatedAt: '',
      gameMode: 'sandbox' as const,
      data: null,
    }));
  } catch {
    return [];
  }
}

// ── Boot-time init ─────────────────────────────────────────────

/** Call at app startup to resolve the best CDN. Fire-and-forget. */
export function initObjectStore(): void {
  resolveBase().catch(() => {});
}

/**
 * grudge-uuid.ts — Grudge UUID System
 *
 * Generates and tracks typed Grudge UUIDs across the application.
 * Every game entity, asset, world save, and session gets a unique
 * identifier with a typed prefix for the Grudge ecosystem.
 *
 * Format: PREFIX-XXXXXXXX (8 hex chars from crypto hash)
 *
 * Prefixes:
 *   CHAR-  Character identity
 *   ITEM-  Equipment / inventory item instance
 *   SKIL-  Weapon skill definition
 *   WRLD-  World save / dungeon instance
 *   3DFX-  3D effect / shader preset
 *   SESS-  Game session
 *   ACCT-  Account / Grudge ID
 *   PROP-  Sandbox prop instance
 *   MATL-  Crafting material
 *   ENCH-  Enchantment
 */

// ── UUID Prefix Types ──────────────────────────────────────────

export type GrudgeUUIDPrefix =
  | 'CHAR' | 'ITEM' | 'SKIL' | 'WRLD' | '3DFX'
  | 'SESS' | 'ACCT' | 'PROP' | 'MATL' | 'ENCH';

// ── Generation ─────────────────────────────────────────────────

let _counter = 0;

/**
 * Generate a Grudge UUID with typed prefix.
 * Uses crypto.getRandomValues when available, falls back to Math.random.
 */
export function generateGrudgeUUID(prefix: GrudgeUUIDPrefix): string {
  let hex: string;
  try {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    hex = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Fallback for environments without crypto
    hex = (Date.now().toString(16).slice(-4) +
           (++_counter).toString(16).padStart(2, '0') +
           Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')).slice(0, 8);
  }
  return `${prefix}-${hex.toUpperCase()}`;
}

/**
 * Generate a deterministic UUID from a seed string (for stable item IDs).
 * Uses a simple hash — same input always produces same output.
 */
export function deterministicUUID(prefix: GrudgeUUIDPrefix, seed: string): string {
  let hash = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `${prefix}-${hex}`;
}

// ── Parsing ────────────────────────────────────────────────────

/** Extract the prefix from a Grudge UUID (e.g. 'CHAR-ABC123' → 'CHAR') */
export function getUUIDPrefix(uuid: string): GrudgeUUIDPrefix | null {
  const match = uuid.match(/^([A-Z0-9]+)-/);
  return match ? (match[1] as GrudgeUUIDPrefix) : null;
}

/** Get the short suffix (last 8 chars) for display */
export function shortUUID(uuid: string): string {
  return uuid.split('-').pop() ?? uuid;
}

/** Validate that a string looks like a Grudge UUID */
export function isGrudgeUUID(value: string): boolean {
  return /^[A-Z0-9]+-[A-F0-9]{6,}$/i.test(value);
}

// ── Session Registry ───────────────────────────────────────────

interface RegistryEntry {
  uuid: string;
  prefix: GrudgeUUIDPrefix;
  label?: string;
  createdAt: number;
}

const _registry = new Map<string, RegistryEntry>();
let _sessionId: string | null = null;

/** Start a new session and return the session UUID */
export function startSession(): string {
  _sessionId = generateGrudgeUUID('SESS');
  registerUUID(_sessionId, 'SESS', 'Game Session');
  return _sessionId;
}

/** Get current session UUID */
export function getSessionId(): string {
  if (!_sessionId) _sessionId = startSession();
  return _sessionId;
}

/** Register a UUID in the session registry */
export function registerUUID(uuid: string, prefix: GrudgeUUIDPrefix, label?: string): void {
  _registry.set(uuid, { uuid, prefix, label, createdAt: Date.now() });
}

/** Get all registered UUIDs of a given prefix */
export function getRegisteredUUIDs(prefix?: GrudgeUUIDPrefix): RegistryEntry[] {
  const entries = Array.from(_registry.values());
  return prefix ? entries.filter(e => e.prefix === prefix) : entries;
}

/** Export the session registry as JSON (for sync to backend) */
export function exportRegistry(): { sessionId: string; entries: RegistryEntry[] } {
  return {
    sessionId: getSessionId(),
    entries: Array.from(_registry.values()),
  };
}

/** Clear the session registry */
export function clearRegistry(): void {
  _registry.clear();
  _sessionId = null;
}

// ── Grudge ID helpers (from auth system) ───────────────────────

/** Get the player's Grudge ID from localStorage (set by grudgeBackend.ts) */
export function getGrudgeId(): string | null {
  return localStorage.getItem('grudge_id');
}

/** Get the player's Grudge auth token */
export function getGrudgeToken(): string | null {
  return localStorage.getItem('grudge_auth_token');
}

/** Build standard Grudge headers for API calls */
export function grudgeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getGrudgeToken();
  const grudgeId = getGrudgeId();
  const session = getSessionId();

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (grudgeId) headers['X-Grudge-ID'] = grudgeId;
  if (session) headers['X-Grudge-Session'] = session;

  return headers;
}

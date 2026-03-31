/**
 * Player Account — Backend-Owned Character Data
 *
 * Authoritative character data lives on Grudge backend.
 * Fallback chain: Grudge API → Puter KV → localStorage
 * Player data is NEVER localStorage-only in production.
 */

import { HeroData, HEROES } from './types';
import type { PlayerCharacterState } from './player-characters';
import { createPlayerCharacterState, RACE_FACTIONS, findBestHeroModel } from './player-characters';
import { isPuterAvailable, kvSave, kvLoad } from './puter-cloud';
import { getAuthToken, getSession } from './grudge-auth';

// ── Constants ──────────────────────────────────────────────────

// All API calls go through the Vercel/Express proxy at /api/characters
// which forwards to api.grudge-studio.com server-side (avoids CORS + hides VPS URL)
// See: api/Grudge Studio Network Audit.md for the canonical pattern
const GRUDGE_API_BASE = '/api';

const LOCAL_KEY = 'grudge_player_character';
const PUTER_KEY = 'player_character';
const SYNC_INTERVAL = 30_000; // 30s

/** Returns Authorization header using Grudge JWT from auth service (falls back to localStorage) */
function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ── State ──────────────────────────────────────────────────────

let _currentCharacter: PlayerCharacterState | null = null;
let _syncTimer: ReturnType<typeof setInterval> | null = null;
let _dirty = false;

// ── Load (fallback chain) ──────────────────────────────────────

/**
 * Load player character from the best available source.
 * Grudge backend → Puter KV → localStorage
 */
export async function loadPlayerCharacter(grudgeId?: string): Promise<PlayerCharacterState | null> {
  // 1. Try Grudge backend
  if (grudgeId) {
    try {
      const resp = await fetch(`${GRUDGE_API_BASE}/characters/${grudgeId}`, {
        headers: { ...authHeaders() },
      });
      if (resp.ok) {
        const data = await resp.json();
        _currentCharacter = data as PlayerCharacterState;
        // Mirror to local cache
        localStorage.setItem(LOCAL_KEY, JSON.stringify(_currentCharacter));
        if (isPuterAvailable()) kvSave(PUTER_KEY, _currentCharacter);
        return _currentCharacter;
      }
    } catch { /* offline — try next source */ }
  }

  // 2. Try Puter KV
  if (isPuterAvailable()) {
    const puterData = await kvLoad<PlayerCharacterState>(PUTER_KEY);
    if (puterData) {
      _currentCharacter = puterData;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(puterData));
      return _currentCharacter;
    }
  }

  // 3. Last resort: localStorage
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      _currentCharacter = JSON.parse(raw) as PlayerCharacterState;
      return _currentCharacter;
    }
  } catch { /* corrupt data */ }

  return null;
}

// ── Save ───────────────────────────────────────────────────────

/**
 * Save player character to all available backends.
 * Writes to Grudge API first, mirrors to Puter KV and localStorage.
 */
export async function savePlayerCharacter(character: PlayerCharacterState): Promise<boolean> {
  _currentCharacter = character;
  _dirty = false;

  // Always save to localStorage (instant, offline-safe)
  localStorage.setItem(LOCAL_KEY, JSON.stringify(character));

  // Also set the legacy hero ID for backward compat with existing game code
  const legacyId = 100 + character.modelIndex;
  localStorage.setItem('grudge_hero_id', String(legacyId));

  let backendOk = false;

  // Try Grudge backend
  try {
    const resp = await fetch(`${GRUDGE_API_BASE}/characters/${character.grudgeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(character),
    });
    backendOk = resp.ok;
  } catch { /* offline */ }

  // Mirror to Puter KV
  if (isPuterAvailable()) {
    await kvSave(PUTER_KEY, character);
  }

  return backendOk;
}

// ── Create New Character ───────────────────────────────────────

/**
 * Create a new player character on the backend.
 * Returns the created character with server-assigned IDs.
 */
export async function createNewCharacter(
  accountId: string,
  modelIndex: number,
  race: string,
  heroClass: string,
  customName: string,
): Promise<PlayerCharacterState> {
  // Generate a temporary grudgeId (server should assign the real one)
  const tempGrudgeId = `CHAR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const character = createPlayerCharacterState(
    accountId, tempGrudgeId, modelIndex, race, heroClass, customName,
  );

  // Try to create on backend
  try {
    const resp = await fetch(`${GRUDGE_API_BASE}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(character),
    });
    if (resp.ok) {
      const serverData = await resp.json();
      // Server may assign a real grudgeId
      if (serverData.grudgeId) character.grudgeId = serverData.grudgeId;
    }
  } catch { /* offline — character created locally */ }

  await savePlayerCharacter(character);
  startSync();
  return character;
}

// ── Sync ───────────────────────────────────────────────────────

/** Mark character data as changed (will sync on next interval) */
export function markDirty(): void {
  _dirty = true;
}

/** Start periodic sync to backend */
export function startSync(): void {
  if (_syncTimer) return;
  _syncTimer = setInterval(async () => {
    if (_dirty && _currentCharacter) {
      await savePlayerCharacter(_currentCharacter);
    }
  }, SYNC_INTERVAL);
}

/** Stop periodic sync */
export function stopSync(): void {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
  }
}

/** Get current character (in-memory) */
export function getCurrentCharacter(): PlayerCharacterState | null {
  return _currentCharacter;
}

/** Update current character state in memory and mark dirty */
export function updateCharacter(updates: Partial<PlayerCharacterState>): void {
  if (!_currentCharacter) return;
  Object.assign(_currentCharacter, updates);
  _dirty = true;
  // Immediate localStorage write for crash safety
  localStorage.setItem(LOCAL_KEY, JSON.stringify(_currentCharacter));
}

// ── Boot-Time Character Resolution ─────────────────────────────

/**
 * Ensure the player's custom character is loaded and registered in HEROES[].
 * Call this at game boot BEFORE referencing HEROES by heroId.
 * Returns the resolved HeroData or null if no character exists.
 */
export async function ensurePlayerHeroLoaded(): Promise<HeroData | null> {
  // 1. Try loading from backend via grudge auth session
  const session = getSession();
  const grudgeId = session?.grudgeId || localStorage.getItem('grudge_id') || null;
  let pc = await loadPlayerCharacter(grudgeId || undefined);

  // 2. Fallback: recover from grudge_custom_hero localStorage
  if (!pc) {
    try {
      const raw = localStorage.getItem('grudge_custom_hero');
      if (raw) {
        const parsed = JSON.parse(raw) as HeroData;
        // This is already a HeroData — register directly
        if (parsed.id != null && parsed.race && parsed.heroClass) {
          if (!HEROES.find(h => h.id === parsed.id)) {
            parsed.isAINpc = false;
            HEROES.push(parsed);
          }
          localStorage.setItem('grudge_hero_id', String(parsed.id));
          return parsed;
        }
      }
    } catch { /* corrupt data */ }
    return null;
  }

  // 3. Convert PlayerCharacterState → HeroData and register
  const heroData = playerCharacterToHeroData(pc);
  heroData.isAINpc = false;

  // Remove any stale entry with same id, then register
  const existingIdx = HEROES.findIndex(h => h.id === heroData.id);
  if (existingIdx >= 0) {
    HEROES[existingIdx] = heroData;
  } else {
    HEROES.push(heroData);
  }

  // Keep localStorage in sync
  localStorage.setItem('grudge_hero_id', String(heroData.id));
  localStorage.setItem('grudge_custom_hero', JSON.stringify(heroData));

  return heroData;
}

/**
 * Synchronous version — only reads from localStorage/HEROES[]. Use at render time
 * when you can't await. Call ensurePlayerHeroLoaded() first at boot.
 */
export function getPlayerHeroSync(): HeroData | null {
  const heroId = localStorage.getItem('grudge_hero_id');
  if (!heroId) return null;

  const numId = parseInt(heroId, 10);
  let hero = HEROES.find(h => h.id === numId) ?? null;
  if (hero && !hero.isAINpc) return hero;

  // Fallback: try grudge_custom_hero
  try {
    const raw = localStorage.getItem('grudge_custom_hero');
    if (raw) {
      const parsed = JSON.parse(raw) as HeroData;
      if (String(parsed.id) === heroId) {
        parsed.isAINpc = false;
        if (!HEROES.find(h => h.id === parsed.id)) {
          HEROES.push(parsed);
        }
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
}

// ── Convert to HeroData (backward compat) ──────────────────────

/** Convert a PlayerCharacterState to a HeroData for use with existing game systems */
export function playerCharacterToHeroData(pc: PlayerCharacterState): HeroData {
  // Base stats by class (same as create-character.tsx CLASS_BASE_STATS)
  const CLASS_BASE: Record<string, { hp: number; atk: number; def: number; spd: number; rng: number; mp: number }> = {
    Warrior: { hp: 220, atk: 22, def: 18, spd: 55, rng: 1.5, mp: 90 },
    Mage:    { hp: 160, atk: 20, def: 7,  spd: 60, rng: 5.5, mp: 150 },
    Ranger:  { hp: 180, atk: 21, def: 10, spd: 70, rng: 6.5, mp: 110 },
    Worg:    { hp: 210, atk: 23, def: 14, spd: 65, rng: 1.5, mp: 95 },
  };

  const RACE_BONUS: Record<string, Partial<Record<string, number>>> = {
    Human: { hp: 10, atk: 2, def: 2, spd: 5, mp: 10 },
    Barbarian: { hp: 15, atk: 5, def: -2, spd: 3, mp: -5 },
    Dwarf: { hp: 20, atk: 1, def: 6, spd: -5, mp: 5 },
    Elf: { hp: -10, atk: -1, def: -3, spd: 10, mp: 20 },
    Orc: { hp: 10, atk: 6, def: 2, spd: 2, mp: -10 },
    Undead: { hp: 25, atk: 1, def: 4, spd: -5, mp: 10 },
  };

  const base = CLASS_BASE[pc.heroClass] || CLASS_BASE.Warrior;
  const bonus = RACE_BONUS[pc.race] || {};

  // Use the smart model matching if modelIndex wasn't specifically set
  const resolvedModel = pc.modelIndex > 0 ? pc.modelIndex : findBestHeroModel(pc.race, pc.heroClass);

  return {
    id: 100 + resolvedModel,
    name: pc.customName,
    title: `The ${pc.heroClass}`,
    race: pc.race,
    heroClass: pc.heroClass,
    faction: pc.faction,
    rarity: 'Rare',
    hp: base.hp + (bonus.hp || 0),
    atk: base.atk + (bonus.atk || 0),
    def: base.def + (bonus.def || 0),
    spd: base.spd + (bonus.spd || 0),
    rng: base.rng,
    mp: base.mp + (bonus.mp || 0),
    quote: `A ${pc.race} ${pc.heroClass} of the ${pc.faction} faction.`,
    equippedWeaponId: pc.weaponType || undefined,
    isAINpc: false, // THIS IS A PLAYER CHARACTER
  };
}

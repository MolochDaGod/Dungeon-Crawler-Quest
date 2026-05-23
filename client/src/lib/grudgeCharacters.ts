/**
 * grudgeCharacters.ts — Backend-first character persistence for DCQ.
 *
 * Pattern: try api.grudge-studio.com first → fall back to localStorage.
 * Characters created here are shared across all Grudge games (same account).
 */

import { authHeaders, getCurrentUser } from "./grudgeBackend";

const API_BASE = "/api/characters";
const LOCAL_KEY = "grudge_characters";
const ACTIVE_KEY = "grudge_active_character_id";

// ── Types ────────────────────────────────────────────────────────────────────

export interface GrudgeCharacter {
  id: string;
  name: string;
  race: string;
  heroClass: string;
  faction: string;
  level: number;
  xp: number;
  attributes: Record<string, number>;
  equipment: Record<string, string | null>;
  weaponType: string | null;
  avatarUrl: string | null;
  createdAt: string;
  /** Local-only fields (not sent to backend) */
  _localOnly?: boolean;
}

// ── Local storage helpers ────────────────────────────────────────────────────

function loadLocal(): GrudgeCharacter[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(chars: GrudgeCharacter[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(chars));
}

function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}

// ── API calls (with localStorage fallback) ───────────────────────────────────

/**
 * Fetch all characters for the current user.
 * Tries the Grudge API first, falls back to localStorage.
 */
export async function getAll(): Promise<GrudgeCharacter[]> {
  try {
    const res = await fetch(API_BASE, {
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      const chars: GrudgeCharacter[] = Array.isArray(data) ? data : data.characters || [];
      // Sync to localStorage as cache
      if (chars.length > 0) saveLocal(chars);
      return chars;
    }
  } catch {
    // Network error — fall through to localStorage
  }
  // Fallback: localStorage
  return loadLocal();
}

/**
 * Create a new character. Posts to API, caches locally.
 */
export async function create(
  char: Omit<GrudgeCharacter, "id" | "createdAt">,
): Promise<GrudgeCharacter> {
  const user = getCurrentUser();
  const payload = {
    ...char,
    grudgeId: user?.grudgeId || "guest",
  };

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const created: GrudgeCharacter = await res.json();
      // Cache locally
      const local = loadLocal();
      local.push(created);
      saveLocal(local);
      setActiveId(created.id);
      return created;
    }
  } catch {
    // Network error — create locally
  }

  // Fallback: create locally with a generated ID
  const localChar: GrudgeCharacter = {
    ...char,
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    _localOnly: true,
  };
  const local = loadLocal();
  local.push(localChar);
  saveLocal(local);
  setActiveId(localChar.id);
  return localChar;
}

/**
 * Update an existing character.
 */
export async function update(
  id: string,
  updates: Partial<GrudgeCharacter>,
): Promise<GrudgeCharacter | null> {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: GrudgeCharacter = await res.json();
      // Update local cache
      const local = loadLocal();
      const idx = local.findIndex((c) => c.id === id);
      if (idx >= 0) local[idx] = { ...local[idx], ...updated };
      saveLocal(local);
      return updated;
    }
  } catch {
    // fallback
  }

  // Local fallback
  const local = loadLocal();
  const idx = local.findIndex((c) => c.id === id);
  if (idx >= 0) {
    local[idx] = { ...local[idx], ...updates };
    saveLocal(local);
    return local[idx];
  }
  return null;
}

/**
 * Delete a character.
 */
export async function remove(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    // ignore — still remove locally
  }
  const local = loadLocal().filter((c) => c.id !== id);
  saveLocal(local);
  if (getActiveId() === id && local.length > 0) {
    setActiveId(local[0].id);
  }
}

/**
 * Get the currently active character, or the first one if none is set.
 */
export async function getActive(): Promise<GrudgeCharacter | null> {
  const chars = await getAll();
  if (chars.length === 0) return null;
  const activeId = getActiveId();
  return chars.find((c) => c.id === activeId) || chars[0];
}

/**
 * Set the active character ID.
 */
export function setActive(id: string): void {
  setActiveId(id);
}

/**
 * Check if the player has any characters (fast — checks localStorage first).
 */
export function hasCharactersLocally(): boolean {
  return loadLocal().length > 0;
}

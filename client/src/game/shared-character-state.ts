/**
 * Shared Character State — Single Source of Truth
 *
 * Every game mode (MOBA Arena, Open World MMO, Island Harvesting, Gruda Wars,
 * Crafting Suite) reads and writes character data through this module.
 *
 * Data flow:
 *   1. Grudge Backend (api.grudge-studio.com) — authoritative in production
 *   2. Puter KV — cloud backup for offline-first
 *   3. localStorage — instant local cache
 *
 * Character identity:
 *   - grudgeId: server-assigned unique ID (CHAR-xxx)
 *   - accountId: player account (puter ID or wallet address)
 *   - UUID: used for cNFT metadata, Crossmint minting, and inter-app sync
 *
 * This module is imported by:
 *   - open-world.ts (MMO)
 *   - engine.ts (MOBA Arena)
 *   - island-harvest.ts (Island)
 *   - pages/character.tsx (Character Sheet)
 *   - pages/create-character.tsx (Character Creation)
 *   - Any future game mode (Gruda Wars, Space RTS, etc.)
 */

import type { HeroData } from './types';
import type { PlayerCharacterState } from './player-characters';
import type { PlayerAttributes } from './attributes';
import type { PlayerProfessions, ResourceInventory } from './professions-system';
import type { PlayerEquipment, EquipmentBag } from './equipment';
import type { MissionLog } from './missions';
import type { PlayerProgress } from './player-progress';
import {
  loadPlayerCharacter, savePlayerCharacter, getCurrentCharacter,
  ensurePlayerHeroLoaded, playerCharacterToHeroData,
} from './player-account';
import { loadAttributes, saveAttributes } from './attributes';
import {
  loadProfessions, saveProfessions,
  loadResourceInventory, saveResourceInventory,
} from './professions-system';
import { loadEquipment, saveEquipment, loadEquipmentBag, saveEquipmentBag } from './equipment';
import { loadMissionLog, saveMissionLog } from './missions';
import { loadPlayerProgress, savePlayerProgress } from './player-progress';

// ── Unified Character Snapshot ─────────────────────────────────

/**
 * Complete character state snapshot — everything needed to restore
 * a character in any game mode.
 */
export interface CharacterSnapshot {
  /** Character identity */
  character: PlayerCharacterState | null;
  /** Resolved HeroData (stats + model) */
  heroData: HeroData | null;
  /** 8-attribute system */
  attributes: PlayerAttributes;
  /** Gathering + crafting levels */
  professions: PlayerProfessions;
  /** Harvested resources */
  resources: ResourceInventory;
  /** Equipped gear */
  equipment: PlayerEquipment;
  /** Inventory bag */
  bag: EquipmentBag;
  /** Active + completed missions */
  missions: MissionLog;
  /** Zone discovery, kills, reputation, playtime */
  progress: PlayerProgress;
}

// ── Load Full Snapshot ─────────────────────────────────────────

/**
 * Load the complete character state from all persistence layers.
 * Call this once at game boot. All game modes use this same snapshot.
 */
export async function loadCharacterSnapshot(): Promise<CharacterSnapshot> {
  // Ensure character is loaded into HEROES[] (async — hits backend/puter/localStorage)
  const heroData = await ensurePlayerHeroLoaded();
  const character = getCurrentCharacter();

  // Load all sub-systems from localStorage (instant, cached from last sync)
  const heroClass = heroData?.heroClass || character?.heroClass || 'Warrior';
  const attributes = loadAttributes(heroClass);
  const professions = loadProfessions();
  const resources = loadResourceInventory();
  const equipment = loadEquipment();
  const bag = loadEquipmentBag();
  const missions = loadMissionLog();
  const progress = loadPlayerProgress();

  return {
    character,
    heroData,
    attributes,
    professions,
    resources,
    equipment,
    bag,
    missions,
    progress,
  };
}

// ── Save Full Snapshot ─────────────────────────────────────────

/**
 * Save the complete character state to all persistence layers.
 * Call this on game exit, zone transitions, or periodically.
 */
export async function saveCharacterSnapshot(snap: CharacterSnapshot): Promise<void> {
  // Save each sub-system to localStorage immediately
  if (snap.character) {
    await savePlayerCharacter(snap.character);
  }
  saveAttributes(snap.attributes);
  saveProfessions(snap.professions);
  saveResourceInventory(snap.resources);
  saveEquipment(snap.equipment);
  saveEquipmentBag(snap.bag);
  saveMissionLog(snap.missions);
  savePlayerProgress(snap.progress);
}

// ── Singleton Access ───────────────────────────────────────────

let _activeSnapshot: CharacterSnapshot | null = null;

/**
 * Get the active character snapshot.
 * Returns null if loadCharacterSnapshot() hasn't been called yet.
 */
export function getActiveSnapshot(): CharacterSnapshot | null {
  return _activeSnapshot;
}

/**
 * Initialize the shared character state. Call once at app boot.
 */
export async function initSharedCharacterState(): Promise<CharacterSnapshot> {
  _activeSnapshot = await loadCharacterSnapshot();
  return _activeSnapshot;
}

/**
 * Update the active snapshot in memory (for live game state changes).
 * Does NOT persist — call saveCharacterSnapshot() separately.
 */
export function updateActiveSnapshot(updates: Partial<CharacterSnapshot>): void {
  if (!_activeSnapshot) return;
  Object.assign(_activeSnapshot, updates);
}

// ── Character List (Multi-Character Support) ───────────────────

const CHAR_LIST_KEY = 'grudge_character_list';

export interface CharacterListEntry {
  grudgeId: string;
  customName: string;
  race: string;
  heroClass: string;
  faction: string;
  level: number;
  /** cNFT image URL (set after minting) */
  imageUrl?: string;
  /** Crossmint mint address */
  mintAddress?: string;
  createdAt: string;
}

/**
 * Get all characters owned by the current account.
 * Reads from localStorage; backend sync adds/removes entries.
 */
export function getCharacterList(): CharacterListEntry[] {
  try {
    const raw = localStorage.getItem(CHAR_LIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CharacterListEntry[];
  } catch {
    return [];
  }
}

/**
 * Add a character to the local list (called after creation or backend sync).
 */
export function addToCharacterList(entry: CharacterListEntry): void {
  const list = getCharacterList();
  const existing = list.findIndex(c => c.grudgeId === entry.grudgeId);
  if (existing >= 0) {
    list[existing] = entry;
  } else {
    list.push(entry);
  }
  localStorage.setItem(CHAR_LIST_KEY, JSON.stringify(list));
}

/**
 * Remove a character from the local list.
 */
export function removeFromCharacterList(grudgeId: string): void {
  const list = getCharacterList().filter(c => c.grudgeId !== grudgeId);
  localStorage.setItem(CHAR_LIST_KEY, JSON.stringify(list));
}

// ── Cross-App Sync Contract ────────────────────────────────────

/**
 * The Grudge backend sync payload.
 * All apps that need character data POST/GET this shape.
 *
 * Endpoint: POST api.grudge-studio.com/api/characters/:grudgeId/sync
 * Body: GrudgeSyncPayload
 *
 * The backend merges based on `lastModified` timestamps per field.
 * Conflicts resolve with "latest write wins" per sub-system.
 */
export interface GrudgeSyncPayload {
  grudgeId: string;
  accountId: string;
  lastModified: string; // ISO timestamp
  character: PlayerCharacterState;
  attributes: PlayerAttributes;
  professions: PlayerProfessions;
  resources: ResourceInventory;
  equipment: PlayerEquipment;
  bag: EquipmentBag;
  missions: MissionLog;
  progress: PlayerProgress;
}

/**
 * Build a sync payload from the active snapshot.
 */
export function buildSyncPayload(): GrudgeSyncPayload | null {
  if (!_activeSnapshot?.character) return null;
  return {
    grudgeId: _activeSnapshot.character.grudgeId,
    accountId: _activeSnapshot.character.accountId,
    lastModified: new Date().toISOString(),
    character: _activeSnapshot.character,
    attributes: _activeSnapshot.attributes,
    professions: _activeSnapshot.professions,
    resources: _activeSnapshot.resources,
    equipment: _activeSnapshot.equipment,
    bag: _activeSnapshot.bag,
    missions: _activeSnapshot.missions,
    progress: _activeSnapshot.progress,
  };
}

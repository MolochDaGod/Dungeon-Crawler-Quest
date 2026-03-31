/**
 * Genesis Island — Instanced Starting Zone (Zone 10)
 *
 * Every new player starts here.  Every guild can own their own instance.
 * The island is a small land mass (~1835×1722 DCQ units) centered in
 * a 16000×16000 ocean zone, accessible by sailing from Pirate Bay (Zone 4).
 *
 * INSTANCING:
 *   Each guild gets a unique instance identified by UUID.
 *   The base zone definition (terrain, harvestables, structures) is shared.
 *   Instance state (ownership, built structures, claimed resources) is
 *   stored per-guild on the backend.
 *
 * SCALE REFERENCE:
 *   This zone was converted from the Unity MOBILE scene at:
 *     XZ: 2.5 DCQ units per Unity unit (1 Unity unit ≈ 1 meter)
 *     Y:  0.22 DCQ units per Unity unit (height compressed)
 *   A wall segment = 36 DCQ units, a house = ~50 DCQ units.
 *   This scale is the calibration reference for the entire world.
 *
 * NEW PLAYER FLOW:
 *   1. Create character → spawns on Genesis Island (their guild's instance)
 *   2. Tutorial quests teach combat, harvesting, crafting on the island
 *   3. At level 5, unlock the Harbor portal to sail to Pirate Bay (Zone 4)
 *   4. From there, enter the main 3×3 world grid
 *
 * PVP:
 *   Guilds can invite other players to their island for PvP events.
 *   The floating PvP Arena Platform (above the island) has tiered arenas.
 *   PvP lobby codes (GRD-XXXX) link to specific island instances.
 */

import { v4 as uuidv4 } from 'uuid' // falls back to crypto.randomUUID if unavailable

// ── Genesis Island Instance ────────────────────────────────────

export interface GenesisIslandInstance {
  /** Unique island instance ID */
  instanceId: string;
  /** Guild ID that owns this island (null = new player personal island) */
  guildId: string | null;
  /** Player grudge_id who created this island (owner for personal islands) */
  ownerId: string;
  /** Display name */
  name: string;
  /** Zone ID (always 10) */
  zoneId: 10;
  /** Current PvP mode for the island */
  pvpMode: 'pve' | 'guild_pvp' | 'open_pvp' | 'arena_only';
  /** Active player session IDs on this instance */
  activePlayers: string[];
  /** Max concurrent players */
  maxPlayers: number;
  /** Timestamp of creation */
  createdAt: number;
  /** Custom structures placed by the guild (positions + asset IDs) */
  customStructures: PlacedStructure[];
  /** PvP lobby code if hosting an event (GRD-XXXX format) */
  pvpLobbyCode: string | null;
  /** Whether the island is public (anyone can sail to it) */
  isPublic: boolean;
}

export interface PlacedStructure {
  id: string;
  assetId: string;
  x: number;
  y: number;
  rotation: number;
  placedBy: string;  // grudge_id
  placedAt: number;  // timestamp
}

// ── Factory ────────────────────────────────────────────────────

/** Generate a UUID for a new island instance */
function generateInstanceId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for environments without crypto.randomUUID
    return 'gi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * Create a new Genesis Island instance for a player or guild.
 */
export function createGenesisIsland(
  ownerId: string,
  guildId: string | null = null,
  name?: string,
): GenesisIslandInstance {
  return {
    instanceId: generateInstanceId(),
    guildId,
    ownerId,
    name: name || (guildId ? 'Guild Island' : 'Personal Island'),
    zoneId: 10,
    pvpMode: guildId ? 'guild_pvp' : 'pve',
    activePlayers: [],
    maxPlayers: guildId ? 50 : 10,
    createdAt: Date.now(),
    customStructures: [],
    pvpLobbyCode: null,
    isPublic: false,
  };
}

// ── PvP Lobby ──────────────────────────────────────────────────

/** Generate a GRD-XXXX lobby code for PvP events on the island */
export function generatePvpLobbyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = 'GRD-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Open the island for a PvP event.
 * Returns the lobby code that other players use to join.
 */
export function openPvpEvent(
  island: GenesisIslandInstance,
  mode: 'guild_pvp' | 'open_pvp' | 'arena_only' = 'open_pvp',
): string {
  const code = generatePvpLobbyCode();
  island.pvpLobbyCode = code;
  island.pvpMode = mode;
  island.isPublic = true;
  return code;
}

/** Close the PvP event and return to default mode */
export function closePvpEvent(island: GenesisIslandInstance): void {
  island.pvpLobbyCode = null;
  island.pvpMode = island.guildId ? 'guild_pvp' : 'pve';
  island.isPublic = false;
}

// ── Player Session Management ──────────────────────────────────

export function joinIsland(island: GenesisIslandInstance, sessionId: string): boolean {
  if (island.activePlayers.length >= island.maxPlayers) return false;
  if (island.activePlayers.includes(sessionId)) return true; // already on
  island.activePlayers.push(sessionId);
  return true;
}

export function leaveIsland(island: GenesisIslandInstance, sessionId: string): void {
  island.activePlayers = island.activePlayers.filter(s => s !== sessionId);
}

// ── Structure Placement ────────────────────────────────────────

export function placeStructure(
  island: GenesisIslandInstance,
  assetId: string,
  x: number, y: number,
  rotation: number,
  placedBy: string,
): PlacedStructure {
  const structure: PlacedStructure = {
    id: generateInstanceId(),
    assetId,
    x, y, rotation,
    placedBy,
    placedAt: Date.now(),
  };
  island.customStructures.push(structure);
  return structure;
}

export function removeStructure(island: GenesisIslandInstance, structureId: string): boolean {
  const idx = island.customStructures.findIndex(s => s.id === structureId);
  if (idx < 0) return false;
  island.customStructures.splice(idx, 1);
  return true;
}

// ── Instance Registry (client-side cache) ──────────────────────

const _instances = new Map<string, GenesisIslandInstance>();

export function registerInstance(island: GenesisIslandInstance): void {
  _instances.set(island.instanceId, island);
}

export function getInstance(instanceId: string): GenesisIslandInstance | null {
  return _instances.get(instanceId) ?? null;
}

export function getInstanceByGuild(guildId: string): GenesisIslandInstance | null {
  for (const island of _instances.values()) {
    if (island.guildId === guildId) return island;
  }
  return null;
}

export function getInstanceByOwner(ownerId: string): GenesisIslandInstance | null {
  for (const island of _instances.values()) {
    if (island.ownerId === ownerId && !island.guildId) return island;
  }
  return null;
}

export function getPublicInstances(): GenesisIslandInstance[] {
  return Array.from(_instances.values()).filter(i => i.isPublic);
}

export function getActiveEventIslands(): GenesisIslandInstance[] {
  return Array.from(_instances.values()).filter(i => i.pvpLobbyCode !== null);
}

// ── Scale Constants (exported for other systems to reference) ──

/** DCQ units per Unity unit (horizontal) */
export const GENESIS_SCALE_XZ = 2.5;

/** DCQ units per Unity unit (vertical/height) */
export const GENESIS_SCALE_Y = 0.22;

/** The island sits centered at (8000, 8000) in the zone */
export const GENESIS_ISLAND_CENTER = { x: 8000, y: 8000 };

/** Island footprint in DCQ units */
export const GENESIS_ISLAND_SIZE = { w: 1835, h: 1723 };

/** Island bounds (top-left corner + size) */
export const GENESIS_ISLAND_BOUNDS = {
  x: 7083, y: 7139,
  w: 1835, h: 1723,
};

/**
 * Convert a Unity position to DCQ zone coordinates.
 * Use this when placing objects from the Unity scene data.
 */
export function unityToGenesisDCQ(unityX: number, unityZ: number): { x: number; y: number } {
  return {
    x: Math.round(8000 + (unityX - (-133.3)) * GENESIS_SCALE_XZ),
    y: Math.round(8000 + (unityZ - (-155.6)) * GENESIS_SCALE_XZ),
  };
}

/**
 * Convert a Unity Y (height) to DCQ terrain height.
 */
export function unityToGenesisHeight(unityY: number): number {
  return (unityY - (-2880)) * GENESIS_SCALE_Y;
}

// ── New Player Starting Position ───────────────────────────────
//
// SPAWN FLOW (matches original Unity implementation):
//   1. Character spawns at a SAFE TELEPORTER position (ground level or below)
//   2. Invisible teleporter INSTANTLY warps player to the airship deck
//   3. Player is now standing on the airship — no falling through mesh
//   4. Player chooses race/class, then jumps off the airship to the island
//   5. Normal fall physics brings them to the Barbarian Camp below
//
// This avoids the common problem of spawning at height and falling
// through unloaded meshes.  The teleporter fires on the first frame
// before any rendering occurs.

/** Safe teleporter position — where the character actually spawns (ground-safe) */
export const GENESIS_SAFE_SPAWN = {
  ...unityToGenesisDCQ(-118.5, -105.18),
  height: 0,  // ground level, immediately teleported away
};

/** Airship body position (floating above the island) */
export const GENESIS_AIRSHIP_POS = {
  ...unityToGenesisDCQ(-118.5, -105.18),
  height: unityToGenesisHeight(-2506),  // ~82 DCQ units above ground
};

/** Airship deck — where the teleporter sends you (actual play position) */
export const GENESIS_AIRSHIP_DECK = {
  ...unityToGenesisDCQ(-118.5, -105.18),
  height: unityToGenesisHeight(-2411),  // ~103 DCQ units above ground (deck level)
};

/** Ground-level landing zone — the Barbarian Camp starting area */
export const GENESIS_LANDING_POINT = unityToGenesisDCQ(-380.52, 27.13);

/** The spawn point used by the game — set to safe teleporter position.
 *  The open-world engine should detect this zone and immediately
 *  teleport to GENESIS_AIRSHIP_DECK on first frame. */
export const GENESIS_SPAWN_POINT = GENESIS_SAFE_SPAWN;

/** All race spawn points (same position — teleported to airship deck) */
export const RACE_SPAWN_POINTS: Record<string, { x: number; y: number; height: number }> = {
  Human:     GENESIS_SPAWN_POINT,
  Barbarian: GENESIS_SPAWN_POINT,
  Dwarf:     GENESIS_SPAWN_POINT,
  Elf:       GENESIS_SPAWN_POINT,
  Orc:       GENESIS_SPAWN_POINT,
  Undead:    GENESIS_SPAWN_POINT,
};

/**
 * Check if a player just spawned and needs the airship teleport.
 * Call on the first frame after entering Zone 10.
 * Returns the airship deck position if teleport needed, null otherwise.
 */
export function checkAirshipTeleport(
  playerX: number, playerY: number, playerHeight: number,
): { x: number; y: number; height: number } | null {
  const dx = playerX - GENESIS_SAFE_SPAWN.x;
  const dy = playerY - GENESIS_SAFE_SPAWN.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // If player is within 50 units of the safe spawn and at ground level, teleport up
  if (dist < 50 && playerHeight < 5) {
    return GENESIS_AIRSHIP_DECK;
  }
  return null;
}

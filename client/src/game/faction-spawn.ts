/**
 * Faction Dock Spawn System
 *
 * Maps player faction (derived from race) to their faction's dock zone.
 * Players spawn at their faction's waterfront dock when entering the open world.
 */

import { RACE_FACTIONS } from './player-characters';
import type { PlayerCharacterState } from './player-characters';
import { getZoneById, ISLAND_ZONES } from './zones';

// ── Faction → Zone Mapping ─────────────────────────────────────
// Zone IDs match the 3×3 grid layout in zones.ts:
//   1 = Crusade Coast  (TOP,    col 1 row 0)
//   2 = Fabled Shore   (LEFT,   col 0 row 1)
//   3 = Legion Harbor  (RIGHT,  col 2 row 1)
//   4 = Pirate Bay     (BOTTOM, col 1 row 2)

export interface FactionDock {
  faction: string;
  zoneId: number;
  zoneName: string;
  /** Dock spawn point — on the waterfront pier */
  dockSpawn: { x: number; y: number };
  /** Hero NPC positions at the dock */
  npcPositions: { x: number; y: number; role: string }[];
  /** Faction emblem color for UI */
  color: string;
  /** Faction motto */
  motto: string;
}

// Derive dock positions from zone defs so they stay in sync with the grid
function dockFromZone(zoneId: number): { x: number; y: number } {
  const z = ISLAND_ZONES.find(z => z.id === zoneId);
  if (z?.dockSpawn) return z.dockSpawn;
  if (z) return { x: z.bounds.x + z.bounds.w / 2, y: z.bounds.y + z.bounds.h / 2 };
  return { x: 8000, y: 8000 };
}

function npcAround(cx: number, cy: number): { x: number; y: number; role: string }[] {
  return [
    { x: cx - 200, y: cy + 100, role: 'commander' },
    { x: cx + 200, y: cy + 100, role: 'supply_master' },
    { x: cx, y: cy - 200, role: 'scout' },
  ];
}

const _crusadeDock = dockFromZone(1);
const _fabledDock  = dockFromZone(2);
const _legionDock  = dockFromZone(3);
const _pirateDock  = dockFromZone(4);

export const FACTION_DOCKS: Record<string, FactionDock> = {
  Crusade: {
    faction: 'Crusade',
    zoneId: 1,
    zoneName: 'Crusade Coast',
    dockSpawn: _crusadeDock,
    npcPositions: npcAround(_crusadeDock.x, _crusadeDock.y),
    color: '#c5a059',
    motto: 'For Honor and Light',
  },
  Fabled: {
    faction: 'Fabled',
    zoneId: 2,
    zoneName: 'Fabled Shore',
    dockSpawn: _fabledDock,
    npcPositions: npcAround(_fabledDock.x, _fabledDock.y),
    color: '#22d3ee',
    motto: 'Wisdom Endures',
  },
  Legion: {
    faction: 'Legion',
    zoneId: 3,
    zoneName: 'Legion Harbor',
    dockSpawn: _legionDock,
    npcPositions: npcAround(_legionDock.x, _legionDock.y),
    color: '#ef4444',
    motto: 'Strength Through Fury',
  },
  Pirates: {
    faction: 'Pirates',
    zoneId: 4,
    zoneName: 'Pirate Bay',
    dockSpawn: _pirateDock,
    npcPositions: npcAround(_pirateDock.x, _pirateDock.y),
    color: '#f59e0b',
    motto: 'Take What Ye Can',
  },
};

// ── Spawn Resolution ───────────────────────────────────────────

/**
 * Get the faction dock for a player character.
 * Falls back to Crusade if faction is unknown.
 */
export function getPlayerFactionDock(character: PlayerCharacterState): FactionDock {
  const faction = character.faction || RACE_FACTIONS[character.race] || 'Crusade';
  return FACTION_DOCKS[faction] || FACTION_DOCKS.Crusade;
}

/**
 * Get the spawn point for a player based on their faction.
 * Used by initOpenWorld() to override default spawn.
 */
export function getFactionSpawnPoint(character: PlayerCharacterState): { x: number; y: number; zoneId: number } {
  const dock = getPlayerFactionDock(character);
  return {
    x: dock.dockSpawn.x,
    y: dock.dockSpawn.y,
    zoneId: dock.zoneId,
  };
}

/**
 * Get all faction dock definitions (for rendering dock structures on the map).
 */
export function getAllFactionDocks(): FactionDock[] {
  return Object.values(FACTION_DOCKS);
}

// ── Dock Structures (fishing village pack integration) ──────────

export interface DockStructure {
  x: number;
  y: number;
  type: 'pier' | 'boat_small' | 'boat_large' | 'dock_house' | 'barrel' | 'crate' | 'anchor' | 'lamp' | 'flag';
  rotation?: number;
  faction: string;
}

/**
 * Generate dock structures for a faction dock using fishing village pack assets.
 * These are placed around the dockSpawn point.
 */
export function generateDockStructures(dock: FactionDock): DockStructure[] {
  const { x, y } = dock.dockSpawn;
  const f = dock.faction;
  const structures: DockStructure[] = [];

  // Main pier extending into water
  structures.push({ x: x, y: y - 40, type: 'pier', faction: f });
  structures.push({ x: x, y: y - 80, type: 'pier', faction: f });

  // Boats at dock
  structures.push({ x: x - 60, y: y - 60, type: 'boat_large', faction: f, rotation: 0.3 });
  structures.push({ x: x + 50, y: y - 40, type: 'boat_small', faction: f, rotation: -0.2 });

  // Dock house (quest hub)
  structures.push({ x: x, y: y + 40, type: 'dock_house', faction: f });

  // Decorations
  structures.push({ x: x - 30, y: y + 10, type: 'barrel', faction: f });
  structures.push({ x: x + 30, y: y + 10, type: 'crate', faction: f });
  structures.push({ x: x - 50, y: y - 20, type: 'anchor', faction: f });
  structures.push({ x: x + 60, y: y + 30, type: 'lamp', faction: f });

  // Faction flag
  structures.push({ x: x, y: y + 80, type: 'flag', faction: f });
  structures.push({ x: x - 80, y: y + 60, type: 'flag', faction: f });
  structures.push({ x: x + 80, y: y + 60, type: 'flag', faction: f });

  return structures;
}

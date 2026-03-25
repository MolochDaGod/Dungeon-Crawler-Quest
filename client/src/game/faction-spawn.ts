/**
 * Faction Dock Spawn System
 *
 * Maps player faction (derived from race) to their faction's dock zone.
 * Players spawn at their faction's waterfront dock when entering the open world.
 */

import { RACE_FACTIONS } from './player-characters';
import type { PlayerCharacterState } from './player-characters';
import { getZoneById } from './zones';

// ── Faction → Zone Mapping ─────────────────────────────────────

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

export const FACTION_DOCKS: Record<string, FactionDock> = {
  Crusade: {
    faction: 'Crusade',
    zoneId: 16,
    zoneName: 'Crusade Coast',
    dockSpawn: { x: 7500, y: 800 },
    npcPositions: [
      { x: 7300, y: 900, role: 'commander' },
      { x: 7700, y: 900, role: 'supply_master' },
      { x: 7500, y: 600, role: 'scout' },
    ],
    color: '#c5a059',
    motto: 'For Honor and Light',
  },
  Fabled: {
    faction: 'Fabled',
    zoneId: 17,
    zoneName: 'Fabled Shore',
    dockSpawn: { x: 1400, y: 7400 },
    npcPositions: [
      { x: 1200, y: 7500, role: 'commander' },
      { x: 1600, y: 7500, role: 'supply_master' },
      { x: 1400, y: 7200, role: 'scout' },
    ],
    color: '#22d3ee',
    motto: 'Wisdom Endures',
  },
  Legion: {
    faction: 'Legion',
    zoneId: 18,
    zoneName: 'Legion Harbor',
    dockSpawn: { x: 14650, y: 7400 },
    npcPositions: [
      { x: 14450, y: 7500, role: 'commander' },
      { x: 14850, y: 7500, role: 'supply_master' },
      { x: 14650, y: 7200, role: 'scout' },
    ],
    color: '#ef4444',
    motto: 'Strength Through Fury',
  },
  Pirates: {
    faction: 'Pirates',
    zoneId: 19,
    zoneName: 'Pirate Bay',
    dockSpawn: { x: 7500, y: 13800 },
    npcPositions: [
      { x: 7300, y: 13900, role: 'commander' },
      { x: 7700, y: 13900, role: 'supply_master' },
      { x: 7500, y: 13600, role: 'scout' },
    ],
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

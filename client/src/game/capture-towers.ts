/**
 * Capture Tower System — Open-World Territory Control
 *
 * Towers are spread across a zone.  Each tower has enemy guards.
 * When a player clears the guards and stands within range, the tower
 * gradually captures to the player's faction.  Owned towers stop
 * spawning hostile guards and grant passive buffs / safe waypoints.
 *
 * Designed for Zone 2 (Fabled Shore) but generic enough for any zone.
 */

// ── Types ──────────────────────────────────────────────────────

export type TowerTier = 'outer' | 'inner' | 'fortress';

export interface TowerGuardDef {
  type: string;   // enemy template key (matches ENEMY_TEMPLATES)
  level: number;
  count: number;
}

export interface CaptureTowerDef {
  id: string;
  name: string;
  zoneId: number;
  x: number;
  y: number;
  tier: TowerTier;
  /** Radius the player must be within to capture */
  captureRadius: number;
  /** Guards that spawn while tower is hostile */
  guards: TowerGuardDef[];
  /** Asset id used for the 3D model */
  assetId: string;
  /** Description shown in UI */
  description: string;
}

export interface CaptureTowerState {
  def: CaptureTowerDef;
  /** Faction currently owning the tower (null = contested / hostile) */
  ownerFaction: string | null;
  /** 0..100  — reaches 100 to flip ownership */
  captureProgress: number;
  /** Faction attempting to capture */
  capturingFaction: string | null;
  /** IDs of currently spawned guard enemies (tracked by open-world engine) */
  guardEntityIds: number[];
  /** True once guards have been cleared after a flip */
  guardsCleared: boolean;
  /** Cooldown before guards respawn after tower is lost */
  guardRespawnTimer: number;
}

// ── Constants ──────────────────────────────────────────────────

const CAPTURE_RATE         = 8;    // progress per second while in range
const DECAY_RATE           = 3;    // progress lost per second when out of range
const GUARD_RESPAWN_DELAY  = 120;  // seconds before guards come back if tower lost
const CAPTURE_RADIUS_BASE  = 250;

// ── Zone 2 Capture Towers (Fabled Shore — Elf Territory) ───────
//
//  Layout across the 16000×16000 zone — roughly 4×4 grid with
//  variation to feel organic.  Towers get harder toward the center.
//
//  Grid reference:
//    Col  →  ~2000   5000   9000   13000
//    Row  ↓
//    1:     2000
//    2:     5500
//    3:     9500
//    4:    13000

const z2 = (
  id: string, name: string, x: number, y: number,
  tier: TowerTier, guards: TowerGuardDef[], asset: string, desc: string,
): CaptureTowerDef => ({
  id, name, zoneId: 2, x, y, tier,
  captureRadius: tier === 'fortress' ? 350 : CAPTURE_RADIUS_BASE,
  guards, assetId: asset, description: desc,
});

const outerGuards: TowerGuardDef[] = [
  { type: 'Treant', level: 4, count: 2 },
  { type: 'Spider', level: 3, count: 3 },
];
const innerGuards: TowerGuardDef[] = [
  { type: 'Treant', level: 6, count: 2 },
  { type: 'Harpy', level: 5, count: 2 },
  { type: 'Golem', level: 5, count: 1 },
];
const eliteGuards: TowerGuardDef[] = [
  { type: 'Treant', level: 8, count: 2 },
  { type: 'Golem', level: 7, count: 2 },
  { type: 'Harpy', level: 6, count: 2 },
];

export const ZONE2_CAPTURE_TOWERS: CaptureTowerDef[] = [
  // ── Row 1 (north) ──  outer ring uses Lv1-2 defense towers
  z2('z2-t01', 'Moonveil Spire',       1800,  1800, 'outer', outerGuards, 'dt-archer-1',  'A slender spire veiled in moonlight, overlooking the northern glade.'),
  z2('z2-t02', 'Starwood Beacon',      5200,  2200, 'outer', outerGuards, 'dt-frost-1',   'Ancient beacon that once guided ships through enchanted fog.'),
  z2('z2-t03', 'Crystalvein Watch',     9200,  1600, 'outer', outerGuards, 'dt-wizard-1',  'Tower above a glowing crystal deposit, pulsing with mana.'),
  z2('z2-t04', 'Thornguard Tower',    13200,  2000, 'outer', outerGuards, 'dt-ballista-1', 'Thorn-wrapped tower at the eastern forest edge.'),

  // ── Row 2 (north-center) ──  inner ring uses Lv2-3 defense towers
  z2('z2-t05', 'Whispering Arch',      2200,  5200, 'inner', innerGuards, 'dt-archer-2',  'Arched tower where the wind carries faint elven song.'),
  z2('z2-t06', 'Runestone Tower',       5400,  5800, 'inner', innerGuards, 'dt-wizard-2',  'Tower encircled by ancient rune stones that glow at night.'),
  z2('z2-t07', 'Heartwood Bastion',     8800,  5600, 'inner', innerGuards, 'dt-frost-2',   'Bastion carved from the heartwood of a colossal tree.'),
  z2('z2-t08', 'Jadescale Watch',      13000,  5400, 'inner', innerGuards, 'dt-cannon-2',  'Watchtower near the river bend, draped in jade vines.'),

  // ── Row 3 (south-center) ──  elite inner towers use Lv3
  z2('z2-t09', 'Silverbloom Tower',     1600,  9600, 'inner', innerGuards, 'dt-ballista-2','Tower surrounded by luminous silver flowers.'),
  z2('z2-t10', 'Gladekeeper Spire',     5000,  9200, 'inner', eliteGuards, 'dt-wizard-3',  'Sacred spire guarding the path to the inner fortress.'),
  z2('z2-t11', 'Sunfire Pinnacle',      9400,  9800, 'inner', eliteGuards, 'dt-archer-3',  'Pinnacle that channels sunlight into a perpetual flame.'),
  z2('z2-t12', 'Mossheart Tower',      13400,  9400, 'inner', innerGuards, 'dt-frost-3',   'Moss-covered tower hiding a druid shrine within.'),

  // ── Row 4 (south) ──  outer ring Lv1-2
  z2('z2-t13', 'Duskfen Watch',         2000, 13200, 'outer', outerGuards, 'dt-cannon-1',  'Tower perched above the misty southern fen.'),
  z2('z2-t14', 'Bramblegate Tower',     5600, 13000, 'outer', outerGuards, 'dt-archer-2',  'Briar-choked tower that blocks a forest chokepoint.'),
  z2('z2-t15', 'Willowshade Spire',     9000, 13400, 'outer', outerGuards, 'dt-frost-2',   'Spire hidden beneath the canopy of weeping willows.'),
  z2('z2-t16', 'Frostpetal Lookout',   13000, 13200, 'outer', outerGuards, 'dt-ballista-2','Lookout tower where enchanted frost petals never melt.'),
];

// ── All Capture Towers (expandable to other zones) ─────────────

export const ALL_CAPTURE_TOWERS: CaptureTowerDef[] = [
  ...ZONE2_CAPTURE_TOWERS,
];

// ── State Factory ──────────────────────────────────────────────

export function createCaptureTowerState(def: CaptureTowerDef): CaptureTowerState {
  return {
    def,
    ownerFaction: null,
    captureProgress: 0,
    capturingFaction: null,
    guardEntityIds: [],
    guardsCleared: false,
    guardRespawnTimer: 0,
  };
}

export function createAllTowerStates(zoneId: number): CaptureTowerState[] {
  return ALL_CAPTURE_TOWERS
    .filter(t => t.zoneId === zoneId)
    .map(createCaptureTowerState);
}

// ── Update Logic ───────────────────────────────────────────────

export interface TowerUpdateResult {
  captured: CaptureTowerState | null;
  lost: CaptureTowerState | null;
  guardSpawnRequests: { tower: CaptureTowerState; guards: TowerGuardDef[] }[];
}

/**
 * Tick all towers.  Returns events the engine should act on.
 *
 * @param towers      Current tower states
 * @param playerX     Player world position
 * @param playerY     Player world position
 * @param playerFaction  Player's faction string
 * @param dt          Delta time (seconds)
 */
export function updateCaptureTowers(
  towers: CaptureTowerState[],
  playerX: number,
  playerY: number,
  playerFaction: string,
  dt: number,
): TowerUpdateResult {
  const result: TowerUpdateResult = { captured: null, lost: null, guardSpawnRequests: [] };

  for (const t of towers) {
    const dx = playerX - t.def.x;
    const dy = playerY - t.def.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inRange = dist <= t.def.captureRadius;

    // ── Guard respawn timer ──
    if (t.ownerFaction === null && t.guardRespawnTimer > 0) {
      t.guardRespawnTimer -= dt;
      if (t.guardRespawnTimer <= 0 && t.guardsCleared) {
        t.guardsCleared = false;
        result.guardSpawnRequests.push({ tower: t, guards: t.def.guards });
      }
    }

    // ── Capture progress ──
    if (inRange && t.ownerFaction !== playerFaction) {
      // Player is trying to capture
      if (t.capturingFaction !== playerFaction) {
        // Switched factions mid-capture → reset
        t.capturingFaction = playerFaction;
        t.captureProgress = 0;
      }
      t.captureProgress = Math.min(100, t.captureProgress + CAPTURE_RATE * dt);

      if (t.captureProgress >= 100) {
        // Tower captured!
        const wasPreviouslyOwned = t.ownerFaction !== null;
        t.ownerFaction = playerFaction;
        t.captureProgress = 0;
        t.capturingFaction = null;
        t.guardsCleared = true;
        t.guardEntityIds = [];
        result.captured = t;
      }
    } else if (!inRange && t.capturingFaction !== null && t.ownerFaction !== t.capturingFaction) {
      // Decay capture progress
      t.captureProgress = Math.max(0, t.captureProgress - DECAY_RATE * dt);
      if (t.captureProgress <= 0) {
        t.capturingFaction = null;
      }
    }
  }

  return result;
}

// ── Queries ────────────────────────────────────────────────────

export function getCaptureTowersForZone(zoneId: number): CaptureTowerDef[] {
  return ALL_CAPTURE_TOWERS.filter(t => t.zoneId === zoneId);
}

export function getOwnedTowerCount(towers: CaptureTowerState[], faction: string): number {
  return towers.filter(t => t.ownerFaction === faction).length;
}

export function getTowerNear(
  towers: CaptureTowerState[], x: number, y: number, range: number,
): CaptureTowerState | null {
  for (const t of towers) {
    const dx = x - t.def.x, dy = y - t.def.y;
    if (Math.sqrt(dx * dx + dy * dy) < range) return t;
  }
  return null;
}

/** Buff multiplier granted by captured towers (e.g. +2% ATK per tower) */
export function getCapturedTowerBuff(towers: CaptureTowerState[], faction: string): {
  atkMult: number; defMult: number; xpMult: number;
} {
  const count = getOwnedTowerCount(towers, faction);
  return {
    atkMult: 1 + count * 0.02,
    defMult: 1 + count * 0.01,
    xpMult:  1 + count * 0.03,
  };
}

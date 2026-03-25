/**
 * Zone System - ported from GRUDGE_IslandZoneController + GRUDGE_ZoneTrigger
 * Defines world zones with properties, detects player zone transitions.
 */

export interface ZoneSpawnPoint {
  x: number;
  y: number;
}

export interface MonsterSpawnDef {
  x: number;
  y: number;
  type: string;       // enemy type name
  level: number;
  respawnTime: number; // seconds
  count: number;       // how many to spawn at this point
}

export interface ZoneDef {
  id: number;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  requiredLevel: number;
  isPvP: boolean;
  isSafeZone: boolean;
  terrainType: string;      // primary terrain for procedural fill
  ambientColor: string;     // hex color tint for zone
  description: string;
  playerSpawns: ZoneSpawnPoint[];
  monsterSpawns: MonsterSpawnDef[];
  connectedZoneIds: number[];
  npcPositions: ZoneSpawnPoint[];
  portalPositions: { x: number; y: number; targetZoneId: number }[];
  /** Asset pack id for structures in this zone */
  assetPack?: string;
  /** Specific structure asset IDs to place in this zone */
  structureAssets?: string[];
  /** Island type for world map rendering */
  islandType?: 'town' | 'port' | 'dungeon' | 'wilderness' | 'boss-arena' | 'village';
  /** Faction dock spawn point (for faction-spawn.ts) */
  dockSpawn?: { x: number; y: number };
  /** Faction that controls this zone */
  faction?: string;
  /** Can players deploy Pirate Claim flags here to establish a base? */
  claimable?: boolean;
}

// ── 3×3 Grid World Layout ──────────────────────────────────────
// 16000×16000 world divided into a 3×3 macro grid:
//   [TL: NW Wilds]      [TOP: Crusade Dock]     [TR: NE Wilds]
//   [LEFT: Fabled Dock]  [CENTER: Travelers Town] [RIGHT: Legion Dock]
//   [BL: SW Wilds]      [BOTTOM: Pirates Dock]   [BR: SE Wilds]
//
// Each cell ~4800×4800 with 400px ocean gaps. 9 zones total.
// Center = safe hub. Cardinal = faction docks. Corners = claimable PvP.
export const OPEN_WORLD_SIZE = 16000;

const _P = 400;  // ocean padding
const _C = 4800; // cell size
const _gx = (col: number) => _P + col * (_C + _P);
const _gy = (row: number) => _P + row * (_C + _P);
const _cx = (col: number) => _gx(col) + _C / 2;
const _cy = (row: number) => _gy(row) + _C / 2;

export const ISLAND_ZONES: ZoneDef[] = [
  // ── 0: CENTER (1,1) — Travelers Town ────────────────────────
  { id: 0, name: 'Travelers Town',
    bounds: { x: _gx(1), y: _gy(1), w: _C, h: _C },
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#4a7a3a',
    description: 'The central crossroads. All factions meet here in peace. Shops, trainers, Heroes Guild.',
    playerSpawns: [{ x: _cx(1), y: _cy(1) }, { x: _cx(1) - 200, y: _cy(1) - 200 }, { x: _cx(1) + 200, y: _cy(1) + 200 }],
    monsterSpawns: [],
    connectedZoneIds: [1, 2, 3, 4],
    npcPositions: [
      { x: _cx(1) - 400, y: _cy(1) - 300 }, { x: _cx(1) + 400, y: _cy(1) - 300 },
      { x: _cx(1), y: _cy(1) - 600 }, { x: _cx(1) - 500, y: _cy(1) + 300 }, { x: _cx(1) + 500, y: _cy(1) + 300 },
    ],
    portalPositions: [], islandType: 'town',
  },

  // ── 1: TOP (1,0) — Crusade Coast ──────────────────────────
  { id: 1, name: 'Crusade Coast',
    bounds: { x: _gx(1), y: _gy(0), w: _C, h: _C },
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#5a7a3a',
    description: 'Northern fortress of the Crusade. Human & Barbarian heroes patrol the ramparts.',
    playerSpawns: [{ x: _cx(1), y: _cy(0) + 400 }],
    monsterSpawns: [
      { x: _gx(1) + 600, y: _gy(0) + 800, type: 'Slime', level: 2, respawnTime: 30, count: 3 },
      { x: _gx(1) + _C - 600, y: _gy(0) + 1200, type: 'Skeleton', level: 3, respawnTime: 40, count: 2 },
      { x: _cx(1), y: _gy(0) + _C - 600, type: 'Bandit', level: 4, respawnTime: 35, count: 3 },
    ],
    connectedZoneIds: [0, 5, 6],
    npcPositions: [
      { x: _cx(1) - 300, y: _cy(0) + 200 }, { x: _cx(1) + 300, y: _cy(0) + 200 },
      { x: _cx(1), y: _cy(0) - 200 }, { x: _cx(1) - 500, y: _cy(0) + 600 }, { x: _cx(1) + 500, y: _cy(0) + 600 },
    ],
    portalPositions: [{ x: _cx(1), y: _gy(0) + _C - 100, targetZoneId: 0 }],
    structureAssets: ['ct-fortress','ct-tower-01','ct-tower-03','ct-tower-05','ct-wall-01','ct-wall-02','ct-bridge','ct-barracks','ct-armory','ct-gates-1','ct-brazier','mv-inn','mv-blacksmith','mv-well'],
    islandType: 'town', dockSpawn: { x: _cx(1), y: _gy(0) + 400 }, faction: 'Crusade',
  },

  // ── 2: LEFT (0,1) — Fabled Shore ──────────────────────────
  { id: 2, name: 'Fabled Shore',
    bounds: { x: _gx(0), y: _gy(1), w: _C, h: _C },
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#3a6a6a',
    description: 'Western coast ruled by Elves & Dwarves. Ancient temples overlook the sea.',
    playerSpawns: [{ x: _cx(0) + 400, y: _cy(1) }],
    monsterSpawns: [
      { x: _gx(0) + 800, y: _gy(1) + 600, type: 'Spider', level: 2, respawnTime: 30, count: 3 },
      { x: _gx(0) + 1200, y: _gy(1) + _C - 800, type: 'Treant', level: 4, respawnTime: 50, count: 2 },
      { x: _gx(0) + _C - 600, y: _cy(1), type: 'Harpy', level: 3, respawnTime: 35, count: 3 },
    ],
    connectedZoneIds: [0, 5, 7],
    npcPositions: [
      { x: _cx(0) + 200, y: _cy(1) - 300 }, { x: _cx(0) + 200, y: _cy(1) + 300 },
      { x: _cx(0) - 200, y: _cy(1) }, { x: _cx(0) + 600, y: _cy(1) - 500 }, { x: _cx(0) + 600, y: _cy(1) + 500 },
    ],
    portalPositions: [{ x: _gx(0) + _C - 100, y: _cy(1), targetZoneId: 0 }],
    structureAssets: ['ft-fortress','ft-tower-1','ft-tower-3','ft-tower-5','ft-wall-1','ft-bridge','ft-arsenal','ft-barracks','ft-brazier','mv-inn','mv-mill','mv-gazebo'],
    islandType: 'town', dockSpawn: { x: _gx(0) + 400, y: _cy(1) }, faction: 'Fabled',
  },

  // ── 3: RIGHT (2,1) — Legion Harbor ─────────────────────────
  { id: 3, name: 'Legion Harbor',
    bounds: { x: _gx(2), y: _gy(1), w: _C, h: _C },
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'stone', ambientColor: '#4a3a5a',
    description: 'Eastern dark harbor of the Legion. Orc & Undead heroes guard the docks.',
    playerSpawns: [{ x: _cx(2) - 400, y: _cy(1) }],
    monsterSpawns: [
      { x: _gx(2) + 600, y: _cy(1) - 400, type: 'Wraith', level: 3, respawnTime: 40, count: 2 },
      { x: _gx(2) + _C - 800, y: _cy(1) + 600, type: 'Dark Archer', level: 4, respawnTime: 45, count: 3 },
      { x: _cx(2), y: _gy(1) + _C - 600, type: 'Orc Grunt', level: 3, respawnTime: 35, count: 4 },
    ],
    connectedZoneIds: [0, 6, 8],
    npcPositions: [
      { x: _cx(2) - 200, y: _cy(1) - 300 }, { x: _cx(2) - 200, y: _cy(1) + 300 },
      { x: _cx(2) + 200, y: _cy(1) }, { x: _cx(2) - 600, y: _cy(1) - 500 }, { x: _cx(2) - 600, y: _cy(1) + 500 },
    ],
    portalPositions: [{ x: _gx(2) + 100, y: _cy(1), targetZoneId: 0 }],
    structureAssets: ['lt-fortress','lt-tower-01','lt-tower-3','lt-tower-5','lt-wall-1','lt-bridge','lt-barracks','lt-arsenal','lt-drum','lt-brazier','os-tavern','os-smithy'],
    islandType: 'town', dockSpawn: { x: _gx(2) + _C - 400, y: _cy(1) }, faction: 'Legion',
  },

  // ── 4: BOTTOM (1,2) — Pirate Bay ──────────────────────────
  { id: 4, name: 'Pirate Bay',
    bounds: { x: _gx(1), y: _gy(2), w: _C, h: _C },
    requiredLevel: 1, isPvP: true, isSafeZone: false,
    terrainType: 'water', ambientColor: '#1a4a6a',
    description: 'Southern pirate stronghold. Lawless PvP waters where the Pirates faction rules.',
    playerSpawns: [{ x: _cx(1), y: _cy(2) - 400 }],
    monsterSpawns: [
      { x: _gx(1) + 800, y: _gy(2) + 600, type: 'Bandit', level: 3, respawnTime: 30, count: 4 },
      { x: _gx(1) + _C - 800, y: _cy(2), type: 'Spider', level: 4, respawnTime: 35, count: 3 },
      { x: _cx(1), y: _gy(2) + _C - 800, type: 'Sea Serpent', level: 6, respawnTime: 120, count: 1 },
      { x: _cx(1) + 600, y: _cy(2) - 200, type: 'Bandit Chief', level: 8, respawnTime: 90, count: 1 },
    ],
    connectedZoneIds: [0, 7, 8],
    npcPositions: [{ x: _cx(1) - 300, y: _cy(2) - 200 }, { x: _cx(1) + 300, y: _cy(2) - 200 }, { x: _cx(1), y: _cy(2) + 200 }],
    portalPositions: [{ x: _cx(1), y: _gy(2) + 100, targetZoneId: 0 }],
    structureAssets: ['pk-ship-large','pk-ship-small','pk-dock','pk-dock-broken','pk-house-1','pk-house-2','pk-cannon','pk-barrel','pk-anchor','pk-palm-1','pk-palm-2'],
    islandType: 'port', dockSpawn: { x: _cx(1), y: _gy(2) + 400 }, faction: 'Pirates',
  },

  // ── 5: TOP-LEFT (0,0) — Northwest Wilds (claimable) ────────
  { id: 5, name: 'Northwest Wilds',
    bounds: { x: _gx(0), y: _gy(0), w: _C, h: _C },
    requiredLevel: 3, isPvP: true, isSafeZone: false,
    terrainType: 'jungle', ambientColor: '#1a4a12',
    description: 'Dense untamed forest. Crews can claim territory here. Rich in logging & herbalism.',
    playerSpawns: [{ x: _cx(0), y: _cy(0) }],
    monsterSpawns: [
      { x: _gx(0) + 600, y: _gy(0) + 600, type: 'Slime', level: 2, respawnTime: 30, count: 4 },
      { x: _gx(0) + 2400, y: _gy(0) + 1200, type: 'Spider', level: 4, respawnTime: 25, count: 3 },
      { x: _gx(0) + 1000, y: _gy(0) + 3000, type: 'Treant', level: 5, respawnTime: 60, count: 2 },
      { x: _gx(0) + 3500, y: _gy(0) + 2000, type: 'Timber Wolf', level: 4, respawnTime: 35, count: 4 },
      { x: _gx(0) + 2000, y: _gy(0) + 4000, type: 'Goblin Shaman', level: 6, respawnTime: 50, count: 2 },
      { x: _cx(0), y: _cy(0), type: 'Dragon', level: 10, respawnTime: 120, count: 1 },
    ],
    connectedZoneIds: [1, 2],
    npcPositions: [{ x: _cx(0) + 300, y: _cy(0) + 300 }],
    portalPositions: [{ x: _gx(0) + _C - 100, y: _cy(0), targetZoneId: 1 }, { x: _cx(0), y: _gy(0) + _C - 100, targetZoneId: 2 }],
    islandType: 'wilderness', claimable: true,
  },

  // ── 6: TOP-RIGHT (2,0) — Northeast Wilds (claimable) ───────
  { id: 6, name: 'Northeast Wilds',
    bounds: { x: _gx(2), y: _gy(0), w: _C, h: _C },
    requiredLevel: 5, isPvP: true, isSafeZone: false,
    terrainType: 'stone', ambientColor: '#5a5a6a',
    description: 'Treacherous mountain crags. PvP territory with mining nodes and ancient ruins.',
    playerSpawns: [{ x: _cx(2), y: _cy(0) }],
    monsterSpawns: [
      { x: _gx(2) + 800, y: _gy(0) + 600, type: 'Golem', level: 6, respawnTime: 60, count: 2 },
      { x: _gx(2) + 3000, y: _gy(0) + 1000, type: 'Bandit', level: 5, respawnTime: 35, count: 4 },
      { x: _gx(2) + 1500, y: _gy(0) + 2500, type: 'Skeleton', level: 7, respawnTime: 45, count: 3 },
      { x: _gx(2) + 4000, y: _gy(0) + 2000, type: 'Dark Archer', level: 8, respawnTime: 40, count: 3 },
      { x: _cx(2), y: _cy(0), type: 'Bandit Chief', level: 10, respawnTime: 90, count: 1 },
    ],
    connectedZoneIds: [1, 3],
    npcPositions: [],
    portalPositions: [{ x: _gx(2) + 100, y: _cy(0), targetZoneId: 1 }, { x: _cx(2), y: _gy(0) + _C - 100, targetZoneId: 3 }],
    assetPack: 'stone-terrain',
    structureAssets: ['st-big-1','st-big-2','st-big-3','st-lit-1','st-lit-2','mn-mine-1','mn-mine-2','mn-coal','mn-gold-1'],
    islandType: 'wilderness', claimable: true,
  },

  // ── 7: BOTTOM-LEFT (0,2) — Southwest Wilds (claimable) ─────
  { id: 7, name: 'Southwest Wilds',
    bounds: { x: _gx(0), y: _gy(2), w: _C, h: _C },
    requiredLevel: 8, isPvP: true, isSafeZone: false,
    terrainType: 'dirt', ambientColor: '#5a2010',
    description: 'Volcanic badlands. Rich in rare ores. Crews battle for control.',
    playerSpawns: [{ x: _cx(0), y: _cy(2) }],
    monsterSpawns: [
      { x: _gx(0) + 800, y: _gy(2) + 800, type: 'Berserker', level: 10, respawnTime: 45, count: 3 },
      { x: _gx(0) + 3000, y: _gy(2) + 1000, type: 'Dragon', level: 12, respawnTime: 90, count: 1 },
      { x: _gx(0) + 1200, y: _gy(2) + 3500, type: 'Fire Drake', level: 11, respawnTime: 80, count: 2 },
      { x: _gx(0) + 4000, y: _gy(2) + 2500, type: 'Infernal Colossus', level: 15, respawnTime: 180, count: 1 },
      { x: _cx(0), y: _cy(2), type: 'Piglin Brute', level: 12, respawnTime: 45, count: 2 },
    ],
    connectedZoneIds: [2, 4],
    npcPositions: [],
    portalPositions: [{ x: _gx(0) + _C - 100, y: _cy(2), targetZoneId: 4 }, { x: _cx(0), y: _gy(2) + 100, targetZoneId: 2 }],
    assetPack: 'volcano',
    structureAssets: ['vl-volcano-1','vl-volcano-2','vl-volcano-3','vl-boulder-1','vl-boulder-2','vl-boulder-3','of-fortress','of-tower-1','os-tent-1'],
    islandType: 'wilderness', claimable: true,
  },

  // ── 8: BOTTOM-RIGHT (2,2) — Southeast Wilds (claimable) ────
  { id: 8, name: 'Southeast Wilds',
    bounds: { x: _gx(2), y: _gy(2), w: _C, h: _C },
    requiredLevel: 12, isPvP: true, isSafeZone: false,
    terrainType: 'stone', ambientColor: '#2a1a2a',
    description: 'Ancient crypts & graveyards. Most dangerous claimable territory. World bosses roam.',
    playerSpawns: [{ x: _cx(2), y: _cy(2) }],
    monsterSpawns: [
      { x: _gx(2) + 800, y: _gy(2) + 600, type: 'Skeleton', level: 12, respawnTime: 30, count: 5 },
      { x: _gx(2) + 3000, y: _gy(2) + 1200, type: 'Necromancer', level: 14, respawnTime: 50, count: 2 },
      { x: _gx(2) + 4000, y: _gy(2) + 2500, type: 'Lich King', level: 18, respawnTime: 180, count: 1 },
      { x: _gx(2) + 2000, y: _gy(2) + 4200, type: 'Shadow Dragon', level: 20, respawnTime: 240, count: 1 },
      { x: _cx(2), y: _cy(2), type: 'Infernal Colossus', level: 22, respawnTime: 300, count: 1 },
    ],
    connectedZoneIds: [3, 4],
    npcPositions: [],
    portalPositions: [{ x: _gx(2) + 100, y: _cy(2), targetZoneId: 3 }, { x: _cx(2), y: _gy(2) + 100, targetZoneId: 4 }],
    assetPack: 'bossgraveyard',
    structureAssets: ['bg-ruin-1','bg-ruin-2','bg-ruin-3','bg-ruin-5','bg-ruin-8','bg-ruin-12','bg-ruin-15','md-torch','md-bones'],
    islandType: 'boss-arena', claimable: true,
  },
];

// --- Zone queries ---

export function getZoneAtPosition(x: number, y: number): ZoneDef | null {
  for (const zone of ISLAND_ZONES) {
    const b = zone.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) {
      return zone;
    }
  }
  return null;
}

export function getZoneById(id: number): ZoneDef | null {
  return ISLAND_ZONES.find(z => z.id === id) ?? null;
}

export function canEnterZone(playerLevel: number, zone: ZoneDef): boolean {
  return playerLevel >= zone.requiredLevel;
}

export function getActiveZones(): ZoneDef[] {
  return ISLAND_ZONES;
}

export function getZoneColor(zone: ZoneDef): string {
  if (zone.isSafeZone) return '#22c55e';
  if (zone.isPvP) return '#ef4444';
  return '#f59e0b';
}

// --- Zone transition tracker ---

export interface ZoneTracker {
  currentZoneId: number | null;
  previousZoneId: number | null;
  transitionTime: number;
}

export function createZoneTracker(): ZoneTracker {
  return { currentZoneId: null, previousZoneId: null, transitionTime: 0 };
}

/** Returns the new zone if a transition just happened, null otherwise */
export function updateZoneTracker(tracker: ZoneTracker, playerX: number, playerY: number, dt: number): ZoneDef | null {
  tracker.transitionTime += dt;
  const zone = getZoneAtPosition(playerX, playerY);
  const newId = zone?.id ?? null;

  if (newId !== tracker.currentZoneId) {
    tracker.previousZoneId = tracker.currentZoneId;
    tracker.currentZoneId = newId;
    tracker.transitionTime = 0;
    return zone;
  }
  return null;
}

// ── Dungeon Entrances ──────────────────────────────────────────

export interface DungeonEntrance {
  id: string;
  name: string;
  x: number;
  y: number;
  zoneId: number;
  requiredLevel: number;
  description: string;
  difficulty: 'normal' | 'hard' | 'heroic';
  icon: string;       // emoji for map display
  floors: number;     // how many floors the dungeon has
}

export const DUNGEON_ENTRANCES: DungeonEntrance[] = [
  {
    id: 'forest-crypt',
    name: 'Forest Crypt',
    x: 1700, y: 4400,
    zoneId: 1,
    requiredLevel: 3,
    description: 'A crumbling crypt hidden among the roots of ancient trees.',
    difficulty: 'normal',
    icon: '🏚️',
    floors: 3,
  },
  {
    id: 'swamp-cavern',
    name: 'Swamp Cavern',
    x: 5800, y: 3200,
    zoneId: 2,
    requiredLevel: 6,
    description: 'A dank cavern beneath the cursed swamp. The air reeks of decay.',
    difficulty: 'normal',
    icon: '🕳️',
    floors: 4,
  },
  {
    id: 'mountain-mine',
    name: 'Abandoned Mine',
    x: 4600, y: 900,
    zoneId: 3,
    requiredLevel: 9,
    description: 'An old mine overrun by golems and bandits.',
    difficulty: 'hard',
    icon: '⛏️',
    floors: 5,
  },
  {
    id: 'dragon-lair',
    name: 'Dragon\'s Lair',
    x: 2400, y: 1000,
    zoneId: 4,
    requiredLevel: 12,
    description: 'The entrance to a dragon\'s underground lair. Heat radiates from within.',
    difficulty: 'hard',
    icon: '🐉',
    floors: 5,
  },
  {
    id: 'catacombs',
    name: 'Catacombs',
    x: 6200, y: 900,
    zoneId: 5,
    requiredLevel: 13,
    description: 'Ancient catacombs stretching deep beneath the crypts.',
    difficulty: 'hard',
    icon: '💀',
    floors: 6,
  },
  {
    id: 'volcanic-caldera',
    name: 'Volcanic Caldera',
    x: 1200, y: 6800,
    zoneId: 6,
    requiredLevel: 16,
    description: 'A descent into the molten heart of the volcano.',
    difficulty: 'heroic',
    icon: '🌋',
    floors: 7,
  },
  {
    id: 'titan-vault',
    name: 'Titan\'s Vault',
    x: 6200, y: 6200,
    zoneId: 7,
    requiredLevel: 19,
    description: 'A sealed vault where ancient titans were imprisoned.',
    difficulty: 'heroic',
    icon: '🗿',
    floors: 8,
  },
  {
    id: 'pirate-grotto',
    name: 'Pirate Grotto',
    x: 14200, y: 9600,
    zoneId: 11,
    requiredLevel: 7,
    description: 'A hidden sea cave filled with pirate treasure and traps.',
    difficulty: 'normal',
    icon: '🏴‍☠️',
    floors: 3,
  },
  {
    id: 'dungeon-depths',
    name: 'The Deep Descent',
    x: 10500, y: 11200,
    zoneId: 12,
    requiredLevel: 15,
    description: 'The deepest level of the dungeon complex. No light reaches here.',
    difficulty: 'heroic',
    icon: '🕸️',
    floors: 10,
  },
  {
    id: 'piglin-warren',
    name: 'Piglin Warren',
    x: 6800, y: 11600,
    zoneId: 15,
    requiredLevel: 19,
    description: 'The underground tunnels beneath the piglin outpost.',
    difficulty: 'heroic',
    icon: '🐗',
    floors: 8,
  },
];

export function getDungeonEntrancesInZone(zoneId: number): DungeonEntrance[] {
  return DUNGEON_ENTRANCES.filter(d => d.zoneId === zoneId);
}

export function getDungeonEntranceNear(x: number, y: number, range: number): DungeonEntrance | null {
  for (const d of DUNGEON_ENTRANCES) {
    const dx = d.x - x, dy = d.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < range) return d;
  }
  return null;
}

// ── Roads (connections rendered as paths between zones) ────────

export interface RoadSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;      // road width in world units
  type: 'dirt' | 'stone' | 'bridge';
}

function zoneCenter(id: number): { x: number; y: number } {
  const z = ISLAND_ZONES.find(z => z.id === id);
  if (!z) return { x: 0, y: 0 };
  return { x: z.bounds.x + z.bounds.w / 2, y: z.bounds.y + z.bounds.h / 2 };
}

// Auto-generate roads from zone connections
export const ZONE_ROADS: RoadSegment[] = (() => {
  const roads: RoadSegment[] = [];
  const seen = new Set<string>();

  for (const zone of ISLAND_ZONES) {
    const from = zoneCenter(zone.id);
    for (const connId of zone.connectedZoneIds) {
      const key = [Math.min(zone.id, connId), Math.max(zone.id, connId)].join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      const to = zoneCenter(connId);
      const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
      roads.push({
        from, to,
        width: dist > 4000 ? 60 : 40,
        type: dist > 5000 ? 'bridge' : zone.terrainType === 'stone' ? 'stone' : 'dirt',
      });
    }
  }
  return roads;
})();

// ── Buildings (placed structures in zones for rendering) ───────

export interface BuildingPlacement {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zoneId: number;
  color: string;
  roofColor: string;
  type: 'fortress' | 'tower' | 'house' | 'shop' | 'wall' | 'dock' | 'ruin' | 'camp' | 'gate' | 'inn' | 'well' | 'mill';
}

// Auto-generate building placements from zone structureAssets
export const ZONE_BUILDINGS: BuildingPlacement[] = (() => {
  const buildings: BuildingPlacement[] = [];
  const BTYPE: Record<string, { type: BuildingPlacement['type']; w: number; h: number; color: string; roofColor: string }> = {
    fortress: { type: 'fortress', w: 120, h: 100, color: '#5a5040', roofColor: '#8a7050' },
    tower:    { type: 'tower', w: 40, h: 40, color: '#6a6050', roofColor: '#907060' },
    wall:     { type: 'wall', w: 80, h: 16, color: '#5a5a5a', roofColor: '#5a5a5a' },
    house:    { type: 'house', w: 50, h: 40, color: '#6a5030', roofColor: '#a06030' },
    shop:     { type: 'shop', w: 45, h: 35, color: '#5a6040', roofColor: '#7a9050' },
    barracks: { type: 'house', w: 70, h: 50, color: '#5a4a3a', roofColor: '#7a5a3a' },
    arsenal:  { type: 'shop', w: 60, h: 45, color: '#4a4a5a', roofColor: '#6a6a7a' },
    dock:     { type: 'dock', w: 80, h: 20, color: '#5a4030', roofColor: '#5a4030' },
    ship:     { type: 'dock', w: 60, h: 30, color: '#4a3020', roofColor: '#6a4030' },
    ruin:     { type: 'ruin', w: 50, h: 50, color: '#4a4040', roofColor: '#3a3030' },
    camp:     { type: 'camp', w: 30, h: 30, color: '#6a4020', roofColor: '#ff8c00' },
    gate:     { type: 'gate', w: 50, h: 24, color: '#5a5040', roofColor: '#8a7050' },
    inn:      { type: 'inn', w: 60, h: 50, color: '#6a5535', roofColor: '#a07040' },
    well:     { type: 'well', w: 20, h: 20, color: '#5a5a6a', roofColor: '#4a4a5a' },
    mill:     { type: 'mill', w: 50, h: 50, color: '#5a4a3a', roofColor: '#8a7a5a' },
  };

  for (const zone of ISLAND_ZONES) {
    if (!zone.structureAssets || zone.structureAssets.length === 0) continue;
    const b = zone.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    for (let i = 0; i < zone.structureAssets.length; i++) {
      const assetId = zone.structureAssets[i];
      // Determine building type from asset id
      let btype = BTYPE.house;
      if (assetId.includes('fortress')) btype = BTYPE.fortress;
      else if (assetId.includes('tower')) btype = BTYPE.tower;
      else if (assetId.includes('wall')) btype = BTYPE.wall;
      else if (assetId.includes('barracks') || assetId.includes('kazarm')) btype = BTYPE.barracks;
      else if (assetId.includes('arsenal') || assetId.includes('armory') || assetId.includes('ammourry')) btype = BTYPE.arsenal;
      else if (assetId.includes('gate')) btype = BTYPE.gate;
      else if (assetId.includes('dock')) btype = BTYPE.dock;
      else if (assetId.includes('ship')) btype = BTYPE.ship;
      else if (assetId.includes('ruin')) btype = BTYPE.ruin;
      else if (assetId.includes('brazier') || assetId.includes('fire') || assetId.includes('bonfire')) btype = BTYPE.camp;
      else if (assetId.includes('inn')) btype = BTYPE.inn;
      else if (assetId.includes('well')) btype = BTYPE.well;
      else if (assetId.includes('mill') || assetId.includes('sawmill')) btype = BTYPE.mill;
      else if (assetId.includes('house')) btype = BTYPE.house;
      else if (assetId.includes('market') || assetId.includes('shop')) btype = BTYPE.shop;

      // Place buildings in a pattern around zone center
      const angle = (i / zone.structureAssets.length) * Math.PI * 2;
      const radius = btype.type === 'fortress' ? 0 : 80 + i * 25;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;

      buildings.push({
        id: `${zone.id}-${assetId}`,
        name: assetId,
        x: Math.max(b.x + 30, Math.min(b.x + b.w - 30, px)),
        y: Math.max(b.y + 30, Math.min(b.y + b.h - 30, py)),
        w: btype.w,
        h: btype.h,
        zoneId: zone.id,
        color: btype.color,
        roofColor: btype.roofColor,
        type: btype.type,
      });
    }
  }
  return buildings;
})();

export function getBuildingsInZone(zoneId: number): BuildingPlacement[] {
  return ZONE_BUILDINGS.filter(b => b.zoneId === zoneId);
}

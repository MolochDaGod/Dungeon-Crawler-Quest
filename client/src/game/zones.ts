/**
 * Zone System — Albion-Style Independent Clusters
 *
 * Each zone is its own 16000×16000 map. Only ONE zone renders at a time.
 * Players transition between zones via exits at edges → loading → new zone.
 *
 * Layout (world map):
 *   [5: NW Wilds]     ←→  [1: Crusade Coast]  ←→  [6: NE Wilds]
 *        ↕                       ↕                       ↕
 *   [2: Fabled Shore]  ←→  [0: Travelers Town] ←→  [3: Legion Harbor]
 *        ↕                       ↕                       ↕
 *   [7: SW Wilds]     ←→  [4: Pirate Bay]     ←→  [8: SE Wilds]
 */

// ── Size ───────────────────────────────────────────────────────
/** Every zone is this size — all coords are zone-local (0..SIZE) */
export const OPEN_WORLD_SIZE = 16000;

const S = OPEN_WORLD_SIZE;
const H = S / 2;       // 8000 — center
const E = S - 200;     // 15800 — near edge

// ── Type Definitions ───────────────────────────────────────────

export interface ZoneSpawnPoint { x: number; y: number }

export interface MonsterSpawnDef {
  x: number; y: number;
  type: string; level: number; respawnTime: number; count: number;
}

/** Exit at zone edge — walk here to transition to another zone */
export interface ZoneExit {
  edge: 'north' | 'south' | 'east' | 'west';
  x: number; y: number; w: number; h: number;
  targetZoneId: number;
  spawnX: number; spawnY: number;
  label: string;
}

/** Named sub-area within a zone */
export interface SubZoneDef {
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  terrainType: string;
  safe: boolean;
  description: string;
}

/** Impassable water body — creates lanes */
export interface WaterLane {
  points: { x: number; y: number }[];
  type: 'river' | 'lake';
}

/** Impassable cliff/wall — creates choke points */
export interface CliffWall {
  from: { x: number; y: number };
  to: { x: number; y: number };
  thickness: number;
}

export interface DungeonEntrance {
  id: string; name: string;
  x: number; y: number;
  requiredLevel: number; description: string;
  difficulty: 'normal' | 'hard' | 'heroic';
  icon: string; floors: number;
}

export interface ZoneDef {
  id: number;
  name: string;
  bounds: { x: number; y: number; w: number; h: number };
  requiredLevel: number;
  isPvP: boolean;
  isSafeZone: boolean;
  terrainType: string;
  ambientColor: string;
  description: string;
  playerSpawns: ZoneSpawnPoint[];
  monsterSpawns: MonsterSpawnDef[];
  npcPositions: ZoneSpawnPoint[];
  exits: ZoneExit[];
  subZones: SubZoneDef[];
  waterLanes: WaterLane[];
  cliffWalls: CliffWall[];
  dungeons: DungeonEntrance[];
  assetPack?: string;
  structureAssets?: string[];
  islandType?: 'town' | 'port' | 'dungeon' | 'wilderness' | 'boss-arena' | 'village';
  dockSpawn?: { x: number; y: number };
  faction?: string;
  claimable?: boolean;
  connectedZoneIds: number[];
  portalPositions: { x: number; y: number; targetZoneId: number }[];
}

// ── Exit Helpers ───────────────────────────────────────────────

function exitN(tid: number, lbl: string): ZoneExit {
  return { edge: 'north', x: H - 400, y: 0, w: 800, h: 200, targetZoneId: tid, spawnX: H, spawnY: E, label: lbl };
}
function exitS(tid: number, lbl: string): ZoneExit {
  return { edge: 'south', x: H - 400, y: E, w: 800, h: 200, targetZoneId: tid, spawnX: H, spawnY: 200, label: lbl };
}
function exitW(tid: number, lbl: string): ZoneExit {
  return { edge: 'west', x: 0, y: H - 400, w: 200, h: 800, targetZoneId: tid, spawnX: E, spawnY: H, label: lbl };
}
function exitE(tid: number, lbl: string): ZoneExit {
  return { edge: 'east', x: E, y: H - 400, w: 200, h: 800, targetZoneId: tid, spawnX: 200, spawnY: H, label: lbl };
}

const FULL = { x: 0, y: 0, w: S, h: S };

// ── 9 Zone Definitions ─────────────────────────────────────────

export const ISLAND_ZONES: ZoneDef[] = [

  // 0: TRAVELERS TOWN — Center safe hub ─────────────────────────
  { id: 0, name: 'Travelers Town', bounds: FULL,
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#4a7a3a',
    description: 'The crossroads of the world. All factions meet here in peace.',
    playerSpawns: [{ x: H, y: H }, { x: H - 300, y: H - 300 }, { x: H + 300, y: H + 300 }],
    monsterSpawns: [],
    npcPositions: [
      { x: H - 500, y: H - 400 }, { x: H + 500, y: H - 400 }, { x: H, y: H - 800 },
      { x: H - 600, y: H + 400 }, { x: H + 600, y: H + 400 }, { x: H, y: H + 800 },
    ],
    exits: [ exitN(1, 'To Crusade Coast'), exitS(4, 'To Pirate Bay'), exitW(2, 'To Fabled Shore'), exitE(3, 'To Legion Harbor') ],
    subZones: [
      { name: 'Market Square', bounds: { x: H - 500, y: H - 500, w: 1000, h: 1000 }, terrainType: 'grass', safe: true, description: 'Small central marketplace.' },
      { name: 'Heroes Guild', bounds: { x: H - 200, y: H - 1200, w: 400, h: 400 }, terrainType: 'grass', safe: true, description: 'The Heroes Guild HQ.' },
      { name: 'Training Grounds', bounds: { x: H + 1200, y: H - 400, w: 800, h: 800 }, terrainType: 'dirt', safe: true, description: 'Practice arena.' },
      { name: 'Fishing Pond', bounds: { x: H - 2000, y: H + 1800, w: 800, h: 800 }, terrainType: 'water', safe: true, description: 'Peaceful fishing spot.' },
      { name: 'Farmland', bounds: { x: 2000, y: 2000, w: 1600, h: 1200 }, terrainType: 'grass', safe: true, description: 'Fertile fields.' },
      { name: 'Harbor District', bounds: { x: H - 600, y: E - 1200, w: 1200, h: 800 }, terrainType: 'water', safe: true, description: 'Docks connecting to all factions.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: H + 3000 }, { x: 3000, y: H + 2000 }, { x: H, y: H + 1500 }, { x: S - 3000, y: H + 2000 }, { x: S, y: H + 3000 }] },
      { type: 'lake', points: [{ x: H - 2500, y: H + 1800 }, { x: H - 1500, y: H + 1500 }, { x: H - 1000, y: H + 2500 }, { x: H - 2000, y: H + 3000 }, { x: H - 3000, y: H + 2500 }] },
    ],
    cliffWalls: [],
    dungeons: [
      { id: 'heroes-trial', name: 'Heroes Trial', x: H + 2500, y: H - 2000, requiredLevel: 1, description: 'Training dungeon for new adventurers.', difficulty: 'normal', icon: '⚔️', floors: 3 },
    ],
    islandType: 'town', connectedZoneIds: [1, 2, 3, 4], portalPositions: [],
  },

  // 1: CRUSADE COAST — Top, Human & Barbarian ───────────────────
  { id: 1, name: 'Crusade Coast', bounds: FULL,
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#5a7a3a',
    description: 'Northern fortress of the Crusade. Human & Barbarian heroes patrol.',
    playerSpawns: [{ x: H, y: H }, { x: H - 400, y: H + 400 }],
    monsterSpawns: [
      { x: 2000, y: 2000, type: 'Slime', level: 1, respawnTime: 30, count: 4 },
      { x: 5000, y: 3000, type: 'Skeleton', level: 3, respawnTime: 40, count: 3 },
      { x: 10000, y: 4000, type: 'Bandit', level: 4, respawnTime: 35, count: 4 },
      { x: 13000, y: 2000, type: 'Timber Wolf', level: 3, respawnTime: 35, count: 3 },
      { x: 3000, y: 12000, type: 'Spider', level: 2, respawnTime: 25, count: 4 },
      { x: 8000, y: 10000, type: 'Skeleton', level: 5, respawnTime: 45, count: 3 },
      { x: 12000, y: 12000, type: 'Bandit Chief', level: 8, respawnTime: 90, count: 1 },
      { x: 6000, y: 7000, type: 'Golem', level: 6, respawnTime: 60, count: 2 },
    ],
    npcPositions: [
      { x: H - 400, y: H - 300 }, { x: H + 400, y: H - 300 }, { x: H, y: H - 600 },
      { x: H - 600, y: H + 300 }, { x: H + 600, y: H + 300 },
    ],
    exits: [ exitS(0, 'To Travelers Town'), exitW(5, 'To NW Wilds'), exitE(6, 'To NE Wilds') ],
    subZones: [
      { name: 'Crusade Fortress', bounds: { x: H - 600, y: H - 600, w: 1200, h: 1200 }, terrainType: 'grass', safe: true, description: 'Main crusader stronghold.' },
      { name: 'Farmlands', bounds: { x: 2000, y: 2000, w: 2000, h: 1500 }, terrainType: 'grass', safe: false, description: 'Fertile farmland.' },
      { name: 'Cathedral Hill', bounds: { x: H + 500, y: 1500, w: 800, h: 800 }, terrainType: 'stone', safe: true, description: 'Holy cathedral.' },
      { name: 'Coastal Cliffs', bounds: { x: 500, y: H + 4000, w: S - 1000, h: 2000 }, terrainType: 'stone', safe: false, description: 'Sheer cliffs overlooking ocean.' },
      { name: 'Knights Field', bounds: { x: 10000, y: 2500, w: 1500, h: 1200 }, terrainType: 'dirt', safe: false, description: 'Knight training grounds.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: 6000 }, { x: 4000, y: 5500 }, { x: 8000, y: 6500 }, { x: 12000, y: 5800 }, { x: S, y: 6000 }] },
      { type: 'lake', points: [{ x: 11000, y: 7500 }, { x: 13000, y: 7000 }, { x: 14000, y: 8500 }, { x: 12500, y: 9500 }, { x: 10500, y: 9000 }] },
    ],
    cliffWalls: [
      { from: { x: 500, y: 13000 }, to: { x: 6000, y: 14000 }, thickness: 200 },
      { from: { x: 10000, y: 13500 }, to: { x: 15500, y: 13000 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'holy-catacombs', name: 'Holy Catacombs', x: H + 1000, y: 2000, requiredLevel: 3, description: 'Sacred burial chambers.', difficulty: 'normal', icon: '⛪', floors: 4 },
      { id: 'abandoned-mine', name: 'Abandoned Mine', x: 3000, y: 10000, requiredLevel: 6, description: 'Mine overrun by spiders and golems.', difficulty: 'hard', icon: '⛏️', floors: 5 },
    ],
    assetPack: 'crusadetown',
    structureAssets: ['ct-fortress','ct-tower-01','ct-tower-03','ct-tower-05','ct-wall-01','ct-wall-02','ct-bridge','ct-barracks','ct-armory','ct-gates-1','ct-brazier','mv-inn','mv-blacksmith','mv-well'],
    islandType: 'town', dockSpawn: { x: H, y: H + 400 }, faction: 'Crusade',
    connectedZoneIds: [0, 5, 6], portalPositions: [],
  },

  // 2: FABLED SHORE — Left, Elf & Dwarf ─────────────────────────
  { id: 2, name: 'Fabled Shore', bounds: FULL,
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'grass', ambientColor: '#3a6a6a',
    description: 'Western coast ruled by Elves & Dwarves. Ancient temples overlook the sea.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 3000, y: 3000, type: 'Spider', level: 2, respawnTime: 30, count: 3 },
      { x: 12000, y: 5000, type: 'Treant', level: 4, respawnTime: 50, count: 2 },
      { x: 5000, y: 11000, type: 'Harpy', level: 3, respawnTime: 35, count: 3 },
      { x: 10000, y: 8000, type: 'Golem', level: 5, respawnTime: 60, count: 2 },
      { x: 2000, y: 8000, type: 'Spider', level: 4, respawnTime: 30, count: 4 },
      { x: 13000, y: 13000, type: 'Treant', level: 6, respawnTime: 50, count: 2 },
    ],
    npcPositions: [
      { x: H, y: H - 400 }, { x: H - 500, y: H + 300 }, { x: H + 500, y: H + 300 },
      { x: H - 300, y: H - 700 }, { x: H + 300, y: H + 700 },
    ],
    exits: [ exitE(0, 'To Travelers Town'), exitN(5, 'To NW Wilds'), exitS(7, 'To SW Wilds') ],
    subZones: [
      { name: 'Fabled Citadel', bounds: { x: H - 600, y: H - 600, w: 1200, h: 1200 }, terrainType: 'grass', safe: true, description: 'Elven-dwarven citadel of wisdom.' },
      { name: 'Crystal Groves', bounds: { x: 1000, y: 1000, w: 5000, h: 4000 }, terrainType: 'jungle', safe: false, description: 'Enchanted groves with crystals.' },
      { name: 'Ancient Library', bounds: { x: 10000, y: 2000, w: 3000, h: 2500 }, terrainType: 'stone', safe: true, description: 'Arcane knowledge repository.' },
      { name: 'Waterfall Lake', bounds: { x: 2000, y: 10000, w: 4000, h: 4000 }, terrainType: 'water', safe: false, description: 'Sacred lake with waterfalls.' },
      { name: 'Dwarven Mines', bounds: { x: 10000, y: 10000, w: 5000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Deep mines rich in ore.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 6000, y: 0 }, { x: 5500, y: 4000 }, { x: 4000, y: 8000 }, { x: 3500, y: 12000 }, { x: 5000, y: S }] },
      { type: 'lake', points: [{ x: 2500, y: 10500 }, { x: 5000, y: 10000 }, { x: 5500, y: 12500 }, { x: 3500, y: 13500 }, { x: 1500, y: 12000 }] },
    ],
    cliffWalls: [
      { from: { x: 7000, y: 3000 }, to: { x: 7000, y: 7000 }, thickness: 150 },
      { from: { x: 9000, y: 9000 }, to: { x: 14000, y: 8000 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'elven-ruins', name: 'Elven Ruins', x: 3000, y: 3000, requiredLevel: 4, description: 'Collapsed elven temple with ancient magic.', difficulty: 'normal', icon: '🏛️', floors: 4 },
      { id: 'arcane-depths', name: 'Arcane Depths', x: 11000, y: 3000, requiredLevel: 8, description: 'Reality-warping dungeon beneath the library.', difficulty: 'hard', icon: '🔮', floors: 6 },
    ],
    assetPack: 'fabledtown',
    structureAssets: ['ft-fortress','ft-tower-1','ft-tower-3','ft-tower-5','ft-wall-1','ft-bridge','ft-arsenal','ft-barracks','ft-brazier','mv-inn','mv-mill','mv-gazebo'],
    islandType: 'town', dockSpawn: { x: H + 400, y: H }, faction: 'Fabled',
    connectedZoneIds: [0, 5, 7], portalPositions: [],
  },

  // 3: LEGION HARBOR — Right, Orc & Undead ──────────────────────
  { id: 3, name: 'Legion Harbor', bounds: FULL,
    requiredLevel: 1, isPvP: false, isSafeZone: true,
    terrainType: 'stone', ambientColor: '#4a3a5a',
    description: 'Eastern dark harbor of the Legion. Orc & Undead heroes guard.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 4000, y: 3000, type: 'Wraith', level: 3, respawnTime: 40, count: 2 },
      { x: 12000, y: 5000, type: 'Dark Archer', level: 4, respawnTime: 45, count: 3 },
      { x: 3000, y: 10000, type: 'Orc Grunt', level: 3, respawnTime: 35, count: 4 },
      { x: 10000, y: 12000, type: 'Skeleton', level: 5, respawnTime: 30, count: 5 },
      { x: 6000, y: 6000, type: 'Golem', level: 6, respawnTime: 60, count: 2 },
      { x: 14000, y: 3000, type: 'Necromancer', level: 7, respawnTime: 50, count: 2 },
    ],
    npcPositions: [
      { x: H, y: H - 400 }, { x: H - 500, y: H + 300 }, { x: H + 500, y: H + 300 },
      { x: H - 300, y: H - 700 }, { x: H + 300, y: H + 700 },
    ],
    exits: [ exitW(0, 'To Travelers Town'), exitN(6, 'To NE Wilds'), exitS(8, 'To SE Wilds') ],
    subZones: [
      { name: 'Legion Fortress', bounds: { x: H - 700, y: H - 600, w: 1400, h: 1200 }, terrainType: 'stone', safe: true, description: 'The dark fortress.' },
      { name: 'War Forge', bounds: { x: 10000, y: 2000, w: 4000, h: 3000 }, terrainType: 'stone', safe: false, description: 'Orcish weapons forged in lava.' },
      { name: 'Undead Crypts', bounds: { x: 2000, y: 10000, w: 4000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Where the dead rise.' },
      { name: 'Bone Wastes', bounds: { x: 8000, y: 10000, w: 6000, h: 4000 }, terrainType: 'dirt', safe: false, description: 'Barren bone-littered fields.' },
      { name: 'Dark Harbor', bounds: { x: 1000, y: 1000, w: 5000, h: 3000 }, terrainType: 'water', safe: true, description: 'Legion docks.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: 5000 }, { x: 4000, y: 5500 }, { x: 8000, y: 4500 }, { x: 12000, y: 5000 }, { x: S, y: 4800 }] },
    ],
    cliffWalls: [
      { from: { x: 2000, y: 7000 }, to: { x: 6000, y: 7500 }, thickness: 200 },
      { from: { x: 8000, y: 8000 }, to: { x: 8000, y: 13000 }, thickness: 180 },
    ],
    dungeons: [
      { id: 'dark-forge', name: 'Dark Forge', x: 12000, y: 3000, requiredLevel: 5, description: 'Underground forge with lava channels.', difficulty: 'hard', icon: '🔥', floors: 5 },
      { id: 'bone-pit', name: 'Bone Pit', x: 3000, y: 12000, requiredLevel: 8, description: 'Mass grave leading to an underground necropolis.', difficulty: 'hard', icon: '💀', floors: 6 },
    ],
    assetPack: 'legiontown',
    structureAssets: ['lt-fortress','lt-tower-01','lt-tower-3','lt-tower-5','lt-wall-1','lt-bridge','lt-barracks','lt-arsenal','lt-drum','lt-brazier','os-tavern','os-smithy'],
    islandType: 'town', dockSpawn: { x: H - 400, y: H }, faction: 'Legion',
    connectedZoneIds: [0, 6, 8], portalPositions: [],
  },

  // 4: PIRATE BAY — Bottom, Pirates (PvP) ───────────────────────
  { id: 4, name: 'Pirate Bay', bounds: FULL,
    requiredLevel: 1, isPvP: true, isSafeZone: false,
    terrainType: 'water', ambientColor: '#1a4a6a',
    description: 'Southern pirate stronghold. Lawless PvP waters.',
    playerSpawns: [{ x: H, y: 2000 }],
    monsterSpawns: [
      { x: 3000, y: 3000, type: 'Bandit', level: 3, respawnTime: 30, count: 4 },
      { x: 12000, y: 4000, type: 'Spider', level: 4, respawnTime: 35, count: 3 },
      { x: 5000, y: 10000, type: 'Sea Serpent', level: 6, respawnTime: 120, count: 1 },
      { x: 8000, y: 8000, type: 'Skeleton', level: 4, respawnTime: 30, count: 4 },
      { x: 13000, y: 10000, type: 'Bandit Chief', level: 8, respawnTime: 90, count: 1 },
      { x: 2000, y: 13000, type: 'Sea Serpent', level: 8, respawnTime: 120, count: 1 },
      { x: 10000, y: 14000, type: 'Spider', level: 5, respawnTime: 30, count: 5 },
    ],
    npcPositions: [{ x: H - 400, y: 1500 }, { x: H + 400, y: 1500 }, { x: H, y: 2500 }],
    exits: [ exitN(0, 'To Travelers Town'), exitW(7, 'To SW Wilds'), exitE(8, 'To SE Wilds') ],
    subZones: [
      { name: 'Pirate Docks', bounds: { x: H - 3000, y: 500, w: 6000, h: 3000 }, terrainType: 'water', safe: false, description: 'Chaotic pirate berths.' },
      { name: 'Smuggler Beach', bounds: { x: 1000, y: 4000, w: 5000, h: 3000 }, terrainType: 'water', safe: false, description: 'Hidden smuggling beach.' },
      { name: 'Shipwreck Cove', bounds: { x: 9000, y: 5000, w: 5000, h: 4000 }, terrainType: 'water', safe: false, description: 'Sunken ship graveyard.' },
      { name: 'Palm Jungle', bounds: { x: 2000, y: 9000, w: 6000, h: 5000 }, terrainType: 'jungle', safe: false, description: 'Tropical jungle with pirate camps.' },
      { name: 'PvP Arena', bounds: { x: 10000, y: 10000, w: 4000, h: 4000 }, terrainType: 'dirt', safe: false, description: 'Open fighting grounds. No rules.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: 8000 }, { x: 4000, y: 7500 }, { x: 8000, y: 8500 }, { x: 12000, y: 7800 }, { x: S, y: 8000 }] },
      { type: 'lake', points: [{ x: 9500, y: 5500 }, { x: 13000, y: 5000 }, { x: 14000, y: 7500 }, { x: 11000, y: 8500 }, { x: 9000, y: 7000 }] },
    ],
    cliffWalls: [{ from: { x: 6500, y: 5000 }, to: { x: 6500, y: 10000 }, thickness: 150 }],
    dungeons: [
      { id: 'sunken-temple', name: 'Sunken Temple', x: 11000, y: 6000, requiredLevel: 5, description: 'Half-submerged ancient temple.', difficulty: 'normal', icon: '🌊', floors: 4 },
      { id: 'sea-cave', name: 'Sea Cave', x: 2000, y: 6000, requiredLevel: 8, description: 'Dark cave behind the waterfall.', difficulty: 'hard', icon: '🏴‍☠️', floors: 5 },
    ],
    assetPack: 'pirate-kit',
    structureAssets: ['pk-ship-large','pk-ship-small','pk-dock','pk-dock-broken','pk-house-1','pk-house-2','pk-cannon','pk-barrel','pk-anchor','pk-palm-1','pk-palm-2'],
    islandType: 'port', dockSpawn: { x: H, y: 1500 }, faction: 'Pirates',
    connectedZoneIds: [0, 7, 8], portalPositions: [],
  },

  // 5: NW WILDS — Claimable jungle ──────────────────────────────
  { id: 5, name: 'Northwest Wilds', bounds: FULL,
    requiredLevel: 3, isPvP: true, isSafeZone: false,
    terrainType: 'jungle', ambientColor: '#1a4a12',
    description: 'Dense untamed forest. Crews can claim territory. Rich in logging & herbalism.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 2000, y: 2000, type: 'Slime', level: 2, respawnTime: 30, count: 5 },
      { x: 6000, y: 3000, type: 'Spider', level: 4, respawnTime: 25, count: 4 },
      { x: 3000, y: 8000, type: 'Treant', level: 5, respawnTime: 60, count: 2 },
      { x: 10000, y: 5000, type: 'Timber Wolf', level: 4, respawnTime: 35, count: 4 },
      { x: 5000, y: 12000, type: 'Goblin Shaman', level: 6, respawnTime: 50, count: 2 },
      { x: 12000, y: 10000, type: 'Cave Bear', level: 7, respawnTime: 60, count: 2 },
      { x: H, y: H, type: 'Dragon', level: 10, respawnTime: 120, count: 1 },
      { x: 14000, y: 2000, type: 'Dire Wolf', level: 5, respawnTime: 40, count: 3 },
      { x: 2000, y: 14000, type: 'Treant', level: 8, respawnTime: 60, count: 2 },
    ],
    npcPositions: [{ x: H + 500, y: H + 500 }],
    exits: [ exitE(1, 'To Crusade Coast'), exitS(2, 'To Fabled Shore') ],
    subZones: [
      { name: 'Deep Canopy', bounds: { x: 1000, y: 1000, w: 6000, h: 6000 }, terrainType: 'jungle', safe: false, description: 'Thickest forest. Spider nests.' },
      { name: 'Treant Grove', bounds: { x: 2000, y: 8000, w: 4000, h: 4000 }, terrainType: 'jungle', safe: false, description: 'Sacred walking tree grove.' },
      { name: 'Wolf Territory', bounds: { x: 8000, y: 3000, w: 6000, h: 5000 }, terrainType: 'grass', safe: false, description: 'Wolf pack clearings.' },
      { name: 'Dragon Hollow', bounds: { x: H - 2000, y: H - 2000, w: 4000, h: 4000 }, terrainType: 'dirt', safe: false, description: 'Dragon\'s territory.' },
      { name: 'Hidden Clearing', bounds: { x: 10000, y: 10000, w: 4000, h: 4000 }, terrainType: 'grass', safe: false, description: 'Good spot for a claim flag.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: H }, { x: 4000, y: H - 1000 }, { x: 8000, y: H + 500 }, { x: 12000, y: H - 500 }, { x: S, y: H }] },
      { type: 'river', points: [{ x: H, y: 0 }, { x: H + 1000, y: 4000 }, { x: H - 500, y: 8000 }, { x: H + 500, y: 12000 }, { x: H, y: S }] },
    ],
    cliffWalls: [
      { from: { x: 1000, y: 6500 }, to: { x: 4000, y: 6000 }, thickness: 180 },
      { from: { x: 10000, y: 9000 }, to: { x: 14000, y: 9500 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'forest-crypt', name: 'Forest Crypt', x: 3000, y: 4000, requiredLevel: 3, description: 'Crypt among ancient tree roots.', difficulty: 'normal', icon: '🏚️', floors: 3 },
      { id: 'spider-den', name: 'Spider Den', x: 5000, y: 2000, requiredLevel: 6, description: 'Web-choked cavern of giant spiders.', difficulty: 'hard', icon: '🕷️', floors: 5 },
    ],
    islandType: 'wilderness', claimable: true,
    connectedZoneIds: [1, 2], portalPositions: [],
  },

  // 6: NE WILDS — Claimable mountains ───────────────────────────
  { id: 6, name: 'Northeast Wilds', bounds: FULL,
    requiredLevel: 5, isPvP: true, isSafeZone: false,
    terrainType: 'stone', ambientColor: '#5a5a6a',
    description: 'Treacherous mountain crags. Mining nodes and ancient ruins.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 3000, y: 3000, type: 'Golem', level: 6, respawnTime: 60, count: 2 },
      { x: 10000, y: 3000, type: 'Bandit', level: 5, respawnTime: 35, count: 4 },
      { x: 5000, y: 8000, type: 'Skeleton', level: 7, respawnTime: 45, count: 3 },
      { x: 12000, y: 8000, type: 'Dark Archer', level: 8, respawnTime: 40, count: 3 },
      { x: 7000, y: 12000, type: 'Corrupted Knight', level: 10, respawnTime: 55, count: 2 },
      { x: H, y: H, type: 'Bandit Chief', level: 10, respawnTime: 90, count: 1 },
      { x: 2000, y: 13000, type: 'Iron Sentinel', level: 12, respawnTime: 60, count: 1 },
    ],
    npcPositions: [],
    exits: [ exitW(1, 'To Crusade Coast'), exitS(3, 'To Legion Harbor') ],
    subZones: [
      { name: 'Frozen Peaks', bounds: { x: 1000, y: 1000, w: 6000, h: 5000 }, terrainType: 'stone', safe: false, description: 'Snow-capped peaks.' },
      { name: 'Bandit Fortress', bounds: { x: 9000, y: 2000, w: 5000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Fortified bandit stronghold.' },
      { name: 'Crystal Mines', bounds: { x: 2000, y: 8000, w: 5000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Rich crystal and ore veins.' },
      { name: 'Golem Valley', bounds: { x: 8000, y: 9000, w: 6000, h: 5000 }, terrainType: 'dirt', safe: false, description: 'Ancient stone golems patrol.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: 7000 }, { x: 5000, y: 6500 }, { x: 10000, y: 7500 }, { x: S, y: 7000 }] },
    ],
    cliffWalls: [
      { from: { x: 7000, y: 1000 }, to: { x: 7500, y: 6000 }, thickness: 250 },
      { from: { x: 3000, y: 11000 }, to: { x: 8000, y: 11500 }, thickness: 200 },
      { from: { x: 12000, y: 10000 }, to: { x: 15000, y: 12000 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'frozen-cavern', name: 'Frozen Cavern', x: 3000, y: 3000, requiredLevel: 6, description: 'Ice cavern with frost wyrms.', difficulty: 'hard', icon: '❄️', floors: 5 },
      { id: 'bandit-stronghold', name: 'Bandit Stronghold', x: 11000, y: 3000, requiredLevel: 9, description: 'Underground bandit fortress.', difficulty: 'hard', icon: '🏰', floors: 6 },
    ],
    assetPack: 'stone-terrain',
    structureAssets: ['st-big-1','st-big-2','st-big-3','st-lit-1','st-lit-2','mn-mine-1','mn-mine-2','mn-coal','mn-gold-1'],
    islandType: 'wilderness', claimable: true,
    connectedZoneIds: [1, 3], portalPositions: [],
  },

  // 7: SW WILDS — Claimable volcanic ────────────────────────────
  { id: 7, name: 'Southwest Wilds', bounds: FULL,
    requiredLevel: 8, isPvP: true, isSafeZone: false,
    terrainType: 'dirt', ambientColor: '#5a2010',
    description: 'Volcanic badlands. Rich in rare ores. Crews battle for control.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 3000, y: 3000, type: 'Berserker', level: 10, respawnTime: 45, count: 3 },
      { x: 10000, y: 3000, type: 'Dragon', level: 12, respawnTime: 90, count: 1 },
      { x: 4000, y: 10000, type: 'Fire Drake', level: 11, respawnTime: 80, count: 2 },
      { x: 12000, y: 8000, type: 'Infernal Colossus', level: 15, respawnTime: 180, count: 1 },
      { x: 6000, y: 13000, type: 'Piglin Grunt', level: 10, respawnTime: 30, count: 4 },
      { x: H, y: H, type: 'Piglin Brute', level: 12, respawnTime: 45, count: 2 },
      { x: 2000, y: 7000, type: 'Tentacle Horror', level: 11, respawnTime: 50, count: 2 },
      { x: 14000, y: 14000, type: 'Boar Dragon', level: 14, respawnTime: 120, count: 1 },
    ],
    npcPositions: [],
    exits: [ exitN(2, 'To Fabled Shore'), exitE(4, 'To Pirate Bay') ],
    subZones: [
      { name: 'Lava Fields', bounds: { x: 1000, y: 1000, w: 6000, h: 5000 }, terrainType: 'dirt', safe: false, description: 'Cracked earth with lava beneath.' },
      { name: 'Obsidian Cliffs', bounds: { x: 8000, y: 2000, w: 6000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Black cliffs with dragon nests.' },
      { name: 'Piglin Camp', bounds: { x: 4000, y: 10000, w: 5000, h: 4000 }, terrainType: 'dirt', safe: false, description: 'Fortified piglin war camp.' },
      { name: 'Fire Drake Nests', bounds: { x: 10000, y: 9000, w: 5000, h: 5000 }, terrainType: 'dirt', safe: false, description: 'Volcanic vents where drakes breed.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: 0, y: 6000 }, { x: 3000, y: 5000 }, { x: 7000, y: 6500 }, { x: 11000, y: 5500 }, { x: S, y: 6000 }] },
    ],
    cliffWalls: [
      { from: { x: 1000, y: 8000 }, to: { x: 5000, y: 8500 }, thickness: 250 },
      { from: { x: 8000, y: 7000 }, to: { x: 8500, y: 12000 }, thickness: 200 },
      { from: { x: 11000, y: 13000 }, to: { x: 15000, y: 13500 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'volcanic-caldera', name: 'Volcanic Caldera', x: 3000, y: 3000, requiredLevel: 10, description: 'Descent into the molten volcano heart.', difficulty: 'heroic', icon: '🌋', floors: 7 },
      { id: 'piglin-tunnels', name: 'Piglin Tunnels', x: 6000, y: 12000, requiredLevel: 12, description: 'Tunnel network beneath the piglin camp.', difficulty: 'heroic', icon: '🐗', floors: 6 },
    ],
    assetPack: 'volcano',
    structureAssets: ['vl-volcano-1','vl-volcano-2','vl-volcano-3','vl-boulder-1','vl-boulder-2','vl-boulder-3','of-fortress','of-tower-1','os-tent-1'],
    islandType: 'wilderness', claimable: true,
    connectedZoneIds: [2, 4], portalPositions: [],
  },

  // 8: SE WILDS — Claimable graveyard ───────────────────────────
  { id: 8, name: 'Southeast Wilds', bounds: FULL,
    requiredLevel: 12, isPvP: true, isSafeZone: false,
    terrainType: 'stone', ambientColor: '#2a1a2a',
    description: 'Ancient crypts & graveyards. Most dangerous claimable territory.',
    playerSpawns: [{ x: H, y: H }],
    monsterSpawns: [
      { x: 3000, y: 3000, type: 'Skeleton', level: 12, respawnTime: 30, count: 5 },
      { x: 10000, y: 3000, type: 'Necromancer', level: 14, respawnTime: 50, count: 2 },
      { x: 5000, y: 8000, type: 'Iron Sentinel', level: 15, respawnTime: 60, count: 2 },
      { x: 12000, y: 8000, type: 'Lich King', level: 18, respawnTime: 180, count: 1 },
      { x: 6000, y: 13000, type: 'Shadow Dragon', level: 20, respawnTime: 240, count: 1 },
      { x: H, y: H, type: 'Infernal Colossus', level: 22, respawnTime: 300, count: 1 },
      { x: 2000, y: 12000, type: 'Dark Archer', level: 13, respawnTime: 40, count: 4 },
      { x: 13000, y: 13000, type: 'Plague Rat Swarm', level: 12, respawnTime: 25, count: 6 },
      { x: 4000, y: 5000, type: 'Corrupted Knight', level: 14, respawnTime: 55, count: 3 },
    ],
    npcPositions: [],
    exits: [ exitN(3, 'To Legion Harbor'), exitW(4, 'To Pirate Bay') ],
    subZones: [
      { name: 'Bone Fields', bounds: { x: 1000, y: 1000, w: 6000, h: 5000 }, terrainType: 'dirt', safe: false, description: 'Fields of ancient bones.' },
      { name: 'Necromancer Towers', bounds: { x: 9000, y: 2000, w: 5000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Dark ritual spires.' },
      { name: 'Titan Graveyard', bounds: { x: H - 3000, y: H - 2000, w: 6000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Colossal titan skeletons.' },
      { name: 'Shadow Rift', bounds: { x: 3000, y: 10000, w: 5000, h: 4000 }, terrainType: 'stone', safe: false, description: 'Tear in reality.' },
      { name: 'Ancient Arena', bounds: { x: 10000, y: 10000, w: 4000, h: 4000 }, terrainType: 'stone', safe: false, description: 'World boss summoning colosseum.' },
    ],
    waterLanes: [
      { type: 'river', points: [{ x: H, y: 0 }, { x: H - 1000, y: 5000 }, { x: H + 500, y: 10000 }, { x: H, y: S }] },
    ],
    cliffWalls: [
      { from: { x: 1000, y: 7000 }, to: { x: 6000, y: 7500 }, thickness: 250 },
      { from: { x: 10000, y: 7000 }, to: { x: 15000, y: 7500 }, thickness: 200 },
      { from: { x: 3000, y: 14000 }, to: { x: 8000, y: 14500 }, thickness: 200 },
    ],
    dungeons: [
      { id: 'titans-vault', name: "Titan's Vault", x: H, y: H - 1000, requiredLevel: 16, description: 'Sealed vault of imprisoned titans. Hardest dungeon.', difficulty: 'heroic', icon: '🗿', floors: 8 },
      { id: 'lich-throne', name: 'Lich Throne', x: 10000, y: 3000, requiredLevel: 19, description: 'Lich King throne room. Only the strongest survive.', difficulty: 'heroic', icon: '👑', floors: 10 },
    ],
    assetPack: 'bossgraveyard',
    structureAssets: ['bg-ruin-1','bg-ruin-2','bg-ruin-3','bg-ruin-5','bg-ruin-8','bg-ruin-12','bg-ruin-15','md-torch','md-bones'],
    islandType: 'boss-arena', claimable: true,
    connectedZoneIds: [3, 4], portalPositions: [],
  },
];

// ── Zone Queries ───────────────────────────────────────────────

export function getZoneById(id: number): ZoneDef | null {
  return ISLAND_ZONES.find(z => z.id === id) ?? null;
}

export function getZoneAtPosition(x: number, y: number): ZoneDef | null {
  for (const zone of ISLAND_ZONES) {
    const b = zone.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return zone;
  }
  return null;
}

export function canEnterZone(playerLevel: number, zone: ZoneDef): boolean {
  return playerLevel >= zone.requiredLevel;
}

export function getActiveZones(): ZoneDef[] { return ISLAND_ZONES; }

export function getZoneColor(zone: ZoneDef): string {
  if (zone.isSafeZone) return '#22c55e';
  if (zone.isPvP) return '#ef4444';
  return '#f59e0b';
}

// ── Sub-Zone Queries ───────────────────────────────────────────

export function getSubZoneAtPosition(zone: ZoneDef, x: number, y: number): SubZoneDef | null {
  for (const sz of zone.subZones) {
    const b = sz.bounds;
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return sz;
  }
  return null;
}

// ── Zone Exit Detection ────────────────────────────────────────

export function checkZoneExit(zone: ZoneDef, px: number, py: number): ZoneExit | null {
  for (const exit of zone.exits) {
    if (px >= exit.x && px < exit.x + exit.w && py >= exit.y && py < exit.y + exit.h) return exit;
  }
  return null;
}

// ── Zone Tracker ───────────────────────────────────────────────

export interface ZoneTracker {
  currentZoneId: number | null;
  currentSubZone: string | null;
  previousZoneId: number | null;
  transitionTime: number;
}

export function createZoneTracker(): ZoneTracker {
  return { currentZoneId: null, currentSubZone: null, previousZoneId: null, transitionTime: 0 };
}

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

// ── Dungeon Queries ────────────────────────────────────────────

export function getDungeonEntrancesInZone(zoneId: number): DungeonEntrance[] {
  return getZoneById(zoneId)?.dungeons ?? [];
}

export function getDungeonEntranceNear(zone: ZoneDef, x: number, y: number, range: number): DungeonEntrance | null {
  for (const d of zone.dungeons) {
    const dx = d.x - x, dy = d.y - y;
    if (Math.sqrt(dx * dx + dy * dy) < range) return d;
  }
  return null;
}

export const DUNGEON_ENTRANCES: DungeonEntrance[] = ISLAND_ZONES.flatMap(z => z.dungeons);

// ── Roads ──────────────────────────────────────────────────────

export interface RoadSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
  type: 'dirt' | 'stone' | 'bridge';
}

export function generateZoneRoads(zone: ZoneDef): RoadSegment[] {
  const roads: RoadSegment[] = [];
  const szs = zone.subZones;
  if (szs.length < 2) return roads;
  for (let i = 0; i < szs.length - 1; i++) {
    const a = szs[i], b = szs[i + 1];
    roads.push({
      from: { x: a.bounds.x + a.bounds.w / 2, y: a.bounds.y + a.bounds.h / 2 },
      to: { x: b.bounds.x + b.bounds.w / 2, y: b.bounds.y + b.bounds.h / 2 },
      width: 40, type: zone.terrainType === 'stone' ? 'stone' : 'dirt',
    });
  }
  return roads;
}

export const ZONE_ROADS: RoadSegment[] = ISLAND_ZONES.flatMap(z => generateZoneRoads(z));

// ── Buildings ──────────────────────────────────────────────────

export interface BuildingPlacement {
  id: string; name: string;
  x: number; y: number; w: number; h: number;
  zoneId: number; color: string; roofColor: string;
  type: 'fortress' | 'tower' | 'house' | 'shop' | 'wall' | 'dock' | 'ruin' | 'camp' | 'gate' | 'inn' | 'well' | 'mill';
}

const _BT: Record<string, { type: BuildingPlacement['type']; w: number; h: number; color: string; roofColor: string }> = {
  fortress: { type: 'fortress', w: 120, h: 100, color: '#5a5040', roofColor: '#8a7050' },
  tower: { type: 'tower', w: 40, h: 40, color: '#6a6050', roofColor: '#907060' },
  wall: { type: 'wall', w: 80, h: 16, color: '#5a5a5a', roofColor: '#5a5a5a' },
  house: { type: 'house', w: 50, h: 40, color: '#6a5030', roofColor: '#a06030' },
  shop: { type: 'shop', w: 45, h: 35, color: '#5a6040', roofColor: '#7a9050' },
  dock: { type: 'dock', w: 80, h: 20, color: '#5a4030', roofColor: '#5a4030' },
  ruin: { type: 'ruin', w: 50, h: 50, color: '#4a4040', roofColor: '#3a3030' },
  camp: { type: 'camp', w: 30, h: 30, color: '#6a4020', roofColor: '#ff8c00' },
  gate: { type: 'gate', w: 50, h: 24, color: '#5a5040', roofColor: '#8a7050' },
  inn: { type: 'inn', w: 60, h: 50, color: '#6a5535', roofColor: '#a07040' },
  well: { type: 'well', w: 20, h: 20, color: '#5a5a6a', roofColor: '#4a4a5a' },
  mill: { type: 'mill', w: 50, h: 50, color: '#5a4a3a', roofColor: '#8a7a5a' },
};

function _classify(id: string) {
  for (const [k, v] of Object.entries(_BT)) { if (id.includes(k)) return v; }
  if (id.includes('ship')) return _BT.dock;
  if (id.includes('brazier') || id.includes('fire')) return _BT.camp;
  if (id.includes('market')) return _BT.shop;
  if (id.includes('barracks')) return _BT.house;
  if (id.includes('arsenal') || id.includes('armory')) return _BT.shop;
  return _BT.house;
}

export const ZONE_BUILDINGS: BuildingPlacement[] = (() => {
  const out: BuildingPlacement[] = [];
  for (const z of ISLAND_ZONES) {
    if (!z.structureAssets?.length) continue;
    for (let i = 0; i < z.structureAssets.length; i++) {
      const aid = z.structureAssets[i];
      const bt = _classify(aid);
      const angle = (i / z.structureAssets.length) * Math.PI * 2;
      const r = bt.type === 'fortress' ? 0 : 100 + i * 30;
      out.push({ id: `${z.id}-${aid}`, name: aid, x: H + Math.cos(angle) * r, y: H + Math.sin(angle) * r, w: bt.w, h: bt.h, zoneId: z.id, color: bt.color, roofColor: bt.roofColor, type: bt.type });
    }
  }
  return out;
})();

export function getBuildingsInZone(zoneId: number): BuildingPlacement[] {
  return ZONE_BUILDINGS.filter(b => b.zoneId === zoneId);
}

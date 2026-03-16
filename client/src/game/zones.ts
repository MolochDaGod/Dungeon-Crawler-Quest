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
}

// Open world expanded to 16000x16000 for island-based MMO with boats
export const OPEN_WORLD_SIZE = 16000;

export const ISLAND_ZONES: ZoneDef[] = [
  {
    id: 0,
    name: 'Starting Village',
    bounds: { x: 3500, y: 3500, w: 1000, h: 1000 },
    requiredLevel: 1,
    isPvP: false,
    isSafeZone: true,
    terrainType: 'grass',
    ambientColor: '#4a7a3a',
    description: 'A peaceful village where adventurers begin their journey.',
    playerSpawns: [{ x: 4000, y: 4000 }, { x: 3900, y: 3900 }, { x: 4100, y: 4050 }],
    monsterSpawns: [],
    connectedZoneIds: [1, 2, 3],
    npcPositions: [{ x: 3800, y: 3800 }, { x: 4100, y: 3700 }, { x: 3700, y: 4100 }],
    portalPositions: [],
  },
  {
    id: 1,
    name: 'Forest of Whispers',
    bounds: { x: 1500, y: 3000, w: 2000, h: 2000 },
    requiredLevel: 1,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'jungle',
    ambientColor: '#1a4a12',
    description: 'Dense woods teeming with creatures. Watch your step.',
    playerSpawns: [{ x: 2500, y: 4000 }],
    monsterSpawns: [
      { x: 2000, y: 3500, type: 'Slime', level: 1, respawnTime: 30, count: 3 },
      { x: 2500, y: 3200, type: 'Slime', level: 2, respawnTime: 30, count: 2 },
      { x: 1800, y: 4200, type: 'Skeleton', level: 3, respawnTime: 45, count: 2 },
      { x: 2200, y: 4500, type: 'Slime', level: 2, respawnTime: 30, count: 4 },
      { x: 3000, y: 3800, type: 'Skeleton', level: 4, respawnTime: 60, count: 2 },
    ],
    connectedZoneIds: [0, 2, 4],
    npcPositions: [{ x: 2500, y: 4800 }],
    portalPositions: [{ x: 1600, y: 4500, targetZoneId: 4 }],
  },
  {
    id: 2,
    name: 'Cursed Swamp',
    bounds: { x: 4500, y: 3000, w: 2000, h: 2000 },
    requiredLevel: 5,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'water',
    ambientColor: '#2a3a2a',
    description: 'A fetid swamp where the undead stir beneath murky waters.',
    playerSpawns: [{ x: 5500, y: 4000 }],
    monsterSpawns: [
      { x: 5000, y: 3500, type: 'Slime', level: 5, respawnTime: 30, count: 3 },
      { x: 5500, y: 3300, type: 'Skeleton', level: 6, respawnTime: 40, count: 3 },
      { x: 6000, y: 4000, type: 'Golem', level: 7, respawnTime: 60, count: 2 },
      { x: 5200, y: 4500, type: 'Skeleton', level: 8, respawnTime: 45, count: 3 },
      { x: 4800, y: 3800, type: 'Slime', level: 6, respawnTime: 30, count: 4 },
    ],
    connectedZoneIds: [0, 3, 5],
    npcPositions: [{ x: 4700, y: 3200 }],
    portalPositions: [{ x: 6200, y: 3500, targetZoneId: 5 }],
  },
  {
    id: 3,
    name: 'Mountain Pass',
    bounds: { x: 3000, y: 500, w: 2000, h: 2500 },
    requiredLevel: 8,
    isPvP: true,
    isSafeZone: false,
    terrainType: 'stone',
    ambientColor: '#5a5a6a',
    description: 'A treacherous mountain pass. PvP enabled — watch your back.',
    playerSpawns: [{ x: 4000, y: 1500 }],
    monsterSpawns: [
      { x: 3500, y: 1000, type: 'Golem', level: 8, respawnTime: 60, count: 2 },
      { x: 4200, y: 800, type: 'Dragon', level: 10, respawnTime: 90, count: 1 },
      { x: 3800, y: 2000, type: 'Skeleton', level: 9, respawnTime: 45, count: 3 },
      { x: 4500, y: 1500, type: 'Golem', level: 10, respawnTime: 60, count: 2 },
    ],
    connectedZoneIds: [0, 6, 7],
    npcPositions: [],
    portalPositions: [{ x: 4800, y: 600, targetZoneId: 7 }],
  },
  {
    id: 4,
    name: "Dragon's Reach",
    bounds: { x: 200, y: 500, w: 2800, h: 2500 },
    requiredLevel: 10,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'dirt',
    ambientColor: '#6a4a2a',
    description: 'Ancient dragon territory. Powerful beasts lurk in every crevice.',
    playerSpawns: [{ x: 1500, y: 2000 }],
    monsterSpawns: [
      { x: 800, y: 1200, type: 'Dragon', level: 10, respawnTime: 90, count: 1 },
      { x: 1500, y: 800, type: 'Dragon', level: 12, respawnTime: 90, count: 1 },
      { x: 2200, y: 1500, type: 'Golem', level: 11, respawnTime: 60, count: 2 },
      { x: 1000, y: 2200, type: 'Skeleton', level: 12, respawnTime: 45, count: 3 },
      { x: 2500, y: 900, type: 'Dragon', level: 14, respawnTime: 120, count: 1 },
    ],
    connectedZoneIds: [1],
    npcPositions: [{ x: 1500, y: 2800 }],
    portalPositions: [],
  },
  {
    id: 5,
    name: 'Undead Crypts',
    bounds: { x: 5500, y: 500, w: 2300, h: 2500 },
    requiredLevel: 12,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'stone',
    ambientColor: '#2a1a2a',
    description: 'Crumbling crypts filled with restless dead. High danger, high reward.',
    playerSpawns: [{ x: 6500, y: 2000 }],
    monsterSpawns: [
      { x: 6000, y: 1000, type: 'Skeleton', level: 12, respawnTime: 30, count: 4 },
      { x: 6800, y: 800, type: 'Skeleton', level: 14, respawnTime: 40, count: 3 },
      { x: 7200, y: 1500, type: 'Golem', level: 15, respawnTime: 60, count: 2 },
      { x: 5800, y: 1800, type: 'Skeleton', level: 13, respawnTime: 35, count: 5 },
      { x: 6500, y: 2500, type: 'Dragon', level: 16, respawnTime: 120, count: 1 },
    ],
    connectedZoneIds: [2],
    npcPositions: [{ x: 6500, y: 2800 }],
    portalPositions: [],
  },
  {
    id: 6,
    name: 'Volcano Rim',
    bounds: { x: 200, y: 5500, w: 3000, h: 2300 },
    requiredLevel: 15,
    isPvP: true,
    isSafeZone: false,
    terrainType: 'dirt',
    ambientColor: '#5a2010',
    description: 'The scorched rim of an active volcano. PvP zone — only the strong survive.',
    playerSpawns: [{ x: 1500, y: 6500 }],
    monsterSpawns: [
      { x: 800, y: 6000, type: 'Golem', level: 15, respawnTime: 60, count: 3 },
      { x: 1500, y: 7000, type: 'Dragon', level: 17, respawnTime: 90, count: 2 },
      { x: 2500, y: 6500, type: 'Dragon', level: 18, respawnTime: 120, count: 1 },
      { x: 1000, y: 7200, type: 'Golem', level: 16, respawnTime: 60, count: 3 },
    ],
    connectedZoneIds: [3],
    npcPositions: [],
    portalPositions: [{ x: 300, y: 7500, targetZoneId: 7 }],
  },
  {
    id: 7,
    name: 'Boss Arena',
    bounds: { x: 5000, y: 5500, w: 2800, h: 2300 },
    requiredLevel: 18,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'stone',
    ambientColor: '#3a0a0a',
    description: 'The final battleground. World bosses spawn here.',
    playerSpawns: [{ x: 6500, y: 6500 }],
    monsterSpawns: [
      { x: 6000, y: 6000, type: 'Golem', level: 18, respawnTime: 60, count: 3 },
      { x: 7000, y: 6500, type: 'Dragon', level: 20, respawnTime: 120, count: 1 },
      { x: 5500, y: 7000, type: 'Skeleton', level: 18, respawnTime: 40, count: 5 },
      { x: 6500, y: 7200, type: 'Dragon', level: 22, respawnTime: 180, count: 1 },
    ],
    connectedZoneIds: [3, 6, 8],
    npcPositions: [],
    portalPositions: [],
    assetPack: 'bossgraveyard',
    structureAssets: ['bg-ruin-1', 'bg-ruin-2', 'bg-ruin-3', 'bg-ruin-5', 'bg-ruin-8', 'bg-ruin-12', 'bg-ruin-15', 'bg-ruin-18', 'bg-ruin-21'],
    islandType: 'boss-arena',
  },

  // ── New Island Zones (expanded world) ────────────────────────

  {
    id: 8,
    name: 'Crusade Island',
    bounds: { x: 9000, y: 2000, w: 2500, h: 2500 },
    requiredLevel: 5,
    isPvP: false,
    isSafeZone: true,
    terrainType: 'grass',
    ambientColor: '#5a6a3a',
    description: 'A fortified crusader stronghold. Faction vendors and trainers reside here.',
    playerSpawns: [{ x: 10250, y: 3250 }],
    monsterSpawns: [],
    connectedZoneIds: [0, 9, 13],
    npcPositions: [
      { x: 10000, y: 3000 }, { x: 10500, y: 3000 }, { x: 10250, y: 2600 },
      { x: 9800, y: 3500 }, { x: 10700, y: 3500 },
    ],
    portalPositions: [{ x: 9200, y: 3200, targetZoneId: 0 }],
    assetPack: 'crusadetown',
    structureAssets: [
      'ct-fortress', 'ct-tower-01', 'ct-tower-03', 'ct-tower-05',
      'ct-wall-01', 'ct-wall-02', 'ct-bridge', 'ct-barracks', 'ct-armory',
      'ct-gates-1', 'ct-brazier', 'ct-firebell', 'ct-sentry',
    ],
    islandType: 'town',
  },
  {
    id: 9,
    name: 'Fabled Island',
    bounds: { x: 12000, y: 4000, w: 2500, h: 2500 },
    requiredLevel: 8,
    isPvP: false,
    isSafeZone: true,
    terrainType: 'grass',
    ambientColor: '#3a5a6a',
    description: 'A mystical island of ancient towers and arcane knowledge.',
    playerSpawns: [{ x: 13250, y: 5250 }],
    monsterSpawns: [],
    connectedZoneIds: [8, 10, 14],
    npcPositions: [
      { x: 13000, y: 5000 }, { x: 13500, y: 5000 }, { x: 13250, y: 4600 },
      { x: 12800, y: 5400 },
    ],
    portalPositions: [{ x: 12200, y: 5200, targetZoneId: 8 }],
    assetPack: 'fabledtown',
    structureAssets: [
      'ft-fortress', 'ft-tower-1', 'ft-tower-3', 'ft-tower-5',
      'ft-wall-1', 'ft-bridge', 'ft-arsenal', 'ft-barracks',
      'ft-brazier', 'ft-watchtower', 'ft-gates-1',
    ],
    islandType: 'town',
  },
  {
    id: 10,
    name: 'Legion Outpost',
    bounds: { x: 9000, y: 7000, w: 2500, h: 2500 },
    requiredLevel: 10,
    isPvP: false,
    isSafeZone: true,
    terrainType: 'stone',
    ambientColor: '#4a4a5a',
    description: 'A military legion outpost. War drums echo across the stone walls.',
    playerSpawns: [{ x: 10250, y: 8250 }],
    monsterSpawns: [],
    connectedZoneIds: [9, 11, 12],
    npcPositions: [
      { x: 10000, y: 8000 }, { x: 10500, y: 8000 }, { x: 10250, y: 7600 },
      { x: 9800, y: 8500 }, { x: 10700, y: 8400 },
    ],
    portalPositions: [{ x: 9200, y: 8200, targetZoneId: 7 }],
    assetPack: 'legiontown',
    structureAssets: [
      'lt-fortress', 'lt-tower-01', 'lt-tower-3', 'lt-tower-5',
      'lt-wall-1', 'lt-bridge', 'lt-barracks', 'lt-arsenal',
      'lt-drum', 'lt-brazier', 'lt-shed', 'lt-gates-1',
    ],
    islandType: 'town',
  },
  {
    id: 11,
    name: 'Pirate Cove',
    bounds: { x: 12500, y: 8000, w: 3000, h: 2500 },
    requiredLevel: 6,
    isPvP: true,
    isSafeZone: false,
    terrainType: 'water',
    ambientColor: '#1a3a5a',
    description: 'A lawless pirate port. Ships dock here. PvP zone — trust no one.',
    playerSpawns: [{ x: 14000, y: 9250 }],
    monsterSpawns: [
      { x: 13200, y: 8500, type: 'Skeleton', level: 6, respawnTime: 30, count: 3 },
      { x: 14500, y: 8800, type: 'Spider', level: 7, respawnTime: 35, count: 2 },
      { x: 13800, y: 9800, type: 'Skeleton', level: 8, respawnTime: 40, count: 3 },
      { x: 15000, y: 9500, type: 'Orc Grunt', level: 9, respawnTime: 50, count: 2 },
    ],
    connectedZoneIds: [10, 12],
    npcPositions: [
      { x: 14000, y: 9000 }, { x: 13500, y: 9200 },
    ],
    portalPositions: [],
    assetPack: 'pirate-kit',
    structureAssets: [
      'pk-ship-large', 'pk-ship-small', 'pk-dock', 'pk-dock-broken',
      'pk-house-1', 'pk-house-2', 'pk-house-3', 'pk-sawmill',
      'pk-cannon', 'pk-barrel', 'pk-chest-closed', 'pk-anchor',
      'pk-cliff-1', 'pk-cliff-2', 'pk-palm-1', 'pk-palm-2', 'pk-palm-3',
    ],
    islandType: 'port',
  },
  {
    id: 12,
    name: 'Dungeon Depths',
    bounds: { x: 9500, y: 11000, w: 2000, h: 2000 },
    requiredLevel: 14,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'stone',
    ambientColor: '#1a1a2a',
    description: 'An underground dungeon complex. Dangerous monsters guard ancient treasure.',
    playerSpawns: [{ x: 10500, y: 12000 }],
    monsterSpawns: [
      { x: 10000, y: 11500, type: 'Skeleton', level: 14, respawnTime: 30, count: 4 },
      { x: 10800, y: 11300, type: 'Dark Mage', level: 15, respawnTime: 45, count: 2 },
      { x: 10200, y: 12500, type: 'Golem', level: 16, respawnTime: 60, count: 2 },
      { x: 11000, y: 12200, type: 'Lich', level: 18, respawnTime: 120, count: 1 },
      { x: 10500, y: 11800, type: 'Skeleton', level: 15, respawnTime: 35, count: 5 },
    ],
    connectedZoneIds: [10, 11],
    npcPositions: [{ x: 10500, y: 12800 }],
    portalPositions: [{ x: 9600, y: 12000, targetZoneId: 10 }],
    assetPack: 'modular-dungeon',
    structureAssets: [
      'md-floor', 'md-wall', 'md-wall-top', 'md-column', 'md-column-broken',
      'md-entrance', 'md-stairs', 'md-barrel', 'md-bars', 'md-bones',
      'md-chest', 'md-chest-gold', 'md-torch', 'md-torch-wall',
      'md-candelabrum-tall', 'md-carpet', 'md-book-open',
    ],
    islandType: 'dungeon',
  },
  {
    id: 13,
    name: 'Graveyard of Titans',
    bounds: { x: 12500, y: 1000, w: 2500, h: 2500 },
    requiredLevel: 20,
    isPvP: false,
    isSafeZone: false,
    terrainType: 'dirt',
    ambientColor: '#2a1a1a',
    description: 'Ancient ruins where fallen titans rest. The most powerful bosses dwell here.',
    playerSpawns: [{ x: 13750, y: 2250 }],
    monsterSpawns: [
      { x: 13000, y: 1500, type: 'Golem', level: 20, respawnTime: 60, count: 3 },
      { x: 14000, y: 1800, type: 'Dragon', level: 22, respawnTime: 120, count: 1 },
      { x: 13500, y: 2500, type: 'Lich', level: 24, respawnTime: 150, count: 1 },
      { x: 14500, y: 2200, type: 'Dragon', level: 25, respawnTime: 180, count: 1 },
      { x: 13200, y: 3000, type: 'Golem', level: 22, respawnTime: 60, count: 4 },
    ],
    connectedZoneIds: [8, 14],
    npcPositions: [],
    portalPositions: [],
    assetPack: 'bossgraveyard',
    structureAssets: [
      'bg-ruin-1', 'bg-ruin-2', 'bg-ruin-3', 'bg-ruin-4', 'bg-ruin-5',
      'bg-ruin-6', 'bg-ruin-7', 'bg-ruin-8', 'bg-ruin-9', 'bg-ruin-10',
      'bg-ruin-11', 'bg-ruin-12', 'bg-ruin-13', 'bg-ruin-14', 'bg-ruin-15',
      'bg-ruin-16', 'bg-ruin-17', 'bg-ruin-18', 'bg-ruin-19', 'bg-ruin-20', 'bg-ruin-21',
    ],
    islandType: 'boss-arena',
  },
  {
    id: 14,
    name: 'Fisherman\'s Haven',
    bounds: { x: 14500, y: 2000, w: 1500, h: 1500 },
    requiredLevel: 3,
    isPvP: false,
    isSafeZone: true,
    terrainType: 'water',
    ambientColor: '#2a5a7a',
    description: 'A quiet fishing village with a blacksmith, inn, and market stalls.',
    playerSpawns: [{ x: 15250, y: 2750 }],
    monsterSpawns: [],
    connectedZoneIds: [9, 13],
    npcPositions: [
      { x: 15000, y: 2500 }, { x: 15400, y: 2500 }, { x: 15200, y: 2300 },
      { x: 14800, y: 2800 },
    ],
    portalPositions: [{ x: 14600, y: 2700, targetZoneId: 9 }],
    assetPack: 'medieval-village',
    structureAssets: [
      'mv-inn', 'mv-blacksmith', 'mv-house-1', 'mv-house-2', 'mv-house-3',
      'mv-stable', 'mv-mill', 'mv-bell-tower', 'mv-well', 'mv-gazebo',
      'mv-market-1', 'mv-market-2', 'mv-bonfire', 'mv-cart', 'mv-fence',
    ],
    islandType: 'village',
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

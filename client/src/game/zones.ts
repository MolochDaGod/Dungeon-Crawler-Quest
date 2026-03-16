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
}

// Open world is 8000x8000 to give room for 8 distinct zones
export const OPEN_WORLD_SIZE = 8000;

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
    connectedZoneIds: [3, 6],
    npcPositions: [],
    portalPositions: [],
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

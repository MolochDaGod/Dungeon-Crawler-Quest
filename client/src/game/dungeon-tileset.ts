/**
 * Dungeon Tileset Atlas — Sprite region definitions for the craftpix dungeon tileset.
 * Maps tile types to source rectangles in the spritesheets.
 *
 * Spritesheets:
 *   walls_floor.png (192×336, 16px grid = 12 cols × 21 rows)
 *   Under_walls.png (146×288)
 *   Objects.png (320×256, 16px grid = 20 cols × 16 rows)
 *   Chest_door_lever.png (96×208, 16px grid = 6 cols × 13 rows)
 *   Fire_animation.png (224×384, 32px grid = 7 cols × 12 rows)
 *   fire_trap.png (80×512, 16px grid = 5 cols × 32 rows)
 *   Spike_trap.png (48×288, 16px grid = 3 cols × 18 rows)
 *   Decorative_cracks.png (128×528)
 */

// ── Types ──────────────────────────────────────────────────────

export interface SpriteRegion {
  x: number; y: number;
  w: number; h: number;
}

export interface AnimatedRegion {
  frames: SpriteRegion[];
  frameDuration: number; // ms per frame
}

// ── Asset Paths ────────────────────────────────────────────────

export const DUNGEON_ASSETS = {
  wallsFloor:     '/assets/dungeon-tileset/PNG/walls_floor.png',
  underWalls:     '/assets/dungeon-tileset/PNG/Under_walls.png',
  cracks:         '/assets/dungeon-tileset/PNG/Decorative_cracks.png',
  objects:        '/assets/dungeon-tileset/PNG/Objects.png',
  chestDoorLever: '/assets/dungeon-tileset/PNG/Chest_door_lever.png',
  fire:           '/assets/dungeon-tileset/PNG/Fire_animation.png',
  fireTrap:       '/assets/dungeon-tileset/PNG/fire_trap.png',
  spikeTrap:      '/assets/dungeon-tileset/PNG/Spike_trap.png',
  latticeTrap:    '/assets/dungeon-tileset/PNG/lattice_trap.png',
  waterCoast:     '/assets/dungeon-tileset/PNG/Water_coasts_animation.png',
  waterfalls:     '/assets/dungeon-tileset/PNG/Waterfalls.png',
  fountain:       '/assets/dungeon-tileset/PNG/fountain_animation.png',
} as const;

export const TROPICAL_ASSETS = {
  bg:        '/assets/tropical-tileset/PNG/bg.png',
  lake:      '/assets/tropical-tileset/PNG/lake.png',
  // land_1 through land_18
  land: Array.from({ length: 18 }, (_, i) => `/assets/tropical-tileset/PNG/land_${i + 1}.png`),
  // road_1 through road_26
  road: Array.from({ length: 26 }, (_, i) => `/assets/tropical-tileset/PNG/road_${i + 1}.png`),
  // building_1 through building_5
  building: Array.from({ length: 5 }, (_, i) => `/assets/tropical-tileset/PNG/building_${i + 1}.png`),
  // tree_1 through tree_13
  tree: Array.from({ length: 13 }, (_, i) => `/assets/tropical-tileset/PNG/tree_${i + 1}.png`),
  // greenery_1 through greenery_10
  greenery: Array.from({ length: 10 }, (_, i) => `/assets/tropical-tileset/PNG/greenery_${i + 1}.png`),
  // stones_1 through stones_11
  stones: Array.from({ length: 11 }, (_, i) => `/assets/tropical-tileset/PNG/stones_${i + 1}.png`),
  // decor_1 through decor_7
  decor: Array.from({ length: 7 }, (_, i) => `/assets/tropical-tileset/PNG/decor_${i + 1}.png`),
} as const;

// ── Helper ─────────────────────────────────────────────────────

function gridR(col: number, row: number, cellW = 16, cellH = 16): SpriteRegion {
  return { x: col * cellW, y: row * cellH, w: cellW, h: cellH };
}

// ── walls_floor.png Atlas (12 cols × 21 rows, 16px cells) ─────

export const FLOOR_TILES: SpriteRegion[] = [
  gridR(0, 0), gridR(1, 0), gridR(2, 0), gridR(3, 0), // stone variants
  gridR(4, 0), gridR(5, 0), gridR(0, 1), gridR(1, 1), // more stone variants
];

// Wall autotile pieces — indexed by bitmask of neighbors (N=1, E=2, S=4, W=8)
// We define the most important configurations
export const WALL_TILES: Record<number, SpriteRegion> = {
  0:  gridR(6, 0),   // isolated wall
  1:  gridR(6, 1),   // N only
  2:  gridR(7, 0),   // E only
  3:  gridR(7, 1),   // N+E (corner)
  4:  gridR(6, 2),   // S only
  5:  gridR(6, 3),   // N+S (vertical)
  6:  gridR(7, 2),   // E+S (corner)
  7:  gridR(7, 3),   // N+E+S (T-junction)
  8:  gridR(8, 0),   // W only
  9:  gridR(8, 1),   // N+W (corner)
  10: gridR(8, 2),   // E+W (horizontal)
  11: gridR(8, 3),   // N+E+W (T-junction)
  12: gridR(9, 0),   // S+W (corner)
  13: gridR(9, 1),   // N+S+W (T-junction)
  14: gridR(9, 2),   // E+S+W (T-junction)
  15: gridR(9, 3),   // all sides (cross)
};

// Wall front face (the visible side when looking south)
export const WALL_FRONT: SpriteRegion[] = [
  gridR(0, 4), gridR(1, 4), gridR(2, 4), gridR(3, 4),
];

// ── Objects.png Atlas (20 cols × 16 rows, 16px cells) ──────────

export const OBJECTS = {
  // Chains (wall-mounted)
  chains:     [gridR(0, 0), gridR(1, 0), gridR(2, 0)],
  // Banners
  banners:    [gridR(3, 0), gridR(4, 0), gridR(5, 0)],
  // Crystals (ice/blue)
  crystals:   [gridR(0, 4), gridR(1, 4), gridR(2, 4), gridR(3, 4)],
  // Bones / skulls
  bones:      [gridR(6, 4), gridR(7, 4), gridR(8, 4), gridR(9, 4)],
  // Rubble / rocks
  rubble:     [gridR(10, 4), gridR(11, 4), gridR(12, 4)],
  // Barrels
  barrels:    [gridR(0, 6), gridR(1, 6)],
  // Tables / furniture
  tables:     [gridR(4, 6), gridR(5, 6)],
} as const;

// ── Chest_door_lever.png Atlas (6 cols × 13 rows, 16px) ────────

export const CHEST_DOOR = {
  // Chests: closed and open states
  chestClosed: gridR(0, 0),
  chestOpen:   gridR(1, 0),
  // Doors: closed and open
  doorClosed:  gridR(0, 3),
  doorOpen:    gridR(1, 3),
  // Lever: off and on
  leverOff:    gridR(0, 6),
  leverOn:     gridR(1, 6),
  // Stairs
  stairsDown:  gridR(0, 8),
  stairsUp:    gridR(1, 8),
} as const;

// ── Fire_animation.png (32px cells) ────────────────────────────

export const TORCH_ANIM: AnimatedRegion = {
  frames: Array.from({ length: 7 }, (_, i) => ({ x: i * 32, y: 0, w: 32, h: 32 })),
  frameDuration: 120,
};

export const TORCH_SMALL_ANIM: AnimatedRegion = {
  frames: Array.from({ length: 7 }, (_, i) => ({ x: i * 32, y: 32, w: 32, h: 32 })),
  frameDuration: 120,
};

export const FIRE_BLUE_ANIM: AnimatedRegion = {
  frames: Array.from({ length: 7 }, (_, i) => ({ x: i * 32, y: 64, w: 32, h: 32 })),
  frameDuration: 100,
};

// ── Trap Animations ────────────────────────────────────────────

// Spike trap: 3 cols × 18 rows at 16px. Retracted→extended cycle.
export const SPIKE_TRAP_ANIM: AnimatedRegion = {
  frames: Array.from({ length: 6 }, (_, i) => ({ x: 0, y: i * 48, w: 48, h: 48 })),
  frameDuration: 200,
};

// Fire trap: 5 cols × 32 rows at 16px
export const FIRE_TRAP_ANIM: AnimatedRegion = {
  frames: Array.from({ length: 8 }, (_, i) => ({ x: 0, y: i * 64, w: 80, h: 64 })),
  frameDuration: 150,
};

// ── Room Decoration Pools ──────────────────────────────────────
// Which objects to scatter in different room types

export const ROOM_DECOR: Record<string, { pool: SpriteRegion[]; chance: number; maxPerRoom: number }> = {
  normal:   { pool: [...OBJECTS.bones, ...OBJECTS.rubble, ...OBJECTS.barrels], chance: 0.3, maxPerRoom: 4 },
  treasure: { pool: [...OBJECTS.crystals, ...OBJECTS.barrels, ...OBJECTS.chains], chance: 0.5, maxPerRoom: 6 },
  boss:     { pool: [...OBJECTS.bones, ...OBJECTS.banners, ...OBJECTS.chains], chance: 0.4, maxPerRoom: 8 },
  shop:     { pool: [...OBJECTS.barrels, ...OBJECTS.tables], chance: 0.6, maxPerRoom: 5 },
  start:    { pool: [...OBJECTS.barrels, ...OBJECTS.tables], chance: 0.2, maxPerRoom: 2 },
};

// ── Autotile Bitmask Calculator ────────────────────────────────

/**
 * Calculate wall autotile bitmask from neighbor states.
 * N=1, E=2, S=4, W=8
 */
export function getWallBitmask(
  isWallN: boolean, isWallE: boolean,
  isWallS: boolean, isWallW: boolean,
): number {
  return (isWallN ? 1 : 0) | (isWallE ? 2 : 0) | (isWallS ? 4 : 0) | (isWallW ? 8 : 0);
}

// ── Image Loading Helper ───────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();

export function loadTilesetImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { imageCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

export function getTilesetImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null;
}

/** Preload all dungeon tileset images */
export async function preloadDungeonTilesets(): Promise<void> {
  const allPaths = Object.values(DUNGEON_ASSETS);
  await Promise.allSettled(allPaths.map(loadTilesetImage));
}

/**
 * Tileset System
 * Maps zone terrain types to tileset images for terrain, roads, buildings,
 * and decoration rendering in the 2D open-world mode.
 *
 * Primary asset packs (256×256 tiles):
 *   tropical-city  — land, road, buildings, decor
 *   house-constructor — 32px pixel house tiles
 *   castle-defense — 32px field/castle tiles
 *   river-creatures — animated water enemies
 *
 * Legacy 16px packs remain in public/assets/packs/tilesets/ for dungeons.
 */

const T = '/assets/packs/tilesets';
const TC = '/assets/packs/tropical-city';
const HC = '/assets/packs/house-constructor/tiles';
const CD = '/assets/packs/castle-defense/tiles';

// ── Types ──────────────────────────────────────────────────────

export interface TilesetEntry {
  id: string;
  name: string;
  /** Sprite sheet path for tiles */
  tilesheetPath: string;
  /** Optional separate objects/props sheet */
  objectsPath?: string;
  /** Optional water/animated tiles */
  waterPath?: string;
  /** Tile size in pixels (assumes square) */
  tileSize: number;
  /** Number of columns in the sprite sheet */
  columns: number;
}

export interface BiomeTileset {
  biome: string;
  ground: TilesetEntry;
  details?: TilesetEntry;
  water?: TilesetEntry;
}

/** Individual tile image path (not a sprite sheet) */
export interface TileImage {
  id: string;
  path: string;
  /** Native size in px (256 for tropical, 32 for pixel art) */
  nativeSize: number;
}

/** Building with layered component parts */
export interface BuildingDef {
  id: string;
  name: string;
  /** Ordered bottom-to-top component image paths */
  parts: string[];
  /** Approximate footprint in world tiles (w, h) */
  footprint: { w: number; h: number };
  /** Zone types this building suits */
  biomes: string[];
  /** Is this a town/safe-zone building? */
  isTown: boolean;
}

/** Decor / vegetation / prop definition */
export interface DecorDef {
  id: string;
  name: string;
  path: string;
  nativeSize: number;
  /** World draw size multiplier relative to RENDER_TILE */
  scale: number;
  /** Does it cast a shadow? */
  hasShadow: boolean;
  /** Collision radius (0 = walk-through) */
  collisionRadius: number;
  biomes: string[];
  category: 'tree' | 'stone' | 'greenery' | 'decor';
}

// ── Legacy Tileset Entries (dungeons) ──────────────────────────

export const DUNGEON_TILESET: TilesetEntry = {
  id: 'ts-dungeon-walls',
  name: 'Dungeon Walls & Floors',
  tilesheetPath: `${T}/dungeon/PNG/walls_floor.png`,
  objectsPath: `${T}/dungeon/PNG/other_objects.png`,
  waterPath: `${T}/dungeon/PNG/water_detilazation_v2.png`,
  tileSize: 16,
  columns: 16,
};

export const DUNGEON_PROPS_TILESET: TilesetEntry = {
  id: 'ts-dungeon-props',
  name: 'Dungeon Props',
  tilesheetPath: `${T}/dungeon/PNG/chest_lever.png`,
  objectsPath: `${T}/dungeon/PNG/torches.png`,
  tileSize: 16,
  columns: 8,
};

export const DUNGEON_TRAPS_TILESET: TilesetEntry = {
  id: 'ts-dungeon-traps',
  name: 'Dungeon Traps',
  tilesheetPath: `${T}/dungeon/PNG/Spikes.png`,
  objectsPath: `${T}/dungeon/PNG/dragon_trap.png`,
  tileSize: 16,
  columns: 8,
};

export const GRASSLAND_TILESET: TilesetEntry = {
  id: 'ts-grassland',
  name: 'Grassland Ground',
  tilesheetPath: `${T}/grassland/PNG/ground_grasss.png`,
  objectsPath: `${T}/grassland/PNG/Trees_rocks.png`,
  waterPath: `${T}/grassland/PNG/Water_coasts.png`,
  tileSize: 16,
  columns: 16,
};

export const GRASSLAND_DETAILS: TilesetEntry = {
  id: 'ts-grassland-details',
  name: 'Grassland Details',
  tilesheetPath: `${T}/grassland/PNG/Details.png`,
  tileSize: 16,
  columns: 16,
};

export const SWAMP_TILESET: TilesetEntry = {
  id: 'ts-swamp',
  name: 'Swamp Ground',
  tilesheetPath: `${T}/swamp/PNG/ground_grass.png`,
  objectsPath: `${T}/swamp/PNG/Objects.png`,
  waterPath: `${T}/swamp/PNG/water_coasts.png`,
  tileSize: 16,
  columns: 16,
};

export const ROAD_TILESET: TilesetEntry = {
  id: 'ts-roads',
  name: 'Roads & Paths',
  tilesheetPath: `${T}/roads/PNG_Tiled/Road1.png`,
  objectsPath: `${T}/roads/PNG_Tiled/Road2.png`,
  tileSize: 16,
  columns: 16,
};

export const ROAD_GRASS_TILESET: TilesetEntry = {
  id: 'ts-roads-grass',
  name: 'Roads on Grass',
  tilesheetPath: `${T}/roads/PNG_Tiled/Road1_grass.png`,
  objectsPath: `${T}/roads/PNG_Tiled/Ground_grass.png`,
  tileSize: 16,
  columns: 16,
};

export const RUINS_TILESET: TilesetEntry = {
  id: 'ts-ruins',
  name: 'Ruins & Rubble',
  tilesheetPath: `${T}/ruins/PNG/Assets_source.png`,
  objectsPath: `${T}/ruins/PNG/Assets_shadows_source.png`,
  tileSize: 16,
  columns: 16,
};

// ── Tropical Medieval City — Land Tiles (256×256 individual PNGs) ──
// Biome mapping based on visual inspection of the tileset reference images:
//   land_1-6: green grass, grass+dirt edges, grass fill
//   land_7-12: dirt/stone paths, cobblestone, mixed terrain
//   land_13-18: water edges, coastal, shallow water
//   land_19-22: deep terrain, cliffs, elevation
//   land_23-26: special tiles (cave entrance, ruins floor, transitions)

export const TROPICAL_LAND_TILES: TileImage[] = Array.from({ length: 26 }, (_, i) => ({
  id: `land-${i + 1}`,
  path: `${TC}/land/land_${i + 1}.png`,
  nativeSize: 256,
}));

/** Biome → which land tile indices to use for ground fill */
export const BIOME_LAND_INDICES: Record<string, number[]> = {
  grass:  [1, 2, 3, 4, 5, 6],
  jungle: [1, 2, 5, 6, 19, 20],
  dirt:   [7, 8, 9, 10, 11, 12],
  stone:  [10, 11, 12, 23, 24, 25],
  water:  [13, 14, 15, 16, 17, 18],
};

// ── Tropical Medieval City — Road Tiles ────────────────────────

export const TROPICAL_ROAD_TILES: TileImage[] = Array.from({ length: 17 }, (_, i) => ({
  id: `road-${i + 1}`,
  path: `${TC}/road/road_${i + 1}.png`,
  nativeSize: 256,
}));

/**
 * Road tile roles for auto-tiling connectivity:
 *   1-4: straight sections (H, V, H-wide, V-wide)
 *   5-8: corners (TL, TR, BL, BR)
 *   9-12: T-junctions (T-up, T-down, T-left, T-right)
 *   13: crossroad
 *   14-15: end-caps
 *   16-17: decorative variants
 */
export const ROAD_TILE_ROLES: Record<string, number> = {
  hStraight: 1, vStraight: 2, hWide: 3, vWide: 4,
  cornerTL: 5, cornerTR: 6, cornerBL: 7, cornerBR: 8,
  tUp: 9, tDown: 10, tLeft: 11, tRight: 12,
  cross: 13, endCapH: 14, endCapV: 15,
  decoA: 16, decoB: 17,
};

// ── Tropical Medieval City — Buildings ─────────────────────────

function buildBuildingDef(
  num: number, partCount: number,
  footprint: { w: number; h: number },
  biomes: string[], isTown: boolean,
): BuildingDef {
  return {
    id: `tc-building-${num}`,
    name: `Tropical Building ${num}`,
    parts: Array.from({ length: partCount }, (_, i) => `${TC}/buildings/building_${num}/building_${i + 1}.png`),
    footprint,
    biomes,
    isTown,
  };
}

export const TROPICAL_BUILDINGS: BuildingDef[] = [
  buildBuildingDef(1,  10, { w: 4, h: 4 }, ['grass', 'dirt'],           true),
  buildBuildingDef(2,  4,  { w: 3, h: 3 }, ['grass', 'dirt'],           true),
  buildBuildingDef(3,  4,  { w: 3, h: 3 }, ['grass', 'dirt'],           true),
  buildBuildingDef(4,  1,  { w: 2, h: 2 }, ['grass', 'dirt', 'stone'],  false),
  buildBuildingDef(5,  6,  { w: 3, h: 3 }, ['grass', 'dirt'],           true),
  buildBuildingDef(6,  7,  { w: 3, h: 4 }, ['grass', 'dirt'],           true),
  buildBuildingDef(7,  6,  { w: 3, h: 3 }, ['grass', 'jungle'],         true),
  buildBuildingDef(8,  7,  { w: 3, h: 4 }, ['grass', 'jungle'],         true),
  buildBuildingDef(9,  6,  { w: 3, h: 3 }, ['grass'],                   true),
  buildBuildingDef(10, 9,  { w: 4, h: 4 }, ['grass', 'dirt'],           true),
  buildBuildingDef(11, 5,  { w: 3, h: 3 }, ['grass', 'jungle'],         true),
  buildBuildingDef(12, 8,  { w: 3, h: 4 }, ['grass', 'dirt'],           true),
  buildBuildingDef(13, 8,  { w: 3, h: 4 }, ['dirt', 'stone'],           true),
  buildBuildingDef(14, 7,  { w: 4, h: 5 }, ['grass', 'dirt'],           true),
  buildBuildingDef(15, 6,  { w: 4, h: 4 }, ['grass', 'dirt'],           true),
  buildBuildingDef(16, 8,  { w: 3, h: 4 }, ['dirt', 'stone'],           true),
  buildBuildingDef(17, 11, { w: 5, h: 5 }, ['grass', 'dirt'],           true),
  buildBuildingDef(18, 5,  { w: 3, h: 3 }, ['grass', 'water'],          false),
];

// ── Tropical Medieval City — Decor ─────────────────────────────

export const TROPICAL_DECOR: DecorDef[] = [
  // Trees
  { id: 'tc-tree-1', name: 'Palm Tree', path: `${TC}/decor/tree_1.png`, nativeSize: 256, scale: 2.5, hasShadow: true, collisionRadius: 15, biomes: ['grass', 'jungle', 'dirt'], category: 'tree' },
  { id: 'tc-tree-2', name: 'Broadleaf', path: `${TC}/decor/tree_2.png`, nativeSize: 256, scale: 2.8, hasShadow: true, collisionRadius: 18, biomes: ['grass', 'jungle'],        category: 'tree' },
  // Greenery
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `tc-green-${i + 1}`, name: `Bush ${i + 1}`,
    path: `${TC}/decor/greenery_${i + 1}.png`, nativeSize: 256, scale: 1.2,
    hasShadow: true, collisionRadius: 0,
    biomes: ['grass', 'jungle', 'dirt'] as string[], category: 'greenery' as const,
  })),
  // Stones
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `tc-stone-${i + 1}`, name: `Stone ${i + 1}`,
    path: `${TC}/decor/stones_${i + 1}.png`, nativeSize: 256, scale: 1.0,
    hasShadow: true, collisionRadius: 10,
    biomes: ['grass', 'stone', 'dirt', 'jungle'] as string[], category: 'stone' as const,
  })),
  // General decor items
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `tc-decor-${i + 1}`, name: `Decor ${i + 1}`,
    path: `${TC}/decor/decor_${i + 1}.png`, nativeSize: 256, scale: 1.4,
    hasShadow: true, collisionRadius: 8,
    biomes: ['grass', 'dirt', 'jungle', 'stone'] as string[], category: 'decor' as const,
  })),
];

// ── House Constructor Tileset (32×32 pixel art) ────────────────

export const HOUSE_TILESET_SHEET: TilesetEntry = {
  id: 'ts-house-constructor',
  name: 'House Constructor Tileset',
  tilesheetPath: `${HC}/House_Tileset.png`,
  tileSize: 32,
  columns: 16,
};

// ── Castle Defense Field Tileset (32×32 pixel art) ─────────────

export const CASTLE_FIELD_SHEET: TilesetEntry = {
  id: 'ts-castle-fields',
  name: 'Castle Defense Fields',
  tilesheetPath: `${CD}/FieldsTileset.png`,
  tileSize: 32,
  columns: 8,
};

export const CASTLE_FIELD_TILES: TileImage[] = Array.from({ length: 64 }, (_, i) => ({
  id: `castle-field-${i + 1}`,
  path: `${CD}/FieldsTile_${String(i + 1).padStart(2, '0')}.png`,
  nativeSize: 32,
}));

/** Castle field tile indices by usage */
export const CASTLE_TILE_ROLES: Record<string, number[]> = {
  grassFlat: [1, 2, 3, 4, 5, 6],
  dirtPath: [7, 8, 9, 10, 11, 12],
  stoneWall: [13, 14, 15, 16, 17, 18, 19, 20],
  waterEdge: [21, 22, 23, 24, 25, 26],
  cliffEdge: [27, 28, 29, 30, 31, 32],
  towerBase: [33, 34, 35, 36],
  bridgeDeck: [37, 38, 39, 40],
  decoration: [41, 42, 43, 44, 45, 46, 47, 48],
};

// ── Biome → Tileset Mapping (updated to use tropical tilesets) ──

export const BIOME_TILESETS: Record<string, BiomeTileset> = {
  grass: {
    biome: 'grass',
    ground: GRASSLAND_TILESET,
    details: GRASSLAND_DETAILS,
    water: { ...GRASSLAND_TILESET, id: 'ts-grassland-water', name: 'Grassland Water' },
  },
  jungle: {
    biome: 'jungle',
    ground: GRASSLAND_TILESET,
    details: GRASSLAND_DETAILS,
  },
  water: {
    biome: 'water',
    ground: SWAMP_TILESET,
    water: SWAMP_TILESET,
  },
  stone: {
    biome: 'stone',
    ground: DUNGEON_TILESET,
    details: DUNGEON_PROPS_TILESET,
  },
  dirt: {
    biome: 'dirt',
    ground: ROAD_GRASS_TILESET,
    details: RUINS_TILESET,
  },
};

// ── Zone Terrain → Tileset Lookup ──────────────────────────────

/** Get the tileset config for a terrain type */
export function getTilesetForTerrain(terrainType: string): BiomeTileset | null {
  return BIOME_TILESETS[terrainType] || null;
}

/** Get all available tilesets */
export function getAllTilesets(): TilesetEntry[] {
  return [
    DUNGEON_TILESET,
    DUNGEON_PROPS_TILESET,
    DUNGEON_TRAPS_TILESET,
    GRASSLAND_TILESET,
    GRASSLAND_DETAILS,
    SWAMP_TILESET,
    ROAD_TILESET,
    ROAD_GRASS_TILESET,
    RUINS_TILESET,
    HOUSE_TILESET_SHEET,
    CASTLE_FIELD_SHEET,
  ];
}

/** Get tropical buildings suitable for a biome */
export function getBuildingsForBiome(biome: string): BuildingDef[] {
  return TROPICAL_BUILDINGS.filter(b => b.biomes.includes(biome));
}

/** Get decor suitable for a biome and category */
export function getDecorForBiome(biome: string, category?: DecorDef['category']): DecorDef[] {
  return TROPICAL_DECOR.filter(d =>
    d.biomes.includes(biome) && (!category || d.category === category)
  );
}

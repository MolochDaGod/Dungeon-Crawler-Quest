/**
 * Tileset System
 * Maps zone terrain types to pixel art tileset images for minimap,
 * terrain texture overlay, and 2D rendering modes.
 *
 * Tileset packs extracted from craftpix.net to public/assets/packs/tilesets/
 */

const T = '/assets/packs/tilesets';

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

// ── Tileset Entries ────────────────────────────────────────────

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

// ── Biome → Tileset Mapping ────────────────────────────────────

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
  ];
}

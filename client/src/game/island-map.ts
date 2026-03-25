/**
 * Home Island Map Generator
 * Procedural 40×40 tile grid forming a single island surrounded by water.
 * Terrain: deep water → shallow water → sand → grass → dense forest
 * Resource nodes placed per biome for each gathering profession.
 */

// ── Tile types ─────────────────────────────────────────────────

export const TILE = {
  DEEP_WATER: 0,
  SHALLOW_WATER: 1,
  SAND: 2,
  GRASS: 3,
  DENSE_GRASS: 4,
  DIRT: 5,
  STONE: 6,
} as const;

export type TileType = (typeof TILE)[keyof typeof TILE];

export const TILE_SIZE = 64;
export const MAP_W = 40;
export const MAP_H = 40;

// ── Tile color fallbacks (used when tileset image not loaded) ──

export const TILE_COLORS: Record<number, string> = {
  [TILE.DEEP_WATER]: '#0e4166',
  [TILE.SHALLOW_WATER]: '#1a6b8a',
  [TILE.SAND]: '#d4b87a',
  [TILE.GRASS]: '#4a7a3a',
  [TILE.DENSE_GRASS]: '#2a5a1a',
  [TILE.DIRT]: '#8a7050',
  [TILE.STONE]: '#6a6a72',
};

// ── Resource Node ──────────────────────────────────────────────

export interface IslandResourceNode {
  id: number;
  tileX: number;
  tileY: number;
  professionId: string;
  tier: number;
  name: string;
  icon: string;
  depleted: boolean;
  respawnAt: number;
}

// ── Structure (building, dock, etc.) ───────────────────────────

export interface IslandStructure {
  id: string;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  type: 'castle' | 'dock' | 'house' | 'well' | 'tower' | 'boat' | 'palm';
  label: string;
  assetKey: string; // key for asset loader lookup
}

// ── Full Island Map ────────────────────────────────────────────

export interface IslandMapData {
  width: number;
  height: number;
  tiles: number[][];
  resourceNodes: IslandResourceNode[];
  structures: IslandStructure[];
  dockTile: { x: number; y: number };
  spawnTile: { x: number; y: number };
  /** Decoration layer: trees, rocks, stumps etc. per tile */
  decorations: Map<string, IslandDecoration>;
}

export interface IslandDecoration {
  type: 'tree' | 'rock' | 'stump' | 'bush' | 'flower' | 'palm' | 'barrel' | 'chest' | 'log';
  variant: number;
}

// ── Simple seeded RNG ──────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 7) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

// ── Island Generation ──────────────────────────────────────────

export function generateHomeIsland(seed: number = 42): IslandMapData {
  const rng = seededRng(seed);
  const W = MAP_W;
  const H = MAP_H;
  const CX = W / 2;
  const CY = H / 2;
  const BASE_RADIUS = 15;

  // Generate noise offsets for organic island coastline
  const coastNoise: number[] = [];
  for (let a = 0; a < 360; a++) {
    coastNoise.push(
      Math.sin(a * 0.08) * 1.5 +
      Math.cos(a * 0.15) * 1.0 +
      Math.sin(a * 0.23 + 1.7) * 0.8
    );
  }

  // Build tile grid
  const tiles: number[][] = [];
  for (let y = 0; y < H; y++) {
    const row: number[] = [];
    for (let x = 0; x < W; x++) {
      const dx = x - CX;
      const dy = y - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const noise = coastNoise[Math.floor(angle) % 360];
      const effectiveRadius = BASE_RADIUS + noise;

      let tile: number;
      if (dist > effectiveRadius + 1.5) {
        tile = TILE.DEEP_WATER;
      } else if (dist > effectiveRadius) {
        tile = TILE.SHALLOW_WATER;
      } else if (dist > effectiveRadius - 2) {
        tile = TILE.SAND;
      } else if (dist > effectiveRadius - 5) {
        tile = TILE.GRASS;
      } else {
        tile = TILE.DENSE_GRASS;
      }

      row.push(tile);
    }
    tiles.push(row);
  }

  // Carve dirt paths from center to dock (south) and to key areas
  const pathPoints: { x: number; y: number }[][] = [
    // Center to south dock
    Array.from({ length: 14 }, (_, i) => ({ x: CX, y: CY + i })),
    // Center east (to logging zone)
    Array.from({ length: 8 }, (_, i) => ({ x: CX + i, y: CY })),
    // Center north (to mining zone)
    Array.from({ length: 8 }, (_, i) => ({ x: CX, y: CY - i })),
    // Center west (to herb zone)
    Array.from({ length: 8 }, (_, i) => ({ x: CX - i, y: CY })),
  ];

  for (const path of pathPoints) {
    for (const pt of path) {
      const tx = Math.round(pt.x);
      const ty = Math.round(pt.y);
      if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
        const current = tiles[ty][tx];
        if (current === TILE.GRASS || current === TILE.DENSE_GRASS) {
          tiles[ty][tx] = TILE.DIRT;
        }
      }
    }
  }

  // Add stone patches in the north for mining
  for (let dy = -3; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const tx = Math.round(CX + dx);
      const ty = Math.round(CY - 9 + dy);
      if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
        if (tiles[ty][tx] >= TILE.GRASS) {
          tiles[ty][tx] = TILE.STONE;
        }
      }
    }
  }

  // ── Decorations ──────────────────────────────────────────────

  const decorations = new Map<string, IslandDecoration>();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tile = tiles[y][x];
      const key = `${x},${y}`;
      const r = rng();

      if (tile === TILE.DENSE_GRASS && r < 0.35) {
        decorations.set(key, { type: 'tree', variant: Math.floor(rng() * 3) });
      } else if (tile === TILE.GRASS && r < 0.12) {
        decorations.set(key, { type: r < 0.06 ? 'bush' : 'flower', variant: Math.floor(rng() * 3) });
      } else if (tile === TILE.STONE && r < 0.3) {
        decorations.set(key, { type: 'rock', variant: Math.floor(rng() * 5) });
      } else if (tile === TILE.SAND && r < 0.06) {
        decorations.set(key, { type: 'palm', variant: Math.floor(rng() * 2) });
      } else if (tile === TILE.DENSE_GRASS && r < 0.45) {
        decorations.set(key, { type: 'stump', variant: Math.floor(rng() * 4) });
      }
    }
  }

  // ── Structures ───────────────────────────────────────────────

  const structures: IslandStructure[] = [
    // Player's castle at island center
    {
      id: 'home-castle', tileX: CX - 1, tileY: CY - 1, tileW: 3, tileH: 3,
      type: 'castle', label: 'Home Castle', assetKey: 'forest-castle',
    },
    // Well near castle
    {
      id: 'well', tileX: CX + 3, tileY: CY - 1, tileW: 1, tileH: 1,
      type: 'well', label: 'Well', assetKey: 'forest-well',
    },
    // Villager house east
    {
      id: 'house-east', tileX: CX + 4, tileY: CY + 1, tileW: 2, tileH: 2,
      type: 'house', label: 'Lodge', assetKey: 'forest-house',
    },
    // Villager house west
    {
      id: 'house-west', tileX: CX - 5, tileY: CY + 1, tileW: 2, tileH: 2,
      type: 'house', label: 'Herb Hut', assetKey: 'forest-tribal',
    },
    // Archer tower north
    {
      id: 'tower-north', tileX: CX, tileY: CY - 7, tileW: 1, tileH: 1,
      type: 'tower', label: 'Watchtower', assetKey: 'forest-tower',
    },
    // Dock area south
    {
      id: 'dock', tileX: CX - 1, tileY: CY + 13, tileW: 3, tileH: 2,
      type: 'dock', label: 'Dock', assetKey: 'pirate-dock',
    },
    // Boat at dock
    {
      id: 'boat', tileX: CX, tileY: CY + 15, tileW: 2, tileH: 2,
      type: 'boat', label: 'Your Ship', assetKey: 'pirate-boat',
    },
    // Coastal palms
    {
      id: 'palm-1', tileX: CX - 5, tileY: CY + 11, tileW: 1, tileH: 1,
      type: 'palm', label: '', assetKey: 'pirate-palm',
    },
    {
      id: 'palm-2', tileX: CX + 5, tileY: CY + 11, tileW: 1, tileH: 1,
      type: 'palm', label: '', assetKey: 'pirate-palm',
    },
  ];

  // Remove decorations under structures
  for (const s of structures) {
    for (let dy = 0; dy < s.tileH; dy++) {
      for (let dx = 0; dx < s.tileW; dx++) {
        decorations.delete(`${s.tileX + dx},${s.tileY + dy}`);
      }
    }
  }

  // ── Resource Nodes ───────────────────────────────────────────

  const nodeId = { current: 1 };
  function makeNode(
    tileX: number, tileY: number,
    professionId: string, tier: number, name: string, icon: string,
  ): IslandResourceNode {
    // Remove any decoration at this tile
    decorations.delete(`${tileX},${tileY}`);
    return {
      id: nodeId.current++, tileX, tileY,
      professionId, tier, name, icon,
      depleted: false, respawnAt: 0,
    };
  }

  const resourceNodes: IslandResourceNode[] = [
    // Mining nodes (north stone area)
    makeNode(CX - 1, CY - 10, 'mining', 1, 'Iron Vein', '⛏️'),
    makeNode(CX + 1, CY - 9, 'mining', 1, 'Copper Deposit', '⛏️'),
    makeNode(CX - 2, CY - 8, 'mining', 2, 'Silver Vein', '⛏️'),
    makeNode(CX + 2, CY - 11, 'mining', 1, 'Rough Stone', '⛏️'),

    // Logging nodes (east dense forest)
    makeNode(CX + 7, CY - 2, 'logging', 1, 'Pine Tree', '🪓'),
    makeNode(CX + 8, CY, 'logging', 1, 'Oak Tree', '🪓'),
    makeNode(CX + 6, CY + 2, 'logging', 2, 'Ironwood', '🪓'),
    makeNode(CX + 9, CY + 1, 'logging', 1, 'Birch Tree', '🪓'),

    // Herbalism nodes (west grass)
    makeNode(CX - 7, CY - 1, 'herbalism', 1, 'Red Flowers', '🌿'),
    makeNode(CX - 8, CY + 1, 'herbalism', 1, 'Common Herbs', '🌿'),
    makeNode(CX - 6, CY - 3, 'herbalism', 2, 'Moonpetal Bush', '🌿'),
    makeNode(CX - 9, CY, 'herbalism', 1, 'Herb Patch', '🌿'),

    // Fishing nodes (coastal south & east)
    makeNode(CX - 4, CY + 13, 'fishing', 1, 'Fishing Spot', '🎣'),
    makeNode(CX + 4, CY + 13, 'fishing', 1, 'Clam Bed', '🎣'),
    makeNode(CX + 12, CY + 3, 'fishing', 2, 'Deep Pool', '🎣'),

    // Skinning nodes (forest)
    makeNode(CX + 5, CY - 5, 'skinning', 1, 'Animal Trail', '🔪'),
    makeNode(CX - 3, CY - 5, 'skinning', 1, 'Beast Den', '🔪'),
    makeNode(CX + 3, CY - 7, 'skinning', 2, 'Monster Lair', '🔪'),

    // Scavenging nodes (near ruins/structures)
    makeNode(CX - 3, CY + 3, 'scavenging', 1, 'Old Crates', '🧲'),
    makeNode(CX + 3, CY + 5, 'scavenging', 1, 'Scrap Pile', '🧲'),
    makeNode(CX - 1, CY + 7, 'scavenging', 2, 'Abandoned Cart', '🧲'),
  ];

  return {
    width: W,
    height: H,
    tiles,
    resourceNodes,
    structures,
    dockTile: { x: CX, y: CY + 14 },
    spawnTile: { x: CX, y: CY + 12 },
    decorations,
  };
}

// ── Helpers ────────────────────────────────────────────────────

/** Check if a tile coordinate is land (not water) */
export function isLandTile(tiles: number[][], x: number, y: number): boolean {
  if (y < 0 || y >= tiles.length || x < 0 || x >= tiles[0].length) return false;
  return tiles[y][x] >= TILE.SAND;
}

/** Get the tile type name */
export function tileName(tile: number): string {
  switch (tile) {
    case TILE.DEEP_WATER: return 'Deep Water';
    case TILE.SHALLOW_WATER: return 'Shallow Water';
    case TILE.SAND: return 'Beach';
    case TILE.GRASS: return 'Grassland';
    case TILE.DENSE_GRASS: return 'Forest';
    case TILE.DIRT: return 'Path';
    case TILE.STONE: return 'Rocky Ground';
    default: return 'Unknown';
  }
}

/**
 * AI Chunk Generator — Stage C+D: Chunk Tile Placement + Decoration
 *
 * Processes each 125×125 chunk:
 *   1. Reads biome mask → places base terrain tiles
 *   2. Places roads using cobble/dirt tiles
 *   3. Places height blockers (mountains, cliffs)
 *   4. Scatters props (trees, rocks, bushes) using metadata rules
 *   5. Places structures in city/dock biomes
 *
 * Uses tile-metadata registry for sprite selection.
 * Respects biome tags, adjacency rules, rarity weights.
 */

import { SeededRandom } from './ai-map-gen';
import { type BiomeMask, getBiome, Biome } from './ai-world-planner';
import { TileLayer } from './tilemap-chunk';
import { ZoneTilemap } from './tilemap-zone';
import {
  TILE_PX, CHUNK_TILES, TILES_PER_ZONE,
  type TileMeta, type BiomeId,
  queryTiles, queryTilesByCat, pickTileWeighted, getTilesForBiome,
} from './tile-metadata';
import type { ZoneDef } from './zones';

// ── Biome → metadata BiomeId mapping ───────────────────────────

const BIOME_TO_META: Record<number, BiomeId> = {
  [Biome.DEEP_WATER]: 'water',
  [Biome.SHALLOW]:    'water',
  [Biome.BEACH]:      'beach',
  [Biome.GRASS]:      'grass',
  [Biome.FOREST]:     'forest',
  [Biome.MUD]:        'swamp',
  [Biome.ROAD]:       'city',    // roads use city-biome tiles
  [Biome.MOUNTAIN]:   'mountain',
  [Biome.CITY]:       'city',
  [Biome.DOCK]:       'dock',
  [Biome.RUINS]:      'ruins',
  [Biome.DIRT]:       'dirt',
  [Biome.SAND]:       'beach',
};

// ── Terrain tile caches (built once per generate call) ─────────

interface TerrainTileCache {
  grass:    TileMeta[];
  dirt:     TileMeta[];
  sand:     TileMeta[];
  water:    TileMeta[];
  cobble:   TileMeta[];
  mountain: TileMeta[];
  forest:   TileMeta[];
  mud:      TileMeta[];
  ruins:    TileMeta[];
  city:     TileMeta[];
}

function buildTerrainCache(): TerrainTileCache {
  return {
    grass:    queryTiles('grass', 'terrain'),
    dirt:     queryTiles('dirt', 'terrain'),
    sand:     queryTiles('beach', 'terrain'),
    water:    queryTiles('water', 'water'),
    cobble:   queryTilesByCat('city', 'cobble'),
    mountain: queryTilesByCat('mountain', 'mountain'),
    forest:   queryTiles('forest', 'terrain'),
    mud:      queryTilesByCat('swamp', 'mud' as any) || queryTiles('dirt', 'terrain'),
    ruins:    queryTiles('ruins', 'terrain'),
    city:     queryTiles('city', 'terrain'),
  };
}

// ── Prop tile caches ───────────────────────────────────────────

interface PropTileCache {
  trees:   TileMeta[];
  bushes:  TileMeta[];
  rocks:   TileMeta[];
  flowers: TileMeta[];
  lamps:   TileMeta[];
  fences:  TileMeta[];
}

function buildPropCache(): PropTileCache {
  return {
    trees:   queryTilesByCat('any', 'tree'),
    bushes:  queryTilesByCat('any', 'bush'),
    rocks:   queryTilesByCat('any', 'rock'),
    flowers: queryTilesByCat('any', 'flower'),
    lamps:   queryTilesByCat('city', 'lamp'),
    fences:  queryTilesByCat('any', 'fence'),
  };
}

// ── Structure tile cache ───────────────────────────────────────

function getStructureTiles(): TileMeta[] {
  return queryTiles('city', 'structure');
}

// ── Main Generator ─────────────────────────────────────────────

/**
 * Generate all chunks for a zone tilemap using the biome mask.
 * This is the main entry point — call once when a zone loads.
 */
export function generateAllChunks(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  zone: ZoneDef,
  seed: number,
): void {
  const terrainCache = buildTerrainCache();
  const propCache = buildPropCache();
  const structureTiles = getStructureTiles();

  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      generateChunk(tilemap, biomeMask, cx, cy, terrainCache, propCache, structureTiles, zone, seed + cx * 137 + cy * 311);
    }
  }
}

/**
 * Generate a single 125×125 chunk.
 */
function generateChunk(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  cx: number, cy: number,
  terrain: TerrainTileCache,
  props: PropTileCache,
  structures: TileMeta[],
  zone: ZoneDef,
  seed: number,
): void {
  const rng = new SeededRandom(seed);
  const baseX = cx * CHUNK_TILES;
  const baseY = cy * CHUNK_TILES;

  // ── Layer 0: Base Terrain ────────────────────────────────────
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = baseX + lx;
      const ty = baseY + ly;
      if (tx >= TILES_PER_ZONE || ty >= TILES_PER_ZONE) continue;

      const biome = getBiome(biomeMask, tx, ty);
      const tile = pickTerrainTile(biome, terrain, rng);
      if (tile) {
        tilemap.setTile(TileLayer.BASE_TERRAIN, tx, ty, tile.id);
      }
    }
  }

  // ── Layer 2: Height Blockers (mountains, cliffs) ─────────────
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = baseX + lx;
      const ty = baseY + ly;
      if (tx >= TILES_PER_ZONE || ty >= TILES_PER_ZONE) continue;

      const biome = getBiome(biomeMask, tx, ty);
      if (biome === Biome.MOUNTAIN) {
        if (terrain.mountain.length > 0) {
          const t = terrain.mountain[Math.abs(Math.floor(rng.next() * terrain.mountain.length)) % terrain.mountain.length];
          tilemap.setTile(TileLayer.HEIGHT_BLOCKER, tx, ty, t.id);
        }
      }
    }
  }

  // ── Layer 3: Roads ───────────────────────────────────────────
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = baseX + lx;
      const ty = baseY + ly;
      if (tx >= TILES_PER_ZONE || ty >= TILES_PER_ZONE) continue;

      const biome = getBiome(biomeMask, tx, ty);
      if (biome === Biome.ROAD && terrain.cobble.length > 0) {
        const t = pickTileWeighted(terrain.cobble, () => rng.next());
        tilemap.setTile(TileLayer.ROAD, tx, ty, t.id);
      }
    }
  }

  // ── Layer 4: Structures (city/dock biomes) ───────────────────
  if (structures.length > 0) {
    // Scatter structures in city/dock areas of this chunk
    for (let attempt = 0; attempt < 8; attempt++) {
      const lx = Math.floor(rng.next() * CHUNK_TILES);
      const ly = Math.floor(rng.next() * CHUNK_TILES);
      const tx = baseX + lx;
      const ty = baseY + ly;
      if (tx >= TILES_PER_ZONE || ty >= TILES_PER_ZONE) continue;

      const biome = getBiome(biomeMask, tx, ty);
      if (biome !== Biome.CITY && biome !== Biome.DOCK) continue;

      const structure = structures[Math.floor(rng.next() * structures.length)];
      // Check if area is clear
      let clear = true;
      for (let dy = 0; dy < structure.heightTiles && clear; dy++) {
        for (let dx = 0; dx < structure.widthTiles && clear; dx++) {
          if (tilemap.getTileNum(TileLayer.STRUCTURE, tx + dx, ty + dy) !== 0) clear = false;
          if (tilemap.getTileNum(TileLayer.HEIGHT_BLOCKER, tx + dx, ty + dy) !== 0) clear = false;
        }
      }
      if (clear) {
        tilemap.placeMultiTile(TileLayer.STRUCTURE, tx, ty, structure);
      }
    }
  }

  // ── Layer 5: Props (trees, rocks, bushes, flowers, lamps) ────
  for (let ly = 0; ly < CHUNK_TILES; ly++) {
    for (let lx = 0; lx < CHUNK_TILES; lx++) {
      const tx = baseX + lx;
      const ty = baseY + ly;
      if (tx >= TILES_PER_ZONE || ty >= TILES_PER_ZONE) continue;

      // Skip if already occupied
      if (tilemap.getTileNum(TileLayer.STRUCTURE, tx, ty) !== 0) continue;
      if (tilemap.getTileNum(TileLayer.HEIGHT_BLOCKER, tx, ty) !== 0) continue;
      if (tilemap.getTileNum(TileLayer.ROAD, tx, ty) !== 0) continue;

      const biome = getBiome(biomeMask, tx, ty);
      if (biome === Biome.DEEP_WATER || biome === Biome.SHALLOW || biome === Biome.MOUNTAIN) continue;

      // Probability-based prop placement
      const roll = rng.next();

      if (biome === Biome.FOREST) {
        // Dense forest: 15% chance of tree, 8% bush
        if (roll < 0.15 && props.trees.length > 0) {
          const t = pickTileWeighted(props.trees, () => rng.next());
          tilemap.setTile(TileLayer.PROP, tx, ty, t.id);
        } else if (roll < 0.23 && props.bushes.length > 0) {
          const t = pickTileWeighted(props.bushes, () => rng.next());
          tilemap.setTile(TileLayer.PROP, tx, ty, t.id);
        }
      } else if (biome === Biome.GRASS) {
        // Grassland: 4% tree, 3% bush, 2% flower, 1% rock
        if (roll < 0.04 && props.trees.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.trees, () => rng.next()).id);
        } else if (roll < 0.07 && props.bushes.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.bushes, () => rng.next()).id);
        } else if (roll < 0.09 && props.flowers.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.flowers, () => rng.next()).id);
        } else if (roll < 0.10 && props.rocks.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.rocks, () => rng.next()).id);
        }
      } else if (biome === Biome.DIRT || biome === Biome.MUD) {
        // Dirt/mud: 5% rock, 2% bush
        if (roll < 0.05 && props.rocks.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.rocks, () => rng.next()).id);
        } else if (roll < 0.07 && props.bushes.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.bushes, () => rng.next()).id);
        }
      } else if (biome === Biome.CITY) {
        // City: 1% lamp, 0.5% barrel/crate
        if (roll < 0.01 && props.lamps.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.lamps, () => rng.next()).id);
        }
      } else if (biome === Biome.BEACH || biome === Biome.SAND) {
        // Beach: 2% rock, 1% bush
        if (roll < 0.02 && props.rocks.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.rocks, () => rng.next()).id);
        }
      } else if (biome === Biome.RUINS) {
        // Ruins: 3% rock
        if (roll < 0.03 && props.rocks.length > 0) {
          tilemap.setTile(TileLayer.PROP, tx, ty, pickTileWeighted(props.rocks, () => rng.next()).id);
        }
      }
    }
  }

  // Mark chunk as generated
  tilemap.markGenerated(cx, cy);
}

// ── Terrain tile picker ────────────────────────────────────────

function pickTerrainTile(biome: Biome, cache: TerrainTileCache, rng: SeededRandom): TileMeta | null {
  let pool: TileMeta[];

  switch (biome) {
    case Biome.GRASS:      pool = cache.grass; break;
    case Biome.FOREST:     pool = cache.forest.length > 0 ? cache.forest : cache.grass; break;
    case Biome.DIRT:       pool = cache.dirt; break;
    case Biome.MUD:        pool = cache.mud.length > 0 ? cache.mud : cache.dirt; break;
    case Biome.SAND:
    case Biome.BEACH:      pool = cache.sand; break;
    case Biome.DEEP_WATER:
    case Biome.SHALLOW:    pool = cache.water; break;
    case Biome.ROAD:       pool = cache.cobble.length > 0 ? cache.cobble : cache.dirt; break;
    case Biome.MOUNTAIN:   pool = cache.mountain.length > 0 ? cache.mountain : cache.dirt; break;
    case Biome.CITY:       pool = cache.city.length > 0 ? cache.city : cache.cobble.length > 0 ? cache.cobble : cache.grass; break;
    case Biome.DOCK:       pool = cache.sand.length > 0 ? cache.sand : cache.dirt; break;
    case Biome.RUINS:      pool = cache.ruins.length > 0 ? cache.ruins : cache.dirt; break;
    default:               pool = cache.grass; break;
  }

  if (pool.length === 0) return null;
  return pickTileWeighted(pool, () => rng.next());
}

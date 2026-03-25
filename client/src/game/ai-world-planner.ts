/**
 * AI World Planner — Stage A+B: Macro + Zone Planning
 *
 * Generates a 1000×1000 biome ID grid for each zone using:
 *   - Simplex noise for organic terrain distribution
 *   - Zone sub-zones for named area identity
 *   - Water lanes (rivers/lakes) for impassable barriers
 *   - Cliff walls for choke points
 *   - Zone exits for road connections
 *
 * Biome IDs match the color legend:
 *   0: deep_water   #0b1d3a
 *   1: shallow      #1f5f8b
 *   2: beach        #d6b36a
 *   3: grass        #5d9c59
 *   4: forest       #2f6b3d
 *   5: mud          #5a4a32
 *   6: road         #8b6a43
 *   7: mountain     #6b6b6b
 *   8: city         #b33a2f
 *   9: dock         #c97a2b
 *  10: ruins        #7d6aa8
 *  11: dirt         #8a6a4a
 *  12: sand         #d6c06a
 */

import { SimplexNoise, SeededRandom } from './ai-map-gen';
import { ZoneDef, getZoneById } from './zones';
import { TILES_PER_ZONE, TILE_PX } from './tile-metadata';

// ── Biome IDs ──────────────────────────────────────────────────

export const enum Biome {
  DEEP_WATER = 0,
  SHALLOW    = 1,
  BEACH      = 2,
  GRASS      = 3,
  FOREST     = 4,
  MUD        = 5,
  ROAD       = 6,
  MOUNTAIN   = 7,
  CITY       = 8,
  DOCK       = 9,
  RUINS      = 10,
  DIRT       = 11,
  SAND       = 12,
}

export const BIOME_COLORS: Record<number, string> = {
  [Biome.DEEP_WATER]: '#0b1d3a',
  [Biome.SHALLOW]:    '#1f5f8b',
  [Biome.BEACH]:      '#d6b36a',
  [Biome.GRASS]:      '#5d9c59',
  [Biome.FOREST]:     '#2f6b3d',
  [Biome.MUD]:        '#5a4a32',
  [Biome.ROAD]:       '#8b6a43',
  [Biome.MOUNTAIN]:   '#6b6b6b',
  [Biome.CITY]:       '#b33a2f',
  [Biome.DOCK]:       '#c97a2b',
  [Biome.RUINS]:      '#7d6aa8',
  [Biome.DIRT]:       '#8a6a4a',
  [Biome.SAND]:       '#d6c06a',
};

// Map zone terrainType to base biome
const TERRAIN_TO_BIOME: Record<string, Biome> = {
  grass:  Biome.GRASS,
  jungle: Biome.FOREST,
  stone:  Biome.DIRT,
  dirt:   Biome.DIRT,
  water:  Biome.SHALLOW,
};

// Map sub-zone terrainType to biome
const SUBZONE_TERRAIN_TO_BIOME: Record<string, Biome> = {
  grass:  Biome.GRASS,
  jungle: Biome.FOREST,
  stone:  Biome.MOUNTAIN,
  dirt:   Biome.DIRT,
  water:  Biome.SHALLOW,
};

// ── Biome Mask ─────────────────────────────────────────────────

export type BiomeMask = Uint8Array; // 1000×1000 flat array

export function createBiomeMask(): BiomeMask {
  return new Uint8Array(TILES_PER_ZONE * TILES_PER_ZONE);
}

export function getBiome(mask: BiomeMask, tx: number, ty: number): Biome {
  if (tx < 0 || tx >= TILES_PER_ZONE || ty < 0 || ty >= TILES_PER_ZONE) return Biome.DEEP_WATER;
  return mask[ty * TILES_PER_ZONE + tx];
}

export function setBiome(mask: BiomeMask, tx: number, ty: number, biome: Biome): void {
  if (tx < 0 || tx >= TILES_PER_ZONE || ty < 0 || ty >= TILES_PER_ZONE) return;
  mask[ty * TILES_PER_ZONE + tx] = biome;
}

// ── Generation ─────────────────────────────────────────────────

/**
 * Generate the biome mask for a zone.
 * This is the "planning map" — the first stage of world generation.
 */
export function generateBiomeMask(zone: ZoneDef, seed: number): BiomeMask {
  const mask = createBiomeMask();
  const noise = new SimplexNoise(seed);
  const rng = new SeededRandom(seed);
  const N = TILES_PER_ZONE;

  // ── Step 1: Fill base biome from zone terrainType ──
  const baseBiome = TERRAIN_TO_BIOME[zone.terrainType] ?? Biome.GRASS;
  mask.fill(baseBiome);

  // ── Step 2: Island shape — ocean around edges ──
  // Creates an organic coastline using noise
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      // Distance from center (0..1)
      const dx = (tx - N / 2) / (N / 2);
      const dy = (ty - N / 2) / (N / 2);
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Noise-perturbed island edge
      const edgeNoise = noise.fbm(tx * 0.004, ty * 0.004, 4, 2, 0.5);
      const islandRadius = 0.82 + edgeNoise * 0.15;

      if (distFromCenter > islandRadius) {
        // Ocean
        setBiome(mask, tx, ty, Biome.DEEP_WATER);
      } else if (distFromCenter > islandRadius - 0.04) {
        // Beach/shoreline
        setBiome(mask, tx, ty, Biome.BEACH);
      } else if (distFromCenter > islandRadius - 0.08) {
        // Shallow water / sand transition
        const n = noise.noise2D(tx * 0.02, ty * 0.02);
        setBiome(mask, tx, ty, n > 0 ? Biome.SAND : Biome.BEACH);
      }
    }
  }

  // ── Step 3: Apply sub-zones ──
  for (const sz of zone.subZones) {
    const b = sz.bounds;
    // Convert world-pixel bounds to tile coords
    const tx0 = Math.floor(b.x / TILE_PX);
    const ty0 = Math.floor(b.y / TILE_PX);
    const tw = Math.floor(b.w / TILE_PX);
    const th = Math.floor(b.h / TILE_PX);
    const szBiome = SUBZONE_TERRAIN_TO_BIOME[sz.terrainType] ?? baseBiome;

    // Fill sub-zone area with its biome (with noise-softened edges)
    for (let ty = ty0; ty < ty0 + th && ty < N; ty++) {
      for (let tx = tx0; tx < tx0 + tw && tx < N; tx++) {
        // Only overwrite if current tile is land (not ocean/beach)
        const current = getBiome(mask, tx, ty);
        if (current === Biome.DEEP_WATER || current === Biome.BEACH) continue;

        // Soften edges with noise
        const edgeDx = Math.min(tx - tx0, tx0 + tw - tx) / 8;
        const edgeDy = Math.min(ty - ty0, ty0 + th - ty) / 8;
        const edgeFade = Math.min(edgeDx, edgeDy);
        const edgeNoise = noise.noise2D(tx * 0.05 + sz.name.length, ty * 0.05);

        if (edgeFade > 0.5 || (edgeFade > 0 && edgeNoise > 0)) {
          setBiome(mask, tx, ty, szBiome);
        }

        // Safe sub-zones get 'city' biome only in their tight core
        // edgeFade > 6 ensures city footprint stays small (~6-8% of zone)
        if (sz.safe && edgeFade > 6) {
          setBiome(mask, tx, ty, Biome.CITY);
        }
      }
    }
  }

  // ── Step 4: Water lanes (rivers & lakes) ──
  for (const wl of zone.waterLanes) {
    if (wl.type === 'river') {
      paintRiver(mask, wl.points, noise, 6); // 6 tiles wide
    } else {
      paintLake(mask, wl.points);
    }
  }

  // ── Step 5: Cliff walls ──
  for (const cw of zone.cliffWalls) {
    paintCliffWall(mask, cw.from, cw.to, Math.ceil(cw.thickness / TILE_PX));
  }

  // ── Step 6: Roads connecting exits + sub-zone centers ──
  // Connect zone exits to the center
  const center = { x: N / 2, y: N / 2 };
  for (const exit of zone.exits) {
    const exitTile = { x: Math.floor(exit.x / TILE_PX + exit.w / TILE_PX / 2), y: Math.floor(exit.y / TILE_PX + exit.h / TILE_PX / 2) };
    paintRoad(mask, exitTile, center, noise, seed + exit.targetZoneId);
  }

  // Connect sub-zone centers to the main center
  for (const sz of zone.subZones) {
    const szCenter = {
      x: Math.floor((sz.bounds.x + sz.bounds.w / 2) / TILE_PX),
      y: Math.floor((sz.bounds.y + sz.bounds.h / 2) / TILE_PX),
    };
    paintRoad(mask, szCenter, center, noise, seed + sz.name.length);
  }

  // ── Step 7: Dungeon entrance markers ──
  for (const dg of zone.dungeons) {
    const dtx = Math.floor(dg.x / TILE_PX);
    const dty = Math.floor(dg.y / TILE_PX);
    // Mark a small area as ruins around dungeon entrance
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const current = getBiome(mask, dtx + dx, dty + dy);
        if (current !== Biome.DEEP_WATER && current !== Biome.SHALLOW) {
          setBiome(mask, dtx + dx, dty + dy, Biome.RUINS);
        }
      }
    }
  }

  // ── Step 8: Noise-based biome variation ──
  // Adds forest patches in grass, mud patches in dirt, etc.
  for (let ty = 0; ty < N; ty++) {
    for (let tx = 0; tx < N; tx++) {
      const current = getBiome(mask, tx, ty);
      if (current === Biome.DEEP_WATER || current === Biome.ROAD || current === Biome.CITY || current === Biome.RUINS) continue;

      const n1 = noise.fbm(tx * 0.008, ty * 0.008, 3, 2, 0.6);
      const n2 = noise.fbm(tx * 0.015 + 100, ty * 0.015 + 100, 2, 2, 0.5);

      if (current === Biome.GRASS && n1 > 0.65) {
        setBiome(mask, tx, ty, Biome.FOREST);
      } else if (current === Biome.DIRT && n2 > 0.7) {
        setBiome(mask, tx, ty, Biome.MUD);
      } else if (current === Biome.FOREST && n1 < 0.3) {
        // Clear some forest for variety
        setBiome(mask, tx, ty, Biome.GRASS);
      }
    }
  }

  return mask;
}

// ── Painting Helpers ───────────────────────────────────────────

/** Paint a river along a polyline path */
function paintRiver(mask: BiomeMask, points: { x: number; y: number }[], noise: SimplexNoise, width: number): void {
  for (let i = 0; i < points.length - 1; i++) {
    const a = { x: Math.floor(points[i].x / TILE_PX), y: Math.floor(points[i].y / TILE_PX) };
    const b = { x: Math.floor(points[i + 1].x / TILE_PX), y: Math.floor(points[i + 1].y / TILE_PX) };
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist);

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const cx = Math.round(a.x + dx * t);
      const cy = Math.round(a.y + dy * t);

      // Width varies with noise
      const w = width + Math.floor(noise.noise2D(cx * 0.1, cy * 0.1) * 3);

      for (let dy2 = -w; dy2 <= w; dy2++) {
        for (let dx2 = -w; dx2 <= w; dx2++) {
          if (dx2 * dx2 + dy2 * dy2 <= w * w) {
            const tx = cx + dx2, ty = cy + dy2;
            const current = getBiome(mask, tx, ty);
            if (current !== Biome.ROAD && current !== Biome.CITY) {
              setBiome(mask, tx, ty, Math.abs(dx2) + Math.abs(dy2) <= w / 2 ? Biome.DEEP_WATER : Biome.SHALLOW);
            }
          }
        }
      }
    }
  }
}

/** Paint a lake from polygon points */
function paintLake(mask: BiomeMask, points: { x: number; y: number }[]): void {
  if (points.length < 3) return;
  // Convert to tile coords
  const tilePoints = points.map(p => ({ x: Math.floor(p.x / TILE_PX), y: Math.floor(p.y / TILE_PX) }));

  // Bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of tilePoints) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }

  // Scanline fill using point-in-polygon
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (pointInPolygon(tx, ty, tilePoints)) {
        const current = getBiome(mask, tx, ty);
        if (current !== Biome.ROAD && current !== Biome.CITY) {
          // Edge = shallow, interior = deep
          const edgeDist = distToPolygonEdge(tx, ty, tilePoints);
          setBiome(mask, tx, ty, edgeDist > 3 ? Biome.DEEP_WATER : Biome.SHALLOW);
        }
      }
    }
  }
}

/** Paint a cliff wall between two points */
function paintCliffWall(mask: BiomeMask, from: { x: number; y: number }, to: { x: number; y: number }, widthTiles: number): void {
  const a = { x: Math.floor(from.x / TILE_PX), y: Math.floor(from.y / TILE_PX) };
  const b = { x: Math.floor(to.x / TILE_PX), y: Math.floor(to.y / TILE_PX) };
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist);
  const hw = Math.ceil(widthTiles / 2);

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(a.x + dx * t);
    const cy = Math.round(a.y + dy * t);
    for (let d = -hw; d <= hw; d++) {
      // Perpendicular offset
      const px = cx + Math.round((-dy / dist) * d);
      const py = cy + Math.round((dx / dist) * d);
      setBiome(mask, px, py, Biome.MOUNTAIN);
    }
  }
}

/** Paint a road between two tile positions */
function paintRoad(mask: BiomeMask, from: { x: number; y: number }, to: { x: number; y: number }, noise: SimplexNoise, seed: number): void {
  const dx = to.x - from.x, dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist);

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(from.x + dx * t);
    const cy = Math.round(from.y + dy * t);

    // Slight noise-based winding
    const perpX = -dy / dist, perpY = dx / dist;
    const wobble = noise.noise2D(s * 0.05 + seed, 0) * 4;
    const rx = Math.round(cx + perpX * wobble);
    const ry = Math.round(cy + perpY * wobble);

    // Road is 3 tiles wide
    for (let d = -1; d <= 1; d++) {
      for (let e = -1; e <= 1; e++) {
        const tx = rx + d, ty = ry + e;
        const current = getBiome(mask, tx, ty);
        // Don't overwrite water or mountains with road
        if (current !== Biome.DEEP_WATER && current !== Biome.SHALLOW && current !== Biome.MOUNTAIN) {
          setBiome(mask, tx, ty, Biome.ROAD);
        }
      }
    }
  }
}

// ── Geometry Helpers ────────────────────────────────────────────

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function distToPolygonEdge(x: number, y: number, poly: { x: number; y: number }[]): number {
  let minDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const dx = poly[i].x - poly[j].x, dy = poly[i].y - poly[j].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - poly[j].x) * dx + (y - poly[j].y) * dy) / (len * len)));
    const px = poly[j].x + t * dx, py = poly[j].y + t * dy;
    const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

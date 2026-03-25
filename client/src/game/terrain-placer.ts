/**
 * AI Terrain Placement System
 * Generates deterministic terrain tile layouts per zone using seeded noise.
 * Handles land tiles, road auto-tiling, building placement, decor scattering,
 * shadow generation, and water edge detection.
 *
 * All placements are deterministic (seeded) so they remain consistent across
 * frames and sessions without needing to persist layouts.
 */

import { ZoneDef, ISLAND_ZONES, ZONE_ROADS, RoadSegment } from './zones';
import {
  TROPICAL_LAND_TILES, TROPICAL_ROAD_TILES, TROPICAL_BUILDINGS,
  TROPICAL_DECOR, BIOME_LAND_INDICES, ROAD_TILE_ROLES,
  CASTLE_FIELD_TILES, CASTLE_TILE_ROLES,
  BuildingDef, DecorDef, TileImage,
  getBuildingsForBiome, getDecorForBiome,
} from './tilesets';

// ── Constants ──────────────────────────────────────────────────

export const PLACE_TILE = 120;  // world-space tile size — large enough for 256px tiles to look good

// ── Seeded Random ──────────────────────────────────────────────

function seeded(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function seededInt(x: number, y: number, seed: number, max: number): number {
  return Math.floor(seeded(x, y, seed) * max);
}

function seededPick<T>(arr: T[], x: number, y: number, seed: number): T {
  return arr[seededInt(x, y, seed, arr.length)];
}

// ── Tile Selection Types ───────────────────────────────────────

export interface PlacedLandTile {
  /** Grid column within zone */
  gx: number;
  /** Grid row within zone */
  gy: number;
  /** World X of tile top-left */
  wx: number;
  /** World Y of tile top-left */
  wy: number;
  /** Path to tile image */
  tilePath: string;
  /** Rotation (0, 90, 180, 270) for variety */
  rotation: number;
  /** Alpha for blending (edge tiles fade) */
  alpha: number;
}

export interface PlacedRoadTile {
  wx: number;
  wy: number;
  tilePath: string;
  rotation: number;
}

export interface PlacedBuilding {
  wx: number;
  wy: number;
  def: BuildingDef;
  /** Scale multiplier */
  scale: number;
  /** Unique seed for this building (for part offsets) */
  seed: number;
}

export interface PlacedDecor {
  wx: number;
  wy: number;
  def: DecorDef;
  scale: number;
  rotation: number;
  /** Shadow offset (dx, dy, alpha) */
  shadow: { dx: number; dy: number; alpha: number };
}

export interface ZonePlacement {
  zoneId: number;
  landTiles: PlacedLandTile[];
  roadTiles: PlacedRoadTile[];
  buildings: PlacedBuilding[];
  decor: PlacedDecor[];
  /** Water tiles at zone edges bordering water/ocean */
  waterEdgeTiles: PlacedLandTile[];
}

// ── Main Placement AI ──────────────────────────────────────────

const _placementCache = new Map<number, ZonePlacement>();

/** Clear cached placements (call on zone layout change) */
export function invalidatePlacementCache(): void {
  _placementCache.clear();
}

/** Get or generate placement for a zone */
export function getZonePlacement(zone: ZoneDef): ZonePlacement {
  const cached = _placementCache.get(zone.id);
  if (cached) return cached;

  const placement: ZonePlacement = {
    zoneId: zone.id,
    landTiles: generateLandTiles(zone),
    roadTiles: generateRoadTiles(zone),
    buildings: generateBuildings(zone),
    decor: generateDecor(zone),
    waterEdgeTiles: generateWaterEdges(zone),
  };

  _placementCache.set(zone.id, placement);
  return placement;
}

// ── Land Tile Generation ───────────────────────────────────────

function generateLandTiles(zone: ZoneDef): PlacedLandTile[] {
  const tiles: PlacedLandTile[] = [];
  const b = zone.bounds;
  const gridW = Math.ceil(b.w / PLACE_TILE);
  const gridH = Math.ceil(b.h / PLACE_TILE);

  // Get biome-appropriate tile indices
  const tileIndices = BIOME_LAND_INDICES[zone.terrainType] ?? BIOME_LAND_INDICES.grass;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      // Pick a land tile based on position and zone seed
      const tileIdx = tileIndices[seededInt(gx, gy, zone.id * 31 + 7, tileIndices.length)];
      const tile = TROPICAL_LAND_TILES[tileIdx - 1]; // indices are 1-based
      if (!tile) continue;

      // Only rotate 180° (not 90/270) — avoids visible seam lines with non-symmetric tiles
      const rot = seededInt(gx + 100, gy + 200, zone.id * 17, 2) * 180;

      // Smooth edge fade: multi-tile gradient at zone borders for natural blending
      const edgeDistX = Math.min(gx, gridW - 1 - gx);
      const edgeDistY = Math.min(gy, gridH - 1 - gy);
      const edgeDist = Math.min(edgeDistX, edgeDistY);
      const alpha = edgeDist === 0 ? 0.7 : edgeDist === 1 ? 0.88 : 1.0;

      tiles.push({
        gx, gy,
        wx: b.x + gx * PLACE_TILE,
        wy: b.y + gy * PLACE_TILE,
        tilePath: tile.path,
        rotation: rot,
        alpha,
      });
    }
  }

  return tiles;
}

// ── Road Tile Generation ───────────────────────────────────────

function generateRoadTiles(zone: ZoneDef): PlacedRoadTile[] {
  const tiles: PlacedRoadTile[] = [];
  const b = zone.bounds;

  // Collect road segments that pass through or near this zone
  for (const road of ZONE_ROADS) {
    if (!roadIntersectsZone(road, b)) continue;

    const dx = road.to.x - road.from.x;
    const dy = road.to.y - road.from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / PLACE_TILE);
    const isH = Math.abs(dx) > Math.abs(dy);

    for (let i = 0; i <= steps; i++) {
      const wx = road.from.x + (dx / steps) * i;
      const wy = road.from.y + (dy / steps) * i;

      // Only place tiles within zone bounds (with small margin)
      if (wx < b.x - PLACE_TILE || wx > b.x + b.w + PLACE_TILE) continue;
      if (wy < b.y - PLACE_TILE || wy > b.y + b.h + PLACE_TILE) continue;

      // Pick road tile based on direction
      const roleKey = isH ? 'hStraight' : 'vStraight';
      const tileNum = ROAD_TILE_ROLES[roleKey] ?? 1;
      const tile = TROPICAL_ROAD_TILES[tileNum - 1];
      if (!tile) continue;

      tiles.push({
        wx: Math.round(wx / PLACE_TILE) * PLACE_TILE,
        wy: Math.round(wy / PLACE_TILE) * PLACE_TILE,
        tilePath: tile.path,
        rotation: isH ? 0 : 90,
      });

      // Road width: add tiles perpendicular
      const perpX = isH ? 0 : PLACE_TILE;
      const perpY = isH ? PLACE_TILE : 0;
      tiles.push({
        wx: Math.round(wx / PLACE_TILE) * PLACE_TILE + perpX,
        wy: Math.round(wy / PLACE_TILE) * PLACE_TILE + perpY,
        tilePath: tile.path,
        rotation: isH ? 0 : 90,
      });
      tiles.push({
        wx: Math.round(wx / PLACE_TILE) * PLACE_TILE - perpX,
        wy: Math.round(wy / PLACE_TILE) * PLACE_TILE - perpY,
        tilePath: tile.path,
        rotation: isH ? 0 : 90,
      });
    }
  }

  return tiles;
}

function roadIntersectsZone(road: RoadSegment, bounds: { x: number; y: number; w: number; h: number }): boolean {
  const margin = PLACE_TILE * 3;
  const minX = bounds.x - margin;
  const maxX = bounds.x + bounds.w + margin;
  const minY = bounds.y - margin;
  const maxY = bounds.y + bounds.h + margin;
  // Simple AABB check on road segment endpoints
  return (
    (road.from.x >= minX && road.from.x <= maxX && road.from.y >= minY && road.from.y <= maxY) ||
    (road.to.x >= minX && road.to.x <= maxX && road.to.y >= minY && road.to.y <= maxY) ||
    // Check if segment crosses zone
    (Math.min(road.from.x, road.to.x) <= maxX && Math.max(road.from.x, road.to.x) >= minX &&
     Math.min(road.from.y, road.to.y) <= maxY && Math.max(road.from.y, road.to.y) >= minY)
  );
}

// ── Building Placement ─────────────────────────────────────────

function generateBuildings(zone: ZoneDef): PlacedBuilding[] {
  const buildings: PlacedBuilding[] = [];
  const b = zone.bounds;
  const available = getBuildingsForBiome(zone.terrainType);
  if (available.length === 0) return buildings;

  // Density based on zone type
  const isTown = zone.isSafeZone || zone.islandType === 'town' || zone.islandType === 'village' || zone.islandType === 'port';
  const maxBuildings = isTown ? 12 : (zone.terrainType === 'water' ? 2 : 5);

  // Use grid-based placement to avoid overlap
  const gridStep = isTown ? 6 : 10; // tiles between buildings
  const gridW = Math.floor(b.w / PLACE_TILE / gridStep);
  const gridH = Math.floor(b.h / PLACE_TILE / gridStep);
  let count = 0;

  for (let gy = 1; gy < gridH && count < maxBuildings; gy++) {
    for (let gx = 1; gx < gridW && count < maxBuildings; gx++) {
      // Probability check
      const prob = isTown ? 0.55 : 0.25;
      if (seeded(gx, gy, zone.id * 41 + 3) > prob) continue;

      // Pick a building
      const def = seededPick(available, gx, gy, zone.id * 53 + 11);
      // Only place town buildings in safe zones
      if (def.isTown && !isTown) continue;

      const wx = b.x + gx * gridStep * PLACE_TILE + seeded(gx + 50, gy + 50, zone.id * 67) * PLACE_TILE * 2;
      const wy = b.y + gy * gridStep * PLACE_TILE + seeded(gx + 70, gy + 70, zone.id * 73) * PLACE_TILE * 2;

      // Don't place too close to zone edges
      if (wx < b.x + PLACE_TILE * 3 || wx > b.x + b.w - PLACE_TILE * 5) continue;
      if (wy < b.y + PLACE_TILE * 3 || wy > b.y + b.h - PLACE_TILE * 5) continue;

      // Don't place on NPC positions or player spawns
      const tooClose = [...zone.npcPositions, ...zone.playerSpawns].some(
        p => Math.abs(p.x - wx) < PLACE_TILE * 4 && Math.abs(p.y - wy) < PLACE_TILE * 4
      );
      if (tooClose) continue;

      const scale = 0.8 + seeded(gx + 90, gy + 90, zone.id * 83) * 0.4;

      buildings.push({ wx, wy, def, scale, seed: zone.id * 1000 + count });
      count++;
    }
  }

  return buildings;
}

// ── Decor Placement ────────────────────────────────────────────

function generateDecor(zone: ZoneDef): PlacedDecor[] {
  const decor: PlacedDecor[] = [];
  const b = zone.bounds;
  const available = getDecorForBiome(zone.terrainType);
  if (available.length === 0) return decor;

  // Density per biome
  const density: Record<string, number> = {
    grass: 0.06, jungle: 0.10, dirt: 0.04, stone: 0.03, water: 0.02,
  };
  const prob = density[zone.terrainType] ?? 0.04;

  const gridW = Math.ceil(b.w / PLACE_TILE);
  const gridH = Math.ceil(b.h / PLACE_TILE);

  // Sun direction for shadows (top-right light → shadow bottom-left)
  const shadowDx = 4;
  const shadowDy = 6;
  const shadowAlpha = 0.25;

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      if (seeded(gx, gy, zone.id * 97 + 19) > prob) continue;

      const def = seededPick(available, gx, gy, zone.id * 101 + 23);
      const wx = b.x + gx * PLACE_TILE + seeded(gx + 200, gy + 300, zone.id * 107) * PLACE_TILE * 0.8;
      const wy = b.y + gy * PLACE_TILE + seeded(gx + 400, gy + 500, zone.id * 109) * PLACE_TILE * 0.8;

      // Skip edge tiles for border zones
      if (wx < b.x + PLACE_TILE || wx > b.x + b.w - PLACE_TILE) continue;
      if (wy < b.y + PLACE_TILE || wy > b.y + b.h - PLACE_TILE) continue;

      const scale = def.scale * (0.7 + seeded(gx + 600, gy + 700, zone.id * 113) * 0.6);
      const rotation = seededInt(gx + 800, gy + 900, zone.id * 127, 4) * 90;

      decor.push({
        wx, wy, def, scale, rotation,
        shadow: def.hasShadow
          ? { dx: shadowDx, dy: shadowDy, alpha: shadowAlpha }
          : { dx: 0, dy: 0, alpha: 0 },
      });
    }
  }

  return decor;
}

// ── Water Edge Generation ──────────────────────────────────────

function generateWaterEdges(zone: ZoneDef): PlacedLandTile[] {
  const edges: PlacedLandTile[] = [];
  const b = zone.bounds;

  // Only generate water edges for zones that border water zones or ocean
  const adjacentWaterZones = ISLAND_ZONES.filter(z =>
    z.id !== zone.id &&
    z.terrainType === 'water' &&
    zonesAdjacent(zone.bounds, z.bounds)
  );

  if (adjacentWaterZones.length === 0 && zone.terrainType !== 'water') return edges;

  // Use water-category land tiles (indices 13-18)
  const waterIndices = BIOME_LAND_INDICES.water;
  const gridW = Math.ceil(b.w / PLACE_TILE);
  const gridH = Math.ceil(b.h / PLACE_TILE);

  // Scan edges of zone
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const isEdge = gx <= 1 || gx >= gridW - 2 || gy <= 1 || gy >= gridH - 2;
      if (!isEdge && zone.terrainType !== 'water') continue;

      // For water zones, fill entire interior with water tiles
      // For non-water zones, only put water edges at boundaries facing water zones
      const wx = b.x + gx * PLACE_TILE;
      const wy = b.y + gy * PLACE_TILE;

      let shouldPlace = false;
      if (zone.terrainType === 'water') {
        shouldPlace = true;
      } else {
        // Check if this edge faces a water zone
        for (const wz of adjacentWaterZones) {
          if (Math.abs(wx - wz.bounds.x) < PLACE_TILE * 3 ||
              Math.abs(wx - (wz.bounds.x + wz.bounds.w)) < PLACE_TILE * 3 ||
              Math.abs(wy - wz.bounds.y) < PLACE_TILE * 3 ||
              Math.abs(wy - (wz.bounds.y + wz.bounds.h)) < PLACE_TILE * 3) {
            shouldPlace = true;
            break;
          }
        }
      }

      if (!shouldPlace) continue;

      const tileIdx = waterIndices[seededInt(gx, gy, zone.id * 137 + 29, waterIndices.length)];
      const tile = TROPICAL_LAND_TILES[tileIdx - 1];
      if (!tile) continue;

      edges.push({
        gx, gy, wx, wy,
        tilePath: tile.path,
        rotation: seededInt(gx + 1000, gy + 1000, zone.id * 139, 4) * 90,
        alpha: zone.terrainType === 'water' ? 0.9 : 0.6,
      });
    }
  }

  return edges;
}

function zonesAdjacent(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  const margin = PLACE_TILE * 5;
  return !(a.x + a.w + margin < b.x || b.x + b.w + margin < a.x ||
           a.y + a.h + margin < b.y || b.y + b.h + margin < a.y);
}

// ── Ocean Fill Data ────────────────────────────────────────────

/** Get ocean fill color based on depth from nearest land */
export function getOceanColor(wx: number, wy: number): string {
  // Find nearest zone
  let minDist = Infinity;
  for (const zone of ISLAND_ZONES) {
    const cx = zone.bounds.x + zone.bounds.w / 2;
    const cy = zone.bounds.y + zone.bounds.h / 2;
    const dx = wx - cx;
    const dy = wy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) - Math.max(zone.bounds.w, zone.bounds.h) / 2;
    if (dist < minDist) minDist = dist;
  }

  // Gradient: shallow near land → deep far from land
  const depth = Math.max(0, Math.min(1, minDist / 2000));
  const r = Math.round(20 - depth * 10);
  const g = Math.round(60 - depth * 20);
  const b = Math.round(90 + depth * 30);
  return `rgb(${r},${g},${b})`;
}

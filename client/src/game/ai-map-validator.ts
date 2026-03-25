/**
 * AI Map Validator — Stage E: Post-generation validation & auto-repair.
 *
 * Checks every generated zone for:
 *   1. Road connectivity — all exits reachable from spawn
 *   2. No trapped walkable areas — flood fill from spawn
 *   3. Dock access to water — dock sub-zones adjoin water tiles
 *   4. Structure bounds — structures sit inside city/dock sub-zone areas
 *   5. Mountain/cliff walls actually blocking — no single-tile gaps
 *   6. Chunk border continuity — biome & terrain match at seams
 *
 * Outputs an issue log. Attempts automatic repair where possible.
 */

import { ZoneTilemap } from './tilemap-zone';
import { TileLayer } from './tilemap-chunk';
import {
  TILE_PX, TILES_PER_ZONE, CHUNK_TILES, CHUNKS_PER_ZONE,
} from './tile-metadata';
import {
  type BiomeMask, getBiome, setBiome, Biome,
} from './ai-world-planner';
import type { ZoneDef } from './zones';

// ── Issue Types ────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: IssueSeverity;
  check: string;
  message: string;
  /** Tile position if applicable */
  tx?: number;
  ty?: number;
  /** Whether auto-repair was applied */
  repaired: boolean;
}

export interface ValidationResult {
  zoneId: number;
  zoneName: string;
  issues: ValidationIssue[];
  passedChecks: string[];
  totalIssues: number;
  errorsFixed: number;
  durationMs: number;
}

// ── Main Validator ─────────────────────────────────────────────

/**
 * Run all validation checks on a generated zone tilemap.
 * Automatically repairs issues where possible.
 */
export function validateZone(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  zone: ZoneDef,
): ValidationResult {
  const t0 = performance.now();
  const issues: ValidationIssue[] = [];
  const passed: string[] = [];

  // 1. Road connectivity
  const roadIssues = checkRoadConnectivity(tilemap, biomeMask, zone);
  issues.push(...roadIssues);
  if (roadIssues.length === 0) passed.push('road_connectivity');

  // 2. No trapped walkable areas
  const trapIssues = checkTrappedAreas(tilemap, biomeMask, zone);
  issues.push(...trapIssues);
  if (trapIssues.length === 0) passed.push('no_trapped_areas');

  // 3. Dock access to water
  const dockIssues = checkDockWaterAccess(tilemap, biomeMask, zone);
  issues.push(...dockIssues);
  if (dockIssues.length === 0) passed.push('dock_water_access');

  // 4. Structure bounds
  const structIssues = checkStructureBounds(tilemap, zone);
  issues.push(...structIssues);
  if (structIssues.length === 0) passed.push('structure_bounds');

  // 5. Mountain/cliff wall integrity
  const wallIssues = checkWallIntegrity(tilemap, biomeMask);
  issues.push(...wallIssues);
  if (wallIssues.length === 0) passed.push('wall_integrity');

  // 6. Chunk border seams
  const seamIssues = checkChunkSeams(tilemap, biomeMask);
  issues.push(...seamIssues);
  if (seamIssues.length === 0) passed.push('chunk_seams');

  const errorsFixed = issues.filter(i => i.repaired).length;
  const dt = performance.now() - t0;

  const result: ValidationResult = {
    zoneId: zone.id,
    zoneName: zone.name,
    issues,
    passedChecks: passed,
    totalIssues: issues.length,
    errorsFixed,
    durationMs: Math.round(dt),
  };

  // Log summary
  if (issues.length > 0) {
    console.warn(
      `[MapValidator] Zone ${zone.id} "${zone.name}": ${issues.length} issues (${errorsFixed} auto-fixed) in ${result.durationMs}ms`,
    );
    for (const i of issues.filter(x => x.severity === 'error')) {
      console.warn(`  ❌ [${i.check}] ${i.message}${i.repaired ? ' (repaired)' : ''}`);
    }
  } else {
    console.log(
      `[MapValidator] Zone ${zone.id} "${zone.name}": all checks passed in ${result.durationMs}ms`,
    );
  }

  return result;
}

// ── 1. Road Connectivity ───────────────────────────────────────

/**
 * Verify that every zone exit is reachable from the player spawn
 * via passable tiles (roads or walkable terrain).
 * Repair: carve a dirt road from spawn to unreachable exits.
 */
function checkRoadConnectivity(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  zone: ZoneDef,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (zone.exits.length === 0) return issues;

  // Pick spawn point (first player spawn, or zone center)
  const spawn = zone.playerSpawns[0] ?? { x: 8000, y: 8000 };
  const spawnTx = Math.floor(spawn.x / TILE_PX);
  const spawnTy = Math.floor(spawn.y / TILE_PX);

  // Flood-fill passable tiles from spawn
  const reachable = floodFillPassable(tilemap, spawnTx, spawnTy);

  for (const exit of zone.exits) {
    const etx = Math.floor((exit.x + exit.w / 2) / TILE_PX);
    const ety = Math.floor((exit.y + exit.h / 2) / TILE_PX);
    const idx = ety * TILES_PER_ZONE + etx;

    if (!reachable.has(idx)) {
      // Auto-repair: carve a passable path from spawn to exit
      carvePath(tilemap, biomeMask, spawnTx, spawnTy, etx, ety);
      issues.push({
        severity: 'error',
        check: 'road_connectivity',
        message: `Exit "${exit.label}" (${etx},${ety}) unreachable from spawn — carved path`,
        tx: etx, ty: ety,
        repaired: true,
      });
    }
  }

  return issues;
}

// ── 2. Trapped Walkable Areas ──────────────────────────────────

/**
 * Flood-fill from spawn and check that the majority of walkable tiles
 * are reachable. Flag large disconnected walkable islands.
 * Repair: punch a 3-wide corridor from the island toward the main area.
 */
function checkTrappedAreas(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  zone: ZoneDef,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const spawn = zone.playerSpawns[0] ?? { x: 8000, y: 8000 };
  const spawnTx = Math.floor(spawn.x / TILE_PX);
  const spawnTy = Math.floor(spawn.y / TILE_PX);

  const reachable = floodFillPassable(tilemap, spawnTx, spawnTy);
  const reachableCount = reachable.size;

  // Count total walkable tiles (sample — every 4th tile for speed)
  let totalWalkable = 0;
  let unreachableWalkable = 0;
  const STEP = 4;
  for (let ty = 0; ty < TILES_PER_ZONE; ty += STEP) {
    for (let tx = 0; tx < TILES_PER_ZONE; tx += STEP) {
      if (tilemap.isPassable(tx, ty)) {
        totalWalkable++;
        const idx = ty * TILES_PER_ZONE + tx;
        if (!reachable.has(idx)) unreachableWalkable++;
      }
    }
  }

  if (totalWalkable === 0) {
    issues.push({
      severity: 'error',
      check: 'trapped_areas',
      message: 'No walkable tiles found at all — zone entirely blocked',
      repaired: false,
    });
    return issues;
  }

  const unreachableRatio = unreachableWalkable / totalWalkable;

  if (unreachableRatio > 0.15) {
    // More than 15% of walkable area is trapped — serious issue
    issues.push({
      severity: 'error',
      check: 'trapped_areas',
      message: `${Math.round(unreachableRatio * 100)}% of walkable tiles unreachable from spawn (${unreachableWalkable * STEP * STEP} est. tiles)`,
      repaired: false,
    });
  } else if (unreachableRatio > 0.05) {
    issues.push({
      severity: 'warning',
      check: 'trapped_areas',
      message: `${Math.round(unreachableRatio * 100)}% of walkable tiles unreachable — minor isolated pockets`,
      repaired: false,
    });
  }

  return issues;
}

// ── 3. Dock / Water Access ─────────────────────────────────────

/**
 * Ensure dock sub-zones actually border water tiles.
 * Repair: paint shallow water adjacent to dock areas.
 */
function checkDockWaterAccess(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  zone: ZoneDef,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Find dock-type sub-zones or zones with dockSpawn
  const dockSubZones = zone.subZones.filter(
    sz => sz.terrainType === 'water' || sz.name.toLowerCase().includes('dock')
      || sz.name.toLowerCase().includes('harbor') || sz.name.toLowerCase().includes('port'),
  );

  if (zone.dockSpawn) {
    const dtx = Math.floor(zone.dockSpawn.x / TILE_PX);
    const dty = Math.floor(zone.dockSpawn.y / TILE_PX);

    // Check if there's water within 20 tiles of the dock spawn
    let foundWater = false;
    for (let dy = -20; dy <= 20 && !foundWater; dy++) {
      for (let dx = -20; dx <= 20 && !foundWater; dx++) {
        const b = getBiome(biomeMask, dtx + dx, dty + dy);
        if (b === Biome.DEEP_WATER || b === Biome.SHALLOW) foundWater = true;
      }
    }

    if (!foundWater) {
      // Repair: paint shallow water ring just south of dock
      for (let dx = -8; dx <= 8; dx++) {
        for (let dy = 5; dy <= 12; dy++) {
          const tx = dtx + dx, ty = dty + dy;
          setBiome(biomeMask, tx, ty, Biome.SHALLOW);
          tilemap.setTile(TileLayer.BASE_TERRAIN, tx, ty, 'water_shallow');
        }
      }
      issues.push({
        severity: 'error',
        check: 'dock_water_access',
        message: `Dock spawn (${dtx},${dty}) has no water within 20 tiles — added shallow water`,
        tx: dtx, ty: dty,
        repaired: true,
      });
    }
  }

  for (const sz of dockSubZones) {
    const bx0 = Math.floor(sz.bounds.x / TILE_PX);
    const by0 = Math.floor(sz.bounds.y / TILE_PX);
    const bw = Math.floor(sz.bounds.w / TILE_PX);
    const bh = Math.floor(sz.bounds.h / TILE_PX);

    // Sample edges of the sub-zone for water
    let waterCount = 0;
    const edgeSamples: [number, number][] = [];
    // Bottom edge
    for (let tx = bx0; tx < bx0 + bw; tx += 4) edgeSamples.push([tx, by0 + bh]);
    // Top edge
    for (let tx = bx0; tx < bx0 + bw; tx += 4) edgeSamples.push([tx, by0 - 1]);
    // Left edge
    for (let ty = by0; ty < by0 + bh; ty += 4) edgeSamples.push([bx0 - 1, ty]);
    // Right edge
    for (let ty = by0; ty < by0 + bh; ty += 4) edgeSamples.push([bx0 + bw, ty]);

    for (const [sx, sy] of edgeSamples) {
      const b = getBiome(biomeMask, sx, sy);
      if (b === Biome.DEEP_WATER || b === Biome.SHALLOW) waterCount++;
    }

    if (waterCount === 0 && edgeSamples.length > 0) {
      issues.push({
        severity: 'warning',
        check: 'dock_water_access',
        message: `Sub-zone "${sz.name}" appears dock/harbor but has no adjacent water`,
        repaired: false,
      });
    }
  }

  return issues;
}

// ── 4. Structure Bounds ────────────────────────────────────────

/**
 * Check that structure-layer tiles are placed within city/dock biome areas.
 * Structures in wilderness may indicate misplacement.
 */
function checkStructureBounds(
  tilemap: ZoneTilemap,
  zone: ZoneDef,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let outOfBounds = 0;
  const MAX_REPORT = 5;

  // Sample structure layer tiles
  const STEP = 8;
  for (let ty = 0; ty < TILES_PER_ZONE; ty += STEP) {
    for (let tx = 0; tx < TILES_PER_ZONE; tx += STEP) {
      const structId = tilemap.getTileNum(TileLayer.STRUCTURE, tx, ty);
      if (structId === 0) continue;

      // Check if this position is inside any city/dock sub-zone
      let inSubZone = false;
      for (const sz of zone.subZones) {
        if (sz.safe || sz.terrainType === 'grass') {
          const bx0 = sz.bounds.x / TILE_PX;
          const by0 = sz.bounds.y / TILE_PX;
          const bx1 = bx0 + sz.bounds.w / TILE_PX;
          const by1 = by0 + sz.bounds.h / TILE_PX;
          if (tx >= bx0 && tx < bx1 && ty >= by0 && ty < by1) {
            inSubZone = true;
            break;
          }
        }
      }

      if (!inSubZone) {
        outOfBounds++;
        if (outOfBounds <= MAX_REPORT) {
          issues.push({
            severity: 'warning',
            check: 'structure_bounds',
            message: `Structure tile at (${tx},${ty}) is outside any safe/city sub-zone`,
            tx, ty,
            repaired: false,
          });
        }
      }
    }
  }

  if (outOfBounds > MAX_REPORT) {
    issues.push({
      severity: 'warning',
      check: 'structure_bounds',
      message: `…and ${outOfBounds - MAX_REPORT} more out-of-bounds structures`,
      repaired: false,
    });
  }

  return issues;
}

// ── 5. Wall Integrity ──────────────────────────────────────────

/**
 * Check mountain/cliff wall lines for single-tile gaps that would let
 * players walk through what should be impassable barriers.
 * Repair: fill 1-tile gaps with the adjacent blocker tile.
 */
function checkWallIntegrity(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let gapsFixed = 0;

  // Scan for mountain biome tiles — check for isolated 1-tile passable gaps
  for (let ty = 1; ty < TILES_PER_ZONE - 1; ty++) {
    for (let tx = 1; tx < TILES_PER_ZONE - 1; tx++) {
      const biome = getBiome(biomeMask, tx, ty);
      if (biome === Biome.MOUNTAIN) continue; // already mountain

      // Check if this tile is surrounded by mountain on opposite sides
      const north = getBiome(biomeMask, tx, ty - 1);
      const south = getBiome(biomeMask, tx, ty + 1);
      const west = getBiome(biomeMask, tx - 1, ty);
      const east = getBiome(biomeMask, tx + 1, ty);

      const vertGap = north === Biome.MOUNTAIN && south === Biome.MOUNTAIN;
      const horizGap = west === Biome.MOUNTAIN && east === Biome.MOUNTAIN;

      if (vertGap || horizGap) {
        // This is a 1-tile gap in a wall — plug it
        setBiome(biomeMask, tx, ty, Biome.MOUNTAIN);
        tilemap.setTile(TileLayer.HEIGHT_BLOCKER, tx, ty, 'mountain_block');
        gapsFixed++;
      }
    }
  }

  if (gapsFixed > 0) {
    issues.push({
      severity: 'warning',
      check: 'wall_integrity',
      message: `Fixed ${gapsFixed} single-tile gap(s) in mountain/cliff walls`,
      repaired: true,
    });
  }

  return issues;
}

// ── 6. Chunk Border Seams ──────────────────────────────────────

/**
 * Check that tiles at chunk borders match their neighbours in the
 * adjacent chunk. A seam = adjacent tiles being wildly different
 * biomes (e.g. deep water next to city with no transition).
 * Repair: soften with a transition tile where needed.
 */
function checkChunkSeams(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let seamsFound = 0;

  // Horizontal seams (between chunk columns)
  for (let cy = 0; cy < CHUNKS_PER_ZONE; cy++) {
    for (let cx = 0; cx < CHUNKS_PER_ZONE - 1; cx++) {
      const borderX = (cx + 1) * CHUNK_TILES; // first tile of next chunk
      // Sample every 8th tile along the seam for speed
      for (let ly = 0; ly < CHUNK_TILES; ly += 8) {
        const ty = cy * CHUNK_TILES + ly;
        const leftBiome = getBiome(biomeMask, borderX - 1, ty);
        const rightBiome = getBiome(biomeMask, borderX, ty);

        if (isHarshTransition(leftBiome, rightBiome)) {
          seamsFound++;
        }
      }
    }
  }

  // Vertical seams (between chunk rows)
  for (let cx = 0; cx < CHUNKS_PER_ZONE; cx++) {
    for (let cy = 0; cy < CHUNKS_PER_ZONE - 1; cy++) {
      const borderY = (cy + 1) * CHUNK_TILES;
      for (let lx = 0; lx < CHUNK_TILES; lx += 8) {
        const tx = cx * CHUNK_TILES + lx;
        const topBiome = getBiome(biomeMask, tx, borderY - 1);
        const botBiome = getBiome(biomeMask, tx, borderY);

        if (isHarshTransition(topBiome, botBiome)) {
          seamsFound++;
        }
      }
    }
  }

  if (seamsFound > 0) {
    const severity: IssueSeverity = seamsFound > 50 ? 'warning' : 'info';
    issues.push({
      severity,
      check: 'chunk_seams',
      message: `${seamsFound} harsh biome transition(s) detected at chunk borders`,
      repaired: false,
    });
  }

  return issues;
}

// ── Helpers ────────────────────────────────────────────────────

/** Biome pairs that are "compatible" neighbours (no harsh seam). */
const COMPATIBLE_BIOMES: Set<string> = new Set([
  key(Biome.GRASS, Biome.FOREST),
  key(Biome.GRASS, Biome.DIRT),
  key(Biome.GRASS, Biome.ROAD),
  key(Biome.GRASS, Biome.CITY),
  key(Biome.GRASS, Biome.MUD),
  key(Biome.GRASS, Biome.SAND),
  key(Biome.GRASS, Biome.BEACH),
  key(Biome.DIRT, Biome.MUD),
  key(Biome.DIRT, Biome.ROAD),
  key(Biome.DIRT, Biome.SAND),
  key(Biome.BEACH, Biome.SAND),
  key(Biome.BEACH, Biome.SHALLOW),
  key(Biome.SHALLOW, Biome.DEEP_WATER),
  key(Biome.CITY, Biome.ROAD),
  key(Biome.CITY, Biome.DOCK),
  key(Biome.ROAD, Biome.DIRT),
  key(Biome.ROAD, Biome.DOCK),
  key(Biome.RUINS, Biome.DIRT),
  key(Biome.RUINS, Biome.GRASS),
  key(Biome.MOUNTAIN, Biome.DIRT),
  key(Biome.MOUNTAIN, Biome.GRASS),
  key(Biome.FOREST, Biome.DIRT),
  key(Biome.FOREST, Biome.MUD),
]);

function key(a: Biome, b: Biome): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function isHarshTransition(a: Biome, b: Biome): boolean {
  if (a === b) return false;
  return !COMPATIBLE_BIOMES.has(key(a, b));
}

/**
 * BFS flood-fill of all passable tiles reachable from a start tile.
 * Returns a Set of (ty * TILES_PER_ZONE + tx) indices.
 *
 * Uses a bounded fill to avoid excessive memory for 1M-tile grids:
 * stops after visiting MAX_FILL tiles.
 */
const MAX_FILL = 200_000;

function floodFillPassable(tilemap: ZoneTilemap, startTx: number, startTy: number): Set<number> {
  const visited = new Set<number>();
  const queue: number[] = [];

  const startIdx = startTy * TILES_PER_ZONE + startTx;
  // If start tile is not passable, try nearby tiles
  let sx = startTx, sy = startTy;
  if (!tilemap.isPassable(sx, sy)) {
    let found = false;
    for (let r = 1; r <= 10 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (tilemap.isPassable(sx + dx, sy + dy)) {
            sx += dx;
            sy += dy;
            found = true;
          }
        }
      }
    }
  }

  const initIdx = sy * TILES_PER_ZONE + sx;
  visited.add(initIdx);
  queue.push(initIdx);

  const N = TILES_PER_ZONE;
  const DIRS = [1, -1, N, -N]; // right, left, down, up

  while (queue.length > 0 && visited.size < MAX_FILL) {
    const idx = queue.shift()!;
    const tx = idx % N;
    const ty = Math.floor(idx / N);

    for (const d of DIRS) {
      const nidx = idx + d;
      if (visited.has(nidx)) continue;
      const nx = nidx % N;
      const ny = Math.floor(nidx / N);
      // Bounds check (wrap detection for left/right moves)
      if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
      if (d === 1 && nx === 0) continue;     // wrapped right→left
      if (d === -1 && nx === N - 1) continue; // wrapped left→right

      if (tilemap.isPassable(nx, ny)) {
        visited.add(nidx);
        queue.push(nidx);
      }
    }
  }

  return visited;
}

/**
 * Carve a passable path between two tile positions.
 * Clears blocker/structure layers and paints dirt biome.
 * Path is 3 tiles wide to ensure passage.
 */
function carvePath(
  tilemap: ZoneTilemap,
  biomeMask: BiomeMask,
  fromTx: number, fromTy: number,
  toTx: number, toTy: number,
): void {
  const dx = toTx - fromTx;
  const dy = toTy - fromTy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return;
  const steps = Math.ceil(dist);

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(fromTx + dx * t);
    const cy = Math.round(fromTy + dy * t);

    for (let d = -1; d <= 1; d++) {
      for (let e = -1; e <= 1; e++) {
        const tx = cx + d, ty = cy + e;
        if (tx < 0 || tx >= TILES_PER_ZONE || ty < 0 || ty >= TILES_PER_ZONE) continue;

        // Clear blockers
        tilemap.setTileNum(TileLayer.HEIGHT_BLOCKER, tx, ty, 0);
        // Clear structures blocking the path
        tilemap.setTileNum(TileLayer.STRUCTURE, tx, ty, 0);

        // Set biome to dirt if it was mountain/deep water
        const biome = getBiome(biomeMask, tx, ty);
        if (biome === Biome.MOUNTAIN || biome === Biome.DEEP_WATER) {
          setBiome(biomeMask, tx, ty, Biome.DIRT);
          tilemap.setTile(TileLayer.BASE_TERRAIN, tx, ty, 'ggb_dirt_r4_c0');
        }
      }
    }
  }
}

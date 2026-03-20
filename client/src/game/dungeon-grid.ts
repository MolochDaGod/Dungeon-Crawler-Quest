/**
 * Dungeon Collision Grid — Pathfinding-compatible grid built from DungeonTile[][].
 * Used by A* pathfinding, enemy AI patrol routes, and line-of-sight checks.
 * 
 * Each cell maps 1:1 to a DungeonTile at the same (tx, ty) position.
 * TILE_SIZE (40px) matches the dungeon coordinate system.
 */

import type { DungeonTile, DungeonRoom } from './dungeon';

// ── Constants ──────────────────────────────────────────────────

export const TILE_SIZE = 40;

const COST_FLOOR = 1.0;
const COST_DOOR  = 1.0;
const COST_TRAP  = 1.8;  // enemies avoid traps slightly
const COST_CHEST = 2.0;  // navigate around chests
const COST_WALL  = Infinity;

// Tile types considered walkable for pathfinding
const WALKABLE_TYPES = new Set<string>(['floor', 'door', 'stairs', 'trap', 'chest', 'spawn']);

// ── DungeonGrid ────────────────────────────────────────────────

export class DungeonGrid {
  readonly width: number;
  readonly height: number;
  readonly walkable: boolean[][];
  readonly cost: number[][];

  constructor(tiles: DungeonTile[][], width: number, height: number) {
    this.width = width;
    this.height = height;
    this.walkable = [];
    this.cost = [];

    for (let y = 0; y < height; y++) {
      this.walkable[y] = [];
      this.cost[y] = [];
      for (let x = 0; x < width; x++) {
        const tile = tiles[y]?.[x];
        if (!tile) {
          this.walkable[y][x] = false;
          this.cost[y][x] = Infinity;
          continue;
        }
        const isWalk = WALKABLE_TYPES.has(tile.type);
        this.walkable[y][x] = isWalk;
        if (!isWalk) {
          this.cost[y][x] = COST_WALL;
        } else if (tile.type === 'trap') {
          this.cost[y][x] = COST_TRAP;
        } else if (tile.type === 'chest') {
          this.cost[y][x] = COST_CHEST;
        } else if (tile.type === 'door') {
          this.cost[y][x] = COST_DOOR;
        } else {
          this.cost[y][x] = COST_FLOOR;
        }
      }
    }
  }

  // ── A* Compatible Interface ────────────────────────────────

  /** Is this grid cell walkable? */
  isGridWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return false;
    return this.walkable[ty][tx];
  }

  /** Get movement cost for this cell */
  getGridCost(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return Infinity;
    return this.cost[ty][tx];
  }

  /** Check if a world-space position is walkable */
  isWalkable(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    return this.isGridWalkable(tx, ty);
  }

  // ── Line of Sight ──────────────────────────────────────────

  /** Bresenham line-of-sight check between two tile coords */
  hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    while (cx !== x1 || cy !== y1) {
      if (!this.isGridWalkable(cx, cy)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx)  { err += dx; cy += sy; }
    }
    return this.isGridWalkable(x1, y1);
  }

  /** World-space line of sight */
  hasWorldLOS(ax: number, ay: number, bx: number, by: number): boolean {
    return this.hasLineOfSight(
      Math.floor(ax / TILE_SIZE), Math.floor(ay / TILE_SIZE),
      Math.floor(bx / TILE_SIZE), Math.floor(by / TILE_SIZE),
    );
  }

  // ── Room Helpers ───────────────────────────────────────────

  /** Get a random walkable floor tile within a room (world coordinates) */
  getRandomFloorInRoom(room: DungeonRoom): { x: number; y: number } {
    const candidates: { x: number; y: number }[] = [];
    for (let dy = 1; dy < room.h - 1; dy++) {
      for (let dx = 1; dx < room.w - 1; dx++) {
        const tx = room.x + dx;
        const ty = room.y + dy;
        if (this.isGridWalkable(tx, ty)) {
          candidates.push({
            x: tx * TILE_SIZE + TILE_SIZE / 2,
            y: ty * TILE_SIZE + TILE_SIZE / 2,
          });
        }
      }
    }
    if (candidates.length === 0) {
      return {
        x: (room.x + room.w / 2) * TILE_SIZE,
        y: (room.y + room.h / 2) * TILE_SIZE,
      };
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Find doorway tiles for a room (walkable tiles on the room border) */
  getDoorways(room: DungeonRoom): { x: number; y: number }[] {
    const doors: { x: number; y: number }[] = [];
    // Check edges of the room for walkable tiles that lead outside
    for (let dx = 0; dx < room.w; dx++) {
      // Top edge
      if (this.isGridWalkable(room.x + dx, room.y - 1)) {
        doors.push({ x: (room.x + dx) * TILE_SIZE + TILE_SIZE / 2, y: room.y * TILE_SIZE });
      }
      // Bottom edge
      if (this.isGridWalkable(room.x + dx, room.y + room.h)) {
        doors.push({ x: (room.x + dx) * TILE_SIZE + TILE_SIZE / 2, y: (room.y + room.h - 1) * TILE_SIZE + TILE_SIZE / 2 });
      }
    }
    for (let dy = 0; dy < room.h; dy++) {
      // Left edge
      if (this.isGridWalkable(room.x - 1, room.y + dy)) {
        doors.push({ x: room.x * TILE_SIZE, y: (room.y + dy) * TILE_SIZE + TILE_SIZE / 2 });
      }
      // Right edge
      if (this.isGridWalkable(room.x + room.w, room.y + dy)) {
        doors.push({ x: (room.x + room.w - 1) * TILE_SIZE + TILE_SIZE / 2, y: (room.y + dy) * TILE_SIZE + TILE_SIZE / 2 });
      }
    }
    return doors;
  }

  // ── Patrol Route Generation ────────────────────────────────

  /**
   * Generate patrol waypoints for enemies in a room.
   * Returns a loop of world-space points: room corners + doorways + optional corridor extensions.
   */
  generatePatrolRoute(room: DungeonRoom, rooms?: DungeonRoom[]): { x: number; y: number }[] {
    const waypoints: { x: number; y: number }[] = [];

    // 1. Pick 3-5 random floor tiles in the room
    const numInterior = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numInterior; i++) {
      waypoints.push(this.getRandomFloorInRoom(room));
    }

    // 2. Add doorway tiles
    const doors = this.getDoorways(room);
    for (const d of doors) {
      waypoints.push(d);
    }

    // 3. Optionally extend into connected corridors (50% chance per door)
    if (rooms) {
      for (const door of doors) {
        if (Math.random() < 0.5) {
          // Walk 3-5 tiles into the corridor
          const dtx = Math.floor(door.x / TILE_SIZE);
          const dty = Math.floor(door.y / TILE_SIZE);
          const cx = (room.x + room.w / 2);
          const cy = (room.y + room.h / 2);
          // Direction away from room center
          const dirX = dtx > cx ? 1 : dtx < cx ? -1 : 0;
          const dirY = dty > cy ? 1 : dty < cy ? -1 : 0;
          const steps = 3 + Math.floor(Math.random() * 3);
          let ex = dtx, ey = dty;
          for (let s = 0; s < steps; s++) {
            const nx = ex + dirX;
            const ny = ey + dirY;
            if (!this.isGridWalkable(nx, ny)) break;
            ex = nx; ey = ny;
          }
          if (ex !== dtx || ey !== dty) {
            waypoints.push({
              x: ex * TILE_SIZE + TILE_SIZE / 2,
              y: ey * TILE_SIZE + TILE_SIZE / 2,
            });
          }
        }
      }
    }

    // 4. Order waypoints into a loop using nearest-neighbor
    if (waypoints.length <= 1) return waypoints;
    return orderWaypointsNearestNeighbor(waypoints);
  }

  /**
   * Generate a corridor patrol route (back-and-forth between two points).
   * Used for enemies spawned in hallways.
   */
  generateCorridorPatrol(startX: number, startY: number, endX: number, endY: number): { x: number; y: number }[] {
    return [
      { x: startX, y: startY },
      { x: endX, y: endY },
    ];
  }

  // ── Which Room Contains a Point ────────────────────────────

  /** Find which room index a world position is inside */
  getRoomAt(worldX: number, worldY: number, rooms: DungeonRoom[]): number {
    const tx = Math.floor(worldX / TILE_SIZE);
    const ty = Math.floor(worldY / TILE_SIZE);
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return i;
    }
    return -1; // in a corridor or nowhere
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Order waypoints into an approximate loop using nearest-neighbor heuristic */
function orderWaypointsNearestNeighbor(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  const ordered: { x: number; y: number }[] = [];
  const remaining = [...points];
  ordered.push(remaining.splice(0, 1)[0]);

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dx = remaining[i].x - last.x;
      const dy = remaining[i].y - last.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  return ordered;
}

/** Build a DungeonGrid from the current dungeon state */
export function buildDungeonGrid(tiles: DungeonTile[][], mapWidth: number, mapHeight: number): DungeonGrid {
  return new DungeonGrid(tiles, mapWidth, mapHeight);
}

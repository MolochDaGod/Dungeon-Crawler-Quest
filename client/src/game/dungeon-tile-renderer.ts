/**
 * Dungeon Tile Renderer — autotiled sprite-based tile rendering.
 * Replaces colored rectangles with proper tileset sprites from craftpix dungeon tileset.
 *
 * Handles: floor variants, wall autotiling (NSEW bitmask), wall front-face depth,
 * doors (open/close by proximity), traps (animated), stairs, torches (animated),
 * and room decoration objects.
 */

import type { DungeonTile, DungeonRoom } from './dungeon';
import {
  DUNGEON_ASSETS,
  getTilesetImage,
  preloadDungeonTilesets,
  FLOOR_TILES,
  WALL_TILES,
  WALL_FRONT,
  CHEST_DOOR,
  TORCH_ANIM,
  SPIKE_TRAP_ANIM,
  ROOM_DECOR,
  getWallBitmask,
  type SpriteRegion,
  type AnimatedRegion,
} from './dungeon-tileset';

const TILE_SIZE = 40;

// ── Helpers ────────────────────────────────────────────────────

function drawRegion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  region: SpriteRegion,
  x: number, y: number,
  dw = TILE_SIZE, dh = TILE_SIZE,
): void {
  ctx.drawImage(img, region.x, region.y, region.w, region.h, x, y, dw, dh);
}

function animFrame(anim: AnimatedRegion, gameTime: number): SpriteRegion {
  const idx = Math.floor((gameTime * 1000) / anim.frameDuration) % anim.frames.length;
  return anim.frames[idx];
}

function isWall(tiles: DungeonTile[][], tx: number, ty: number, w: number, h: number): boolean {
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return true;
  return tiles[ty][tx].type === 'wall';
}

// Stable seed per tile for reproducible decoration
function tileSeed(tx: number, ty: number): number {
  return ((tx * 73856093) ^ (ty * 19349669)) >>> 0;
}

// ── Decoration Cache ───────────────────────────────────────────

interface RoomDecorItem {
  region: SpriteRegion;
  x: number;
  y: number;
}

// ── DungeonTileRenderer ────────────────────────────────────────

export class DungeonTileRenderer {
  private loading = false;
  private loaded = false;
  private roomDecorMap = new Map<number, RoomDecorItem[]>();

  /** Kick off tileset preload. Safe to call multiple times. */
  ensureLoaded(): void {
    if (this.loaded || this.loading) return;
    this.loading = true;
    preloadDungeonTilesets().then(() => {
      this.loaded = true;
      this.loading = false;
    });
  }

  /** Are tileset images ready? */
  isReady(): boolean { return this.loaded; }

  // ── Room Decoration Seeding ──────────────────────────────────

  /**
   * Seed decoration objects for all rooms. Call once per floor generation.
   * Uses a deterministic seed so decorations don't shuffle every frame.
   */
  seedDecorations(rooms: DungeonRoom[], tiles: DungeonTile[][], mapW: number, mapH: number): void {
    this.roomDecorMap.clear();
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const cfg = ROOM_DECOR[room.type] || ROOM_DECOR.normal;
      if (!cfg) continue;
      const items: RoomDecorItem[] = [];
      let placed = 0;

      for (let dy = 1; dy < room.h - 1 && placed < cfg.maxPerRoom; dy++) {
        for (let dx = 1; dx < room.w - 1 && placed < cfg.maxPerRoom; dx++) {
          const tx = room.x + dx;
          const ty = room.y + dy;
          if (tx >= mapW || ty >= mapH) continue;
          if (tiles[ty][tx].type !== 'floor') continue;

          const seed = tileSeed(tx, ty) % 1000;
          if (seed / 1000 > cfg.chance) continue;

          const region = cfg.pool[seed % cfg.pool.length];
          items.push({ region, x: tx * TILE_SIZE, y: ty * TILE_SIZE });
          placed++;
        }
      }
      this.roomDecorMap.set(i, items);
    }
  }

  // ── Single Tile Rendering ────────────────────────────────────

  /**
   * Render one dungeon tile at grid position (tx, ty).
   * Call this INSTEAD of voxel.drawDungeonTile.
   */
  renderTile(
    ctx: CanvasRenderingContext2D,
    tiles: DungeonTile[][],
    tx: number, ty: number,
    mapW: number, mapH: number,
    gameTime: number,
    playerX: number, playerY: number,
  ): void {
    const tile = tiles[ty][tx];
    const x = tx * TILE_SIZE;
    const y = ty * TILE_SIZE;

    const wallsFloorImg = getTilesetImage(DUNGEON_ASSETS.wallsFloor);
    const chestDoorImg = getTilesetImage(DUNGEON_ASSETS.chestDoorLever);

    switch (tile.type) {
      case 'floor':
      case 'spawn':
        this.drawFloor(ctx, wallsFloorImg, tiles, tx, ty, x, y, mapW, mapH);
        break;
      case 'wall':
        this.drawWall(ctx, wallsFloorImg, tiles, tx, ty, x, y, mapW, mapH);
        break;
      case 'door':
        this.drawDoor(ctx, wallsFloorImg, chestDoorImg, x, y, tx, ty, playerX, playerY);
        break;
      case 'stairs':
        this.drawStairs(ctx, wallsFloorImg, chestDoorImg, x, y);
        break;
      case 'trap':
        this.drawTrap(ctx, wallsFloorImg, x, y, gameTime);
        break;
      case 'chest':
        // Floor only — chest sprite rendered separately by DungeonRenderer.renderChests
        this.drawFloorBase(ctx, wallsFloorImg, x, y, tx, ty);
        break;
    }
  }

  // ── Tile Type Drawing ────────────────────────────────────────

  private drawFloorBase(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, tx: number, ty: number): void {
    if (img) {
      const variant = tileSeed(tx, ty) % FLOOR_TILES.length;
      drawRegion(ctx, img, FLOOR_TILES[variant], x, y);
    } else {
      ctx.fillStyle = '#2a1f14';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
    tiles: DungeonTile[][], tx: number, ty: number,
    x: number, y: number, mapW: number, mapH: number,
  ): void {
    // Base floor
    this.drawFloorBase(ctx, img, x, y, tx, ty);

    // Wall front-face depth: if north neighbor is a wall, draw its front face
    // overlapping the top portion of this floor tile for the "wall height" illusion
    if (img && isWall(tiles, tx, ty - 1, mapW, mapH)) {
      const frontVariant = tileSeed(tx, ty - 1) % WALL_FRONT.length;
      drawRegion(ctx, img, WALL_FRONT[frontVariant], x, y, TILE_SIZE, TILE_SIZE * 0.5);
    }

    // Small floor crack / pebble overlays (procedural, cheap)
    const seed = tileSeed(tx, ty) % 100;
    if (seed > 80 && tiles[ty][tx].decoration > 0) {
      ctx.fillStyle = 'rgba(80,80,60,0.12)';
      ctx.beginPath();
      ctx.arc(x + 12 + (seed % 16), y + 10 + (seed % 12), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawWall(
    ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
    tiles: DungeonTile[][], tx: number, ty: number,
    x: number, y: number, mapW: number, mapH: number,
  ): void {
    if (img) {
      const bitmask = getWallBitmask(
        isWall(tiles, tx, ty - 1, mapW, mapH),
        isWall(tiles, tx + 1, ty, mapW, mapH),
        isWall(tiles, tx, ty + 1, mapW, mapH),
        isWall(tiles, tx - 1, ty, mapW, mapH),
      );
      const wallRegion = WALL_TILES[bitmask] || WALL_TILES[0];
      drawRegion(ctx, img, wallRegion, x, y);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private drawDoor(
    ctx: CanvasRenderingContext2D,
    floorImg: HTMLImageElement | null,
    doorImg: HTMLImageElement | null,
    x: number, y: number,
    tx: number, ty: number,
    playerX: number, playerY: number,
  ): void {
    // Floor under door
    this.drawFloorBase(ctx, floorImg, x, y, tx, ty);

    // Door state: open if player is close
    const cx = x + TILE_SIZE / 2;
    const cy = y + TILE_SIZE / 2;
    const dx = cx - playerX;
    const dy = cy - playerY;
    const nearPlayer = dx * dx + dy * dy < (TILE_SIZE * 2.5) ** 2;

    if (doorImg) {
      const region = nearPlayer ? CHEST_DOOR.doorOpen : CHEST_DOOR.doorClosed;
      drawRegion(ctx, doorImg, region, x, y);
    } else {
      ctx.fillStyle = nearPlayer ? '#4a3520' : '#8B4513';
      ctx.fillRect(x + 8, y, TILE_SIZE - 16, TILE_SIZE);
    }
  }

  private drawStairs(
    ctx: CanvasRenderingContext2D,
    floorImg: HTMLImageElement | null,
    doorImg: HTMLImageElement | null,
    x: number, y: number,
  ): void {
    if (floorImg) drawRegion(ctx, floorImg, FLOOR_TILES[0], x, y);
    if (doorImg) {
      drawRegion(ctx, doorImg, CHEST_DOOR.stairsDown, x, y);
    } else {
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
  }

  private drawTrap(
    ctx: CanvasRenderingContext2D,
    floorImg: HTMLImageElement | null,
    x: number, y: number,
    gameTime: number,
  ): void {
    if (floorImg) drawRegion(ctx, floorImg, FLOOR_TILES[0], x, y);

    const spikeImg = getTilesetImage(DUNGEON_ASSETS.spikeTrap);
    if (spikeImg) {
      const frame = animFrame(SPIKE_TRAP_ANIM, gameTime);
      drawRegion(ctx, spikeImg, frame, x, y);
    } else {
      ctx.fillStyle = 'rgba(245,158,11,0.5)';
      ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    }
  }

  // ── Animated Torches (rendered after all tiles) ──────────────

  /**
   * Render animated torch sprites on walls that border floor tiles.
   * Call once after the main tile loop.
   */
  renderTorches(
    ctx: CanvasRenderingContext2D,
    tiles: DungeonTile[][],
    mapW: number, mapH: number,
    gameTime: number,
    visibleTiles: Set<number>,
    startTX: number, startTY: number,
    endTX: number, endTY: number,
  ): void {
    const fireImg = getTilesetImage(DUNGEON_ASSETS.fire);
    if (!fireImg) return;

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        if (!visibleTiles.has(ty * mapW + tx)) continue;
        const tile = tiles[ty]?.[tx];
        if (!tile || tile.type !== 'wall') continue;

        // Only place torches on walls that touch a floor
        const hasFloor =
          (tx > 0 && tiles[ty][tx - 1]?.type !== 'wall') ||
          (tx < mapW - 1 && tiles[ty][tx + 1]?.type !== 'wall') ||
          (ty > 0 && tiles[ty - 1]?.[tx]?.type !== 'wall') ||
          (ty < mapH - 1 && tiles[ty + 1]?.[tx]?.type !== 'wall');
        if (!hasFloor) continue;

        // Deterministic placement — ~25% of eligible walls get a torch
        const seed = tileSeed(tx, ty) % 100;
        if (seed > 25) continue;

        const frame = animFrame(TORCH_ANIM, gameTime + seed * 0.01);
        const wx = tx * TILE_SIZE + TILE_SIZE / 2 - 16;
        const wy = ty * TILE_SIZE - 8;
        ctx.drawImage(fireImg, frame.x, frame.y, frame.w, frame.h, wx, wy, 32, 32);
      }
    }
  }

  // ── Room Decorations (rendered after tiles, before entities) ─

  /**
   * Render decoration objects (barrels, bones, chains, etc.) placed in rooms.
   * Only renders items in currently visible tiles.
   */
  renderDecorations(
    ctx: CanvasRenderingContext2D,
    visibleTiles: Set<number>,
    mapW: number,
  ): void {
    const objectsImg = getTilesetImage(DUNGEON_ASSETS.objects);
    if (!objectsImg) return;

    this.roomDecorMap.forEach((items) => {
      for (const item of items) {
        const tx = Math.floor(item.x / TILE_SIZE);
        const ty = Math.floor(item.y / TILE_SIZE);
        if (!visibleTiles.has(ty * mapW + tx)) continue;
        // Draw decoration slightly smaller and centered within the tile
        drawRegion(ctx, objectsImg, item.region, item.x + 6, item.y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
      }
    });
  }
}

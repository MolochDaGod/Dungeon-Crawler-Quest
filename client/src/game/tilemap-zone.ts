/**
 * Zone Tilemap Manager — Holds the 8×8 chunk grid for the active zone.
 *
 * Provides:
 *   - setTile / getTile by world tile coords + layer
 *   - isPassable check (blockers + structures + water)
 *   - Camera-based visible chunk list
 *   - Chunk generation trigger (delegates to ai-chunk-generator)
 */

import { CHUNK_TILES, CHUNKS_PER_ZONE, TILES_PER_ZONE, TILE_PX, type TileMeta, getTileMeta } from './tile-metadata';
import {
  TileChunk, TileLayer, LAYER_COUNT,
  worldTileToChunk, worldPxToTile, tileToWorldPx, getVisibleChunks,
  type ChunkCoord,
} from './tilemap-chunk';

// ── Zone Tilemap ───────────────────────────────────────────────

export class ZoneTilemap {
  /** Zone ID this tilemap belongs to */
  readonly zoneId: number;
  /** 8×8 grid of chunks (row-major: chunks[cy][cx]) */
  private chunks: TileChunk[][];
  /** Tile ID → TileMeta index for fast passability checks */
  private _tileIdMap: Map<number, string>;
  /** Auto-incrementing tile ID counter */
  private _nextTileId: number;
  /** Map tile string ID → numeric ID */
  private _idToNum: Map<string, number>;
  /** Map numeric ID → string ID */
  private _numToId: Map<number, string>;

  constructor(zoneId: number) {
    this.zoneId = zoneId;
    this._tileIdMap = new Map();
    this._nextTileId = 1; // 0 = empty
    this._idToNum = new Map();
    this._numToId = new Map();

    // Create empty 8×8 chunk grid
    this.chunks = [];
    for (let cy = 0; cy < CHUNKS_PER_ZONE; cy++) {
      this.chunks[cy] = [];
      for (let cx = 0; cx < CHUNKS_PER_ZONE; cx++) {
        this.chunks[cy][cx] = new TileChunk(cx, cy);
      }
    }
  }

  // ── Tile ID Mapping ────────────────────────────────────────

  /** Convert a string tile meta ID to a numeric tile ID for storage */
  resolveTileId(metaId: string): number {
    const existing = this._idToNum.get(metaId);
    if (existing != null) return existing;
    const num = this._nextTileId++;
    this._idToNum.set(metaId, num);
    this._numToId.set(num, metaId);
    return num;
  }

  /** Get the string meta ID from a numeric tile ID */
  getMetaId(numId: number): string | undefined {
    return this._numToId.get(numId);
  }

  /** Get the TileMeta for a numeric tile ID */
  getMetaForId(numId: number): TileMeta | undefined {
    const metaId = this._numToId.get(numId);
    if (!metaId) return undefined;
    return getTileMeta(metaId);
  }

  // ── Chunk Access ───────────────────────────────────────────

  /** Get a chunk by chunk coordinates */
  getChunk(cx: number, cy: number): TileChunk | null {
    if (cx < 0 || cx >= CHUNKS_PER_ZONE || cy < 0 || cy >= CHUNKS_PER_ZONE) return null;
    return this.chunks[cy][cx];
  }

  /** Get visible chunks for the current camera */
  getVisibleChunks(camX: number, camY: number, viewW: number, viewH: number): TileChunk[] {
    const coords = getVisibleChunks(camX, camY, viewW, viewH);
    return coords.map(c => this.chunks[c.cy]?.[c.cx]).filter(Boolean);
  }

  // ── Tile Get/Set ───────────────────────────────────────────

  /** Set a tile by world tile coordinates (0..999) */
  setTile(layer: TileLayer, tileX: number, tileY: number, metaId: string): void {
    const { cx, cy, lx, ly } = worldTileToChunk(tileX, tileY);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return;
    const numId = this.resolveTileId(metaId);
    chunk.set(layer, lx, ly, numId);
  }

  /** Set a tile by numeric ID (for bulk operations) */
  setTileNum(layer: TileLayer, tileX: number, tileY: number, numId: number): void {
    const { cx, cy, lx, ly } = worldTileToChunk(tileX, tileY);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return;
    chunk.set(layer, lx, ly, numId);
  }

  /** Get the numeric tile ID at world tile coords */
  getTileNum(layer: TileLayer, tileX: number, tileY: number): number {
    const { cx, cy, lx, ly } = worldTileToChunk(tileX, tileY);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return 0;
    return chunk.get(layer, lx, ly);
  }

  /** Get the string meta ID at world tile coords */
  getTileMetaId(layer: TileLayer, tileX: number, tileY: number): string | undefined {
    const num = this.getTileNum(layer, tileX, tileY);
    if (num === 0) return undefined;
    return this._numToId.get(num);
  }

  /** Get the full TileMeta at world tile coords */
  getTileMeta(layer: TileLayer, tileX: number, tileY: number): TileMeta | undefined {
    const metaId = this.getTileMetaId(layer, tileX, tileY);
    if (!metaId) return undefined;
    return getTileMeta(metaId);
  }

  // ── Multi-tile placement ───────────────────────────────────

  /** Place a multi-tile sprite (e.g. 4×6 tree) anchored at top-left tile */
  placeMultiTile(layer: TileLayer, tileX: number, tileY: number, meta: TileMeta): void {
    const numId = this.resolveTileId(meta.id);
    for (let dy = 0; dy < meta.heightTiles; dy++) {
      for (let dx = 0; dx < meta.widthTiles; dx++) {
        this.setTileNum(layer, tileX + dx, tileY + dy, numId);
      }
    }
  }

  // ── Passability ────────────────────────────────────────────

  /** Check if a world tile position is passable */
  isPassable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileX >= TILES_PER_ZONE || tileY < 0 || tileY >= TILES_PER_ZONE) return false;

    const { cx, cy, lx, ly } = worldTileToChunk(tileX, tileY);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return false;

    // Fast path: check blocker layers directly
    if (chunk.isBlocked(lx, ly)) return false;

    // Check water (impassable without boat)
    const waterTile = chunk.get(TileLayer.BASE_TERRAIN, lx, ly);
    if (waterTile !== 0) {
      const meta = this.getMetaForId(waterTile);
      if (meta && !meta.passable) return false;
    }

    // Check prop layer (some props like fences block)
    const propTile = chunk.get(TileLayer.PROP, lx, ly);
    if (propTile !== 0) {
      const meta = this.getMetaForId(propTile);
      if (meta && !meta.passable) return false;
    }

    return true;
  }

  /** Check passability at world PIXEL coords */
  isPassableAtPx(worldX: number, worldY: number): boolean {
    const { tx, ty } = worldPxToTile(worldX, worldY);
    return this.isPassable(tx, ty);
  }

  // ── Fill Operations ────────────────────────────────────────

  /** Fill an entire zone layer with one tile */
  fillLayer(layer: TileLayer, metaId: string): void {
    const numId = this.resolveTileId(metaId);
    for (let cy = 0; cy < CHUNKS_PER_ZONE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_ZONE; cx++) {
        this.chunks[cy][cx].fill(layer, numId);
      }
    }
  }

  /** Fill a world-tile rectangle on a layer */
  fillRect(layer: TileLayer, x0: number, y0: number, w: number, h: number, metaId: string): void {
    const numId = this.resolveTileId(metaId);
    for (let ty = y0; ty < y0 + h; ty++) {
      for (let tx = x0; tx < x0 + w; tx++) {
        this.setTileNum(layer, tx, ty, numId);
      }
    }
  }

  // ── Chunk Generation Status ────────────────────────────────

  /** Mark a chunk as generated */
  markGenerated(cx: number, cy: number): void {
    const chunk = this.getChunk(cx, cy);
    if (chunk) {
      chunk.generated = true;
      chunk.dirty = true;
    }
  }

  /** Check if a chunk has been generated */
  isChunkGenerated(cx: number, cy: number): boolean {
    return this.getChunk(cx, cy)?.generated ?? false;
  }

  /** Get all ungenerated chunks */
  getUngeneratedChunks(): ChunkCoord[] {
    const result: ChunkCoord[] = [];
    for (let cy = 0; cy < CHUNKS_PER_ZONE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_ZONE; cx++) {
        if (!this.chunks[cy][cx].generated) {
          result.push({ cx, cy });
        }
      }
    }
    return result;
  }

  // ── Clear ──────────────────────────────────────────────────

  /** Clear all chunk data (for zone transition) */
  clearAll(): void {
    for (let cy = 0; cy < CHUNKS_PER_ZONE; cy++) {
      for (let cx = 0; cx < CHUNKS_PER_ZONE; cx++) {
        this.chunks[cy][cx].clear();
      }
    }
  }
}

// ── Singleton for active zone ──────────────────────────────────

let _activeZoneTilemap: ZoneTilemap | null = null;

export function getActiveZoneTilemap(): ZoneTilemap | null {
  return _activeZoneTilemap;
}

export function setActiveZoneTilemap(tm: ZoneTilemap | null): void {
  _activeZoneTilemap = tm;
}

/** Create a fresh tilemap for a zone */
export function createZoneTilemap(zoneId: number): ZoneTilemap {
  const tm = new ZoneTilemap(zoneId);
  _activeZoneTilemap = tm;
  return tm;
}

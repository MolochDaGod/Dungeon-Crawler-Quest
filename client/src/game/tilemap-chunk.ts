/**
 * Tilemap Chunk — 125×125 tile grid with 7 render layers.
 *
 * Each zone (1000×1000 tiles) is divided into 8×8 chunks.
 * Each chunk stores tile IDs per layer per cell.
 * Tile ID 0 = empty (no tile). Positive IDs index into tile-metadata registry.
 *
 * Layers (bottom to top):
 *   0: base_terrain   — grass, dirt, sand, water
 *   1: biome_overlay   — forest density, swamp patches
 *   2: height_blocker  — mountains, cliffs (impassable)
 *   3: road            — dirt paths, cobblestone, bridges
 *   4: structure       — houses, walls, gates, docks
 *   5: prop            — trees, rocks, bushes, lamps, barrels
 *   6: metadata        — spawn zones, resource zones, faction influence
 */

import { CHUNK_TILES, CHUNKS_PER_ZONE, TILES_PER_ZONE, TILE_PX } from './tile-metadata';

// ── Constants ──────────────────────────────────────────────────

export const LAYER_COUNT = 7;

export const enum TileLayer {
  BASE_TERRAIN  = 0,
  BIOME_OVERLAY = 1,
  HEIGHT_BLOCKER = 2,
  ROAD          = 3,
  STRUCTURE     = 4,
  PROP          = 5,
  METADATA      = 6,
}

export const LAYER_NAMES: string[] = [
  'base_terrain', 'biome_overlay', 'height_blocker',
  'road', 'structure', 'prop', 'metadata',
];

// ── Chunk Coordinate ───────────────────────────────────────────

export interface ChunkCoord {
  /** Chunk column (0..7) */
  cx: number;
  /** Chunk row (0..7) */
  cy: number;
}

// ── Tile Chunk ─────────────────────────────────────────────────

/**
 * A single chunk: 125×125 tiles, 7 layers.
 * Data stored as flat Uint16Arrays for memory efficiency.
 * Each layer = CHUNK_TILES * CHUNK_TILES Uint16 values.
 * Value 0 = empty. Positive = tile registry index.
 */
export class TileChunk {
  readonly cx: number;
  readonly cy: number;
  /** 7 flat arrays, each CHUNK_TILES² elements */
  readonly layers: Uint16Array[];
  /** Whether this chunk has been generated */
  generated: boolean;
  /** Whether this chunk is dirty (needs re-render) */
  dirty: boolean;

  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
    this.generated = false;
    this.dirty = true;
    const size = CHUNK_TILES * CHUNK_TILES;
    this.layers = Array.from({ length: LAYER_COUNT }, () => new Uint16Array(size));
  }

  /** Get tile ID at local chunk position (lx, ly) on a layer */
  get(layer: TileLayer, lx: number, ly: number): number {
    if (lx < 0 || lx >= CHUNK_TILES || ly < 0 || ly >= CHUNK_TILES) return 0;
    return this.layers[layer][ly * CHUNK_TILES + lx];
  }

  /** Set tile ID at local chunk position */
  set(layer: TileLayer, lx: number, ly: number, tileId: number): void {
    if (lx < 0 || lx >= CHUNK_TILES || ly < 0 || ly >= CHUNK_TILES) return;
    this.layers[layer][ly * CHUNK_TILES + lx] = tileId;
    this.dirty = true;
  }

  /** Fill an entire layer with one tile ID */
  fill(layer: TileLayer, tileId: number): void {
    this.layers[layer].fill(tileId);
    this.dirty = true;
  }

  /** Fill a rectangular region on a layer */
  fillRect(layer: TileLayer, x0: number, y0: number, w: number, h: number, tileId: number): void {
    const x1 = Math.min(x0 + w, CHUNK_TILES);
    const y1 = Math.min(y0 + h, CHUNK_TILES);
    const data = this.layers[layer];
    for (let y = Math.max(0, y0); y < y1; y++) {
      for (let x = Math.max(0, x0); x < x1; x++) {
        data[y * CHUNK_TILES + x] = tileId;
      }
    }
    this.dirty = true;
  }

  /** Check if ANY blocker layer tile is set at a position */
  isBlocked(lx: number, ly: number): boolean {
    if (lx < 0 || lx >= CHUNK_TILES || ly < 0 || ly >= CHUNK_TILES) return true;
    const idx = ly * CHUNK_TILES + lx;
    // Height blockers (mountains, cliffs)
    if (this.layers[TileLayer.HEIGHT_BLOCKER][idx] !== 0) return true;
    // Structure layer (buildings block)
    if (this.layers[TileLayer.STRUCTURE][idx] !== 0) return true;
    return false;
  }

  /** Clear all layers */
  clear(): void {
    for (const layer of this.layers) layer.fill(0);
    this.generated = false;
    this.dirty = true;
  }

  // ── Serialization ──────────────────────────────────────────

  /** Serialize to a compact binary blob for save/load */
  serialize(): ArrayBuffer {
    const layerSize = CHUNK_TILES * CHUNK_TILES * 2; // 2 bytes per Uint16
    const header = 8; // cx(2) + cy(2) + generated(1) + padding(3)
    const buf = new ArrayBuffer(header + LAYER_COUNT * layerSize);
    const view = new DataView(buf);
    view.setUint16(0, this.cx);
    view.setUint16(2, this.cy);
    view.setUint8(4, this.generated ? 1 : 0);

    for (let l = 0; l < LAYER_COUNT; l++) {
      const offset = header + l * layerSize;
      const src = this.layers[l];
      for (let i = 0; i < src.length; i++) {
        view.setUint16(offset + i * 2, src[i]);
      }
    }
    return buf;
  }

  /** Deserialize from binary blob */
  static deserialize(buf: ArrayBuffer): TileChunk {
    const view = new DataView(buf);
    const cx = view.getUint16(0);
    const cy = view.getUint16(2);
    const chunk = new TileChunk(cx, cy);
    chunk.generated = view.getUint8(4) === 1;

    const layerSize = CHUNK_TILES * CHUNK_TILES * 2;
    const header = 8;
    for (let l = 0; l < LAYER_COUNT; l++) {
      const offset = header + l * layerSize;
      for (let i = 0; i < chunk.layers[l].length; i++) {
        chunk.layers[l][i] = view.getUint16(offset + i * 2);
      }
    }
    chunk.dirty = true;
    return chunk;
  }
}

// ── Coordinate Conversion ──────────────────────────────────────

/** Convert world tile coords (0..999) to chunk coord + local tile coords */
export function worldTileToChunk(tileX: number, tileY: number): {
  cx: number; cy: number; lx: number; ly: number;
} {
  const cx = Math.floor(tileX / CHUNK_TILES);
  const cy = Math.floor(tileY / CHUNK_TILES);
  const lx = tileX - cx * CHUNK_TILES;
  const ly = tileY - cy * CHUNK_TILES;
  return { cx, cy, lx, ly };
}

/** Convert world pixel coords to world tile coords */
export function worldPxToTile(worldX: number, worldY: number): { tx: number; ty: number } {
  return {
    tx: Math.floor(worldX / TILE_PX),
    ty: Math.floor(worldY / TILE_PX),
  };
}

/** Convert world tile coords to world pixel coords (top-left of tile) */
export function tileToWorldPx(tx: number, ty: number): { wx: number; wy: number } {
  return { wx: tx * TILE_PX, wy: ty * TILE_PX };
}

/** Convert chunk coord + local tile to world tile coords */
export function chunkLocalToWorld(cx: number, cy: number, lx: number, ly: number): { tx: number; ty: number } {
  return {
    tx: cx * CHUNK_TILES + lx,
    ty: cy * CHUNK_TILES + ly,
  };
}

/** Get which chunks are visible given a camera rect in world pixels */
export function getVisibleChunks(
  camX: number, camY: number, viewW: number, viewH: number,
): ChunkCoord[] {
  const left = Math.max(0, Math.floor((camX - viewW / 2) / TILE_PX / CHUNK_TILES));
  const right = Math.min(CHUNKS_PER_ZONE - 1, Math.floor((camX + viewW / 2) / TILE_PX / CHUNK_TILES));
  const top = Math.max(0, Math.floor((camY - viewH / 2) / TILE_PX / CHUNK_TILES));
  const bottom = Math.min(CHUNKS_PER_ZONE - 1, Math.floor((camY + viewH / 2) / TILE_PX / CHUNK_TILES));

  const chunks: ChunkCoord[] = [];
  for (let cy = top; cy <= bottom; cy++) {
    for (let cx = left; cx <= right; cx++) {
      chunks.push({ cx, cy });
    }
  }
  return chunks;
}

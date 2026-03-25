/**
 * Tilemap Renderer V2 — Chunk-Based 16px Tile Rendering
 *
 * Renders the active ZoneTilemap by:
 *   1. Determining visible chunks from camera position
 *   2. For each visible chunk, drawing 7 layers bottom-to-top
 *   3. Using sprite sheet cache for efficient image loading
 *   4. Drawing at pixel-perfect 16px scale with imageRendering: pixelated
 */

import { TILE_PX, CHUNK_TILES, TILES_PER_ZONE, type TileMeta, getTileMeta } from './tile-metadata';
import { TileChunk, TileLayer, LAYER_COUNT, tileToWorldPx } from './tilemap-chunk';
import { ZoneTilemap, getActiveZoneTilemap } from './tilemap-zone';

// ── Sprite Sheet Cache ─────────────────────────────────────────

const _sheetCache = new Map<string, HTMLImageElement>();
const _loadingSheets = new Set<string>();

function loadSheet(src: string): HTMLImageElement | null {
  const cached = _sheetCache.get(src);
  if (cached) return cached.complete ? cached : null;
  if (_loadingSheets.has(src)) return null;
  _loadingSheets.add(src);
  const img = new Image();
  img.src = src;
  img.onload = () => { _sheetCache.set(src, img); _loadingSheets.delete(src); };
  img.onerror = () => { _loadingSheets.delete(src); };
  _sheetCache.set(src, img);
  return null;
}

// ── Render Constants ───────────────────────────────────────────

/** Layers to render (in order). Skip METADATA layer (6) since it's not visual. */
const RENDER_LAYERS: TileLayer[] = [
  TileLayer.BASE_TERRAIN,
  TileLayer.BIOME_OVERLAY,
  TileLayer.HEIGHT_BLOCKER,
  TileLayer.ROAD,
  TileLayer.STRUCTURE,
  TileLayer.PROP,
];

// ── Renderer ───────────────────────────────────────────────────

/**
 * Render the active zone tilemap to the canvas.
 * Call this from OpenWorldRenderer.renderTerrain().
 *
 * @param ctx - Canvas 2D context (already translated by camera)
 * @param camX - Camera center X in world pixels
 * @param camY - Camera center Y in world pixels
 * @param viewW - Viewport width in world pixels
 * @param viewH - Viewport height in world pixels
 */
export function renderTilemap(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
): void {
  const tilemap = getActiveZoneTilemap();
  if (!tilemap) return;

  // Calculate visible tile range
  const leftTile = Math.max(0, Math.floor((camX - viewW / 2) / TILE_PX) - 1);
  const rightTile = Math.min(TILES_PER_ZONE - 1, Math.ceil((camX + viewW / 2) / TILE_PX) + 1);
  const topTile = Math.max(0, Math.floor((camY - viewH / 2) / TILE_PX) - 1);
  const bottomTile = Math.min(TILES_PER_ZONE - 1, Math.ceil((camY + viewH / 2) / TILE_PX) + 1);

  // Camera offset for drawing (ctx is already translated to world origin by the caller)
  // Each tile draws at (tx * TILE_PX, ty * TILE_PX) in world coords

  // Draw each render layer
  for (const layer of RENDER_LAYERS) {
    for (let ty = topTile; ty <= bottomTile; ty++) {
      for (let tx = leftTile; tx <= rightTile; tx++) {
        const numId = tilemap.getTileNum(layer, tx, ty);
        if (numId === 0) continue;

        const metaId = tilemap.getMetaId(numId);
        if (!metaId) continue;

        const meta = getTileMeta(metaId);
        if (!meta) continue;

        const sheet = loadSheet(meta.sheet);
        if (!sheet) {
          // Fallback: draw a colored rectangle based on type
          drawFallback(ctx, tx, ty, meta);
          continue;
        }

        // Draw the sprite at the world position
        const worldX = tx * TILE_PX;
        const worldY = ty * TILE_PX;
        const drawW = meta.widthTiles * TILE_PX;
        const drawH = meta.heightTiles * TILE_PX;

        ctx.drawImage(
          sheet,
          meta.sx, meta.sy, meta.sw, meta.sh,
          worldX, worldY, drawW, drawH,
        );
      }
    }
  }
}

// ── Fallback rendering ─────────────────────────────────────────

const FALLBACK_COLORS: Record<string, string> = {
  terrain:   '#3a6a2a',
  structure: '#6a5030',
  prop:      '#2a5a1a',
  road:      '#8a7050',
  blocker:   '#5a5a6a',
  water:     '#1a3a5a',
  actor:     '#ff0000',
};

function drawFallback(ctx: CanvasRenderingContext2D, tx: number, ty: number, meta: TileMeta): void {
  const worldX = tx * TILE_PX;
  const worldY = ty * TILE_PX;
  const drawW = meta.widthTiles * TILE_PX;
  const drawH = meta.heightTiles * TILE_PX;

  ctx.fillStyle = FALLBACK_COLORS[meta.type] || '#4a4a4a';
  ctx.globalAlpha = 0.6;
  ctx.fillRect(worldX, worldY, drawW, drawH);
  ctx.globalAlpha = 1;
}

// ── Ocean rendering (outside island) ───────────────────────────

/**
 * Render the ocean background for tiles outside the island.
 * The biome mask marks DEEP_WATER tiles at the edges.
 * This renders a smooth ocean gradient as the background layer.
 */
export function renderOceanBackground(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  time: number,
): void {
  const worldSize = TILES_PER_ZONE * TILE_PX;

  // Base ocean gradient
  const grad = ctx.createRadialGradient(
    worldSize / 2, worldSize / 2, worldSize * 0.3,
    worldSize / 2, worldSize / 2, worldSize * 0.6,
  );
  grad.addColorStop(0, '#0e2a4a');
  grad.addColorStop(0.5, '#0c2040');
  grad.addColorStop(1, '#081830');
  ctx.fillStyle = grad;

  const left = camX - viewW / 2;
  const top = camY - viewH / 2;
  ctx.fillRect(left, top, viewW, viewH);

  // Subtle animated wave shimmer
  const now = time;
  const waveSize = 200;
  const sx = Math.floor(left / waveSize) - 1;
  const sy = Math.floor(top / waveSize) - 1;
  const ex = Math.ceil((left + viewW) / waveSize) + 1;
  const ey = Math.ceil((top + viewH) / waveSize) + 1;

  for (let wy = sy; wy <= ey; wy++) {
    for (let wx = sx; wx <= ex; wx++) {
      const w1 = Math.sin(now * 0.0008 + wx * 0.4 + wy * 0.3) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(40,100,160,${0.04 + w1 * 0.06})`;
      ctx.fillRect(wx * waveSize, wy * waveSize, waveSize, waveSize);
    }
  }
}

// ── Zone exit rendering ────────────────────────────────────────

import type { ZoneExit } from './zones';

/**
 * Render zone exit markers (glowing areas at edges).
 */
export function renderZoneExits(
  ctx: CanvasRenderingContext2D,
  exits: ZoneExit[],
  time: number,
): void {
  const pulse = 0.5 + Math.sin(time * 0.003) * 0.3;

  for (const exit of exits) {
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);

    // Arrow indicator
    ctx.globalAlpha = pulse + 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const cx = exit.x + exit.w / 2;
    const cy = exit.y + exit.h / 2;
    const arrow = exit.edge === 'north' ? '▲' : exit.edge === 'south' ? '▼' : exit.edge === 'west' ? '◀' : '▶';
    ctx.fillText(arrow, cx, cy + 5);

    // Label
    ctx.font = '10px sans-serif';
    ctx.fillText(exit.label, cx, cy + (exit.edge === 'north' ? -10 : 20));
    ctx.globalAlpha = 1;
  }
}

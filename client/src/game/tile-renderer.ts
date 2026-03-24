/**
 * Tile Map Renderer — Top-Down 2D Tile Rendering
 * Renders terrain, roads, buildings, decorations, water, and shadows
 * using tropical medieval city tilesets (256×256) + AI terrain placement.
 *
 * Asset packs:
 *   tropical-city  — land, road, buildings, decor (256px tiles)
 *   house-constructor — pixel house tiles (32px)
 *   castle-defense — field tiles (32px)
 *   river-creatures — water zone enemies
 *
 * Uses camera culling and cached tile grids for performance.
 */

import { ISLAND_ZONES, ZoneDef } from './zones';
import {
  getZonePlacement, invalidatePlacementCache,
  PlacedLandTile, PlacedRoadTile, PlacedBuilding, PlacedDecor,
  PLACE_TILE, getOceanColor,
} from './terrain-placer';

// ── Constants ──────────────────────────────────────────────────

const RENDER_TILE = PLACE_TILE; // 40px world-space tiles

// Biome fallback fill colors (used while tile images load)
const BIOME_GROUND_COLORS: Record<string, string> = {
  grass:  '#3a6a2a',
  jungle: '#2a5a1a',
  water:  '#1a3a5a',
  stone:  '#4a4a5a',
  dirt:   '#5a4a3a',
};

// Ocean base gradient colors
const OCEAN_SHALLOW = '#1a4a6a';
const OCEAN_DEEP = '#0a2040';

// ── Image Cache ────────────────────────────────────────────────

const _imageCache = new Map<string, HTMLImageElement>();
const _loadingSet = new Set<string>();

function loadImage(src: string): HTMLImageElement | null {
  const cached = _imageCache.get(src);
  if (cached) return cached.complete ? cached : null;
  if (_loadingSet.has(src)) return null;
  _loadingSet.add(src);
  const img = new Image();
  img.src = src;
  img.onload = () => { _imageCache.set(src, img); _loadingSet.delete(src); };
  img.onerror = () => { _loadingSet.delete(src); };
  _imageCache.set(src, img);
  return null;
}

/** Pre-load a batch of tile images for smoother initial render */
function preloadTiles(paths: string[]): void {
  for (const p of paths) loadImage(p);
}

// ── Seeded Random (for noise overlays) ─────────────────────────

function seededRand(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

/** Call when zones change (e.g. after scaling) */
export function invalidateRoadCache(): void {
  invalidatePlacementCache();
}

// ── Main Renderer ──────────────────────────────────────────────

export class TileMapRenderer {
  private _preloaded = false;

  constructor() {}

  /** Pre-load first visible zone's tile images */
  private ensurePreloaded(zone: ZoneDef): void {
    if (this._preloaded) return;
    this._preloaded = true;
    const placement = getZonePlacement(zone);
    // Preload a sample of land tiles
    const landPaths = new Set<string>();
    for (const t of placement.landTiles.slice(0, 50)) landPaths.add(t.tilePath);
    for (const t of placement.roadTiles.slice(0, 20)) landPaths.add(t.tilePath);
    for (const d of placement.decor.slice(0, 30)) landPaths.add(d.def.path);
    for (const b of placement.buildings) {
      for (const p of b.def.parts.slice(0, 3)) landPaths.add(p);
    }
    preloadTiles(Array.from(landPaths));
  }

  // ── Ground Rendering ─────────────────────────────────────────

  /** Render ground fill for a zone using tropical land tiles */
  renderZoneGround(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    const b = zone.bounds;
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    this.ensurePreloaded(zone);

    // Base biome fill (fallback while tiles load)
    const baseColor = BIOME_GROUND_COLORS[zone.terrainType] || '#3a5a2a';
    ctx.fillStyle = baseColor;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);

    // Draw land tiles from AI placer
    const placement = getZonePlacement(zone);
    const margin = RENDER_TILE * 2;

    for (const tile of placement.landTiles) {
      // Camera cull
      if (tile.wx + RENDER_TILE < camX - margin || tile.wx > camX + viewW + margin) continue;
      if (tile.wy + RENDER_TILE < camY - margin || tile.wy > camY + viewH + margin) continue;

      const img = loadImage(tile.tilePath);
      const sx = tile.wx - camX;
      const sy = tile.wy - camY;

      if (img?.complete) {
        ctx.globalAlpha = tile.alpha;
        if (tile.rotation !== 0) {
          ctx.save();
          ctx.translate(sx + RENDER_TILE / 2, sy + RENDER_TILE / 2);
          ctx.rotate((tile.rotation * Math.PI) / 180);
          ctx.drawImage(img, -RENDER_TILE / 2, -RENDER_TILE / 2, RENDER_TILE, RENDER_TILE);
          ctx.restore();
        } else {
          ctx.drawImage(img, sx, sy, RENDER_TILE, RENDER_TILE);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Water edge overlay
    for (const wt of placement.waterEdgeTiles) {
      if (wt.wx + RENDER_TILE < camX - margin || wt.wx > camX + viewW + margin) continue;
      if (wt.wy + RENDER_TILE < camY - margin || wt.wy > camY + viewH + margin) continue;

      const img = loadImage(wt.tilePath);
      const sx = wt.wx - camX;
      const sy = wt.wy - camY;

      if (img?.complete) {
        ctx.globalAlpha = wt.alpha;
        ctx.drawImage(img, sx, sy, RENDER_TILE, RENDER_TILE);
        ctx.globalAlpha = 1;
      } else {
        // Water fallback
        ctx.globalAlpha = wt.alpha * 0.5;
        ctx.fillStyle = '#1a4a6a';
        ctx.fillRect(sx, sy, RENDER_TILE, RENDER_TILE);
        ctx.globalAlpha = 1;
      }
    }

    // Subtle noise overlay for depth
    const startTX = Math.max(0, Math.floor((camX - b.x) / RENDER_TILE));
    const startTY = Math.max(0, Math.floor((camY - b.y) / RENDER_TILE));
    const endTX = Math.min(Math.ceil(b.w / RENDER_TILE), Math.ceil((camX + viewW - b.x) / RENDER_TILE) + 1);
    const endTY = Math.min(Math.ceil(b.h / RENDER_TILE), Math.ceil((camY + viewH - b.y) / RENDER_TILE) + 1);

    ctx.globalAlpha = 0.05;
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const noise = seededRand(tx, ty, zone.id) * 0.3;
        if (noise > 0.12) {
          ctx.fillStyle = `rgba(0,0,0,${noise})`;
          ctx.fillRect(b.x + tx * RENDER_TILE - camX, b.y + ty * RENDER_TILE - camY, RENDER_TILE, RENDER_TILE);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Road Rendering ───────────────────────────────────────────

  /** Render road tiles using tropical road assets */
  renderRoads(ctx: CanvasRenderingContext2D, zones: ZoneDef[], camX: number, camY: number, viewW: number, viewH: number): void {
    const margin = RENDER_TILE * 2;

    for (const zone of zones) {
      const b = zone.bounds;
      if (b.x + b.w < camX - margin * 3 || b.x > camX + viewW + margin * 3) continue;
      if (b.y + b.h < camY - margin * 3 || b.y > camY + viewH + margin * 3) continue;

      const placement = getZonePlacement(zone);

      for (const rt of placement.roadTiles) {
        if (rt.wx + RENDER_TILE < camX - margin || rt.wx > camX + viewW + margin) continue;
        if (rt.wy + RENDER_TILE < camY - margin || rt.wy > camY + viewH + margin) continue;

        const img = loadImage(rt.tilePath);
        const sx = rt.wx - camX;
        const sy = rt.wy - camY;

        if (img?.complete) {
          if (rt.rotation !== 0) {
            ctx.save();
            ctx.translate(sx + RENDER_TILE / 2, sy + RENDER_TILE / 2);
            ctx.rotate((rt.rotation * Math.PI) / 180);
            ctx.drawImage(img, -RENDER_TILE / 2, -RENDER_TILE / 2, RENDER_TILE, RENDER_TILE);
            ctx.restore();
          } else {
            ctx.drawImage(img, sx, sy, RENDER_TILE, RENDER_TILE);
          }
        } else {
          // Fallback: brown road
          ctx.fillStyle = '#8a7050';
          ctx.fillRect(sx, sy, RENDER_TILE, RENDER_TILE);
        }
      }
    }
  }

  // ── Building Rendering ───────────────────────────────────────

  /** Render tropical buildings with shadow layer */
  renderBuildings(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    const b = zone.bounds;
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    const placement = getZonePlacement(zone);
    const margin = RENDER_TILE * 6;

    for (const bld of placement.buildings) {
      if (bld.wx < camX - margin || bld.wx > camX + viewW + margin) continue;
      if (bld.wy < camY - margin || bld.wy > camY + viewH + margin) continue;

      const drawW = bld.def.footprint.w * RENDER_TILE * bld.scale;
      const drawH = bld.def.footprint.h * RENDER_TILE * bld.scale;
      const sx = bld.wx - camX;
      const sy = bld.wy - camY;

      // Shadow layer
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(sx + drawW / 2 + 4, sy + drawH - 2, drawW * 0.45, drawH * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw building parts (first part = base, last = roof)
      // We draw just the main composite image (building_1.png) for performance
      const mainImg = loadImage(bld.def.parts[0]);
      if (mainImg?.complete) {
        ctx.drawImage(mainImg, sx, sy - drawH * 0.3, drawW, drawH);
      } else {
        // Fallback: colored rectangle
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(sx + 2, sy - drawH * 0.2, drawW - 4, drawH * 0.8);
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(sx, sy - drawH * 0.3, drawW, drawH * 0.15); // roof
      }
    }
  }

  // ── Decor Rendering ──────────────────────────────────────────

  /** Render trees, bushes, stones, props with shadows */
  renderZoneDetails(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    const b = zone.bounds;
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    const placement = getZonePlacement(zone);
    const margin = RENDER_TILE * 3;

    for (const d of placement.decor) {
      if (d.wx < camX - margin || d.wx > camX + viewW + margin) continue;
      if (d.wy < camY - margin || d.wy > camY + viewH + margin) continue;

      const drawSize = RENDER_TILE * d.scale;
      const sx = d.wx - camX;
      const sy = d.wy - camY;

      // Shadow
      if (d.shadow.alpha > 0) {
        ctx.globalAlpha = d.shadow.alpha;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(
          sx + d.shadow.dx, sy + d.shadow.dy + drawSize * 0.3,
          drawSize * 0.35, drawSize * 0.12,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const img = loadImage(d.def.path);
      if (img?.complete) {
        if (d.rotation !== 0) {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate((d.rotation * Math.PI) / 180);
          ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          ctx.restore();
        } else {
          ctx.drawImage(img, sx - drawSize / 2, sy - drawSize / 2, drawSize, drawSize);
        }
      } else {
        // Fallback by category
        const catColors: Record<string, string> = {
          tree: '#2a5a1a', stone: '#5a5a6a', greenery: '#3a7a2a', decor: '#6a5a3a',
        };
        ctx.fillStyle = catColors[d.def.category] || '#4a4a4a';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, drawSize / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── Water Rendering ──────────────────────────────────────────

  /** Render animated water shimmer for water zones */
  renderWater(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number, time: number): void {
    if (zone.terrainType !== 'water') return;
    const b = zone.bounds;
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    const startTX = Math.max(0, Math.floor((camX - b.x) / RENDER_TILE));
    const startTY = Math.max(0, Math.floor((camY - b.y) / RENDER_TILE));
    const endTX = Math.min(Math.ceil(b.w / RENDER_TILE), Math.ceil((camX + viewW - b.x) / RENDER_TILE) + 1);
    const endTY = Math.min(Math.ceil(b.h / RENDER_TILE), Math.ceil((camY + viewH - b.y) / RENDER_TILE) + 1);

    // Animated water shimmer overlay
    const phase = (time * 0.001) % (Math.PI * 2);
    ctx.globalAlpha = 0.12;
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const shimmer = Math.sin(phase + tx * 0.8 + ty * 0.6) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(100,180,255,${shimmer * 0.3})`;
        ctx.fillRect(
          b.x + tx * RENDER_TILE - camX,
          b.y + ty * RENDER_TILE - camY,
          RENDER_TILE, RENDER_TILE
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── Zone Exits / Portals ─────────────────────────────────────

  /** Render zone exit/entrance markers */
  renderZoneExits(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    // Draw portal positions as glowing circles
    for (const portal of zone.portalPositions) {
      const sx = portal.x - camX;
      const sy = portal.y - camY;
      if (sx < -60 || sx > viewW + 60 || sy < -60 || sy > viewH + 60) continue;

      // Outer glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(sx, sy, 30, 0, Math.PI * 2);
      ctx.fill();

      // Inner
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(sx, sy, 15, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      const targetZone = ISLAND_ZONES.find(z => z.id === portal.targetZoneId);
      if (targetZone) {
        ctx.fillText(`→ ${targetZone.name}`, sx, sy - 35);
      }
      ctx.globalAlpha = 1;
    }

    // Draw zone connection signposts at edges
    const b = zone.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    for (const connId of zone.connectedZoneIds) {
      const conn = ISLAND_ZONES.find(z => z.id === connId);
      if (!conn) continue;
      const connCx = conn.bounds.x + conn.bounds.w / 2;
      const connCy = conn.bounds.y + conn.bounds.h / 2;

      const angle = Math.atan2(connCy - cy, connCx - cx);
      const edgeX = cx + Math.cos(angle) * Math.min(b.w, b.h) / 2;
      const edgeY = cy + Math.sin(angle) * Math.min(b.w, b.h) / 2;

      const sx = edgeX - camX;
      const sy = edgeY - camY;
      if (sx < -60 || sx > viewW + 60 || sy < -60 || sy > viewH + 60) continue;

      // Signpost
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(sx - 2, sy - 20, 4, 20);
      ctx.fillStyle = '#8a7050';
      ctx.fillRect(sx - 18, sy - 24, 36, 12);
      ctx.fillStyle = '#fff';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(conn.name.split(' ')[0], sx, sy - 16);
    }
  }

  // ── Full Render Pass ─────────────────────────────────────────

  /** Full render pass: ground → water → roads → buildings → details → exits */
  render(ctx: CanvasRenderingContext2D, zones: ZoneDef[], camX: number, camY: number, viewW: number, viewH: number, time?: number): void {
    // Layer 1: Zone ground fills (land tiles)
    for (const zone of zones) {
      this.renderZoneGround(ctx, zone, camX, camY, viewW, viewH);
    }

    // Layer 2: Water shimmer (animated)
    const t = time ?? performance.now();
    for (const zone of zones) {
      this.renderWater(ctx, zone, camX, camY, viewW, viewH, t);
    }

    // Layer 3: Roads
    this.renderRoads(ctx, zones, camX, camY, viewW, viewH);

    // Layer 4: Buildings (with shadows)
    for (const zone of zones) {
      this.renderBuildings(ctx, zone, camX, camY, viewW, viewH);
    }

    // Layer 5: Details — trees, bushes, stones, decor (with shadows)
    for (const zone of zones) {
      this.renderZoneDetails(ctx, zone, camX, camY, viewW, viewH);
    }

    // Layer 6: Zone exits and portals
    for (const zone of zones) {
      this.renderZoneExits(ctx, zone, camX, camY, viewW, viewH);
    }
  }
}

// Singleton
let _renderer: TileMapRenderer | null = null;
export function getTileMapRenderer(): TileMapRenderer {
  if (!_renderer) _renderer = new TileMapRenderer();
  return _renderer;
}

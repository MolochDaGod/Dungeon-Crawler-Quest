/**
 * Tile Map Renderer — Top-Down 2D Tile Rendering
 * Renders terrain, roads, decorations, and water using sprite tilesets.
 * Uses camera culling and cached tile grids for performance.
 *
 * Road tilesets: public/assets/sprites/roads/PNG_Tiled/
 * Ground/biome:  public/assets/sprites/roads/PNG_Tiled/Ground_grass.png
 * Zone tilesets:  tilesets.ts (grassland, swamp, dungeon, ruins)
 */

import { ZONE_ROADS, RoadSegment, ISLAND_ZONES, ZoneDef, ZONE_BUILDINGS } from './zones';
import { BIOME_TILESETS, BiomeTileset } from './tilesets';

// ── Constants ──────────────────────────────────────────────────

const ROAD_TILE = 16;           // road tileset native tile size (px)
const RENDER_TILE = 40;         // world-space tile size (matches TILE_SIZE in open-world.ts)
const ROAD_WIDTH = 3;           // road width in tiles (3 tiles wide = 120px world)
const ROAD_DRAW_SCALE = RENDER_TILE / ROAD_TILE;

// ── Road Tile Indices (from Road1_grass.png 240×416 = 15c×26r at 16px) ──
// The tileset is organized as auto-tile pieces. Key tile positions:
// Row 0: end-caps (circle variants)
// Row 1-2: corner pieces
// Row 3-5: straight pieces, T-junctions
// Row 6-8: cross-roads, large pieces
// We'll use simplified tile IDs mapped to source rects.

interface TileRect {
  sx: number; sy: number; sw: number; sh: number;
}

// Road tile atlas positions — mapped from visual inspection of Road1_grass.png (240×416)
// The sheet has variable-sized pieces, not a uniform grid. Key usable regions:
const ROAD_TILES = {
  // Row 0: Circle end-caps (~48×48 each, 4 across)
  dot:       { sx: 0,   sy: 0,   sw: 48, sh: 48 },
  // Row 4-5: Straight horizontal road section (large piece at bottom-left)
  hStraight: { sx: 0,   sy: 336, sw: 80, sh: 32 },
  // Row 3-4: Straight vertical road section (left side)
  vStraight: { sx: 0,   sy: 208, sw: 32, sh: 80 },
  // Row 2: Corner pieces (4 variants, ~48×48)
  cornerTL:  { sx: 0,   sy: 112, sw: 48, sh: 48 },
  cornerTR:  { sx: 96,  sy: 112, sw: 48, sh: 48 },
  cornerBL:  { sx: 0,   sy: 160, sw: 48, sh: 48 },
  cornerBR:  { sx: 96,  sy: 160, sw: 48, sh: 48 },
  // Row 3: T-junction and cross pieces
  tDown:     { sx: 144, sy: 208, sw: 48, sh: 48 },
  tUp:       { sx: 144, sy: 160, sw: 48, sh: 48 },
  tLeft:     { sx: 96,  sy: 208, sw: 48, sh: 48 },
  tRight:    { sx: 192, sy: 208, sw: 48, sh: 48 },
  // Row 6: Cross-road (large center piece ~96×96)
  cross:     { sx: 144, sy: 336, sw: 96, sh: 80 },
  // Row 4: Large filled road section (center ~80×80)
  fill:      { sx: 48,  sy: 256, sw: 80, sh: 80 },
} as const;

// Biome colors from Ground_grass.png (8 rows of tree/bush variants)
const BIOME_GROUND_COLORS: Record<string, string> = {
  grass:  '#3a6a2a',
  jungle: '#2a5a1a',
  water:  '#1a3a4a',
  stone:  '#4a4a5a',
  dirt:   '#5a4a3a',
};

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

// ── Road Path Rasterizer ───────────────────────────────────────
// Converts ZONE_ROADS line segments into tile positions for rendering

interface RoadTile {
  wx: number;    // world x
  wy: number;    // world y
  tile: keyof typeof ROAD_TILES;
}

function rasterizeRoadSegment(seg: RoadSegment): RoadTile[] {
  const tiles: RoadTile[] = [];
  const dx = seg.to.x - seg.from.x;
  const dy = seg.to.y - seg.from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / RENDER_TILE);
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i <= steps; i++) {
    const wx = seg.from.x + sx * i;
    const wy = seg.from.y + sy * i;
    // Determine tile type based on direction
    const isH = Math.abs(dx) > Math.abs(dy);
    tiles.push({ wx, wy, tile: isH ? 'hStraight' : 'vStraight' });
    // Add width tiles perpendicular to road direction
    for (let w = 1; w <= Math.floor(ROAD_WIDTH / 2); w++) {
      if (isH) {
        tiles.push({ wx, wy: wy - RENDER_TILE * w, tile: 'hStraight' });
        tiles.push({ wx, wy: wy + RENDER_TILE * w, tile: 'hStraight' });
      } else {
        tiles.push({ wx: wx - RENDER_TILE * w, wy, tile: 'vStraight' });
        tiles.push({ wx: wx + RENDER_TILE * w, wy, tile: 'vStraight' });
      }
    }
  }
  return tiles;
}

// ── Cached Road Grid ───────────────────────────────────────────

let _roadTilesCache: RoadTile[] | null = null;

function getRoadTiles(): RoadTile[] {
  if (_roadTilesCache) return _roadTilesCache;
  const all: RoadTile[] = [];
  for (const road of ZONE_ROADS) {
    all.push(...rasterizeRoadSegment(road));
  }
  _roadTilesCache = all;
  return all;
}

/** Call when zones change (e.g. after scaling) */
export function invalidateRoadCache(): void {
  _roadTilesCache = null;
}

// ── Ground Detail Placement ────────────────────────────────────
// Seeded random decorations (trees, bushes, rocks) from Ground_grass.png

interface GroundDetail {
  wx: number;
  wy: number;
  srcCol: number;   // column in Ground_grass.png (0-3)
  srcRow: number;   // row in Ground_grass.png (0-7, color variant)
  size: number;     // draw size multiplier
}

const _zoneDetailsCache = new Map<number, GroundDetail[]>();

function seededRand(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function getZoneDetails(zone: ZoneDef): GroundDetail[] {
  const cached = _zoneDetailsCache.get(zone.id);
  if (cached) return cached;

  const details: GroundDetail[] = [];
  const b = zone.bounds;
  const density = zone.terrainType === 'jungle' ? 0.08
    : zone.terrainType === 'grass' ? 0.04
    : zone.terrainType === 'water' ? 0.02
    : 0.03;

  // Biome → Ground_grass.png row mapping
  const biomeRow: Record<string, number> = {
    grass: 0, jungle: 1, water: 4, stone: 5, dirt: 6,
  };
  const row = biomeRow[zone.terrainType] ?? 0;

  const gridW = Math.floor(b.w / RENDER_TILE);
  const gridH = Math.floor(b.h / RENDER_TILE);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      if (seededRand(gx, gy, zone.id) > density) continue;
      const col = Math.floor(seededRand(gx + 100, gy + 200, zone.id) * 4); // 0-3: tree, bush, rock, flower
      const size = 0.8 + seededRand(gx + 300, gy + 400, zone.id) * 0.6;
      details.push({
        wx: b.x + gx * RENDER_TILE + RENDER_TILE / 2,
        wy: b.y + gy * RENDER_TILE + RENDER_TILE / 2,
        srcCol: col,
        srcRow: row,
        size,
      });
    }
  }

  _zoneDetailsCache.set(zone.id, details);
  return details;
}

// ── Main Renderer ──────────────────────────────────────────────

export class TileMapRenderer {
  private roadSheet: HTMLImageElement | null = null;
  private groundSheet: HTMLImageElement | null = null;
  private roadStyle: string = 'Road1_grass';

  constructor() {
    // Pre-load road and ground sheets
    this.roadSheet = loadImage(`/assets/sprites/roads/PNG_Tiled/${this.roadStyle}.png`);
    this.groundSheet = loadImage('/assets/sprites/roads/PNG_Tiled/Ground_grass.png');
  }

  /** Set which road style to use (Road1-5, with _grass/_ground suffix) */
  setRoadStyle(style: string): void {
    this.roadStyle = style;
    this.roadSheet = loadImage(`/assets/sprites/roads/PNG_Tiled/${style}.png`);
  }

  /** Render ground fill for a zone (biome-colored base) */
  renderZoneGround(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    const b = zone.bounds;
    // Skip zones entirely off-screen
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    // Base biome fill (gradient instead of flat color)
    const baseColor = BIOME_GROUND_COLORS[zone.terrainType] || '#3a5a2a';
    ctx.fillStyle = baseColor;
    ctx.fillRect(b.x - camX, b.y - camY, b.w, b.h);

    // Subtle noise pattern overlay
    ctx.globalAlpha = 0.08;
    const startTX = Math.max(0, Math.floor((camX - b.x) / RENDER_TILE));
    const startTY = Math.max(0, Math.floor((camY - b.y) / RENDER_TILE));
    const endTX = Math.min(Math.ceil(b.w / RENDER_TILE), Math.ceil((camX + viewW - b.x) / RENDER_TILE) + 1);
    const endTY = Math.min(Math.ceil(b.h / RENDER_TILE), Math.ceil((camY + viewH - b.y) / RENDER_TILE) + 1);

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const noise = seededRand(tx, ty, zone.id) * 0.3;
        if (noise > 0.15) {
          ctx.fillStyle = `rgba(0,0,0,${noise})`;
          ctx.fillRect(b.x + tx * RENDER_TILE - camX, b.y + ty * RENDER_TILE - camY, RENDER_TILE, RENDER_TILE);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Render road tiles */
  renderRoads(ctx: CanvasRenderingContext2D, camX: number, camY: number, viewW: number, viewH: number): void {
    if (!this.roadSheet) {
      this.roadSheet = loadImage(`/assets/sprites/roads/PNG_Tiled/${this.roadStyle}.png`);
    }
    const img = this.roadSheet;

    const roadTiles = getRoadTiles();
    const margin = RENDER_TILE * 2;

    for (const rt of roadTiles) {
      // Cull off-screen
      if (rt.wx + RENDER_TILE < camX - margin || rt.wx > camX + viewW + margin) continue;
      if (rt.wy + RENDER_TILE < camY - margin || rt.wy > camY + viewH + margin) continue;

      const screenX = rt.wx - camX - RENDER_TILE / 2;
      const screenY = rt.wy - camY - RENDER_TILE / 2;

      if (img?.complete) {
        const src = ROAD_TILES[rt.tile];
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh,
          screenX, screenY,
          src.sw * ROAD_DRAW_SCALE, src.sh * ROAD_DRAW_SCALE);
      } else {
        // Fallback: brown road rectangle
        ctx.fillStyle = '#8a7050';
        ctx.fillRect(screenX, screenY, RENDER_TILE, RENDER_TILE);
      }
    }
  }

  /** Render ground details (trees, bushes, rocks) for a zone */
  renderZoneDetails(ctx: CanvasRenderingContext2D, zone: ZoneDef, camX: number, camY: number, viewW: number, viewH: number): void {
    const b = zone.bounds;
    if (b.x + b.w < camX || b.x > camX + viewW || b.y + b.h < camY || b.y > camY + viewH) return;

    if (!this.groundSheet) {
      this.groundSheet = loadImage('/assets/sprites/roads/PNG_Tiled/Ground_grass.png');
    }
    const img = this.groundSheet;
    const details = getZoneDetails(zone);
    const margin = RENDER_TILE * 2;

    for (const d of details) {
      if (d.wx < camX - margin || d.wx > camX + viewW + margin) continue;
      if (d.wy < camY - margin || d.wy > camY + viewH + margin) continue;

      const screenX = d.wx - camX;
      const screenY = d.wy - camY;
      const drawSize = RENDER_TILE * d.size;

      if (img?.complete) {
        // Ground_grass.png: 272×496 = 4 columns × 8 rows of biome-colored elements
        // Col 0: round tree/bush, Col 1: square block, Col 2: dark variant, Col 3: small accent
        // Rows 0-7: grass-green, olive, autumn-brown, teal, cream, deep-green, khaki, dark-green
        const cellW = 68;  // 272 / 4 = 68px per column
        const cellH = 62;  // 496 / 8 = 62px per row
        const srcX = d.srcCol * cellW;
        const srcY = d.srcRow * cellH;
        ctx.drawImage(img, srcX, srcY, cellW, cellH,
          screenX - drawSize / 2, screenY - drawSize / 2,
          drawSize, drawSize * (cellH / cellW));
      } else {
        // Fallback: colored circles for trees/bushes
        const colors = ['#2a5a1a', '#3a6a2a', '#5a5a6a', '#6a5a3a'];
        ctx.fillStyle = colors[d.srcCol % colors.length];
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(screenX, screenY, drawSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

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

    // Draw zone connection roads with signposts at edges
    const b = zone.bounds;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;

    for (const connId of zone.connectedZoneIds) {
      const conn = ISLAND_ZONES.find(z => z.id === connId);
      if (!conn) continue;
      const connCx = conn.bounds.x + conn.bounds.w / 2;
      const connCy = conn.bounds.y + conn.bounds.h / 2;

      // Find edge point of this zone towards the connected zone
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

  /** Full render pass: ground → roads → details → exits */
  render(ctx: CanvasRenderingContext2D, zones: ZoneDef[], camX: number, camY: number, viewW: number, viewH: number): void {
    // Layer 1: Zone ground fills
    for (const zone of zones) {
      this.renderZoneGround(ctx, zone, camX, camY, viewW, viewH);
    }

    // Layer 2: Roads
    this.renderRoads(ctx, camX, camY, viewW, viewH);

    // Layer 3: Details (trees, bushes, rocks)
    for (const zone of zones) {
      this.renderZoneDetails(ctx, zone, camX, camY, viewW, viewH);
    }

    // Layer 4: Zone exits and portals
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

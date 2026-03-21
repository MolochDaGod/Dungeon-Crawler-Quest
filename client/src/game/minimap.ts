/**
 * Minimap Renderer - ported from GRUDGE_Minimap
 * Canvas-based minimap showing player, enemies, NPCs, portals, zone boundaries.
 * Rendered in a corner of the screen.
 */

import { ISLAND_ZONES, OPEN_WORLD_SIZE, getZoneColor, ZoneDef } from './zones';
import { OpenWorldState, OWEnemy, OWNPC } from './open-world';
import { ALL_TOWN_BUILDINGS, BuildingType } from './town-buildings';

const BUILDING_MINIMAP_COLORS: Record<BuildingType, string> = {
  inn:      '#f59e0b',
  blacksmith: '#ef4444',
  guild:    '#ffd700',
  shop:     '#22c55e',
  trainer:  '#3b82f6',
  barracks: '#6366f1',
  armory:   '#8b5cf6',
};

// ── Types ──────────────────────────────────────────────────────

export interface MinimapConfig {
  size: number;        // px (square)
  x: number;           // screen x
  y: number;           // screen y
  zoom: number;        // 1 = full world fits, higher = zoomed in
  showEnemies: boolean;
  showNPCs: boolean;
  showPortals: boolean;
  showZoneLabels: boolean;
}

export function createMinimapConfig(): MinimapConfig {
  return {
    size: 200,
    x: 0, y: 0, // set by caller based on canvas size
    zoom: 4,
    showEnemies: true,
    showNPCs: true,
    showPortals: true,
    showZoneLabels: true,
  };
}

// ── Render ─────────────────────────────────────────────────────

export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  state: OpenWorldState,
  config: MinimapConfig,
  canvasW: number,
  canvasH: number,
): void {
  const { size, zoom } = config;
  const mx = canvasW - size - 12;
  const my = 12;

  const p = state.player;

  // How much world area is visible on the minimap
  const viewSize = OPEN_WORLD_SIZE / zoom;
  const halfView = viewSize / 2;

  // Center minimap on player
  const viewX = p.x - halfView;
  const viewY = p.y - halfView;

  // Scale: world pixels → minimap pixels
  const scale = size / viewSize;

  // Helper: world → minimap coords
  const toMX = (wx: number) => mx + (wx - viewX) * scale;
  const toMY = (wy: number) => my + (wy - viewY) * scale;
  const inView = (wx: number, wy: number) =>
    wx >= viewX && wx <= viewX + viewSize && wy >= viewY && wy <= viewY + viewSize;

  // Background — ocean blue instead of black
  ctx.save();

  ctx.fillStyle = 'rgba(12,30,60,0.9)';
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 2;
  ctx.fillRect(mx, my, size, size);
  ctx.strokeRect(mx, my, size, size);

  // Clip to minimap area
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();

  // Zone fills
  for (const zone of ISLAND_ZONES) {
    const b = zone.bounds;
    const zx = toMX(b.x);
    const zy = toMY(b.y);
    const zw = b.w * scale;
    const zh = b.h * scale;

    // Skip if entirely off-screen
    if (zx + zw < mx || zx > mx + size || zy + zh < my || zy > my + size) continue;

    // Fill zone area with tinted color
    ctx.fillStyle = zone.ambientColor;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(zx, zy, zw, zh);

    // Zone border
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = getZoneColor(zone);
    ctx.lineWidth = 1;
    ctx.strokeRect(zx, zy, zw, zh);

    // Zone name label
    if (config.showZoneLabels && zw > 30) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.max(7, Math.min(10, zw / 8))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, zx + zw / 2, zy + zh / 2 + 3);
    }
  }
  ctx.globalAlpha = 1;

  // Portals
  if (config.showPortals) {
    for (const zone of ISLAND_ZONES) {
      for (const portal of zone.portalPositions) {
        if (!inView(portal.x, portal.y)) continue;
        const px = toMX(portal.x);
        const py = toMY(portal.y);
        ctx.fillStyle = '#a855f7';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Town buildings (small squares with type color)
  for (const tb of ALL_TOWN_BUILDINGS) {
    const bCX = tb.wx + tb.ww / 2;
    const bCY = tb.wy + tb.wh / 2;
    if (!inView(bCX, bCY)) continue;
    const bx = toMX(bCX);
    const by = toMY(bCY);
    ctx.fillStyle = BUILDING_MINIMAP_COLORS[tb.type] || '#888';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(bx - 3, by - 3, 6, 6);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(bx - 3, by - 3, 6, 6);
    ctx.globalAlpha = 1;
  }

  // NPCs
  if (config.showNPCs) {
    for (const npc of state.npcs) {
      if (!inView(npc.x, npc.y)) continue;
      const nx = toMX(npc.x);
      const ny = toMY(npc.y);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Enemies
  if (config.showEnemies) {
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (!inView(enemy.x, enemy.y)) continue;
      const ex = toMX(enemy.x);
      const ey = toMY(enemy.y);
      if (enemy.isBoss) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = enemy.color;
        ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
      }
    }
  }

  // Player (always last / on top)
  const ppx = toMX(p.x);
  const ppy = toMY(p.y);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(ppx, ppy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Player facing indicator
  const facingLen = 8;
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ppx, ppy);
  ctx.lineTo(ppx + Math.cos(p.facing) * facingLen, ppy + Math.sin(p.facing) * facingLen);
  ctx.stroke();

  ctx.restore();

  // Coordinates below minimap
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.floor(p.x)}, ${Math.floor(p.y)}`, mx + size, my + size + 14);

  // Zone name above minimap
  const currentZone = ISLAND_ZONES.find(z => {
    const b = z.bounds;
    return p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h;
  });
  if (currentZone) {
    ctx.fillStyle = getZoneColor(currentZone);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentZone.name, mx + size / 2, my - 4);
  } else {
    ctx.fillStyle = '#4488aa';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ocean', mx + size / 2, my - 4);
  }
}

// ── Zoom Controls ──────────────────────────────────────────────

export function minimapZoomIn(config: MinimapConfig): void {
  config.zoom = Math.min(12, config.zoom + 1);
}

export function minimapZoomOut(config: MinimapConfig): void {
  config.zoom = Math.max(1, config.zoom - 1);
}

export function toggleMinimapFilter(config: MinimapConfig, filter: 'enemies' | 'npcs' | 'portals' | 'zoneLabels'): void {
  switch (filter) {
    case 'enemies': config.showEnemies = !config.showEnemies; break;
    case 'npcs': config.showNPCs = !config.showNPCs; break;
    case 'portals': config.showPortals = !config.showPortals; break;
    case 'zoneLabels': config.showZoneLabels = !config.showZoneLabels; break;
  }
}

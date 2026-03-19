/**
 * World Collision Detection
 * Handles collision between entities and world objects:
 *   - Stone walls (from node-map.ts getStartingTownWalls)
 *   - Water tiles (impassable deep water)
 *   - Decorations with collisionRadius > 0 (trees, rocks, buildings)
 *   - World boundaries
 */

import { collidesWithWall, isDeepWater, WORLD_SIZE } from './node-map';
import type { ZoneDecorLayout } from './world-decorations';

// ── Types ──────────────────────────────────────────────────────

export interface CollisionResult {
  blocked: boolean;
  pushX: number;   // push-back direction X
  pushY: number;   // push-back direction Y
  reason?: 'wall' | 'water' | 'decoration' | 'boundary';
}

// ── Main Collision Check ───────────────────────────────────────

const ENTITY_RADIUS = 12;  // player/animal collision radius

/**
 * Check if moving to (nx, ny) would cause a collision.
 * Returns push-back vector if blocked.
 */
export function checkWorldCollision(
  nx: number, ny: number,
  radius: number,
  layouts: ZoneDecorLayout[],
): CollisionResult {
  // World boundary
  const pad = 50;
  if (nx < pad || nx > WORLD_SIZE - pad || ny < pad || ny > WORLD_SIZE - pad) {
    return { blocked: true, pushX: nx < pad ? 1 : nx > WORLD_SIZE - pad ? -1 : 0, pushY: ny < pad ? 1 : ny > WORLD_SIZE - pad ? -1 : 0, reason: 'boundary' };
  }

  // Stone walls
  if (collidesWithWall(nx, ny, radius)) {
    return { blocked: true, pushX: 0, pushY: 0, reason: 'wall' };
  }

  // Deep water
  if (isDeepWater(nx, ny)) {
    return { blocked: true, pushX: 0, pushY: 0, reason: 'water' };
  }

  // Decoration collision (trees, rocks, buildings)
  for (const layout of layouts) {
    for (const deco of layout.decorations) {
      if (deco.collisionRadius <= 0) continue;
      const dx = nx - deco.x;
      const dy = ny - deco.y;
      const distSq = dx * dx + dy * dy;
      const minDist = radius + deco.collisionRadius;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const pushDist = minDist - dist;
        if (dist > 0) {
          return {
            blocked: true,
            pushX: (dx / dist) * pushDist,
            pushY: (dy / dist) * pushDist,
            reason: 'decoration',
          };
        }
        return { blocked: true, pushX: 1, pushY: 0, reason: 'decoration' };
      }
    }
  }

  return { blocked: false, pushX: 0, pushY: 0 };
}

/**
 * Apply collision to a movement vector.
 * Returns the adjusted (nx, ny) after resolving collisions.
 */
export function resolveMovement(
  cx: number, cy: number,
  nx: number, ny: number,
  radius: number,
  layouts: ZoneDecorLayout[],
): { x: number; y: number } {
  // Try full movement first
  const full = checkWorldCollision(nx, ny, radius, layouts);
  if (!full.blocked) return { x: nx, y: ny };

  // Try sliding along X axis
  const slideX = checkWorldCollision(nx, cy, radius, layouts);
  if (!slideX.blocked) return { x: nx, y: cy };

  // Try sliding along Y axis
  const slideY = checkWorldCollision(cx, ny, radius, layouts);
  if (!slideY.blocked) return { x: cx, y: ny };

  // Fully blocked - push back
  if (full.pushX !== 0 || full.pushY !== 0) {
    return { x: cx + full.pushX, y: cy + full.pushY };
  }

  // Can't move at all
  return { x: cx, y: cy };
}

// ── Render Walls (debug + visual) ──────────────────────────────

import { getStartingTownWalls } from './node-map';

export function renderWalls(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  const walls = getStartingTownWalls();

  for (const wall of walls) {
    if (wall.isGate) {
      // Gate opening - draw subtle markers
      ctx.save();
      ctx.strokeStyle = '#6a5a3a';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(wall.x1 - camX, wall.y1 - camY);
      ctx.lineTo(wall.x2 - camX, wall.y2 - camY);
      ctx.stroke();

      // Gate pillars
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(wall.x1 - camX - 8, wall.y1 - camY - 8, 16, 16);
      ctx.fillRect(wall.x2 - camX - 8, wall.y2 - camY - 8, 16, 16);
      ctx.restore();
      continue;
    }

    // Solid wall
    ctx.save();
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const halfT = wall.thickness / 2;

    // Wall shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(wall.x1 - camX + nx * halfT + 3, wall.y1 - camY + ny * halfT + 3);
    ctx.lineTo(wall.x2 - camX + nx * halfT + 3, wall.y2 - camY + ny * halfT + 3);
    ctx.lineTo(wall.x2 - camX - nx * halfT + 3, wall.y2 - camY - ny * halfT + 3);
    ctx.lineTo(wall.x1 - camX - nx * halfT + 3, wall.y1 - camY - ny * halfT + 3);
    ctx.closePath();
    ctx.fill();

    // Wall body (stone texture pattern)
    ctx.fillStyle = '#6a6a7a';
    ctx.beginPath();
    ctx.moveTo(wall.x1 - camX + nx * halfT, wall.y1 - camY + ny * halfT);
    ctx.lineTo(wall.x2 - camX + nx * halfT, wall.y2 - camY + ny * halfT);
    ctx.lineTo(wall.x2 - camX - nx * halfT, wall.y2 - camY - ny * halfT);
    ctx.lineTo(wall.x1 - camX - nx * halfT, wall.y1 - camY - ny * halfT);
    ctx.closePath();
    ctx.fill();

    // Wall top edge (lighter)
    ctx.strokeStyle = '#8a8a9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wall.x1 - camX + nx * halfT, wall.y1 - camY + ny * halfT);
    ctx.lineTo(wall.x2 - camX + nx * halfT, wall.y2 - camY + ny * halfT);
    ctx.stroke();

    // Stone brick pattern
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    const segments = Math.floor(len / 24);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const px = wall.x1 + dx * t - camX;
      const py = wall.y1 + dy * t - camY;
      ctx.beginPath();
      ctx.moveTo(px + nx * halfT, py + ny * halfT);
      ctx.lineTo(px - nx * halfT, py - ny * halfT);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Render Animated Water ──────────────────────────────────────

export function renderWaterArea(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  camX: number, camY: number,
  gameTime: number,
): void {
  const sx = bounds.x - camX;
  const sy = bounds.y - camY;

  // Base water color
  ctx.fillStyle = '#1a3a5a';
  ctx.fillRect(sx, sy, bounds.w, bounds.h);

  // Animated water shimmer
  const tileSize = 40;
  const startTX = Math.floor(Math.max(0, camX - bounds.x) / tileSize);
  const startTY = Math.floor(Math.max(0, camY - bounds.y) / tileSize);
  const endTX = Math.min(Math.ceil(bounds.w / tileSize), Math.ceil((camX + 1600 - bounds.x) / tileSize));
  const endTY = Math.min(Math.ceil(bounds.h / tileSize), Math.ceil((camY + 1200 - bounds.y) / tileSize));

  for (let ty = startTY; ty < endTY; ty++) {
    for (let tx = startTX; tx < endTX; tx++) {
      const wx = bounds.x + tx * tileSize;
      const wy = bounds.y + ty * tileSize;

      // Wave pattern
      const wave1 = Math.sin(gameTime * 1.5 + tx * 0.8 + ty * 0.3) * 0.5 + 0.5;
      const wave2 = Math.sin(gameTime * 0.8 + tx * 0.4 + ty * 1.2) * 0.5 + 0.5;
      const combined = (wave1 + wave2) * 0.5;

      // Light shimmer on peaks
      if (combined > 0.6) {
        ctx.globalAlpha = (combined - 0.6) * 0.3;
        ctx.fillStyle = '#4a8aaa';
        ctx.fillRect(wx - camX, wy - camY, tileSize, tileSize);
      }

      // Dark troughs
      if (combined < 0.3) {
        ctx.globalAlpha = (0.3 - combined) * 0.2;
        ctx.fillStyle = '#0a1a3a';
        ctx.fillRect(wx - camX, wy - camY, tileSize, tileSize);
      }

      // Foam/sparkle on random tiles
      const seed = ((tx * 17 + ty * 31) % 100);
      if (seed > 85 && combined > 0.7) {
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.arc(wx - camX + 20, wy - camY + 20, 2 + combined * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.globalAlpha = 1;

  // Shoreline edge (darker border)
  ctx.strokeStyle = '#0a2a4a';
  ctx.lineWidth = 3;
  ctx.strokeRect(sx + 2, sy + 2, bounds.w - 4, bounds.h - 4);

  // Inner shoreline (lighter)
  ctx.strokeStyle = 'rgba(100,180,220,0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx + 8, sy + 8, bounds.w - 16, bounds.h - 16);
}

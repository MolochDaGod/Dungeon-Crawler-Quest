/**
 * Voxel Spell Projectiles
 * Animated voxel spell effects that travel from caster toward mouse/target position.
 * Each projectile type has a unique visual style, trail particles, and impact effect.
 *
 * Types: spike, fireball, frostbolt, lightning, nature, shadow
 * Also handles class ranged attacks: thrown_axe, arrow, magic_bolt
 */

// ── Types ──────────────────────────────────────────────────────

export type VoxelProjectileType =
  | 'spike' | 'fireball' | 'frostbolt' | 'lightning' | 'nature' | 'shadow'
  | 'thrown_axe' | 'arrow' | 'magic_bolt' | 'thrown_dagger';

export interface VoxelProjectile {
  id: number;
  type: VoxelProjectileType;
  /** Current world position */
  x: number;
  y: number;
  /** Origin position (for trail rendering) */
  originX: number;
  originY: number;
  /** Target position (mouse world coords) */
  targetX: number;
  targetY: number;
  /** Movement angle (radians) */
  angle: number;
  /** Pixels per second */
  speed: number;
  /** Damage on hit */
  damage: number;
  /** Source entity ID (player = 1) */
  sourceId: number;
  /** Color tint */
  color: string;
  /** Accent/trail color */
  trailColor: string;
  /** Elapsed time */
  timer: number;
  /** Max lifetime (auto-remove after this) */
  maxLife: number;
  /** Hit radius for collision */
  hitRadius: number;
  /** Is this projectile dead? */
  dead: boolean;
  /** Rotation for spinning projectiles (thrown axe etc) */
  rotation: number;
  /** Spin speed (radians/sec) */
  spinSpeed: number;
  /** Scale multiplier */
  scale: number;
  /** Does it return to caster (boomerang)? */
  returning: boolean;
  /** Trail particle timer */
  trailTimer: number;
}

// ── Projectile Config ──────────────────────────────────────────

interface ProjectileConfig {
  speed: number;
  hitRadius: number;
  maxLife: number;
  scale: number;
  spinSpeed: number;
  trailInterval: number; // seconds between trail particles
}

const PROJECTILE_CONFIGS: Record<VoxelProjectileType, ProjectileConfig> = {
  spike:         { speed: 250, hitRadius: 20, maxLife: 1.5, scale: 1.0,  spinSpeed: 0,     trailInterval: 0.05 },
  fireball:      { speed: 320, hitRadius: 18, maxLife: 2.0, scale: 1.2,  spinSpeed: 0,     trailInterval: 0.03 },
  frostbolt:     { speed: 350, hitRadius: 15, maxLife: 2.0, scale: 0.9,  spinSpeed: 2,     trailInterval: 0.04 },
  lightning:     { speed: 600, hitRadius: 12, maxLife: 0.8, scale: 0.8,  spinSpeed: 0,     trailInterval: 0.02 },
  nature:        { speed: 200, hitRadius: 22, maxLife: 2.5, scale: 1.0,  spinSpeed: 0,     trailInterval: 0.06 },
  shadow:        { speed: 280, hitRadius: 16, maxLife: 2.0, scale: 1.1,  spinSpeed: 1,     trailInterval: 0.04 },
  thrown_axe:    { speed: 300, hitRadius: 14, maxLife: 1.8, scale: 1.0,  spinSpeed: 12,    trailInterval: 0.05 },
  arrow:         { speed: 500, hitRadius: 10, maxLife: 1.5, scale: 0.7,  spinSpeed: 0,     trailInterval: 0.06 },
  magic_bolt:    { speed: 380, hitRadius: 14, maxLife: 2.0, scale: 1.0,  spinSpeed: 3,     trailInterval: 0.03 },
  thrown_dagger: { speed: 400, hitRadius: 10, maxLife: 1.2, scale: 0.6,  spinSpeed: 15,    trailInterval: 0.04 },
};

// ── Color Presets ──────────────────────────────────────────────

export const ELEMENT_COLORS: Record<string, { primary: string; trail: string }> = {
  fire:      { primary: '#ff6622', trail: '#ff4400' },
  frost:     { primary: '#66bbff', trail: '#4488dd' },
  arcane:    { primary: '#aa44ff', trail: '#8822cc' },
  nature:    { primary: '#44cc44', trail: '#228822' },
  lightning: { primary: '#ffdd44', trail: '#ccaa22' },
  shadow:    { primary: '#6622aa', trail: '#440088' },
  holy:      { primary: '#ffee88', trail: '#ddcc44' },
  physical:  { primary: '#aaaaaa', trail: '#777777' },
};

// ── Factory ────────────────────────────────────────────────────

let _nextProjId = 1000;

export function createVoxelProjectile(
  type: VoxelProjectileType,
  originX: number, originY: number,
  targetX: number, targetY: number,
  damage: number,
  sourceId: number,
  color: string,
  trailColor: string,
): VoxelProjectile {
  const cfg = PROJECTILE_CONFIGS[type];
  const angle = Math.atan2(targetY - originY, targetX - originX);

  return {
    id: ++_nextProjId,
    type,
    x: originX, y: originY,
    originX, originY,
    targetX, targetY,
    angle,
    speed: cfg.speed,
    damage,
    sourceId,
    color,
    trailColor,
    timer: 0,
    maxLife: cfg.maxLife,
    hitRadius: cfg.hitRadius,
    dead: false,
    rotation: 0,
    spinSpeed: cfg.spinSpeed,
    scale: cfg.scale,
    returning: false,
    trailTimer: 0,
  };
}

// ── Update ─────────────────────────────────────────────────────

export interface ProjectileTrailParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

/**
 * Update a projectile. Returns trail particles to spawn.
 */
export function updateVoxelProjectile(proj: VoxelProjectile, dt: number): ProjectileTrailParticle[] {
  if (proj.dead) return [];

  proj.timer += dt;
  if (proj.timer >= proj.maxLife) { proj.dead = true; return []; }

  // Move
  const moveSpeed = proj.speed * dt;
  if (proj.type === 'spike') {
    // Spike: discrete column positions along the line
    const progress = proj.timer / proj.maxLife;
    const totalDist = Math.sqrt((proj.targetX - proj.originX) ** 2 + (proj.targetY - proj.originY) ** 2);
    const dist = Math.min(totalDist, progress * totalDist * 1.5);
    proj.x = proj.originX + Math.cos(proj.angle) * dist;
    proj.y = proj.originY + Math.sin(proj.angle) * dist;
  } else if (proj.returning) {
    // Boomerang return phase
    // (not implemented yet — projectile just dies at max life)
    proj.x += Math.cos(proj.angle) * moveSpeed;
    proj.y += Math.sin(proj.angle) * moveSpeed;
  } else {
    proj.x += Math.cos(proj.angle) * moveSpeed;
    proj.y += Math.sin(proj.angle) * moveSpeed;
  }

  // Spin
  proj.rotation += proj.spinSpeed * dt;

  // Trail particles
  const trails: ProjectileTrailParticle[] = [];
  proj.trailTimer += dt;
  const cfg = PROJECTILE_CONFIGS[proj.type];
  while (proj.trailTimer >= cfg.trailInterval) {
    proj.trailTimer -= cfg.trailInterval;
    const spread = 4;
    trails.push({
      x: proj.x + (Math.random() - 0.5) * spread,
      y: proj.y + (Math.random() - 0.5) * spread,
      vx: -Math.cos(proj.angle) * 20 + (Math.random() - 0.5) * 15,
      vy: -Math.sin(proj.angle) * 20 + (Math.random() - 0.5) * 15 - 10,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.5,
      color: proj.trailColor,
      size: 2 + Math.random() * 2,
    });
  }

  return trails;
}

// ── Render ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function renderVoxelProjectile(
  ctx: CanvasRenderingContext2D,
  proj: VoxelProjectile,
  camX: number, camY: number,
  gameTime: number,
): void {
  if (proj.dead) return;

  const sx = proj.x - camX;
  const sy = proj.y - camY;
  const s = proj.scale;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(proj.rotation);

  switch (proj.type) {
    case 'fireball': {
      // Glowing orange/red sphere with pulsing corona
      const pulse = 1 + Math.sin(gameTime * 15) * 0.15;
      const r = 8 * s * pulse;
      // Corona glow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = proj.trailColor;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // Bright center
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'frostbolt': {
      // Blue crystal shard
      const r = 6 * s;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Crystal shape (diamond)
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.5);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r * 1.5);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.3, 0);
      ctx.lineTo(0, r * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'lightning': {
      // Zigzag bolt segments
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 3 * s;
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(-15 * s, 0);
      for (let i = 0; i < 5; i++) {
        const px = (-15 + i * 7.5) * s;
        const py = (Math.random() - 0.5) * 10 * s;
        ctx.lineTo(px, py);
      }
      ctx.lineTo(15 * s, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Bright core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * s;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-10 * s, 0);
      ctx.lineTo(10 * s, 0);
      ctx.stroke();
      break;
    }

    case 'spike': {
      // Earth spike rising from ground
      const progress = Math.min(1, proj.timer * 3);
      const h = 14 * s * progress;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = proj.color;
      // Triangular spike
      ctx.beginPath();
      ctx.moveTo(-4 * s, 0);
      ctx.lineTo(0, -h);
      ctx.lineTo(4 * s, 0);
      ctx.closePath();
      ctx.fill();
      // Debris at base
      ctx.fillStyle = '#6a5a4a';
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-6 * s + i * 4 * s, -1, 3 * s, 3 * s);
      }
      break;
    }

    case 'nature': {
      // Growing vine/thorn
      const growth = Math.min(1, proj.timer * 2);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(-8 * s, 4 * s);
      ctx.quadraticCurveTo(0, -6 * s * growth, 8 * s, 2 * s);
      ctx.stroke();
      // Leaves
      ctx.fillStyle = '#44aa22';
      ctx.globalAlpha = 0.7 * growth;
      ctx.beginPath();
      ctx.arc(4 * s, -2 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-3 * s, 1 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'shadow': {
      // Dark orb with swirling mist
      const pulse = 1 + Math.sin(gameTime * 8) * 0.2;
      const r = 7 * s * pulse;
      // Mist aura
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#2a0044';
      ctx.beginPath();
      ctx.arc(Math.sin(gameTime * 5) * 3, Math.cos(gameTime * 4) * 3, r * 3, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // Eye/center
      ctx.fillStyle = '#ff44ff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'thrown_axe': {
      // Spinning axe silhouette
      ctx.globalAlpha = 0.9;
      // Handle
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(-1.5 * s, -8 * s, 3 * s, 16 * s);
      // Axe head
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.moveTo(-6 * s, -8 * s);
      ctx.lineTo(0, -10 * s);
      ctx.lineTo(6 * s, -8 * s);
      ctx.lineTo(3 * s, -4 * s);
      ctx.lineTo(-3 * s, -4 * s);
      ctx.closePath();
      ctx.fill();
      // Glint
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-1 * s, -9 * s, 2 * s, 3 * s);
      break;
    }

    case 'thrown_dagger': {
      // Small spinning dagger
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#8a8a9a';
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(2 * s, 0);
      ctx.lineTo(0, 7 * s);
      ctx.lineTo(-2 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(-1.5 * s, 2 * s, 3 * s, 5 * s);
      break;
    }

    case 'arrow': {
      // Arrow pointing in travel direction (no rotation needed, already rotated by angle)
      ctx.rotate(-proj.rotation); // Undo spin, arrows don't spin
      ctx.rotate(proj.angle); // Face travel direction
      ctx.globalAlpha = 0.9;
      // Shaft
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-10 * s, -1 * s, 20 * s, 2 * s);
      // Head
      ctx.fillStyle = '#aaaaaa';
      ctx.beginPath();
      ctx.moveTo(10 * s, -3 * s);
      ctx.lineTo(14 * s, 0);
      ctx.lineTo(10 * s, 3 * s);
      ctx.closePath();
      ctx.fill();
      // Fletching
      ctx.fillStyle = '#cc4444';
      ctx.beginPath();
      ctx.moveTo(-10 * s, -3 * s);
      ctx.lineTo(-8 * s, 0);
      ctx.lineTo(-10 * s, 3 * s);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'magic_bolt': {
      // Glowing energy orb
      const pulse = 1 + Math.sin(gameTime * 12) * 0.1;
      const r = 6 * s * pulse;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = proj.trailColor;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Class Ranged Attack Helpers ────────────────────────────────

export interface ClassRangedConfig {
  type: VoxelProjectileType;
  color: string;
  trailColor: string;
  cooldown: number;
  damageMultiplier: number;
  speedMultiplier: number;
}

export function getClassRangedConfig(heroClass: string, weaponType?: string): ClassRangedConfig {
  switch (heroClass) {
    case 'Warrior':
      return { type: 'thrown_axe', color: '#aaaaaa', trailColor: '#777777', cooldown: 0.8, damageMultiplier: 0.8, speedMultiplier: 1.0 };
    case 'Worg':
      return { type: 'thrown_dagger', color: '#8a8a9a', trailColor: '#555555', cooldown: 0.7, damageMultiplier: 0.6, speedMultiplier: 1.3 };
    case 'Ranger':
      return { type: 'arrow', color: '#8a6a3a', trailColor: '#5a4a2a', cooldown: 0.4, damageMultiplier: 1.0, speedMultiplier: 1.2 };
    case 'Mage': {
      // Color based on equipped staff element
      const element = weaponType?.includes('fire') ? 'fire'
        : weaponType?.includes('frost') ? 'frost'
        : weaponType?.includes('nature') ? 'nature'
        : weaponType?.includes('lightning') ? 'lightning'
        : 'arcane';
      const ec = ELEMENT_COLORS[element] || ELEMENT_COLORS.arcane;
      return { type: 'magic_bolt', color: ec.primary, trailColor: ec.trail, cooldown: 0.6, damageMultiplier: 1.2, speedMultiplier: 1.0 };
    }
    default:
      return { type: 'magic_bolt', color: '#aaaaaa', trailColor: '#777777', cooldown: 0.8, damageMultiplier: 0.7, speedMultiplier: 1.0 };
  }
}

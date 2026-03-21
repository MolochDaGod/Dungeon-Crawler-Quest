/**
 * Space Conquest — Canvas Renderer
 * Draws the solar system map: star, orbital paths, planets, ships,
 * neutrals, fleet transits, combat VFX, and particle nebula background.
 */

import { SpaceConquestState, SpaceUnit, SpaceVFX, PlanetState } from './space-conquest-engine';

// ── Background Stars (generated once) ──────────────────────────

interface BGStar {
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
}

let _bgStars: BGStar[] | null = null;

function ensureBGStars(): BGStar[] {
  if (_bgStars) return _bgStars;
  _bgStars = [];
  for (let i = 0; i < 400; i++) {
    _bgStars.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      size: 0.5 + Math.random() * 2,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 1 + Math.random() * 3,
    });
  }
  return _bgStars;
}

// ── Main Render ────────────────────────────────────────────────

export function renderSpaceConquest(ctx: CanvasRenderingContext2D, state: SpaceConquestState, width: number, height: number): void {
  const cam = state.camera;
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Deep space background
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
  bgGrad.addColorStop(0, '#0a0a1a');
  bgGrad.addColorStop(0.5, '#050510');
  bgGrad.addColorStop(1, '#010108');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Camera transform
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  // Background stars
  drawBGStars(ctx, state);

  // Nebula glow patches
  drawNebulaGlow(ctx, state);

  // Orbital paths
  drawOrbitalPaths(ctx, state);

  // Center star
  drawStar(ctx, state);

  // Planets (back to front by orbit radius)
  const sorted = [...state.planets].sort((a, b) => a.def.orbitRadius - b.def.orbitRadius);
  for (const planet of sorted) {
    drawPlanet(ctx, state, planet);
  }

  // Fleet transits
  for (const fleet of state.fleets) {
    drawFleet(ctx, state, fleet);
  }

  // VFX
  for (const vfx of state.vfx) {
    drawVFX(ctx, vfx);
  }

  // Particles
  for (const p of state.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // camera

  // Custom cursor (small crosshair)
  drawCursor(ctx, state, width, height);

  ctx.restore();
}

// ── Background Stars ───────────────────────────────────────────

function drawBGStars(ctx: CanvasRenderingContext2D, state: SpaceConquestState): void {
  const stars = ensureBGStars();
  const t = state.gameTime;
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.x);
    ctx.globalAlpha = s.brightness * twinkle;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Nebula ─────────────────────────────────────────────────────

function drawNebulaGlow(ctx: CanvasRenderingContext2D, state: SpaceConquestState): void {
  const nebulas = [
    { x: -400, y: -200, r: 200, color: 'rgba(139,92,246,0.04)' },
    { x: 300, y: 350, r: 180, color: 'rgba(236,72,153,0.03)' },
    { x: -200, y: 400, r: 250, color: 'rgba(59,130,246,0.03)' },
    { x: 500, y: -300, r: 160, color: 'rgba(249,115,22,0.025)' },
  ];
  for (const n of nebulas) {
    const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    grad.addColorStop(0, n.color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
}

// ── Orbital Paths ──────────────────────────────────────────────

function drawOrbitalPaths(ctx: CanvasRenderingContext2D, state: SpaceConquestState): void {
  for (const planet of state.planets) {
    ctx.strokeStyle = planet.conquered ? `${planet.def.glowColor}30` : '#ffffff08';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(state.starX, state.starY, planet.def.orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Center Star ────────────────────────────────────────────────

function drawStar(ctx: CanvasRenderingContext2D, state: SpaceConquestState): void {
  const { starX: sx, starY: sy, gameTime: t } = state;
  const pulse = 1 + 0.05 * Math.sin(t * 2);
  const r = 30 * pulse;

  // Outer corona
  const corona = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 3);
  corona.addColorStop(0, 'rgba(255,200,50,0.3)');
  corona.addColorStop(0.5, 'rgba(255,150,30,0.08)');
  corona.addColorStop(1, 'transparent');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
  ctx.fill();

  // Star body
  const starGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  starGrad.addColorStop(0, '#fff8e1');
  starGrad.addColorStop(0.4, '#ffd54f');
  starGrad.addColorStop(0.8, '#ff8f00');
  starGrad.addColorStop(1, '#e65100');
  ctx.fillStyle = starGrad;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();

  // Star glow
  ctx.shadowColor = '#ffd54f';
  ctx.shadowBlur = 40 * pulse;
  ctx.fillStyle = 'rgba(255,213,79,0.3)';
  ctx.beginPath();
  ctx.arc(sx, sy, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ── Planet ─────────────────────────────────────────────────────

function drawPlanet(ctx: CanvasRenderingContext2D, state: SpaceConquestState, planet: PlanetState): void {
  const { wx, wy, def } = planet;
  const isSelected = state.selectedPlanetId === def.id;
  const isHovered = state.hoveredPlanetId === def.id;
  const r = def.size;

  // Selection / hover glow
  if (isSelected || isHovered) {
    const glowR = r + (isSelected ? 14 : 8);
    const pulse = 0.6 + 0.4 * Math.sin(state.gameTime * 3);
    ctx.globalAlpha = isSelected ? 0.5 * pulse : 0.3;
    const glow = ctx.createRadialGradient(wx, wy, r * 0.5, wx, wy, glowR);
    glow.addColorStop(0, def.glowColor);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(wx, wy, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Planet shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(wx + 2, wy + 2, r, 0, Math.PI * 2);
  ctx.fill();

  // Planet body
  const grad = ctx.createRadialGradient(wx - r * 0.3, wy - r * 0.3, r * 0.1, wx, wy, r);
  grad.addColorStop(0, lighten(def.color, 40));
  grad.addColorStop(0.6, def.color);
  grad.addColorStop(1, darken(def.color, 40));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(wx, wy, r, 0, Math.PI * 2);
  ctx.fill();

  // Atmosphere ring
  ctx.strokeStyle = `${def.color}40`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(wx, wy, r + 3, 0, Math.PI * 2);
  ctx.stroke();

  // Conquest flag
  if (planet.conquered) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 10px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', wx, wy - r - 6);
  } else if (planet.inCombat) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 10px Oxanium, sans-serif';
    ctx.textAlign = 'center';
    const flash = Math.sin(state.gameTime * 8) > 0 ? 1 : 0.4;
    ctx.globalAlpha = flash;
    ctx.fillText('⚔', wx, wy - r - 6);
    ctx.globalAlpha = 1;
  }

  // Garrison count indicators
  const aliveNeutrals = planet.neutrals.filter(u => !u.dead).length;
  const aliveShips = planet.playerShips.filter(u => !u.dead).length;

  if (aliveNeutrals > 0) {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 8px Oxanium, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${aliveNeutrals}`, wx + r + 5, wy - 3);
  }
  if (aliveShips > 0) {
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 8px Oxanium, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${aliveShips}`, wx + r + 5, wy + 8);
  }

  // Planet name
  ctx.fillStyle = isSelected ? '#ffffff' : '#888888';
  ctx.font = `bold ${isSelected ? 10 : 8}px Oxanium, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(def.name, wx, wy + r + 14);

  // Draw units around planet
  drawUnitsAroundPlanet(ctx, state, planet);

  // Conquest beam effect
  if (planet.conquestAnim > 0) {
    ctx.globalAlpha = planet.conquestAnim * 0.6;
    const beamGrad = ctx.createRadialGradient(wx, wy, 0, wx, wy, r * 3);
    beamGrad.addColorStop(0, '#ffd700');
    beamGrad.addColorStop(0.5, `${def.color}88`);
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.arc(wx, wy, r * 3 * (2 - planet.conquestAnim), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── Units Around Planet ────────────────────────────────────────

function drawUnitsAroundPlanet(ctx: CanvasRenderingContext2D, state: SpaceConquestState, planet: PlanetState): void {
  const allUnits = [...planet.neutrals, ...planet.playerShips];
  for (const u of allUnits) {
    if (u.dead) {
      // Death fade
      if (u.animTimer < 1.5) {
        ctx.globalAlpha = Math.max(0, 1 - u.animTimer / 1.5);
        drawShipSprite(ctx, u, state.gameTime);
        ctx.globalAlpha = 1;
      }
      continue;
    }
    drawShipSprite(ctx, u, state.gameTime);
  }
}

function drawShipSprite(ctx: CanvasRenderingContext2D, unit: SpaceUnit, time: number): void {
  const bob = Math.sin(unit.bobPhase) * 2;
  const sx = unit.x;
  const sy = unit.y + bob;
  const r = unit.size;

  // Ship body (triangle pointing in facing direction)
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(unit.facing);

  // Shield bubble
  if (unit.shieldActive) {
    ctx.strokeStyle = '#7dd3fc88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(125,211,252,0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enrage aura
  if (unit.enraged) {
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 12;
  }

  // Ship shape
  ctx.fillStyle = unit.color;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.6, -r * 0.5);
  ctx.lineTo(-r * 0.3, 0);
  ctx.lineTo(-r * 0.6, r * 0.5);
  ctx.closePath();
  ctx.fill();

  // Engine glow
  if (unit.animState === 'moving' || unit.animState === 'attacking') {
    ctx.fillStyle = unit.animState === 'attacking' ? '#ff6b35' : '#4fc3f7';
    ctx.beginPath();
    ctx.arc(-r * 0.5, 0, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.restore();

  // HP bar (small, below ship)
  if (unit.hp < unit.maxHp && !unit.dead) {
    const barW = r * 2;
    const barH = 2;
    const barX = sx - barW / 2;
    const barY = sy + r + 4 + bob;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = unit.owner === 'player' ? '#4ade80' : '#ef4444';
    ctx.fillRect(barX, barY, barW * (unit.hp / unit.maxHp), barH);
  }
}

// ── Fleet Transit ──────────────────────────────────────────────

function drawFleet(ctx: CanvasRenderingContext2D, state: SpaceConquestState, fleet: { ships: SpaceUnit[]; progress: number }): void {
  for (const ship of fleet.ships) {
    drawShipSprite(ctx, ship, state.gameTime);
  }
}

// ── VFX ────────────────────────────────────────────────────────

function drawVFX(ctx: CanvasRenderingContext2D, vfx: SpaceVFX): void {
  const alpha = Math.max(0, vfx.life / vfx.maxLife);
  ctx.globalAlpha = alpha;

  switch (vfx.type) {
    case 'laser': {
      if (vfx.tx !== undefined && vfx.ty !== undefined) {
        ctx.strokeStyle = vfx.color;
        ctx.lineWidth = vfx.radius * alpha;
        ctx.shadowColor = vfx.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(vfx.x, vfx.y);
        ctx.lineTo(vfx.tx, vfx.ty);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'explosion': {
      const progress = 1 - alpha;
      const r = vfx.radius * (0.5 + progress);
      const grad = ctx.createRadialGradient(vfx.x, vfx.y, 0, vfx.x, vfx.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, vfx.color);
      grad.addColorStop(0.7, `${vfx.color}44`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Shockwave ring
      ctx.strokeStyle = `${vfx.color}88`;
      ctx.lineWidth = 2 * alpha;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, r * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'shield_hit': {
      ctx.strokeStyle = vfx.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, vfx.radius * (1 + (1 - alpha) * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'muzzle_flash': {
      const r = vfx.radius * (1 + (1 - alpha));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = vfx.color;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'conquest_beam': {
      const grad = ctx.createRadialGradient(vfx.x, vfx.y, 0, vfx.x, vfx.y, vfx.radius);
      grad.addColorStop(0, '#ffd700');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, vfx.radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.globalAlpha = 1;
}

// ── Cursor ─────────────────────────────────────────────────────

function drawCursor(ctx: CanvasRenderingContext2D, state: SpaceConquestState, width: number, height: number): void {
  // No custom cursor needed — the page uses CSS cursor
}

// ── Color Helpers ──────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  return adjustColor(hex, amount);
}

function darken(hex: string, amount: number): string {
  return adjustColor(hex, -amount);
}

function adjustColor(hex: string, amount: number): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Hit Testing ────────────────────────────────────────────────

/** Check which planet (if any) the world-space point hits */
export function hitTestPlanet(state: SpaceConquestState, wx: number, wy: number): number {
  for (const planet of state.planets) {
    const dx = wx - planet.wx;
    const dy = wy - planet.wy;
    const hitR = planet.def.size + 10; // generous click area
    if (dx * dx + dy * dy <= hitR * hitR) {
      return planet.def.id;
    }
  }
  return -1;
}

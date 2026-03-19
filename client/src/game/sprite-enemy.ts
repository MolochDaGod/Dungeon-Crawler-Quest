/**
 * Sprite Enemy Renderer — Top-Down Ent Character Sprites
 * Renders enemies using extracted craftpix ent sprite sheets with
 * 4-directional animation (down/left/right/up × idle/walk/attack/hurt/death).
 *
 * Sprite format (confirmed):
 *   Frame size: 128×128 pixels
 *   Idle:       512×512 = 4 cols × 4 rows  (4 dirs × 4 frames)
 *   Walk/Run:   768×512 = 6 cols × 4 rows  (4 dirs × 6 frames)
 *   Attack:     896×512 = 7 cols × 4 rows  (4 dirs × 7 frames)
 *   Hurt:       512×512 = 4 cols × 4 rows  (4 dirs × 4 frames)
 *   Death:      768×512 = 6 cols × 4 rows  (4 dirs × 6 frames)
 *   Row order: 0=down, 1=left, 2=right, 3=up
 */

// ── Types ──────────────────────────────────────────────────────

export type SpriteAnimState = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';

export interface SpriteEnemyDef {
  id: string;
  name: string;
  /** Base path to PNG/Ent#/Without_shadow/ folder */
  basePath: string;
  /** Prefix for file names (e.g. 'Ent1') */
  prefix: string;
  /** Maps to enemy template type in open-world.ts */
  enemyType: string;
  /** Draw scale (world pixels per sprite pixel) */
  drawScale: number;
}

interface SheetMeta {
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
}

const ANIM_META: Record<SpriteAnimState, SheetMeta> = {
  idle:   { cols: 4, rows: 4, frameW: 128, frameH: 128 },
  walk:   { cols: 6, rows: 4, frameW: 128, frameH: 128 },
  attack: { cols: 7, rows: 4, frameW: 128, frameH: 128 },
  hurt:   { cols: 4, rows: 4, frameW: 128, frameH: 128 },
  death:  { cols: 6, rows: 4, frameW: 128, frameH: 128 },
};

const ANIM_FPS: Record<SpriteAnimState, number> = {
  idle: 6, walk: 10, attack: 14, hurt: 10, death: 8,
};

// File name mapping (animation state → file suffix)
const ANIM_FILE: Record<SpriteAnimState, string> = {
  idle:   '_Idle_without_shadow.png',
  walk:   '_Walk_without_shadow.png',
  attack: '_Attack_without_shadow.png',
  hurt:   '_Hurt_without_shadow.png',
  death:  '_Death_without_shadow.png',
};

// ── Enemy Definitions ──────────────────────────────────────────
// 9 ent types across 3 packs, mapped to existing enemy template types

const SPRITE_BASE = '/assets/sprites';

export const SPRITE_ENEMY_DEFS: SpriteEnemyDef[] = [
  // Pack 1
  { id: 'ent1-p1', name: 'Forest Ent',       basePath: `${SPRITE_BASE}/ent-chars-1/PNG/Ent1/Without_shadow`, prefix: 'Ent1', enemyType: 'Treant',          drawScale: 0.5 },
  { id: 'ent2-p1', name: 'Moss Guardian',     basePath: `${SPRITE_BASE}/ent-chars-1/PNG/Ent2/Without_shadow`, prefix: 'Ent2', enemyType: 'Cave Bear',        drawScale: 0.5 },
  { id: 'ent3-p1', name: 'Thorn Walker',      basePath: `${SPRITE_BASE}/ent-chars-1/PNG/Ent3/Without_shadow`, prefix: 'Ent3', enemyType: 'Timber Wolf',      drawScale: 0.45 },
  // Pack 2
  { id: 'ent1-p2', name: 'Swamp Horror',      basePath: `${SPRITE_BASE}/ent-chars-2/PNG/Ent1/Without_shadow`, prefix: 'Ent1', enemyType: 'Tentacle Horror',  drawScale: 0.55 },
  { id: 'ent2-p2', name: 'Bog Shambler',      basePath: `${SPRITE_BASE}/ent-chars-2/PNG/Ent2/Without_shadow`, prefix: 'Ent2', enemyType: 'Golem',            drawScale: 0.5 },
  { id: 'ent3-p2', name: 'Rot Fiend',         basePath: `${SPRITE_BASE}/ent-chars-2/PNG/Ent3/Without_shadow`, prefix: 'Ent3', enemyType: 'Wraith',           drawScale: 0.45 },
  // Pack 3
  { id: 'ent1-p3', name: 'Ancient Oak',       basePath: `${SPRITE_BASE}/ent-chars-3/PNG/Ent1/Without_shadow`, prefix: 'Ent1', enemyType: 'Iron Sentinel',    drawScale: 0.6 },
  { id: 'ent2-p3', name: 'Blighted Treant',   basePath: `${SPRITE_BASE}/ent-chars-3/PNG/Ent2/Without_shadow`, prefix: 'Ent2', enemyType: 'Corrupted Knight', drawScale: 0.5 },
  { id: 'ent3-p3', name: 'Fungal Colossus',   basePath: `${SPRITE_BASE}/ent-chars-3/PNG/Ent3/Without_shadow`, prefix: 'Ent3', enemyType: 'Berserker',        drawScale: 0.55 },
];

// Quick lookup: enemy type → sprite def
const _enemyTypeToSprite = new Map<string, SpriteEnemyDef>();
for (const def of SPRITE_ENEMY_DEFS) {
  _enemyTypeToSprite.set(def.enemyType, def);
}

/** Check if an enemy type has a sprite definition */
export function hasSpriteForEnemy(enemyType: string): boolean {
  return _enemyTypeToSprite.has(enemyType);
}

/** Get sprite def for an enemy type */
export function getSpriteDefForEnemy(enemyType: string): SpriteEnemyDef | null {
  return _enemyTypeToSprite.get(enemyType) ?? null;
}

// ── Image Cache ────────────────────────────────────────────────

const _sheetCache = new Map<string, HTMLImageElement>();

function getSheet(def: SpriteEnemyDef, anim: SpriteAnimState): HTMLImageElement | null {
  const path = `${def.basePath}/${def.prefix}${ANIM_FILE[anim]}`;
  let img = _sheetCache.get(path);
  if (img) return img.complete ? img : null;

  img = new Image();
  img.src = path;
  _sheetCache.set(path, img);
  return null;
}

// Pre-load all sheets for faster first render
export function preloadSpriteEnemies(): void {
  for (const def of SPRITE_ENEMY_DEFS) {
    for (const anim of Object.keys(ANIM_FILE) as SpriteAnimState[]) {
      getSheet(def, anim);
    }
  }
}

// ── Direction from Facing Angle ────────────────────────────────

/** Convert a facing angle (radians) to sprite row index (0=down, 1=left, 2=right, 3=up) */
function facingToRow(facing: number): number {
  // Normalize to 0..2π
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // 4 directions: down (π/4..3π/4), left (3π/4..5π/4), up (5π/4..7π/4), right (else)
  if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) return 0;  // down
  if (a >= Math.PI * 0.75 && a < Math.PI * 1.25) return 1;  // left
  if (a >= Math.PI * 1.25 && a < Math.PI * 1.75) return 3;  // up
  return 2; // right
}

// ── Render ─────────────────────────────────────────────────────

/**
 * Draw a sprite enemy at the given position.
 * @param ctx       Canvas context
 * @param def       Sprite enemy definition
 * @param wx        World X position
 * @param wy        World Y position
 * @param facing    Facing angle in radians
 * @param animState Animation state
 * @param animTime  Elapsed time in this animation state (seconds)
 * @param camX      Camera X offset
 * @param camY      Camera Y offset
 * @param tint      Optional color tint (for damage flash etc.)
 */
export function drawSpriteEnemy(
  ctx: CanvasRenderingContext2D,
  def: SpriteEnemyDef,
  wx: number, wy: number,
  facing: number,
  animState: SpriteAnimState,
  animTime: number,
  camX: number, camY: number,
  tint?: string,
): void {
  const meta = ANIM_META[animState];
  const fps = ANIM_FPS[animState];
  const sheet = getSheet(def, animState);

  const row = facingToRow(facing);
  // Auto-detect frame count from actual sheet width (handles variable sizes per entity)
  const actualCols = sheet?.complete ? Math.floor(sheet.width / meta.frameW) : meta.cols;
  const totalFrames = actualCols;
  const frameIndex = animState === 'death'
    ? Math.min(Math.floor(animTime * fps), totalFrames - 1) // Death doesn't loop
    : Math.floor(animTime * fps) % totalFrames;

  const sx = frameIndex * meta.frameW;
  const sy = row * meta.frameH;
  const drawW = meta.frameW * def.drawScale;
  const drawH = meta.frameH * def.drawScale;

  const screenX = wx - camX - drawW / 2;
  const screenY = wy - camY - drawH / 2;

  if (sheet?.complete) {
    ctx.drawImage(sheet, sx, sy, meta.frameW, meta.frameH, screenX, screenY, drawW, drawH);

    // Optional tint overlay (for hurt flash)
    if (tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = tint;
      ctx.fillRect(screenX, screenY, drawW, drawH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  } else {
    // Fallback: colored circle with enemy initial
    ctx.fillStyle = '#4a8a2a';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(wx - camX, wy - camY, drawW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.name[0], wx - camX, wy - camY + 4);
  }
}

/**
 * Map OWEnemy animState string to SpriteAnimState.
 * The open-world engine uses strings like 'idle', 'walking', 'attacking', 'hit', 'dying'.
 */
export function mapOWAnimState(owAnimState: string): SpriteAnimState {
  switch (owAnimState) {
    case 'walking':
    case 'chasing':
    case 'returning':
    case 'fleeing':
      return 'walk';
    case 'attacking':
    case 'attack':
    case 'casting':
      return 'attack';
    case 'hit':
    case 'hurt':
    case 'stunned':
      return 'hurt';
    case 'dying':
    case 'dead':
      return 'death';
    default:
      return 'idle';
  }
}

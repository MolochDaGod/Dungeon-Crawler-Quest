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

  // When called from open-world renderer, the canvas context is already
  // camera-translated, so we just draw at world position directly.
  const screenX = wx - drawW / 2;
  const screenY = wy - drawH / 2;

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

// ═══════════════════════════════════════════════════════════════
// Pixel Crawler Sprite System
// Format: horizontal strip per direction (Down-Sheet, Side-Sheet, Up-Sheet)
// Single row, variable frame count (auto-detected from sheet width).
// Anims: Idle, Run, Death (no attack/hurt — fallback to idle with tint).
// ═══════════════════════════════════════════════════════════════

type PCDirection = 'Down' | 'Side' | 'Up';
type PCAnimType = 'Idle' | 'Run' | 'Death';

interface PCSpriteDef {
  id: string;
  name: string;
  basePath: string;       // folder containing Down/Side/Up sheet PNGs
  filePrefix: string;     // e.g. 'Idle', 'Run', 'Death'
  enemyType: string;      // maps to ENEMY_TEMPLATES
  drawScale: number;
  frameW: number;
  frameH: number;
}

// Pixel Crawler assets: served from ObjectStore CDN for deployment.
// Local fallback: /assets/packs/pixel-crawler/Pixel Crawler - Free Pack
// CDN: https://molochdagod.github.io/ObjectStore/sprites/pixel-crawler
const OS_CDN = 'https://molochdagod.github.io/ObjectStore';
const PC_BASE = `${OS_CDN}/sprites/pixel-crawler`;

const PC_SPRITE_DEFS: PCSpriteDef[] = [
  // ── Sloarscorth (Zone 3) — Frozen Crystal Highlands asset packs ──
  // Orc FBX Free — mapped to Stoneage Brute (primitive heavy melee)
  { id: 'orc-fbx-brute',    name: 'Stoneage Brute',    basePath: `${PC_BASE}/mobs/orc-fbx`,          filePrefix: '', enemyType: 'Stoneage Brute',    drawScale: 0.75, frameW: 32, frameH: 32 },
  // Bandits Free — mapped to Frost Wolf handlers / camp enemies
  { id: 'bandit-frost',     name: 'Frost Bandit',      basePath: `${PC_BASE}/mobs/bandit-free`,       filePrefix: '', enemyType: 'Frost Wolf',        drawScale: 0.65, frameW: 32, frameH: 32 },
  // Undead Free — mapped to Frozen Skeleton & Undead Warden
  { id: 'undead-skeleton',  name: 'Frozen Skeleton',   basePath: `${PC_BASE}/mobs/undead-skeleton`,   filePrefix: '', enemyType: 'Frozen Skeleton',   drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'undead-warden',    name: 'Undead Warden',     basePath: `${PC_BASE}/mobs/undead-warden`,     filePrefix: '', enemyType: 'Undead Warden',     drawScale: 0.7,  frameW: 32, frameH: 32 },
  { id: 'undead-wraith',    name: 'Ice Wraith',        basePath: `${PC_BASE}/mobs/undead-wraith`,     filePrefix: '', enemyType: 'Ice Wraith',        drawScale: 0.65, frameW: 32, frameH: 32 },
  // Castle pack — Crystal Golem (stone guardian aesthetic)
  { id: 'castle-golem',    name: 'Crystal Golem',     basePath: `${PC_BASE}/mobs/castle-golem`,      filePrefix: '', enemyType: 'Crystal Golem',     drawScale: 0.8,  frameW: 32, frameH: 32 },
  // KASA & SHOGUN boss asset packs
  { id: 'boss-kasa',       name: 'KASA',              basePath: `${PC_BASE}/bosses/kasa`,            filePrefix: '', enemyType: 'KASA',              drawScale: 1.2,  frameW: 64, frameH: 64 },
  { id: 'boss-shogun',     name: 'SHOGUN',            basePath: `${PC_BASE}/bosses/shogun`,          filePrefix: '', enemyType: 'SHOGUN',            drawScale: 1.2,  frameW: 64, frameH: 64 },
  // Ice Spider (recolored spider)
  { id: 'ice-spider',      name: 'Ice Spider',        basePath: `${PC_BASE}/mobs/ice-spider`,        filePrefix: '', enemyType: 'Ice Spider',        drawScale: 0.6,  frameW: 32, frameH: 32 },

  // Orc Crew — URL-safe paths for ObjectStore CDN
  { id: 'pc-orc',         name: 'Orc Grunt',       basePath: `${PC_BASE}/mobs/orc`,            filePrefix: '', enemyType: 'Orc Grunt',        drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-orc-rogue',   name: 'Orc Rogue',       basePath: `${PC_BASE}/mobs/orc-rogue`,      filePrefix: '', enemyType: 'Bandit',           drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-orc-shaman',  name: 'Orc Shaman',      basePath: `${PC_BASE}/mobs/orc-shaman`,     filePrefix: '', enemyType: 'Goblin Shaman',    drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-orc-warrior', name: 'Orc Warrior',     basePath: `${PC_BASE}/mobs/orc-warrior`,    filePrefix: '', enemyType: 'Piglin Brute',     drawScale: 0.65, frameW: 32, frameH: 32 },
  // Skeleton Crew
  { id: 'pc-skeleton',       name: 'Skeleton Base',   basePath: `${PC_BASE}/mobs/skeleton-base`,    filePrefix: '', enemyType: 'Skeleton',         drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-skeleton-mage',  name: 'Skeleton Mage',   basePath: `${PC_BASE}/mobs/skeleton-mage`,    filePrefix: '', enemyType: 'Dark Mage',        drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-skeleton-rogue', name: 'Skeleton Rogue',  basePath: `${PC_BASE}/mobs/skeleton-rogue`,   filePrefix: '', enemyType: 'Dark Archer',      drawScale: 0.65, frameW: 32, frameH: 32 },
  { id: 'pc-skeleton-war',   name: 'Skeleton Warrior',basePath: `${PC_BASE}/mobs/skeleton-warrior`, filePrefix: '', enemyType: 'Corrupted Knight', drawScale: 0.65, frameW: 32, frameH: 32 },
  // NPCs (faction NPCs / alternative enemy skins)
  { id: 'pc-knight', name: 'Knight',  basePath: `${PC_BASE}/npcs/knight`,  filePrefix: '', enemyType: 'Iron Sentinel',    drawScale: 0.7, frameW: 32, frameH: 32 },
  { id: 'pc-rogue',  name: 'Rogue',   basePath: `${PC_BASE}/npcs/rogue`,   filePrefix: '', enemyType: 'Bandit Chief',     drawScale: 0.7, frameW: 32, frameH: 32 },
  { id: 'pc-wizard', name: 'Wizard',  basePath: `${PC_BASE}/npcs/wizzard`, filePrefix: '', enemyType: 'Necromancer',      drawScale: 0.7, frameW: 32, frameH: 32 },
];

// Pixel Crawler sheets use: {basePath}/{Anim}/{Anim}-Sheet.png
// (e.g. .../Orc/Idle/Idle-Sheet.png, .../Orc/Run/Run-Sheet.png, .../Orc/Death/Death-Sheet.png)

function pcSheetPath(def: PCSpriteDef, anim: PCAnimType): string {
  return `${def.basePath}/${anim}/${anim}-Sheet.png`;
}

// Map SpriteAnimState to Pixel Crawler anim type
function mapToPCAnim(anim: SpriteAnimState): PCAnimType {
  switch (anim) {
    case 'walk': return 'Run';
    case 'death': return 'Death';
    case 'attack':
    case 'hurt':
    default: return 'Idle'; // No attack/hurt sheets — use Idle with tint
  }
}

// Direction from facing angle for Pixel Crawler (only 3 directions: Down, Side, Up)
// Side sheet is mirrored for left facing
function pcFacingDir(facing: number): { dir: PCDirection; flip: boolean } {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a >= Math.PI * 0.25 && a < Math.PI * 0.75) return { dir: 'Down', flip: false };
  if (a >= Math.PI * 0.75 && a < Math.PI * 1.25) return { dir: 'Side', flip: true };  // left = flip
  if (a >= Math.PI * 1.25 && a < Math.PI * 1.75) return { dir: 'Up', flip: false };
  return { dir: 'Side', flip: false }; // right = no flip
}

// PC sheet path with direction suffix: {basePath}/{Anim}/{Anim}_{Dir}-Sheet.png
// For mobs it's just {basePath}/{Anim}/{Anim}-Sheet.png (single direction, no dir suffix)
// So we try the direction-specific path first, then fallback to the generic one
function pcDirSheetPath(def: PCSpriteDef, anim: PCAnimType, dir: PCDirection): string {
  // Character sheets use direction suffix, mob sheets don't
  return `${def.basePath}/${anim}/${anim}-Sheet.png`;
}

function getPCSheet(def: PCSpriteDef, anim: PCAnimType): HTMLImageElement | null {
  const path = pcSheetPath(def, anim);
  let img = _sheetCache.get(path);
  if (img) return img.complete ? img : null;
  img = new Image();
  img.src = path;
  _sheetCache.set(path, img);
  return null;
}

// Register PC sprites into the main lookup map
for (const def of PC_SPRITE_DEFS) {
  if (!_enemyTypeToSprite.has(def.enemyType)) {
    // Create a compat SpriteEnemyDef wrapper so the main system recognizes it
    const compatDef: SpriteEnemyDef = {
      id: def.id,
      name: def.name,
      basePath: def.basePath,
      prefix: '',
      enemyType: def.enemyType,
      drawScale: def.drawScale,
    };
    _enemyTypeToSprite.set(def.enemyType, compatDef);
    SPRITE_ENEMY_DEFS.push(compatDef);
  }
}

/** Check if an enemy should use the Pixel Crawler renderer */
function isPCSprite(enemyType: string): PCSpriteDef | null {
  return PC_SPRITE_DEFS.find(d => d.enemyType === enemyType) ?? null;
}

/**
 * Draw a Pixel Crawler sprite (horizontal strip, auto-detect frame count).
 * Falls back to the main drawSpriteEnemy for Ent-pack types.
 */
export function drawPCSprite(
  ctx: CanvasRenderingContext2D,
  enemyType: string,
  wx: number, wy: number,
  facing: number,
  animState: SpriteAnimState,
  animTime: number,
  tint?: string,
): boolean {
  const pcDef = isPCSprite(enemyType);
  if (!pcDef) return false;

  const pcAnim = mapToPCAnim(animState);
  const sheet = getPCSheet(pcDef, pcAnim);
  const { dir, flip } = pcFacingDir(facing);
  const fps = animState === 'death' ? 8 : animState === 'walk' ? 10 : 6;
  const fw = pcDef.frameW;
  const fh = pcDef.frameH;

  // Auto-detect frames from sheet width
  const totalFrames = sheet?.complete ? Math.max(1, Math.floor(sheet.width / fw)) : 4;
  const frameIndex = animState === 'death'
    ? Math.min(Math.floor(animTime * fps), totalFrames - 1)
    : Math.floor(animTime * fps) % totalFrames;

  const sx = frameIndex * fw;
  const drawW = fw * pcDef.drawScale;
  const drawH = fh * pcDef.drawScale;
  const screenX = wx - drawW / 2;
  const screenY = wy - drawH / 2;

  if (sheet?.complete) {
    ctx.save();
    if (flip) {
      ctx.translate(wx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, 0, fw, fh, -drawW / 2, screenY, drawW, drawH);
    } else {
      ctx.drawImage(sheet, sx, 0, fw, fh, screenX, screenY, drawW, drawH);
    }

    // Tint for attack/hurt states (no dedicated sheets)
    if (tint || animState === 'attack' || animState === 'hurt') {
      const tintColor = tint || (animState === 'attack' ? '#ff440044' : '#ff000044');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = animState === 'hurt' ? 0.5 : 0.25;
      ctx.fillStyle = tintColor;
      if (flip) {
        ctx.fillRect(-drawW / 2, screenY, drawW, drawH);
      } else {
        ctx.fillRect(screenX, screenY, drawW, drawH);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else {
    // Fallback circle
    ctx.fillStyle = '#8b4513';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(wx, wy, drawW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  return true;
}

/** Preload all Pixel Crawler sheets */
export function preloadPCSprites(): void {
  const anims: PCAnimType[] = ['Idle', 'Run', 'Death'];
  for (const def of PC_SPRITE_DEFS) {
    for (const anim of anims) {
      getPCSheet(def, anim);
    }
  }
}

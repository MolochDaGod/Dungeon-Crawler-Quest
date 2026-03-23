/**
 * World Decorations — Buildings, Animals, Harvestable Nodes, Props
 * Places interactive and visual objects throughout zones with sprite rendering.
 *
 * Asset packs:
 *   Farm animals:     public/assets/sprites/farm-animals/PNG/
 *   Blacksmith/Guild: public/assets/sprites/blacksmith-house/PNG/
 *   Roads/ground:     public/assets/sprites/roads/PNG_Tiled/
 *   Village buildings: farm-animals/PNG/Houses.png
 */

import { ZoneDef, ISLAND_ZONES } from './zones';

// ── Constants ──────────────────────────────────────────────────

const FARM = '/assets/sprites/farm-animals/PNG';
const GUILD = '/assets/sprites/blacksmith-house/PNG';
const OS = 'https://molochdagod.github.io/ObjectStore';

// ── Types ──────────────────────────────────────────────────────

export type DecoType =
  | 'animal' | 'tree' | 'rock' | 'herb' | 'fish_node' | 'corpse'
  | 'building' | 'fence' | 'signpost' | 'campfire' | 'barrel'
  | 'chest' | 'npc' | 'guild_door' | 'forge' | 'well' | 'plant'
  | 'windmill' | 'barn' | 'cart';

export interface WorldDecoration {
  id: string;
  type: DecoType;
  x: number;
  y: number;
  zoneId: number;
  /** Sprite sheet path */
  sprite: string;
  /** Source rect in sprite sheet */
  srcRect: { sx: number; sy: number; sw: number; sh: number };
  /** Draw size in world pixels */
  drawW: number;
  drawH: number;
  /** Animated? */
  animated: boolean;
  frameCols?: number;
  frameRows?: number;
  frameW?: number;
  frameH?: number;
  fps?: number;
  /** Interactable with E key? */
  interactable: boolean;
  interactLabel?: string;
  /** For harvestable nodes: profession requirement */
  profession?: string;
  /** For animals: drops on kill */
  drops?: { item: string; qty: number; chance: number }[];
  /** For NPCs */
  npcRole?: 'vendor' | 'quest' | 'trainer' | 'blacksmith' | 'innkeeper' | 'guard';
  npcName?: string;
  /** Collision radius (0 = no collision) */
  collisionRadius: number;
  /** Has shadow? */
  hasShadow: boolean;
}

// ── Animal Sprite Definitions ──────────────────────────────────

export interface AnimalDef {
  id: string;
  name: string;
  sprite: string;
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
  idleRow: number;     // row for idle anim
  walkRow: number;     // row for walk anim
  idleFrames: number;
  walkFrames: number;
  fps: number;
  drawScale: number;
  hp: number;
  drops: { item: string; qty: number; chance: number }[];
  /** Which biomes this animal spawns in */
  biomes: string[];
  /** How many per zone on average */
  density: number;
  wanderSpeed: number;
}

export const ANIMAL_DEFS: AnimalDef[] = [
  {
    id: 'chicken', name: 'Chicken',
    sprite: `${FARM}/Chicken_animation.png`,
    frameW: 32, frameH: 32, cols: 8, rows: 6,
    idleRow: 0, walkRow: 1, idleFrames: 4, walkFrames: 4, fps: 6,
    drawScale: 1.2, hp: 15,
    drops: [
      { item: 'Raw Chicken', qty: 1, chance: 1.0 },
      { item: 'Feathers', qty: 2, chance: 0.8 },
      { item: 'Small Bone', qty: 1, chance: 0.3 },
    ],
    biomes: ['grass', 'dirt'], density: 5, wanderSpeed: 30,
  },
  {
    id: 'cow', name: 'Cow',
    sprite: `${FARM}/Cow_animation.png`,
    frameW: 64, frameH: 64, cols: 8, rows: 6,
    idleRow: 0, walkRow: 1, idleFrames: 4, walkFrames: 4, fps: 4,
    drawScale: 0.9, hp: 60,
    drops: [
      { item: 'Raw Beef', qty: 2, chance: 1.0 },
      { item: 'Thick Leather', qty: 1, chance: 0.8 },
      { item: 'Hide', qty: 1, chance: 0.6 },
      { item: 'Bone', qty: 1, chance: 0.4 },
    ],
    biomes: ['grass'], density: 3, wanderSpeed: 18,
  },
  {
    id: 'pig', name: 'Pig',
    sprite: `${FARM}/Pig_animation.png`,
    frameW: 32, frameH: 32, cols: 8, rows: 6,
    idleRow: 0, walkRow: 1, idleFrames: 4, walkFrames: 4, fps: 5,
    drawScale: 1.3, hp: 40,
    drops: [
      { item: 'Raw Pork', qty: 2, chance: 1.0 },
      { item: 'Leather', qty: 1, chance: 0.7 },
      { item: 'Bone', qty: 1, chance: 0.3 },
    ],
    biomes: ['grass', 'water', 'dirt'], density: 4, wanderSpeed: 22,
  },
];

// ── Live Animal State (for AI wandering) ───────────────────────

export interface LiveAnimal {
  id: number;
  def: AnimalDef;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  animState: 'idle' | 'walk' | 'hurt' | 'dead';
  animTimer: number;
  wanderTarget: { x: number; y: number } | null;
  wanderCooldown: number;
  zoneId: number;
  deathTimer: number;
  respawnTimer: number;
}

let _animalIdCounter = 0;

export function spawnAnimal(def: AnimalDef, x: number, y: number, zoneId: number): LiveAnimal {
  return {
    id: ++_animalIdCounter,
    def,
    x, y,
    facing: Math.random() * Math.PI * 2,
    hp: def.hp,
    maxHp: def.hp,
    dead: false,
    animState: 'idle',
    animTimer: 0,
    wanderTarget: null,
    wanderCooldown: 2 + Math.random() * 4,
    zoneId,
    deathTimer: 0,
    respawnTimer: 0,
  };
}

export function updateAnimal(animal: LiveAnimal, dt: number, zoneBounds: { x: number; y: number; w: number; h: number }): void {
  animal.animTimer += dt;

  if (animal.dead) {
    animal.deathTimer += dt;
    return;
  }

  // Wander AI
  animal.wanderCooldown -= dt;
  if (animal.wanderCooldown <= 0 && !animal.wanderTarget) {
    // Pick a random nearby point within zone
    const range = 200;
    animal.wanderTarget = {
      x: Math.max(zoneBounds.x + 40, Math.min(zoneBounds.x + zoneBounds.w - 40, animal.x + (Math.random() - 0.5) * range * 2)),
      y: Math.max(zoneBounds.y + 40, Math.min(zoneBounds.y + zoneBounds.h - 40, animal.y + (Math.random() - 0.5) * range * 2)),
    };
    animal.animState = 'walk';
    animal.wanderCooldown = 3 + Math.random() * 5;
  }

  if (animal.wanderTarget) {
    const dx = animal.wanderTarget.x - animal.x;
    const dy = animal.wanderTarget.y - animal.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) {
      animal.wanderTarget = null;
      animal.animState = 'idle';
    } else {
      animal.facing = Math.atan2(dy, dx);
      const speed = animal.def.wanderSpeed * dt;
      animal.x += (dx / dist) * speed;
      animal.y += (dy / dist) * speed;
    }
  }
}

// ── Draw Animal ────────────────────────────────────────────────

const _animalSheets = new Map<string, HTMLImageElement>();

function getAnimalSheet(src: string): HTMLImageElement | null {
  let img = _animalSheets.get(src);
  if (img) return img.complete ? img : null;
  img = new Image();
  img.src = src;
  _animalSheets.set(src, img);
  return null;
}

export function drawAnimal(
  ctx: CanvasRenderingContext2D,
  animal: LiveAnimal,
  camX: number, camY: number,
): void {
  const def = animal.def;
  const sheet = getAnimalSheet(def.sprite);

  const row = animal.animState === 'walk' ? def.walkRow : def.idleRow;
  const frames = animal.animState === 'walk' ? def.walkFrames : def.idleFrames;
  const frame = animal.dead ? 0 : Math.floor(animal.animTimer * def.fps) % frames;

  const drawW = def.frameW * def.drawScale;
  const drawH = def.frameH * def.drawScale;
  const screenX = animal.x - camX - drawW / 2;
  const screenY = animal.y - camY - drawH / 2;

  if (animal.dead) {
    ctx.globalAlpha = Math.max(0, 1 - animal.deathTimer * 0.5);
  }

  if (sheet?.complete) {
    ctx.drawImage(sheet,
      frame * def.frameW, row * def.frameH, def.frameW, def.frameH,
      screenX, screenY, drawW, drawH);
  } else {
    // Fallback circle
    ctx.fillStyle = def.id === 'cow' ? '#888' : def.id === 'pig' ? '#daa' : '#fa0';
    ctx.beginPath();
    ctx.arc(animal.x - camX, animal.y - camY, drawW / 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // Health bar if damaged
  if (!animal.dead && animal.hp < animal.maxHp) {
    const barW = 30;
    const barX = animal.x - camX - barW / 2;
    const barY = animal.y - camY - drawH / 2 - 8;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY, barW * (animal.hp / animal.maxHp), 4);
  }
}

// ── Heroes Guild (Blacksmith House Exterior) ───────────────────

export interface GuildBuilding {
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number;
  doorY: number;
  doorW: number;
  doorH: number;
  interiorLoaded: boolean;
}

const _guildSheets = new Map<string, HTMLImageElement>();

function getGuildSheet(src: string): HTMLImageElement | null {
  let img = _guildSheets.get(src);
  if (img) return img.complete ? img : null;
  img = new Image();
  img.src = src;
  _guildSheets.set(src, img);
  return null;
}

/** Draw the Heroes Guild exterior at position */
export function drawHeroesGuild(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  camX: number, camY: number,
  gameTime: number,
): void {
  const exterior = getGuildSheet(`${GUILD}/House_exterior.png`);
  const smoke = getGuildSheet(`${GUILD}/Smoke_animation.png`);

  const drawW = 280; // world-space width
  const drawH = 200; // world-space height
  const sx = gx - camX - drawW / 2;
  const sy = gy - camY - drawH / 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(gx - camX, gy - camY + drawH / 2 - 10, drawW / 2 + 10, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Main building
  if (exterior?.complete) {
    // Draw the main house piece (top-left of sheet: ~220×160)
    ctx.drawImage(exterior, 0, 0, 220, 160, sx, sy, drawW, drawH);
  } else {
    // Fallback
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(sx, sy, drawW, drawH);
    ctx.fillStyle = '#8a5a3a';
    ctx.fillRect(sx + 10, sy, drawW - 20, drawH / 3);
  }

  // Smoke animation (chimney)
  if (smoke?.complete) {
    const smokeFrame = Math.floor(gameTime * 6) % 16;
    const smokeFW = 48;
    const smokeFH = 80;
    ctx.globalAlpha = 0.6;
    ctx.drawImage(smoke, smokeFrame * smokeFW, 0, smokeFW, smokeFH,
      sx + drawW * 0.6, sy - 40, 36, 60);
    ctx.globalAlpha = 1;
  }

  // Door indicator
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(sx + drawW / 2 - 15, sy + drawH - 35, 30, 35);

  // "Heroes Guild" sign
  ctx.fillStyle = '#c5a059';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Heroes Guild', gx - camX, sy - 6);

  // E prompt
  ctx.fillStyle = '#ffd700';
  ctx.font = '9px sans-serif';
  ctx.fillText('[E] Enter', gx - camX, sy + drawH + 14);
}

// ── Village Layout Generator ───────────────────────────────────
// Generates decoration placements for a zone based on its properties

function seeded(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export interface ZoneDecorLayout {
  zoneId: number;
  decorations: WorldDecoration[];
  animals: LiveAnimal[];
  guildPos: { x: number; y: number } | null;
}

export function generateZoneDecorations(zone: ZoneDef): ZoneDecorLayout {
  const b = zone.bounds;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const decos: WorldDecoration[] = [];
  const animals: LiveAnimal[] = [];
  let guildPos: { x: number; y: number } | null = null;
  let decoId = 0;

  // ── Starting Village Special Layout ──
  if (zone.id === 0) {
    // Heroes Guild at center
    guildPos = { x: cx, y: cy - 100 };

    // Market row (south of center)
    const marketY = cy + 200;
    decos.push(makeBuilding(`z0-market-1`, 'cart', cx - 150, marketY, zone.id, 'Shop Cart'));
    decos.push(makeBuilding(`z0-market-2`, 'cart', cx, marketY, zone.id, 'Potion Cart'));
    decos.push(makeBuilding(`z0-market-3`, 'cart', cx + 150, marketY, zone.id, 'Weapon Cart'));

    // Village NPCs
    decos.push(makeNPC(`z0-npc-1`, cx - 150, marketY + 40, zone.id, 'vendor', 'Merchant Gilda'));
    decos.push(makeNPC(`z0-npc-2`, cx, marketY + 40, zone.id, 'vendor', 'Alchemist Fenn'));
    decos.push(makeNPC(`z0-npc-3`, cx + 150, marketY + 40, zone.id, 'vendor', 'Weaponsmith Kael'));
    decos.push(makeNPC(`z0-npc-4`, cx + 200, cy - 50, zone.id, 'blacksmith', 'Master Smith'));
    decos.push(makeNPC(`z0-npc-5`, cx - 250, cy, zone.id, 'quest', 'Captain Aldric'));
    decos.push(makeNPC(`z0-npc-6`, cx - 200, cy + 100, zone.id, 'trainer', 'Combat Tutor'));
    decos.push(makeNPC(`z0-npc-7`, cx + 300, cy + 100, zone.id, 'innkeeper', 'Innkeeper Rose'));

    // Farm animals in NE corner
    for (const aDef of ANIMAL_DEFS) {
      for (let i = 0; i < 3; i++) {
        const ax = cx + 200 + seeded(i, zone.id, aDef.id.charCodeAt(0)) * 300;
        const ay = cy - 300 + seeded(i + 10, zone.id, aDef.id.charCodeAt(0)) * 200;
        animals.push(spawnAnimal(aDef, ax, ay, zone.id));
      }
    }

    // Fences around perimeter
    for (let fx = b.x + 60; fx < b.x + b.w - 60; fx += 80) {
      decos.push(makeProp(`z0-fence-t-${decoId++}`, 'fence', fx, b.y + 30, zone.id));
      decos.push(makeProp(`z0-fence-b-${decoId++}`, 'fence', fx, b.y + b.h - 30, zone.id));
    }

    // Campfire near guild
    decos.push(makeProp(`z0-fire`, 'campfire', cx - 80, cy + 60, zone.id));

    // Well
    decos.push(makeProp(`z0-well`, 'well', cx + 80, cy + 60, zone.id));

    // Trees along edges
    for (let i = 0; i < 12; i++) {
      const tx = b.x + 40 + seeded(i, 1, zone.id) * (b.w - 80);
      const ty = b.y + 40 + (i < 6 ? seeded(i, 2, zone.id) * 100 : b.h - 100 + seeded(i, 3, zone.id) * 60);
      decos.push(makeHarvestable(`z0-tree-${i}`, 'tree', tx, ty, zone.id, 'logging'));
    }

    // Plants/herbs
    for (let i = 0; i < 8; i++) {
      const px = b.x + 80 + seeded(i, 5, zone.id) * (b.w - 160);
      const py = b.y + b.h - 200 + seeded(i, 6, zone.id) * 120;
      decos.push(makeHarvestable(`z0-herb-${i}`, 'herb', px, py, zone.id, 'herbalism'));
    }

    // Fishing pond markers (SE)
    decos.push(makeHarvestable(`z0-fish-1`, 'fish_node', cx + 350, cy + 300, zone.id, 'fishing'));
    decos.push(makeHarvestable(`z0-fish-2`, 'fish_node', cx + 400, cy + 330, zone.id, 'fishing'));

    return { zoneId: zone.id, decorations: decos, animals, guildPos };
  }

  // ── Generic Zone Decorations ──

  // Trees based on biome
  const treeDensity = zone.terrainType === 'jungle' ? 20 : zone.terrainType === 'grass' ? 10 : 5;
  for (let i = 0; i < treeDensity; i++) {
    const tx = b.x + 60 + seeded(i, 10, zone.id) * (b.w - 120);
    const ty = b.y + 60 + seeded(i, 11, zone.id) * (b.h - 120);
    decos.push(makeHarvestable(`z${zone.id}-tree-${i}`, 'tree', tx, ty, zone.id, 'logging'));
  }

  // Rocks/ore for stone biomes
  if (zone.terrainType === 'stone' || zone.terrainType === 'dirt') {
    for (let i = 0; i < 8; i++) {
      const rx = b.x + 80 + seeded(i, 20, zone.id) * (b.w - 160);
      const ry = b.y + 80 + seeded(i, 21, zone.id) * (b.h - 160);
      decos.push(makeHarvestable(`z${zone.id}-rock-${i}`, 'rock', rx, ry, zone.id, 'mining'));
    }
  }

  // Herbs for grass/jungle
  if (zone.terrainType === 'grass' || zone.terrainType === 'jungle') {
    for (let i = 0; i < 6; i++) {
      const hx = b.x + 60 + seeded(i, 30, zone.id) * (b.w - 120);
      const hy = b.y + 60 + seeded(i, 31, zone.id) * (b.h - 120);
      decos.push(makeHarvestable(`z${zone.id}-herb-${i}`, 'herb', hx, hy, zone.id, 'herbalism'));
    }
  }

  // Fish nodes near water zones
  if (zone.terrainType === 'water') {
    for (let i = 0; i < 4; i++) {
      decos.push(makeHarvestable(`z${zone.id}-fish-${i}`, 'fish_node',
        b.x + 100 + seeded(i, 40, zone.id) * (b.w - 200),
        b.y + 100 + seeded(i, 41, zone.id) * (b.h - 200),
        zone.id, 'fishing'));
    }
  }

  // Animals based on biome
  for (const aDef of ANIMAL_DEFS) {
    if (!aDef.biomes.includes(zone.terrainType)) continue;
    const count = Math.ceil(aDef.density * (zone.isSafeZone ? 0.5 : 1));
    for (let i = 0; i < count; i++) {
      const ax = b.x + 80 + seeded(i, 50 + aDef.id.charCodeAt(0), zone.id) * (b.w - 160);
      const ay = b.y + 80 + seeded(i + 20, 50 + aDef.id.charCodeAt(0), zone.id) * (b.h - 160);
      animals.push(spawnAnimal(aDef, ax, ay, zone.id));
    }
  }

  // ── Wilderness Camp Structures ──
  // Place camps at zone edges, crossroads, and near spawn points
  if (!zone.isSafeZone) {
    // Campfires near monster spawn clusters (1-3 per zone)
    const campCount = Math.min(3, Math.ceil(zone.monsterSpawns.length / 4));
    for (let i = 0; i < campCount; i++) {
      const campX = b.x + b.w * 0.2 + seeded(i, 70, zone.id) * b.w * 0.6;
      const campY = b.y + b.h * 0.2 + seeded(i, 71, zone.id) * b.h * 0.6;
      // Campfire
      decos.push(makeProp(`z${zone.id}-camp-fire-${i}`, 'campfire', campX, campY, zone.id));
      // Surrounding barrels/crates
      decos.push(makeProp(`z${zone.id}-camp-barrel-${i}a`, 'barrel', campX - 30, campY + 20, zone.id));
      decos.push(makeProp(`z${zone.id}-camp-barrel-${i}b`, 'barrel', campX + 35, campY + 15, zone.id));
      // Fence segments around camp
      decos.push(makeProp(`z${zone.id}-camp-fence-${i}a`, 'fence', campX - 50, campY - 30, zone.id));
      decos.push(makeProp(`z${zone.id}-camp-fence-${i}b`, 'fence', campX + 50, campY - 30, zone.id));
    }

    // Signposts at zone entrances
    for (let i = 0; i < zone.connectedZoneIds.length && i < 3; i++) {
      const edgeX = b.x + (i % 2 === 0 ? 60 : b.w - 60);
      const edgeY = b.y + 60 + seeded(i, 72, zone.id) * (b.h - 120);
      decos.push(makeProp(`z${zone.id}-sign-${i}`, 'signpost', edgeX, edgeY, zone.id));
    }

    // Ruined structures in higher-level zones
    if (zone.requiredLevel >= 8) {
      const ruinCount = zone.requiredLevel >= 12 ? 3 : 2;
      for (let i = 0; i < ruinCount; i++) {
        const rx = b.x + 120 + seeded(i, 73, zone.id) * (b.w - 240);
        const ry = b.y + 120 + seeded(i, 74, zone.id) * (b.h - 240);
        decos.push(makeBuilding(`z${zone.id}-ruin-${i}`, 'building', rx, ry, zone.id, 'Ruins'));
      }
    }
  }

  // Chests in non-safe zones
  if (!zone.isSafeZone) {
    const chestCount = zone.requiredLevel >= 15 ? 3 : zone.requiredLevel >= 8 ? 2 : 1;
    for (let i = 0; i < chestCount; i++) {
      decos.push({
        id: `z${zone.id}-chest-${i}`,
        type: 'chest',
        x: b.x + 100 + seeded(i, 60, zone.id) * (b.w - 200),
        y: b.y + 100 + seeded(i, 61, zone.id) * (b.h - 200),
        zoneId: zone.id,
        sprite: `${FARM}/Houses.png`,
        srcRect: { sx: 0, sy: 0, sw: 32, sh: 32 },
        drawW: 32, drawH: 32,
        animated: false,
        interactable: true,
        interactLabel: 'Open Chest',
        collisionRadius: 16,
        hasShadow: true,
      });
    }
  }

  return { zoneId: zone.id, decorations: decos, animals, guildPos };
}

// ── Factory Helpers ────────────────────────────────────────────

function makeBuilding(id: string, type: DecoType, x: number, y: number, zoneId: number, label: string): WorldDecoration {
  return {
    id, type, x, y, zoneId,
    sprite: `${FARM}/Houses.png`,
    srcRect: { sx: 0, sy: 0, sw: 80, sh: 60 },
    drawW: 80, drawH: 60,
    animated: false,
    interactable: true,
    interactLabel: label,
    collisionRadius: 30,
    hasShadow: true,
  };
}

function makeNPC(id: string, x: number, y: number, zoneId: number, role: WorldDecoration['npcRole'], name: string): WorldDecoration {
  return {
    id, type: 'npc', x, y, zoneId,
    sprite: `${GUILD}/Smith/Idle_Walk/Smith_idle_without_shadow.png`,
    srcRect: { sx: 0, sy: 0, sw: 48, sh: 48 },
    drawW: 40, drawH: 40,
    animated: true,
    frameCols: 6, frameRows: 4, frameW: 48, frameH: 48, fps: 5,
    interactable: true,
    interactLabel: `Talk to ${name}`,
    npcRole: role,
    npcName: name,
    collisionRadius: 16,
    hasShadow: true,
  };
}

function makeProp(id: string, type: DecoType, x: number, y: number, zoneId: number): WorldDecoration {
  const props: Record<string, { sw: number; sh: number; dw: number; dh: number }> = {
    fence:    { sw: 48, sh: 16, dw: 60, dh: 20 },
    campfire: { sw: 32, sh: 32, dw: 36, dh: 36 },
    well:     { sw: 32, sh: 32, dw: 36, dh: 36 },
    barrel:   { sw: 16, sh: 16, dw: 24, dh: 24 },
    signpost: { sw: 16, sh: 32, dw: 20, dh: 40 },
  };
  const p = props[type] || { sw: 32, sh: 32, dw: 32, dh: 32 };
  return {
    id, type, x, y, zoneId,
    sprite: `${FARM}/Houses.png`,
    srcRect: { sx: 0, sy: 200, sw: p.sw, sh: p.sh },
    drawW: p.dw, drawH: p.dh,
    animated: type === 'campfire',
    interactable: false,
    collisionRadius: type === 'fence' ? 0 : 12,
    hasShadow: true,
  };
}

function makeHarvestable(id: string, type: DecoType, x: number, y: number, zoneId: number, profession: string): WorldDecoration {
  const sizes: Record<string, { sw: number; sh: number; dw: number; dh: number }> = {
    tree:      { sw: 48, sh: 64, dw: 48, dh: 64 },
    rock:      { sw: 32, sh: 24, dw: 36, dh: 28 },
    herb:      { sw: 16, sh: 16, dw: 20, dh: 20 },
    fish_node: { sw: 32, sh: 16, dw: 36, dh: 20 },
    corpse:    { sw: 32, sh: 32, dw: 36, dh: 36 },
  };
  const s = sizes[type] || { sw: 32, sh: 32, dw: 32, dh: 32 };
  return {
    id, type, x, y, zoneId,
    sprite: type === 'tree' ? `${FARM}/Plants.png`
      : type === 'fish_node' ? `${FARM}/fishes.png`
      : `${FARM}/Ground_grass_details.png`,
    srcRect: { sx: 0, sy: 0, sw: s.sw, sh: s.sh },
    drawW: s.dw, drawH: s.dh,
    animated: type === 'fish_node',
    interactable: true,
    interactLabel: profession === 'logging' ? 'Chop'
      : profession === 'mining' ? 'Mine'
      : profession === 'herbalism' ? 'Gather'
      : profession === 'fishing' ? 'Fish'
      : profession === 'skinning' ? 'Skin'
      : 'Harvest',
    profession,
    collisionRadius: type === 'tree' ? 20 : 0,
    hasShadow: type === 'tree',
  };
}

// ── Draw Decoration ────────────────────────────────────────────

const _decoSheets = new Map<string, HTMLImageElement>();

function getDecoSheet(src: string): HTMLImageElement | null {
  let img = _decoSheets.get(src);
  if (img) return img.complete ? img : null;
  img = new Image();
  img.src = src;
  _decoSheets.set(src, img);
  return null;
}

export function drawDecoration(
  ctx: CanvasRenderingContext2D,
  deco: WorldDecoration,
  camX: number, camY: number,
  gameTime: number,
  playerDist?: number,
): void {
  const sheet = getDecoSheet(deco.sprite);
  const screenX = deco.x - camX - deco.drawW / 2;
  const screenY = deco.y - camY - deco.drawH / 2;

  // Shadow
  if (deco.hasShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(deco.x - camX, deco.y - camY + deco.drawH / 2, deco.drawW / 2, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sheet?.complete) {
    let srcX = deco.srcRect.sx;
    let srcY = deco.srcRect.sy;
    if (deco.animated && deco.frameCols && deco.frameW) {
      const frame = Math.floor(gameTime * (deco.fps || 6)) % deco.frameCols;
      srcX = frame * deco.frameW;
    }
    ctx.drawImage(sheet, srcX, srcY, deco.srcRect.sw, deco.srcRect.sh,
      screenX, screenY, deco.drawW, deco.drawH);
  } else {
    // Fallback icons
    const colors: Record<string, string> = {
      tree: '#2a5a1a', rock: '#6a6a7a', herb: '#4a8a3a', fish_node: '#3a7aba',
      building: '#5a4a3a', chest: '#c5a059', npc: '#fbbf24', fence: '#6a5030',
      campfire: '#ff6b2b', well: '#5a5a6a', cart: '#7a6040',
    };
    ctx.fillStyle = colors[deco.type] || '#888';
    if (deco.type === 'tree') {
      ctx.beginPath();
      ctx.arc(deco.x - camX, deco.y - camY - 10, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3020';
      ctx.fillRect(deco.x - camX - 3, deco.y - camY, 6, 16);
    } else if (deco.type === 'npc') {
      ctx.beginPath();
      ctx.arc(deco.x - camX, deco.y - camY, 12, 0, Math.PI * 2);
      ctx.fill();
      // NPC name
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(deco.npcName || 'NPC', deco.x - camX, deco.y - camY - 18);
      // Role icon
      const icons: Record<string, string> = { vendor: '🛒', quest: '❗', trainer: '📖', blacksmith: '🔨', innkeeper: '🏠', guard: '🛡️' };
      ctx.font = '12px sans-serif';
      ctx.fillText(icons[deco.npcRole || ''] || '?', deco.x - camX, deco.y - camY - 28);
    } else {
      ctx.fillRect(screenX, screenY, deco.drawW, deco.drawH);
    }
  }

  // Interaction prompt when player is near
  if (deco.interactable && playerDist !== undefined && playerDist < 80) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[E] ${deco.interactLabel}`, deco.x - camX, deco.y - camY - deco.drawH / 2 - 10);
  }
}

// ── Zone Layout Cache ──────────────────────────────────────────

const _layoutCache = new Map<number, ZoneDecorLayout>();

export function getZoneLayout(zone: ZoneDef): ZoneDecorLayout {
  let layout = _layoutCache.get(zone.id);
  if (!layout) {
    layout = generateZoneDecorations(zone);
    _layoutCache.set(zone.id, layout);
  }
  return layout;
}

export function clearLayoutCache(): void {
  _layoutCache.clear();
}

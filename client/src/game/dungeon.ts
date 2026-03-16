import {
  HeroData, HEROES, CLASS_ABILITIES, Vec2, AbilityDef,
  heroStatsAtLevel, calcDamage, RACE_COLORS, CLASS_COLORS, ItemDef, ITEMS,
  getHeroAbilities, getWeaponRenderType, getHeroWeapon
} from './types';
import { VoxelRenderer, DungeonTileVoxelType } from './voxel';
import { globalAnimDirector } from './voxel-motion';
import { SpriteEffectSystem, CLASS_SPELL_VFX } from './sprite-effects';
import {
  StatusEffect, StatusEffectType, createStatusEffect, applyStatusEffect,
  updateStatusEffects, isStunned, isRooted, isSilenced, getSpeedMultiplier,
  hasLifesteal, getAbilityStatusEffects, calculateDamage as combatCalcDamage,
  CombatEntity, EFFECT_COLORS
} from './combat';

export interface DungeonTile {
  type: 'floor' | 'wall' | 'door' | 'stairs' | 'trap' | 'chest' | 'spawn';
  revealed: boolean;
  decoration: number;
}

export interface DungeonRoom {
  x: number; y: number;
  w: number; h: number;
  type: 'normal' | 'treasure' | 'boss' | 'start' | 'shop';
  connected: number[];
}

export interface DungeonEnemy {
  id: number;
  x: number; y: number;
  type: string;
  hp: number; maxHp: number;
  atk: number; def: number;
  spd: number; rng: number;
  facing: number;
  dead: boolean;
  animState: string;
  animTimer: number;
  attackTimer: number;
  targetId: number | null;
  color: string;
  xpValue: number;
  goldValue: number;
  isBoss: boolean;
  size: number;
  activeEffects: StatusEffect[];
  ccImmunityTimers: Map<StatusEffectType, number>;
}

export interface DungeonHeroEnemy {
  id: number;
  x: number; y: number;
  heroDataId: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  atk: number; def: number;
  spd: number; rng: number;
  level: number;
  facing: number;
  dead: boolean;
  animState: string;
  animTimer: number;
  attackTimer: number;
  abilityCooldowns: number[];
  xpValue: number;
  goldValue: number;
  activeEffects: StatusEffect[];
  ccImmunityTimers: Map<StatusEffectType, number>;
  shieldHp: number;
  aiState: 'patrol' | 'chase' | 'attack' | 'ability' | 'retreat';
  patrolTarget: Vec2 | null;
  patrolTimer: number;
  homeX: number;
  homeY: number;
}

export interface DungeonChest {
  id: number;
  x: number; y: number;
  opened: boolean;
  loot: { gold: number; xp: number; item: ItemDef | null };
}

export interface DungeonPlayer {
  id: number;
  heroDataId: number;
  x: number; y: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  atk: number; def: number;
  spd: number; rng: number;
  level: number; xp: number;
  gold: number;
  items: (ItemDef | null)[];
  abilityCooldowns: number[];
  facing: number;
  animState: string;
  animTimer: number;
  vx: number; vy: number;
  dead: boolean;
  activeEffects: StatusEffect[];
  ccImmunityTimers: Map<StatusEffectType, number>;
  shieldHp: number;
  kills: number;
}

export interface DungeonProjectile {
  id: number;
  x: number; y: number;
  targetId: number;
  damage: number;
  speed: number;
  color: string;
  size: number;
  sourceIsPlayer: boolean;
}

export interface DungeonSpellEffect {
  x: number; y: number;
  type: 'cast_circle' | 'impact_ring' | 'aoe_blast' | 'skillshot_trail' | 'cone_sweep' | 'dash_trail';
  life: number; maxLife: number;
  radius: number;
  color: string;
  angle: number;
  data?: any;
}

export interface DungeonTargeting {
  active: boolean;
  abilityIndex: number;
  castType: 'targeted' | 'skillshot' | 'ground_aoe' | 'self_cast' | 'cone' | 'line';
  range: number;
  radius: number;
  color: string;
}

export interface DungeonParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

export interface DungeonFloatingText {
  x: number; y: number;
  text: string; color: string;
  life: number; vy: number; size: number;
}

export interface DungeonState {
  floor: number;
  tiles: DungeonTile[][];
  rooms: DungeonRoom[];
  mapWidth: number;
  mapHeight: number;
  player: DungeonPlayer;
  enemies: DungeonEnemy[];
  heroEnemies: DungeonHeroEnemy[];
  chests: DungeonChest[];
  projectiles: DungeonProjectile[];
  particles: DungeonParticle[];
  floatingTexts: DungeonFloatingText[];
  camera: { x: number; y: number; zoom: number };
  nextId: number;
  gameOver: boolean;
  gameWon: boolean;
  paused: boolean;
  showInventory: boolean;
  killFeed: { text: string; color: string; time: number }[];
  gameTime: number;
  visibleTiles: Set<number>;
  lastVisTileX: number;
  lastVisTileY: number;
  mouseWorld: Vec2;
  targeting: DungeonTargeting;
  spellEffects: DungeonSpellEffect[];
}

export interface DungeonHudState {
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  level: number; xp: number; xpToNext: number;
  gold: number; floor: number;
  kills: number;
  items: (ItemDef | null)[];
  abilityCooldowns: number[];
  heroName: string; heroClass: string; heroRace: string;
  gameOver: boolean; gameWon: boolean;
  activeEffects: StatusEffect[];
  atk: number; def: number; spd: number;
  killFeed: { text: string; color: string; time: number }[];
  gameTime: number;
  showInventory: boolean;
  animState: string;
  animTimer: number;
  facing: string;
  px: number;
  py: number;
}

const TILE_SIZE = 40;
const ENEMY_TEMPLATES: Record<string, {
  hp: number; atk: number; def: number; spd: number; rng: number;
  color: string; xp: number; gold: number; isBoss: boolean; size: number;
}> = {
  Slime: { hp: 80, atk: 8, def: 2, spd: 40, rng: 50, color: '#22c55e', xp: 15, gold: 8, isBoss: false, size: 8 },
  Skeleton: { hp: 100, atk: 12, def: 5, spd: 55, rng: 60, color: '#d4d4d8', xp: 25, gold: 12, isBoss: false, size: 10 },
  'Orc Grunt': { hp: 150, atk: 18, def: 8, spd: 50, rng: 60, color: '#65a30d', xp: 35, gold: 18, isBoss: false, size: 12 },
  'Dark Mage': { hp: 90, atk: 22, def: 4, spd: 45, rng: 200, color: '#7c3aed', xp: 40, gold: 22, isBoss: false, size: 10 },
  Spider: { hp: 70, atk: 14, def: 3, spd: 70, rng: 50, color: '#78716c', xp: 20, gold: 10, isBoss: false, size: 9 },
  Golem: { hp: 300, atk: 25, def: 20, spd: 30, rng: 60, color: '#a16207', xp: 60, gold: 35, isBoss: false, size: 16 },
  Dragon: { hp: 800, atk: 40, def: 18, spd: 45, rng: 150, color: '#dc2626', xp: 200, gold: 150, isBoss: true, size: 24 },
  Lich: { hp: 600, atk: 35, def: 12, spd: 40, rng: 250, color: '#6b21a8', xp: 180, gold: 120, isBoss: true, size: 20 },
};

const FLOOR_ENEMY_TYPES: string[][] = [
  ['Slime', 'Slime', 'Skeleton'],
  ['Skeleton', 'Spider', 'Orc Grunt'],
  ['Orc Grunt', 'Dark Mage', 'Spider'],
  ['Dark Mage', 'Golem', 'Orc Grunt'],
  ['Golem', 'Dark Mage', 'Dragon'],
];

const OPPOSING_RACES: Record<string, string[]> = {
  Human: ['Orc', 'Undead'],
  Barbarian: ['Undead', 'Elf'],
  Dwarf: ['Orc', 'Undead'],
  Elf: ['Orc', 'Barbarian'],
  Orc: ['Human', 'Elf', 'Dwarf'],
  Undead: ['Human', 'Barbarian', 'Dwarf'],
};

function getOpposingHeroes(playerRace: string): HeroData[] {
  const opposingRaces = OPPOSING_RACES[playerRace] || ['Orc', 'Undead'];
  return HEROES.filter(h => opposingRaces.includes(h.race) && !h.isSecret);
}

function xpForDungeonLevel(level: number): number {
  return 80 + (level - 1) * 60;
}

export function createDungeonState(heroId: number): DungeonState {
  const hd = HEROES.find(h => h.id === heroId) || HEROES[0];
  const stats = heroStatsAtLevel(hd, 1);

  const state: DungeonState = {
    floor: 1,
    tiles: [],
    rooms: [],
    mapWidth: 0,
    mapHeight: 0,
    player: {
      id: 1,
      heroDataId: hd.id,
      x: 0, y: 0,
      hp: stats.hp, maxHp: stats.hp,
      mp: stats.mp, maxMp: stats.mp,
      atk: stats.atk, def: stats.def,
      spd: hd.spd, rng: hd.rng * 50,
      level: 1, xp: 0, gold: 0,
      items: [null, null, null, null, null, null],
      abilityCooldowns: [0, 0, 0, 0],
      facing: 0,
      animState: 'idle',
      animTimer: 0,
      vx: 0, vy: 0,
      dead: false,
      activeEffects: [],
      ccImmunityTimers: new Map(),
      shieldHp: 0,
      kills: 0,
    },
    enemies: [],
    heroEnemies: [],
    chests: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    camera: { x: 0, y: 0, zoom: 1.2 },
    nextId: 100,
    gameOver: false,
    gameWon: false,
    paused: false,
    showInventory: false,
    killFeed: [],
    gameTime: 0,
    visibleTiles: new Set<number>(),
    lastVisTileX: -1,
    lastVisTileY: -1,
    mouseWorld: { x: 0, y: 0 },
    targeting: {
      active: false,
      abilityIndex: -1,
      castType: 'targeted',
      range: 0,
      radius: 0,
      color: '#fff',
    },
    spellEffects: [],
  };

  generateFloor(state);
  return state;
}

function generateFloor(state: DungeonState) {
  const w = 40 + state.floor * 5;
  const h = 30 + state.floor * 4;
  state.mapWidth = w;
  state.mapHeight = h;

  state.tiles = [];
  for (let y = 0; y < h; y++) {
    state.tiles[y] = [];
    for (let x = 0; x < w; x++) {
      state.tiles[y][x] = { type: 'wall', revealed: false, decoration: Math.random() < 0.1 ? 1 + Math.floor(Math.random() * 3) : 0 };
    }
  }

  state.rooms = [];
  const numRooms = 6 + state.floor * 2;
  let attempts = 0;

  while (state.rooms.length < numRooms && attempts < 200) {
    attempts++;
    const rw = 5 + Math.floor(Math.random() * 6);
    const rh = 4 + Math.floor(Math.random() * 5);
    const rx = 1 + Math.floor(Math.random() * (w - rw - 2));
    const ry = 1 + Math.floor(Math.random() * (h - rh - 2));

    let overlaps = false;
    for (const room of state.rooms) {
      if (rx < room.x + room.w + 1 && rx + rw > room.x - 1 &&
          ry < room.y + room.h + 1 && ry + rh > room.y - 1) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    const roomType = state.rooms.length === 0 ? 'start' as const :
      (state.rooms.length === numRooms - 1 && state.floor % 5 === 0) ? 'boss' as const :
      Math.random() < 0.15 ? 'treasure' as const :
      Math.random() < 0.1 ? 'shop' as const : 'normal' as const;

    state.rooms.push({ x: rx, y: ry, w: rw, h: rh, type: roomType, connected: [] });

    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        state.tiles[ry + dy][rx + dx].type = 'floor';
      }
    }
  }

  for (let i = 0; i < state.rooms.length - 1; i++) {
    connectRooms(state, state.rooms[i], state.rooms[i + 1]);
    state.rooms[i].connected.push(i + 1);
    state.rooms[i + 1].connected.push(i);
  }

  const startRoom = state.rooms[0];
  state.player.x = (startRoom.x + startRoom.w / 2) * TILE_SIZE;
  state.player.y = (startRoom.y + startRoom.h / 2) * TILE_SIZE;
  revealAround(state, state.player.x, state.player.y, 6);

  state.enemies = [];
  state.heroEnemies = [];
  state.chests = [];

  const floorIdx = Math.min(state.floor - 1, FLOOR_ENEMY_TYPES.length - 1);
  const enemyTypes = FLOOR_ENEMY_TYPES[floorIdx];
  const scaleFactor = 1 + (state.floor - 1) * 0.15;

  for (let i = 1; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    const cx = (room.x + room.w / 2) * TILE_SIZE;
    const cy = (room.y + room.h / 2) * TILE_SIZE;

    if (room.type === 'boss') {
      const bossType = state.floor >= 5 ? 'Dragon' : 'Lich';
      const template = ENEMY_TEMPLATES[bossType];
      state.enemies.push(createEnemy(state, bossType, template, cx, cy, scaleFactor));
      state.tiles[room.y + room.h - 1][room.x + room.w - 1].type = 'stairs';
    } else if (room.type === 'treasure') {
      state.chests.push({
        id: state.nextId++,
        x: cx, y: cy,
        opened: false,
        loot: { gold: 30 + state.floor * 15, xp: 20 + state.floor * 10, item: Math.random() < 0.3 ? ITEMS[Math.floor(Math.random() * ITEMS.length)] : null }
      });
      const guardType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      const template = ENEMY_TEMPLATES[guardType];
      state.enemies.push(createEnemy(state, guardType, template, cx - 40, cy - 30, scaleFactor));
    } else if (room.type === 'normal') {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count; j++) {
        const etype = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const template = ENEMY_TEMPLATES[etype];
        const ex = (room.x + 1 + Math.random() * (room.w - 2)) * TILE_SIZE;
        const ey = (room.y + 1 + Math.random() * (room.h - 2)) * TILE_SIZE;
        state.enemies.push(createEnemy(state, etype, template, ex, ey, scaleFactor));
      }
    }
  }

  for (let i = 1; i < state.rooms.length; i++) {
    if (state.rooms[i].type === 'normal' && Math.random() < 0.3) {
      const room = state.rooms[i];
      const cx = (room.x + 1 + Math.random() * (room.w - 2)) * TILE_SIZE;
      const cy = (room.y + 1 + Math.random() * (room.h - 2)) * TILE_SIZE;
      if (Math.random() < 0.4) {
        state.tiles[Math.floor(cy / TILE_SIZE)][Math.floor(cx / TILE_SIZE)].type = 'trap';
      }
    }
  }

  if (state.floor >= 2) {
    const playerHd = HEROES[state.player.heroDataId];
    const opposingPool = getOpposingHeroes(playerHd.race);
    if (opposingPool.length > 0) {
      const heroCount = state.floor <= 3 ? 1 : state.floor <= 6 ? 2 : 3;
      const normalRooms = state.rooms.filter(r => r.type === 'normal');
      const usedRoomIndices = new Set<number>();

      for (let h = 0; h < heroCount && usedRoomIndices.size < normalRooms.length; h++) {
        let roomIdx: number;
        do {
          roomIdx = Math.floor(Math.random() * normalRooms.length);
        } while (usedRoomIndices.has(roomIdx) && usedRoomIndices.size < normalRooms.length);
        usedRoomIndices.add(roomIdx);

        const room = normalRooms[roomIdx];
        const heroData = opposingPool[Math.floor(Math.random() * opposingPool.length)];
        const heroLevel = Math.max(1, state.player.level + state.floor - 2);
        const hx = (room.x + room.w / 2) * TILE_SIZE;
        const hy = (room.y + room.h / 2) * TILE_SIZE;

        state.heroEnemies.push(createHeroEnemy(state, heroData, heroLevel, hx, hy));
      }
    }
  }
}

function connectRooms(state: DungeonState, a: DungeonRoom, b: DungeonRoom) {
  let cx = Math.floor(a.x + a.w / 2);
  let cy = Math.floor(a.y + a.h / 2);
  const tx = Math.floor(b.x + b.w / 2);
  const ty = Math.floor(b.y + b.h / 2);

  while (cx !== tx) {
    if (cy >= 0 && cy < state.mapHeight && cx >= 0 && cx < state.mapWidth) {
      state.tiles[cy][cx].type = state.tiles[cy][cx].type === 'wall' ? 'floor' : state.tiles[cy][cx].type;
      if (cy > 0) state.tiles[cy - 1][cx].type = state.tiles[cy - 1][cx].type === 'wall' ? 'floor' : state.tiles[cy - 1][cx].type;
    }
    cx += cx < tx ? 1 : -1;
  }
  while (cy !== ty) {
    if (cy >= 0 && cy < state.mapHeight && cx >= 0 && cx < state.mapWidth) {
      state.tiles[cy][cx].type = state.tiles[cy][cx].type === 'wall' ? 'floor' : state.tiles[cy][cx].type;
      if (cx > 0) state.tiles[cy][cx - 1].type = state.tiles[cy][cx - 1].type === 'wall' ? 'floor' : state.tiles[cy][cx - 1].type;
    }
    cy += cy < ty ? 1 : -1;
  }
}

function createEnemy(
  state: DungeonState, type: string,
  template: typeof ENEMY_TEMPLATES[string],
  x: number, y: number, scale: number
): DungeonEnemy {
  return {
    id: state.nextId++,
    x, y, type,
    hp: Math.floor(template.hp * scale),
    maxHp: Math.floor(template.hp * scale),
    atk: Math.floor(template.atk * scale),
    def: Math.floor(template.def * scale),
    spd: template.spd,
    rng: template.rng,
    facing: 0,
    dead: false,
    animState: 'idle',
    animTimer: Math.random() * 5,
    attackTimer: 0,
    targetId: null,
    color: template.color,
    xpValue: Math.floor(template.xp * scale),
    goldValue: Math.floor(template.gold * scale),
    isBoss: template.isBoss,
    size: template.size,
    activeEffects: [],
    ccImmunityTimers: new Map(),
  };
}

function createHeroEnemy(state: DungeonState, heroData: HeroData, level: number, x: number, y: number): DungeonHeroEnemy {
  const stats = heroStatsAtLevel(heroData, level);
  const scaleFactor = 1 + (state.floor - 1) * 0.1;
  return {
    id: state.nextId++,
    x, y,
    heroDataId: heroData.id,
    hp: Math.floor(stats.hp * scaleFactor),
    maxHp: Math.floor(stats.hp * scaleFactor),
    mp: stats.mp,
    maxMp: stats.mp,
    atk: Math.floor(stats.atk * scaleFactor),
    def: Math.floor(stats.def * scaleFactor),
    spd: heroData.spd,
    rng: heroData.rng * 50,
    level,
    facing: 0,
    dead: false,
    animState: 'idle',
    animTimer: Math.random() * 5,
    attackTimer: 0,
    abilityCooldowns: [0, 0, 0, 0],
    xpValue: Math.floor((50 + level * 20) * scaleFactor),
    goldValue: Math.floor((40 + level * 15) * scaleFactor),
    activeEffects: [],
    ccImmunityTimers: new Map(),
    shieldHp: 0,
    aiState: 'patrol',
    patrolTarget: null,
    patrolTimer: 0,
    homeX: x,
    homeY: y,
  };
}

const VISION_TILE_RADIUS = 7;
const VISION_RADIUS = VISION_TILE_RADIUS * TILE_SIZE;

function tileKey(tx: number, ty: number, mapW: number): number {
  return ty * mapW + tx;
}

function isOpaque(state: DungeonState, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= state.mapWidth || ty >= state.mapHeight) return true;
  return state.tiles[ty][tx].type === 'wall';
}

function castLight(
  state: DungeonState, visible: Set<number>,
  cx: number, cy: number, maxRadius: number,
  row: number, startSlope: number, endSlope: number,
  xx: number, xy: number, yx: number, yy: number
) {
  if (startSlope < endSlope) return;
  const mapW = state.mapWidth;
  const rSq = maxRadius * maxRadius;

  let nextStart = startSlope;
  for (let i = row; i <= maxRadius; i++) {
    let blocked = false;
    for (let dx = -i, dy = -i; dx <= 0; dx++) {
      const mx = cx + dx * xx + dy * xy;
      const my = cy + dx * yx + dy * yy;

      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);

      if (startSlope < rSlope) continue;
      if (endSlope > lSlope) break;

      if (mx >= 0 && my >= 0 && mx < state.mapWidth && my < state.mapHeight) {
        if (dx * dx + dy * dy <= rSq) {
          visible.add(tileKey(mx, my, mapW));
        }
      }

      if (blocked) {
        if (isOpaque(state, mx, my)) {
          nextStart = rSlope;
          continue;
        } else {
          blocked = false;
          startSlope = nextStart;
        }
      } else if (isOpaque(state, mx, my) && i < maxRadius) {
        blocked = true;
        castLight(state, visible, cx, cy, maxRadius, i + 1, nextStart, rSlope, xx, xy, yx, yy);
        nextStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

function computeVisibility(state: DungeonState) {
  const ptx = Math.floor(state.player.x / TILE_SIZE);
  const pty = Math.floor(state.player.y / TILE_SIZE);

  if (ptx === state.lastVisTileX && pty === state.lastVisTileY) return;
  state.lastVisTileX = ptx;
  state.lastVisTileY = pty;

  const mapW = state.mapWidth;
  const visible = new Set<number>();
  visible.add(tileKey(ptx, pty, mapW));

  const multipliers = [
    [1,  0,  0,  1],
    [0,  1,  1,  0],
    [0, -1,  1,  0],
    [-1,  0,  0,  1],
    [-1,  0,  0, -1],
    [0, -1, -1,  0],
    [0,  1, -1,  0],
    [1,  0,  0, -1],
  ];

  for (const m of multipliers) {
    castLight(state, visible, ptx, pty, VISION_TILE_RADIUS, 1, 1.0, 0.0, m[0], m[1], m[2], m[3]);
  }

  state.visibleTiles = visible;

  visible.forEach((key) => {
    const ty = Math.floor(key / mapW);
    const tx = key % mapW;
    if (tx >= 0 && tx < state.mapWidth && ty >= 0 && ty < state.mapHeight) {
      state.tiles[ty][tx].revealed = true;
    }
  });
}

function forceVisibilityRefresh(state: DungeonState) {
  state.lastVisTileX = -1;
  state.lastVisTileY = -1;
  computeVisibility(state);
}

function revealAround(state: DungeonState, _wx: number, _wy: number, _radius: number) {
  computeVisibility(state);
}

function isInPlayerVision(state: DungeonState, wx: number, wy: number): boolean {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);
  if (tx < 0 || ty < 0 || tx >= state.mapWidth || ty >= state.mapHeight) return false;
  return state.visibleTiles.has(tileKey(tx, ty, state.mapWidth));
}

function distXY(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function isWalkable(state: DungeonState, wx: number, wy: number): boolean {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);
  if (tx < 0 || tx >= state.mapWidth || ty < 0 || ty >= state.mapHeight) return false;
  return state.tiles[ty][tx].type !== 'wall';
}

export function updateDungeon(state: DungeonState, dt: number, keys: Set<string>) {
  if (state.paused || state.gameOver) return;
  state.gameTime += dt;

  const p = state.player;
  if (p.dead) return;

  p.animTimer += dt;
  p.mp = Math.min(p.maxMp, p.mp + dt * 3);

  const effectResult = updateStatusEffects(p as any as CombatEntity, dt);
  if (effectResult.damage > 0) {
    p.hp -= effectResult.damage;
    addDungeonText(state, p.x, p.y - 20, `-${Math.floor(effectResult.damage)}`, '#ef4444', 12);
  }
  if (effectResult.heal > 0) {
    p.hp = Math.min(p.maxHp, p.hp + effectResult.heal);
    addDungeonText(state, p.x, p.y - 20, `+${Math.floor(effectResult.heal)}`, '#22c55e', 12);
  }

  if (!isStunned(p as any as CombatEntity)) {
    let mx = 0, my = 0;
    if (keys.has('w') || keys.has('arrowup')) my = -1;
    if (keys.has('s') || keys.has('arrowdown')) my = 1;
    if (keys.has('a') || keys.has('arrowleft')) mx = -1;
    if (keys.has('d') || keys.has('arrowright')) mx = 1;

    const spdMult = getSpeedMultiplier(p as any as CombatEntity);
    if (!isRooted(p as any as CombatEntity) && (mx !== 0 || my !== 0)) {
      const len = Math.sqrt(mx * mx + my * my);
      const speed = p.spd * 2 * spdMult;
      p.vx = (mx / len) * speed;
      p.vy = (my / len) * speed;
      p.facing = Math.atan2(my, mx);
      p.animState = 'walk';
    } else {
      p.vx = 0;
      p.vy = 0;
      if (p.animState === 'walk') p.animState = 'idle';
    }

    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (isWalkable(state, nx, p.y)) p.x = nx;
    if (isWalkable(state, p.x, ny)) p.y = ny;
  }

  for (let i = 0; i < p.abilityCooldowns.length; i++) {
    if (p.abilityCooldowns[i] > 0) p.abilityCooldowns[i] -= dt;
  }

  revealAround(state, p.x, p.y, 5);

  const trapTx = Math.floor(p.x / TILE_SIZE);
  const trapTy = Math.floor(p.y / TILE_SIZE);
  if (trapTx >= 0 && trapTx < state.mapWidth && trapTy >= 0 && trapTy < state.mapHeight) {
    const tile = state.tiles[trapTy][trapTx];
    if (tile.type === 'trap') {
      p.hp -= 15 + state.floor * 5;
      addDungeonText(state, p.x, p.y - 20, 'TRAP!', '#f59e0b', 18);
      spawnDungeonParticles(state, p.x, p.y, '#f59e0b', 10);
      tile.type = 'floor';
    }
    if (tile.type === 'stairs') {
      state.floor++;
      if (state.floor > 10) {
        state.gameOver = true;
        state.gameWon = true;
      } else {
        generateFloor(state);
        state.killFeed.push({ text: `Descended to Floor ${state.floor}`, color: '#ffd700', time: state.gameTime });
      }
      return;
    }
  }

  for (const chest of state.chests) {
    if (!chest.opened && distXY(p, chest) < 30) {
      chest.opened = true;
      p.gold += chest.loot.gold;
      p.xp += chest.loot.xp;
      addDungeonText(state, chest.x, chest.y - 20, `+${chest.loot.gold}g`, '#ffd700', 16);
      if (chest.loot.item) {
        const slot = p.items.findIndex(s => s === null);
        if (slot !== -1) {
          p.items[slot] = chest.loot.item;
          applyDungeonItemStats(p, chest.loot.item);
          addDungeonText(state, chest.x, chest.y - 35, chest.loot.item.name, '#a855f7', 14);
        }
      }
      checkDungeonLevelUp(state, p);
      spawnDungeonParticles(state, chest.x, chest.y, '#ffd700', 15);
    }
  }

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.animTimer += dt;

    const eres = updateStatusEffects(enemy as any as CombatEntity, dt);
    if (eres.damage > 0) {
      enemy.hp -= eres.damage;
      addDungeonText(state, enemy.x, enemy.y - 15, `-${Math.floor(eres.damage)}`, '#ff6666', 10);
    }

    if (enemy.hp <= 0) {
      killDungeonEnemy(state, enemy);
      continue;
    }

    if (isStunned(enemy as any as CombatEntity)) continue;

    const d = distXY(enemy, p);
    if (d < 400) {
      enemy.targetId = p.id;
      enemy.facing = angleBetween(enemy, p);

      if (d <= enemy.rng + 10) {
        enemy.animState = 'attack';
        globalAnimDirector.registerAttack(enemy.id, state.gameTime || 0);
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          const spdMult = getSpeedMultiplier(enemy as any as CombatEntity);
          state.projectiles.push({
            id: state.nextId++,
            x: enemy.x, y: enemy.y,
            targetId: p.id,
            damage: enemy.atk,
            speed: enemy.rng > 100 ? 400 : 300,
            color: enemy.color,
            size: enemy.isBoss ? 5 : 3,
            sourceIsPlayer: false,
          });
          enemy.attackTimer = 1.2 / spdMult;
        }
      } else if (!isRooted(enemy as any as CombatEntity)) {
        const spdMult = getSpeedMultiplier(enemy as any as CombatEntity);
        const angle = angleBetween(enemy, p);
        const nx2 = enemy.x + Math.cos(angle) * enemy.spd * spdMult * dt;
        const ny2 = enemy.y + Math.sin(angle) * enemy.spd * spdMult * dt;
        if (isWalkable(state, nx2, ny2)) {
          enemy.x = nx2;
          enemy.y = ny2;
        }
        enemy.animState = 'walk';
      }
    } else {
      enemy.animState = 'idle';
    }
  }

  updateHeroEnemies(state, dt);

  for (const proj of state.projectiles) {
    let target: { x: number; y: number; id: number } | null = null;
    if (proj.sourceIsPlayer) {
      target = state.enemies.find(e => e.id === proj.targetId && !e.dead) ||
               state.heroEnemies.find(he => he.id === proj.targetId && !he.dead) || null;
    } else {
      target = proj.targetId === p.id && !p.dead ? p : null;
    }

    if (!target) { proj.targetId = -1; continue; }

    const angle = angleBetween(proj, target);
    proj.x += Math.cos(angle) * proj.speed * dt;
    proj.y += Math.sin(angle) * proj.speed * dt;

    if (distXY(proj, target) < 15) {
      if (proj.sourceIsPlayer) {
        const enemy = state.enemies.find(e => e.id === target!.id);
        const heroEnemy = !enemy ? state.heroEnemies.find(he => he.id === target!.id && !he.dead) : null;
        if (enemy) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: enemy.def, activeEffects: enemy.activeEffects }, proj.damage);
          enemy.hp -= result.finalDamage;
          const col = result.isCrit ? '#ffd700' : '#ffffff';
          addDungeonText(state, enemy.x, enemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
          spawnDungeonParticles(state, enemy.x, enemy.y, '#ff6666', 3);

          const ls = hasLifesteal(p as any as CombatEntity);
          if (ls > 0) {
            const heal = Math.floor(result.finalDamage * ls);
            p.hp = Math.min(p.maxHp, p.hp + heal);
          }

          if (enemy.hp <= 0) killDungeonEnemy(state, enemy);
        } else if (heroEnemy) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: heroEnemy.def, activeEffects: heroEnemy.activeEffects }, proj.damage);
          if (heroEnemy.shieldHp > 0) {
            const abs = Math.min(heroEnemy.shieldHp, result.finalDamage);
            heroEnemy.shieldHp -= abs;
            result.finalDamage = Math.max(0, result.finalDamage - abs);
          }
          heroEnemy.hp -= result.finalDamage;
          const col = result.isCrit ? '#ffd700' : '#ffffff';
          addDungeonText(state, heroEnemy.x, heroEnemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
          spawnDungeonParticles(state, heroEnemy.x, heroEnemy.y, '#ff6666', 5);

          const ls = hasLifesteal(p as any as CombatEntity);
          if (ls > 0) {
            const heal = Math.floor(result.finalDamage * ls);
            p.hp = Math.min(p.maxHp, p.hp + heal);
          }

          if (heroEnemy.hp <= 0) killDungeonHeroEnemy(state, heroEnemy);
        }
      } else {
        const result = combatCalcDamage({ atk: 15, activeEffects: [] }, { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp }, proj.damage);
        if (p.shieldHp > 0) {
          const abs = Math.min(p.shieldHp, result.finalDamage);
          p.shieldHp -= abs;
          result.finalDamage = Math.max(0, result.finalDamage - abs);
        }
        p.hp -= result.finalDamage;
        addDungeonText(state, p.x, p.y - 20, `-${result.finalDamage}`, '#ef4444', 14);
        spawnDungeonParticles(state, p.x, p.y, '#ef4444', 3);
      }
      proj.targetId = -1;
    }
  }

  state.projectiles = state.projectiles.filter(pr => pr.targetId !== -1);
  state.enemies = state.enemies.filter(e => !e.dead || e.animTimer < 0.5);
  state.heroEnemies = state.heroEnemies.filter(he => !he.dead || he.animTimer < 0.5);

  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    pt.vy += 40 * dt;
  }
  state.particles = state.particles.filter(pt => pt.life > 0);

  for (const ft of state.floatingTexts) {
    ft.y += ft.vy * dt;
    ft.life -= dt;
  }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

  state.killFeed = state.killFeed.filter(k => state.gameTime - k.time < 6);

  for (const se of state.spellEffects) {
    se.life -= dt;
  }
  state.spellEffects = state.spellEffects.filter(se => se.life > 0);

  if (p.hp <= 0) {
    p.dead = true;
    state.gameOver = true;
    state.gameWon = false;
    spawnDungeonParticles(state, p.x, p.y, '#ef4444', 20);
  }

  state.camera.x += (p.x - state.camera.x) * 0.1;
  state.camera.y += (p.y - state.camera.y) * 0.1;
}

function killDungeonEnemy(state: DungeonState, enemy: DungeonEnemy) {
  enemy.dead = true;
  enemy.animTimer = 0;
  state.player.xp += enemy.xpValue;
  state.player.gold += enemy.goldValue;
  state.player.kills++;
  addDungeonText(state, enemy.x, enemy.y - 15, `+${enemy.goldValue}g`, '#ffd700', 12);
  spawnDungeonParticles(state, enemy.x, enemy.y, enemy.color, 12);
  checkDungeonLevelUp(state, state.player);
  state.killFeed.push({ text: `Defeated ${enemy.type}${enemy.isBoss ? ' (BOSS)' : ''}`, color: enemy.color, time: state.gameTime });
}

function killDungeonHeroEnemy(state: DungeonState, he: DungeonHeroEnemy) {
  he.dead = true;
  he.animTimer = 0;
  const heroData = HEROES[he.heroDataId];
  state.player.xp += he.xpValue;
  state.player.gold += he.goldValue;
  state.player.kills++;
  addDungeonText(state, he.x, he.y - 20, `+${he.goldValue}g +${he.xpValue}xp`, '#ffd700', 16);
  spawnDungeonParticles(state, he.x, he.y, RACE_COLORS[heroData.race] || '#fff', 20);
  checkDungeonLevelUp(state, state.player);
  state.killFeed.push({
    text: `Slain enemy hero ${heroData.name} (${heroData.race} ${heroData.heroClass})`,
    color: RACE_COLORS[heroData.race] || '#ffd700',
    time: state.gameTime
  });
}

function updateHeroEnemies(state: DungeonState, dt: number) {
  const p = state.player;
  if (p.dead) return;

  for (const he of state.heroEnemies) {
    if (he.dead) continue;
    he.animTimer += dt;
    he.mp = Math.min(he.maxMp, he.mp + dt * 2);

    const eres = updateStatusEffects(he as any as CombatEntity, dt);
    if (eres.damage > 0) {
      he.hp -= eres.damage;
      addDungeonText(state, he.x, he.y - 15, `-${Math.floor(eres.damage)}`, '#ff6666', 10);
    }
    if (eres.heal > 0) {
      he.hp = Math.min(he.maxHp, he.hp + eres.heal);
    }

    if (he.hp <= 0) {
      killDungeonHeroEnemy(state, he);
      continue;
    }

    if (isStunned(he as any as CombatEntity)) continue;

    for (let i = 0; i < he.abilityCooldowns.length; i++) {
      if (he.abilityCooldowns[i] > 0) he.abilityCooldowns[i] -= dt;
    }

    he.attackTimer -= dt;

    const d = distXY(he, p);
    const heroData = HEROES[he.heroDataId];
    const abilities = getHeroAbilities(heroData.race, heroData.heroClass);
    const hpPct = he.hp / he.maxHp;

    if (hpPct < 0.25 && he.aiState !== 'retreat') {
      he.aiState = 'retreat';
    } else if (d < 500 && hpPct >= 0.25) {
      if (d <= he.rng + 20) {
        he.aiState = 'attack';
      } else {
        he.aiState = 'chase';
      }
    } else if (he.aiState !== 'retreat') {
      he.aiState = 'patrol';
    }

    he.facing = angleBetween(he, p);

    switch (he.aiState) {
      case 'patrol': {
        he.patrolTimer -= dt;
        if (!he.patrolTarget || he.patrolTimer <= 0 || distXY(he, he.patrolTarget) < 10) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 80;
          he.patrolTarget = {
            x: he.homeX + Math.cos(angle) * dist,
            y: he.homeY + Math.sin(angle) * dist,
          };
          he.patrolTimer = 2 + Math.random() * 3;
        }
        if (he.patrolTarget && !isRooted(he as any as CombatEntity)) {
          const angle = angleBetween(he, he.patrolTarget);
          const spdMult = getSpeedMultiplier(he as any as CombatEntity);
          const nx = he.x + Math.cos(angle) * he.spd * 0.5 * spdMult * dt;
          const ny = he.y + Math.sin(angle) * he.spd * 0.5 * spdMult * dt;
          if (isWalkable(state, nx, ny)) { he.x = nx; he.y = ny; }
          he.facing = angle;
          he.animState = 'walk';
        }
        break;
      }
      case 'chase': {
        if (!isRooted(he as any as CombatEntity)) {
          const spdMult = getSpeedMultiplier(he as any as CombatEntity);
          const angle = angleBetween(he, p);
          const nx = he.x + Math.cos(angle) * he.spd * 2 * spdMult * dt;
          const ny = he.y + Math.sin(angle) * he.spd * 2 * spdMult * dt;
          if (isWalkable(state, nx, ny)) { he.x = nx; he.y = ny; }
          he.animState = 'walk';
        }

        if (abilities) {
          for (let i = 1; i < abilities.length; i++) {
            const ab = abilities[i];
            if (!ab || he.abilityCooldowns[i] > 0 || he.mp < ab.manaCost) continue;
            if (ab.type === 'dash' && d > 100 && d < ab.range + 50) {
              heroEnemyUseAbility(state, he, i, abilities);
              break;
            }
          }
        }
        break;
      }
      case 'attack': {
        he.animState = 'attack';

        if (abilities) {
          let usedAbility = false;
          for (let i = 1; i < abilities.length; i++) {
            const ab = abilities[i];
            if (!ab || he.abilityCooldowns[i] > 0 || he.mp < ab.manaCost) continue;
            if (d <= (ab.range || he.rng) + 30 || ab.castType === 'self_cast') {
              if (Math.random() < 0.4) {
                heroEnemyUseAbility(state, he, i, abilities);
                usedAbility = true;
                break;
              }
            }
          }

          if (!usedAbility && he.attackTimer <= 0) {
            const spdMult = getSpeedMultiplier(he as any as CombatEntity);
            state.projectiles.push({
              id: state.nextId++,
              x: he.x, y: he.y,
              targetId: p.id,
              damage: he.atk,
              speed: he.rng > 150 ? 400 : 350,
              color: CLASS_COLORS[heroData.heroClass] || '#fff',
              size: 4,
              sourceIsPlayer: false,
            });
            he.attackTimer = 1.0 / spdMult;
          }
        } else if (he.attackTimer <= 0) {
          const spdMult = getSpeedMultiplier(he as any as CombatEntity);
          state.projectiles.push({
            id: state.nextId++,
            x: he.x, y: he.y,
            targetId: p.id,
            damage: he.atk,
            speed: 350,
            color: CLASS_COLORS[heroData.heroClass] || '#fff',
            size: 4,
            sourceIsPlayer: false,
          });
          he.attackTimer = 1.0 / spdMult;
        }
        break;
      }
      case 'retreat': {
        if (!isRooted(he as any as CombatEntity)) {
          const spdMult = getSpeedMultiplier(he as any as CombatEntity);
          const fleeAngle = angleBetween(p, he);
          const nx = he.x + Math.cos(fleeAngle) * he.spd * 2.5 * spdMult * dt;
          const ny = he.y + Math.sin(fleeAngle) * he.spd * 2.5 * spdMult * dt;
          if (isWalkable(state, nx, ny)) { he.x = nx; he.y = ny; }
          he.animState = 'walk';
          he.facing = fleeAngle;
        }

        if (abilities) {
          for (let i = 0; i < abilities.length; i++) {
            const ab = abilities[i];
            if (!ab || he.abilityCooldowns[i] > 0 || he.mp < ab.manaCost) continue;
            if (ab.type === 'buff' || ab.type === 'heal' || ab.type === 'dash') {
              heroEnemyUseAbility(state, he, i, abilities);
              break;
            }
          }
        }

        if (hpPct >= 0.4 || d > 500) {
          he.aiState = 'patrol';
        }
        break;
      }
    }
  }
}

function heroEnemyUseAbility(state: DungeonState, he: DungeonHeroEnemy, abilityIndex: number, abilities: AbilityDef[]) {
  if (isSilenced(he as any as CombatEntity)) return;

  const ab = abilities[abilityIndex];
  if (!ab) return;

  he.mp -= ab.manaCost;
  he.abilityCooldowns[abilityIndex] = ab.cooldown;
  he.animState = 'ability';

  const p = state.player;
  const heroData = HEROES[he.heroDataId];
  const abilityColor = CLASS_COLORS[heroData.heroClass] || '#fff';

  switch (ab.type) {
    case 'damage': {
      if (distXY(he, p) <= (ab.range || he.rng) + 50) {
        const dmg = ab.damage + he.atk * 0.8;
        const result = combatCalcDamage({ atk: he.atk, activeEffects: he.activeEffects }, { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp }, dmg, 0.1);
        if (p.shieldHp > 0) {
          const abs = Math.min(p.shieldHp, result.finalDamage);
          p.shieldHp -= abs;
          result.finalDamage = Math.max(0, result.finalDamage - abs);
        }
        p.hp -= result.finalDamage;
        addDungeonText(state, p.x, p.y - 20, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, '#ef4444', 14);
        spawnDungeonParticles(state, p.x, p.y, abilityColor, 8);
        const effects = getAbilityEffects(ab.name, he.id, he.atk);
        for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      }
      break;
    }
    case 'aoe': {
      const cx = he.x + Math.cos(he.facing) * 60;
      const cy = he.y + Math.sin(he.facing) * 60;
      if (distXY({ x: cx, y: cy }, p) < ab.radius) {
        const dmg = ab.damage + he.atk * 0.6;
        const result = combatCalcDamage({ atk: he.atk, activeEffects: he.activeEffects }, { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp }, dmg);
        if (p.shieldHp > 0) {
          const abs = Math.min(p.shieldHp, result.finalDamage);
          p.shieldHp -= abs;
          result.finalDamage = Math.max(0, result.finalDamage - abs);
        }
        p.hp -= result.finalDamage;
        addDungeonText(state, p.x, p.y - 20, `-${result.finalDamage}`, '#ef4444', 14);
        const effects = getAbilityEffects(ab.name, he.id, he.atk);
        for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      }
      spawnDungeonParticles(state, cx, cy, abilityColor, 15);
      break;
    }
    case 'buff': {
      const effects = getAbilityEffects(ab.name, he.id, he.atk);
      for (const eff of effects) applyStatusEffect(he as any as CombatEntity, eff);
      spawnDungeonParticles(state, he.x, he.y, '#ffd700', 10);
      break;
    }
    case 'heal': {
      he.shieldHp = 60 + he.def * 2;
      const effects = getAbilityEffects(ab.name, he.id, he.atk);
      for (const eff of effects) applyStatusEffect(he as any as CombatEntity, eff);
      spawnDungeonParticles(state, he.x, he.y, '#22c55e', 8);
      break;
    }
    case 'dash': {
      const angle = angleBetween(he, p);
      const dashDist = Math.min(ab.range, distXY(he, p));
      const nx = he.x + Math.cos(angle) * dashDist;
      const ny = he.y + Math.sin(angle) * dashDist;
      if (isWalkable(state, nx, ny)) { he.x = nx; he.y = ny; }
      if (ab.damage > 0 && distXY(he, p) < 60) {
        const result = combatCalcDamage({ atk: he.atk, activeEffects: he.activeEffects }, { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp }, ab.damage + he.atk * 0.5);
        if (p.shieldHp > 0) {
          const abs = Math.min(p.shieldHp, result.finalDamage);
          p.shieldHp -= abs;
          result.finalDamage = Math.max(0, result.finalDamage - abs);
        }
        p.hp -= result.finalDamage;
        addDungeonText(state, p.x, p.y - 20, `-${result.finalDamage}`, '#ef4444', 14);
      }
      spawnDungeonParticles(state, he.x, he.y, abilityColor, 8);
      const effects = getAbilityEffects(ab.name, he.id, he.atk);
      for (const eff of effects) applyStatusEffect(he as any as CombatEntity, eff);
      break;
    }
    case 'debuff': {
      if (distXY(he, p) <= ab.radius + 50) {
        const effects = getAbilityEffects(ab.name, he.id, he.atk);
        for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
        if (ab.damage > 0) {
          const result = combatCalcDamage({ atk: he.atk, activeEffects: he.activeEffects }, { def: p.def, activeEffects: p.activeEffects }, ab.damage);
          p.hp -= result.finalDamage;
        }
      }
      spawnDungeonParticles(state, he.x, he.y, '#06b6d4', 10);
      break;
    }
  }
  addDungeonText(state, he.x, he.y - 30, ab.name, abilityColor, 14);
}

function checkDungeonLevelUp(state: DungeonState, p: DungeonPlayer) {
  while (p.level < 30 && p.xp >= xpForDungeonLevel(p.level)) {
    p.xp -= xpForDungeonLevel(p.level);
    p.level++;
    const hd = HEROES[p.heroDataId];
    const stats = heroStatsAtLevel(hd, p.level);
    const oldMaxHp = p.maxHp;
    p.maxHp = stats.hp + totalDungeonItemStat(p, 'hp');
    p.hp = Math.min(p.hp + (p.maxHp - oldMaxHp), p.maxHp);
    p.atk = stats.atk + totalDungeonItemStat(p, 'atk');
    p.def = stats.def + totalDungeonItemStat(p, 'def');
    p.spd = stats.spd + totalDungeonItemStat(p, 'spd');
    p.maxMp = stats.mp + totalDungeonItemStat(p, 'mp');
    p.mp = Math.min(p.mp + 20, p.maxMp);
    addDungeonText(state, p.x, p.y - 40, `LEVEL ${p.level}!`, '#ffd700', 20);
    spawnDungeonParticles(state, p.x, p.y, '#ffd700', 20);
    state.killFeed.push({ text: `Reached level ${p.level}!`, color: '#ffd700', time: state.gameTime });
  }
}

function totalDungeonItemStat(p: DungeonPlayer, stat: 'hp' | 'atk' | 'def' | 'spd' | 'mp'): number {
  return p.items.reduce((t, item) => t + (item ? item[stat] : 0), 0);
}

function applyDungeonItemStats(p: DungeonPlayer, item: ItemDef) {
  p.maxHp += item.hp; p.hp += item.hp;
  p.atk += item.atk; p.def += item.def;
  p.spd += item.spd; p.maxMp += item.mp; p.mp += item.mp;
}

function getDungeonSettings(): { showDamageNumbers: boolean; showDebugOverlay: boolean } {
  try {
    const raw = localStorage.getItem('grudge_graphics_settings');
    if (raw) {
      const s = JSON.parse(raw);
      return {
        showDamageNumbers: s.showDamageNumbers !== false,
        showDebugOverlay: s.showDebugOverlay === true,
      };
    }
  } catch { /* ignore */ }
  return { showDamageNumbers: true, showDebugOverlay: false };
}

function addDungeonText(state: DungeonState, x: number, y: number, text: string, color: string, size: number) {
  if (!getDungeonSettings().showDamageNumbers) return;
  state.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -35, size });
}

function spawnDungeonParticles(state: DungeonState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 150,
      vy: (Math.random() - 0.5) * 150 - 30,
      life: 0.6, maxLife: 0.6,
      color, size: 3
    });
  }
}

export function handleDungeonAbility(state: DungeonState, abilityIndex: number, targetWorld?: { x: number; y: number }) {
  const p = state.player;
  if (p.dead || isStunned(p as any) || isSilenced(p as any)) return;

  const hd = HEROES[p.heroDataId];
  const abilities = getHeroAbilities(hd.race, hd.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;

  const ab = abilities[abilityIndex];
  if (p.abilityCooldowns[abilityIndex] > 0 || p.mp < ab.manaCost) return;

  p.mp -= ab.manaCost;
  p.abilityCooldowns[abilityIndex] = ab.cooldown;
  p.animState = 'ability';

  // Trigger sprite-sheet VFX for this ability
  const hd2 = HEROES[p.heroDataId];
  const classVfx = CLASS_SPELL_VFX[hd2.heroClass];
  if (classVfx && classVfx[abilityIndex] && (state as any)._spriteEffects) {
    ((state as any)._spriteEffects as SpriteEffectSystem).playEffect(classVfx[abilityIndex], p.x, p.y, 1.5, 800);
  }

  if (targetWorld && (ab.castType === 'ground_aoe' || ab.castType === 'skillshot' || ab.castType === 'line' || ab.castType === 'cone')) {
    p.facing = Math.atan2(targetWorld.y - p.y, targetWorld.x - p.x);
  }

  const nearest = findNearestDungeonEnemy(state, p, ab.range + 100);
  const abilityColor = CLASS_COLORS[hd.heroClass] || '#fff';

  addSpellEffect(state, p.x, p.y, 'cast_circle', 25, abilityColor, 0.5);

  const realHeroTarget = nearest ? state.heroEnemies.find(he => he.id === nearest.id && !he.dead) : null;

  switch (ab.type) {
    case 'damage': {
      if (nearest) {
        const dmg = ab.damage + p.atk * 0.8;
        if (realHeroTarget) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: realHeroTarget.def, activeEffects: realHeroTarget.activeEffects }, dmg, 0.1);
          if (realHeroTarget.shieldHp > 0) { const a = Math.min(realHeroTarget.shieldHp, result.finalDamage); realHeroTarget.shieldHp -= a; result.finalDamage = Math.max(0, result.finalDamage - a); }
          realHeroTarget.hp -= result.finalDamage;
          addDungeonText(state, realHeroTarget.x, realHeroTarget.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, result.isCrit ? '#ffd700' : abilityColor, 14);
          spawnDungeonParticles(state, realHeroTarget.x, realHeroTarget.y, abilityColor, 8);
          addSpellEffect(state, realHeroTarget.x, realHeroTarget.y, 'impact_ring', 30, abilityColor, 0.4);
          const effects = getAbilityEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(realHeroTarget as any as CombatEntity, eff);
          if (realHeroTarget.hp <= 0) killDungeonHeroEnemy(state, realHeroTarget);
        } else {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, dmg, 0.1);
          nearest.hp -= result.finalDamage;
          addDungeonText(state, nearest.x, nearest.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, result.isCrit ? '#ffd700' : abilityColor, 14);
          spawnDungeonParticles(state, nearest.x, nearest.y, abilityColor, 8);
          addSpellEffect(state, nearest.x, nearest.y, 'impact_ring', 30, abilityColor, 0.4);
          const effects = getAbilityEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(nearest as any as CombatEntity, eff);
          if (nearest.hp <= 0) killDungeonEnemy(state, nearest);
        }
      }
      break;
    }
    case 'aoe': {
      const cx = targetWorld && (ab.castType === 'ground_aoe') ? targetWorld.x : nearest ? nearest.x : p.x + Math.cos(p.facing) * 100;
      const cy = targetWorld && (ab.castType === 'ground_aoe') ? targetWorld.y : nearest ? nearest.y : p.y + Math.sin(p.facing) * 100;

      if (ab.castType === 'cone') {
        addSpellEffect(state, p.x, p.y, 'cone_sweep', ab.radius, abilityColor, 0.6, p.facing);
      } else {
        addSpellEffect(state, cx, cy, 'aoe_blast', ab.radius, abilityColor, 0.6);
      }

      for (const e of state.enemies) {
        if (e.dead) continue;
        if (distXY({ x: cx, y: cy }, e) < ab.radius) {
          const dmg = ab.damage + p.atk * 0.6;
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: e.def, activeEffects: e.activeEffects }, dmg);
          e.hp -= result.finalDamage;
          addDungeonText(state, e.x, e.y - 15, `-${result.finalDamage}`, abilityColor, 12);
          addSpellEffect(state, e.x, e.y, 'impact_ring', 20, abilityColor, 0.3);
          const effects = getAbilityEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(e as any as CombatEntity, eff);
          if (e.hp <= 0) killDungeonEnemy(state, e);
        }
      }
      for (const he of state.heroEnemies) {
        if (he.dead) continue;
        if (distXY({ x: cx, y: cy }, he) < ab.radius) {
          const dmg = ab.damage + p.atk * 0.6;
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: he.def, activeEffects: he.activeEffects }, dmg);
          he.hp -= result.finalDamage;
          addDungeonText(state, he.x, he.y - 15, `-${result.finalDamage}`, abilityColor, 12);
          addSpellEffect(state, he.x, he.y, 'impact_ring', 20, abilityColor, 0.3);
          const effects = getAbilityEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(he as any as CombatEntity, eff);
          if (he.hp <= 0) killDungeonHeroEnemy(state, he);
        }
      }
      spawnDungeonParticles(state, cx, cy, abilityColor, 20);
      break;
    }
    case 'buff': {
      const effects = getAbilityEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      addSpellEffect(state, p.x, p.y, 'cast_circle', 35, '#ffd700', 0.8);
      spawnDungeonParticles(state, p.x, p.y, '#ffd700', 15);
      break;
    }
    case 'debuff': {
      addSpellEffect(state, p.x, p.y, 'aoe_blast', ab.radius, '#06b6d4', 0.5);
      for (const e of state.enemies) {
        if (e.dead || distXY(p, e) > ab.radius) continue;
        const effects = getAbilityEffects(ab.name, p.id, p.atk);
        for (const eff of effects) applyStatusEffect(e as any as CombatEntity, eff);
        if (ab.damage > 0) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: e.def, activeEffects: e.activeEffects }, ab.damage);
          e.hp -= result.finalDamage;
          if (e.hp <= 0) killDungeonEnemy(state, e);
        }
      }
      for (const he of state.heroEnemies) {
        if (he.dead || distXY(p, he) > ab.radius) continue;
        const effects = getAbilityEffects(ab.name, p.id, p.atk);
        for (const eff of effects) applyStatusEffect(he as any as CombatEntity, eff);
        if (ab.damage > 0) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: he.def, activeEffects: he.activeEffects }, ab.damage);
          he.hp -= result.finalDamage;
          if (he.hp <= 0) killDungeonHeroEnemy(state, he);
        }
      }
      spawnDungeonParticles(state, p.x, p.y, '#06b6d4', 12);
      break;
    }
    case 'heal': {
      p.shieldHp = 100 + p.def * 2;
      const effects = getAbilityEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      addSpellEffect(state, p.x, p.y, 'cast_circle', 30, '#22c55e', 0.6);
      spawnDungeonParticles(state, p.x, p.y, '#22c55e', 10);
      break;
    }
    case 'dash': {
      const startX = p.x, startY = p.y;
      if (nearest) {
        const angle = angleBetween(p, nearest);
        const dashDist = Math.min(ab.range, distXY(p, nearest));
        const nx = p.x + Math.cos(angle) * dashDist;
        const ny = p.y + Math.sin(angle) * dashDist;
        if (isWalkable(state, nx, ny)) { p.x = nx; p.y = ny; }
        if (ab.damage > 0) {
          if (realHeroTarget) {
            const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: realHeroTarget.def, activeEffects: realHeroTarget.activeEffects }, ab.damage + p.atk * 0.5);
            realHeroTarget.hp -= result.finalDamage;
            addSpellEffect(state, realHeroTarget.x, realHeroTarget.y, 'impact_ring', 25, abilityColor, 0.4);
            if (realHeroTarget.hp <= 0) killDungeonHeroEnemy(state, realHeroTarget);
          } else {
            const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, ab.damage + p.atk * 0.5);
            nearest.hp -= result.finalDamage;
            addSpellEffect(state, nearest.x, nearest.y, 'impact_ring', 25, abilityColor, 0.4);
            if (nearest.hp <= 0) killDungeonEnemy(state, nearest);
          }
        }
      } else {
        const nx = p.x + Math.cos(p.facing) * ab.range;
        const ny = p.y + Math.sin(p.facing) * ab.range;
        if (isWalkable(state, nx, ny)) { p.x = nx; p.y = ny; }
      }
      addSpellEffect(state, startX, startY, 'dash_trail', 15, abilityColor, 0.4, Math.atan2(p.y - startY, p.x - startX), { endX: p.x, endY: p.y });
      const effects = getAbilityEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      spawnDungeonParticles(state, p.x, p.y, abilityColor, 8);
      break;
    }
  }
  addDungeonText(state, p.x, p.y - 30, ab.name, abilityColor, 16);
}

function getAbilityEffects(name: string, sourceId: number, atk: number): StatusEffect[] {
  return getAbilityStatusEffects(name, sourceId, atk);
}

export function updateDungeonMouseWorld(state: DungeonState, screenX: number, screenY: number, canvasW: number, canvasH: number) {
  const cam = state.camera;
  state.mouseWorld.x = (screenX - canvasW / 2) / cam.zoom + cam.x;
  state.mouseWorld.y = (screenY - canvasH / 2) / cam.zoom + cam.y;
}

export function startDungeonTargeting(state: DungeonState, abilityIndex: number) {
  const p = state.player;
  if (p.dead) return;
  const hd = HEROES[p.heroDataId];
  const abilities = getHeroAbilities(hd.race, hd.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;
  const ab = abilities[abilityIndex];
  if (p.abilityCooldowns[abilityIndex] > 0 || p.mp < ab.manaCost) return;

  if (ab.castType === 'self_cast' || ab.castType === 'targeted') {
    handleDungeonAbility(state, abilityIndex);
    return;
  }

  state.targeting = {
    active: true,
    abilityIndex,
    castType: ab.castType,
    range: ab.range > 0 ? ab.range : 200,
    radius: ab.radius > 0 ? ab.radius : 80,
    color: CLASS_COLORS[hd.heroClass] || '#fff',
  };
}

export function confirmDungeonTargeting(state: DungeonState) {
  if (!state.targeting.active) return;
  handleDungeonAbility(state, state.targeting.abilityIndex, state.mouseWorld);
  cancelDungeonTargeting(state);
}

export function cancelDungeonTargeting(state: DungeonState) {
  state.targeting.active = false;
  state.targeting.abilityIndex = -1;
}

function addSpellEffect(state: DungeonState, x: number, y: number, type: DungeonSpellEffect['type'], radius: number, color: string, duration: number, angle: number = 0, data?: any) {
  state.spellEffects.push({ x, y, type, life: duration, maxLife: duration, radius, color, angle, data });
}

export function handleDungeonAttack(state: DungeonState) {
  const p = state.player;
  if (p.dead || isStunned(p as any)) return;

  const nearest = findNearestDungeonEnemy(state, p, p.rng + 50);
  if (nearest) {
    state.projectiles.push({
      id: state.nextId++,
      x: p.x, y: p.y,
      targetId: nearest.id,
      damage: p.atk,
      speed: 500,
      color: CLASS_COLORS[HEROES[p.heroDataId].heroClass] || '#fff',
      size: 4,
      sourceIsPlayer: true,
    });
    p.animState = 'attack';
    p.facing = angleBetween(p, nearest);
    globalAnimDirector.registerAttack(p.id, state.gameTime || 0);
  }
}

function findNearestDungeonEnemy(state: DungeonState, from: { x: number; y: number }, range: number): DungeonEnemy | null {
  let nearest: DungeonEnemy | null = null;
  let nearestDist = range;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = distXY(from, e);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
  }
  for (const he of state.heroEnemies) {
    if (he.dead) continue;
    const d = distXY(from, he);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = {
        id: he.id, x: he.x, y: he.y,
        type: HEROES[he.heroDataId].name,
        hp: he.hp, maxHp: he.maxHp,
        atk: he.atk, def: he.def,
        spd: he.spd, rng: he.rng,
        facing: he.facing, dead: he.dead,
        animState: he.animState, animTimer: he.animTimer,
        attackTimer: he.attackTimer, targetId: null,
        color: RACE_COLORS[HEROES[he.heroDataId].race] || '#fff',
        xpValue: he.xpValue, goldValue: he.goldValue,
        isBoss: false, size: 14,
        activeEffects: he.activeEffects,
        ccImmunityTimers: he.ccImmunityTimers,
      };
    }
  }
  return nearest;
}

export function getDungeonHudState(state: DungeonState): DungeonHudState {
  const p = state.player;
  const hd = HEROES[p.heroDataId];
  return {
    hp: p.hp, maxHp: p.maxHp,
    mp: p.mp, maxMp: p.maxMp,
    level: p.level, xp: p.xp, xpToNext: xpForDungeonLevel(p.level),
    gold: p.gold, floor: state.floor,
    kills: p.kills,
    items: p.items,
    abilityCooldowns: p.abilityCooldowns,
    heroName: hd.name, heroClass: hd.heroClass, heroRace: hd.race,
    gameOver: state.gameOver, gameWon: state.gameWon,
    activeEffects: [...p.activeEffects],
    atk: p.atk, def: p.def, spd: p.spd,
    killFeed: state.killFeed,
    gameTime: state.gameTime,
    showInventory: state.showInventory,
    animState: p.animState || 'idle',
    animTimer: p.animTimer || 0,
    facing: String(p.facing ?? 0),
    px: p.x,
    py: p.y,
  };
}

export class DungeonRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private voxel: VoxelRenderer;
  private spriteEffects: SpriteEffectSystem;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.voxel = new VoxelRenderer();
    this.spriteEffects = new SpriteEffectSystem();
  }

  updateSpriteEffects(dt: number) {
    this.spriteEffects.update(dt);
  }

  getSpriteEffects() {
    return this.spriteEffects;
  }

  render(state: DungeonState) {
    computeVisibility(state);
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const cam = state.camera;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.renderTiles(ctx, state, cam, W, H);
    this.renderChests(ctx, state);

    this.renderTargetingIndicator(ctx, state);

    const sorted = [...state.enemies.filter(e => !e.dead && isInPlayerVision(state, e.x, e.y))].sort((a, b) => a.y - b.y);
    for (const enemy of sorted) this.renderEnemy(ctx, enemy, state);

    for (const he of state.heroEnemies) {
      if (!he.dead && isInPlayerVision(state, he.x, he.y)) {
        this.renderHeroEnemy(ctx, he, state);
      }
    }

    this.renderPlayer(ctx, state);

    for (const se of state.spellEffects) {
      this.renderSpellEffect(ctx, se, state);
    }

    for (const proj of state.projectiles) {
      if (isInPlayerVision(state, proj.x, proj.y)) this.renderProjectile(ctx, proj);
    }
    for (const pt of state.particles) {
      if (isInPlayerVision(state, pt.x, pt.y)) this.renderParticle(ctx, pt);
    }
    for (const ft of state.floatingTexts) {
      if (isInPlayerVision(state, ft.x, ft.y)) this.renderFloatingText(ctx, ft);
    }

    // Render sprite-sheet VFX
    this.spriteEffects.render(ctx);

    ctx.restore();

    this.renderMinimap(ctx, state, W, H);
  }

  private renderTiles(ctx: CanvasRenderingContext2D, state: DungeonState, cam: { x: number; y: number; zoom: number }, W: number, H: number) {
    const startTX = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / TILE_SIZE) - 1);
    const startTY = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / TILE_SIZE) - 1);
    const endTX = Math.min(state.mapWidth, Math.ceil((cam.x + W / 2 / cam.zoom) / TILE_SIZE) + 1);
    const endTY = Math.min(state.mapHeight, Math.ceil((cam.y + H / 2 / cam.zoom) / TILE_SIZE) + 1);

    const px = state.player.x;
    const py = state.player.y;
    const vrSq = VISION_RADIUS * VISION_RADIUS;

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const tile = state.tiles[ty][tx];
        if (!tile.revealed) continue;

        const x = tx * TILE_SIZE, y = ty * TILE_SIZE;
        const tileCX = x + TILE_SIZE / 2;
        const tileCY = y + TILE_SIZE / 2;
        const dx = tileCX - px, dy = tileCY - py;
        const distSq = dx * dx + dy * dy;
        const inVision = state.visibleTiles.has(tileKey(tx, ty, state.mapWidth));
        ctx.globalAlpha = inVision ? Math.max(0.4, 1 - distSq / vrSq * 0.6) : 0.15;

        let voxType: DungeonTileVoxelType = 'floor';
        if (tile.type === 'wall') voxType = 'wall';
        else if (tile.type === 'trap') voxType = 'trap';
        else if (tile.type === 'stairs') voxType = 'stairs';
        else if (tile.type === 'door') voxType = 'door';
        else if (tile.type === 'chest') voxType = 'chest';
        else voxType = 'floor';

        this.voxel.drawDungeonTile(ctx, x, y, TILE_SIZE, voxType, tx, ty);

        if (tile.type === 'floor' && tile.decoration > 0) {
          const seed = (tx * 17 + ty * 31) % 100;
          if (seed > 70) {
            ctx.fillStyle = 'rgba(80,80,60,0.15)';
            const cx = x + TILE_SIZE * 0.3 + (seed % 5) * 2;
            const cy = y + TILE_SIZE * 0.3 + (seed % 7) * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, 1.5 + (seed % 3), 0, Math.PI * 2);
            ctx.fill();
          }
          if (seed > 85) {
            ctx.strokeStyle = 'rgba(60,50,30,0.15)';
            ctx.lineWidth = 0.5;
            const crackLen = 4 + (seed % 8);
            const crackAngle = (seed * 0.17) % (Math.PI * 2);
            const crackX = x + TILE_SIZE * 0.5 + (seed % 10) - 5;
            const crackY = y + TILE_SIZE * 0.5 + (seed % 7) - 3;
            ctx.beginPath();
            ctx.moveTo(crackX, crackY);
            ctx.lineTo(crackX + Math.cos(crackAngle) * crackLen, crackY + Math.sin(crackAngle) * crackLen);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    this.renderTorchGlow(ctx, state);
  }

  private renderTorchGlow(ctx: CanvasRenderingContext2D, state: DungeonState) {
    const torchPositions: { x: number; y: number }[] = [];
    const px = state.player.x;
    const py = state.player.y;

    const torchRange = Math.ceil(VISION_RADIUS * 1.1 / TILE_SIZE);
    const ptx = Math.floor(px / TILE_SIZE);
    const pty = Math.floor(py / TILE_SIZE);
    const tStartX = Math.max(0, ptx - torchRange);
    const tStartY = Math.max(0, pty - torchRange);
    const tEndX = Math.min(state.mapWidth, ptx + torchRange + 1);
    const tEndY = Math.min(state.mapHeight, pty + torchRange + 1);

    for (let ty = tStartY; ty < tEndY; ty++) {
      for (let tx = tStartX; tx < tEndX; tx++) {
        const tile = state.tiles[ty][tx];
        if (!state.visibleTiles.has(tileKey(tx, ty, state.mapWidth))) continue;
        if (tile.type !== 'wall') continue;
        const hasFloorNeighbor = (
          (tx > 0 && state.tiles[ty][tx - 1].type === 'floor') ||
          (tx < state.mapWidth - 1 && state.tiles[ty][tx + 1].type === 'floor') ||
          (ty > 0 && state.tiles[ty - 1][tx].type === 'floor') ||
          (ty < state.mapHeight - 1 && state.tiles[ty + 1][tx].type === 'floor')
        );
        if (!hasFloorNeighbor) continue;
        const seed = (tx * 31 + ty * 17) % 100;
        if (seed > 75) {
          const wx = tx * TILE_SIZE + TILE_SIZE / 2;
          const wy = ty * TILE_SIZE + TILE_SIZE / 2;
          torchPositions.push({ x: wx, y: wy });
        }
      }
    }

    const flicker = Date.now() * 0.003;
    for (const torch of torchPositions) {
      const r = 50 + Math.sin(flicker + torch.x * 0.1) * 10;
      const grad = ctx.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, r);
      grad.addColorStop(0, 'rgba(255,160,50,0.12)');
      grad.addColorStop(0.5, 'rgba(255,120,30,0.06)');
      grad.addColorStop(1, 'rgba(255,80,10,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(torch.x, torch.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderChests(ctx: CanvasRenderingContext2D, state: DungeonState) {
    for (const chest of state.chests) {
      if (chest.opened) continue;
      if (!isInPlayerVision(state, chest.x, chest.y)) continue;
      ctx.save();
      ctx.translate(chest.x, chest.y);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(-10, -8, 20, 16);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-10, -8, 20, 16);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(-3, -2, 6, 4);
      ctx.restore();
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: DungeonEnemy, state: DungeonState) {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distSq = dx * dx + dy * dy;
    const dimFactor = Math.max(0.3, 1 - distSq / (VISION_RADIUS * VISION_RADIUS) * 0.5);

    ctx.save();
    ctx.globalAlpha = dimFactor;

    this.voxel.drawEnemyVoxel(ctx, enemy.x, enemy.y, enemy.type, enemy.facing, enemy.animState, enemy.animTimer, enemy.size, enemy.isBoss);

    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    this.renderHealthBar(ctx, 0, -enemy.size - 8, enemy.size, enemy.hp, enemy.maxHp, enemy.color);

    if (enemy.activeEffects.length > 0) {
      let ox = -enemy.activeEffects.length * 5;
      for (const eff of enemy.activeEffects) {
        ctx.fillStyle = eff.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ox, -enemy.size - 14, 8, 4);
        ctx.globalAlpha = 1;
        ox += 10;
      }
    }

    if (enemy.isBoss) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.type, 0, -enemy.size - 16);
    }

    ctx.restore();
    ctx.restore();
  }

  private renderHeroEnemy(ctx: CanvasRenderingContext2D, he: DungeonHeroEnemy, state: DungeonState) {
    const heroData = HEROES[he.heroDataId];
    const raceColor = RACE_COLORS[heroData.race] || '#888';
    const classColor = CLASS_COLORS[heroData.heroClass] || '#888';
    const dx = he.x - state.player.x;
    const dy = he.y - state.player.y;
    const distSq = dx * dx + dy * dy;
    const dimFactor = Math.max(0.3, 1 - distSq / (VISION_RADIUS * VISION_RADIUS) * 0.5);

    ctx.save();
    ctx.globalAlpha = dimFactor;

    ctx.save();
    ctx.translate(he.x, he.y);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.003) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = dimFactor;

    const buffNames = he.activeEffects.map(e => e.name || '');
    this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, heroData.heroClass, he.facing, he.animState, he.animTimer, heroData.race, heroData.name, undefined, undefined, he.id, he.shieldHp > 0 ? he.shieldHp : undefined, buffNames.length > 0 ? buffNames : undefined, state.gameTime);

    ctx.globalAlpha = 1;
    this.renderHealthBar(ctx, 0, -24, 20, he.hp, he.maxHp, '#ef4444');

    const mpPct = he.mp / he.maxMp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-20, -18, 40, 3);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-20, -18, 40 * mpPct, 3);

    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${heroData.name}`, 0, -30);
    ctx.fillStyle = '#ccc';
    ctx.font = '8px sans-serif';
    ctx.fillText(`Lv${he.level} ${heroData.heroClass}`, 0, -38);

    if (he.activeEffects.length > 0) {
      let ox = -he.activeEffects.length * 5;
      for (const eff of he.activeEffects) {
        ctx.fillStyle = eff.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ox, -44, 8, 4);
        ctx.globalAlpha = 1;
        ox += 10;
      }
    }

    ctx.restore();
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, state: DungeonState) {
    const p = state.player;
    const hd = HEROES[p.heroDataId];
    const raceColor = RACE_COLORS[hd.race] || '#888';
    const classColor = CLASS_COLORS[hd.heroClass] || '#888';

    ctx.save();
    ctx.translate(p.x, p.y);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.004) * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const buffNames = p.activeEffects.map(e => e.name || '');
    this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, hd.heroClass, p.facing, p.animState, p.animTimer, hd.race, hd.name, undefined, undefined, p.id, p.shieldHp > 0 ? p.shieldHp : undefined, buffNames.length > 0 ? buffNames : undefined, state.gameTime);

    this.renderHealthBar(ctx, 0, -24, 20, p.hp, p.maxHp, '#22c55e');
    const mpPct = p.mp / p.maxMp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-20, -18, 40, 3);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-20, -18, 40 * mpPct, 3);

    if (p.activeEffects.length > 0) {
      let ox = -p.activeEffects.length * 5;
      for (const eff of p.activeEffects) {
        ctx.fillStyle = eff.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ox, -30, 8, 4);
        ctx.globalAlpha = 1;
        ox += 10;
      }
    }

    ctx.restore();
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: DungeonProjectile) {
    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private renderParticle(ctx: CanvasRenderingContext2D, p: DungeonParticle) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderFloatingText(ctx: CanvasRenderingContext2D, ft: DungeonFloatingText) {
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = Math.min(1, ft.life * 2);
    ctx.font = `bold ${ft.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hp: number, maxHp: number, color: string) {
    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - hw, y, hw * 2, 4);
    ctx.fillStyle = pct > 0.5 ? color : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x - hw, y, hw * 2 * pct, 4);
  }

  private renderTargetingIndicator(ctx: CanvasRenderingContext2D, state: DungeonState) {
    const t = state.targeting;
    if (!t.active) return;

    const p = state.player;
    const mx = state.mouseWorld.x;
    const my = state.mouseWorld.y;
    const pulse = 0.4 + Math.sin(Date.now() * 0.005) * 0.15;

    ctx.save();

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, t.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const dx = mx - p.x;
    const dy = my - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inRange = dist <= t.range * 1.1;
    const baseColor = inRange ? t.color : '#ff3333';

    if (t.castType === 'ground_aoe') {
      const tx = dist > t.range ? p.x + (dx / dist) * t.range : mx;
      const ty = dist > t.range ? p.y + (dy / dist) * t.range : my;

      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(tx, ty, t.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, t.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = pulse * 0.5;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx - 6, ty);
      ctx.lineTo(tx + 6, ty);
      ctx.moveTo(tx, ty - 6);
      ctx.lineTo(tx, ty + 6);
      ctx.stroke();
    } else if (t.castType === 'skillshot' || t.castType === 'line') {
      const angle = Math.atan2(dy, dx);
      const endX = p.x + Math.cos(angle) * t.range;
      const endY = p.y + Math.sin(angle) * t.range;
      const halfWidth = t.radius > 0 ? t.radius * 0.3 : 12;
      const perpX = Math.cos(angle + Math.PI / 2) * halfWidth;
      const perpY = Math.sin(angle + Math.PI / 2) * halfWidth;

      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(p.x + perpX, p.y + perpY);
      ctx.lineTo(endX + perpX, endY + perpY);
      ctx.lineTo(endX - perpX, endY - perpY);
      ctx.lineTo(p.x - perpX, p.y - perpY);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + perpX, p.y + perpY);
      ctx.lineTo(endX + perpX, endY + perpY);
      ctx.lineTo(endX - perpX, endY - perpY);
      ctx.lineTo(p.x - perpX, p.y - perpY);
      ctx.closePath();
      ctx.stroke();

      ctx.globalAlpha = pulse * 0.4;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (t.castType === 'cone') {
      const angle = Math.atan2(dy, dx);
      const coneAngle = Math.PI / 3;
      const startAngle = angle - coneAngle / 2;
      const endAngle = angle + coneAngle / 2;

      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, t.radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, t.radius, startAngle, endAngle);
      ctx.closePath();
      ctx.stroke();

      const segCount = 3;
      ctx.globalAlpha = pulse * 0.15;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= segCount; i++) {
        const r = (t.radius / (segCount + 1)) * i;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, startAngle, endAngle);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderSpellEffect(ctx: CanvasRenderingContext2D, se: DungeonSpellEffect, state: DungeonState) {
    const t = se.life / se.maxLife;
    ctx.save();

    switch (se.type) {
      case 'cast_circle': {
        const expand = 1 + (1 - t) * 0.3;
        ctx.globalAlpha = t * 0.5;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = t * 0.15;
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand * 0.6, 0, Math.PI * 2);
        ctx.fill();

        const rotAngle = (1 - t) * Math.PI * 4;
        ctx.globalAlpha = t * 0.3;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = rotAngle + (Math.PI / 2) * i;
          const r = se.radius * expand;
          ctx.beginPath();
          ctx.arc(se.x, se.y, r, a - 0.2, a + 0.2);
          ctx.stroke();
        }
        break;
      }
      case 'impact_ring': {
        const expand = 1 + (1 - t) * 1.5;
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = t * 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'aoe_blast': {
        const expand = 0.3 + (1 - t) * 0.7;
        ctx.globalAlpha = t * 0.3;
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = t * 0.6;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * expand, 0, Math.PI * 2);
        ctx.stroke();

        if (t > 0.5) {
          ctx.globalAlpha = (t - 0.5) * 2 * 0.4;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(se.x, se.y, se.radius * expand * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'cone_sweep': {
        const sweepProgress = 1 - t;
        const coneAngle = Math.PI / 3;
        const currentAngle = se.angle - coneAngle / 2 + coneAngle * sweepProgress;

        ctx.globalAlpha = t * 0.3;
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.arc(se.x, se.y, se.radius, se.angle - coneAngle / 2, se.angle + coneAngle / 2);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.lineTo(se.x + Math.cos(currentAngle) * se.radius, se.y + Math.sin(currentAngle) * se.radius);
        ctx.stroke();
        break;
      }
      case 'dash_trail': {
        if (!se.data) break;
        const endX = se.data.endX || se.x;
        const endY = se.data.endY || se.y;

        ctx.globalAlpha = t * 0.5;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 4 * t;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.globalAlpha = t * 0.2;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 8 * t;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'skillshot_trail': {
        const angle = se.angle;
        const len = se.radius;
        const endX = se.x + Math.cos(angle) * len;
        const endY = se.y + Math.sin(angle) * len;

        ctx.globalAlpha = t * 0.6;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, state: DungeonState, W: number, H: number) {
    const mw = 160, mh = 120;
    const mx = W - mw - 10, my = 10;
    const scaleX = mw / (state.mapWidth * TILE_SIZE);
    const scaleY = mh / (state.mapHeight * TILE_SIZE);
    const scale = Math.min(scaleX, scaleY);

    ctx.fillStyle = 'rgba(10,10,20,0.85)';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 2;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    for (let ty = 0; ty < state.mapHeight; ty++) {
      for (let tx = 0; tx < state.mapWidth; tx++) {
        const tile = state.tiles[ty][tx];
        if (!tile.revealed) continue;
        if (tile.type === 'wall') continue;
        ctx.fillStyle = tile.type === 'stairs' ? '#ffd700' : tile.type === 'trap' ? '#f59e0b' : '#444';
        ctx.fillRect(mx + tx * TILE_SIZE * scale, my + ty * TILE_SIZE * scale, Math.max(1, TILE_SIZE * scale), Math.max(1, TILE_SIZE * scale));
      }
    }

    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      if (!isInPlayerVision(state, enemy.x, enemy.y)) continue;
      ctx.fillStyle = enemy.isBoss ? '#ffd700' : enemy.color;
      ctx.fillRect(mx + enemy.x * scale - 1, my + enemy.y * scale - 1, 3, 3);
    }

    for (const he of state.heroEnemies) {
      if (he.dead || !isInPlayerVision(state, he.x, he.y)) continue;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx + he.x * scale, my + he.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * scale, my + state.player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

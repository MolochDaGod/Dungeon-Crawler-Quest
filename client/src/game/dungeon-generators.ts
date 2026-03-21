/**
 * Dungeon Generators — Three formats + portal integration
 *
 * 1. Long Cave (Gauntlet): straight corridor, minion waves, boss at end
 * 2. Dungeon Maze: rooms + hallways, central boss hall, portal on boss death
 * 3. Boss Arena: single open room, tough boss with summon skill
 */

import type { DungeonTile, DungeonRoom, DungeonEnemy, ExitPortal } from './dungeon';

export type DungeonFormat = 'long_cave' | 'dungeon_maze' | 'boss_arena';

export interface DungeonConfig {
  format: DungeonFormat;
  floor: number;
  difficulty: number; // 1-10 multiplier
  loreDungeonId?: string; // If set, uses static lore layout
}

export interface GeneratedDungeon {
  tiles: DungeonTile[][];
  rooms: DungeonRoom[];
  enemies: Omit<DungeonEnemy, 'id' | 'animState' | 'animTimer' | 'attackTimer' | 'targetId' | 'activeEffects' | 'ccImmunityTimers'>[];
  spawnX: number;
  spawnY: number;
  bossRoomIndex: number;
  mapWidth: number;
  mapHeight: number;
  trapTiles: { x: number; y: number; type: 'fire' | 'saw' | 'plate' }[];
  portalSpawnPoint: { x: number; y: number } | null; // Where boss-death portal appears
}

function makeTile(type: DungeonTile['type'] = 'wall', revealed = false): DungeonTile {
  return { type, revealed, decoration: 0 };
}

function fillTiles(w: number, h: number): DungeonTile[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => makeTile('wall')));
}

function carveRect(tiles: DungeonTile[][], x: number, y: number, w: number, h: number, type: DungeonTile['type'] = 'floor') {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy, tx = x + dx;
      if (ty >= 0 && ty < tiles.length && tx >= 0 && tx < tiles[0].length) {
        tiles[ty][tx] = makeTile(type);
      }
    }
  }
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Enemy Templates ──

const ENEMY_TYPES = [
  { type: 'slime',    hp: 40, atk: 8,  def: 2, spd: 30, rng: 1.2, xp: 15, gold: 5,  color: '#22c55e', size: 0.7 },
  { type: 'skeleton', hp: 55, atk: 12, def: 5, spd: 40, rng: 1.5, xp: 25, gold: 10, color: '#d4d4d8', size: 0.9 },
  { type: 'orc',      hp: 80, atk: 16, def: 8, spd: 35, rng: 1.5, xp: 40, gold: 15, color: '#65a30d', size: 1.0 },
  { type: 'wraith',   hp: 60, atk: 18, def: 3, spd: 50, rng: 2.0, xp: 35, gold: 12, color: '#a78bfa', size: 0.8 },
  { type: 'golem',    hp: 120,atk: 20, def: 15,spd: 25, rng: 1.5, xp: 50, gold: 20, color: '#78716c', size: 1.3 },
];

const BOSS_TYPES = [
  { type: 'dragon_boss',  hp: 500, atk: 35, def: 20, spd: 30, rng: 2.5, xp: 200, gold: 100, color: '#ef4444', size: 2.0 },
  { type: 'lich_boss',    hp: 400, atk: 40, def: 12, spd: 35, rng: 4.0, xp: 200, gold: 100, color: '#8b5cf6', size: 1.8 },
  { type: 'golem_king',   hp: 600, atk: 30, def: 25, spd: 20, rng: 2.0, xp: 250, gold: 120, color: '#f59e0b', size: 2.2 },
  { type: 'shadow_lord',  hp: 450, atk: 38, def: 15, spd: 45, rng: 3.0, xp: 220, gold: 110, color: '#6366f1', size: 1.9 },
];

function scaleEnemy(base: typeof ENEMY_TYPES[0], floor: number, difficulty: number) {
  const mult = 1 + (floor - 1) * 0.15 + (difficulty - 1) * 0.1;
  const scaledHp = Math.floor(base.hp * mult);
  return {
    ...base,
    hp: scaledHp,
    maxHp: scaledHp,
    atk: Math.floor(base.atk * mult),
    def: Math.floor(base.def * mult),
    xpValue: Math.floor(base.xp * mult),
    goldValue: Math.floor(base.gold * mult),
    facing: 0, dead: false, isBoss: false,
    x: 0, y: 0,
  };
}

function scaleBoss(base: typeof BOSS_TYPES[0], floor: number, difficulty: number) {
  const mult = 1 + (floor - 1) * 0.2 + (difficulty - 1) * 0.15;
  return {
    ...base,
    hp: Math.floor(base.hp * mult),
    maxHp: Math.floor(base.hp * mult),
    atk: Math.floor(base.atk * mult),
    def: Math.floor(base.def * mult),
    xpValue: Math.floor(base.xp * mult),
    goldValue: Math.floor(base.gold * mult),
    facing: 0, dead: false, isBoss: true,
    x: 0, y: 0,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. LONG CAVE — Gauntlet Run
// ═══════════════════════════════════════════════════════════════

export function generateLongCave(config: DungeonConfig): GeneratedDungeon {
  const { floor, difficulty } = config;
  const w = 60, h = 15;
  const tiles = fillTiles(w, h);
  const rooms: DungeonRoom[] = [];
  const enemies: GeneratedDungeon['enemies'] = [];
  const traps: GeneratedDungeon['trapTiles'] = [];

  // Main corridor — y=4 to y=10 (6 tiles wide)
  carveRect(tiles, 1, 4, w - 2, 7);

  // Starting alcove
  carveRect(tiles, 1, 5, 4, 5);
  rooms.push({ x: 1, y: 5, w: 4, h: 5, type: 'start', connected: [1] });

  // Generate wave alcoves every 8-12 tiles
  let cx = 8;
  let roomIdx = 1;
  while (cx < w - 12) {
    const alcoveW = rand(4, 6);
    const alcoveH = rand(3, 5);
    const alcoveY = rand(1, 3);
    carveRect(tiles, cx, alcoveY, alcoveW, alcoveH);
    rooms.push({ x: cx, y: alcoveY, w: alcoveW, h: alcoveH, type: 'normal', connected: [roomIdx - 1, roomIdx + 1] });

    // Spawn 2-4 enemies in this alcove
    const count = rand(2, 3 + Math.floor(floor / 3));
    for (let i = 0; i < count; i++) {
      const tmpl = ENEMY_TYPES[rand(0, Math.min(ENEMY_TYPES.length - 1, Math.floor(floor / 2)))];
      const e = scaleEnemy(tmpl, floor, difficulty);
      e.x = (cx + rand(1, alcoveW - 2)) * 40 + 20;
      e.y = (alcoveY + rand(1, alcoveH - 2)) * 40 + 20;
      enemies.push(e);
    }

    // Random traps in corridor
    if (Math.random() < 0.4) {
      const trapTypes: ('fire' | 'saw' | 'plate')[] = ['fire', 'saw', 'plate'];
      traps.push({ x: cx + rand(0, 2), y: rand(5, 9), type: trapTypes[rand(0, 2)] });
    }

    cx += rand(8, 12);
    roomIdx++;
  }

  // Boss area at end
  const bossX = w - 10, bossY = 2;
  carveRect(tiles, bossX, bossY, 9, 11);
  const bossRoomIndex = rooms.length;
  rooms.push({ x: bossX, y: bossY, w: 9, h: 11, type: 'boss', connected: [roomIdx - 1] });

  const bossTemplate = BOSS_TYPES[rand(0, BOSS_TYPES.length - 1)];
  const boss = scaleBoss(bossTemplate, floor, difficulty);
  boss.x = (bossX + 4) * 40 + 20;
  boss.y = (bossY + 5) * 40 + 20;
  enemies.push(boss);

  return {
    tiles, rooms, enemies, mapWidth: w, mapHeight: h,
    spawnX: 3 * 40, spawnY: 7 * 40,
    bossRoomIndex,
    trapTiles: traps,
    portalSpawnPoint: { x: (bossX + 4) * 40 + 20, y: (bossY + 8) * 40 + 20 },
  };
}

// ═══════════════════════════════════════════════════════════════
// 2. DUNGEON MAZE — Rooms + Hallways + Central Boss Hall
// ═══════════════════════════════════════════════════════════════

export function generateDungeonMaze(config: DungeonConfig): GeneratedDungeon {
  const { floor, difficulty } = config;
  const w = 40, h = 40;
  const tiles = fillTiles(w, h);
  const rooms: DungeonRoom[] = [];
  const enemies: GeneratedDungeon['enemies'] = [];
  const traps: GeneratedDungeon['trapTiles'] = [];

  // Central boss hall (12×12 in the center)
  const cx = Math.floor(w / 2) - 6, cy = Math.floor(h / 2) - 6;
  carveRect(tiles, cx, cy, 12, 12);
  const bossRoomIndex = 0;
  rooms.push({ x: cx, y: cy, w: 12, h: 12, type: 'boss', connected: [] });

  // Generate 6-10 surrounding rooms
  const roomCount = rand(6, 10);
  for (let i = 0; i < roomCount; i++) {
    const rw = rand(5, 8), rh = rand(5, 8);
    let rx = rand(1, w - rw - 1), ry = rand(1, h - rh - 1);

    // Avoid overlapping boss room
    let tries = 0;
    while (tries < 20 && rx + rw > cx - 1 && rx < cx + 13 && ry + rh > cy - 1 && ry < cy + 13) {
      rx = rand(1, w - rw - 1);
      ry = rand(1, h - rh - 1);
      tries++;
    }
    if (tries >= 20) continue;

    carveRect(tiles, rx, ry, rw, rh);
    const roomType = i === 0 ? 'start' : (Math.random() < 0.2 ? 'treasure' : 'normal');
    rooms.push({ x: rx, y: ry, w: rw, h: rh, type: roomType as any, connected: [0] });

    // Connect to boss room via hallway
    const fromX = rx + Math.floor(rw / 2);
    const fromY = ry + Math.floor(rh / 2);
    const toX = cx + 6;
    const toY = cy + 6;
    // Horizontal then vertical
    const minHX = Math.min(fromX, toX), maxHX = Math.max(fromX, toX);
    for (let hx = minHX; hx <= maxHX; hx++) {
      if (tiles[fromY]?.[hx]) tiles[fromY][hx] = makeTile('floor');
      if (tiles[fromY + 1]?.[hx]) tiles[fromY + 1][hx] = makeTile('floor');
    }
    const minVY = Math.min(fromY, toY), maxVY = Math.max(fromY, toY);
    for (let vy = minVY; vy <= maxVY; vy++) {
      if (tiles[vy]?.[toX]) tiles[vy][toX] = makeTile('floor');
      if (tiles[vy]?.[toX + 1]) tiles[vy][toX + 1] = makeTile('floor');
    }

    // Spawn enemies in room
    if (roomType !== 'start') {
      const count = rand(2, 4);
      for (let e = 0; e < count; e++) {
        const tmpl = ENEMY_TYPES[rand(0, Math.min(ENEMY_TYPES.length - 1, Math.floor(floor / 2)))];
        const en = scaleEnemy(tmpl, floor, difficulty);
        en.x = (rx + rand(1, rw - 2)) * 40 + 20;
        en.y = (ry + rand(1, rh - 2)) * 40 + 20;
        enemies.push(en);
      }
    }

    // Hallway traps
    if (Math.random() < 0.3) {
      traps.push({ x: Math.floor((fromX + toX) / 2), y: Math.floor((fromY + toY) / 2), type: 'plate' });
    }
  }

  // Boss in center
  const bossTemplate = BOSS_TYPES[rand(0, BOSS_TYPES.length - 1)];
  const boss = scaleBoss(bossTemplate, floor, difficulty);
  boss.x = (cx + 6) * 40 + 20;
  boss.y = (cy + 6) * 40 + 20;
  enemies.push(boss);

  // Spawn point = first start room
  const startRoom = rooms.find(r => r.type === 'start') || rooms[1] || rooms[0];

  return {
    tiles, rooms, enemies, mapWidth: w, mapHeight: h,
    spawnX: (startRoom.x + Math.floor(startRoom.w / 2)) * 40,
    spawnY: (startRoom.y + Math.floor(startRoom.h / 2)) * 40,
    bossRoomIndex,
    trapTiles: traps,
    portalSpawnPoint: { x: (cx + 6) * 40 + 20, y: (cy + 9) * 40 + 20 },
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. BOSS ARENA — Single room, tough boss with summon
// ═══════════════════════════════════════════════════════════════

export function generateBossArena(config: DungeonConfig): GeneratedDungeon {
  const { floor, difficulty } = config;
  const w = 24, h = 24;
  const tiles = fillTiles(w, h);
  const enemies: GeneratedDungeon['enemies'] = [];

  // One big arena room
  carveRect(tiles, 2, 2, w - 4, h - 4);
  const rooms: DungeonRoom[] = [
    { x: 2, y: 2, w: w - 4, h: h - 4, type: 'boss', connected: [] },
  ];

  // Boss in center
  const bossTemplate = BOSS_TYPES[rand(0, BOSS_TYPES.length - 1)];
  const boss = scaleBoss(bossTemplate, floor, difficulty);
  boss.hp = Math.floor(boss.hp * 1.5); // 50% tougher
  boss.maxHp = boss.hp;
  boss.x = Math.floor(w / 2) * 40 + 20;
  boss.y = Math.floor(h / 2) * 40 + 20;
  enemies.push(boss);

  // Pre-spawn a few minions around boss
  const minionCount = rand(2, 4);
  for (let i = 0; i < minionCount; i++) {
    const tmpl = ENEMY_TYPES[rand(0, 2)];
    const m = scaleEnemy(tmpl, floor, difficulty);
    const angle = (i / minionCount) * Math.PI * 2;
    m.x = boss.x + Math.cos(angle) * 160;
    m.y = boss.y + Math.sin(angle) * 160;
    enemies.push(m);
  }

  return {
    tiles, rooms, enemies, mapWidth: w, mapHeight: h,
    spawnX: 4 * 40, spawnY: (h - 4) * 40,
    bossRoomIndex: 0,
    trapTiles: [],
    portalSpawnPoint: { x: Math.floor(w / 2) * 40 + 20, y: (h - 5) * 40 + 20 },
  };
}

// ═══════════════════════════════════════════════════════════════
// Main entry — pick generator by format
// ═══════════════════════════════════════════════════════════════

export function generateDungeon(config: DungeonConfig): GeneratedDungeon {
  switch (config.format) {
    case 'long_cave': return generateLongCave(config);
    case 'dungeon_maze': return generateDungeonMaze(config);
    case 'boss_arena': return generateBossArena(config);
    default: return generateDungeonMaze(config);
  }
}

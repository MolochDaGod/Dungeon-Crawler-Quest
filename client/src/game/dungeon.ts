import {
  DungeonFloor, DungeonRoom, DungeonTile, Enemy, ChestEntity, Position,
  TILE_SIZE, ENEMY_RADIUS, BOSS_RADIUS, EnemyType, getEnemyTemplate, generateLoot,
  ENEMY_COLORS, Item,
} from './types';

function createEmptyTiles(width: number, height: number): DungeonTile[][] {
  const tiles: DungeonTile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = { type: 'wall', explored: false, visible: false, variant: Math.floor(Math.random() * 4) };
    }
  }
  return tiles;
}

function carveRoom(tiles: DungeonTile[][], room: DungeonRoom) {
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
        tiles[y][x].type = 'floor';
        tiles[y][x].variant = Math.floor(Math.random() * 4);
      }
    }
  }
}

function carveCorridor(tiles: DungeonTile[][], x1: number, y1: number, x2: number, y2: number) {
  let x = x1;
  let y = y1;

  while (x !== x2) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      tiles[y][x].type = 'floor';
      if (y + 1 < tiles.length) tiles[y + 1][x].type = 'floor';
    }
    x += x < x2 ? 1 : -1;
  }
  while (y !== y2) {
    if (y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length) {
      tiles[y][x].type = 'floor';
      if (x + 1 < tiles[0].length) tiles[y][x + 1].type = 'floor';
    }
    y += y < y2 ? 1 : -1;
  }
}

function roomCenter(room: DungeonRoom): Position {
  return {
    x: room.x + Math.floor(room.width / 2),
    y: room.y + Math.floor(room.height / 2),
  };
}

function roomsOverlap(a: DungeonRoom, b: DungeonRoom, padding: number = 2): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

let enemyIdCounter = 0;

function createEnemy(type: EnemyType, position: Position, floor: number, isBoss: boolean = false): Enemy {
  const template = getEnemyTemplate(type, floor, isBoss);
  return {
    id: `enemy_${enemyIdCounter++}`,
    name: template.name || 'Unknown',
    type,
    level: floor * 2 + Math.floor(Math.random() * 3),
    health: template.maxHealth || 50,
    maxHealth: template.maxHealth || 50,
    damage: template.damage || 10,
    defense: template.defense || 2,
    speed: template.speed || 1.5,
    detectionRange: template.detectionRange || 180,
    attackRange: template.attackRange || 45,
    attackCooldown: template.attackCooldown || 1200,
    lastAttackTime: 0,
    state: 'idle',
    position: { ...position },
    velocity: { x: 0, y: 0 },
    radius: isBoss ? BOSS_RADIUS : ENEMY_RADIUS,
    color: ENEMY_COLORS[type],
    patrolTarget: null,
    isBoss,
    experienceReward: template.experienceReward || 20,
    goldReward: template.goldReward || 5,
    facingAngle: Math.random() * Math.PI * 2,
    hitFlash: 0,
    deathTimer: 0,
  };
}

export function generateDungeon(floor: number): DungeonFloor {
  const width = 60 + floor * 5;
  const height = 50 + floor * 5;
  const maxWidth = Math.min(width, 120);
  const maxHeight = Math.min(height, 100);
  const tiles = createEmptyTiles(maxWidth, maxHeight);
  const rooms: DungeonRoom[] = [];
  const enemies: Enemy[] = [];
  const chests: ChestEntity[] = [];

  const numRooms = 8 + floor * 2;
  const maxRoomAttempts = numRooms * 10;

  for (let attempt = 0; attempt < maxRoomAttempts && rooms.length < numRooms; attempt++) {
    const w = 5 + Math.floor(Math.random() * 8);
    const h = 5 + Math.floor(Math.random() * 7);
    const x = 2 + Math.floor(Math.random() * (maxWidth - w - 4));
    const y = 2 + Math.floor(Math.random() * (maxHeight - h - 4));

    const newRoom: DungeonRoom = { x, y, width: w, height: h, type: 'normal', connected: false };

    let overlaps = false;
    for (const existing of rooms) {
      if (roomsOverlap(newRoom, existing)) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push(newRoom);
      carveRoom(tiles, newRoom);
    }
  }

  if (rooms.length < 2) {
    rooms.push({ x: 5, y: 5, width: 8, height: 8, type: 'start', connected: false });
    carveRoom(tiles, rooms[0]);
    rooms.push({ x: maxWidth - 15, y: maxHeight - 15, width: 8, height: 8, type: 'exit', connected: false });
    carveRoom(tiles, rooms[1]);
  }

  rooms[0].type = 'start';
  rooms[rooms.length - 1].type = 'exit';

  if (rooms.length > 3) {
    const bossRoomIdx = rooms.length - 2;
    rooms[bossRoomIdx].type = 'boss';
  }

  const treasureCount = Math.min(2, Math.floor(rooms.length / 4));
  for (let i = 0; i < treasureCount; i++) {
    const idx = 1 + Math.floor(Math.random() * (rooms.length - 2));
    if (rooms[idx].type === 'normal') {
      rooms[idx].type = 'treasure';
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    const prev = roomCenter(rooms[i - 1]);
    const curr = roomCenter(rooms[i]);
    carveCorridor(tiles, prev.x, prev.y, curr.x, curr.y);
    rooms[i].connected = true;
    rooms[i - 1].connected = true;
  }

  const exitRoom = rooms[rooms.length - 1];
  const exitCenter = roomCenter(exitRoom);
  tiles[exitCenter.y][exitCenter.x].type = 'stairs_down';

  const enemyTypes: EnemyType[] = ['skeleton', 'zombie', 'demon', 'spider', 'wraith'];
  if (floor >= 3) enemyTypes.push('golem');
  if (floor >= 5) enemyTypes.push('dragon', 'necromancer');

  for (const room of rooms) {
    if (room.type === 'start') continue;

    if (room.type === 'boss') {
      const center = roomCenter(room);
      const bossType = floor >= 5 ? 'dragon' : (floor >= 3 ? 'golem' : 'demon');
      enemies.push(createEnemy(bossType, {
        x: center.x * TILE_SIZE + TILE_SIZE / 2,
        y: center.y * TILE_SIZE + TILE_SIZE / 2,
      }, floor, true));

      for (let i = 0; i < 2; i++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
        const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        enemies.push(createEnemy(type, {
          x: ex * TILE_SIZE + TILE_SIZE / 2,
          y: ey * TILE_SIZE + TILE_SIZE / 2,
        }, floor));
      }
      continue;
    }

    if (room.type === 'treasure') {
      const center = roomCenter(room);
      const loot: Item[] = [];
      for (let i = 0; i < 3; i++) {
        const item = generateLoot(floor, floor * 2 + 2, true);
        if (item) loot.push(item);
      }
      chests.push({
        id: `chest_${chests.length}`,
        position: { x: center.x * TILE_SIZE + TILE_SIZE / 2, y: center.y * TILE_SIZE + TILE_SIZE / 2 },
        opened: false,
        loot,
      });

      for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
        const ex = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
        const ey = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
        const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        enemies.push(createEnemy(type, {
          x: ex * TILE_SIZE + TILE_SIZE / 2,
          y: ey * TILE_SIZE + TILE_SIZE / 2,
        }, floor));
      }
      continue;
    }

    const enemyCount = 1 + Math.floor(Math.random() * (2 + floor * 0.5));
    for (let i = 0; i < enemyCount; i++) {
      const ex = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
      const ey = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      enemies.push(createEnemy(type, {
        x: ex * TILE_SIZE + TILE_SIZE / 2,
        y: ey * TILE_SIZE + TILE_SIZE / 2,
      }, floor));
    }
  }

  return {
    width: maxWidth,
    height: maxHeight,
    tiles,
    rooms,
    enemies,
    items: [],
    floor,
    chests,
  };
}

export function getPlayerStartPosition(dungeon: DungeonFloor): Position {
  const startRoom = dungeon.rooms.find(r => r.type === 'start') || dungeon.rooms[0];
  const center = roomCenter(startRoom);
  return {
    x: center.x * TILE_SIZE + TILE_SIZE / 2,
    y: center.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function isWalkable(dungeon: DungeonFloor, worldX: number, worldY: number): boolean {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  if (tileX < 0 || tileX >= dungeon.width || tileY < 0 || tileY >= dungeon.height) return false;
  return dungeon.tiles[tileY][tileX].type !== 'wall';
}

export function updateVisibility(dungeon: DungeonFloor, playerPos: Position, viewRange: number = 8) {
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      dungeon.tiles[y][x].visible = false;
    }
  }

  const playerTileX = Math.floor(playerPos.x / TILE_SIZE);
  const playerTileY = Math.floor(playerPos.y / TILE_SIZE);

  for (let dy = -viewRange; dy <= viewRange; dy++) {
    for (let dx = -viewRange; dx <= viewRange; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > viewRange) continue;

      const tx = playerTileX + dx;
      const ty = playerTileY + dy;
      if (tx < 0 || tx >= dungeon.width || ty < 0 || ty >= dungeon.height) continue;

      let blocked = false;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 1; s < steps; s++) {
        const sx = playerTileX + Math.round(dx * s / steps);
        const sy = playerTileY + Math.round(dy * s / steps);
        if (sx >= 0 && sx < dungeon.width && sy >= 0 && sy < dungeon.height) {
          if (dungeon.tiles[sy][sx].type === 'wall') {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        dungeon.tiles[ty][tx].visible = true;
        dungeon.tiles[ty][tx].explored = true;
      }
    }
  }
}

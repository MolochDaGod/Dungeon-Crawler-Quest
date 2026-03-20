/**
 * Ruin Camps — Destructible enemy spawner camps scattered across zones.
 * Each camp is a cluster of 3-7 ruin pieces with a central spawner core.
 * Destroying the core stops enemy spawning and marks the camp as cleared.
 *
 * 8 color themes mapped to biomes. 5 sizes per theme.
 * 70% of camps are active spawners, 30% are decorative.
 */

// ── Types ──────────────────────────────────────────────────────

export interface RuinPiece {
  color: string;
  size: 1 | 2 | 3 | 4 | 5; // 1=largest, 5=rubble
  offsetX: number;
  offsetY: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  isSpawnerCore: boolean;
  collisionW: number;
  collisionH: number;
}

export interface SpawnerDef {
  enemyTypes: string[];
  maxAlive: number;
  spawnInterval: number; // seconds
  spawnRadius: number;
  tier: number;
}

export interface RuinCamp {
  id: string;
  worldX: number;
  worldY: number;
  nodeId: number;
  pieces: RuinPiece[];
  spawner: SpawnerDef | null; // null = decorative
  hp: number;
  maxHp: number;
  destroyed: boolean;
  missionId: string | null;
  spawnTimer: number;
  aliveEnemyIds: number[];
}

// ── Biome Color Mapping ────────────────────────────────────────

export const RUIN_BIOME_COLORS: Record<number, string> = {
  1: 'Snow',        // Zone 1 — Frozen Highlands
  2: 'Blue-gray',   // Zone 2 — Undead Crypts
  3: 'Yellow',      // Zone 3 — Graveyard of Titans
  4: 'Brown',       // Zone 4 — Dragon's Reach
  5: 'Brown-gray',  // Zone 5 — Starting Lands
  6: 'Sand',        // Zone 6 — Crusade Islands
  7: 'Brown',       // Zone 7 — Volcano Rim
  8: 'White',       // Zone 8 — Boss Arena
  9: 'Water',       // Zone 9 — Pirate Cove
};

// ── Size → HP Mapping ──────────────────────────────────────────

const SIZE_HP: Record<number, number> = { 1: 500, 2: 300, 3: 200, 4: 100, 5: 50 };
const SIZE_PX: Record<number, number> = { 1: 128, 2: 80, 3: 64, 4: 48, 5: 32 };

// ── Zone → Enemy Types ─────────────────────────────────────────

const ZONE_ENEMIES: Record<number, string[]> = {
  1: ['Skeleton', 'Dark Mage'],
  2: ['Skeleton', 'Spider'],
  3: ['Orc Grunt', 'Golem'],
  4: ['Orc Grunt', 'Dark Mage'],
  5: ['Slime', 'Spider', 'Skeleton'],
  6: ['Skeleton', 'Orc Grunt'],
  7: ['Dark Mage', 'Golem'],
  8: ['Golem', 'Dark Mage'],
  9: ['Spider', 'Orc Grunt'],
};

// ── Camp Generation ────────────────────────────────────────────

let nextCampId = 1;

/**
 * Generate a ruin camp at the given position.
 * @param isSpawner - true = active enemy spawner, false = decorative only
 */
export function generateCamp(
  worldX: number, worldY: number,
  nodeId: number, isSpawner: boolean,
  tier: number,
): RuinCamp {
  const color = RUIN_BIOME_COLORS[nodeId] || 'Brown-gray';
  const pieceCount = 3 + Math.floor(Math.random() * 5); // 3-7 pieces
  const pieces: RuinPiece[] = [];

  // Center piece — always the largest, this is the spawner core
  pieces.push({
    color, size: 1,
    offsetX: 0, offsetY: 0,
    hp: SIZE_HP[1], maxHp: SIZE_HP[1],
    destroyed: false,
    isSpawnerCore: isSpawner,
    collisionW: SIZE_PX[1], collisionH: SIZE_PX[1] * 0.6,
  });

  // Surrounding pieces
  for (let i = 1; i < pieceCount; i++) {
    const size = (i < 3 ? (2 + Math.floor(Math.random() * 2)) : (4 + Math.floor(Math.random() * 2))) as 1|2|3|4|5;
    const angle = (i / pieceCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 60 + Math.random() * 100;
    pieces.push({
      color, size,
      offsetX: Math.cos(angle) * dist,
      offsetY: Math.sin(angle) * dist,
      hp: SIZE_HP[size], maxHp: SIZE_HP[size],
      destroyed: false,
      isSpawnerCore: false,
      collisionW: SIZE_PX[size], collisionH: SIZE_PX[size] * 0.6,
    });
  }

  const totalHp = pieces.reduce((s, p) => s + p.maxHp, 0);
  const enemies = ZONE_ENEMIES[nodeId] || ['Slime', 'Spider'];

  return {
    id: `CAMP-${nextCampId++}`,
    worldX, worldY, nodeId,
    pieces,
    spawner: isSpawner ? {
      enemyTypes: enemies,
      maxAlive: 3 + Math.floor(tier * 0.5),
      spawnInterval: 8 - tier * 0.5,
      spawnRadius: 200,
      tier,
    } : null,
    hp: totalHp, maxHp: totalHp,
    destroyed: false,
    missionId: null,
    spawnTimer: 0,
    aliveEnemyIds: [],
  };
}

/**
 * Generate 3-5 camps per zone at valid positions.
 * 70% spawner, 30% decorative.
 */
export function generateZoneCamps(
  nodeId: number, tier: number,
  zoneLeft: number, zoneTop: number,
  zoneW: number, zoneH: number,
): RuinCamp[] {
  const count = 3 + Math.floor(Math.random() * 3);
  const camps: RuinCamp[] = [];
  for (let i = 0; i < count; i++) {
    const x = zoneLeft + 200 + Math.random() * (zoneW - 400);
    const y = zoneTop + 200 + Math.random() * (zoneH - 400);
    const isSpawner = Math.random() < 0.7;
    camps.push(generateCamp(x, y, nodeId, isSpawner, tier));
  }
  return camps;
}

// ── Damage & Destruction ───────────────────────────────────────

/**
 * Apply damage to a specific ruin piece.
 * Returns true if the spawner core was destroyed (camp cleared).
 */
export function damagePiece(camp: RuinCamp, pieceIndex: number, damage: number): boolean {
  const piece = camp.pieces[pieceIndex];
  if (!piece || piece.destroyed) return false;

  piece.hp -= damage;
  camp.hp -= damage;

  if (piece.hp <= 0) {
    piece.destroyed = true;
    piece.hp = 0;

    if (piece.isSpawnerCore) {
      camp.destroyed = true;
      // Spawned enemies will despawn after 10s (handled by caller)
      return true;
    }
  }

  return false;
}

// ── Spawner Update ─────────────────────────────────────────────

export interface SpawnRequest {
  campId: string;
  enemyType: string;
  x: number;
  y: number;
  tier: number;
}

/**
 * Tick the spawner for a camp. Returns spawn requests for new enemies.
 */
export function updateCampSpawner(camp: RuinCamp, dt: number): SpawnRequest[] {
  if (camp.destroyed || !camp.spawner) return [];

  // Clean up dead enemies from alive list (caller should remove IDs of dead enemies)
  camp.spawnTimer += dt;
  if (camp.spawnTimer < camp.spawner.spawnInterval) return [];
  camp.spawnTimer = 0;

  if (camp.aliveEnemyIds.length >= camp.spawner.maxAlive) return [];

  // Spawn one enemy
  const type = camp.spawner.enemyTypes[Math.floor(Math.random() * camp.spawner.enemyTypes.length)];
  const angle = Math.random() * Math.PI * 2;
  const dist = 20 + Math.random() * camp.spawner.spawnRadius;
  return [{
    campId: camp.id,
    enemyType: type,
    x: camp.worldX + Math.cos(angle) * dist,
    y: camp.worldY + Math.sin(angle) * dist,
    tier: camp.spawner.tier,
  }];
}

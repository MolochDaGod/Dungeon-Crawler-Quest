/**
 * Dungeon AI — behavior system for dungeon enemies.
 * Replaces the inline straight-line moveToward logic with:
 *  - A* pathfinding through corridors and rooms
 *  - Room-based instant aggro (all enemies in player's room)
 *  - Corridor LOS aggro
 *  - Per-archetype behaviors (melee, tactical, ranged, tank, boss)
 *  - Alert nearby: aggroed enemies wake up neighbors
 *  - Patrol routes generated from room layout
 */

import type { DungeonGrid } from './dungeon-grid';
import type { DungeonState, DungeonEnemy } from './dungeon';
import { findDungeonPath } from './pathfinding';
import {
  isStunned, isRooted, getSpeedMultiplier, type CombatEntity,
} from './combat';

// ── Constants ──────────────────────────────────────────────────

const AGGRO_RANGE = 400;
const DEAGGRO_RANGE = 600;
const DEAGGRO_TIME = 5;
const PATH_RECALC_SEC = 1.5;
const ALERT_RANGE = 200;

// ── Types ──────────────────────────────────────────────────────

type DungeonArchetype =
  | 'melee_aggressive'   // Slime, Spider — rush and attack
  | 'melee_tactical'     // Skeleton, Orc — chase, attempt surround
  | 'ranged_cautious'    // Dark Mage — keep distance, flee if close
  | 'tank_slow'          // Golem — slow chase, high aggro persistence
  | 'boss';              // Dragon, Lich — stay in room, always aggro

type AIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'flee';

interface DungeonAIData {
  archetype: DungeonArchetype;
  state: AIState;
  patrolWaypoints: { x: number; y: number }[];
  patrolIdx: number;
  patrolPause: number;
  pathCache: { x: number; y: number }[];
  pathIdx: number;
  pathTimer: number;
  homeX: number;
  homeY: number;
  deaggroTimer: number;
}

// ── AI Data Store (keyed by enemy ID) ──────────────────────────

const store = new Map<number, DungeonAIData>();

// ── Archetype Mapping ──────────────────────────────────────────

function archetypeFor(type: string, isBoss: boolean): DungeonArchetype {
  if (isBoss) return 'boss';
  switch (type) {
    case 'Slime': case 'Spider': return 'melee_aggressive';
    case 'Skeleton': case 'Orc Grunt': return 'melee_tactical';
    case 'Dark Mage': return 'ranged_cautious';
    case 'Golem': return 'tank_slow';
    default: return 'melee_aggressive';
  }
}

// ── Helpers ────────────────────────────────────────────────────

function d(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function moveStep(
  e: DungeonEnemy, tx: number, ty: number,
  speed: number, dt: number, grid: DungeonGrid,
): void {
  const dx = tx - e.x, dy = ty - e.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;
  const step = Math.min(speed * dt, dist);
  const nx = e.x + (dx / dist) * step;
  const ny = e.y + (dy / dist) * step;
  if (grid.isWalkable(nx, e.y)) e.x = nx;
  if (grid.isWalkable(e.x, ny)) e.y = ny;
}

/** Follow cached A* path. Returns true if still traveling. */
function followPath(
  e: DungeonEnemy, ai: DungeonAIData,
  speed: number, dt: number, grid: DungeonGrid,
): boolean {
  if (ai.pathIdx >= ai.pathCache.length) return false;
  const wp = ai.pathCache[ai.pathIdx];
  if (d(e, wp) < 12) { ai.pathIdx++; return ai.pathIdx < ai.pathCache.length; }
  moveStep(e, wp.x, wp.y, speed, dt, grid);
  e.facing = Math.atan2(wp.y - e.y, wp.x - e.x);
  return true;
}

// ── Init ───────────────────────────────────────────────────────

/**
 * Initialize AI data for all enemies on the current floor.
 * Call once after generateFloor spawns enemies.
 */
export function initDungeonEnemyAI(state: DungeonState, grid: DungeonGrid): void {
  store.clear();
  for (const enemy of state.enemies) {
    const roomIdx = grid.getRoomAt(enemy.x, enemy.y, state.rooms);
    const room = roomIdx >= 0 ? state.rooms[roomIdx] : null;
    const waypoints = room ? grid.generatePatrolRoute(room, state.rooms) : [];
    const startIdx = waypoints.length > 0 ? (enemy.id % waypoints.length) : 0;

    store.set(enemy.id, {
      archetype: archetypeFor(enemy.type, enemy.isBoss),
      state: 'patrol',
      patrolWaypoints: waypoints,
      patrolIdx: startIdx,
      patrolPause: 0,
      pathCache: [],
      pathIdx: 0,
      pathTimer: 0,
      homeX: enemy.x,
      homeY: enemy.y,
      deaggroTimer: 0,
    });
  }
}

// ── Main Update ────────────────────────────────────────────────

/**
 * Update AI for all dungeon enemies.
 * Handles aggro detection, state transitions, pathfinding movement.
 * DOES NOT handle: status effects, attack timer, projectile creation, death.
 * Those remain in the main dungeon.ts loop.
 *
 * Call once per frame before the per-enemy attack logic.
 */
export function updateDungeonEnemyAI(
  state: DungeonState,
  grid: DungeonGrid,
  dt: number,
): void {
  const p = state.player;
  if (p.dead) return;

  const playerRoom = grid.getRoomAt(p.x, p.y, state.rooms);

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;

    // Skip stunned enemies (handled by combat system)
    if (isStunned(enemy as unknown as CombatEntity)) continue;
    // Rooted enemies can still target/face/attack but not move
    const rooted = isRooted(enemy as unknown as CombatEntity);
    const spdMult = getSpeedMultiplier(enemy as unknown as CombatEntity);

    const ai = store.get(enemy.id);
    if (!ai) continue;

    const dist2p = d(enemy, p);
    const enemyRoom = grid.getRoomAt(enemy.x, enemy.y, state.rooms);

    // ── Aggro Detection ──────────────────────────────────────
    let shouldAggro = false;

    // Room aggro: all enemies in the same room as player
    if (playerRoom >= 0 && playerRoom === enemyRoom) {
      shouldAggro = true;
    }
    // Corridor LOS aggro
    else if (dist2p < AGGRO_RANGE && grid.hasWorldLOS(enemy.x, enemy.y, p.x, p.y)) {
      shouldAggro = true;
    }
    // Boss always aggros when player is in boss room
    else if (ai.archetype === 'boss' && enemyRoom >= 0 && playerRoom === enemyRoom) {
      shouldAggro = true;
    }

    // Already engaged — check deaggro
    if (ai.state === 'chase' || ai.state === 'attack' || ai.state === 'flee') {
      if (!shouldAggro && dist2p > DEAGGRO_RANGE && !grid.hasWorldLOS(enemy.x, enemy.y, p.x, p.y)) {
        ai.deaggroTimer += dt;
        if (ai.deaggroTimer >= DEAGGRO_TIME) {
          ai.state = 'patrol';
          ai.deaggroTimer = 0;
          enemy.targetId = null;
          enemy.animState = 'idle';
          continue;
        }
      } else {
        ai.deaggroTimer = 0;
        shouldAggro = true;
      }
    }

    // Transition from patrol/idle → chase
    if (shouldAggro && (ai.state === 'patrol' || ai.state === 'idle')) {
      ai.state = 'chase';
      enemy.targetId = p.id;
      ai.deaggroTimer = 0;
      ai.pathTimer = 0; // force path recalc
      alertNearby(state, enemy, grid);
    }

    // ── State Machine ────────────────────────────────────────

    switch (ai.state) {
      case 'patrol': {
        if (rooted) { enemy.animState = 'idle'; break; }
        if (ai.patrolWaypoints.length === 0) { enemy.animState = 'idle'; break; }
        if (ai.patrolPause > 0) {
          ai.patrolPause -= dt;
          enemy.animState = 'idle';
          break;
        }
        const wp = ai.patrolWaypoints[ai.patrolIdx % ai.patrolWaypoints.length];
        if (d(enemy, wp) < 15) {
          ai.patrolIdx = (ai.patrolIdx + 1) % ai.patrolWaypoints.length;
          ai.patrolPause = 0.5 + Math.random() * 1.5;
          enemy.animState = 'idle';
          break;
        }
        moveStep(enemy, wp.x, wp.y, enemy.spd * 0.5 * spdMult, dt, grid);
        enemy.facing = Math.atan2(wp.y - enemy.y, wp.x - enemy.x);
        enemy.animState = 'walk';
        break;
      }

      case 'chase': {
        enemy.targetId = p.id;

        // Transition to attack when in range
        if (dist2p <= enemy.rng + 10) {
          ai.state = 'attack';
          break;
        }

        // Ranged cautious: flee if player gets too close
        if (ai.archetype === 'ranged_cautious' && dist2p < 80) {
          ai.state = 'flee';
          break;
        }

        if (rooted) { enemy.animState = 'idle'; break; }

        // Recalculate path periodically
        ai.pathTimer -= dt;
        if (ai.pathTimer <= 0 || ai.pathIdx >= ai.pathCache.length) {
          const result = findDungeonPath(enemy.x, enemy.y, p.x, p.y, grid);
          if (result.found) {
            ai.pathCache = result.path;
            ai.pathIdx = 0;
          }
          ai.pathTimer = PATH_RECALC_SEC + Math.random() * 0.5;
        }

        // Move along path
        const chaseSpd = ai.archetype === 'tank_slow'
          ? enemy.spd * 0.8 * spdMult
          : enemy.spd * 1.5 * spdMult;

        if (!followPath(enemy, ai, chaseSpd, dt, grid)) {
          // Fallback: direct approach (path not found or depleted)
          moveStep(enemy, p.x, p.y, enemy.spd * spdMult, dt, grid);
          enemy.facing = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        }
        enemy.animState = 'walk';
        break;
      }

      case 'attack': {
        enemy.targetId = p.id;
        enemy.facing = Math.atan2(p.y - enemy.y, p.x - enemy.x);
        enemy.animState = 'attack';

        // Target moved out of range → chase again
        if (dist2p > enemy.rng + 60) {
          ai.state = 'chase';
          ai.pathTimer = 0;
          break;
        }

        // Ranged cautious: maintain distance by kiting backwards
        if (ai.archetype === 'ranged_cautious' && dist2p < 100 && !rooted) {
          const away = Math.atan2(enemy.y - p.y, enemy.x - p.x);
          moveStep(enemy, enemy.x + Math.cos(away) * 80, enemy.y + Math.sin(away) * 80, enemy.spd * spdMult, dt, grid);
        }

        // Low HP ranged → flee
        if (ai.archetype === 'ranged_cautious' && enemy.hp / enemy.maxHp < 0.3) {
          ai.state = 'flee';
          break;
        }
        // NOTE: attack timer + projectile creation handled by main loop
        break;
      }

      case 'flee': {
        if (rooted) { enemy.animState = 'idle'; break; }
        const away = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        moveStep(enemy, enemy.x + Math.cos(away) * 120, enemy.y + Math.sin(away) * 120, enemy.spd * 1.2 * spdMult, dt, grid);
        enemy.facing = away;
        enemy.animState = 'walk';
        if (dist2p > 250 || enemy.hp / enemy.maxHp > 0.5) {
          ai.state = dist2p < AGGRO_RANGE ? 'chase' : 'patrol';
        }
        break;
      }

      case 'idle':
        enemy.animState = 'idle';
        if (ai.patrolWaypoints.length > 0) ai.state = 'patrol';
        break;
    }
  }
}

// ── Alert Nearby ───────────────────────────────────────────────

function alertNearby(state: DungeonState, alerter: DungeonEnemy, grid: DungeonGrid): void {
  for (const ally of state.enemies) {
    if (ally.id === alerter.id || ally.dead) continue;
    if (d(alerter, ally) > ALERT_RANGE) continue;
    const ai = store.get(ally.id);
    if (!ai || ai.state !== 'patrol') continue;
    ai.state = 'chase';
    ally.targetId = state.player.id;
    ai.deaggroTimer = 0;
    ai.pathTimer = 0;
  }
}

// ── Cleanup ────────────────────────────────────────────────────

/** Clear all AI data. Call when leaving dungeon. */
export function clearDungeonAI(): void {
  store.clear();
}

import {
  MobaState, MobaHero, MobaMinion, MobaTower, MobaNexus,
  Projectile, Particle, FloatingText, HudState, Camera,
  HeroData, HEROES, ITEMS, CLASS_ABILITIES, LANE_WAYPOINTS,
  MAP_SIZE, TEAM_COLORS, TEAM_NAMES, Vec2,
  xpForLevel, heroStatsAtLevel, calcDamage,
  RACE_COLORS, CLASS_COLORS, RARITY_COLORS
} from './types';
import { VoxelRenderer, TerrainType } from './voxel';
import {
  StatusEffect, updateStatusEffects, applyStatusEffect,
  isStunned, isRooted, isSilenced, getSpeedMultiplier,
  hasLifesteal, getAbilityStatusEffects,
  CombatEntity, calculateDamage as combatCalcDamage,
  DOT_TYPES, CC_TYPES
} from './combat';

const BASE_POSITIONS: Vec2[] = [
  { x: 300, y: 3700 },
  { x: 3700, y: 300 }
];

const TOWER_POSITIONS: { x: number; y: number; lane: number; team: number; tier: number }[] = [];

function initTowerPositions() {
  TOWER_POSITIONS.length = 0;
  for (let team = 0; team < 2; team++) {
    for (let lane = 0; lane < 3; lane++) {
      const waypoints = LANE_WAYPOINTS[lane];
      const path = team === 0 ? waypoints : [...waypoints].reverse();
      for (let tier = 0; tier < 2; tier++) {
        const t = (tier + 1) / 4;
        const totalLen = pathLength(path);
        const pos = pointAlongPath(path, t * totalLen);
        TOWER_POSITIONS.push({ x: pos.x, y: pos.y, lane, team, tier });
      }
    }
    const base = BASE_POSITIONS[team];
    TOWER_POSITIONS.push({ x: base.x + (team === 0 ? 80 : -80), y: base.y + (team === 0 ? -80 : 80), lane: -1, team, tier: 3 });
  }
}

function pathLength(path: Vec2[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += dist(path[i - 1], path[i]);
  }
  return len;
}

function pointAlongPath(path: Vec2[], d: number): Vec2 {
  let remaining = d;
  for (let i = 1; i < path.length; i++) {
    const segLen = dist(path[i - 1], path[i]);
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t };
    }
    remaining -= segLen;
  }
  return path[path.length - 1];
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function seededRandom(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const TILE_GRID = Math.ceil(MAP_SIZE / 80);

function isOnLaneStatic(x: number, y: number): boolean {
  for (const lane of LANE_WAYPOINTS) {
    for (let i = 1; i < lane.length; i++) {
      const a = lane[i - 1], b = lane[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const px = a.x + t * dx, py = a.y + t * dy;
      const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (d < 120) return true;
    }
  }
  return false;
}

function isNearRiver(x: number, y: number): boolean {
  const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
  const angle = Math.atan2(y - cy, x - cx);
  const riverDist = Math.abs(Math.sin(angle * 2)) * 200 + 50;
  const distCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  return Math.abs(distCenter - 1000) < riverDist * 0.15 && !isOnLaneStatic(x, y);
}

function generateTerrainMap(): number[][] {
  const grid: number[][] = [];
  for (let ty = 0; ty < TILE_GRID; ty++) {
    grid[ty] = [];
    for (let tx = 0; tx < TILE_GRID; tx++) {
      const wx = tx * 80 + 40;
      const wy = ty * 80 + 40;
      const distToCenter = Math.sqrt((wx - MAP_SIZE / 2) ** 2 + (wy - MAP_SIZE / 2) ** 2);

      const distBase0 = Math.sqrt((wx - BASE_POSITIONS[0].x) ** 2 + (wy - BASE_POSITIONS[0].y) ** 2);
      const distBase1 = Math.sqrt((wx - BASE_POSITIONS[1].x) ** 2 + (wy - BASE_POSITIONS[1].y) ** 2);

      if (distBase0 < 200) { grid[ty][tx] = 6; continue; }
      if (distBase1 < 200) { grid[ty][tx] = 7; continue; }

      if (isNearRiver(wx, wy)) { grid[ty][tx] = 8; continue; }

      if (isOnLaneStatic(wx, wy)) { grid[ty][tx] = 4; continue; }

      if (distToCenter > 400 && distToCenter < 1800) {
        grid[ty][tx] = 5;
      } else {
        grid[ty][tx] = seededRandom(tx, ty) > 0.85 ? 1 : 0;
      }
    }
  }
  return grid;
}

const TERRAIN_LOOKUP: TerrainType[] = ['grass', 'dirt', 'stone', 'water', 'lane', 'jungle', 'base_blue', 'base_red', 'river'];

function generateDecorations(): { x: number; y: number; type: 'tree' | 'rock'; seed: number }[] {
  const decos: { x: number; y: number; type: 'tree' | 'rock'; seed: number }[] = [];
  for (let i = 0; i < 200; i++) {
    const x = seededRandom(i * 7, i * 13) * MAP_SIZE;
    const y = seededRandom(i * 11, i * 17) * MAP_SIZE;
    const distBase0 = Math.sqrt((x - BASE_POSITIONS[0].x) ** 2 + (y - BASE_POSITIONS[0].y) ** 2);
    const distBase1 = Math.sqrt((x - BASE_POSITIONS[1].x) ** 2 + (y - BASE_POSITIONS[1].y) ** 2);
    if (distBase0 < 300 || distBase1 < 300) continue;
    if (isOnLaneStatic(x, y)) continue;
    const distCenter = Math.sqrt((x - MAP_SIZE / 2) ** 2 + (y - MAP_SIZE / 2) ** 2);
    if (distCenter > 400 && distCenter < 1800) {
      decos.push({ x, y, type: seededRandom(i, i + 100) > 0.3 ? 'tree' : 'rock', seed: i });
    }
  }
  for (let i = 0; i < 80; i++) {
    const x = seededRandom(i * 23 + 500, i * 29) * MAP_SIZE;
    const y = seededRandom(i * 31, i * 37 + 500) * MAP_SIZE;
    if (isOnLaneStatic(x, y)) continue;
    const distBase0 = Math.sqrt((x - BASE_POSITIONS[0].x) ** 2 + (y - BASE_POSITIONS[0].y) ** 2);
    const distBase1 = Math.sqrt((x - BASE_POSITIONS[1].x) ** 2 + (y - BASE_POSITIONS[1].y) ** 2);
    if (distBase0 < 300 || distBase1 < 300) continue;
    decos.push({ x, y, type: 'rock', seed: i + 300 });
  }
  return decos;
}

export function createInitialState(playerHeroId: number, playerTeam: number): MobaState {
  initTowerPositions();

  const state: MobaState = {
    heroes: [],
    minions: [],
    towers: [],
    nexuses: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    camera: { x: BASE_POSITIONS[playerTeam].x, y: BASE_POSITIONS[playerTeam].y, zoom: 1 },
    gameTime: 0,
    nextMinionWave: 5,
    playerHeroIndex: 0,
    gameOver: false,
    winner: -1,
    paused: false,
    nextEntityId: 1000,
    mouseWorld: { x: 0, y: 0 },
    selectedAbility: -1,
    showShop: false,
    showScoreboard: false,
    killFeed: [],
    terrainMap: generateTerrainMap(),
    decorations: generateDecorations(),
    cursorMode: 'default',
    hoveredEntityId: null,
    aKeyHeld: false
  };

  const team0Heroes = [playerHeroId];
  const team1Heroes: number[] = [];

  const available = HEROES.filter(h => h.id !== playerHeroId && !h.isSecret);
  const shuffled = [...available].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 4 && i < shuffled.length; i++) team0Heroes.push(shuffled[i].id);
  for (let i = 4; i < 9 && i < shuffled.length; i++) team1Heroes.push(shuffled[i].id);

  const laneAssign = [0, 0, 1, 1, 2];

  team0Heroes.forEach((hid, idx) => {
    const hd = HEROES.find(h => h.id === hid)!;
    const lane = laneAssign[idx] ?? 1;
    const spawn = laneSpawn(lane, 0);
    const hero = createHero(state, hd, 0, spawn.x, spawn.y, idx === 0);
    if (idx === 0) state.playerHeroIndex = state.heroes.length;
    state.heroes.push(hero);
  });

  team1Heroes.forEach((hid, _idx) => {
    const hd = HEROES.find(h => h.id === hid)!;
    const lane = laneAssign[_idx] ?? 1;
    const spawn = laneSpawn(lane, 1);
    state.heroes.push(createHero(state, hd, 1, spawn.x, spawn.y, false));
  });

  TOWER_POSITIONS.forEach(tp => {
    state.towers.push(createTower(state, tp.x, tp.y, tp.team, tp.lane, tp.tier));
  });

  state.nexuses.push({ id: state.nextEntityId++, x: BASE_POSITIONS[0].x, y: BASE_POSITIONS[0].y, team: 0, hp: 3000, maxHp: 3000, dead: false, destroyed: false });
  state.nexuses.push({ id: state.nextEntityId++, x: BASE_POSITIONS[1].x, y: BASE_POSITIONS[1].y, team: 1, hp: 3000, maxHp: 3000, dead: false, destroyed: false });

  return state;
}

function laneSpawn(lane: number, team: number): Vec2 {
  const base = BASE_POSITIONS[team];
  const offsets = [{ x: -60, y: -60 }, { x: 0, y: 0 }, { x: 60, y: 60 }];
  return { x: base.x + offsets[lane].x, y: base.y + offsets[lane].y };
}

function createHero(state: MobaState, hd: HeroData, team: number, x: number, y: number, isPlayer: boolean): MobaHero {
  const stats = heroStatsAtLevel(hd, 1);
  return {
    id: state.nextEntityId++,
    heroDataId: hd.id,
    x, y, team,
    hp: stats.hp, maxHp: stats.hp,
    mp: stats.mp, maxMp: stats.mp,
    atk: stats.atk, def: stats.def, spd: stats.spd, rng: hd.rng * 50,
    level: 1, xp: 0, gold: 500,
    kills: 0, deaths: 0, assists: 0,
    items: [null, null, null, null, null, null],
    abilityCooldowns: [0, 0, 0, 0],
    autoAttackTimer: 0,
    targetId: null, moveTarget: null,
    attackMoveTarget: null, isAttackMoving: false, stopCommand: false,
    vx: 0, vy: 0, facing: team === 0 ? -Math.PI / 4 : Math.PI * 3 / 4,
    animState: 'idle', animTimer: 0, attackAnimPhase: 0,
    respawnTimer: 0, isPlayer, dead: false,
    stunTimer: 0, buffTimer: 0, shieldHp: 0,
    lastDamagedBy: [],
    activeEffects: [],
    ccImmunityTimers: new Map()
  };
}

function createTower(state: MobaState, x: number, y: number, team: number, lane: number, tier: number): MobaTower {
  const hp = tier === 3 ? 2500 : 2000 - tier * 200;
  return {
    id: state.nextEntityId++,
    x, y, team, lane, tierIndex: tier,
    hp, maxHp: hp,
    atk: 80 + tier * 20, rng: 350,
    autoAttackTimer: 0,
    targetId: null, dead: false,
    isNexusTower: tier === 3
  };
}

function spawnMinionWave(state: MobaState) {
  for (let team = 0; team < 2; team++) {
    for (let lane = 0; lane < 3; lane++) {
      const base = BASE_POSITIONS[team];
      const offsets = [{ x: -40, y: -40 }, { x: 0, y: 0 }, { x: 40, y: 40 }];
      for (let i = 0; i < 4; i++) {
        const isSiege = i === 3 && state.gameTime > 120;
        state.minions.push({
          id: state.nextEntityId++,
          x: base.x + offsets[lane].x + (Math.random() - 0.5) * 30,
          y: base.y + offsets[lane].y + (Math.random() - 0.5) * 30,
          team, lane,
          hp: isSiege ? 300 : 200 + Math.floor(state.gameTime / 60) * 15,
          maxHp: isSiege ? 300 : 200 + Math.floor(state.gameTime / 60) * 15,
          waypointIndex: 0,
          targetId: null,
          atk: isSiege ? 35 : 18 + Math.floor(state.gameTime / 60) * 2,
          def: isSiege ? 10 : 3,
          spd: isSiege ? 60 : 80,
          rng: isSiege ? 250 : 80,
          autoAttackTimer: 0,
          minionType: isSiege ? 'siege' : (i < 3 ? 'melee' : 'ranged'),
          facing: team === 0 ? -Math.PI / 4 : Math.PI * 3 / 4,
          animTimer: Math.random() * 10,
          dead: false,
          goldValue: isSiege ? 40 : 20,
          xpValue: isSiege ? 50 : 25
        });
      }
    }
  }
}

export function updateGame(state: MobaState, dt: number, keys: Set<string>) {
  if (state.paused || state.gameOver) return;

  state.gameTime += dt;

  if (state.gameTime >= state.nextMinionWave) {
    spawnMinionWave(state);
    state.nextMinionWave += 30;
  }

  const player = state.heroes[state.playerHeroIndex];

  if (player && !player.dead) {
    const playerSpdMult = getSpeedMultiplier(player as any as CombatEntity);
    const playerRooted = isRooted(player as any as CombatEntity);
    let mx = 0, my = 0;
    if (keys.has('arrowup')) my = -1;
    if (keys.has('arrowdown')) my = 1;
    if (keys.has('arrowleft')) mx = -1;
    if (keys.has('arrowright')) mx = 1;

    if (!playerRooted && (mx !== 0 || my !== 0)) {
      const len = Math.sqrt(mx * mx + my * my);
      const speed = player.spd * 1.8 * playerSpdMult;
      player.vx = (mx / len) * speed;
      player.vy = (my / len) * speed;
      player.facing = Math.atan2(my, mx);
      player.moveTarget = null;
      player.attackMoveTarget = null;
      player.isAttackMoving = false;
      player.stopCommand = false;
      player.animState = 'walk';
    } else if (!playerRooted && player.isAttackMoving && player.attackMoveTarget) {
      const d = dist(player, player.attackMoveTarget);
      const nearEnemy = findNearestEnemy(state, player, player.rng + 50);
      if (nearEnemy) {
        player.targetId = nearEnemy.id;
        player.vx = 0;
        player.vy = 0;
      } else if (d < 10) {
        player.attackMoveTarget = null;
        player.isAttackMoving = false;
        player.vx = 0;
        player.vy = 0;
        player.animState = 'idle';
      } else {
        const angle = angleTo(player, player.attackMoveTarget);
        const speed = player.spd * 1.8 * playerSpdMult;
        player.vx = Math.cos(angle) * speed;
        player.vy = Math.sin(angle) * speed;
        player.facing = angle;
        player.animState = 'walk';
      }
    } else if (!playerRooted && player.moveTarget) {
      const d = dist(player, player.moveTarget);
      if (d < 10) {
        player.moveTarget = null;
        player.vx = 0;
        player.vy = 0;
        player.animState = 'idle';
      } else {
        const angle = angleTo(player, player.moveTarget);
        const speed = player.spd * 1.8 * playerSpdMult;
        player.vx = Math.cos(angle) * speed;
        player.vy = Math.sin(angle) * speed;
        player.facing = angle;
        player.animState = 'walk';
      }
    } else if (!player.stopCommand && player.targetId === null && !player.moveTarget && !player.isAttackMoving) {
      const nearEnemy = findNearestEnemy(state, player, player.rng + 30);
      if (nearEnemy) {
        player.targetId = nearEnemy.id;
      } else {
        player.vx = 0;
        player.vy = 0;
        if (player.animState === 'walk') player.animState = 'idle';
      }
    } else if (player.stopCommand) {
      player.vx = 0;
      player.vy = 0;
      if (player.animState === 'walk') player.animState = 'idle';
    } else {
      player.vx = 0;
      player.vy = 0;
      if (player.animState === 'walk') player.animState = 'idle';
    }

    if (keys.has(' ')) {
      const target = findNearestEnemy(state, player, player.rng + 30);
      if (target) player.targetId = target.id;
    }

    updateHoveredEntity(state);

    const baseDist = dist(player, BASE_POSITIONS[player.team]);
    if (baseDist < 200) {
      player.hp = Math.min(player.maxHp, player.hp + dt * 15);
      player.mp = Math.min(player.maxMp, player.mp + dt * 8);
    }
  }

  for (const hero of state.heroes) {
    updateHero(state, hero, dt);
  }

  for (const minion of state.minions) {
    updateMinion(state, minion, dt);
  }

  for (const tower of state.towers) {
    updateTower(state, tower, dt);
  }

  updateProjectiles(state, dt);
  updateParticles(state, dt);
  updateFloatingTexts(state, dt);

  state.minions = state.minions.filter(m => !m.dead);
  state.towers = state.towers.filter(t => !t.dead);
  state.projectiles = state.projectiles.filter(p => {
    const target = findEntityById(state, p.targetId);
    return target && !target.dead;
  });

  state.killFeed = state.killFeed.filter(k => state.gameTime - k.time < 8);

  for (const nexus of state.nexuses) {
    if (nexus.hp <= 0 && !nexus.destroyed) {
      nexus.destroyed = true;
      nexus.dead = true;
      state.gameOver = true;
      state.winner = nexus.team === 0 ? 1 : 0;
    }
  }

  if (player && !player.dead) {
    state.camera.x += (player.x - state.camera.x) * 0.08;
    state.camera.y += (player.y - state.camera.y) * 0.08;
  }

  state.camera.x = Math.max(0, Math.min(MAP_SIZE, state.camera.x));
  state.camera.y = Math.max(0, Math.min(MAP_SIZE, state.camera.y));
}

function updateHero(state: MobaState, hero: MobaHero, dt: number) {
  if (hero.dead) {
    hero.respawnTimer -= dt;
    if (hero.respawnTimer <= 0) {
      respawnHero(state, hero);
    }
    return;
  }

  hero.animTimer += dt;
  hero.mp = Math.min(hero.maxMp, hero.mp + dt * 2);

  const effectResult = updateStatusEffects(hero as any as CombatEntity, dt);
  if (effectResult.damage > 0) {
    hero.hp -= effectResult.damage;
    addFloatingText(state, hero.x, hero.y - 20, `-${Math.floor(effectResult.damage)}`, '#ff6666', 10);
  }
  if (effectResult.heal > 0) {
    hero.hp = Math.min(hero.maxHp, hero.hp + effectResult.heal);
  }

  if (hero.stunTimer > 0) hero.stunTimer -= dt;

  const stunned = isStunned(hero as any as CombatEntity) || hero.stunTimer > 0;
  if (stunned) {
    hero.vx = 0;
    hero.vy = 0;
    hero.autoAttackTimer -= dt;
    for (let i = 0; i < hero.abilityCooldowns.length; i++) {
      if (hero.abilityCooldowns[i] > 0) hero.abilityCooldowns[i] -= dt;
    }
    if (hero.hp <= 0) killHero(state, hero);
    return;
  }

  if (hero.buffTimer > 0) hero.buffTimer -= dt;

  for (let i = 0; i < hero.abilityCooldowns.length; i++) {
    if (hero.abilityCooldowns[i] > 0) hero.abilityCooldowns[i] -= dt;
  }

  hero.autoAttackTimer -= dt;

  if (!hero.isPlayer) {
    runHeroAI(state, hero, dt);
  }

  hero.x += hero.vx * dt;
  hero.y += hero.vy * dt;
  hero.x = Math.max(50, Math.min(MAP_SIZE - 50, hero.x));
  hero.y = Math.max(50, Math.min(MAP_SIZE - 50, hero.y));

  if (hero.targetId !== null) {
    const target = findEntityById(state, hero.targetId);
    if (!target || target.dead) {
      hero.targetId = null;
    } else {
      const d = dist(hero, target);
      if (d <= hero.rng + 30) {
        if (hero.autoAttackTimer <= 0) {
          performAutoAttack(state, hero, target);
          hero.autoAttackTimer = 1.0;
          hero.animState = 'attack';
          hero.facing = angleTo(hero, target);
        }
        hero.vx = 0;
        hero.vy = 0;
      } else {
        const angle = angleTo(hero, target);
        const speed = hero.spd * 1.8;
        hero.vx = Math.cos(angle) * speed;
        hero.vy = Math.sin(angle) * speed;
        hero.facing = angle;
        hero.animState = 'walk';
      }
    }
  }

  if (hero.hp <= 0) {
    killHero(state, hero);
  }
}

function runHeroAI(state: MobaState, hero: MobaHero, _dt: number) {
  const heroData = HEROES[hero.heroDataId];
  if (!heroData) return;

  if (hero.hp < hero.maxHp * 0.2) {
    const base = BASE_POSITIONS[hero.team];
    hero.moveTarget = { x: base.x, y: base.y };
    hero.targetId = null;
    const angle = angleTo(hero, base);
    hero.vx = Math.cos(angle) * hero.spd * 1.8;
    hero.vy = Math.sin(angle) * hero.spd * 1.8;
    hero.facing = angle;

    const baseDist = dist(hero, base);
    if (baseDist < 200) {
      hero.hp = Math.min(hero.maxHp, hero.hp + 5);
      hero.mp = Math.min(hero.maxMp, hero.mp + 3);
    }
    return;
  }

  for (let i = 0; i < hero.abilityCooldowns.length; i++) {
    if (hero.abilityCooldowns[i] <= 0) {
      const abilities = CLASS_ABILITIES[heroData.heroClass];
      if (abilities && abilities[i]) {
        const ab = abilities[i];
        if (hero.mp >= ab.manaCost) {
          const target = findNearestEnemy(state, hero, ab.range + 100);
          if (target && dist(hero, target) < ab.range + 50) {
            executeAbility(state, hero, i, target);
            break;
          }
        }
      }
    }
  }

  if (hero.targetId === null) {
    const enemy = findNearestEnemy(state, hero, 500);
    if (enemy) {
      hero.targetId = enemy.id;
    } else {
      const lanes = [0, 1, 2];
      const lane = lanes[hero.id % 3];
      const waypoints = hero.team === 0 ? LANE_WAYPOINTS[lane] : [...LANE_WAYPOINTS[lane]].reverse();
      const target = waypoints[waypoints.length - 1];
      const angle = angleTo(hero, target);
      hero.vx = Math.cos(angle) * hero.spd * 1.5;
      hero.vy = Math.sin(angle) * hero.spd * 1.5;
      hero.facing = angle;
      hero.animState = 'walk';
    }
  }

  if (hero.gold >= 800) {
    const affordable = ITEMS.filter(item => item.cost <= hero.gold).sort((a, b) => b.cost - a.cost);
    if (affordable.length > 0) {
      const slot = hero.items.findIndex(s => s === null);
      if (slot !== -1) {
        const item = affordable[0];
        hero.items[slot] = item;
        hero.gold -= item.cost;
        applyItemStats(hero, item);
      }
    }
  }
}

function applyItemStats(hero: MobaHero, item: { hp: number; atk: number; def: number; spd: number; mp: number }) {
  hero.maxHp += item.hp;
  hero.hp += item.hp;
  hero.atk += item.atk;
  hero.def += item.def;
  hero.spd += item.spd;
  hero.maxMp += item.mp;
  hero.mp += item.mp;
}

function findNearestEnemy(state: MobaState, entity: { x: number; y: number; team: number }, range: number): { id: number; x: number; y: number; team: number; dead: boolean; hp: number } | null {
  let nearest: any = null;
  let nearestDist = range;

  for (const h of state.heroes) {
    if (h.team === entity.team || h.dead) continue;
    const d = dist(entity, h);
    if (d < nearestDist) { nearestDist = d; nearest = h; }
  }
  for (const m of state.minions) {
    if (m.team === entity.team || m.dead) continue;
    const d = dist(entity, m);
    if (d < nearestDist) { nearestDist = d; nearest = m; }
  }
  for (const t of state.towers) {
    if (t.team === entity.team || t.dead) continue;
    const d = dist(entity, t);
    if (d < nearestDist) { nearestDist = d; nearest = t; }
  }
  for (const n of state.nexuses) {
    if (n.team === entity.team || n.dead) continue;
    const d = dist(entity, n);
    if (d < nearestDist) { nearestDist = d; nearest = n; }
  }

  return nearest;
}

function findEntityById(state: MobaState, id: number): any {
  for (const h of state.heroes) if (h.id === id) return h;
  for (const m of state.minions) if (m.id === id) return m;
  for (const t of state.towers) if (t.id === id) return t;
  for (const n of state.nexuses) if (n.id === id) return n;
  return null;
}

function performAutoAttack(state: MobaState, attacker: MobaHero | MobaMinion, target: any) {
  const atk = 'atk' in attacker ? attacker.atk : 15;
  const color = attacker.team === 0 ? '#60a5fa' : '#f87171';
  state.projectiles.push({
    id: state.nextEntityId++,
    x: attacker.x, y: attacker.y,
    targetId: target.id,
    targetType: 'hero',
    damage: atk,
    speed: 600,
    team: attacker.team,
    sourceId: attacker.id,
    color,
    size: 4
  });
}

export function executeAbility(state: MobaState, hero: MobaHero, abilityIndex: number, target: any) {
  const heroData = HEROES[hero.heroDataId];
  if (!heroData) return;
  const abilities = CLASS_ABILITIES[heroData.heroClass];
  if (!abilities || !abilities[abilityIndex]) return;

  const ab = abilities[abilityIndex];
  if (hero.abilityCooldowns[abilityIndex] > 0 || hero.mp < ab.manaCost) return;

  hero.mp -= ab.manaCost;
  hero.abilityCooldowns[abilityIndex] = ab.cooldown;
  hero.animState = 'ability';
  hero.animTimer = 0;

  const abilityColor = CLASS_COLORS[heroData.heroClass] || '#ffffff';

  const statusEffects = getAbilityStatusEffects(ab.name, hero.id, hero.atk);

  switch (ab.type) {
    case 'damage': {
      if (target) {
        const dmg = ab.damage + hero.atk * 0.8;
        dealDamage(state, hero, target, dmg);
        spawnAbilityParticles(state, target.x, target.y, abilityColor, 8);
        if (target.activeEffects) {
          for (const eff of statusEffects) applyStatusEffect(target as any as CombatEntity, eff);
        } else if (ab.duration > 0 && 'stunTimer' in target) {
          target.stunTimer = ab.duration;
        }
      }
      break;
    }
    case 'aoe': {
      const cx = target ? target.x : hero.x;
      const cy = target ? target.y : hero.y;
      const entities = getAllEnemies(state, hero.team);
      for (const e of entities) {
        if (dist({ x: cx, y: cy }, e) < ab.radius) {
          const dmg = ab.damage + hero.atk * 0.6;
          dealDamage(state, hero, e, dmg);
          if (e.activeEffects) {
            for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
          }
        }
      }
      spawnAbilityParticles(state, cx, cy, abilityColor, 20);
      break;
    }
    case 'buff': {
      hero.buffTimer = ab.duration;
      for (const eff of statusEffects) applyStatusEffect(hero as any as CombatEntity, eff);
      if (ab.name === 'Avatar') {
        const buffHp = Math.floor(hero.maxHp * 0.5);
        hero.maxHp += buffHp;
        hero.hp += buffHp;
        setTimeout(() => { hero.maxHp -= buffHp; hero.hp = Math.min(hero.hp, hero.maxHp); }, ab.duration * 1000);
      }
      spawnAbilityParticles(state, hero.x, hero.y, '#ffd700', 15);
      break;
    }
    case 'debuff': {
      const entities = getAllEnemies(state, hero.team);
      for (const e of entities) {
        if (dist(hero, e) < ab.radius) {
          if (e.activeEffects) {
            for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
          } else {
            if ('spd' in e) {
              const origSpd = e.spd;
              e.spd = Math.floor(e.spd * 0.6);
              setTimeout(() => { e.spd = origSpd; }, ab.duration * 1000);
            }
          }
          if (ab.damage > 0) dealDamage(state, hero, e, ab.damage);
        }
      }
      spawnAbilityParticles(state, hero.x, hero.y, '#06b6d4', 12);
      break;
    }
    case 'heal': {
      hero.shieldHp = 100 + hero.def * 2;
      for (const eff of statusEffects) applyStatusEffect(hero as any as CombatEntity, eff);
      spawnAbilityParticles(state, hero.x, hero.y, '#22c55e', 10);
      break;
    }
    case 'dash': {
      if (target) {
        const angle = angleTo(hero, target);
        const dashDist = Math.min(ab.range, dist(hero, target));
        hero.x += Math.cos(angle) * dashDist;
        hero.y += Math.sin(angle) * dashDist;
        if (ab.damage > 0) dealDamage(state, hero, target, ab.damage + hero.atk * 0.5);
        spawnAbilityParticles(state, hero.x, hero.y, abilityColor, 8);
      } else {
        const dashDist = ab.range;
        hero.x += Math.cos(hero.facing) * dashDist;
        hero.y += Math.sin(hero.facing) * dashDist;
        spawnAbilityParticles(state, hero.x, hero.y, abilityColor, 8);
      }
      for (const eff of statusEffects) applyStatusEffect(hero as any as CombatEntity, eff);
      hero.x = Math.max(50, Math.min(MAP_SIZE - 50, hero.x));
      hero.y = Math.max(50, Math.min(MAP_SIZE - 50, hero.y));
      break;
    }
  }

  addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
}

function getAllEnemies(state: MobaState, team: number): any[] {
  const enemies: any[] = [];
  for (const h of state.heroes) if (h.team !== team && !h.dead) enemies.push(h);
  for (const m of state.minions) if (m.team !== team && !m.dead) enemies.push(m);
  for (const t of state.towers) if (t.team !== team && !t.dead) enemies.push(t);
  return enemies;
}

function dealDamage(state: MobaState, attacker: any, target: any, rawDmg: number) {
  const def = 'def' in target ? target.def : 0;
  let dmg = calcDamage(rawDmg, def);

  if ('shieldHp' in target && target.shieldHp > 0) {
    const absorbed = Math.min(target.shieldHp, dmg);
    target.shieldHp -= absorbed;
    dmg -= absorbed;
  }

  target.hp -= dmg;

  if ('lastDamagedBy' in target) {
    if (!target.lastDamagedBy.includes(attacker.id)) {
      target.lastDamagedBy.push(attacker.id);
      if (target.lastDamagedBy.length > 5) target.lastDamagedBy.shift();
    }
  }

  const color = dmg > 40 ? '#ffd700' : '#ffffff';
  addFloatingText(state, target.x, target.y - 20, `-${dmg}`, color, dmg > 40 ? 18 : 14);

  for (let i = 0; i < 3; i++) {
    state.particles.push({
      x: target.x, y: target.y,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100,
      life: 0.3, maxLife: 0.3,
      color: '#ff6666', size: 3, type: 'hit'
    });
  }

  if (target.hp <= 0) {
    target.dead = true;

    if ('heroDataId' in target) {
      killHero(state, target);
      if ('heroDataId' in attacker) {
        const killer = attacker as MobaHero;
        killer.kills++;
        killer.gold += 300;
        killer.xp += 150;
        addFloatingText(state, killer.x, killer.y - 30, '+300g', '#ffd700', 16);
        checkLevelUp(state, killer);

        for (const dmgId of target.lastDamagedBy) {
          if (dmgId !== killer.id) {
            const assistant = state.heroes.find(h => h.id === dmgId);
            if (assistant && assistant.team === killer.team) {
              assistant.assists++;
              assistant.gold += 100;
              assistant.xp += 75;
            }
          }
        }

        const killerData = HEROES[killer.heroDataId];
        const targetData = HEROES[target.heroDataId];
        if (killerData && targetData) {
          state.killFeed.push({
            text: `${killerData.name} killed ${targetData.name}`,
            color: TEAM_COLORS[killer.team],
            time: state.gameTime
          });
        }
      }
    } else if ('goldValue' in target) {
      if ('heroDataId' in attacker) {
        const killer = attacker as MobaHero;
        killer.gold += (target as MobaMinion).goldValue;
        killer.xp += (target as MobaMinion).xpValue;
        addFloatingText(state, killer.x, killer.y - 30, `+${(target as MobaMinion).goldValue}g`, '#ffd700', 12);
        checkLevelUp(state, killer);
      }
      spawnDeathParticles(state, target.x, target.y, '#888888');
    } else if ('isNexusTower' in target) {
      spawnDeathParticles(state, target.x, target.y, TEAM_COLORS[target.team]);
      state.killFeed.push({
        text: `${TEAM_NAMES[target.team === 0 ? 1 : 0]} destroyed a tower!`,
        color: TEAM_COLORS[target.team === 0 ? 1 : 0],
        time: state.gameTime
      });
      if ('heroDataId' in attacker) {
        (attacker as MobaHero).gold += 150;
      }
    } else if ('destroyed' in target) {
      target.destroyed = true;
    }
  }
}

function killHero(state: MobaState, hero: MobaHero) {
  hero.dead = true;
  hero.deaths++;
  hero.respawnTimer = 5 + hero.level * 2;
  hero.targetId = null;
  hero.moveTarget = null;
  hero.vx = 0;
  hero.vy = 0;
  hero.lastDamagedBy = [];
  spawnDeathParticles(state, hero.x, hero.y, TEAM_COLORS[hero.team]);
}

function respawnHero(state: MobaState, hero: MobaHero) {
  const base = BASE_POSITIONS[hero.team];
  hero.x = base.x + (Math.random() - 0.5) * 60;
  hero.y = base.y + (Math.random() - 0.5) * 60;
  hero.dead = false;
  const stats = heroStatsAtLevel(HEROES[hero.heroDataId], hero.level);
  hero.hp = stats.hp;
  hero.maxHp = stats.hp;
  hero.mp = stats.mp;
  hero.maxMp = stats.mp;

  for (const item of hero.items) {
    if (item) {
      hero.maxHp += item.hp;
      hero.hp += item.hp;
      hero.maxMp += item.mp;
      hero.mp += item.mp;
    }
  }

  hero.stunTimer = 0;
  hero.shieldHp = 0;
  hero.animState = 'idle';
  spawnAbilityParticles(state, hero.x, hero.y, '#22c55e', 15);
}

function checkLevelUp(state: MobaState, hero: MobaHero) {
  while (hero.level < 18 && hero.xp >= xpForLevel(hero.level)) {
    hero.xp -= xpForLevel(hero.level);
    hero.level++;
    const stats = heroStatsAtLevel(HEROES[hero.heroDataId], hero.level);
    const hpDiff = stats.hp - (hero.maxHp - totalItemStat(hero, 'hp'));
    hero.maxHp += hpDiff;
    hero.hp = Math.min(hero.hp + hpDiff, hero.maxHp);
    hero.atk = stats.atk + totalItemStat(hero, 'atk');
    hero.def = stats.def + totalItemStat(hero, 'def');
    hero.spd = stats.spd + totalItemStat(hero, 'spd');
    hero.maxMp = stats.mp + totalItemStat(hero, 'mp');
    hero.mp = Math.min(hero.mp + 20, hero.maxMp);

    addFloatingText(state, hero.x, hero.y - 40, `LEVEL ${hero.level}!`, '#ffd700', 20);
    spawnAbilityParticles(state, hero.x, hero.y, '#ffd700', 20);

    if (hero.isPlayer) {
      state.killFeed.push({ text: `You reached level ${hero.level}!`, color: '#ffd700', time: state.gameTime });
    }
  }
}

function totalItemStat(hero: MobaHero, stat: 'hp' | 'atk' | 'def' | 'spd' | 'mp'): number {
  let total = 0;
  for (const item of hero.items) {
    if (item) total += item[stat];
  }
  return total;
}

function updateMinion(state: MobaState, minion: MobaMinion, dt: number) {
  if (minion.dead) return;

  minion.animTimer += dt;
  minion.autoAttackTimer -= dt;

  const enemy = findNearestEnemy(state, minion, 300);
  if (enemy && dist(minion, enemy) < minion.rng + 20) {
    if (minion.autoAttackTimer <= 0) {
      performAutoAttack(state, minion as any, enemy);
      minion.autoAttackTimer = 1.2;
      minion.facing = angleTo(minion, enemy);
    }
    return;
  }

  if (enemy && dist(minion, enemy) < 300) {
    const angle = angleTo(minion, enemy);
    minion.x += Math.cos(angle) * minion.spd * dt;
    minion.y += Math.sin(angle) * minion.spd * dt;
    minion.facing = angle;
    return;
  }

  const waypoints = minion.team === 0 ? LANE_WAYPOINTS[minion.lane] : [...LANE_WAYPOINTS[minion.lane]].reverse();
  if (minion.waypointIndex < waypoints.length) {
    const wp = waypoints[minion.waypointIndex];
    const d = dist(minion, wp);
    if (d < 40) {
      minion.waypointIndex++;
    } else {
      const angle = angleTo(minion, wp);
      minion.x += Math.cos(angle) * minion.spd * dt;
      minion.y += Math.sin(angle) * minion.spd * dt;
      minion.facing = angle;
    }
  }
}

function updateTower(state: MobaState, tower: MobaTower, dt: number) {
  if (tower.dead) return;

  tower.autoAttackTimer -= dt;

  if (tower.targetId !== null) {
    const target = findEntityById(state, tower.targetId);
    if (!target || target.dead || dist(tower, target) > tower.rng + 50) {
      tower.targetId = null;
    }
  }

  if (tower.targetId === null) {
    let closest: any = null;
    let closestDist = tower.rng;

    for (const m of state.minions) {
      if (m.team === tower.team || m.dead) continue;
      const d = dist(tower, m);
      if (d < closestDist) { closestDist = d; closest = m; }
    }
    if (!closest) {
      for (const h of state.heroes) {
        if (h.team === tower.team || h.dead) continue;
        const d = dist(tower, h);
        if (d < closestDist) { closestDist = d; closest = h; }
      }
    }
    if (closest) tower.targetId = closest.id;
  }

  if (tower.targetId !== null && tower.autoAttackTimer <= 0) {
    const target = findEntityById(state, tower.targetId);
    if (target) {
      state.projectiles.push({
        id: state.nextEntityId++,
        x: tower.x, y: tower.y,
        targetId: target.id,
        targetType: 'hero',
        damage: tower.atk,
        speed: 800,
        team: tower.team,
        sourceId: tower.id,
        color: TEAM_COLORS[tower.team],
        size: 6
      });
      tower.autoAttackTimer = 1.5;

      for (let i = 0; i < 3; i++) {
        state.particles.push({
          x: tower.x, y: tower.y - 30,
          vx: (Math.random() - 0.5) * 60,
          vy: -Math.random() * 80,
          life: 0.4, maxLife: 0.4,
          color: TEAM_COLORS[tower.team], size: 4, type: 'tower'
        });
      }
    }
  }
}

function updateProjectiles(state: MobaState, dt: number) {
  for (const proj of state.projectiles) {
    const target = findEntityById(state, proj.targetId);
    if (!target || target.dead) continue;

    const angle = angleTo(proj, target);
    proj.x += Math.cos(angle) * proj.speed * dt;
    proj.y += Math.sin(angle) * proj.speed * dt;

    if (dist(proj, target) < 15) {
      const attacker = findEntityById(state, proj.sourceId);
      if (attacker) {
        dealDamage(state, attacker, target, proj.damage);
      } else {
        target.hp -= proj.damage;
        if (target.hp <= 0) target.dead = true;
      }
      proj.targetId = -1;
    }
  }
  state.projectiles = state.projectiles.filter(p => p.targetId !== -1);
}

function updateParticles(state: MobaState, dt: number) {
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vy += 50 * dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

function updateFloatingTexts(state: MobaState, dt: number) {
  for (const ft of state.floatingTexts) {
    ft.y += ft.vy * dt;
    ft.life -= dt;
  }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);
}

function addFloatingText(state: MobaState, x: number, y: number, text: string, color: string, size: number) {
  state.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -40, size });
}

function spawnDeathParticles(state: MobaState, x: number, y: number, color: string) {
  for (let i = 0; i < 15; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200 - 50,
      life: 0.8, maxLife: 0.8,
      color, size: 4, type: 'death'
    });
  }
}

function spawnAbilityParticles(state: MobaState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 150,
      vy: (Math.random() - 0.5) * 150 - 30,
      life: 0.6, maxLife: 0.6,
      color, size: 3, type: 'ability'
    });
  }
}

export function handlePlayerAbility(state: MobaState, abilityIndex: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  const target = findNearestEnemy(state, player, 600);
  executeAbility(state, player, abilityIndex, target);
}

export function handlePlayerAttack(state: MobaState) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  const target = findNearestEnemy(state, player, player.rng + 50);
  if (target) {
    player.targetId = target.id;
    player.stopCommand = false;
    player.isAttackMoving = false;
    player.attackMoveTarget = null;
  }
}

export function handleAttackMoveClick(state: MobaState, worldX: number, worldY: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  const clickedUnit = findEntityAtPosition(state, worldX, worldY, player.team);
  if (clickedUnit) {
    player.targetId = clickedUnit.id;
    player.moveTarget = null;
    player.attackMoveTarget = null;
    player.isAttackMoving = false;
  } else {
    player.attackMoveTarget = { x: worldX, y: worldY };
    player.isAttackMoving = true;
    player.targetId = null;
    player.moveTarget = null;
  }
  player.stopCommand = false;
}

export function handleStopCommand(state: MobaState) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  player.targetId = null;
  player.moveTarget = null;
  player.attackMoveTarget = null;
  player.isAttackMoving = false;
  player.stopCommand = true;
  player.vx = 0;
  player.vy = 0;
  player.animState = 'idle';
}

export function handleRightClick(state: MobaState, worldX: number, worldY: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  player.stopCommand = false;
  player.isAttackMoving = false;
  player.attackMoveTarget = null;

  const clickedEnemy = findEntityAtPosition(state, worldX, worldY, player.team);

  if (clickedEnemy) {
    player.targetId = clickedEnemy.id;
    player.moveTarget = null;
  } else {
    player.moveTarget = { x: worldX, y: worldY };
    player.targetId = null;
  }
}

export function findEntityAtPosition(state: MobaState, worldX: number, worldY: number, playerTeam: number): any {
  let closest: any = null;
  let closestDist = 35;

  for (const h of state.heroes) {
    if (h.team === playerTeam || h.dead) continue;
    const d = dist({ x: worldX, y: worldY }, h);
    if (d < closestDist) { closestDist = d; closest = h; }
  }
  for (const m of state.minions) {
    if (m.team === playerTeam || m.dead) continue;
    const d = dist({ x: worldX, y: worldY }, m);
    if (d < closestDist) { closestDist = d; closest = m; }
  }
  for (const t of state.towers) {
    if (t.team === playerTeam || t.dead) continue;
    const d = dist({ x: worldX, y: worldY }, t);
    if (d < closestDist) { closestDist = d; closest = t; }
  }
  for (const n of state.nexuses) {
    if (n.team === playerTeam || n.dead) continue;
    const d = dist({ x: worldX, y: worldY }, n);
    if (d < closestDist) { closestDist = d; closest = n; }
  }

  return closest;
}

export function updateHoveredEntity(state: MobaState) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player) { state.hoveredEntityId = null; return; }

  const entity = findEntityAtPosition(state, state.mouseWorld.x, state.mouseWorld.y, player.team);
  state.hoveredEntityId = entity ? entity.id : null;
}

export function buyItem(state: MobaState, itemId: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player) return;

  const item = ITEMS.find(i => i.id === itemId);
  if (!item || player.gold < item.cost) return;

  const slot = player.items.findIndex(s => s === null);
  if (slot === -1) return;

  player.items[slot] = item;
  player.gold -= item.cost;
  applyItemStats(player, item);

  addFloatingText(state, player.x, player.y - 30, `Bought ${item.name}`, '#ffd700', 14);
}

export function getHudState(state: MobaState): HudState {
  const player = state.heroes[state.playerHeroIndex];
  const heroData = player ? HEROES[player.heroDataId] : null;

  return {
    hp: player?.hp ?? 0,
    maxHp: player?.maxHp ?? 1,
    mp: player?.mp ?? 0,
    maxMp: player?.maxMp ?? 1,
    level: player?.level ?? 1,
    xp: player?.xp ?? 0,
    xpToNext: player ? xpForLevel(player.level) : 100,
    gold: player?.gold ?? 0,
    kills: player?.kills ?? 0,
    deaths: player?.deaths ?? 0,
    assists: player?.assists ?? 0,
    items: player?.items ?? [null, null, null, null, null, null],
    abilityCooldowns: player?.abilityCooldowns ?? [0, 0, 0, 0],
    gameTime: state.gameTime,
    heroName: heroData?.name ?? '',
    heroTitle: heroData?.title ?? '',
    heroClass: heroData?.heroClass ?? '',
    heroRace: heroData?.race ?? '',
    gameOver: state.gameOver,
    winner: state.winner,
    team: player?.team ?? 0,
    showShop: state.showShop,
    showScoreboard: state.showScoreboard,
    allHeroes: state.heroes.map(h => {
      const hd = HEROES[h.heroDataId];
      return { name: hd?.name ?? '', kills: h.kills, deaths: h.deaths, assists: h.assists, level: h.level, team: h.team, hp: h.hp, maxHp: h.maxHp };
    }),
    killFeed: state.killFeed,
    atk: player?.atk ?? 0,
    def: player?.def ?? 0,
    spd: player?.spd ?? 0,
    activeEffects: (player?.activeEffects || []).map((e: any) => ({
      name: e.name || e.type,
      icon: e.icon || '',
      color: e.color || '#fff',
      remaining: e.remaining || 0,
      stacks: e.stacks || 1,
    }))
  };
}

export class MobaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private voxel: VoxelRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.voxel = new VoxelRenderer();
  }

  render(state: MobaState) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const cam = state.camera;

    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.renderMap(ctx, cam, W, H, state);
    this.renderLanes(ctx);

    for (const nexus of state.nexuses) {
      if (!nexus.dead) this.renderNexus(ctx, nexus);
    }

    for (const tower of state.towers) {
      if (!tower.dead) this.renderTower(ctx, tower);
    }

    if (state.hoveredEntityId !== null) {
      const hovEntity = findEntityById(state, state.hoveredEntityId);
      if (hovEntity && !hovEntity.dead) {
        ctx.save();
        ctx.translate(hovEntity.x, hovEntity.y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    const sortedMinions = [...state.minions].sort((a, b) => a.y - b.y);
    for (const minion of sortedMinions) {
      if (!minion.dead) this.renderMinion(ctx, minion);
    }

    const sortedHeroes = [...state.heroes].sort((a, b) => a.y - b.y);
    for (const hero of sortedHeroes) {
      if (!hero.dead) this.renderHero(ctx, hero, state);
    }

    for (const proj of state.projectiles) {
      this.renderProjectile(ctx, proj);
    }

    for (const p of state.particles) {
      this.renderParticle(ctx, p);
    }

    for (const ft of state.floatingTexts) {
      this.renderFloatingText(ctx, ft);
    }

    this.renderCursor(ctx, state);

    ctx.restore();

    this.renderMinimap(ctx, state, W, H);
    this.renderKillFeed(ctx, state, W);
  }

  private renderCursor(ctx: CanvasRenderingContext2D, state: MobaState) {
    const mx = state.mouseWorld.x;
    const my = state.mouseWorld.y;
    const t = Date.now() * 0.004;

    ctx.save();
    ctx.translate(mx, my);

    if (state.cursorMode === 'attack') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(-3, 0);
      ctx.moveTo(3, 0); ctx.lineTo(8, 0);
      ctx.moveTo(0, -8); ctx.lineTo(0, -3);
      ctx.moveTo(0, 3); ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.globalAlpha = 0.4 + Math.sin(t) * 0.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (state.cursorMode === 'ability') {
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + Math.sin(t) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, 12, t, t + Math.PI * 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, -t, -t + Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (state.cursorMode === 'attackmove') {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(-4, 0);
      ctx.moveTo(4, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, -4);
      ctx.moveTo(0, 4); ctx.lineTo(0, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.globalAlpha = 0.3 + Math.sin(t * 2) * 0.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (state.cursorMode === 'move') {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, -3); ctx.lineTo(2, -3);
      ctx.lineTo(2, 8); ctx.lineTo(-2, 8);
      ctx.lineTo(-2, -3); ctx.lineTo(-5, -3);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      const sz = 6;
      ctx.beginPath();
      ctx.moveTo(-sz, -sz + 3); ctx.lineTo(-sz, -sz); ctx.lineTo(-sz + 3, -sz);
      ctx.moveTo(sz, -sz + 3); ctx.lineTo(sz, -sz); ctx.lineTo(sz - 3, -sz);
      ctx.moveTo(-sz, sz - 3); ctx.lineTo(-sz, sz); ctx.lineTo(-sz + 3, sz);
      ctx.moveTo(sz, sz - 3); ctx.lineTo(sz, sz); ctx.lineTo(sz - 3, sz);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private renderMap(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, state: MobaState) {
    const startTX = Math.max(0, Math.floor((cam.x - W / 2 / cam.zoom) / 80) - 1);
    const startTY = Math.max(0, Math.floor((cam.y - H / 2 / cam.zoom) / 80) - 1);
    const endTX = Math.min(TILE_GRID, Math.ceil((cam.x + W / 2 / cam.zoom) / 80) + 1);
    const endTY = Math.min(TILE_GRID, Math.ceil((cam.y + H / 2 / cam.zoom) / 80) + 1);

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const terrainIdx = state.terrainMap[ty]?.[tx] ?? 0;
        const terrain = TERRAIN_LOOKUP[terrainIdx] || 'grass';
        this.voxel.drawTerrainTile(ctx, tx * 80, ty * 80, 80, terrain, tx, ty);
      }
    }

    for (const deco of state.decorations) {
      if (deco.x < cam.x - W / 2 / cam.zoom - 40 || deco.x > cam.x + W / 2 / cam.zoom + 40) continue;
      if (deco.y < cam.y - H / 2 / cam.zoom - 80 || deco.y > cam.y + H / 2 / cam.zoom + 40) continue;
      if (deco.type === 'tree') {
        this.voxel.drawTreeVoxel(ctx, deco.x, deco.y, deco.seed);
      } else {
        this.voxel.drawRockVoxel(ctx, deco.x, deco.y, deco.seed);
      }
    }
  }

  private isOnLane(x: number, y: number): boolean {
    for (const lane of LANE_WAYPOINTS) {
      for (let i = 1; i < lane.length; i++) {
        const a = lane[i - 1], b = lane[i];
        const d = this.pointToSegmentDist(x, y, a.x, a.y, b.x, b.y);
        if (d < 120) return true;
      }
    }
    return false;
  }

  private pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const projX = ax + t * dx, projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  private renderLanes(ctx: CanvasRenderingContext2D) {
    const laneColors = ['rgba(100,160,100,0.08)', 'rgba(140,140,100,0.08)', 'rgba(100,100,160,0.08)'];
    for (let l = 0; l < 3; l++) {
      const lane = LANE_WAYPOINTS[l];
      ctx.strokeStyle = laneColors[l];
      ctx.lineWidth = 100;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lane[0].x, lane[0].y);
      for (let i = 1; i < lane.length; i++) {
        ctx.lineTo(lane[i].x, lane[i].y);
      }
      ctx.stroke();
    }
  }

  private renderNexus(ctx: CanvasRenderingContext2D, nexus: MobaNexus) {
    const color = TEAM_COLORS[nexus.team];
    const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.8;

    ctx.save();
    ctx.translate(nexus.x, nexus.y);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillStyle = gradient;
    ctx.fillRect(-60, -60, 120, 120);
    ctx.globalAlpha = 1;

    this.voxel.drawNexusVoxel(ctx, 0, 0, color);

    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, -24, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    this.renderHealthBar(ctx, 0, -50, 50, nexus.hp, nexus.maxHp, color);

    ctx.restore();
  }

  private renderTower(ctx: CanvasRenderingContext2D, tower: MobaTower) {
    const color = TEAM_COLORS[tower.team];

    ctx.save();
    ctx.translate(tower.x, tower.y);

    this.voxel.drawTowerVoxel(ctx, 0, 0, color, tower.tierIndex || 1);

    const pulse = Math.sin(Date.now() * 0.005) * 3;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, -56, 4 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (tower.targetId !== null) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, tower.rng, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    this.renderHealthBar(ctx, 0, -65, 30, tower.hp, tower.maxHp, color);

    ctx.restore();
  }

  private renderMinion(ctx: CanvasRenderingContext2D, minion: MobaMinion) {
    const color = TEAM_COLORS[minion.team];

    ctx.save();
    ctx.translate(minion.x, minion.y);

    const size = minion.minionType === 'siege' ? 10 : 7;
    this.voxel.drawMinionVoxel(ctx, 0, 0, color, size, minion.facing, minion.animTimer, minion.minionType);

    this.renderHealthBar(ctx, 0, -size - 8, 12, minion.hp, minion.maxHp, color);

    ctx.restore();
  }

  renderHero(ctx: CanvasRenderingContext2D, hero: MobaHero, _state: MobaState) {
    const heroData = HEROES[hero.heroDataId];
    if (!heroData) return;

    const raceColor = RACE_COLORS[heroData.race] || '#888';
    const classColor = CLASS_COLORS[heroData.heroClass] || '#888';
    const isPlayer = hero.isPlayer;

    ctx.save();
    ctx.translate(hero.x, hero.y);

    if (isPlayer) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.004) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (hero.buffTimer > 0) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (hero.shieldHp > 0) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (hero.activeEffects && hero.activeEffects.length > 0) {
      for (const eff of hero.activeEffects) {
        const effColor = eff.color || '#fff';
        ctx.strokeStyle = effColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.006) * 0.15;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, heroData.heroClass, hero.facing, hero.animState, hero.animTimer, heroData.race);

    const teamColor = TEAM_COLORS[hero.team];
    ctx.fillStyle = teamColor;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(0, 18, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    this.renderHealthBar(ctx, 0, -28, 24, hero.hp, hero.maxHp, TEAM_COLORS[hero.team]);

    const mpPct = hero.mp / hero.maxMp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-24, -22, 48, 3);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-24, -22, 48 * mpPct, 3);

    if (hero.activeEffects && hero.activeEffects.length > 0) {
      let ox = -hero.activeEffects.length * 5;
      for (const eff of hero.activeEffects) {
        ctx.fillStyle = eff.color || '#fff';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ox, -18, 8, 3);
        ctx.globalAlpha = 1;
        ox += 10;
      }
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv${hero.level}`, 0, -32);

    if (!isPlayer) {
      ctx.font = '8px sans-serif';
      ctx.fillStyle = RARITY_COLORS[heroData.rarity] || '#fff';
      ctx.fillText(heroData.name.split(' ').pop() || '', 0, -40);
    }

    ctx.restore();
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderParticle(ctx: CanvasRenderingContext2D, p: Particle) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = Math.min(1, ft.life * 2);
    ctx.font = `bold ${ft.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, hp: number, maxHp: number, color: string) {
    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - halfWidth, y, halfWidth * 2, 4);
    ctx.fillStyle = pct > 0.5 ? color : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x - halfWidth, y, halfWidth * 2 * pct, 4);
  }

  private renderMinimap(ctx: CanvasRenderingContext2D, state: MobaState, W: number, H: number) {
    const mw = 180, mh = 180;
    const mx = W - mw - 10, my = H - mh - 10;
    const scale = mw / MAP_SIZE;

    ctx.fillStyle = 'rgba(10,15,10,0.85)';
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 2;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);

    for (const lane of LANE_WAYPOINTS) {
      ctx.strokeStyle = 'rgba(100,100,100,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx + lane[0].x * scale, my + lane[0].y * scale);
      for (let i = 1; i < lane.length; i++) {
        ctx.lineTo(mx + lane[i].x * scale, my + lane[i].y * scale);
      }
      ctx.stroke();
    }

    for (const tower of state.towers) {
      if (tower.dead) continue;
      ctx.fillStyle = TEAM_COLORS[tower.team];
      ctx.fillRect(mx + tower.x * scale - 2, my + tower.y * scale - 2, 4, 4);
    }

    for (const nexus of state.nexuses) {
      if (nexus.dead) continue;
      ctx.fillStyle = TEAM_COLORS[nexus.team];
      ctx.beginPath();
      ctx.arc(mx + nexus.x * scale, my + nexus.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const minion of state.minions) {
      ctx.fillStyle = TEAM_COLORS[minion.team];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(mx + minion.x * scale - 1, my + minion.y * scale - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    for (const hero of state.heroes) {
      if (hero.dead) continue;
      ctx.fillStyle = hero.isPlayer ? '#ffd700' : TEAM_COLORS[hero.team];
      ctx.beginPath();
      ctx.arc(mx + hero.x * scale, my + hero.y * scale, hero.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const player = state.heroes[state.playerHeroIndex];
    if (player) {
      const vw = (W / state.camera.zoom) * scale;
      const vh = (H / state.camera.zoom) * scale;
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mx + (state.camera.x - W / 2 / state.camera.zoom) * scale,
        my + (state.camera.y - H / 2 / state.camera.zoom) * scale,
        vw, vh
      );
    }
  }

  private renderKillFeed(ctx: CanvasRenderingContext2D, state: MobaState, W: number) {
    const feed = state.killFeed.slice(-5);
    for (let i = 0; i < feed.length; i++) {
      const entry = feed[i];
      const alpha = Math.min(1, (8 - (state.gameTime - entry.time)) / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W / 2 - 150, 60 + i * 22, 300, 20);
      ctx.fillStyle = entry.color;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(entry.text, W / 2, 75 + i * 22);
    }
    ctx.globalAlpha = 1;
  }
}

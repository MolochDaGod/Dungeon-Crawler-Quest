import {
  MobaState, MobaHero, MobaMinion, MobaTower, MobaNexus,
  Projectile, Particle, FloatingText, HudState, Camera,
  HeroData, HEROES, ITEMS, LANE_WAYPOINTS,
  MAP_SIZE, TEAM_COLORS, TEAM_NAMES, Vec2, SpellEffect,
  SpellProjectile, AreaDamageZoneState, TargetInfo,
  xpForLevel, heroStatsAtLevel, calcDamage,
  RACE_COLORS, CLASS_COLORS, RARITY_COLORS,
  JungleCamp, JungleMob, getHeroAbilities
} from './types';
import { VoxelRenderer, TerrainType } from './voxel';
import { SpriteEffectSystem, SpriteEffectType } from './sprite-effects';
import {
  StatusEffect, StatusEffectType, updateStatusEffects, applyStatusEffect,
  isStunned, isRooted, isSilenced, getSpeedMultiplier,
  hasLifesteal, getAbilityStatusEffects, createStatusEffect,
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

const TERRAIN_LOOKUP: TerrainType[] = ['grass', 'dirt', 'stone', 'water', 'lane', 'jungle', 'base_blue', 'base_red', 'river', 'jungle_path'];

function generateDecorations(): { x: number; y: number; type: string; seed: number }[] {
  const decos: { x: number; y: number; type: string; seed: number }[] = [];

  decos.push({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, type: 'coliseum', seed: 9000 });
  decos.push({ x: BASE_POSITIONS[0].x + 120, y: BASE_POSITIONS[0].y - 80, type: 'barracks', seed: 9001 });
  decos.push({ x: BASE_POSITIONS[0].x + 200, y: BASE_POSITIONS[0].y - 30, type: 'forge', seed: 9002 });
  decos.push({ x: BASE_POSITIONS[1].x - 120, y: BASE_POSITIONS[1].y + 80, type: 'crypt', seed: 9003 });
  decos.push({ x: BASE_POSITIONS[1].x - 200, y: BASE_POSITIONS[1].y + 30, type: 'necropolis_walls', seed: 9004 });
  decos.push({ x: 600, y: 600, type: 'arch', seed: 9005 });
  decos.push({ x: 3400, y: 3400, type: 'arch', seed: 9006 });
  decos.push({ x: 1000, y: 3200, type: 'tree_house', seed: 9007 });
  decos.push({ x: 3200, y: 1000, type: 'hellhouse', seed: 9008 });
  decos.push({ x: 1600, y: 2400, type: 'cabin_shed', seed: 9009 });
  decos.push({ x: 2400, y: 1600, type: 'storage_house', seed: 9010 });
  decos.push({ x: MAP_SIZE / 2 - 300, y: MAP_SIZE / 2 + 300, type: 'camp_fire_glb', seed: 9011 });
  decos.push({ x: MAP_SIZE / 2 + 300, y: MAP_SIZE / 2 - 300, type: 'camp_fire_glb', seed: 9012 });

  const jungleStructureTypes = ['gravestone', 'tree_lava', 'camp_fire_glb'];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = 800 + seededRandom(i * 41, i * 53) * 600;
    const x = MAP_SIZE / 2 + Math.cos(angle) * r;
    const y = MAP_SIZE / 2 + Math.sin(angle) * r;
    if (isOnLaneStatic(x, y)) continue;
    const structType = jungleStructureTypes[i % jungleStructureTypes.length];
    decos.push({ x, y, type: structType, seed: 9100 + i });
  }

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
    jungleCamps: [],
    cursorMode: 'default',
    hoveredEntityId: null,
    aKeyHeld: false,
    _ambientTimer: 0,
    spellEffects: [],
    spellProjectiles: [],
    screenShake: 0,
    areaDamageZones: [],
    pendingSpriteEffects: [],
    firstBloodClaimed: false
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
    hero.assignedLane = lane;
    if (idx === 0) state.playerHeroIndex = state.heroes.length;
    state.heroes.push(hero);
  });

  team1Heroes.forEach((hid, _idx) => {
    const hd = HEROES.find(h => h.id === hid)!;
    const lane = laneAssign[_idx] ?? 1;
    const spawn = laneSpawn(lane, 1);
    const hero = createHero(state, hd, 1, spawn.x, spawn.y, false);
    hero.assignedLane = lane;
    state.heroes.push(hero);
  });

  TOWER_POSITIONS.forEach(tp => {
    state.towers.push(createTower(state, tp.x, tp.y, tp.team, tp.lane, tp.tier));
  });

  state.nexuses.push({ id: state.nextEntityId++, x: BASE_POSITIONS[0].x, y: BASE_POSITIONS[0].y, team: 0, hp: 3000, maxHp: 3000, dead: false, destroyed: false });
  state.nexuses.push({ id: state.nextEntityId++, x: BASE_POSITIONS[1].x, y: BASE_POSITIONS[1].y, team: 1, hp: 3000, maxHp: 3000, dead: false, destroyed: false });

  createJungleCamps(state);

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
    attackWindup: 0, attackBackswing: 0, pendingAttackTarget: null as any,
    respawnTimer: 0, isPlayer, dead: false,
    stunTimer: 0, buffTimer: 0, shieldHp: 0,
    lastDamagedBy: [],
    activeEffects: [],
    ccImmunityTimers: new Map(),
    dodgeCooldown: 0, dodgeTimer: 0, dodgeDir: 0,
    dashAttackCooldown: 0, dashAttackTimer: 0,
    lungeSlashTimer: 0, lungeSlashCooldown: 0,
    comboCount: 0, comboTimer: 0,
    blockActive: false, blockTimer: 0, blockCooldown: 0,
    iFrames: 0,
    assignedLane: 1,
    abilityCharges: initAbilityCharges(hd.race, hd.heroClass),
    abilityChargeTimers: [0, 0, 0, 0],
    abilityLevels: [0, 0, 0, 0],
    abilityPoints: 1,
    aiChatTimer: 5 + Math.random() * 20,
    killStreak: 0
  };
}

function initAbilityCharges(race: string, heroClass: string): number[] {
  const abilities = getHeroAbilities(race, heroClass);
  if (!abilities || abilities.length === 0) return [0, 0, 0, 0];
  return abilities.map(ab => ab.maxCharges || 0);
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

const JUNGLE_CAMP_POSITIONS: { x: number; y: number; type: 'small' | 'medium' | 'buff' }[] = [
  { x: 1000, y: 1000, type: 'small' },
  { x: 1500, y: 2500, type: 'medium' },
  { x: 800, y: 2200, type: 'buff' },
  { x: 1800, y: 1200, type: 'small' },
  { x: 3000, y: 3000, type: 'small' },
  { x: 2500, y: 1500, type: 'medium' },
  { x: 3200, y: 1800, type: 'buff' },
  { x: 2200, y: 2800, type: 'small' },
  { x: 1200, y: 3200, type: 'small' },
  { x: 2800, y: 800, type: 'small' },
];

function createJungleCamps(state: MobaState) {
  for (const pos of JUNGLE_CAMP_POSITIONS) {
    const camp: JungleCamp = {
      id: state.nextEntityId++,
      x: pos.x, y: pos.y,
      mobs: [],
      respawnTimer: 0,
      respawnDelay: 60,
      campType: pos.type,
      allDead: false
    };

    const mobCount = pos.type === 'small' ? 3 : pos.type === 'medium' ? 2 : 1;
    for (let i = 0; i < mobCount; i++) {
      const hp = pos.type === 'small' ? 200 : pos.type === 'medium' ? 500 : 1200;
      const atk = pos.type === 'small' ? 15 : pos.type === 'medium' ? 30 : 60;
      const gold = pos.type === 'small' ? 25 : pos.type === 'medium' ? 60 : 120;
      const xp = pos.type === 'small' ? 30 : pos.type === 'medium' ? 80 : 200;
      const offX = (i - mobCount / 2) * 30;
      const offY = (Math.random() - 0.5) * 20;
      camp.mobs.push({
        id: state.nextEntityId++,
        x: pos.x + offX, y: pos.y + offY,
        hp, maxHp: hp, atk, def: pos.type === 'buff' ? 10 : 3,
        rng: 60, dead: false,
        facing: Math.random() * Math.PI * 2,
        animTimer: Math.random() * 10,
        autoAttackTimer: 0,
        targetId: null,
        goldValue: gold, xpValue: xp,
        mobType: pos.type,
        homeX: pos.x + offX, homeY: pos.y + offY,
        leashRange: 300
      });
    }
    state.jungleCamps.push(camp);
  }
}

function updateJungleCamps(state: MobaState, dt: number) {
  for (const camp of state.jungleCamps) {
    if (camp.allDead) {
      camp.respawnTimer -= dt;
      if (camp.respawnTimer <= 0) {
        camp.allDead = false;
        for (const mob of camp.mobs) {
          mob.dead = false;
          mob.hp = mob.maxHp;
          mob.x = mob.homeX;
          mob.y = mob.homeY;
          mob.targetId = null;
        }
      }
      continue;
    }

    let allDead = true;
    for (const mob of camp.mobs) {
      if (mob.dead) continue;
      allDead = false;
      mob.animTimer += dt;
      mob.autoAttackTimer -= dt;

      if (mob.targetId !== null) {
        const target = findEntityById(state, mob.targetId);
        if (!target || target.dead || dist(mob, target) > mob.leashRange) {
          mob.targetId = null;
          const angle = angleTo(mob, { x: mob.homeX, y: mob.homeY });
          mob.x += Math.cos(angle) * 60 * dt;
          mob.y += Math.sin(angle) * 60 * dt;
          mob.facing = angle;
          mob.hp = Math.min(mob.maxHp, mob.hp + dt * 20);
          continue;
        }
        const d = dist(mob, target);
        mob.facing = angleTo(mob, target);
        if (d <= mob.rng + 20) {
          if ((mob as any).atkWindup > 0) {
            (mob as any).atkWindup -= dt;
            if ((mob as any).atkWindup <= 0) {
              if (!target.dead && dist(mob, target) < mob.rng + 60) {
                dealDamage(state, mob as any, target, mob.atk);
                state.spellEffects.push({
                  x: target.x, y: target.y, type: 'impact_ring',
                  life: 0.15, maxLife: 0.15, radius: 15,
                  color: mob.mobType === 'buff' ? '#a855f7' : '#65a30d', angle: 0
                });
              }
            }
          } else if (mob.autoAttackTimer <= 0) {
            (mob as any).atkWindup = 0.4;
            mob.autoAttackTimer = 1.5;
          }
        } else {
          const angle = angleTo(mob, target);
          mob.x += Math.cos(angle) * 50 * dt;
          mob.y += Math.sin(angle) * 50 * dt;
          mob.facing = angle;
        }
      } else {
        let nearestHero: MobaHero | null = null;
        let nearestDist = 200;
        for (const h of state.heroes) {
          if (h.dead) continue;
          const d = dist(mob, h);
          if (d < nearestDist) { nearestDist = d; nearestHero = h; }
        }
        if (nearestHero) {
          mob.targetId = nearestHero.id;
        } else {
          const homeDist = dist(mob, { x: mob.homeX, y: mob.homeY });
          if (homeDist > 20) {
            const angle = angleTo(mob, { x: mob.homeX, y: mob.homeY });
            mob.x += Math.cos(angle) * 30 * dt;
            mob.y += Math.sin(angle) * 30 * dt;
            mob.facing = angle;
          }
        }
      }

      if (mob.hp <= 0) {
        mob.dead = true;
        let creditHero: MobaHero | null = null;
        if (mob.targetId !== null) {
          const targetEntity = findEntityById(state, mob.targetId);
          if (targetEntity && 'heroDataId' in targetEntity && !(targetEntity as MobaHero).dead) {
            creditHero = targetEntity as MobaHero;
          }
        }
        if (!creditHero) {
          let closestDist = 500;
          for (const h of state.heroes) {
            if (h.dead) continue;
            const d = dist(mob, h);
            if (d < closestDist) {
              closestDist = d;
              creditHero = h;
            }
          }
        }
        if (creditHero) {
          creditHero.gold += mob.goldValue;
          creditHero.xp += mob.xpValue;
          checkLevelUp(state, creditHero);
          addFloatingText(state, mob.x, mob.y - 10, `+${mob.goldValue}g`, '#ffd700', 14);
          addFloatingText(state, mob.x, mob.y - 25, `+${mob.xpValue}xp`, '#a78bfa', 11);
          if (mob.mobType === 'buff' && creditHero.isPlayer) {
            state.killFeed.push({
              text: 'You slew the Jungle Boss!',
              color: '#a855f7',
              time: state.gameTime
            });
          }
        }
        spawnDeathParticles(state, mob.x, mob.y, mob.mobType === 'buff' ? '#a855f7' : '#65a30d');
        if (mob.mobType === 'buff') {
          spawnAbilityParticles(state, mob.x, mob.y, '#a855f7', 25);
          state.screenShake = 0.15;
        }
      }
    }

    if (allDead) {
      camp.allDead = true;
      camp.respawnTimer = camp.respawnDelay;
    }
  }
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
          hp: isSiege ? 300 : 200 + Math.floor(state.gameTime / 60) * 15 + Math.floor(state.gameTime / 300) * 20,
          maxHp: isSiege ? 300 : 200 + Math.floor(state.gameTime / 60) * 15 + Math.floor(state.gameTime / 300) * 20,
          waypointIndex: 0,
          targetId: null,
          atk: isSiege ? 35 : 18 + Math.floor(state.gameTime / 60) * 2 + Math.floor(state.gameTime / 300) * 3,
          def: isSiege ? 10 : 3,
          spd: isSiege ? 60 : 80,
          rng: isSiege ? 250 : 80,
          autoAttackTimer: 0,
          minionType: isSiege ? 'siege' : (i < 3 ? 'melee' : 'ranged'),
          facing: team === 0 ? -Math.PI / 4 : Math.PI * 3 / 4,
          animTimer: Math.random() * 10,
          dead: false,
          goldValue: isSiege ? 40 : 20,
          xpValue: isSiege ? 50 : 25,
          attackWindup: 0,
          attackBackswing: 0,
          pendingTarget: null
        });
      }
    }
  }
}

export function updateGame(state: MobaState, dt: number, keys: Set<string>) {
  if (state.paused || state.gameOver) return;

  (state as any)._frame = ((state as any)._frame || 0) + 1;
  state.gameTime += dt;

  if (state.gameTime >= state.nextMinionWave) {
    spawnMinionWave(state);
    state.nextMinionWave += 30;
  }

  for (const hero of state.heroes) {
    if (!hero.dead) {
      hero.gold += dt * 1;
      hero.xp += dt * 1;
      hero.mp = Math.min(hero.maxMp, hero.mp + dt * (1 + hero.level * 0.3));
      checkLevelUp(state, hero);
    }
  }

  state._ambientTimer += dt;
  if (state._ambientTimer > 0.5) {
    state._ambientTimer = 0;
    const p = state.heroes[state.playerHeroIndex];
    if (p && !p.dead) {
      for (let i = 0; i < 2; i++) {
        state.particles.push({
          x: p.x + (Math.random() - 0.5) * 300,
          y: p.y + (Math.random() - 0.5) * 300,
          vx: (Math.random() - 0.5) * 10,
          vy: -Math.random() * 15 - 5,
          life: 2.0, maxLife: 2.0,
          color: Math.random() > 0.5 ? '#4ade80' : '#fbbf24',
          size: 2, type: 'heal'
        });
      }
    }
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

  updateJungleCamps(state, dt);
  updateProjectiles(state, dt);
  updateSpellProjectiles(state, dt);
  updateAreaDamageZones(state, dt);
  updateParticles(state, dt);
  updateFloatingTexts(state, dt);
  updateSpellEffects(state, dt);

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
  if (hero.attackAnimPhase > 0) hero.attackAnimPhase -= dt;
  if (hero.dodgeCooldown > 0) hero.dodgeCooldown -= dt;
  if (hero.dashAttackCooldown > 0) hero.dashAttackCooldown -= dt;
  if (hero.lungeSlashCooldown > 0) hero.lungeSlashCooldown -= dt;
  if (hero.blockCooldown > 0) hero.blockCooldown -= dt;
  if (hero.iFrames > 0) hero.iFrames -= dt;

  const heroData = HEROES[hero.heroDataId];
  if (heroData) {
    const abilities = getHeroAbilities(heroData.race, heroData.heroClass);
    if (abilities) {
      for (let i = 0; i < abilities.length; i++) {
        const ab = abilities[i];
        if (ab.maxCharges && ab.maxCharges > 0) {
          if (hero.abilityCharges[i] < ab.maxCharges) {
            hero.abilityChargeTimers[i] += dt;
            const rechargeTime = ab.chargeRechargeTime || ab.cooldown;
            if (hero.abilityChargeTimers[i] >= rechargeTime) {
              hero.abilityCharges[i]++;
              hero.abilityChargeTimers[i] = 0;
            }
          }
        }
      }
    }
  }
  if (hero.comboTimer > 0) {
    hero.comboTimer -= dt;
    if (hero.comboTimer <= 0) hero.comboCount = 0;
  }

  if (hero.dodgeTimer > 0) {
    hero.dodgeTimer -= dt;
    const dodgeSpeed = hero.spd * 5;
    hero.vx = Math.cos(hero.dodgeDir) * dodgeSpeed;
    hero.vy = Math.sin(hero.dodgeDir) * dodgeSpeed;
    hero.animState = 'dodge';
    if (hero.dodgeTimer <= 0) {
      hero.vx = 0;
      hero.vy = 0;
      hero.animState = 'idle';
    }
  }

  if (hero.dashAttackTimer > 0) {
    hero.dashAttackTimer -= dt;
    const dashSpeed = hero.spd * 6;
    hero.vx = Math.cos(hero.facing) * dashSpeed;
    hero.vy = Math.sin(hero.facing) * dashSpeed;
    hero.animState = 'dash_attack';
    const enemies = getAllEnemies(state, hero.team);
    for (const e of enemies) {
      if (dist(hero, e) < 60) {
        const dmg = hero.atk * 1.5;
        dealDamage(state, hero, e, dmg);
        spawnSlashEffect(state, e.x, e.y, hero.facing, CLASS_COLORS[HEROES[hero.heroDataId]?.heroClass || 'Warrior'] || '#ef4444');
        hero.dashAttackTimer = 0;
        hero.vx = 0;
        hero.vy = 0;
        hero.animState = 'idle';
        state.screenShake = 0.15;
        break;
      }
    }
    if (hero.dashAttackTimer <= 0) {
      hero.vx = 0;
      hero.vy = 0;
    }
  }

  if (hero.lungeSlashTimer > 0) {
    hero.lungeSlashTimer -= dt;
    const lungeProgress = 1 - (hero.lungeSlashTimer / 0.4);
    hero.animState = 'lunge_slash';

    if (lungeProgress < 0.4) {
      const lungeSpeed = hero.spd * 4.5;
      hero.vx = Math.cos(hero.facing) * lungeSpeed;
      hero.vy = Math.sin(hero.facing) * lungeSpeed;
    } else if (lungeProgress < 0.55) {
      hero.vx *= 0.15;
      hero.vy *= 0.15;

      if (!(hero as any)._lungeHasHit) {
        (hero as any)._lungeHasHit = true;
        const enemies = getAllEnemies(state, hero.team);
        let hitAny = false;
        for (const e of enemies) {
          if (dist(hero, e) < 90) {
            let angleDiff = angleTo(hero, e) - hero.facing;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) < Math.PI * 0.6) {
              const dmg = hero.atk * 1.8;
              dealDamage(state, hero, e, dmg);
              spawnSlashEffect(state, e.x, e.y, hero.facing, CLASS_COLORS[HEROES[hero.heroDataId]?.heroClass || 'Warrior'] || '#ef4444');
              hitAny = true;
            }
          }
        }
        if (hitAny) {
          state.screenShake = 0.12;
        }
      }
    } else {
      hero.vx *= 0.3;
      hero.vy *= 0.3;
    }

    if (hero.lungeSlashTimer <= 0) {
      hero.vx = 0;
      hero.vy = 0;
      hero.animState = 'idle';
      (hero as any)._lungeHasHit = false;
    }
  }

  if (hero.blockActive && hero.blockTimer > 0) {
    hero.blockTimer -= dt;
    if (hero.blockTimer <= 0) {
      hero.blockActive = false;
      hero.animState = 'idle';
    } else {
      hero.animState = 'block';
      hero.vx *= 0.3;
      hero.vy *= 0.3;
    }
  }

  hero.mp = Math.min(hero.maxMp, hero.mp + dt * (2 + hero.level * 0.5));

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

  if (hero.attackWindup > 0) {
    hero.attackWindup -= dt;
    hero.vx = 0;
    hero.vy = 0;
    const target = hero.pendingAttackTarget ? findEntityById(state, hero.pendingAttackTarget) : null;
    if (target && !target.dead) {
      hero.facing = angleTo(hero, target);
    }
    hero.animState = 'attack';

    if (hero.attackWindup <= 0) {
      const connectRange = isMeleeClass(HEROES[hero.heroDataId]?.heroClass || '') ? hero.rng + 60 : hero.rng + 80;
      if (target && !target.dead && dist(hero, target) < connectRange) {
        hero.comboCount = (hero.comboCount + 1);
        hero.comboTimer = 2.0;
        const comboMult = hero.comboCount >= 3 ? 1.5 : 1.0;
        performAutoAttack(state, hero, target, comboMult);
        const heroData = HEROES[hero.heroDataId];
        if (heroData && (heroData.heroClass === 'Warrior' || heroData.heroClass === 'Worg') && dist(hero, target) < 100) {
          const slashColor = CLASS_COLORS[heroData.heroClass] || '#ef4444';
          state.spellEffects.push({
            x: hero.x + Math.cos(hero.facing) * 25, y: hero.y + Math.sin(hero.facing) * 25,
            type: 'slash_arc', life: 0.2, maxLife: 0.2, radius: 25, color: slashColor, angle: hero.facing
          });
          state.pendingSpriteEffects.push({ type: 'melee_impact', x: target.x, y: target.y, scale: 0.6, duration: 400 });
        }
        if (heroData && heroData.heroClass === 'Mage') {
          state.pendingSpriteEffects.push({ type: 'mage_attack', x: target.x, y: target.y, scale: 0.7, duration: 500 });
        }
        if (heroData && heroData.heroClass === 'Ranger') {
          state.pendingSpriteEffects.push({ type: 'fire_attack', x: target.x, y: target.y, scale: 0.5, duration: 350 });
        }
        if (hero.comboCount >= 3) {
          hero.animState = 'combo_finisher';
          hero.animTimer = 0;
          spawnSlashEffect(state, target.x, target.y, hero.facing, '#ffd700');
          state.screenShake = 0.15;
          state.spellEffects.push({
            x: target.x, y: target.y, type: 'combo_burst',
            life: 0.4, maxLife: 0.4, radius: 50, color: '#ffd700', angle: 0
          });
          state.pendingSpriteEffects.push({ type: 'ultimate', x: target.x, y: target.y, scale: 1.0, duration: 700 });
          addFloatingText(state, target.x, target.y - 35, `COMBO x${hero.comboCount}!`, '#ffd700', 16);
          hero.comboCount = 0;
        }
      }
      hero.attackBackswing = 0.3;
      hero.pendingAttackTarget = null;
    }
  } else if (hero.attackBackswing > 0) {
    hero.attackBackswing -= dt;
    hero.vx *= 0.1;
    hero.vy *= 0.1;
    if (hero.attackBackswing <= 0) {
      if (hero.animState === 'attack' || hero.animState === 'combo_finisher') {
        hero.animState = 'idle';
        hero.animTimer = 0;
      }
    }
  }

  if (!hero.isPlayer) {
    runHeroAI(state, hero, dt);
  }

  hero.x += hero.vx * dt;
  hero.y += hero.vy * dt;
  hero.x = Math.max(50, Math.min(MAP_SIZE - 50, hero.x));
  hero.y = Math.max(50, Math.min(MAP_SIZE - 50, hero.y));

  if (hero.attackWindup <= 0 && hero.attackBackswing <= 0 && hero.targetId !== null) {
    const target = findEntityById(state, hero.targetId);
    if (!target || target.dead) {
      hero.targetId = null;
    } else if (!hasLineOfSight(state, hero, target, hero.team)) {
      const angle = angleTo(hero, target);
      const spdMult = getSpeedMultiplier(hero as any as CombatEntity);
      const speed = hero.spd * 1.8 * spdMult;
      hero.vx = Math.cos(angle) * speed;
      hero.vy = Math.sin(angle) * speed;
      hero.facing = angle;
      hero.animState = 'walk';
    } else {
      const d = dist(hero, target);
      if (d <= hero.rng + 30) {
        hero.facing = angleTo(hero, target);
        if (hero.autoAttackTimer <= 0) {
          const heroData = HEROES[hero.heroDataId];
          const isMelee = heroData ? isMeleeClass(heroData.heroClass) : false;
          const windupTime = isMelee ? 0.28 : 0.20;
          hero.attackWindup = windupTime;
          hero.pendingAttackTarget = target.id;
          hero.animState = 'attack';
          hero.animTimer = 0;
          hero.attackAnimPhase = windupTime + 0.3;
          hero.autoAttackTimer = Math.max(0.8, 2.2 - hero.spd * 0.008);
        }
        hero.vx = 0;
        hero.vy = 0;
      } else {
        const angle = angleTo(hero, target);
        const spdMult = getSpeedMultiplier(hero as any as CombatEntity);
        const speed = hero.spd * 1.8 * spdMult;
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

function evaluateThreat(state: MobaState, hero: MobaHero): number {
  let threat = 0;
  for (const h of state.heroes) {
    if (h.team === hero.team || h.dead) continue;
    const d = dist(hero, h);
    if (d < 400) threat += (400 - d) / 400 * (h.atk / 20);
    if (d < 200) threat += 2;
  }
  for (const t of state.towers) {
    if (t.team === hero.team || t.dead) continue;
    if (dist(hero, t) < t.rng + 50) threat += 3;
  }
  return threat;
}

function countAlliesNearby(state: MobaState, hero: MobaHero, range: number): number {
  let count = 0;
  for (const h of state.heroes) {
    if (h.team !== hero.team || h.dead || h.id === hero.id) continue;
    if (dist(hero, h) < range) count++;
  }
  for (const m of state.minions) {
    if (m.team !== hero.team || m.dead) continue;
    if (dist(hero, m) < range) count++;
  }
  return count;
}

function countEnemiesNearby(state: MobaState, hero: MobaHero, range: number): number {
  let count = 0;
  for (const h of state.heroes) {
    if (h.team === hero.team || h.dead) continue;
    if (dist(hero, h) < range) count++;
  }
  return count;
}

function findBestAbilityTarget(state: MobaState, hero: MobaHero, ability: any, abilityIndex: number): any {
  if (ability.type === 'heal' || ability.type === 'buff') {
    let weakestAlly: any = null;
    let lowestHpPct = 1;
    for (const h of state.heroes) {
      if (h.team !== hero.team || h.dead || h.id === hero.id) continue;
      const hpPct = h.hp / h.maxHp;
      if (hpPct < lowestHpPct && dist(hero, h) < ability.range) {
        lowestHpPct = hpPct;
        weakestAlly = h;
      }
    }
    if (weakestAlly && lowestHpPct < 0.6) return weakestAlly;
    if (hero.hp / hero.maxHp < 0.5) return hero;
    return null;
  }

  if (ability.type === 'aoe') {
    let bestPos: any = null;
    let bestCount = 0;
    const enemies = getAllEnemies(state, hero.team);
    for (const e of enemies) {
      if (dist(hero, e) > ability.range + 50) continue;
      let count = 0;
      for (const e2 of enemies) {
        if (dist(e, e2) < (ability.radius || 100)) count++;
      }
      if (count > bestCount) { bestCount = count; bestPos = e; }
    }
    return bestCount >= 2 ? bestPos : findNearestEnemy(state, hero, ability.range);
  }

  if (ability.type === 'damage' || ability.type === 'debuff') {
    let best: any = null;
    let bestScore = -1;
    const enemies = getAllEnemies(state, hero.team);
    for (const e of enemies) {
      if (dist(hero, e) > ability.range + 50) continue;
      let score = 0;
      if ('heroDataId' in e) score += 5;
      if (e.hp < ability.damage + hero.atk * 0.8) score += 10;
      const hpPct = e.hp / (e.maxHp || 1000);
      score += (1 - hpPct) * 3;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  return findNearestEnemy(state, hero, ability.range + 50);
}

function getGamePhase(gameTime: number): 'laning' | 'midgame' | 'lategame' {
  if (gameTime < 600) return 'laning';
  if (gameTime < 1500) return 'midgame';
  return 'lategame';
}

function countAlliedMinionsNearby(state: MobaState, hero: MobaHero, range: number): number {
  let count = 0;
  for (const m of state.minions) {
    if (m.team !== hero.team || m.dead) continue;
    if (dist(hero, m) < range) count++;
  }
  return count;
}

function countAlliedHeroesNearby(state: MobaState, hero: MobaHero, range: number): number {
  let count = 0;
  for (const h of state.heroes) {
    if (h.team !== hero.team || h.dead || h.id === hero.id) continue;
    if (dist(hero, h) < range) count++;
  }
  return count;
}

function isNearEnemyTower(state: MobaState, entity: { x: number; y: number; team: number }): boolean {
  for (const t of state.towers) {
    if (t.team === entity.team || t.dead) continue;
    if (dist(entity, t) < t.rng + 80) return true;
  }
  return false;
}

function hasAlliedMinionAhead(state: MobaState, hero: MobaHero, target: { x: number; y: number }): boolean {
  const heroDistToTarget = dist(hero, target);
  for (const m of state.minions) {
    if (m.team !== hero.team || m.dead) continue;
    const minionDistToTarget = dist(m, target);
    if (minionDistToTarget < heroDistToTarget && dist(hero, m) < 400) return true;
  }
  return false;
}

function getFocusFireTarget(state: MobaState, hero: MobaHero): MobaHero | null {
  for (const ally of state.heroes) {
    if (ally.team !== hero.team || ally.dead || ally.id === hero.id) continue;
    if (ally.targetId !== null) {
      const allyTarget = findEntityById(state, ally.targetId);
      if (allyTarget && !allyTarget.dead && 'heroDataId' in allyTarget && allyTarget.team !== hero.team) {
        if (dist(hero, allyTarget) < 600) return allyTarget as MobaHero;
      }
    }
  }
  return null;
}

function aiLevelUpAbilities(state: MobaState, hero: MobaHero, heroData: HeroData) {
  if (hero.abilityPoints <= 0) return;

  const priorityMap: Record<string, number[]> = {
    Warrior: [3, 0, 1, 2],
    Mage: [3, 0, 2, 1],
    Ranger: [3, 0, 1, 2],
    Worg: [3, 1, 0, 2]
  };
  const priority = priorityMap[heroData.heroClass] || [3, 0, 1, 2];

  while (hero.abilityPoints > 0) {
    let leveled = false;
    for (const idx of priority) {
      const maxLevel = idx === 3 ? 3 : 4;
      if (hero.abilityLevels[idx] >= maxLevel) continue;

      if (idx === 3) {
        const requiredHeroLevels = [6, 11, 16];
        const currentAbLevel = hero.abilityLevels[idx];
        if (currentAbLevel >= requiredHeroLevels.length) continue;
        if (hero.level < requiredHeroLevels[currentAbLevel]) continue;
      }

      hero.abilityLevels[idx]++;
      hero.abilityPoints--;
      leveled = true;
      break;
    }
    if (!leveled) break;
  }
}

function runHeroAI(state: MobaState, hero: MobaHero, dt: number) {
  const heroData = HEROES[hero.heroDataId];
  if (!heroData) return;

  const hpPct = hero.hp / hero.maxHp;
  const mpPct = hero.mp / hero.maxMp;
  const threat = evaluateThreat(state, hero);
  const alliesNearby = countAlliesNearby(state, hero, 400);
  const base = BASE_POSITIONS[hero.team];
  const baseDist = dist(hero, base);
  const phase = getGamePhase(state.gameTime);
  const isRanged = heroData.heroClass === 'Ranger' || heroData.heroClass === 'Mage';
  const alliedHeroesNearby = countAlliedHeroesNearby(state, hero, 600);
  const enemiesNearby = countEnemiesNearby(state, hero, 500);

  aiLevelUpAbilities(state, hero, heroData);

  const retreatThreshold = alliesNearby >= 2 ? 0.15 : (alliesNearby >= 1 ? 0.25 : 0.35);

  if (hpPct < retreatThreshold || (hpPct < 0.4 && threat > 3 && alliesNearby === 0)) {
    hero.moveTarget = { x: base.x, y: base.y };
    hero.targetId = null;
    const angle = angleTo(hero, base);
    hero.vx = Math.cos(angle) * hero.spd * 2.0;
    hero.vy = Math.sin(angle) * hero.spd * 2.0;
    hero.facing = angle;
    hero.animState = 'walk';

    if (baseDist < 200) {
      hero.hp = Math.min(hero.maxHp, hero.hp + dt * 20);
      hero.mp = Math.min(hero.maxMp, hero.mp + dt * 10);
    }

    if (hpPct < 0.15 && hero.abilityCooldowns.length > 0) {
      const abilities = getHeroAbilities(heroData.race, heroData.heroClass);
      if (abilities) {
        for (let i = 0; i < abilities.length; i++) {
          if (hero.abilityCooldowns[i] <= 0 && abilities[i].type === 'dash' && hero.mp >= abilities[i].manaCost) {
            const awayAngle = angleTo(hero, base);
            hero.x += Math.cos(awayAngle) * 100;
            hero.y += Math.sin(awayAngle) * 100;
            hero.abilityCooldowns[i] = abilities[i].cooldown;
            hero.mp -= abilities[i].manaCost;
            break;
          }
        }
      }
    }
    return;
  }

  if (baseDist < 250 && hpPct < 0.8) {
    hero.hp = Math.min(hero.maxHp, hero.hp + dt * 15);
    hero.mp = Math.min(hero.maxMp, hero.mp + dt * 8);
    if (hpPct < 0.6) return;
  }

  const abilities = getHeroAbilities(heroData.race, heroData.heroClass);
  if (abilities) {
    const isWarriorClass = heroData.heroClass === 'Warrior' || heroData.heroClass === 'Worg';
    const isMage = heroData.heroClass === 'Mage';

    let bestAbility = -1;
    let bestAbilityScore = 0;
    let bestAbilityTarget: any = null;

    for (let i = 0; i < abilities.length; i++) {
      const ab = abilities[i];
      if (ab.maxCharges && ab.maxCharges > 0) {
        if (hero.abilityCharges[i] <= 0 || hero.mp < ab.manaCost) continue;
      } else {
        if (hero.abilityCooldowns[i] > 0 || hero.mp < ab.manaCost) continue;
      }

      if (hero.abilityLevels[i] <= 0) continue;

      const target = findBestAbilityTarget(state, hero, ab, i);
      if (!target) continue;

      let score = ab.damage * 0.5;
      if (ab.type === 'aoe') score *= 1.5;
      if (ab.type === 'damage' && 'heroDataId' in target && target.hp < ab.damage + hero.atk * 0.8) score += 20;
      if (ab.type === 'heal' && target.hp / target.maxHp < 0.4) score += 15;

      const isCC = ab.name === 'Shield Bash' || ab.name === 'Frost Nova' || ab.name === 'Howl' || ab.name === 'Trap';
      if (isCC) score += 12;

      if (i === 3) {
        if (phase === 'lategame' && ab.type === 'aoe' && enemiesNearby >= 2) {
          score *= 3.0;
        } else if (enemiesNearby >= 2 || ('heroDataId' in target && target.hp < ab.damage + hero.atk)) {
          score *= 2.0;
        } else {
          score = 0;
        }
      }

      if (phase === 'laning') {
        if (i === 3) score *= 0.5;
        if ('heroDataId' in target) score *= 0.7;
      }
      if (phase === 'midgame' && i === 3 && hero.abilityCooldowns[3] <= 0) {
        score *= 1.5;
      }

      if (isMage && mpPct < 0.3 && i < 3) score *= 0.3;
      if (isWarriorClass && hpPct > 0.8 && ab.type === 'heal') score = 0;

      if (score > bestAbilityScore) {
        bestAbilityScore = score;
        bestAbility = i;
        bestAbilityTarget = target;
      }
    }

    if (bestAbility >= 0 && bestAbilityTarget) {
      executeAbility(state, hero, bestAbility, bestAbilityTarget);
    }
  }

  if (hero.targetId === null) {
    const aggroRange = isRooted(hero as any as CombatEntity) ? 200 : 500;
    let bestTarget: any = null;
    let bestScore = -1;

    if (phase === 'laning') {
      let lastHitTarget: any = null;
      let lastHitScore = -1;
      for (const m of state.minions) {
        if (m.team === hero.team || m.dead) continue;
        const d = dist(hero, m);
        if (d > 350) continue;
        if (m.hp <= hero.atk * 1.2 + 5) {
          const sc = 30 + (350 - d) / 350 * 5;
          if (sc > lastHitScore) { lastHitScore = sc; lastHitTarget = m; }
        }
      }
      if (lastHitTarget) {
        bestTarget = lastHitTarget;
        bestScore = lastHitScore;
      }

      if (!bestTarget) {
        for (const h of state.heroes) {
          if (h.team === hero.team || h.dead) continue;
          const d = dist(hero, h);
          if (d > aggroRange) continue;
          if (!hasLineOfSight(state, hero, h, hero.team)) continue;
          if (alliesNearby >= enemiesNearby && hpPct > 0.5) {
            let score = (aggroRange - d) / aggroRange * 3;
            score += (1 - h.hp / h.maxHp) * 5;
            if (h.hp < hero.atk * 2) score += 10;
            if (score > bestScore) { bestScore = score; bestTarget = h; }
          }
        }
      }

      if (!bestTarget) {
        const ownTower = state.towers.find(t => t.team === hero.team && !t.dead && t.lane === hero.assignedLane);
        const nearOwnMinions = countAlliedMinionsNearby(state, hero, 300);
        if (nearOwnMinions > 0 || (ownTower && dist(hero, ownTower) < 400)) {
          hero.vx *= 0.3;
          hero.vy *= 0.3;
          hero.animState = 'idle';
        }
      }
    } else {
      const focusTarget = getFocusFireTarget(state, hero);

      for (const h of state.heroes) {
        if (h.team === hero.team || h.dead) continue;
        const d = dist(hero, h);
        if (d > aggroRange) continue;
        if (!hasLineOfSight(state, hero, h, hero.team)) continue;
        let score = (aggroRange - d) / aggroRange * 5;
        score += (1 - h.hp / h.maxHp) * 8;

        if (h.hp < hero.atk * 2) score += 20;

        const targetData = HEROES[h.heroDataId];
        if (targetData) {
          if (targetData.heroClass === 'Mage' || targetData.heroClass === 'Ranger') score += 5;
        }

        if (focusTarget && h.id === focusTarget.id) score += 10;

        if (isNearEnemyTower(state, hero) && !hasAlliedMinionAhead(state, hero, h)) {
          score -= 25;
        }

        if (score > bestScore) { bestScore = score; bestTarget = h; }
      }

      if (!bestTarget) {
        let lastHitTarget: any = null;
        let lastHitScore = -1;
        for (const m of state.minions) {
          if (m.team === hero.team || m.dead) continue;
          const d = dist(hero, m);
          if (d > 350) continue;
          if (m.hp <= hero.atk * 1.2 + 5) {
            const sc = 20 + (350 - d) / 350 * 5;
            if (sc > lastHitScore) { lastHitScore = sc; lastHitTarget = m; }
          }
        }
        if (lastHitTarget) {
          bestTarget = lastHitTarget;
          bestScore = lastHitScore;
        } else {
          for (const m of state.minions) {
            if (m.team === hero.team || m.dead) continue;
            const d = dist(hero, m);
            if (d > 350) continue;
            let score = (350 - d) / 350 * 2;
            if (score > bestScore) { bestScore = score; bestTarget = m; }
          }
        }
      }
    }

    if (!bestTarget) {
      const minAlliesForTower = phase === 'lategame' ? 3 : 2;
      for (const t of state.towers) {
        if (t.team === hero.team || t.dead) continue;
        const d = dist(hero, t);
        if (d > 400) continue;
        if (alliedHeroesNearby < minAlliesForTower - 1) continue;
        if (!hasAlliedMinionAhead(state, hero, t)) continue;
        bestTarget = t;
      }
    }

    if (!bestTarget && phase === 'midgame') {
      if (hero.abilityCooldowns[3] <= 0 && hero.abilityLevels[3] > 0) {
        const otherLanes = [0, 1, 2].filter(l => l !== hero.assignedLane);
        const gankLane = otherLanes[Math.floor(seededRandom(hero.id, Math.floor(state.gameTime / 30)) * otherLanes.length)];
        const waypoints = hero.team === 0 ? LANE_WAYPOINTS[gankLane] : [...LANE_WAYPOINTS[gankLane]].reverse();
        const midPoint = waypoints[Math.floor(waypoints.length / 2)];
        const angle = angleTo(hero, midPoint);
        hero.vx = Math.cos(angle) * hero.spd * 1.6;
        hero.vy = Math.sin(angle) * hero.spd * 1.6;
        hero.facing = angle;
        hero.animState = 'walk';
        bestTarget = null;
      }

      if (!bestTarget) {
        const wavesPushed = !state.minions.some(m => m.team !== hero.team && !m.dead && m.lane === hero.assignedLane && dist(hero, m) < 600);
        if (wavesPushed) {
          let nearestCamp: JungleCamp | null = null;
          let nearestCampDist = 800;
          for (const camp of state.jungleCamps) {
            if (camp.allDead) continue;
            const d = dist(hero, camp);
            if (d < nearestCampDist) { nearestCampDist = d; nearestCamp = camp; }
          }
          if (nearestCamp) {
            const angle = angleTo(hero, nearestCamp);
            hero.vx = Math.cos(angle) * hero.spd * 1.5;
            hero.vy = Math.sin(angle) * hero.spd * 1.5;
            hero.facing = angle;
            hero.animState = 'walk';
            const nearestMob = nearestCamp.mobs.find(m => !m.dead);
            if (nearestMob && dist(hero, nearestMob) < 200) {
              bestTarget = nearestMob;
            }
          }
        }
      }
    }

    if (!bestTarget && phase === 'lategame') {
      if (alliedHeroesNearby < 3) {
        let closestAlly: MobaHero | null = null;
        let closestAllyDist = 1500;
        for (const h of state.heroes) {
          if (h.team !== hero.team || h.dead || h.id === hero.id) continue;
          const d = dist(hero, h);
          if (d < closestAllyDist) { closestAllyDist = d; closestAlly = h; }
        }
        if (closestAlly && closestAllyDist > 300) {
          const angle = angleTo(hero, closestAlly);
          hero.vx = Math.cos(angle) * hero.spd * 1.6;
          hero.vy = Math.sin(angle) * hero.spd * 1.6;
          hero.facing = angle;
          hero.animState = 'walk';
        }
      }
    }

    if (bestTarget) {
      hero.targetId = bestTarget.id;
    } else if (hero.vx === 0 && hero.vy === 0) {
      const lane = hero.assignedLane;
      const waypoints = hero.team === 0 ? LANE_WAYPOINTS[lane] : [...LANE_WAYPOINTS[lane]].reverse();

      let nearestWpIdx = 0;
      let minWpDist = Infinity;
      for (let i = 0; i < waypoints.length; i++) {
        const d = dist(hero, waypoints[i]);
        if (d < minWpDist) { minWpDist = d; nearestWpIdx = i; }
      }

      const targetWpIdx = Math.min(nearestWpIdx + 1, waypoints.length - 1);
      const wp = waypoints[targetWpIdx];

      if (phase === 'laning') {
        const nearOwnMinions = countAlliedMinionsNearby(state, hero, 400);
        if (nearOwnMinions === 0) {
          const angle = angleTo(hero, wp);
          hero.vx = Math.cos(angle) * hero.spd * 1.2;
          hero.vy = Math.sin(angle) * hero.spd * 1.2;
          hero.facing = angle;
          hero.animState = 'walk';
        }
      } else {
        const angle = angleTo(hero, wp);
        hero.vx = Math.cos(angle) * hero.spd * 1.5;
        hero.vy = Math.sin(angle) * hero.spd * 1.5;
        hero.facing = angle;
        hero.animState = 'walk';
      }
    }
  }

  if (hero.targetId !== null && hero.targetId !== undefined) {
    const target = findEntityById(state, hero.targetId);
    if (target && !target.dead) {
      const d = dist(hero, target);

      if (isRanged && d < hero.rng * 0.5) {
        if ((hero as any)._orbWalkTimer === undefined) (hero as any)._orbWalkTimer = 0;
        (hero as any)._orbWalkTimer += dt;

        if (hero.autoAttackTimer > 0.3) {
          const enemyAngle = angleTo(target, hero);
          const perpAngle = enemyAngle + (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
          const strafeWeight = 0.6;
          const finalAngle = enemyAngle * (1 - strafeWeight) + perpAngle * strafeWeight;
          hero.vx = Math.cos(finalAngle) * hero.spd * 1.6;
          hero.vy = Math.sin(finalAngle) * hero.spd * 1.6;
          hero.facing = angleTo(hero, target);
          hero.animState = 'walk';
        } else {
          hero.vx = 0;
          hero.vy = 0;
          hero.facing = angleTo(hero, target);
        }
      } else if (isRanged && d < hero.rng * 0.4 && threat > 1) {
        const awayAngle = angleTo(target, hero);
        hero.vx = Math.cos(awayAngle) * hero.spd * 1.5;
        hero.vy = Math.sin(awayAngle) * hero.spd * 1.5;
        hero.facing = angleTo(hero, target);
        hero.animState = 'walk';
      }

      if (isNearEnemyTower(state, hero) && 'heroDataId' in target) {
        if (!hasAlliedMinionAhead(state, hero, target)) {
          hero.targetId = null;
          const angle = angleTo(target, hero);
          hero.vx = Math.cos(angle) * hero.spd * 1.8;
          hero.vy = Math.sin(angle) * hero.spd * 1.8;
          hero.facing = angle;
          hero.animState = 'walk';
        }
      }
    }
  }

  const ownedCount = hero.items.filter(s => s !== null).length;
  const bestTier = ownedCount < 2 ? 1 : ownedCount < 4 ? 2 : 3;
  const buyThreshold = bestTier === 1 ? 300 : bestTier === 2 ? 750 : 1400;

  if (hero.gold >= buyThreshold) {
    const slot = hero.items.findIndex(s => s === null);
    if (slot !== -1) {
      const sortedItems = [...ITEMS]
        .filter(item => item.cost <= hero.gold && item.tier <= bestTier)
        .sort((a, b) => {
          const scoreItem = (it: typeof a) => {
            let s = it.atk * 2 + it.def + it.hp * 0.1 + it.spd * 3;
            if (heroData.heroClass === 'Warrior' || heroData.heroClass === 'Worg') s += it.def * 2 + it.hp * 0.2;
            if (heroData.heroClass === 'Mage') s += it.atk * 1.5 + it.mp * 0.3;
            if (heroData.heroClass === 'Ranger') s += it.atk * 2 + it.spd * 4;
            if (hpPct < 0.5) s += it.hp * 0.3 + it.def * 1.5;
            return s;
          };
          return scoreItem(b) - scoreItem(a);
        });
      if (sortedItems.length > 0) {
        const item = sortedItems[0];
        hero.items[slot] = item;
        hero.gold -= item.cost;
        applyItemStats(hero, item);
        addAiChat(state, hero, heroData, `bought ${item.name}`);
      }
    }
  }

  if (Math.random() < 0.0012 * dt) {
    const laneName = ['top', 'mid', 'bot'][hero.assignedLane];
    const enemiesNearbyChat = countEnemiesNearby(state, hero, 500);
    const contextMsgs: string[] = [];
    if (hpPct < 0.3) contextMsgs.push('going b', 'need heal', 'low hp retreating', 'brb base');
    else if (hpPct < 0.5 && threat > 2) contextMsgs.push('playing safe', 'backing off', 'careful ' + laneName, 'they have kill pressure');
    else if (threat > 3 && alliesNearby === 0) contextMsgs.push('need backup ' + laneName, 'help ' + laneName, 'enemy ganking', 'missing enemy ' + laneName);
    else if (hero.kills > 2 && hero.deaths === 0) contextMsgs.push('lets go', 'feeling strong', 'push ' + laneName, 'I\'m fed lets fight');
    else if (hero.deaths > hero.kills + 2) contextMsgs.push('they are fed', 'play safe team', 'need to farm', 'farming under tower');
    else if (alliesNearby >= 3 && enemiesNearbyChat >= 2) contextMsgs.push('group push', 'all in', 'fight here', 'lets teamfight', 'GO GO GO');
    else if (alliesNearby >= 3) contextMsgs.push('push ' + laneName + ' together', 'group up', 'lets take tower');
    else if (hero.gold > 1500) contextMsgs.push('need to shop', 'saving for item', 'b for items');
    else if (phase === 'lategame' && enemiesNearbyChat === 0) contextMsgs.push('we need to end', 'push for nexus', 'group for final push');
    else if (phase === 'midgame' && hero.level >= 6) contextMsgs.push('roaming ' + laneName, 'gank incoming', 'ult ready lets fight', 'push mid together');
    else if (phase === 'laning') contextMsgs.push('farming ' + laneName, 'cs is good', 'stay safe early', 'scaling');
    else contextMsgs.push('push ' + laneName, 'enemy missing', 'group up', 'care', 'on my way', 'well played', 'focus carry', 'target their mage');
    addAiChat(state, hero, heroData, contextMsgs[Math.floor(Math.random() * contextMsgs.length)]);
  }
}

function addAiChat(state: MobaState, hero: MobaHero, heroData: HeroData, msg: string) {
  if (state.killFeed.length > 8) return;
  const name = heroData.name || `${heroData.race} ${heroData.heroClass}`;
  state.killFeed.push({
    text: `[${TEAM_NAMES[hero.team]}] ${name}: ${msg}`,
    color: hero.team === 0 ? '#60a5fa' : '#f87171',
    time: state.gameTime
  });
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

function findNearestEnemy(state: MobaState, entity: { x: number; y: number; team: number }, range: number, includeJungle: boolean = true): { id: number; x: number; y: number; team: number; dead: boolean; hp: number } | null {
  let nearest: any = null;
  let nearestDist = range;

  for (const h of state.heroes) {
    if (h.team === entity.team || h.dead) continue;
    const d = dist(entity, h);
    if (d < nearestDist && hasLineOfSight(state, entity, h, entity.team)) { nearestDist = d; nearest = h; }
  }
  for (const m of state.minions) {
    if (m.team === entity.team || m.dead) continue;
    const d = dist(entity, m);
    if (d < nearestDist && hasLineOfSight(state, entity, m, entity.team)) { nearestDist = d; nearest = m; }
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
  if (includeJungle) {
    for (const camp of state.jungleCamps) {
      for (const mob of camp.mobs) {
        if (mob.dead) continue;
        const d = dist(entity, mob);
        if (d < nearestDist) { nearestDist = d; nearest = mob; }
      }
    }
  }

  return nearest;
}

let entityIndex: Map<number, any> | null = null;
let entityIndexFrame = -1;

function buildEntityIndex(state: MobaState): Map<number, any> {
  const frame = (state as any)._frame || 0;
  if (entityIndex && entityIndexFrame === frame) return entityIndex;
  const map = new Map<number, any>();
  for (let i = 0, len = state.heroes.length; i < len; i++) map.set(state.heroes[i].id, state.heroes[i]);
  for (let i = 0, len = state.minions.length; i < len; i++) map.set(state.minions[i].id, state.minions[i]);
  for (let i = 0, len = state.towers.length; i < len; i++) map.set(state.towers[i].id, state.towers[i]);
  for (let i = 0, len = state.nexuses.length; i < len; i++) map.set(state.nexuses[i].id, state.nexuses[i]);
  for (let ci = 0, clen = state.jungleCamps.length; ci < clen; ci++) {
    const mobs = state.jungleCamps[ci].mobs;
    for (let mi = 0, mlen = mobs.length; mi < mlen; mi++) map.set(mobs[mi].id, mobs[mi]);
  }
  entityIndex = map;
  entityIndexFrame = frame;
  return map;
}

function findEntityById(state: MobaState, id: number): any {
  return buildEntityIndex(state).get(id) ?? null;
}

function isMeleeClass(heroClass: string): boolean {
  return heroClass === 'Warrior' || heroClass === 'Worg';
}

function performAutoAttack(state: MobaState, attacker: MobaHero | MobaMinion, target: any, comboMult: number = 1.0) {
  const atk = 'atk' in attacker ? attacker.atk : 15;
  const color = attacker.team === 0 ? '#60a5fa' : '#f87171';
  const dmg = Math.floor(atk * comboMult);

  let isMelee = false;
  if ('heroDataId' in attacker) {
    const heroData = HEROES[(attacker as MobaHero).heroDataId];
    isMelee = heroData ? isMeleeClass(heroData.heroClass) : false;
  } else if ('minionType' in attacker) {
    isMelee = (attacker as MobaMinion).minionType === 'melee';
  }

  const meleeRange = 'rng' in attacker ? (attacker as any).rng + 40 : 120;
  if (isMelee && dist(attacker, target) < meleeRange) {
    dealDamage(state, attacker, target, dmg);
    const slashAngle = angleTo(attacker, target);
    state.spellEffects.push({
      x: target.x, y: target.y,
      type: 'slash_arc', life: 0.2, maxLife: 0.2,
      radius: 28, color: comboMult > 1 ? '#ffd700' : color, angle: slashAngle
    });
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      state.particles.push({
        x: target.x + Math.cos(a) * 10,
        y: target.y + Math.sin(a) * 10,
        vx: Math.cos(a) * (40 + Math.random() * 40), vy: Math.sin(a) * (40 + Math.random() * 40) - 20,
        life: 0.3, maxLife: 0.3, color, size: 2 + Math.random(), type: 'hit'
      });
    }
    state.spellEffects.push({
      x: (attacker.x + target.x) / 2, y: (attacker.y + target.y) / 2,
      type: 'impact_ring', life: 0.15, maxLife: 0.15,
      radius: 18, color: comboMult > 1 ? '#ffd700' : color, angle: 0
    });
  } else if (isMelee && dist(attacker, target) < meleeRange + 40) {
    const lungeAngle = angleTo(attacker, target);
    const lungeDist = Math.min(dist(attacker, target) - meleeRange + 20, 40);
    if (lungeDist > 0) {
      attacker.x += Math.cos(lungeAngle) * lungeDist;
      attacker.y += Math.sin(lungeAngle) * lungeDist;
    }
    dealDamage(state, attacker, target, dmg);
    state.spellEffects.push({
      x: target.x, y: target.y,
      type: 'slash_arc', life: 0.2, maxLife: 0.2,
      radius: 25, color: comboMult > 1 ? '#ffd700' : color, angle: lungeAngle
    });
    for (let i = 0; i < 3; i++) {
      state.particles.push({
        x: target.x + (Math.random() - 0.5) * 15,
        y: target.y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50,
        life: 0.25, maxLife: 0.25, color, size: 2, type: 'hit'
      });
    }
  } else {
    state.projectiles.push({
      id: state.nextEntityId++,
      x: attacker.x, y: attacker.y,
      targetId: target.id,
      targetType: 'hero',
      damage: dmg,
      speed: 450,
      team: attacker.team,
      sourceId: attacker.id,
      color: comboMult > 1 ? '#ffd700' : color,
      size: comboMult > 1 ? 6 : 4
    });
  }

  if (comboMult > 1 && 'heroDataId' in attacker) {
    const heroData = HEROES[(attacker as MobaHero).heroDataId];
    const atkColor = CLASS_COLORS[heroData?.heroClass || 'Warrior'] || '#ef4444';
    spawnSlashEffect(state, attacker.x + Math.cos((attacker as MobaHero).facing) * 30, attacker.y + Math.sin((attacker as MobaHero).facing) * 30, (attacker as MobaHero).facing, atkColor);
  }

  if ('heroDataId' in attacker && isMelee) {
    const heroData = HEROES[(attacker as MobaHero).heroDataId];
    const trailColor = CLASS_COLORS[heroData?.heroClass || 'Warrior'] || '#ef4444';
    const facing = (attacker as MobaHero).facing;
    for (let t = 0; t < 4; t++) {
      const d = 10 + t * 8;
      const spread = (Math.random() - 0.5) * 0.6;
      state.particles.push({
        x: attacker.x + Math.cos(facing + spread) * d,
        y: attacker.y + Math.sin(facing + spread) * d,
        vx: Math.cos(facing + spread) * 15,
        vy: Math.sin(facing + spread) * 15,
        life: 0.15 + Math.random() * 0.05, maxLife: 0.2,
        color: trailColor, size: 2 + Math.random(), type: 'slash'
      });
    }
  }
}

export function executeAbility(state: MobaState, hero: MobaHero, abilityIndex: number, target: any) {
  const heroData = HEROES[hero.heroDataId];
  if (!heroData) return;
  const abilities = getHeroAbilities(heroData.race, heroData.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;

  const abRaw = abilities[abilityIndex];
  const abilityLevel = hero.abilityLevels?.[abilityIndex] || 0;
  const levelDamageMultiplier = abilityLevel > 0 ? (1 + (abilityLevel - 1) * 0.25) : 1;
  const ab = { ...abRaw, damage: Math.floor(abRaw.damage * levelDamageMultiplier) };

  if (ab.maxCharges && ab.maxCharges > 0) {
    if (hero.abilityCharges[abilityIndex] <= 0 || hero.mp < ab.manaCost) return;
    hero.abilityCharges[abilityIndex]--;
    if (hero.abilityChargeTimers[abilityIndex] <= 0) {
      hero.abilityChargeTimers[abilityIndex] = 0;
    }
  } else {
    if (hero.abilityCooldowns[abilityIndex] > 0 || hero.mp < ab.manaCost) return;
    hero.abilityCooldowns[abilityIndex] = ab.cooldown;
  }

  hero.mp -= ab.manaCost;
  hero.animState = 'ability';
  hero.animTimer = 0;

  const classEffectMap: Record<string, string> = {
    Warrior: 'warrior_spin', Worg: 'fire_ability', Mage: 'mage_ability', Ranger: 'buff'
  };
  const effectType = classEffectMap[heroData.heroClass] || 'channel';
  state.pendingSpriteEffects.push({ type: effectType, x: hero.x, y: hero.y, scale: 0.8, duration: 600 });

  const abilityColor = CLASS_COLORS[heroData.heroClass] || '#ffffff';
  const statusEffects = getAbilityStatusEffects(ab.name, hero.id, hero.atk);
  const mouseTarget = state.mouseWorld;

  if (ab.name === 'Skull Splitter') {
    if (target) {
      const dmg = ab.damage + hero.atk * 0.9;
      if (dist(hero, target) > hero.rng + 20) {
        const lungeAngle = angleTo(hero, target);
        const lungeDist = Math.min(dist(hero, target) - 30, 60);
        hero.x += Math.cos(lungeAngle) * lungeDist;
        hero.y += Math.sin(lungeAngle) * lungeDist;
      }
      hero.facing = angleTo(hero, target);
      dealDamage(state, hero, target, dmg);
      if (target.activeEffects) {
        for (const eff of statusEffects) applyStatusEffect(target as any as CombatEntity, { ...eff });
      }
      state.spellEffects.push({
        x: target.x, y: target.y, type: 'axe_chop',
        life: 0.35, maxLife: 0.35, radius: 35, color: '#ef4444', angle: hero.facing
      });
      state.spellEffects.push({
        x: target.x, y: target.y, type: 'impact_ring',
        life: 0.25, maxLife: 0.25, radius: 30, color: '#dc2626', angle: 0
      });
      state.screenShake = 0.12;
      spawnAbilityParticles(state, target.x, target.y, '#ef4444', 14);
      spawnCastBurst(state, target.x, target.y, '#dc2626', 10);
    }
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'War Cry') {
    const entities = getAllEnemies(state, hero.team);
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        if (e.activeEffects) {
          for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
        }
      }
    }
    applyStatusEffect(hero as any as CombatEntity, createStatusEffect(StatusEffectType.AtkBuff, ab.duration, hero.id, 30, 0, 0, 1, 'War Cry ATK'));
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'fear_wave',
      life: 0.6, maxLife: 0.6, radius: ab.radius, color: '#65a30d', angle: 0
    });
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'impact_ring',
      life: 0.4, maxLife: 0.4, radius: ab.radius * 0.8, color: '#65a30d', angle: 0
    });
    state.screenShake = 0.1;
    spawnAbilityParticles(state, hero.x, hero.y, '#65a30d', 20);
    spawnCastBurst(state, hero.x, hero.y, '#84cc16', 14);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Cleave') {
    const entities = getAllEnemies(state, hero.team);
    const coneAngle = hero.facing;
    const coneHalfWidth = Math.PI / 3;
    let hitCount = 0;
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        const angleToE = angleTo(hero, e);
        let angleDiff = angleToE - coneAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) < coneHalfWidth) {
          const dmg = ab.damage + hero.atk * 0.7;
          dealDamage(state, hero, e, dmg);
          hitCount++;
          spawnAbilityParticles(state, e.x, e.y, '#ef4444', 6);
        }
      }
    }
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'cleave_arc',
      life: 0.4, maxLife: 0.4, radius: ab.radius, color: '#ef4444', angle: coneAngle,
      data: { halfWidth: coneHalfWidth }
    });
    if (hitCount >= 2) state.screenShake = 0.1;
    spawnCastBurst(state, hero.x, hero.y, '#ef4444', 12);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Blood Fury') {
    for (const eff of statusEffects) applyStatusEffect(hero as any as CombatEntity, eff);
    hero.buffTimer = ab.duration;
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'blood_fury_aura',
      life: 1.0, maxLife: 1.0, radius: 50, color: '#dc2626', angle: 0
    });
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'cast_circle',
      life: 0.5, maxLife: 0.5, radius: 45, color: '#dc2626', angle: 0
    });
    state.screenShake = 0.12;
    spawnAbilityParticles(state, hero.x, hero.y, '#dc2626', 22);
    spawnCastBurst(state, hero.x, hero.y, '#ef4444', 14);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Piercing Strike') {
    if (target) {
      const dmg = ab.damage + hero.atk * 0.85;
      hero.facing = angleTo(hero, target);
      if (dist(hero, target) > hero.rng + 10) {
        const lungeAngle = angleTo(hero, target);
        const lungeDist = Math.min(dist(hero, target) - 30, 70);
        hero.x += Math.cos(lungeAngle) * lungeDist;
        hero.y += Math.sin(lungeAngle) * lungeDist;
      }
      dealDamage(state, hero, target, dmg);
      state.spellEffects.push({
        x: target.x, y: target.y, type: 'spear_thrust',
        life: 0.3, maxLife: 0.3, radius: 25, color: '#22d3ee', angle: hero.facing
      });
      state.spellEffects.push({
        x: target.x, y: target.y, type: 'impact_ring',
        life: 0.2, maxLife: 0.2, radius: 20, color: '#67e8f9', angle: 0
      });
      spawnAbilityParticles(state, target.x, target.y, '#22d3ee', 10);
      spawnCastBurst(state, target.x, target.y, '#67e8f9', 8);
    }
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Wind Walk') {
    const tx = target ? target.x : mouseTarget.x;
    const ty = target ? target.y : mouseTarget.y;
    const angle = Math.atan2(ty - hero.y, tx - hero.x);
    const dashDist = Math.min(ab.range, Math.sqrt((tx - hero.x) ** 2 + (ty - hero.y) ** 2));
    const startX = hero.x, startY = hero.y;
    hero.x += Math.cos(angle) * dashDist;
    hero.y += Math.sin(angle) * dashDist;
    hero.x = Math.max(50, Math.min(MAP_SIZE - 50, hero.x));
    hero.y = Math.max(50, Math.min(MAP_SIZE - 50, hero.y));
    hero.facing = angle;
    hero.iFrames = ab.duration;
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      state.spellEffects.push({
        x: startX + (hero.x - startX) * t, y: startY + (hero.y - startY) * t,
        type: 'dash_trail', life: 0.3, maxLife: 0.3, radius: 6, color: '#22d3ee', angle
      });
    }
    spawnAbilityParticles(state, hero.x, hero.y, '#22d3ee', 12);
    spawnCastBurst(state, hero.x, hero.y, '#67e8f9', 8);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Glaive Sweep') {
    const entities = getAllEnemies(state, hero.team);
    let hitCount = 0;
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        const dmg = ab.damage + hero.atk * 0.65;
        dealDamage(state, hero, e, dmg);
        hitCount++;
        if (e.activeEffects) {
          for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
        }
        spawnAbilityParticles(state, e.x, e.y, '#22d3ee', 4);
      }
    }
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'glaive_sweep',
      life: 0.5, maxLife: 0.5, radius: ab.radius, color: '#22d3ee', angle: hero.facing
    });
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'impact_ring',
      life: 0.35, maxLife: 0.35, radius: ab.radius * 0.7, color: '#67e8f9', angle: 0
    });
    if (hitCount >= 2) state.screenShake = 0.1;
    spawnCastBurst(state, hero.x, hero.y, '#22d3ee', 16);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Dance of Blades') {
    const entities = getAllEnemies(state, hero.team);
    const totalHits = 8;
    const dmgPerHit = (ab.damage + hero.atk * 0.4) / totalHits;
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        const totalDmg = ab.damage + hero.atk * 0.4;
        dealDamage(state, hero, e, totalDmg);
        spawnAbilityParticles(state, e.x, e.y, '#22d3ee', 6);
      }
    }
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'dance_blades',
      life: 1.0, maxLife: 1.0, radius: ab.radius, color: '#22d3ee', angle: 0,
      data: { hits: totalHits }
    });
    for (let i = 0; i < 6; i++) {
      state.spellEffects.push({
        x: hero.x, y: hero.y, type: 'whirlwind_slash',
        life: 0.6, maxLife: 0.6, radius: ab.radius * 0.8,
        color: '#22d3ee', angle: (i / 6) * Math.PI * 2
      });
    }
    state.screenShake = 0.15;
    spawnAbilityParticles(state, hero.x, hero.y, '#22d3ee', 25);
    spawnCastBurst(state, hero.x, hero.y, '#67e8f9', 16);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Fireball') {
    const angle = target ? angleTo(hero, target) : angleTo(hero, mouseTarget);
    spawnSpellProjectile(state, hero, angle, ab, '#ff6600', '#ff3300');
    spawnCastBurst(state, hero.x, hero.y, '#ff6600', 12);
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'cast_circle',
      life: 0.3, maxLife: 0.3, radius: 30, color: '#ff6600', angle: 0
    });
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Power Shot') {
    const angle = target ? angleTo(hero, target) : angleTo(hero, mouseTarget);
    spawnSpellProjectile(state, hero, angle, ab, '#22c55e', '#15803d', true);
    spawnCastBurst(state, hero.x, hero.y, '#22c55e', 10);
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'cast_circle',
      life: 0.25, maxLife: 0.25, radius: 25, color: '#22c55e', angle: 0
    });
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Meteor') {
    const cx = target ? target.x : mouseTarget.x;
    const cy = target ? target.y : mouseTarget.y;
    state.spellEffects.push({
      x: cx, y: cy, type: 'meteor_shadow',
      life: 1.2, maxLife: 1.2, radius: ab.radius, color: '#ff4400', angle: 0,
      data: { damage: ab.damage + hero.atk * 0.6, team: hero.team, sourceId: hero.id }
    });
    state.spellEffects.push({
      x: cx, y: cy, type: 'telegraph_circle',
      life: 1.2, maxLife: 1.2, radius: ab.radius, color: '#ff4400', angle: 0
    });
    spawnCastBurst(state, hero.x, hero.y, '#ff4400', 15);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Frost Nova') {
    const entities = getAllEnemies(state, hero.team);
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        const dmg = ab.damage + hero.atk * 0.6;
        dealDamage(state, hero, e, dmg);
        if (e.activeEffects) {
          for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
        }
        for (let p = 0; p < 6; p++) {
          const a = Math.random() * Math.PI * 2;
          state.particles.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 30,
            life: 0.5, maxLife: 0.5, color: '#67e8f9', size: 3, type: 'ability'
          });
        }
      }
    }
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'frost_ring',
      life: 0.8, maxLife: 0.8, radius: ab.radius, color: '#67e8f9', angle: 0
    });
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'frost_ring',
      life: 0.5, maxLife: 0.5, radius: ab.radius * 0.6, color: '#22d3ee', angle: 0
    });
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'ground_frost',
      life: 3.0, maxLife: 3.0, radius: ab.radius, color: '#22d3ee', angle: 0
    });
    state.screenShake = 0.15;
    spawnCastBurst(state, hero.x, hero.y, '#67e8f9', 20);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Whirlwind' || ab.name === 'Blade Storm') {
    const entities = getAllEnemies(state, hero.team);
    for (const e of entities) {
      if (dist(hero, e) < ab.radius) {
        const dmg = ab.damage + hero.atk * 0.6;
        dealDamage(state, hero, e, dmg);
      }
    }
    for (let i = 0; i < 6; i++) {
      state.spellEffects.push({
        x: hero.x, y: hero.y, type: 'whirlwind_slash',
        life: 0.5, maxLife: 0.5, radius: ab.radius,
        color: '#ef4444', angle: (i / 6) * Math.PI * 2
      });
    }
    state.spellEffects.push({
      x: hero.x, y: hero.y, type: 'impact_ring',
      life: 0.3, maxLife: 0.3, radius: ab.radius * 0.8, color: '#ef4444', angle: 0
    });
    state.screenShake = 0.1;
    spawnCastBurst(state, hero.x, hero.y, '#ef4444', 16);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  if (ab.name === 'Storm of Arrows') {
    const cx = target ? target.x : mouseTarget.x;
    const cy = target ? target.y : mouseTarget.y;
    state.spellEffects.push({
      x: cx, y: cy, type: 'arrow_rain',
      life: ab.duration, maxLife: ab.duration, radius: ab.radius, color: '#22c55e', angle: 0,
      data: { damage: (ab.damage + hero.atk * 0.6) / 6, team: hero.team, sourceId: hero.id, tickTimer: 0 }
    });
    state.spellEffects.push({
      x: cx, y: cy, type: 'telegraph_circle',
      life: 0.5, maxLife: 0.5, radius: ab.radius, color: '#22c55e', angle: 0
    });
    spawnCastBurst(state, hero.x, hero.y, '#22c55e', 12);
    addFloatingText(state, hero.x, hero.y - 30, ab.name, abilityColor, 16);
    return;
  }

  const isMeleeHero = isMeleeClass(heroData.heroClass);

  switch (ab.type) {
    case 'damage': {
      if (target) {
        const dmg = ab.damage + hero.atk * 0.8;
        if (isMeleeHero && dist(hero, target) > hero.rng + 30) {
          const lungeAngle = angleTo(hero, target);
          const lungeDist = Math.min(dist(hero, target) - 40, 80);
          hero.x += Math.cos(lungeAngle) * lungeDist;
          hero.y += Math.sin(lungeAngle) * lungeDist;
          state.spellEffects.push({
            x: hero.x, y: hero.y, type: 'dash_trail',
            life: 0.2, maxLife: 0.2, radius: 8, color: abilityColor, angle: lungeAngle
          });
        }
        dealDamage(state, hero, target, dmg);
        if (isMeleeHero) {
          const slashAngle = angleTo(hero, target);
          state.spellEffects.push({
            x: target.x, y: target.y, type: 'slash_arc',
            life: 0.25, maxLife: 0.25, radius: 30, color: abilityColor, angle: slashAngle
          });
          state.spellEffects.push({
            x: target.x, y: target.y, type: 'impact_ring',
            life: 0.2, maxLife: 0.2, radius: 22, color: '#ffffff', angle: 0
          });
          state.screenShake = 0.06;
        }
        spawnAbilityParticles(state, target.x, target.y, abilityColor, isMeleeHero ? 12 : 8);
        spawnCastBurst(state, target.x, target.y, abilityColor, 8);
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
      let hitCount = 0;
      for (const e of entities) {
        if (dist({ x: cx, y: cy }, e) < ab.radius) {
          const dmg = ab.damage + hero.atk * 0.6;
          dealDamage(state, hero, e, dmg);
          hitCount++;
          if (e.activeEffects) {
            for (const eff of statusEffects) applyStatusEffect(e as any as CombatEntity, { ...eff });
          }
        }
      }
      spawnAbilityParticles(state, cx, cy, abilityColor, 25);
      spawnCastBurst(state, cx, cy, abilityColor, 14);
      state.spellEffects.push({
        x: cx, y: cy, type: 'impact_ring',
        life: 0.4, maxLife: 0.4, radius: ab.radius, color: abilityColor, angle: 0
      });
      state.spellEffects.push({
        x: cx, y: cy, type: 'ground_scorch',
        life: 1.5, maxLife: 1.5, radius: ab.radius * 0.5, color: abilityColor, angle: 0
      });
      if (hitCount >= 2) state.screenShake = 0.12;
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
        state.screenShake = 0.15;
      }
      spawnAbilityParticles(state, hero.x, hero.y, '#ffd700', 20);
      spawnCastBurst(state, hero.x, hero.y, '#ffd700', 12);
      state.spellEffects.push({
        x: hero.x, y: hero.y, type: 'cast_circle',
        life: 0.4, maxLife: 0.4, radius: 40, color: '#ffd700', angle: 0
      });
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
      spawnAbilityParticles(state, hero.x, hero.y, '#06b6d4', 16);
      spawnCastBurst(state, hero.x, hero.y, '#06b6d4', 10);
      state.spellEffects.push({
        x: hero.x, y: hero.y, type: 'impact_ring',
        life: 0.35, maxLife: 0.35, radius: ab.radius * 0.7, color: '#06b6d4', angle: 0
      });
      break;
    }
    case 'heal': {
      const healAmt = 80 + hero.def * 3;
      hero.hp = Math.min(hero.maxHp, hero.hp + healAmt);
      hero.shieldHp = 100 + hero.def * 2;
      addFloatingText(state, hero.x, hero.y - 35, `+${healAmt}`, '#22c55e', 16);
      for (const eff of statusEffects) applyStatusEffect(hero as any as CombatEntity, eff);
      spawnAbilityParticles(state, hero.x, hero.y, '#22c55e', 18);
      spawnCastBurst(state, hero.x, hero.y, '#22c55e', 10);
      state.spellEffects.push({
        x: hero.x, y: hero.y, type: 'cast_circle',
        life: 0.5, maxLife: 0.5, radius: 35, color: '#22c55e', angle: 0
      });
      for (let i = 0; i < 6; i++) {
        state.particles.push({
          x: hero.x + (Math.random() - 0.5) * 30, y: hero.y,
          vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 40,
          life: 0.8, maxLife: 0.8, color: '#4ade80', size: 2, type: 'ability'
        });
      }
      break;
    }
    case 'dash': {
      if (target) {
        const angle = angleTo(hero, target);
        const dashDist = Math.min(ab.range, dist(hero, target));
        hero.x += Math.cos(angle) * dashDist;
        hero.y += Math.sin(angle) * dashDist;
        if (ab.damage > 0) dealDamage(state, hero, target, ab.damage + hero.atk * 0.5);
        spawnAbilityParticles(state, hero.x, hero.y, abilityColor, 12);
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

function spawnSpellProjectile(state: MobaState, hero: MobaHero, angle: number, ab: any, color: string, trailColor: string, piercing: boolean = false) {
  const speed = 600;
  state.spellProjectiles.push({
    id: state.nextEntityId++,
    x: hero.x + Math.cos(angle) * 20,
    y: hero.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    speed,
    damage: ab.damage + hero.atk * 0.8,
    radius: 15,
    team: hero.team,
    sourceId: hero.id,
    color,
    trailColor,
    piercing,
    hitIds: [],
    life: ab.range / speed + 0.1,
    maxLife: ab.range / speed + 0.1,
    spellName: ab.name,
    aoeRadius: ab.radius || 0
  });
}

function getAllEnemies(state: MobaState, team: number): any[] {
  const enemies: any[] = [];
  for (const h of state.heroes) if (h.team !== team && !h.dead) enemies.push(h);
  for (const m of state.minions) if (m.team !== team && !m.dead) enemies.push(m);
  for (const t of state.towers) if (t.team !== team && !t.dead) enemies.push(t);
  for (const camp of state.jungleCamps) {
    for (const mob of camp.mobs) {
      if (!mob.dead) enemies.push(mob);
    }
  }
  return enemies;
}

function dealDamage(state: MobaState, attacker: any, target: any, rawDmg: number) {
  if ('iFrames' in target && target.iFrames > 0) {
    addFloatingText(state, target.x, target.y - 20, 'DODGE', '#22d3ee', 14);
    for (let i = 0; i < 4; i++) {
      state.particles.push({
        x: target.x, y: target.y,
        vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
        life: 0.3, maxLife: 0.3, color: '#22d3ee', size: 2, type: 'dodge'
      });
    }
    return;
  }

  const def = 'def' in target ? target.def : 0;
  let dmg = calcDamage(rawDmg, def);

  if ('blockActive' in target && target.blockActive) {
    const blockReduction = 0.7;
    const blocked = Math.floor(dmg * blockReduction);
    dmg -= blocked;
    addFloatingText(state, target.x, target.y - 30, `BLOCKED ${blocked}`, '#f59e0b', 12);
    state.spellEffects.push({
      x: target.x, y: target.y, type: 'shield_flash',
      life: 0.25, maxLife: 0.25, radius: 30, color: '#f59e0b', angle: 0
    });
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: target.x, y: target.y - 10,
        vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 80,
        life: 0.4, maxLife: 0.4, color: '#fbbf24', size: 3, type: 'spark'
      });
    }
  }

  if ('shieldHp' in target && target.shieldHp > 0) {
    const absorbed = Math.min(target.shieldHp, dmg);
    target.shieldHp -= absorbed;
    dmg -= absorbed;
  }

  target.hp -= dmg;

  if ('heroDataId' in attacker && attacker.buffTimer > 0) {
    const heroData = HEROES[(attacker as MobaHero).heroDataId];
    if (heroData && heroData.heroClass === 'Worg') {
      const lifestealAmt = Math.floor(dmg * 0.15);
      (attacker as MobaHero).hp = Math.min((attacker as MobaHero).maxHp, (attacker as MobaHero).hp + lifestealAmt);
      if (lifestealAmt > 0) {
        addFloatingText(state, attacker.x, attacker.y - 15, `+${lifestealAmt}`, '#22c55e', 10);
      }
    }
  }

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
      const victim = target as MobaHero;
      killHero(state, victim);
      if ('heroDataId' in attacker) {
        const killer = attacker as MobaHero;
        killer.kills++;
        killer.killStreak++;
        let goldReward = 300;
        const killXp = 100 + victim.level * 20;

        if (victim.killStreak >= 3) {
          const streakBonus = 50 * victim.killStreak;
          goldReward += streakBonus;
          state.killFeed.push({
            text: `Shutdown! +${streakBonus} bonus gold!`,
            color: '#ffd700',
            time: state.gameTime
          });
        }
        victim.killStreak = 0;

        if (!state.firstBloodClaimed) {
          state.firstBloodClaimed = true;
          goldReward += 200;
          state.killFeed.push({
            text: 'FIRST BLOOD!',
            color: '#ef4444',
            time: state.gameTime
          });
        }

        killer.gold += goldReward;
        killer.xp += killXp;
        addFloatingText(state, killer.x, killer.y - 30, `+${goldReward}g`, '#ffd700', 16);
        checkLevelUp(state, killer);

        const assistXp = Math.floor(killXp * 0.6);
        for (const dmgId of victim.lastDamagedBy) {
          if (dmgId !== killer.id) {
            const assistant = state.heroes.find(h => h.id === dmgId);
            if (assistant && assistant.team === killer.team) {
              assistant.assists++;
              assistant.gold += 100;
              assistant.xp += assistXp;
              checkLevelUp(state, assistant);
            }
          }
        }

        const killerData = HEROES[killer.heroDataId];
        const targetData = HEROES[victim.heroDataId];
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
        const lastHitBonus = 15;
        const totalGold = (target as MobaMinion).goldValue + lastHitBonus;
        killer.gold += totalGold;
        killer.xp += (target as MobaMinion).xpValue;
        addFloatingText(state, killer.x, killer.y - 30, `+${totalGold}g`, '#ffd700', 12);
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
      const towerBounty = 200;
      const enemyTeam = target.team === 0 ? 1 : 0;
      const nearbyAllies = state.heroes.filter(h => h.team === enemyTeam && !h.dead && dist(h, target) < 1000);
      if (nearbyAllies.length > 0) {
        const goldPerAlly = Math.floor(towerBounty / nearbyAllies.length);
        for (const ally of nearbyAllies) {
          ally.gold += goldPerAlly;
          addFloatingText(state, ally.x, ally.y - 30, `+${goldPerAlly}g`, '#ffd700', 12);
        }
      }
    } else if ('destroyed' in target) {
      target.destroyed = true;
    }
  }
}

function killHero(state: MobaState, hero: MobaHero) {
  hero.dead = true;
  hero.deaths++;
  hero.respawnTimer = 5 + hero.level * 2 + state.gameTime / 60;
  hero.targetId = null;
  hero.moveTarget = null;
  hero.vx = 0;
  hero.vy = 0;
  hero.lastDamagedBy = [];
  spawnDeathParticles(state, hero.x, hero.y, TEAM_COLORS[hero.team]);
  state.pendingSpriteEffects.push({ type: 'undead', x: hero.x, y: hero.y, scale: 1.0, duration: 800 });
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

    hero.abilityPoints++;

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

  if (minion.attackWindup > 0) {
    minion.attackWindup -= dt;
    const target = minion.pendingTarget ? findEntityById(state, minion.pendingTarget) : null;
    if (target && !target.dead) {
      minion.facing = angleTo(minion, target);
    }
    if (minion.attackWindup <= 0) {
      if (target && !target.dead && dist(minion, target) < minion.rng + 60) {
        performAutoAttack(state, minion as any, target);
      }
      minion.pendingTarget = null;
      minion.attackBackswing = 0.25;
    }
    return;
  }

  if (minion.attackBackswing > 0) {
    minion.attackBackswing -= dt;
    return;
  }

  const enemy = findNearestEnemy(state, minion, 300, false);
  if (enemy && dist(minion, enemy) < minion.rng + 20) {
    minion.facing = angleTo(minion, enemy);
    if (minion.autoAttackTimer <= 0) {
      minion.attackWindup = minion.minionType === 'melee' ? 0.3 : 0.2;
      minion.pendingTarget = enemy.id;
      minion.autoAttackTimer = Math.max(1.0, 2.6 - minion.spd * 0.005);
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

  let heroAggressor: MobaHero | null = null;
  for (const ally of state.heroes) {
    if (ally.team !== tower.team || ally.dead) continue;
    if (dist(tower, ally) > tower.rng) continue;
    for (const enemy of state.heroes) {
      if (enemy.team === tower.team || enemy.dead) continue;
      if (dist(tower, enemy) > tower.rng) continue;
      if (ally.lastDamagedBy.includes(enemy.id)) {
        heroAggressor = enemy;
        break;
      }
    }
    if (heroAggressor) break;
  }
  if (heroAggressor && tower.targetId !== heroAggressor.id) {
    tower.targetId = heroAggressor.id;
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
        if (d > tower.rng) continue;
        if (d < closestDist) { closestDist = d; closest = h; }
      }
    }
    if (closest) tower.targetId = closest.id;
  }

  if (tower.targetId !== null && tower.autoAttackTimer <= 0) {
    const target = findEntityById(state, tower.targetId);
    if (target) {
      const tType: 'hero' | 'minion' | 'tower' | 'nexus' =
        'heroDataId' in target ? 'hero' : 'minionType' in target ? 'minion' : 'tierIndex' in target ? 'tower' : 'nexus';
      state.projectiles.push({
        id: state.nextEntityId++,
        x: tower.x, y: tower.y,
        targetId: target.id,
        targetType: tType,
        damage: tower.atk,
        speed: 800,
        team: tower.team,
        sourceId: tower.id,
        color: TEAM_COLORS[tower.team],
        size: 6
      });
      tower.autoAttackTimer = 2.5;

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

function hasLineOfSight(state: MobaState, a: Vec2, b: Vec2, attackerTeam: number): boolean {
  const d = dist(a, b);
  if (d < 30) return true;
  const steps = Math.ceil(d / 40);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    for (const tower of state.towers) {
      if (tower.dead) continue;
      if (tower.team === attackerTeam) continue;
      const td = dist({ x: px, y: py }, tower);
      if (td < 35) return false;
    }
  }
  return true;
}

function updateProjectiles(state: MobaState, dt: number) {
  for (const proj of state.projectiles) {
    const target = findEntityById(state, proj.targetId);
    if (!target || target.dead) continue;

    const angle = angleTo(proj, target);
    proj.x += Math.cos(angle) * proj.speed * dt;
    proj.y += Math.sin(angle) * proj.speed * dt;

    let hitTower = false;
    for (const tower of state.towers) {
      if (tower.dead || tower.team === proj.team) continue;
      if (tower.id === proj.targetId) continue;
      if (dist(proj, tower) < 30) {
        hitTower = true;
        for (let i = 0; i < 3; i++) {
          state.particles.push({
            x: proj.x, y: proj.y,
            vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 50,
            life: 0.2, maxLife: 0.2, color: '#888', size: 2, type: 'spark'
          });
        }
        break;
      }
    }
    if (hitTower) { proj.targetId = -1; continue; }

    if (dist(proj, target) < 15) {
      const attacker = findEntityById(state, proj.sourceId);
      if (attacker) {
        dealDamage(state, attacker, target, proj.damage);
      } else {
        target.hp -= proj.damage;
        if (target.hp <= 0) target.dead = true;
      }
      for (let i = 0; i < 4; i++) {
        state.particles.push({
          x: target.x, y: target.y - 5,
          vx: (Math.random() - 0.5) * 100, vy: -Math.random() * 60 - 20,
          life: 0.25, maxLife: 0.25, color: proj.color, size: 2, type: 'spark'
        });
      }
      if (proj.size >= 6) {
        spawnImpactRing(state, target.x, target.y, proj.color, 35);
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

function spawnCastBurst(state: MobaState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 40 + Math.random() * 80;
    state.particles.push({
      x: x + Math.cos(angle) * 8, y: y + Math.sin(angle) * 8,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 20,
      life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
      color, size: 2 + Math.random() * 2, type: 'ability'
    });
  }
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x, y: y - 10,
      vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 40,
      life: 0.5, maxLife: 0.5,
      color: '#ffffff', size: 2, type: 'ability'
    });
  }
}

function spawnSlashEffect(state: MobaState, x: number, y: number, angle: number, color: string) {
  state.spellEffects.push({
    x, y, type: 'slash_arc',
    life: 0.3, maxLife: 0.3, radius: 40, color, angle
  });
  for (let i = 0; i < 8; i++) {
    const spread = angle + (Math.random() - 0.5) * 1.2;
    state.particles.push({
      x, y,
      vx: Math.cos(spread) * (80 + Math.random() * 60),
      vy: Math.sin(spread) * (80 + Math.random() * 60),
      life: 0.35, maxLife: 0.35, color, size: 2 + Math.random() * 2, type: 'slash'
    });
  }
}

function spawnImpactRing(state: MobaState, x: number, y: number, color: string, radius: number) {
  state.spellEffects.push({
    x, y, type: 'impact_ring',
    life: 0.4, maxLife: 0.4, radius, color, angle: 0
  });
}

function updateSpellProjectiles(state: MobaState, dt: number) {
  for (let i = state.spellProjectiles.length - 1; i >= 0; i--) {
    const sp = state.spellProjectiles[i];
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;
    sp.life -= dt;

    if (Math.random() < 0.6) {
      state.particles.push({
        x: sp.x + (Math.random() - 0.5) * 10,
        y: sp.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 30,
        vy: (Math.random() - 0.5) * 30,
        life: 0.2, maxLife: 0.2,
        color: sp.trailColor, size: 3, type: 'ability'
      });
    }

    const enemies = getAllEnemies(state, sp.team);
    for (const e of enemies) {
      if (sp.hitIds.includes(e.id)) continue;
      const d = dist(sp, e);
      if (d < 30) {
        const attacker = findEntityById(state, sp.sourceId);
        if (attacker) {
          dealDamage(state, attacker, e, sp.damage);
        }

        for (let p = 0; p < 5; p++) {
          state.particles.push({
            x: e.x, y: e.y,
            vx: (Math.random() - 0.5) * 120,
            vy: (Math.random() - 0.5) * 120,
            life: 0.3, maxLife: 0.3,
            color: sp.color, size: 4, type: 'hit'
          });
        }

        if (sp.piercing) {
          sp.hitIds.push(e.id);
          sp.damage *= 0.8;
        } else {
          if (sp.aoeRadius > 0) {
            state.spellEffects.push({
              x: sp.x, y: sp.y, type: 'fire_ring',
              life: 0.5, maxLife: 0.5, radius: sp.aoeRadius,
              color: sp.color, angle: 0
            });
            state.spellEffects.push({
              x: sp.x, y: sp.y, type: 'impact_ring',
              life: 0.35, maxLife: 0.35, radius: sp.aoeRadius * 0.7,
              color: '#ffffff', angle: 0
            });
            state.spellEffects.push({
              x: sp.x, y: sp.y, type: 'ground_scorch',
              life: 1.5, maxLife: 1.5, radius: sp.aoeRadius * 0.6,
              color: '#332200', angle: 0
            });
            state.screenShake = 0.12;
            for (let p2 = 0; p2 < 12; p2++) {
              const a = (p2 / 12) * Math.PI * 2;
              state.particles.push({
                x: sp.x, y: sp.y,
                vx: Math.cos(a) * (60 + Math.random() * 80),
                vy: Math.sin(a) * (60 + Math.random() * 80) - 20,
                life: 0.5, maxLife: 0.5,
                color: sp.color, size: 3 + Math.random() * 2, type: 'ability'
              });
            }
            for (const ae of enemies) {
              if (ae.id === e.id) continue;
              if (dist(sp, ae) < sp.aoeRadius) {
                if (attacker) dealDamage(state, attacker, ae, sp.damage * 0.6);
              }
            }
          }
          sp.life = 0;
          break;
        }
      }
    }

    if (sp.life <= 0) {
      state.spellProjectiles.splice(i, 1);
    }
  }
}

function updateSpellEffects(state: MobaState, dt: number) {
  for (let i = state.spellEffects.length - 1; i >= 0; i--) {
    const eff = state.spellEffects[i];
    eff.life -= dt;

    if (eff.type === 'meteor_shadow' && eff.life <= 0 && eff.data) {
      state.spellEffects.push({
        x: eff.x, y: eff.y, type: 'meteor_impact',
        life: 0.7, maxLife: 0.7, radius: eff.radius * 1.2,
        color: '#ff6600', angle: 0
      });
      state.spellEffects.push({
        x: eff.x, y: eff.y, type: 'fire_ring',
        life: 0.4, maxLife: 0.4, radius: eff.radius * 0.9,
        color: '#ff4400', angle: 0
      });
      state.spellEffects.push({
        x: eff.x, y: eff.y, type: 'ground_scorch',
        life: 3.0, maxLife: 3.0, radius: eff.radius * 0.8,
        color: '#331100', angle: 0
      });
      state.screenShake = 0.4;

      const enemies = getAllEnemies(state, eff.data.team);
      const attacker = findEntityById(state, eff.data.sourceId);
      for (const e of enemies) {
        if (dist(eff, e) < eff.radius) {
          if (attacker) dealDamage(state, attacker, e, eff.data.damage);
        }
      }
      for (let p = 0; p < 30; p++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 200;
        const colors = ['#ff6600', '#ff3300', '#ff8800', '#ffaa00', '#ffffff'];
        state.particles.push({
          x: eff.x + (Math.random() - 0.5) * 20, y: eff.y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
          life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
          color: colors[Math.floor(Math.random() * colors.length)], size: 3 + Math.random() * 3, type: 'ability'
        });
      }
    }

    if (eff.type === 'arrow_rain' && eff.data && eff.life > 0) {
      eff.data.tickTimer = (eff.data.tickTimer || 0) + dt;
      if (eff.data.tickTimer >= 0.5) {
        eff.data.tickTimer = 0;
        const enemies = getAllEnemies(state, eff.data.team);
        const attacker = findEntityById(state, eff.data.sourceId);
        for (const e of enemies) {
          if (dist(eff, e) < eff.radius) {
            if (attacker) dealDamage(state, attacker, e, eff.data.damage);
          }
        }
        for (let p = 0; p < 10; p++) {
          const ax = eff.x + (Math.random() - 0.5) * eff.radius * 2;
          const ay = eff.y + (Math.random() - 0.5) * eff.radius * 2;
          state.particles.push({
            x: ax, y: ay - 30, vx: (Math.random() - 0.5) * 10, vy: 80 + Math.random() * 40,
            life: 0.35, maxLife: 0.35,
            color: '#22c55e', size: 2, type: 'ability'
          });
        }
      }
    }

    if (eff.life <= 0) state.spellEffects.splice(i, 1);
  }
  if (state.screenShake > 0) state.screenShake -= dt;
}

function updateAreaDamageZones(state: MobaState, dt: number) {
  for (let i = state.areaDamageZones.length - 1; i >= 0; i--) {
    const zone = state.areaDamageZones[i];
    zone.life -= dt;
    zone.tickTimer += dt;

    if (zone.tickTimer >= zone.tickInterval && zone.ticksRemaining > 0) {
      zone.tickTimer = 0;
      zone.ticksRemaining--;
      zone.hitThisTick = [];

      const enemies = getAllEnemies(state, zone.team);
      const attacker = findEntityById(state, zone.sourceId);
      for (const e of enemies) {
        if (dist(zone, e) < zone.radius) {
          if (attacker) dealDamage(state, attacker, e, zone.damage);
          zone.hitThisTick.push(e.id);

          if (zone.stunChance > 0 && Math.random() < zone.stunChance) {
            if ('stunTimer' in e) {
              (e as any).stunTimer = Math.max((e as any).stunTimer || 0, zone.stunTime);
            }
          }

          const zoneTypeEffects: Record<string, () => void> = {
            frost: () => {
              if ('spd' in e && 'activeEffects' in e) {
                applyStatusEffect(e as any, {
                  id: state.nextEntityId++, type: StatusEffectType.Slow, name: 'Frost Zone', duration: 1.5,
                  icon: '❄', color: '#60a5fa', remaining: 1.5,
                  stacks: 1, maxStacks: 1, value: 0.6,
                  tickRate: 0, tickTimer: 0, tickDamage: 0, sourceId: zone.sourceId,
                });
              }
            },
            poison: () => {
              if ('activeEffects' in e) {
                applyStatusEffect(e as any, {
                  id: state.nextEntityId++, type: StatusEffectType.Poison, name: 'Poison', duration: 3,
                  icon: '☠', color: '#22c55e', remaining: 3,
                  stacks: 1, maxStacks: 3, value: 0,
                  tickRate: 0.5, tickTimer: 0, tickDamage: Math.floor(zone.damage * 0.3), sourceId: zone.sourceId,
                });
              }
            },
          };
          if (zoneTypeEffects[zone.zoneType]) zoneTypeEffects[zone.zoneType]();
        }
      }

      for (let p = 0; p < 4; p++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * zone.radius;
        state.particles.push({
          x: zone.x + Math.cos(a) * r, y: zone.y + Math.sin(a) * r,
          vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40,
          life: 0.5, maxLife: 0.5,
          color: zone.color, size: 2 + Math.random() * 2, type: 'ability'
        });
      }
    }

    if (zone.life <= 0 || zone.ticksRemaining <= 0) {
      state.areaDamageZones.splice(i, 1);
    }
  }
}

export function spawnAreaDamageZone(
  state: MobaState,
  x: number, y: number,
  radius: number, damage: number,
  team: number, sourceId: number,
  ticks: number, tickInterval: number,
  stunChance: number, stunTime: number,
  color: string,
  zoneType: AreaDamageZoneState['zoneType']
) {
  state.areaDamageZones.push({
    id: state.nextEntityId++,
    x, y, radius, damage, team, sourceId,
    tickInterval, tickTimer: 0,
    ticksRemaining: ticks,
    life: ticks * tickInterval,
    maxLife: ticks * tickInterval,
    stunChance, stunTime, color,
    hitThisTick: [],
    zoneType,
  });

  state.spellEffects.push({
    x, y, type: 'cast_circle',
    life: 0.5, maxLife: 0.5,
    radius: radius, color, angle: 0
  });

  for (let p = 0; p < 12; p++) {
    const a = (p / 12) * Math.PI * 2;
    state.particles.push({
      x: x + Math.cos(a) * radius * 0.5,
      y: y + Math.sin(a) * radius * 0.5,
      vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 30,
      life: 0.4, maxLife: 0.4,
      color, size: 3, type: 'ability'
    });
  }
}

export function handleDodge(state: MobaState) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;
  if (player.dodgeCooldown > 0 || player.mp < 15) return;

  player.mp -= 15;
  player.dodgeCooldown = 3.0;
  player.dodgeTimer = 0.2;
  player.iFrames = 0.3;

  let dodgeDir = player.facing + Math.PI;
  if (player.moveTarget) {
    dodgeDir = Math.atan2(player.moveTarget.y - player.y, player.moveTarget.x - player.x);
  }
  player.dodgeDir = dodgeDir;
  state.pendingSpriteEffects.push({ type: 'dash', x: player.x, y: player.y, scale: 0.7, duration: 400 });

  player.targetId = null;
  player.stopCommand = false;

  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: player.x, y: player.y,
      vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100,
      life: 0.3, maxLife: 0.3, color: '#22d3ee', size: 3, type: 'dodge'
    });
  }
  state.spellEffects.push({
    x: player.x, y: player.y, type: 'dash_trail',
    life: 0.3, maxLife: 0.3, radius: 20, color: '#22d3ee', angle: dodgeDir
  });
  addFloatingText(state, player.x, player.y - 25, 'DODGE', '#22d3ee', 14);
}

export function handleDashAttack(state: MobaState) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;
  if (player.dashAttackCooldown > 0 || player.mp < 25) return;

  player.mp -= 25;
  player.dashAttackCooldown = 5.0;
  player.dashAttackTimer = 0.25;

  if (state.hoveredEntityId !== null) {
    const target = findEntityById(state, state.hoveredEntityId);
    if (target && !target.dead) {
      player.facing = angleTo(player, target);
    }
  } else {
    player.facing = Math.atan2(state.mouseWorld.y - player.y, state.mouseWorld.x - player.x);
  }

  player.animState = 'dash_attack';
  player.animTimer = 0;
  player.targetId = null;
  player.stopCommand = false;

  for (let i = 0; i < 5; i++) {
    const angle = player.facing + Math.PI + (Math.random() - 0.5) * 0.8;
    state.particles.push({
      x: player.x, y: player.y,
      vx: Math.cos(angle) * (60 + Math.random() * 40),
      vy: Math.sin(angle) * (60 + Math.random() * 40),
      life: 0.3, maxLife: 0.3, color: '#f97316', size: 3, type: 'slash'
    });
  }
  state.spellEffects.push({
    x: player.x, y: player.y, type: 'dash_trail',
    life: 0.35, maxLife: 0.35, radius: 15, color: '#f97316', angle: player.facing
  });
  addFloatingText(state, player.x, player.y - 25, 'DASH!', '#f97316', 14);
}

export function handleRmbMelee(state: MobaState, worldX: number, worldY: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return false;
  if (player.lungeSlashCooldown > 0) return false;
  if (player.lungeSlashTimer > 0 || player.dashAttackTimer > 0 || player.dodgeTimer > 0) return false;

  const clickedEnemy = findEntityAtPosition(state, worldX, worldY, player.team);

  let targetX = worldX;
  let targetY = worldY;

  if (clickedEnemy && dist(player, clickedEnemy) < 200) {
    targetX = clickedEnemy.x;
    targetY = clickedEnemy.y;
    player.targetId = clickedEnemy.id;
  } else {
    const enemies = getAllEnemies(state, player.team);
    let closest: any = null;
    let closestDist = 200;
    for (const e of enemies) {
      const d = dist(player, e);
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) return false;
    targetX = closest.x;
    targetY = closest.y;
  }

  player.facing = Math.atan2(targetY - player.y, targetX - player.x);
  player.lungeSlashTimer = 0.4;
  player.lungeSlashCooldown = 1.2;
  player.animState = 'lunge_slash';
  player.animTimer = 0;
  player.moveTarget = null;
  player.stopCommand = true;
  player.pendingAttackTarget = null;
  player.isAttackMoving = false;
  player.attackMoveTarget = null;

  const heroClass = HEROES[player.heroDataId]?.heroClass || 'Warrior';
  const slashColor = CLASS_COLORS[heroClass] || '#ef4444';

  for (let i = 0; i < 4; i++) {
    const angle = player.facing + (Math.random() - 0.5) * 0.6;
    state.particles.push({
      x: player.x, y: player.y,
      vx: Math.cos(angle) * (80 + Math.random() * 60),
      vy: Math.sin(angle) * (80 + Math.random() * 60),
      life: 0.25, maxLife: 0.25, color: slashColor, size: 3, type: 'slash'
    });
  }
  state.spellEffects.push({
    x: player.x, y: player.y, type: 'dash_trail',
    life: 0.3, maxLife: 0.3, radius: 12, color: slashColor, angle: player.facing
  });
  addFloatingText(state, player.x, player.y - 25, 'LUNGE!', slashColor, 13);
  return true;
}

export function handleBlock(state: MobaState, active: boolean) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;

  if (active) {
    if (player.blockCooldown > 0) return;
    player.blockActive = true;
    player.blockTimer = 1.5;
    player.animState = 'block';
    player.animTimer = 0;
    player.vx = 0;
    player.vy = 0;
    player.targetId = null;
    state.pendingSpriteEffects.push({ type: 'shield', x: player.x, y: player.y, scale: 0.8, duration: 800 });
    state.spellEffects.push({
      x: player.x, y: player.y, type: 'shield_flash',
      life: 0.2, maxLife: 0.2, radius: 25, color: '#f59e0b', angle: player.facing
    });
  } else {
    if (player.blockActive) {
      player.blockActive = false;
      player.blockTimer = 0;
      player.blockCooldown = 2.0;
      player.animState = 'idle';
    }
  }
}

export function handlePlayerAbility(state: MobaState, abilityIndex: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;
  if (player.abilityLevels[abilityIndex] <= 0) return;

  const target = findNearestEnemy(state, player, 600);
  executeAbility(state, player, abilityIndex, target);
}

export function handleLevelUpAbility(state: MobaState, abilityIndex: number) {
  const player = state.heroes[state.playerHeroIndex];
  if (!player || player.dead) return;
  if (player.abilityPoints <= 0) return;
  if (abilityIndex < 0 || abilityIndex > 3) return;

  const maxLevel = abilityIndex === 3 ? 3 : 4;
  if (player.abilityLevels[abilityIndex] >= maxLevel) return;

  if (abilityIndex === 3) {
    const requiredHeroLevels = [6, 11, 16];
    const currentAbLevel = player.abilityLevels[abilityIndex];
    if (currentAbLevel >= requiredHeroLevels.length) return;
    if (player.level < requiredHeroLevels[currentAbLevel]) return;
  }

  player.abilityLevels[abilityIndex]++;
  player.abilityPoints--;

  const heroData = HEROES[player.heroDataId];
  const abilities = heroData ? getHeroAbilities(heroData.race, heroData.heroClass) : null;
  const abName = abilities?.[abilityIndex]?.name || `Ability ${abilityIndex + 1}`;
  addFloatingText(state, player.x, player.y - 40, `${abName} Leveled!`, '#ffd700', 14);
  spawnAbilityParticles(state, player.x, player.y, '#ffd700', 10);
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
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        x: worldX, y: worldY,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80 - 20,
        life: 0.5, maxLife: 0.5,
        color: '#f97316', size: 3, type: 'ability'
      });
    }
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
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        x: worldX, y: worldY,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80 - 20,
        life: 0.5, maxLife: 0.5,
        color: '#22c55e', size: 3, type: 'ability'
      });
    }
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
  for (const camp of state.jungleCamps) {
    for (const mob of camp.mobs) {
      if (mob.dead) continue;
      const d = dist({ x: worldX, y: worldY }, mob);
      if (d < closestDist) { closestDist = d; closest = mob; }
    }
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
      return { name: hd?.name ?? '', kills: h.kills, deaths: h.deaths, assists: h.assists, level: h.level, team: h.team, hp: h.hp, maxHp: h.maxHp, heroRace: hd?.race ?? '', heroClass: hd?.heroClass ?? '', items: h.items ?? [null, null, null, null, null, null] };
    }),
    killFeed: state.killFeed,
    atk: player?.atk ?? 0,
    def: player?.def ?? 0,
    spd: player?.spd ?? 0,
    rng: player?.rng ?? 0,
    dead: player?.dead ?? false,
    respawnTimer: player?.respawnTimer ?? 0,
    activeEffects: (player?.activeEffects || []).map((e: any) => ({
      name: e.name || e.type,
      icon: e.icon || '',
      color: e.color || '#fff',
      remaining: e.remaining || 0,
      stacks: e.stacks || 1,
    })),
    dodgeCooldown: player?.dodgeCooldown ?? 0,
    dashAttackCooldown: player?.dashAttackCooldown ?? 0,
    lungeSlashCooldown: player?.lungeSlashCooldown ?? 0,
    comboCount: player?.comboCount ?? 0,
    comboTimer: player?.comboTimer ?? 0,
    blockActive: player?.blockActive ?? false,
    blockCooldown: player?.blockCooldown ?? 0,
    abilityCharges: player?.abilityCharges ?? [0, 0, 0, 0],
    abilityMaxCharges: heroData ? getHeroAbilities(heroData.race, heroData.heroClass).map(ab => ab.maxCharges || 0) : [0, 0, 0, 0],
    abilityLevels: player?.abilityLevels ?? [0, 0, 0, 0],
    abilityPoints: player?.abilityPoints ?? 0,
    minimapEntities: (() => {
      const pt = player?.team ?? 0;
      const visionSrcs: { x: number; y: number; r2: number }[] = [];
      for (const h of state.heroes) if (!h.dead && h.team === pt) visionSrcs.push({ x: h.x, y: h.y, r2: 600 * 600 });
      for (const t of state.towers) if (!t.dead && t.team === pt) visionSrcs.push({ x: t.x, y: t.y, r2: 500 * 500 });
      for (const m of state.minions) if (!m.dead && m.team === pt) visionSrcs.push({ x: m.x, y: m.y, r2: 300 * 300 });
      const inVis = (ex: number, ey: number) => {
        for (const s of visionSrcs) { const dx = ex - s.x, dy = ey - s.y; if (dx * dx + dy * dy <= s.r2) return true; }
        return false;
      };
      return [
        ...state.heroes.filter(h => !h.dead && (h.team === pt || inVis(h.x, h.y))).map(h => ({
          x: h.x, y: h.y,
          type: (h.isPlayer ? 'player' : h.team === pt ? 'ally_hero' : 'enemy_hero') as any,
        })),
        ...state.towers.filter(t => !t.dead && (t.team === pt || inVis(t.x, t.y))).map(t => ({
          x: t.x, y: t.y,
          type: (t.team === pt ? 'ally_tower' : 'enemy_tower') as any,
        })),
        ...state.nexuses.filter(n => !n.dead).map(n => ({
          x: n.x, y: n.y,
          type: (n.team === pt ? 'ally_nexus' : 'enemy_nexus') as any,
        })),
        ...state.minions.filter(m => !m.dead && (m.team === pt || inVis(m.x, m.y))).map(m => ({
          x: m.x, y: m.y,
          type: (m.team === pt ? 'ally_minion' : 'enemy_minion') as any,
        })),
        ...state.jungleCamps.filter(c => !c.allDead && inVis(c.x, c.y)).map(c => ({
          x: c.x, y: c.y,
          type: (`jungle_${c.campType}` as any),
        })),
      ];
    })(),
    cameraViewport: {
      x: state.camera.x,
      y: state.camera.y,
      w: (typeof window !== 'undefined' ? window.innerWidth : 1920) / state.camera.zoom,
      h: (typeof window !== 'undefined' ? window.innerHeight : 1080) / state.camera.zoom,
    },
    targetInfo: getTargetInfo(state, player),
  };
}

function getTargetInfo(state: MobaState, player: MobaHero | undefined): TargetInfo | null {
  if (!player) return null;
  const targetEntityId = player.targetId ?? state.hoveredEntityId;
  if (targetEntityId === null || targetEntityId === undefined) return null;
  const entity = findEntityById(state, targetEntityId);
  if (!entity || entity.dead) return null;

  if ('heroDataId' in entity) {
    const hero = entity as MobaHero;
    const hd = HEROES[hero.heroDataId];
    return {
      name: hd?.name ?? 'Hero',
      entityType: 'hero',
      hp: hero.hp,
      maxHp: hero.maxHp,
      level: hero.level,
      team: hero.team,
      isAlly: hero.team === player.team,
      heroClass: hd?.heroClass,
      heroRace: hd?.race,
      atk: hero.atk,
      def: hero.def,
      activeEffects: (hero.activeEffects || []).map((e: any) => ({
        name: e.name || e.type,
        icon: e.icon || '',
        color: e.color || '#fff',
        remaining: e.remaining || 0,
        stacks: e.stacks || 1,
      })),
    };
  }
  if ('minionType' in entity) {
    const minion = entity as MobaMinion;
    return {
      name: `${minion.minionType.charAt(0).toUpperCase() + minion.minionType.slice(1)} Minion`,
      entityType: 'minion',
      hp: minion.hp,
      maxHp: minion.maxHp,
      level: 1,
      team: minion.team,
      isAlly: minion.team === player.team,
      atk: minion.atk,
      def: minion.def,
      activeEffects: [],
    };
  }
  if ('tierIndex' in entity) {
    const tower = entity as MobaTower;
    return {
      name: tower.isNexusTower ? 'Nexus Tower' : `Tower (Tier ${tower.tierIndex + 1})`,
      entityType: 'tower',
      hp: tower.hp,
      maxHp: tower.maxHp,
      level: tower.tierIndex + 1,
      team: tower.team,
      isAlly: tower.team === player.team,
      atk: tower.atk,
      activeEffects: [],
    };
  }
  if ('destroyed' in entity) {
    const nexus = entity as MobaNexus;
    return {
      name: 'Nexus',
      entityType: 'nexus',
      hp: nexus.hp,
      maxHp: nexus.maxHp,
      level: 1,
      team: nexus.team,
      isAlly: nexus.team === player.team,
      activeEffects: [],
    };
  }
  if ('mobType' in entity) {
    const mob = entity as JungleMob;
    const typeLabel = mob.mobType === 'buff' ? 'Jungle Boss' : mob.mobType === 'medium' ? 'Jungle Brute' : 'Jungle Creep';
    return {
      name: typeLabel,
      entityType: 'jungle_mob',
      hp: mob.hp,
      maxHp: mob.maxHp,
      level: mob.mobType === 'buff' ? 3 : mob.mobType === 'medium' ? 2 : 1,
      team: -1,
      isAlly: false,
      atk: mob.atk,
      def: mob.def,
      activeEffects: [],
    };
  }
  return null;
}

export class MobaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private voxel: VoxelRenderer;
  private grabCursorImg: HTMLImageElement | null = null;
  spriteEffects: SpriteEffectSystem;
  private lastRenderTime = 0;
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private exploredMap: boolean[][];
  private visionSources: { x: number; y: number; radius: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.voxel = new VoxelRenderer();
    this.spriteEffects = new SpriteEffectSystem();
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = 800;
    this.fogCanvas.height = 600;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    const gridSize = Math.ceil(MAP_SIZE / 80);
    this.exploredMap = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const img = new Image();
    img.src = '/assets/cursor-grab.png';
    img.onload = () => { this.grabCursorImg = img; };
  }

  private updateVision(state: MobaState) {
    const playerTeam = state.heroes[state.playerHeroIndex]?.team ?? 0;
    this.visionSources.length = 0;
    for (const hero of state.heroes) {
      if (!hero.dead && hero.team === playerTeam) {
        this.visionSources.push({ x: hero.x, y: hero.y, radius: 600 });
      }
    }
    for (const tower of state.towers) {
      if (!tower.dead && tower.team === playerTeam) {
        this.visionSources.push({ x: tower.x, y: tower.y, radius: 500 });
      }
    }
    for (const minion of state.minions) {
      if (!minion.dead && minion.team === playerTeam) {
        this.visionSources.push({ x: minion.x, y: minion.y, radius: 300 });
      }
    }
    const tileSize = 80;
    for (const src of this.visionSources) {
      const r = src.radius;
      const stx = Math.max(0, Math.floor((src.x - r) / tileSize));
      const sty = Math.max(0, Math.floor((src.y - r) / tileSize));
      const etx = Math.min(this.exploredMap[0].length - 1, Math.floor((src.x + r) / tileSize));
      const ety = Math.min(this.exploredMap.length - 1, Math.floor((src.y + r) / tileSize));
      for (let ty = sty; ty <= ety; ty++) {
        for (let tx = stx; tx <= etx; tx++) {
          const cx = tx * tileSize + tileSize / 2;
          const cy = ty * tileSize + tileSize / 2;
          const dx = cx - src.x, dy = cy - src.y;
          if (dx * dx + dy * dy <= r * r) {
            this.exploredMap[ty][tx] = true;
          }
        }
      }
    }
  }

  isInVision(x: number, y: number): boolean {
    for (const src of this.visionSources) {
      const dx = x - src.x, dy = y - src.y;
      if (dx * dx + dy * dy <= src.radius * src.radius) return true;
    }
    return false;
  }

  private renderFogOfWar(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, state: MobaState) {
    const fW = W;
    const fH = H;
    if (this.fogCanvas.width !== fW || this.fogCanvas.height !== fH) {
      this.fogCanvas.width = fW;
      this.fogCanvas.height = fH;
    }
    const fCtx = this.fogCtx;
    fCtx.clearRect(0, 0, fW, fH);
    fCtx.fillStyle = 'rgba(0,0,0,0.85)';
    fCtx.fillRect(0, 0, fW, fH);

    fCtx.globalCompositeOperation = 'destination-out';

    for (const src of this.visionSources) {
      const sx = (src.x - cam.x) * cam.zoom + fW / 2;
      const sy = (src.y - cam.y) * cam.zoom + fH / 2;
      const sr = src.radius * cam.zoom;
      if (sx + sr < 0 || sx - sr > fW || sy + sr < 0 || sy - sr > fH) continue;
      const grad = fCtx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.7, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      fCtx.fillStyle = grad;
      fCtx.beginPath();
      fCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      fCtx.fill();
    }

    fCtx.globalCompositeOperation = 'source-over';

    const tileSize = 80;
    const startTX = Math.max(0, Math.floor((cam.x - fW / 2 / cam.zoom) / tileSize) - 1);
    const startTY = Math.max(0, Math.floor((cam.y - fH / 2 / cam.zoom) / tileSize) - 1);
    const gridMax = this.exploredMap.length;
    const endTX = Math.min(gridMax, Math.ceil((cam.x + fW / 2 / cam.zoom) / tileSize) + 1);
    const endTY = Math.min(gridMax, Math.ceil((cam.y + fH / 2 / cam.zoom) / tileSize) + 1);
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        if (this.exploredMap[ty]?.[tx]) continue;
        const px = (tx * tileSize - cam.x) * cam.zoom + fW / 2;
        const py = (ty * tileSize - cam.y) * cam.zoom + fH / 2;
        const ps = tileSize * cam.zoom;
        fCtx.fillStyle = 'rgba(0,0,0,0.35)';
        fCtx.fillRect(px, py, ps, ps);
      }
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fogCanvas, 0, 0);
    ctx.restore();
  }

  render(state: MobaState) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const cam = state.camera;
    const playerTeam = state.heroes[state.playerHeroIndex]?.team ?? 0;

    this.updateVision(state);

    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (state.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * state.screenShake * 30;
      const shakeY = (Math.random() - 0.5) * state.screenShake * 30;
      ctx.translate(shakeX, shakeY);
    }
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.renderMap(ctx, cam, W, H, state);
    this.renderLanes(ctx);

    this.renderFogOfWar(ctx, cam, W, H, state);

    for (const nexus of state.nexuses) {
      if (!nexus.dead) this.renderNexus(ctx, nexus);
    }

    for (const tower of state.towers) {
      if (!tower.dead) {
        if (tower.team !== playerTeam && !this.isInVision(tower.x, tower.y)) continue;
        this.renderTower(ctx, tower);
      }
    }

    if (state.hoveredEntityId !== null) {
      const hovEntity = findEntityById(state, state.hoveredEntityId);
      if (hovEntity && !hovEntity.dead && this.isInVision(hovEntity.x, hovEntity.y)) {
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

    this.renderTargetFrame(ctx, state);

    for (const camp of state.jungleCamps) {
      if (camp.allDead) continue;
      for (const mob of camp.mobs) {
        if (!mob.dead && this.isInVision(mob.x, mob.y)) this.renderJungleMob(ctx, mob, camp);
      }
    }

    const sortedMinions = [...state.minions].sort((a, b) => a.y - b.y);
    for (const minion of sortedMinions) {
      if (!minion.dead) {
        if (minion.team !== playerTeam && !this.isInVision(minion.x, minion.y)) continue;
        this.renderMinion(ctx, minion);
      }
    }

    const sortedHeroes = [...state.heroes].sort((a, b) => a.y - b.y);
    for (const hero of sortedHeroes) {
      if (!hero.dead) {
        if (hero.team !== playerTeam && !this.isInVision(hero.x, hero.y)) continue;
        this.renderHero(ctx, hero, state);
      }
    }

    const player = state.heroes[state.playerHeroIndex];
    if (player && !player.dead && state.selectedAbility >= 0) {
      const heroData = HEROES[player.heroDataId];
      const abilities = heroData ? getHeroAbilities(heroData.race, heroData.heroClass) : null;
      const ab = abilities ? abilities[state.selectedAbility] : null;
      if (ab) {
        const range = ab.range || 300;
        const castType = ab.castType || 'targeted';
        const mx = state.mouseWorld.x;
        const my = state.mouseWorld.y;
        const pulse = 0.25 + Math.sin(Date.now() * 0.004) * 0.1;

        ctx.save();
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(player.x, player.y, range, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        if (castType === 'ground_aoe' && ab.radius > 0) {
          const r = ab.radius;
          ctx.globalAlpha = 0.15 + Math.sin(Date.now() * 0.005) * 0.05;
          ctx.fillStyle = '#a855f7';
          ctx.beginPath();
          ctx.arc(mx, my, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
        } else if (castType === 'skillshot') {
          const angle = angleTo(player, { x: mx, y: my });
          const w = 30;
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#a855f7';
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(angle);
          ctx.fillRect(0, -w, range, w * 2);
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.5;
          ctx.strokeRect(0, -w, range, w * 2);
          ctx.restore();
        } else if (castType === 'line') {
          const angle = angleTo(player, { x: mx, y: my });
          const w = 15;
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#22d3ee';
          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(angle);
          ctx.fillRect(0, -w, range, w * 2);
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.strokeRect(0, -w, range, w * 2);
          ctx.restore();
        } else if (castType === 'cone') {
          const angle = angleTo(player, { x: mx, y: my });
          const spread = Math.PI / 4;
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.moveTo(player.x, player.y);
          ctx.arc(player.x, player.y, range, angle - spread, angle + spread);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.4;
          ctx.stroke();
        } else if (castType === 'targeted') {
          if (state.hoveredEntityId !== null) {
            const tgt = findEntityById(state, state.hoveredEntityId);
            if (tgt && !tgt.dead) {
              ctx.globalAlpha = 0.3;
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(player.x, player.y);
              ctx.lineTo(tgt.x, tgt.y);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(tgt.x, tgt.y, 18, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    if (player && !player.dead) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.rng + 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const proj of state.projectiles) {
      this.renderProjectile(ctx, proj, state);
    }

    for (const sp of state.spellProjectiles) {
      ctx.save();
      ctx.translate(sp.x, sp.y);

      const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      outerGlow.addColorStop(0, sp.color + '44');
      outerGlow.addColorStop(0.5, sp.trailColor + '22');
      outerGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.3, sp.color);
      glow.addColorStop(0.7, sp.trailColor + '88');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      const projAngle = Math.atan2(sp.vy, sp.vx);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = sp.trailColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(projAngle) * 20, -Math.sin(projAngle) * 20);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(projAngle) * 35, -Math.sin(projAngle) * 35);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    for (const p of state.particles) {
      this.renderParticle(ctx, p);
    }

    for (const ft of state.floatingTexts) {
      this.renderFloatingText(ctx, ft);
    }

    for (const zone of state.areaDamageZones) {
      this.renderAreaDamageZone(ctx, zone, state.gameTime);
    }

    for (const se of state.spellEffects) {
      this.renderSpellEffect(ctx, se);
    }

    const now = performance.now() / 1000;
    const dt = this.lastRenderTime > 0 ? Math.min(0.1, now - this.lastRenderTime) : 0.016;
    this.lastRenderTime = now;

    for (const eff of state.pendingSpriteEffects) {
      this.spriteEffects.playEffect(eff.type as SpriteEffectType, eff.x, eff.y, eff.scale, eff.duration);
    }
    state.pendingSpriteEffects.length = 0;

    this.spriteEffects.update(dt);
    this.spriteEffects.render(ctx);

    this.renderCursor(ctx, state);

    ctx.restore();

    this.renderKillFeed(ctx, state, W);
  }

  private renderTargetFrame(ctx: CanvasRenderingContext2D, state: MobaState) {
    const player = state.heroes[state.playerHeroIndex];
    if (!player || player.dead) return;

    const targetEntityId = player.targetId ?? state.hoveredEntityId;
    if (targetEntityId === null || targetEntityId === undefined) return;
    const entity = findEntityById(state, targetEntityId);
    if (!entity || entity.dead) return;

    const isAlly = 'team' in entity && entity.team === player.team;
    const isNeutral = !('team' in entity) || entity.team === -1;
    const frameColor = isAlly ? '#4ade80' : isNeutral ? '#fbbf24' : '#ef4444';
    const glowColor = isAlly ? 'rgba(74,222,128,' : isNeutral ? 'rgba(251,191,36,' : 'rgba(239,68,68,';

    const t = Date.now() * 0.003;
    const pulse = 0.4 + Math.sin(t * 2) * 0.15;
    const bracketAnim = Math.sin(t) * 2;

    const entitySize = 'heroDataId' in entity ? 28 : 'tierIndex' in entity ? 35 : 'destroyed' in entity ? 40 : 20;
    const sz = entitySize + 6 + bracketAnim;
    const bracketLen = sz * 0.4;

    ctx.save();
    ctx.translate(entity.x, entity.y);

    const glowRad = entitySize + 10 + Math.sin(t * 3) * 3;
    const glow = ctx.createRadialGradient(0, 0, entitySize * 0.3, 0, 0, glowRad);
    glow.addColorStop(0, glowColor + '0)');
    glow.addColorStop(0.5, glowColor + (pulse * 0.3).toFixed(2) + ')');
    glow.addColorStop(1, glowColor + '0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7 + Math.sin(t * 2) * 0.2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-sz, -sz + bracketLen); ctx.lineTo(-sz, -sz); ctx.lineTo(-sz + bracketLen, -sz);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sz - bracketLen, -sz); ctx.lineTo(sz, -sz); ctx.lineTo(sz, -sz + bracketLen);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz, sz - bracketLen); ctx.lineTo(-sz, sz); ctx.lineTo(-sz + bracketLen, sz);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sz - bracketLen, sz); ctx.lineTo(sz, sz); ctx.lineTo(sz, sz - bracketLen);
    ctx.stroke();

    ctx.globalAlpha = pulse * 0.5;
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, entitySize + 4, entitySize + 2, 0, Math.PI, false);
    ctx.stroke();
    ctx.setLineDash([]);

    let entityName = '';
    if ('heroDataId' in entity) {
      const hd = HEROES[(entity as MobaHero).heroDataId];
      entityName = hd?.name?.split(' ').pop() ?? 'Hero';
    } else if ('minionType' in entity) {
      entityName = (entity as MobaMinion).minionType + ' Minion';
    } else if ('tierIndex' in entity) {
      entityName = (entity as MobaTower).isNexusTower ? 'Nexus Tower' : 'Tower';
    } else if ('destroyed' in entity) {
      entityName = 'Nexus';
    } else if ('mobType' in entity) {
      const m = entity as JungleMob;
      entityName = m.mobType === 'buff' ? 'Boss' : m.mobType === 'medium' ? 'Brute' : 'Creep';
    }

    if (entityName) {
      ctx.globalAlpha = 0.9;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const textW = ctx.measureText(entityName).width;
      ctx.fillRect(-textW / 2 - 4, -sz - 14, textW + 8, 13);

      ctx.fillStyle = frameColor;
      ctx.fillText(entityName, 0, -sz - 3);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
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
    } else if (state.hoveredEntityId !== null && this.grabCursorImg) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.grabCursorImg, -12, -12, 24, 24);
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

    const animTime = state.gameTime;
    const tileSize = 80;

    const adj = (tx: number, ty: number, dx: number, dy: number) => {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= TILE_GRID || ny >= TILE_GRID) return 'grass';
      return TERRAIN_LOOKUP[state.terrainMap[ny]?.[nx] ?? 0] || 'grass';
    };

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const terrainIdx = state.terrainMap[ty]?.[tx] ?? 0;
        const terrain = TERRAIN_LOOKUP[terrainIdx] || 'grass';
        const x = tx * tileSize;
        const y = ty * tileSize;
        this.voxel.drawTerrainTile(ctx, x, y, tileSize, terrain, tx, ty);

        const seed = ((tx * 374761393 + ty * 668265263) >>> 0) % 1000;
        const seed2 = ((tx * 668265263 + ty * 374761393 + 12345) >>> 0) % 1000;

        if (terrain === 'lane') {
          ctx.fillStyle = 'rgba(90,80,60,0.04)';
          ctx.fillRect(x + 20, y, 40, tileSize);

          ctx.strokeStyle = 'rgba(80,70,50,0.08)';
          ctx.lineWidth = 1;
          ctx.setLineDash([8, 12]);
          ctx.beginPath();
          ctx.moveTo(x + 15, y);
          ctx.lineTo(x + 15, y + tileSize);
          ctx.moveTo(x + 65, y);
          ctx.lineTo(x + 65, y + tileSize);
          ctx.stroke();
          ctx.setLineDash([]);

          if (seed > 300) {
            const crackCount = 1 + (seed % 3);
            ctx.strokeStyle = 'rgba(60,50,40,0.08)';
            ctx.lineWidth = 0.5;
            for (let c = 0; c < crackCount; c++) {
              const cx = x + 15 + ((seed * (c + 1) * 7) % 50);
              const cy = y + 10 + ((seed * (c + 1) * 13) % 60);
              const cl = 5 + (seed2 % 10);
              const ca = ((seed * (c + 3)) % 628) / 100;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + Math.cos(ca) * cl, cy + Math.sin(ca) * cl);
              if (c % 2 === 0) {
                ctx.lineTo(cx + Math.cos(ca + 0.5) * cl * 0.6, cy + Math.sin(ca + 0.5) * cl * 0.6);
              }
              ctx.stroke();
            }
          }

          if (seed > 500) {
            const pebbleCount = 2 + (seed % 4);
            for (let p = 0; p < pebbleCount; p++) {
              const px = x + 10 + ((seed * (p + 1) * 7) % 60);
              const py = y + 10 + ((seed * (p + 1) * 13) % 60);
              const pr = 1 + (seed2 % 2);
              ctx.fillStyle = `rgba(${100 + seed2 % 30},${90 + seed2 % 20},${70 + seed2 % 15},0.12)`;
              ctx.beginPath();
              ctx.arc(px, py, pr, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (seed > 800) {
            const lx = x + 40;
            const ly = y + 40;
            const glowPulse = 0.03 + Math.sin(animTime * 2 + tx * 3) * 0.02;
            ctx.fillStyle = `rgba(210,180,100,${glowPulse})`;
            ctx.beginPath();
            ctx.arc(lx, ly, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(255,220,120,${glowPulse * 2})`;
            ctx.beginPath();
            ctx.arc(lx, ly, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (terrain === 'grass') {
          const bladeCount = 3 + (seed % 5);
          for (let b = 0; b < bladeCount; b++) {
            const bx = x + 5 + ((seed * (b + 1) * 11) % 70);
            const by = y + 20 + ((seed * (b + 1) * 17) % 55);
            const bh = 5 + (seed % 7);
            const sway = Math.sin(animTime * 1.5 + bx * 0.05 + b * 0.3) * 2.5;
            const shade = 40 + (seed2 * (b + 1)) % 50;
            ctx.strokeStyle = `rgba(${shade},${shade + 60},${shade - 10},0.18)`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + sway * 0.5, by - bh * 0.5, bx + sway * 1.5, by - bh);
            ctx.stroke();
          }

          if (seed > 850) {
            const flowerColors = ['rgba(220,80,120,0.3)', 'rgba(180,120,220,0.3)', 'rgba(220,200,80,0.3)', 'rgba(100,180,220,0.3)'];
            const fc = flowerColors[seed % flowerColors.length];
            const fx = x + 15 + (seed2 % 50);
            const fy = y + 15 + ((seed * 3) % 50);
            ctx.fillStyle = fc;
            for (let p = 0; p < 5; p++) {
              const pa = (p / 5) * Math.PI * 2 + animTime * 0.3;
              ctx.beginPath();
              ctx.arc(fx + Math.cos(pa) * 3, fy + Math.sin(pa) * 3, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = 'rgba(255,230,100,0.4)';
            ctx.beginPath();
            ctx.arc(fx, fy, 1, 0, Math.PI * 2);
            ctx.fill();
          }

          if (seed > 600 && seed < 700) {
            const mx = x + 10 + (seed2 % 60);
            const my = y + 25 + ((seed * 7) % 50);
            ctx.fillStyle = 'rgba(180,140,100,0.08)';
            ctx.beginPath();
            ctx.arc(mx, my, 2 + seed % 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(200,60,60,0.12)';
            ctx.beginPath();
            ctx.ellipse(mx, my - 3 - seed % 2, 3 + seed % 2, 2 + seed % 2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (terrain === 'jungle') {
          const bladeCount = 4 + (seed % 5);
          for (let b = 0; b < bladeCount; b++) {
            const bx = x + 3 + ((seed * (b + 1) * 11) % 74);
            const by = y + 15 + ((seed * (b + 1) * 17) % 60);
            const bh = 6 + (seed % 8);
            const sway = Math.sin(animTime * 1.2 + bx * 0.04 + b * 0.4) * 1.8;
            ctx.strokeStyle = `rgba(${20 + seed % 15},${70 + seed % 30},${15 + seed % 10},0.25)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.quadraticCurveTo(bx + sway * 0.5, by - bh * 0.6, bx + sway * 1.2, by - bh);
            ctx.stroke();
          }

          if (seed > 500) {
            const mossCount = 1 + seed % 3;
            for (let m = 0; m < mossCount; m++) {
              const mx = x + 8 + ((seed * (m + 2) * 19) % 64);
              const my = y + 10 + ((seed * (m + 3) * 23) % 60);
              ctx.fillStyle = 'rgba(30,80,25,0.12)';
              ctx.beginPath();
              ctx.ellipse(mx, my, 4 + seed % 4, 2 + seed % 3, (seed * m) % 314 / 100, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (seed > 700) {
            const sporeX = x + 20 + (seed2 % 40);
            const sporeY = y + 30 + ((seed * 5) % 30);
            const sporeAlpha = 0.06 + Math.sin(animTime * 0.8 + seed) * 0.04;
            ctx.fillStyle = `rgba(120,200,80,${sporeAlpha})`;
            ctx.beginPath();
            ctx.arc(sporeX, sporeY, 8 + Math.sin(animTime + seed) * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (terrain === 'base_blue' || terrain === 'base_red') {
          const isBlue = terrain === 'base_blue';
          const baseColor = isBlue ? 'rgba(60,100,220,' : 'rgba(220,60,60,';
          const glow = 0.04 + Math.sin(animTime * 1.5 + tx + ty) * 0.02;
          ctx.fillStyle = baseColor + glow + ')';
          ctx.fillRect(x, y, tileSize, tileSize);

          ctx.strokeStyle = baseColor + '0.04)';
          ctx.lineWidth = 0.5;
          for (let gx = 0; gx < 4; gx++) {
            ctx.beginPath();
            ctx.moveTo(x + gx * 20, y);
            ctx.lineTo(x + gx * 20, y + tileSize);
            ctx.stroke();
          }
          for (let gy = 0; gy < 4; gy++) {
            ctx.beginPath();
            ctx.moveTo(x, y + gy * 20);
            ctx.lineTo(x + tileSize, y + gy * 20);
            ctx.stroke();
          }

          if (seed > 600) {
            const rcx = x + tileSize / 2;
            const rcy = y + tileSize / 2;
            const runeRotation = animTime * 0.5 + seed;
            const runeAlpha = 0.06 + Math.sin(animTime * 2 + seed) * 0.03;
            ctx.save();
            ctx.translate(rcx, rcy);
            ctx.rotate(runeRotation);
            ctx.strokeStyle = baseColor + runeAlpha + ')';
            ctx.lineWidth = 1;
            const rr = 12 + (seed % 15);
            ctx.beginPath();
            ctx.arc(0, 0, rr, 0, Math.PI * 2);
            ctx.stroke();
            for (let s = 0; s < 4; s++) {
              const sa = (s / 4) * Math.PI * 2;
              ctx.beginPath();
              ctx.moveTo(Math.cos(sa) * (rr - 3), Math.sin(sa) * (rr - 3));
              ctx.lineTo(Math.cos(sa) * (rr + 5), Math.sin(sa) * (rr + 5));
              ctx.stroke();
            }
            ctx.restore();
          }

          const ambientGlow = 0.02 + Math.sin(animTime * 1.2 + tx * 2 + ty * 3) * 0.015;
          const grad = ctx.createRadialGradient(x + 40, y + 40, 0, x + 40, y + 40, 50);
          grad.addColorStop(0, baseColor + ambientGlow + ')');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, tileSize, tileSize);
        }

        if (terrain === 'river' || terrain === 'water') {
          const wave1 = Math.sin(animTime * 2.2 + tx * 0.8 + ty * 0.6) * 0.08 + 0.07;
          ctx.globalAlpha = wave1;
          ctx.fillStyle = '#67e8f9';
          ctx.fillRect(x, y, tileSize, tileSize);

          const wave2 = Math.sin(animTime * 1.6 + tx * 1.2 + ty * 0.4) * 0.04;
          ctx.globalAlpha = Math.max(0, wave2 + 0.03);
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(x, y, tileSize, tileSize);

          ctx.strokeStyle = '#a5f3fc';
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = 0.08 + Math.sin(animTime * 3 + tx) * 0.04;
          for (let cl = 0; cl < 3; cl++) {
            const clY = y + 15 + cl * 22 + Math.sin(animTime * 1.8 + tx * 0.5 + cl) * 4;
            const clX = x + 5 + Math.sin(animTime * 1.2 + cl * 2) * 8;
            ctx.beginPath();
            ctx.moveTo(clX, clY);
            ctx.quadraticCurveTo(x + 40, clY + Math.sin(animTime * 2.5 + cl) * 3, x + 75, clY + Math.sin(animTime * 2 + cl + 1) * 5);
            ctx.stroke();
          }

          const rippleX = x + 40 + Math.sin(animTime * 3 + tx * 2) * 20;
          const rippleY = y + 40 + Math.cos(animTime * 2.5 + ty * 2) * 20;
          ctx.globalAlpha = 0.1 + Math.sin(animTime * 4 + tx + ty) * 0.05;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(rippleX, rippleY, 6 + Math.sin(animTime * 5) * 4, 0, Math.PI * 2);
          ctx.stroke();

          if (seed > 600) {
            const lpx = x + 20 + (seed % 40);
            const lpy = y + 20 + (seed2 % 40);
            const lpBob = Math.sin(animTime * 0.8 + seed * 0.1) * 1.5;
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(lpx, lpy + lpBob, 5, 3.5, (seed % 314) / 100, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#166534';
            ctx.beginPath();
            ctx.ellipse(lpx + 2, lpy + lpBob - 1, 2, 1, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          if (seed > 400 && seed < 600) {
            const sparklePhase = animTime * 5 + seed;
            if (Math.sin(sparklePhase) > 0.7) {
              const spx = x + 10 + (seed % 60);
              const spy = y + 10 + (seed2 % 60);
              const sparkAlpha = (Math.sin(sparklePhase) - 0.7) * 3;
              ctx.globalAlpha = sparkAlpha * 0.6;
              ctx.fillStyle = '#ffffff';
              ctx.beginPath();
              ctx.arc(spx, spy, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          const foamAlpha = 0.06 + Math.sin(animTime * 3.5 + tx * 1.2) * 0.03;
          ctx.fillStyle = 'rgba(200,240,255,' + foamAlpha + ')';
          if (adj(tx, ty, -1, 0) !== 'river' && adj(tx, ty, -1, 0) !== 'water') {
            for (let fy = 0; fy < 4; fy++) {
              const fx = x + 1 + Math.sin(animTime * 2 + fy) * 2;
              ctx.fillRect(fx, y + fy * 20 + 5, 3 + Math.sin(animTime * 4 + fy) * 2, 2);
            }
          }
          if (adj(tx, ty, 1, 0) !== 'river' && adj(tx, ty, 1, 0) !== 'water') {
            for (let fy = 0; fy < 4; fy++) {
              const fx = x + tileSize - 4 + Math.sin(animTime * 2.3 + fy) * 2;
              ctx.fillRect(fx, y + fy * 20 + 8, 3 + Math.sin(animTime * 4.2 + fy) * 2, 2);
            }
          }
          if (adj(tx, ty, 0, -1) !== 'river' && adj(tx, ty, 0, -1) !== 'water') {
            for (let fx = 0; fx < 4; fx++) {
              const fy = y + 1 + Math.sin(animTime * 2.1 + fx) * 2;
              ctx.fillRect(x + fx * 20 + 5, fy, 2, 3 + Math.sin(animTime * 3.8 + fx) * 2);
            }
          }
          if (adj(tx, ty, 0, 1) !== 'river' && adj(tx, ty, 0, 1) !== 'water') {
            for (let fx = 0; fx < 4; fx++) {
              const fy = y + tileSize - 3 + Math.sin(animTime * 2.4 + fx) * 2;
              ctx.fillRect(x + fx * 20 + 8, fy, 2, 3 + Math.sin(animTime * 3.6 + fx) * 2);
            }
          }

          ctx.globalAlpha = 1;
        }
      }
    }

    this.renderAmbientParticles(ctx, cam, W, H, state);

    for (const deco of state.decorations) {
      if (deco.x < cam.x - W / 2 / cam.zoom - 80 || deco.x > cam.x + W / 2 / cam.zoom + 80) continue;
      if (deco.y < cam.y - H / 2 / cam.zoom - 120 || deco.y > cam.y + H / 2 / cam.zoom + 80) continue;

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      if (deco.type === 'tree') {
        ctx.ellipse(deco.x, deco.y + 12, 14, 5, 0, 0, Math.PI * 2);
      } else if (deco.type === 'rock') {
        ctx.ellipse(deco.x, deco.y + 8, 10, 4, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      if (deco.type === 'tree') {
        this.voxel.drawTreeVoxel(ctx, deco.x, deco.y, deco.seed);
      } else if (deco.type === 'rock') {
        this.voxel.drawRockVoxel(ctx, deco.x, deco.y, deco.seed);
      } else {
        this.drawStructureDecoration(ctx, deco);
      }
    }
  }

  private renderAmbientParticles(ctx: CanvasRenderingContext2D, cam: Camera, W: number, H: number, state: MobaState) {
    const animTime = state.gameTime;
    const viewLeft = cam.x - W / 2 / cam.zoom;
    const viewTop = cam.y - H / 2 / cam.zoom;
    const viewRight = cam.x + W / 2 / cam.zoom;
    const viewBottom = cam.y + H / 2 / cam.zoom;

    for (let i = 0; i < 30; i++) {
      const baseX = ((i * 374761393 + 12345) >>> 0) % MAP_SIZE;
      const baseY = ((i * 668265263 + 54321) >>> 0) % MAP_SIZE;
      if (baseX < viewLeft - 40 || baseX > viewRight + 40 || baseY < viewTop - 40 || baseY > viewBottom + 40) continue;

      const tx = Math.floor(baseX / 80);
      const ty = Math.floor(baseY / 80);
      if (tx < 0 || ty < 0 || tx >= TILE_GRID || ty >= TILE_GRID) continue;
      const terrainIdx = state.terrainMap[ty]?.[tx] ?? 0;
      const terrain = TERRAIN_LOOKUP[terrainIdx] || 'grass';

      if (terrain === 'jungle' || terrain === 'grass') {
        const px = baseX + Math.sin(animTime * 0.8 + i * 0.7) * 15;
        const py = baseY + Math.cos(animTime * 0.6 + i * 0.9) * 10 - Math.sin(animTime * 1.2 + i) * 8;
        const alpha = 0.15 + Math.sin(animTime * 2 + i * 1.3) * 0.15;
        ctx.fillStyle = '#a3e635';
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (terrain === 'base_blue' || terrain === 'base_red') {
        const px = baseX + Math.sin(animTime * 1.2 + i * 0.5) * 10;
        const py = baseY - Math.abs(Math.sin(animTime * 1.5 + i * 0.8)) * 20;
        const alpha = 0.1 + Math.sin(animTime * 3 + i * 1.5) * 0.1;
        ctx.fillStyle = terrain === 'base_blue' ? '#60a5fa' : '#f87171';
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.arc(px, py, 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (terrain === 'lane') {
        const px = baseX + Math.sin(animTime * 0.3 + i) * 5;
        const py = baseY + Math.cos(animTime * 0.4 + i * 0.6) * 3 - 5;
        const alpha = 0.06 + Math.sin(animTime * 1.5 + i * 2) * 0.04;
        ctx.fillStyle = '#d4c090';
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.arc(px, py, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawStructureDecoration(ctx: CanvasRenderingContext2D, deco: { x: number; y: number; type: string; seed: number }) {
    const structureStyles: Record<string, { color: string; accent: string; w: number; h: number; label: string }> = {
      coliseum: { color: '#8b7355', accent: '#c5a059', w: 60, h: 50, label: 'Arena' },
      barracks: { color: '#5c3d1e', accent: '#8b6c42', w: 40, h: 32, label: 'Barracks' },
      forge: { color: '#4a3728', accent: '#ef4444', w: 35, h: 28, label: 'Forge' },
      crypt: { color: '#2d2d3d', accent: '#6b21a8', w: 38, h: 34, label: 'Crypt' },
      necropolis_walls: { color: '#1f1f2e', accent: '#4a1f6b', w: 50, h: 20, label: '' },
      arch: { color: '#9ca3af', accent: '#c5a059', w: 24, h: 40, label: '' },
      tree_house: { color: '#3d5c1e', accent: '#8b6c42', w: 36, h: 38, label: '' },
      hellhouse: { color: '#3d1f1f', accent: '#dc2626', w: 38, h: 36, label: '' },
      cabin_shed: { color: '#6b4423', accent: '#8b7355', w: 30, h: 24, label: '' },
      storage_house: { color: '#5c4a32', accent: '#8b7355', w: 32, h: 26, label: '' },
      camp_fire_glb: { color: '#ef4444', accent: '#f97316', w: 12, h: 12, label: '' },
      gravestone: { color: '#6b7280', accent: '#374151', w: 10, h: 14, label: '' },
      tree_lava: { color: '#7f1d1d', accent: '#ef4444', w: 18, h: 30, label: '' },
    };
    const style = structureStyles[deco.type];
    if (!style) return;

    ctx.save();
    ctx.translate(deco.x, deco.y);

    if (deco.type === 'camp_fire_glb') {
      const flicker = Math.sin(Date.now() * 0.008 + deco.seed) * 3;
      const grd = ctx.createRadialGradient(0, 0, 2, 0, 0, 14 + flicker);
      grd.addColorStop(0, 'rgba(255,150,50,0.6)');
      grd.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(-16, -16, 32, 32);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -4, 6, 4);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-2, -8 - flicker, 4, 6);
    } else if (deco.type === 'gravestone') {
      ctx.fillStyle = style.color;
      ctx.fillRect(-4, -12, 8, 12);
      ctx.fillRect(-5, -14, 10, 3);
      ctx.fillStyle = style.accent;
      ctx.fillRect(-1, -10, 2, 6);
      ctx.fillRect(-3, -8, 6, 2);
    } else if (deco.type === 'tree_lava') {
      ctx.fillStyle = '#3d1f1f';
      ctx.fillRect(-3, -4, 6, 8);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(-3, -16, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (deco.type === 'arch') {
      ctx.fillStyle = style.color;
      ctx.fillRect(-12, -40, 6, 40);
      ctx.fillRect(6, -40, 6, 40);
      ctx.fillRect(-12, -40, 24, 6);
      ctx.fillStyle = style.accent;
      ctx.fillRect(-10, -38, 20, 2);
    } else {
      ctx.fillStyle = style.color;
      const hw = style.w / 2, hh = style.h / 2;
      ctx.fillRect(-hw, -hh, style.w, style.h);
      ctx.strokeStyle = style.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw, -hh, style.w, style.h);
      if (style.h > 24) {
        ctx.fillStyle = style.accent;
        ctx.fillRect(-hw + 3, -hh, style.w - 6, 4);
      }
      if (style.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.7;
        ctx.fillText(style.label, 0, 0);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
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

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const size = minion.minionType === 'siege' ? 10 : 7;
    this.voxel.drawMinionVoxel(ctx, 0, 0, color, size, minion.facing, minion.animTimer, minion.minionType);

    this.renderHealthBar(ctx, 0, -size - 8, 12, minion.hp, minion.maxHp, color);

    ctx.restore();
  }

  private renderJungleMob(ctx: CanvasRenderingContext2D, mob: JungleMob, _camp: JungleCamp) {
    const colors: Record<string, string> = { small: '#65a30d', medium: '#3b82f6', buff: '#a855f7' };
    const color = colors[mob.mobType] || '#65a30d';
    const size = mob.mobType === 'small' ? 10 : mob.mobType === 'medium' ? 14 : 22;

    ctx.save();
    ctx.translate(mob.x, mob.y);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.5, size * 0.7, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    this.voxel.drawJungleMobVoxel(ctx, 0, 0, mob.mobType, mob.facing, mob.animTimer);

    const barY = mob.mobType === 'buff' ? -32 : mob.mobType === 'medium' ? -22 : -14;
    this.renderHealthBar(ctx, 0, barY, size + 8, mob.hp, mob.maxHp, color);

    if (mob.targetId !== null) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5 + Math.sin(mob.animTimer * 6) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, size + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

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

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

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

    if (hero.blockActive) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.01) * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, 24, hero.facing - Math.PI / 3, hero.facing + Math.PI / 3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(245,158,11,0.1)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 24, hero.facing - Math.PI / 3, hero.facing + Math.PI / 3);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (hero.iFrames > 0) {
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.03) * 0.3;
    }

    if (hero.comboCount > 0 && hero.comboTimer > 0) {
      const comboAlpha = 0.3 + hero.comboCount * 0.15;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.globalAlpha = comboAlpha;
      for (let c = 0; c < hero.comboCount; c++) {
        const cAngle = (c / Math.max(hero.comboCount, 1)) * Math.PI * 2 + Date.now() * 0.005;
        ctx.beginPath();
        ctx.arc(Math.cos(cAngle) * 18, Math.sin(cAngle) * 18 - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
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

    this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, heroData.heroClass, hero.facing, hero.animState, hero.animTimer, heroData.race, heroData.name, hero.buffTimer, hero.items);

    if (hero.animState === 'attack' || hero.animState === 'ability' || hero.animState === 'combo_finisher') {
      const isMelee = heroData.heroClass === 'Warrior' || heroData.heroClass === 'Worg';
      const trailColor = heroData.heroClass === 'Mage' ? '#a855f7' : heroData.heroClass === 'Ranger' ? '#22d3ee' : heroData.heroClass === 'Worg' ? '#ff6622' : '#f59e0b';
      const trailGlowColor = heroData.heroClass === 'Mage' ? '#d8b4fe' : heroData.heroClass === 'Ranger' ? '#67e8f9' : heroData.heroClass === 'Worg' ? '#fbbf24' : '#fde68a';
      const swingPhase = Math.sin(hero.animTimer * (isMelee ? 10 : 6));
      const isCombo = hero.animState === 'combo_finisher';
      const trailIntensity = isCombo ? 1.4 : 1.0;

      if (isMelee && swingPhase > 0) {
        ctx.save();
        for (let trail = 2; trail >= 0; trail--) {
          const trailOffset = trail * 0.08;
          const trailAlpha = (swingPhase * 0.5 * trailIntensity) * (1 - trail * 0.3);
          ctx.globalAlpha = trailAlpha;
          ctx.strokeStyle = trail === 0 ? trailColor : trailGlowColor;
          ctx.lineWidth = isCombo ? 5 - trail : 3 - trail * 0.5;
          ctx.shadowColor = trailColor;
          ctx.shadowBlur = isCombo ? 14 : 8;
          const arcStart = hero.facing - Math.PI * (isCombo ? 0.9 : 0.6) - trailOffset;
          const arcEnd = hero.facing + Math.PI * (isCombo ? 0.5 : 0.3) * swingPhase + trailOffset;
          ctx.beginPath();
          ctx.arc(0, -5, 28 + trail * 3, arcStart, arcEnd);
          ctx.stroke();
        }
        ctx.restore();
      } else if (!isMelee && swingPhase > 0.3) {
        ctx.save();
        ctx.globalAlpha = swingPhase * 0.35 * trailIntensity;
        ctx.fillStyle = trailColor;
        ctx.shadowColor = trailGlowColor;
        ctx.shadowBlur = 12;
        const px = Math.cos(hero.facing) * 18;
        const py = Math.sin(hero.facing) * 18 - 10;
        ctx.beginPath();
        ctx.arc(px, py, 5 + swingPhase * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = swingPhase * 0.15;
        ctx.fillStyle = trailGlowColor;
        ctx.beginPath();
        ctx.arc(px, py, 8 + swingPhase * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

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

    const displayName = heroData.name.split(' ').pop() || heroData.name;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    const nameWidth = ctx.measureText(displayName).width;
    const pillW = Math.max(nameWidth + 10, 30);

    ctx.fillStyle = isPlayer ? 'rgba(50,40,10,0.85)' : 'rgba(0,0,0,0.65)';
    const pillY = -42;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(-pillW / 2 + r, pillY - 7);
    ctx.arcTo(pillW / 2, pillY - 7, pillW / 2, pillY + 5, r);
    ctx.arcTo(pillW / 2, pillY + 5, -pillW / 2, pillY + 5, r);
    ctx.arcTo(-pillW / 2, pillY + 5, -pillW / 2, pillY - 7, r);
    ctx.arcTo(-pillW / 2, pillY - 7, pillW / 2, pillY - 7, r);
    ctx.fill();

    if (isPlayer) {
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-pillW / 2 + r, pillY - 7);
      ctx.arcTo(pillW / 2, pillY - 7, pillW / 2, pillY + 5, r);
      ctx.arcTo(pillW / 2, pillY + 5, -pillW / 2, pillY + 5, r);
      ctx.arcTo(-pillW / 2, pillY + 5, -pillW / 2, pillY - 7, r);
      ctx.arcTo(-pillW / 2, pillY - 7, pillW / 2, pillY - 7, r);
      ctx.stroke();
    }

    ctx.fillStyle = isPlayer ? '#ffd700' : (RARITY_COLORS[heroData.rarity] || '#ccc');
    ctx.fillText(displayName, 0, pillY + 1);

    ctx.font = 'bold 7px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Lv${hero.level}`, 0, -32);

    ctx.restore();
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: Projectile, state: MobaState) {
    const target = findEntityById(state, proj.targetId);
    if (target) {
      const angle = Math.atan2(target.y - proj.y, target.x - proj.x);
      for (let i = 1; i <= 3; i++) {
        ctx.fillStyle = proj.color;
        ctx.globalAlpha = 0.3 - i * 0.08;
        ctx.beginPath();
        ctx.arc(
          proj.x - Math.cos(angle) * i * 8,
          proj.y - Math.sin(angle) * i * 8,
          proj.size * (1 - i * 0.2),
          0, Math.PI * 2
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size * 0.4, 0, Math.PI * 2);
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
    ctx.globalAlpha = Math.min(1, ft.life * 2);
    ctx.font = `bold ${ft.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  }

  private renderSpellEffect(ctx: CanvasRenderingContext2D, se: SpellEffect) {
    const progress = 1 - (se.life / se.maxLife);
    ctx.save();
    ctx.translate(se.x, se.y);

    if (se.type === 'slash_arc') {
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.lineCap = 'round';
      const sweep = Math.PI * 0.8;
      const startAngle = se.angle - sweep / 2;
      const r = se.radius * (0.5 + progress * 0.5);
      ctx.beginPath();
      ctx.arc(0, 0, r, startAngle, startAngle + sweep * progress);
      ctx.stroke();
      ctx.lineWidth = 2 * (1 - progress);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, startAngle + sweep * 0.2, startAngle + sweep * progress * 0.8);
      ctx.stroke();
    } else if (se.type === 'impact_ring') {
      const r = se.radius * progress;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = (1 - progress) * 0.1;
      ctx.fillStyle = se.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'dash_trail') {
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = se.radius * (1 - progress);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(se.angle) * 60 * progress, -Math.sin(se.angle) * 60 * progress);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const off = (i + 1) * 15 * progress;
        ctx.globalAlpha = (1 - progress) * 0.3 * (1 - i * 0.3);
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.arc(-Math.cos(se.angle) * off, -Math.sin(se.angle) * off, se.radius * (1 - progress) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (se.type === 'shield_flash') {
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 4 * (1 - progress);
      const r = se.radius * (0.8 + progress * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, se.angle - Math.PI / 3, se.angle + Math.PI / 3);
      ctx.stroke();
      ctx.fillStyle = se.color;
      ctx.globalAlpha = (1 - progress) * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'combo_burst') {
      const rays = 6;
      ctx.globalAlpha = (1 - progress) * 0.6;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + progress * Math.PI;
        const r = se.radius * progress;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
    } else if (se.type === 'ground_slam') {
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.fillStyle = se.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, se.radius * progress, se.radius * 0.3 * progress, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, se.radius * progress, se.radius * 0.3 * progress, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (se.type === 'fire_ring') {
      const r = se.radius * progress;
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff3300';
      ctx.lineWidth = 3 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, 'rgba(255,100,0,0.3)');
      grad.addColorStop(0.7, 'rgba(255,50,0,0.1)');
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'frost_ring') {
      const r = se.radius * Math.min(1, progress * 2);
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 5 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, 'rgba(34,211,238,0.2)');
      grad.addColorStop(0.8, 'rgba(103,232,249,0.1)');
      grad.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'meteor_shadow') {
      const r = se.radius * progress * 0.6;
      ctx.globalAlpha = 0.4 + progress * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 2;
      ctx.globalAlpha = progress * 0.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, se.radius * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (se.type === 'meteor_impact') {
      const r = se.radius * (0.5 + progress * 0.5);
      ctx.globalAlpha = (1 - progress) * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(255,200,50,${(1 - progress) * 0.5})`);
      grad.addColorStop(0.4, `rgba(255,100,0,${(1 - progress) * 0.3})`);
      grad.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'arrow_rain') {
      ctx.globalAlpha = 0.15 + (1 - progress) * 0.15;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, se.radius);
      grad.addColorStop(0, 'rgba(34,197,94,0.1)');
      grad.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.fill();
      const t = se.maxLife - se.life;
      for (let a = 0; a < 5; a++) {
        const ax = Math.sin(t * 8 + a * 1.3) * se.radius * 0.7;
        const ay = Math.cos(t * 6 + a * 2.1) * se.radius * 0.7;
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 8);
        ctx.lineTo(ax, ay + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ax - 2, ay - 4);
        ctx.lineTo(ax, ay - 8);
        ctx.lineTo(ax + 2, ay - 4);
        ctx.stroke();
      }
    } else if (se.type === 'whirlwind_slash') {
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.lineCap = 'round';
      const sweep = Math.PI * 0.6;
      const r = se.radius * (0.6 + progress * 0.4);
      const startAngle = se.angle + progress * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, startAngle, startAngle + sweep);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, startAngle + sweep * 0.1, startAngle + sweep * 0.9);
      ctx.stroke();
    } else if (se.type === 'ground_scorch') {
      ctx.globalAlpha = (1 - progress) * 0.3;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, se.radius);
      grad.addColorStop(0, 'rgba(50,30,0,0.5)');
      grad.addColorStop(0.6, 'rgba(30,15,0,0.3)');
      grad.addColorStop(1, 'rgba(20,10,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'ground_frost') {
      ctx.globalAlpha = (1 - progress) * 0.25;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, se.radius);
      grad.addColorStop(0, 'rgba(34,211,238,0.4)');
      grad.addColorStop(0.5, 'rgba(103,232,249,0.2)');
      grad.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(103,232,249,0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + progress * 0.3;
        const r = se.radius * (0.3 + (((i * 37 + 13) % 17) / 17) * 0.5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
        const branchA = a + 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        ctx.lineTo(Math.cos(branchA) * r * 0.7, Math.sin(branchA) * r * 0.7);
        ctx.stroke();
      }
    } else if (se.type === 'cast_circle') {
      const r = se.radius * (0.5 + progress * 0.5);
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 2 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `${se.color}40`);
      grad.addColorStop(1, `${se.color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'telegraph_circle') {
      const pulsePhase = Math.sin((se.maxLife - se.life) * 12) * 0.15;
      ctx.globalAlpha = 0.15 + pulsePhase + progress * 0.2;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, se.radius);
      grad.addColorStop(0, `${se.color}08`);
      grad.addColorStop(0.8, `${se.color}15`);
      grad.addColorStop(1, `${se.color}00`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3 + progress * 0.3;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else if (se.type === 'axe_chop') {
      ctx.globalAlpha = (1 - progress) * 0.85;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 5 * (1 - progress);
      ctx.lineCap = 'round';
      const r = se.radius * (0.4 + progress * 0.6);
      const startAngle = se.angle - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(startAngle) * r * 0.2, Math.sin(startAngle) * r * 0.2);
      ctx.lineTo(0, 0);
      ctx.lineTo(Math.cos(se.angle) * r, Math.sin(se.angle) * r);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.6, se.angle - 0.3, se.angle + 0.3);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const spread = (Math.random() - 0.5) * 0.8;
        const sparkR = r * (0.3 + Math.random() * 0.7);
        ctx.fillStyle = '#fbbf24';
        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(se.angle + spread) * sparkR, Math.sin(se.angle + spread) * sparkR, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (se.type === 'spear_thrust') {
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 3 * (1 - progress);
      ctx.lineCap = 'round';
      const len = se.radius * (0.5 + progress * 0.5);
      ctx.beginPath();
      ctx.moveTo(-Math.cos(se.angle) * len * 0.3, -Math.sin(se.angle) * len * 0.3);
      ctx.lineTo(Math.cos(se.angle) * len, Math.sin(se.angle) * len);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(se.angle) * len * 0.5, Math.sin(se.angle) * len * 0.5);
      ctx.lineTo(Math.cos(se.angle) * len, Math.sin(se.angle) * len);
      ctx.stroke();
      const tipX = Math.cos(se.angle) * len;
      const tipY = Math.sin(se.angle) * len;
      ctx.fillStyle = se.color;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4 * (1 - progress), 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'glaive_sweep') {
      ctx.globalAlpha = (1 - progress) * 0.75;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.lineCap = 'round';
      const r = se.radius * (0.5 + progress * 0.5);
      const fullSweep = Math.PI * 1.5;
      const startAngle = se.angle - fullSweep / 2 + progress * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, startAngle, startAngle + fullSweep * (1 - progress * 0.3));
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, startAngle + fullSweep * 0.1, startAngle + fullSweep * 0.9);
      ctx.stroke();
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 2 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, startAngle, startAngle + fullSweep);
      ctx.stroke();
    } else if (se.type === 'blood_fury_aura') {
      const pulseR = se.radius * (0.8 + Math.sin(progress * Math.PI * 6) * 0.2);
      ctx.globalAlpha = (1 - progress) * 0.5;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pulseR);
      grad.addColorStop(0, 'rgba(220,38,38,0.4)');
      grad.addColorStop(0.5, 'rgba(239,68,68,0.2)');
      grad.addColorStop(1, 'rgba(220,38,38,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + progress * Math.PI * 3;
        const pr = pulseR * 0.6;
        ctx.fillStyle = '#ef4444';
        ctx.globalAlpha = (1 - progress) * 0.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * pr, Math.sin(a) * pr, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (se.type === 'fear_wave') {
      const waveR = se.radius * progress;
      ctx.globalAlpha = (1 - progress) * 0.6;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 2 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, waveR * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      const grad = ctx.createRadialGradient(0, 0, waveR * 0.3, 0, 0, waveR);
      grad.addColorStop(0, 'rgba(101,163,13,0.15)');
      grad.addColorStop(1, 'rgba(101,163,13,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = (1 - progress) * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, waveR, 0, Math.PI * 2);
      ctx.fill();
    } else if (se.type === 'cleave_arc') {
      ctx.globalAlpha = (1 - progress) * 0.8;
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 5 * (1 - progress);
      ctx.lineCap = 'round';
      const halfWidth = se.data?.halfWidth || Math.PI / 3;
      const r = se.radius * (0.5 + progress * 0.5);
      const startAngle = se.angle - halfWidth;
      const endAngle = se.angle + halfWidth;
      ctx.beginPath();
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5 * (1 - progress);
      ctx.globalAlpha = (1 - progress) * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, startAngle + halfWidth * 0.2, endAngle - halfWidth * 0.2);
      ctx.stroke();
      ctx.fillStyle = se.color;
      ctx.globalAlpha = (1 - progress) * 0.1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
    } else if (se.type === 'dance_blades') {
      const hits = se.data?.hits || 8;
      const activeHit = Math.floor(progress * hits);
      for (let i = 0; i < hits; i++) {
        const a = (i / hits) * Math.PI * 2 + progress * Math.PI * 4;
        const bladeR = se.radius * (0.4 + Math.sin(progress * Math.PI * 3 + i) * 0.2);
        const alpha = i <= activeHit ? (1 - progress) * 0.7 : (1 - progress) * 0.2;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 3 * (1 - progress);
        ctx.lineCap = 'round';
        const bladeLen = 15 * (1 - progress);
        const bx = Math.cos(a) * bladeR;
        const by = Math.sin(a) * bladeR;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a + Math.PI / 4) * bladeLen, by - Math.sin(a + Math.PI / 4) * bladeLen);
        ctx.lineTo(bx + Math.cos(a + Math.PI / 4) * bladeLen, by + Math.sin(a + Math.PI / 4) * bladeLen);
        ctx.stroke();
      }
      ctx.globalAlpha = (1 - progress) * 0.15;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, se.radius);
      grad.addColorStop(0, 'rgba(34,211,238,0.2)');
      grad.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, se.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderAreaDamageZone(ctx: CanvasRenderingContext2D, zone: AreaDamageZoneState, gameTime: number) {
    ctx.save();
    ctx.translate(zone.x, zone.y);
    const lifeRatio = zone.life / zone.maxLife;
    const t = gameTime;

    const zoneVisuals: Record<string, { fill: string; stroke: string }> = {
      fire: { fill: 'rgba(239,68,68,0.12)', stroke: '#ef4444' },
      frost: { fill: 'rgba(96,165,250,0.12)', stroke: '#60a5fa' },
      poison: { fill: 'rgba(34,197,94,0.1)', stroke: '#22c55e' },
      lightning: { fill: 'rgba(250,204,21,0.12)', stroke: '#facc15' },
      holy: { fill: 'rgba(251,191,36,0.12)', stroke: '#fbbf24' },
      shadow: { fill: 'rgba(139,92,246,0.12)', stroke: '#8b5cf6' },
    };
    const vis = zoneVisuals[zone.zoneType] || zoneVisuals.fire;

    ctx.globalAlpha = lifeRatio * 0.6;
    ctx.fillStyle = vis.fill;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = vis.stroke;
    ctx.lineWidth = 2;
    ctx.globalAlpha = lifeRatio * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius, 0, Math.PI * 2);
    ctx.stroke();

    const innerPulse = 0.5 + Math.sin(t * 4) * 0.2;
    ctx.lineWidth = 1;
    ctx.globalAlpha = lifeRatio * innerPulse * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, zone.radius * (0.4 + Math.sin(t * 3) * 0.1), 0, Math.PI * 2);
    ctx.stroke();

    if (zone.zoneType === 'fire') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.5;
        const r = zone.radius * (0.3 + 0.5 * ((i * 7 + 3) % 5) / 5);
        ctx.globalAlpha = lifeRatio * 0.3;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (zone.zoneType === 'frost') {
      ctx.globalAlpha = lifeRatio * 0.15;
      ctx.strokeStyle = '#93c5fd';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.1;
        const r = zone.radius * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
    } else if (zone.zoneType === 'lightning') {
      if (Math.random() < 0.1) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        const a = Math.random() * Math.PI * 2;
        const r = zone.radius * Math.random();
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        for (let s = 0; s < 4; s++) {
          ctx.lineTo(
            Math.cos(a + (Math.random() - 0.5) * 0.5) * r * (0.4 + s * 0.2),
            Math.sin(a + (Math.random() - 0.5) * 0.5) * r * (0.4 + s * 0.2)
          );
        }
        ctx.stroke();
      }
    }

    if (zone.tickTimer < 0.15 && zone.ticksRemaining < zone.maxLife / zone.tickInterval) {
      const flashAlpha = (0.15 - zone.tickTimer) / 0.15;
      ctx.globalAlpha = flashAlpha * 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, zone.radius * (zone.tickTimer / 0.15), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, halfWidth: number, hp: number, maxHp: number, color: string) {
    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(x - halfWidth - 1, y - 1, halfWidth * 2 + 2, 6);
    const barColor = pct > 0.5 ? color : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = barColor;
    ctx.fillRect(x - halfWidth, y, halfWidth * 2 * pct, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - halfWidth, y, halfWidth * 2 * pct, 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - halfWidth - 1, y - 1, halfWidth * 2 + 2, 6);
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

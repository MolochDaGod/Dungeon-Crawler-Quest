/**
 * Open World Game Engine - Phase 4
 * Replaces floor-based dungeon with zone-based open world.
 * Reuses dungeon combat, abilities, items, and enemy types.
 * Integrates with world-state.ts, zones.ts, player-progress.ts.
 */

import {
  HeroData, HEROES, Vec2, AbilityDef, ItemDef, ITEMS,
  heroStatsAtLevel, RACE_COLORS, CLASS_COLORS,
  getHeroAbilities, getWeaponRenderType, getHeroWeapon
} from './types';
import { VoxelRenderer, DungeonTileVoxelType } from './voxel';
import { globalAnimDirector } from './voxel-motion';
import {
  StatusEffect, StatusEffectType, createStatusEffect, applyStatusEffect,
  updateStatusEffects, isStunned, isRooted, isSilenced, getSpeedMultiplier,
  hasLifesteal, getAbilityStatusEffects, calculateDamage as combatCalcDamage,
  CombatEntity, EFFECT_COLORS
} from './combat';
import {
  WorldState, WeatherType, createWorldState, updateWorldState,
  saveWorldState, loadWorldStatePersisted, pushWorldEvent,
  getSunIntensity, getAmbientBrightness, getWeatherSpeedMod,
  getFormattedTime, isDayTime, getWeatherIcon, getWeatherDescription,
  spawnWorldBoss, defeatWorldBoss, WEATHER_INFO
} from './world-state';
import {
  ZoneDef, ISLAND_ZONES, OPEN_WORLD_SIZE, getZoneAtPosition, canEnterZone,
  getZoneById, getZoneColor, ZoneTracker, createZoneTracker, updateZoneTracker
} from './zones';
import {
  PlayerProgress, createPlayerProgress, savePlayerProgress, loadPlayerProgress,
  onZoneDiscovered, onMonsterKilled, onPlayerLevelUp, onPlayerDeath,
  updatePlayTime, getReputationRank, getReputationColor, ProgressEvent
} from './player-progress';
import {
  WeaponSkillLoadout, buildWeaponLoadout, getAbilitiesWithWeapon,
  getOSWeaponTypeKey, saveLoadout, applySavedSelections, buildAbilitiesFromLoadout
} from './weapon-skills';
import { HERO_WEAPONS } from './types';
import {
  PlayerAttributes, loadAttributes, saveAttributes, grantLevelUpPoints,
  applyAttributeBonus, computeDerivedStats, allocatePoint, AttributeId,
  getAttributeSummary, AttributeSummary
} from './attributes';
import {
  PlayerProfessions, loadProfessions, saveProfessions,
  performHarvest, gainProfessionXp, addResource,
  ResourceInventory, loadResourceInventory, saveResourceInventory,
  getProfessionSummaries, ProfessionSummaryItem,
  GATHERING_PROFESSIONS
} from './professions-system';
import {
  PlayerEquipment, loadEquipment, saveEquipment,
  EquipmentBag, loadEquipmentBag, saveEquipmentBag,
  equipItem, computeEquipmentStats, computeSetBonuses,
  generateRandomEquipment, addToBag, SetBonus
} from './equipment';

// ── Constants ──────────────────────────────────────────────────

const TILE_SIZE = 40;
const OW_VIEW_RANGE = 800;       // pixels visible around player
const SPAWN_RADIUS = 1200;       // only spawn/update enemies within this
const DESPAWN_RADIUS = 1600;     // enemies beyond this are removed
const AGGRO_RANGE = 400;

// Zone → terrain tile type mapping
const ZONE_TERRAIN: Record<string, DungeonTileVoxelType> = {
  grass: 'floor',
  jungle: 'floor',
  water: 'floor',
  stone: 'floor',
  dirt: 'floor',
};

// ── Enemy Templates (same as dungeon, reused) ──────────────────

const ENEMY_TEMPLATES: Record<string, {
  hp: number; atk: number; def: number; spd: number; rng: number;
  color: string; xp: number; gold: number; isBoss: boolean; size: number;
}> = {
  Slime:      { hp: 80,  atk: 8,  def: 2,  spd: 40,  rng: 50,  color: '#22c55e', xp: 15,  gold: 8,   isBoss: false, size: 8  },
  Skeleton:   { hp: 100, atk: 12, def: 5,  spd: 55,  rng: 60,  color: '#d4d4d8', xp: 25,  gold: 12,  isBoss: false, size: 10 },
  'Orc Grunt':{ hp: 150, atk: 18, def: 8,  spd: 50,  rng: 60,  color: '#65a30d', xp: 35,  gold: 18,  isBoss: false, size: 12 },
  'Dark Mage':{ hp: 90,  atk: 22, def: 4,  spd: 45,  rng: 200, color: '#7c3aed', xp: 40,  gold: 22,  isBoss: false, size: 10 },
  Spider:     { hp: 70,  atk: 14, def: 3,  spd: 70,  rng: 50,  color: '#78716c', xp: 20,  gold: 10,  isBoss: false, size: 9  },
  Golem:      { hp: 300, atk: 25, def: 20, spd: 30,  rng: 60,  color: '#a16207', xp: 60,  gold: 35,  isBoss: false, size: 16 },
  Dragon:     { hp: 800, atk: 40, def: 18, spd: 45,  rng: 150, color: '#dc2626', xp: 200, gold: 150, isBoss: true,  size: 24 },
  Lich:       { hp: 600, atk: 35, def: 12, spd: 40,  rng: 250, color: '#6b21a8', xp: 180, gold: 120, isBoss: true,  size: 20 },
};

// ── Interfaces ─────────────────────────────────────────────────

export interface OWEnemy {
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
  homeX: number;
  homeY: number;
  leashRange: number;
  zoneId: number;
  spawnIndex: number;    // which monsterSpawn this came from
  respawnTimer: number;  // countdown after death
  level: number;
}

export interface OWPlayer {
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

export interface OWProjectile {
  id: number;
  x: number; y: number;
  targetId: number;
  damage: number;
  speed: number;
  color: string;
  size: number;
  sourceIsPlayer: boolean;
}

export interface OWParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

export interface OWFloatingText {
  x: number; y: number;
  text: string; color: string;
  life: number; vy: number; size: number;
}

export interface OWSpellEffect {
  x: number; y: number;
  type: 'cast_circle' | 'impact_ring' | 'aoe_blast' | 'skillshot_trail' | 'cone_sweep' | 'dash_trail';
  life: number; maxLife: number;
  radius: number;
  color: string;
  angle: number;
  data?: any;
}

export interface OWTargeting {
  active: boolean;
  abilityIndex: number;
  castType: 'targeted' | 'skillshot' | 'ground_aoe' | 'self_cast' | 'cone' | 'line';
  range: number;
  radius: number;
  color: string;
}

// NPC stub for safe zone merchants / quest givers
export interface OWNPC {
  id: number;
  x: number; y: number;
  name: string;
  type: 'merchant' | 'quest' | 'trainer' | 'crafter';
  zoneId: number;
  facing: number;
}

// Resource node for harvesting
export interface OWResourceNode {
  id: number;
  x: number; y: number;
  professionId: string;  // gathering profession: mining, logging, etc.
  tier: number;
  depleted: boolean;
  respawnTimer: number;
  zoneId: number;
}

// Respawn queue for dead spawn points
interface SpawnRespawn {
  zoneId: number;
  spawnIndex: number;
  timer: number;
  count: number;
}

export interface OpenWorldState {
  player: OWPlayer;
  enemies: OWEnemy[];
  npcs: OWNPC[];
  projectiles: OWProjectile[];
  particles: OWParticle[];
  floatingTexts: OWFloatingText[];
  spellEffects: OWSpellEffect[];
  camera: { x: number; y: number; zoom: number };
  nextId: number;
  gameOver: boolean;
  paused: boolean;
  showInventory: boolean;
  killFeed: { text: string; color: string; time: number }[];
  gameTime: number;
  mouseWorld: Vec2;
  targeting: OWTargeting;

  // Open-world systems
  worldState: WorldState;
  zoneTracker: ZoneTracker;
  playerProgress: PlayerProgress;
  pendingProgressEvents: ProgressEvent[];
  spawnRespawns: SpawnRespawn[];

  // Weapon-based skill system
  weaponLoadout: WeaponSkillLoadout | null;
  weaponLoadoutReady: boolean;

  // Attributes system
  playerAttributes: PlayerAttributes;

  // RPG systems
  playerProfessions: PlayerProfessions;
  resourceInventory: ResourceInventory;
  playerEquipment: PlayerEquipment;
  equipmentBag: EquipmentBag;
  resourceNodes: OWResourceNode[];
  harvestCooldown: number;

  // Terrain cache (only tiles near player are generated)
  terrainCache: Map<string, DungeonTileVoxelType>;
}

export interface OWHudState {
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  level: number; xp: number; xpToNext: number;
  gold: number;
  kills: number;
  items: (ItemDef | null)[];
  abilityCooldowns: number[];
  heroName: string; heroClass: string; heroRace: string;
  gameOver: boolean;
  activeEffects: StatusEffect[];
  atk: number; def: number; spd: number;
  killFeed: { text: string; color: string; time: number }[];
  gameTime: number;
  showInventory: boolean;
  animState: string;
  animTimer: number;
  facing: string;
  px: number; py: number;
  // Open-world additions
  zoneName: string;
  zonePvP: boolean;
  zoneSafe: boolean;
  worldTime: string;
  worldTimeRaw: number;
  weatherIcon: string;
  weatherLabel: string;
  isDayTime: boolean;
  ambientBrightness: number;
  reputation: number;
  reputationRank: string;
  reputationColor: string;
  zonesDiscovered: number;
  monstersSlain: number;
  bossesDefeated: number;
  pendingEvents: ProgressEvent[];
  worldBossActive: boolean;
  worldBossName: string;
  worldBossHp: number;
  worldBossMaxHp: number;
  // Weapon skill info
  abilityNames: string[];
  abilityDescriptions: string[];
  weaponType: string;
  weaponLoadoutReady: boolean;
  // Attributes
  attributeSummary: AttributeSummary;
}

// ── Helpers ────────────────────────────────────────────────────

function xpForLevel(level: number): number {
  return 80 + (level - 1) * 60;
}

function distXY(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Simple open-world walkability: within bounds, not in collision zone
function isWalkableOW(x: number, y: number): boolean {
  return x >= 10 && y >= 10 && x < OPEN_WORLD_SIZE - 10 && y < OPEN_WORLD_SIZE - 10;
}

// Get terrain type for a tile based on which zone it falls in
function getTerrainForPosition(wx: number, wy: number): DungeonTileVoxelType {
  const zone = getZoneAtPosition(wx, wy);
  if (!zone) return 'wall'; // outside any zone = impassable terrain
  return ZONE_TERRAIN[zone.terrainType] || 'floor';
}

// ── Create State ───────────────────────────────────────────────

export function createOpenWorldState(heroId: number): OpenWorldState {
  const hd = HEROES.find(h => h.id === heroId) || HEROES[0];
  const baseStats = heroStatsAtLevel(hd, 1);
  const playerAttrs = loadAttributes(hd.heroClass);
  const stats = applyAttributeBonus(baseStats, playerAttrs, hd.heroClass);

  // Start in the Starting Village
  const startZone = ISLAND_ZONES[0];
  const spawn = startZone.playerSpawns[0];

  const worldState = createWorldState();
  loadWorldStatePersisted(worldState);

  const state: OpenWorldState = {
    player: {
      id: 1,
      heroDataId: hd.id,
      x: spawn.x, y: spawn.y,
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
    npcs: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    spellEffects: [],
    camera: { x: spawn.x, y: spawn.y, zoom: 1.2 },
    nextId: 100,
    gameOver: false,
    paused: false,
    showInventory: false,
    killFeed: [],
    gameTime: 0,
    mouseWorld: { x: 0, y: 0 },
    targeting: {
      active: false, abilityIndex: -1,
      castType: 'targeted', range: 0, radius: 0, color: '#fff',
    },
    worldState,
    zoneTracker: createZoneTracker(),
    playerProgress: loadPlayerProgress(),
    pendingProgressEvents: [],
    spawnRespawns: [],
    weaponLoadout: null,
    weaponLoadoutReady: false,
    playerAttributes: playerAttrs,
    playerProfessions: loadProfessions(),
    resourceInventory: loadResourceInventory(),
    playerEquipment: loadEquipment(),
    equipmentBag: loadEquipmentBag(),
    resourceNodes: [],
    harvestCooldown: 0,
    terrainCache: new Map(),
  };

  // Generate NPCs and resource nodes from zone definitions
  generateNPCs(state);
  generateResourceNodes(state);

  // Initial zone discovery
  const enterEvents = onZoneDiscovered(state.playerProgress, startZone.id, startZone.name);
  state.pendingProgressEvents.push(...enterEvents);

  // Initialize weapon loadout asynchronously
  initWeaponLoadout(state, hd);

  return state;
}

async function initWeaponLoadout(state: OpenWorldState, hd: HeroData): Promise<void> {
  try {
    const raceClass = `${hd.race}_${hd.heroClass}`;
    const weaponType = (HERO_WEAPONS as Record<string, string>)[raceClass]
      || (HERO_WEAPONS as Record<string, string>)[hd.heroClass]
      || 'swords';
    const osKey = getOSWeaponTypeKey(weaponType);
    const weaponId = hd.equippedWeaponId || null;
    const loadout = await buildWeaponLoadout(osKey, weaponId, hd.race, hd.heroClass);
    if (loadout) {
      applySavedSelections(loadout);
      state.weaponLoadout = loadout;
      state.weaponLoadoutReady = true;
      state.killFeed.push({ text: `Weapon skills loaded: ${weaponType}`, color: '#60a5fa', time: state.gameTime });
    }
  } catch {
    // fallback to class abilities — already the default
  }
}

function generateNPCs(state: OpenWorldState): void {
  for (const zone of ISLAND_ZONES) {
    for (let i = 0; i < zone.npcPositions.length; i++) {
      const pos = zone.npcPositions[i];
      state.npcs.push({
        id: state.nextId++,
        x: pos.x, y: pos.y,
        name: zone.isSafeZone ? (i === 0 ? 'Merchant' : i === 1 ? 'Trainer' : 'Quest Giver') : 'Wanderer',
        type: zone.isSafeZone ? (i === 0 ? 'merchant' : i === 1 ? 'trainer' : 'quest') : 'quest',
        zoneId: zone.id,
        facing: Math.random() * Math.PI * 2,
      });
    }
  }
}

// ── Resource Nodes ─────────────────────────────────────────────

const ZONE_RESOURCE_MAP: Record<string, string[]> = {
  grass:  ['herbalism', 'logging'],
  jungle: ['logging', 'herbalism', 'skinning'],
  water:  ['fishing', 'herbalism'],
  stone:  ['mining', 'scavenging'],
  dirt:   ['mining', 'logging', 'skinning'],
  sand:   ['fishing', 'scavenging'],
  ruins:  ['scavenging', 'mining'],
};

function generateResourceNodes(state: OpenWorldState): void {
  for (const zone of ISLAND_ZONES) {
    if (zone.isSafeZone) continue;
    const profTypes = ZONE_RESOURCE_MAP[zone.terrainType] || ['mining'];
    const tier = Math.max(1, Math.min(8, Math.ceil(zone.requiredLevel / 3)));
    const nodeCount = 4 + Math.floor(zone.bounds.w * zone.bounds.h / 1000000);

    for (let i = 0; i < nodeCount; i++) {
      const b = zone.bounds;
      const x = b.x + 100 + Math.random() * (b.w - 200);
      const y = b.y + 100 + Math.random() * (b.h - 200);
      const profId = profTypes[i % profTypes.length];
      state.resourceNodes.push({
        id: state.nextId++,
        x, y,
        professionId: profId,
        tier,
        depleted: false,
        respawnTimer: 0,
        zoneId: zone.id,
      });
    }
  }
}

/** Handle E key harvesting interaction */
export function handleOWHarvest(state: OpenWorldState): void {
  if (state.harvestCooldown > 0 || state.player.dead) return;
  const p = state.player;

  // Find nearest non-depleted resource node within range
  let nearest: OWResourceNode | null = null;
  let nearestDist = 80;
  for (const node of state.resourceNodes) {
    if (node.depleted) continue;
    const d = distXY(p, node);
    if (d < nearestDist) { nearestDist = d; nearest = node; }
  }
  if (!nearest) return;

  const result = performHarvest(nearest.professionId, nearest.tier, state.playerProfessions);
  if (!result) {
    addText(state, p.x, p.y - 30, 'Too low level!', '#ef4444', 12);
    return;
  }

  // Add resources to inventory
  for (const r of result.resources) {
    addResource(state.resourceInventory, r.name, r.tier, r.quantity);
    addText(state, nearest.x, nearest.y - 20, `+${r.quantity} ${r.name}`, '#ffd700', 12);
  }

  // Grant gathering XP
  const levelUp = gainProfessionXp(state.playerProfessions, 'gathering', nearest.professionId, result.xpGained);
  addText(state, p.x, p.y - 15, `+${result.xpGained} XP`, '#60a5fa', 10);
  if (levelUp.leveled) {
    state.killFeed.push({ text: `${nearest.professionId} leveled to ${levelUp.newLevel}!`, color: '#ffd700', time: state.gameTime });
  }

  // Equipment drop chance
  if (result.gearDrop) {
    const drop = generateRandomEquipment(nearest.tier);
    addToBag(state.equipmentBag, drop);
    addText(state, nearest.x, nearest.y - 35, `GEAR: ${drop.name}!`, '#a855f7', 14);
    state.killFeed.push({ text: `Found equipment: ${drop.name}`, color: '#a855f7', time: state.gameTime });
    saveEquipmentBag(state.equipmentBag);
  }

  // Deplete node
  nearest.depleted = true;
  nearest.respawnTimer = 30 + nearest.tier * 10;
  state.harvestCooldown = 1.5;
  spawnParticles(state, nearest.x, nearest.y, '#ffd700', 8);

  // Save
  saveProfessions(state.playerProfessions);
  saveResourceInventory(state.resourceInventory);
}

function updateResourceNodes(state: OpenWorldState, dt: number): void {
  state.harvestCooldown = Math.max(0, state.harvestCooldown - dt);
  for (const node of state.resourceNodes) {
    if (node.depleted) {
      node.respawnTimer -= dt;
      if (node.respawnTimer <= 0) {
        node.depleted = false;
      }
    }
  }
}

// ── Spawning ───────────────────────────────────────────────────

function spawnEnemiesNearPlayer(state: OpenWorldState): void {
  const p = state.player;

  for (const zone of ISLAND_ZONES) {
    // Only process zones whose bounds overlap with spawn radius
    const b = zone.bounds;
    if (p.x + SPAWN_RADIUS < b.x || p.x - SPAWN_RADIUS > b.x + b.w) continue;
    if (p.y + SPAWN_RADIUS < b.y || p.y - SPAWN_RADIUS > b.y + b.h) continue;

    for (let si = 0; si < zone.monsterSpawns.length; si++) {
      const ms = zone.monsterSpawns[si];
      const d = distXY(p, ms);
      if (d > SPAWN_RADIUS) continue;

      // Check if already spawned
      const alreadyAlive = state.enemies.filter(
        e => e.zoneId === zone.id && e.spawnIndex === si && !e.dead
      ).length;
      if (alreadyAlive >= ms.count) continue;

      // Check if in respawn queue
      const inRespawn = state.spawnRespawns.some(
        r => r.zoneId === zone.id && r.spawnIndex === si
      );
      if (inRespawn) continue;

      const template = ENEMY_TEMPLATES[ms.type];
      if (!template) continue;

      const toSpawn = ms.count - alreadyAlive;
      for (let j = 0; j < toSpawn; j++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 80;
        const ex = ms.x + Math.cos(angle) * dist;
        const ey = ms.y + Math.sin(angle) * dist;
        const scale = 1 + (ms.level - 1) * 0.12;

        state.enemies.push({
          id: state.nextId++,
          x: ex, y: ey,
          type: ms.type,
          hp: Math.floor(template.hp * scale),
          maxHp: Math.floor(template.hp * scale),
          atk: Math.floor(template.atk * scale),
          def: Math.floor(template.def * scale),
          spd: template.spd,
          rng: template.rng,
          facing: Math.random() * Math.PI * 2,
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
          homeX: ms.x,
          homeY: ms.y,
          leashRange: 500,
          zoneId: zone.id,
          spawnIndex: si,
          respawnTimer: 0,
          level: ms.level,
        });
      }
    }
  }
}

// ── Update Loop ────────────────────────────────────────────────

export function updateOpenWorld(state: OpenWorldState, dt: number, keys: Set<string>): void {
  if (state.paused || state.gameOver) return;
  state.gameTime += dt;

  const p = state.player;

  // Update world systems
  updateWorldState(state.worldState, dt);
  const progressEvents = updatePlayTime(state.playerProgress, dt);
  state.pendingProgressEvents.push(...progressEvents);

  // Zone tracking
  const newZone = updateZoneTracker(state.zoneTracker, p.x, p.y, dt);
  if (newZone) {
    const zEvents = onZoneDiscovered(state.playerProgress, newZone.id, newZone.name);
    state.pendingProgressEvents.push(...zEvents);
    pushWorldEvent(state.worldState, 'zone_enter', newZone.name, newZone.description, 4);
    state.playerProgress.currentZoneName = newZone.name;
    state.killFeed.push({ text: `Entered: ${newZone.name}`, color: getZoneColor(newZone), time: state.gameTime });

    if (!canEnterZone(p.level, newZone)) {
      state.killFeed.push({ text: `Warning: Level ${newZone.requiredLevel} recommended!`, color: '#ef4444', time: state.gameTime });
    }
  }

  // World boss auto-spawn check
  if (!state.worldState.worldBoss.active && state.worldState.worldBoss.spawnTimer >= state.worldState.worldBossSpawnInterval) {
    const bossZone = ISLAND_ZONES[7]; // Boss Arena
    spawnWorldBoss(state.worldState, 'Ancient Dragon Lord', bossZone.playerSpawns[0].x, bossZone.playerSpawns[0].y, 5000);
    state.killFeed.push({ text: 'WORLD BOSS: Ancient Dragon Lord has appeared!', color: '#ffd700', time: state.gameTime });
  }

  if (p.dead) return;

  // Player update
  p.animTimer += dt;
  // Mana regen boosted by WIS
  const derived = computeDerivedStats(state.playerAttributes);
  p.mp = Math.min(p.maxMp, p.mp + dt * derived.manaRegen);

  const effectResult = updateStatusEffects(p as any as CombatEntity, dt);
  if (effectResult.damage > 0) {
    p.hp -= effectResult.damage;
    addText(state, p.x, p.y - 20, `-${Math.floor(effectResult.damage)}`, '#ef4444', 12);
  }
  if (effectResult.heal > 0) {
    p.hp = Math.min(p.maxHp, p.hp + effectResult.heal);
    addText(state, p.x, p.y - 20, `+${Math.floor(effectResult.heal)}`, '#22c55e', 12);
  }

  // Movement (weather affects speed)
  if (!isStunned(p as any as CombatEntity)) {
    let mx = 0, my = 0;
    if (keys.has('w') || keys.has('arrowup')) my = -1;
    if (keys.has('s') || keys.has('arrowdown')) my = 1;
    if (keys.has('a') || keys.has('arrowleft')) mx = -1;
    if (keys.has('d') || keys.has('arrowright')) mx = 1;

    const spdMult = getSpeedMultiplier(p as any as CombatEntity) * getWeatherSpeedMod(state.worldState);
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
    if (isWalkableOW(nx, p.y)) p.x = nx;
    if (isWalkableOW(p.x, ny)) p.y = ny;
  }

  // Ability cooldowns
  for (let i = 0; i < p.abilityCooldowns.length; i++) {
    if (p.abilityCooldowns[i] > 0) p.abilityCooldowns[i] -= dt;
  }

  // Resource nodes
  updateResourceNodes(state, dt);

  // E key harvesting
  if (keys.has('e')) {
    handleOWHarvest(state);
  }

  // Spawn enemies near player
  spawnEnemiesNearPlayer(state);

  // Despawn enemies far from player
  state.enemies = state.enemies.filter(e => {
    if (e.dead) return e.animTimer < 0.5;
    return distXY(p, e) < DESPAWN_RADIUS;
  });

  // Update respawn timers
  for (let i = state.spawnRespawns.length - 1; i >= 0; i--) {
    state.spawnRespawns[i].timer -= dt;
    if (state.spawnRespawns[i].timer <= 0) {
      state.spawnRespawns.splice(i, 1);
    }
  }

  // Update enemies
  updateEnemies(state, dt);

  // Update projectiles
  updateProjectiles(state, dt);

  // Particles
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    pt.vy += 40 * dt;
  }
  state.particles = state.particles.filter(pt => pt.life > 0);

  // Floating texts
  for (const ft of state.floatingTexts) {
    ft.y += ft.vy * dt;
    ft.life -= dt;
  }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);

  // Spell effects
  for (const se of state.spellEffects) se.life -= dt;
  state.spellEffects = state.spellEffects.filter(se => se.life > 0);

  // Kill feed
  state.killFeed = state.killFeed.filter(k => state.gameTime - k.time < 6);

  // Player death
  if (p.hp <= 0) {
    p.dead = true;
    state.gameOver = true;
    onPlayerDeath(state.playerProgress);
    spawnParticles(state, p.x, p.y, '#ef4444', 20);
  }

  // Camera follow
  state.camera.x += (p.x - state.camera.x) * 0.1;
  state.camera.y += (p.y - state.camera.y) * 0.1;

  // Periodic save
  if (Math.floor(state.gameTime) % 30 === 0 && state.gameTime > 1) {
    saveWorldState(state.worldState);
    savePlayerProgress(state.playerProgress);
  }
}

// ── Enemy AI ───────────────────────────────────────────────────

function updateEnemies(state: OpenWorldState, dt: number): void {
  const p = state.player;
  if (p.dead) return;

  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.animTimer += dt;

    const eres = updateStatusEffects(enemy as any as CombatEntity, dt);
    if (eres.damage > 0) {
      enemy.hp -= eres.damage;
      addText(state, enemy.x, enemy.y - 15, `-${Math.floor(eres.damage)}`, '#ff6666', 10);
    }

    if (enemy.hp <= 0) {
      killEnemy(state, enemy);
      continue;
    }

    if (isStunned(enemy as any as CombatEntity)) continue;

    const d = distXY(enemy, p);

    // Leash check — return home if too far
    const homeD = distXY(enemy, { x: enemy.homeX, y: enemy.homeY });
    if (homeD > enemy.leashRange && d > AGGRO_RANGE * 0.5) {
      const angle = angleBetween(enemy, { x: enemy.homeX, y: enemy.homeY });
      const spdMult = getSpeedMultiplier(enemy as any as CombatEntity);
      enemy.x += Math.cos(angle) * enemy.spd * spdMult * dt;
      enemy.y += Math.sin(angle) * enemy.spd * spdMult * dt;
      enemy.facing = angle;
      enemy.animState = 'walk';
      enemy.targetId = null;
      // Regen while leashing
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.05 * dt);
      continue;
    }

    if (d < AGGRO_RANGE) {
      enemy.targetId = p.id;
      enemy.facing = angleBetween(enemy, p);

      if (d <= enemy.rng + 10) {
        enemy.animState = 'attack';
        globalAnimDirector.registerAttack(enemy.id, state.gameTime);
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
        enemy.x += Math.cos(angle) * enemy.spd * spdMult * dt;
        enemy.y += Math.sin(angle) * enemy.spd * spdMult * dt;
        enemy.animState = 'walk';
      }
    } else {
      // Idle wander near home
      enemy.animState = 'idle';
      if (Math.random() < 0.005) {
        const angle = Math.random() * Math.PI * 2;
        enemy.x += Math.cos(angle) * 10;
        enemy.y += Math.sin(angle) * 10;
        enemy.facing = angle;
      }
    }
  }
}

function killEnemy(state: OpenWorldState, enemy: OWEnemy): void {
  enemy.dead = true;
  enemy.animTimer = 0;
  state.player.xp += enemy.xpValue;
  state.player.gold += enemy.goldValue;
  state.player.kills++;
  state.playerProgress.totalGoldEarned += enemy.goldValue;

  addText(state, enemy.x, enemy.y - 15, `+${enemy.goldValue}g`, '#ffd700', 12);
  spawnParticles(state, enemy.x, enemy.y, enemy.color, 12);
  checkLevelUp(state);

  const progressEvents = onMonsterKilled(state.playerProgress, enemy.isBoss);
  state.pendingProgressEvents.push(...progressEvents);

  state.killFeed.push({
    text: `Defeated ${enemy.type} (Lv${enemy.level})${enemy.isBoss ? ' BOSS' : ''}`,
    color: enemy.color,
    time: state.gameTime,
  });

  // Schedule respawn
  const zone = ISLAND_ZONES.find(z => z.id === enemy.zoneId);
  if (zone && zone.monsterSpawns[enemy.spawnIndex]) {
    state.spawnRespawns.push({
      zoneId: enemy.zoneId,
      spawnIndex: enemy.spawnIndex,
      timer: zone.monsterSpawns[enemy.spawnIndex].respawnTime,
      count: 1,
    });
  }

  // Equipment drop (bosses guaranteed, regular enemies 10-15%)
  const dropChance = enemy.isBoss ? 1.0 : 0.10 + enemy.level * 0.003;
  if (Math.random() < dropChance) {
    const dropTier = Math.max(1, Math.min(8, Math.ceil(enemy.level / 3)));
    const drop = generateRandomEquipment(dropTier);
    addToBag(state.equipmentBag, drop);
    addText(state, enemy.x, enemy.y - 30, drop.name, '#a855f7', 14);
    state.killFeed.push({ text: `Loot: ${drop.name} (T${dropTier})`, color: '#a855f7', time: state.gameTime });
    saveEquipmentBag(state.equipmentBag);
  }

  // Skinning XP from kills
  const skinXp = Math.floor(enemy.level * 5);
  gainProfessionXp(state.playerProfessions, 'gathering', 'skinning', skinXp);

  // Check world boss
  if (state.worldState.worldBoss.active && enemy.isBoss) {
    const wb = state.worldState.worldBoss;
    if (distXY(enemy, wb) < 200) {
      defeatWorldBoss(state.worldState);
      state.killFeed.push({ text: 'WORLD BOSS DEFEATED!', color: '#ffd700', time: state.gameTime });
    }
  }
}

// ── Projectiles ────────────────────────────────────────────────

function updateProjectiles(state: OpenWorldState, dt: number): void {
  const p = state.player;

  for (const proj of state.projectiles) {
    let target: { x: number; y: number; id: number } | null = null;
    if (proj.sourceIsPlayer) {
      target = state.enemies.find(e => e.id === proj.targetId && !e.dead) || null;
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
        if (enemy) {
          const result = combatCalcDamage(
            { atk: p.atk, activeEffects: p.activeEffects },
            { def: enemy.def, activeEffects: enemy.activeEffects },
            proj.damage
          );
          enemy.hp -= result.finalDamage;
          const col = result.isCrit ? '#ffd700' : '#ffffff';
          addText(state, enemy.x, enemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
          spawnParticles(state, enemy.x, enemy.y, '#ff6666', 3);

          const ls = hasLifesteal(p as any as CombatEntity);
          if (ls > 0) {
            const heal = Math.floor(result.finalDamage * ls);
            p.hp = Math.min(p.maxHp, p.hp + heal);
          }
          if (enemy.hp <= 0) killEnemy(state, enemy);
        }
      } else {
        const result = combatCalcDamage(
          { atk: 15, activeEffects: [] },
          { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp },
          proj.damage
        );
        if (p.shieldHp > 0) {
          const abs = Math.min(p.shieldHp, result.finalDamage);
          p.shieldHp -= abs;
          result.finalDamage = Math.max(0, result.finalDamage - abs);
        }
        p.hp -= result.finalDamage;
        addText(state, p.x, p.y - 20, `-${result.finalDamage}`, '#ef4444', 14);
        spawnParticles(state, p.x, p.y, '#ef4444', 3);
      }
      proj.targetId = -1;
    }
  }

  state.projectiles = state.projectiles.filter(pr => pr.targetId !== -1);
}

// ── Level Up ───────────────────────────────────────────────────

function checkLevelUp(state: OpenWorldState): void {
  const p = state.player;
  while (p.level < 30 && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    const hd = HEROES[p.heroDataId];
    const baseStats = heroStatsAtLevel(hd, p.level);
    const stats = applyAttributeBonus(baseStats, state.playerAttributes, hd.heroClass);
    const oldMaxHp = p.maxHp;
    p.maxHp = stats.hp + totalItemStat(p, 'hp');
    p.hp = Math.min(p.hp + (p.maxHp - oldMaxHp), p.maxHp);
    p.atk = stats.atk + totalItemStat(p, 'atk');
    p.def = stats.def + totalItemStat(p, 'def');
    p.spd = stats.spd + totalItemStat(p, 'spd');
    p.maxMp = stats.mp + totalItemStat(p, 'mp');
    p.mp = Math.min(p.mp + 20, p.maxMp);

    // Grant attribute points on level up
    grantLevelUpPoints(state.playerAttributes);
    saveAttributes(state.playerAttributes);

    addText(state, p.x, p.y - 40, `LEVEL ${p.level}!`, '#ffd700', 20);
    spawnParticles(state, p.x, p.y, '#ffd700', 20);
    state.killFeed.push({ text: `Reached level ${p.level}! (+3 attribute points)`, color: '#ffd700', time: state.gameTime });

    const progressEvents = onPlayerLevelUp(state.playerProgress, p.level);
    state.pendingProgressEvents.push(...progressEvents);
  }
}

function totalItemStat(p: OWPlayer, stat: 'hp' | 'atk' | 'def' | 'spd' | 'mp'): number {
  return p.items.reduce((t, item) => t + (item ? item[stat] : 0), 0);
}

function applyItemStats(p: OWPlayer, item: ItemDef): void {
  p.maxHp += item.hp; p.hp += item.hp;
  p.atk += item.atk; p.def += item.def;
  p.spd += item.spd; p.maxMp += item.mp; p.mp += item.mp;
}

// ── Abilities (mirrors dungeon.ts) ─────────────────────────────

export function handleOWAbility(state: OpenWorldState, abilityIndex: number, targetWorld?: Vec2): void {
  const p = state.player;
  if (p.dead || isStunned(p as any) || isSilenced(p as any)) return;

  const hd = HEROES[p.heroDataId];
  const abilities = getAbilitiesWithWeapon(state.weaponLoadout, hd.race, hd.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;

  const ab = abilities[abilityIndex];
  if (p.abilityCooldowns[abilityIndex] > 0 || p.mp < ab.manaCost) return;

  p.mp -= ab.manaCost;
  p.abilityCooldowns[abilityIndex] = ab.cooldown;
  p.animState = 'ability';

  if (targetWorld && (ab.castType === 'ground_aoe' || ab.castType === 'skillshot' || ab.castType === 'line' || ab.castType === 'cone')) {
    p.facing = Math.atan2(targetWorld.y - p.y, targetWorld.x - p.x);
  }

  const nearest = findNearestEnemy(state, p, ab.range + 100);
  const abilityColor = CLASS_COLORS[hd.heroClass] || '#fff';

  addSpellEffect(state, p.x, p.y, 'cast_circle', 25, abilityColor, 0.5);

  switch (ab.type) {
    case 'damage': {
      if (nearest) {
        const dmg = ab.damage + p.atk * 0.8;
        const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, dmg, 0.1);
        nearest.hp -= result.finalDamage;
        addText(state, nearest.x, nearest.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, result.isCrit ? '#ffd700' : abilityColor, 14);
        spawnParticles(state, nearest.x, nearest.y, abilityColor, 8);
        addSpellEffect(state, nearest.x, nearest.y, 'impact_ring', 30, abilityColor, 0.4);
        const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
        for (const eff of effects) applyStatusEffect(nearest as any as CombatEntity, eff);
        if (nearest.hp <= 0) killEnemy(state, nearest);
      }
      break;
    }
    case 'aoe': {
      const cx = targetWorld && ab.castType === 'ground_aoe' ? targetWorld.x : nearest ? nearest.x : p.x + Math.cos(p.facing) * 100;
      const cy = targetWorld && ab.castType === 'ground_aoe' ? targetWorld.y : nearest ? nearest.y : p.y + Math.sin(p.facing) * 100;

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
          addText(state, e.x, e.y - 15, `-${result.finalDamage}`, abilityColor, 12);
          addSpellEffect(state, e.x, e.y, 'impact_ring', 20, abilityColor, 0.3);
          const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(e as any as CombatEntity, eff);
          if (e.hp <= 0) killEnemy(state, e);
        }
      }
      spawnParticles(state, cx, cy, abilityColor, 20);
      break;
    }
    case 'buff': {
      const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      addSpellEffect(state, p.x, p.y, 'cast_circle', 35, '#ffd700', 0.8);
      spawnParticles(state, p.x, p.y, '#ffd700', 15);
      break;
    }
    case 'debuff': {
      addSpellEffect(state, p.x, p.y, 'aoe_blast', ab.radius, '#06b6d4', 0.5);
      for (const e of state.enemies) {
        if (e.dead || distXY(p, e) > ab.radius) continue;
        const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
        for (const eff of effects) applyStatusEffect(e as any as CombatEntity, eff);
        if (ab.damage > 0) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: e.def, activeEffects: e.activeEffects }, ab.damage);
          e.hp -= result.finalDamage;
          if (e.hp <= 0) killEnemy(state, e);
        }
      }
      spawnParticles(state, p.x, p.y, '#06b6d4', 12);
      break;
    }
    case 'heal': {
      p.shieldHp = 100 + p.def * 2;
      const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      addSpellEffect(state, p.x, p.y, 'cast_circle', 30, '#22c55e', 0.6);
      spawnParticles(state, p.x, p.y, '#22c55e', 10);
      break;
    }
    case 'dash': {
      const startX = p.x, startY = p.y;
      if (nearest) {
        const angle = angleBetween(p, nearest);
        const dashDist = Math.min(ab.range, distXY(p, nearest));
        const nx = p.x + Math.cos(angle) * dashDist;
        const ny = p.y + Math.sin(angle) * dashDist;
        if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
        if (ab.damage > 0) {
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, ab.damage + p.atk * 0.5);
          nearest.hp -= result.finalDamage;
          addSpellEffect(state, nearest.x, nearest.y, 'impact_ring', 25, abilityColor, 0.4);
          if (nearest.hp <= 0) killEnemy(state, nearest);
        }
      } else {
        const nx = p.x + Math.cos(p.facing) * ab.range;
        const ny = p.y + Math.sin(p.facing) * ab.range;
        if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
      }
      addSpellEffect(state, startX, startY, 'dash_trail', 15, abilityColor, 0.4, Math.atan2(p.y - startY, p.x - startX), { endX: p.x, endY: p.y });
      const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      spawnParticles(state, p.x, p.y, abilityColor, 8);
      break;
    }
  }
  addText(state, p.x, p.y - 30, ab.name, abilityColor, 16);
}

export function handleOWAttack(state: OpenWorldState): void {
  const p = state.player;
  if (p.dead || isStunned(p as any)) return;

  const nearest = findNearestEnemy(state, p, p.rng + 50);
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
    globalAnimDirector.registerAttack(p.id, state.gameTime);
  }
}

function findNearestEnemy(state: OpenWorldState, from: { x: number; y: number }, range: number): OWEnemy | null {
  let nearest: OWEnemy | null = null;
  let nearestDist = range;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = distXY(from, e);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
  }
  return nearest;
}

// ── Targeting ──────────────────────────────────────────────────

export function updateOWMouseWorld(state: OpenWorldState, screenX: number, screenY: number, canvasW: number, canvasH: number): void {
  const cam = state.camera;
  state.mouseWorld.x = (screenX - canvasW / 2) / cam.zoom + cam.x;
  state.mouseWorld.y = (screenY - canvasH / 2) / cam.zoom + cam.y;
}

export function startOWTargeting(state: OpenWorldState, abilityIndex: number): void {
  const p = state.player;
  if (p.dead) return;
  const hd = HEROES[p.heroDataId];
  const abilities = getAbilitiesWithWeapon(state.weaponLoadout, hd.race, hd.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;
  const ab = abilities[abilityIndex];
  if (p.abilityCooldowns[abilityIndex] > 0 || p.mp < ab.manaCost) return;

  if (ab.castType === 'self_cast' || ab.castType === 'targeted') {
    handleOWAbility(state, abilityIndex);
    return;
  }

  state.targeting = {
    active: true, abilityIndex,
    castType: ab.castType,
    range: ab.range > 0 ? ab.range : 200,
    radius: ab.radius > 0 ? ab.radius : 80,
    color: CLASS_COLORS[hd.heroClass] || '#fff',
  };
}

export function confirmOWTargeting(state: OpenWorldState): void {
  if (!state.targeting.active) return;
  handleOWAbility(state, state.targeting.abilityIndex, state.mouseWorld);
  cancelOWTargeting(state);
}

export function cancelOWTargeting(state: OpenWorldState): void {
  state.targeting.active = false;
  state.targeting.abilityIndex = -1;
}

/** Swap weapon and rebuild skill loadout */
export async function swapOWWeapon(state: OpenWorldState, newWeaponType: string, weaponId: string | null): Promise<void> {
  const hd = HEROES[state.player.heroDataId];
  const osKey = getOSWeaponTypeKey(newWeaponType);
  const loadout = await buildWeaponLoadout(osKey, weaponId, hd.race, hd.heroClass);
  if (loadout) {
    applySavedSelections(loadout);
    state.weaponLoadout = loadout;
    state.weaponLoadoutReady = true;
    saveLoadout(loadout);
    state.killFeed.push({ text: `Weapon changed: ${newWeaponType}`, color: '#60a5fa', time: state.gameTime });
  }
}

// ── VFX Helpers ────────────────────────────────────────────────

function addText(state: OpenWorldState, x: number, y: number, text: string, color: string, size: number): void {
  state.floatingTexts.push({ x, y, text, color, life: 1.5, vy: -35, size });
}

function spawnParticles(state: OpenWorldState, x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 150,
      vy: (Math.random() - 0.5) * 150 - 30,
      life: 0.6, maxLife: 0.6,
      color, size: 3,
    });
  }
}

function addSpellEffect(state: OpenWorldState, x: number, y: number, type: OWSpellEffect['type'], radius: number, color: string, duration: number, angle = 0, data?: any): void {
  state.spellEffects.push({ x, y, type, life: duration, maxLife: duration, radius, color, angle, data });
}

// ── HUD State ──────────────────────────────────────────────────

export function getOWHudState(state: OpenWorldState): OWHudState {
  const p = state.player;
  const hd = HEROES[p.heroDataId];
  const zone = getZoneAtPosition(p.x, p.y);
  const ws = state.worldState;
  const prog = state.playerProgress;

  // Drain pending events for UI to consume
  const events = [...state.pendingProgressEvents];
  state.pendingProgressEvents = [];

  return {
    hp: p.hp, maxHp: p.maxHp,
    mp: p.mp, maxMp: p.maxMp,
    level: p.level, xp: p.xp, xpToNext: xpForLevel(p.level),
    gold: p.gold,
    kills: p.kills,
    items: p.items,
    abilityCooldowns: p.abilityCooldowns,
    heroName: hd.name, heroClass: hd.heroClass, heroRace: hd.race,
    gameOver: state.gameOver,
    activeEffects: [...p.activeEffects],
    atk: p.atk, def: p.def, spd: p.spd,
    killFeed: state.killFeed,
    gameTime: state.gameTime,
    showInventory: state.showInventory,
    animState: p.animState || 'idle',
    animTimer: p.animTimer || 0,
    facing: String(p.facing ?? 0),
    px: p.x, py: p.y,
    // OW additions
    zoneName: zone?.name ?? 'Wilderness',
    zonePvP: zone?.isPvP ?? false,
    zoneSafe: zone?.isSafeZone ?? false,
    worldTime: getFormattedTime(ws),
    worldTimeRaw: ws.worldTime,
    weatherIcon: getWeatherIcon(ws),
    weatherLabel: getWeatherDescription(ws),
    isDayTime: isDayTime(ws),
    ambientBrightness: getAmbientBrightness(ws),
    reputation: prog.reputation,
    reputationRank: getReputationRank(prog.reputation),
    reputationColor: getReputationColor(prog.reputation),
    zonesDiscovered: prog.zonesDiscovered.length,
    monstersSlain: prog.monstersSlain,
    bossesDefeated: prog.bossesDefeated,
    pendingEvents: events,
    worldBossActive: ws.worldBoss.active,
    worldBossName: ws.worldBoss.name,
    worldBossHp: ws.worldBoss.hp,
    worldBossMaxHp: ws.worldBoss.maxHp,
    // Weapon skill info
    abilityNames: getAbilitiesWithWeapon(state.weaponLoadout, hd.race, hd.heroClass).map(a => a.name),
    abilityDescriptions: getAbilitiesWithWeapon(state.weaponLoadout, hd.race, hd.heroClass).map(a => a.description || ''),
    weaponType: state.weaponLoadout?.weaponType || '',
    weaponLoadoutReady: state.weaponLoadoutReady,
    // Attribute info
    attributeSummary: getAttributeSummary(state.playerAttributes),
  };
}

/** Allocate an attribute point from the open world */
export function allocateOWAttribute(state: OpenWorldState, attrId: AttributeId): boolean {
  const success = allocatePoint(state.playerAttributes, attrId);
  if (success) {
    // Recalc player stats with new attribute values
    const hd = HEROES[state.player.heroDataId];
    const baseStats = heroStatsAtLevel(hd, state.player.level);
    const stats = applyAttributeBonus(baseStats, state.playerAttributes, hd.heroClass);
    const p = state.player;
    const oldMaxHp = p.maxHp;
    p.maxHp = stats.hp + totalItemStat(p, 'hp');
    p.hp = Math.min(p.hp + (p.maxHp - oldMaxHp), p.maxHp);
    p.atk = stats.atk + totalItemStat(p, 'atk');
    p.def = stats.def + totalItemStat(p, 'def');
    p.spd = stats.spd + totalItemStat(p, 'spd');
    p.maxMp = stats.mp + totalItemStat(p, 'mp');
    saveAttributes(state.playerAttributes);
  }
  return success;
}

// ── Renderer ─

// Zone terrain color palettes
const ZONE_FLOOR_COLORS: Record<string, { base: string; accent: string }> = {
  grass:  { base: '#2a5c1a', accent: '#3a7a2a' },
  jungle: { base: '#1a3a12', accent: '#2a5a1a' },
  water:  { base: '#1a3a3a', accent: '#2a4a4a' },
  stone:  { base: '#4a4a5a', accent: '#5a5a6a' },
  dirt:   { base: '#5a3a1a', accent: '#6a4a2a' },
};

export class OpenWorldRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private voxel: VoxelRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.voxel = new VoxelRenderer();
  }

  render(state: OpenWorldState): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const cam = state.camera;
    const brightness = getAmbientBrightness(state.worldState);

    // Sky color based on time of day
    const skyR = Math.floor(10 * brightness);
    const skyG = Math.floor(10 * brightness);
    const skyB = Math.floor(20 * brightness);
    ctx.fillStyle = `rgb(${skyR},${skyG},${skyB})`;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.renderTerrain(ctx, state, cam, W, H, brightness);
    this.renderZoneBorders(ctx, state);
    this.renderPortals(ctx, state);
    this.renderNPCs(ctx, state, brightness);
    this.renderTargetingIndicator(ctx, state);

    // Enemies sorted by Y for depth
    const sorted = state.enemies.filter(e => !e.dead).sort((a, b) => a.y - b.y);
    for (const enemy of sorted) this.renderEnemy(ctx, enemy, state, brightness);

    this.renderPlayer(ctx, state, brightness);

    for (const se of state.spellEffects) this.renderSpellEffect(ctx, se);

    for (const proj of state.projectiles) this.renderProjectile(ctx, proj);
    for (const pt of state.particles) this.renderParticle(ctx, pt);
    for (const ft of state.floatingTexts) this.renderFloatingText(ctx, ft);

    ctx.restore();

    // Weather overlay
    this.renderWeatherOverlay(ctx, state.worldState, W, H);

    // Night overlay
    if (brightness < 0.5) {
      ctx.fillStyle = `rgba(0,0,30,${(0.5 - brightness) * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private renderTerrain(ctx: CanvasRenderingContext2D, state: OpenWorldState, cam: { x: number; y: number; zoom: number }, W: number, H: number, brightness: number): void {
    const viewW = W / cam.zoom;
    const viewH = H / cam.zoom;
    const startX = Math.max(0, Math.floor((cam.x - viewW / 2) / TILE_SIZE) - 1);
    const startY = Math.max(0, Math.floor((cam.y - viewH / 2) / TILE_SIZE) - 1);
    const endX = Math.min(Math.ceil(OPEN_WORLD_SIZE / TILE_SIZE), Math.ceil((cam.x + viewW / 2) / TILE_SIZE) + 1);
    const endY = Math.min(Math.ceil(OPEN_WORLD_SIZE / TILE_SIZE), Math.ceil((cam.y + viewH / 2) / TILE_SIZE) + 1);

    for (let ty = startY; ty < endY; ty++) {
      for (let tx = startX; tx < endX; tx++) {
        const wx = tx * TILE_SIZE + TILE_SIZE / 2;
        const wy = ty * TILE_SIZE + TILE_SIZE / 2;
        const zone = getZoneAtPosition(wx, wy);

        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;

        if (!zone) {
          // Wilderness / impassable
          ctx.fillStyle = `rgba(20,20,20,${brightness})`;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        const colors = ZONE_FLOOR_COLORS[zone.terrainType] || ZONE_FLOOR_COLORS.grass;
        const seed = (tx * 17 + ty * 31) % 100;
        const baseColor = seed > 60 ? colors.accent : colors.base;

        ctx.globalAlpha = Math.max(0.3, brightness);
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

        // Tile decoration details
        if (seed > 75) {
          ctx.fillStyle = `rgba(255,255,255,0.03)`;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }

        ctx.globalAlpha = 1;
      }
    }
  }

  private renderZoneBorders(ctx: CanvasRenderingContext2D, state: OpenWorldState): void {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.globalAlpha = 0.4;

    for (const zone of ISLAND_ZONES) {
      const b = zone.bounds;
      // Only render if near camera
      if (Math.abs(state.camera.x - (b.x + b.w / 2)) > 2000) continue;
      if (Math.abs(state.camera.y - (b.y + b.h / 2)) > 2000) continue;

      ctx.strokeStyle = getZoneColor(zone);
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      // Zone name label at top of zone
      ctx.fillStyle = getZoneColor(zone);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6;
      ctx.fillText(zone.name, b.x + b.w / 2, b.y - 8);
      ctx.globalAlpha = 0.4;
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderPortals(ctx: CanvasRenderingContext2D, state: OpenWorldState): void {
    const pulse = 0.5 + Math.sin(Date.now() * 0.004) * 0.3;

    for (const zone of ISLAND_ZONES) {
      for (const portal of zone.portalPositions) {
        const d = distXY(state.player, portal);
        if (d > 800) continue;

        ctx.save();
        ctx.translate(portal.x, portal.y);

        // Outer glow
        ctx.globalAlpha = pulse * 0.3;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        // Inner
        ctx.globalAlpha = pulse * 0.8;
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        const targetZone = getZoneById(portal.targetZoneId);
        if (targetZone) {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#c084fc';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`→ ${targetZone.name}`, 0, -30);
        }

        ctx.restore();
      }
    }
  }

  private renderNPCs(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    for (const npc of state.npcs) {
      const d = distXY(state.player, npc);
      if (d > 800) continue;

      ctx.save();
      ctx.translate(npc.x, npc.y);
      ctx.globalAlpha = Math.max(0.4, brightness);

      // Body
      ctx.fillStyle = npc.type === 'merchant' ? '#f59e0b' : npc.type === 'trainer' ? '#3b82f6' : '#22c55e';
      ctx.fillRect(-6, -12, 12, 24);

      // Head
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -16, 6, 0, Math.PI * 2);
      ctx.fill();

      // Name
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, 0, -26);

      // Interaction indicator
      if (d < 60) {
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px sans-serif';
        ctx.fillText('!', 0, -34);
      }

      ctx.restore();
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: OWEnemy, state: OpenWorldState, brightness: number): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness);

    this.voxel.drawEnemyVoxel(ctx, enemy.x, enemy.y, enemy.type, enemy.facing, enemy.animState, enemy.animTimer, enemy.size, enemy.isBoss);

    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    // Health bar
    this.renderHealthBar(ctx, 0, -enemy.size - 8, enemy.size, enemy.hp, enemy.maxHp, enemy.color);

    // Level indicator
    ctx.fillStyle = '#ccc';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv${enemy.level}`, 0, -enemy.size - 12);

    // Status effects
    if (enemy.activeEffects.length > 0) {
      let ox = -enemy.activeEffects.length * 5;
      for (const eff of enemy.activeEffects) {
        ctx.fillStyle = eff.color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(ox, -enemy.size - 18, 8, 4);
        ctx.globalAlpha = 1;
        ox += 10;
      }
    }

    if (enemy.isBoss) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.type, 0, -enemy.size - 22);
    }

    ctx.restore();
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    const p = state.player;
    const hd = HEROES[p.heroDataId];
    const raceColor = RACE_COLORS[hd.race] || '#888';
    const classColor = CLASS_COLORS[hd.heroClass] || '#888';

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = Math.max(0.4, brightness);

    // Player indicator ring
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.globalAlpha = (0.4 + Math.sin(Date.now() * 0.004) * 0.2) * brightness;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0.4, brightness);

    const buffNames = p.activeEffects.map(e => e.name || '');
    this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, hd.heroClass, p.facing, p.animState, p.animTimer, hd.race, hd.name, undefined, undefined, p.id, p.shieldHp > 0 ? p.shieldHp : undefined, buffNames.length > 0 ? buffNames : undefined, state.gameTime);

    ctx.globalAlpha = 1;
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

  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, hp: number, maxHp: number, color: string): void {
    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - hw, y, hw * 2, 4);
    ctx.fillStyle = pct > 0.5 ? color : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x - hw, y, hw * 2 * pct, 4);
  }

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: OWProjectile): void {
    ctx.fillStyle = proj.color;
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private renderParticle(ctx: CanvasRenderingContext2D, p: OWParticle): void {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private renderFloatingText(ctx: CanvasRenderingContext2D, ft: OWFloatingText): void {
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = Math.min(1, ft.life * 2);
    ctx.font = `bold ${ft.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1;
  }

  private renderTargetingIndicator(ctx: CanvasRenderingContext2D, state: OpenWorldState): void {
    const t = state.targeting;
    if (!t.active) return;

    const p = state.player;
    const mx = state.mouseWorld.x;
    const my = state.mouseWorld.y;
    const pulse = 0.4 + Math.sin(Date.now() * 0.005) * 0.15;

    ctx.save();

    // Range circle
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
      const tx2 = dist > t.range ? p.x + (dx / dist) * t.range : mx;
      const ty2 = dist > t.range ? p.y + (dy / dist) * t.range : my;

      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.arc(tx2, ty2, t.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = pulse * 0.8;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx2, ty2, t.radius, 0, Math.PI * 2);
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
    } else if (t.castType === 'cone') {
      const angle = Math.atan2(dy, dx);
      const coneAngle = Math.PI / 3;

      ctx.globalAlpha = pulse * 0.2;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, t.radius, angle - coneAngle / 2, angle + coneAngle / 2);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderSpellEffect(ctx: CanvasRenderingContext2D, se: OWSpellEffect): void {
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
        ctx.stroke();
        break;
      }
      case 'cone_sweep': {
        const coneAngle = Math.PI / 3;
        ctx.globalAlpha = t * 0.3;
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.arc(se.x, se.y, se.radius, se.angle - coneAngle / 2, se.angle + coneAngle / 2);
        ctx.closePath();
        ctx.fill();
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
        ctx.lineCap = 'butt';
        break;
      }
      case 'skillshot_trail': {
        const angle = se.angle;
        const len = se.radius;
        ctx.globalAlpha = t * 0.6;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 3 * t;
        ctx.beginPath();
        ctx.moveTo(se.x, se.y);
        ctx.lineTo(se.x + Math.cos(angle) * len, se.y + Math.sin(angle) * len);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  private renderWeatherOverlay(ctx: CanvasRenderingContext2D, ws: WorldState, W: number, H: number): void {
    const weather = ws.weather;
    if (weather === WeatherType.Clear || weather === WeatherType.Cloudy) return;

    ctx.save();
    const time = Date.now() * 0.001;

    if (weather === WeatherType.Rain || weather === WeatherType.Storm) {
      ctx.strokeStyle = weather === WeatherType.Storm ? 'rgba(180,200,255,0.3)' : 'rgba(150,180,220,0.2)';
      ctx.lineWidth = 1;
      const count = weather === WeatherType.Storm ? 120 : 60;
      for (let i = 0; i < count; i++) {
        const x = ((i * 37 + time * 100) % (W + 40)) - 20;
        const y = ((i * 53 + time * 300) % (H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.stroke();
      }
    }

    if (weather === WeatherType.Snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 50; i++) {
        const x = ((i * 47 + time * 30 + Math.sin(time + i) * 20) % (W + 20)) - 10;
        const y = ((i * 61 + time * 50) % (H + 20)) - 10;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (weather === WeatherType.Fog) {
      ctx.fillStyle = 'rgba(180,180,180,0.15)';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
  }
}

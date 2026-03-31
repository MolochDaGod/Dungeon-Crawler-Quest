/**
 * Open World Game Engine - Phase 4
 * Replaces floor-based dungeon with zone-based open world.
 * Reuses dungeon combat, abilities, items, and enemy types.
 * Integrates with world-state.ts, zones.ts, player-progress.ts.
 */

import {
  HeroData, HEROES, Vec2, AbilityDef, ItemDef, ITEMS,
  heroStatsAtLevel, RACE_COLORS, CLASS_COLORS,
  getHeroAbilities, getWeaponRenderType, getHeroWeapon,
  WeaponType, getHeroById
} from './types';
import { VoxelRenderer, DungeonTileVoxelType } from './voxel';
import { globalAnimDirector, drawAISlashVFX } from './voxel-motion';
import {
  StatusEffect, StatusEffectType, createStatusEffect, applyStatusEffect,
  updateStatusEffects, isStunned, isRooted, isSilenced, getSpeedMultiplier,
  hasLifesteal, getAbilityStatusEffects, calculateDamage as combatCalcDamage,
  CombatEntity, EFFECT_COLORS, buildDamageOpts, DamageOpts
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
  getZoneById, getZoneColor, ZoneTracker, createZoneTracker, updateZoneTracker,
  DUNGEON_ENTRANCES, DungeonEntrance, getDungeonEntranceNear,
  ZONE_ROADS, RoadSegment, ZONE_BUILDINGS, BuildingPlacement,
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
  getAttributeSummary, AttributeSummary, MAX_LEVEL, POINTS_PER_LEVEL
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
  generateRandomEquipment, addToBag, removeFromBag, SetBonus
} from './equipment';
import { ConsumableHotbarItem } from './npc-shops';
import {
  MissionLog, ActiveMission, MissionReward,
  loadMissionLog, saveMissionLog, getAvailableMissions,
  acceptMission, onMissionKill, onMissionCollect, onMissionExplore,
  onMissionDungeonEnter, claimMission
} from './missions';
import {
  GeneratedWorldData, GeneratedDecoration, GeneratedBuilding, GeneratedRoad,
  loadGeneratedWorld,
} from './ai-map-gen';
import { drawGLBProjectile, drawGLBSprite, CLASS_PROJECTILE_SPRITE } from './babylon-glb-sprites';
import { WorldHeightmap, createWorldHeightmap } from './terrain-heightmap';
import {
  BoatState, createBoatState, BoatDock, BOAT_DOCKS,
  shouldMount, mountBoat, shouldDismount, dismountBoat, updateBoatPosition,
} from './boats';
import { SpawnerManager, createSpawnerManager, SpawnRequest } from './spawner-system';
import { ZoneEventManager, createZoneEventManager, EventUpdate } from './zone-events';
import { behaviorTick, assignArchetype, clearBehaviorCache, getArchetype, AIEntity, AITarget } from './ai-behaviors';
import { KeybindConfig, KeybindAction, loadKeybindings } from './keybindings';
import { OWAnimFSM, OWAnimState } from './ow-anim-fsm';
import { EffectPool, EffectSlot, EffectType } from './effect-pool';
import { getTileMapRenderer } from './tile-renderer';
import { getSpriteDefForEnemy, drawSpriteEnemy, mapOWAnimState, preloadSpriteEnemies } from './sprite-enemy';
import { getZoneLayout, drawDecoration, drawAnimal, updateAnimal, drawHeroesGuild, type ZoneDecorLayout, type LiveAnimal } from './world-decorations';
import { resolveMovement } from './world-collision';
import {
  getNearbyPlayer, openInteractMenu, closeInteractMenu,
  createInteractMenuState, type InteractMenuState,
} from './player-interact';
import { renderWalls, renderWaterArea } from './world-collision';
import { ZONE_5_AREAS, getZone5Area, collidesWithWall, isDeepWater } from './node-map';
import {
  VoxelProjectile, createVoxelProjectile, updateVoxelProjectile,
  renderVoxelProjectile, getClassRangedConfig
} from './voxel-projectiles';
import { projectileHitsCircle } from './spatial-math';
import { checkAbilityCost, deductAbilityCost, getEffectiveCooldown, type ResourceState } from './ability-costs';
import {
  TownBuilding, ALL_TOWN_BUILDINGS, getBuildingNear, InteriorNPCDef,
} from './town-buildings';
import {
  getFactionSpawnPoint, getPlayerFactionDock, getAllFactionDocks,
  generateDockStructures, FACTION_DOCKS, type FactionDock, type DockStructure,
} from './faction-spawn';
import {
  FACTION_HERO_NPCS, getFactionNPCs, getNPCQuests, getFactionQuest,
  type FactionHeroNPC, type FactionQuestDef,
} from './faction-quests';
import {
  type ModularVoxelConfig, defaultModularConfig,
} from './voxel-modular';
import { getCurrentCharacter } from './player-account';
import {
  ZoneClusterState, createZoneClusterState, getActiveZone,
  checkPlayerZoneExit, beginZoneTransition, updateTransition,
  completeZoneSwap, updateBanner, getTransitionOpacity,
} from './zone-cluster';
import { createZoneTilemap, getActiveZoneTilemap } from './tilemap-zone';
import { generateBiomeMask } from './ai-world-planner';
import { generateAllChunks } from './ai-chunk-generator';
import { renderTilemap, renderOceanBackground, renderZoneExits } from './tilemap-renderer-v2';
import { validateZone } from './ai-map-validator';

// ── Constants ──────────────────────────────────────────────────

const TILE_SIZE = 40;
const OW_VIEW_RANGE = 800;       // pixels visible around player
const SPAWN_RADIUS = 1500;       // only spawn/update enemies within this
const DESPAWN_RADIUS = 2000;     // enemies beyond this are removed
const AGGRO_RANGE = 300;         // base aggro range (varies per enemy type)

// Per-enemy aggro range multipliers (bigger/boss enemies detect from further)
const AGGRO_MULTIPLIER: Record<string, number> = {
  Slime: 0.6, Spider: 0.7, Imp: 0.8, 'Plague Rat Swarm': 0.5,
  Skeleton: 0.9, Bandit: 1.0, 'Orc Grunt': 1.0, 'Timber Wolf': 1.2,
  'Dark Archer': 1.3, 'Dark Mage': 1.1, Wraith: 1.1, Harpy: 1.2,
  Golem: 0.8, 'Iron Sentinel': 0.7, 'Cave Bear': 1.0, Treant: 0.6,
  Poacher: 1.0, Scavenger: 0.95, Thug: 1.05,
  'Basic Goblin': 0.9, 'Goblin Archer': 1.15, 'Goblin Warrior': 1.0,
  'Rock Golem': 0.75, 'Earth Golem': 0.8, 'Iron Golem': 0.85,
  Dragon: 1.5, 'Fire Drake': 1.3, 'Frost Wyrm': 1.4, 'Shadow Dragon': 1.5,
  'Lich King': 1.5, 'Infernal Colossus': 1.6, 'Bandit Chief': 1.2,
  // GRUDGE Legacy monsters
  'Gargoyle': 1.1, 'Minotaur': 1.3, 'Arachnid': 0.9, 'Demon': 1.2,
  'Arch Demon': 1.5, 'Necromancer': 1.2, 'Ogre': 1.2, 'Dryad': 0.7,
  'Horn Beetle': 0.8, 'Cave Hound': 1.0, 'Fiend': 1.1, 'Reptilian': 1.0,
  'Cerberus': 1.6, 'Gorgoz': 1.6, 'Mimic': 0.5, 'Yeti': 1.3,
  'Dark Elf Guard': 1.1, 'Dark Elf Archer': 1.3, 'Dark Elf Commander': 1.4,
  'Dark Elf Lord': 1.5, 'Ice Golem': 0.8, 'Lava Golem': 0.8,
  'Forest Golem': 0.7, 'Stone Golem': 0.8, 'Juggernaut': 1.5,
  'Emerald Drake': 1.4, 'Hellfire Drake': 1.4, 'Void Drake': 1.5,
  'Nightstalker Drake': 1.3, 'Rock Drake': 1.2, 'Frigid Drake': 1.3,
  'Crab': 0.6, 'Rhino': 1.0, 'Scorpion': 0.9, 'War Saber': 1.1,
  'Grunk': 0.8, 'Young Ent': 0.6, 'Elder Ent': 0.8, 'Corrupted Ent': 0.9,
};

function getEnemyAggroRange(type: string, isBoss: boolean): number {
  const mult = AGGRO_MULTIPLIER[type] ?? 1.0;
  return AGGRO_RANGE * mult * (isBoss ? 1.5 : 1.0);
}

// Leash = half the zone size (~500 for a 1000-wide zone)
// Enemies chase player across half the zone before walking home
const BASE_LEASH_RANGE = 800;    // half a zone width
const BOSS_LEASH_RANGE = 1200;   // bosses chase further

// Enemy attackStyle → weapon type for AI slash VFX
const ENEMY_ATTACK_WEAPON: Record<string, WeaponType> = {
  melee: 'sword_shield',
  ranged: 'bow',
  aoe: 'staff',
};

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
  attackStyle: 'melee' | 'ranged' | 'aoe';
}> = {
  Slime:      { hp: 80,  atk: 8,  def: 2,  spd: 40,  rng: 50,  color: '#22c55e', xp: 15,  gold: 8,   isBoss: false, size: 8,  attackStyle: 'melee' },
  Skeleton:   { hp: 100, atk: 12, def: 5,  spd: 55,  rng: 60,  color: '#d4d4d8', xp: 25,  gold: 12,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Orc Grunt':{ hp: 150, atk: 18, def: 8,  spd: 50,  rng: 60,  color: '#65a30d', xp: 35,  gold: 18,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Dark Mage':{ hp: 90,  atk: 22, def: 4,  spd: 45,  rng: 200, color: '#7c3aed', xp: 40,  gold: 22,  isBoss: false, size: 10, attackStyle: 'aoe' },
  Spider:     { hp: 70,  atk: 14, def: 3,  spd: 70,  rng: 50,  color: '#78716c', xp: 20,  gold: 10,  isBoss: false, size: 9,  attackStyle: 'melee' },
  Golem:      { hp: 300, atk: 25, def: 20, spd: 30,  rng: 60,  color: '#a16207', xp: 60,  gold: 35,  isBoss: false, size: 16, attackStyle: 'melee' },
  Dragon:     { hp: 800, atk: 40, def: 18, spd: 45,  rng: 150, color: '#dc2626', xp: 200, gold: 150, isBoss: true,  size: 24, attackStyle: 'aoe' },
  Lich:       { hp: 600, atk: 35, def: 12, spd: 40,  rng: 250, color: '#6b21a8', xp: 180, gold: 120, isBoss: true,  size: 20, attackStyle: 'aoe' },
  // ── Dragons & Wyrms (T5-T7) ──
  'Fire Drake':     { hp: 703,  atk: 30, def: 14, spd: 55,  rng: 120, color: '#ff6b2b', xp: 120, gold: 85,  isBoss: false, size: 18, attackStyle: 'ranged' },
  'Frost Wyrm':     { hp: 856,  atk: 35, def: 20, spd: 42,  rng: 140, color: '#4fc3f7', xp: 160, gold: 100, isBoss: false, size: 22, attackStyle: 'ranged' },
  'Shadow Dragon':  { hp: 1030, atk: 45, def: 25, spd: 48,  rng: 160, color: '#6a1b9a', xp: 280, gold: 200, isBoss: true,  size: 28, attackStyle: 'aoe' },
  'Boar Dragon':    { hp: 886,  atk: 40, def: 28, spd: 35,  rng: 90,  color: '#5d4037', xp: 200, gold: 140, isBoss: false, size: 24, attackStyle: 'melee' },
  // ── Piglin Forces ──
  'Piglin Grunt':   { hp: 200,  atk: 20, def: 10, spd: 48,  rng: 60,  color: '#c6a700', xp: 45,  gold: 25,  isBoss: false, size: 11, attackStyle: 'melee' },
  'Piglin Brute':   { hp: 350,  atk: 28, def: 16, spd: 42,  rng: 70,  color: '#8d6e00', xp: 75,  gold: 40,  isBoss: false, size: 14, attackStyle: 'melee' },
  // ── New Enemies ──
  'Bandit':           { hp: 120,  atk: 15, def: 6,  spd: 58,  rng: 55,  color: '#8b4513', xp: 30,  gold: 20,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Bandit Chief':     { hp: 400,  atk: 25, def: 14, spd: 50,  rng: 65,  color: '#6b2e0a', xp: 120, gold: 80,  isBoss: true,  size: 14, attackStyle: 'melee' },
  'Poacher':          { hp: 125,  atk: 16, def: 5,  spd: 60,  rng: 90,  color: '#7a4a1f', xp: 32,  gold: 18,  isBoss: false, size: 10, attackStyle: 'ranged' },
  'Scavenger':        { hp: 105,  atk: 14, def: 4,  spd: 62,  rng: 55,  color: '#5a3820', xp: 28,  gold: 16,  isBoss: false, size: 9,  attackStyle: 'melee' },
  'Thug':             { hp: 165,  atk: 20, def: 9,  spd: 48,  rng: 58,  color: '#4a2b16', xp: 40,  gold: 24,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Sea Serpent':      { hp: 500,  atk: 30, def: 12, spd: 60,  rng: 120, color: '#0077be', xp: 150, gold: 90,  isBoss: true,  size: 22, attackStyle: 'ranged' },
  'Wraith':           { hp: 130,  atk: 20, def: 3,  spd: 50,  rng: 100, color: '#b0b0d0', xp: 40,  gold: 25,  isBoss: false, size: 12, attackStyle: 'ranged' },
  'Treant':           { hp: 250,  atk: 18, def: 18, spd: 25,  rng: 60,  color: '#2d5a1e', xp: 50,  gold: 15,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Dire Wolf':        { hp: 110,  atk: 16, def: 5,  spd: 72,  rng: 50,  color: '#555566', xp: 28,  gold: 14,  isBoss: false, size: 11, attackStyle: 'melee' },
  'Corrupted Knight': { hp: 280,  atk: 24, def: 20, spd: 40,  rng: 55,  color: '#4a0e2e', xp: 65,  gold: 45,  isBoss: false, size: 13, attackStyle: 'melee' },
  'Harpy':            { hp: 100,  atk: 18, def: 4,  spd: 65,  rng: 90,  color: '#9966cc', xp: 35,  gold: 18,  isBoss: false, size: 10, attackStyle: 'ranged' },
  'Imp':              { hp: 60,   atk: 14, def: 2,  spd: 70,  rng: 80,  color: '#ff4444', xp: 18,  gold: 10,  isBoss: false, size: 7,  attackStyle: 'ranged' },
  'Basic Goblin':     { hp: 85,   atk: 11, def: 3,  spd: 62,  rng: 50,  color: '#5f8f2c', xp: 20,  gold: 10,  isBoss: false, size: 8,  attackStyle: 'melee' },
  'Goblin Archer':    { hp: 90,   atk: 14, def: 3,  spd: 60,  rng: 140, color: '#6ea83a', xp: 24,  gold: 12,  isBoss: false, size: 8,  attackStyle: 'ranged' },
  'Goblin Warrior':   { hp: 130,  atk: 18, def: 7,  spd: 55,  rng: 55,  color: '#4c7c20', xp: 30,  gold: 16,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Goblin Shaman':    { hp: 140,  atk: 22, def: 5,  spd: 42,  rng: 150, color: '#44aa44', xp: 55,  gold: 30,  isBoss: false, size: 9,  attackStyle: 'aoe' },
  'Rock Golem':       { hp: 280,  atk: 24, def: 18, spd: 28,  rng: 55,  color: '#8c6a42', xp: 55,  gold: 28,  isBoss: false, size: 16, attackStyle: 'melee' },
  'Earth Golem':      { hp: 330,  atk: 27, def: 21, spd: 26,  rng: 58,  color: '#7b5e3b', xp: 65,  gold: 34,  isBoss: false, size: 17, attackStyle: 'melee' },
  'Iron Golem':       { hp: 420,  atk: 32, def: 28, spd: 24,  rng: 60,  color: '#6e7278', xp: 85,  gold: 42,  isBoss: false, size: 18, attackStyle: 'melee' },
  // ── Phase 5: New Enemy Heroes ──
  'Berserker':          { hp: 280,  atk: 30, def: 8,  spd: 62,  rng: 55,  color: '#cc2222', xp: 70,  gold: 40,  isBoss: false, size: 13, attackStyle: 'melee' },
  'Dark Archer':        { hp: 150,  atk: 24, def: 6,  spd: 55,  rng: 220, color: '#2a4a2a', xp: 55,  gold: 30,  isBoss: false, size: 10, attackStyle: 'ranged' },
  'Necromancer':        { hp: 200,  atk: 28, def: 5,  spd: 38,  rng: 180, color: '#4a0066', xp: 80,  gold: 50,  isBoss: false, size: 11, attackStyle: 'aoe' },
  'Iron Sentinel':      { hp: 450,  atk: 20, def: 30, spd: 25,  rng: 60,  color: '#6a6a8a', xp: 90,  gold: 55,  isBoss: false, size: 16, attackStyle: 'melee' },
  'Plague Rat Swarm':   { hp: 100,  atk: 12, def: 2,  spd: 75,  rng: 45,  color: '#7a6a30', xp: 25,  gold: 12,  isBoss: false, size: 8,  attackStyle: 'melee' },
  // ── Phase 5: New Bosses ──
  'Infernal Colossus':  { hp: 1500, atk: 50, def: 30, spd: 28,  rng: 90,  color: '#ff3300', xp: 400, gold: 300, isBoss: true,  size: 32, attackStyle: 'aoe' },
  'Lich King':          { hp: 1200, atk: 55, def: 20, spd: 35,  rng: 250, color: '#220066', xp: 500, gold: 400, isBoss: true,  size: 28, attackStyle: 'aoe' },
  // ── New Voxel Monsters ──
  'Tentacle Horror':    { hp: 320,  atk: 22, def: 10, spd: 35,  rng: 80,  color: '#5e2a8a', xp: 80,  gold: 50,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Timber Wolf':        { hp: 140,  atk: 18, def: 6,  spd: 78,  rng: 50,  color: '#6b6b6b', xp: 32,  gold: 16,  isBoss: false, size: 13, attackStyle: 'melee' },
  'Cave Bear':          { hp: 400,  atk: 28, def: 16, spd: 38,  rng: 65,  color: '#5a3a1a', xp: 90,  gold: 55,  isBoss: false, size: 20, attackStyle: 'melee' },
  'Pit Demon':          { hp: 550,  atk: 35, def: 14, spd: 50,  rng: 100, color: '#aa1111', xp: 140, gold: 90,  isBoss: false, size: 22, attackStyle: 'aoe' },
  'Sky Hawk':           { hp: 120,  atk: 20, def: 4,  spd: 82,  rng: 110, color: '#8b6914', xp: 35,  gold: 20,  isBoss: false, size: 14, attackStyle: 'ranged' },
  // ── Sloarscorth (Zone 3) — Frozen Crystal Highlands ──
  'Frost Wolf':          { hp: 130,  atk: 16, def: 5,  spd: 75,  rng: 50,  color: '#a0c4e8', xp: 28,  gold: 14,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Ice Spider':          { hp: 90,   atk: 18, def: 4,  spd: 68,  rng: 50,  color: '#88ccee', xp: 24,  gold: 12,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Crystal Golem':       { hp: 380,  atk: 26, def: 24, spd: 22,  rng: 60,  color: '#4fc3f7', xp: 70,  gold: 40,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Ice Wraith':          { hp: 140,  atk: 22, def: 3,  spd: 48,  rng: 160, color: '#b3e5fc', xp: 45,  gold: 28,  isBoss: false, size: 12, attackStyle: 'ranged' },
  'Frozen Skeleton':     { hp: 120,  atk: 14, def: 8,  spd: 52,  rng: 55,  color: '#cfd8dc', xp: 30,  gold: 16,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Stoneage Brute':      { hp: 350,  atk: 30, def: 14, spd: 32,  rng: 65,  color: '#8d6e63', xp: 75,  gold: 45,  isBoss: false, size: 16, attackStyle: 'melee' },
  'Undead Warden':       { hp: 260,  atk: 22, def: 18, spd: 38,  rng: 60,  color: '#78909c', xp: 65,  gold: 38,  isBoss: false, size: 14, attackStyle: 'melee' },
  // ── Sloarscorth Roaming Bosses ──
  'KASA':                { hp: 1800, atk: 45, def: 22, spd: 40,  rng: 100, color: '#ff7043', xp: 500, gold: 350, isBoss: true,  size: 30, attackStyle: 'melee' },
  'SHOGUN':              { hp: 2000, atk: 52, def: 26, spd: 36,  rng: 120, color: '#e53935', xp: 600, gold: 400, isBoss: true,  size: 32, attackStyle: 'aoe' },

  // ══════════════════════════════════════════════════════════
  // GRUDGE Legacy Monsters (from Unity FRESH GRUDGE project)
  // ══════════════════════════════════════════════════════════

  // World mobs
  'Raptor':             { hp: 140,  atk: 20, def: 5,  spd: 80,  rng: 50,  color: '#a0522d', xp: 35,  gold: 18,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Rhino':              { hp: 350,  atk: 28, def: 20, spd: 35,  rng: 70,  color: '#696969', xp: 75,  gold: 40,  isBoss: false, size: 20, attackStyle: 'melee' },
  'Crab':               { hp: 90,   atk: 12, def: 10, spd: 30,  rng: 40,  color: '#ff6347', xp: 18,  gold: 8,   isBoss: false, size: 8,  attackStyle: 'melee' },
  'Scorpion':           { hp: 130,  atk: 22, def: 8,  spd: 50,  rng: 50,  color: '#8b4513', xp: 38,  gold: 22,  isBoss: false, size: 11, attackStyle: 'melee' },
  'War Saber':          { hp: 180,  atk: 24, def: 7,  spd: 70,  rng: 55,  color: '#c0c0c0', xp: 45,  gold: 28,  isBoss: false, size: 14, attackStyle: 'melee' },
  'Grunk':              { hp: 110,  atk: 16, def: 6,  spd: 55,  rng: 50,  color: '#556b2f', xp: 28,  gold: 15,  isBoss: false, size: 10, attackStyle: 'melee' },
  'Young Ent':          { hp: 160,  atk: 14, def: 12, spd: 22,  rng: 60,  color: '#228b22', xp: 35,  gold: 12,  isBoss: false, size: 14, attackStyle: 'melee' },
  'Elder Ent':          { hp: 500,  atk: 28, def: 24, spd: 18,  rng: 70,  color: '#006400', xp: 120, gold: 70,  isBoss: true,  size: 26, attackStyle: 'melee' },
  'Corrupted Ent':      { hp: 300,  atk: 22, def: 16, spd: 25,  rng: 65,  color: '#4a0e4a', xp: 65,  gold: 35,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Hairy Spider':       { hp: 95,   atk: 18, def: 4,  spd: 68,  rng: 50,  color: '#3e2723', xp: 26,  gold: 14,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Poison Spider':      { hp: 80,   atk: 16, def: 3,  spd: 72,  rng: 50,  color: '#4caf50', xp: 24,  gold: 12,  isBoss: false, size: 10, attackStyle: 'melee' },

  // Dungeon mobs
  'Gargoyle':           { hp: 220,  atk: 22, def: 16, spd: 42,  rng: 55,  color: '#607d8b', xp: 55,  gold: 35,  isBoss: false, size: 14, attackStyle: 'melee' },
  'Minotaur':           { hp: 450,  atk: 32, def: 18, spd: 45,  rng: 65,  color: '#795548', xp: 110, gold: 70,  isBoss: true,  size: 22, attackStyle: 'melee' },
  'Arachnid':           { hp: 160,  atk: 20, def: 6,  spd: 58,  rng: 50,  color: '#424242', xp: 42,  gold: 25,  isBoss: false, size: 14, attackStyle: 'melee' },
  'Demon':              { hp: 300,  atk: 30, def: 10, spd: 50,  rng: 90,  color: '#b71c1c', xp: 85,  gold: 55,  isBoss: false, size: 16, attackStyle: 'aoe' },
  'Arch Demon':         { hp: 800,  atk: 42, def: 18, spd: 42,  rng: 110, color: '#880e4f', xp: 250, gold: 180, isBoss: true,  size: 26, attackStyle: 'aoe' },
  'Dryad':              { hp: 130,  atk: 16, def: 8,  spd: 48,  rng: 100, color: '#66bb6a', xp: 35,  gold: 20,  isBoss: false, size: 11, attackStyle: 'ranged' },
  'Horn Beetle':        { hp: 180,  atk: 20, def: 14, spd: 40,  rng: 50,  color: '#33691e', xp: 45,  gold: 25,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Cave Hound':         { hp: 120,  atk: 18, def: 5,  spd: 65,  rng: 50,  color: '#4e342e', xp: 30,  gold: 16,  isBoss: false, size: 11, attackStyle: 'melee' },
  'Fiend':              { hp: 200,  atk: 24, def: 8,  spd: 52,  rng: 80,  color: '#6a1b9a', xp: 55,  gold: 35,  isBoss: false, size: 13, attackStyle: 'ranged' },
  'Reptilian':          { hp: 170,  atk: 20, def: 10, spd: 55,  rng: 55,  color: '#388e3c', xp: 42,  gold: 26,  isBoss: false, size: 12, attackStyle: 'melee' },
  'Ogre':               { hp: 500,  atk: 35, def: 14, spd: 32,  rng: 70,  color: '#827717', xp: 110, gold: 65,  isBoss: true,  size: 24, attackStyle: 'melee' },
  'Ogre Bone Crusher':  { hp: 650,  atk: 40, def: 18, spd: 30,  rng: 75,  color: '#6d4c41', xp: 160, gold: 100, isBoss: true,  size: 26, attackStyle: 'melee' },
  'Juggernaut':         { hp: 1000, atk: 38, def: 28, spd: 25,  rng: 65,  color: '#455a64', xp: 250, gold: 180, isBoss: true,  size: 28, attackStyle: 'melee' },
  'Yeti':               { hp: 600,  atk: 32, def: 20, spd: 38,  rng: 70,  color: '#eceff1', xp: 140, gold: 90,  isBoss: true,  size: 24, attackStyle: 'melee' },
  'Kraken':             { hp: 900,  atk: 40, def: 16, spd: 30,  rng: 150, color: '#006064', xp: 300, gold: 220, isBoss: true,  size: 30, attackStyle: 'aoe' },
  'Mimic':              { hp: 200,  atk: 26, def: 12, spd: 0,   rng: 50,  color: '#ffd600', xp: 60,  gold: 80,  isBoss: false, size: 10, attackStyle: 'melee' },

  // Golem variants
  'Ice Golem':          { hp: 400,  atk: 26, def: 22, spd: 24,  rng: 60,  color: '#b3e5fc', xp: 80,  gold: 45,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Lava Golem':         { hp: 420,  atk: 30, def: 20, spd: 22,  rng: 65,  color: '#ff5722', xp: 85,  gold: 50,  isBoss: false, size: 18, attackStyle: 'melee' },
  'Forest Golem':       { hp: 350,  atk: 22, def: 20, spd: 26,  rng: 60,  color: '#2e7d32', xp: 70,  gold: 38,  isBoss: false, size: 17, attackStyle: 'melee' },
  'Stone Golem':        { hp: 380,  atk: 24, def: 24, spd: 20,  rng: 58,  color: '#757575', xp: 75,  gold: 42,  isBoss: false, size: 18, attackStyle: 'melee' },

  // Drake variants (10 — mountable after taming)
  'Emerald Drake':      { hp: 750,  atk: 34, def: 16, spd: 55,  rng: 130, color: '#00e676', xp: 180, gold: 120, isBoss: false, size: 22, attackStyle: 'ranged' },
  'Forest Drake':       { hp: 700,  atk: 30, def: 18, spd: 52,  rng: 120, color: '#1b5e20', xp: 160, gold: 100, isBoss: false, size: 20, attackStyle: 'ranged' },
  'Frigid Drake':       { hp: 720,  atk: 32, def: 16, spd: 50,  rng: 125, color: '#4dd0e1', xp: 170, gold: 110, isBoss: false, size: 21, attackStyle: 'ranged' },
  'Hellfire Drake':     { hp: 800,  atk: 38, def: 14, spd: 58,  rng: 140, color: '#ff3d00', xp: 200, gold: 140, isBoss: false, size: 23, attackStyle: 'aoe' },
  'Lava Drake':         { hp: 780,  atk: 36, def: 15, spd: 50,  rng: 130, color: '#dd2c00', xp: 190, gold: 130, isBoss: false, size: 22, attackStyle: 'aoe' },
  'Nightstalker Drake': { hp: 680,  atk: 34, def: 12, spd: 65,  rng: 120, color: '#311b92', xp: 170, gold: 110, isBoss: false, size: 20, attackStyle: 'melee' },
  'Rock Drake':         { hp: 850,  atk: 30, def: 26, spd: 38,  rng: 110, color: '#8d6e63', xp: 180, gold: 120, isBoss: false, size: 24, attackStyle: 'melee' },
  'Void Drake':         { hp: 900,  atk: 40, def: 18, spd: 48,  rng: 150, color: '#1a237e', xp: 250, gold: 180, isBoss: true,  size: 26, attackStyle: 'aoe' },
  'Dragon Bone Drake':  { hp: 950,  atk: 42, def: 22, spd: 45,  rng: 140, color: '#fafafa', xp: 280, gold: 200, isBoss: true,  size: 28, attackStyle: 'aoe' },

  // Dark Elves
  'Dark Elf Guard':     { hp: 180,  atk: 20, def: 12, spd: 55,  rng: 55,  color: '#37474f', xp: 45,  gold: 28,  isBoss: false, size: 11, attackStyle: 'melee' },
  'Dark Elf Archer':    { hp: 140,  atk: 22, def: 6,  spd: 58,  rng: 200, color: '#263238', xp: 42,  gold: 26,  isBoss: false, size: 10, attackStyle: 'ranged' },
  'Dark Elf Commander': { hp: 350,  atk: 28, def: 16, spd: 50,  rng: 65,  color: '#1a237e', xp: 100, gold: 65,  isBoss: true,  size: 13, attackStyle: 'melee' },
  'Dark Elf Lord':      { hp: 700,  atk: 38, def: 22, spd: 45,  rng: 80,  color: '#0d47a1', xp: 220, gold: 150, isBoss: true,  size: 16, attackStyle: 'aoe' },

  // World bosses
  'Cerberus':           { hp: 1600, atk: 48, def: 22, spd: 50,  rng: 80,  color: '#b71c1c', xp: 450, gold: 350, isBoss: true,  size: 30, attackStyle: 'melee' },
  'Gorgoz':             { hp: 1400, atk: 44, def: 26, spd: 35,  rng: 100, color: '#4a148c', xp: 400, gold: 300, isBoss: true,  size: 28, attackStyle: 'aoe' },
  'Ancient Thresher':   { hp: 1800, atk: 50, def: 20, spd: 40,  rng: 120, color: '#1b5e20', xp: 500, gold: 380, isBoss: true,  size: 32, attackStyle: 'aoe' },
  'Vile Terror Bringer':{ hp: 2000, atk: 55, def: 24, spd: 38,  rng: 110, color: '#311b92', xp: 600, gold: 450, isBoss: true,  size: 34, attackStyle: 'aoe' },
  'Corrupted Flame Eater':{ hp: 1500, atk: 46, def: 18, spd: 45, rng: 130, color: '#ff6f00', xp: 420, gold: 320, isBoss: true, size: 28, attackStyle: 'aoe' },
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
  hitStopTimer: number;       // >0 = animation frozen (impact freeze)
  homeX: number;
  homeY: number;
  leashRange: number;
  zoneId: number;
  spawnIndex: number;    // which monsterSpawn this came from
  respawnTimer: number;  // countdown after death
  level: number;
  attackStyle: 'melee' | 'ranged' | 'aoe';
  aoeTelegraph: { x: number; y: number; timer: number; radius: number } | null;
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
  comboStep: number;
  comboTimer: number;
  heavyAttackCooldown: number;
  meleeAnimTimer: number;
  hitStopTimer: number;       // >0 = animation frozen (impact freeze)
  // MMO controls
  stamina: number;
  maxStamina: number;
  sprinting: boolean;
  dodgeTimer: number;       // >0 = currently in dodge roll
  dodgeCooldown: number;    // >0 = dodge on CD
  dodgeInvuln: boolean;     // true during dodge i-frames
  lockedTargetId: number | null;
  // Spell combo
  spellComboCount: number;  // consecutive ability casts
  spellComboTimer: number;  // resets combo after window expires
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
  homing: boolean;
  vx: number;
  vy: number;
  glbSprite?: string;
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
  life: number; maxLife: number; vy: number; size: number;
}

export interface OWSpellEffect {
  x: number; y: number;
  type: 'cast_circle' | 'impact_ring' | 'aoe_blast' | 'skillshot_trail' | 'cone_sweep' | 'dash_trail' | 'melee_slash' | 'melee_lunge' | 'heavy_slash' | 'enemy_slash' | 'enemy_aoe_telegraph' | 'enemy_aoe_blast';
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
  dialogue: string[];   // greeting lines (randomly picked)
  shopTier: number;     // controls equipment tier sold
}

export type NPCDialogTab = 'shop' | 'quests' | 'train' | 'craft' | 'consumables';

export interface ActiveNPCDialog {
  npc: OWNPC;
  tab: NPCDialogTab;
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
  screenShake: { timer: number; intensity: number };
  hitFlash: Map<number, number>;  // entityId → flash remaining
  comboDisplay: { count: number; timer: number };
  ambientParticles: OWParticle[];
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

  // NPC dialog
  activeNPC: ActiveNPCDialog | null;

  // Animation FSM
  animFSM: OWAnimFSM;

  // Pre-allocated effect pool (replaces spellEffects for hot-path usage)
  effectPool: EffectPool;

  // Mission system
  missionLog: MissionLog;

  // Terrain cache (only tiles near player are generated)
  terrainCache: Map<string, DungeonTileVoxelType>;

  // AI-generated world data (from world editor)
  generatedWorld: GeneratedWorldData | null;

  // Phase 6-7 systems
  heightmap: WorldHeightmap;
  boatState: BoatState;
  boatDocks: BoatDock[];
  spawnerManager: SpawnerManager;
  eventManager: ZoneEventManager;

  // Voxel projectiles (class ranged attacks + spell effects)
  voxelProjectiles: VoxelProjectile[];
  rangedAttackCooldown: number;

  // ── Town building system ──
  /** When non-null, player is inside this building */
  activeBuilding: TownBuilding | null;
  /** Player's position inside the building interior (0..1 of room) */
  interiorPlayer: { x: number; y: number };
  /** Which interior NPC is being talked to */
  activeInteriorNPC: InteriorNPCDef | null;
  /** Cooldown so one E press doesn't immediately exit+enter */
  interactCooldown: number;

  /** AI faction heroes living in the world */
  aiHeroes: import('./ai-hero-brain').AIHeroInstance[];

  /** Consumable hotbar — 3 slots for keys 6, 7, 8 */
  consumableSlots: [ConsumableHotbarItem | null, ConsumableHotbarItem | null, ConsumableHotbarItem | null];

  /** V2: Modular voxel config for the player character */
  modularConfig: ModularVoxelConfig | null;
  /** V2: Faction hero NPCs at dock (rendered as voxel heroes) */
  factionHeroNPCs: FactionHeroNPC[];
  /** V2: Dock structures (piers, boats, flags) for all faction docks */
  factionDockStructures: DockStructure[];
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
  zoneId: number;
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
  // Missions
  activeMissions: { id: string; name: string; status: string; objectives: { type: string; target: string; current: number; required: number }[] }[];
  nearbyDungeon: DungeonEntrance | null;
  // MMO controls
  stamina: number;
  maxStamina: number;
  sprinting: boolean;
  dodgeCooldown: number;
  lockedTargetId: number | null;
  nearbyInteractable: string | null; // label for "Press E" prompt
  // NPC dialog
  activeNPC: ActiveNPCDialog | null;
  // Equipment
  equipSlots: { slot: string; label: string; icon: string; item: { name: string; tier: number; atk: number; def: number; hp: number; setName: string; iconUrl?: string } | null }[];
  bagItems: { id: string; name: string; slot: string; tier: number; atk: number; def: number; hp: number; mp: number; iconUrl?: string; passive?: string; lore?: string; setName: string }[];
  consumableHotbar: ({ name: string; category: string; iconPath: string | null; count: number; color: string } | null)[];
  setBonuses: { setName: string; pieces: number }[];
  // Professions
  gatheringProfs: { id: string; name: string; icon: string; color: string; level: number; xp: number; xpToNext: number; tier: number; tierName: string; tierColor: string }[];
  craftingProfs: { id: string; name: string; icon: string; color: string; level: number; xp: number; xpToNext: number; tier: number; tierName: string; tierColor: string }[];
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

// Simple open-world walkability — delegates to heightmap when available, falls back to bounds check
// Also checks world collision (walls, water, decorations) from the new collision system
let _activeHeightmap: WorldHeightmap | null = null;
let _activeBoatMounted = false;
let _activeJumping = false;
function isWalkableOW(x: number, y: number): boolean {
  // Bounds check
  if (x < 10 || y < 10 || x >= OPEN_WORLD_SIZE - 10 || y >= OPEN_WORLD_SIZE - 10) return false;

  // Tilemap passability check (new system — authoritative when active)
  const tm = getActiveZoneTilemap();
  if (tm) {
    if (!tm.isPassableAtPx(x, y)) return false;
  }

  // Heightmap check — when jumping, use isJumpable to clear low obstacles
  if (_activeHeightmap) {
    if (_activeJumping) {
      if (!_activeHeightmap.isJumpable(x, y)) return false;
    } else {
      if (!_activeHeightmap.isWalkable(x, y, _activeBoatMounted)) return false;
    }
  }
  // New collision checks: stone walls + deep water (walls always block, even jumping)
  if (collidesWithWall(x, y, 10)) return false;
  if (!_activeJumping && isDeepWater(x, y)) return false;
  return true;
}

/** Check if a world position is near any zone edge (for shoreline foam) */
function isNearAnyZone(wx: number, wy: number, dist: number): boolean {
  for (const zone of ISLAND_ZONES) {
    const b = zone.bounds;
    // Check if we're outside the zone but within `dist` pixels of its edge
    if (wx >= b.x - dist && wx <= b.x + b.w + dist &&
        wy >= b.y - dist && wy <= b.y + b.h + dist) {
      // But NOT inside the zone itself
      if (wx < b.x || wx > b.x + b.w || wy < b.y || wy > b.y + b.h) {
        return true;
      }
    }
  }
  return false;
}

// Get terrain type for a tile based on which zone it falls in
function getTerrainForPosition(wx: number, wy: number): DungeonTileVoxelType {
  const zone = getZoneAtPosition(wx, wy);
  if (!zone) return 'floor'; // outside zones = ocean (walkable by boat)
  return ZONE_TERRAIN[zone.terrainType] || 'floor';
}

// ── Create State ───────────────────────────────────────────────

export function createOpenWorldState(heroId: number): OpenWorldState {
  const hd = HEROES.find(h => h.id === heroId) || HEROES[0];
  const baseStats = heroStatsAtLevel(hd, 1);
  const playerAttrs = loadAttributes(hd.heroClass);
  const attrStats = applyAttributeBonus(baseStats, playerAttrs, hd.heroClass);

  // Apply equipment stats on top of attribute-enhanced base stats
  const equip = loadEquipment();
  const eqStats = computeEquipmentStats(equip);
  const stats = {
    hp: attrStats.hp + eqStats.hp,
    atk: attrStats.atk + eqStats.atk,
    def: attrStats.def + eqStats.def,
    spd: attrStats.spd + eqStats.spd,
    mp: attrStats.mp + eqStats.mp,
  };

  // Resolve spawn — new players start on Genesis Island (Zone 10)
  // Existing players with a faction spawn at their faction dock
  const currentChar = getCurrentCharacter();
  let spawn: { x: number; y: number };
  let startZone = ISLAND_ZONES[0];

  const genesisZone = ISLAND_ZONES.find(z => z.id === 10);

  if (currentChar?.level && currentChar.level > 1 && currentChar.faction) {
    // Returning player → faction dock
    const factionSpawn = getFactionSpawnPoint(currentChar);
    const factionZone = ISLAND_ZONES.find(z => z.id === factionSpawn.zoneId);
    if (factionZone) {
      startZone = factionZone;
      spawn = { x: factionSpawn.x, y: factionSpawn.y };
    } else {
      spawn = startZone.playerSpawns[0];
    }
  } else if (genesisZone) {
    // New player → Genesis Island (Zone 10)
    startZone = genesisZone;
    spawn = startZone.playerSpawns[0];
  } else {
    spawn = startZone.playerSpawns[0];
  }

  // Build modular voxel config from character state (or defaults)
  const modularConfig: ModularVoxelConfig = currentChar?.modularConfig
    ?? defaultModularConfig(hd.race, hd.heroClass);

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
      abilityCooldowns: [0, 0, 0, 0, 0],
      facing: 0,
      animState: 'idle',
      animTimer: 0,
      vx: 0, vy: 0,
      dead: false,
      activeEffects: [],
      ccImmunityTimers: new Map(),
      shieldHp: 0,
      kills: 0,
      comboStep: 0,
      comboTimer: 0,
      heavyAttackCooldown: 0,
      meleeAnimTimer: 0,
      hitStopTimer: 0,
      stamina: 100,
      maxStamina: 100,
      sprinting: false,
      dodgeTimer: 0,
      spellComboCount: 0,
      spellComboTimer: 0,
      dodgeCooldown: 0,
      dodgeInvuln: false,
      lockedTargetId: null,
    },
    enemies: [],
    npcs: [],
    projectiles: [],
    particles: [],
    floatingTexts: [],
    spellEffects: [],
    camera: { x: spawn.x, y: spawn.y, zoom: 1.2 },
    screenShake: { timer: 0, intensity: 0 },
    hitFlash: new Map(),
    comboDisplay: { count: 0, timer: 0 },
    ambientParticles: [],
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
    activeNPC: null,
    animFSM: new OWAnimFSM(),
    effectPool: new EffectPool(128),
    missionLog: loadMissionLog(),
    terrainCache: new Map(),
    generatedWorld: null as any, // tilemap engine replaces old ai-map-gen
    heightmap: null as any, // initialized below
    boatState: createBoatState(),
    boatDocks: BOAT_DOCKS,
    spawnerManager: null as any, // initialized below
    eventManager: createZoneEventManager(),
    // Town building system
    activeBuilding: null,
    interiorPlayer: { x: 0.5, y: 0.75 },
    activeInteriorNPC: null,
    interactCooldown: 0,
    // Consumable hotbar
    consumableSlots: [null, null, null] as [ConsumableHotbarItem | null, ConsumableHotbarItem | null, ConsumableHotbarItem | null],
    // V2: Modular character + faction systems
    modularConfig,
    factionHeroNPCs: currentChar?.faction
      ? getFactionNPCs(currentChar.faction)
      : getFactionNPCs('Crusade'),
    factionDockStructures: getAllFactionDocks().flatMap(d => generateDockStructures(d)),
  } as unknown as OpenWorldState;
  // Assigned separately because TypeScript requires these to exist at runtime
  // but the interface uses them as non-optional for convenience
  state.voxelProjectiles = [];
  state.rangedAttackCooldown = 0;

  // ── Zone Cluster: track which zone is loaded ──
  (state as any).zoneCluster = createZoneClusterState(startZone.id);

  // ── Generate tilemap for starting zone ──
  const _startTilemap = createZoneTilemap(startZone.id);
  const _startBiomeMask = generateBiomeMask(startZone, startZone.id * 12345);
  generateAllChunks(_startTilemap, _startBiomeMask, startZone, startZone.id * 12345);
  validateZone(_startTilemap, _startBiomeMask, startZone);

  // Initialize heightmap from generated world data
  state.heightmap = createWorldHeightmap(state.generatedWorld);
  // Build spawner defs from zone data + heightmap
  state.spawnerManager = createSpawnerManager(state.heightmap);

  // Generate NPCs and resource nodes from zone definitions
  generateNPCs(state);
  generateResourceNodes(state);

  // Spawn AI faction heroes (dynamic import — avoids require() in Vite ESM bundle)
  (state as any).aiHeroes = [];
  import('./ai-hero-brain').then(mod => {
    (state as any)._aiHeroBrainModule = mod;
    (state as any).aiHeroes = mod.createAllAIHeroes();
  }).catch(() => {
    (state as any).aiHeroes = [];
  });

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

// NPC name + dialogue tables per zone
const NPC_LORE: Record<number, { merchant: { name: string; dialogue: string[] }; trainer: { name: string; dialogue: string[] }; quest: { name: string; dialogue: string[] }; crafter: { name: string; dialogue: string[] } }> = {
  0: {
    merchant: { name: 'Griselda the Peddler', dialogue: ['Looking to buy or sell?', 'Fresh wares from the capital!', 'Gold speaks louder than steel.'] },
    trainer:  { name: 'Orin Deepmind', dialogue: ['Seeking to refine your talents?', 'Wisdom begins with knowing oneself.', 'I can reset your attributes… for a price.'] },
    quest:    { name: 'Elder Maren', dialogue: ['The village needs your aid, adventurer.', 'Dark tidings from the forest…', 'Will you answer the call?'] },
    crafter:  { name: 'Forge-Master Dunn', dialogue: ['Bring materials and I\'ll craft wonders.', 'The anvil waits for no one.', 'Quality takes time and ore.'] },
  },
  1: {
    merchant: { name: 'Whisper Merchant', dialogue: ['Sssh… fine goods, low prices.'] },
    trainer:  { name: 'Ranger Lysse', dialogue: ['The forest teaches patience.'] },
    quest:    { name: 'Scout Thorn', dialogue: ['The woods crawl with danger.'] },
    crafter:  { name: 'Woodcarver Elm', dialogue: ['Bring me timber and I\'ll shape it.'] },
  },
};
const DEFAULT_NPC_LORE = {
  merchant: { name: 'Traveling Merchant', dialogue: ['Wares for sale!'] },
  trainer:  { name: 'Wandering Sage', dialogue: ['I can help you respec.'] },
  quest:    { name: 'Adventurer', dialogue: ['Need something done?'] },
  crafter:  { name: 'Tinker', dialogue: ['Got materials?'] },
};

function generateNPCs(state: OpenWorldState): void {
  // Only generate NPCs for the active zone (cluster system)
  const cluster: ZoneClusterState | undefined = (state as any).zoneCluster;
  const zones = cluster ? [getActiveZone(cluster)] : ISLAND_ZONES;
  for (const zone of zones) {
    const typeOrder: OWNPC['type'][] = zone.isSafeZone
      ? ['merchant', 'trainer', 'quest', 'crafter']
      : ['quest'];
    for (let i = 0; i < zone.npcPositions.length; i++) {
      const pos = zone.npcPositions[i];
      const npcType = typeOrder[i % typeOrder.length];
      const lore = (NPC_LORE[zone.id] || DEFAULT_NPC_LORE)[npcType] || DEFAULT_NPC_LORE[npcType];
      const shopTier = Math.max(1, Math.min(8, Math.ceil(zone.requiredLevel / 3)));
      state.npcs.push({
        id: state.nextId++,
        x: pos.x, y: pos.y,
        name: lore.name,
        type: npcType,
        zoneId: zone.id,
        facing: Math.random() * Math.PI * 2,
        dialogue: lore.dialogue,
        shopTier,
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
  const cluster: ZoneClusterState | undefined = (state as any).zoneCluster;
  const zones = cluster ? [getActiveZone(cluster)] : ISLAND_ZONES;
  for (const zone of zones) {
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
    // Mission collect tracking
    const collectComplete = onMissionCollect(state.missionLog, r.name);
    for (const _mid of collectComplete) {
      state.killFeed.push({ text: `MISSION COMPLETE!`, color: '#ffd700', time: state.gameTime });
    }
    if (collectComplete.length > 0) saveMissionLog(state.missionLog);
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

/** Unified E-key interaction: player > NPC > building > dungeon > harvest */
function handleOWInteract(state: OpenWorldState): void {
  if (state.player.dead) return;
  if (state.interactCooldown > 0) return;
  const p = state.player;

  // ── Player interaction (highest priority) ──
  if (!state.activeBuilding) {
    const aiHeroes = (state.aiHeroes || []).map(h => ({
      id: h.heroData?.id ?? 0, name: h.heroData?.name ?? 'Hero',
      race: h.heroData?.race ?? 'Human', heroClass: h.heroData?.heroClass ?? 'Warrior',
      level: h.level ?? 1, x: h.x, y: h.y, dead: h.dead ?? false,
    }));
    const nearbyPlayer = getNearbyPlayer(p.x, p.y, aiHeroes);
    if (nearbyPlayer) {
      // Initialize interact menu if not present
      if (!(state as any)._interactMenu) {
        (state as any)._interactMenu = createInteractMenuState();
      }
      const menu = (state as any)._interactMenu as InteractMenuState;
      if (menu.open && menu.target?.sessionId === nearbyPlayer.sessionId) {
        // Already open for this player — close it (toggle)
        closeInteractMenu(menu);
      } else {
        openInteractMenu(menu, nearbyPlayer, (state as any)._partyState, (state as any)._guildState);
      }
      state.interactCooldown = 0.3;
      return;
    }
  }

  // ── Inside a building: talk to NPC or exit via door ──
  if (state.activeBuilding) {
    const b = state.activeBuilding;
    // Door exit: player near the bottom-centre (iy > 0.82)
    if (state.interiorPlayer.y > 0.82) {
      exitBuilding(state);
      return;
    }
    // Talk to interior NPC
    const iPx = state.interiorPlayer.x;
    const iPy = state.interiorPlayer.y;
    let nearest: InteriorNPCDef | null = null;
    let nearestD = 0.18;
    for (const inpc of b.npcs) {
      const d = Math.sqrt((iPx - inpc.ix) ** 2 + (iPy - inpc.iy) ** 2);
      if (d < nearestD) { nearestD = d; nearest = inpc; }
    }
    if (nearest) {
      state.activeInteriorNPC = nearest;
      // Innkeeper: restore HP and MP
      if (nearest.role === 'innkeeper') {
        const p = state.player;
        const healed = p.maxHp - p.hp;
        const restored = p.maxMp - p.mp;
        p.hp = p.maxHp;
        p.mp = p.maxMp;
        if (healed > 0 || restored > 0) {
          state.killFeed.push({ text: `${nearest.name}: Rested and recovered! (+${Math.floor(healed)} HP, +${Math.floor(restored)} MP)`, color: '#22c55e', time: state.gameTime });
        } else {
          const greeting = nearest.dialogue[Math.floor(Math.random() * nearest.dialogue.length)];
          state.killFeed.push({ text: `${nearest.name}: "${greeting}"`, color: '#ffd700', time: state.gameTime });
        }
        return;
      }
      // All other roles: open the real NPC dialog panel
      const roleToType: Record<string, OWNPC['type']> = {
        vendor: 'merchant', blacksmith: 'crafter', trainer: 'trainer',
        quest: 'quest', guard: 'quest',
      };
      const npcType: OWNPC['type'] = roleToType[nearest.role] || 'merchant';
      const zone = state.activeBuilding!.zoneId;
      const shopTier = Math.max(1, Math.min(8, Math.ceil((zone + 1) * 1.5)));
      const syntheticNPC: OWNPC = {
        id: -1,
        x: state.player.x, y: state.player.y,
        name: nearest.name,
        type: npcType,
        zoneId: zone,
        facing: 0,
        dialogue: nearest.dialogue,
        shopTier,
      };
      openNPCDialog(state, syntheticNPC);
    }
    return;
  }

  // Try dungeon entrance first (closest priority)
  const entrance = getDungeonEntranceNear(ISLAND_ZONES[0], p.x, p.y, 80);
  if (entrance && distXY(p, entrance) < 60) {
    enterOWDungeon(state);
    return;
  }

  // Try building entry
  const bldg = getBuildingNear(p.x, p.y, 70);
  if (bldg) {
    enterBuilding(state, bldg);
    return;
  }

  // Try NPC interaction
  for (const npc of state.npcs) {
    if (distXY(p, npc) < 60) {
      openNPCDialog(state, npc);
      return;
    }
  }

  // Fall through to harvesting
  handleOWHarvest(state);
}

/** Enter a town building */
export function enterBuilding(state: OpenWorldState, bldg: TownBuilding): void {
  state.activeBuilding = bldg;
  state.interiorPlayer = { x: 0.5, y: 0.85 };
  state.activeInteriorNPC = null;
  state.interactCooldown = 0.5;
  state.killFeed.push({ text: `Entered: ${bldg.name}`, color: '#c5a059', time: state.gameTime });
}

/** Exit current building back to world */
export function exitBuilding(state: OpenWorldState): void {
  state.activeBuilding = null;
  state.activeInteriorNPC = null;
  state.interactCooldown = 0.5;
  state.killFeed.push({ text: 'Returned to the world.', color: '#9a9a9a', time: state.gameTime });
}

// ── NPC Dialog Open / Close ────────────────────────────────────

export function openNPCDialog(state: OpenWorldState, npc: OWNPC): void {
  const defaultTab: NPCDialogTab = npc.type === 'merchant' ? 'shop' : npc.type === 'trainer' ? 'train' : npc.type === 'crafter' ? 'craft' : 'quests';
  state.activeNPC = { npc, tab: defaultTab };
  const greeting = npc.dialogue[Math.floor(Math.random() * npc.dialogue.length)] || `Talking to ${npc.name}...`;
  state.killFeed.push({ text: greeting, color: '#ffd700', time: state.gameTime });
}

export function closeNPCDialog(state: OpenWorldState): void {
  state.activeNPC = null;
}

/** Space key: dodge roll with i-frames */
export function handleOWDodge(state: OpenWorldState): void {
  const p = state.player;
  if (p.dead || p.dodgeCooldown > 0 || p.dodgeTimer > 0 || isStunned(p as any)) return;
  if (p.stamina < 20) return; // costs 20 stamina
  p.stamina -= 20;
  p.dodgeTimer = 0.3;
  p.dodgeCooldown = 1.0;
  p.dodgeInvuln = true;
  state.animFSM.tryTransition('dodge', true);
  p.meleeAnimTimer = 0; // cancel melee if mid-swing
  spawnParticles(state, p.x, p.y, '#9a8a6a', 6);
}

/** Tab key: cycle through nearby enemies for target lock */
export function handleOWTargetCycle(state: OpenWorldState): void {
  const p = state.player;
  if (p.dead) return;

  // Gather living enemies within aggro range, sorted by distance
  const nearby = state.enemies
    .filter(e => !e.dead && distXY(p, e) < AGGRO_RANGE * 2)
    .sort((a, b) => distXY(p, a) - distXY(p, b));

  if (nearby.length === 0) {
    p.lockedTargetId = null;
    return;
  }

  // Find current locked index
  const curIdx = p.lockedTargetId !== null
    ? nearby.findIndex(e => e.id === p.lockedTargetId)
    : -1;

  // Cycle to next
  const nextIdx = (curIdx + 1) % nearby.length;
  p.lockedTargetId = nearby[nextIdx].id;
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

  // Only spawn enemies for the active zone (cluster system)
  const _cluster: ZoneClusterState | undefined = (state as any).zoneCluster;
  const _spawnZones = _cluster ? [getActiveZone(_cluster)] : ISLAND_ZONES;
  for (const zone of _spawnZones) {
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
          leashRange: template.isBoss ? BOSS_LEASH_RANGE : BASE_LEASH_RANGE,
          zoneId: zone.id,
          spawnIndex: si,
          respawnTimer: 0,
          level: ms.level,
          attackStyle: template.attackStyle,
          aoeTelegraph: null,
          hitStopTimer: 0,
        });
      }
    }
  }
}

// ── Update Loop ────────────────────────────────────────────────

export function updateOpenWorld(state: OpenWorldState, dt: number, keys: Set<string>, bindings?: KeybindConfig): void {
  const kb = bindings || loadKeybindings();
  if (state.paused || state.gameOver) return;
  state.gameTime += dt;

  const p = state.player;

  // Update world systems
  updateWorldState(state.worldState, dt);
  const progressEvents = updatePlayTime(state.playerProgress, dt);
  state.pendingProgressEvents.push(...progressEvents);

  // ── Zone Cluster: exit detection + transition ──
  const cluster: ZoneClusterState = (state as any).zoneCluster;
  if (cluster) {
    // Check if player walked into a zone exit
    const exit = checkPlayerZoneExit(cluster, p.x, p.y);
    if (exit) {
      beginZoneTransition(cluster, exit);
      state.killFeed.push({ text: `→ ${exit.label}`, color: '#60a5fa', time: state.gameTime });
    }

    // Update transition animation
    const shouldSwap = updateTransition(cluster, dt);
    if (shouldSwap) {
      const result = completeZoneSwap(cluster);
      // Reposition player in new zone
      p.x = result.x;
      p.y = result.y;
      state.camera.x = result.x;
      state.camera.y = result.y;
      // Clear old zone entities
      state.enemies = [];
      state.npcs = [];
      state.resourceNodes = [];
      state.projectiles = [];
      state.particles = [];
      state.floatingTexts = [];
      state.spellEffects = [];
      state.ambientParticles = [];
      // Regenerate tilemap + NPCs + resources for new zone
      const _newTilemap = createZoneTilemap(result.zone.id);
      const _newBiomeMask = generateBiomeMask(result.zone, result.zone.id * 12345);
      generateAllChunks(_newTilemap, _newBiomeMask, result.zone, result.zone.id * 12345);
      validateZone(_newTilemap, _newBiomeMask, result.zone);
      generateNPCs(state);
      generateResourceNodes(state);
      state.killFeed.push({ text: `Entered: ${result.zone.name}`, color: '#22c55e', time: state.gameTime });
    }

    updateBanner(cluster, dt);

    // Skip normal update during transition fade
    if (cluster.transitioning) return;
  }

  // Zone tracking (sub-zone within current cluster)
  const newZone = updateZoneTracker(state.zoneTracker, p.x, p.y, dt);
  if (newZone) {
    const zEvents = onZoneDiscovered(state.playerProgress, newZone.id, newZone.name);
    state.pendingProgressEvents.push(...zEvents);
    pushWorldEvent(state.worldState, 'zone_enter', newZone.name, newZone.description, 4);
    state.playerProgress.currentZoneName = newZone.name;
    state.killFeed.push({ text: `Entered: ${newZone.name}`, color: getZoneColor(newZone), time: state.gameTime });

    // Mission explore tracking
    const exploreComplete = onMissionExplore(state.missionLog, newZone.name);
    for (const _mid of exploreComplete) {
      state.killFeed.push({ text: `MISSION COMPLETE!`, color: '#ffd700', time: state.gameTime });
    }
    if (exploreComplete.length > 0) saveMissionLog(state.missionLog);

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

  // Sync heightmap for isWalkableOW delegate
  _activeHeightmap = state.heightmap;
  _activeBoatMounted = state.boatState?.mounted ?? false;
  // Track if player is currently airborne (jump/double-jump) for obstacle clearing
  // Detected via dodge animation state (jump/double-jump use 'dodge' animState)
  _activeJumping = p.animState === 'dodge' || p.dodgeTimer > 0;

  // Boat mount/dismount logic
  if (shouldMount(p.x, p.y, state.boatState, state.heightmap)) {
    mountBoat(state.boatState, p.x, p.y);
    state.killFeed.push({ text: 'Mounted boat', color: '#4fc3f7', time: state.gameTime });
  } else if (shouldDismount(p.x, p.y, state.boatState, state.heightmap)) {
    dismountBoat(state.boatState);
    state.killFeed.push({ text: 'Dismounted boat', color: '#4fc3f7', time: state.gameTime });
  }
  updateBoatPosition(state.boatState, p.x, p.y);

  // Zone event updates
  const eventUpdates = state.eventManager.update(dt, p.level, state.spawnerManager);
  for (const eu of eventUpdates) {
    state.killFeed.push({ text: eu.message, color: eu.color, time: state.gameTime });
  }

  // ── Hit-Stop (impact freeze) ──
  if (p.hitStopTimer > 0) {
    p.hitStopTimer -= dt;
    if (p.hitStopTimer <= 0) { p.hitStopTimer = 0; state.animFSM.unfreeze(); }
  }

  // ── Animation FSM tick ──
  state.animFSM.update(dt);
  p.animState = state.animFSM.state;
  p.animTimer = state.animFSM.timer;

  // Player update — compute derived stats for this frame
  const derived = computeDerivedStats(state.playerAttributes);
  // Mana + Health regen from attributes
  p.mp = Math.min(p.maxMp, p.mp + dt * derived.manaRegen);
  p.hp = Math.min(p.maxHp, p.hp + dt * derived.healthRegen);

  const effectResult = updateStatusEffects(p as any as CombatEntity, dt);
  if (effectResult.damage > 0) {
    p.hp -= effectResult.damage;
    addText(state, p.x, p.y - 20, `-${Math.floor(effectResult.damage)}`, '#ef4444', 12);
  }
  if (effectResult.heal > 0) {
    p.hp = Math.min(p.maxHp, p.hp + effectResult.heal);
    addText(state, p.x, p.y - 20, `+${Math.floor(effectResult.heal)}`, '#22c55e', 12);
  }

  // ── Dodge Roll Update ──
  if (p.dodgeTimer > 0) {
    p.dodgeTimer -= dt;
    state.animFSM.tryTransition('dodge');
    const dodgeSpeed = 400;
    const dodgeNx = p.x + Math.cos(p.facing) * dodgeSpeed * dt;
    const dodgeNy = p.y + Math.sin(p.facing) * dodgeSpeed * dt;
    if (isWalkableOW(dodgeNx, p.y)) p.x = dodgeNx;
    if (isWalkableOW(p.x, dodgeNy)) p.y = dodgeNy;
      // animState driven by FSM
    p.dodgeInvuln = p.dodgeTimer > 0.05; // i-frames for most of roll
    // Spawn dust trail
    if (Math.random() < 0.6) {
      state.particles.push({
        x: p.x - Math.cos(p.facing) * 8 + (Math.random() - 0.5) * 6,
        y: p.y - Math.sin(p.facing) * 8 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20, vy: -15 - Math.random() * 15,
        life: 0.3, maxLife: 0.3, color: '#9a8a6a', size: 3 + Math.random() * 2,
      });
    }
    if (p.dodgeTimer <= 0) { p.dodgeInvuln = false; }
  }
  if (p.dodgeCooldown > 0) p.dodgeCooldown -= dt;

  // ── Sprint / Stamina ──
  const kUp = kb[KeybindAction.MoveUp].key;
  const kDown = kb[KeybindAction.MoveDown].key;
  const kLeft = kb[KeybindAction.MoveLeft].key;
  const kRight = kb[KeybindAction.MoveRight].key;
  const kSprint = kb[KeybindAction.Sprint].key;
  const kInteract = kb[KeybindAction.Interact].key;

  p.sprinting = keys.has(kSprint) && p.stamina > 0 && !p.dead;
  if (p.sprinting && (keys.has(kUp) || keys.has(kDown) || keys.has(kLeft) || keys.has(kRight))) {
    p.stamina = Math.max(0, p.stamina - 25 * dt);
  } else {
    // Regen stamina when not sprinting
    p.stamina = Math.min(p.maxStamina, p.stamina + 15 * dt);
  }

  // Interact cooldown
  if (state.interactCooldown > 0) state.interactCooldown = Math.max(0, state.interactCooldown - dt);

  // ── Inside a building: use interior movement ──
  if (state.activeBuilding) {
    const ip = state.interiorPlayer;
    let imx = 0, imy = 0;
    if (keys.has(kUp)) imy = -1;
    if (keys.has(kDown)) imy = 1;
    if (keys.has(kLeft)) imx = -1;
    if (keys.has(kRight)) imx = 1;
    const ispd = p.spd * 0.8 * dt / state.activeBuilding.roomH;
    if (imx !== 0 || imy !== 0) {
      const ilen = Math.sqrt(imx * imx + imy * imy);
      ip.x = Math.max(0.05, Math.min(0.95, ip.x + (imx / ilen) * ispd * 2.5));
      ip.y = Math.max(0.1, Math.min(0.92, ip.y + (imy / ilen) * ispd * 1.8));
      p.facing = Math.atan2(imy, imx);
    }
    // Dismiss interior NPC dialog if player moves away
    if ((imx !== 0 || imy !== 0) && state.activeInteriorNPC) {
      state.activeInteriorNPC = null;
    }
    // Skip world movement
    p.vx = 0; p.vy = 0;
    state.animFSM.tryTransition(imx !== 0 || imy !== 0 ? 'walk' : 'idle');
    p.animState = state.animFSM.state;
    p.animTimer = state.animFSM.timer;
    // Camera follows player in world (interior renders in screen-space, no camera needed)
    // Update ambient particles, effects etc but skip enemy spawning/combat
    updateAmbientParticles(state, dt);
    if (state.screenShake.timer > 0) {
      state.screenShake.timer -= dt;
      if (state.screenShake.timer <= 0) state.screenShake.intensity = 0;
    }
    for (const ft of state.floatingTexts) { ft.y += ft.vy * dt; ft.life -= dt; }
    state.floatingTexts = state.floatingTexts.filter(ft => ft.life > 0);
    state.killFeed = state.killFeed.filter(k => state.gameTime - k.time < 6);
    // Interact key inside building
    if (keys.has(kInteract)) handleOWInteract(state);
    return;
  }

  // ── Skip movement while NPC dialog is open ──
  if (state.activeNPC) {
    p.vx = 0; p.vy = 0;
    // Still update camera, particles, etc. but skip combat/movement
  }

  // ── Movement (weather affects speed) ──
  if (!state.activeNPC && !isStunned(p as any as CombatEntity) && p.dodgeTimer <= 0) {
    let mx = 0, my = 0;
    if (keys.has(kUp)) my = -1;
    if (keys.has(kDown)) my = 1;
    if (keys.has(kLeft)) mx = -1;
    if (keys.has(kRight)) mx = 1;

    const spdMult = getSpeedMultiplier(p as any as CombatEntity) * getWeatherSpeedMod(state.worldState);
    const sprintMult = p.sprinting ? 1.6 : 1.0;
    const moveSpeedBonus = 1 + (derived.movementSpeed / 100); // AGI movement speed %
    if (!isRooted(p as any as CombatEntity) && (mx !== 0 || my !== 0)) {
      const len = Math.sqrt(mx * mx + my * my);
      const speed = p.spd * 2 * spdMult * sprintMult * moveSpeedBonus;
      p.vx = (mx / len) * speed;
      p.vy = (my / len) * speed;
      p.facing = Math.atan2(my, mx);
      state.animFSM.tryTransition('walk');
    } else {
      p.vx = 0;
      p.vy = 0;
      state.animFSM.tryTransition('idle');
    }

    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;

    // Per-axis sliding with heightmap + wall collision
    // When jumping, low obstacles (elevation 2) are clearable
    if (isWalkableOW(nx, p.y)) p.x = nx;
    if (isWalkableOW(p.x, ny)) p.y = ny;
  }

  // ── Validate locked target ──
  if (p.lockedTargetId !== null) {
    const lockedEnemy = state.enemies.find(e => e.id === p.lockedTargetId && !e.dead);
    if (!lockedEnemy || distXY(p, lockedEnemy) > DESPAWN_RADIUS) {
      p.lockedTargetId = null;
    }
  }

  // Ability cooldowns
  for (let i = 0; i < p.abilityCooldowns.length; i++) {
    if (p.abilityCooldowns[i] > 0) p.abilityCooldowns[i] -= dt;
  }

  // Melee combo timers
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) { p.comboStep = 0; }
  }
  if (p.meleeAnimTimer > 0) p.meleeAnimTimer -= dt;
  if (p.heavyAttackCooldown > 0) p.heavyAttackCooldown -= dt;
  // Spell combo decay
  if (p.spellComboTimer > 0) {
    p.spellComboTimer -= dt;
    if (p.spellComboTimer <= 0) { p.spellComboCount = 0; }
  }

  // Resource nodes
  updateResourceNodes(state, dt);

  // Interact key: harvest, NPC, dungeon entrance
  if (keys.has(kInteract)) {
    handleOWInteract(state);
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

  // Ranged attack cooldown
  if (state.rangedAttackCooldown > 0) state.rangedAttackCooldown -= dt;

  // Update voxel projectiles (class ranged attacks + spell effects)
  for (const vp of state.voxelProjectiles) {
    const trails = updateVoxelProjectile(vp, dt);
    // Spawn trail particles
    for (const tp of trails) {
      state.particles.push({ x: tp.x, y: tp.y, vx: tp.vx, vy: tp.vy, life: tp.life, maxLife: tp.maxLife, color: tp.color, size: tp.size });
    }
    // Check enemy collision using swept circle test (catches fast projectiles)
    if (!vp.dead && vp.sourceId === p.id) {
      const prevX = vp.x - Math.cos(vp.angle) * vp.speed * dt;
      const prevY = vp.y - Math.sin(vp.angle) * vp.speed * dt;
      for (const enemy of state.enemies) {
        if (enemy.dead) continue;
        if (projectileHitsCircle(prevX, prevY, vp.x, vp.y, vp.hitRadius, enemy.x, enemy.y, enemy.size)) {
          // Hit!
          const dmgOpts = buildDamageOpts(computeDerivedStats(state.playerAttributes), null);
          const result = combatCalcDamage(
            { atk: p.atk, activeEffects: p.activeEffects },
            { def: enemy.def, activeEffects: enemy.activeEffects },
            vp.damage, dmgOpts,
          );
          enemy.hp -= result.finalDamage;
          const col = result.isCrit ? '#ffd700' : '#ffffff';
          addText(state, enemy.x, enemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
          triggerHitFlash(state, enemy.id);
          spawnParticles(state, enemy.x, enemy.y, vp.color, 6);
          // Projectile impact force — pushes enemies away from hit point; caster excluded
          applyCombatForce(state, enemy.x, enemy.y, p.id, 80, 55);
          if (enemy.hp <= 0) killEnemy(state, enemy);
          vp.dead = true;
          triggerScreenShake(state, 2, 0.08);
          break;
        }
      }
    }
  }
  state.voxelProjectiles = state.voxelProjectiles.filter(vp => !vp.dead);

  // ── AI Faction Heroes ──
  if (state.aiHeroes && state.aiHeroes.length > 0 && (state as any)._aiHeroBrainModule) {
    const { tickAIHero } = (state as any)._aiHeroBrainModule;
    const aiCtx = {
      heightmap: state.heightmap,
      gameTime: state.gameTime,
      dt,
      enemies: state.enemies
        .filter(e => !e.dead)
        .map(e => ({ id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, faction: '', dead: e.dead })),
      harvestables: state.resourceNodes
        .filter(r => !r.depleted)
        .map(r => ({ x: r.x, y: r.y, resourceType: r.professionId, tier: r.tier })),
      allAIHeroes: state.aiHeroes,
      playerX: p.x,
      playerY: p.y,
      playerFaction: 'Docks', // player is neutral for now
    };
    for (const aiHero of state.aiHeroes) {
      tickAIHero(aiHero, aiCtx);
    }
  }

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

  // Spell effects — pool tick (legacy array kept in sync)
  state.effectPool.update(dt);
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

  // Ambient VFX
  updateAmbientParticles(state, dt);

  // Screen shake decay
  if (state.screenShake.timer > 0) {
    state.screenShake.timer -= dt;
    if (state.screenShake.timer <= 0) { state.screenShake.intensity = 0; }
  }

  // Hit flash decay
  const flashToDelete: number[] = [];
  state.hitFlash.forEach((timer, id) => {
    const remaining = timer - dt;
    if (remaining <= 0) flashToDelete.push(id);
    else state.hitFlash.set(id, remaining);
  });
  for (const id of flashToDelete) state.hitFlash.delete(id);

  // Combo display decay
  if (state.comboDisplay.timer > 0) {
    state.comboDisplay.timer -= dt;
    if (state.comboDisplay.timer <= 0) resetCombo(state);
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

    // Enemy hit-stop: tick down and skip AI while frozen
    const enemyFrozen = enemy.hitStopTimer > 0;
    if (enemyFrozen) {
      enemy.hitStopTimer = Math.max(0, enemy.hitStopTimer - dt);
    }
    if (!enemyFrozen) enemy.animTimer += dt;

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
    if (enemyFrozen) continue; // hit-stop: skip AI while frozen

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

    const aggroRange = getEnemyAggroRange(enemy.type, enemy.isBoss);
    if (d < aggroRange) {
      enemy.targetId = p.id;
      enemy.facing = angleBetween(enemy, p);

      // AOE telegraph update
      if (enemy.aoeTelegraph) {
        enemy.aoeTelegraph.timer -= dt;
        if (enemy.aoeTelegraph.timer <= 0) {
          // AOE fires!
          const tg = enemy.aoeTelegraph;
          addSpellEffect(state, tg.x, tg.y, 'enemy_aoe_blast', tg.radius, enemy.color, 0.5);
          const dd = distXY(p, { x: tg.x, y: tg.y });
          if (dd < tg.radius && !p.dodgeInvuln) {
            const result = combatCalcDamage(
              { atk: enemy.atk, activeEffects: [] },
              { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp },
              enemy.atk * 1.3
            );
            let dmg = result.finalDamage;
            if (p.shieldHp > 0) { const abs = Math.min(p.shieldHp, dmg); p.shieldHp -= abs; dmg -= abs; }
            p.hp -= dmg;
            addText(state, p.x, p.y - 20, `-${dmg}`, '#ef4444', 14);
            spawnParticles(state, p.x, p.y, '#ef4444', 5);
          } else if (p.dodgeInvuln && dd < tg.radius) {
            addText(state, p.x, p.y - 20, 'DODGE', '#ffd700', 12);
          }
          enemy.aoeTelegraph = null;
          enemy.attackTimer = 2.0;
        }
        enemy.animState = 'attack';
        continue;
      }

      if (d <= enemy.rng + 10) {
        enemy.animState = 'attack';
        globalAnimDirector.registerAttack(enemy.id, state.gameTime);
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          const spdMult = getSpeedMultiplier(enemy as any as CombatEntity);

          if (enemy.attackStyle === 'melee') {
            // Melee: wind-up line indicator → then cone damage + slash VFX + lunge
            // Show directional line telegraph on the ground
            addSpellEffect(state,
              enemy.x + Math.cos(enemy.facing) * (enemy.size + 5),
              enemy.y + Math.sin(enemy.facing) * (enemy.size + 5),
              'enemy_slash', enemy.size + 20, '#cc3333', 0.4, enemy.facing);
            const lungeX = enemy.x + Math.cos(enemy.facing) * 12;
            const lungeY = enemy.y + Math.sin(enemy.facing) * 12;
            if (isWalkableOW(lungeX, lungeY)) { enemy.x = lungeX; enemy.y = lungeY; }
            if (d < enemy.rng + 20 && !p.dodgeInvuln) {
              const result = combatCalcDamage(
                { atk: enemy.atk, activeEffects: [] },
                { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp },
                enemy.atk
              );
              let dmg = result.finalDamage;
              if (p.shieldHp > 0) { const abs = Math.min(p.shieldHp, dmg); p.shieldHp -= abs; dmg -= abs; }
              p.hp -= dmg;
              addText(state, p.x, p.y - 20, `-${dmg}`, '#ef4444', 14);
              spawnParticles(state, p.x, p.y, '#ef4444', 3);
              // Hit-stop on enemy melee connecting with player
              const hs = enemy.isBoss ? 0.05 : 0.03;
              p.hitStopTimer = hs; state.animFSM.freeze();
              enemy.hitStopTimer = hs;
            } else if (p.dodgeInvuln && d < enemy.rng + 20) {
              addText(state, p.x, p.y - 20, 'DODGE', '#ffd700', 12);
            }
            addSpellEffect(state, enemy.x + Math.cos(enemy.facing) * (enemy.size + 10), enemy.y + Math.sin(enemy.facing) * (enemy.size + 10), 'enemy_slash', enemy.size + 15, enemy.color, 0.25, enemy.facing);
            enemy.attackTimer = 1.2 / spdMult;

          } else if (enemy.attackStyle === 'ranged') {
            // Ranged: occasionally fire AOE telegraph instead of projectile
            const useAoe = enemy.level >= 5 && Math.random() < 0.25;
            if (useAoe) {
              enemy.aoeTelegraph = {
                x: p.x + (Math.random() - 0.5) * 40,
                y: p.y + (Math.random() - 0.5) * 40,
                timer: 1.0,
                radius: 45 + enemy.level,
              };
              addSpellEffect(state, enemy.aoeTelegraph.x, enemy.aoeTelegraph.y, 'enemy_aoe_telegraph', enemy.aoeTelegraph.radius, enemy.color, 1.0);
              enemy.attackTimer = 1.0;
            } else {
              const angle = angleBetween(enemy, p);
              state.projectiles.push({
                id: state.nextId++,
                x: enemy.x, y: enemy.y,
                targetId: p.id,
                damage: enemy.atk,
                speed: 350,
                color: enemy.color,
                size: enemy.isBoss ? 5 : 3,
                sourceIsPlayer: false,
                homing: false,
                vx: Math.cos(angle) * 350,
                vy: Math.sin(angle) * 350,
              });
              enemy.attackTimer = 1.4 / spdMult;
            }

          } else {
            // AOE: telegraph then blast
            enemy.aoeTelegraph = {
              x: p.x + (Math.random() - 0.5) * 30,
              y: p.y + (Math.random() - 0.5) * 30,
              timer: 0.8,
              radius: enemy.isBoss ? 80 : 55,
            };
            addSpellEffect(state, enemy.aoeTelegraph.x, enemy.aoeTelegraph.y, 'enemy_aoe_telegraph', enemy.aoeTelegraph.radius, enemy.color, 0.8);
            enemy.attackTimer = 0.8;
          }
        }
    } else if (!isRooted(enemy as any as CombatEntity)) {
        const spdMult = getSpeedMultiplier(enemy as any as CombatEntity);
        let moveAngle = angleBetween(enemy, p);

        // Ranged kiting: ranged enemies try to maintain distance
        if (enemy.attackStyle === 'ranged' && d < enemy.rng * 0.5) {
          moveAngle = angleBetween(p, enemy); // flee away
        }

        // Steering: separation from nearby enemies to avoid overlap
        let sepX = 0, sepY = 0;
        for (const other of state.enemies) {
          if (other === enemy || other.dead) continue;
          const od = distXY(enemy, other);
          if (od < 30 && od > 0.1) {
            const repel = (30 - od) / 30;
            sepX += (enemy.x - other.x) / od * repel * 0.5;
            sepY += (enemy.y - other.y) / od * repel * 0.5;
          }
        }

        const speed = enemy.spd * spdMult;
        let nx = enemy.x + Math.cos(moveAngle) * speed * dt + sepX * speed * dt;
        let ny = enemy.y + Math.sin(moveAngle) * speed * dt + sepY * speed * dt;
        if (isWalkableOW(nx, enemy.y)) enemy.x = nx;
        if (isWalkableOW(enemy.x, ny)) enemy.y = ny;
        enemy.facing = moveAngle;
        enemy.animState = 'walk';
      }
    } else {
      // Patrol: idle enemies walk a small circuit around home
      enemy.animState = 'idle';
      const patrolPhase = (state.gameTime + enemy.id * 1.7) % 12;
      const patrolRadius = 40;
      if (patrolPhase < 3) {
        const patrolAngle = ((state.gameTime * 0.5 + enemy.id * 2.3) % (Math.PI * 2));
        const tx = enemy.homeX + Math.cos(patrolAngle) * patrolRadius;
        const ty = enemy.homeY + Math.sin(patrolAngle) * patrolRadius;
        const toHome = distXY(enemy, { x: tx, y: ty });
        if (toHome > 5) {
          const angle = angleBetween(enemy, { x: tx, y: ty });
          enemy.x += Math.cos(angle) * enemy.spd * 0.3 * dt;
          enemy.y += Math.sin(angle) * enemy.spd * 0.3 * dt;
          enemy.facing = angle;
          enemy.animState = 'walk';
        }
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

  addText(state, enemy.x, enemy.y - 15, `+${enemy.goldValue}g`, '#ffd700', 14);
  addText(state, enemy.x + 15, enemy.y - 25, `+${enemy.xpValue} XP`, '#a855f7', 11);
  spawnDeathBurst(state, enemy.x, enemy.y, enemy.color, enemy.isBoss);
  triggerScreenShake(state, enemy.isBoss ? 10 : 4, enemy.isBoss ? 0.3 : 0.15);
  checkLevelUp(state);

  const progressEvents = onMonsterKilled(state.playerProgress, enemy.isBoss);
  state.pendingProgressEvents.push(...progressEvents);

  state.killFeed.push({
    text: `Defeated ${enemy.type} (Lv${enemy.level})${enemy.isBoss ? ' BOSS' : ''}`,
    color: enemy.color,
    time: state.gameTime,
  });

  // Mission tracking
  const missionComplete = onMissionKill(state.missionLog, enemy.type, enemy.isBoss);
  for (const mid of missionComplete) {
    state.killFeed.push({ text: `MISSION COMPLETE!`, color: '#ffd700', time: state.gameTime });
  }
  if (missionComplete.length > 0) saveMissionLog(state.missionLog);

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

  // Track kill for zone events
  state.eventManager.onKill();

  // Clear AI behavior cache for dead enemy
  clearBehaviorCache(enemy.id);

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
    if (proj.homing) {
      // Homing projectile (player abilities)
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
        handleProjectileHit(state, proj, target);
        proj.targetId = -1;
      }
    } else {
      // Straight-line projectile (dodgeable)
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Check collision with player (enemy projectiles) — dodge rolls avoid
      if (!proj.sourceIsPlayer && !p.dead && !p.dodgeInvuln && distXY(proj, p) < 15) {
        handleProjectileHit(state, proj, p);
        proj.targetId = -1;
        continue;
      }
      // Check collision with enemies (player projectiles)
      if (proj.sourceIsPlayer) {
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (distXY(proj, e) < e.size + 5) {
            handleProjectileHit(state, proj, e);
            proj.targetId = -1;
            break;
          }
        }
      }
      // Despawn after traveling too far
      if (proj.x < -100 || proj.y < -100 || proj.x > OPEN_WORLD_SIZE + 100 || proj.y > OPEN_WORLD_SIZE + 100) {
        proj.targetId = -1;
      }
    }
  }

  state.projectiles = state.projectiles.filter(pr => pr.targetId !== -1);
}

function handleProjectileHit(state: OpenWorldState, proj: OWProjectile, target: { x: number; y: number; id: number }): void {
  const p = state.player;
  if (proj.sourceIsPlayer) {
    const enemy = state.enemies.find(e => e.id === target.id);
    if (enemy) {
      const projDerived = computeDerivedStats(state.playerAttributes);
      const projOpts = buildDamageOpts(projDerived, null);
      const result = combatCalcDamage(
        { atk: p.atk, activeEffects: p.activeEffects },
        { def: enemy.def, activeEffects: enemy.activeEffects },
        proj.damage,
        projOpts,
      );
      enemy.hp -= result.finalDamage;
      const col = result.isCrit ? '#ffd700' : '#ffffff';
      addText(state, enemy.x, enemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
      spawnParticles(state, enemy.x, enemy.y, '#ff6666', 3);
      // Projectile impact force — pushes enemies from hit point; caster excluded
      applyCombatForce(state, enemy.x, enemy.y, p.id, 70, 45);
      const ls = hasLifesteal(p as any as CombatEntity);
      if (ls > 0) { const heal = Math.floor(result.finalDamage * ls); p.hp = Math.min(p.maxHp, p.hp + heal); }
      if (enemy.hp <= 0) killEnemy(state, enemy);
    }
  } else {
    const result = combatCalcDamage(
      { atk: 15, activeEffects: [] },
      { def: p.def, activeEffects: p.activeEffects, shieldHp: p.shieldHp },
      proj.damage
    );
    let dmg = result.finalDamage;
    if (p.shieldHp > 0) { const abs = Math.min(p.shieldHp, dmg); p.shieldHp -= abs; dmg -= abs; }
    p.hp -= dmg;
    addText(state, p.x, p.y - 20, `-${dmg}`, '#ef4444', 14);
    spawnParticles(state, p.x, p.y, '#ef4444', 3);
  }
}

// ── Level Up ───────────────────────────────────────────────────

function checkLevelUp(state: OpenWorldState): void {
  const p = state.player;
  while (p.level < MAX_LEVEL && p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    const hd = getHeroById(p.heroDataId);
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
    state.killFeed.push({ text: `Reached level ${p.level}! (+${POINTS_PER_LEVEL} attribute points)`, color: '#ffd700', time: state.gameTime });

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

  const hd = getHeroById(p.heroDataId);
  const abilities = getAbilitiesWithWeapon(state.weaponLoadout, hd.race, hd.heroClass);
  if (!abilities || !abilities[abilityIndex]) return;

  const ab = abilities[abilityIndex];
  if (p.abilityCooldowns[abilityIndex] > 0) return;

  // Multi-resource cost check (mana + health + stamina)
  const resources: ResourceState = { hp: p.hp, maxHp: p.maxHp, mp: p.mp, maxMp: p.maxMp, stamina: p.stamina, maxStamina: p.maxStamina };
  const costCheck = checkAbilityCost(ab, resources);
  if (!costCheck.canCast) {
    addText(state, p.x, p.y - 25, costCheck.reason, '#ef4444', 10);
    return;
  }

  // Deduct costs (mana, health, stamina)
  deductAbilityCost(resources, costCheck);
  p.hp = resources.hp;
  p.mp = resources.mp;
  p.stamina = resources.stamina;

  // Apply CDR to cooldown
  const derived = computeDerivedStats(state.playerAttributes);
  p.abilityCooldowns[abilityIndex] = getEffectiveCooldown(ab, derived);
  state.animFSM.tryTransition('ability');

  // Spell combo tracking — casting within 3s window stacks
  if (p.spellComboTimer > 0) {
    p.spellComboCount = Math.min(p.spellComboCount + 1, 5);
  } else {
    p.spellComboCount = 1;
  }
  p.spellComboTimer = 3.0;
  const comboBonus = 1.0 + p.spellComboCount * 0.08; // up to +40% at 5 stacks

  if (targetWorld && (ab.castType === 'ground_aoe' || ab.castType === 'skillshot' || ab.castType === 'line' || ab.castType === 'cone')) {
    p.facing = Math.atan2(targetWorld.y - p.y, targetWorld.x - p.x);
  }

  const nearest = findNearestEnemy(state, p, ab.range + 100);
  const abilityColor = CLASS_COLORS[hd.heroClass] || '#fff';

  // Channeling particle burst
  for (let ci = 0; ci < 4 + p.spellComboCount * 2; ci++) {
    const ca = (ci / (4 + p.spellComboCount * 2)) * Math.PI * 2;
    state.particles.push({
      x: p.x + Math.cos(ca) * 20, y: p.y + Math.sin(ca) * 20,
      vx: -Math.cos(ca) * 40, vy: -Math.sin(ca) * 40 - 20,
      life: 0.4, maxLife: 0.4, color: abilityColor, size: 2,
    });
  }
  if (p.spellComboCount >= 3) {
    addText(state, p.x, p.y - 45, `x${p.spellComboCount} SPELL COMBO`, '#ffd700', 14);
  }

  switch (ab.type) {
    case 'damage': {
      if (nearest) {
        const pDerived = computeDerivedStats(state.playerAttributes);
        const isMagic = hd.heroClass === 'Mage';
        const dmgMult = isMagic ? pDerived.magicDmgMult : pDerived.physDmgMult;
        const dmg = (ab.damage + p.atk * 0.8) * comboBonus * dmgMult;
        const dmgOpts = buildDamageOpts(pDerived, null);
        const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, dmg, dmgOpts);
        nearest.hp -= result.finalDamage;
        addText(state, nearest.x, nearest.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, result.isCrit ? '#ffd700' : abilityColor, result.isCrit ? 18 : 14);
        spawnParticles(state, nearest.x, nearest.y, abilityColor, 10 + p.spellComboCount * 2);
        triggerScreenShake(state, 3 + p.spellComboCount, 0.12);
        triggerHitFlash(state, nearest.id);
        // Impact force — pushes enemies near the target; never moves the caster
        applyCombatForce(state, nearest.x, nearest.y, p.id, 90 + p.spellComboCount * 15, 50);
        const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
        for (const eff of effects) applyStatusEffect(nearest as any as CombatEntity, eff);
        if (nearest.hp <= 0) killEnemy(state, nearest);
      }
      break;
    }
    case 'aoe': {
      const pDerivedAoe = computeDerivedStats(state.playerAttributes);
      const isMagicAoe = hd.heroClass === 'Mage';
      const aoeDmgMult = isMagicAoe ? pDerivedAoe.magicDmgMult : pDerivedAoe.physDmgMult;
      const cx = targetWorld && ab.castType === 'ground_aoe' ? targetWorld.x : nearest ? nearest.x : p.x + Math.cos(p.facing) * 100;
      const cy = targetWorld && ab.castType === 'ground_aoe' ? targetWorld.y : nearest ? nearest.y : p.y + Math.sin(p.facing) * 100;

      if (ab.castType === 'cone') {
        addSpellEffect(state, p.x, p.y, 'cone_sweep', ab.radius, abilityColor, 0.6, p.facing);
      } else {
        addSpellEffect(state, cx, cy, 'aoe_blast', ab.radius, abilityColor, 0.6);
      }

      const aoeOpts = buildDamageOpts(pDerivedAoe, null);
      let aoeHits = 0;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (distXY({ x: cx, y: cy }, e) < ab.radius) {
          const dmg = (ab.damage + p.atk * 0.6) * comboBonus * aoeDmgMult;
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: e.def, activeEffects: e.activeEffects }, dmg, aoeOpts);
          e.hp -= result.finalDamage;
          addText(state, e.x, e.y - 15, `-${result.finalDamage}`, abilityColor, 12);
          triggerHitFlash(state, e.id);
          const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
          for (const eff of effects) applyStatusEffect(e as any as CombatEntity, eff);
          if (e.hp <= 0) killEnemy(state, e);
          aoeHits++;
        }
      }
      if (aoeHits > 0) triggerScreenShake(state, 4 + aoeHits, 0.15);
      spawnParticles(state, cx, cy, abilityColor, 20 + p.spellComboCount * 4);
      // Radial blast force — pushes all enemies out from AoE centre; caster excluded
      applyCombatForce(state, cx, cy, p.id, ab.radius * 1.15, 65 + p.spellComboCount * 10);
      break;
    }
    case 'buff': {
      const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
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
          const debuffOpts = buildDamageOpts(computeDerivedStats(state.playerAttributes), null);
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: e.def, activeEffects: e.activeEffects }, ab.damage, debuffOpts);
          e.hp -= result.finalDamage;
          if (e.hp <= 0) killEnemy(state, e);
        }
      }
      spawnParticles(state, p.x, p.y, '#06b6d4', 12);
      // Debuff shockwave — repels enemies away from player; caster excluded
      applyCombatForce(state, p.x, p.y, p.id, ab.radius, 45);
      break;
    }
    case 'heal': {
      p.shieldHp = 100 + p.def * 2;
      const effects = getAbilityStatusEffects(ab.name, p.id, p.atk);
      for (const eff of effects) applyStatusEffect(p as any as CombatEntity, eff);
      spawnParticles(state, p.x, p.y, '#22c55e', 10);
      break;
    }
    case 'dash': {
      const dashDerived = computeDerivedStats(state.playerAttributes);
      const dashRangeBonus = 1 + (dashDerived.movementSpeed / 200); // AGI extends dash range
      const startX = p.x, startY = p.y;
      if (nearest) {
        const angle = angleBetween(p, nearest);
        const dashDist = Math.min(ab.range * dashRangeBonus, distXY(p, nearest));
        const nx = p.x + Math.cos(angle) * dashDist;
        const ny = p.y + Math.sin(angle) * dashDist;
        if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
        if (ab.damage > 0) {
          const dashOpts = buildDamageOpts(dashDerived, null);
          const dashDmg = (ab.damage + p.atk * 0.5) * dashDerived.physDmgMult;
          const result = combatCalcDamage({ atk: p.atk, activeEffects: p.activeEffects }, { def: nearest.def, activeEffects: nearest.activeEffects }, dashDmg, dashOpts);
          nearest.hp -= result.finalDamage;
          if (nearest.hp <= 0) killEnemy(state, nearest);
        }
      } else {
        const nx = p.x + Math.cos(p.facing) * ab.range * dashRangeBonus;
        const ny = p.y + Math.sin(p.facing) * ab.range * dashRangeBonus;
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

// ── Melee Arc Damage Helper ─────────────────────────────────────

const MELEE_RANGE = 65;
const COMBO_WINDOW = 0.5;

function meleeArcDamage(state: OpenWorldState, coneAngle: number, range: number, damage: number, slowDuration: number, slowPct: number): number {
  const p = state.player;
  const playerDerived = computeDerivedStats(state.playerAttributes);
  let hits = 0;
  let anyCrit = false;
  // Knockback scales with combo step: step1 = 0.6, step2 = 0.75, step3/finisher = 1.0
  const comboKB = p.comboStep <= 1 ? 0.6 : p.comboStep === 2 ? 0.75 : 1.0;
  const knockbackDist = range * 0.8 * comboKB;
  const stunDuration = 0.2 * comboKB;
  // Scale damage with physical damage multiplier
  const scaledDamage = damage * playerDerived.physDmgMult;
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = distXY(p, enemy);
    if (d > range + enemy.size) continue;
    const angle = angleBetween(p, enemy);
    let diff = angle - p.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > coneAngle / 2) continue;

    const dmgOpts = buildDamageOpts(playerDerived, null);
    const result = combatCalcDamage(
      { atk: p.atk, activeEffects: p.activeEffects },
      { def: enemy.def, activeEffects: enemy.activeEffects },
      scaledDamage,
      dmgOpts,
    );
    enemy.hp -= result.finalDamage;
    if (result.isCrit) anyCrit = true;
    const col = result.isCrit ? '#ffd700' : '#ffffff';
    addText(state, enemy.x, enemy.y - 15, `${result.isCrit ? 'CRIT ' : ''}-${result.finalDamage}`, col, result.isCrit ? 16 : 12);
    spawnParticles(state, enemy.x, enemy.y, '#ff6666', 4);
    triggerHitFlash(state, enemy.id);
    incrementCombo(state);
    enemy.hitStopTimer = result.isCrit ? 0.07 : 0.04;
    hits++;

    // ── Knockback: push enemy to edge of slash arc ──
    const pushAngle = angleBetween(p, enemy);
    const targetDist = Math.max(d, knockbackDist);
    const nx = p.x + Math.cos(pushAngle) * targetDist;
    const ny = p.y + Math.sin(pushAngle) * targetDist;
    if (isWalkableOW(nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
    }
    // Brief hitstun so enemies can't immediately counter
    applyStatusEffect(enemy as any as CombatEntity, createStatusEffect(StatusEffectType.Stun, stunDuration, p.id, 0));

    // Melee slow
    if (slowDuration > 0) {
      applyStatusEffect(enemy as any as CombatEntity, createStatusEffect(StatusEffectType.Slow, slowDuration, p.id, slowPct));
    }

    // Lifesteal from derived stats + status effects
    const lsEffect = hasLifesteal(p as any as CombatEntity);
    const lsTotal = Math.max(lsEffect, result.drained > 0 ? result.drained / Math.max(1, result.finalDamage) : 0);
    if (lsTotal > 0 || result.drained > 0) {
      const heal = result.drained > 0 ? result.drained : Math.floor(result.finalDamage * lsTotal);
      p.hp = Math.min(p.maxHp, p.hp + heal);
    }
    if (enemy.hp <= 0) killEnemy(state, enemy);
  }
  if (hits > 0) {
    triggerScreenShake(state, 3 + hits, 0.12);
    // Hit-stop: freeze player + FSM on melee impact
    p.hitStopTimer = anyCrit ? 0.07 : 0.04;
    state.animFSM.freeze();
    // Melee shockwave — supplemental radial push for nearby enemies (stacks with per-enemy knockback above)
    applyCombatForce(state, p.x, p.y, p.id, range + 35, 28 + knockbackDist * 0.3);
  }
  return hits;
}

export function handleOWAttack(state: OpenWorldState): void {
  const p = state.player;
  if (p.dead || isStunned(p as any) || p.meleeAnimTimer > 0) return;

  const hd = getHeroById(p.heroDataId);
  const abilityColor = CLASS_COLORS[hd.heroClass] || '#ef4444';

  // Auto-face nearest enemy if one is close
  const nearest = findNearestEnemy(state, p, MELEE_RANGE + 40);
  if (nearest) p.facing = angleBetween(p, nearest);

  // Combo chain
  if (p.comboTimer > 0 && p.comboStep < 3) {
    p.comboStep++;
  } else {
    p.comboStep = 1;
  }
  p.comboTimer = COMBO_WINDOW;

  if (p.comboStep === 1) {
    // Forward slash: lunge 20px, 60° cone
    const nx = p.x + Math.cos(p.facing) * 20;
    const ny = p.y + Math.sin(p.facing) * 20;
    if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
    meleeArcDamage(state, Math.PI / 3, MELEE_RANGE, p.atk * 1.0, 0.3, 0.3);
    addSpellEffect(state, p.x + Math.cos(p.facing) * 30, p.y + Math.sin(p.facing) * 30, 'melee_slash', 40, abilityColor, 0.25, p.facing);
    state.animFSM.tryTransition('attack', true);
    p.meleeAnimTimer = 0.25;
  } else if (p.comboStep === 2) {
    // Back slash: slight backstep, 90° cone, more damage
    const nx = p.x - Math.cos(p.facing) * 8;
    const ny = p.y - Math.sin(p.facing) * 8;
    if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
    meleeArcDamage(state, Math.PI / 2, MELEE_RANGE + 10, p.atk * 1.2, 0.3, 0.3);
    const slashColor = hd.heroClass === 'Mage' ? '#a855f7' : hd.heroClass === 'Ranger' ? '#22c55e' : '#f59e0b';
    addSpellEffect(state, p.x + Math.cos(p.facing) * 30, p.y + Math.sin(p.facing) * 30, 'melee_slash', 50, slashColor, 0.25, p.facing);
    state.animFSM.tryTransition('attack', true);
    p.meleeAnimTimer = 0.25;
  } else {
    // Lunge: dash 50px forward, narrow thrust, highest damage
    const nx = p.x + Math.cos(p.facing) * 50;
    const ny = p.y + Math.sin(p.facing) * 50;
    if (isWalkableOW(nx, ny)) { p.x = nx; p.y = ny; }
    meleeArcDamage(state, Math.PI / 4, MELEE_RANGE + 20, p.atk * 1.8, 0.4, 0.35);
    addSpellEffect(state, p.x, p.y, 'melee_lunge', 60, '#ffd700', 0.3, p.facing, { startX: p.x - Math.cos(p.facing) * 50, startY: p.y - Math.sin(p.facing) * 50 });
    state.animFSM.tryTransition('lunge_slash', true);
    p.meleeAnimTimer = 0.3;
    p.comboStep = 0;
    p.comboTimer = 0;
  }

  globalAnimDirector.registerAttack(p.id, state.gameTime);
}

/** RMB: Class-specific ranged attack aimed at mouse position */
export function handleOWRangedAttack(state: OpenWorldState): void {
  const p = state.player;
  if (p.dead || isStunned(p as any) || state.rangedAttackCooldown > 0) return;

  const hd = getHeroById(p.heroDataId);
  const cfg = getClassRangedConfig(hd.heroClass, state.weaponLoadout?.weaponType);

  // Face toward mouse
  p.facing = Math.atan2(state.mouseWorld.y - p.y, state.mouseWorld.x - p.x);

  // Spawn projectile from player toward mouse
  const damage = p.atk * cfg.damageMultiplier;
  const proj = createVoxelProjectile(
    cfg.type,
    p.x + Math.cos(p.facing) * 20, p.y + Math.sin(p.facing) * 20,
    state.mouseWorld.x, state.mouseWorld.y,
    damage, p.id,
    cfg.color, cfg.trailColor,
  );
  proj.speed *= cfg.speedMultiplier;
  state.voxelProjectiles.push(proj);

  // Animation
  state.animFSM.tryTransition('attack', true);
  p.meleeAnimTimer = 0.3;
  state.rangedAttackCooldown = cfg.cooldown;

  // VFX at launch point
  spawnParticles(state, p.x + Math.cos(p.facing) * 15, p.y + Math.sin(p.facing) * 15, cfg.color, 4);

  globalAnimDirector.registerAttack(p.id, state.gameTime);
}

function findNearestEnemy(state: OpenWorldState, from: { x: number; y: number }, range: number): OWEnemy | null {
  // Prefer locked target if within range
  if (state.player.lockedTargetId !== null) {
    const locked = state.enemies.find(e => e.id === state.player.lockedTargetId && !e.dead);
    if (locked && distXY(from, locked) < range) return locked;
  }
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
  const hd = getHeroById(p.heroDataId);
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

/** Accept a mission from NPC */
export function acceptOWMission(state: OpenWorldState, missionId: string): boolean {
  const m = acceptMission(state.missionLog, missionId);
  if (m) {
    state.killFeed.push({ text: `Quest accepted: ${m.def.name}`, color: '#60a5fa', time: state.gameTime });
    saveMissionLog(state.missionLog);
    return true;
  }
  return false;
}

/** Claim completed mission rewards */
export function claimOWMission(state: OpenWorldState, missionId: string): MissionReward | null {
  const reward = claimMission(state.missionLog, missionId);
  if (reward) {
    state.player.xp += reward.xp;
    state.player.gold += reward.gold;
    state.playerProgress.reputation += reward.reputation;
    state.killFeed.push({ text: `+${reward.xp} XP, +${reward.gold}g`, color: '#ffd700', time: state.gameTime });
    if (reward.equipmentTier) {
      const drop = generateRandomEquipment(reward.equipmentTier);
      addToBag(state.equipmentBag, drop);
      state.killFeed.push({ text: `Reward: ${drop.name}`, color: '#a855f7', time: state.gameTime });
      saveEquipmentBag(state.equipmentBag);
    }
    checkLevelUp(state);
    saveMissionLog(state.missionLog);
    savePlayerProgress(state.playerProgress);
    return reward;
  }
  return null;
}

/** Enter a dungeon from the open world */
export function enterOWDungeon(state: OpenWorldState): DungeonEntrance | null {
  const entrance = getDungeonEntranceNear(ISLAND_ZONES[0], state.player.x, state.player.y, 80);
  if (!entrance) return null;
  if (state.player.level < entrance.requiredLevel) {
    state.killFeed.push({ text: `Requires level ${entrance.requiredLevel}!`, color: '#ef4444', time: state.gameTime });
    return null;
  }
  const dungeonComplete = onMissionDungeonEnter(state.missionLog, entrance.id);
  for (const mid of dungeonComplete) {
    state.killFeed.push({ text: `MISSION COMPLETE!`, color: '#ffd700', time: state.gameTime });
  }
  saveMissionLog(state.missionLog);
  return entrance;
}

/** Swap weapon and rebuild skill loadout */
export async function swapOWWeapon(state: OpenWorldState, newWeaponType: string, weaponId: string | null): Promise<void> {
  const hd = getHeroById(state.player.heroDataId);
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
  state.floatingTexts.push({ x, y, text, color, life: 1.5, maxLife: 1.5, vy: -35, size });
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

// ── Screen Shake ───────────────────────────────────────────────

function triggerScreenShake(state: OpenWorldState, intensity: number, duration: number): void {
  if (intensity > state.screenShake.intensity) {
    state.screenShake.intensity = intensity;
    state.screenShake.timer = duration;
  }
}

// ── Hit Flash ──────────────────────────────────────────────────

function triggerHitFlash(state: OpenWorldState, entityId: number): void {
  state.hitFlash.set(entityId, 0.12);
}

// ── Combat Force (push / pull) ─────────────────────────────────
/**
 * Radial force burst originating from (cx, cy).
 * Pushes (or pulls) all living enemies within `radius` by `magnitude` units
 * with inverse-linear falloff.  The entity whose id === casterId is always
 * skipped — guaranteeing the caster is never displaced by their own abilities.
 */
function applyCombatForce(
  state: OpenWorldState,
  cx: number, cy: number,
  casterId: number,
  radius: number,
  magnitude: number,
  forceType: 'push' | 'pull' = 'push',
): void {
  const dir = forceType === 'push' ? 1 : -1;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.id === casterId) continue;
    const dx = enemy.x - cx;
    const dy = enemy.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1 || d > radius) continue;
    // Inverse-linear falloff: full force at centre, 30% at edge
    const falloff = 1 - (d / radius) * 0.7;
    const dist = magnitude * falloff;
    const nx = enemy.x + (dx / d) * dir * dist;
    const ny = enemy.y + (dy / d) * dir * dist;
    if (isWalkableOW(nx, ny)) { enemy.x = nx; enemy.y = ny; }
  }
}

// ── Combo Display ──────────────────────────────────────────────

function incrementCombo(state: OpenWorldState): void {
  state.comboDisplay.count++;
  state.comboDisplay.timer = 2.0;
}

function resetCombo(state: OpenWorldState): void {
  state.comboDisplay.count = 0;
  state.comboDisplay.timer = 0;
}

// ── Enhanced Death VFX ─────────────────────────────────────────

function spawnDeathBurst(state: OpenWorldState, x: number, y: number, color: string, isBoss: boolean): void {
  const count = isBoss ? 40 : 18;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
    const speed = 60 + Math.random() * (isBoss ? 200 : 120);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      color, size: 2 + Math.random() * (isBoss ? 4 : 2),
    });
  }
  // Gold coin particles
  for (let i = 0; i < 6; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 80,
      vy: -80 - Math.random() * 60,
      life: 1.0, maxLife: 1.0,
      color: '#ffd700', size: 3,
    });
  }
  // XP orb particles (purple, float upward)
  for (let i = 0; i < 4; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30,
      vy: -50 - Math.random() * 40,
      life: 1.2, maxLife: 1.2,
      color: '#a855f7', size: 4,
    });
  }
}

// ── Ambient Particles ──────────────────────────────────────────

function updateAmbientParticles(state: OpenWorldState, dt: number): void {
  const p = state.player;
  const zone = getZoneAtPosition(p.x, p.y);
  const terrain = zone?.terrainType ?? '';
  const ws = state.worldState;
  const isNight = !isDayTime(ws);

  // Spawn ambient particles periodically
  if (state.ambientParticles.length < 30 && Math.random() < dt * 3) {
    const ox = (Math.random() - 0.5) * 600;
    const oy = (Math.random() - 0.5) * 600;
    if (terrain === 'grass' || terrain === 'jungle') {
      if (isNight) {
        // Fireflies at night
        state.ambientParticles.push({
          x: p.x + ox, y: p.y + oy,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15 - 5,
          life: 3 + Math.random() * 3, maxLife: 6,
          color: '#aaff44', size: 2,
        });
      } else {
        // Floating pollen/dust
        state.ambientParticles.push({
          x: p.x + ox, y: p.y + oy,
          vx: (Math.random() - 0.5) * 8 + 3,
          vy: (Math.random() - 0.5) * 5 - 2,
          life: 4 + Math.random() * 3, maxLife: 7,
          color: 'rgba(255,255,200,0.5)', size: 1.5,
        });
      }
    } else if (terrain === 'stone' || terrain === 'dirt') {
      // Dust motes
      state.ambientParticles.push({
        x: p.x + ox, y: p.y + oy,
        vx: (Math.random() - 0.5) * 10,
        vy: -3 - Math.random() * 5,
        life: 3 + Math.random() * 2, maxLife: 5,
        color: 'rgba(180,160,130,0.4)', size: 1.5,
      });
    }
  }

  // Update ambient particles
  for (const ap of state.ambientParticles) {
    ap.x += ap.vx * dt;
    ap.y += ap.vy * dt;
    // Fireflies wiggle
    if (ap.color === '#aaff44') {
      ap.vx += (Math.random() - 0.5) * 30 * dt;
      ap.vy += (Math.random() - 0.5) * 30 * dt;
    }
    ap.life -= dt;
  }
  state.ambientParticles = state.ambientParticles.filter(ap => ap.life > 0);
}

function addSpellEffect(state: OpenWorldState, x: number, y: number, type: OWSpellEffect['type'], radius: number, color: string, duration: number, angle = 0, data?: any): void {
  // Dual-write: pool (zero-alloc hot path) + legacy array (backward compat)
  state.effectPool.spawn(x, y, type as EffectType, radius, color, duration, angle, data);
  state.spellEffects.push({ x, y, type, life: duration, maxLife: duration, radius, color, angle, data });
}

function getNearbyInteractableLabel(state: OpenWorldState): string | null {
  const p = state.player;
  // Inside building: exit prompt
  if (state.activeBuilding) {
    if (state.interiorPlayer.y > 0.80) return 'Exit building';
    for (const inpc of state.activeBuilding.npcs) {
      const d = Math.sqrt((state.interiorPlayer.x - inpc.ix) ** 2 + (state.interiorPlayer.y - inpc.iy) ** 2);
      if (d < 0.18) return `Talk to ${inpc.name}`;
    }
    return null;
  }
  // Nearby player (highest priority in overworld)
  const aiHeroes = (state.aiHeroes || []).map(h => ({
    id: h.heroData?.id ?? 0, name: h.heroData?.name ?? 'Hero',
    race: h.heroData?.race ?? 'Human', heroClass: h.heroData?.heroClass ?? 'Warrior',
    level: h.level ?? 1, x: h.x, y: h.y, dead: h.dead ?? false,
  }));
  const nearbyPlayer = getNearbyPlayer(p.x, p.y, aiHeroes);
  if (nearbyPlayer) {
    const tag = nearbyPlayer.isAI ? 'AI' : 'Player';
    return `${nearbyPlayer.name} [${tag}] — Lv${nearbyPlayer.level} ${nearbyPlayer.heroClass}`;
  }
  // Dungeon entrance
  const ent = getDungeonEntranceNear(ISLAND_ZONES[0], p.x, p.y, 80);
  if (ent && distXY(p, ent) < 60) return `Enter ${ent.name}`;
  // Town building door
  const bldg = getBuildingNear(p.x, p.y, 70);
  if (bldg) return `Enter ${bldg.name}`;
  // NPC
  for (const npc of state.npcs) {
    if (distXY(p, npc) < 60) return `Talk to ${npc.name}`;
  }
  // Resource node
  for (const node of state.resourceNodes) {
    if (!node.depleted && distXY(p, node) < 80) return `Harvest (${node.professionId})`;
  }
  return null;
}

// ── HUD State ──────────────────────────────────────────────────

export function getOWHudState(state: OpenWorldState): OWHudState {
  const p = state.player;
  const hd = HEROES.find(h => h.id === p.heroDataId) || HEROES[0];
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
    zoneId: zone?.id ?? -1,
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
    // Missions
    activeMissions: state.missionLog.active.map(m => ({
      id: m.def.id, name: m.def.name, status: m.status,
      objectives: m.objectives.map(o => ({ type: o.type, target: o.target, current: o.current, required: o.required })),
    })),
    nearbyDungeon: getDungeonEntranceNear(ISLAND_ZONES[0], p.x, p.y, 80),
    // MMO controls
    stamina: p.stamina,
    maxStamina: p.maxStamina,
    sprinting: p.sprinting,
    dodgeCooldown: p.dodgeCooldown,
    lockedTargetId: p.lockedTargetId,
    nearbyInteractable: getNearbyInteractableLabel(state),
    activeNPC: state.activeNPC,
    // Equipment
    equipSlots: (() => {
      const SLOTS: { id: string; label: string; icon: string }[] = [
        { id: 'helm', label: 'Helm', icon: '🪖' },
        { id: 'shoulder', label: 'Shoulder', icon: '🦺' },
        { id: 'chest', label: 'Chest', icon: '👘' },
        { id: 'hands', label: 'Hands', icon: '🧤' },
        { id: 'feet', label: 'Feet', icon: '👟' },
        { id: 'ring', label: 'Ring', icon: '💍' },
        { id: 'necklace', label: 'Necklace', icon: '📿' },
        { id: 'cape', label: 'Cape', icon: '🧣' },
        { id: 'mainhand', label: 'Main Hand', icon: '⚔️' },
        { id: 'offhand', label: 'Off-Hand', icon: '🛡️' },
      ];
      return SLOTS.map(s => {
        const item = state.playerEquipment.slots[s.id as keyof typeof state.playerEquipment.slots];
        return {
          slot: s.id, label: s.label, icon: s.icon,
      item: item ? { name: item.name, tier: item.tier, atk: item.atk, def: item.def, hp: item.hp, setName: item.setName, iconUrl: item.iconUrl } : null,
        };
      });
    })(),
    bagItems: state.equipmentBag.items.slice(0, 36).map(i => ({
      id: i.id, name: i.name, slot: i.slot, tier: i.tier,
      atk: i.atk, def: i.def, hp: i.hp, mp: i.mp,
      iconUrl: i.iconUrl, passive: i.passive, lore: i.lore, setName: i.setName,
    })),
    setBonuses: computeSetBonuses(state.playerEquipment).map(b => ({ setName: b.setName, pieces: b.pieces })),
    consumableHotbar: state.consumableSlots.map(slot => slot ? {
      name: slot.name, category: slot.category,
      iconPath: slot.iconPath, count: slot.count, color: slot.color,
    } : null),
    // Professions
    ...(() => {
      const ps = getProfessionSummaries(state.playerProfessions);
      return {
        gatheringProfs: ps.gathering.map(g => ({ id: g.id, name: g.name, icon: g.icon, color: g.color, level: g.level, xp: g.xp, xpToNext: g.xpToNext, tier: g.tier, tierName: g.tierName, tierColor: g.tierColor })),
        craftingProfs: ps.crafting.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, level: c.level, xp: c.xp, xpToNext: c.xpToNext, tier: c.tier, tierName: c.tierName, tierColor: c.tierColor })),
      };
    })(),
  };
}

// ── Use consumable from hotbar slot ───────────────────────────

export function useConsumableHotbar(state: OpenWorldState, slotIndex: number): void {
  if (slotIndex < 0 || slotIndex > 2) return;
  const item = state.consumableSlots[slotIndex];
  if (!item) return;
  const p = state.player;
  const eff = item.effect;

  if (eff.healHp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + eff.healHp);
    addText(state, p.x, p.y - 28, `+${eff.healHp} HP`, '#22c55e', 14);
    spawnParticles(state, p.x, p.y, '#22c55e', 6);
  }
  if (eff.healMp > 0) {
    p.mp = Math.min(p.maxMp, p.mp + eff.healMp);
    addText(state, p.x, p.y - 38, `+${eff.healMp} MP`, '#818cf8', 12);
    spawnParticles(state, p.x, p.y, '#818cf8', 4);
  }
  if (eff.atkPct > 0) {
    addText(state, p.x, p.y - 32, `ATK +${Math.round(eff.atkPct * 100)}%`, '#fbbf24', 12);
  }
  if (eff.defPct > 0) {
    addText(state, p.x, p.y - 32, `DEF +${Math.round(eff.defPct * 100)}%`, '#60a5fa', 12);
  }

  state.killFeed.push({ text: `♥ ${item.name}`, color: item.color, time: state.gameTime });
  item.count--;
  if (item.count <= 0) state.consumableSlots[slotIndex] = null;
}

// ── Equip bag item from inventory ─────────────────────────────

export function equipBagItemOW(state: OpenWorldState, itemId: string): boolean {
  const item = state.equipmentBag.items.find(i => i.id === itemId);
  if (!item) return false;

  const result = equipItem(state.playerEquipment, item);
  if (!result.success) return false;

  // Remove equipped item from bag; return displaced item to bag
  removeFromBag(state.equipmentBag, itemId);
  if (result.removedItem) addToBag(state.equipmentBag, result.removedItem);
  saveEquipment(state.playerEquipment);
  saveEquipmentBag(state.equipmentBag);

  // Recalculate player stats from base + attributes + equipment
  const hd = getHeroById(state.player.heroDataId);
  const baseStats = heroStatsAtLevel(hd, state.player.level);
  const stats = applyAttributeBonus(baseStats, state.playerAttributes, hd.heroClass);
  const eqStats = computeEquipmentStats(state.playerEquipment);
  const p = state.player;
  const oldMaxHp = p.maxHp;
  p.maxHp = stats.hp + eqStats.hp;
  p.hp = Math.min(p.hp + (p.maxHp - oldMaxHp), p.maxHp);
  p.atk = stats.atk + eqStats.atk;
  p.def = stats.def + eqStats.def;
  p.spd = stats.spd + eqStats.spd;
  p.maxMp = stats.mp + eqStats.mp;

  // Re-init weapon loadout if a mainhand was just equipped
  if (result.weaponChanged && result.newWeaponType) {
    const osKey = getOSWeaponTypeKey(result.newWeaponType);
    buildWeaponLoadout(osKey, result.newWeaponId ?? null, hd.race, hd.heroClass).then(loadout => {
      if (loadout) {
        applySavedSelections(loadout);
        state.weaponLoadout = loadout;
        state.weaponLoadoutReady = true;
        saveLoadout(loadout);
      }
    });
  }

  state.killFeed.push({ text: `Equipped: ${item.name}`, color: '#d4a400', time: state.gameTime });
  return true;
}

/** Allocate an attribute point from the open world */
export function allocateOWAttribute(state: OpenWorldState, attrId: AttributeId): boolean {
  const success = allocatePoint(state.playerAttributes, attrId);
  if (success) {
    // Recalc player stats with new attribute values
    const hd = getHeroById(state.player.heroDataId);
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

// ── Color utility ──────────────────────────────────────────────
/** Lighten a hex color string by `amount` (0-255 each channel) */
function shadeColor(hex: string, amount: number): string {
  const c = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((c >> 16) & 0xff) + amount);
  const g = Math.min(255, ((c >> 8) & 0xff) + amount);
  const b = Math.min(255, (c & 0xff) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Town NPC sprite painter (procedural pixel-art style) ──────
/**
 * Draw a detailed 2D top-down NPC sprite using canvas 2D.
 * Each role has distinct silhouette, outfit colors, and accessories.
 */
function drawTownNPCSprite(
  ctx: CanvasRenderingContext2D,
  wx: number, wy: number,
  role: string,
  name: string,
  appearance: string | undefined,
  brightness: number,
  distToPlayer: number,
  gameTime: number,
): void {
  ctx.save();
  ctx.translate(wx, wy);
  ctx.globalAlpha = Math.max(0.5, brightness);

  // Gentle bob animation
  const bob = Math.sin(gameTime * 1.8 + wx * 0.01) * 1.5;

  // Role palette
  const palette: Record<string, { body: string; trim: string; skin: string; hat?: string }> = {
    merchant:  { body: '#d97706', trim: '#f59e0b', skin: '#f9c784', hat: '#92400e' },
    trainer:   { body: '#1d4ed8', trim: '#3b82f6', skin: '#f9c784', hat: '#1e3a8a' },
    quest:     { body: '#15803d', trim: '#22c55e', skin: '#f9c784', hat: '#14532d' },
    crafter:   { body: '#6b21a8', trim: '#a855f7', skin: '#f9c784', hat: '#3b0764' },
  };
  const appearancePalette: Record<string, { body: string; trim: string; skin: string; hat?: string }> = {
    blacksmith: { body: '#5b3a24', trim: '#c97316', skin: '#f0c28f', hat: '#2f1b0c' },
    hunter:     { body: '#556b2f', trim: '#d4a15a', skin: '#f0c28f', hat: '#3a4a1a' },
    child:      { body: '#7c5cff', trim: '#ffd166', skin: '#f3c997', hat: '#4338ca' },
  };
  const pal = (appearance && appearancePalette[appearance]) || palette[role] || palette.quest;

  const y0 = bob;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (two rectangles)
  ctx.fillStyle = pal.body;
  ctx.fillRect(-5, y0 + 4, 4, 9);   // left leg
  ctx.fillRect(1, y0 + 4, 4, 9);    // right leg

  // Feet
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(-6, y0 + 13, 5, 3);
  ctx.fillRect(1, y0 + 13, 5, 3);

  // Body / robe
  ctx.fillStyle = pal.body;
  ctx.fillRect(-7, y0 - 6, 14, 12);
  // Trim stripe
  ctx.fillStyle = pal.trim;
  ctx.fillRect(-3, y0 - 5, 6, 10);

  // Role accessory
  ctx.save();
  if (role === 'merchant') {
    // Side satchel bag
    ctx.fillStyle = '#92400e';
    ctx.fillRect(6, y0 - 1, 5, 6);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(7, y0, 3, 4);
  } else if (role === 'trainer') {
    // Scroll in left hand
    ctx.fillStyle = '#e5d3b3';
    ctx.fillRect(-11, y0 - 4, 4, 8);
    ctx.fillStyle = '#b5a070';
    ctx.fillRect(-11, y0 - 4, 4, 1);
    ctx.fillRect(-11, y0 + 3, 4, 1);
  } else if (role === 'quest') {
    // Shield / badge on chest
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(-2, y0 + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('!', -2.5, y0 + 5);
  } else if (role === 'crafter') {
    // Hammer in right hand
    ctx.fillStyle = '#78716c';
    ctx.fillRect(7, y0 - 6, 2, 9);  // handle
    ctx.fillStyle = '#44403c';
    ctx.fillRect(5, y0 - 9, 6, 4);  // head
  }
  ctx.restore();

  // Arms
  ctx.fillStyle = pal.trim;
  ctx.fillRect(-11, y0 - 4, 5, 8); // left arm
  ctx.fillRect(6, y0 - 4, 5, 8);  // right arm

  // Neck
  ctx.fillStyle = pal.skin;
  ctx.fillRect(-2, y0 - 9, 4, 4);

  // Head
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(0, y0 - 16, 7, 0, Math.PI * 2);
  ctx.fill();
  // Face highlight
  ctx.fillStyle = 'rgba(255,255,200,0.25)';
  ctx.beginPath();
  ctx.arc(-2, y0 - 17, 3, 0, Math.PI * 2);
  ctx.fill();

  // Hat / head gear
  if (pal.hat) {
    ctx.fillStyle = pal.hat;
    if (role === 'merchant') {
      // Wide-brim hat
      ctx.fillRect(-10, y0 - 22, 20, 3);
      ctx.fillRect(-5, y0 - 27, 10, 6);
    } else if (role === 'trainer') {
      // Pointed mage hat
      ctx.beginPath();
      ctx.moveTo(0, y0 - 30);
      ctx.lineTo(-8, y0 - 22);
      ctx.lineTo(8, y0 - 22);
      ctx.closePath();
      ctx.fill();
    } else if (role === 'quest') {
      // Feathered cap
      ctx.fillRect(-7, y0 - 24, 14, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(4, y0 - 28, 3, 6);
    } else if (role === 'crafter') {
      // Hood
      ctx.beginPath();
      ctx.arc(0, y0 - 18, 9, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Name tag
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const nameW = Math.min(name.length * 5.5, 90);
  ctx.fillRect(-nameW / 2 - 2, y0 - 42, nameW + 4, 11);
  ctx.fillStyle = '#e0d0a8';
  ctx.font = `bold 8px 'PixelGothic', 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(name.length > 16 ? name.slice(0, 16) + '.' : name, 0, y0 - 33);

  // [E] interact prompt when close
  if (distToPlayer < 70) {
    const pulse = 0.55 + Math.sin(Date.now() * 0.005) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd700';
    ctx.font = `bold 9px 'PixelGothic', 'Courier New', monospace`;
    ctx.fillText('[E] Talk', 0, y0 - 49);
  }

  ctx.restore();
}

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
  private tileRenderer = getTileMapRenderer();
  private activeLayouts: ZoneDecorLayout[] = [];
  private activeAnimals: LiveAnimal[] = [];
  private lastLayoutZoneId = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.voxel = new VoxelRenderer();
    preloadSpriteEnemies();
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

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (state.screenShake.timer > 0) {
      const decay = state.screenShake.timer * 10;
      const inten = state.screenShake.intensity * Math.min(1, decay);
      shakeX = (Math.random() - 0.5) * inten;
      shakeY = (Math.random() - 0.5) * inten;
      ctx.translate(shakeX, shakeY);
    }

    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // ── New tile-based terrain + decorations ──
    this.updateZoneLayouts(state);
    const viewW = W / cam.zoom;
    const viewH = H / cam.zoom;
    const camLeft = cam.x - viewW / 2;
    const camTop = cam.y - viewH / 2;

    // Layer 1: Tile-based terrain (replaces old flat fills)
    this.renderTerrain(ctx, state, cam, W, H, brightness);

    // Layer 2: Water areas (animated, rendered on top of terrain)
    for (const area of ZONE_5_AREAS) {
      if (area.terrainType === 'water') {
        renderWaterArea(ctx, area.bounds, camLeft, camTop, state.gameTime);
      }
    }

    // Layer 3: Roads (tile-based)
    this.tileRenderer.renderRoads(ctx, ISLAND_ZONES, camLeft, camTop, viewW, viewH);
    this.renderRoads(ctx, state, brightness);
    this.renderGeneratedRoads(ctx, state, brightness);

    // Layer 4: Stone walls
    renderWalls(ctx, camLeft, camTop);

    this.renderZoneBorders(ctx, state);

    // Layer 5: Buildings + decorations
    this.renderBuildings(ctx, state, brightness);
    this.renderGeneratedBuildings(ctx, state, brightness);
    this.renderGeneratedDecorations(ctx, state, brightness);

    // Layer 6: World decorations (trees, rocks, herbs, props, chests)
    this.renderWorldDecorations(ctx, state, camLeft, camTop, viewW, viewH);

    // Layer 7: Heroes Guild
    for (const layout of this.activeLayouts) {
      if (layout.guildPos) {
        drawHeroesGuild(ctx, layout.guildPos.x, layout.guildPos.y, camLeft, camTop, state.gameTime);
      }
    }

    // Layer 8: Animals
    this.renderAnimals(ctx, state, camLeft, camTop);

    this.renderPortals(ctx, state);
    this.renderDungeonEntrances(ctx, state);
    this.renderNPCs(ctx, state, brightness);
    this.renderTargetingIndicator(ctx, state);

    // Ambient particles (behind entities)
    for (const ap of state.ambientParticles) this.renderAmbientParticle(ctx, ap);

    // Enemies sorted by Y for depth — use sprite renderer for supported types
    const sorted = state.enemies.filter(e => !e.dead).sort((a, b) => a.y - b.y);
    for (const enemy of sorted) {
      const spriteDef = getSpriteDefForEnemy(enemy.type);
      if (spriteDef) {
        const animState = mapOWAnimState(enemy.animState);
        const tint = (state.hitFlash.get(enemy.id) ?? 0) > 0 ? '#ffffff' : undefined;
        drawSpriteEnemy(ctx, spriteDef, enemy.x, enemy.y, enemy.facing, animState, enemy.animTimer, camLeft, camTop, tint);
      } else {
        this.renderEnemy(ctx, enemy, state, brightness);
      }
    }

    this.renderPlayer(ctx, state, brightness);

    // Render spell effects from pre-allocated pool
    state.effectPool.forEach(slot => this.renderSpellEffect(ctx, slot as any));

    for (const proj of state.projectiles) this.renderProjectile(ctx, proj, state.gameTime);

    // Voxel projectiles (class ranged attacks + spell effects)
    for (const vp of state.voxelProjectiles) {
      renderVoxelProjectile(ctx, vp, camLeft, camTop, state.gameTime);
    }

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

    // HUD overlays (screen space)
    this.renderComboDisplay(ctx, state, W, H);
    this.renderHeavyCooldownIndicator(ctx, state, W, H);

    // Building interior (full-screen overlay, drawn last)
    if (state.activeBuilding) {
      this.renderBuildingInterior(ctx, state, W, H);
    }

    // ── Zone Cluster: transition overlay + zone banner ──
    const _zc: ZoneClusterState | undefined = (state as any).zoneCluster;
    if (_zc) {
      // Transition fade overlay
      const tOpacity = getTransitionOpacity(_zc);
      if (tOpacity > 0) {
        ctx.fillStyle = `rgba(0,0,0,${tOpacity})`;
        ctx.fillRect(0, 0, W, H);
        // "Loading..." text at center
        if (tOpacity > 0.5) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px sans-serif';
          ctx.textAlign = 'center';
          ctx.globalAlpha = (tOpacity - 0.5) * 2;
          ctx.fillText(_zc.bannerText || 'Loading...', W / 2, H / 2);
          ctx.globalAlpha = 1;
        }
      }

      // Zone name banner (fades after entering)
      if (_zc.bannerTimer > 0 && !_zc.transitioning) {
        const fade = Math.min(1, _zc.bannerTimer / 0.5); // fade out over last 0.5s
        ctx.globalAlpha = fade * 0.9;
        // Dark backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(W / 2 - 200, 60, 400, 50);
        // Zone name
        ctx.fillStyle = _zc.bannerColor;
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(_zc.bannerText, W / 2, 92);
        ctx.globalAlpha = 1;
      }
    }
  }

  private renderTerrain(ctx: CanvasRenderingContext2D, state: OpenWorldState, cam: { x: number; y: number; zoom: number }, W: number, H: number, brightness: number): void {
    const viewW = W / cam.zoom;
    const viewH = H / cam.zoom;

    // ── Layer 0: Ocean background (gradient + animated waves) ──
    renderOceanBackground(ctx, cam.x, cam.y, viewW, viewH, Date.now());

    // ── Layer 1-6: 16px tilemap (terrain, roads, structures, props) ──
    // Renders all 7 layers from the active ZoneTilemap
    renderTilemap(ctx, cam.x, cam.y, viewW, viewH);

    // ── Zone exits: glowing markers at zone edges ──
    const _cluster: ZoneClusterState | undefined = (state as any).zoneCluster;
    if (_cluster) {
      const activeZone = getActiveZone(_cluster);
      renderZoneExits(ctx, activeZone.exits, state.gameTime * 1000);
    }
  }

  // ── New World Decoration + Animal helpers ──────────────────────

  private updateZoneLayouts(state: OpenWorldState): void {
    // Get decoration layouts for nearby zones
    const currentZone = getZoneAtPosition(state.player.x, state.player.y);
    const currentId = currentZone?.id ?? -1;
    if (currentId !== this.lastLayoutZoneId) {
      this.lastLayoutZoneId = currentId;
      this.activeLayouts = [];
      this.activeAnimals = [];
      // Load layouts for current zone and adjacent zones
      const zoneIds: number[] = [];
      if (currentZone) zoneIds.push(currentZone.id);
      if (currentZone) {
        for (const connId of currentZone.connectedZoneIds) {
          if (!zoneIds.includes(connId)) zoneIds.push(connId);
        }
      }
      for (const zid of zoneIds) {
        const zone = getZoneById(zid);
        if (zone) {
          const layout = getZoneLayout(zone);
          this.activeLayouts.push(layout);
          this.activeAnimals.push(...layout.animals);
        }
      }
    }
    // Update animal AI
    for (const animal of this.activeAnimals) {
      const zone = ISLAND_ZONES.find(z => z.id === animal.zoneId);
      if (zone) updateAnimal(animal, 1 / 60, zone.bounds);
    }
  }

  private renderWorldDecorations(ctx: CanvasRenderingContext2D, state: OpenWorldState, camX: number, camY: number, viewW: number, viewH: number): void {
    const p = state.player;
    for (const layout of this.activeLayouts) {
      for (const deco of layout.decorations) {
        // Cull distant decorations
        if (Math.abs(deco.x - p.x) > viewW * 0.6 || Math.abs(deco.y - p.y) > viewH * 0.6) continue;
        const dist = Math.sqrt((p.x - deco.x) ** 2 + (p.y - deco.y) ** 2);
        drawDecoration(ctx, deco, camX, camY, state.gameTime, dist);
      }
    }
  }

  private renderAnimals(ctx: CanvasRenderingContext2D, state: OpenWorldState, camX: number, camY: number): void {
    for (const animal of this.activeAnimals) {
      if (Math.abs(animal.x - state.player.x) > 800 || Math.abs(animal.y - state.player.y) > 800) continue;
      drawAnimal(ctx, animal, camX, camY);
    }
  }

  private renderRoads(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    const p = state.player;
    const ROAD_COLORS: Record<string, string> = {
      dirt: '#7a5c3a', stone: '#8a8a9a', bridge: '#a07040',
    };

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness) * 0.6;
    ctx.lineCap = 'round';

    for (const road of ZONE_ROADS) {
      // Cull distant roads
      const midX = (road.from.x + road.to.x) / 2;
      const midY = (road.from.y + road.to.y) / 2;
      if (Math.abs(p.x - midX) > 1500 || Math.abs(p.y - midY) > 1500) continue;

      // Road edge/border (wider, darker)
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = road.width + 4;
      ctx.beginPath();
      ctx.moveTo(road.from.x, road.from.y);
      ctx.lineTo(road.to.x, road.to.y);
      ctx.stroke();

      // Road surface
      ctx.strokeStyle = ROAD_COLORS[road.type] || ROAD_COLORS.dirt;
      ctx.lineWidth = road.width;
      ctx.beginPath();
      ctx.moveTo(road.from.x, road.from.y);
      ctx.lineTo(road.to.x, road.to.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Sprite image cache for buildings
  private _buildingSpriteCache = new Map<string, HTMLImageElement>();
  private _getBuildingSprite(src: string): HTMLImageElement | null {
    let img = this._buildingSpriteCache.get(src);
    if (img) return img.complete ? img : null;
    img = new Image();
    img.src = src;
    this._buildingSpriteCache.set(src, img);
    return null;
  }

  private renderBuildings(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    const p = state.player;
    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness);

    // Sprite sheets for building types
    const housesImg = this._getBuildingSprite('/assets/sprites/farm-animals/PNG/Houses.png');
    const guildImg = this._getBuildingSprite('/assets/sprites/blacksmith-house/PNG/House_exterior.png');

    // Source rects in Houses.png (446x286 spritesheet with multiple building pieces)
    // Row 0: small houses ~80x70 each
    // Row 1: larger structures, walls, roofs
    const HOUSE_SRC: Record<string, { sx: number; sy: number; sw: number; sh: number }> = {
      fortress: { sx: 0, sy: 0, sw: 160, sh: 130 },
      tower:    { sx: 160, sy: 0, sw: 70, sh: 100 },
      house:    { sx: 230, sy: 0, sw: 80, sh: 70 },
      shop:     { sx: 310, sy: 0, sw: 80, sh: 70 },
      wall:     { sx: 0, sy: 200, sw: 80, sh: 30 },
      dock:     { sx: 80, sy: 200, sw: 100, sh: 30 },
      ruin:     { sx: 230, sy: 70, sw: 80, sh: 70 },
      camp:     { sx: 310, sy: 70, sw: 60, sh: 60 },
      gate:     { sx: 160, sy: 100, sw: 70, sh: 40 },
      inn:      { sx: 0, sy: 130, sw: 100, sh: 70 },
      well:     { sx: 100, sy: 130, sw: 40, sh: 40 },
      mill:     { sx: 140, sy: 130, sw: 80, sh: 70 },
    };

    for (const bld of ZONE_BUILDINGS) {
      if (Math.abs(p.x - bld.x) > 900 || Math.abs(p.y - bld.y) > 900) continue;

      const drawX = bld.x - bld.w / 2;
      const drawY = bld.y - bld.h / 2;
      const src = HOUSE_SRC[bld.type] || HOUSE_SRC.house;

      // Try sprite first
      const img = bld.type === 'fortress' || bld.type === 'inn' ? guildImg : housesImg;
      if (img?.complete) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(bld.x, bld.y + bld.h / 2 + 4, bld.w / 2 + 5, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        // Sprite
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, drawX, drawY, bld.w, bld.h);
      } else {
        // Fallback: colored rectangle with roof
        ctx.fillStyle = bld.color;
        ctx.fillRect(drawX, drawY, bld.w, bld.h);
        ctx.fillStyle = bld.roofColor;
        ctx.beginPath();
        ctx.moveTo(drawX - 4, drawY);
        ctx.lineTo(bld.x, drawY - 12);
        ctx.lineTo(drawX + bld.w + 4, drawY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(40,20,10,0.7)';
        ctx.fillRect(bld.x - 3, drawY + bld.h - 8, 6, 8);
      }

      // Label (close range only)
      const d = Math.abs(p.x - bld.x) + Math.abs(p.y - bld.y);
      if (d < 200) {
        ctx.fillStyle = '#e0d0a8';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.7;
        ctx.fillText(bld.type.charAt(0).toUpperCase() + bld.type.slice(1), bld.x, drawY - 6);
        ctx.globalAlpha = Math.max(0.3, brightness);
      }
    }

    ctx.restore();

    // Draw town buildings (enterable) on top
    this.renderTownBuildingExteriors(ctx, state, brightness);
  }

  // Sprite mapping for town building types → Houses.png source rects
  private static TOWN_BLDG_SPRITES: Record<string, { sx: number; sy: number; sw: number; sh: number }> = {
    inn:        { sx: 0,   sy: 130, sw: 100, sh: 70 },
    blacksmith: { sx: 0,   sy: 0,   sw: 80,  sh: 70 },
    shop:       { sx: 310, sy: 0,   sw: 80,  sh: 70 },
    trainer:    { sx: 230, sy: 0,   sw: 80,  sh: 70 },
    guild:      { sx: 0,   sy: 0,   sw: 160, sh: 130 },
    barracks:   { sx: 160, sy: 0,   sw: 70,  sh: 100 },
    armory:     { sx: 230, sy: 70,  sw: 80,  sh: 70 },
  };

  /** Draw all enterable town buildings with sprite exteriors, doors, and [E] prompts */
  private renderTownBuildingExteriors(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    const p = state.player;
    const housesImg = this._getBuildingSprite('/assets/sprites/farm-animals/PNG/Houses.png');
    const guildImg = this._getBuildingSprite('/assets/sprites/blacksmith-house/PNG/House_exterior.png');

    for (const tb of ALL_TOWN_BUILDINGS) {
      const cx = tb.wx + tb.ww / 2;
      const cy = tb.wy + tb.wh / 2;
      if (Math.abs(cx - p.x) > 800 || Math.abs(cy - p.y) > 800) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0.5, brightness);

      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(cx, tb.wy + tb.wh + 4, tb.ww / 2 + 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Try sprite rendering first
      const src = OpenWorldRenderer.TOWN_BLDG_SPRITES[tb.type];
      const img = (tb.type === 'guild' || tb.type === 'inn') ? guildImg : housesImg;
      if (img?.complete && src) {
        ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, tb.wx, tb.wy, tb.ww, tb.wh);
      } else {
        // Fallback: colored rectangle with roof
        ctx.fillStyle = tb.wallColor;
        ctx.fillRect(tb.wx, tb.wy, tb.ww, tb.wh);
        ctx.fillStyle = shadeColor(tb.wallColor, 30);
        ctx.beginPath();
        ctx.moveTo(tb.wx - 4, tb.wy);
        ctx.lineTo(cx, tb.wy - 14);
        ctx.lineTo(tb.wx + tb.ww + 4, tb.wy);
        ctx.closePath();
        ctx.fill();
        // Windows
        ctx.fillStyle = 'rgba(200,220,255,0.3)';
        ctx.fillRect(tb.wx + 8, tb.wy + 10, 12, 10);
        ctx.fillRect(tb.wx + tb.ww - 20, tb.wy + 10, 12, 10);
        ctx.strokeStyle = tb.floorColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(tb.wx + 8, tb.wy + 10, 12, 10);
        ctx.strokeRect(tb.wx + tb.ww - 20, tb.wy + 10, 12, 10);
      }

      // Door overlay (at bottom-centre, always drawn)
      const doorX = tb.wx + tb.ww / 2 - 6;
      const doorY = tb.wy + tb.wh - 12;
      ctx.fillStyle = '#2a1408';
      ctx.fillRect(doorX, doorY, 12, 14);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 1;
      ctx.strokeRect(doorX, doorY, 12, 14);
      ctx.fillStyle = '#c5a059';
      ctx.beginPath();
      ctx.arc(doorX + 9, doorY + 7, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Building name label
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#e0d0a8';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(tb.name, cx, tb.wy - 18);

      // Building type icon
      const typeIcons: Record<string, string> = { inn: '🏨', blacksmith: '⚒️', shop: '🛒', trainer: '⚔️', guild: '🏰', barracks: '🏛️', armory: '🛡️' };
      ctx.font = '12px sans-serif';
      ctx.fillText(typeIcons[tb.type] || '🏠', cx, tb.wy - 6);

      // [E] Enter prompt near door
      const doorDist = Math.sqrt((p.x - tb.doorX) ** 2 + (p.y - tb.doorY) ** 2);
      if (doorDist < 80) {
        const pulse = 0.55 + Math.sin(Date.now() * 0.005) * 0.35;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('[E] Enter', tb.doorX, tb.doorY + 14);
        ctx.globalAlpha = pulse * 0.25;
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(doorX - 2, doorY - 2, 16, 18);
      }

      ctx.restore();
    }
  }

  /** Full-screen building interior overlay */
  private renderBuildingInterior(ctx: CanvasRenderingContext2D, state: OpenWorldState, W: number, H: number): void {
    const b = state.activeBuilding!;
    const gameTime = state.gameTime;

    // Room layout in screen-space, centred
    const roomX = Math.floor((W - b.roomW) / 2);
    const roomY = Math.floor((H - b.roomH) / 2);
    const rW = b.roomW;
    const rH = b.roomH;

    // Dark vignette overlay over world
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    // ── Outer wall (stone/brick border) ──
    ctx.fillStyle = b.wallColor;
    ctx.fillRect(roomX - 12, roomY - 12, rW + 24, rH + 24);

    // ── Floor ──
    // Base floor color
    ctx.fillStyle = b.floorColor;
    ctx.fillRect(roomX, roomY, rW, rH);

    // Planks pattern
    ctx.save();
    ctx.beginPath();
    ctx.rect(roomX, roomY, rW, rH);
    ctx.clip();
    const plankH = 18;
    for (let py = 0; py < rH; py += plankH) {
      const even = Math.floor(py / plankH) % 2 === 0;
      ctx.fillStyle = even ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(roomX, roomY + py, rW, plankH);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(roomX, roomY + py + plankH);
      ctx.lineTo(roomX + rW, roomY + py + plankH);
      ctx.stroke();
    }
    // Vertical plank lines (offset per row)
    const plankW = 60;
    for (let py = 0; py < rH; py += plankH) {
      const off = (Math.floor(py / plankH) % 2) * (plankW / 2);
      for (let px = off; px < rW + plankW; px += plankW) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(roomX + px, roomY + py);
        ctx.lineTo(roomX + px, roomY + py + plankH);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ── Walls (top and sides) ──
    ctx.fillStyle = shadeColor(b.wallColor, 15);
    ctx.fillRect(roomX, roomY - 12, rW, 12);  // top wall
    ctx.fillRect(roomX - 12, roomY, 12, rH);  // left wall
    ctx.fillRect(roomX + rW, roomY, 12, rH);  // right wall

    // Wall shadows
    const grad = ctx.createLinearGradient(roomX, roomY, roomX, roomY + 40);
    grad.addColorStop(0, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(roomX, roomY, rW, 40);

    // ── Door at bottom ──
    const dX = roomX + rW / 2 - 14;
    const dY = roomY + rH - 1;
    ctx.fillStyle = '#2a1408';
    ctx.fillRect(dX, dY, 28, 14);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(dX, dY, 28, 14);
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.arc(dX + 22, dY + 7, 2, 0, Math.PI * 2);
    ctx.fill();
    // [E] to exit
    const nearDoor = state.interiorPlayer.y > 0.80;
    const pulseDoor = 0.6 + Math.sin(Date.now() * 0.005) * 0.3;
    ctx.globalAlpha = nearDoor ? pulseDoor : 0.4;
    ctx.fillStyle = nearDoor ? '#ffd700' : '#aaa';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('[E] Exit', roomX + rW / 2, dY + 26);
    ctx.globalAlpha = 1;

    // ── Furniture ──
    for (const f of b.furniture) {
      const fx = roomX + f.ix * rW;
      const fy = roomY + f.iy * rH;
      this.drawInteriorFurniture(ctx, f.type, fx, fy, gameTime);
    }

    // ── Interior NPCs ──
    for (const inpc of b.npcs) {
      const nx = roomX + inpc.ix * rW;
      const ny = roomY + inpc.iy * rH;
      const npcDist = Math.sqrt(
        (state.interiorPlayer.x - inpc.ix) ** 2 + (state.interiorPlayer.y - inpc.iy) ** 2,
      );
      drawTownNPCSprite(ctx, nx, ny, inpc.role, inpc.name, inpc.appearance, 1, npcDist * rH * 2.5, gameTime);
    }

    // ── Active interior NPC dialog bubble ──
    if (state.activeInteriorNPC) {
      const inpc = state.activeInteriorNPC;
      const nx = roomX + inpc.ix * rW;
      const ny = roomY + inpc.iy * rH;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      const bubW = 180, bubH = 44;
      const bx = Math.max(roomX + 4, Math.min(roomX + rW - bubW - 4, nx - bubW / 2));
      const by = ny - 70;
      ctx.fillRect(bx, by, bubW, bubH);
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bubW, bubH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(inpc.name, bx + 6, by + 13);
      ctx.fillStyle = '#e0d0a8';
      ctx.font = '8px sans-serif';
      // Word wrap at ~28 chars
      const lastLine = inpc.dialogue[Math.floor(gameTime / 3) % inpc.dialogue.length] || '';
      const words = lastLine.split(' ');
      let line = '', lineY = by + 25;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (test.length > 30 && line) {
          ctx.fillText(line, bx + 6, lineY);
          line = w; lineY += 11;
        } else { line = test; }
      }
      if (line) ctx.fillText(line, bx + 6, lineY);
      ctx.restore();
    }

    // ── Player sprite inside ──
    const plx = roomX + state.interiorPlayer.x * rW;
    const ply = roomY + state.interiorPlayer.y * rH;
    ctx.save();
    ctx.translate(plx, ply);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body — use same hero voxel renderer as world view
    const ihd = getHeroById(state.player.heroDataId);
    if (ihd) {
      this.voxel.drawHeroVoxel(ctx, 0, 0,
        RACE_COLORS[ihd.race] || '#888',
        CLASS_COLORS[ihd.heroClass] || '#888',
        ihd.heroClass, state.player.facing,
        state.player.animState, state.player.animTimer,
        ihd.race, ihd.name,
        undefined, undefined, state.player.id, undefined, undefined, state.gameTime);
    } else {
      // Fallback sprite
      ctx.fillStyle = '#4a7a3a';
      ctx.fillRect(-6, -16, 12, 24);
      ctx.fillStyle = '#f9c784';
      ctx.beginPath(); ctx.arc(0, -22, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ── Building title ──
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(roomX, roomY - 34, rW, 22);
    ctx.strokeStyle = '#c5a059';
    ctx.lineWidth = 1;
    ctx.strokeRect(roomX, roomY - 34, rW, 22);
    ctx.fillStyle = '#c5a059';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, roomX + rW / 2, roomY - 17);
  }

  /** Draw a single piece of interior furniture */
  private drawInteriorFurniture(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, gameTime: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.textAlign = 'center';

    switch (type) {
      case 'table':
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(-18, -12, 36, 24);
        ctx.strokeStyle = '#6b4a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(-18, -12, 36, 24);
        // Legs
        ctx.fillStyle = '#5a3a0a';
        ctx.fillRect(-16, 10, 4, 6);
        ctx.fillRect(12, 10, 4, 6);
        break;
      case 'shelf':
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-16, -20, 32, 8); // top shelf
        ctx.fillRect(-16, -5, 32, 8);  // bottom shelf
        ctx.fillRect(-16, -20, 4, 28); // left side
        ctx.fillRect(12, -20, 4, 28);  // right side
        // Items on shelf
        ctx.fillStyle = '#a87040';
        ctx.fillRect(-12, -18, 4, 6);
        ctx.fillStyle = '#6a9040';
        ctx.fillRect(-5, -18, 4, 6);
        break;
      case 'barrel':
        ctx.fillStyle = '#5a3a1a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a2010';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, -5, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 5, 10, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'chest':
        ctx.fillStyle = '#8b5a10';
        ctx.fillRect(-14, -8, 28, 18);
        ctx.fillStyle = '#6b4010';
        ctx.fillRect(-14, -8, 28, 6);
        ctx.strokeStyle = '#c5a059';
        ctx.lineWidth = 1;
        ctx.strokeRect(-14, -8, 28, 18);
        ctx.fillStyle = '#c5a059';
        ctx.beginPath();
        ctx.arc(0, 4, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'anvil':
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(-12, -4, 24, 10);
        ctx.fillRect(-8, 4, 16, 6);
        ctx.fillRect(-6, -10, 12, 8);
        ctx.strokeStyle = '#5a5a6a';
        ctx.lineWidth = 1;
        ctx.strokeRect(-12, -4, 24, 10);
        break;
      case 'bed':
        // Frame
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-16, -10, 32, 22);
        // Mattress
        ctx.fillStyle = '#e0d0b0';
        ctx.fillRect(-13, -8, 26, 15);
        // Pillow
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(-11, -8, 20, 6);
        break;
      case 'counter':
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(-22, -8, 44, 16);
        ctx.fillStyle = '#7a5040';
        ctx.fillRect(-22, -8, 44, 5);
        ctx.strokeStyle = '#3a2010';
        ctx.lineWidth = 1;
        ctx.strokeRect(-22, -8, 44, 16);
        break;
      case 'fireplace': {
        ctx.fillStyle = '#3a3030';
        ctx.fillRect(-18, -10, 36, 20);
        ctx.fillRect(-15, -8, 30, 14); // opening
        ctx.fillStyle = '#1a1010';
        ctx.fillRect(-12, -6, 24, 10); // inner
        // Fire animation
        const fi = Math.sin(gameTime * 8) * 2;
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-8, 2);
        ctx.lineTo(0, -8 + fi);
        ctx.lineTo(8, 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(-4, 2);
        ctx.lineTo(0, -4 + fi);
        ctx.lineTo(4, 2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'bookcase':
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-12, -22, 24, 44);
        // Books
        const bookColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
        for (let bi = 0; bi < 3; bi++) {
          for (let bj = 0; bj < 3; bj++) {
            ctx.fillStyle = bookColors[(bi * 3 + bj) % bookColors.length];
            ctx.fillRect(-10 + bj * 7, -18 + bi * 14, 6, 12);
          }
        }
        break;
      case 'rack':
        // Weapon rack
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-2, -18, 4, 36);
        ctx.fillRect(-14, -8, 28, 3);
        ctx.fillRect(-14, 5, 28, 3);
        // Weapons on rack
        ctx.fillStyle = '#78716c';
        ctx.fillRect(-12, -16, 2, 32);
        ctx.fillRect(-4, -16, 2, 32);
        ctx.fillRect(4, -16, 2, 32);
        ctx.fillRect(12, -16, 2, 32);
        break;
    }
    ctx.restore();
  }

  private renderDungeonEntrances(ctx: CanvasRenderingContext2D, state: OpenWorldState): void {
    const p = state.player;
    const pulse = 0.5 + Math.sin(Date.now() * 0.003) * 0.3;
    const spin = Date.now() * 0.0022;

    for (const entrance of DUNGEON_ENTRANCES) {
      const d = distXY(p, entrance);
      if (d > 900) continue;

      ctx.save();
      ctx.translate(entrance.x, entrance.y);

      // Outer magical glow
      ctx.globalAlpha = pulse * 0.18;
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();

      // Stone plinth / frame base
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#3b2a1d';
      ctx.beginPath();
      ctx.moveTo(-24, 16);
      ctx.lineTo(-14, 8);
      ctx.lineTo(14, 8);
      ctx.lineTo(24, 16);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8b6b4a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Portal frame
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, -2, 18, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, -2, 22, 28, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner portal energy
      const portalGrad = ctx.createRadialGradient(0, -2, 2, 0, -2, 20);
      portalGrad.addColorStop(0, `rgba(255,255,255,${0.85 * pulse})`);
      portalGrad.addColorStop(0.25, `rgba(168,85,247,${0.75 * pulse})`);
      portalGrad.addColorStop(0.7, `rgba(59,130,246,${0.55 * pulse})`);
      portalGrad.addColorStop(1, 'rgba(15,23,42,0.08)');
      ctx.fillStyle = portalGrad;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(0, -2, 15, 21, 0, 0, Math.PI * 2);
      ctx.fill();

      // Swirl arcs
      ctx.strokeStyle = '#f5d0fe';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.45 + pulse * 0.2;
      ctx.beginPath();
      ctx.arc(0, -2, 10, spin, spin + Math.PI * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 6, -spin * 1.25, -spin * 1.25 + Math.PI * 1.1);
      ctx.stroke();

      // Floating rune sparks
      for (let i = 0; i < 4; i++) {
        const a = spin + i * (Math.PI / 2);
        const rx = Math.cos(a) * 12;
        const ry = -2 + Math.sin(a) * 16;
        ctx.fillStyle = '#f5d0fe';
        ctx.globalAlpha = 0.55 + pulse * 0.2;
        ctx.beginPath();
        ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dungeon name
      ctx.fillStyle = '#c084fc';
      ctx.globalAlpha = 0.8;
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(entrance.name, 0, -28);

      // Level requirement
      ctx.fillStyle = p.level >= entrance.requiredLevel ? '#cbd5e1' : '#ef4444';
      ctx.font = '8px sans-serif';
      ctx.fillText(`Lv${entrance.requiredLevel}+`, 0, -20);

      // Interaction prompt when nearby
      if (d < 80) {
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('[F] Enter', 0, 26);
      }

      ctx.restore();
    }
  }

  // ── AI-Generated World Rendering ──────────────────────────────

  private getGeneratedZoneData(state: OpenWorldState, zoneId: number) {
    return state.generatedWorld?.zones.find(z => z.zoneId === zoneId) ?? null;
  }

  private renderGeneratedDecorations(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    if (!state.generatedWorld) return;
    const p = state.player;
    const viewRange = 900;

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness);

    for (const zoneData of state.generatedWorld.zones) {
      for (const deco of zoneData.decorations) {
        if (Math.abs(p.x - deco.x) > viewRange || Math.abs(p.y - deco.y) > viewRange) continue;

        const size = 10 * deco.scale;
        ctx.save();
        ctx.translate(deco.x, deco.y);
        ctx.rotate(deco.rotation * Math.PI / 180);

        if (deco.type.includes('tree') || deco.type === 'pine_tree' || deco.type === 'birch_tree') {
          ctx.fillStyle = '#5a3a1a';
          ctx.fillRect(-2 * deco.scale, 2 * deco.scale, 4 * deco.scale, 8 * deco.scale);
          ctx.fillStyle = deco.type.includes('dead') ? '#6b5b4b' : '#2d7a2d';
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(-size * 0.7, size * 0.2);
          ctx.lineTo(size * 0.7, size * 0.2);
          ctx.closePath();
          ctx.fill();
        } else if (deco.type.includes('rock') || deco.type.includes('boulder') || deco.type === 'pebble') {
          ctx.fillStyle = '#777';
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('bush') || deco.type.includes('fern') || deco.type === 'plant' || deco.type === 'clover') {
          ctx.fillStyle = '#3a8a3a';
          ctx.beginPath();
          ctx.ellipse(0, 0, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('flower')) {
          ctx.fillStyle = '#ff6b8a';
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (deco.type.includes('mushroom')) {
          ctx.fillStyle = '#cc4444';
          ctx.beginPath();
          ctx.arc(0, -2, size * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ddd';
          ctx.fillRect(-1, -1, 2, 5);
        } else if (deco.type.includes('grass')) {
          ctx.fillStyle = 'rgba(60,150,40,0.5)';
          ctx.fillRect(-2, -size * 0.3, 1, size * 0.6);
          ctx.fillRect(1, -size * 0.4, 1, size * 0.5);
        } else {
          ctx.fillStyle = '#666';
          ctx.fillRect(-size * 0.4, -size * 0.4, size * 0.8, size * 0.8);
        }

        ctx.restore();
      }
    }
    ctx.restore();
  }

  private renderGeneratedBuildings(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    if (!state.generatedWorld) return;
    const p = state.player;
    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness);

    for (const zoneData of state.generatedWorld.zones) {
      for (const bld of zoneData.buildings) {
        if (Math.abs(p.x - bld.x) > 900 || Math.abs(p.y - bld.y) > 900) continue;

        ctx.fillStyle = bld.color;
        ctx.fillRect(bld.x - bld.w / 2, bld.y - bld.h / 2, bld.w, bld.h);
        ctx.fillStyle = bld.roofColor;
        ctx.beginPath();
        ctx.moveTo(bld.x - bld.w / 2 - 3, bld.y - bld.h / 2);
        ctx.lineTo(bld.x, bld.y - bld.h / 2 - 10);
        ctx.lineTo(bld.x + bld.w / 2 + 3, bld.y - bld.h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(40,20,10,0.6)';
        ctx.fillRect(bld.x - 2, bld.y + bld.h / 2 - 6, 4, 6);

        const d = Math.abs(p.x - bld.x) + Math.abs(p.y - bld.y);
        if (d < 150) {
          ctx.fillStyle = '#bbb';
          ctx.font = '7px sans-serif';
          ctx.textAlign = 'center';
          ctx.globalAlpha = 0.5;
          ctx.fillText(bld.type, bld.x, bld.y - bld.h / 2 - 14);
          ctx.globalAlpha = Math.max(0.3, brightness);
        }
      }
    }
    ctx.restore();
  }

  private renderGeneratedRoads(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    if (!state.generatedWorld) return;
    const p = state.player;
    const ROAD_COLORS: Record<string, string> = { dirt: '#7a5c3a', stone: '#8a8a9a', bridge: '#a07040' };

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness) * 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allRoads = [
      ...state.generatedWorld.globalRoads,
      ...state.generatedWorld.zones.flatMap(z => z.roads),
    ];

    for (const road of allRoads) {
      if (road.points.length < 2) continue;
      const midIdx = Math.floor(road.points.length / 2);
      const mid = road.points[midIdx];
      if (Math.abs(p.x - mid.x) > 1500 || Math.abs(p.y - mid.y) > 1500) continue;

      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = road.width + 3;
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);
      for (let i = 1; i < road.points.length; i++) ctx.lineTo(road.points[i].x, road.points[i].y);
      ctx.stroke();

      ctx.strokeStyle = ROAD_COLORS[road.type] || ROAD_COLORS.dirt;
      ctx.lineWidth = road.width;
      ctx.beginPath();
      ctx.moveTo(road.points[0].x, road.points[0].y);
      for (let i = 1; i < road.points.length; i++) ctx.lineTo(road.points[i].x, road.points[i].y);
      ctx.stroke();
    }

    ctx.restore();
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
      drawTownNPCSprite(ctx, npc.x, npc.y, npc.type, npc.name, undefined, brightness, d, state.gameTime);
    }
    // V2: Render faction hero NPCs at dock positions as voxel heroes
    this.renderFactionHeroNPCs(ctx, state, brightness);
    // V2: Render dock structures
    this.renderDockStructures(ctx, state, brightness);
  }

  /** Render faction hero NPCs as full voxel heroes with quest indicators */
  private renderFactionHeroNPCs(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    for (const npc of state.factionHeroNPCs) {
      const d = distXY(state.player, npc);
      if (d > 1000) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0.5, brightness);

      // Render as voxel hero using their race/class
      const raceColor = RACE_COLORS[npc.race] || '#888';
      const classColor = CLASS_COLORS[npc.heroClass] || '#888';
      const isDockVendor = npc.station === 'dock_vendor';
      const isPatrol = npc.station === 'zone_patrol';
      // Dock vendors face the player; patrol NPCs face their walk direction
      const facing = isDockVendor ? angleBetween(npc, state.player) : state.gameTime * 0.3;
      const animState = isPatrol ? 'walk' : 'idle';

      this.voxel.drawHeroVoxel(
        ctx, npc.x, npc.y, raceColor, classColor,
        npc.heroClass, facing, animState, state.gameTime,
        npc.race, npc.name,
      );

      // Quest exclamation mark (dock vendors only — they give quests)
      if (isDockVendor) {
        const bob = Math.sin(state.gameTime * 3) * 3;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', npc.x, npc.y - 38 + bob);
        ctx.shadowBlur = 0;
      }

      // Nameplate
      ctx.fillStyle = 'rgba(10,8,5,0.85)';
      ctx.strokeStyle = npc.role === 'commander' ? 'rgba(239,68,68,0.6)'
        : npc.role === 'quartermaster' ? 'rgba(245,158,11,0.6)'
        : npc.role === 'patrol' ? 'rgba(96,165,250,0.4)'
        : 'rgba(34,197,94,0.6)';
      ctx.lineWidth = 1;
      const pw = 64, ph = 14;
      ctx.beginPath();
      ctx.roundRect(npc.x - pw / 2, npc.y - 52, pw, ph, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#e0d0a8';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name.split(' ').pop() || npc.name, npc.x, npc.y - 43);

      // Role tag
      const roleLabel = npc.role === 'commander' ? '⚔ Commander'
        : npc.role === 'quartermaster' ? '🛡 Quartermaster'
        : npc.role === 'patrol' ? '🗡 Patrol'
        : '📍 Scout';
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.font = '6px sans-serif';
      ctx.fillText(roleLabel, npc.x, npc.y - 55);

      // Faction badge
      ctx.fillStyle = 'rgba(197,160,89,0.6)';
      ctx.font = '5px sans-serif';
      ctx.fillText(`[${npc.faction}]`, npc.x, npc.y - 60);

      // Interact prompt when close (dock vendors only)
      if (isDockVendor && d < 80) {
        const pulse = 0.6 + Math.sin(state.gameTime * 4) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('[E] Talk', npc.x, npc.y + 20);
      }
      // Patrol heroes show a softer label when near
      if (isPatrol && d < 120) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#aaa';
        ctx.font = '7px sans-serif';
        ctx.fillText('On Patrol', npc.x, npc.y + 18);
      }

      ctx.restore();
    }
  }

  /** Render dock structures (piers, boats, flags) from faction-spawn.ts */
  private renderDockStructures(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {

    for (const ds of state.factionDockStructures) {
      const d = distXY(state.player, ds);
      if (d > 1200) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0.5, brightness);
      ctx.translate(ds.x, ds.y);
      if (ds.rotation) ctx.rotate(ds.rotation);

      const factionColor = FACTION_DOCKS[ds.faction]?.color || '#c5a059';

      switch (ds.type) {
        case 'pier':
          ctx.fillStyle = '#6b4423';
          ctx.fillRect(-20, -6, 40, 12);
          ctx.strokeStyle = '#4a3010';
          ctx.lineWidth = 1;
          ctx.strokeRect(-20, -6, 40, 12);
          // Planks
          for (let px = -18; px <= 16; px += 8) {
            ctx.fillStyle = '#5a3a18';
            ctx.fillRect(px, -5, 6, 10);
          }
          break;
        case 'boat_large':
          ctx.fillStyle = '#5a3a1a';
          ctx.beginPath();
          ctx.moveTo(-24, 0); ctx.lineTo(-18, -12); ctx.lineTo(18, -12);
          ctx.lineTo(24, 0); ctx.lineTo(18, 10); ctx.lineTo(-18, 10);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#3a2010';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // Mast
          ctx.fillStyle = '#4a3010';
          ctx.fillRect(-1, -24, 2, 20);
          // Sail
          ctx.fillStyle = factionColor;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(0, -22); ctx.lineTo(10, -14); ctx.lineTo(0, -6);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = brightness;
          break;
        case 'boat_small':
          ctx.fillStyle = '#6b4a23';
          ctx.beginPath();
          ctx.moveTo(-14, 0); ctx.lineTo(-10, -8); ctx.lineTo(10, -8);
          ctx.lineTo(14, 0); ctx.lineTo(10, 6); ctx.lineTo(-10, 6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#4a3010';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case 'dock_house':
          ctx.fillStyle = '#5a4030';
          ctx.fillRect(-18, -16, 36, 28);
          ctx.fillStyle = '#8a6a40';
          ctx.fillRect(-18, -20, 36, 6);
          ctx.strokeStyle = factionColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(-18, -16, 36, 28);
          // Door
          ctx.fillStyle = '#3a2010';
          ctx.fillRect(-4, 4, 8, 10);
          break;
        case 'barrel':
          ctx.fillStyle = '#5a3a1a';
          ctx.beginPath();
          ctx.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3a2010';
          ctx.lineWidth = 1;
          ctx.stroke();
          break;
        case 'crate':
          ctx.fillStyle = '#6b4a23';
          ctx.fillRect(-6, -6, 12, 12);
          ctx.strokeStyle = '#4a3010';
          ctx.lineWidth = 1;
          ctx.strokeRect(-6, -6, 12, 12);
          break;
        case 'anchor':
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 4, 6, 0.3, Math.PI - 0.3);
          ctx.stroke();
          ctx.moveTo(0, -6); ctx.lineTo(0, 8);
          ctx.stroke();
          ctx.fillStyle = '#666';
          ctx.fillRect(-4, -8, 8, 3);
          break;
        case 'lamp':
          ctx.fillStyle = '#4a4a4a';
          ctx.fillRect(-1, -12, 2, 12);
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = 0.6 + Math.sin(state.gameTime * 3) * 0.2;
          ctx.beginPath();
          ctx.arc(0, -14, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = brightness;
          break;
        case 'flag':
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(-1, -20, 2, 20);
          ctx.fillStyle = factionColor;
          ctx.fillRect(1, -20, 12, 8);
          // Faction initial
          ctx.fillStyle = '#000';
          ctx.font = 'bold 6px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ds.faction[0], 7, -14);
          break;
      }

      ctx.restore();
    }
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, enemy: OWEnemy, state: OpenWorldState, brightness: number): void {
    ctx.save();
    ctx.globalAlpha = Math.max(0.3, brightness);

    // Hit flash: white overlay when enemy just took damage
    const flashTimer = state.hitFlash.get(enemy.id) ?? 0;
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
    }

    this.voxel.drawEnemyVoxel(ctx, enemy.x, enemy.y, enemy.type, enemy.facing, enemy.animState, enemy.animTimer, enemy.size, enemy.isBoss);

    // AI slash VFX for attacking enemies (parity with player weapon trails)
    if (enemy.animState === 'attack' && enemy.animTimer > 0.05) {
      const wType = ENEMY_ATTACK_WEAPON[enemy.attackStyle] || 'sword_shield';
      const plan = globalAnimDirector.planAttack('Warrior', wType, enemy.id, enemy.facing);
      plan.slashWidth *= Math.max(1, enemy.size / 12); // scale to enemy size
      if (enemy.isBoss) { plan.impactFlash = true; plan.trailIntensity = 1.8; }
      const atkPhase = enemy.animTimer % 0.8; // syncs with drawEnemyVoxel attack cycle
      const progress = Math.min(1, atkPhase / plan.duration);
      drawAISlashVFX(ctx, enemy.x, enemy.y - enemy.size * 0.5, plan, progress, state.gameTime);
    }

    // White flash overlay on hit
    if (flashTimer > 0) {
      ctx.restore();
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.globalAlpha = flashTimer * 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -enemy.size * 0.5, enemy.size + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);

    // Health bar (enhanced with border)
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

    // Aggro indicator (red eye when chasing player)
    if (enemy.targetId !== null) {
      ctx.fillStyle = '#ff4444';
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.beginPath();
      ctx.arc(0, -enemy.size - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, state: OpenWorldState, brightness: number): void {
    const p = state.player;
    const hd = getHeroById(p.heroDataId);
    const raceColor = RACE_COLORS[hd.race] || '#888';
    const classColor = CLASS_COLORS[hd.heroClass] || '#888';

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = Math.max(0.4, brightness);

    // Subtle ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const buffNames = p.activeEffects.map(e => e.name || '');
    // V2: Use modular voxel renderer when config is available
    if (state.modularConfig) {
      this.voxel.drawModularHeroVoxel(ctx, 0, 0, state.modularConfig, p.facing, p.animState, p.animTimer, p.id, state.gameTime);
    } else {
      this.voxel.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, hd.heroClass, p.facing, p.animState, p.animTimer, hd.race, hd.name, undefined, undefined, p.id, p.shieldHp > 0 ? p.shieldHp : undefined, buffNames.length > 0 ? buffNames : undefined, state.gameTime);
    }

    // ── Styled nameplate ──
    ctx.globalAlpha = 1;
    const plateW = 52;
    const plateH = 22;
    const plateY = -36;

    // Background
    ctx.fillStyle = 'rgba(10,8,5,0.85)';
    ctx.strokeStyle = 'rgba(197,160,89,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-plateW / 2, plateY, plateW, plateH, 3);
    ctx.fill();
    ctx.stroke();

    // Name
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hd.name.split(' ').pop() || hd.name, 0, plateY + 8);

    // Level badge
    ctx.fillStyle = '#c5a059';
    ctx.font = '6px sans-serif';
    ctx.fillText(`Lv${p.level}`, 0, plateY + 14.5);

    // HP bar
    const barW = plateW - 6;
    const hpPct = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2, plateY + 16, barW, 3);
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(-barW / 2, plateY + 16, barW * hpPct, 3);

    // MP bar
    const mpPct = p.mp / p.maxMp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-barW / 2, plateY + 20, barW, 2);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(-barW / 2, plateY + 20, barW * mpPct, 2);

    // Status effects (small colored pips)
    if (p.activeEffects.length > 0) {
      const effW = p.activeEffects.length * 6;
      let ox = -effW / 2;
      for (const eff of p.activeEffects) {
        ctx.fillStyle = eff.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(ox, plateY - 5, 5, 3);
        ctx.globalAlpha = 1;
        ox += 6;
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

  private renderProjectile(ctx: CanvasRenderingContext2D, proj: OWProjectile, gameTime: number): void {
    // Try GLB sprite for projectiles with sprite tags
    if (proj.glbSprite) {
      const drawn = drawGLBProjectile(ctx, proj.glbSprite, proj.x, proj.y, gameTime, 0.5, proj.color);
      if (drawn) return;
    }
    // Fallback: glowing circle
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
    const alpha = Math.min(1, ft.life * 2);
    const age = ft.maxLife - ft.life;
    // Pop-in spring: small → overshoot → settle
    const popScale = age < 0.08
      ? 0.35 + (age / 0.08) * 0.85
      : age < 0.16 ? 1.2 - ((age - 0.08) / 0.08) * 0.2
      : 1.0;

    const isCrit   = ft.text.includes('CRIT');
    const isHeal   = ft.color === '#22c55e' || ft.color === '#6ec96e' || ft.color === '#86efac';
    const isGold   = ft.color === '#ffd700';
    const isXp     = ft.color === '#60a5fa';
    const baseSize = isCrit ? Math.ceil(ft.size * 1.45) : ft.size;

    ctx.save();
    ctx.translate(ft.x, ft.y);
    ctx.scale(popScale, popScale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = `bold ${baseSize}px 'PixelGothic', 'Courier New', monospace`;

    // Glow for impactful events
    if (isCrit) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 18; }
    else if (isGold) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8; }
    else if (isHeal) { ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 7; }
    else if (isXp)   { ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 6; }
    else if (ft.size >= 14) { ctx.shadowColor = ft.color; ctx.shadowBlur = 5; }

    // Thick black outline for readability
    ctx.strokeStyle = isHeal ? 'rgba(0,40,0,0.85)' : 'rgba(0,0,0,0.85)';
    ctx.lineWidth = isCrit ? 5 : 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(ft.text, 0, 0);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    ctx.shadowBlur = 0;

    // Star burst on CRIT entry
    if (isCrit && age < 0.25) {
      const t = age / 0.25;
      ctx.globalAlpha = alpha * (1 - t);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const sa = (i / 6) * Math.PI * 2 + age * 8;
        const r  = 14 + t * 8;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * r, Math.sin(sa) * r * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Heal shimmer (+HP text gets small green sparkles)
    if (isHeal && age < 0.35) {
      const t = age / 0.35;
      ctx.globalAlpha = alpha * (1 - t) * 0.7;
      ctx.fillStyle = '#86efac';
      for (let i = 0; i < 3; i++) {
        const sa = ((i / 3) * Math.PI * 2 + age * 6);
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * 10, Math.sin(sa) * 8 - 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderAmbientParticle(ctx: CanvasRenderingContext2D, ap: OWParticle): void {
    const alpha = Math.min(1, ap.life / ap.maxLife) * 0.6;
    const isFirefly = ap.color === '#aaff44';

    ctx.save();
    if (isFirefly) {
      // Pulsing glow
      const pulse = 0.4 + Math.sin(Date.now() * 0.008 + ap.x * 0.1) * 0.6;
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = ap.color;
      ctx.shadowColor = '#aaff44';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.size + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Core
      ctx.globalAlpha = alpha * pulse * 1.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ap.color;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderComboDisplay(ctx: CanvasRenderingContext2D, state: OpenWorldState, W: number, H: number): void {
    if (state.comboDisplay.count < 2) return;
    const combo = state.comboDisplay;
    const alpha = Math.min(1, combo.timer * 2);
    const popScale = combo.timer > 1.8 ? 1.2 : 1.0;

    ctx.save();
    ctx.translate(W - 120, H * 0.35);
    ctx.scale(popScale, popScale);
    ctx.globalAlpha = alpha;

    // Combo text — PixelGothic font
    const comboColor = combo.count >= 10 ? '#ffd700' : combo.count >= 5 ? '#f97316' : '#ef4444';
    ctx.textAlign = 'center';
    ctx.font = `bold 30px 'PixelGothic', 'Courier New', monospace`;
    ctx.shadowColor = comboColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(`${combo.count}`, 0, 0);
    ctx.fillStyle = comboColor;
    ctx.fillText(`${combo.count}`, 0, 0);
    ctx.shadowBlur = 0;

    ctx.font = `bold 11px 'PixelGothic', 'Courier New', monospace`;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeText('COMBO', 0, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('COMBO', 0, 18);

    // Timer bar
    const barW = 50;
    const pct = combo.timer / 2.0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-barW / 2, 24, barW, 4);
    ctx.fillStyle = comboColor;
    ctx.fillRect(-barW / 2, 24, barW * pct, 4);

    ctx.restore();
  }

  private renderHeavyCooldownIndicator(ctx: CanvasRenderingContext2D, state: OpenWorldState, W: number, H: number): void {
    const cd = state.player.heavyAttackCooldown;
    if (cd <= 0) return;

    const cx = W / 2, cy = H / 2 + 30;
    const maxCd = 1.2;
    const pct = cd / maxCd;

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
    ctx.stroke();
    ctx.restore();
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
      case 'melee_slash': {
        // Glowing arc slash in front of player
        const slashProgress = 1 - t;
        const arcStart = se.angle - Math.PI * 0.4;
        const arcEnd = se.angle + Math.PI * 0.4;
        const arcAngle = arcStart + (arcEnd - arcStart) * slashProgress;
        const reachDist = se.radius * (0.7 + slashProgress * 0.3);
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 4 + slashProgress * 3;
        ctx.shadowColor = se.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(se.x, se.y, reachDist, arcStart, arcAngle);
        ctx.stroke();
        // Secondary trail
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = t * 0.4;
        ctx.beginPath();
        ctx.arc(se.x, se.y, reachDist + 5, arcStart + 0.1, arcAngle - 0.1);
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      }
      case 'melee_lunge': {
        // Dash trail from start to current position
        const startX = se.data?.startX ?? se.x;
        const startY = se.data?.startY ?? se.y;
        ctx.globalAlpha = t * 0.6;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 6 * t;
        ctx.shadowColor = se.color;
        ctx.shadowBlur = 15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(se.x, se.y);
        ctx.stroke();
        // Thrust point
        const tipX = se.x + Math.cos(se.angle) * 15;
        const tipY = se.y + Math.sin(se.angle) * 15;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = t;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt';
        break;
      }
      case 'heavy_slash': {
        // Wide heavy overhead arc
        const hp = 1 - t;
        const hArcStart = se.angle - Math.PI * 0.55;
        const hArcEnd = se.angle + Math.PI * 0.55;
        const hArcAngle = hArcStart + (hArcEnd - hArcStart) * hp;
        const hReach = se.radius * (0.6 + hp * 0.4);
        ctx.globalAlpha = t * 0.9;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 6 + hp * 4;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(se.x, se.y, hReach, hArcStart, hArcAngle);
        ctx.stroke();
        // Impact flash at end
        if (hp > 0.7) {
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = (1 - hp) * 3;
          ctx.beginPath();
          ctx.arc(se.x + Math.cos(se.angle) * hReach, se.y + Math.sin(se.angle) * hReach, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case 'enemy_slash': {
        // Enemy melee slash: quick arc from enemy position
        const ep = 1 - t;
        const eArcStart = se.angle - Math.PI * 0.35;
        const eArcEnd = se.angle + Math.PI * 0.35;
        const eArcAngle = eArcStart + (eArcEnd - eArcStart) * ep;
        ctx.globalAlpha = t * 0.7;
        ctx.strokeStyle = se.color;
        ctx.lineWidth = 3 + ep * 3;
        ctx.shadowColor = se.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * (0.5 + ep * 0.5), eArcStart, eArcAngle);
        ctx.stroke();
        // Claw marks
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = t * 0.3;
        for (let cl = 0; cl < 3; cl++) {
          const clAngle = se.angle + (cl - 1) * 0.15;
          ctx.beginPath();
          ctx.moveTo(se.x + Math.cos(clAngle) * 5, se.y + Math.sin(clAngle) * 5);
          ctx.lineTo(se.x + Math.cos(clAngle) * (se.radius * ep), se.y + Math.sin(clAngle) * (se.radius * ep));
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        break;
      }
      case 'enemy_aoe_telegraph': {
        // Albion-style: red circle that FILLS from edge to center over wind-up
        const fillProgress = 1 - t; // 0 at start → 1 when it fires
        const pulse = 1 + Math.sin(Date.now() * 0.012) * 0.04;
        const r = se.radius * pulse;

        // Outer border ring (always visible, red)
        ctx.strokeStyle = '#cc2222';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(se.x, se.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Filling red sweep — fills from 0% to 100% over the telegraph duration
        if (fillProgress > 0) {
          // Radial fill from edge inward
          const fillR = r * fillProgress;
          const grad = ctx.createRadialGradient(se.x, se.y, Math.max(0.1, r - fillR), se.x, se.y, r);
          grad.addColorStop(0, 'rgba(200,30,30,0)');
          grad.addColorStop(0.3, 'rgba(200,30,30,0.15)');
          grad.addColorStop(1, 'rgba(220,40,40,0.45)');
          ctx.fillStyle = grad;
          ctx.globalAlpha = 0.5 + fillProgress * 0.4;
          ctx.beginPath();
          ctx.arc(se.x, se.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Inner progress circle (solid red, grows with fill)
          ctx.fillStyle = 'rgba(255,60,60,0.35)';
          ctx.globalAlpha = fillProgress * 0.6;
          ctx.beginPath();
          ctx.arc(se.x, se.y, fillR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Warning cross-hatch at >70% fill
        if (fillProgress > 0.7) {
          const urgency = (fillProgress - 0.7) / 0.3;
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = urgency * 0.5;
          // Cross pattern
          ctx.beginPath();
          ctx.moveTo(se.x - r * 0.5, se.y - r * 0.5);
          ctx.lineTo(se.x + r * 0.5, se.y + r * 0.5);
          ctx.moveTo(se.x + r * 0.5, se.y - r * 0.5);
          ctx.lineTo(se.x - r * 0.5, se.y + r * 0.5);
          ctx.stroke();
        }
        break;
      }
      case 'enemy_aoe_blast': {
        // Albion-style: rapid flash + expanding shockwave ring
        const bp = 1 - t;
        const blastR = se.radius * (0.5 + bp * 0.5);

        // Ground scorch (persists briefly)
        ctx.fillStyle = 'rgba(80,20,20,0.3)';
        ctx.globalAlpha = t;
        ctx.beginPath();
        ctx.arc(se.x, se.y, se.radius * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Expanding shockwave ring
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 4 * t;
        ctx.globalAlpha = t * 0.8;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(se.x, se.y, blastR, 0, Math.PI * 2);
        ctx.stroke();

        // Inner flash (bright white burst at start)
        if (bp < 0.3) {
          const flashAlpha = (0.3 - bp) * 3;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = flashAlpha * 0.6;
          ctx.beginPath();
          ctx.arc(se.x, se.y, se.radius * 0.4 * (1 - bp), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
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

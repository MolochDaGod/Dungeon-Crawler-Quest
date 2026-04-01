/**
 * Player Character Registry — Modular MMO Character Definitions
 *
 * Maps the 12 DungeonCrawler character models to playable archetypes.
 * Each model has a body type (heavy/medium/slim) that determines which
 * races can use it. Players choose race + class + body at character creation,
 * then own that character through the Grudge backend.
 *
 * Character models are DungeonCrawler_Character.fbx → converted to GLB.
 * All share the same Mixamo-compatible skeleton for animation retargeting.
 * Palette texture (256×1 PNG) drives skin/armor color variants per race.
 */

import type { EquipmentAppearance } from './voxel-equipment';
import type { ModularVoxelConfig } from './voxel-modular';
import type { ToonRtsRaceKey } from '../../../shared/toon-rts-registry';
import type { MountState } from './mount-system';

// ── Types ──────────────────────────────────────────────────────

export type BodyType = 'heavy_male' | 'medium_male' | 'slim_male' | 'heavy_female' | 'medium_female' | 'slim_female';

export interface PlayerCharacterDef {
  /** Index into DungeonCrawler_Character array (0-11) */
  modelIndex: number;
  /** Source filename (for conversion pipeline) */
  sourceFbx: string;
  /** Display name shown in character creator */
  displayName: string;
  /** Body type category */
  bodyType: BodyType;
  /** Which races can pick this body */
  availableRaces: string[];
  /** Default model scale in world */
  modelScale: number;
  /** Default skin tone hex (overridden by race selection) */
  defaultSkinColor: string;
  /** ObjectStore asset ID (set after upload) */
  objectStoreId?: string;
  /** ObjectStore GLB URL (set after upload) */
  glbUrl?: string;
  /** Toon_RTS character GLB path (high-poly selectable model) */
  toonRtsCharacterGlb?: string;
  /** Toon_RTS cavalry GLB path (mounted variant) */
  toonRtsCavalryGlb?: string;
}

export interface PlayerCharacterState {
  /** Grudge backend account ID */
  accountId: string;
  /** Grudge ID for this character */
  grudgeId: string;
  /** Selected model index (0-11) */
  modelIndex: number;
  /** Body type */
  bodyType: BodyType;
  /** Player-chosen name */
  customName: string;
  /** Race */
  race: string;
  /** Class */
  heroClass: string;
  /** Faction (derived from race) */
  faction: string;
  /** Level */
  level: number;
  /** Starting weapon type (e.g. 'swords', 'bow', 'fireStaves') */
  weaponType: string;
  /** Equipment appearance snapshot */
  appearance: EquipmentAppearance;
  /** Bear sprite variant for Worg class (brown/white) */
  bearSpriteVariant: 'brown' | 'white';
  /** V2 modular voxel customization (lower/chest/face/arm styles) */
  modularConfig?: ModularVoxelConfig;
  /** Mount / cavalry state */
  mountState?: MountState;
  /** Use Toon_RTS 3D model instead of voxel (when GLBs are available) */
  useToonRtsModel?: boolean;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  lastLogin: string;
}

// ── Race → Skin Color Mapping ──────────────────────────────────

export const RACE_SKIN_COLORS: Record<string, string> = {
  Human: '#c4956a',
  Barbarian: '#a57850',
  Dwarf: '#d4a574',
  Elf: '#e8d5b8',
  Orc: '#5a8a3a',
  Undead: '#7a8a7a',
};

// ── Race → Toon_RTS Mapping ────────────────────────────────────

/** Maps game race → Toon_RTS asset prefix and race key */
export const RACE_TOON_RTS: Record<string, { key: ToonRtsRaceKey; prefix: string; characterGlb: string; cavalryGlb: string }> = {
  Human:     { key: 'western_kingdoms', prefix: 'WK',  characterGlb: '/models/toon-rts/western_kingdoms/WK_Characters_customizable.glb',  cavalryGlb: '/models/toon-rts/western_kingdoms/WK_Cavalry_customizable.glb' },
  Barbarian: { key: 'barbarians',       prefix: 'BRB', characterGlb: '/models/toon-rts/barbarians/BRB_Characters_customizable.glb',     cavalryGlb: '/models/toon-rts/barbarians/BRB_Cavalry_customizable.glb' },
  Dwarf:     { key: 'dwarves',          prefix: 'DWF', characterGlb: '/models/toon-rts/dwarves/DWF_Characters_customizable.glb',        cavalryGlb: '/models/toon-rts/dwarves/DWF_Cavalry_customizable.glb' },
  Elf:       { key: 'elves',            prefix: 'ELF', characterGlb: '/models/toon-rts/elves/ELF_Characters_customizable.glb',          cavalryGlb: '/models/toon-rts/elves/ELF_Cavalry_customizable.glb' },
  Orc:       { key: 'orcs',             prefix: 'ORC', characterGlb: '/models/toon-rts/orcs/ORC_Characters_Customizable.glb',           cavalryGlb: '/models/toon-rts/orcs/ORC_Cavalry_Customizable.glb' },
  Undead:    { key: 'undead',           prefix: 'UD',  characterGlb: '/models/toon-rts/undead/UD_Characters_customizable.glb',           cavalryGlb: '/models/toon-rts/undead/UD_Cavalry_customizable.glb' },
};

/** Toon_RTS equipment mapping: game weapon type → race-specific equipment GLB */
export const TOON_RTS_EQUIPMENT: Record<string, Record<string, string>> = {
  Barbarian: {
    hammers:    '/models/toon-rts/barbarians/equipment/BRB_weapon_hammer_B.glb',
    spears:     '/models/toon-rts/barbarians/equipment/BRB_weapon_spear.glb',
    fireStaves: '/models/toon-rts/barbarians/equipment/BRB_weapon_staff_B.glb',
    swords:     '/models/toon-rts/barbarians/equipment/BRB_weapon_sword_B.glb',
  },
  Elf: {
    spears:      '/models/toon-rts/elves/equipment/ELF_weapon_spear.glb',
    natureStaves:'/models/toon-rts/elves/equipment/ELF_weapon_staff_C.glb',
  },
  Orc: {
    greataxes:  '/models/toon-rts/orcs/equipment/ORC_weapon_Axe_A.glb',
    fireStaves: '/models/toon-rts/orcs/equipment/ORC_weapon_staff_B.glb',
  },
  Undead: {
    spears:      '/models/toon-rts/undead/equipment/UD_weapon_Spear.glb',
    frostStaves: '/models/toon-rts/undead/equipment/UD_weapon_staff_B.glb',
    greatswords: '/models/toon-rts/undead/equipment/UD_weapon_Sword_C.glb',
  },
  Human: {
    arcaneStaves:'/models/toon-rts/western_kingdoms/equipment/WK_weapon_staff_B.glb',
    swords:      '/models/toon-rts/western_kingdoms/equipment/WK_weapon_sword_A.glb',
  },
  Dwarf: {},
};

/** Get Toon_RTS equipment GLB for a race + weapon type combo */
export function getToonRtsWeapon(race: string, weaponType: string): string | null {
  return TOON_RTS_EQUIPMENT[race]?.[weaponType] ?? null;
}

// ── Race → Faction Mapping ─────────────────────────────────────

export const RACE_FACTIONS: Record<string, string> = {
  Human: 'Crusade',
  Barbarian: 'Crusade',
  Dwarf: 'Fabled',
  Elf: 'Fabled',
  Orc: 'Legion',
  Undead: 'Legion',
};

// ── Race → Bear Form Variant ───────────────────────────────────

export const RACE_BEAR_VARIANT: Record<string, 'brown' | 'white'> = {
  Human: 'white',
  Barbarian: 'brown',
  Dwarf: 'white',
  Elf: 'white',
  Orc: 'brown',
  Undead: 'white',
};

// ── Race → Compatible Body Types ───────────────────────────────

const RACE_BODY_COMPAT: Record<string, BodyType[]> = {
  Human:     ['medium_male', 'medium_female', 'slim_male', 'slim_female', 'heavy_male'],
  Barbarian: ['heavy_male', 'heavy_female', 'medium_male'],
  Dwarf:     ['heavy_male', 'heavy_female', 'medium_male'],
  Elf:       ['slim_male', 'slim_female', 'medium_male', 'medium_female'],
  Orc:       ['heavy_male', 'heavy_female', 'medium_male'],
  Undead:    ['slim_male', 'slim_female', 'medium_male', 'medium_female', 'heavy_male'],
};

// ── Character Definitions (12 models) ──────────────────────────

export const PLAYER_CHARACTER_DEFS: PlayerCharacterDef[] = [
  { modelIndex: 0,  sourceFbx: 'DungeonCrawler_Character.fbx',   displayName: 'Knight',         bodyType: 'heavy_male',    availableRaces: ['Human', 'Barbarian', 'Orc', 'Dwarf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 1,  sourceFbx: 'DungeonCrawler_Character1.fbx',  displayName: 'Warrior',        bodyType: 'medium_male',   availableRaces: ['Human', 'Barbarian', 'Elf', 'Orc', 'Dwarf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 2,  sourceFbx: 'DungeonCrawler_Character2.fbx',  displayName: 'Rogue',          bodyType: 'slim_male',     availableRaces: ['Human', 'Elf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 3,  sourceFbx: 'DungeonCrawler_Character3.fbx',  displayName: 'Mage',           bodyType: 'medium_male',   availableRaces: ['Human', 'Barbarian', 'Elf', 'Orc', 'Dwarf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 4,  sourceFbx: 'DungeonCrawler_Character4.fbx',  displayName: 'Ranger',         bodyType: 'slim_male',     availableRaces: ['Human', 'Elf', 'Barbarian', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 5,  sourceFbx: 'DungeonCrawler_Character5.fbx',  displayName: 'Berserker',      bodyType: 'heavy_male',    availableRaces: ['Human', 'Barbarian', 'Orc', 'Dwarf'], modelScale: 0.008, defaultSkinColor: '#a57850' },
  { modelIndex: 6,  sourceFbx: 'DungeonCrawler_Character6.fbx',  displayName: 'Huntress',       bodyType: 'slim_female',   availableRaces: ['Human', 'Elf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#e8d5b8' },
  { modelIndex: 7,  sourceFbx: 'DungeonCrawler_Character7.fbx',  displayName: 'Valkyrie',       bodyType: 'medium_female', availableRaces: ['Human', 'Barbarian', 'Elf', 'Orc', 'Dwarf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 8,  sourceFbx: 'DungeonCrawler_Character8.fbx',  displayName: 'Witch',          bodyType: 'medium_female', availableRaces: ['Human', 'Elf', 'Barbarian', 'Undead'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
  { modelIndex: 9,  sourceFbx: 'DungeonCrawler_Character9.fbx',  displayName: 'Brute',          bodyType: 'heavy_male',    availableRaces: ['Orc', 'Barbarian', 'Dwarf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#5a8a3a' },
  { modelIndex: 10, sourceFbx: 'DungeonCrawler_Character10.fbx', displayName: 'Shadow',         bodyType: 'slim_female',   availableRaces: ['Human', 'Elf', 'Undead'], modelScale: 0.008, defaultSkinColor: '#7a8a7a' },
  { modelIndex: 11, sourceFbx: 'DungeonCrawler_Character11.fbx', displayName: 'Shieldmaiden',   bodyType: 'heavy_female',  availableRaces: ['Human', 'Barbarian', 'Orc', 'Dwarf'], modelScale: 0.008, defaultSkinColor: '#c4956a' },
];

// ── Lookup Functions ───────────────────────────────────────────

/** Get all character defs compatible with a given race */
export function getCharacterDefsForRace(race: string): PlayerCharacterDef[] {
  return PLAYER_CHARACTER_DEFS.filter(d => d.availableRaces.includes(race));
}

/** Get a specific character def by model index */
export function getCharacterDef(modelIndex: number): PlayerCharacterDef | null {
  return PLAYER_CHARACTER_DEFS.find(d => d.modelIndex === modelIndex) ?? null;
}

/** Get character defs filtered by race and body type */
export function getCharacterDefsByBody(race: string, bodyType: BodyType): PlayerCharacterDef[] {
  return PLAYER_CHARACTER_DEFS.filter(d =>
    d.bodyType === bodyType && d.availableRaces.includes(race)
  );
}

/** Get compatible body types for a race */
export function getBodyTypesForRace(race: string): BodyType[] {
  return RACE_BODY_COMPAT[race] || ['medium_male'];
}

// ── Class → Body Type Affinity ───────────────────────────────

const CLASS_BODY_AFFINITY: Record<string, BodyType[]> = {
  Warrior: ['heavy_male', 'heavy_female', 'medium_male', 'medium_female'],
  Mage:    ['medium_male', 'medium_female', 'slim_male', 'slim_female'],
  Ranger:  ['slim_male', 'slim_female', 'medium_male', 'medium_female'],
  Worge:   ['medium_male', 'medium_female', 'slim_male', 'slim_female'],
};

/**
 * Find the best DungeonCrawler model for a race+class combo.
 * Matches by: 1) race compatibility, 2) class body-type affinity, 3) first available.
 */
export function findBestHeroModel(race: string, heroClass: string): number {
  const affinityBodies = CLASS_BODY_AFFINITY[heroClass] || ['medium_male'];

  // Priority 1: race-compatible + class body-type affinity match
  for (const body of affinityBodies) {
    const match = PLAYER_CHARACTER_DEFS.find(
      d => d.bodyType === body && d.availableRaces.includes(race)
    );
    if (match) return match.modelIndex;
  }

  // Priority 2: any race-compatible model
  const raceMatch = PLAYER_CHARACTER_DEFS.find(d => d.availableRaces.includes(race));
  if (raceMatch) return raceMatch.modelIndex;

  // Fallback: model 1 (medium_male Warrior — universal)
  return 1;
}

/** Create initial character state for a new player */
export function createPlayerCharacterState(
  accountId: string,
  grudgeId: string,
  modelIndex: number,
  race: string,
  heroClass: string,
  customName: string,
  weaponType?: string,
): PlayerCharacterState {
  const def = getCharacterDef(modelIndex);
  const { createMountState, getDefaultMountForRace } = require('./mount-system');
  const raceToon = RACE_TOON_RTS[race];
  const mountState = createMountState();
  mountState.equippedMountId = getDefaultMountForRace(race);

  return {
    accountId,
    grudgeId,
    modelIndex,
    bodyType: def?.bodyType || 'medium_male',
    customName,
    race,
    heroClass,
    faction: RACE_FACTIONS[race] || 'Crusade',
    level: 1,
    weaponType: weaponType || '',
    appearance: {},
    bearSpriteVariant: RACE_BEAR_VARIANT[race] || 'brown',
    modularConfig: {
      race,
      heroClass,
      skinColor: RACE_SKIN_COLORS[race] || '#c4956a',
      lowerStyle: 0,
      chestStyle: 0,
      faceStyle: 0,
      armStyle: 0,
    },
    mountState,
    useToonRtsModel: !!raceToon,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
}

// ── Weapon Model Paths (from Voxel RPG Characters pack) ────────

export const PLAYER_WEAPON_MODELS: Record<string, { fbx: string; displayName: string }> = {
  sword:      { fbx: 'Content/Weapons/Sword.fbx',      displayName: 'Sword' },
  sword_1:    { fbx: 'Content/Weapons/Sword_1.fbx',    displayName: 'Short Sword' },
  longsword:  { fbx: 'Content/Weapons/LongSword.fbx',  displayName: 'Long Sword' },
  longsword_1:{ fbx: 'Content/Weapons/LongSword_1.fbx',displayName: 'Greatsword' },
  longsword_2:{ fbx: 'Content/Weapons/LongSword_2.fbx',displayName: 'Claymore' },
  knife:      { fbx: 'Content/Weapons/Knife.fbx',      displayName: 'Dagger' },
  knife_1:    { fbx: 'Content/Weapons/Knife_1.fbx',    displayName: 'Stiletto' },
  spear:      { fbx: 'Content/Weapons/Spear.fbx',      displayName: 'Spear' },
  spear_1:    { fbx: 'Content/Weapons/Spear_1.fbx',    displayName: 'Halberd' },
  longbow:    { fbx: 'Content/Weapons/LongBow.fbx',    displayName: 'Long Bow' },
  bowrope:    { fbx: 'Content/Weapons/BowRope.fbx',    displayName: 'Bow' },
  shield:     { fbx: 'Content/Weapons/Shield.fbx',     displayName: 'Tower Shield' },
  shield_1:   { fbx: 'Content/Weapons/Shield_1.fbx',   displayName: 'Round Shield' },
  shield_2:   { fbx: 'Content/Weapons/Shield_2.fbx',   displayName: 'Kite Shield' },
  magiccane:  { fbx: 'Content/Weapons/MagicCane.fbx',  displayName: 'Magic Staff' },
  magiccane_1:{ fbx: 'Content/Weapons/MagicCane_1.fbx',displayName: 'Wand' },
  spellbook:  { fbx: 'Content/Weapons/SpellBook.fbx',  displayName: 'Spell Book' },
  arrow:      { fbx: 'Content/Weapons/Arrow.fbx',      displayName: 'Arrow' },
};

/** Map game weapon types to player weapon model keys */
export const WEAPON_TYPE_TO_PLAYER_MODEL: Record<string, string> = {
  swords: 'sword',
  daggers: 'knife',
  bows: 'longbow',
  crossbows: 'bowrope',
  spears: 'spear',
  hammers: 'longsword_1', // re-skin as hammer via palette
  greataxes: 'longsword_2',
  greatswords: 'longsword',
  scythes: 'spear_1',
  axes1h: 'sword_1',
  guns: 'magiccane_1', // re-skin via palette
  fireStaves: 'magiccane',
  frostStaves: 'magiccane',
  arcaneStaves: 'magiccane',
  natureStaves: 'magiccane',
  lightningStaves: 'magiccane',
  holyStaves: 'magiccane',
};

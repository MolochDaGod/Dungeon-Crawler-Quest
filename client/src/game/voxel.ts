import { getHeroWeapon, getWeaponRenderType, type WeaponType } from './types';
import {
  buildHeroRig, defaultRigPose, getRigPartRenderOrder, getPartRenderOffset,
  type HeroRig, type HeroRigPose, type PartId as RigPartId,
} from './voxel-parts';
import { type EquipmentAppearance, getEffectiveArmorColors, getEffectiveBootColor } from './voxel-equipment';
import {
  drawCastingCircle, drawWeaponTrail, drawAuraEffect,
  drawTransformVFX, drawHealingVFX, drawShieldVFX,
  drawSummonVFX, WeaponTrailSystem,
  sampleMotion, additivePoses, MOTION_LIBRARY,
  getClassMotionProfile, type FullPose, type BodyPartPose as MotionBodyPartPose,
  globalAnimDirector, drawAISlashVFX, drawAISpellVFX,
  type AttackPlan, type SpellVFXPlan
} from './voxel-motion';
import {
  getCachedParsedBody, getPartRenderOrder, PART_SCREEN_OFFSETS,
  type ParsedBody, type BodyPartName
} from './voxel-body-parser';

function vfxSeededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type VoxelModel = (string | null)[][][];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function blend(hex1: string, hex2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * 8-directional facing:
 *   0 = up, 1 = right, 2 = down, 3 = left
 *   4 = up-right, 5 = down-right, 6 = down-left, 7 = up-left
 */
function facingToDir(facing: number): number {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // 8 sectors of 45° each, starting from right (0 rad)
  const sector = Math.round(a / (Math.PI * 0.25)) % 8;
  //  sector 0 = right, 1 = down-right, 2 = down, 3 = down-left,
  //  4 = left, 5 = up-left, 6 = up, 7 = up-right
  const MAP = [1, 5, 2, 6, 3, 7, 0, 4];
  return MAP[sector];
}

/** For rendering: map 8-dir to the nearest cardinal (0-3) for the voxel model */
function dirToCardinal(dir: number): number {
  if (dir < 4) return dir;
  // Diagonals: 4=up-right→right(1), 5=down-right→right(1), 6=down-left→left(3), 7=up-left→left(3)
  return dir === 4 ? 1 : dir === 5 ? 1 : dir === 6 ? 3 : 3;
}

/** Skew angle for diagonal facing (slight body lean) */
function dirToSkew(dir: number): number {
  if (dir < 4) return 0; // cardinals: no skew
  // diagonals: slight lean toward the vertical component
  return dir === 4 ? -0.12 : dir === 5 ? 0.12 : dir === 6 ? 0.12 : -0.12;
}

function seededRandom(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const RACE_SKIN: Record<string, string> = {
  Human: '#c4956a',
  Barbarian: '#a57850',
  Dwarf: '#d4a574',
  Elf: '#e8d5b8',
  Orc: '#5a8a3a',
  Undead: '#7a8a7a'
};

const CLASS_ARMOR: Record<string, { primary: string; secondary: string; weapon: string }> = {
  Warrior: { primary: '#8b8b8b', secondary: '#c0c0c0', weapon: '#d4d4d4' },
  Worg: { primary: '#6b4423', secondary: '#8b6914', weapon: '#a0522d' },
  Mage: { primary: '#4a3080', secondary: '#6b46c1', weapon: '#9333ea' },
  Ranger: { primary: '#2d5016', secondary: '#4a7c23', weapon: '#854d0e' }
};

interface HeroCustomization {
  cape?: string;
  hat?: 'helm' | 'hood' | 'wizard' | 'crown' | 'horned' | 'skull' | 'feathered' | 'tribal' | 'miner' | 'captain';
  hatColor?: string;
  hatAccent?: string;
  shoulders?: string;
  belt?: string;
}

const HERO_CUSTOMIZATIONS: Record<string, HeroCustomization> = {
  // Humans
  'Sir Aldric Valorheart': { cape: '#cc2222', hat: 'helm', hatColor: '#999999', hatAccent: '#cccccc', shoulders: '#aaaaaa' },
  'Gareth Moonshadow': { cape: '#2a1a3e', hat: 'hood', hatColor: '#1a0e2e', shoulders: '#3a2a4e' },
  'Archmage Elara Brightspire': { cape: '#3050a0', hat: 'wizard', hatColor: '#4a3080', hatAccent: '#ffd700', belt: '#c5a059' },
  'Kael Shadowblade': { cape: '#1a3a12', hat: 'hood', hatColor: '#0e2808', belt: '#4a3010' },
  // Barbarians
  'Ulfgar Bonecrusher': { cape: '#5a3a1a', hat: 'horned', hatColor: '#666666', hatAccent: '#d4a574', shoulders: '#777777' },
  'Hrothgar Fangborn': { hat: 'skull', hatColor: '#d4a574', belt: '#aa2222' },
  'Volka Stormborn': { cape: '#1a2a5a', hat: 'wizard', hatColor: '#1a1a3e', hatAccent: '#4488cc', belt: '#3060a0' },
  'Svala Windrider': { cape: '#8899aa', hat: 'feathered', hatColor: '#667788', hatAccent: '#ffffff' },
  // Dwarves
  'Thane Ironshield': { cape: '#1a2a5a', hat: 'crown', hatColor: '#ffd700', hatAccent: '#ff4444', shoulders: '#c5a059' },
  'Bromm Earthshaker': { cape: '#4a3010', hat: 'horned', hatColor: '#555555', hatAccent: '#aa6633', shoulders: '#666666' },
  'Runa Forgekeeper': { cape: '#aa4400', hat: 'helm', hatColor: '#884422', hatAccent: '#ff6600', belt: '#ff8800' },
  'Durin Tunnelwatcher': { hat: 'miner', hatColor: '#c5a059', hatAccent: '#ffdd44', belt: '#6b4423' },
  // Elves
  'Thalion Bladedancer': { cape: '#eeeeee', hat: 'crown', hatColor: '#ffd700', hatAccent: '#22d3ee', shoulders: '#dddddd' },
  'Sylara Wildheart': { cape: '#2a5a1a', hat: 'crown', hatColor: '#44aa22', hatAccent: '#88dd44' },
  'Lyra Stormweaver': { cape: '#2266aa', hat: 'crown', hatColor: '#22d3ee', hatAccent: '#ffffff' },
  'Aelindra Swiftbow': { cape: '#2d5016', hat: 'feathered', hatColor: '#3a6a22', hatAccent: '#88cc44', belt: '#6b4423' },
  // Orcs
  'Grommash Ironjaw': { cape: '#8a1a1a', hat: 'horned', hatColor: '#444444', hatAccent: '#cc2222', shoulders: '#555555' },
  'Fenris Bloodfang': { cape: '#5a1111', hat: 'skull', hatColor: '#ccbb99', shoulders: '#3a2a1a' },
  "Zul'jin the Hexmaster": { hat: 'tribal', hatColor: '#cc4422', hatAccent: '#ffd700', belt: '#c5a059', shoulders: '#6b4423' },
  'Razak Deadeye': { shoulders: '#d4a574', belt: '#5a3a1a' },
  // Undead
  'Lord Malachar': { cape: '#1a1a2e', hat: 'helm', hatColor: '#333344', hatAccent: '#6644aa', shoulders: '#444466' },
  'The Ghoulfather': { cape: '#2a3a2a', hat: 'hood', hatColor: '#3a4a3a', belt: '#555555' },
  'Necromancer Vexis': { cape: '#3a1a4a', hat: 'wizard', hatColor: '#2a0a3a', hatAccent: '#aa44ff', belt: '#6644aa' },
  'Shade Whisper': { cape: '#2a3a4a', hat: 'hood', hatColor: '#3a4a5a' },
  // Pirates
  'Racalvin the Pirate King': { cape: '#c5a059' },
  'Cpt. John Wayne': { cape: '#3050a0', hat: 'captain', hatColor: '#1a1a3e', hatAccent: '#c5a059', shoulders: '#c5a059' },
};

export type TerrainType = 'grass' | 'dirt' | 'stone' | 'water' | 'lane' | 'jungle' | 'base_blue' | 'base_red' | 'river' | 'jungle_path';
export type DungeonTileVoxelType = 'floor' | 'wall' | 'wall_top' | 'door' | 'trap' | 'stairs' | 'chest';

const TERRAIN_PALETTES: Record<TerrainType, { base: string[]; accent: string[]; height: number }> = {
  grass:     { base: ['#2a5c1a', '#357025', '#2e6320', '#3a7a2d'], accent: ['#4a8a3a', '#286018'], height: 1 },
  dirt:      { base: ['#6b4423', '#7a5030', '#5e3b1a', '#8a6040'], accent: ['#4a3010', '#9a7050'], height: 1 },
  stone:     { base: ['#5a5a6a', '#666678', '#4e4e5e', '#72728a'], accent: ['#3a3a4a', '#8a8a9a'], height: 1 },
  water:     { base: ['#1a4a8a', '#2060a0', '#153d7a', '#2570b0'], accent: ['#3080c0', '#1040a0'], height: 0 },
  lane:      { base: ['#4a4030', '#564a38', '#3e3628', '#605040'], accent: ['#706050', '#2e2820'], height: 1 },
  jungle:    { base: ['#1a3a12', '#1e4216', '#163210', '#224a1a'], accent: ['#0e2808', '#2a5220'], height: 1 },
  base_blue: { base: ['#1a2a5a', '#203470', '#162450', '#283e80'], accent: ['#3050a0', '#101a40'], height: 2 },
  base_red:  { base: ['#5a1a1a', '#702020', '#501616', '#802828'], accent: ['#a03030', '#401010'], height: 2 },
  river:     { base: ['#1a5a7a', '#206a8a', '#154a6a', '#207a9a'], accent: ['#3090b0', '#104060'], height: 0 },
  jungle_path: { base: ['#3a3020', '#453828', '#2e2818', '#4a3e28'], accent: ['#5a4e38', '#252010'], height: 1 },
};

const DUNGEON_PALETTES: Record<DungeonTileVoxelType, { base: string[]; accent: string[] }> = {
  floor:    { base: ['#3a3a2e', '#353528', '#2e2e22', '#404032'], accent: ['#4a4a3a', '#2a2a1e'] },
  wall:     { base: ['#2a2a3e', '#252540', '#202038', '#303048'], accent: ['#1a1a2e', '#3a3a50'] },
  wall_top: { base: ['#353550', '#303048', '#3a3a58', '#282840'], accent: ['#404060', '#202038'] },
  door:     { base: ['#6b4423', '#7a5030', '#5e3b1a', '#8a6040'], accent: ['#c5a059', '#4a3010'] },
  trap:     { base: ['#4a2020', '#552828', '#3e1818', '#603030'], accent: ['#802020', '#f59e0b'] },
  stairs:   { base: ['#2a4a2a', '#305530', '#224022', '#386038'], accent: ['#ffd700', '#1a3a1a'] },
  chest:    { base: ['#a16207', '#8a5506', '#7a4a05', '#b87008'], accent: ['#ffd700', '#6b4006'] },
};

interface BodyPartPose {
  ox: number; oy: number; oz: number;
  rotation?: number;
  scale?: number;
}

function getAnimPoses(heroClass: string, animState: string, animTimer: number, weaponType?: WeaponType, globalTime?: number): {
  leftLeg: BodyPartPose; rightLeg: BodyPartPose;
  leftArm: BodyPartPose; rightArm: BodyPartPose;
  torso: BodyPartPose; head: BodyPartPose;
  weapon: BodyPartPose; weaponGlow: number;
} {
  // For cyclic animations (idle/walk), use monotonic globalTime so the cycle
  // never stutters when the FSM timer resets on transitions.
  const t = animTimer;           // FSM timer — resets on state entry (for timed animations)
  const gt = globalTime ?? t;   // global time — never resets (for cyclic animations)

  const idleBreath = Math.sin(gt * 1.5) * 0.7; // visible ±1 voxel breathing
  const idle = {
    leftLeg: { ox: 0, oy: 0, oz: 0 },
    rightLeg: { ox: 0, oy: 0, oz: 0 },
    leftArm: { ox: Math.round(Math.sin(gt * 1.5 + 0.3) * 0.4), oy: 0, oz: Math.round(idleBreath * 0.3) },
    rightArm: { ox: Math.round(-Math.sin(gt * 1.5 + 0.3) * 0.4), oy: 0, oz: Math.round(idleBreath * 0.3) },
    torso: { ox: 0, oy: 0, oz: Math.round(idleBreath) },
    head: { ox: 0, oy: 0, oz: Math.round(Math.sin(gt * 1.5 + 0.2) * 0.6) },
    weapon: { ox: 0, oy: 0, oz: Math.round(idleBreath * 0.5) },
    weaponGlow: 0
  };

  if (animState === 'idle') return idle;

  if (animState === 'walk') {
    const freq = 10;
    const phase = Math.sin(gt * freq);
    const phase2 = Math.cos(gt * freq);
    const stride = 2.5;
    const liftHeight = 1.4;
    const bounce = Math.abs(Math.sin(gt * freq * 2)) * 0.6;
    const hipSway = Math.sin(gt * freq) * 0.4;
    const headBob = Math.sin(gt * freq * 2 + 0.5) * 0.35;
    return {
      leftLeg: { ox: 0, oy: Math.round(phase * stride), oz: Math.round(Math.max(0, -phase) * liftHeight) },
      rightLeg: { ox: 0, oy: Math.round(-phase * stride), oz: Math.round(Math.max(0, phase) * liftHeight) },
      leftArm: { ox: 0, oy: Math.round(-phase * 2.0), oz: Math.round(Math.abs(phase2) * 0.5) },
      rightArm: { ox: 0, oy: Math.round(phase * 2.0), oz: Math.round(Math.abs(-phase2) * 0.5) },
      torso: { ox: 0, oy: 0, oz: Math.round(bounce) },
      head: { ox: 0, oy: 0, oz: Math.round(bounce * 0.7 + headBob) },
      weapon: { ox: 0, oy: Math.round(-phase * 0.5), oz: Math.round(bounce * 0.3) },
      weaponGlow: 0
    };
  }

  if (animState === 'attack') {
    const atkProgress = Math.min(1, t / 0.65);

    if (weaponType === 'heavy_axe' && (heroClass === 'Warrior' || heroClass === 'Worg')) {
      const windUp = atkProgress < 0.4 ? atkProgress / 0.4 : 0;
      const chop = atkProgress >= 0.4 && atkProgress < 0.65 ? (atkProgress - 0.4) / 0.25 : 0;
      const followThru = atkProgress >= 0.65 ? (atkProgress - 0.65) / 0.35 : 0;
      const raisedArm = Math.round(windUp * 6.0);
      const slamDown = Math.round(chop * 8.0);
      const bodyDip = Math.round(chop * 2.5);
      return {
        leftLeg: { ox: 0, oy: Math.round(chop * 2.0 - followThru * 0.5), oz: Math.round(chop * 1.0) },
        rightLeg: { ox: 0, oy: Math.round(-chop * 1.0 + windUp * 0.5), oz: 0 },
        leftArm: { ox: Math.round(chop * 3.0 - windUp * 1.0), oy: Math.round(-chop * 2.0), oz: Math.round(raisedArm - slamDown + followThru * 1.0) },
        rightArm: { ox: Math.round(-windUp * 1.5 + followThru * 0.5), oy: Math.round(windUp * 0.8), oz: Math.round(windUp * 3.0 - chop * 1.5) },
        torso: { ox: Math.round(chop * 1.5 - followThru * 0.5), oy: 0, oz: Math.round(-bodyDip + followThru * 1.0) },
        head: { ox: Math.round(chop * 1.0 - windUp * 0.3), oy: 0, oz: Math.round(-bodyDip * 0.5 + windUp * 1.0) },
        weapon: { ox: Math.round(chop * 4.0 - windUp * 1.5), oy: Math.round(-chop * 3.0 + windUp * 0.5), oz: Math.round(raisedArm * 1.2 - slamDown * 1.5 + followThru * 0.5) },
        weaponGlow: chop > 0.2 ? 1.0 : windUp > 0.6 ? 0.6 : followThru > 0 ? 0.3 : 0
      };
    }

    if (weaponType === 'spear' && (heroClass === 'Warrior' || heroClass === 'Worg')) {
      const draw = atkProgress < 0.3 ? atkProgress / 0.3 : 0;
      const thrust = atkProgress >= 0.3 && atkProgress < 0.55 ? (atkProgress - 0.3) / 0.25 : 0;
      const retract = atkProgress >= 0.55 ? (atkProgress - 0.55) / 0.45 : 0;
      const pullBack = Math.round(draw * 3.0);
      const pushFwd = Math.round(thrust * 7.0);
      return {
        leftLeg: { ox: 0, oy: Math.round(thrust * 3.5 - retract * 1.5), oz: Math.round(thrust * 0.5) },
        rightLeg: { ox: 0, oy: Math.round(-thrust * 1.5 + draw * 1.0), oz: 0 },
        leftArm: { ox: Math.round(-pullBack + pushFwd - retract * 2.0), oy: Math.round(-thrust * 1.5), oz: Math.round(thrust * 2.0 + draw * 1.0) },
        rightArm: { ox: Math.round(-draw * 1.0 + retract * 0.5), oy: Math.round(draw * 0.5), oz: Math.round(draw * 1.5) },
        torso: { ox: Math.round(-pullBack * 0.4 + pushFwd * 0.5 - retract * 0.3), oy: Math.round(thrust * 0.5), oz: Math.round(-thrust * 0.3) },
        head: { ox: Math.round(thrust * 1.5 - draw * 0.5), oy: Math.round(thrust * 0.3), oz: 0 },
        weapon: { ox: Math.round(-pullBack * 1.5 + pushFwd * 1.5 - retract * 3.0), oy: Math.round(-thrust * 2.0), oz: Math.round(thrust * 3.0 + draw * 2.0 - retract * 1.0) },
        weaponGlow: thrust > 0.15 ? 1.0 : draw > 0.5 ? 0.4 : retract > 0 ? 0.2 : 0
      };
    }

    if (weaponType === 'war_hammer' && (heroClass === 'Warrior' || heroClass === 'Worg')) {
      const windUp = atkProgress < 0.45 ? atkProgress / 0.45 : 0;
      const slam = atkProgress >= 0.45 && atkProgress < 0.65 ? (atkProgress - 0.45) / 0.2 : 0;
      const followThru = atkProgress >= 0.65 ? (atkProgress - 0.65) / 0.35 : 0;
      const raise = Math.round(windUp * 7.0);
      const smash = Math.round(slam * 10.0);
      const bodySquat = Math.round(slam * 3.0);
      return {
        leftLeg: { ox: 0, oy: Math.round(slam * 1.5 - slam * 0.5), oz: Math.round(slam * 1.5) },
        rightLeg: { ox: 0, oy: Math.round(-slam * 1.5 + slam * 0.5), oz: Math.round(slam * 1.5) },
        leftArm: { ox: Math.round(slam * 2.0), oy: Math.round(-slam * 2.5), oz: Math.round(raise - smash + followThru * 2.0) },
        rightArm: { ox: Math.round(slam * 1.5), oy: Math.round(-slam * 1.5), oz: Math.round(raise * 0.8 - smash * 0.6 + followThru * 1.0) },
        torso: { ox: Math.round(slam * 0.5), oy: 0, oz: Math.round(-bodySquat + followThru * 1.5) },
        head: { ox: Math.round(slam * 0.5 - windUp * 0.3), oy: 0, oz: Math.round(-bodySquat * 0.6 + windUp * 1.5) },
        weapon: { ox: Math.round(slam * 3.0), oy: Math.round(-slam * 4.0 + windUp * 0.5), oz: Math.round(raise * 1.5 - smash * 2.0 + followThru * 1.0) },
        weaponGlow: slam > 0.1 ? 1.0 : windUp > 0.6 ? 0.5 : followThru > 0 ? 0.4 : 0
      };
    }

    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      // Weapon-leading melee slash: weapon moves first, body follows
      const windUp = atkProgress < 0.3 ? atkProgress / 0.3 : 0;
      const swing = atkProgress >= 0.3 && atkProgress < 0.6 ? (atkProgress - 0.3) / 0.3 : 0;
      const followThru = atkProgress >= 0.6 ? (atkProgress - 0.6) / 0.4 : 0;
      const easeSwing = swing > 0 ? Math.sin(swing * Math.PI * 0.5) : 0;
      // Weapon rotation leads more aggressively
      const weaponRot = Math.max(-120, Math.min(10, windUp * 20 - easeSwing * 130 + followThru * 40));
      // Forward lunge: body lurches into the swing
      const lungeFwd = easeSwing * 3.5 - followThru * 1.5;
      return {
        leftLeg: { ox: Math.round(lungeFwd * 0.5), oy: Math.round(easeSwing * 2 - followThru * 0.8), oz: Math.round(easeSwing * 0.8) },
        rightLeg: { ox: Math.round(-lungeFwd * 0.3), oy: Math.round(-easeSwing * 1.2 + windUp * 0.6), oz: 0 },
        leftArm: { ox: Math.round(-windUp * 2 + easeSwing * 5 - followThru * 1.5), oy: Math.round(-easeSwing * 1.5), oz: Math.round(windUp * 1.5 + easeSwing * 3) },
        rightArm: { ox: Math.round(-windUp * 0.8 + followThru * 0.5), oy: 0, oz: Math.round(windUp * 1.5 + easeSwing * 0.8) },
        torso: { ox: Math.round(lungeFwd), oy: 0, oz: Math.round(-easeSwing * 0.3), rotation: -windUp * 15 + easeSwing * 22 - followThru * 8 },
        head: { ox: Math.round(lungeFwd * 0.6 + easeSwing * 0.5), oy: 0, oz: 0 },
        weapon: {
          ox: Math.round(-windUp * 2 + easeSwing * 7 - followThru * 3),
          oy: Math.round(-easeSwing * 3 + followThru * 1.5),
          oz: Math.round(windUp * 6 - easeSwing * 4 + followThru * 1.5),
          rotation: weaponRot
        },
        weaponGlow: swing > 0.1 ? 1.0 : windUp > 0.4 ? 0.6 : followThru > 0 ? 0.35 : 0
      };
    }
    if (heroClass === 'Ranger') {
      const draw = atkProgress < 0.45 ? atkProgress / 0.45 : 1;
      const hold = atkProgress >= 0.4 && atkProgress < 0.55 ? 1 : 0;
      const release = atkProgress >= 0.55 ? Math.min(1, (atkProgress - 0.55) / 0.15) : 0;
      const recoil = atkProgress >= 0.7 ? (atkProgress - 0.7) / 0.3 : 0;
      const stringTension = draw * (1 - release);
      return {
        leftLeg: { ox: 0, oy: Math.round(-draw * 1.0), oz: 0 },
        rightLeg: { ox: 0, oy: Math.round(draw * 1.2 - recoil * 0.5), oz: 0 },
        leftArm: { ox: Math.round(draw * 3.5 - release * 0.5 - recoil * 1.0), oy: Math.round(-draw * 0.8), oz: Math.round(draw * 3.0) },
        rightArm: { ox: Math.round(-draw * 3.0 + release * 5.0 - recoil * 2.0), oy: Math.round(draw * 0.3), oz: Math.round(draw * 2.0 + release * 1.0 - recoil * 0.5) },
        torso: { ox: Math.round(-draw * 0.8 + release * 0.5), oy: Math.round(-draw * 0.5 + release * 0.3), oz: Math.round(release * -0.3) },
        head: { ox: Math.round(draw * 0.5 + release * 1.0 - recoil * 0.5), oy: Math.round(-draw * 0.3), oz: 0 },
        weapon: { ox: Math.round(draw * 3.0 - release * 0.5), oy: Math.round(-draw * 0.5), oz: Math.round(draw * 4.0 - release * 0.5) },
        weaponGlow: release > 0.2 ? 1.0 : stringTension > 0.6 ? 0.7 : draw > 0.3 ? 0.3 : 0
      };
    }
    if (heroClass === 'Mage') {
      const raise = atkProgress < 0.4 ? atkProgress / 0.4 : 1;
      const channel = atkProgress >= 0.25 && atkProgress < 0.55 ? Math.min(1, (atkProgress - 0.25) / 0.3) : 0;
      const cast = atkProgress >= 0.5 ? Math.min(1, (atkProgress - 0.5) / 0.15) : 0;
      const recover = atkProgress >= 0.75 ? (atkProgress - 0.75) / 0.25 : 0;
      const glow = Math.max(channel * 0.8, cast);
      const orbPulse = Math.sin(t * 20) * 0.3;
      return {
        leftLeg: { ox: 0, oy: Math.round(-cast * 0.8 + recover * 0.3), oz: 0 },
        rightLeg: { ox: 0, oy: Math.round(cast * 0.8 - recover * 0.4), oz: 0 },
        leftArm: { ox: Math.round(cast * 4.5 - recover * 1.5), oy: Math.round(-raise * 1.5 + orbPulse), oz: Math.round(raise * 5.5 + cast * 1.0 - recover * 3) },
        rightArm: { ox: Math.round(cast * 3.0 - recover * 0.8), oy: Math.round(raise * 1.0 - orbPulse), oz: Math.round(raise * 4.5 + channel * 1.0 - recover * 2) },
        torso: { ox: Math.round(cast * 0.5), oy: 0, oz: Math.round(raise * 1.0 + channel * 0.5 - recover * 0.8) },
        head: { ox: Math.round(cast * 0.5), oy: 0, oz: Math.round(raise * 1.2 + channel * 0.5 - recover * 0.8) },
        weapon: { ox: Math.round(cast * 3 - recover * 1), oy: Math.round(-cast * 1 + orbPulse * 0.5), oz: Math.round(raise * 5 - cast * 3 - recover * 1), rotation: Math.max(-90, Math.min(0, raise * 10 - cast * 70 + recover * 30)) },
        weaponGlow: glow > 0.1 ? Math.min(1, glow + orbPulse * 0.2) : 0
      };
    }
    return idle;
  }

  if (animState === 'ability') {
    const pulse = (Math.sin(t * 8) + 1) * 0.5;
    const burst = Math.max(0, Math.sin(t * 8 + 1.5));
    const channel = Math.min(1, t * 4);
    const basePose = {
      leftLeg: { ox: 0, oy: Math.round(-burst * 0.8), oz: 0 },
      rightLeg: { ox: 0, oy: Math.round(burst * 0.8), oz: 0 },
      leftArm: { ox: Math.round(burst * 2.5), oy: Math.round(-pulse * 1.5), oz: Math.round(pulse * 4 + channel * 2) },
      rightArm: { ox: Math.round(burst * 2.5), oy: Math.round(pulse * 1.5), oz: Math.round(pulse * 4 + channel * 2) },
      torso: { ox: 0, oy: 0, oz: Math.round(pulse * 0.7 + channel * 0.5) },
      head: { ox: 0, oy: 0, oz: Math.round(pulse * 0.8 + channel * 0.5) },
      weapon: { ox: Math.round(burst * 2), oy: 0, oz: Math.round(channel * 4 - burst * 2), rotation: Math.max(-90, Math.min(0, channel * 10 - burst * 60)) },
      weaponGlow: Math.max(pulse, channel * 0.6) * 0.95
    };
    const profile = weaponType ? getClassMotionProfile(heroClass, weaponType) : null;
    if (profile) {
      const motionKey = profile.abilityMotion;
      const motion = MOTION_LIBRARY[motionKey];
      if (motion) {
        const motionPose = sampleMotion(motion, t * profile.attackSpeed);
        return additivePoses(basePose, motionPose, 0.35 * profile.swingWeight) as typeof basePose;
      }
    }
    return basePose;
  }

  if (animState === 'dodge') {
    const dur = 0.35;
    const p = Math.min(1, t / dur);
    const variant = (heroClass.charCodeAt(0) + (weaponType || '').length) % 3;

    if (variant === 0) {
      const flipAngle = p * 360;
      const arc = Math.sin(p * Math.PI);
      const tuck = p < 0.5 ? p * 2 : (1 - p) * 2;
      return {
        leftLeg: { ox: 0, oy: Math.round(-tuck * 1), oz: Math.round(arc * 2) },
        rightLeg: { ox: 0, oy: Math.round(tuck * 1), oz: Math.round(arc * 2) },
        leftArm: { ox: Math.round(-tuck * 1), oy: 0, oz: Math.round(tuck * 1) },
        rightArm: { ox: Math.round(tuck * 1), oy: 0, oz: Math.round(tuck * 1) },
        torso: { ox: 0, oy: Math.round(-arc * 2), oz: Math.round(arc * 3), rotation: flipAngle },
        head: { ox: 0, oy: Math.round(-arc * 1), oz: Math.round(arc * 2) },
        weapon: { ox: 0, oy: 0, oz: Math.round(arc * 1) },
        weaponGlow: 0
      };
    } else if (variant === 1) {
      const spinAngle = p * 360;
      const crouch = Math.sin(p * Math.PI) * 0.5;
      return {
        leftLeg: { ox: 0, oy: Math.round(-crouch * 1), oz: Math.round(-crouch * 1) },
        rightLeg: { ox: 0, oy: Math.round(crouch * 1), oz: Math.round(-crouch * 1) },
        leftArm: { ox: Math.round(-crouch * 1), oy: Math.round(-crouch * 1), oz: 0 },
        rightArm: { ox: Math.round(crouch * 1), oy: Math.round(crouch * 1), oz: 0 },
        torso: { ox: 0, oy: 0, oz: Math.round(-crouch * 2), rotation: spinAngle },
        head: { ox: 0, oy: 0, oz: Math.round(-crouch * 1) },
        weapon: { ox: 0, oy: 0, oz: 0 },
        weaponGlow: 0
      };
    } else {
      const spinAngle = -p * 360;
      const crouch = Math.sin(p * Math.PI) * 0.5;
      return {
        leftLeg: { ox: 0, oy: Math.round(crouch * 1), oz: Math.round(-crouch * 1) },
        rightLeg: { ox: 0, oy: Math.round(-crouch * 1), oz: Math.round(-crouch * 1) },
        leftArm: { ox: Math.round(crouch * 1), oy: Math.round(crouch * 1), oz: 0 },
        rightArm: { ox: Math.round(-crouch * 1), oy: Math.round(-crouch * 1), oz: 0 },
        torso: { ox: 0, oy: 0, oz: Math.round(-crouch * 2), rotation: spinAngle },
        head: { ox: 0, oy: 0, oz: Math.round(-crouch * 1) },
        weapon: { ox: 0, oy: 0, oz: 0 },
        weaponGlow: 0
      };
    }
  }

  if (animState === 'lunge_slash') {
    const progress = Math.min(1, t / 0.4);
    const lunge = progress < 0.4 ? progress / 0.4 : 1;
    const slash = progress >= 0.35 && progress < 0.6 ? (progress - 0.35) / 0.25 : 0;
    const recover = progress >= 0.6 ? (progress - 0.6) / 0.4 : 0;
    const lungeFwd = lunge * (1 - recover * 0.5);
    const slashArc = Math.sin(slash * Math.PI);
    const basePose = {
      leftLeg: { ox: 0, oy: Math.round(lungeFwd * 4 - recover * 2), oz: Math.round(Math.max(0, slash - 0.5) * 2) },
      rightLeg: { ox: 0, oy: Math.round(-lungeFwd * 2 + recover), oz: 0 },
      leftArm: { ox: Math.round(lungeFwd * 5 + slashArc * 3 - recover * 3), oy: Math.round(-slashArc * 4), oz: Math.round(lungeFwd * 3 + slashArc * 5 - recover * 4) },
      rightArm: { ox: Math.round(lungeFwd * 2 - recover), oy: Math.round(slashArc * 1.5), oz: Math.round(lungeFwd * 2 + slashArc * 2 - recover * 2) },
      torso: { ox: Math.round(lungeFwd * 3.5 - recover * 1.5), oy: Math.round(slashArc * 0.8), oz: Math.round(-slashArc * 0.5 + lungeFwd * 0.5) },
      head: { ox: Math.round(lungeFwd * 2.5 + slashArc * 0.5 - recover), oy: Math.round(slashArc * 0.5), oz: Math.round(lungeFwd * 0.5 - slashArc * 0.3) },
      weapon: { ox: Math.round(lungeFwd * 4 + slashArc * 3 - recover * 2), oy: Math.round(-slashArc * 3 + recover * 1), oz: Math.round(lungeFwd * 4 - slashArc * 3 + recover * 1), rotation: Math.max(-90, Math.min(0, lungeFwd * 5 - slashArc * 90 + recover * 30)) },
      weaponGlow: slash > 0.1 ? 1.0 : lungeFwd > 0.7 ? 0.6 : recover > 0 ? 0.3 : 0
    };
    const swingMotion = MOTION_LIBRARY['swing_horizontal'];
    if (swingMotion) {
      const motionPose = sampleMotion(swingMotion, t * 1.2);
      return additivePoses(basePose, motionPose, 0.2) as typeof basePose;
    }
    return basePose;
  }

  if (animState === 'dash_attack') {
    const thrust = Math.min(1, t * 6);
    const extend = Math.sin(thrust * Math.PI);
    return {
      leftLeg: { ox: 0, oy: Math.round(-extend * 2), oz: 0 },
      rightLeg: { ox: 0, oy: Math.round(extend * 2), oz: 0 },
      leftArm: { ox: Math.round(extend * 3), oy: Math.round(-extend), oz: Math.round(extend * 2) },
      rightArm: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend) },
      torso: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend * 0.5) },
      head: { ox: Math.round(extend * 1.5), oy: 0, oz: Math.round(extend * 0.5) },
      weapon: { ox: Math.round(extend * 3), oy: Math.round(-extend * 1.5), oz: Math.round(4 - extend * 3), rotation: Math.max(-90, Math.min(0, -extend * 90)) },
      weaponGlow: extend > 0.5 ? extend : 0
    };
  }

  if (animState === 'combo_finisher') {
    const dur = 0.7;
    const p = Math.min(1, t / dur);
    const wind = p < 0.25 ? p / 0.25 : 0;
    const strike = p >= 0.25 && p < 0.55 ? (p - 0.25) / 0.3 : 0;
    const follow = p >= 0.55 ? (p - 0.55) / 0.45 : 0;
    const recover = p >= 0.7 ? (p - 0.7) / 0.3 : 0;
    const easeStrike = strike > 0 ? Math.sin(strike * Math.PI * 0.5) : 0;
    const easeFollow = follow > 0 ? Math.sin(follow * Math.PI * 0.5) : 0;
    const easeRecover = recover > 0 ? recover * recover : 0;
    const weaponRot = Math.max(-90, Math.min(0, wind * 15 - easeStrike * 105 + easeFollow * 20 + easeRecover * 30));

    const basePose = {
      leftLeg: { ox: 0, oy: Math.round(wind * 1 - easeStrike * 1.5 + easeRecover * 0.5), oz: 0 },
      rightLeg: { ox: 0, oy: Math.round(-wind * 0.5 + easeStrike * 0.5), oz: Math.round(easeStrike * 0.5) },
      leftArm: {
        ox: Math.round(-wind * 1 + easeStrike * 3 - easeRecover * 1.5),
        oy: Math.round(-easeStrike * 1),
        oz: Math.round(wind * 1 + easeStrike * 2 - easeFollow * 1 - easeRecover * 1)
      },
      rightArm: {
        ox: Math.round(-wind * 0.5 + easeStrike * 0.5),
        oy: 0,
        oz: Math.round(wind * 0.5 + easeStrike * 0.5 - easeRecover * 0.5)
      },
      torso: {
        ox: Math.round(-wind * 0.5 + easeStrike * 1.5 - easeRecover * 0.5),
        oy: 0,
        oz: 0,
        rotation: -wind * 12 + easeStrike * 20 - easeFollow * 8 - easeRecover * 10
      },
      head: {
        ox: Math.round(easeStrike * 0.5 - easeRecover * 0.5),
        oy: 0,
        oz: 0
      },
      weapon: {
        ox: Math.round(-wind * 1 + easeStrike * 4 - easeRecover * 2),
        oy: Math.round(-easeStrike * 2 + easeRecover * 1),
        oz: Math.round(wind * 5 - easeStrike * 4 + easeRecover * 1),
        rotation: weaponRot
      },
      weaponGlow: easeStrike > 0.3 ? Math.min(1, easeStrike * 1.5) : wind > 0.5 ? 0.4 : easeRecover > 0 ? 0.2 : 0
    };
    const profile = weaponType ? getClassMotionProfile(heroClass, weaponType) : null;
    if (profile) {
      const motion = MOTION_LIBRARY[profile.attackMotion];
      if (motion) {
        const motionPose = sampleMotion(motion, (t * 1.2) % motion.duration);
        return additivePoses(basePose, motionPose, 0.12 * profile.recoilScale) as typeof basePose;
      }
    }
    return basePose;
  }

  if (animState === 'block') {
    const brace = Math.min(1, t * 8);
    const breathe = Math.sin(t * 3) * 0.3 * brace;
    return {
      leftLeg: { ox: 0, oy: Math.round(-brace * 1.5), oz: Math.round(brace * 0.5) },
      rightLeg: { ox: 0, oy: Math.round(brace * 1.5), oz: 0 },
      leftArm: { ox: Math.round(brace * 3), oy: Math.round(-brace * 1), oz: Math.round(brace * 2 + breathe) },
      rightArm: { ox: Math.round(brace * 2), oy: Math.round(brace * 0.5), oz: Math.round(brace * 1.5 + breathe) },
      torso: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(-brace * 0.5), rotation: -brace * 5 },
      head: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(-brace * 0.3) },
      weapon: { ox: Math.round(brace * 4), oy: Math.round(-brace * 1), oz: Math.round(brace * 2 + breathe * 0.5), rotation: Math.max(-90, -brace * 90) },
      weaponGlow: brace * 0.4
    };
  }

  if (animState === 'death') {
    const fall = Math.min(1, t * 2);
    return {
      leftLeg: { ox: Math.round(fall * -2), oy: Math.round(fall * 3), oz: Math.round(-fall * 6) },
      rightLeg: { ox: Math.round(fall * 2), oy: Math.round(fall * 2), oz: Math.round(-fall * 5) },
      leftArm: { ox: Math.round(fall * -4), oy: Math.round(-fall * 3), oz: Math.round(-fall * 4), rotation: fall * 45 },
      rightArm: { ox: Math.round(fall * 4), oy: Math.round(fall * 2), oz: Math.round(-fall * 3), rotation: -fall * 30 },
      torso: { ox: Math.round(fall * 1), oy: Math.round(fall * 1), oz: Math.round(-fall * 7), rotation: fall * 25 },
      head: { ox: Math.round(fall * 2), oy: Math.round(-fall * 1), oz: Math.round(-fall * 8), rotation: fall * 40 },
      weapon: { ox: Math.round(fall * 5), oy: Math.round(-fall * 4), oz: Math.round(-fall * 6), rotation: -fall * 120 },
      weaponGlow: 0
    };
  }

  return idle;
}

function buildBearModel(animState: string, animTimer: number): VoxelModel {
  const fur = '#5a3a1a';
  const darkFur = '#3a2a12';
  const lightFur = '#7a5a3a';
  const midFur = '#6b4a2a';
  const nose = '#222222';
  const eye = '#111111';
  const eyeGlow = '#ff6600';
  const claw = '#ccccaa';
  const fang = '#eeeecc';
  const pawPad = '#444433';

  // Enlarged bear grid for 1.5x voxel model
  const W = 12, D = 12, H = 16;
  const model: VoxelModel = [];
  for (let z = 0; z < H; z++) {
    model[z] = [];
    for (let y = 0; y < D; y++) {
      model[z][y] = [];
      for (let x = 0; x < W; x++) model[z][y][x] = null;
    }
  }

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) model[z][y][x] = c;
  };

  const t = animTimer;
  const walkPhase = animState === 'walk' ? Math.sin(t * 7) : 0;
  const walkPhase2 = animState === 'walk' ? Math.cos(t * 7) : 0;
  const atkProgress = animState === 'attack' || animState === 'combo_finisher' ? Math.min(1, t / 0.6) : 0;
  const rearUp = atkProgress < 0.4 ? atkProgress / 0.4 : atkProgress < 0.6 ? 1 : 1 - (atkProgress - 0.6) / 0.4;
  const swipe = atkProgress >= 0.35 && atkProgress < 0.6 ? (atkProgress - 0.35) / 0.25 : 0;
  const bodyBob = animState === 'walk' ? Math.abs(Math.sin(t * 14)) * 0.5 : 0;
  // Idle breathing
  const idleBreathe = animState === 'idle' ? Math.sin(t * 1.8) * 0.3 : 0;

  const fLegOy = Math.round(walkPhase * 1.5);
  const bLegOy = Math.round(-walkPhase * 1.5);
  const fLegOz = Math.round(Math.max(0, -walkPhase) * 0.8);
  const bLegOz = Math.round(Math.max(0, walkPhase) * 0.8);
  const weightShift = Math.round(walkPhase2 * 0.6);
  const bodyRear = Math.round(rearUp * 2 + idleBreathe);

  // ── Back legs (thicker)
  for (let y = 3; y <= 7; y++) {
    setV(0 + fLegOz, y + fLegOy, 2, darkFur);
    setV(1 + fLegOz, y + fLegOy, 2, fur);
    setV(0 + fLegOz, y + fLegOy, 9, darkFur);
    setV(1 + fLegOz, y + fLegOy, 9, fur);
    setV(0 + fLegOz, y + fLegOy, 3, darkFur);
    setV(1 + fLegOz, y + fLegOy, 8, darkFur);
    // Extra thickness
    setV(2 + fLegOz, y + fLegOy, 2, midFur);
    setV(2 + fLegOz, y + fLegOy, 9, midFur);
  }
  setV(0, 3 + fLegOy, 2, claw); setV(0, 3 + fLegOy, 3, claw);
  setV(0, 3 + fLegOy, 9, claw); setV(0, 3 + fLegOy, 8, claw);
  setV(0, 4, 2, pawPad); setV(0, 4, 9, pawPad);

  // ── Front legs — LONG arms that reach to the ground
  const armLow = Math.round(rearUp * 3); // arms drop lower during attack
  for (let y = 3; y <= 7; y++) {
    setV(0 + bLegOz, y + bLegOy, 4, darkFur);
    setV(1 + bLegOz, y + bLegOy, 4, fur);
    setV(2 + bLegOz, y + bLegOy, 4, fur);
    setV(0 + bLegOz, y + bLegOy, 7, darkFur);
    setV(1 + bLegOz, y + bLegOy, 7, fur);
    setV(2 + bLegOz, y + bLegOy, 7, fur);
    // Ground-reaching front arm extension (3 thick)
    setV(0 + bLegOz, y + bLegOy, 3, midFur);
    setV(0 + bLegOz, y + bLegOy, 8, midFur);
    setV(1 + bLegOz, y + bLegOy, 3, darkFur);
    setV(1 + bLegOz, y + bLegOy, 8, darkFur);
  }
  // Front paw claws (big)
  setV(0, 3 + bLegOy, 3, claw); setV(0, 3 + bLegOy, 4, claw); setV(0, 2 + bLegOy, 4, claw);
  setV(0, 3 + bLegOy, 7, claw); setV(0, 3 + bLegOy, 8, claw); setV(0, 2 + bLegOy, 7, claw);
  setV(0, 4, 4, pawPad); setV(0, 4, 7, pawPad);

  // ── Massive body (wider + taller)
  const bodyZ = bodyRear + Math.round(bodyBob);
  for (let x = 2; x <= 9; x++) {
    for (let y = 3; y <= 8; y++) {
      const isEdge = x === 2 || x === 9 || y === 3 || y === 8;
      setV(2 + bodyZ, y + weightShift, x, isEdge ? darkFur : fur);
      setV(3 + bodyZ, y + weightShift, x, isEdge ? fur : midFur);
      setV(4 + bodyZ, y + weightShift, x, isEdge ? darkFur : fur);
      setV(5 + bodyZ, y + weightShift, x, isEdge ? fur : midFur);
    }
  }

  // Extra top body layer
  for (let x = 3; x <= 8; x++) {
    for (let y = 3; y <= 8; y++) {
      setV(6 + bodyZ, y + weightShift, x, fur);
    }
  }

  // Belly markings
  for (let x = 3; x <= 8; x++) {
    setV(3 + bodyZ, 5 + weightShift, x, lightFur);
    setV(3 + bodyZ, 6 + weightShift, x, lightFur);
    setV(4 + bodyZ, 5 + weightShift, x, lightFur);
    setV(4 + bodyZ, 6 + weightShift, x, lightFur);
  }

  // Back ridge
  for (let x = 2; x <= 9; x++) {
    setV(6 + bodyZ, 4 + weightShift, x, darkFur);
    setV(6 + bodyZ, 7 + weightShift, x, darkFur);
  }

  // ── Huge shoulder hump
  const shoulderOz = bodyZ + Math.round(rearUp * 1);
  for (let y = 3; y <= 8; y++) {
    setV(6 + shoulderOz, y + weightShift, 2, midFur);
    setV(6 + shoulderOz, y + weightShift, 9, midFur);
    setV(7 + shoulderOz, y + weightShift, 3, darkFur);
    setV(7 + shoulderOz, y + weightShift, 8, darkFur);
  }
  // Hump mass
  for (let x = 4; x <= 7; x++) {
    setV(7 + shoulderOz, 5 + weightShift, x, midFur);
    setV(7 + shoulderOz, 6 + weightShift, x, midFur);
  }

  // ── Head (large, set forward)
  const headOz = bodyZ + Math.round(rearUp * 2.5);
  const headOx = Math.round(swipe * 2);
  for (let x = 3; x <= 8; x++) {
    for (let y = 2; y <= 6; y++) {
      const isTop = y === 2 || x === 3 || x === 8;
      setV(7 + headOz, y + headOx, x, isTop ? darkFur : fur);
      setV(8 + headOz, y + headOx, x, isTop ? fur : midFur);
      setV(9 + headOz, y + headOx, x, darkFur);
    }
  }
  // Snout
  for (let x = 4; x <= 7; x++) {
    setV(10 + headOz, 3 + headOx, x, fur);
    setV(10 + headOz, 4 + headOx, x, fur);
  }
  for (let x = 5; x <= 6; x++) {
    setV(11 + headOz, 3 + headOx, x, darkFur);
    setV(11 + headOz, 4 + headOx, x, darkFur);
  }

  // Eyes (glowing orange)
  setV(9 + headOz, 2 + headOx, 4, eye);
  setV(9 + headOz, 2 + headOx, 7, eye);
  setV(10 + headOz, 2 + headOx, 4, eyeGlow);
  setV(10 + headOz, 2 + headOx, 7, eyeGlow);

  // Nose + mouth
  setV(8 + headOz, 2 + headOx, 5, nose);
  setV(8 + headOz, 2 + headOx, 6, nose);
  setV(7 + headOz, 2 + headOx, 5, '#994444');
  setV(7 + headOz, 2 + headOx, 6, '#994444');

  // Large fangs
  setV(7 + headOz, 2 + headOx, 4, fang);
  setV(7 + headOz, 2 + headOx, 7, fang);
  setV(6 + headOz, 2 + headOx, 4, fang);
  setV(6 + headOz, 2 + headOx, 7, fang);

  // Ears
  setV(10 + headOz, 4 + headOx, 3, fur);
  setV(10 + headOz, 4 + headOx, 8, fur);
  setV(11 + headOz, 4 + headOx, 3, darkFur);
  setV(11 + headOz, 4 + headOx, 8, darkFur);
  setV(11 + headOz, 3 + headOx, 3, darkFur);
  setV(11 + headOz, 3 + headOx, 8, darkFur);

  // ── Attack claw swipe VFX
  if (swipe > 0.1) {
    const clawExtend = Math.round(swipe * 4);
    for (let ci = 0; ci < 4; ci++) {
      setV(4 + bodyZ, 2 - clawExtend + ci, 0, claw);
      setV(4 + bodyZ, 2 - clawExtend + ci, 11, claw);
      setV(5 + bodyZ, 2 - clawExtend + ci, 1, claw);
      setV(5 + bodyZ, 2 - clawExtend + ci, 10, claw);
    }
    // Claw glow on swing
    setV(3 + bodyZ, 1, 0, '#ff4400');
    setV(3 + bodyZ, 1, 11, '#ff4400');
    setV(4 + bodyZ, 1, 0, '#ff6600');
    setV(4 + bodyZ, 1, 11, '#ff6600');
  }

  // ── Reared-up extended arms
  if (rearUp > 0.5) {
    for (let y = 3; y <= 8; y++) {
      setV(3 + bodyZ, y + weightShift, 0, darkFur);
      setV(4 + bodyZ, y + weightShift, 0, fur);
      setV(5 + bodyZ, y + weightShift, 0, midFur);
      setV(3 + bodyZ, y + weightShift, 11, darkFur);
      setV(4 + bodyZ, y + weightShift, 11, fur);
      setV(5 + bodyZ, y + weightShift, 11, midFur);
    }
    // Shoulder mass when reared
    for (let y = 4; y <= 7; y++) {
      setV(6 + bodyZ, y + weightShift, 1, fur);
      setV(6 + bodyZ, y + weightShift, 10, fur);
    }
  }

  return model;
}

function buildRapierWeapon(wP: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number) {
  const blade = '#d4d4d4';
  const guard = '#c5a059';
  const handle = '#6b4423';
  const pommel = '#dc2626';

  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, pommel);

  setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);

  setV(5 + wP.oz, 0 + wP.oy, 0 + wP.ox, guard);
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, guard);
  setV(5 + wP.oz, 2 + wP.oy, 0 + wP.ox, guard);

  for (let z = 6; z <= 12; z++) {
    const bladeColor = weaponGlow > 0 ? blend(blade, '#ffffff', weaponGlow * 0.4) : blade;
    setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, bladeColor);
  }

  if (weaponGlow > 0) {
    setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend(blade, '#ffffff', weaponGlow));
  }
}

function buildAxeWeapon(wP: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  const handle = '#5a3a1a';
  const handleDark = '#3a2812';
  const axeHead = '#8a8a8a';
  const axeEdge = '#c0c0c0';

  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, handleDark);
  setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);

  const headColor = weaponGlow > 0 ? blend(axeHead, '#ff4400', weaponGlow * 0.5) : axeHead;
  const edgeColor = weaponGlow > 0 ? blend(axeEdge, '#ffffff', weaponGlow * 0.6) : axeEdge;
  setV(8 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(9 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(10 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(8 + wP.oz, 0 + wP.oy, 0 + wP.ox, edgeColor);
  setV(9 + wP.oz, 0 + wP.oy, 0 + wP.ox, edgeColor);
  setV(10 + wP.oz, 0 + wP.oy, 0 + wP.ox, edgeColor);
  setV(11 + wP.oz, 0 + wP.oy, 0 + wP.ox, weaponGlow > 0 ? blend(edgeColor, '#ffffff', weaponGlow) : shade(edgeColor, 1.2));
  setV(9 + wP.oz, 2 + wP.oy, 0 + wP.ox, headColor);
}

function buildSpearWeapon(wP: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  const shaft = '#6b4423';
  const shaftLight = '#8a5a33';
  const spearHead = '#c0c0c0';

  setV(1 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(shaft, 0.7));
  for (let z = 2; z <= 9; z++) {
    setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, z % 3 === 0 ? shaftLight : shaft);
  }

  const tipColor = weaponGlow > 0 ? blend(spearHead, '#ffffff', weaponGlow * 0.6) : spearHead;
  setV(10 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(spearHead, 0.8));
  setV(11 + wP.oz, 1 + wP.oy, 0 + wP.ox, tipColor);
  setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, weaponGlow > 0 ? blend('#ffffff', spearHead, 0.3) : shade(spearHead, 1.3));
  setV(10 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(spearHead, 0.7));
  setV(10 + wP.oz, 2 + wP.oy, 0 + wP.ox, shade(spearHead, 0.7));
}

function buildHammerWeapon(wP: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  const handle = '#5a3a1a';
  const handleWrap = '#8a6914';
  const hammerHead = '#777777';
  const hammerFace = '#999999';

  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(handle, 0.7));
  setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, handleWrap);
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, handleWrap);

  const headColor = weaponGlow > 0 ? blend(hammerHead, '#ffd700', weaponGlow * 0.5) : hammerHead;
  const faceColor = weaponGlow > 0 ? blend(hammerFace, '#ffffff', weaponGlow * 0.6) : hammerFace;
  setV(8 + wP.oz, 0 + wP.oy, 0 + wP.ox, headColor);
  setV(8 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(8 + wP.oz, 2 + wP.oy, 0 + wP.ox, headColor);
  setV(9 + wP.oz, 0 + wP.oy, 0 + wP.ox, faceColor);
  setV(9 + wP.oz, 1 + wP.oy, 0 + wP.ox, faceColor);
  setV(9 + wP.oz, 2 + wP.oy, 0 + wP.ox, faceColor);
  setV(10 + wP.oz, 0 + wP.oy, 0 + wP.ox, headColor);
  setV(10 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(10 + wP.oz, 2 + wP.oy, 0 + wP.ox, headColor);
  if (weaponGlow > 0) {
    setV(11 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend(faceColor, '#ffffff', weaponGlow));
  }
}

function buildSwordShieldWeapon(wP: BodyPartPose, rA: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#c5a059');
  for (let z = 3; z <= 4; z++) {
    setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, '#8a6914');
  }
  setV(5 + wP.oz, 0 + wP.oy, 0 + wP.ox, '#999999');
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#999999');
  setV(5 + wP.oz, 2 + wP.oy, 0 + wP.ox, '#999999');
  for (let z = 6; z <= 11; z++) {
    const bladeShade = z > 9 ? 1.3 : z > 7 ? 1.1 : 1.0;
    const bladeColor = weaponGlow > 0 ? blend(armorWeapon, '#ffffff', weaponGlow * (z - 5) * 0.1) : shade(armorWeapon, bladeShade);
    setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, bladeColor);
  }
  setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, weaponGlow > 0 ? blend('#ffffff', armorWeapon, 0.3) : shade(armorWeapon, 1.4));

  setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
  setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
  setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#aaaaaa');
  setV(4 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#888888');
  setV(3 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#888888');
  setV(3 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#777777');
}

function buildGreatswordWeapon(wP: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#c5a059');
  setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#5a3a1a');
  setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#5a3a1a');
  setV(5 + wP.oz, 0 + wP.oy, 0 + wP.ox, '#999999');
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#888888');
  setV(5 + wP.oz, 2 + wP.oy, 0 + wP.ox, '#999999');
  for (let z = 6; z <= 13; z++) {
    const bladeShade = z > 11 ? 1.3 : z > 8 ? 1.1 : 1.0;
    const bladeColor = weaponGlow > 0 ? blend(armorWeapon, '#ffffff', weaponGlow * (z - 5) * 0.08) : shade(armorWeapon, bladeShade);
    setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, bladeColor);
  }
  if (weaponGlow > 0) {
    setV(13 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend('#ffffff', armorWeapon, weaponGlow * 0.5));
  }
}

function buildAxeShieldWeapon(wP: BodyPartPose, rA: BodyPartPose, setV: (z: number, y: number, x: number, c: string) => void, weaponGlow: number, armorWeapon: string) {
  const handle = '#5a3a1a';
  const axeHead = '#8a8a8a';
  setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(handle, 0.7));
  setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, handle);
  const headColor = weaponGlow > 0 ? blend(axeHead, '#ff4400', weaponGlow * 0.4) : axeHead;
  setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(8 + wP.oz, 1 + wP.oy, 0 + wP.ox, headColor);
  setV(6 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(axeHead, 1.2));
  setV(7 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(axeHead, 1.3));
  setV(8 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(axeHead, 1.2));

  setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
  setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
  setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#888888');
  setV(4 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#888888');
  setV(3 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#777777');
}

function buildHeroModel(race: string, heroClass: string, animState: string, animTimer: number, heroName?: string, heroItems?: ({ id: number } | null)[], equipAppearance?: EquipmentAppearance | null, globalTime?: number): VoxelModel {
  const isPirate = heroName?.includes('Racalvin') || heroName?.includes('Pirate King');
  const skin = RACE_SKIN[race] || '#c4956a';
  const classArmorBase = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  // Equipment appearance overrides class defaults when gear is equipped
  const armor = equipAppearance ? getEffectiveArmorColors(classArmorBase, equipAppearance) : classArmorBase;
  const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
  const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';
  const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));

  const W = 8, D = 8, H = 16;
  const model: VoxelModel = [];
  for (let z = 0; z < H; z++) {
    model[z] = [];
    for (let y = 0; y < D; y++) {
      model[z][y] = [];
      for (let x = 0; x < W; x++) model[z][y][x] = null;
    }
  }

  const poses = getAnimPoses(heroClass, animState, animTimer, weaponType, globalTime);

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) {
      if (poses.weaponGlow > 0 && animState === 'ability') {
        c = blend(c, '#ffd700', poses.weaponGlow * 0.25);
      }
      model[z][y][x] = c;
    }
  };

  // Athletic proportions: legs +1 voxel, torso +1 voxel → everything shifts up
  const bootColor = equipAppearance ? getEffectiveBootColor(shade(armor.primary, 0.7), equipAppearance) : shade(armor.primary, 0.7);
  const bootAccent = shade(armor.primary, 0.85);
  const lL = poses.leftLeg, rL = poses.rightLeg;
  // Left leg: 3 voxels tall (was 2)
  setV(0 + lL.oz, 2 + lL.oy, 2 + lL.ox, bootColor);
  setV(0 + lL.oz, 3 + lL.oy, 2 + lL.ox, bootColor);
  setV(0 + lL.oz, 2 + lL.oy, 3 + lL.ox, bootAccent);
  setV(1 + lL.oz, 2 + lL.oy, 2 + lL.ox, armor.secondary);
  setV(1 + lL.oz, 3 + lL.oy, 2 + lL.ox, armor.secondary);
  setV(2 + lL.oz, 2 + lL.oy, 2 + lL.ox, armor.primary);
  setV(2 + lL.oz, 3 + lL.oy, 2 + lL.ox, armor.primary);
  // Right leg: 3 voxels tall (was 2)
  setV(0 + rL.oz, 2 + rL.oy, 5 + rL.ox, bootColor);
  setV(0 + rL.oz, 3 + rL.oy, 5 + rL.ox, bootColor);
  setV(0 + rL.oz, 2 + rL.oy, 4 + rL.ox, bootAccent);
  setV(1 + rL.oz, 2 + rL.oy, 5 + rL.ox, armor.secondary);
  setV(1 + rL.oz, 3 + rL.oy, 5 + rL.ox, armor.secondary);
  setV(2 + rL.oz, 2 + rL.oy, 5 + rL.ox, armor.primary);
  setV(2 + rL.oz, 3 + rL.oy, 5 + rL.ox, armor.primary);

  // Torso shifted up by +1, extra row for taller build
  const tP = poses.torso;
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 4; y++) {
      setV(3 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(4 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(5 + tP.oz, y + tP.oy, x + tP.ox, armor.secondary);
      setV(6 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(7 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
    }
  }
  for (let y = 2; y <= 4; y++) {
    setV(4 + tP.oz, y + tP.oy, 1 + tP.ox, shade(armor.primary, 0.9));
    setV(4 + tP.oz, y + tP.oy, 6 + tP.ox, shade(armor.primary, 0.9));
  }
  setV(5 + tP.oz, 3 + tP.oy, 3 + tP.ox, shade(armor.secondary, 1.1));
  setV(5 + tP.oz, 3 + tP.oy, 4 + tP.ox, shade(armor.secondary, 1.1));

  if (heroClass === 'Warrior') {
    setV(7 + tP.oz, 2 + tP.oy, 2 + tP.ox, '#666666');
    setV(7 + tP.oz, 4 + tP.oy, 2 + tP.ox, '#666666');
    setV(7 + tP.oz, 2 + tP.oy, 5 + tP.ox, '#666666');
    setV(7 + tP.oz, 4 + tP.oy, 5 + tP.ox, '#666666');
    for (let x = 2; x <= 5; x++) {
      setV(6 + tP.oz, 2 + tP.oy, x + tP.ox, '#555555');
    }
    setV(7 + tP.oz, 3 + tP.oy, 1 + tP.ox, shade(armor.secondary, 0.8));
    setV(7 + tP.oz, 3 + tP.oy, 6 + tP.ox, shade(armor.secondary, 0.8));
    setV(7 + tP.oz, 2 + tP.oy, 1 + tP.ox, shade(armor.secondary, 0.7));
    setV(7 + tP.oz, 2 + tP.oy, 6 + tP.ox, shade(armor.secondary, 0.7));
  }

  if (heroClass === 'Mage') {
    for (let y = 2; y <= 4; y++) {
      setV(3 + tP.oz, y + tP.oy, 2 + tP.ox, armor.secondary);
      setV(3 + tP.oz, y + tP.oy, 5 + tP.ox, armor.secondary);
    }
  }

  if (heroClass === 'Ranger') {
    setV(4 + tP.oz, 2 + tP.oy, 2 + tP.ox, '#2d4016');
    setV(4 + tP.oz, 2 + tP.oy, 5 + tP.ox, '#2d4016');
  }

  // Arms shifted up +1, extended 1 voxel longer
  const lA = poses.leftArm;
  setV(7 + lA.oz, 2 + lA.oy, 1 + lA.ox, shade(armor.secondary, 0.9));
  setV(6 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(5 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(4 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(4 + lA.oz, 3 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(3 + lA.oz, 2 + lA.oy, 1 + lA.ox, skin);
  setV(3 + lA.oz, 3 + lA.oy, 1 + lA.ox, skin);

  const rA = poses.rightArm;
  setV(7 + rA.oz, 2 + rA.oy, 6 + rA.ox, shade(armor.secondary, 0.9));
  setV(6 + rA.oz, 2 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(5 + rA.oz, 2 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(4 + rA.oz, 2 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(3 + rA.oz, 2 + rA.oy, 6 + rA.ox, skin);
  setV(3 + rA.oz, 3 + rA.oy, 6 + rA.ox, skin);

  // Head shifted up +2
  const hP = poses.head;
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 4; y++) {
      setV(8 + hP.oz, y + hP.oy, x + hP.ox, skin);
      setV(9 + hP.oz, y + hP.oy, x + hP.ox, skin);
      setV(10 + hP.oz, y + hP.oy, x + hP.ox, skin);
    }
  }

  setV(9 + hP.oz, 2 + hP.oy, 2 + hP.ox, eye);
  setV(9 + hP.oz, 2 + hP.oy, 5 + hP.ox, eye);

  setV(8 + hP.oz, 2 + hP.oy, 3 + hP.ox, shade(skin, 0.85));
  setV(8 + hP.oz, 2 + hP.oy, 4 + hP.ox, shade(skin, 0.85));

  for (let x = 2; x <= 5; x++) {
    setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hair);
    setV(11 + hP.oz, 4 + hP.oy, x + hP.ox, hair);
    setV(10 + hP.oz, 4 + hP.oy, x + hP.ox, hair);
  }
  setV(11 + hP.oz, 2 + hP.oy, 2 + hP.ox, hair);
  setV(11 + hP.oz, 2 + hP.oy, 5 + hP.ox, hair);

  if (race === 'Dwarf') {
    setV(8 + hP.oz, 2 + hP.oy, 2 + hP.ox, hair);
    setV(8 + hP.oz, 2 + hP.oy, 5 + hP.ox, hair);
    setV(7 + hP.oz, 2 + hP.oy, 3 + hP.ox, hair);
    setV(7 + hP.oz, 2 + hP.oy, 4 + hP.ox, hair);
    setV(7 + hP.oz, 3 + hP.oy, 3 + hP.ox, hair);
  }
  if (race === 'Elf') {
    setV(10 + hP.oz, 1 + hP.oy, 2 + hP.ox, skin);
    setV(10 + hP.oz, 1 + hP.oy, 5 + hP.ox, skin);
    setV(11 + hP.oz, 1 + hP.oy, 2 + hP.ox, skin);
    setV(11 + hP.oz, 1 + hP.oy, 5 + hP.ox, skin);
  }
  if (race === 'Orc') {
    setV(9 + hP.oz, 3 + hP.oy, 1 + hP.ox, skin);
    setV(9 + hP.oz, 3 + hP.oy, 6 + hP.ox, skin);
    setV(8 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#445522');
    setV(8 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#445522');
  }
  if (race === 'Undead') {
    setV(9 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#555555');
    setV(9 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#555555');
    setV(10 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#3a3a3a');
  }
  if (race === 'Barbarian' && !isPirate) {
    setV(12 + hP.oz, 3 + hP.oy, 3 + hP.ox, hair);
    setV(12 + hP.oz, 3 + hP.oy, 4 + hP.ox, hair);
    setV(11 + hP.oz, 3 + hP.oy, 2 + hP.ox, hair);
    setV(11 + hP.oz, 3 + hP.oy, 5 + hP.ox, hair);
  }

  if (isPirate) {
    const hatColor = '#1a1a2e';
    const hatBrim = '#222244';
    const hatBand = '#c5a059';
    for (let x = 1; x <= 6; x++) {
      setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hatBrim);
      setV(11 + hP.oz, 2 + hP.oy, x + hP.ox, hatBrim);
    }
    for (let x = 2; x <= 5; x++) {
      setV(12 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
      setV(12 + hP.oz, 2 + hP.oy, x + hP.ox, hatColor);
      setV(13 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
    }
    for (let x = 3; x <= 4; x++) {
      setV(14 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
    }
    setV(12 + hP.oz, 2 + hP.oy, 2 + hP.ox, hatBand);
    setV(12 + hP.oz, 2 + hP.oy, 3 + hP.ox, hatBand);
    setV(12 + hP.oz, 2 + hP.oy, 4 + hP.ox, hatBand);
    setV(12 + hP.oz, 2 + hP.oy, 5 + hP.ox, hatBand);

    const beardColor = '#2a1a0a';
    setV(8 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(8 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
    setV(7 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(7 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
    setV(7 + hP.oz, 3 + hP.oy, 3 + hP.ox, beardColor);
    setV(7 + hP.oz, 3 + hP.oy, 4 + hP.ox, beardColor);
    setV(6 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(6 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
  }

  const wP = poses.weapon;
  const hasRapier = heroItems?.some(item => item && item.id === 12) ?? false;

  if (hasRapier) {
    buildRapierWeapon(wP, setV, poses.weaponGlow);
  } else if (heroClass === 'Warrior') {
    if (weaponType === 'heavy_axe') {
      buildAxeWeapon(wP, setV, poses.weaponGlow, armor.weapon);
    } else if (weaponType === 'spear') {
      buildSpearWeapon(wP, setV, poses.weaponGlow, armor.weapon);
    } else if (weaponType === 'war_hammer') {
      buildHammerWeapon(wP, setV, poses.weaponGlow, armor.weapon);
    } else if (weaponType === 'greatsword') {
      buildGreatswordWeapon(wP, setV, poses.weaponGlow, armor.weapon);
    } else if (weaponType === 'axe_shield') {
      buildAxeShieldWeapon(wP, rA, setV, poses.weaponGlow, armor.weapon);
    } else {
      buildSwordShieldWeapon(wP, rA, setV, poses.weaponGlow, armor.weapon);
    }

    if (weaponType === 'sword_shield' || weaponType === 'axe_shield') {
      setV(12 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#888888');
      setV(12 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#888888');
      setV(12 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#888888');
      setV(12 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#888888');
    }
  }

  if (!hasRapier && heroClass === 'Worg') {
    setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#3a2a12');
    setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#5a3a1a');
    for (let z = 4; z <= 8; z++) {
      const clawColor = poses.weaponGlow > 0 ? blend(armor.weapon, '#ff4400', poses.weaponGlow * 0.5) : armor.weapon;
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, clawColor);
    }
    setV(9 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(armor.weapon, 0.7));
    setV(8 + wP.oz, 0 + wP.oy, 0 + wP.ox, armor.weapon);
    setV(7 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(armor.weapon, 0.8));
    if (poses.weaponGlow > 0) {
      setV(9 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ff4400', poses.weaponGlow));
    }
  }

  if (!hasRapier && heroClass === 'Ranger' && isPirate) {
    const gunMetal = '#555555';
    const gunWood = '#5a3a1a';
    setV(4 + wP.oz, 1 + wP.oy, 0 + wP.ox, gunWood);
    setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, gunWood);
    setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, gunMetal);
    setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, gunMetal);
    setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, gunMetal);
    setV(7 + wP.oz, 0 + wP.oy, 0 + wP.ox, '#333333');
    setV(8 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#333333');
    setV(5 + wP.oz, 0 + wP.oy, 0 + wP.ox, '#c5a059');
    if (poses.weaponGlow > 0) {
      setV(8 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend('#ff6600', '#ffff00', poses.weaponGlow));
      setV(9 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend('#ff4400', '#ffff00', poses.weaponGlow * 0.5));
    }
  } else if (!hasRapier && heroClass === 'Ranger') {
    for (let z = 2; z <= 10; z++) {
      const bowColor = (z === 2 || z === 10) ? shade('#6b4423', 0.8) : '#6b4423';
      setV(z + wP.oz, 0 + wP.oy, 0 + wP.ox, bowColor);
    }
    setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#555555');
    setV(10 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#555555');
    setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#999999');
    setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#888888');
    setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#888888');

    setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#6b4423');
    setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#6b4423');
    setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#2d5016');
    setV(4 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#2d5016');

    if (poses.weaponGlow > 0) {
      setV(6 + wP.oz, 0 + wP.oy, -1 + wP.ox, blend('#22c55e', '#ffff00', poses.weaponGlow));
      setV(6 + wP.oz, 0 + wP.oy, 1 + wP.ox, blend('#22c55e', '#ffff00', poses.weaponGlow * 0.5));
    }
  }

  if (!hasRapier && heroClass === 'Mage') {
    setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#3a2215');
    for (let z = 3; z <= 11; z++) {
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, '#553322');
    }
    setV(12 + wP.oz, 0 + wP.oy, 0 + wP.ox, shade(armor.weapon, 0.8));
    setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, armor.weapon);
    setV(12 + wP.oz, 2 + wP.oy, 0 + wP.ox, shade(armor.weapon, 0.8));
    setV(13 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(armor.weapon, 1.4));
    if (poses.weaponGlow > 0) {
      const orbColor = blend(armor.weapon, '#ffffff', poses.weaponGlow);
      setV(13 + wP.oz, 1 + wP.oy, 0 + wP.ox, orbColor);
      setV(13 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.6));
      setV(13 + wP.oz, 2 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.6));
      setV(12 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.4));
      setV(12 + wP.oz, 2 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.4));
    }

    setV(12 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.secondary);
    setV(12 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.secondary);
    setV(13 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.weapon);
    setV(13 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.weapon);
  }

  // Per-hero visual customizations
  const custom = heroName ? HERO_CUSTOMIZATIONS[heroName] : undefined;
  if (custom) {
    // Cape (behind character at y=5)
    if (custom.cape) {
      for (let z = 3; z <= 7; z++) {
        setV(z + tP.oz, 5 + tP.oy, 3 + tP.ox, z === 7 ? shade(custom.cape, 1.15) : custom.cape);
        setV(z + tP.oz, 5 + tP.oy, 4 + tP.ox, z === 7 ? shade(custom.cape, 1.15) : custom.cape);
      }
      setV(7 + tP.oz, 5 + tP.oy, 2 + tP.ox, custom.cape);
      setV(7 + tP.oz, 5 + tP.oy, 5 + tP.ox, custom.cape);
    }

    // Shoulder pads
    if (custom.shoulders) {
      setV(7 + tP.oz, 2 + tP.oy, 0 + tP.ox, custom.shoulders);
      setV(7 + tP.oz, 3 + tP.oy, 0 + tP.ox, shade(custom.shoulders, 0.85));
      setV(7 + tP.oz, 2 + tP.oy, 7 + tP.ox, custom.shoulders);
      setV(7 + tP.oz, 3 + tP.oy, 7 + tP.ox, shade(custom.shoulders, 0.85));
    }

    // Belt / sash
    if (custom.belt) {
      for (let x = 2; x <= 5; x++) setV(3 + tP.oz, 2 + tP.oy, x + tP.ox, custom.belt);
    }

    // Hat (skip for heroes that already have pirate hat)
    if (custom.hat && !isPirate) {
      const hc = custom.hatColor || '#888888';
      const ha = custom.hatAccent || shade(hc, 1.3);

      if (custom.hat === 'helm') {
        for (let x = 2; x <= 5; x++) {
          setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
          setV(11 + hP.oz, 2 + hP.oy, x + hP.ox, hc);
        }
        setV(12 + hP.oz, 3 + hP.oy, 3 + hP.ox, ha);
        setV(12 + hP.oz, 3 + hP.oy, 4 + hP.ox, ha);
      } else if (custom.hat === 'hood') {
        for (let x = 2; x <= 5; x++) {
          setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
          setV(11 + hP.oz, 4 + hP.oy, x + hP.ox, hc);
        }
        setV(10 + hP.oz, 4 + hP.oy, 3 + hP.ox, hc);
        setV(10 + hP.oz, 4 + hP.oy, 4 + hP.ox, hc);
        setV(10 + hP.oz, 5 + hP.oy, 3 + hP.ox, hc);
        setV(10 + hP.oz, 5 + hP.oy, 4 + hP.ox, hc);
      } else if (custom.hat === 'wizard') {
        for (let x = 1; x <= 6; x++) setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
        for (let x = 2; x <= 5; x++) setV(12 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
        setV(13 + hP.oz, 3 + hP.oy, 3 + hP.ox, hc);
        setV(13 + hP.oz, 3 + hP.oy, 4 + hP.ox, hc);
        setV(14 + hP.oz, 3 + hP.oy, 3 + hP.ox, ha);
      } else if (custom.hat === 'crown') {
        setV(11 + hP.oz, 2 + hP.oy, 2 + hP.ox, hc);
        setV(11 + hP.oz, 2 + hP.oy, 5 + hP.ox, hc);
        setV(11 + hP.oz, 2 + hP.oy, 3 + hP.ox, ha);
        setV(11 + hP.oz, 2 + hP.oy, 4 + hP.ox, ha);
        setV(11 + hP.oz, 3 + hP.oy, 2 + hP.ox, hc);
        setV(11 + hP.oz, 3 + hP.oy, 5 + hP.ox, hc);
      } else if (custom.hat === 'horned') {
        for (let x = 2; x <= 5; x++) setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
        setV(12 + hP.oz, 2 + hP.oy, 1 + hP.ox, ha);
        setV(13 + hP.oz, 2 + hP.oy, 1 + hP.ox, ha);
        setV(12 + hP.oz, 2 + hP.oy, 6 + hP.ox, ha);
        setV(13 + hP.oz, 2 + hP.oy, 6 + hP.ox, ha);
      } else if (custom.hat === 'skull') {
        for (let x = 2; x <= 5; x++) {
          setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
          setV(11 + hP.oz, 2 + hP.oy, x + hP.ox, hc);
        }
        setV(11 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#111111');
        setV(11 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#111111');
      } else if (custom.hat === 'feathered') {
        for (let x = 2; x <= 5; x++) setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
        setV(12 + hP.oz, 3 + hP.oy, 5 + hP.ox, ha);
        setV(13 + hP.oz, 3 + hP.oy, 5 + hP.ox, ha);
      } else if (custom.hat === 'tribal') {
        setV(11 + hP.oz, 2 + hP.oy, 2 + hP.ox, hc);
        setV(11 + hP.oz, 2 + hP.oy, 5 + hP.ox, hc);
        setV(12 + hP.oz, 2 + hP.oy, 3 + hP.ox, ha);
        setV(12 + hP.oz, 2 + hP.oy, 4 + hP.ox, ha);
        setV(12 + hP.oz, 3 + hP.oy, 3 + hP.ox, hc);
        setV(12 + hP.oz, 3 + hP.oy, 4 + hP.ox, hc);
      } else if (custom.hat === 'miner') {
        for (let x = 2; x <= 5; x++) {
          setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
          setV(11 + hP.oz, 2 + hP.oy, x + hP.ox, hc);
        }
        setV(12 + hP.oz, 2 + hP.oy, 3 + hP.ox, ha);
      } else if (custom.hat === 'captain') {
        for (let x = 1; x <= 6; x++) setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hc);
        for (let x = 2; x <= 5; x++) setV(11 + hP.oz, 2 + hP.oy, x + hP.ox, hc);
        for (let x = 2; x <= 5; x++) setV(12 + hP.oz, 3 + hP.oy, x + hP.ox, shade(hc, 0.8));
        setV(12 + hP.oz, 2 + hP.oy, 3 + hP.ox, ha);
        setV(12 + hP.oz, 2 + hP.oy, 4 + hP.ox, ha);
      }
    }
  }

  return model;
}

export function buildHeroModelWithPoses(race: string, heroClass: string, customPoses: {
  leftLeg: BodyPartPose; rightLeg: BodyPartPose;
  leftArm: BodyPartPose; rightArm: BodyPartPose;
  torso: BodyPartPose; head: BodyPartPose;
  weapon: BodyPartPose; weaponGlow: number;
}, heroName?: string): VoxelModel {
  const isPirate = heroName?.includes('Racalvin') || heroName?.includes('Pirate King');
  const skin = RACE_SKIN[race] || '#c4956a';
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
  const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';
  const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));

  const W = 8, D = 8, H = 14;
  const model: VoxelModel = [];
  for (let z = 0; z < H; z++) {
    model[z] = [];
    for (let y = 0; y < D; y++) {
      model[z][y] = [];
      for (let x = 0; x < W; x++) model[z][y][x] = null;
    }
  }

  const poses = customPoses;

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) {
      model[z][y][x] = c;
    }
  };

  const setWV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) {
      if (poses.weaponGlow > 0) {
        c = blend(c, '#ffd700', poses.weaponGlow * 0.4);
      }
      model[z][y][x] = c;
    }
  };

  const bootColor = shade(armor.primary, 0.7);
  const lL = poses.leftLeg, rL = poses.rightLeg;
  const lA = poses.leftArm, rA = poses.rightArm;
  const tP = poses.torso, hP = poses.head;
  const wP = poses.weapon;
  const weaponGlow = poses.weaponGlow;

  const xformV = (baseZ: number, baseY: number, baseX: number, part: BodyPartPose, cx: number, cy: number, cz: number, color: string, useWV?: boolean) => {
    let dz = baseZ - cz, dy = baseY - cy, dx = baseX - cx;
    const sc = part.scale ?? 1;
    if (sc !== 1) { dz *= sc; dy *= sc; dx *= sc; }
    const rot = part.rotation ?? 0;
    if (rot !== 0) {
      const rad = rot * Math.PI / 180;
      const cosR = Math.cos(rad), sinR = Math.sin(rad);
      const newDx = dx * cosR - dz * sinR;
      const newDz = dx * sinR + dz * cosR;
      dx = newDx; dz = newDz;
    }
    const fz = Math.round(cz + dz + part.oz);
    const fy = Math.round(cy + dy + part.oy);
    const fx = Math.round(cx + dx + part.ox);
    if (useWV) setWV(fz, fy, fx, color); else setV(fz, fy, fx, color);
  };

  xformV(0, 2, 2, lL, 2, 2.5, 0.5, bootColor);
  xformV(0, 3, 2, lL, 2, 2.5, 0.5, bootColor);
  xformV(1, 2, 2, lL, 2, 2.5, 0.5, armor.primary);
  xformV(0, 2, 5, rL, 5, 2.5, 0.5, bootColor);
  xformV(0, 3, 5, rL, 5, 2.5, 0.5, bootColor);
  xformV(1, 2, 5, rL, 5, 2.5, 0.5, armor.primary);

  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 4; y++) xformV(2, y, x, tP, 3.5, 3, 3.5, armor.primary);
  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 4; y++) {
    xformV(3, y, x, tP, 3.5, 3, 3.5, armor.primary);
    xformV(4, y, x, tP, 3.5, 3, 3.5, armor.primary);
    xformV(5, y, x, tP, 3.5, 3, 3.5, armor.secondary);
  }

  xformV(3, 3, 1, lA, 1, 3, 4, armor.primary);
  xformV(4, 3, 1, lA, 1, 3, 4, armor.secondary);
  xformV(5, 3, 1, lA, 1, 3, 4, skin);
  xformV(3, 3, 6, rA, 6, 3, 4, armor.primary);
  xformV(4, 3, 6, rA, 6, 3, 4, armor.secondary);
  xformV(5, 3, 6, rA, 6, 3, 4, skin);

  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 4; y++) xformV(6, y, x, hP, 3.5, 3, 6.5, skin);
  xformV(7, 2, 3, hP, 3.5, 3, 6.5, skin);
  xformV(7, 2, 4, hP, 3.5, 3, 6.5, skin);
  xformV(7, 3, 3, hP, 3.5, 3, 6.5, hair);
  xformV(7, 3, 4, hP, 3.5, 3, 6.5, hair);
  xformV(7, 4, 3, hP, 3.5, 3, 6.5, hair);
  xformV(7, 4, 4, hP, 3.5, 3, 6.5, hair);
  xformV(6, 2, 3, hP, 3.5, 3, 6.5, eye);
  xformV(6, 2, 4, hP, 3.5, 3, 6.5, eye);

  const wCx = 0, wCy = 1, wCz = 5;
  if (weaponType === 'sword_shield') {
    xformV(2, 1, 0, wP, wCx, wCy, wCz, '#c5a059', true);
    for (let z = 3; z <= 8; z++) xformV(z, 1, 0, wP, wCx, wCy, wCz, '#c0c0c0', true);
  } else if (weaponType === 'staff') {
    for (let z = 1; z <= 9; z++) xformV(z, 1, 0, wP, wCx, wCy, wCz, z >= 8 ? '#8b5cf6' : '#6b4423', true);
  } else if (weaponType === 'bow') {
    for (let z = 2; z <= 7; z++) xformV(z, 1, 0, wP, wCx, wCy, wCz, '#6b4423', true);
    xformV(2, 0, 0, wP, wCx, wCy, wCz, '#d4d4d8', true);
    xformV(7, 0, 0, wP, wCx, wCy, wCz, '#d4d4d8', true);
  } else {
    xformV(2, 1, 0, wP, wCx, wCy, wCz, '#c5a059', true);
    for (let z = 3; z <= 8; z++) xformV(z, 1, 0, wP, wCx, wCy, wCz, '#c0c0c0', true);
  }

  return model;
}

function buildMinionModel(color: string, minionType: string, animTimer: number): VoxelModel {
  const dark = shade(color, 0.5);
  const mid = shade(color, 0.75);
  const col = color;
  const light = shade(color, 1.15);
  const bright = shade(color, 1.4);
  const walk = Math.sin(animTimer * 8);
  const bob = Math.sin(animTimer * 6);
  const metal = '#9ca3af'; const metalDark = '#6b7280'; const metalBright = '#d1d5db';
  const leather = '#78350f'; const wood = '#92400e'; const woodLight = '#b45309';

  function makeGrid(h: number, w: number): VoxelModel {
    const m: VoxelModel = [];
    for (let z = 0; z < h; z++) { m[z] = []; for (let y = 0; y < w; y++) { m[z][y] = []; for (let x = 0; x < w; x++) m[z][y][x] = null; } }
    return m;
  }

  if (minionType === 'siege' || minionType === 'super') {
    // Tank voxel model - armored vehicle with treads and cannon
    const model = makeGrid(10, 9);
    const isSup = minionType === 'super';
    const hull = isSup ? '#c5a059' : '#4a6741';
    const hullDark = shade(hull, 0.7);
    const hullLight = shade(hull, 1.2);
    const tread = '#333333';
    const treadLight = '#555555';
    const barrel = '#6b7280';
    const barrelDark = '#4b5563';
    // Treads (left and right tracks)
    const treadBob = Math.round(walk * 0.3);
    for (let y = 0; y <= 8; y++) {
      model[0][y][0] = tread; model[0][y][1] = treadLight;
      model[0][y][7] = treadLight; model[0][y][8] = tread;
    }
    if (treadBob > 0) {
      model[0][0][0] = treadLight; model[0][8][8] = treadLight;
    }
    // Hull body (lower)
    for (let x = 1; x <= 7; x++) for (let y = 1; y <= 7; y++) {
      model[1][y][x] = hullDark;
      model[2][y][x] = hull;
    }
    // Angled front armor
    for (let x = 2; x <= 6; x++) { model[2][0][x] = hullLight; model[3][0][x] = hull; }
    for (let x = 2; x <= 6; x++) { model[2][8][x] = hullDark; }
    // Hull top
    for (let x = 2; x <= 6; x++) for (let y = 2; y <= 6; y++) model[3][y][x] = hull;
    // Turret base
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) model[4][y][x] = hullLight;
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) model[5][y][x] = hull;
    // Turret top
    model[6][4][4] = hullLight; model[6][3][4] = hull; model[6][5][4] = hull;
    model[6][4][3] = hull; model[6][4][5] = hull;
    // Cannon barrel extending forward
    for (let y = 0; y <= 2; y++) { model[5][y][4] = barrel; model[4][y][4] = barrelDark; }
    model[5][0][4] = shade(barrel, 1.3);
    // Side armor plates
    for (let y = 1; y <= 7; y++) { model[2][y][0] = metalDark; model[2][y][8] = metalDark; }
    for (let y = 1; y <= 7; y++) { model[3][y][0] = metal; model[3][y][8] = metal; }
    // Exhaust pipes
    model[4][7][2] = '#444'; model[4][7][6] = '#444';
    model[5][7][2] = '#555'; model[5][7][6] = '#555';
    // Hatches
    model[6][4][4] = '#888';
    if (isSup) {
      // Gold trim for super version
      for (let y = 0; y <= 8; y++) { model[3][y][1] = '#c5a059'; model[3][y][7] = '#c5a059'; }
      model[7][4][4] = '#ffd700';
      // Side cannons
      model[4][0][2] = barrel; model[4][0][6] = barrel;
    }
    return model;
  }

  if (minionType === 'ranged') {
    // Tall, thin robed caster with staff and pointed hat
    const model = makeGrid(10, 5);
    const legOff = Math.round(walk * 0.4);
    const robeColor = shade(col, 0.8);
    const robeLight = shade(col, 1.1);
    const hatColor = shade(col, 0.55);
    const staffGem = bright;
    // Thin legs
    model[0][2][1 + (legOff > 0 ? 1 : 0)] = dark;
    model[0][2][3 - (legOff > 0 ? 1 : 0)] = dark;
    model[1][2][1] = dark; model[1][2][3] = dark;
    // Wide robe skirt (z=2-3)
    for (let x = 0; x <= 4; x++) { model[2][2][x] = robeColor; model[2][1][x] = robeColor; model[2][3][x] = robeColor; }
    for (let x = 0; x <= 4; x++) { model[3][2][x] = robeLight; model[3][1][x] = robeColor; model[3][3][x] = robeColor; }
    // Narrow torso with robe (z=4-5)
    for (let x = 1; x <= 3; x++) { model[4][2][x] = col; model[4][1][x] = robeColor; model[4][3][x] = robeColor; }
    model[5][2][2] = col; model[5][1][2] = robeColor; model[5][3][2] = robeColor;
    model[5][2][1] = robeColor; model[5][2][3] = robeColor;
    // Thin arms (z=4-5) sticking out
    model[4][2][0] = mid; model[4][2][4] = mid;
    model[5][2][0] = mid; model[5][2][4] = mid;
    // Neck + head (z=6-7)
    model[6][2][2] = light;
    model[7][1][2] = bright; model[7][3][2] = bright; model[7][2][2] = light;
    model[7][2][1] = light; model[7][2][3] = light;
    // Pointed hat (z=8-9)
    for (let x = 1; x <= 3; x++) { model[8][2][x] = hatColor; model[8][1][x] = hatColor; model[8][3][x] = hatColor; }
    model[8][2][0] = hatColor; model[8][2][4] = hatColor;
    model[9][2][2] = hatColor; model[9][1][2] = hatColor; model[9][3][2] = hatColor;
    // Staff in left hand
    const staffBob = Math.round(bob * 0.3);
    for (let z = 1; z <= 8; z++) model[z][0][0] = z >= 7 ? staffGem : wood;
    model[9][0][0] = bright;
    if (bob > 0) model[9 + staffBob] && (model[9][0][0] = blend(staffGem, '#ffffff', Math.abs(bob) * 0.5));
    return model;
  }

  // Melee minion: wider, shorter, armored with shield + helmet
  const model = makeGrid(7, 7);
  const legOff = Math.round(walk * 0.5);
  // Wide stumpy legs (z=0)
  model[0][3][1 + (legOff > 0 ? 1 : 0)] = dark; model[0][3][2 + (legOff > 0 ? 1 : 0)] = dark;
  model[0][3][4 - (legOff > 0 ? 1 : 0)] = dark; model[0][3][5 - (legOff > 0 ? 1 : 0)] = dark;
  // Armored legs (z=1)
  model[1][3][1] = metalDark; model[1][3][2] = metalDark;
  model[1][3][4] = metalDark; model[1][3][5] = metalDark;
  // Wide armored torso (z=2-3) - 5 voxels wide
  for (let x = 1; x <= 5; x++) for (let y = 2; y <= 4; y++) {
    model[2][y][x] = metal; model[3][y][x] = metal;
  }
  // Core body color inside armor
  for (let x = 2; x <= 4; x++) { model[2][3][x] = col; model[3][3][x] = col; }
  // Shoulder pauldrons (z=3)
  model[3][3][0] = metalBright; model[3][2][0] = metalDark;
  model[3][3][6] = metalBright; model[3][2][6] = metalDark;
  model[3][4][0] = metalDark; model[3][4][6] = metalDark;
  // Arms (z=2-3)
  model[2][3][0] = mid; model[2][3][6] = mid;
  // Head (z=4-5)
  model[4][3][2] = light; model[4][3][3] = light; model[4][3][4] = light;
  model[4][2][3] = light; model[4][4][3] = light;
  model[5][3][3] = bright; model[5][2][3] = bright; model[5][4][3] = bright;
  // Helmet (z=5-6)
  model[5][3][2] = metalBright; model[5][3][4] = metalBright;
  model[6][3][3] = metal; model[6][2][3] = metalDark; model[6][4][3] = metalDark;
  // Sword in right hand
  const swingOff = bob > 0.2 ? 1 : 0;
  model[2][1][0] = metalBright; model[3][1][0] = metalBright;
  model[4 + swingOff][1][0] = metalBright; model[5][1][0] = metalDark;
  // Shield in left hand
  for (let z = 2; z <= 4; z++) {
    model[z][5][6] = metal; model[z][4][6] = metalDark;
  }
  model[3][5][6] = metalBright;
  return model;
}

function buildJungleMobModel(mobType: string, animTimer: number): VoxelModel {
  const bob = Math.sin(animTimer * 3);
  const walk = Math.sin(animTimer * 5);

  if (mobType === 'buff') {
    const model: VoxelModel = [];
    const h = 10; const w = 7;
    for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
    const body = '#6b21a8'; const belly = '#9333ea'; const dark = shade(body, 0.6); const horn = '#c5a059';
    const legOff = Math.round(walk * 0.5);
    model[0][2][1 + (legOff > 0 ? 1 : 0)] = dark; model[0][2][5 - (legOff > 0 ? 1 : 0)] = dark;
    model[0][4][1 - (legOff > 0 ? 0 : -1)] = dark; model[0][4][5 + (legOff > 0 ? 0 : -1)] = dark;
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) { model[1][y][x] = dark; }
    for (let x = 0; x <= 6; x++) for (let y = 0; y <= 6; y++) {
      if (x >= 1 && x <= 5 && y >= 1 && y <= 5) { model[2][y][x] = body; model[3][y][x] = body; model[4][y][x] = body; }
    }
    for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) { model[2][y][x] = belly; model[3][y][x] = belly; }
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) { model[5][y][x] = body; }
    for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) { model[6][y][x] = shade(body, 1.1); }
    model[7][3][2] = '#dc2626'; model[7][3][4] = '#dc2626';
    model[7][3][3] = shade(body, 1.2);
    model[8][3][2] = horn; model[8][3][4] = horn;
    model[9][3][2] = shade(horn, 1.3); model[9][3][4] = shade(horn, 1.3);
    model[5][0][3] = '#1f1f2e'; model[6][0][3] = '#1f1f2e';
    return model;
  }

  if (mobType === 'medium') {
    const model: VoxelModel = [];
    const h = 6; const w = 5;
    for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
    const fur = '#3b82f6'; const darkFur = shade(fur, 0.7); const belly = shade(fur, 1.3);
    const legOff = Math.round(walk * 0.5);
    model[0][1][0 + (legOff > 0 ? 1 : 0)] = darkFur; model[0][1][4 - (legOff > 0 ? 1 : 0)] = darkFur;
    model[0][3][1] = darkFur; model[0][3][3] = darkFur;
    for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) { model[1][y][x] = fur; model[2][y][x] = fur; }
    model[2][2][2] = belly;
    for (let x = 1; x <= 3; x++) model[3][2][x] = fur;
    model[4][2][1] = '#ef4444'; model[4][2][3] = '#ef4444';
    model[4][2][2] = shade(fur, 1.1);
    model[5][2][2] = shade(fur, 1.2);
    model[3][0][2] = fur; model[4][0][2] = shade(fur, 0.8);
    return model;
  }

  const model: VoxelModel = [];
  const h = 4; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const skin = '#65a30d'; const darkSkin = shade(skin, 0.7);
  model[0][1][0] = darkSkin; model[0][1][2] = darkSkin;
  model[1][1][1] = skin;
  for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) {
    if (Math.abs(x - 1) + Math.abs(y - 1) <= 1) model[2][y][x] = skin;
  }
  model[3][1][1] = shade(skin, 1.2);
  model[2][0][1] = shade(skin, 0.8);
  return model;
}

function buildTreeModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 8 + (seed % 3);
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < 5; y++) {
      model[z][y] = [];
      for (let x = 0; x < 5; x++) model[z][y][x] = null;
    }
  }
  const trunkH = 3 + (seed % 2);
  for (let z = 0; z < trunkH; z++) {
    model[z][2][2] = shade('#553322', 0.8 + (seed % 3) * 0.1);
    if (z > 0 && seed % 3 === 0) model[z][2][3] = shade('#4a2d1a', 0.9);
  }
  const leafColors = ['#1a5a1a', '#2a6a2a', '#1e5e1e', '#2e7a2e', '#186818'];
  for (let z = trunkH; z < h; z++) {
    const r = z < h - 2 ? 2 : (z < h - 1 ? 1 : 0);
    for (let y = 2 - r; y <= 2 + r; y++) {
      for (let x = 2 - r; x <= 2 + r; x++) {
        if (y >= 0 && y < 5 && x >= 0 && x < 5) {
          const leafSeed = (seed + x * 7 + y * 13 + z * 23) % leafColors.length;
          model[z][y][x] = leafColors[leafSeed];
        }
      }
    }
  }
  return model;
}

function buildRockModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const sz = 2 + (seed % 2);
  for (let z = 0; z < sz + 1; z++) {
    model[z] = [];
    for (let y = 0; y < 3; y++) {
      model[z][y] = [];
      for (let x = 0; x < 3; x++) model[z][y][x] = null;
    }
  }
  const rockColors = ['#5a5a6a', '#4e4e5e', '#666678', '#585868'];
  for (let z = 0; z < sz; z++) {
    const r = z === 0 ? 1 : 0;
    for (let y = 1 - r; y <= 1 + r; y++) {
      for (let x = 1 - r; x <= 1 + r; x++) {
        if (y >= 0 && y < 3 && x >= 0 && x < 3) {
          model[z][y][x] = rockColors[(seed + x + y + z) % rockColors.length];
        }
      }
    }
  }
  return model;
}

// ── New Tree Models ──────────────────────────────────────────────

function buildPineTreeModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 14 + (seed % 2);
  const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  // Trunk
  for (let z = 0; z < 5; z++) model[z][2][2] = shade('#3a2210', 0.85 + (seed % 3) * 0.05);
  // Conical canopy
  const darkGreen = '#0e4e0e'; const midGreen = '#1a5a1a';
  for (let z = 4; z < h - 1; z++) {
    const r = Math.max(0, Math.floor((h - 1 - z) / 3));
    for (let y = 2 - r; y <= 2 + r; y++) for (let x = 2 - r; x <= 2 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        model[z][y][x] = (x + y + z + seed) % 3 === 0 ? darkGreen : midGreen;
      }
    }
  }
  // Snow cap
  model[h - 1][2][2] = '#ffffff';
  if (seed % 2 === 0) { model[h - 2][1][2] = '#eeeeff'; model[h - 2][3][2] = '#eeeeff'; }
  return model;
}

function buildWillowModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 12; const w = 7;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  // Trunk
  for (let z = 0; z < 6; z++) {
    model[z][3][3] = '#4a3a1a';
    if (z > 2) { model[z][3][2] = shade('#4a3a1a', 0.9); model[z][3][4] = shade('#4a3a1a', 0.9); }
  }
  // Canopy dome
  const leafLight = '#4a9a4a'; const leafDark = '#2a7a2a';
  for (let z = 5; z < 10; z++) {
    const r = z < 8 ? 3 : (z < 9 ? 2 : 1);
    for (let y = 3 - r; y <= 3 + r; y++) for (let x = 3 - r; x <= 3 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) model[z][y][x] = (x + y + seed) % 2 === 0 ? leafLight : leafDark;
    }
  }
  // Droopy vines at edges
  for (let dy = -2; dy <= 2; dy += 4) {
    for (let z = 3; z < 7; z++) {
      const yy = 3 + dy; if (yy >= 0 && yy < w) model[z][yy][3] = shade(leafDark, 0.8);
    }
  }
  return model;
}

function buildPalmModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 14; const w = 7;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  // Thin curved trunk
  const bark = '#6a5a3a';
  for (let z = 0; z < 10; z++) {
    const lean = z > 4 ? Math.floor((z - 4) / 3) : 0;
    model[z][3][3 + lean] = bark;
  }
  // Frond crown
  const frond = '#2a8a2a'; const frondLight = '#3a9a3a';
  const cx = 3 + 2; // lean offset at top
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    if (Math.abs(dx) + Math.abs(dy) <= 3 && (Math.abs(dx) + Math.abs(dy) > 0)) {
      const xx = cx + dx; const yy = 3 + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < w) {
        model[10][yy][xx] = (dx + dy + seed) % 2 === 0 ? frond : frondLight;
        if (Math.abs(dx) + Math.abs(dy) >= 2) model[9][yy][xx] = shade(frond, 0.85);
      }
    }
  }
  model[11][3][cx] = frondLight;
  return model;
}

function buildDeadTreeModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 10 + (seed % 2); const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const bark = '#3a2a1a'; const barkLight = '#4a3a2a';
  // Main trunk
  for (let z = 0; z < h - 2; z++) model[z][2][2] = z % 3 === 0 ? barkLight : bark;
  // Gnarled branches — no leaves
  model[5][2][3] = barkLight; model[5][2][4] = shade(bark, 0.7);
  model[6][1][2] = barkLight; model[6][0][2] = shade(bark, 0.7);
  model[7][2][1] = bark; model[8][3][2] = barkLight;
  if (seed % 2 === 0) { model[4][3][2] = bark; model[3][4][2] = shade(bark, 0.6); }
  return model;
}

function buildMushroomTreeModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 10; const w = 7;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  // Thick stem
  const stem = '#d4a574';
  for (let z = 0; z < 6; z++) {
    model[z][3][3] = stem; model[z][3][2] = shade(stem, 0.9); model[z][2][3] = shade(stem, 0.9);
  }
  // Flat mushroom cap
  const capMain = '#cc4444'; const capLight = '#ff6666'; const spot = '#ffffff';
  for (let z = 6; z < 9; z++) {
    const r = z === 6 ? 3 : (z === 7 ? 2 : 1);
    for (let y = 3 - r; y <= 3 + r; y++) for (let x = 3 - r; x <= 3 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        const isSpot = (x + y + seed) % 5 === 0;
        model[z][y][x] = isSpot ? spot : ((x + y) % 2 === 0 ? capMain : capLight);
      }
    }
  }
  model[9][3][3] = capMain;
  return model;
}

// ── New Rock Models ──────────────────────────────────────────────

function buildCrystalRockModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 8; const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const colors = ['#7b3ff2', '#00e5ff', '#b388ff', '#e0e0e0'];
  // Base cluster
  for (let z = 0; z < 3; z++) for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) {
    model[z][y][x] = colors[(x + y + z + seed) % colors.length];
  }
  // Jagged spires
  model[3][2][2] = colors[0]; model[4][2][2] = colors[1]; model[5][2][2] = colors[0];
  model[3][1][1] = colors[2]; model[4][1][1] = colors[3];
  model[3][3][3] = colors[1]; model[4][3][3] = colors[2]; model[5][3][3] = colors[1];
  model[6][2][2] = colors[3]; model[7][2][2] = colors[1];
  return model;
}

function buildMossyBoulderModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 4; const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const rock = '#4a4a5a'; const moss = '#2a6a2a'; const mossLight = '#3a5a3a';
  // Rounded base
  for (let z = 0; z < 3; z++) {
    const r = z < 2 ? 2 : 1;
    for (let y = 2 - r; y <= 2 + r; y++) for (let x = 2 - r; x <= 2 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        const hasMoss = (x + y + z + seed) % 4 === 0;
        model[z][y][x] = hasMoss ? (z > 0 ? moss : mossLight) : rock;
      }
    }
  }
  model[3][2][2] = moss;
  return model;
}

function buildStalagmiteModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 10; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const colors = ['#5a4a3a', '#4a3a2a', '#6a5a4a'];
  // Wide base tapering to point
  for (let z = 0; z < h; z++) {
    const r = z < 3 ? 1 : 0;
    for (let y = 1 - r; y <= 1 + r; y++) for (let x = 1 - r; x <= 1 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        model[z][y][x] = colors[(z + seed) % colors.length];
      }
    }
  }
  return model;
}

// ── Mountain Models ──────────────────────────────────────────────

function buildMountainPeakModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 16; const w = 9;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#5a5a6a'; const stoneLight = '#7a7a8a'; const snow = '#ffffff'; const stoneDark = '#3a3a4a';
  for (let z = 0; z < h; z++) {
    const r = Math.max(0, Math.floor((h - z) * 4 / h));
    for (let y = 4 - r; y <= 4 + r; y++) for (let x = 4 - r; x <= 4 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        const isSnow = z >= h - 4;
        model[z][y][x] = isSnow ? snow : ((x + y + z) % 3 === 0 ? stoneLight : (z < 4 ? stoneDark : stone));
      }
    }
  }
  return model;
}

function buildCliffModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 12; const w = 9; const d = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const colors = ['#5a4a3a', '#6a5a4a', '#4a3a2a'];
  for (let z = 0; z < h; z++) {
    const depth = z > 8 ? 2 : (z > 4 ? 3 : 4);
    for (let y = 0; y < depth; y++) for (let x = 0; x < w; x++) {
      model[z][y][x] = colors[(x + z) % colors.length];
    }
  }
  return model;
}

function buildMesaModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 8; const w = 9;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const sand = '#8a6a4a'; const sandLight = '#9a7a5a'; const sandDark = '#6a4a2a';
  for (let z = 0; z < h; z++) {
    const r = z < 4 ? 4 : (z < 6 ? 3 : (z < 7 ? 3 : 4));
    for (let y = 4 - r; y <= 4 + r; y++) for (let x = 4 - r; x <= 4 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        model[z][y][x] = z === h - 1 ? sandLight : ((x + y + z) % 3 === 0 ? sandDark : sand);
      }
    }
  }
  return model;
}

function buildHillModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 6; const w = 9;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const grass = '#3a6a2a'; const grassLight = '#4a7a3a'; const dirt = '#5a4a3a';
  for (let z = 0; z < h; z++) {
    const r = Math.max(0, 4 - z);
    for (let y = 4 - r; y <= 4 + r; y++) for (let x = 4 - r; x <= 4 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) {
        const d = Math.abs(x - 4) + Math.abs(y - 4);
        if (d <= r) model[z][y][x] = z === 0 ? dirt : ((x + y) % 2 === 0 ? grass : grassLight);
      }
    }
  }
  return model;
}

function buildCampfireModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 8; const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const wood = '#5a3a1a'; const woodDark = '#3a2210'; const stone = '#5a5a6a'; const stoneDark = '#3a3a4a';
  // Stone ring base
  model[0][0][1] = stone; model[0][0][2] = stoneDark; model[0][0][3] = stone;
  model[0][1][0] = stoneDark; model[0][1][4] = stoneDark;
  model[0][2][0] = stone; model[0][2][4] = stone;
  model[0][3][0] = stoneDark; model[0][3][4] = stoneDark;
  model[0][4][1] = stone; model[0][4][2] = stoneDark; model[0][4][3] = stone;
  // Logs
  model[1][1][2] = wood; model[1][2][1] = woodDark; model[1][2][3] = wood;
  model[1][3][2] = woodDark; model[1][2][2] = '#1a0a00';
  model[2][2][2] = '#1a0800';
  // Animated fire
  const flicker = Math.sin(animTimer * 12);
  const flicker2 = Math.sin(animTimer * 15 + 1.5);
  model[2][1][2] = '#ff4400'; model[2][3][2] = '#ff4400';
  model[2][2][1] = '#ff6600'; model[2][2][3] = '#ff6600';
  model[3][2][2] = '#ff8800'; model[3][1][2] = flicker > 0 ? '#ff6600' : null; model[3][3][2] = flicker2 > 0 ? '#ff6600' : null;
  model[4][2][2] = '#ffaa00';
  model[4][2][1] = flicker > 0.3 ? '#ff6600' : null; model[4][2][3] = flicker2 > 0.3 ? '#ff6600' : null;
  model[5][2][2] = '#ffcc00';
  model[5][1][2] = flicker > 0.5 ? '#ff8800' : null; model[5][3][2] = flicker2 > 0.5 ? '#ff8800' : null;
  model[6][2][2] = flicker > 0.2 ? '#ffdd44' : '#ffcc00';
  model[7][2][2] = flicker > 0.6 ? '#ffee88' : null;
  return model;
}

function buildTowerModel(teamColor: string, tier: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 10 + tier * 2;
  const w = 5;
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) model[z][y][x] = null;
    }
  }
  const stoneBase = '#3a3a4a';
  const stoneDark = '#2a2a3e';
  for (let z = 0; z < h - 3; z++) {
    const r = z < 2 ? 2 : (z < h - 5 ? 1 : 1);
    for (let y = 2 - r; y <= 2 + r; y++) {
      for (let x = 2 - r; x <= 2 + r; x++) {
        if (y >= 0 && y < w && x >= 0 && x < w) {
          model[z][y][x] = (x + y + z) % 3 === 0 ? stoneDark : stoneBase;
        }
      }
    }
  }
  for (let i = h - 3; i < h; i++) {
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        if ((y === 0 || y === w - 1 || x === 0 || x === w - 1) && (y + x) % 2 === 0) {
          model[i][y][x] = teamColor;
        }
      }
    }
  }
  model[h - 1][2][2] = shade(teamColor, 1.4);
  return model;
}

function buildNexusModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 8;
  const w = 7;
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) model[z][y][x] = null;
    }
  }
  for (let z = 0; z < 3; z++) {
    for (let y = 1; y < w - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const d = Math.abs(x - 3) + Math.abs(y - 3);
        if (d <= 2 + z) {
          model[z][y][x] = z === 0 ? '#1a1a2e' : shade(teamColor, 0.5 + z * 0.15);
        }
      }
    }
  }
  for (let z = 3; z < 6; z++) {
    for (let y = 2; y < w - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if ((y === 2 || y === w - 3 || x === 2 || x === w - 3)) {
          model[z][y][x] = teamColor;
        }
      }
    }
  }
  model[5][3][3] = shade(teamColor, 1.5);
  model[6][3][3] = shade(teamColor, 1.3);
  model[7][3][3] = '#ffd700';
  return model;
}

// ── Terrain Props ──────────────────────────────────────────────

function buildBushModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 3; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const greens = ['#1a5a1a', '#2a6a2a', '#3a7a3a'];
  for (let z = 0; z < 2; z++) for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    if (z === 0 || (Math.abs(x - 1) + Math.abs(y - 1) <= 1))
      model[z][y][x] = greens[(x + y + z + seed) % greens.length];
  }
  model[2][1][1] = greens[seed % greens.length];
  return model;
}

function buildFlowerPatchModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 3; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const green = '#2a7a2a';
  const petals = ['#ff4488', '#ffaa22', '#4488ff', '#ff66aa', '#ffdd44'];
  // Grass base
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) model[0][y][x] = green;
  // Stems
  model[1][0][0] = green; model[1][1][2] = green; model[1][2][1] = green;
  // Flower heads
  model[2][0][0] = petals[(seed) % petals.length];
  model[2][1][2] = petals[(seed + 1) % petals.length];
  model[2][2][1] = petals[(seed + 2) % petals.length];
  return model;
}

function buildGrassTuftModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 4; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const colors = ['#3a7a2a', '#4a8a3a', '#5a9a4a'];
  for (let z = 0; z < h; z++) {
    const spread = z < 2 ? 1 : 0;
    for (let x = 1 - spread; x <= 1 + spread; x++) {
      if (x >= 0 && x < w) model[z][1][x] = colors[(x + z + seed) % colors.length];
    }
    if (z < 3 && seed % 2 === 0) model[z][0][1] = colors[(z + seed) % colors.length];
  }
  return model;
}

function buildMushroomClusterModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 3; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stem = '#d4a574'; const cap = '#cc4444'; const capDark = '#8b4513';
  // Big mushroom
  model[0][1][1] = stem; model[1][1][1] = stem; model[2][1][1] = cap;
  model[2][0][1] = capDark; model[2][1][0] = capDark; model[2][1][2] = capDark;
  // Small mushroom
  model[0][2][0] = stem; model[1][2][0] = (seed % 2 === 0) ? cap : capDark;
  return model;
}

function buildBarrelModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 4; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const wood = '#8b6914'; const woodDark = '#6a4a0a'; const band = '#888888';
  for (let z = 0; z < h; z++) {
    const isBand = z === 0 || z === h - 1;
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      if (Math.abs(x - 1) + Math.abs(y - 1) <= 1) {
        model[z][y][x] = isBand ? band : ((x + y) % 2 === 0 ? wood : woodDark);
      }
    }
  }
  return model;
}

function buildHayBaleModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 3; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const hay = ['#c8a832', '#b89828', '#d8b842'];
  for (let z = 0; z < h; z++) for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    model[z][y][x] = hay[(x + y + z) % hay.length];
  }
  return model;
}

// ── New Structures ──────────────────────────────────────────────

function buildHouseModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 8; const w = 7;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const wall = '#6a5a4a'; const wallDark = '#5a4a3a'; const roof = '#8b6914'; const chimney = '#3a3a4a';
  // Walls (z 0-4)
  for (let z = 0; z < 5; z++) for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) {
    if (y === 1 || y === 5 || x === 1 || x === 5) {
      model[z][y][x] = (x + y + z) % 3 === 0 ? wallDark : wall;
    }
  }
  // Door
  model[0][3][1] = null; model[1][3][1] = null;
  // Windows
  model[2][2][1] = '#88ccff'; model[2][4][1] = '#88ccff';
  model[2][2][5] = '#88ccff'; model[2][4][5] = '#88ccff';
  // Floor
  for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) model[0][y][x] = wallDark;
  // Roof (pyramid)
  for (let z = 5; z < 8; z++) {
    const r = 3 - (z - 5);
    for (let y = 3 - r; y <= 3 + r; y++) for (let x = 3 - r; x <= 3 + r; x++) {
      if (y >= 0 && y < w && x >= 0 && x < w) model[z][y][x] = roof;
    }
  }
  // Chimney
  model[5][5][5] = chimney; model[6][5][5] = chimney; model[7][5][5] = chimney;
  // Team color door frame
  model[0][3][1] = teamColor; model[2][3][1] = teamColor;
  return model;
}

function buildBridgeModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 4; const w = 9; const d = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#5a5a6a'; const wood = '#6a5a4a'; const stoneDark = '#4a4a5a';
  // Stone arch supports
  for (let z = 0; z < 3; z++) {
    model[z][2][0] = stone; model[z][2][w - 1] = stone;
    model[z][2][1] = stoneDark; model[z][2][w - 2] = stoneDark;
  }
  // Deck
  for (let x = 0; x < w; x++) for (let y = 1; y < 4; y++) {
    model[3][y][x] = (x + y) % 2 === 0 ? wood : stone;
  }
  // Rails
  for (let x = 0; x < w; x += 2) {
    model[3][0][x] = stoneDark; model[3][4][x] = stoneDark;
  }
  return model;
}

function buildWellModel(): VoxelModel {
  const model: VoxelModel = [];
  const h = 6; const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#5a5a6a'; const wood = '#6a5a4a'; const water = '#3a7aaa';
  // Stone ring
  for (let z = 0; z < 3; z++) for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    if ((y === 0 || y === w - 1 || x === 0 || x === w - 1) && !(y === 0 && x === 0) && !(y === 0 && x === w-1) && !(y === w-1 && x === 0) && !(y === w-1 && x === w-1))
      model[z][y][x] = stone;
  }
  // Water inside
  model[0][1][1] = water; model[0][2][2] = water; model[0][1][2] = water; model[0][2][1] = water;
  model[0][1][3] = water; model[0][2][3] = water; model[0][3][1] = water; model[0][3][2] = water; model[0][3][3] = water;
  // Support posts
  model[3][0][0] = wood; model[3][0][w-1] = wood;
  model[4][0][0] = wood; model[4][0][w-1] = wood;
  // Roof beam
  for (let x = 0; x < w; x++) model[5][0][x] = wood;
  return model;
}

function buildShrineModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 7; const w = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#3a3a4a'; const glow = '#8b5cf6'; const gold = '#ffd700';
  // Stone base
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) { model[0][y][x] = stone; model[1][y][x] = stone; }
  // Pillar corners
  for (let z = 2; z < 5; z++) {
    model[z][1][1] = stone; model[z][1][3] = stone; model[z][3][1] = stone; model[z][3][3] = stone;
  }
  // Glowing center
  model[2][2][2] = glow; model[3][2][2] = shade(glow, 1.3); model[4][2][2] = glow;
  // Gold cap
  model[5][2][2] = gold; model[6][2][2] = teamColor;
  return model;
}

function buildGateModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 10; const w = 7; const d = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#3a3a4a'; const stoneDark = '#2a2a3e'; const wood = '#6a5a4a';
  // Left and right pillars
  for (let z = 0; z < h; z++) for (let y = 0; y < d; y++) {
    model[z][y][0] = (z + y) % 2 === 0 ? stone : stoneDark;
    model[z][y][1] = stone;
    model[z][y][w - 2] = stone;
    model[z][y][w - 1] = (z + y) % 2 === 0 ? stone : stoneDark;
  }
  // Arch top
  for (let x = 2; x < w - 2; x++) for (let y = 0; y < d; y++) {
    model[h - 1][y][x] = stone;
    model[h - 2][y][x] = teamColor;
  }
  // Portcullis bars
  for (let z = 0; z < h - 2; z++) {
    model[z][1][3] = z % 2 === 0 ? wood : null;
  }
  return model;
}

function buildWallSegmentModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 6; const w = 7; const d = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const stone = '#3a3a4a'; const stoneDark = '#2a2a3e'; const stoneLight = '#4a4a5a';
  // Main wall body
  for (let z = 0; z < h - 1; z++) for (let y = 0; y < d; y++) for (let x = 0; x < w; x++) {
    model[z][y][x] = (x + y + z) % 3 === 0 ? stoneDark : stone;
  }
  // Battlements (merlons)
  for (let x = 0; x < w; x += 2) for (let y = 0; y < d; y++) {
    model[h - 1][y][x] = teamColor;
  }
  // Walk path (indent top)
  for (let x = 1; x < w; x += 2) model[h - 1][1][x] = stoneLight;
  return model;
}

// ── Animal Models ──────────────────────────────────────────────

function buildDeerModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 7; const w = 5; const d = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const body = '#8b6914'; const bodyLight = '#a07828'; const white = '#ffffff';
  const walk = Math.sin(animTimer * 4) * 0.5;
  // Legs
  model[0][1][1] = body; model[0][1][3] = body;
  model[1][1][1] = body; model[1][1][3] = body;
  // Body
  for (let x = 1; x < 4; x++) { model[2][1][x] = body; model[3][1][x] = bodyLight; }
  // Neck & head
  model[4][1][4] = body; model[5][1][4] = bodyLight;
  // Antlers
  model[6][0][4] = white; model[6][2][4] = white;
  // Tail
  model[3][1][0] = white;
  return model;
}

function buildBoarModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 4; const w = 5; const d = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const body = '#5a3a2a'; const bodyLight = '#7a5a4a'; const tusk = '#d4a574';
  // Legs
  model[0][0][1] = body; model[0][2][1] = body; model[0][0][3] = body; model[0][2][3] = body;
  // Stocky body
  for (let x = 1; x < 4; x++) for (let y = 0; y < d; y++) {
    model[1][y][x] = body; model[2][y][x] = bodyLight;
  }
  // Head + tusks
  model[2][1][4] = body; model[3][1][4] = bodyLight;
  model[2][0][4] = tusk; model[2][2][4] = tusk;
  return model;
}

function buildHorseModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 8; const w = 7; const d = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const body = '#5a3a1a'; const bodyLight = '#8a6a3a'; const mane = '#1a1a1a';
  // Legs
  for (let z = 0; z < 3; z++) {
    model[z][1][1] = body; model[z][1][5] = body;
  }
  // Body
  for (let x = 1; x < 6; x++) { model[3][1][x] = body; model[4][1][x] = bodyLight; }
  model[3][0][2] = body; model[3][2][2] = body; model[3][0][4] = body; model[3][2][4] = body;
  // Neck
  model[5][1][5] = body; model[6][1][5] = bodyLight;
  // Head
  model[7][1][5] = bodyLight; model[7][1][6] = body;
  // Mane
  model[5][0][5] = mane; model[6][0][5] = mane; model[7][0][5] = mane;
  // Tail
  model[4][1][0] = mane; model[3][1][0] = mane;
  return model;
}

function buildHawkModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 3; const w = 5; const d = 5;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const body = '#5a3a1a'; const wing = '#f5f5dc'; const beak = '#1a1a1a';
  const wingFlap = Math.sin(animTimer * 6);
  // Body center
  model[1][2][2] = body; model[1][2][3] = body;
  // Head + beak
  model[2][2][4] = body; model[2][2][4] = beak;
  // Wings
  const wingZ = wingFlap > 0 ? 2 : 0;
  model[wingZ][0][2] = wing; model[wingZ][1][2] = wing;
  model[wingZ][3][2] = wing; model[wingZ][4][2] = wing;
  model[1][0][2] = wing; model[1][4][2] = wing;
  // Tail
  model[1][2][0] = body; model[0][2][0] = body;
  return model;
}

function buildFishModel(animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 2; const w = 3; const d = 1;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < d; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const body = '#4488cc'; const belly = '#66aadd'; const fin = '#ccddee';
  model[0][0][0] = fin; model[0][0][1] = body; model[0][0][2] = body;
  model[1][0][1] = belly; model[1][0][2] = fin;
  return model;
}

interface DeathVoxel {
  sx: number; sy: number; sz: number;
  vx: number; vy: number; vz: number;
  color: string;
  rot: number; rotSpeed: number;
  scale: number;
  grounded: boolean;
}

interface DeathDebris {
  voxels: DeathVoxel[];
  startTime: number;
  duration: number;
}

export class VoxelRenderer {
  private spriteCache = new Map<string, ImageBitmap>();
  private tileCache = new Map<string, HTMLCanvasElement>();
  private cubeSize = 4;
  private weaponTrails = new Map<number, WeaponTrailSystem>();
  private transformTimers = new Map<number, number>();
  private deathDebrisCache = new Map<number, DeathDebris>();
  private parsedBodyCache = new Map<string, ParsedBody>();

  private getWeaponTrail(entityId: number): WeaponTrailSystem {
    let trail = this.weaponTrails.get(entityId);
    if (!trail) { trail = new WeaponTrailSystem(); this.weaponTrails.set(entityId, trail); }
    return trail;
  }

  private initDeathDebris(entityId: number, model: VoxelModel, time: number): DeathDebris {
    const voxels: DeathVoxel[] = [];
    for (let z = 0; z < model.length; z++) {
      const layer = model[z];
      if (!layer) continue;
      for (let y = 0; y < layer.length; y++) {
        const row = layer[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x++) {
          const color = row[x];
          if (!color) continue;
          const cx = x - 4, cy = y - 4, cz = z;
          const angle = Math.atan2(cy, cx);
          const dist = Math.sqrt(cx * cx + cy * cy) + 0.5;
          const speed = 0.8 + Math.random() * 1.5;
          voxels.push({
            sx: cx, sy: cy, sz: cz,
            vx: Math.cos(angle) * dist * speed * 0.4 + (Math.random() - 0.5) * 2,
            vy: Math.sin(angle) * dist * speed * 0.3 + (Math.random() - 0.5) * 1.5,
            vz: (cz * 0.3 + 1) * speed + Math.random() * 2,
            color,
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 360,
            scale: 1,
            grounded: false
          });
        }
      }
    }
    voxels.sort((a, b) => a.sz - b.sz);
    const debris: DeathDebris = { voxels, startTime: time, duration: 2.5 };
    this.deathDebrisCache.set(entityId, debris);
    return debris;
  }

  /**
   * Render a parsed body with independent per-part canvas transforms.
   * Each body part gets its own rotation/scale/translation from the FullPose.
   */
  renderParsedBody(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    parsed: ParsedBody,
    poses: FullPose,
    cubeSize: number,
    facing: number
  ) {
    const cs = cubeSize;
    const isoX = cs;
    const isoY = cs * 0.5;
    const renderOrder = getPartRenderOrder(facing);

    // Map FullPose part names to ParsedBody part names
    const poseMap: Record<BodyPartName, MotionBodyPartPose & { weaponGlow?: number }> = {
      leftLeg: poses.leftLeg,
      rightLeg: poses.rightLeg,
      chest: poses.torso,
      leftArm: poses.leftArm,
      rightArm: poses.rightArm,
      head: poses.head,
      hat: poses.head, // hat follows head by default but with slight delay
      weapon: poses.weapon,
    };

    for (const partName of renderOrder) {
      const part = parsed[partName];
      const pose = poseMap[partName];
      if (!part || !pose) continue;

      // Check if this part has any voxels
      let hasVoxels = false;
      outer: for (let z = 0; z < part.model.length; z++) {
        const layer = part.model[z];
        if (!layer) continue;
        for (let y = 0; y < layer.length; y++) {
          const row = layer[y];
          if (!row) continue;
          for (let x = 0; x < row.length; x++) {
            if (row[x]) { hasVoxels = true; break outer; }
          }
        }
      }
      if (!hasVoxels) continue;

      const offsets = PART_SCREEN_OFFSETS[partName];
      const rotation = (pose.rotation ?? 0) * Math.PI / 180;
      const scale = pose.scale ?? 1;
      const ox = pose.ox ?? 0;
      const oy = pose.oy ?? 0;
      const oz = pose.oz ?? 0;

      // For hat: add slight lag/bounce relative to head
      let hatBounce = 0;
      if (partName === 'hat') {
        const headRot = (poses.head.rotation ?? 0) * Math.PI / 180;
        hatBounce = Math.sin(headRot * 2) * 2;
      }

      // Calculate screen position of this part's origin in iso space
      const partWorldX = offsets.dx + ox;
      const partWorldY = offsets.dy + oy;
      const partWorldZ = offsets.dz + oz + hatBounce;

      // Iso projection of part origin
      const partScreenX = cx + (partWorldX - partWorldY) * isoX;
      const partScreenY = cy + (partWorldX + partWorldY) * isoY - partWorldZ * cs;

      // Apply canvas-level transform for rotation and scale
      if (Math.abs(rotation) > 0.001 || Math.abs(scale - 1) > 0.01) {
        ctx.save();

        // Translate to pivot point, rotate, scale, translate back
        const pivotScreenX = partScreenX + (part.pivotX - part.pivotY) * isoX;
        const pivotScreenY = partScreenY + (part.pivotX + part.pivotY) * isoY - part.pivotZ * cs;

        ctx.translate(pivotScreenX, pivotScreenY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.translate(-pivotScreenX, -pivotScreenY);

        this.renderVoxelModel(ctx, partScreenX, partScreenY, part.model, cs, facing);
        ctx.restore();
      } else {
        this.renderVoxelModel(ctx, partScreenX, partScreenY, part.model, cs, facing);
      }
    }
  }

  /**
   * Get or build a cached parsed body for combat rendering.
   */
  private getParsedBody(race: string, heroClass: string, heroName?: string): ParsedBody {
    const key = `${race}:${heroClass}:${heroName ?? ''}`;
    let cached = this.parsedBodyCache.get(key);
    if (!cached) {
      // Build idle model with zero poses for clean slicing
      const idleModel = buildHeroModel(race, heroClass, 'idle', 0, heroName);
      cached = getCachedParsedBody(race, heroClass, idleModel, heroName);
      this.parsedBodyCache.set(key, cached);
    }
    return cached;
  }

  private renderDeathDebris(ctx: CanvasRenderingContext2D, cx: number, cy: number, debris: DeathDebris, time: number, facing: number) {
    const elapsed = time - debris.startTime;
    const gravity = 18;
    const cs = this.cubeSize;
    const isoX = cs;
    const isoY = cs * 0.5;
    const fadeStart = debris.duration * 0.6;
    const globalAlpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (debris.duration - fadeStart)) : 1;

    ctx.save();
    ctx.globalAlpha = globalAlpha;

    for (const v of debris.voxels) {
      let px: number, py: number, pz: number;
      if (v.grounded) {
        px = v.sx;
        py = v.sy;
        pz = -2;
      } else {
        px = v.sx + v.vx * elapsed;
        py = v.sy + v.vy * elapsed;
        pz = v.sz + v.vz * elapsed - 0.5 * gravity * elapsed * elapsed;

        if (pz < -2) {
          pz = -2;
          v.sx = px; v.sy = py;
          v.vx = 0; v.vy = 0; v.vz = 0;
          v.grounded = true;
        }
      }

      const screenX = cx + (px - py) * isoX;
      const screenY = cy + (px + py) * isoY - pz * cs;
      const shrink = elapsed > fadeStart ? Math.max(0.3, 1 - (elapsed - fadeStart) / (debris.duration - fadeStart) * 0.7) : 1;

      this.drawIsoCube(ctx, screenX, screenY, cs * shrink, v.color);
    }

    ctx.restore();
  }

  drawHeroVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    raceColor: string, classColor: string,
    heroClass: string, facing: number,
    animState: string, animTimer: number,
    race: string,
    heroName?: string,
    buffTimer?: number,
    heroItems?: ({ id: number } | null)[],
    entityId?: number,
    shieldHp?: number,
    activeBuffs?: string[],
    gameTime?: number
  ) {
    const groundY = y + 6;
    const time = gameTime ?? animTimer;
    const eid = entityId ?? 0;

    if (heroClass === 'Worg' && buffTimer && buffTimer > 0) {
      const prevTransform = this.transformTimers.get(eid) ?? 0;
      const transformProgress = Math.min(1, prevTransform + 0.05);
      this.transformTimers.set(eid, transformProgress);

      if (transformProgress < 0.95) {
        drawTransformVFX(ctx, x, groundY - 14, transformProgress, '#f97316', time);
      }

      const bearModel = buildBearModel(animState, animTimer);
      // 1.5x scale for bear form
      const bearScale = Math.floor(this.cubeSize * 1.5);
      this.renderVoxelModel(ctx, x, groundY - 38, bearModel, bearScale, facing);

      if (shieldHp && shieldHp > 0) drawShieldVFX(ctx, x, groundY - 14, shieldHp, 200, time);
      return;
    } else {
      this.transformTimers.delete(eid);
    }

    const classVfxColors: Record<string, string> = { Warrior: '#ef4444', Mage: '#8b5cf6', Ranger: '#22c55e', Worg: '#f97316' };
    const vfxColor = classVfxColors[heroClass] || '#ffffff';

    if (animState === 'ability' && animTimer > 0.01 && animTimer < 0.3) {
      const castProgress = Math.min(1, animTimer / 0.3);
      const castColor = heroClass === 'Mage' ? '#8b5cf6' : heroClass === 'Ranger' ? '#22c55e' : heroClass === 'Worg' ? '#f97316' : '#ef4444';
      ctx.save();
      ctx.globalAlpha = (1 - castProgress) * 0.5;
      drawCastingCircle(ctx, x, groundY + 2, 16, castColor, castProgress, time);
      ctx.restore();
    }

    if ((animState === 'attack' || animState === 'combo_finisher' || animState === 'lunge_slash' || animState === 'dash_attack') && animTimer > 0.03) {
      const isFinisher = animState === 'combo_finisher';

      const trail = this.getWeaponTrail(eid);
      // Weapon leads ahead of facing — sweep arc from -40° to +40° during attack
      const atkProgress = Math.min(1, animTimer / 0.55);
      const sweepArc = Math.PI * 0.44; // ±40° total sweep
      const sweepAngle = facing + (-sweepArc + sweepArc * 2 * atkProgress);
      const weaponReach = 16 + atkProgress * 28;
      const wx = x + Math.cos(sweepAngle) * weaponReach;
      const wy = groundY - 10 + Math.sin(sweepAngle) * weaponReach * 0.5;
      const wz = 8 + Math.sin(atkProgress * Math.PI) * 6;
      trail.addPoint(wx, wy, wz, time);
      trail.update(time);
      drawWeaponTrail(ctx, trail.getPoints(), vfxColor, isFinisher ? 4 : 3, facing);

      // Weapon afterimage ghosts — draw faded copies at older weapon positions
      const pts = trail.getPoints();
      if (pts.length >= 3) {
        ctx.save();
        const ghostCount = Math.min(4, pts.length - 1);
        for (let gi = 1; gi <= ghostCount; gi++) {
          const pt = pts[pts.length - 1 - gi];
          if (!pt) continue;
          const ghostAlpha = (1 - gi / (ghostCount + 1)) * 0.25;
          ctx.globalAlpha = ghostAlpha;
          ctx.strokeStyle = vfxColor;
          ctx.lineWidth = 2.5 - gi * 0.4;
          ctx.shadowColor = vfxColor;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3 + (1 - gi / ghostCount) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    } else {
      const trail = this.weaponTrails.get(eid);
      if (trail) { trail.update(time); if (trail.getPoints().length > 0) drawWeaponTrail(ctx, trail.getPoints(), vfxColor, 2, facing); }
    }

    const model = buildHeroModel(race, heroClass, animState, animTimer, heroName, heroItems, undefined, time);

    if (animState === 'death') {
      let debris = this.deathDebrisCache.get(eid);
      if (!debris) {
        const aliveModel = buildHeroModel(race, heroClass, 'idle', 0, heroName, heroItems);
        debris = this.initDeathDebris(eid, aliveModel, time);
      }
      const elapsed = time - debris.startTime;
      if (elapsed < debris.duration) {
        this.renderDeathDebris(ctx, x, groundY - 12, debris, time, facing);
      } else {
        this.deathDebrisCache.delete(eid);
      }
      return;
    } else {
      this.deathDebrisCache.delete(eid);
    }

    // Use parsed body rendering for combat states (per-part rotation/scale)
    const isCombatAnim = animState === 'attack' || animState === 'combo_finisher' ||
      animState === 'dash_attack' || animState === 'lunge_slash' || animState === 'ability';
    if (isCombatAnim && animTimer > 0.01) {
      const parsed = this.getParsedBody(race, heroClass, heroName);
      const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));
      const motionProfile = getClassMotionProfile(heroClass, weaponType);
      // Pick the combo motion based on current combo step
      let motionName = motionProfile.attackMotion;
      if (animState === 'ability') {
        motionName = motionProfile.abilityMotion;
      } else {
        const plan = globalAnimDirector.planAttack(heroClass, weaponType, eid, facing);
        motionName = plan.motionName;
      }

      const motion = MOTION_LIBRARY[motionName];
      if (motion) {
        const scaledTime = animTimer * (motionProfile.attackSpeed * 1.0);
        const comboPose = sampleMotion(motion, scaledTime);
        this.renderParsedBody(ctx, x, groundY - 12, parsed, comboPose, this.cubeSize, facing);
      } else {
        this.renderVoxelModel(ctx, x, groundY - 12, model, this.cubeSize, facing);
      }
    } else {
      this.renderVoxelModel(ctx, x, groundY - 12, model, this.cubeSize, facing);
    }

    if (animState === 'attack' && animTimer > 0.02) {
      this.drawAttackVFX(ctx, x, groundY, heroClass, facing, animTimer, race);
      const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));
      const aiPlan = globalAnimDirector.planAttack(heroClass, weaponType, eid, facing);
      const atkProgress = Math.min(1, animTimer / aiPlan.duration);
      drawAISlashVFX(ctx, x, groundY - 8, aiPlan, atkProgress, time);
    }
    if (animState === 'ability' && animTimer > 0.02) {
      this.drawAbilityVFX(ctx, x, groundY, heroClass, facing, animTimer);
      const abilityKey = heroClass === 'Mage' ? 'E' : heroClass === 'Ranger' ? 'Q' : 'Q';
      const spellPlan = globalAnimDirector.planSpellVFX(heroClass, abilityKey);
      const abilityProgress = Math.min(1, animTimer / 0.8);
      drawAISpellVFX(ctx, x, groundY - 5, spellPlan, abilityProgress, time);
    }
    if (animState === 'combo_finisher' && animTimer > 0.02) {
      const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));
      const finisherPlan = globalAnimDirector.planAttack(heroClass, weaponType, eid, facing);
      finisherPlan.impactFlash = true;
      finisherPlan.slashWidth *= 1.4;
      finisherPlan.trailIntensity = 2.0;
      const finisherProgress = Math.min(1, animTimer / finisherPlan.duration);
      drawAISlashVFX(ctx, x, groundY - 8, finisherPlan, finisherProgress, time);
    }
    if (animState === 'dash_attack' && animTimer > 0.02) {
      this.drawDashVFX(ctx, x, groundY, heroClass, facing, animTimer);
      const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));
      const dashPlan = globalAnimDirector.planAttack(heroClass, weaponType, eid, facing);
      dashPlan.slashArc *= 0.7;
      const dashProgress = Math.min(1, animTimer / dashPlan.duration);
      drawAISlashVFX(ctx, x, groundY - 8, dashPlan, dashProgress, time);
    }
    if (animState === 'lunge_slash' && animTimer > 0.02) {
      this.drawLungeSlashVFX(ctx, x, groundY, heroClass, facing, animTimer);
      const weaponType = getWeaponRenderType(getHeroWeapon(race, heroClass));
      const lungePlan = globalAnimDirector.planAttack(heroClass, weaponType, eid, facing);
      lungePlan.slashArc *= 1.2;
      lungePlan.screenShake = 4;
      const lungeProgress = Math.min(1, animTimer / lungePlan.duration);
      drawAISlashVFX(ctx, x, groundY - 8, lungePlan, lungeProgress, time);
    }
    if (animState === 'combo_finisher' && animTimer > 0.02) {
      this.drawComboFinisherVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }

    if (shieldHp && shieldHp > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      drawShieldVFX(ctx, x, groundY - 14, shieldHp, 200, time);
      ctx.restore();
    }

    if (activeBuffs && activeBuffs.length > 0) {
      const hasHeal = activeBuffs.some(b => b.includes('heal') || b.includes('Heal') || b.includes('Regen'));
      const hasAtkBuff = activeBuffs.some(b => b.includes('ATK') || b.includes('Fury') || b.includes('Frenzy') || b.includes('Rally'));
      const hasSpeedBuff = activeBuffs.some(b => b.includes('Speed') || b.includes('Haste') || b.includes('Wind'));
      const hasLifesteal = activeBuffs.some(b => b.includes('Lifesteal') || b.includes('Blood'));

      if (hasHeal) drawHealingVFX(ctx, x, groundY - 8, 0.3, time);
      if (hasAtkBuff) drawAuraEffect(ctx, x, groundY - 12, '#ef4444', 0.15, time);
      if (hasSpeedBuff) drawAuraEffect(ctx, x, groundY - 10, '#22d3ee', 0.12, time);
      if (hasLifesteal) drawAuraEffect(ctx, x, groundY - 12, '#dc2626', 0.12, time);
    }
  }

  private drawAttackVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number, race?: string) {
    const atkProgress = Math.min(1, t / 0.65);
    const weaponType = race ? getWeaponRenderType(getHeroWeapon(race, heroClass)) : 'sword_shield';

    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      if (weaponType === 'heavy_axe') {
        const chop = atkProgress >= 0.4 && atkProgress < 0.65 ? (atkProgress - 0.4) / 0.25 : 0;
        const followThru = atkProgress >= 0.65 ? Math.min(1, (atkProgress - 0.65) / 0.25) : 0;

        if (chop > 0.05) {
          ctx.save();
          ctx.translate(x, y - 10);
          const chopDist = 20 + chop * 25;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 5 + chop * 4;
          ctx.globalAlpha = 0.8 + chop * 0.2;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 14 + chop * 12;
          const chopAngle = facing;
          ctx.beginPath();
          ctx.moveTo(Math.cos(chopAngle) * 5, Math.sin(chopAngle) * 5 - 15 + chop * 15);
          ctx.lineTo(Math.cos(chopAngle) * chopDist, Math.sin(chopAngle) * chopDist + chop * 10);
          ctx.stroke();

          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(chopAngle - 0.2) * 8, Math.sin(chopAngle - 0.2) * 8 - 12 + chop * 12);
          ctx.lineTo(Math.cos(chopAngle - 0.1) * (chopDist - 5), Math.sin(chopAngle - 0.1) * (chopDist - 5) + chop * 8);
          ctx.stroke();

          if (chop > 0.7) {
            const impactX = Math.cos(chopAngle) * chopDist;
            const impactY = Math.sin(chopAngle) * chopDist;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2;
            ctx.globalAlpha = (1 - chop) * 3;
            ctx.beginPath();
            ctx.arc(impactX, impactY + chop * 10, 8 + chop * 12, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        if (followThru > 0 && followThru < 0.7) {
          ctx.save();
          ctx.translate(x, y - 5);
          const fadeAlpha = Math.max(0, (0.7 - followThru) * 1.8);
          const impactX = Math.cos(facing) * 30;
          const impactY = Math.sin(facing) * 30;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.globalAlpha = fadeAlpha * 0.5;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8;
          const shockRadius = 8 + followThru * 25;
          ctx.beginPath();
          ctx.arc(impactX, impactY, shockRadius, 0, Math.PI * 2);
          ctx.stroke();
          const slamSeed = Math.floor(t * 10);
          for (let i = 0; i < 5; i++) {
            const sa = vfxSeededRand(slamSeed + i * 7) * Math.PI * 2;
            const sd = shockRadius * 0.5 + vfxSeededRand(slamSeed + i * 13 + 3) * shockRadius * 0.5;
            ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#ef4444';
            ctx.globalAlpha = fadeAlpha * 0.4;
            ctx.beginPath();
            ctx.arc(impactX + Math.cos(sa) * sd, impactY + Math.sin(sa) * sd, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      } else if (weaponType === 'spear') {
        const thrust = atkProgress >= 0.3 && atkProgress < 0.55 ? (atkProgress - 0.3) / 0.25 : 0;
        const retract = atkProgress >= 0.55 ? Math.min(1, (atkProgress - 0.55) / 0.3) : 0;

        if (thrust > 0.05) {
          ctx.save();
          ctx.translate(x, y - 10);
          const thrustDist = 15 + thrust * 35;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 3 + thrust * 3;
          ctx.globalAlpha = 0.7 + thrust * 0.3;
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 10 + thrust * 8;
          ctx.beginPath();
          ctx.moveTo(Math.cos(facing) * 5, Math.sin(facing) * 5);
          ctx.lineTo(Math.cos(facing) * thrustDist, Math.sin(facing) * thrustDist);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = thrust * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(facing) * 8, Math.sin(facing) * 8);
          ctx.lineTo(Math.cos(facing) * (thrustDist - 3), Math.sin(facing) * (thrustDist - 3));
          ctx.stroke();

          if (thrust > 0.6) {
            const tipX = Math.cos(facing) * thrustDist;
            const tipY = Math.sin(facing) * thrustDist;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = (thrust - 0.6) * 2.5;
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(tipX, tipY, 3 + thrust * 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        if (retract > 0 && retract < 0.6) {
          ctx.save();
          ctx.translate(x, y - 10);
          const fadeAlpha = Math.max(0, (0.6 - retract) * 2);
          const tipX = Math.cos(facing) * 45;
          const tipY = Math.sin(facing) * 45;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = fadeAlpha * 0.4;
          ctx.beginPath();
          ctx.arc(tipX, tipY, 5 + retract * 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      } else if (weaponType === 'war_hammer') {
        const slam = atkProgress >= 0.45 && atkProgress < 0.65 ? (atkProgress - 0.45) / 0.2 : 0;
        const followThru = atkProgress >= 0.65 ? Math.min(1, (atkProgress - 0.65) / 0.25) : 0;

        if (slam > 0.3) {
          ctx.save();
          ctx.translate(x, y - 5);
          const impactX = Math.cos(facing) * (15 + slam * 20);
          const impactY = Math.sin(facing) * (15 + slam * 20);

          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 4 + slam * 4;
          ctx.globalAlpha = slam * 0.9;
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 15 + slam * 10;
          ctx.beginPath();
          ctx.moveTo(0, -10 + slam * 10);
          ctx.lineTo(impactX, impactY);
          ctx.stroke();

          if (slam > 0.7) {
            const shockRadius = (slam - 0.7) * 60;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
            ctx.globalAlpha = (1 - slam) * 3;
            ctx.beginPath();
            ctx.arc(impactX, impactY, shockRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = (1 - slam) * 2;
            ctx.beginPath();
            ctx.arc(impactX, impactY, shockRadius * 1.5, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }

        if (followThru > 0 && followThru < 0.8) {
          ctx.save();
          ctx.translate(x, y - 2);
          const fadeAlpha = Math.max(0, (0.8 - followThru) * 1.5);
          const impactX = Math.cos(facing) * 35;
          const impactY = Math.sin(facing) * 35;
          const waveRadius = 15 + followThru * 40;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = fadeAlpha * 0.5;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(impactX, impactY, waveRadius, 0, Math.PI * 2);
          ctx.stroke();

          for (let c = 0; c < 6; c++) {
            const ca = (c / 6) * Math.PI * 2;
            const cLen = 8 + followThru * 20;
            ctx.strokeStyle = '#fde68a';
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = fadeAlpha * 0.3;
            ctx.beginPath();
            ctx.moveTo(impactX, impactY);
            ctx.lineTo(impactX + Math.cos(ca) * cLen, impactY + Math.sin(ca) * cLen);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      } else {
      // Enhanced weapon-leading slash arc — wider, more aggressive
      const swing = atkProgress >= 0.25 && atkProgress < 0.55 ? (atkProgress - 0.25) / 0.3 : 0;
      const followThru = atkProgress >= 0.55 ? Math.min(1, (atkProgress - 0.55) / 0.3) : 0;
      const primaryColor = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
      const secondaryColor = heroClass === 'Warrior' ? '#fca5a5' : '#fdba74';

      if (swing > 0.05) {
        ctx.save();
        ctx.translate(x, y - 10);

        const arcStart = facing - Math.PI * 0.85;
        const arcEnd = facing + Math.PI * 0.65;
        const arcAngle = arcStart + (arcEnd - arcStart) * swing;
        const reachDist = 28 + swing * 24;

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 4 + swing * 3;
        ctx.globalAlpha = 0.8 + swing * 0.2;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 12 + swing * 10;
        ctx.beginPath();
        ctx.arc(0, 0, reachDist, arcStart, arcAngle);
        ctx.stroke();

        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, reachDist + 5, arcStart + 0.05, arcAngle - 0.05);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3 + swing * 0.2;
        ctx.beginPath();
        ctx.arc(0, 0, reachDist + 10, arcStart + 0.15, arcAngle - 0.15);
        ctx.stroke();

        if (swing > 0.5) {
          const sparkCount = 6;
          const swingSeed = Math.floor(t * 10) + 50;
          for (let s = 0; s < sparkCount; s++) {
            const sa = arcAngle - s * 0.12;
            const sr = reachDist + (vfxSeededRand(swingSeed + s * 11) - 0.5) * 12;
            const sx = Math.cos(sa) * sr;
            const sy = Math.sin(sa) * sr;
            ctx.fillStyle = s % 2 === 0 ? '#ffffff' : secondaryColor;
            ctx.globalAlpha = (1 - swing) * 2.5;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0.1, 1.5 + vfxSeededRand(swingSeed + s * 17 + 5) * 1.5), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (followThru > 0 && followThru < 0.7) {
        ctx.save();
        ctx.translate(x, y - 10);
        const fadeAlpha = Math.max(0, (0.7 - followThru) * 1.8);

        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = fadeAlpha * 0.6;
        ctx.shadowColor = primaryColor;
        ctx.shadowBlur = 6;
        const fullArcStart = facing - Math.PI * 0.75;
        const fullArcEnd = facing + Math.PI * 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, 38 + followThru * 8, fullArcStart, fullArcEnd);
        ctx.stroke();

        const shockRadius = 10 + followThru * 30;
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = fadeAlpha * 0.35;
        ctx.beginPath();
        ctx.arc(Math.cos(facing) * 20, Math.sin(facing) * 20, shockRadius, 0, Math.PI * 2);
        ctx.stroke();

        const followSeed = Math.floor(t * 10) + 200;
        for (let i = 0; i < 4; i++) {
          const fr1 = vfxSeededRand(followSeed + i * 7);
          const fr2 = vfxSeededRand(followSeed + i * 13 + 3);
          const fr3 = vfxSeededRand(followSeed + i * 19 + 7);
          const sparkAngle = facing + (fr1 - 0.5) * 1.2;
          const sparkDist = 20 + followThru * 25 + fr2 * 10;
          ctx.fillStyle = '#fde68a';
          ctx.globalAlpha = fadeAlpha * 0.5;
          ctx.beginPath();
          ctx.arc(Math.cos(sparkAngle) * sparkDist, Math.sin(sparkAngle) * sparkDist, Math.max(0.1, 1 + fr3), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      }
    }

    if (heroClass === 'Ranger') {
      const draw = atkProgress < 0.45 ? atkProgress / 0.45 : 1;
      const release = atkProgress >= 0.55 ? Math.min(1, (atkProgress - 0.55) / 0.15) : 0;
      const recoil = atkProgress >= 0.7 ? (atkProgress - 0.7) / 0.3 : 0;

      ctx.save();
      ctx.translate(x, y - 8);

      if (draw > 0.1 && release < 0.5) {
        const drawBack = draw * 8;
        const stringColor = draw > 0.7 ? '#ffd700' : '#aaaaaa';
        ctx.strokeStyle = stringColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.8;
        const bowCx = Math.cos(facing) * 10;
        const bowCy = Math.sin(facing) * 10;
        const pullX = bowCx - Math.cos(facing) * drawBack;
        const pullY = bowCy - Math.sin(facing) * drawBack;
        ctx.beginPath();
        ctx.moveTo(bowCx + Math.cos(facing + Math.PI / 2) * 8, bowCy + Math.sin(facing + Math.PI / 2) * 8);
        ctx.lineTo(pullX, pullY);
        ctx.lineTo(bowCx + Math.cos(facing - Math.PI / 2) * 8, bowCy + Math.sin(facing - Math.PI / 2) * 8);
        ctx.stroke();

        if (draw > 0.3) {
          ctx.strokeStyle = '#c5a059';
          ctx.lineWidth = 2;
          ctx.globalAlpha = draw * 0.9;
          const arrowLen = 12;
          const arrowTip = bowCx + Math.cos(facing) * arrowLen;
          const arrowTipY = bowCy + Math.sin(facing) * arrowLen;
          ctx.beginPath();
          ctx.moveTo(pullX - Math.cos(facing) * 3, pullY - Math.sin(facing) * 3);
          ctx.lineTo(arrowTip, arrowTipY);
          ctx.stroke();

          ctx.fillStyle = '#888888';
          ctx.beginPath();
          ctx.moveTo(arrowTip, arrowTipY);
          ctx.lineTo(arrowTip - Math.cos(facing - 0.4) * 4, arrowTipY - Math.sin(facing - 0.4) * 4);
          ctx.lineTo(arrowTip - Math.cos(facing + 0.4) * 4, arrowTipY - Math.sin(facing + 0.4) * 4);
          ctx.fill();
        }

        if (draw > 0.8) {
          ctx.fillStyle = '#ffd700';
          ctx.globalAlpha = (draw - 0.8) * 5 * (0.5 + Math.sin(t * 30) * 0.5);
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(bowCx + Math.cos(facing) * 12, bowCy + Math.sin(facing) * 12, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (release > 0) {
        const arrowDist = release * 55 + recoil * 25;
        const arrowX = Math.cos(facing) * (14 + arrowDist);
        const arrowY = Math.sin(facing) * (14 + arrowDist);
        const fadeAlpha = Math.max(0, 1 - recoil * 1.3);

        if (fadeAlpha > 0) {
          const trailLen = 14 + release * 16;
          for (let trail = 0; trail < 3; trail++) {
            const trailOffset = trail * 3;
            const trailAlpha = fadeAlpha * (1 - trail * 0.25);
            ctx.strokeStyle = trail === 0 ? '#22c55e' : trail === 1 ? '#4ade80' : '#86efac';
            ctx.lineWidth = 3 - trail * 0.7;
            ctx.globalAlpha = trailAlpha;
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 8 - trail * 2;
            ctx.beginPath();
            ctx.moveTo(arrowX - Math.cos(facing) * (trailLen + trailOffset), arrowY - Math.sin(facing) * (trailLen + trailOffset));
            ctx.lineTo(arrowX, arrowY);
            ctx.stroke();
          }

          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = fadeAlpha;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(arrowX + Math.cos(facing) * 5, arrowY + Math.sin(facing) * 5);
          ctx.lineTo(arrowX + Math.cos(facing - 0.5) * -4, arrowY + Math.sin(facing - 0.5) * -4);
          ctx.lineTo(arrowX + Math.cos(facing + 0.5) * -4, arrowY + Math.sin(facing + 0.5) * -4);
          ctx.fill();

          if (recoil > 0.3 && recoil < 0.8) {
            const impactProgress = (recoil - 0.3) / 0.5;
            const impactRadius = 5 + impactProgress * 15;
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.globalAlpha = (1 - impactProgress) * 0.6;
            ctx.beginPath();
            ctx.arc(arrowX, arrowY, impactRadius, 0, Math.PI * 2);
            ctx.stroke();

            const arrowSeed = Math.floor(t * 10) + 300;
            for (let s = 0; s < 4; s++) {
              const sa = facing + (s - 1.5) * 0.6;
              const sd = impactRadius + vfxSeededRand(arrowSeed + s * 11) * 5;
              ctx.fillStyle = '#bbf7d0';
              ctx.globalAlpha = (1 - impactProgress) * 0.5;
              ctx.beginPath();
              ctx.arc(arrowX + Math.cos(sa) * sd, arrowY + Math.sin(sa) * sd, Math.max(0.1, 1 + vfxSeededRand(arrowSeed + s * 17 + 5)), 0, Math.PI * 2);
              ctx.fill();
            }
          }

          ctx.shadowBlur = 0;
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (heroClass === 'Mage') {
      const raise = atkProgress < 0.4 ? atkProgress / 0.4 : 1;
      const channel = atkProgress >= 0.25 && atkProgress < 0.55 ? Math.min(1, (atkProgress - 0.25) / 0.3) : 0;
      const cast = atkProgress >= 0.5 ? Math.min(1, (atkProgress - 0.5) / 0.15) : 0;
      const recover = atkProgress >= 0.75 ? (atkProgress - 0.75) / 0.25 : 0;

      ctx.save();
      ctx.translate(x, y - 14);

      const orbX = Math.cos(facing) * (8 + cast * 6);
      const orbY = Math.sin(facing) * (8 + cast * 6) - 12 - raise * 8;

      if (channel > 0.1 || cast > 0) {
        const orbGlow = Math.max(channel, cast);
        const orbRadius = 3 + orbGlow * 4;
        const orbColor = '#9333ea';

        const grd = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, orbRadius + 4);
        grd.addColorStop(0, 'rgba(147,51,234,0.8)');
        grd.addColorStop(0.5, 'rgba(147,51,234,0.3)');
        grd.addColorStop(1, 'rgba(147,51,234,0)');
        ctx.fillStyle = grd;
        ctx.globalAlpha = orbGlow;
        ctx.fillRect(orbX - orbRadius - 4, orbY - orbRadius - 4, (orbRadius + 4) * 2, (orbRadius + 4) * 2);

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = orbGlow * 0.9;
        ctx.shadowColor = orbColor;
        ctx.shadowBlur = 10 + orbGlow * 8;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = orbColor;
        ctx.beginPath();
        ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (channel > 0.3) {
          const runeRadius = 12 + channel * 8;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = channel * 0.6;
          const runeRot = t * 8;
          ctx.beginPath();
          ctx.arc(orbX, orbY, runeRadius, runeRot, runeRot + Math.PI * 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(orbX, orbY, runeRadius * 0.65, runeRot + Math.PI, runeRot + Math.PI * 2.2);
          ctx.stroke();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = channel * 0.35;
          ctx.beginPath();
          ctx.arc(orbX, orbY, runeRadius * 1.3, -runeRot * 0.7, -runeRot * 0.7 + Math.PI * 1.2);
          ctx.stroke();
        }

        const orbCount = Math.floor(channel * 3);
        for (let o = 0; o < orbCount; o++) {
          const orbAngle = t * 5 + o * (Math.PI * 2 / Math.max(1, orbCount));
          const orbDist = 8 + channel * 6;
          const ox = orbX + Math.cos(orbAngle) * orbDist;
          const oy = orbY + Math.sin(orbAngle) * orbDist;
          ctx.fillStyle = '#c084fc';
          ctx.globalAlpha = 0.7;
          ctx.shadowColor = '#a855f7';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(ox, oy, 2 + channel, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        const sparkCount = Math.floor(channel * 5 + cast * 4);
        for (let s = 0; s < sparkCount; s++) {
          const sa = t * 6 + s * (Math.PI * 2 / Math.max(1, sparkCount));
          const sr = orbRadius + 2 + Math.sin(t * 12 + s) * 5;
          ctx.fillStyle = s % 2 === 0 ? '#e9d5ff' : '#a855f7';
          ctx.globalAlpha = 0.5 + Math.sin(t * 10 + s * 2) * 0.3;
          ctx.beginPath();
          ctx.arc(orbX + Math.cos(sa) * sr, orbY + Math.sin(sa) * sr, Math.max(0.1, 1.2 + vfxSeededRand(Math.floor(t * 10) + s * 7) * 0.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (cast > 0.3 && recover < 0.6) {
        const castDist = (cast - 0.3) * 1.4 * 40;
        const castX = orbX + Math.cos(facing) * castDist;
        const castY = orbY + Math.sin(facing) * castDist;
        const castAlpha = Math.max(0, 1 - recover * 1.8);

        if (castAlpha > 0) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.globalAlpha = castAlpha * 0.7;
          ctx.shadowColor = '#9333ea';
          ctx.shadowBlur = 10;

          const burstRadius = 5 + cast * 12;
          ctx.beginPath();
          ctx.arc(castX, castY, burstRadius, 0, Math.PI * 2);
          ctx.stroke();

          const waveRadius = burstRadius + 4 + recover * 20;
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = castAlpha * 0.4;
          ctx.beginPath();
          ctx.arc(castX, castY, waveRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = castAlpha * 0.9;
          ctx.beginPath();
          ctx.arc(castX, castY, 3, 0, Math.PI * 2);
          ctx.fill();

          for (let r = 0; r < 6; r++) {
            const rayAngle = (Math.PI * 2 / 6) * r + t * 4;
            const rayLen = burstRadius * 0.8;
            ctx.strokeStyle = '#e9d5ff';
            ctx.lineWidth = 1;
            ctx.globalAlpha = castAlpha * 0.35;
            ctx.beginPath();
            ctx.moveTo(castX, castY);
            ctx.lineTo(castX + Math.cos(rayAngle) * rayLen, castY + Math.sin(rayAngle) * rayLen);
            ctx.stroke();
          }

          ctx.shadowBlur = 0;
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private drawAbilityVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number) {
    const pulse = (Math.sin(t * 8) + 1) * 0.5;
    const channel = Math.min(1, t * 4);

    ctx.save();
    ctx.translate(x, y - 6);

    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      const auraColor = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
      const auraRadius = 14 + pulse * 8 + channel * 4;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3 + pulse * 0.3;
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(0, -4, auraRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (channel > 0.5) {
        ctx.lineWidth = 1;
        ctx.globalAlpha = (channel - 0.5) * 0.6;
        ctx.beginPath();
        ctx.arc(0, -4, auraRadius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      const spikeCount = 6;
      for (let s = 0; s < spikeCount; s++) {
        const sa = (s / spikeCount) * Math.PI * 2 + t * 3;
        const sLen = 4 + pulse * 6;
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4 + pulse * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * auraRadius, Math.sin(sa) * auraRadius - 4);
        ctx.lineTo(Math.cos(sa) * (auraRadius + sLen), Math.sin(sa) * (auraRadius + sLen) - 4);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    if (heroClass === 'Ranger') {
      const trapRadius = 8 + channel * 10;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.4 + pulse * 0.3;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 4;

      const rot = t * 4;
      for (let i = 0; i < 3; i++) {
        const a = rot + i * (Math.PI * 2 / 3);
        ctx.beginPath();
        ctx.arc(0, 0, trapRadius, a, a + Math.PI * 0.4);
        ctx.stroke();
      }

      if (pulse > 0.5) {
        for (let i = 0; i < 4; i++) {
          const sa = t * 5 + i * Math.PI * 0.5;
          const sr = trapRadius * 0.6;
          ctx.fillStyle = '#4ade80';
          ctx.globalAlpha = (pulse - 0.5) * 0.8;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }

    if (heroClass === 'Mage') {
      const runeRadius = 16 + channel * 10;
      const rot = t * 3;
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.3 + channel * 0.4;
      ctx.shadowColor = '#9333ea';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.arc(0, 0, runeRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, runeRadius * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      const glyphCount = 6;
      for (let g = 0; g < glyphCount; g++) {
        const ga = rot + g * (Math.PI * 2 / glyphCount);
        const gx = Math.cos(ga) * runeRadius;
        const gy = Math.sin(ga) * runeRadius;
        ctx.fillStyle = '#e9d5ff';
        ctx.globalAlpha = 0.5 + Math.sin(t * 8 + g * 1.5) * 0.3;
        ctx.beginPath();
        ctx.arc(gx, gy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      const innerRot = -rot * 1.5;
      const sides = 5;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3 + pulse * 0.4;
      ctx.beginPath();
      for (let s = 0; s <= sides; s++) {
        const pa = innerRot + s * (Math.PI * 2 / sides);
        const pr = runeRadius * 0.4;
        if (s === 0) ctx.moveTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
        else ctx.lineTo(Math.cos(pa) * pr, Math.sin(pa) * pr);
      }
      ctx.closePath();
      ctx.stroke();

      const castOrbX = Math.cos(facing) * (8 + channel * 4);
      const castOrbY = Math.sin(facing) * (8 + channel * 4) - 16;
      const orbSize = 3 + pulse * 3;
      const grd = ctx.createRadialGradient(castOrbX, castOrbY, 0, castOrbX, castOrbY, orbSize + 3);
      grd.addColorStop(0, 'rgba(255,255,255,0.8)');
      grd.addColorStop(0.4, 'rgba(168,85,247,0.5)');
      grd.addColorStop(1, 'rgba(147,51,234,0)');
      ctx.fillStyle = grd;
      ctx.globalAlpha = channel * 0.8;
      ctx.fillRect(castOrbX - orbSize - 3, castOrbY - orbSize - 3, (orbSize + 3) * 2, (orbSize + 3) * 2);
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawDashVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number) {
    const thrust = Math.min(1, t * 6);
    const extend = Math.sin(thrust * Math.PI);

    if (extend < 0.1) return;

    ctx.save();
    ctx.translate(x, y - 8);

    const trailColor = heroClass === 'Warrior' ? '#ef4444' : heroClass === 'Mage' ? '#8b5cf6' : heroClass === 'Ranger' ? '#22c55e' : '#f97316';
    const trailLen = extend * 25;
    const trailX = Math.cos(facing) * trailLen;
    const trailY = Math.sin(facing) * trailLen;

    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 3;
    ctx.globalAlpha = extend * 0.6;
    ctx.shadowColor = trailColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(facing) * 5, -Math.sin(facing) * 5);
    ctx.lineTo(trailX, trailY);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = extend * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(trailX * 0.7, trailY * 0.7);
    ctx.stroke();

    const sparkAngle = facing + Math.PI;
    const dashSeed = Math.floor(t * 10);
    for (let i = 0; i < 3; i++) {
      const r1 = vfxSeededRand(dashSeed + i * 7);
      const r2 = vfxSeededRand(dashSeed + i * 13 + 3);
      const r3 = vfxSeededRand(dashSeed + i * 19 + 7);
      const sa = sparkAngle + (r1 - 0.5) * 1.2;
      const sd = 3 + r2 * 8;
      ctx.fillStyle = trailColor;
      ctx.globalAlpha = (1 - thrust) * 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, Math.max(0.1, 1 + r3), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawLungeSlashVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number) {
    const progress = Math.min(1, t / 0.4);
    const lunge = progress < 0.4 ? progress / 0.4 : 1;
    const slash = progress >= 0.35 && progress < 0.6 ? (progress - 0.35) / 0.25 : 0;
    const recover = progress >= 0.6 ? (progress - 0.6) / 0.4 : 0;

    const classColor = heroClass === 'Warrior' ? '#ef4444' : heroClass === 'Mage' ? '#8b5cf6' : heroClass === 'Ranger' ? '#22c55e' : '#f97316';

    ctx.save();
    ctx.translate(x, y - 8);

    if (lunge > 0.2 && recover < 0.5) {
      const trailLen = lunge * 30;
      ctx.strokeStyle = classColor;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = (1 - recover * 2) * 0.5;
      ctx.shadowColor = classColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(facing) * 8, -Math.sin(facing) * 8);
      ctx.lineTo(Math.cos(facing) * trailLen, Math.sin(facing) * trailLen);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = lunge * 0.3 * (1 - recover * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(facing) * trailLen * 0.6, Math.sin(facing) * trailLen * 0.6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (slash > 0.05) {
      const slashDist = 20 + slash * 25;
      const arcStart = facing - Math.PI * 0.7;
      const arcEnd = facing + Math.PI * 0.5;
      const arcAngle = arcStart + (arcEnd - arcStart) * slash;

      ctx.strokeStyle = classColor;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.8 + slash * 0.2;
      ctx.shadowColor = classColor;
      ctx.shadowBlur = 10 + slash * 8;
      ctx.beginPath();
      ctx.arc(0, 0, slashDist, arcStart, arcAngle);
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, slashDist + 8, arcStart + 0.15, arcAngle - 0.1);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = slash * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, slashDist - 4, arcStart + 0.3, arcAngle - 0.2);
      ctx.stroke();

      if (slash > 0.4) {
        const lungeSeed = Math.floor(t * 10);
        for (let s = 0; s < 5; s++) {
          const sa = arcAngle - s * 0.12;
          const rs1 = vfxSeededRand(lungeSeed + s * 11);
          const rs2 = vfxSeededRand(lungeSeed + s * 17 + 5);
          const sr = slashDist + (rs1 - 0.5) * 12;
          ctx.fillStyle = s % 2 === 0 ? '#ffffff' : classColor;
          ctx.globalAlpha = (1 - slash) * 1.5;
          ctx.shadowBlur = 3;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, Math.max(0.1, 1.5 + rs2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }

    if (recover > 0 && recover < 0.7) {
      const fadeAlpha = (0.7 - recover) * 1.4;
      const fullArcStart = facing - Math.PI * 0.7;
      const fullArcEnd = facing + Math.PI * 0.5;
      ctx.strokeStyle = classColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fadeAlpha * 0.4;
      ctx.shadowColor = classColor;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 48, fullArcStart, fullArcEnd);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const sparkAngle = facing + Math.PI;
    if (lunge > 0.3 && recover < 0.3) {
      const trailSeed = Math.floor(t * 10) + 100;
      for (let i = 0; i < 3; i++) {
        const rt1 = vfxSeededRand(trailSeed + i * 7);
        const rt2 = vfxSeededRand(trailSeed + i * 13 + 3);
        const rt3 = vfxSeededRand(trailSeed + i * 19 + 7);
        const sa = sparkAngle + (rt1 - 0.5) * 1.0;
        const sd = 4 + rt2 * 10;
        ctx.fillStyle = classColor;
        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, Math.max(0.1, 1 + rt3 * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawComboFinisherVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number) {
    const classColor = heroClass === 'Warrior' ? '#ef4444' : heroClass === 'Mage' ? '#8b5cf6' : heroClass === 'Ranger' ? '#22c55e' : '#f97316';
    const secondaryColor = heroClass === 'Warrior' ? '#fca5a5' : heroClass === 'Mage' ? '#c4b5fd' : heroClass === 'Ranger' ? '#86efac' : '#fdba74';
    const phase = t * 28;
    const power = Math.abs(Math.sin(phase * 0.5));
    const spin = Math.sin(phase);

    ctx.save();
    ctx.translate(x, y - 10);

    const crackCount = 6;
    const crackProgress = Math.min(1, t * 3);
    if (crackProgress > 0.1) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = (1 - crackProgress * 0.6) * 0.6;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 4;
      for (let c = 0; c < crackCount; c++) {
        const ca = (c / crackCount) * Math.PI * 2 + 0.3;
        const cLen = 10 + crackProgress * 25 + Math.sin(c * 1.7) * 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const midX = Math.cos(ca) * cLen * 0.5 + Math.sin(c * 3.1) * 3;
        const midY = Math.sin(ca) * cLen * 0.5 + Math.cos(c * 2.7) * 3;
        ctx.lineTo(midX, midY);
        ctx.lineTo(Math.cos(ca) * cLen, Math.sin(ca) * cLen);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    const shockRadius = 22 + power * 22;
    ctx.strokeStyle = classColor;
    ctx.lineWidth = 3.5 + power * 2.5;
    ctx.globalAlpha = 0.6 + power * 0.4;
    ctx.shadowColor = classColor;
    ctx.shadowBlur = 14 + power * 12;
    const rot = t * 6;
    ctx.beginPath();
    ctx.arc(0, -4, shockRadius, rot, rot + Math.PI * 1.6);
    ctx.stroke();

    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, -4, shockRadius + 10, rot + Math.PI * 0.4, rot + Math.PI * 1.9);
    ctx.stroke();

    const waveRadius = shockRadius + 15 + power * 10;
    ctx.strokeStyle = classColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.2 + power * 0.15;
    ctx.beginPath();
    ctx.arc(0, -4, waveRadius, 0, Math.PI * 2);
    ctx.stroke();

    const spikeCount = 10;
    for (let s = 0; s < spikeCount; s++) {
      const sa = (s / spikeCount) * Math.PI * 2 + rot;
      const sLen = 8 + power * 14 + Math.sin(t * 15 + s * 2) * 4;
      ctx.strokeStyle = s % 3 === 0 ? '#ffd700' : s % 2 === 0 ? classColor : '#ffffff';
      ctx.lineWidth = s % 3 === 0 ? 2.5 : 1.5;
      ctx.globalAlpha = 0.4 + power * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * shockRadius, Math.sin(sa) * shockRadius - 4);
      ctx.lineTo(Math.cos(sa) * (shockRadius + sLen), Math.sin(sa) * (shockRadius + sLen) - 4);
      ctx.stroke();
    }

    if (power > 0.4) {
      for (let s = 0; s < 8; s++) {
        const sa = rot * 2 + s * Math.PI / 4;
        const sr = shockRadius * 0.5 + Math.sin(t * 12 + s) * 8;
        ctx.fillStyle = s % 3 === 0 ? '#ffd700' : s % 2 === 0 ? '#ffffff' : classColor;
        ctx.globalAlpha = power * 0.7;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr - 4, 2 + Math.sin(t * 20 + s) * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const weaponArc = facing + spin * Math.PI * 0.9;
    const weaponDist = 30 + power * 14;
    ctx.strokeStyle = classColor;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.8;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, -4, weaponDist, weaponArc - 0.9, weaponArc + 0.9);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, -4, weaponDist - 4, weaponArc - 0.6, weaponArc + 0.6);
    ctx.stroke();

    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, -4, weaponDist + 6, weaponArc - 0.7, weaponArc + 0.7);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawHeroPortrait(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    width: number, height: number,
    race: string, heroClass: string,
    heroName?: string
  ) {
    const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;

    // Build full idle hero model with per-hero customizations
    const model = buildHeroModel(race, heroClass, 'idle', 0, heroName);

    // Scale to fit: cs=4 for card portraits (>=100px), cs=3 for small thumbnails
    const portraitCs = Math.min(width, height) >= 100 ? 4 : 3;
    const cx = x + Math.floor(width / 2);
    const cy = y + Math.floor(height * 0.68);

    // Clip to portrait bounds and render full-body voxel
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    this.renderVoxelModel(ctx, cx, cy, model, portraitCs, 0.3);
    ctx.restore();

    // Subtle border
    const [br, bg, bb] = hexToRgb(armor.primary);
    ctx.fillStyle = `rgba(${br},${bg},${bb},0.27)`;
    ctx.fillRect(x, y, 1, height);
    ctx.fillRect(x + width - 1, y, 1, height);
    ctx.fillRect(x, y, width, 1);
    ctx.fillRect(x, y + height - 1, width, 1);
  }

  /**
   * Render a hero using the part-based rig system.
   * Each section (head, torso, arms, legs) is drawn separately with its own
   * rotation applied via ctx.rotate() around the joint pivot.
   *
   * @param cx   Character center X (screen, within current transform)
   * @param cy   Character ground Y (feet level)
   * @param rig  Pre-built rig (from buildHeroRig) — reuse across frames
   * @param pose Joint rotation angles (from defaultRigPose / walkRigPose etc)
   * @param cubeSize Voxel cube size — default 1, scale via ctx.scale externally
   */
  drawHeroVoxelRig(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    rig: HeroRig,
    pose: HeroRigPose,
    facing: number,
    cubeSize: number = 1
  ) {
    const dir8 = facingToDir(facing);
    const dir  = dir8 < 4 ? dir8 : dirToCardinal(dir8);
    const order = getRigPartRenderOrder(dir);

    for (const partId of order) {
      const part = rig[partId as RigPartId];
      const transform = pose[partId as RigPartId];
      if (!part || !transform) continue;

      // Attachment point on screen (relative to character root)
      const ax = cx + part.attachX * cubeSize;
      const ay = cy - part.attachY * cubeSize; // attachY is upward

      // Compute model render offset so pivot voxel is at (0,0) in local space
      const [offX, offY] = getPartRenderOffset(part, cubeSize);

      const rotRad = transform.rotX * Math.PI / 180;
      const sc = transform.scale ?? 1;

      ctx.save();
      ctx.translate(ax, ay);
      if (Math.abs(rotRad) > 0.001) ctx.rotate(rotRad);
      if (sc !== 1) ctx.scale(sc, sc);
      this.renderVoxelModel(ctx, offX, offY, part.model, cubeSize, facing);
      ctx.restore();
    }
  }

  drawHeroVoxelCustomPose(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    race: string, heroClass: string, facing: number,
    customPoses: {
      leftLeg: { ox: number; oy: number; oz: number };
      rightLeg: { ox: number; oy: number; oz: number };
      leftArm: { ox: number; oy: number; oz: number };
      rightArm: { ox: number; oy: number; oz: number };
      torso: { ox: number; oy: number; oz: number };
      head: { ox: number; oy: number; oz: number };
      weapon: { ox: number; oy: number; oz: number };
      weaponGlow: number;
    },
    heroName?: string
  ) {
    const groundY = y + 6;
    const model = buildHeroModelWithPoses(race, heroClass, customPoses, heroName);
    this.renderVoxelModel(ctx, x, groundY - 12, model, this.cubeSize, facing);
  }

  drawMinionVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, _size: number,
    facing: number, animTimer: number,
    minionType: string
  ) {
    const model = buildMinionModel(color, minionType, animTimer);
    const scale = minionType === 'siege' || minionType === 'super' ? 3 : 3;
    this.renderVoxelModel(ctx, x, y - 6, model, scale, facing);
  }

  drawJungleMobVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    mobType: string,
    facing: number, animTimer: number
  ) {
    const model = buildJungleMobModel(mobType, animTimer);
    const scale = mobType === 'buff' ? 3 : mobType === 'medium' ? 3 : 3;
    const yOff = mobType === 'buff' ? -16 : mobType === 'medium' ? -8 : -4;
    this.renderVoxelModel(ctx, x, y + yOff, model, scale, facing);
  }

  drawTowerVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string, tier: number) {
    const model = buildTowerModel(teamColor, tier);
    this.renderVoxelModel(ctx, x, y - 40, model, 3, 0);
  }

  drawNexusVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildNexusModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 20, model, 4, 0);
  }

  drawTreeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const cacheKey = `tree_${seed % 6}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 60;
      offscreen.height = 80;
      const oc = offscreen.getContext('2d')!;
      const model = buildTreeModel(seed % 6);
      this.renderVoxelModel(oc, 30, 60, model, 3, 0);
      return offscreen;
    });
    ctx.drawImage(cached, x - 30, y - 60);
  }

  drawCampfireVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, animTimer: number) {
    const model = buildCampfireModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 12, model, 3, 0);
  }

  drawRockVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const cacheKey = `rock_${seed % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 30;
      offscreen.height = 30;
      const oc = offscreen.getContext('2d')!;
      const model = buildRockModel(seed % 4);
      this.renderVoxelModel(oc, 15, 20, model, 2, 0);
      return offscreen;
    });
    ctx.drawImage(cached, x - 15, y - 20);
  }

  // ── New Tree draws ──
  drawPineTreeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildPineTreeModel(seed);
    this.renderVoxelModel(ctx, x, y - 40, model, 3, 0);
  }
  drawWillowVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildWillowModel(seed);
    this.renderVoxelModel(ctx, x, y - 30, model, 3, 0);
  }
  drawPalmVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildPalmModel(seed);
    this.renderVoxelModel(ctx, x, y - 40, model, 3, 0);
  }
  drawDeadTreeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildDeadTreeModel(seed);
    this.renderVoxelModel(ctx, x, y - 28, model, 3, 0);
  }
  drawMushroomTreeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildMushroomTreeModel(seed);
    this.renderVoxelModel(ctx, x, y - 26, model, 3, 0);
  }
  // ── New Rock draws ──
  drawCrystalRockVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildCrystalRockModel(seed);
    this.renderVoxelModel(ctx, x, y - 20, model, 3, 0);
  }
  drawMossyBoulderVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildMossyBoulderModel(seed);
    this.renderVoxelModel(ctx, x, y - 10, model, 3, 0);
  }
  drawStalagmiteVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildStalagmiteModel(seed);
    this.renderVoxelModel(ctx, x, y - 26, model, 3, 0);
  }
  // ── Mountain draws ──
  drawMountainPeakVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildMountainPeakModel();
    this.renderVoxelModel(ctx, x, y - 44, model, 3, 0);
  }
  drawCliffVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildCliffModel();
    this.renderVoxelModel(ctx, x, y - 32, model, 3, 0);
  }
  drawMesaVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildMesaModel();
    this.renderVoxelModel(ctx, x, y - 20, model, 3, 0);
  }
  drawHillVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildHillModel();
    this.renderVoxelModel(ctx, x, y - 14, model, 3, 0);
  }
  // ── Terrain prop draws ──
  drawBushVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildBushModel(seed);
    this.renderVoxelModel(ctx, x, y - 6, model, 3, 0);
  }
  drawFlowerPatchVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildFlowerPatchModel(seed);
    this.renderVoxelModel(ctx, x, y - 6, model, 3, 0);
  }
  drawGrassTuftVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildGrassTuftModel(seed);
    this.renderVoxelModel(ctx, x, y - 8, model, 3, 0);
  }
  drawMushroomClusterVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const model = buildMushroomClusterModel(seed);
    this.renderVoxelModel(ctx, x, y - 6, model, 3, 0);
  }
  drawBarrelVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildBarrelModel();
    this.renderVoxelModel(ctx, x, y - 8, model, 3, 0);
  }
  drawHayBaleVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildHayBaleModel();
    this.renderVoxelModel(ctx, x, y - 6, model, 3, 0);
  }
  // ── New Structure draws ──
  drawHouseVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildHouseModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 20, model, 3, 0);
  }
  drawBridgeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildBridgeModel();
    this.renderVoxelModel(ctx, x, y - 8, model, 3, 0);
  }
  drawWellVoxel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const model = buildWellModel();
    this.renderVoxelModel(ctx, x, y - 14, model, 3, 0);
  }
  drawShrineVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildShrineModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 16, model, 3, 0);
  }
  drawGateVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildGateModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 26, model, 3, 0);
  }
  drawWallSegmentVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildWallSegmentModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 14, model, 3, 0);
  }
  // ── Animal draws ──
  drawDeerVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, animTimer: number) {
    const model = buildDeerModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 16, model, 3, facing);
  }
  drawBoarVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, animTimer: number) {
    const model = buildBoarModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 8, model, 3, facing);
  }
  drawHorseVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, animTimer: number) {
    const model = buildHorseModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 20, model, 3, facing);
  }
  drawHawkVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, animTimer: number) {
    const model = buildHawkModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 8, model, 3, facing);
  }
  drawFishVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, animTimer: number) {
    const model = buildFishModel(animTimer);
    this.renderVoxelModel(ctx, x, y - 4, model, 3, facing);
  }

  drawTerrainTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, terrain: TerrainType, tileX: number, tileY: number) {
    const cacheKey = `terrain_${terrain}_${tileX % 4}_${tileY % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = tileSize;
      offscreen.height = tileSize;
      const oc = offscreen.getContext('2d')!;
      this.renderTerrainOnCanvas(oc, tileSize, terrain, tileX, tileY);
      return offscreen;
    });
    ctx.drawImage(cached, x, y);
  }

  drawDungeonTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileType: DungeonTileVoxelType, tileX: number, tileY: number) {
    const cacheKey = `dng_${tileType}_${tileX % 4}_${tileY % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = tileSize;
      offscreen.height = tileSize + (tileType === 'wall' ? 16 : 0);
      const oc = offscreen.getContext('2d')!;
      this.renderDungeonTileOnCanvas(oc, tileSize, tileType, tileX, tileY);
      return offscreen;
    });
    const yOff = tileType === 'wall' ? -16 : 0;
    ctx.drawImage(cached, x, y + yOff);
  }

  drawEnemyVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, enemyType: string, facing: number, animState: string, animTimer: number, size: number, isBoss: boolean) {
    ctx.save();
    ctx.translate(x, y);

    const t = animTimer;
    const bob = Math.sin(t * 3) * 2;
    const isAttacking = animState === 'attack';
    const atkPhase = isAttacking ? Math.min(1, (t % 0.8) / 0.8) : 0;
    const facingFlip = Math.cos(facing) < 0 ? -1 : 1;
    const scale = size / 12;

    const setV = (px: number, py: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(px * scale, py * scale + bob, w * scale, h * scale);
    };

    if (isBoss) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4 + Math.sin(t * 4) * 0.2;
      ctx.beginPath();
      ctx.arc(0, bob, size + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.scale(facingFlip, 1);

    switch (enemyType) {
      case 'Slime': {
        const squash = 1 + Math.sin(t * 5) * 0.15;
        const stretch = 1 / squash;
        ctx.scale(squash, stretch);
        setV(-6, -4, 12, 8, '#22c55e');
        setV(-5, -6, 10, 3, '#2dd460');
        setV(-4, -7, 8, 2, '#34d968');
        setV(-2, 3, 8, 2, '#1a9e48');
        setV(-7, 0, 2, 3, '#1a9e48');
        setV(5, 0, 2, 3, '#1a9e48');
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-2, -2 + bob, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -2 + bob, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-2, -1.5 + bob, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -1.5 + bob, 1, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-3, -5, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'Skeleton': {
        const walk = Math.sin(t * 4) * 3;
        setV(-2, -12, 4, 4, '#e8e0d4');
        setV(-3, -13, 6, 2, '#d4ccc0');
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect((-1) * scale, (-11) * scale + bob, 1 * scale, 1 * scale);
        ctx.fillRect((2) * scale, (-11) * scale + bob, 1 * scale, 1 * scale);
        setV(-3, -8, 6, 6, '#d4ccc0');
        setV(-2, -7, 4, 1, '#c0b8ac');
        setV(-1, -5, 2, 1, '#c0b8ac');
        setV(-4, -8, 2, 4, '#c8c0b4');
        setV(2, -8, 2, 4, '#c8c0b4');
        const armSwing = isAttacking ? Math.sin(atkPhase * Math.PI) * 6 : walk * 0.5;
        setV(-5, -8 + armSwing, 1, 5, '#c0b8ac');
        setV(4, -8 - armSwing, 1, 5, '#c0b8ac');
        setV(-1, -2, 1, 6, '#c0b8ac');
        setV(1, -2, 1, 6, '#c0b8ac');
        if (isAttacking) {
          setV(4 + atkPhase * 4, -10, 2, 8, '#a0a0a0');
        } else {
          setV(5, -6, 1, 6, '#a0a0a0');
        }
        break;
      }
      case 'Orc Grunt': {
        const walk = Math.sin(t * 3.5) * 2;
        setV(-3, -14, 6, 6, '#5a8a2a');
        setV(-4, -15, 8, 3, '#4a7a1a');
        ctx.fillStyle = '#fff';
        ctx.fillRect((-2) * scale, (-13) * scale + bob, 2 * scale, 1 * scale);
        ctx.fillRect((1) * scale, (-13) * scale + bob, 2 * scale, 1 * scale);
        setV(-1, -9, 1, 2, '#e0d0a0');
        setV(1, -9, 1, 2, '#e0d0a0');
        setV(-4, -8, 8, 7, '#6b4423');
        setV(-5, -7, 10, 5, '#7a5533');
        const armSwing = isAttacking ? Math.sin(atkPhase * Math.PI) * 8 : walk;
        setV(-6, -8 + armSwing, 2, 6, '#5a8a2a');
        setV(4, -8 - armSwing, 2, 6, '#5a8a2a');
        setV(-2, -1, 2, 6, '#5a8a2a');
        setV(1, -1, 2, 6, '#5a8a2a');
        if (isAttacking) {
          setV(6, -14 + atkPhase * 4, 2, 10, '#a0a0a0');
          setV(5, -14 + atkPhase * 4, 1, 3, '#7a5533');
        } else {
          setV(6, -8, 2, 8, '#a0a0a0');
        }
        break;
      }
      case 'Dark Mage': {
        const hover = Math.sin(t * 2) * 3;
        const orbGlow = 0.5 + Math.sin(t * 6) * 0.3;
        ctx.save();
        ctx.translate(0, hover);
        setV(-3, -14, 6, 4, '#2d1b4e');
        setV(-4, -16, 8, 4, '#3d2b5e');
        setV(-5, -17, 10, 2, '#4d3b6e');
        ctx.fillStyle = '#a855f7';
        ctx.fillRect((-1) * scale, (-13) * scale + bob, 1 * scale, 1 * scale);
        ctx.fillRect((2) * scale, (-13) * scale + bob, 1 * scale, 1 * scale);
        setV(-5, -10, 10, 10, '#2d1b4e');
        setV(-6, -8, 12, 6, '#3d2b5e');
        setV(-4, 0, 8, 4, '#2d1b4e');
        const armSwing = isAttacking ? Math.sin(atkPhase * Math.PI) * 6 : Math.sin(t * 2) * 2;
        setV(-7, -10 + armSwing, 2, 5, '#3d2b5e');
        setV(5, -10 - armSwing, 2, 5, '#3d2b5e');
        ctx.globalAlpha = orbGlow;
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(6 * scale, (-12 + armSwing) * scale + bob, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        setV(6, -10 - armSwing, 1, 12, '#5a3a1a');
        ctx.restore();
        break;
      }
      case 'Spider': {
        const scuttle = Math.sin(t * 8) * 1.5;
        setV(-4, -4, 8, 6, '#44403c');
        setV(-3, -6, 6, 3, '#57534e');
        setV(-2, -2, 4, 4, '#3a3632');
        ctx.fillStyle = '#dc2626';
        ctx.beginPath(); ctx.arc(-2 * scale, -5 * scale + bob, 1.2 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2 * scale, -5 * scale + bob, 1.2 * scale, 0, Math.PI * 2); ctx.fill();
        for (let leg = 0; leg < 4; leg++) {
          const legAngle = (leg / 4) * Math.PI * 0.6 + 0.3;
          const legBob = Math.sin(t * 8 + leg * 1.5) * 2;
          const lx = Math.cos(legAngle) * 8;
          const ly = Math.sin(legAngle) * 3 + legBob;
          ctx.strokeStyle = '#57534e';
          ctx.lineWidth = 1.5 * scale;
          ctx.beginPath();
          ctx.moveTo(-3 * scale, (-2 + ly * 0.3) * scale + bob);
          ctx.quadraticCurveTo((-3 - lx * 0.5) * scale, (-4 + ly * 0.5) * scale + bob, (-3 - lx) * scale, (ly) * scale + bob);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(3 * scale, (-2 + ly * 0.3) * scale + bob);
          ctx.quadraticCurveTo((3 + lx * 0.5) * scale, (-4 + ly * 0.5) * scale + bob, (3 + lx) * scale, (ly) * scale + bob);
          ctx.stroke();
        }
        break;
      }
      case 'Golem': {
        const rumble = Math.sin(t * 2.5) * 1;
        const armSwing = isAttacking ? Math.sin(atkPhase * Math.PI) * 10 : rumble;
        setV(-5, -16, 10, 8, '#92714a');
        setV(-6, -18, 12, 5, '#7a5e3a');
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(-2 * scale, -15 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3 * scale, -15 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        setV(-7, -8, 14, 10, '#a3845a');
        setV(-6, -6, 12, 6, '#92714a');
        ctx.fillStyle = '#f59e0b';
        ctx.globalAlpha = 0.6 + Math.sin(t * 4) * 0.2;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -3 * scale + bob, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        setV(-9, -8 + armSwing, 3, 8, '#7a5e3a');
        setV(6, -8 - armSwing, 3, 8, '#7a5e3a');
        setV(-4, 2, 3, 8, '#7a5e3a');
        setV(2, 2, 3, 8, '#7a5e3a');
        setV(-5, 2, 10, 2, '#666048');
        break;
      }
      case 'Dragon': {
        const wingFlap = Math.sin(t * 3) * 15;
        const breathPhase = isAttacking ? atkPhase : 0;
        setV(-4, -20, 8, 6, '#b91c1c');
        setV(-5, -22, 10, 4, '#991b1b');
        setV(-3, -23, 2, 2, '#ef4444');
        setV(2, -23, 2, 2, '#ef4444');
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(-2 * scale, -19 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3 * scale, -19 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(-1.5 * scale, -19 * scale + bob, 0.7 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.5 * scale, -19 * scale + bob, 0.7 * scale, 0, Math.PI * 2); ctx.fill();
        setV(-6, -14, 12, 10, '#dc2626');
        setV(-5, -12, 10, 6, '#b91c1c');
        setV(-4, -4, 8, 5, '#991b1b');
        ctx.save();
        ctx.translate(-6 * scale, -14 * scale + bob);
        ctx.rotate(-wingFlap * Math.PI / 180);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-12 * scale, -2 * scale, 12 * scale, 4 * scale);
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(-10 * scale, 0, 8 * scale, 3 * scale);
        ctx.restore();
        ctx.save();
        ctx.translate(6 * scale, -14 * scale + bob);
        ctx.rotate(wingFlap * Math.PI / 180);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(0, -2 * scale, 12 * scale, 4 * scale);
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(2 * scale, 0, 8 * scale, 3 * scale);
        ctx.restore();
        setV(-3, 1, 2, 5, '#991b1b');
        setV(2, 1, 2, 5, '#991b1b');
        ctx.save();
        ctx.translate(0, -4 * scale + bob);
        ctx.rotate(Math.sin(t * 2) * 0.3);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(-1 * scale, 0, 2 * scale, 10 * scale);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(-3 * scale, 10 * scale);
        ctx.lineTo(0, 12 * scale);
        ctx.lineTo(3 * scale, 10 * scale);
        ctx.fill();
        ctx.restore();
        if (breathPhase > 0.2) {
          ctx.globalAlpha = breathPhase;
          ctx.fillStyle = '#ff6600';
          ctx.shadowColor = '#ff4400';
          ctx.shadowBlur = 12;
          for (let fi = 0; fi < 5; fi++) {
            const fd = 5 + fi * 4 * breathPhase;
            const fs = 2 + fi * 1.5 * breathPhase;
            ctx.beginPath();
            ctx.arc((5 + fd) * scale * facingFlip, (-18 + vfxSeededRand(fi * 13 + Math.floor(breathPhase * 10)) * 4) * scale + bob, fs * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'Lich': {
        const hover = Math.sin(t * 2.5) * 4;
        const soulFlicker = 0.6 + Math.sin(t * 8) * 0.3;
        ctx.save();
        ctx.translate(0, hover);
        setV(-3, -18, 6, 5, '#d4ccc0');
        setV(-4, -20, 8, 4, '#c0b8ac');
        ctx.fillStyle = `rgba(34,197,94,${soulFlicker})`;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(-1 * scale, -17 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2 * scale, -17 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        setV(-5, -13, 10, 12, '#1a0a2e');
        setV(-6, -10, 12, 8, '#2a1a3e');
        setV(-4, -1, 8, 4, '#1a0a2e');
        const staffSwing = isAttacking ? Math.sin(atkPhase * Math.PI) * 8 : Math.sin(t * 1.5) * 2;
        setV(-7, -13 + staffSwing, 2, 5, '#2a1a3e');
        setV(5, -13 - staffSwing, 2, 5, '#2a1a3e');
        setV(7, -16 - staffSwing, 1, 16, '#4a3a2a');
        ctx.fillStyle = `rgba(34,197,94,${soulFlicker})`;
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(7.5 * scale, (-18 - staffSwing) * scale + bob, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isAttacking && atkPhase > 0.4) {
          ctx.globalAlpha = atkPhase * 0.8;
          for (let si = 0; si < 4; si++) {
            const sa = t * 3 + si * Math.PI / 2;
            const sr = 8 + si * 3;
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(Math.cos(sa) * sr * scale, (Math.sin(sa) * sr - 5) * scale + bob, 1.5 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        break;
      }

      // ── New Voxel Monsters ─────────────────────────────────────

      case 'Tentacle Horror': {
        // Large purple-green tentacled horror with writhing arms
        const writhe = Math.sin(t * 3) * 3;
        const tentacleWave = (i: number) => Math.sin(t * 4 + i * 1.2) * 6;
        // Bulbous head
        setV(-6, -22, 12, 8, '#5e2a8a');
        setV(-7, -20, 14, 5, '#4a1e6e');
        // Glowing eyes (3 of them)
        ctx.fillStyle = '#ff44ff';
        ctx.shadowColor = '#ff44ff';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(-3 * scale, -19 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(1 * scale, -20 * scale + bob, 1.2 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4 * scale, -18 * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Body
        setV(-5, -14, 10, 10, '#6b3a9a');
        setV(-4, -10, 8, 6, '#5e2a8a');
        // Tentacles (6 writhing arms)
        for (let ti = 0; ti < 6; ti++) {
          const baseAngle = -Math.PI * 0.6 + ti * (Math.PI * 1.2 / 5);
          const tw = tentacleWave(ti);
          const tx2 = Math.cos(baseAngle) * 8 + tw * 0.5;
          const ty2 = -6 + ti * 2 + writhe * (ti % 2 === 0 ? 1 : -1);
          const tentColor = ti % 2 === 0 ? '#7a4ab0' : '#5e2a8a';
          ctx.strokeStyle = tentColor;
          ctx.lineWidth = (2.5 - ti * 0.15) * scale;
          ctx.beginPath();
          ctx.moveTo(tx2 * 0.3 * scale, ty2 * scale + bob);
          ctx.quadraticCurveTo(
            (tx2 * 0.8 + tw * 0.3) * scale, (ty2 + 5) * scale + bob,
            (tx2 * 1.2 + tw * 0.6) * scale, (ty2 + 10) * scale + bob
          );
          ctx.stroke();
          // Sucker dots
          if (ti < 4) {
            ctx.fillStyle = '#9966cc';
            ctx.beginPath();
            ctx.arc((tx2 * 0.8 + tw * 0.3) * scale, (ty2 + 6) * scale + bob, 0.8 * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Slime drip VFX
        if (isAttacking) {
          ctx.globalAlpha = atkPhase * 0.6;
          ctx.fillStyle = '#44ff88';
          ctx.shadowColor = '#44ff88';
          ctx.shadowBlur = 6;
          for (let si = 0; si < 3; si++) {
            const sd = 4 + si * 5 * atkPhase;
            ctx.beginPath();
            ctx.arc((sd * facingFlip) * scale, (-10 + si * 3) * scale + bob, (1.5 + atkPhase) * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
        break;
      }

      case 'Timber Wolf': {
        // Fast quadruped wolf with snout and tail
        const gallop = Math.sin(t * 8) * 3;
        const legPhase = Math.sin(t * 10);
        const tailWag = Math.sin(t * 5) * 8;
        const biteSnap = isAttacking ? Math.sin(atkPhase * Math.PI) * 4 : 0;
        // Body (elongated horizontal)
        setV(-7, -10, 14, 6, '#6b6b6b');
        setV(-6, -8, 12, 4, '#5a5a5a');
        // Head
        setV(5, -14 + gallop * 0.3, 6, 5, '#7a7a7a');
        // Snout
        setV(9, -12 + gallop * 0.3 + biteSnap * 0.3, 4, 3, '#5a5a5a');
        // Jaw (opens on attack)
        setV(9, -10 + gallop * 0.3 + biteSnap, 4, 2, '#4a4a4a');
        // Ears
        setV(6, -16 + gallop * 0.3, 2, 3, '#555555');
        setV(9, -16 + gallop * 0.3, 2, 3, '#555555');
        // Eyes
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(8 * scale, (-13 + gallop * 0.3) * scale + bob, 1 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(10 * scale, (-13 + gallop * 0.3) * scale + bob, 1 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Legs (4 legs with gallop animation)
        const fl = Math.round(legPhase * 2);
        const rl = Math.round(-legPhase * 2);
        setV(-5, -4 + fl, 2, 5, '#5a5a5a');
        setV(-2, -4 + rl, 2, 5, '#5a5a5a');
        setV(3, -4 + rl, 2, 5, '#5a5a5a');
        setV(6, -4 + fl, 2, 5, '#5a5a5a');
        // Tail
        ctx.save();
        ctx.translate(-7 * scale, -9 * scale + bob);
        ctx.rotate((tailWag - 20) * Math.PI / 180);
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(-1 * scale, 0, 2 * scale, -7 * scale);
        ctx.restore();
        // Belly highlight
        setV(-5, -7, 10, 2, '#8a8a8a');
        break;
      }

      case 'Cave Bear': {
        // Massive brown bear standing semi-upright
        const lumberBob = Math.sin(t * 2) * 2;
        const claw = isAttacking ? Math.sin(atkPhase * Math.PI) * 12 : 0;
        const breathe = Math.sin(t * 1.5) * 1;
        // Large body
        setV(-8, -18, 16, 14, '#5a3a1a');
        setV(-7, -14, 14, 10, '#4a2e14');
        // Head
        setV(-5, -24 + lumberBob, 10, 7, '#6b4a2a');
        setV(-4, -22 + lumberBob, 8, 4, '#5a3a1a');
        // Snout
        setV(-2, -20 + lumberBob, 5, 3, '#8a6a4a');
        setV(-1, -19 + lumberBob, 3, 2, '#2a1a0a'); // nose
        // Ears
        setV(-5, -26 + lumberBob, 3, 3, '#5a3a1a');
        setV(3, -26 + lumberBob, 3, 3, '#5a3a1a');
        // Eyes
        ctx.fillStyle = '#331100';
        ctx.beginPath(); ctx.arc(-2 * scale, (-22 + lumberBob) * scale + bob, 1 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3 * scale, (-22 + lumberBob) * scale + bob, 1 * scale, 0, Math.PI * 2); ctx.fill();
        // Arms with claw swipe on attack
        setV(-11, -16 + claw * 0.3 + breathe, 4, 10, '#4a2e14');
        setV(7, -16 - claw * 0.3 + breathe, 4, 10, '#4a2e14');
        // Claws
        ctx.strokeStyle = '#d4d4d4';
        ctx.lineWidth = 1.5 * scale;
        for (let ci = 0; ci < 3; ci++) {
          const cx2 = -11 + ci * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx2 * scale, (-6 + claw * 0.3) * scale + bob);
          ctx.lineTo((cx2 - 0.5) * scale, (-3 + claw * 0.3) * scale + bob);
          ctx.stroke();
        }
        for (let ci = 0; ci < 3; ci++) {
          const cx2 = 8 + ci * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx2 * scale, (-6 - claw * 0.3) * scale + bob);
          ctx.lineTo((cx2 + 0.5) * scale, (-3 - claw * 0.3) * scale + bob);
          ctx.stroke();
        }
        // Legs (thick)
        setV(-6, -4, 5, 6, '#4a2e14');
        setV(2, -4, 5, 6, '#4a2e14');
        // Belly lighter patch
        setV(-4, -12, 8, 6, '#7a5a3a');
        break;
      }

      case 'Pit Demon': {
        // Tall red demon with horns, wings, and fire aura
        const demonBob = Math.sin(t * 2.5) * 2;
        const wingFlap = Math.sin(t * 3.5) * 12;
        const fireFlicker = 0.5 + Math.sin(t * 10) * 0.3;
        const hornGlow = 0.6 + Math.sin(t * 6) * 0.2;
        // Head
        setV(-5, -26 + demonBob, 10, 6, '#aa1111');
        setV(-4, -24 + demonBob, 8, 4, '#881111');
        // Horns (curved up)
        ctx.fillStyle = '#331111';
        ctx.beginPath();
        ctx.moveTo(-5 * scale, (-26 + demonBob) * scale + bob);
        ctx.lineTo(-7 * scale, (-32 + demonBob) * scale + bob);
        ctx.lineTo(-4 * scale, (-28 + demonBob) * scale + bob);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(5 * scale, (-26 + demonBob) * scale + bob);
        ctx.lineTo(7 * scale, (-32 + demonBob) * scale + bob);
        ctx.lineTo(4 * scale, (-28 + demonBob) * scale + bob);
        ctx.fill();
        // Horn glow tips
        ctx.fillStyle = `rgba(255,100,0,${hornGlow})`;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(-7 * scale, (-32 + demonBob) * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7 * scale, (-32 + demonBob) * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Eyes
        ctx.fillStyle = '#ff3300';
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(-2 * scale, (-24 + demonBob) * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3 * scale, (-24 + demonBob) * scale + bob, 1.5 * scale, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Body
        setV(-7, -20, 14, 14, '#cc2222');
        setV(-6, -16, 12, 10, '#aa1111');
        setV(-5, -6, 10, 4, '#881111');
        // Wings
        ctx.save();
        ctx.translate(-7 * scale, (-18 + demonBob) * scale + bob);
        ctx.rotate(-wingFlap * Math.PI / 180);
        ctx.fillStyle = '#661111';
        ctx.fillRect(-14 * scale, -3 * scale, 14 * scale, 5 * scale);
        ctx.fillStyle = '#881111';
        ctx.fillRect(-12 * scale, -1 * scale, 10 * scale, 3 * scale);
        ctx.restore();
        ctx.save();
        ctx.translate(7 * scale, (-18 + demonBob) * scale + bob);
        ctx.rotate(wingFlap * Math.PI / 180);
        ctx.fillStyle = '#661111';
        ctx.fillRect(0, -3 * scale, 14 * scale, 5 * scale);
        ctx.fillStyle = '#881111';
        ctx.fillRect(2 * scale, -1 * scale, 10 * scale, 3 * scale);
        ctx.restore();
        // Arms
        const armSwing2 = isAttacking ? Math.sin(atkPhase * Math.PI) * 8 : Math.sin(t * 2) * 2;
        setV(-10, -18 + armSwing2, 3, 8, '#881111');
        setV(7, -18 - armSwing2, 3, 8, '#881111');
        // Legs
        setV(-4, -2, 3, 6, '#881111');
        setV(2, -2, 3, 6, '#881111');
        // Fire aura when attacking
        if (isAttacking && atkPhase > 0.2) {
          ctx.globalAlpha = atkPhase * fireFlicker;
          ctx.fillStyle = '#ff6600';
          ctx.shadowColor = '#ff4400';
          ctx.shadowBlur = 15;
          for (let fi = 0; fi < 8; fi++) {
            const fa = t * 4 + fi * Math.PI / 4;
            const fr = 12 + fi * 2 * atkPhase;
            ctx.beginPath();
            ctx.arc(Math.cos(fa) * fr * scale, (Math.sin(fa) * fr - 12) * scale + bob, (2 + atkPhase * 2) * scale, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
        break;
      }

      case 'Sky Hawk': {
        // Flying hawk with spread wings, swoops to attack
        const soar = Math.sin(t * 2) * 6;
        const wingBeat = Math.sin(t * 5) * 18;
        const dive = isAttacking ? Math.sin(atkPhase * Math.PI) * 8 : 0;
        ctx.save();
        ctx.translate(0, soar - dive);
        // Body (compact oval)
        setV(-3, -12, 6, 8, '#8b6914');
        setV(-2, -10, 4, 5, '#7a5a10');
        // Head
        setV(-2, -16, 4, 5, '#9a7a20');
        // Beak
        ctx.fillStyle = '#cc8800';
        ctx.beginPath();
        ctx.moveTo(2 * scale * facingFlip, -14 * scale + bob);
        ctx.lineTo(5 * scale * facingFlip, -13 * scale + bob);
        ctx.lineTo(2 * scale * facingFlip, -12 * scale + bob);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.arc(0, -14 * scale + bob, 0.8 * scale, 0, Math.PI * 2); ctx.fill();
        // Wings (large spread)
        ctx.save();
        ctx.translate(-3 * scale, -11 * scale + bob);
        ctx.rotate(-wingBeat * Math.PI / 180);
        ctx.fillStyle = '#6b5010';
        ctx.fillRect(-16 * scale, -1.5 * scale, 16 * scale, 3 * scale);
        // Wing feather tips
        ctx.fillStyle = '#5a4008';
        ctx.fillRect(-18 * scale, -2 * scale, 4 * scale, 4 * scale);
        ctx.restore();
        ctx.save();
        ctx.translate(3 * scale, -11 * scale + bob);
        ctx.rotate(wingBeat * Math.PI / 180);
        ctx.fillStyle = '#6b5010';
        ctx.fillRect(0, -1.5 * scale, 16 * scale, 3 * scale);
        ctx.fillStyle = '#5a4008';
        ctx.fillRect(14 * scale, -2 * scale, 4 * scale, 4 * scale);
        ctx.restore();
        // Tail feathers
        ctx.fillStyle = '#5a4008';
        ctx.beginPath();
        ctx.moveTo(-1 * scale, -4 * scale + bob);
        ctx.lineTo(-3 * scale, 2 * scale + bob);
        ctx.lineTo(3 * scale, 2 * scale + bob);
        ctx.lineTo(1 * scale, -4 * scale + bob);
        ctx.fill();
        // Talons
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(-1 * scale, -4 * scale + bob);
        ctx.lineTo(-2 * scale, 0 + bob);
        ctx.lineTo(-1 * scale, 2 * scale + bob);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(1 * scale, -4 * scale + bob);
        ctx.lineTo(2 * scale, 0 + bob);
        ctx.lineTo(1 * scale, 2 * scale + bob);
        ctx.stroke();
        // Dive trail VFX when attacking
        if (isAttacking && atkPhase > 0.1) {
          ctx.globalAlpha = (1 - atkPhase) * 0.5;
          ctx.strokeStyle = '#ccaa44';
          ctx.lineWidth = 2 * scale;
          ctx.shadowColor = '#ccaa44';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.moveTo(0, -8 * scale + bob);
          ctx.lineTo(-3 * scale * facingFlip, (-8 + dive * 1.5) * scale + bob);
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
        ctx.restore();
        break;
      }

      default: {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(0, bob, size, size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-2, -2 + bob, 2, 0, Math.PI * 2);
        ctx.arc(2, -2 + bob, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }

    // Enemy melee attack slash VFX overlay
    if (isAttacking && atkPhase > 0.1) {
      const enemyTypeLC = enemyType.toLowerCase();
      const isMeleeType = !enemyTypeLC.includes('mage') && !enemyTypeLC.includes('lich') &&
                          !enemyTypeLC.includes('drake') && !enemyTypeLC.includes('wyrm') &&
                          !enemyTypeLC.includes('wraith') && !enemyTypeLC.includes('harpy') &&
                          !enemyTypeLC.includes('imp') && !enemyTypeLC.includes('shaman') &&
                          !enemyTypeLC.includes('demon') && !enemyTypeLC.includes('hawk');
      if (isMeleeType) {
        ctx.save();
        ctx.scale(facingFlip, 1);
        const slashDist = (size + 8) * (0.5 + atkPhase * 0.5);
        const slashArcStart = -Math.PI * 0.4;
        const slashArcEnd = Math.PI * 0.4;
        const slashAngle = slashArcStart + (slashArcEnd - slashArcStart) * atkPhase;
        ctx.globalAlpha = (1 - atkPhase) * 0.7;
        const slashColor = isBoss ? '#ffd700' : (enemyType === 'Spider' ? '#ff4444' : enemyType === 'Slime' ? '#22ff22' : '#dddddd');
        ctx.strokeStyle = slashColor;
        ctx.lineWidth = 2 + atkPhase * 2;
        ctx.shadowColor = slashColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(0, bob - 5, slashDist, slashArcStart, slashAngle);
        ctx.stroke();
        if (enemyType === 'Spider' || enemyType === 'Dire Wolf') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.globalAlpha = (1 - atkPhase) * 0.4;
          for (let cl = 0; cl < 3; cl++) {
            const cla = -0.2 + cl * 0.15;
            ctx.beginPath();
            ctx.moveTo(Math.cos(cla) * 4, bob - 5 + Math.sin(cla) * 4);
            ctx.lineTo(Math.cos(cla) * slashDist * 0.8, bob - 5 + Math.sin(cla) * slashDist * 0.8);
            ctx.stroke();
          }
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private getCachedTile(key: string, builder: () => HTMLCanvasElement): HTMLCanvasElement {
    let cached = this.tileCache.get(key);
    if (!cached) {
      cached = builder();
      this.tileCache.set(key, cached);
      if (this.tileCache.size > 500) {
        const firstKey = this.tileCache.keys().next().value;
        if (firstKey) this.tileCache.delete(firstKey);
      }
    }
    return cached;
  }

  private renderTerrainOnCanvas(ctx: CanvasRenderingContext2D, tileSize: number, terrain: TerrainType, tx: number, ty: number) {
    const palette = TERRAIN_PALETTES[terrain];
    const voxelSize = tileSize / 8;
    const gridSize = 8;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const seed = seededRandom(tx * gridSize + gx, ty * gridSize + gy);
        const colorIdx = Math.floor(seed * palette.base.length);
        let color = palette.base[colorIdx];

        if (seed > 0.85) {
          const accentIdx = Math.floor((seed * 37) % palette.accent.length);
          color = palette.accent[accentIdx];
        }

        const px = gx * voxelSize;
        const py = gy * voxelSize;

        if (terrain === 'water' || terrain === 'river') {
          const wave = Math.sin((gx + gy) * 0.8 + (tx + ty) * 2.1) * 0.1;
          color = shade(color, 0.9 + wave);
        }

        ctx.fillStyle = color;
        ctx.fillRect(px, py, voxelSize + 0.5, voxelSize + 0.5);

        if (palette.height > 0 && seed > 0.7) {
          const highlights = shade(color, 1.15);
          ctx.fillStyle = highlights;
          ctx.fillRect(px, py, voxelSize * 0.5, voxelSize * 0.5);
        }
      }
    }

    if (terrain === 'grass' || terrain === 'jungle') {
      const grassCount = terrain === 'jungle' ? 5 : 3;
      for (let i = 0; i < grassCount; i++) {
        const gx = seededRandom(tx * 100 + i, ty * 100) * tileSize;
        const gy = seededRandom(tx * 100, ty * 100 + i) * tileSize;
        const grassColor = terrain === 'jungle' ? '#1a4a12' : '#3a8a2a';
        ctx.fillStyle = shade(grassColor, 0.8 + seededRandom(tx + i, ty) * 0.4);
        ctx.fillRect(gx, gy, 1.5, 4);
        ctx.fillRect(gx + 1, gy + 1, 1.5, 3);
      }
    }

    if (terrain === 'lane') {
      ctx.strokeStyle = 'rgba(100,90,70,0.15)';
      ctx.lineWidth = 0.5;
      if ((tx + ty) % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(0, tileSize * 0.3);
        ctx.lineTo(tileSize, tileSize * 0.3);
        ctx.stroke();
      }
    }

    if (terrain === 'jungle_path') {
      ctx.strokeStyle = 'rgba(80,70,50,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        const px = seededRandom(tx * 50 + i, ty * 50) * tileSize;
        const py = seededRandom(tx * 50, ty * 50 + i) * tileSize;
        ctx.fillStyle = shade('#2a4a18', 0.7 + seededRandom(tx + i, ty + i) * 0.3);
        ctx.fillRect(px, py, 2, 1.5);
      }
      if ((tx + ty) % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(0, tileSize * 0.5);
        ctx.lineTo(tileSize, tileSize * 0.5);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, tileSize, tileSize);
  }

  private renderDungeonTileOnCanvas(ctx: CanvasRenderingContext2D, tileSize: number, tileType: DungeonTileVoxelType, tx: number, ty: number) {
    const palette = DUNGEON_PALETTES[tileType];
    const voxelSize = tileSize / 6;
    const gridSize = 6;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const seed = seededRandom(tx * gridSize + gx, ty * gridSize + gy);
        const colorIdx = Math.floor(seed * palette.base.length);
        let color = palette.base[colorIdx];

        if (seed > 0.8) {
          color = palette.accent[Math.floor((seed * 17) % palette.accent.length)];
        }

        const px = gx * voxelSize;
        const py = (tileType === 'wall' ? 16 : 0) + gy * voxelSize;

        ctx.fillStyle = color;
        ctx.fillRect(px, py, voxelSize + 0.5, voxelSize + 0.5);

        if (seed > 0.6) {
          ctx.fillStyle = shade(color, 1.1);
          ctx.fillRect(px, py, voxelSize * 0.4, voxelSize * 0.4);
        }
      }
    }

    if (tileType === 'wall') {
      const wallPalette = DUNGEON_PALETTES.wall_top;
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
          const seed = seededRandom(tx * gridSize + gx + 100, ty * gridSize + gy + 100);
          const color = wallPalette.base[Math.floor(seed * wallPalette.base.length)];
          ctx.fillStyle = color;
          const px = gx * voxelSize;
          const py = gy * (16 / 3);
          ctx.fillRect(px, py, voxelSize + 0.5, 16 / 3 + 0.5);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 12, tileSize, 4);
    }

    if (tileType === 'trap') {
      ctx.strokeStyle = '#f59e0b44';
      ctx.lineWidth = 1;
      const inset = tileSize * 0.2;
      const yOff = 0;
      ctx.strokeRect(inset, yOff + inset, tileSize - inset * 2, tileSize - inset * 2);
      ctx.beginPath();
      ctx.moveTo(tileSize * 0.3, yOff + tileSize * 0.3);
      ctx.lineTo(tileSize * 0.7, yOff + tileSize * 0.7);
      ctx.moveTo(tileSize * 0.7, yOff + tileSize * 0.3);
      ctx.lineTo(tileSize * 0.3, yOff + tileSize * 0.7);
      ctx.stroke();
    }

    if (tileType === 'stairs') {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', tileSize / 2, tileSize / 2 + 5);
    }

    if (tileType === 'door') {
      ctx.strokeStyle = '#c5a05988';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tileSize / 2, tileSize / 2, tileSize * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  renderVoxelModel(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    model: VoxelModel,
    cubeSize: number,
    facing: number
  ) {
    const cs = cubeSize;
    const isoX = cs;
    const isoY = cs * 0.5;

    const dir8 = facingToDir(facing);
    const dir = dir8 < 4 ? dir8 : dirToCardinal(dir8);
    const skew = dirToSkew(dir8);

    // Apply diagonal skew for 8-dir facing
    if (skew !== 0) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.transform(1, skew, 0, 1, 0, 0);
      ctx.translate(-cx, -cy);
    }

    for (let z = 0; z < model.length; z++) {
      const layer = model[z];
      if (!layer) continue;
      const rows = layer.length;
      const cols = layer[0]?.length || 0;

      if (dir === 0) {
        for (let y = rows - 1; y >= 0; y--) {
          const row = layer[y];
          if (!row) continue;
          for (let x = 0; x < cols; x++) {
            const color = row[x];
            if (!color) continue;
            const screenX = cx + (x - y) * isoX;
            const screenY = cy + (x + y) * isoY - z * cs;
            this.drawIsoCube(ctx, screenX, screenY, cs, color);
          }
        }
      } else if (dir === 1) {
        for (let x = 0; x < cols; x++) {
          for (let y = 0; y < rows; y++) {
            const row = layer[y];
            if (!row) continue;
            const color = row[x];
            if (!color) continue;
            const mx = rows - 1 - y;
            const my = x;
            const screenX = cx + (mx - my) * isoX;
            const screenY = cy + (mx + my) * isoY - z * cs;
            this.drawIsoCube(ctx, screenX, screenY, cs, color);
          }
        }
      } else if (dir === 2) {
        for (let y = 0; y < rows; y++) {
          const row = layer[y];
          if (!row) continue;
          for (let x = cols - 1; x >= 0; x--) {
            const color = row[x];
            if (!color) continue;
            const mx = cols - 1 - x;
            const my = rows - 1 - y;
            const screenX = cx + (mx - my) * isoX;
            const screenY = cy + (mx + my) * isoY - z * cs;
            this.drawIsoCube(ctx, screenX, screenY, cs, color);
          }
        }
      } else {
        for (let x = cols - 1; x >= 0; x--) {
          for (let y = rows - 1; y >= 0; y--) {
            const row = layer[y];
            if (!row) continue;
            const color = row[x];
            if (!color) continue;
            const mx = y;
            const my = cols - 1 - x;
            const screenX = cx + (mx - my) * isoX;
            const screenY = cy + (mx + my) * isoY - z * cs;
            this.drawIsoCube(ctx, screenX, screenY, cs, color);
          }
        }
      }
    }

    if (skew !== 0) {
      ctx.restore();
    }
  }

  drawIsoCube(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const s = size;
    const hs = s * 0.5;

    ctx.fillStyle = shade(color, 1.2);
    ctx.beginPath();
    ctx.moveTo(x, y - hs);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(color, 0.7);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x - s, y + s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(color, 0.85);
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x + s, y + s);
    ctx.closePath();
    ctx.fill();
  }
}

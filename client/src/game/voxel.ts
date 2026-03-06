import { getHeroWeapon, type WeaponType } from './types';

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

function facingToDir(facing: number): number {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI * 0.25 || a >= Math.PI * 1.75) return 1;
  if (a < Math.PI * 0.75) return 2;
  if (a < Math.PI * 1.25) return 3;
  return 0;
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
}

function getAnimPoses(heroClass: string, animState: string, animTimer: number, weaponType?: WeaponType): {
  leftLeg: BodyPartPose; rightLeg: BodyPartPose;
  leftArm: BodyPartPose; rightArm: BodyPartPose;
  torso: BodyPartPose; head: BodyPartPose;
  weapon: BodyPartPose; weaponGlow: number;
} {
  const t = animTimer;
  const idle = {
    leftLeg: { ox: 0, oy: 0, oz: 0 },
    rightLeg: { ox: 0, oy: 0, oz: 0 },
    leftArm: { ox: 0, oy: 0, oz: 0 },
    rightArm: { ox: 0, oy: 0, oz: 0 },
    torso: { ox: 0, oy: 0, oz: Math.round(Math.sin(t * 2) * 0.3) },
    head: { ox: 0, oy: 0, oz: 0 },
    weapon: { ox: 0, oy: 0, oz: 0 },
    weaponGlow: 0
  };

  if (animState === 'idle') return idle;

  if (animState === 'walk') {
    const freq = 10;
    const phase = Math.sin(t * freq);
    const phase2 = Math.cos(t * freq);
    const stride = 2.0;
    const liftHeight = 0.8;
    const bounce = Math.abs(Math.sin(t * freq * 2)) * 0.6;
    const hipSway = Math.sin(t * freq) * 0.4;
    const shoulderRock = Math.sin(t * freq) * 0.3;
    const headBob = Math.sin(t * freq * 2 + 0.5) * 0.35;
    return {
      leftLeg: { ox: Math.round(phase * stride), oy: 0, oz: Math.round(Math.max(0, -phase) * liftHeight) },
      rightLeg: { ox: Math.round(-phase * stride), oy: 0, oz: Math.round(Math.max(0, phase) * liftHeight) },
      leftArm: { ox: Math.round(-phase * 1.4), oy: Math.round(shoulderRock * 0.5), oz: Math.round(phase2 * 0.5) },
      rightArm: { ox: Math.round(phase * 1.4), oy: Math.round(-shoulderRock * 0.5), oz: Math.round(-phase2 * 0.5) },
      torso: { ox: 0, oy: Math.round(hipSway), oz: Math.round(bounce) },
      head: { ox: 0, oy: Math.round(Math.sin(t * freq * 0.5) * 0.25), oz: Math.round(bounce * 0.8 + headBob) },
      weapon: { ox: Math.round(phase * 0.6), oy: Math.round(shoulderRock * 0.3), oz: Math.round(bounce * 0.3) },
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
        leftLeg: { ox: Math.round(chop * 2.0 - followThru * 0.5), oy: 0, oz: Math.round(chop * 1.0) },
        rightLeg: { ox: Math.round(-chop * 1.0 + windUp * 0.5), oy: 0, oz: 0 },
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
        leftLeg: { ox: Math.round(thrust * 3.5 - retract * 1.5), oy: 0, oz: Math.round(thrust * 0.5) },
        rightLeg: { ox: Math.round(-thrust * 1.5 + draw * 1.0), oy: 0, oz: 0 },
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
        leftLeg: { ox: Math.round(slam * 1.5), oy: Math.round(-slam * 0.5), oz: Math.round(slam * 1.5) },
        rightLeg: { ox: Math.round(-slam * 1.5), oy: Math.round(slam * 0.5), oz: Math.round(slam * 1.5) },
        leftArm: { ox: Math.round(slam * 2.0), oy: Math.round(-slam * 2.5), oz: Math.round(raise - smash + followThru * 2.0) },
        rightArm: { ox: Math.round(slam * 1.5), oy: Math.round(-slam * 1.5), oz: Math.round(raise * 0.8 - smash * 0.6 + followThru * 1.0) },
        torso: { ox: Math.round(slam * 0.5), oy: 0, oz: Math.round(-bodySquat + followThru * 1.5) },
        head: { ox: Math.round(slam * 0.5 - windUp * 0.3), oy: 0, oz: Math.round(-bodySquat * 0.6 + windUp * 1.5) },
        weapon: { ox: Math.round(slam * 3.0), oy: Math.round(-slam * 4.0 + windUp * 0.5), oz: Math.round(raise * 1.5 - smash * 2.0 + followThru * 1.0) },
        weaponGlow: slam > 0.1 ? 1.0 : windUp > 0.6 ? 0.5 : followThru > 0 ? 0.4 : 0
      };
    }

    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      const windUp = atkProgress < 0.35 ? atkProgress / 0.35 : 0;
      const swing = atkProgress >= 0.35 && atkProgress < 0.65 ? (atkProgress - 0.35) / 0.3 : 0;
      const followThru = atkProgress >= 0.65 ? (atkProgress - 0.65) / 0.35 : 0;
      const armExtend = Math.round(windUp > 0 ? -windUp * 4.0 : swing * 5.5 - followThru * 1.5);
      const lunge = Math.round(swing * 3.5);
      const bodyLean = Math.round(swing * 1.5);
      const plantFeet = Math.round(swing * 0.8);
      const shoulderTwist = Math.round(swing * 1.2 - windUp * 0.6);
      return {
        leftLeg: { ox: Math.round(swing * 2.5 - followThru * 0.8), oy: 0, oz: plantFeet },
        rightLeg: { ox: Math.round(-swing * 1.5 + windUp * 0.8), oy: 0, oz: 0 },
        leftArm: { ox: armExtend, oy: Math.round(swing * -3.5 + shoulderTwist), oz: Math.round(swing * 5.0 - windUp * 3.0) },
        rightArm: { ox: Math.round(-windUp * 2.0 + followThru * 0.8), oy: Math.round(windUp * 1.0), oz: Math.round(windUp * 2.0 + swing * 0.5) },
        torso: { ox: lunge, oy: Math.round(swing * 0.8 - windUp * 0.5), oz: Math.round(-bodyLean * 0.4) },
        head: { ox: Math.round(swing * 1.2 - windUp * 0.5), oy: Math.round(shoulderTwist * 0.3), oz: Math.round(-bodyLean * 0.3) },
        weapon: { ox: armExtend + Math.round(swing * 5.0), oy: Math.round(swing * -5.5 + windUp * 1.5), oz: Math.round(windUp * 6 - swing * 5.5 + followThru * 0.5) },
        weaponGlow: swing > 0.15 ? 1.0 : windUp > 0.5 ? 0.5 : followThru > 0 ? 0.3 : 0
      };
    }
    if (heroClass === 'Ranger') {
      const draw = atkProgress < 0.45 ? atkProgress / 0.45 : 1;
      const hold = atkProgress >= 0.4 && atkProgress < 0.55 ? 1 : 0;
      const release = atkProgress >= 0.55 ? Math.min(1, (atkProgress - 0.55) / 0.15) : 0;
      const recoil = atkProgress >= 0.7 ? (atkProgress - 0.7) / 0.3 : 0;
      const stringTension = draw * (1 - release);
      return {
        leftLeg: { ox: Math.round(-draw * 1.0), oy: 0, oz: 0 },
        rightLeg: { ox: Math.round(draw * 1.2 - recoil * 0.5), oy: 0, oz: 0 },
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
        leftLeg: { ox: Math.round(-cast * 0.8 + recover * 0.3), oy: 0, oz: 0 },
        rightLeg: { ox: Math.round(cast * 0.8 - recover * 0.4), oy: 0, oz: 0 },
        leftArm: { ox: Math.round(cast * 4.5 - recover * 1.5), oy: Math.round(-raise * 1.5 + orbPulse), oz: Math.round(raise * 5.5 + cast * 1.0 - recover * 3) },
        rightArm: { ox: Math.round(cast * 3.0 - recover * 0.8), oy: Math.round(raise * 1.0 - orbPulse), oz: Math.round(raise * 4.5 + channel * 1.0 - recover * 2) },
        torso: { ox: Math.round(cast * 0.5), oy: 0, oz: Math.round(raise * 1.0 + channel * 0.5 - recover * 0.8) },
        head: { ox: Math.round(cast * 0.5), oy: 0, oz: Math.round(raise * 1.2 + channel * 0.5 - recover * 0.8) },
        weapon: { ox: Math.round(cast * 4.5 - recover * 1.5), oy: Math.round(-cast * 1.5 + orbPulse * 0.5), oz: Math.round(raise * 6 + cast * 2 - recover * 4) },
        weaponGlow: glow > 0.1 ? Math.min(1, glow + orbPulse * 0.2) : 0
      };
    }
    return idle;
  }

  if (animState === 'ability') {
    const pulse = (Math.sin(t * 8) + 1) * 0.5;
    const burst = Math.max(0, Math.sin(t * 8 + 1.5));
    const channel = Math.min(1, t * 4);
    return {
      leftLeg: { ox: Math.round(-burst * 0.8), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(burst * 0.8), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(burst * 2.5), oy: Math.round(-pulse * 1.5), oz: Math.round(pulse * 4 + channel * 2) },
      rightArm: { ox: Math.round(burst * 2.5), oy: Math.round(pulse * 1.5), oz: Math.round(pulse * 4 + channel * 2) },
      torso: { ox: 0, oy: 0, oz: Math.round(pulse * 0.7 + channel * 0.5) },
      head: { ox: 0, oy: 0, oz: Math.round(pulse * 0.8 + channel * 0.5) },
      weapon: { ox: Math.round(burst * 2.5), oy: 0, oz: Math.round(pulse * 5 + channel) },
      weaponGlow: Math.max(pulse, channel * 0.6) * 0.95
    };
  }

  if (animState === 'dodge') {
    const roll = Math.min(1, t * 8);
    const spin = Math.sin(roll * Math.PI * 2);
    return {
      leftLeg: { ox: Math.round(spin * 2), oy: 0, oz: Math.round(-roll * 2) },
      rightLeg: { ox: Math.round(-spin * 2), oy: 0, oz: Math.round(-roll * 2) },
      leftArm: { ox: Math.round(-spin * 1.5), oy: Math.round(-roll), oz: Math.round(-roll * 3) },
      rightArm: { ox: Math.round(spin * 1.5), oy: Math.round(roll), oz: Math.round(-roll * 3) },
      torso: { ox: Math.round(spin * 0.5), oy: 0, oz: Math.round(-roll * 4) },
      head: { ox: Math.round(spin * 0.3), oy: 0, oz: Math.round(-roll * 5) },
      weapon: { ox: Math.round(-spin * 2), oy: 0, oz: Math.round(-roll * 3) },
      weaponGlow: 0
    };
  }

  if (animState === 'lunge_slash') {
    const progress = Math.min(1, t / 0.4);
    const lunge = progress < 0.4 ? progress / 0.4 : 1;
    const slash = progress >= 0.35 && progress < 0.6 ? (progress - 0.35) / 0.25 : 0;
    const recover = progress >= 0.6 ? (progress - 0.6) / 0.4 : 0;
    const lungeFwd = lunge * (1 - recover * 0.5);
    const slashArc = Math.sin(slash * Math.PI);
    return {
      leftLeg: { ox: Math.round(lungeFwd * 4 - recover * 2), oy: 0, oz: Math.round(Math.max(0, slash - 0.5) * 2) },
      rightLeg: { ox: Math.round(-lungeFwd * 2 + recover), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(lungeFwd * 5 + slashArc * 3 - recover * 3), oy: Math.round(-slashArc * 4), oz: Math.round(lungeFwd * 3 + slashArc * 5 - recover * 4) },
      rightArm: { ox: Math.round(lungeFwd * 2 - recover), oy: Math.round(slashArc * 1.5), oz: Math.round(lungeFwd * 2 + slashArc * 2 - recover * 2) },
      torso: { ox: Math.round(lungeFwd * 3.5 - recover * 1.5), oy: Math.round(slashArc * 0.8), oz: Math.round(-slashArc * 0.5 + lungeFwd * 0.5) },
      head: { ox: Math.round(lungeFwd * 2.5 + slashArc * 0.5 - recover), oy: Math.round(slashArc * 0.5), oz: Math.round(lungeFwd * 0.5 - slashArc * 0.3) },
      weapon: { ox: Math.round(lungeFwd * 6 + slashArc * 4 - recover * 3), oy: Math.round(-slashArc * 6 + recover * 2), oz: Math.round(lungeFwd * 4 + slashArc * 6 - recover * 5) },
      weaponGlow: slash > 0.1 ? 1.0 : lungeFwd > 0.7 ? 0.6 : recover > 0 ? 0.3 : 0
    };
  }

  if (animState === 'dash_attack') {
    const thrust = Math.min(1, t * 6);
    const extend = Math.sin(thrust * Math.PI);
    return {
      leftLeg: { ox: Math.round(-extend * 2), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(extend * 2), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(extend * 3), oy: Math.round(-extend), oz: Math.round(extend * 2) },
      rightArm: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend) },
      torso: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend * 0.5) },
      head: { ox: Math.round(extend * 1.5), oy: 0, oz: Math.round(extend * 0.5) },
      weapon: { ox: Math.round(extend * 4), oy: Math.round(-extend * 2), oz: Math.round(extend * 3) },
      weaponGlow: extend > 0.5 ? extend : 0
    };
  }

  if (animState === 'combo_finisher') {
    const phase = t * 28;
    const spin = Math.sin(phase);
    const spin2 = Math.cos(phase * 0.7);
    const power = Math.abs(Math.sin(phase * 0.5));
    const slam = Math.max(0, Math.sin(phase * 0.5 + 1.2));
    const twist = Math.sin(phase * 1.3) * 2.5;
    const bodyLean = Math.sin(phase * 0.8) * 2.2;
    const jumpPulse = Math.max(0, Math.sin(phase * 0.4)) * 1.5;
    const windmill = Math.sin(phase * 1.8) * 1.5;
    return {
      leftLeg: { ox: Math.round(spin * 4.0), oy: Math.round(spin2 * 1.2 + twist * 0.5), oz: Math.round(Math.max(0, -spin) * 2.5 + jumpPulse) },
      rightLeg: { ox: Math.round(-spin * 4.0), oy: Math.round(-spin2 * 1.2 - twist * 0.5), oz: Math.round(Math.max(0, spin) * 2.5 + jumpPulse) },
      leftArm: { ox: Math.round(spin * 7 + windmill), oy: Math.round(-power * 5.5 + twist), oz: Math.round(power * 7 + slam * 4.0) },
      rightArm: { ox: Math.round(-spin * 6 - windmill), oy: Math.round(power * 3.0 - twist), oz: Math.round(power * 6 + slam * 3.0) },
      torso: { ox: Math.round(spin * 3.0 + bodyLean), oy: Math.round(twist * 1.5), oz: Math.round(power * 2.0 - slam * 3.0 + jumpPulse * 0.5) },
      head: { ox: Math.round(spin * 2.0 + bodyLean * 0.8), oy: Math.round(twist * 1.0), oz: Math.round(power * 1.5 - slam * 2.5 + jumpPulse * 0.5) },
      weapon: { ox: Math.round(spin * 10 + power * 6), oy: Math.round(-power * 7 + slam * 4.0 + twist), oz: Math.round(power * 10 - slam * 6) },
      weaponGlow: 1.0
    };
  }

  if (animState === 'block') {
    const brace = Math.min(1, t * 6);
    return {
      leftLeg: { ox: Math.round(-brace * 0.5), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(brace * 0.5), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(-brace * 2), oy: Math.round(brace), oz: Math.round(brace * 2) },
      rightArm: { ox: Math.round(brace * 1), oy: Math.round(-brace * 0.5), oz: Math.round(brace * 1.5) },
      torso: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(brace * 0.3) },
      head: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(brace * 0.3) },
      weapon: { ox: Math.round(-brace * 1), oy: Math.round(brace * 2), oz: Math.round(brace * 3) },
      weaponGlow: 0.2
    };
  }

  if (animState === 'death') {
    const fall = Math.min(1, t * 2);
    return {
      leftLeg: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 3) },
      rightLeg: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 3) },
      leftArm: { ox: Math.round(fall * 3), oy: Math.round(-fall), oz: Math.round(-fall * 2) },
      rightArm: { ox: Math.round(fall * 3), oy: Math.round(fall), oz: Math.round(-fall * 2) },
      torso: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 4) },
      head: { ox: Math.round(fall * 3), oy: 0, oz: Math.round(-fall * 5) },
      weapon: { ox: Math.round(fall * 4), oy: Math.round(-fall * 2), oz: Math.round(-fall * 4) },
      weaponGlow: 0
    };
  }

  return idle;
}

function buildBearModel(animState: string, animTimer: number): VoxelModel {
  const fur = '#5a3a1a';
  const darkFur = '#3a2a12';
  const lightFur = '#7a5a3a';
  const nose = '#222222';
  const eye = '#111111';
  const claw = '#ccccaa';

  const W = 10, D = 10, H = 12;
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
  const walkPhase = animState === 'walk' ? Math.sin(t * 8) : 0;
  const atkPhase = animState === 'attack' ? Math.max(0, Math.sin(t * 10)) : 0;

  const fLegOx = Math.round(walkPhase * 1.2);
  const bLegOx = Math.round(-walkPhase * 1.2);

  for (let y = 3; y <= 6; y++) {
    setV(0, y, 2 + fLegOx, darkFur);
    setV(1, y, 2 + fLegOx, fur);
    setV(0, y, 7 + fLegOx, darkFur);
    setV(1, y, 7 + fLegOx, fur);
  }
  setV(0, 3 + fLegOx, 2, claw); setV(0, 3 + fLegOx, 7, claw);

  for (let y = 3; y <= 6; y++) {
    setV(0, y, 3 + bLegOx, darkFur);
    setV(1, y, 3 + bLegOx, fur);
    setV(0, y, 6 + bLegOx, darkFur);
    setV(1, y, 6 + bLegOx, fur);
  }

  for (let x = 2; x <= 7; x++) {
    for (let y = 3; y <= 6; y++) {
      setV(2, y, x, fur);
      setV(3, y, x, fur);
      setV(4, y, x, darkFur);
    }
  }
  for (let x = 3; x <= 6; x++) {
    for (let y = 3; y <= 6; y++) {
      setV(5, y, x, fur);
    }
  }

  for (let x = 2; x <= 7; x++) {
    setV(3, 4, x, lightFur);
    setV(3, 5, x, lightFur);
  }

  const headOz = Math.round(atkPhase * 1.5);
  for (let x = 3; x <= 6; x++) {
    for (let y = 2; y <= 5; y++) {
      setV(5 + headOz, y, x, fur);
      setV(6 + headOz, y, x, fur);
      setV(7 + headOz, y, x, darkFur);
    }
  }
  for (let x = 4; x <= 5; x++) {
    setV(8 + headOz, 3, x, fur);
    setV(8 + headOz, 4, x, fur);
  }

  setV(7 + headOz, 2, 3, eye);
  setV(7 + headOz, 2, 6, eye);

  setV(6 + headOz, 2, 4, nose);
  setV(6 + headOz, 2, 5, nose);
  setV(5 + headOz, 2, 4, '#994444');
  setV(5 + headOz, 2, 5, '#994444');

  setV(8 + headOz, 3, 3, fur);
  setV(8 + headOz, 3, 6, fur);
  setV(9 + headOz, 3, 3, darkFur);
  setV(9 + headOz, 3, 6, darkFur);

  if (atkPhase > 0.3) {
    const clawExtend = Math.round(atkPhase * 2);
    setV(3, 2, 1, claw);
    setV(3, 2 - clawExtend, 1, claw);
    setV(3, 2, 8, claw);
    setV(3, 2 - clawExtend, 8, claw);
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

function buildHeroModel(race: string, heroClass: string, animState: string, animTimer: number, heroName?: string, heroItems?: ({ id: number } | null)[]): VoxelModel {
  const isPirate = heroName?.includes('Racalvin') || heroName?.includes('Pirate King');
  const skin = RACE_SKIN[race] || '#c4956a';
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
  const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';
  const weaponType = getHeroWeapon(race, heroClass);

  const W = 8, D = 8, H = 14;
  const model: VoxelModel = [];
  for (let z = 0; z < H; z++) {
    model[z] = [];
    for (let y = 0; y < D; y++) {
      model[z][y] = [];
      for (let x = 0; x < W; x++) model[z][y][x] = null;
    }
  }

  const poses = getAnimPoses(heroClass, animState, animTimer, weaponType);

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) {
      if (poses.weaponGlow > 0 && animState === 'ability') {
        c = blend(c, '#ffd700', poses.weaponGlow * 0.25);
      }
      model[z][y][x] = c;
    }
  };

  const bootColor = shade(armor.primary, 0.7);
  const bootAccent = shade(armor.primary, 0.85);
  const lL = poses.leftLeg, rL = poses.rightLeg;
  setV(0 + lL.oz, 2 + lL.oy, 2 + lL.ox, bootColor);
  setV(0 + lL.oz, 3 + lL.oy, 2 + lL.ox, bootColor);
  setV(0 + lL.oz, 2 + lL.oy, 3 + lL.ox, bootAccent);
  setV(1 + lL.oz, 2 + lL.oy, 2 + lL.ox, armor.secondary);
  setV(1 + lL.oz, 3 + lL.oy, 2 + lL.ox, armor.secondary);

  setV(0 + rL.oz, 2 + rL.oy, 5 + rL.ox, bootColor);
  setV(0 + rL.oz, 3 + rL.oy, 5 + rL.ox, bootColor);
  setV(0 + rL.oz, 2 + rL.oy, 4 + rL.ox, bootAccent);
  setV(1 + rL.oz, 2 + rL.oy, 5 + rL.ox, armor.secondary);
  setV(1 + rL.oz, 3 + rL.oy, 5 + rL.ox, armor.secondary);

  const tP = poses.torso;
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 4; y++) {
      setV(2 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(3 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(4 + tP.oz, y + tP.oy, x + tP.ox, armor.secondary);
      setV(5 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
    }
  }
  for (let y = 2; y <= 4; y++) {
    setV(3 + tP.oz, y + tP.oy, 1 + tP.ox, shade(armor.primary, 0.9));
    setV(3 + tP.oz, y + tP.oy, 6 + tP.ox, shade(armor.primary, 0.9));
  }
  setV(4 + tP.oz, 3 + tP.oy, 3 + tP.ox, shade(armor.secondary, 1.1));
  setV(4 + tP.oz, 3 + tP.oy, 4 + tP.ox, shade(armor.secondary, 1.1));

  if (heroClass === 'Warrior') {
    setV(5 + tP.oz, 2 + tP.oy, 2 + tP.ox, '#666666');
    setV(5 + tP.oz, 4 + tP.oy, 2 + tP.ox, '#666666');
    setV(5 + tP.oz, 2 + tP.oy, 5 + tP.ox, '#666666');
    setV(5 + tP.oz, 4 + tP.oy, 5 + tP.ox, '#666666');
    for (let x = 2; x <= 5; x++) {
      setV(4 + tP.oz, 2 + tP.oy, x + tP.ox, '#555555');
    }
    setV(5 + tP.oz, 3 + tP.oy, 1 + tP.ox, shade(armor.secondary, 0.8));
    setV(5 + tP.oz, 3 + tP.oy, 6 + tP.ox, shade(armor.secondary, 0.8));
    setV(5 + tP.oz, 2 + tP.oy, 1 + tP.ox, shade(armor.secondary, 0.7));
    setV(5 + tP.oz, 2 + tP.oy, 6 + tP.ox, shade(armor.secondary, 0.7));
  }

  if (heroClass === 'Mage') {
    for (let y = 2; y <= 4; y++) {
      setV(2 + tP.oz, y + tP.oy, 2 + tP.ox, armor.secondary);
      setV(2 + tP.oz, y + tP.oy, 5 + tP.ox, armor.secondary);
    }
  }

  if (heroClass === 'Ranger') {
    setV(3 + tP.oz, 2 + tP.oy, 2 + tP.ox, '#2d4016');
    setV(3 + tP.oz, 2 + tP.oy, 5 + tP.ox, '#2d4016');
  }

  const lA = poses.leftArm;
  setV(5 + lA.oz, 2 + lA.oy, 1 + lA.ox, shade(armor.secondary, 0.9));
  setV(4 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(3 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(3 + lA.oz, 3 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(2 + lA.oz, 2 + lA.oy, 1 + lA.ox, skin);
  setV(2 + lA.oz, 3 + lA.oy, 1 + lA.ox, skin);

  const rA = poses.rightArm;
  setV(5 + rA.oz, 2 + rA.oy, 6 + rA.ox, shade(armor.secondary, 0.9));
  setV(4 + rA.oz, 2 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(3 + rA.oz, 2 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(3 + rA.oz, 3 + rA.oy, 6 + rA.ox, armor.secondary);
  setV(2 + rA.oz, 2 + rA.oy, 6 + rA.ox, skin);
  setV(2 + rA.oz, 3 + rA.oy, 6 + rA.ox, skin);

  const hP = poses.head;
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 4; y++) {
      setV(6 + hP.oz, y + hP.oy, x + hP.ox, skin);
      setV(7 + hP.oz, y + hP.oy, x + hP.ox, skin);
      setV(8 + hP.oz, y + hP.oy, x + hP.ox, skin);
    }
  }

  setV(7 + hP.oz, 2 + hP.oy, 2 + hP.ox, eye);
  setV(7 + hP.oz, 2 + hP.oy, 5 + hP.ox, eye);

  setV(6 + hP.oz, 2 + hP.oy, 3 + hP.ox, shade(skin, 0.85));
  setV(6 + hP.oz, 2 + hP.oy, 4 + hP.ox, shade(skin, 0.85));

  for (let x = 2; x <= 5; x++) {
    setV(9 + hP.oz, 3 + hP.oy, x + hP.ox, hair);
    setV(9 + hP.oz, 4 + hP.oy, x + hP.ox, hair);
    setV(8 + hP.oz, 4 + hP.oy, x + hP.ox, hair);
  }
  setV(9 + hP.oz, 2 + hP.oy, 2 + hP.ox, hair);
  setV(9 + hP.oz, 2 + hP.oy, 5 + hP.ox, hair);

  if (race === 'Dwarf') {
    setV(6 + hP.oz, 2 + hP.oy, 2 + hP.ox, hair);
    setV(6 + hP.oz, 2 + hP.oy, 5 + hP.ox, hair);
    setV(5 + hP.oz, 2 + hP.oy, 3 + hP.ox, hair);
    setV(5 + hP.oz, 2 + hP.oy, 4 + hP.ox, hair);
    setV(5 + hP.oz, 3 + hP.oy, 3 + hP.ox, hair);
  }
  if (race === 'Elf') {
    setV(8 + hP.oz, 1 + hP.oy, 2 + hP.ox, skin);
    setV(8 + hP.oz, 1 + hP.oy, 5 + hP.ox, skin);
    setV(9 + hP.oz, 1 + hP.oy, 2 + hP.ox, skin);
    setV(9 + hP.oz, 1 + hP.oy, 5 + hP.ox, skin);
  }
  if (race === 'Orc') {
    setV(7 + hP.oz, 3 + hP.oy, 1 + hP.ox, skin);
    setV(7 + hP.oz, 3 + hP.oy, 6 + hP.ox, skin);
    setV(6 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#445522');
    setV(6 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#445522');
  }
  if (race === 'Undead') {
    setV(7 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#555555');
    setV(7 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#555555');
    setV(8 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#3a3a3a');
  }
  if (race === 'Barbarian' && !isPirate) {
    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, hair);
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, hair);
    setV(9 + hP.oz, 3 + hP.oy, 2 + hP.ox, hair);
    setV(9 + hP.oz, 3 + hP.oy, 5 + hP.ox, hair);
  }

  if (isPirate) {
    const hatColor = '#1a1a2e';
    const hatBrim = '#222244';
    const hatBand = '#c5a059';
    for (let x = 1; x <= 6; x++) {
      setV(9 + hP.oz, 3 + hP.oy, x + hP.ox, hatBrim);
      setV(9 + hP.oz, 2 + hP.oy, x + hP.ox, hatBrim);
    }
    for (let x = 2; x <= 5; x++) {
      setV(10 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
      setV(10 + hP.oz, 2 + hP.oy, x + hP.ox, hatColor);
      setV(11 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
    }
    for (let x = 3; x <= 4; x++) {
      setV(12 + hP.oz, 3 + hP.oy, x + hP.ox, hatColor);
    }
    setV(10 + hP.oz, 2 + hP.oy, 2 + hP.ox, hatBand);
    setV(10 + hP.oz, 2 + hP.oy, 3 + hP.ox, hatBand);
    setV(10 + hP.oz, 2 + hP.oy, 4 + hP.ox, hatBand);
    setV(10 + hP.oz, 2 + hP.oy, 5 + hP.ox, hatBand);

    const beardColor = '#2a1a0a';
    setV(6 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(6 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
    setV(5 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(5 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
    setV(5 + hP.oz, 3 + hP.oy, 3 + hP.ox, beardColor);
    setV(5 + hP.oz, 3 + hP.oy, 4 + hP.ox, beardColor);
    setV(4 + hP.oz, 2 + hP.oy, 3 + hP.ox, beardColor);
    setV(4 + hP.oz, 2 + hP.oy, 4 + hP.ox, beardColor);
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
      setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#888888');
      setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#888888');
      setV(10 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#888888');
      setV(10 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#888888');
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

    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.secondary);
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.secondary);
    setV(11 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.weapon);
    setV(11 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.weapon);
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
    const model = makeGrid(10, 7);
    const legOff = Math.round(walk * 0.4);
    const isSup = minionType === 'super';
    const armor = isSup ? '#c5a059' : metalDark;
    const armorLight = isSup ? '#d4af37' : metal;
    model[0][1][1 + (legOff > 0 ? 1 : 0)] = dark; model[0][1][5 - (legOff > 0 ? 1 : 0)] = dark;
    model[0][5][1 - (legOff > 0 ? 0 : -1)] = dark; model[0][5][5 + (legOff > 0 ? 0 : -1)] = dark;
    model[1][1][1] = dark; model[1][1][5] = dark; model[1][5][1] = dark; model[1][5][5] = dark;
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) model[2][y][x] = mid;
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) { model[3][y][x] = col; model[4][y][x] = col; }
    for (let x = 0; x <= 6; x++) { model[3][0][x] = armor; model[3][6][x] = armor; model[4][0][x] = armor; model[4][6][x] = armor; }
    for (let y = 0; y <= 6; y++) { model[3][y][0] = armor; model[3][y][6] = armor; model[4][y][0] = armor; model[4][y][6] = armor; }
    for (let x = 1; x <= 5; x++) for (let y = 1; y <= 5; y++) model[5][y][x] = col;
    for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) model[5][y][x] = light;
    model[5][0][3] = armorLight; model[5][6][3] = armorLight; model[5][3][0] = armorLight; model[5][3][6] = armorLight;
    for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) model[6][y][x] = col;
    model[6][3][3] = light;
    model[7][2][3] = '#ef4444'; model[7][4][3] = '#ef4444'; model[7][3][3] = bright;
    model[8][3][3] = bright;
    if (isSup) {
      model[9][3][3] = '#ffd700';
      model[6][3][0] = '#ef4444'; model[7][3][0] = '#ef4444';
      model[6][3][6] = '#ef4444'; model[7][3][6] = '#ef4444';
    }
    model[3][0][1] = metalDark; model[3][0][2] = metal; model[3][0][3] = metalBright;
    model[3][0][4] = metal; model[3][0][5] = metalDark;
    model[4][0][2] = metalBright; model[4][0][3] = metalBright; model[4][0][4] = metalBright;
    model[5][0][3] = metalBright; model[6][0][3] = metal;
    return model;
  }

  if (minionType === 'ranged') {
    const model = makeGrid(8, 5);
    const legOff = Math.round(walk * 0.5);
    model[0][2][1 + (legOff > 0 ? 1 : 0)] = dark;
    model[0][2][3 - (legOff > 0 ? 1 : 0)] = dark;
    model[1][2][1] = mid; model[1][2][3] = mid;
    model[1][2][2] = dark;
    for (let x = 1; x <= 3; x++) model[2][2][x] = col;
    model[2][1][2] = col; model[2][3][2] = col;
    model[3][2][2] = col; model[3][1][2] = mid; model[3][3][2] = mid;
    model[3][2][1] = mid; model[3][2][3] = mid;
    model[4][2][0] = leather; model[4][2][4] = leather;
    model[4][2][2] = light; model[4][1][2] = mid; model[4][3][2] = mid;
    model[5][2][2] = light;
    model[6][1][2] = bright; model[6][3][2] = bright; model[6][2][2] = light;
    model[7][2][2] = bright;
    const bowAngle = bob * 0.3;
    model[3][0][0] = wood; model[4][0][0] = wood; model[5][0][0] = woodLight;
    model[2][0][0] = wood; model[6][0][0] = wood;
    if (bowAngle > 0) { model[3][0][1] = '#d4d4d8'; model[4][0][1] = '#d4d4d8'; model[5][0][1] = '#d4d4d8'; }
    return model;
  }

  const model = makeGrid(7, 5);
  const legOff = Math.round(walk * 0.5);
  model[0][2][1 + (legOff > 0 ? 1 : 0)] = dark;
  model[0][2][3 - (legOff > 0 ? 1 : 0)] = dark;
  model[0][2][2] = metalDark;
  model[1][2][1] = mid; model[1][2][3] = mid; model[1][2][2] = dark;
  for (let x = 1; x <= 3; x++) model[2][2][x] = col;
  model[2][1][2] = col; model[2][3][2] = col;
  model[3][2][2] = col; model[3][1][2] = mid; model[3][3][2] = mid;
  model[3][2][1] = leather; model[3][2][3] = leather;
  model[4][2][2] = light; model[4][1][2] = metal; model[4][3][2] = metal;
  model[5][1][2] = bright; model[5][3][2] = bright; model[5][2][2] = light;
  model[6][2][2] = bright;
  const swingOff = bob > 0.2 ? 1 : 0;
  model[2][0][0] = metal; model[3][0][0] = metalBright;
  model[4 + swingOff][0][0] = metalBright;
  model[2][0][1] = metalDark;
  model[2][4][3] = metalDark; model[2][4][4] = metal; model[3][4][4] = metal;
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

export class VoxelRenderer {
  private spriteCache = new Map<string, ImageBitmap>();
  private tileCache = new Map<string, HTMLCanvasElement>();
  private cubeSize = 4;

  drawHeroVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    raceColor: string, classColor: string,
    heroClass: string, facing: number,
    animState: string, animTimer: number,
    race: string,
    heroName?: string,
    buffTimer?: number,
    heroItems?: ({ id: number } | null)[]
  ) {
    const groundY = y + 6;

    if (heroClass === 'Worg' && buffTimer && buffTimer > 0) {
      const bearModel = buildBearModel(animState, animTimer);
      this.renderVoxelModel(ctx, x, groundY - 28, bearModel, this.cubeSize, facing);
      return;
    }

    if ((animState === 'attack' || animState === 'combo_finisher' || animState === 'lunge_slash' || animState === 'dash_attack') && animTimer > 0.03) {
      const isFinisher = animState === 'combo_finisher';
      const isLunge = animState === 'lunge_slash';
      const isDash = animState === 'dash_attack';
      const trailAlpha = isFinisher ? 0.4 : isLunge ? 0.2 : isDash ? 0.15 : 0.12;
      const trailCount = isFinisher ? 4 : isLunge ? 2 : isDash ? 2 : 1;
      const classTrailColors: Record<string, string> = { Warrior: '#ef4444', Mage: '#8b5cf6', Ranger: '#22c55e', Worg: '#f97316' };
      const trailTint = classTrailColors[heroClass] || '#ffffff';
      for (let ti = 0; ti < trailCount; ti++) {
        const trailOffset = 0.05 + ti * 0.05;
        ctx.save();
        ctx.globalAlpha = trailAlpha * (1 - ti * 0.25);
        ctx.globalCompositeOperation = 'lighter';
        const trailModel = buildHeroModel(race, heroClass, animState, Math.max(0, animTimer - trailOffset), heroName, heroItems);
        this.renderVoxelModel(ctx, x, groundY - 12, trailModel, this.cubeSize, facing);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (isFinisher ? trailAlpha * 0.6 : trailAlpha * 0.35) * (1 - ti * 0.25);
        ctx.fillStyle = trailTint;
        const trailSize = isFinisher ? 36 : isLunge ? 28 : 24;
        ctx.fillRect(x - trailSize / 2, groundY - trailSize, trailSize, trailSize);
        ctx.restore();
      }
    }

    const model = buildHeroModel(race, heroClass, animState, animTimer, heroName, heroItems);
    this.renderVoxelModel(ctx, x, groundY - 12, model, this.cubeSize, facing);

    if (animState === 'attack' && animTimer > 0.02) {
      this.drawAttackVFX(ctx, x, groundY, heroClass, facing, animTimer, race);
    }
    if (animState === 'ability' && animTimer > 0.02) {
      this.drawAbilityVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
    if (animState === 'dash_attack' && animTimer > 0.02) {
      this.drawDashVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
    if (animState === 'lunge_slash' && animTimer > 0.02) {
      this.drawLungeSlashVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
    if (animState === 'combo_finisher' && animTimer > 0.02) {
      this.drawComboFinisherVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
  }

  private drawAttackVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number, race?: string) {
    const atkProgress = Math.min(1, t / 0.65);
    const weaponType = race ? getHeroWeapon(race, heroClass) : 'sword_shield';

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
          for (let i = 0; i < 5; i++) {
            const sa = Math.random() * Math.PI * 2;
            const sd = shockRadius * 0.5 + Math.random() * shockRadius * 0.5;
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
      const swing = atkProgress >= 0.3 && atkProgress < 0.6 ? (atkProgress - 0.3) / 0.3 : 0;
      const followThru = atkProgress >= 0.6 ? Math.min(1, (atkProgress - 0.6) / 0.25) : 0;
      const primaryColor = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
      const secondaryColor = heroClass === 'Warrior' ? '#fca5a5' : '#fdba74';

      if (swing > 0.05) {
        ctx.save();
        ctx.translate(x, y - 10);

        const arcStart = facing - Math.PI * 0.75;
        const arcEnd = facing + Math.PI * 0.55;
        const arcAngle = arcStart + (arcEnd - arcStart) * swing;
        const reachDist = 24 + swing * 20;

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
          for (let s = 0; s < sparkCount; s++) {
            const sa = arcAngle - s * 0.12;
            const sr = reachDist + (Math.random() - 0.5) * 12;
            const sx = Math.cos(sa) * sr;
            const sy = Math.sin(sa) * sr;
            ctx.fillStyle = s % 2 === 0 ? '#ffffff' : secondaryColor;
            ctx.globalAlpha = (1 - swing) * 2.5;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + Math.random() * 1.5, 0, Math.PI * 2);
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

        for (let i = 0; i < 4; i++) {
          const sparkAngle = facing + (Math.random() - 0.5) * 1.2;
          const sparkDist = 20 + followThru * 25 + Math.random() * 10;
          ctx.fillStyle = '#fde68a';
          ctx.globalAlpha = fadeAlpha * 0.5;
          ctx.beginPath();
          ctx.arc(Math.cos(sparkAngle) * sparkDist, Math.sin(sparkAngle) * sparkDist, 1 + Math.random(), 0, Math.PI * 2);
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

            for (let s = 0; s < 4; s++) {
              const sa = facing + (s - 1.5) * 0.6;
              const sd = impactRadius + Math.random() * 5;
              ctx.fillStyle = '#bbf7d0';
              ctx.globalAlpha = (1 - impactProgress) * 0.5;
              ctx.beginPath();
              ctx.arc(arrowX + Math.cos(sa) * sd, arrowY + Math.sin(sa) * sd, 1 + Math.random(), 0, Math.PI * 2);
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
          ctx.arc(orbX + Math.cos(sa) * sr, orbY + Math.sin(sa) * sr, 1.2 + Math.random() * 0.8, 0, Math.PI * 2);
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
    for (let i = 0; i < 3; i++) {
      const sa = sparkAngle + (Math.random() - 0.5) * 1.2;
      const sd = 3 + Math.random() * 8;
      ctx.fillStyle = trailColor;
      ctx.globalAlpha = (1 - thrust) * 0.5;
      ctx.beginPath();
      ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, 1 + Math.random(), 0, Math.PI * 2);
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
        for (let s = 0; s < 5; s++) {
          const sa = arcAngle - s * 0.12;
          const sr = slashDist + (Math.random() - 0.5) * 12;
          ctx.fillStyle = s % 2 === 0 ? '#ffffff' : classColor;
          ctx.globalAlpha = (1 - slash) * 1.5;
          ctx.shadowBlur = 3;
          ctx.beginPath();
          ctx.arc(Math.cos(sa) * sr, Math.sin(sa) * sr, 1.5 + Math.random(), 0, Math.PI * 2);
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
      for (let i = 0; i < 3; i++) {
        const sa = sparkAngle + (Math.random() - 0.5) * 1.0;
        const sd = 4 + Math.random() * 10;
        ctx.fillStyle = classColor;
        ctx.globalAlpha = (1 - progress) * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(sa) * sd, Math.sin(sa) * sd, 1 + Math.random() * 0.5, 0, Math.PI * 2);
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
    const skin = RACE_SKIN[race] || '#c4956a';
    const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
    const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
    const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';
    const isPirate = heroName?.includes('Racalvin') || heroName?.includes('Pirate King');

    const px = Math.floor(width / 8);
    const py = Math.floor(height / 10);

    ctx.fillStyle = armor.primary;
    ctx.fillRect(x + px, y + height - py * 3, width - px * 2, py * 3);
    ctx.fillStyle = armor.secondary;
    ctx.fillRect(x + px * 2, y + height - py * 2, width - px * 4, py);

    ctx.fillStyle = skin;
    ctx.fillRect(x + px * 2, y + py * 2, width - px * 4, py * 5);

    ctx.fillStyle = shade(skin, 0.9);
    ctx.fillRect(x + px * 2, y + py * 5, width - px * 4, py);

    ctx.fillStyle = eye;
    ctx.fillRect(x + px * 2 + px, y + py * 4, px, py);
    ctx.fillRect(x + width - px * 3 - px, y + py * 4, px, py);

    ctx.fillStyle = '#ffffff';
    const eyeHighlight = Math.max(1, Math.floor(px * 0.4));
    ctx.fillRect(x + px * 2 + px, y + py * 4, eyeHighlight, eyeHighlight);
    ctx.fillRect(x + width - px * 3 - px, y + py * 4, eyeHighlight, eyeHighlight);

    ctx.fillStyle = shade(skin, 0.8);
    ctx.fillRect(x + px * 3, y + py * 5, px, Math.floor(py * 0.6));
    ctx.fillRect(x + width - px * 4, y + py * 5, px, Math.floor(py * 0.6));

    ctx.fillStyle = hair;
    ctx.fillRect(x + px, y + py, width - px * 2, py * 2);
    ctx.fillRect(x + px, y + py * 2, px, py * 2);
    ctx.fillRect(x + width - px * 2, y + py * 2, px, py * 2);

    if (race === 'Dwarf') {
      ctx.fillStyle = hair;
      ctx.fillRect(x + px * 2, y + py * 6, px, py * 2);
      ctx.fillRect(x + width - px * 3, y + py * 6, px, py * 2);
      ctx.fillRect(x + px * 3, y + py * 7, width - px * 6, py);
    }

    if (race === 'Elf') {
      ctx.fillStyle = skin;
      ctx.fillRect(x + px, y + py * 3, px, py * 2);
      ctx.fillRect(x + width - px * 2, y + py * 3, px, py * 2);
    }

    if (race === 'Orc') {
      ctx.fillStyle = '#445522';
      ctx.fillRect(x + px * 3, y + py * 6, px, py);
      ctx.fillRect(x + width - px * 4, y + py * 6, px, py);
    }

    if (race === 'Undead') {
      ctx.fillStyle = '#555555';
      ctx.fillRect(x + px * 3, y + py * 5, width - px * 6, Math.floor(py * 0.5));
    }

    if (isPirate) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y + py, width, py);
      ctx.fillRect(x + px, y, width - px * 2, py * 2);
      ctx.fillStyle = '#c5a059';
      ctx.fillRect(x + px, y + py * 2, width - px * 2, Math.max(1, Math.floor(py * 0.4)));
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(x + px * 2, y + py * 6, width - px * 4, py * 2);
    }

    if (heroClass === 'Warrior' && !isPirate) {
      ctx.fillStyle = '#888888';
      ctx.fillRect(x + px, y + py, width - px * 2, Math.max(1, Math.floor(py * 0.5)));
      ctx.fillRect(x + px * 2, y + py * 2, px, py);
      ctx.fillRect(x + width - px * 3, y + py * 2, px, py);
    }

    if (heroClass === 'Mage') {
      ctx.fillStyle = armor.secondary;
      ctx.fillRect(x + px, y, width - px * 2, py);
      ctx.fillRect(x + px * 3, y - Math.floor(py * 0.5), px * 2, py);
    }

    ctx.fillStyle = armor.primary + '44';
    ctx.fillRect(x, y, 1, height);
    ctx.fillRect(x + width - 1, y, 1, height);
    ctx.fillRect(x, y, width, 1);
    ctx.fillRect(x, y + height - 1, width, 1);
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
            ctx.arc((5 + fd) * scale * facingFlip, (-18 + Math.random() * 4) * scale + bob, fs * scale, 0, Math.PI * 2);
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

    const dir = facingToDir(facing);

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

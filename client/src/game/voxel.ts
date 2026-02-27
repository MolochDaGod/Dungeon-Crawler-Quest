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

function getAnimPoses(heroClass: string, animState: string, animTimer: number): {
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
    const stride = 1.8;
    const liftHeight = 0.6;
    const bounce = Math.abs(Math.sin(t * freq * 2)) * 0.4;
    const hipSway = Math.sin(t * freq) * 0.3;
    return {
      leftLeg: { ox: Math.round(phase * stride), oy: 0, oz: Math.round(Math.max(0, -phase) * liftHeight) },
      rightLeg: { ox: Math.round(-phase * stride), oy: 0, oz: Math.round(Math.max(0, phase) * liftHeight) },
      leftArm: { ox: Math.round(-phase * 1.2), oy: 0, oz: Math.round(phase2 * 0.4) },
      rightArm: { ox: Math.round(phase * 1.2), oy: 0, oz: Math.round(-phase2 * 0.4) },
      torso: { ox: 0, oy: Math.round(hipSway), oz: Math.round(bounce) },
      head: { ox: 0, oy: Math.round(Math.sin(t * freq * 0.5) * 0.2), oz: Math.round(bounce * 0.8) },
      weapon: { ox: Math.round(phase * 0.5), oy: 0, oz: Math.round(bounce * 0.2) },
      weaponGlow: 0
    };
  }

  if (animState === 'attack') {
    const atkProgress = Math.min(1, t / 0.65);
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
    const phase = t * 24;
    const spin = Math.sin(phase);
    const spin2 = Math.cos(phase * 0.7);
    const power = Math.abs(Math.sin(phase * 0.5));
    const slam = Math.max(0, Math.sin(phase * 0.5 + 1.2));
    const twist = Math.sin(phase * 1.3) * 2.0;
    const bodyLean = Math.sin(phase * 0.8) * 1.8;
    return {
      leftLeg: { ox: Math.round(spin * 3.5), oy: Math.round(spin2 * 1.0 + twist * 0.4), oz: Math.round(Math.max(0, -spin) * 2.0) },
      rightLeg: { ox: Math.round(-spin * 3.5), oy: Math.round(-spin2 * 1.0 - twist * 0.4), oz: Math.round(Math.max(0, spin) * 2.0) },
      leftArm: { ox: Math.round(spin * 6), oy: Math.round(-power * 4.5 + twist), oz: Math.round(power * 6 + slam * 3.0) },
      rightArm: { ox: Math.round(-spin * 5), oy: Math.round(power * 2.5 - twist), oz: Math.round(power * 5 + slam * 2.0) },
      torso: { ox: Math.round(spin * 2.5 + bodyLean), oy: Math.round(twist * 1.2), oz: Math.round(power * 1.5 - slam * 2.5) },
      head: { ox: Math.round(spin * 1.5 + bodyLean * 0.7), oy: Math.round(twist * 0.8), oz: Math.round(power * 1.2 - slam * 2.0) },
      weapon: { ox: Math.round(spin * 8 + power * 5), oy: Math.round(-power * 6 + slam * 3.0 + twist), oz: Math.round(power * 8 - slam * 5) },
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

function buildHeroModel(race: string, heroClass: string, animState: string, animTimer: number, heroName?: string, heroItems?: ({ id: number } | null)[]): VoxelModel {
  const isPirate = heroName?.includes('Racalvin') || heroName?.includes('Pirate King');
  const skin = RACE_SKIN[race] || '#c4956a';
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
  const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';

  const W = 8, D = 8, H = 14;
  const model: VoxelModel = [];
  for (let z = 0; z < H; z++) {
    model[z] = [];
    for (let y = 0; y < D; y++) {
      model[z][y] = [];
      for (let x = 0; x < W; x++) model[z][y][x] = null;
    }
  }

  const poses = getAnimPoses(heroClass, animState, animTimer);

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < H && y >= 0 && y < D && x >= 0 && x < W) {
      if (poses.weaponGlow > 0 && animState === 'ability') {
        c = blend(c, '#ffd700', poses.weaponGlow * 0.25);
      }
      model[z][y][x] = c;
    }
  };

  const lL = poses.leftLeg, rL = poses.rightLeg;
  setV(0 + lL.oz, 2 + lL.oy, 2 + lL.ox, armor.primary);
  setV(0 + lL.oz, 3 + lL.oy, 2 + lL.ox, armor.primary);
  setV(1 + lL.oz, 2 + lL.oy, 2 + lL.ox, armor.secondary);
  setV(1 + lL.oz, 3 + lL.oy, 2 + lL.ox, armor.secondary);

  setV(0 + rL.oz, 2 + rL.oy, 5 + rL.ox, armor.primary);
  setV(0 + rL.oz, 3 + rL.oy, 5 + rL.ox, armor.primary);
  setV(1 + rL.oz, 2 + rL.oy, 5 + rL.ox, armor.secondary);
  setV(1 + rL.oz, 3 + rL.oy, 5 + rL.ox, armor.secondary);

  setV(0, 2, 2, skin); setV(0, 3, 2, skin);
  setV(0, 2, 5, skin); setV(0, 3, 5, skin);

  const tP = poses.torso;
  for (let x = 2; x <= 5; x++) {
    for (let y = 2; y <= 4; y++) {
      setV(2 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(3 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
      setV(4 + tP.oz, y + tP.oy, x + tP.ox, armor.secondary);
      setV(5 + tP.oz, y + tP.oy, x + tP.ox, armor.primary);
    }
  }

  if (heroClass === 'Warrior') {
    setV(5 + tP.oz, 2 + tP.oy, 2 + tP.ox, '#666666');
    setV(5 + tP.oz, 4 + tP.oy, 2 + tP.ox, '#666666');
    setV(5 + tP.oz, 2 + tP.oy, 5 + tP.ox, '#666666');
    setV(5 + tP.oz, 4 + tP.oy, 5 + tP.ox, '#666666');
    for (let x = 2; x <= 5; x++) {
      setV(4 + tP.oz, 2 + tP.oy, x + tP.ox, '#555555');
    }
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
  setV(4 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(3 + lA.oz, 2 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(3 + lA.oz, 3 + lA.oy, 1 + lA.ox, armor.secondary);
  setV(2 + lA.oz, 2 + lA.oy, 1 + lA.ox, skin);
  setV(2 + lA.oz, 3 + lA.oy, 1 + lA.ox, skin);

  const rA = poses.rightArm;
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
    setV(2 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#c5a059');
    for (let z = 3; z <= 4; z++) {
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, '#8a6914');
    }
    setV(5 + wP.oz, 0 + wP.oy, 0 + wP.ox, '#999999');
    setV(5 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#999999');
    setV(5 + wP.oz, 2 + wP.oy, 0 + wP.ox, '#999999');
    for (let z = 6; z <= 11; z++) {
      const bladeShade = z > 9 ? 1.3 : z > 7 ? 1.1 : 1.0;
      const bladeColor = poses.weaponGlow > 0 ? blend(armor.weapon, '#ffffff', poses.weaponGlow * (z - 5) * 0.1) : shade(armor.weapon, bladeShade);
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, bladeColor);
    }
    setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, poses.weaponGlow > 0 ? blend('#ffffff', armor.weapon, 0.3) : shade(armor.weapon, 1.4));

    setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
    setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
    setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#aaaaaa');

    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#888888');
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#888888');
    setV(10 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#888888');
    setV(10 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#888888');
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
  const dark = shade(color, 0.6);
  const mid = shade(color, 0.85);
  const light = shade(color, 1.2);
  const bright = shade(color, 1.4);
  const bob = Math.sin(animTimer * 6);
  const walk = Math.sin(animTimer * 8);

  if (minionType === 'siege' || minionType === 'super') {
    const model: VoxelModel = [];
    const h = 8; const w = 5;
    for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
    const legOff = Math.round(walk * 0.5);
    model[0][1][0 + (legOff > 0 ? 1 : 0)] = dark;
    model[0][1][4 - (legOff > 0 ? 1 : 0)] = dark;
    model[0][3][0 - (legOff > 0 ? 0 : -1)] = dark;
    model[0][3][4 + (legOff > 0 ? 0 : -1)] = dark;
    for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) { model[1][y][x] = dark; model[2][y][x] = mid; }
    for (let x = 0; x <= 4; x++) for (let y = 0; y <= 4; y++) {
      if (x === 0 || x === 4 || y === 0 || y === 4) { if ((x + y) % 2 === 0) model[3][y][x] = mid; }
      else { model[3][y][x] = color; model[4][y][x] = color; }
    }
    for (let x = 1; x <= 3; x++) for (let y = 1; y <= 3; y++) model[5][y][x] = color;
    model[6][2][1] = light; model[6][2][3] = light; model[6][2][2] = bright;
    model[7][2][2] = bright;
    const weaponColor = '#888888';
    model[3][0][2] = weaponColor; model[4][0][2] = weaponColor; model[5][0][2] = shade(weaponColor, 1.3);
    return model;
  }

  if (minionType === 'ranged') {
    const model: VoxelModel = [];
    const h = 7; const w = 3;
    for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
    const legOff = Math.round(walk * 0.5);
    model[0][1][0 + (legOff > 0 ? 1 : 0)] = dark;
    model[0][1][2 - (legOff > 0 ? 1 : 0)] = dark;
    model[1][1][1] = mid;
    for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) {
      if (Math.abs(x - 1) + Math.abs(y - 1) <= 1) model[2][y][x] = color;
    }
    model[3][1][1] = color; model[3][0][1] = mid; model[3][2][1] = mid;
    model[4][1][0] = shade('#8b6c42', 0.8); model[4][1][2] = shade('#8b6c42', 0.8);
    model[5][1][1] = light;
    model[6][1][1] = bright;
    model[3][0][0] = shade('#6b4423', 0.9); model[4][0][0] = shade('#6b4423', 0.9); model[5][0][0] = shade('#6b4423', 1.1);
    return model;
  }

  const model: VoxelModel = [];
  const h = 6; const w = 3;
  for (let z = 0; z < h; z++) { model[z] = []; for (let y = 0; y < w; y++) { model[z][y] = []; for (let x = 0; x < w; x++) model[z][y][x] = null; } }
  const legOff = Math.round(walk * 0.5);
  model[0][1][0 + (legOff > 0 ? 1 : 0)] = dark;
  model[0][1][2 - (legOff > 0 ? 1 : 0)] = dark;
  model[1][1][1] = mid;
  for (let x = 0; x < w; x++) for (let y = 0; y < w; y++) {
    if (Math.abs(x - 1) + Math.abs(y - 1) <= 1) model[2][y][x] = color;
  }
  model[3][1][1] = color; model[3][0][1] = mid;
  model[4][1][1] = light;
  model[5][1][1] = bright;
  const swordColor = '#a0a0a0';
  model[2][0][0] = swordColor; model[3][0][0] = shade(swordColor, 1.2);
  if (bob > 0.3) model[4][0][0] = shade(swordColor, 1.4);
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

    if ((animState === 'attack' || animState === 'combo_finisher') && animTimer > 0.05) {
      const isFinisher = animState === 'combo_finisher';
      const trailAlpha = isFinisher ? 0.35 : 0.1;
      const trailCount = isFinisher ? 3 : 1;
      const classTrailColors: Record<string, string> = { Warrior: '#ef4444', Mage: '#8b5cf6', Ranger: '#22c55e', Worg: '#f97316' };
      const trailTint = classTrailColors[heroClass] || '#ffffff';
      for (let ti = 0; ti < trailCount; ti++) {
        const trailOffset = 0.08 + ti * 0.06;
        ctx.save();
        ctx.globalAlpha = trailAlpha * (1 - ti * 0.3);
        ctx.globalCompositeOperation = 'lighter';
        const trailModel = buildHeroModel(race, heroClass, animState, Math.max(0, animTimer - trailOffset), heroName, heroItems);
        this.renderVoxelModel(ctx, x, groundY - 12, trailModel, this.cubeSize, facing);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = (isFinisher ? trailAlpha * 0.5 : trailAlpha * 0.3) * (1 - ti * 0.3);
        ctx.fillStyle = trailTint;
        const trailSize = isFinisher ? 32 : 24;
        ctx.fillRect(x - trailSize / 2, groundY - trailSize, trailSize, trailSize);
        ctx.restore();
      }
    }

    const model = buildHeroModel(race, heroClass, animState, animTimer, heroName, heroItems);
    this.renderVoxelModel(ctx, x, groundY - 12, model, this.cubeSize, facing);

    if (animState === 'attack' && animTimer > 0.02) {
      this.drawAttackVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
    if (animState === 'ability' && animTimer > 0.02) {
      this.drawAbilityVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
    if (animState === 'dash_attack' && animTimer > 0.02) {
      this.drawDashVFX(ctx, x, groundY, heroClass, facing, animTimer);
    }
  }

  private drawAttackVFX(ctx: CanvasRenderingContext2D, x: number, y: number, heroClass: string, facing: number, t: number) {
    const atkProgress = Math.min(1, t / 0.65);

    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      const swing = atkProgress >= 0.35 && atkProgress < 0.65 ? (atkProgress - 0.35) / 0.3 : 0;
      const followThru = atkProgress >= 0.65 ? Math.min(1, (atkProgress - 0.65) / 0.2) : 0;

      if (swing > 0.05) {
        ctx.save();
        ctx.translate(x, y - 10);

        const arcStart = facing - Math.PI * 0.6;
        const arcEnd = facing + Math.PI * 0.4;
        const arcAngle = arcStart + (arcEnd - arcStart) * swing;
        const reachDist = 22 + swing * 18;

        ctx.strokeStyle = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
        ctx.lineWidth = 3 + swing * 2;
        ctx.globalAlpha = 0.7 + swing * 0.3;
        ctx.shadowColor = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
        ctx.shadowBlur = 8 + swing * 6;
        ctx.beginPath();
        ctx.arc(0, 0, reachDist, arcStart, arcAngle);
        ctx.stroke();

        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, reachDist + 6, arcStart + 0.1, arcAngle - 0.1);
        ctx.stroke();

        if (swing > 0.6) {
          const sparkCount = 3;
          for (let s = 0; s < sparkCount; s++) {
            const sa = arcAngle - s * 0.15;
            const sr = reachDist + (Math.random() - 0.5) * 8;
            const sx = Math.cos(sa) * sr;
            const sy = Math.sin(sa) * sr;
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = (1 - swing) * 2;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5 + Math.random(), 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (followThru > 0 && followThru < 0.6) {
        ctx.save();
        ctx.translate(x, y - 10);
        const trailColor = heroClass === 'Warrior' ? '#ef4444' : '#f97316';
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = (0.6 - followThru) * 1.5;
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = 4;
        const fullArcStart = facing - Math.PI * 0.6;
        const fullArcEnd = facing + Math.PI * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, 36, fullArcStart, fullArcEnd);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
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
        const arrowDist = release * 45 + recoil * 20;
        const arrowX = Math.cos(facing) * (14 + arrowDist);
        const arrowY = Math.sin(facing) * (14 + arrowDist);
        const fadeAlpha = Math.max(0, 1 - recoil * 1.5);

        if (fadeAlpha > 0) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = fadeAlpha;
          ctx.shadowColor = '#22c55e';
          ctx.shadowBlur = 6;
          const trailLen = 10 + release * 8;
          ctx.beginPath();
          ctx.moveTo(arrowX - Math.cos(facing) * trailLen, arrowY - Math.sin(facing) * trailLen);
          ctx.lineTo(arrowX, arrowY);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(arrowX + Math.cos(facing) * 4, arrowY + Math.sin(facing) * 4);
          ctx.lineTo(arrowX + Math.cos(facing - 0.5) * -3, arrowY + Math.sin(facing - 0.5) * -3);
          ctx.lineTo(arrowX + Math.cos(facing + 0.5) * -3, arrowY + Math.sin(facing + 0.5) * -3);
          ctx.fill();

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
          const runeRadius = 10 + channel * 6;
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1;
          ctx.globalAlpha = channel * 0.5;
          const runeRot = t * 8;
          ctx.beginPath();
          ctx.arc(orbX, orbY, runeRadius, runeRot, runeRot + Math.PI * 1.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(orbX, orbY, runeRadius * 0.6, runeRot + Math.PI, runeRot + Math.PI * 2.2);
          ctx.stroke();
        }

        const sparkCount = Math.floor(channel * 4 + cast * 3);
        for (let s = 0; s < sparkCount; s++) {
          const sa = t * 6 + s * (Math.PI * 2 / Math.max(1, sparkCount));
          const sr = orbRadius + 2 + Math.sin(t * 12 + s) * 4;
          ctx.fillStyle = s % 2 === 0 ? '#e9d5ff' : '#a855f7';
          ctx.globalAlpha = 0.4 + Math.sin(t * 10 + s * 2) * 0.3;
          ctx.beginPath();
          ctx.arc(orbX + Math.cos(sa) * sr, orbY + Math.sin(sa) * sr, 1 + Math.random() * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (cast > 0.3 && recover < 0.5) {
        const castDist = (cast - 0.3) * 1.4 * 35;
        const castX = orbX + Math.cos(facing) * castDist;
        const castY = orbY + Math.sin(facing) * castDist;
        const castAlpha = Math.max(0, 1 - recover * 2);

        if (castAlpha > 0) {
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 2;
          ctx.globalAlpha = castAlpha * 0.6;
          ctx.shadowColor = '#9333ea';
          ctx.shadowBlur = 8;

          const burstRadius = 4 + cast * 8;
          ctx.beginPath();
          ctx.arc(castX, castY, burstRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#e9d5ff';
          ctx.globalAlpha = castAlpha * 0.8;
          ctx.beginPath();
          ctx.arc(castX, castY, 2, 0, Math.PI * 2);
          ctx.fill();

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

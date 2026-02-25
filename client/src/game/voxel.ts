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

export type TerrainType = 'grass' | 'dirt' | 'stone' | 'water' | 'lane' | 'jungle' | 'base_blue' | 'base_red' | 'river';
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
    const phase = Math.sin(t * 10);
    const phase2 = Math.cos(t * 10);
    return {
      leftLeg: { ox: Math.round(phase * 1.2), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(-phase * 1.2), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(-phase * 0.8), oy: 0, oz: Math.round(phase2 * 0.3) },
      rightArm: { ox: Math.round(phase * 0.8), oy: 0, oz: Math.round(-phase2 * 0.3) },
      torso: { ox: 0, oy: 0, oz: Math.round(Math.abs(phase) * 0.3) },
      head: { ox: 0, oy: 0, oz: Math.round(Math.abs(phase) * 0.3) },
      weapon: { ox: Math.round(phase * 0.5), oy: 0, oz: 0 },
      weaponGlow: 0
    };
  }

  if (animState === 'attack') {
    if (heroClass === 'Warrior' || heroClass === 'Worg') {
      const phase = t * 14;
      const windUp = Math.max(0, Math.sin(phase) * 1.5);
      const swing = Math.max(0, Math.sin(phase + 1.5));
      const armExtend = Math.round(windUp > 0.5 ? -windUp : swing * 2);
      return {
        leftLeg: { ox: Math.round(Math.sin(phase * 0.5) * 0.5), oy: 0, oz: 0 },
        rightLeg: { ox: Math.round(-Math.sin(phase * 0.5) * 0.5), oy: 0, oz: 0 },
        leftArm: { ox: armExtend, oy: Math.round(swing * -1), oz: Math.round(swing * 2) },
        rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: Math.round(swing * 0.5), oy: 0, oz: 0 },
        head: { ox: Math.round(swing * 0.3), oy: 0, oz: 0 },
        weapon: { ox: armExtend + Math.round(swing * 1.5), oy: Math.round(swing * -2), oz: Math.round(windUp * 3 - swing * 2) },
        weaponGlow: swing > 0.3 ? 0.6 : 0
      };
    }
    if (heroClass === 'Ranger') {
      const drawPhase = (Math.sin(t * 8) + 1) * 0.5;
      const release = Math.max(0, Math.sin(t * 8 + 2));
      return {
        leftLeg: { ox: 0, oy: 0, oz: 0 },
        rightLeg: { ox: Math.round(drawPhase * -0.5), oy: 0, oz: 0 },
        leftArm: { ox: Math.round(drawPhase * -2), oy: 0, oz: Math.round(drawPhase) },
        rightArm: { ox: Math.round(release * 2), oy: 0, oz: Math.round(drawPhase) },
        torso: { ox: Math.round(-drawPhase * 0.3), oy: 0, oz: 0 },
        head: { ox: Math.round(release * 0.5), oy: 0, oz: 0 },
        weapon: { ox: Math.round(-drawPhase * 1.5), oy: 0, oz: Math.round(drawPhase * 2) },
        weaponGlow: release > 0.5 ? 0.8 : 0
      };
    }
    if (heroClass === 'Mage') {
      const raise = (Math.sin(t * 6) + 1) * 0.5;
      const cast = Math.max(0, Math.sin(t * 6 + 2));
      return {
        leftLeg: { ox: 0, oy: 0, oz: 0 },
        rightLeg: { ox: 0, oy: 0, oz: 0 },
        leftArm: { ox: Math.round(cast * 2), oy: 0, oz: Math.round(raise * 3) },
        rightArm: { ox: Math.round(cast * 1), oy: 0, oz: Math.round(raise * 2) },
        torso: { ox: 0, oy: 0, oz: Math.round(raise * 0.5) },
        head: { ox: 0, oy: 0, oz: Math.round(raise * 0.5) },
        weapon: { ox: Math.round(cast * 2), oy: 0, oz: Math.round(raise * 4) },
        weaponGlow: raise > 0.3 ? raise : 0
      };
    }
    return idle;
  }

  if (animState === 'ability') {
    const pulse = (Math.sin(t * 8) + 1) * 0.5;
    const burst = Math.max(0, Math.sin(t * 8 + 1.5));
    return {
      leftLeg: { ox: Math.round(-burst * 0.5), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(burst * 0.5), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(burst * 2), oy: Math.round(-pulse), oz: Math.round(pulse * 3) },
      rightArm: { ox: Math.round(burst * 2), oy: Math.round(pulse), oz: Math.round(pulse * 3) },
      torso: { ox: 0, oy: 0, oz: Math.round(pulse * 0.5) },
      head: { ox: 0, oy: 0, oz: Math.round(pulse * 0.5) },
      weapon: { ox: Math.round(burst * 2), oy: 0, oz: Math.round(pulse * 4) },
      weaponGlow: pulse * 0.9
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
    const phase = t * 16;
    const spin = Math.sin(phase);
    const power = Math.abs(Math.sin(phase * 0.5));
    return {
      leftLeg: { ox: Math.round(spin * 1.5), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(-spin * 1.5), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(spin * 3), oy: Math.round(-power * 2), oz: Math.round(power * 3) },
      rightArm: { ox: Math.round(-spin * 2), oy: Math.round(power), oz: Math.round(power * 2) },
      torso: { ox: Math.round(spin * 1), oy: 0, oz: Math.round(power * 0.5) },
      head: { ox: Math.round(spin * 0.5), oy: 0, oz: Math.round(power * 0.5) },
      weapon: { ox: Math.round(spin * 4 + power * 2), oy: Math.round(-power * 3), oz: Math.round(power * 4) },
      weaponGlow: power > 0.4 ? 1.0 : 0.3
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

function buildHeroModel(race: string, heroClass: string, animState: string, animTimer: number): VoxelModel {
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
  if (race === 'Barbarian') {
    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, hair);
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, hair);
    setV(9 + hP.oz, 3 + hP.oy, 2 + hP.ox, hair);
    setV(9 + hP.oz, 3 + hP.oy, 5 + hP.ox, hair);
  }

  const wP = poses.weapon;
  if (heroClass === 'Warrior') {
    for (let z = 3; z <= 9; z++) {
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, z < 5 ? '#8a6914' : armor.weapon);
    }
    setV(10 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(armor.weapon, 1.3));
    if (poses.weaponGlow > 0) {
      setV(9 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow));
    }

    setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
    setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#aaaaaa');
    setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#aaaaaa');

    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, '#888888');
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, '#888888');
    setV(10 + hP.oz, 2 + hP.oy, 3 + hP.ox, '#888888');
    setV(10 + hP.oz, 2 + hP.oy, 4 + hP.ox, '#888888');
  }

  if (heroClass === 'Worg') {
    for (let z = 2; z <= 7; z++) {
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, z < 4 ? '#5a3a1a' : armor.weapon);
    }
    setV(8 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(armor.weapon, 0.7));
    setV(7 + wP.oz, 0 + wP.oy, 0 + wP.ox, armor.weapon);
    if (poses.weaponGlow > 0) {
      setV(7 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ff4400', poses.weaponGlow));
    }
  }

  if (heroClass === 'Ranger') {
    for (let z = 3; z <= 9; z++) {
      setV(z + wP.oz, 0 + wP.oy, 0 + wP.ox, '#6b4423');
    }
    setV(3 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#666666');
    setV(9 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#666666');
    setV(6 + wP.oz, 1 + wP.oy, 0 + wP.ox, '#999999');

    setV(4 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#6b4423');
    setV(5 + rA.oz, 3 + rA.oy, 6 + rA.ox, '#6b4423');
    setV(5 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#2d5016');
    setV(4 + rA.oz, 4 + rA.oy, 6 + rA.ox, '#2d5016');

    if (poses.weaponGlow > 0) {
      setV(6 + wP.oz, 0 + wP.oy, -1 + wP.ox, blend('#666666', '#ffff00', poses.weaponGlow));
    }
  }

  if (heroClass === 'Mage') {
    for (let z = 2; z <= 11; z++) {
      setV(z + wP.oz, 1 + wP.oy, 0 + wP.ox, '#553322');
    }
    setV(12 + wP.oz, 1 + wP.oy, 0 + wP.ox, armor.weapon);
    setV(13 + wP.oz, 1 + wP.oy, 0 + wP.ox, shade(armor.weapon, 1.4));
    if (poses.weaponGlow > 0) {
      setV(13 + wP.oz, 1 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow));
      setV(12 + wP.oz, 0 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.5));
      setV(12 + wP.oz, 2 + wP.oy, 0 + wP.ox, blend(armor.weapon, '#ffffff', poses.weaponGlow * 0.5));
    }

    setV(10 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.secondary);
    setV(10 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.secondary);
    setV(11 + hP.oz, 3 + hP.oy, 3 + hP.ox, armor.weapon);
    setV(11 + hP.oz, 3 + hP.oy, 4 + hP.ox, armor.weapon);
  }

  return model;
}

function buildMinionModel(color: string, minionType: string, animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = minionType === 'siege' ? 6 : 4;
  const w = minionType === 'siege' ? 5 : 3;

  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) {
        model[z][y][x] = null;
      }
    }
  }

  const dark = shade(color, 0.6);
  const light = shade(color, 1.2);
  const bob = Math.sin(animTimer * 6);

  if (minionType === 'siege') {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < w; y++) {
        model[0][y][x] = dark;
        model[1][y][x] = color;
        model[2][y][x] = color;
        model[3][y][x] = color;
      }
    }
    model[4][1][1] = light;
    model[4][2][2] = light;
    model[5][1][1] = shade(light, 1.2);
  } else {
    const center = Math.floor(w / 2);
    model[0][center][0] = dark;
    model[0][center][w - 1] = dark;
    model[1][center][center] = color;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < w; y++) {
        if (Math.abs(x - center) + Math.abs(y - center) <= 1) model[2][y][x] = color;
      }
    }
    model[3][center][center] = light;
    if (bob > 0) {
      model[0][center][0] = null;
      model[0][center - 1 >= 0 ? center - 1 : 0][0] = dark;
    }
  }

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
    race: string
  ) {
    const model = buildHeroModel(race, heroClass, animState, animTimer);
    this.renderVoxelModel(ctx, x, y - 22, model, this.cubeSize, facing);
  }

  drawMinionVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, _size: number,
    facing: number, animTimer: number,
    minionType: string
  ) {
    const model = buildMinionModel(color, minionType, animTimer);
    this.renderVoxelModel(ctx, x, y - 6, model, 3, facing);
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

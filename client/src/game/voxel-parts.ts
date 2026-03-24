/**
 * voxel-parts.ts
 *
 * Part-based voxel rig system.
 * Each body section is a SEPARATE voxel model with its own pivot/joint.
 * Rendering applies ctx.rotate() per part → compatible with Mixamo bone angle data.
 *
 * Hierarchy (for reference — Stage 1 uses fixed attach points, no full FK):
 *   torso → head
 *         → leftUpperArm → leftForearm
 *         → rightUpperArm → rightForearm
 *         → leftThigh → leftShin
 *         → rightThigh → rightShin
 *         → weapon
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type PartId =
  | 'torso'
  | 'head'
  | 'leftUpperArm'  | 'leftForearm'
  | 'rightUpperArm' | 'rightForearm'
  | 'leftThigh'     | 'leftShin'
  | 'rightThigh'    | 'rightShin'
  | 'weapon';

export const ALL_PARTS: PartId[] = [
  'torso', 'head',
  'leftUpperArm', 'leftForearm',
  'rightUpperArm', 'rightForearm',
  'leftThigh', 'leftShin',
  'rightThigh', 'rightShin',
  'weapon',
];

/** Per-part transform applied at render time */
export interface PartTransform {
  /** Primary rotation in degrees — limb swing (fwd/back).
   *  Maps directly to Mixamo Arm/UpLeg/ForeArm bone rotations. */
  rotX: number;
  /** Secondary rotation — lateral lean */
  rotY: number;
  scale: number;
}

export type HeroRigPose = Record<PartId, PartTransform>;

/** Mixamo-compatible single animation frame (bone rotations in degrees) */
export interface MixamoBoneFrame {
  LeftArm?:      number;   // → leftUpperArm.rotX
  LeftForeArm?:  number;   // → leftForearm.rotX
  RightArm?:     number;   // → rightUpperArm.rotX
  RightForeArm?: number;   // → rightForearm.rotX
  LeftUpLeg?:    number;   // → leftThigh.rotX
  LeftLeg?:      number;   // → leftShin.rotX
  RightUpLeg?:   number;   // → rightThigh.rotX
  RightLeg?:     number;   // → rightShin.rotX
  Spine?:        number;   // → torso.rotX
  Head?:         number;   // → head.rotX
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type VM = (string | null)[][][];

function emptyVM(w: number, d: number, h: number): VM {
  return Array.from({ length: h }, () =>
    Array.from({ length: d }, () => Array(w).fill(null) as (string | null)[])
  );
}

function sv(m: VM, z: number, y: number, x: number, c: string) {
  if (z >= 0 && z < m.length &&
      y >= 0 && y < (m[0]?.length ?? 0) &&
      x >= 0 && x < (m[0]?.[0]?.length ?? 0)) {
    m[z][y][x] = c;
  }
}

function fill(m: VM, z0: number, z1: number, y0: number, y1: number, x0: number, x1: number, c: string) {
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        sv(m, z, y, x, c);
}

function shade(hex: string, f: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v * f).toString(16).padStart(2, '0')).join('');
}

function blend(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1,3),16), ga = parseInt(a.slice(3,5),16), ba = parseInt(a.slice(5,7),16);
  const rb = parseInt(b.slice(1,3),16), gb = parseInt(b.slice(3,5),16), bb = parseInt(b.slice(5,7),16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [
    clamp(ra + (rb - ra) * t),
    clamp(ga + (gb - ga) * t),
    clamp(ba + (bb - ba) * t),
  ].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Colors ───────────────────────────────────────────────────────────────────

export interface RigColors {
  skin: string;
  armorPrimary: string;
  armorSecondary: string;
  hair: string;
  eye: string;
  weapon: string;
}

const RACE_SKIN: Record<string, string> = {
  Human: '#c4956a', Barbarian: '#a57850', Dwarf: '#d4a574',
  Elf: '#e8d5b8', Orc: '#5a8a3a', Undead: '#7a8a7a',
};
const RACE_HAIR: Record<string, string> = {
  Human: '#3a2a1a', Barbarian: '#5a3a1a', Dwarf: '#a0522d',
  Elf: '#e8d090', Orc: '#1a1a1a', Undead: '#444444',
};
const RACE_EYE: Record<string, string> = {
  Human: '#2244aa', Barbarian: '#993300', Dwarf: '#4a6a44',
  Elf: '#22d3ee', Orc: '#ffaa00', Undead: '#ff4444',
};
const CLASS_ARMOR: Record<string, { primary: string; secondary: string; weapon: string }> = {
  Warrior: { primary: '#8b8b8b', secondary: '#c0c0c0', weapon: '#d4d4d4' },
  Worg:    { primary: '#6b4423', secondary: '#8b6914', weapon: '#a0522d' },
  Mage:    { primary: '#4a3080', secondary: '#6b46c1', weapon: '#9333ea' },
  Ranger:  { primary: '#2d5016', secondary: '#4a7c23', weapon: '#854d0e' },
};

export function getRigColors(race: string, heroClass: string): RigColors {
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  return {
    skin:           RACE_SKIN[race]  || '#c4956a',
    armorPrimary:   armor.primary,
    armorSecondary: armor.secondary,
    hair:           RACE_HAIR[race]  || '#3a2a1a',
    eye:            RACE_EYE[race]   || '#2244aa',
    weapon:         armor.weapon,
  };
}

// ─── Part Model Builders ──────────────────────────────────────────────────────

/**
 * HEAD — W=6 D=4 H=8
 *  Z=7:    hair top
 *  Z=5-6:  skull / hair sides
 *  Z=2-4:  face (eyes, nose, mouth)
 *  Z=0-1:  chin / jaw
 */
function buildHead(c: RigColors, race: string): VM {
  const m = emptyVM(6, 4, 8);
  const sk = c.skin;

  // Skull main: 6 wide, 3 deep, Z=2-6
  fill(m, 2, 6,  1, 3,  0, 5, sk);

  // Forehead narrowing at top
  fill(m, 6, 7,  1, 3,  1, 4, c.hair);
  fill(m, 5, 5,  1, 3,  0, 5, sk);

  // Eyes — front face (y=1), z=3-4
  sv(m, 4, 1, 1, c.eye);  sv(m, 4, 1, 4, c.eye);
  // Eye highlights
  sv(m, 4, 1, 2, shade(c.eye, 1.4));  sv(m, 4, 1, 3, shade(c.eye, 1.4));

  // Nose bridge — front face, z=2-3, x=2-3
  sv(m, 3, 1, 2, shade(sk, 0.85));  sv(m, 3, 1, 3, shade(sk, 0.85));

  // Mouth hint — z=2, y=1
  sv(m, 2, 1, 2, shade(sk, 0.78));  sv(m, 2, 1, 3, shade(sk, 0.78));

  // Chin / jaw
  fill(m, 0, 1,  1, 3,  1, 4, shade(sk, 0.92));

  // Hair top
  fill(m, 6, 7,  1, 3,  1, 4, c.hair);
  sv(m, 5, 1, 0, c.hair);  sv(m, 5, 1, 5, c.hair);  // sideburns

  // Race features
  if (race === 'Elf') {
    // Pointed ears — stick out sides at z=4-5
    sv(m, 5, 0, 0, sk);  sv(m, 5, 0, 5, sk);
    sv(m, 4, 0, 0, sk);  sv(m, 4, 0, 5, sk);
  }
  if (race === 'Orc') {
    // Broader jaw + tusks
    fill(m, 0, 1,  1, 3,  0, 5, shade(sk, 0.9));
    sv(m, 0, 1, 2, '#fffde8');  sv(m, 0, 1, 3, '#fffde8'); // tusks
  }
  if (race === 'Undead') {
    // Hollow eyes
    sv(m, 4, 1, 1, '#ff4444');  sv(m, 4, 1, 4, '#ff4444');
    sv(m, 3, 1, 2, '#222222');  sv(m, 3, 1, 3, '#222222');
  }
  if (race === 'Dwarf') {
    // Big beard
    fill(m, 0, 2,  1, 2,  1, 4, shade(c.hair, 1.1));
    sv(m, 0, 2, 0, c.hair);  sv(m, 0, 2, 5, c.hair);
  }

  return m;
}

/**
 * TORSO — W=7 D=4 H=12
 *  Z=10-11: shoulder ridge (widest)
 *  Z=7-9:   chest (6 wide, class armor detail)
 *  Z=5-6:   waist (5 wide, narrowest section)
 *  Z=2-4:   abdomen / belt area (5 wide)
 *  Z=0-1:   hips (6 wide, slightly flared)
 */
function buildTorso(c: RigColors, heroClass: string): VM {
  const m = emptyVM(7, 4, 12);
  const p = c.armorPrimary;
  const s = c.armorSecondary;

  // Hips — Z=0-1
  fill(m, 0, 1,  1, 3,  0, 6, shade(p, 0.85));
  // Abdomen — Z=2-4
  fill(m, 2, 4,  1, 3,  1, 5, p);
  // Belt — Z=2 accent
  fill(m, 2, 2,  1, 3,  1, 5, shade(s, 0.9));

  // Waist (narrowest) — Z=5-6
  fill(m, 5, 6,  1, 3,  1, 5, s);

  // Chest — Z=7-9
  fill(m, 7, 9,  1, 3,  0, 6, p);
  // Chest plate / detail
  fill(m, 8, 9,  1, 2,  2, 4, s);

  // Shoulder ridge — Z=10-11
  fill(m, 10, 11,  1, 3,  0, 6, shade(s, 1.1));

  // Class-specific details
  if (heroClass === 'Warrior') {
    // Pauldrons
    sv(m, 11, 1, 0, '#666666');  sv(m, 11, 3, 0, shade('#666666', 0.8));
    sv(m, 11, 1, 6, '#666666');  sv(m, 11, 3, 6, shade('#666666', 0.8));
    // Breastplate stripe
    fill(m, 7, 10,  1, 2,  3, 3, shade(s, 1.2));
  }
  if (heroClass === 'Mage') {
    // Robe panels
    fill(m, 3, 6,  1, 3,  2, 4, shade(s, 1.15));
    fill(m, 7, 10, 1, 2,  2, 4, blend(p, '#9333ea', 0.4));
  }
  if (heroClass === 'Ranger') {
    // Hood trim
    fill(m, 10, 11, 1, 2, 1, 5, shade(p, 0.8));
    sv(m, 10, 1, 0, '#5a3a1a');  sv(m, 10, 1, 6, '#5a3a1a'); // quiver strap
  }
  if (heroClass === 'Worg') {
    // Fur/leather trim
    fill(m, 8, 11, 1, 3, 0, 6, blend(p, '#4a2a12', 0.3));
  }

  return m;
}

/**
 * UPPER ARM — W=3 D=2 H=7
 *  Z=6:    shoulder cap (3×2, rounded)
 *  Z=2-5:  upper arm cylinder (2×2)
 *  Z=0-1:  elbow end (2×2)
 */
function buildUpperArm(c: RigColors): VM {
  const m = emptyVM(3, 2, 7);
  const p = c.armorSecondary;

  // Shoulder cap
  fill(m, 5, 6,  0, 1,  0, 2, shade(p, 1.1));
  // Upper arm
  fill(m, 1, 5,  0, 1,  0, 1, p);
  // Elbow end (with skin hint)
  fill(m, 0, 0,  0, 1,  0, 1, blend(p, c.skin, 0.4));

  return m;
}

/**
 * FOREARM — W=2 D=2 H=6
 *  Z=4-5:  upper forearm (armor)
 *  Z=1-3:  forearm (armor/skin blend)
 *  Z=0:    wrist / hand (skin)
 */
function buildForearm(c: RigColors): VM {
  const m = emptyVM(2, 2, 6);
  const p = c.armorSecondary;
  const sk = c.skin;

  fill(m, 3, 5,  0, 1,  0, 1, shade(p, 0.95));
  fill(m, 1, 2,  0, 1,  0, 1, blend(p, sk, 0.3));
  // Hand
  fill(m, 0, 0,  0, 1,  0, 1, sk);

  return m;
}

/**
 * THIGH — W=3 D=2 H=8
 *  Z=6-7:  hip / upper thigh (3×2, widest)
 *  Z=3-5:  mid thigh (3×2)
 *  Z=0-2:  knee (2×2, tapered)
 */
function buildThigh(c: RigColors): VM {
  const m = emptyVM(3, 2, 8);
  const p = c.armorPrimary;
  const s = c.armorSecondary;

  // Hip attachment
  fill(m, 6, 7,  0, 1,  0, 2, shade(p, 0.85));
  // Thigh
  fill(m, 3, 5,  0, 1,  0, 2, p);
  // Knee (narrower)
  fill(m, 0, 2,  0, 1,  0, 1, shade(s, 0.9));

  return m;
}

/**
 * SHIN + BOOT — W=3 D=3 H=8
 *  Z=5-7:  shin (2×2)
 *  Z=3-4:  lower shin / ankle (2×2)
 *  Z=0-2:  boot (3×3, foot extends forward in Y)
 */
function buildShin(c: RigColors): VM {
  const m = emptyVM(3, 3, 8);
  const p = c.armorPrimary;
  const boot = shade(p, 0.65);
  const bootAccent = shade(p, 0.8);

  // Shin
  fill(m, 5, 7,  0, 1,  0, 1, shade(p, 0.9));
  // Lower shin
  fill(m, 3, 4,  0, 1,  0, 1, p);
  // Ankle
  fill(m, 2, 2,  0, 2,  0, 1, bootAccent);
  // Boot (wider, extends forward)
  fill(m, 0, 1,  0, 2,  0, 2, boot);
  // Boot toe highlight
  sv(m, 1, 0, 2, bootAccent);  sv(m, 0, 0, 2, shade(boot, 1.1));

  return m;
}

/**
 * WEAPON — varies by class, ~W=2 D=2 H=10
 */
function buildWeapon(c: RigColors, heroClass: string): VM {
  const m = emptyVM(2, 2, 12);
  const wc = c.weapon;

  if (heroClass === 'Mage') {
    // Staff
    fill(m, 1, 9,  0, 0,  0, 0, '#553322');
    fill(m, 10, 11, 0, 1,  0, 1, wc);
    sv(m, 11, 0, 0, shade(wc, 1.5));
  } else if (heroClass === 'Ranger') {
    // Bow
    for (let z = 1; z <= 10; z++) sv(m, z, 0, 0, '#6b4423');
    sv(m, 0, 0, 0, '#555555');  sv(m, 11, 0, 0, '#555555');
    sv(m, 5, 1, 0, '#aaaaaa');  sv(m, 6, 1, 0, '#aaaaaa');
  } else if (heroClass === 'Worg') {
    // Claws
    for (let z = 2; z <= 8; z++) sv(m, z, 0, 0, wc);
    sv(m, 9, 0, 0, shade(wc, 0.7));
    sv(m, 8, 1, 0, wc);
  } else {
    // Sword (default Warrior)
    fill(m, 0, 1,  0, 1,  0, 1, shade(wc, 0.7));  // grip
    sv(m, 2, 0, 0, '#888888');  sv(m, 2, 1, 0, '#888888');  // guard
    for (let z = 3; z <= 10; z++) sv(m, z, 0, 0, wc);          // blade
    sv(m, 11, 0, 0, shade(wc, 1.3)); // tip
  }

  return m;
}

// ─── Rig Definition ───────────────────────────────────────────────────────────

/** A single renderable part */
export interface RigPart {
  id: PartId;
  model: VM;
  /** Screen-space offset from character root (feet at cx,cy) at cubeSize=1
   *  X=rightward, Y=upward (negative = higher on screen) */
  attachX: number;
  attachY: number;
  /** Z-index within the model that is the joint pivot (the fixed end)
   *  The model renders "hanging down" from this Z */
  pivotZ: number;
  /** Center X (voxel) of the pivot within the model */
  pivotVX: number;
  /** Center Y (voxel) of the pivot within the model */
  pivotVY: number;
}

export type HeroRig = Record<PartId, RigPart>;

/**
 * Build the full hero rig for a given race/class.
 * All attachment points are calibrated for cubeSize=1 with ctx.scale(2.0).
 */
export function buildHeroRig(race: string, heroClass: string): HeroRig {
  const colors = getRigColors(race, heroClass);

  // Attach points — screen offset from character root (cx, groundY)
  // Positive X = right, positive Y = upward on screen (i.e. negative screen Y)
  // These are in voxel units (cubeSize=1), scale applied by caller
  const A = {
    torso:         [0,    0  ],
    head:          [0.5, -12 ],
    leftShoulder:  [-3.5, -9 ],
    leftElbow:     [-4,  -15 ],
    rightShoulder: [ 4.5, -9 ],
    rightElbow:    [ 5,  -15 ],
    leftHip:       [-2,    0 ],
    leftKnee:      [-2,   -8 ],
    rightHip:      [ 2,    0 ],
    rightKnee:     [ 2,   -8 ],
    weapon:        [-5,  -13 ],
  };

  const makePart = (
    id: PartId, model: VM,
    attachKey: keyof typeof A,
    pivotZ: number, pivotVX: number, pivotVY: number
  ): RigPart => ({
    id, model,
    attachX: A[attachKey][0],
    attachY: A[attachKey][1],
    pivotZ, pivotVX, pivotVY,
  });

  // Upper arm: pivot at TOP (z=6 = shoulder), model hangs DOWN
  // Thigh:     pivot at TOP (z=7 = hip), model hangs DOWN
  // Head:      pivot at BOTTOM (z=0 = neck), model goes UP
  // Torso:     pivot at bottom center

  return {
    torso:         makePart('torso',         buildTorso(colors, heroClass),    'torso',         0, 3, 2),
    head:          makePart('head',          buildHead(colors, race),          'head',          0, 3, 2),
    leftUpperArm:  makePart('leftUpperArm',  buildUpperArm(colors),            'leftShoulder',  6, 1, 1),
    leftForearm:   makePart('leftForearm',   buildForearm(colors),             'leftElbow',     5, 1, 1),
    rightUpperArm: makePart('rightUpperArm', buildUpperArm(colors),            'rightShoulder', 6, 1, 1),
    rightForearm:  makePart('rightForearm',  buildForearm(colors),             'rightElbow',    5, 1, 1),
    leftThigh:     makePart('leftThigh',     buildThigh(colors),               'leftHip',       7, 1, 1),
    leftShin:      makePart('leftShin',      buildShin(colors),                'leftKnee',      7, 1, 1),
    rightThigh:    makePart('rightThigh',    buildThigh(colors),               'rightHip',      7, 1, 1),
    rightShin:     makePart('rightShin',     buildShin(colors),                'rightKnee',     7, 1, 1),
    weapon:        makePart('weapon',        buildWeapon(colors, heroClass),   'weapon',        10, 0, 0),
  };
}

// ─── Default Pose ─────────────────────────────────────────────────────────────

export function defaultRigPose(): HeroRigPose {
  const def = { rotX: 0, rotY: 0, scale: 1 };
  return Object.fromEntries(ALL_PARTS.map(id => [id, { ...def }])) as HeroRigPose;
}

/** Natural idle pose — slight arm bend, feet apart */
export function idleRigPose(): HeroRigPose {
  const p = defaultRigPose();
  p.leftUpperArm.rotX   = -8;
  p.rightUpperArm.rotX  =  8;
  p.leftForearm.rotX    = -5;
  p.rightForearm.rotX   =  5;
  p.leftThigh.rotX      = -3;
  p.rightThigh.rotX     =  3;
  return p;
}

/** Walk cycle frame at time t (0-1) */
export function walkRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const swing = Math.sin(t * Math.PI * 2) * 30;
  p.leftThigh.rotX      =  swing;
  p.rightThigh.rotX     = -swing;
  p.leftShin.rotX       =  Math.max(0, -swing) * 0.5;
  p.rightShin.rotX      =  Math.max(0,  swing) * 0.5;
  p.leftUpperArm.rotX   = -swing * 0.6;
  p.rightUpperArm.rotX  =  swing * 0.6;
  p.leftForearm.rotX    = -5 + Math.max(0, -swing) * 0.3;
  p.rightForearm.rotX   = -5 + Math.max(0,  swing) * 0.3;
  p.torso.rotY          = Math.sin(t * Math.PI * 2) * 4;
  return p;
}

/** Attack pose — weapon arm swings forward */
export function attackRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const wind = Math.min(1, t * 4);
  const swing = t >= 0.25 ? Math.sin((t - 0.25) / 0.75 * Math.PI) : 0;
  p.rightUpperArm.rotX = -40 * wind + 60 * swing;
  p.rightForearm.rotX  = -20 * wind + 30 * swing;
  p.leftUpperArm.rotX  = 10;
  p.torso.rotX         = -10 * wind + 8 * swing;
  return p;
}

// ─── Pose Interpolation ──────────────────────────────────────────────────────

/** Smoothly interpolate between two rig poses */
export function lerpRigPose(a: HeroRigPose, b: HeroRigPose, t: number): HeroRigPose {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return Object.fromEntries(
    ALL_PARTS.map(id => [id, {
      rotX:  lerp(a[id].rotX,  b[id].rotX),
      rotY:  lerp(a[id].rotY,  b[id].rotY),
      scale: lerp(a[id].scale, b[id].scale),
    }])
  ) as HeroRigPose;
}

// ─── More Pose States ─────────────────────────────────────────────────────────

/** Dodge roll — body ducked, arms back, legs spread */
export function dodgeRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const roll = Math.min(1, t * 6);
  const lean = Math.sin(roll * Math.PI) * 40;
  p.torso.rotX          = -lean * 0.5;
  p.head.rotX           = lean * 0.3;
  p.leftUpperArm.rotX   = lean * 0.8;
  p.rightUpperArm.rotX  = lean * 0.8;
  p.leftForearm.rotX    = 20;
  p.rightForearm.rotX   = 20;
  p.leftThigh.rotX      = -lean * 0.4;
  p.rightThigh.rotX     =  lean * 0.6;
  p.leftShin.rotX       =  Math.max(0, lean) * 0.4;
  p.rightShin.rotX      =  Math.max(0, lean) * 0.3;
  return p;
}

/** Defensive block — shield up, crouched */
export function blockRigPose(): HeroRigPose {
  const p = defaultRigPose();
  p.torso.rotX          = -8;
  p.head.rotX           =  5;
  p.leftUpperArm.rotX   = -60;
  p.leftForearm.rotX    = -40;
  p.rightUpperArm.rotX  =  15;
  p.rightForearm.rotX   =  10;
  p.leftThigh.rotX      = -10;
  p.rightThigh.rotX     =  10;
  p.leftShin.rotX       =  8;
  p.rightShin.rotX      =  5;
  return p;
}

/** Death fall — body toppling backward */
export function deathRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const fall = Math.min(1, t * 2.5);
  const ease = 1 - Math.pow(1 - fall, 3); // ease-in-cubic
  p.torso.rotX          =  ease * 60;
  p.head.rotX           = -ease * 20;
  p.leftUpperArm.rotX   =  ease * 40;
  p.rightUpperArm.rotX  =  ease * 30;
  p.leftForearm.rotX    =  ease * 20;
  p.rightForearm.rotX   = -ease * 15;
  p.leftThigh.rotX      =  ease * 20;
  p.rightThigh.rotX     =  ease * 15;
  p.leftShin.rotX       = -ease * 10;
  p.rightShin.rotX      = -ease * 8;
  return p;
}

/** Mage casting / ability — arms raised, channeling */
export function castRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const channel = Math.min(1, t * 3);
  const pulse = Math.sin(t * 8) * 0.15 + 0.85; // oscillate slightly
  p.leftUpperArm.rotX   = -70 * channel;
  p.leftForearm.rotX    = -40 * channel;
  p.rightUpperArm.rotX  = -65 * channel;
  p.rightForearm.rotX   = -35 * channel;
  p.leftUpperArm.scale  = 0.95 + pulse * 0.1;
  p.rightUpperArm.scale = 0.95 + pulse * 0.1;
  p.head.rotX           = -15 * channel;
  p.torso.rotX          = -8 * channel;
  return p;
}

/** Combo finisher — spinning overhand slam */
export function comboRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const spin = Math.sin(t * Math.PI * 2.5) * 45;
  const slam = Math.max(0, Math.sin(t * Math.PI * 1.5 - 0.5)) * 60;
  p.rightUpperArm.rotX  = -30 + slam + spin * 0.5;
  p.rightForearm.rotX   = -20 + slam * 0.6;
  p.leftUpperArm.rotX   =  20 + spin * 0.3;
  p.leftForearm.rotX    =  10;
  p.torso.rotX          = -15 + slam * 0.3;
  p.torso.rotY          = spin * 0.4;
  p.leftThigh.rotX      = spin * 0.3;
  p.rightThigh.rotX     = -spin * 0.3;
  return p;
}

/** Lunge / dash attack — body fully extended forward */
export function lungeRigPose(t: number): HeroRigPose {
  const p = defaultRigPose();
  const ext = Math.sin(Math.min(1, t * 5) * Math.PI) * 0.9 + 0.1;
  p.torso.rotX          = -25 * ext;
  p.head.rotX           = -10 * ext;
  p.rightUpperArm.rotX  = -80 * ext;
  p.rightForearm.rotX   = -30 * ext;
  p.leftUpperArm.rotX   =  30 * ext;
  p.leftForearm.rotX    =  15 * ext;
  p.leftThigh.rotX      = -40 * ext;
  p.leftShin.rotX       =  20 * ext;
  p.rightThigh.rotX     =  25 * ext;
  p.rightShin.rotX      = -10 * ext;
  return p;
}

/**
 * Master pose dispatcher — maps animState strings (same as the legacy system)
 * to rig poses driven by time t.
 * t is the raw animation timer (seconds, monotonic).
 */
export function getRigPoseForState(animState: string, t: number): HeroRigPose {
  // Normalize t to a 0-1 cycle for cyclic anims
  const cycle = (period: number) => (t % period) / period;

  switch (animState) {
    case 'idle': {
      // Idle breathing: very gentle body sway
      const p = idleRigPose();
      const breath = Math.sin(t * 1.4) * 4;
      p.torso.rotX         = breath * 0.3;
      p.head.rotX          = -breath * 0.2;
      p.leftUpperArm.rotX  += breath * 0.5;
      p.rightUpperArm.rotX -= breath * 0.5;
      return p;
    }
    case 'walk':         return walkRigPose(cycle(0.7));
    case 'attack':       return attackRigPose(cycle(0.6));
    case 'combo_finisher': return comboRigPose(cycle(0.8));
    case 'ability':      return castRigPose(Math.min(t, 1));
    case 'dodge':        return dodgeRigPose(cycle(0.4));
    case 'block':        return blockRigPose();
    case 'death':        return deathRigPose(Math.min(t, 1));
    case 'lunge_slash':  return lungeRigPose(cycle(0.5));
    case 'dash_attack':  return lerpRigPose(lungeRigPose(0.7), attackRigPose(cycle(0.4)), 0.5);
    default:             return idleRigPose();
  }
}

// ─── Mixamo Mapping ───────────────────────────────────────────────────────────

/**
 * Convert a Mixamo bone frame (from FBX animation data) to HeroRigPose.
 * Bone angle direction conventions are normalized — Mixamo uses Z-up, Y-forward.
 * We invert some axes for our screen-space Y-down convention.
 */
export function mixamoToRigPose(frame: MixamoBoneFrame): HeroRigPose {
  const pose = defaultRigPose();
  // Arm rotations (Mixamo X-axis = our forward swing, inverted for right arm)
  if (frame.LeftArm      !== undefined) pose.leftUpperArm.rotX   =  frame.LeftArm;
  if (frame.LeftForeArm  !== undefined) pose.leftForearm.rotX    =  frame.LeftForeArm;
  if (frame.RightArm     !== undefined) pose.rightUpperArm.rotX  = -frame.RightArm;
  if (frame.RightForeArm !== undefined) pose.rightForearm.rotX   = -frame.RightForeArm;
  // Leg rotations
  if (frame.LeftUpLeg    !== undefined) pose.leftThigh.rotX      =  frame.LeftUpLeg;
  if (frame.LeftLeg      !== undefined) pose.leftShin.rotX       =  frame.LeftLeg;
  if (frame.RightUpLeg   !== undefined) pose.rightThigh.rotX     = -frame.RightUpLeg;
  if (frame.RightLeg     !== undefined) pose.rightShin.rotX      = -frame.RightLeg;
  // Spine / head
  if (frame.Spine        !== undefined) pose.torso.rotX          =  frame.Spine;
  if (frame.Head         !== undefined) pose.head.rotX           =  frame.Head;
  return pose;
}

// ─── Render Helper (used by VoxelRenderer.drawHeroVoxelRig) ──────────────────

/**
 * Compute the render offset so that the part's pivotZ voxel appears at (0,0)
 * in the translated+rotated context. The caller should:
 *   ctx.save()
 *   ctx.translate(attachX, attachY)
 *   ctx.rotate(rotX_rad)
 *   renderVoxelModel(ctx, renderOffX, renderOffY, part.model, cubeSize, facing)
 *   ctx.restore()
 */
export function getPartRenderOffset(part: RigPart, cubeSize: number): [number, number] {
  const cs = cubeSize;
  const isoX = cs;
  const isoY = cs * 0.5;
  // Screen position of the pivot voxel relative to model origin
  const pivotScreenX = (part.pivotVX - part.pivotVY) * isoX;
  const pivotScreenY = (part.pivotVX + part.pivotVY) * isoY - part.pivotZ * cs;
  // To make pivot appear at (0,0), shift model by negative pivot offset
  return [-pivotScreenX, -pivotScreenY];
}

/** Depth sort order for RIG parts when rendering at a given direction */
export function getRigPartRenderOrder(dir: number): PartId[] {
  // dir 0 = front facing, dir 2 = back
  if (dir === 0 || dir === 1) {
    // Back-to-front: right arm/leg back, left arm/leg front
    return [
      'rightThigh', 'rightShin',
      'rightUpperArm', 'rightForearm',
      'torso',
      'leftThigh', 'leftShin',
      'weapon',
      'head',
      'leftUpperArm', 'leftForearm',
    ];
  } else {
    // Facing away
    return [
      'leftThigh', 'leftShin',
      'leftUpperArm', 'leftForearm',
      'torso',
      'rightThigh', 'rightShin',
      'weapon',
      'head',
      'rightUpperArm', 'rightForearm',
    ];
  }
}

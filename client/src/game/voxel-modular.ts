/**
 * Voxel Modular Character System — V2
 *
 * Higher-resolution 12×12×24 voxel characters built from 4 swappable component slots:
 *   - Lower Body (legs + boots): z=0..7
 *   - Chest (torso + shoulders): z=8..15
 *   - Face/Head: z=16..23
 *   - Arms: composited onto chest z-range
 *
 * Each race has 5 styles per slot. Class determines armor color overlay.
 * The assembler `buildModularHero()` composites all slots into a single VoxelModel.
 */

// ── Types ──────────────────────────────────────────────────────

export type VoxelModel = (string | null)[][][];

export interface ModularVoxelConfig {
  race: string;
  heroClass: string;
  skinColor: string;
  lowerStyle: number;  // 0-4
  chestStyle: number;  // 0-4
  faceStyle: number;   // 0-4
  armStyle: number;    // 0-4
}

export const MODULAR_GRID = { w: 12, d: 12, h: 24 } as const;

// Component z-ranges in the final assembled model
const LOWER_Z = { min: 0, max: 7 };
const CHEST_Z = { min: 8, max: 15 };
const HEAD_Z  = { min: 16, max: 23 };
// Arms occupy the chest z-range but on the outer x columns
const ARM_X_LEFT  = { min: 0, max: 2 };
const ARM_X_RIGHT = { min: 9, max: 11 };

// ── Color Helpers ──────────────────────────────────────────────

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

function blend(a: string, b: string, t: number): string {
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  return rgbToHex(ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t);
}

// ── Race Skin Colors ───────────────────────────────────────────

export const RACE_SKINS: Record<string, string[]> = {
  Human:     ['#c4956a', '#d4a87a', '#b08058', '#e0c098', '#a07048'],
  Barbarian: ['#a57850', '#8a6038', '#c08a60', '#7a5030', '#b89070'],
  Dwarf:     ['#d4a574', '#c49464', '#e0b888', '#b88454', '#c89a6a'],
  Elf:       ['#e8d5b8', '#f0e0c8', '#d8c8a8', '#ece0d0', '#d0c0a0'],
  Orc:       ['#5a8a3a', '#4a7a2a', '#6a9a4a', '#3a6a1a', '#7aaa5a'],
  Undead:    ['#7a8a7a', '#6a7a6a', '#8a9a8a', '#5a6a5a', '#9aaa9a'],
};

// ── Class Armor Colors ─────────────────────────────────────────

export const CLASS_ARMOR: Record<string, { primary: string; secondary: string; accent: string }> = {
  Warrior: { primary: '#8b8b8b', secondary: '#c0c0c0', accent: '#d4d4d4' },
  Worg:    { primary: '#6b4423', secondary: '#8b6914', accent: '#a0522d' },
  Mage:    { primary: '#4a3080', secondary: '#6b46c1', accent: '#9333ea' },
  Ranger:  { primary: '#2d5016', secondary: '#4a7c23', accent: '#854d0e' },
};

// ── Race Hair Colors ───────────────────────────────────────────

const RACE_HAIR: Record<string, string[]> = {
  Human:     ['#3a2a1a', '#1a1a1a', '#8a6a3a', '#c49464', '#5a2a1a'],
  Barbarian: ['#5a3a1a', '#3a2010', '#8a5a2a', '#1a1a1a', '#7a4a20'],
  Dwarf:     ['#a0522d', '#6a3a18', '#c47040', '#4a2a10', '#8a5830'],
  Elf:       ['#e8d090', '#c0b070', '#f0e0a0', '#a89060', '#d8c480'],
  Orc:       ['#1a1a1a', '#2a2a2a', '#3a3a2a', '#1a2a1a', '#0a0a0a'],
  Undead:    ['#444444', '#333333', '#555555', '#2a2a2a', '#3a3a3a'],
};

// ── Race Eye Colors ────────────────────────────────────────────

const RACE_EYE: Record<string, string> = {
  Human: '#2244aa', Barbarian: '#993300', Dwarf: '#4a6a44',
  Elf: '#22d3ee', Orc: '#ffaa00', Undead: '#ff4444',
};

// ── Voxel Grid Helpers ─────────────────────────────────────────

function emptyModel(w: number, d: number, h: number): VoxelModel {
  return Array.from({ length: h }, () =>
    Array.from({ length: d }, () =>
      Array(w).fill(null) as (string | null)[]
    )
  );
}

function sv(m: VoxelModel, z: number, y: number, x: number, c: string | null): void {
  if (z >= 0 && z < m.length && y >= 0 && y < (m[0]?.length ?? 0) && x >= 0 && x < (m[0]?.[0]?.length ?? 0))
    m[z][y][x] = c;
}

function fill(m: VoxelModel, z0: number, z1: number, y0: number, y1: number, x0: number, x1: number, c: string): void {
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        sv(m, z, y, x, c);
}

function fillRect(m: VoxelModel, z: number, y0: number, y1: number, x0: number, x1: number, c: string): void {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      sv(m, z, y, x, c);
}

// ── Component Builders: Lower Body (z=0..7) ───────────────────

type ComponentBuilder = (skin: string, armor: { primary: string; secondary: string; accent: string }, style: number) => VoxelModel;

function buildLower_Human(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, boot = shade(p, 0.6);

  // Feet (z=0-1)
  fill(m, 0, 1, 4, 7, 2, 4, boot);   // left foot
  fill(m, 0, 1, 4, 7, 7, 9, boot);   // right foot
  // Toe cap
  sv(m, 0, 4, 2, shade(boot, 1.2)); sv(m, 0, 4, 9, shade(boot, 1.2));

  // Shins (z=2-3)
  fill(m, 2, 3, 4, 7, 3, 4, p);  // left shin
  fill(m, 2, 3, 4, 7, 7, 8, p);  // right shin

  // Knees (z=4)
  fill(m, 4, 4, 4, 7, 3, 4, shade(s, 0.9));
  fill(m, 4, 4, 4, 7, 7, 8, shade(s, 0.9));
  // Knee guard detail per style
  if (style >= 1) { sv(m, 4, 5, 3, s); sv(m, 4, 5, 8, s); }
  if (style >= 3) { sv(m, 4, 6, 3, shade(s, 1.2)); sv(m, 4, 6, 8, shade(s, 1.2)); }

  // Thighs (z=5-6)
  fill(m, 5, 6, 4, 7, 2, 4, p);  // left thigh
  fill(m, 5, 6, 4, 7, 7, 9, p);  // right thigh

  // Hips / waist (z=7)
  fill(m, 7, 7, 3, 8, 2, 9, shade(p, 0.85));
  // Belt detail
  fill(m, 7, 7, 5, 6, 3, 8, s);
  if (style === 2 || style === 4) {
    sv(m, 7, 5, 5, shade(s, 1.3)); // belt buckle
    sv(m, 7, 5, 6, shade(s, 1.3));
  }

  return m;
}

function buildLower_Barbarian(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = buildLower_Human(skin, armor, style);
  // Barbarians: thicker legs, fur wraps
  const fur = '#5a3a1a';
  fill(m, 2, 3, 4, 7, 2, 2, fur);  // left fur wrap
  fill(m, 2, 3, 4, 7, 9, 9, fur);  // right fur wrap
  if (style >= 2) {
    fill(m, 4, 5, 4, 7, 1, 1, shade(fur, 0.8)); // extra bulk
    fill(m, 4, 5, 4, 7, 10, 10, shade(fur, 0.8));
  }
  if (style === 4) {
    // War paint stripes on thighs
    sv(m, 5, 5, 3, '#cc2222'); sv(m, 5, 5, 8, '#cc2222');
    sv(m, 6, 6, 3, '#cc2222'); sv(m, 6, 6, 8, '#cc2222');
  }
  return m;
}

function buildLower_Dwarf(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, boot = shade(p, 0.55);

  // Dwarves: shorter, wider legs
  // Big boots (z=0-2)
  fill(m, 0, 2, 3, 8, 1, 4, boot);   // left wide boot
  fill(m, 0, 2, 3, 8, 7, 10, boot);  // right wide boot
  // Boot trim
  fill(m, 2, 2, 3, 8, 1, 4, shade(boot, 1.15));
  fill(m, 2, 2, 3, 8, 7, 10, shade(boot, 1.15));

  // Short stubby legs (z=3-5)
  fill(m, 3, 5, 3, 8, 2, 4, p);
  fill(m, 3, 5, 3, 8, 7, 9, p);

  // Wide hips (z=6-7)
  fill(m, 6, 7, 2, 9, 1, 10, shade(p, 0.85));
  fill(m, 7, 7, 4, 7, 2, 9, s); // belt

  if (style >= 1) {
    // Riveted belt
    sv(m, 7, 4, 3, shade(s, 1.4)); sv(m, 7, 4, 8, shade(s, 1.4));
  }
  if (style >= 3) {
    // Chain mail texture on thighs
    for (let x = 2; x <= 4; x++) sv(m, 4, 5, x, shade(p, 1.1));
    for (let x = 7; x <= 9; x++) sv(m, 4, 5, x, shade(p, 1.1));
  }
  return m;
}

function buildLower_Elf(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, boot = shade(p, 0.65);

  // Elves: slim elegant legs
  // Tall boots (z=0-3)
  fill(m, 0, 3, 4, 7, 3, 4, boot);  // left boot
  fill(m, 0, 3, 4, 7, 7, 8, boot);  // right boot
  // Boot cuff
  fill(m, 3, 3, 4, 7, 3, 4, shade(s, 0.9));
  fill(m, 3, 3, 4, 7, 7, 8, shade(s, 0.9));

  // Slim legs (z=4-6)
  fill(m, 4, 6, 4, 7, 3, 4, p);
  fill(m, 4, 6, 4, 7, 7, 8, p);

  // Slim hips (z=7)
  fill(m, 7, 7, 4, 7, 3, 8, shade(p, 0.88));

  if (style >= 1) {
    // Leaf-pattern embroidery
    sv(m, 2, 5, 3, shade(s, 1.3)); sv(m, 2, 5, 8, shade(s, 1.3));
  }
  if (style >= 2) {
    // Vine wrap
    sv(m, 1, 6, 4, '#4a7a2a'); sv(m, 1, 6, 7, '#4a7a2a');
  }
  if (style === 4) {
    // Golden shin guards
    fill(m, 2, 3, 5, 6, 3, 3, '#c5a059');
    fill(m, 2, 3, 5, 6, 8, 8, '#c5a059');
  }
  return m;
}

function buildLower_Orc(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, boot = shade(p, 0.5);

  // Orcs: massive legs, spiked boots
  // Heavy boots (z=0-2)
  fill(m, 0, 2, 3, 8, 1, 4, boot);
  fill(m, 0, 2, 3, 8, 7, 10, boot);
  // Spikes on boots
  sv(m, 2, 4, 1, shade(s, 1.3)); sv(m, 2, 4, 10, shade(s, 1.3));

  // Thick legs (z=3-5)
  fill(m, 3, 5, 3, 8, 1, 4, p);
  fill(m, 3, 5, 3, 8, 7, 10, p);

  // Massive hips (z=6-7)
  fill(m, 6, 7, 2, 9, 1, 10, shade(p, 0.8));
  fill(m, 7, 7, 4, 7, 2, 9, s); // skull belt

  if (style >= 1) {
    sv(m, 7, 5, 5, '#fffde8'); sv(m, 7, 5, 6, '#fffde8'); // tusks on belt
  }
  if (style >= 3) {
    // Bone shin guards
    fill(m, 3, 4, 5, 6, 1, 1, '#d4a574');
    fill(m, 3, 4, 5, 6, 10, 10, '#d4a574');
  }
  if (style === 4) {
    // War paint
    sv(m, 5, 5, 2, '#cc2222'); sv(m, 5, 5, 9, '#cc2222');
    sv(m, 6, 6, 2, '#cc2222'); sv(m, 6, 6, 9, '#cc2222');
  }
  return m;
}

function buildLower_Undead(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, boot = shade(p, 0.55);
  const bone = '#d4c8a8';

  // Undead: skeletal legs with tattered cloth
  // Bony feet (z=0-1)
  fill(m, 0, 1, 4, 7, 3, 4, bone);
  fill(m, 0, 1, 4, 7, 7, 8, bone);

  // Shin bones with tattered wraps (z=2-4)
  fill(m, 2, 4, 4, 7, 3, 4, shade(bone, 0.9));
  fill(m, 2, 4, 4, 7, 7, 8, shade(bone, 0.9));
  // Tattered cloth strips
  if (style !== 0) {
    sv(m, 3, 5, 2, shade(p, 0.7)); sv(m, 3, 5, 9, shade(p, 0.7));
    sv(m, 2, 6, 2, shade(p, 0.6)); sv(m, 2, 6, 9, shade(p, 0.6));
  }

  // Thigh bones (z=5-6)
  fill(m, 5, 6, 4, 7, 3, 4, bone);
  fill(m, 5, 6, 4, 7, 7, 8, bone);
  // Armor remnants
  fill(m, 5, 6, 5, 6, 2, 4, shade(p, 0.7));
  fill(m, 5, 6, 5, 6, 7, 9, shade(p, 0.7));

  // Pelvis (z=7)
  fill(m, 7, 7, 3, 8, 2, 9, shade(bone, 0.85));
  fill(m, 7, 7, 5, 6, 3, 8, s); // belt remnant

  if (style >= 2) {
    // Exposed joints glowing
    sv(m, 4, 5, 3, '#44ff44'); sv(m, 4, 5, 8, '#44ff44');
  }
  if (style === 4) {
    // Chains
    sv(m, 3, 4, 3, '#666666'); sv(m, 3, 4, 8, '#666666');
    sv(m, 5, 4, 3, '#666666'); sv(m, 5, 4, 8, '#666666');
  }
  return m;
}

// ── Component Builders: Chest (z=8..15) ────────────────────────

function buildChest_Human(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8); // local z=0..7 → assembled z=8..15
  const p = armor.primary, s = armor.secondary, ac = armor.accent;

  // Abdomen (z=0-1 local → z=8-9 assembled)
  fill(m, 0, 1, 3, 8, 2, 9, shade(p, 0.88));

  // Core torso (z=2-4 → z=10-12)
  fill(m, 2, 4, 2, 9, 2, 9, p);
  // Chest plate center
  fill(m, 3, 4, 3, 8, 4, 7, shade(s, 1.1));

  // Upper chest (z=5-6 → z=13-14)
  fill(m, 5, 6, 2, 9, 2, 9, p);
  fill(m, 5, 6, 3, 8, 3, 8, s); // inner chest detail

  // Shoulders (z=7 → z=15)
  fill(m, 7, 7, 2, 9, 1, 10, shade(s, 1.15));

  // Style variants
  if (style >= 1) {
    // Chest emblem
    sv(m, 4, 5, 5, ac); sv(m, 4, 5, 6, ac);
  }
  if (style >= 2) {
    // Shoulder ridges
    fill(m, 7, 7, 3, 4, 1, 2, shade(s, 1.3));
    fill(m, 7, 7, 3, 4, 9, 10, shade(s, 1.3));
  }
  if (style === 3) {
    // Cross-strap
    for (let i = 0; i < 6; i++) sv(m, 2 + Math.floor(i / 2), 4 + (i % 2), 3 + i, shade(s, 0.7));
  }
  if (style === 4) {
    // Full plate overlay
    fill(m, 3, 6, 3, 8, 3, 8, shade(s, 1.05));
    sv(m, 5, 5, 5, ac); sv(m, 5, 5, 6, ac); // gem
  }
  return m;
}

function buildChest_Barbarian(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = buildChest_Human(skin, armor, style);
  const fur = '#5a3a1a';
  // Barbarians: exposed skin center, fur edges
  fill(m, 2, 4, 4, 7, 4, 7, skin); // exposed abs
  fill(m, 2, 5, 3, 8, 1, 2, fur);  // left fur
  fill(m, 2, 5, 3, 8, 9, 10, fur); // right fur
  if (style >= 2) {
    // War paint on torso
    sv(m, 3, 5, 5, '#cc2222'); sv(m, 3, 6, 5, '#cc2222');
    sv(m, 3, 5, 6, '#cc2222'); sv(m, 3, 6, 6, '#cc2222');
  }
  if (style === 4) {
    // Scar lines
    sv(m, 2, 5, 4, shade(skin, 0.7));
    sv(m, 3, 6, 5, shade(skin, 0.7));
    sv(m, 4, 7, 6, shade(skin, 0.7));
  }
  return m;
}

function buildChest_Dwarf(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, ac = armor.accent;

  // Dwarves: wide barrel chest
  fill(m, 0, 1, 2, 9, 1, 10, shade(p, 0.85)); // wide abdomen
  fill(m, 2, 5, 2, 9, 1, 10, p);               // barrel torso
  fill(m, 3, 5, 3, 8, 2, 9, shade(s, 1.05));   // chest plate
  fill(m, 6, 7, 2, 9, 1, 10, shade(s, 1.15));  // wide shoulders

  if (style >= 1) {
    // Rivets
    for (let x = 3; x <= 8; x += 2) sv(m, 4, 4, x, shade(s, 1.4));
  }
  if (style >= 3) {
    // Rune engraving
    sv(m, 3, 5, 4, ac); sv(m, 3, 5, 7, ac);
    sv(m, 4, 6, 5, ac); sv(m, 4, 6, 6, ac);
  }
  if (style === 4) {
    // Master forge plate
    fill(m, 3, 5, 4, 7, 3, 8, shade(ac, 0.9));
  }
  return m;
}

function buildChest_Elf(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary, ac = armor.accent;

  // Elves: slim elegant torso
  fill(m, 0, 1, 4, 7, 3, 8, shade(p, 0.88));  // slim abdomen
  fill(m, 2, 5, 3, 8, 3, 8, p);                // core
  fill(m, 3, 5, 4, 7, 4, 7, shade(s, 1.08));   // inlay
  fill(m, 6, 7, 3, 8, 2, 9, shade(s, 1.12));   // shoulders

  if (style >= 1) {
    // Leaf clasps
    sv(m, 6, 4, 3, '#4a7a2a'); sv(m, 6, 4, 8, '#4a7a2a');
  }
  if (style >= 2) {
    // Flowing sash
    fill(m, 1, 3, 5, 6, 2, 2, shade(s, 0.8));
  }
  if (style === 4) {
    // Moonsilver plate
    fill(m, 3, 5, 4, 7, 4, 7, '#c0d0e0');
    sv(m, 4, 5, 5, '#22d3ee'); sv(m, 4, 5, 6, '#22d3ee');
  }
  return m;
}

function buildChest_Orc(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary;

  // Orcs: massive chest
  fill(m, 0, 1, 2, 9, 1, 10, shade(p, 0.8));  // wide abdomen
  fill(m, 2, 5, 2, 9, 1, 10, p);               // huge torso
  fill(m, 2, 4, 4, 7, 3, 8, skin);             // exposed green chest
  fill(m, 6, 7, 2, 9, 0, 11, shade(s, 1.1));   // massive shoulders

  // Spikes on shoulders
  sv(m, 7, 3, 0, shade(s, 1.4)); sv(m, 7, 3, 11, shade(s, 1.4));

  if (style >= 1) {
    // Bone necklace
    for (let x = 4; x <= 7; x++) sv(m, 5, 4, x, '#d4a574');
  }
  if (style >= 2) {
    // Extra shoulder spikes
    sv(m, 7, 2, 0, shade(s, 1.5)); sv(m, 7, 2, 11, shade(s, 1.5));
    sv(m, 7, 4, 0, shade(s, 1.3)); sv(m, 7, 4, 11, shade(s, 1.3));
  }
  if (style === 4) {
    // Warchief skull plate
    sv(m, 4, 5, 5, '#fffde8'); sv(m, 4, 5, 6, '#fffde8');
    sv(m, 3, 5, 5, '#d4a574'); sv(m, 3, 5, 6, '#d4a574');
  }
  return m;
}

function buildChest_Undead(skin: string, armor: { primary: string; secondary: string; accent: string }, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const p = armor.primary, s = armor.secondary;
  const bone = '#d4c8a8';

  // Undead: ribcage with tattered armor
  fill(m, 0, 1, 3, 8, 2, 9, shade(bone, 0.85)); // spine/pelvis top
  // Ribcage (z=2-5)
  fill(m, 2, 5, 3, 8, 2, 9, shade(bone, 0.9));
  // Gaps between ribs
  for (let z = 2; z <= 5; z++) {
    sv(m, z, 5, 4, null); sv(m, z, 5, 7, null);
    sv(m, z, 6, 4, null); sv(m, z, 6, 7, null);
  }
  // Tattered armor remnants
  fill(m, 3, 5, 3, 8, 2, 3, shade(p, 0.6));
  fill(m, 3, 5, 3, 8, 8, 9, shade(p, 0.6));
  // Shoulder bones
  fill(m, 6, 7, 3, 8, 1, 10, shade(bone, 0.8));

  if (style >= 1) {
    // Glowing spine
    for (let z = 1; z <= 5; z++) sv(m, z, 5, 5, '#44ff44');
  }
  if (style >= 3) {
    // Soul chains
    sv(m, 3, 4, 2, '#6644aa'); sv(m, 3, 4, 9, '#6644aa');
    sv(m, 4, 4, 2, '#6644aa'); sv(m, 4, 4, 9, '#6644aa');
  }
  if (style === 4) {
    // Death knight plate remnant
    fill(m, 4, 6, 4, 7, 3, 8, shade(p, 0.8));
    sv(m, 5, 5, 5, '#aa44ff'); sv(m, 5, 5, 6, '#aa44ff');
  }
  return m;
}

// ── Component Builders: Face/Head (z=16..23) ───────────────────

function buildHead_Human(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8); // local z=0..7 → assembled z=16..23

  // Neck (z=0 local)
  fill(m, 0, 0, 4, 7, 4, 7, skin);

  // Head base (z=1-5)
  fill(m, 1, 5, 3, 8, 3, 8, skin);

  // Eyes (z=3)
  sv(m, 3, 4, 4, eye); sv(m, 3, 4, 7, eye);
  // Eye highlights
  sv(m, 3, 4, 4, shade(eye, 1.3)); sv(m, 3, 4, 7, shade(eye, 1.3));

  // Nose (z=2)
  sv(m, 2, 4, 5, shade(skin, 0.85)); sv(m, 2, 4, 6, shade(skin, 0.85));

  // Mouth (z=1)
  sv(m, 1, 4, 5, shade(skin, 0.75)); sv(m, 1, 4, 6, shade(skin, 0.75));

  // Hair varies by style
  const h = hair;
  if (style === 0) {
    // Short crop
    fill(m, 5, 7, 3, 8, 3, 8, h);
    fill(m, 5, 6, 3, 4, 3, 3, h); // sideburn left
    fill(m, 5, 6, 3, 4, 8, 8, h); // sideburn right
  } else if (style === 1) {
    // Long hair
    fill(m, 5, 7, 3, 8, 3, 8, h);
    fill(m, 3, 6, 3, 8, 2, 2, h); // left side
    fill(m, 3, 6, 3, 8, 9, 9, h); // right side
    fill(m, 1, 4, 8, 8, 3, 8, h); // back drape
  } else if (style === 2) {
    // Mohawk
    fill(m, 5, 7, 4, 7, 5, 6, h);
    fill(m, 6, 7, 3, 8, 5, 6, shade(h, 1.2)); // tall center
  } else if (style === 3) {
    // Bald with stubble
    fill(m, 5, 5, 3, 8, 3, 8, shade(skin, 0.95));
    fill(m, 6, 7, 4, 7, 4, 7, shade(skin, 0.92));
  } else {
    // Braided
    fill(m, 5, 7, 3, 8, 3, 8, h);
    // Braids hanging down sides
    fill(m, 1, 5, 3, 5, 2, 2, shade(h, 0.85));
    fill(m, 1, 5, 3, 5, 9, 9, shade(h, 0.85));
    sv(m, 0, 4, 2, shade(h, 0.7)); sv(m, 0, 4, 9, shade(h, 0.7));
  }

  // Ears
  sv(m, 3, 5, 2, shade(skin, 0.9)); sv(m, 3, 5, 9, shade(skin, 0.9));

  return m;
}

function buildHead_Barbarian(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = buildHead_Human(skin, hair, eye, Math.min(style, 1));
  // Barbarians: war paint, scars, fiercer features
  // Wider jaw
  fill(m, 1, 1, 4, 7, 2, 9, skin);

  if (style >= 1) {
    // War paint across eyes
    sv(m, 3, 4, 3, '#cc2222'); sv(m, 3, 4, 8, '#cc2222');
    sv(m, 3, 5, 3, '#cc2222'); sv(m, 3, 5, 8, '#cc2222');
  }
  if (style >= 3) {
    // Braided beard
    fill(m, 0, 1, 5, 7, 5, 6, shade(hair, 0.9));
    sv(m, 0, 7, 5, shade(hair, 0.8)); // braid tip
  }
  if (style === 4) {
    // Horned headband
    sv(m, 6, 3, 2, '#d4a574'); sv(m, 7, 3, 2, '#d4a574');
    sv(m, 6, 3, 9, '#d4a574'); sv(m, 7, 3, 9, '#d4a574');
  }
  return m;
}

function buildHead_Dwarf(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);

  // Dwarf head: wider, shorter, BIG beard
  fill(m, 0, 0, 4, 7, 3, 8, skin); // neck (wide)

  // Wide head (z=1-4)
  fill(m, 1, 4, 3, 8, 2, 9, skin);

  // Eyes
  sv(m, 3, 4, 4, eye); sv(m, 3, 4, 7, eye);

  // Big nose
  sv(m, 2, 4, 5, shade(skin, 0.8));
  sv(m, 2, 4, 6, shade(skin, 0.8));
  sv(m, 2, 3, 5, shade(skin, 0.82));

  // Beard (z=0-2 front face, varying length by style)
  const beardLen = 1 + style;
  fill(m, 0, Math.min(2, beardLen), 3, 7, 3, 8, shade(hair, 1.1));
  // Mustache
  sv(m, 2, 4, 4, shade(hair, 0.95)); sv(m, 2, 4, 7, shade(hair, 0.95));

  // Hair/helm
  fill(m, 4, 5, 3, 8, 2, 9, hair);

  if (style >= 2) {
    // Braided beard tips
    sv(m, 0, 7, 4, shade(hair, 0.7));
    sv(m, 0, 7, 7, shade(hair, 0.7));
  }
  if (style >= 3) {
    // Iron helmet
    fill(m, 4, 5, 3, 8, 2, 9, '#888888');
    sv(m, 5, 4, 5, '#aaaaaa'); sv(m, 5, 4, 6, '#aaaaaa'); // nose guard
  }
  if (style === 4) {
    // Crown
    sv(m, 5, 3, 3, '#ffd700'); sv(m, 5, 3, 8, '#ffd700');
    sv(m, 5, 3, 5, '#ffd700'); sv(m, 5, 3, 6, '#ffd700');
  }
  return m;
}

function buildHead_Elf(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);

  // Elf head: tall, angular, pointed ears
  fill(m, 0, 0, 4, 7, 4, 7, skin); // slim neck
  fill(m, 1, 5, 3, 8, 3, 8, skin); // narrow face
  fill(m, 6, 7, 4, 7, 4, 7, skin); // tall forehead

  // Large almond eyes
  sv(m, 3, 4, 4, eye); sv(m, 3, 4, 7, eye);
  sv(m, 4, 4, 4, shade(eye, 0.8)); sv(m, 4, 4, 7, shade(eye, 0.8));

  // Pointed ears (key elf feature)
  sv(m, 3, 5, 1, skin); sv(m, 4, 5, 1, skin); sv(m, 5, 5, 1, shade(skin, 0.95));
  sv(m, 3, 5, 10, skin); sv(m, 4, 5, 10, skin); sv(m, 5, 5, 10, shade(skin, 0.95));
  // Ear tips
  sv(m, 5, 4, 0, shade(skin, 0.9)); sv(m, 5, 4, 11, shade(skin, 0.9));

  // Hair
  if (style <= 1) {
    fill(m, 5, 7, 3, 8, 3, 8, hair);
    fill(m, 3, 6, 3, 8, 2, 2, shade(hair, 0.9)); // flowing left
    fill(m, 3, 6, 3, 8, 9, 9, shade(hair, 0.9)); // flowing right
  } else if (style === 2) {
    fill(m, 6, 7, 3, 8, 3, 8, hair);
    // Top knot
    fill(m, 7, 7, 5, 6, 5, 6, shade(hair, 1.2));
  } else if (style === 3) {
    fill(m, 5, 7, 3, 8, 3, 8, hair);
    // Circlet
    fill(m, 5, 5, 3, 4, 3, 8, '#c5a059');
  } else {
    // Long flowing
    fill(m, 5, 7, 3, 8, 3, 8, hair);
    fill(m, 1, 6, 3, 8, 2, 2, shade(hair, 0.85));
    fill(m, 1, 6, 3, 8, 9, 9, shade(hair, 0.85));
    fill(m, 0, 3, 8, 8, 3, 8, shade(hair, 0.8)); // back cascade
  }

  return m;
}

function buildHead_Orc(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);

  fill(m, 0, 0, 4, 7, 3, 8, skin); // thick neck
  fill(m, 1, 5, 3, 8, 2, 9, skin); // wide head
  fill(m, 1, 1, 4, 7, 2, 9, skin); // wide jaw

  // Fierce eyes
  sv(m, 3, 4, 4, eye); sv(m, 3, 4, 7, eye);

  // Tusks (key orc feature)
  sv(m, 1, 4, 3, '#fffde8'); sv(m, 1, 4, 8, '#fffde8');
  sv(m, 0, 4, 3, '#fffde8'); sv(m, 0, 4, 8, '#fffde8');

  // Flat nose
  sv(m, 2, 4, 5, shade(skin, 0.75)); sv(m, 2, 4, 6, shade(skin, 0.75));
  sv(m, 2, 3, 5, shade(skin, 0.78));

  // Hair/topknot
  if (style <= 1) {
    fill(m, 5, 5, 4, 7, 3, 8, hair);
  } else if (style === 2) {
    fill(m, 5, 7, 4, 7, 5, 6, hair); // mohawk
  } else {
    fill(m, 5, 5, 3, 8, 3, 8, hair);
  }

  if (style >= 1) {
    // Earring
    sv(m, 3, 6, 1, '#c5a059');
  }
  if (style >= 3) {
    // War paint
    sv(m, 3, 4, 3, '#cc2222'); sv(m, 3, 5, 3, '#cc2222');
    sv(m, 3, 4, 8, '#cc2222'); sv(m, 3, 5, 8, '#cc2222');
  }
  if (style === 4) {
    // Iron jaw plate
    fill(m, 1, 1, 4, 6, 3, 8, '#666666');
  }
  return m;
}

function buildHead_Undead(skin: string, hair: string, eye: string, style: number): VoxelModel {
  const m = emptyModel(12, 12, 8);
  const bone = '#d4c8a8';

  fill(m, 0, 0, 4, 7, 4, 7, bone); // neck bones
  // Skull (z=1-5)
  fill(m, 1, 5, 3, 8, 3, 8, bone);

  // Hollow eye sockets with glow
  sv(m, 3, 4, 4, '#000000'); sv(m, 3, 4, 7, '#000000');
  sv(m, 3, 5, 4, eye); sv(m, 3, 5, 7, eye); // glowing pupils

  // Nasal cavity
  sv(m, 2, 4, 5, '#1a1a1a'); sv(m, 2, 4, 6, '#1a1a1a');

  // Jaw (exposed)
  fill(m, 1, 1, 4, 6, 3, 8, shade(bone, 0.85));
  // Teeth
  sv(m, 1, 4, 4, '#ffffff'); sv(m, 1, 4, 5, '#ffffff');
  sv(m, 1, 4, 6, '#ffffff'); sv(m, 1, 4, 7, '#ffffff');

  // Top of skull
  fill(m, 5, 5, 3, 8, 3, 8, shade(bone, 0.95));

  if (style === 0) {
    // Bare skull
  } else if (style === 1) {
    // Wispy remaining hair
    sv(m, 5, 3, 3, hair); sv(m, 5, 3, 8, hair);
    sv(m, 5, 4, 2, hair); sv(m, 5, 4, 9, hair);
  } else if (style === 2) {
    // Hood
    fill(m, 4, 7, 3, 8, 2, 9, '#2a2a3e');
    fill(m, 3, 5, 8, 8, 2, 9, '#2a2a3e');
  } else if (style === 3) {
    // Crown of bones
    sv(m, 6, 3, 3, bone); sv(m, 7, 3, 3, shade(bone, 1.1));
    sv(m, 6, 3, 8, bone); sv(m, 7, 3, 8, shade(bone, 1.1));
    sv(m, 6, 3, 5, bone); sv(m, 7, 3, 5, shade(bone, 1.1));
  } else {
    // Death knight helm
    fill(m, 4, 7, 3, 8, 2, 9, '#333344');
    fill(m, 3, 3, 4, 5, 3, 8, '#333344'); // visor
    sv(m, 3, 4, 4, eye); sv(m, 3, 4, 7, eye); // eyes through visor
    sv(m, 5, 3, 5, '#aa44ff'); // helm gem
  }

  return m;
}

// ── Component Builders: Arms ───────────────────────────────────

function buildArm(skin: string, armor: { primary: string; secondary: string; accent: string }, race: string, style: number, isLeft: boolean): VoxelModel {
  // Arms are 3×4×8 — composited onto chest x-columns
  const m = emptyModel(3, 4, 8);
  const p = armor.primary, s = armor.secondary;

  // Shoulder (z=7 local, top)
  fill(m, 7, 7, 0, 3, 0, 2, shade(s, 1.15));

  // Upper arm (z=4-6)
  fill(m, 4, 6, 0, 3, 0, 2, s);

  // Elbow (z=3)
  fill(m, 3, 3, 0, 3, 0, 2, blend(s, skin, 0.4));

  // Forearm (z=1-2)
  fill(m, 1, 2, 0, 3, 0, 2, s);

  // Hand (z=0)
  fill(m, 0, 0, 0, 3, 0, 2, skin);

  // Race-specific arm details
  if (race === 'Orc') {
    // Thicker, spike on shoulder
    sv(m, 7, 1, 1, shade(s, 1.4));
    if (style >= 2) sv(m, 7, 0, 1, shade(s, 1.5));
  } else if (race === 'Dwarf') {
    // Wider forearm (bracers)
    fill(m, 1, 2, 0, 3, 0, 2, shade(p, 0.9));
  } else if (race === 'Elf') {
    // Slim, with vine wraps
    if (style >= 1) {
      sv(m, 3, 1, 1, '#4a7a2a');
      sv(m, 5, 2, 1, '#4a7a2a');
    }
  } else if (race === 'Undead') {
    // Exposed bone at elbow
    fill(m, 3, 3, 0, 3, 0, 2, '#d4c8a8');
    if (style >= 1) sv(m, 2, 1, 1, '#44ff44');
  } else if (race === 'Barbarian') {
    // Fur wraps
    fill(m, 4, 5, 0, 3, 0, 0, '#5a3a1a');
    if (style >= 2) {
      sv(m, 5, 1, 0, '#cc2222'); // war paint
    }
  }

  // Style-specific gauntlet/bracer detail
  if (style >= 3) {
    fill(m, 1, 2, 0, 3, 0, 2, shade(s, 1.1)); // armored forearm
  }
  if (style === 4) {
    sv(m, 7, 1, 1, armor.accent); // gem on shoulder
  }

  return m;
}

// ── Lookup Tables ──────────────────────────────────────────────

const LOWER_BUILDERS: Record<string, ComponentBuilder> = {
  Human: buildLower_Human,
  Barbarian: buildLower_Barbarian,
  Dwarf: buildLower_Dwarf,
  Elf: buildLower_Elf,
  Orc: buildLower_Orc,
  Undead: buildLower_Undead,
};

const CHEST_BUILDERS: Record<string, ComponentBuilder> = {
  Human: buildChest_Human,
  Barbarian: buildChest_Barbarian,
  Dwarf: buildChest_Dwarf,
  Elf: buildChest_Elf,
  Orc: buildChest_Orc,
  Undead: buildChest_Undead,
};

type HeadBuilder = (skin: string, hair: string, eye: string, style: number) => VoxelModel;
const HEAD_BUILDERS: Record<string, HeadBuilder> = {
  Human: buildHead_Human,
  Barbarian: buildHead_Barbarian,
  Dwarf: buildHead_Dwarf,
  Elf: buildHead_Elf,
  Orc: buildHead_Orc,
  Undead: buildHead_Undead,
};

// ── Assembler ──────────────────────────────────────────────────

/**
 * Build a complete 12×12×24 voxel model from modular components.
 * Each component is built independently then composited into the final grid.
 */
export function buildModularHero(config: ModularVoxelConfig): VoxelModel {
  const { race, heroClass, skinColor, lowerStyle, chestStyle, faceStyle, armStyle } = config;
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  const skin = skinColor || (RACE_SKINS[race]?.[0] ?? '#c4956a');
  const hair = RACE_HAIR[race]?.[faceStyle % (RACE_HAIR[race]?.length ?? 1)] ?? '#3a2a1a';
  const eye = RACE_EYE[race] ?? '#2244aa';

  const final = emptyModel(MODULAR_GRID.w, MODULAR_GRID.d, MODULAR_GRID.h);

  // 1. Lower body → z=0..7
  const lowerBuilder = LOWER_BUILDERS[race] || LOWER_BUILDERS.Human;
  const lower = lowerBuilder(skin, armor, lowerStyle);
  compositeComponent(final, lower, 0, 0, LOWER_Z.min);

  // 2. Chest → z=8..15
  const chestBuilder = CHEST_BUILDERS[race] || CHEST_BUILDERS.Human;
  const chest = chestBuilder(skin, armor, chestStyle);
  compositeComponent(final, chest, 0, 0, CHEST_Z.min);

  // 3. Head → z=16..23
  const headBuilder = HEAD_BUILDERS[race] || HEAD_BUILDERS.Human;
  const head = headBuilder(skin, hair, eye, faceStyle);
  compositeComponent(final, head, 0, 0, HEAD_Z.min);

  // 4. Arms → composite onto chest z-range, outer columns
  const leftArm = buildArm(skin, armor, race, armStyle, true);
  const rightArm = buildArm(skin, armor, race, armStyle, false);
  compositeComponent(final, leftArm, ARM_X_LEFT.min, 4, CHEST_Z.min);
  compositeComponent(final, rightArm, ARM_X_RIGHT.min, 4, CHEST_Z.min);

  return final;
}

/**
 * Composite a component model into the final model at the given offsets.
 * Only non-null voxels from the component overwrite the final model.
 */
function compositeComponent(
  final: VoxelModel,
  component: VoxelModel,
  xOffset: number,
  yOffset: number,
  zOffset: number,
): void {
  const ch = component.length;
  const cd = component[0]?.length ?? 0;
  const cw = component[0]?.[0]?.length ?? 0;

  for (let z = 0; z < ch; z++) {
    for (let y = 0; y < cd; y++) {
      for (let x = 0; x < cw; x++) {
        const color = component[z]?.[y]?.[x];
        if (color) {
          sv(final, z + zOffset, y + yOffset, x + xOffset, color);
        }
      }
    }
  }
}

// ── Default Config ─────────────────────────────────────────────

export function defaultModularConfig(race: string, heroClass: string): ModularVoxelConfig {
  return {
    race,
    heroClass,
    skinColor: RACE_SKINS[race]?.[0] ?? '#c4956a',
    lowerStyle: 0,
    chestStyle: 0,
    faceStyle: 0,
    armStyle: 0,
  };
}

// ── Cache ──────────────────────────────────────────────────────

const modularCache = new Map<string, VoxelModel>();

function configKey(config: ModularVoxelConfig): string {
  return `${config.race}:${config.heroClass}:${config.skinColor}:${config.lowerStyle}:${config.chestStyle}:${config.faceStyle}:${config.armStyle}`;
}

/** Get or build a cached modular hero model. */
export function getCachedModularHero(config: ModularVoxelConfig): VoxelModel {
  const key = configKey(config);
  let cached = modularCache.get(key);
  if (!cached) {
    cached = buildModularHero(config);
    modularCache.set(key, cached);
    // Limit cache to 50 entries
    if (modularCache.size > 50) {
      const first = modularCache.keys().next().value;
      if (first) modularCache.delete(first);
    }
  }
  return cached;
}

/** Clear the modular cache (e.g. on customization change). */
export function clearModularCache(): void {
  modularCache.clear();
}

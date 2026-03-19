/**
 * Voxel Equipment Appearance System
 * Converts equipped items into visual overrides for the voxel hero model.
 * Drives armor colors, hat styles, weapon models, and cape colors based
 * on what the player has equipped — like MMO transmog/mogging.
 *
 * Integrates with:
 *   - voxel.ts buildHeroModel() via EquipmentAppearance overrides
 *   - equipment.ts PlayerEquipment for item data
 *   - weapon-models.ts for weapon type → model lookup
 */

import type { PlayerEquipment, EquipmentInstance } from './equipment';
import { EQUIP_TO_MODEL_TYPE } from './weapon-models';

// ── Types ──────────────────────────────────────────────────────

export interface EquipmentAppearance {
  /** Override CLASS_ARMOR.primary with chest/legs piece color */
  armorPrimary?: string;
  /** Override CLASS_ARMOR.secondary with shoulder/glove color */
  armorSecondary?: string;
  /** Override boot color */
  bootColor?: string;
  /** Override weapon color (voxel tint) */
  weaponColor?: string;
  /** Hat style override from equipped helm */
  hatStyle?: 'helm' | 'hood' | 'wizard' | 'crown' | 'horned' | 'skull' | 'feathered' | 'tribal' | 'miner' | 'captain' | null;
  /** Hat color */
  hatColor?: string;
  /** Hat accent */
  hatAccent?: string;
  /** Cape color (from equipped cape) */
  capeColor?: string;
  /** Shoulder pad color */
  shoulderColor?: string;
  /** Belt color */
  beltColor?: string;
  /** Weapon render type override (from equipped weapon type) */
  weaponType?: string;
  /** Glow/enchant tint for high-tier items */
  enchantGlow?: string;
}

// ── Tier Color Ramps ───────────────────────────────────────────
// Higher-tier equipment gets richer, more distinctive colors

const TIER_ARMOR_COLORS: Record<number, { primary: string; secondary: string }> = {
  1: { primary: '#6a5a4a', secondary: '#7a6a5a' },  // Ragged
  2: { primary: '#5a5a5a', secondary: '#6a6a6a' },  // Iron
  3: { primary: '#4a5a6a', secondary: '#5a6a7a' },  // Steel
  4: { primary: '#3a4a7a', secondary: '#4a5a8a' },  // Cobalt
  5: { primary: '#5a3a6a', secondary: '#6a4a7a' },  // Mystic
  6: { primary: '#7a3a3a', secondary: '#8a4a4a' },  // Crimson
  7: { primary: '#3a6a4a', secondary: '#4a7a5a' },  // Emerald
  8: { primary: '#7a6a2a', secondary: '#8a7a3a' },  // Gold
};

const TIER_WEAPON_COLORS: Record<number, string> = {
  1: '#888888', 2: '#999999', 3: '#aaaaaa', 4: '#4488cc',
  5: '#aa44cc', 6: '#cc4444', 7: '#44cc88', 8: '#ffd700',
};

const TIER_GLOW: Record<number, string | undefined> = {
  1: undefined, 2: undefined, 3: undefined, 4: undefined,
  5: '#9966ff', 6: '#ff4444', 7: '#44ff88', 8: '#ffd700',
};

// ── Hat Style from Helm Type ───────────────────────────────────

function helmToHatStyle(item: EquipmentInstance | null): EquipmentAppearance['hatStyle'] {
  if (!item) return null;
  const name = item.name.toLowerCase();
  if (name.includes('crown') || name.includes('circlet')) return 'crown';
  if (name.includes('hood') || name.includes('cowl')) return 'hood';
  if (name.includes('wizard') || name.includes('mage') || name.includes('arcane')) return 'wizard';
  if (name.includes('horn') || name.includes('viking')) return 'horned';
  if (name.includes('skull') || name.includes('bone')) return 'skull';
  if (name.includes('feather') || name.includes('ranger')) return 'feathered';
  if (name.includes('tribal') || name.includes('shaman')) return 'tribal';
  if (name.includes('miner') || name.includes('mining')) return 'miner';
  if (name.includes('captain') || name.includes('pirate')) return 'captain';
  return 'helm'; // default for any other headgear
}

// ── Material Color from Item ───────────────────────────────────

function getItemMaterialColor(item: EquipmentInstance | null): string | undefined {
  if (!item) return undefined;
  const name = item.name.toLowerCase();
  // Named materials override tier colors
  if (name.includes('gold') || name.includes('gilded')) return '#c5a059';
  if (name.includes('obsidian') || name.includes('void')) return '#2a1a3a';
  if (name.includes('frost') || name.includes('ice')) return '#8acdea';
  if (name.includes('fire') || name.includes('flame') || name.includes('infernal')) return '#cc4422';
  if (name.includes('nature') || name.includes('verdant')) return '#3a8a2a';
  if (name.includes('shadow') || name.includes('dark')) return '#3a2a4a';
  if (name.includes('holy') || name.includes('divine')) return '#f0e68c';
  if (name.includes('blood') || name.includes('crimson')) return '#8a2222';
  return undefined; // use tier-based color
}

// ── Build Appearance from Equipment ────────────────────────────

export function buildEquipmentAppearance(equipment: PlayerEquipment): EquipmentAppearance {
  const appearance: EquipmentAppearance = {};

  // Helm → hat style + color
  const helm = equipment.slots.helm;
  if (helm) {
    appearance.hatStyle = helmToHatStyle(helm);
    appearance.hatColor = getItemMaterialColor(helm) || TIER_ARMOR_COLORS[helm.tier]?.primary || '#666666';
    appearance.hatAccent = TIER_WEAPON_COLORS[helm.tier] || '#888888';
  }

  // Chest → armor primary color
  const chest = equipment.slots.chest;
  if (chest) {
    appearance.armorPrimary = getItemMaterialColor(chest) || TIER_ARMOR_COLORS[chest.tier]?.primary;
    appearance.armorSecondary = TIER_ARMOR_COLORS[chest.tier]?.secondary;
    appearance.enchantGlow = TIER_GLOW[chest.tier];
  }

  // Shoulders → shoulder color
  const shoulders = equipment.slots.shoulder;
  if (shoulders) {
    appearance.shoulderColor = getItemMaterialColor(shoulders) || TIER_ARMOR_COLORS[shoulders.tier]?.secondary;
  }

  // Hands → affects arm accent
  const hands = equipment.slots.hands;
  if (hands) {
    appearance.armorSecondary = getItemMaterialColor(hands) || appearance.armorSecondary;
  }

  // Feet → boot color
  const feet = equipment.slots.feet;
  if (feet) {
    appearance.bootColor = getItemMaterialColor(feet) || TIER_ARMOR_COLORS[feet.tier]?.primary;
  }

  // Cape → cape color
  const cape = equipment.slots.cape;
  if (cape) {
    appearance.capeColor = getItemMaterialColor(cape) || TIER_ARMOR_COLORS[cape.tier]?.secondary || '#4a2a2a';
  }

  // Main hand → weapon color + type
  const mainhand = equipment.slots.mainhand;
  if (mainhand) {
    appearance.weaponColor = getItemMaterialColor(mainhand) || TIER_WEAPON_COLORS[mainhand.tier];
    // Map equipment weapon type to render type
    if (mainhand.weaponType) {
      appearance.weaponType = EQUIP_TO_MODEL_TYPE[mainhand.weaponType] || mainhand.weaponType;
    }
  }

  // Off-hand (shield) → secondary weapon accent
  const offhand = equipment.slots.offhand;
  if (offhand) {
    // Off-hand doesn't override primary weapon but adds to appearance
  }

  // Belt → belt color
  appearance.beltColor = equipment.slots.ring
    ? (TIER_ARMOR_COLORS[equipment.slots.ring.tier]?.secondary || '#5a4a3a')
    : undefined;

  return appearance;
}

// ── Apply Appearance to Hero Model Colors ──────────────────────
// These functions are used by buildHeroModel in voxel.ts

export function getEffectiveArmorColors(
  classArmor: { primary: string; secondary: string; weapon: string },
  appearance: EquipmentAppearance | null,
): { primary: string; secondary: string; weapon: string } {
  if (!appearance) return classArmor;
  return {
    primary: appearance.armorPrimary || classArmor.primary,
    secondary: appearance.armorSecondary || classArmor.secondary,
    weapon: appearance.weaponColor || classArmor.weapon,
  };
}

export function getEffectiveBootColor(
  defaultBoot: string,
  appearance: EquipmentAppearance | null,
): string {
  return appearance?.bootColor || defaultBoot;
}

export function getEffectiveHat(
  defaultHat: { hat?: string; hatColor?: string; hatAccent?: string } | undefined,
  appearance: EquipmentAppearance | null,
): { hat?: string; hatColor?: string; hatAccent?: string } | undefined {
  if (!appearance?.hatStyle) return defaultHat;
  return {
    hat: appearance.hatStyle,
    hatColor: appearance.hatColor || defaultHat?.hatColor,
    hatAccent: appearance.hatAccent || defaultHat?.hatAccent,
  };
}

export function getEffectiveCape(
  defaultCape: string | undefined,
  appearance: EquipmentAppearance | null,
): string | undefined {
  return appearance?.capeColor || defaultCape;
}

// ── Weapon Voxel Model Colors (per tier) ───────────────────────
// Used to tint weapon voxels in buildHeroModel weapon functions

export interface WeaponVoxelColors {
  blade: string;
  handle: string;
  accent: string;
  glow: string | null;
}

export function getWeaponVoxelColors(tier: number): WeaponVoxelColors {
  const baseBlade = TIER_WEAPON_COLORS[tier] || '#999999';
  const handle = tier >= 5 ? '#4a3020' : '#6a5040';
  const accent = tier >= 7 ? '#ffd700' : tier >= 5 ? '#aa44cc' : tier >= 3 ? '#4488cc' : '#aaaaaa';
  const glow = TIER_GLOW[tier] || null;
  return { blade: baseBlade, handle, accent, glow };
}

// ── Character Preview Render ───────────────────────────────────
// Renders a voxel hero to an offscreen canvas for UI display

let _previewCanvas: HTMLCanvasElement | null = null;
let _previewCtx: CanvasRenderingContext2D | null = null;

/**
 * Render a hero voxel preview to a data URL for use in React components.
 * @param voxelRenderer The VoxelRenderer instance to use
 * @param race Hero race
 * @param heroClass Hero class
 * @param heroName Hero name (for customization lookup)
 * @param appearance Equipment appearance overrides
 * @param size Preview size in pixels (square)
 * @returns Data URL of the rendered preview
 */
export function renderHeroPreview(
  drawFn: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
  size: number = 128,
): string {
  if (!_previewCanvas) {
    _previewCanvas = document.createElement('canvas');
    _previewCtx = _previewCanvas.getContext('2d')!;
  }
  _previewCanvas.width = size;
  _previewCanvas.height = size;
  const ctx = _previewCtx!;

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Draw hero centered
  drawFn(ctx, size / 2, size * 0.65);

  return _previewCanvas.toDataURL('image/png');
}

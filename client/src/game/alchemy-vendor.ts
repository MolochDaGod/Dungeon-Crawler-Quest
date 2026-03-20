/**
 * Alchemy Vendor — Material transmutation system.
 * Upgrade: 3× Tier N → 1× Tier N+1 (same category)
 * Downgrade: 1× Tier N → 3× Tier N-1 (same category)
 * Works for all 7 material categories including fish.
 * Tier range: T1–T8.
 */

// ── Material Categories ────────────────────────────────────────

export const MATERIAL_CATEGORIES = ['ore', 'wood', 'cloth', 'leather', 'essence', 'gem', 'food'] as const;
export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];

export const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  ore: 'Ore & Metal',
  wood: 'Wood & Timber',
  cloth: 'Cloth & Fiber',
  leather: 'Leather & Hide',
  essence: 'Essence & Reagent',
  gem: 'Gem & Crystal',
  food: 'Food & Fish',
};

export const CATEGORY_ICONS: Record<MaterialCategory, string> = {
  ore: '⛏️', wood: '🪓', cloth: '🧵', leather: '🔪',
  essence: '✨', gem: '💎', food: '🐟',
};

// ── Tier Names ─────────────────────────────────────────────────

export const TIER_MATERIAL_NAMES: Record<MaterialCategory, Record<number, string>> = {
  ore: { 1: 'Copper Ore', 2: 'Iron Ore', 3: 'Gold Ore', 4: 'Mithril Ore', 5: 'Adamantine Ore', 6: 'Orichalcum Ore', 7: 'Starmetal Ore', 8: 'Infinity Ore' },
  wood: { 1: 'Pine Log', 2: 'Oak Log', 3: 'Hardwood', 4: 'Ancient Wood', 5: 'Frostwood', 6: 'Starwood', 7: 'Dragon Root', 8: 'Godwood' },
  cloth: { 1: 'Rough Cloth', 2: 'Linen', 3: 'Silk', 4: 'Moonweave', 5: 'Celestial Thread', 6: 'Starsilk', 7: 'Phoenix Down', 8: 'Cosmic Fiber' },
  leather: { 1: 'Rough Leather', 2: 'Fine Leather', 3: 'Exotic Leather', 4: 'Dragon Hide', 5: 'Celestial Hide', 6: 'Titan Skin', 7: 'Leviathan Scale', 8: 'Infinity Hide' },
  essence: { 1: 'Nature Essence', 2: 'Mana Essence', 3: 'Fire Essence', 4: 'Shadow Essence', 5: 'Void Essence', 6: 'Star Essence', 7: 'Dragon Essence', 8: 'Cosmic Essence' },
  gem: { 1: 'Emerald', 2: 'Ruby', 3: 'Topaz', 4: 'Sapphire', 5: 'Amethyst', 6: 'Obsidian', 7: 'Diamond', 8: 'Infinity Crystal' },
  food: { 1: 'Common Fish', 2: 'Trout', 3: 'Golden Fish', 4: 'Moonfish', 5: 'Void Fish', 6: 'Celestial Koi', 7: 'Phoenix Fin', 8: 'Infinity Fish' },
};

// ── Inventory Interface ────────────────────────────────────────

/**
 * Simple material stack. The alchemy system is inventory-agnostic —
 * it works with any object that has { materialId, category, tier, qty }.
 */
export interface MaterialStack {
  materialId: string;
  category: MaterialCategory;
  tier: number;
  qty: number;
}

// ── Transmutation Logic ────────────────────────────────────────

export interface TransmuteResult {
  success: boolean;
  consumed: { materialId: string; qty: number };
  produced: { materialId: string; tier: number; qty: number };
  error?: string;
}

const UPGRADE_COST = 3;   // 3 of lower tier
const DOWNGRADE_YIELD = 3; // produces 3 of lower tier

/**
 * Check if the player can upgrade a material.
 * Requires 3× of Tier N material, and tier must be < 8.
 */
export function canUpgrade(stack: MaterialStack): boolean {
  return stack.qty >= UPGRADE_COST && stack.tier < 8;
}

/**
 * Check if the player can downgrade a material.
 * Requires 1× of Tier N material, and tier must be > 1.
 */
export function canDowngrade(stack: MaterialStack): boolean {
  return stack.qty >= 1 && stack.tier > 1;
}

/**
 * Perform an upgrade transmutation.
 * Consumes 3× Tier N, produces 1× Tier N+1 (same category).
 *
 * @returns TransmuteResult — caller is responsible for updating actual inventory.
 */
export function performUpgrade(stack: MaterialStack): TransmuteResult {
  if (!canUpgrade(stack)) {
    return {
      success: false,
      consumed: { materialId: stack.materialId, qty: 0 },
      produced: { materialId: '', tier: 0, qty: 0 },
      error: stack.tier >= 8 ? 'Already max tier' : 'Need 3 to upgrade',
    };
  }

  const newTier = stack.tier + 1;
  const newMaterialId = TIER_MATERIAL_NAMES[stack.category]?.[newTier]?.toLowerCase().replace(/\s+/g, '_') || `t${newTier}_${stack.category}`;

  return {
    success: true,
    consumed: { materialId: stack.materialId, qty: UPGRADE_COST },
    produced: { materialId: newMaterialId, tier: newTier, qty: 1 },
  };
}

/**
 * Perform a downgrade transmutation.
 * Consumes 1× Tier N, produces 3× Tier N-1 (same category).
 */
export function performDowngrade(stack: MaterialStack): TransmuteResult {
  if (!canDowngrade(stack)) {
    return {
      success: false,
      consumed: { materialId: stack.materialId, qty: 0 },
      produced: { materialId: '', tier: 0, qty: 0 },
      error: stack.tier <= 1 ? 'Already lowest tier' : 'No materials to downgrade',
    };
  }

  const newTier = stack.tier - 1;
  const newMaterialId = TIER_MATERIAL_NAMES[stack.category]?.[newTier]?.toLowerCase().replace(/\s+/g, '_') || `t${newTier}_${stack.category}`;

  return {
    success: true,
    consumed: { materialId: stack.materialId, qty: 1 },
    produced: { materialId: newMaterialId, tier: newTier, qty: DOWNGRADE_YIELD },
  };
}

// ── Helper: Get material display name ──────────────────────────

export function getMaterialName(category: MaterialCategory, tier: number): string {
  return TIER_MATERIAL_NAMES[category]?.[tier] || `T${tier} ${category}`;
}

export function getMaterialTierColor(tier: number): string {
  const colors: Record<number, string> = {
    1: '#9ca3af', 2: '#22c55e', 3: '#3b82f6', 4: '#8b5cf6',
    5: '#f97316', 6: '#ef4444', 7: '#ec4899', 8: '#f59e0b',
  };
  return colors[tier] || '#fff';
}

/**
 * Crafting System — Phase 5
 * Recipes derived from ObjectStore weapons.json and armor.json craftedBy fields.
 * Integrated with professions-system.ts for crafting profession XP.
 * Integrated with resource inventory for material costs.
 */

import {
  ResourceInventory, removeResource, hasResource,
  PlayerProfessions, gainProfessionXp, getTierForLevel,
  saveProfessions, saveResourceInventory
} from './professions-system';

// ── Recipe Definitions ─────────────────────────────────────────

export interface CraftingIngredient {
  name: string;
  tier: number;
  quantity: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'consumable' | 'tool' | 'camp';
  resultType: string;      // e.g. 'swords', 'cloth-helm', 'health-potion'
  resultTier: number;      // 1-8
  profession: string;      // crafting profession id (miner, forester, chef, engineer, mystic)
  requiredLevel: number;   // profession level needed
  ingredients: CraftingIngredient[];
  craftTime: number;       // seconds to craft
  xpReward: number;        // profession XP granted
  resultCount: number;     // how many items produced
  description: string;
}

// ── Quick Craft Items ──────────────────────────────────
// Placeables craftable from the quick-craft bar (E menu at campfire/bench)

export interface QuickCraftItem {
  id: string;
  name: string;
  icon: string;           // emoji or URL
  modelAssetId: string;   // maps to AssetEntry.id in asset-packs
  modelPath: string;      // direct path for BabylonJS loader
  description: string;
  ingredients: CraftingIngredient[];
  craftTime: number;      // seconds
  xpReward: number;
  profession: string;
  requiredLevel: number;
  category: 'camp' | 'survival' | 'base';
  // gameplay role flags
  isRespawnPoint?: boolean;
  isStorageChest?: boolean;
  isLockedChest?: boolean;
  isCraftingStation?: boolean;
  isWaterSource?: boolean;
  isWarmthSource?: boolean;
  isSleepPoint?: boolean;
}

export const QUICK_CRAFT_ITEMS: QuickCraftItem[] = [
  // ── Camp Assets ──────────────────────────────────────────────
  {
    id: 'qc-campfire',
    name: 'Campfire',
    icon: '🔥',
    modelAssetId: 'ca-fireplace',
    modelPath: '/assets/props/camps/CampAssets.fbx',
    description: 'A crackling fireplace that provides warmth, cooking, and safety. Deters hostile NPCs at night.',
    profession: 'forester',
    requiredLevel: 1,
    ingredients: [
      { name: 'Pine Log', tier: 1, quantity: 3 },
      { name: 'Rough Stone', tier: 1, quantity: 2 },
    ],
    craftTime: 5,
    xpReward: 15,
    category: 'camp',
    isWarmthSource: true,
  },
  {
    id: 'qc-tent',
    name: 'Tent',
    icon: '⛺',
    modelAssetId: 'ca-tent',
    modelPath: '/assets/props/camps/CampAssets.fbx',
    description: 'A portable shelter. Restores HP & MP while resting inside. Required before sleeping bag placement.',
    profession: 'forester',
    requiredLevel: 2,
    ingredients: [
      { name: 'Rough Leather', tier: 1, quantity: 4 },
      { name: 'Pine Log',      tier: 1, quantity: 2 },
    ],
    craftTime: 8,
    xpReward: 20,
    category: 'camp',
    isSleepPoint: true,
  },
  {
    id: 'qc-sleeping-bag',
    name: 'Sleeping Bag',
    icon: '🛏️',
    modelAssetId: 'ca-sleeping-bag',
    modelPath: '/assets/props/camps/CampAssets.fbx',
    description: 'Sets your respawn point. Sleeping through the night fast-forwards time and fully restores stats.',
    profession: 'forester',
    requiredLevel: 1,
    ingredients: [
      { name: 'Rough Leather', tier: 1, quantity: 3 },
      { name: 'Common Herb',   tier: 1, quantity: 1 },
    ],
    craftTime: 6,
    xpReward: 12,
    category: 'camp',
    isRespawnPoint: true,
    isSleepPoint: true,
  },
  // ── Medieval Props — Base Building ──────────────────────────
  {
    id: 'qc-bed',
    name: 'Upgraded Bed',
    icon: '🛏️',
    modelAssetId: 'mp-bed',
    modelPath: '/assets/props/medieval-props/BedSingleWithBedding.fbx',
    description: 'A proper bed with bedding. Upgraded respawn point with bonus HP/MP restoration on wake.',
    profession: 'forester',
    requiredLevel: 10,
    ingredients: [
      { name: 'Ironwood Log',  tier: 2, quantity: 4 },
      { name: 'Fine Leather',  tier: 2, quantity: 3 },
      { name: 'Common Herb',   tier: 1, quantity: 2 },
    ],
    craftTime: 15,
    xpReward: 40,
    category: 'base',
    isRespawnPoint: true,
    isSleepPoint: true,
  },
  {
    id: 'qc-chest-storage',
    name: 'Storage Chest',
    icon: '📦',
    modelAssetId: 'mp-chest-storage',
    modelPath: '/assets/props/medieval-props/ChestClosed.fbx',
    description: 'A base storage chest shared with your crew. 40 extra inventory slots accessible at camp.',
    profession: 'miner',
    requiredLevel: 5,
    ingredients: [
      { name: 'Pine Log',  tier: 1, quantity: 5 },
      { name: 'Iron Ore',  tier: 1, quantity: 3 },
    ],
    craftTime: 12,
    xpReward: 30,
    category: 'base',
    isStorageChest: true,
  },
  {
    id: 'qc-crafting-bench',
    name: 'Crafting Bench',
    icon: '🛠️',
    modelAssetId: 'mp-bench',
    modelPath: '/assets/props/medieval-props/SmallBench.fbx',
    description: 'Unlocks the full crafting interface at camp. Required to craft T2+ weapons and armor.',
    profession: 'miner',
    requiredLevel: 5,
    ingredients: [
      { name: 'Pine Log',  tier: 1, quantity: 6 },
      { name: 'Iron Ore',  tier: 1, quantity: 4 },
      { name: 'Scrap Metal', tier: 1, quantity: 2 },
    ],
    craftTime: 20,
    xpReward: 50,
    category: 'base',
    isCraftingStation: true,
  },
  {
    id: 'qc-water-jug',
    name: 'Water Jug',
    icon: '🫙',
    modelAssetId: 'mp-water-jug',
    modelPath: '/assets/props/medieval-props/SmallJar.fbx',
    description: 'Stores water for cooking recipes and survival. Fill from rivers, wells, or water barrels.',
    profession: 'chef',
    requiredLevel: 1,
    ingredients: [
      { name: 'Rough Stone',  tier: 1, quantity: 3 },
      { name: 'Common Herb',  tier: 1, quantity: 1 },
    ],
    craftTime: 5,
    xpReward: 10,
    category: 'survival',
    isWaterSource: true,
  },
  {
    id: 'qc-chest-locked',
    name: 'Locked Chest',
    icon: '🔒',
    modelAssetId: 'mp-chest-locked',
    modelPath: '/assets/props/medieval-props/ChestClosed.fbx',
    description: 'Personal locked inventory: 20 slots only accessible by you. Cannot be looted by other players.',
    profession: 'miner',
    requiredLevel: 10,
    ingredients: [
      { name: 'Iron Ore',       tier: 1, quantity: 6 },
      { name: 'Pine Log',       tier: 1, quantity: 3 },
      { name: 'Rough Leather',  tier: 1, quantity: 2 },
    ],
    craftTime: 18,
    xpReward: 45,
    category: 'base',
    isLockedChest: true,
  },
  {
    id: 'qc-water-barrel',
    name: 'Water Barrel',
    icon: '🫔',
    modelAssetId: 'mp-water-barrel',
    modelPath: '/assets/props/medieval-props/Barrel.fbx',
    description: 'Collects rainwater passively (weather: rain/storm). Acts as a water source for cooking. Fills 1 unit per rain minute.',
    profession: 'forester',
    requiredLevel: 3,
    ingredients: [
      { name: 'Pine Log',   tier: 1, quantity: 4 },
      { name: 'Iron Ore',   tier: 1, quantity: 2 },
    ],
    craftTime: 10,
    xpReward: 20,
    category: 'survival',
    isWaterSource: true,
  },
];

/** Returns only items craftable without a crafting bench (for early-game quick bar) */
export function getEarlyCampItems(): QuickCraftItem[] {
  return QUICK_CRAFT_ITEMS.filter(i => i.requiredLevel <= 5);
}

/** Returns camp items that require a crafting bench */
export function getAdvancedCampItems(): QuickCraftItem[] {
  return QUICK_CRAFT_ITEMS.filter(i => i.requiredLevel > 5);
}

// ── Profession → Material Mapping ────────────────────────────

const PROFESSION_MATERIALS: Record<string, { primary: string; secondary: string }> = {
  miner:    { primary: 'Iron Ore', secondary: 'Rough Stone' },
  forester: { primary: 'Pine Log', secondary: 'Rough Leather' },
  chef:     { primary: 'Common Fish', secondary: 'Common Herb' },
  engineer: { primary: 'Scrap Metal', secondary: 'Copper Wire' },
  mystic:   { primary: 'Red Flower', secondary: 'Common Herb' },
};

// Tier-scaled material names for each tier
const TIER_ORE: Record<number, string> = {
  1: 'Iron Ore', 2: 'Steel Ore', 3: 'Gold Ore', 4: 'Adamantine Ore',
  5: 'Celestial Ore', 6: 'Starmetal', 7: 'Dragon Scale Ore', 8: 'Infinity Ore',
};
const TIER_WOOD: Record<number, string> = {
  1: 'Pine Log', 2: 'Ironwood Log', 3: 'Elderwood Log', 4: 'Bloodwood',
  5: 'Ancient Oak', 6: 'World Tree Branch', 7: 'Dragon Root', 8: 'Godwood',
};
const TIER_LEATHER: Record<number, string> = {
  1: 'Rough Leather', 2: 'Fine Leather', 3: 'Exotic Leather', 4: 'Dragon Hide',
  5: 'Celestial Hide', 6: 'Titan Skin', 7: 'Phoenix Feather', 8: 'Infinity Hide',
};
const TIER_HERB: Record<number, string> = {
  1: 'Common Herb', 2: 'Moonpetal', 3: 'Dragon\'s Breath', 4: 'Ethereal Orchid',
  5: 'Celestial Bloom', 6: 'Starflower', 7: 'Phoenix Ash Flower', 8: 'Infinity Bloom',
};
const TIER_CLOTH: Record<number, string> = {
  1: 'Red Flower', 2: 'Moonpetal', 3: 'Mana Bloom', 4: 'Life Root',
  5: 'Spirit Herb', 6: 'Sunpetal', 7: 'Titan Root', 8: 'Cosmic Lotus',
};
const TIER_SCRAP: Record<number, string> = {
  1: 'Scrap Metal', 2: 'Iron Gears', 3: 'Steel Components', 4: 'Mythril Circuits',
  5: 'Void Engine Parts', 6: 'Celestial Machinery', 7: 'Dragon Tech', 8: 'Infinity Machine',
};

// ── Auto-generate Recipes ──────────────────────────────────────

function generateWeaponRecipes(): CraftingRecipe[] {
  const recipes: CraftingRecipe[] = [];
  // Weapon types and their crafting profession
  const weaponProf: Record<string, string> = {
    swords: 'miner', axes1h: 'miner', greataxes: 'miner', greatswords: 'miner',
    hammers: 'miner', daggers: 'miner', spears: 'miner',
    bows: 'forester', crossbows: 'forester',
    guns: 'engineer', scythes: 'miner',
    fireStaves: 'mystic', frostStaves: 'mystic', arcaneStaves: 'mystic',
    natureStaves: 'mystic', lightningStaves: 'mystic', holyStaves: 'mystic',
  };

  for (const [weaponType, profId] of Object.entries(weaponProf)) {
    for (let tier = 1; tier <= 8; tier++) {
      const baseCost = tier * 3 + 2;
      const ingredients: CraftingIngredient[] = [];

      if (profId === 'miner') {
        ingredients.push({ name: TIER_ORE[tier], tier, quantity: baseCost });
        if (tier >= 3) ingredients.push({ name: TIER_WOOD[Math.max(1, tier - 1)], tier: Math.max(1, tier - 1), quantity: Math.ceil(baseCost / 2) });
      } else if (profId === 'forester') {
        ingredients.push({ name: TIER_WOOD[tier], tier, quantity: baseCost });
        ingredients.push({ name: TIER_LEATHER[tier], tier, quantity: Math.ceil(baseCost / 2) });
      } else if (profId === 'engineer') {
        ingredients.push({ name: TIER_SCRAP[tier], tier, quantity: baseCost });
        ingredients.push({ name: TIER_ORE[tier], tier, quantity: Math.ceil(baseCost / 3) });
      } else if (profId === 'mystic') {
        ingredients.push({ name: TIER_HERB[tier], tier, quantity: baseCost });
        ingredients.push({ name: TIER_WOOD[tier], tier, quantity: Math.ceil(baseCost / 2) });
      }

      recipes.push({
        id: `weapon-${weaponType}-t${tier}`,
        name: `T${tier} ${weaponType.charAt(0).toUpperCase() + weaponType.slice(1)}`,
        category: 'weapon',
        resultType: weaponType,
        resultTier: tier,
        profession: profId,
        requiredLevel: tier * 10 + 3,
        ingredients,
        craftTime: tier * 2,
        xpReward: tier * 25,
        resultCount: 1,
        description: `Craft a Tier ${tier} ${weaponType}`,
      });
    }
  }
  return recipes;
}

function generateArmorRecipes(): CraftingRecipe[] {
  const recipes: CraftingRecipe[] = [];
  const armorSlots = ['Helm', 'Shoulder', 'Chest', 'Hands', 'Feet', 'Ring', 'Necklace'];
  const materials: { type: string; profId: string; mat: Record<number, string> }[] = [
    { type: 'cloth', profId: 'mystic', mat: TIER_CLOTH },
    { type: 'leather', profId: 'forester', mat: TIER_LEATHER },
    { type: 'metal', profId: 'miner', mat: TIER_ORE },
  ];

  for (const mat of materials) {
    for (const slot of armorSlots) {
      for (let tier = 1; tier <= 8; tier++) {
        const baseCost = slot === 'Chest' ? tier * 4 + 3 : slot === 'Ring' || slot === 'Necklace' ? tier * 2 + 1 : tier * 3 + 2;
        const ingredients: CraftingIngredient[] = [
          { name: mat.mat[tier], tier, quantity: baseCost },
        ];
        if (tier >= 4) {
          // Higher tiers need supplementary materials
          const suppMat = mat.profId === 'miner' ? TIER_LEATHER : mat.profId === 'forester' ? TIER_HERB : TIER_HERB;
          ingredients.push({ name: suppMat[Math.max(1, tier - 1)], tier: Math.max(1, tier - 1), quantity: Math.ceil(baseCost / 3) });
        }

        recipes.push({
          id: `armor-${mat.type}-${slot.toLowerCase()}-t${tier}`,
          name: `T${tier} ${mat.type.charAt(0).toUpperCase() + mat.type.slice(1)} ${slot}`,
          category: 'armor',
          resultType: `${mat.type}-${slot.toLowerCase()}`,
          resultTier: tier,
          profession: mat.profId,
          requiredLevel: tier * 10,
          ingredients,
          craftTime: tier * 1.5,
          xpReward: tier * 20,
          resultCount: 1,
          description: `Craft a Tier ${tier} ${mat.type} ${slot}`,
        });
      }
    }
  }
  return recipes;
}

function generateConsumableRecipes(): CraftingRecipe[] {
  const recipes: CraftingRecipe[] = [];
  for (let tier = 1; tier <= 8; tier++) {
    recipes.push({
      id: `potion-hp-t${tier}`,
      name: `T${tier} Health Potion`,
      category: 'consumable',
      resultType: 'health-potion',
      resultTier: tier,
      profession: 'chef',
      requiredLevel: tier * 8,
      ingredients: [
        { name: TIER_HERB[tier], tier, quantity: tier + 1 },
      ],
      craftTime: tier,
      xpReward: tier * 10,
      resultCount: 3,
      description: `Brew ${3} T${tier} health potions`,
    });
    recipes.push({
      id: `potion-mp-t${tier}`,
      name: `T${tier} Mana Potion`,
      category: 'consumable',
      resultType: 'mana-potion',
      resultTier: tier,
      profession: 'chef',
      requiredLevel: tier * 8,
      ingredients: [
        { name: TIER_HERB[tier], tier, quantity: tier + 1 },
        { name: tier <= 4 ? 'Common Fish' : TIER_HERB[Math.max(1, tier - 2)], tier: tier <= 4 ? 1 : Math.max(1, tier - 2), quantity: tier },
      ],
      craftTime: tier,
      xpReward: tier * 12,
      resultCount: 3,
      description: `Brew ${3} T${tier} mana potions`,
    });
    recipes.push({
      id: `food-buff-t${tier}`,
      name: `T${tier} Battle Ration`,
      category: 'consumable',
      resultType: 'food-buff',
      resultTier: tier,
      profession: 'chef',
      requiredLevel: tier * 10,
      ingredients: [
        { name: tier <= 4 ? 'Common Fish' : 'Golden Fish', tier: tier <= 4 ? 1 : 3, quantity: tier + 2 },
        { name: TIER_HERB[Math.min(tier, 6)], tier: Math.min(tier, 6), quantity: Math.ceil(tier / 2) },
      ],
      craftTime: tier * 2,
      xpReward: tier * 18,
      resultCount: 5,
      description: `Cook ${5} T${tier} battle rations (+stats buff)`,
    });
  }
  return recipes;
}

// ── All Recipes ────────────────────────────────────────────────

let _allRecipes: CraftingRecipe[] | null = null;

export function getAllRecipes(): CraftingRecipe[] {
  if (!_allRecipes) {
    _allRecipes = [
      ...generateWeaponRecipes(),
      ...generateArmorRecipes(),
      ...generateConsumableRecipes(),
    ];
  }
  return _allRecipes;
}

export function getRecipesByProfession(profId: string): CraftingRecipe[] {
  return getAllRecipes().filter(r => r.profession === profId);
}

export function getRecipesByCategory(category: CraftingRecipe['category']): CraftingRecipe[] {
  return getAllRecipes().filter(r => r.category === category);
}

export function getRecipeById(id: string): CraftingRecipe | null {
  return getAllRecipes().find(r => r.id === id) || null;
}

// ── Crafting Logic ─────────────────────────────────────────────

export interface CraftResult {
  success: boolean;
  reason?: string;
  recipe?: CraftingRecipe;
  xpGained?: number;
  profLevelUp?: boolean;
  profNewLevel?: number;
}

/** Check if player can craft a recipe */
export function canCraft(
  recipe: CraftingRecipe,
  inv: ResourceInventory,
  profs: PlayerProfessions,
): { craftable: boolean; reason: string } {
  const prof = profs.crafting[recipe.profession];
  if (!prof) return { craftable: false, reason: 'Unknown profession' };
  if (prof.level < recipe.requiredLevel) return { craftable: false, reason: `Requires ${recipe.profession} level ${recipe.requiredLevel}` };

  for (const ing of recipe.ingredients) {
    if (!hasResource(inv, ing.name, ing.tier, ing.quantity)) {
      return { craftable: false, reason: `Need ${ing.quantity}x ${ing.name} (T${ing.tier})` };
    }
  }
  return { craftable: true, reason: 'Ready to craft' };
}

/** Execute a craft, consuming materials and granting XP */
export function executeCraft(
  recipe: CraftingRecipe,
  inv: ResourceInventory,
  profs: PlayerProfessions,
): CraftResult {
  const check = canCraft(recipe, inv, profs);
  if (!check.craftable) return { success: false, reason: check.reason };

  // Consume ingredients
  for (const ing of recipe.ingredients) {
    removeResource(inv, ing.name, ing.tier, ing.quantity);
  }

  // Grant profession XP
  const levelResult = gainProfessionXp(profs, 'crafting', recipe.profession, recipe.xpReward);

  // Auto-save
  saveProfessions(profs);
  saveResourceInventory(inv);

  return {
    success: true,
    recipe,
    xpGained: recipe.xpReward,
    profLevelUp: levelResult.leveled,
    profNewLevel: levelResult.newLevel,
  };
}

// ── Recipe Filtering for UI ────────────────────────────────────

export function getAvailableRecipes(
  profs: PlayerProfessions,
  inv: ResourceInventory,
  professionFilter?: string,
  categoryFilter?: CraftingRecipe['category'],
): { recipe: CraftingRecipe; craftable: boolean; reason: string }[] {
  let recipes = getAllRecipes();
  if (professionFilter) recipes = recipes.filter(r => r.profession === professionFilter);
  if (categoryFilter) recipes = recipes.filter(r => r.category === categoryFilter);

  return recipes.map(recipe => {
    const check = canCraft(recipe, inv, profs);
    return { recipe, craftable: check.craftable, reason: check.reason };
  });
}

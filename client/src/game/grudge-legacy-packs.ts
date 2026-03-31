/**
 * GRUDGE Legacy Asset Packs — Auto-generated from FRESH GRUDGE Unity Project
 *
 * 1,084 models converted from the original Unity uMMORPG project.
 * Organized by category: monsters, mounts, weapons, harvestables, NPCs, etc.
 *
 * Models live at: /assets/grudge-legacy/{category}/{name}.glb (or .fbx fallback)
 * Source: D:\GitHub\Crown\GRUDGE-NFT-Island\FRESH GRUDGE\Assets
 *
 * To regenerate: node tools/grudge-asset-scan.mjs && node tools/grudge-fbx-convert.mjs
 */

import type { AssetPack, AssetEntry } from './asset-packs';

const BASE = '/assets/grudge-legacy';

function glb(id: string, name: string, path: string, cat: string, tags: string[], scale = 1): AssetEntry {
  return { id, name, path, format: 'gltf', category: cat, tags, scale };
}
function fbx(id: string, name: string, path: string, cat: string, tags: string[], scale = 0.01): AssetEntry {
  return { id, name, path, format: 'fbx', category: cat, tags, scale };
}

// ══════════════════════════════════════════════════════════════
// MONSTERS (209 models) — World mobs, dungeon bosses, drakes
// ══════════════════════════════════════════════════════════════

export const GRUDGE_MONSTER_PACK: AssetPack = {
  id: 'grudge-monsters',
  name: 'GRUDGE Legacy Monsters',
  description: 'Monster models from the original Unity GRUDGE MMO — world mobs, dungeon bosses, drakes, corruptions',
  basePath: `${BASE}/monster`,
  texturePath: `${BASE}/monster`,
  assets: [
    // World mobs
    glb('gm-wolf', 'Wolf', `${BASE}/monster/wolf.glb`, 'character', ['enemy', 'wolf', 'world', 'beast']),
    glb('gm-bear', 'Bear', `${BASE}/monster/bear.glb`, 'character', ['enemy', 'bear', 'world', 'beast']),
    glb('gm-spider', 'Spider', `${BASE}/monster/zhizhu.glb`, 'character', ['enemy', 'spider', 'world']),
    glb('gm-gargoyle', 'Gargoyle', `${BASE}/monster/gargoyle.glb`, 'character', ['enemy', 'gargoyle', 'dungeon']),
    glb('gm-raptor', 'Raptor', `${BASE}/monster/raptor.glb`, 'character', ['enemy', 'raptor', 'world', 'beast']),
    glb('gm-rhino', 'Rhino', `${BASE}/monster/rhino.glb`, 'character', ['enemy', 'rhino', 'world', 'beast']),
    glb('gm-crab', 'Crab', `${BASE}/monster/crab.glb`, 'character', ['enemy', 'crab', 'coastal']),
    glb('gm-goat', 'Goat', `${BASE}/monster/goat.glb`, 'character', ['enemy', 'goat', 'world']),
    glb('gm-scorpion', 'Scorpion', `${BASE}/monster/scorpion.glb`, 'character', ['enemy', 'scorpion', 'desert']),
    glb('gm-young-ent', 'Young Ent', `${BASE}/monster/young_ent.glb`, 'character', ['enemy', 'treant', 'forest']),
    glb('gm-elder-ent', 'Elder Ent', `${BASE}/monster/elder_ent.glb`, 'character', ['enemy', 'treant', 'boss', 'forest']),
    glb('gm-corrupted-ent', 'Corrupted Ent', `${BASE}/monster/corrupted_ent.glb`, 'character', ['enemy', 'treant', 'corrupted']),
    glb('gm-dragon-boar', 'Dragon Boar', `${BASE}/monster/dragon_boar.glb`, 'character', ['enemy', 'boar', 'dragon', 'boss']),
    glb('gm-war-saber', 'War Saber', `${BASE}/monster/war_saber.glb`, 'character', ['enemy', 'saber', 'beast']),
    glb('gm-grunk', 'Grunk', `${BASE}/monster/grunk.glb`, 'character', ['enemy', 'grunk', 'world']),
    glb('gm-hairy-spider', 'Hairy Spider', `${BASE}/monster/hairy_spider.glb`, 'character', ['enemy', 'spider', 'large']),
    glb('gm-poison-spider', 'Poison Spider', `${BASE}/monster/poison_spider.glb`, 'character', ['enemy', 'spider', 'poison']),

    // Dungeon bosses
    glb('gm-minotaur', 'Minotaur', `${BASE}/monster/minotaur.glb`, 'character', ['enemy', 'minotaur', 'dungeon', 'boss']),
    glb('gm-minotaur-elder', 'Minotaur Elder', `${BASE}/monster/minotaur_elder.glb`, 'character', ['enemy', 'minotaur', 'boss']),
    glb('gm-juggernaut', 'Juggernaut', `${BASE}/monster/juggernaut.glb`, 'character', ['enemy', 'juggernaut', 'boss']),
    glb('gm-arachnid', 'Arachnid', `${BASE}/monster/arachnid.glb`, 'character', ['enemy', 'arachnid', 'dungeon']),
    glb('gm-demon', 'Demon', `${BASE}/monster/demon.glb`, 'character', ['enemy', 'demon', 'dungeon']),
    glb('gm-arch-demon', 'Arch Demon', `${BASE}/monster/arch_demon.glb`, 'character', ['enemy', 'demon', 'boss']),
    glb('gm-ice-golem', 'Ice Golem', `${BASE}/monster/ice_golem.glb`, 'character', ['enemy', 'golem', 'ice']),
    glb('gm-lava-golem', 'Lava Golem', `${BASE}/monster/lava_golem.glb`, 'character', ['enemy', 'golem', 'lava']),
    glb('gm-forest-golem', 'Forest Golem', `${BASE}/monster/forest_golem.glb`, 'character', ['enemy', 'golem', 'forest']),
    glb('gm-stone-golem', 'Stone Golem', `${BASE}/monster/stone_golem.glb`, 'character', ['enemy', 'golem', 'stone']),
    glb('gm-yeti', 'Yeti', `${BASE}/monster/yeti.glb`, 'character', ['enemy', 'yeti', 'ice', 'boss']),
    glb('gm-kraken', 'Kraken', `${BASE}/monster/kraken.glb`, 'character', ['enemy', 'kraken', 'ocean', 'boss']),
    glb('gm-necromancer', 'Necromancer', `${BASE}/monster/necromancer.glb`, 'character', ['enemy', 'undead', 'mage', 'dungeon']),
    glb('gm-ogre', 'Ogre', `${BASE}/monster/ogre.glb`, 'character', ['enemy', 'ogre', 'boss']),
    glb('gm-ogre-bone-crusher', 'Ogre Bone Crusher', `${BASE}/monster/ogre_bone_crusher.glb`, 'character', ['enemy', 'ogre', 'boss']),
    glb('gm-reptilian', 'Reptilian', `${BASE}/monster/reptilian.glb`, 'character', ['enemy', 'reptile', 'dungeon']),
    glb('gm-dryad', 'Dryad', `${BASE}/monster/dryad.glb`, 'character', ['enemy', 'dryad', 'forest']),
    glb('gm-horn-beetle', 'Horn Beetle', `${BASE}/monster/horn_beetle.glb`, 'character', ['enemy', 'insect', 'forest']),
    glb('gm-cave-hound', 'Cave Hound', `${BASE}/monster/cave_hound.glb`, 'character', ['enemy', 'hound', 'cave']),
    glb('gm-fiend', 'Fiend', `${BASE}/monster/fiend.glb`, 'character', ['enemy', 'fiend', 'dungeon']),

    // World bosses
    glb('gm-cerberus', 'Cerberus', `${BASE}/monster/cerberus.glb`, 'character', ['enemy', 'cerberus', 'world_boss']),
    glb('gm-gorgoz', 'Gorgoz', `${BASE}/monster/gorgoz.glb`, 'character', ['enemy', 'gorgoz', 'world_boss']),
    glb('gm-ancient-thresher', 'Ancient Thresher', `${BASE}/monster/ancient_thresher.glb`, 'character', ['enemy', 'thresher', 'world_boss']),
    glb('gm-vile-terror', 'Vile Terror Bringer', `${BASE}/monster/vile_terror_bringer.glb`, 'character', ['enemy', 'terror', 'world_boss']),
    glb('gm-corrupted-flame', 'Corrupted Flame Eater', `${BASE}/monster/corrupted_flame_eater.glb`, 'character', ['enemy', 'flame', 'world_boss']),

    // Drakes (10 variants)
    glb('gm-drake-bone', 'Dragon Bone Drake', `${BASE}/monster/dragon_bone_drake.glb`, 'character', ['enemy', 'drake', 'bone']),
    glb('gm-drake-emerald', 'Emerald Drake', `${BASE}/monster/emerald_drake.glb`, 'character', ['enemy', 'drake', 'emerald']),
    glb('gm-drake-forest', 'Forest Drake', `${BASE}/monster/forest_drake.glb`, 'character', ['enemy', 'drake', 'forest']),
    glb('gm-drake-frigid', 'Frigid Drake', `${BASE}/monster/frigid_drake.glb`, 'character', ['enemy', 'drake', 'frost']),
    glb('gm-drake-frost', 'Frost Drake', `${BASE}/monster/frost_drake.glb`, 'character', ['enemy', 'drake', 'frost']),
    glb('gm-drake-hellfire', 'Hellfire Drake', `${BASE}/monster/hellfire_drake.glb`, 'character', ['enemy', 'drake', 'fire']),
    glb('gm-drake-lava', 'Lava Drake', `${BASE}/monster/lava_drake.glb`, 'character', ['enemy', 'drake', 'lava']),
    glb('gm-drake-nightstalker', 'Nightstalker Drake', `${BASE}/monster/nightstalker_drake.glb`, 'character', ['enemy', 'drake', 'shadow']),
    glb('gm-drake-rock', 'Rock Drake', `${BASE}/monster/rock_drake.glb`, 'character', ['enemy', 'drake', 'earth']),
    glb('gm-drake-void', 'Void Drake', `${BASE}/monster/void_drake.glb`, 'character', ['enemy', 'drake', 'void']),

    // Dark Elves
    glb('gm-dark-elf-guard', 'Dark Elf Guard', `${BASE}/monster/dark_elf_guard.glb`, 'character', ['enemy', 'elf', 'dark', 'patrol']),
    glb('gm-dark-elf-archer', 'Dark Elf Archer', `${BASE}/monster/dark_elf_archer.glb`, 'character', ['enemy', 'elf', 'dark', 'ranged']),
    glb('gm-dark-elf-commander', 'Dark Elf Commander', `${BASE}/monster/dark_elf_commander.glb`, 'character', ['enemy', 'elf', 'dark', 'boss']),
    glb('gm-dark-elf-lord', 'Dark Elf Lord', `${BASE}/monster/dark_elf_lord.glb`, 'character', ['enemy', 'elf', 'dark', 'boss']),

    // Corruption mobs
    glb('gm-mimic', 'Mimic', `${BASE}/monster/mimic.glb`, 'character', ['enemy', 'mimic', 'corruption']),
  ],
};

// ══════════════════════════════════════════════════════════════
// MOUNTS (13+ models) — Horses, drakes, mechas, vehicles
// ══════════════════════════════════════════════════════════════

export const GRUDGE_MOUNT_PACK: AssetPack = {
  id: 'grudge-mounts',
  name: 'GRUDGE Legacy Mounts',
  description: 'Mount models — horses, drakes, mechas, boats, vehicles',
  basePath: `${BASE}/mount`,
  texturePath: `${BASE}/mount`,
  assets: [
    glb('gmt-horse', 'Horse', `${BASE}/mount/horse.glb`, 'mount', ['mount', 'horse']),
    glb('gmt-ram', 'Ram', `${BASE}/mount/ram.glb`, 'mount', ['mount', 'ram']),
    glb('gmt-boat', 'Boat', `${BASE}/mount/boat.glb`, 'mount', ['mount', 'boat', 'water']),
    glb('gmt-balloon-boat', 'Balloon Boat', `${BASE}/mount/balloon_boat_dark.glb`, 'mount', ['mount', 'boat', 'air']),
  ],
};

// ══════════════════════════════════════════════════════════════
// WEAPONS (106 models)
// ══════════════════════════════════════════════════════════════

export const GRUDGE_WEAPON_PACK: AssetPack = {
  id: 'grudge-weapons',
  name: 'GRUDGE Legacy Weapons',
  description: 'Weapon models — swords, axes, bows, staffs, shields, maces, spears, daggers',
  basePath: `${BASE}/weapon`,
  texturePath: `${BASE}/weapon`,
  assets: [
    glb('gw-sword', 'Sword', `${BASE}/weapon/sword.glb`, 'weapon', ['sword', 'melee', '1h']),
    glb('gw-greataxe', 'Great Axe', `${BASE}/weapon/greataxe.glb`, 'weapon', ['axe', 'melee', '2h']),
    glb('gw-hammer', 'Hammer', `${BASE}/weapon/hammer.glb`, 'weapon', ['hammer', 'melee', '1h']),
    glb('gw-shield', 'Shield', `${BASE}/weapon/shield.glb`, 'weapon', ['shield', 'defense']),
    glb('gw-staff', 'Staff', `${BASE}/weapon/staff.glb`, 'weapon', ['staff', 'magic']),
    glb('gw-spear-1h', 'Spear 1H', `${BASE}/weapon/spear1h.glb`, 'weapon', ['spear', 'melee', '1h']),
    glb('gw-spear-2h', 'Spear 2H', `${BASE}/weapon/spear2h.glb`, 'weapon', ['spear', 'melee', '2h']),
    glb('gw-mace', 'Mace', `${BASE}/weapon/mace1h.glb`, 'weapon', ['mace', 'melee', '1h']),
    glb('gw-dagger', 'Dagger', `${BASE}/weapon/dagger4_1.glb`, 'weapon', ['dagger', 'melee', '1h']),
    glb('gw-bow', 'Bow', `${BASE}/weapon/bowshot.glb`, 'weapon', ['bow', 'ranged']),
    glb('gw-pickaxe', 'Pickaxe', `${BASE}/weapon/pickaxe.glb`, 'weapon', ['pickaxe', 'tool', 'mining']),
  ],
};

// ══════════════════════════════════════════════════════════════
// HARVESTABLES (40 models) — Trees, ores, crystals, stones
// ══════════════════════════════════════════════════════════════

export const GRUDGE_HARVESTABLE_PACK: AssetPack = {
  id: 'grudge-harvestables',
  name: 'GRUDGE Legacy Harvestables',
  description: 'Harvestable resource nodes — trees, rocks, crystals, ore veins, mining carts',
  basePath: `${BASE}/harvestable`,
  texturePath: `${BASE}/harvestable`,
  assets: [
    glb('gh-stone-1', 'Stone 1', `${BASE}/harvestable/stone1.glb`, 'resource-node', ['mining', 'stone']),
    glb('gh-stone-2', 'Stone 2', `${BASE}/harvestable/stone2.glb`, 'resource-node', ['mining', 'stone']),
    glb('gh-stone-3', 'Stone 3', `${BASE}/harvestable/stone3.glb`, 'resource-node', ['mining', 'stone']),
    glb('gh-big-stone', 'Big Stone', `${BASE}/harvestable/big_stone_01.glb`, 'resource-node', ['mining', 'stone', 'large']),
    glb('gh-crystal', 'Crystal', `${BASE}/harvestable/crystal.glb`, 'resource-node', ['mining', 'crystal']),
    glb('gh-crystal-cluster', 'Crystal Cluster', `${BASE}/harvestable/crystalcluster.glb`, 'resource-node', ['mining', 'crystal']),
    glb('gh-rock-crystal', 'Rock Crystal', `${BASE}/harvestable/rockcrystal-.glb`, 'resource-node', ['mining', 'crystal', 'rock']),
    glb('gh-minecart', 'Minecart', `${BASE}/harvestable/minecart_top.glb`, 'prop', ['mining', 'cart']),
    glb('gh-whetstone', 'Whetstone', `${BASE}/harvestable/whetstone.glb`, 'prop', ['tool', 'crafting']),
  ],
};

// ══════════════════════════════════════════════════════════════
// BUILDINGS (198 models)
// ══════════════════════════════════════════════════════════════

export const GRUDGE_BUILDING_PACK: AssetPack = {
  id: 'grudge-buildings',
  name: 'GRUDGE Legacy Buildings',
  description: 'Building and structure models — towns, dungeons, walls, gates, taverns',
  basePath: `${BASE}/building`,
  texturePath: `${BASE}/building`,
  assets: [
    // Town buildings
    glb('gb-house-1', 'House 1', `${BASE}/building/house1.glb`, 'structure', ['building', 'house', 'town']),
    glb('gb-house-2', 'House 2', `${BASE}/building/house2.glb`, 'structure', ['building', 'house', 'town']),
    glb('gb-house-3', 'House 3', `${BASE}/building/house3.glb`, 'structure', ['building', 'house', 'town']),
    glb('gb-tavern', 'Tavern', `${BASE}/building/tavern.glb`, 'structure', ['building', 'tavern', 'town']),
    glb('gb-windmill', 'Windmill', `${BASE}/building/windmill.glb`, 'structure', ['building', 'windmill', 'town']),
    glb('gb-town-gate', 'Town Gate', `${BASE}/building/towngate.glb`, 'structure', ['gate', 'town']),
    // Walls
    glb('gb-wall-1', 'Stone Wall', `${BASE}/building/wall_part1.glb`, 'wall', ['wall', 'stone', 'town']),
    glb('gb-wall-tower', 'Wall Tower', `${BASE}/building/wall_tower1.glb`, 'structure', ['tower', 'wall', 'town']),
    glb('gb-wall-wooden', 'Wooden Wall', `${BASE}/building/woodenwall_1.glb`, 'wall', ['wall', 'wood']),
    // Dungeon
    glb('gb-dungeon-entrance', 'Dungeon Entrance', `${BASE}/building/enterence.glb`, 'structure', ['dungeon', 'entrance']),
    glb('gb-crypt', 'Crypt', `${BASE}/building/crypt.glb`, 'structure', ['dungeon', 'crypt', 'undead']),
  ],
};

// ══════════════════════════════════════════════════════════════
// ENVIRONMENT (64 models) — Trees, foliage, rocks, nature
// ══════════════════════════════════════════════════════════════

export const GRUDGE_ENVIRONMENT_PACK: AssetPack = {
  id: 'grudge-environment',
  name: 'GRUDGE Legacy Environment',
  description: 'Nature models — trees, bushes, ferns, grass, rocks, flowers, mushrooms',
  basePath: `${BASE}/environment`,
  texturePath: `${BASE}/environment`,
  assets: [
    glb('ge-tree', 'Tree', `${BASE}/environment/tree.glb`, 'terrain', ['tree', 'deciduous']),
    glb('ge-oak', 'Oak Tree', `${BASE}/environment/oak_tree1.glb`, 'terrain', ['tree', 'oak']),
    glb('ge-pine', 'Pine Tree', `${BASE}/environment/pine_tree1.glb`, 'terrain', ['tree', 'pine']),
    glb('ge-willow', 'Willow Tree', `${BASE}/environment/willow_tree1.glb`, 'terrain', ['tree', 'willow']),
    glb('ge-palm', 'Palm Tree', `${BASE}/environment/palm.glb`, 'terrain', ['tree', 'palm', 'tropical']),
    glb('ge-bush', 'Bush', `${BASE}/environment/bush1.glb`, 'terrain', ['bush', 'foliage']),
    glb('ge-fern', 'Fern', `${BASE}/environment/fern1.glb`, 'terrain', ['fern', 'foliage']),
    glb('ge-grass', 'Grass', `${BASE}/environment/grass1.glb`, 'terrain', ['grass', 'foliage']),
    glb('ge-rock', 'Rock', `${BASE}/environment/rock1.glb`, 'terrain', ['rock']),
    glb('ge-mushroom', 'Mushroom', `${BASE}/environment/mushroom1.glb`, 'terrain', ['mushroom']),
    glb('ge-flower', 'Flower', `${BASE}/environment/flower1.glb`, 'terrain', ['flower']),
    glb('ge-sunflower', 'Sunflower', `${BASE}/environment/sunflower.glb`, 'terrain', ['flower', 'sunflower']),
    glb('ge-stump', 'Tree Stump', `${BASE}/environment/deciduous_tree_stump.glb`, 'terrain', ['stump', 'harvestable']),
    glb('ge-pine-stump', 'Pine Stump', `${BASE}/environment/pine_stump.glb`, 'terrain', ['stump', 'harvestable']),
  ],
};

// ══════════════════════════════════════════════════════════════
// PROPS (30 models) — Barrels, chests, carts, furniture
// ══════════════════════════════════════════════════════════════

export const GRUDGE_PROP_PACK: AssetPack = {
  id: 'grudge-props',
  name: 'GRUDGE Legacy Props',
  description: 'Prop models — barrels, chests, carts, furniture, food, storage',
  basePath: `${BASE}/prop`,
  texturePath: `${BASE}/prop`,
  assets: [
    glb('gp-barrel', 'Barrel', `${BASE}/prop/barrel.glb`, 'prop', ['barrel', 'storage']),
    glb('gp-chest', 'Fantasy Chest', `${BASE}/prop/stylized_fantasy_chest.glb`, 'prop', ['chest', 'loot']),
    glb('gp-bag', 'Bag', `${BASE}/prop/bag_0001.glb`, 'prop', ['bag', 'storage']),
    glb('gp-box', 'Box', `${BASE}/prop/box_0002.glb`, 'prop', ['box', 'storage']),
    glb('gp-cart-2w', 'Cart 2-Wheel', `${BASE}/prop/cart_2w.glb`, 'prop', ['cart', 'transport']),
    glb('gp-cart-4w', 'Cart 4-Wheel', `${BASE}/prop/cart_4w.glb`, 'prop', ['cart', 'transport']),
    glb('gp-bottle-red', 'Red Bottle', `${BASE}/prop/bottle_red.glb`, 'prop', ['bottle', 'potion', 'red']),
    glb('gp-bottle-blue', 'Blue Bottle', `${BASE}/prop/bottle_blue.glb`, 'prop', ['bottle', 'potion', 'blue']),
    glb('gp-bottle-green', 'Green Bottle', `${BASE}/prop/bottle_green.glb`, 'prop', ['bottle', 'potion', 'green']),
  ],
};

// ══════════════════════════════════════════════════════════════
// Combined Exports
// ══════════════════════════════════════════════════════════════

export const GRUDGE_LEGACY_PACKS: AssetPack[] = [
  GRUDGE_MONSTER_PACK,
  GRUDGE_MOUNT_PACK,
  GRUDGE_WEAPON_PACK,
  GRUDGE_HARVESTABLE_PACK,
  GRUDGE_BUILDING_PACK,
  GRUDGE_ENVIRONMENT_PACK,
  GRUDGE_PROP_PACK,
];

export const GRUDGE_LEGACY_ASSETS: AssetEntry[] = GRUDGE_LEGACY_PACKS.flatMap(p => p.assets);

export function getGrudgeLegacyAsset(id: string): AssetEntry | undefined {
  return GRUDGE_LEGACY_ASSETS.find(a => a.id === id);
}

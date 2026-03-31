/**
 * Elf Asset Pack Registry — Zone 2 (Fabled Shore)
 *
 * References all downloaded elf-themed asset packs for the enchanted
 * forest zone.  These will be extracted to public/assets/packs/ at
 * build time; paths below assume that final location.
 *
 * Source zips (D:\Downloads):
 *   - EnchantedForest_AssetPack (1).zip
 *   - craftpix-net-850743-elf-weapon-3d-low-poly-models.zip
 *   - craftpix-net-193870-fortress-of-the-elves-3d-low-poly-models.zip
 *   - craftpix-net-293219-elven-runes-stones-and-wooden-sculptures-3d-low-poly-models.zip
 *   - craftpix-net-788035-elves-3d-low-poly-model-pack.zip
 *   - craftpix-net-539977-free-defence-tower-3d-low-poly-models.zip
 *   - SG_Environment_Asset_Pack.zip
 *   - HighLandsFantasyBuildings.zip
 *   - Golem_Free.zip          (enemies)
 *   - Elf_Free.zip            (enemies)
 */

import type { AssetPack, AssetEntry } from './asset-packs';

const P = '/assets/packs';

// ── Helpers ────────────────────────────────────────────────────

function fbx(id: string, name: string, path: string, cat: string, tags: string[], scale?: number): AssetEntry {
  return { id, name, path, format: 'fbx', category: cat, tags, scale };
}
function gltf(id: string, name: string, path: string, cat: string, tags: string[], scale?: number): AssetEntry {
  return { id, name, path, format: 'gltf', category: cat, tags, scale };
}
function obj(id: string, name: string, path: string, cat: string, tags: string[], scale?: number): AssetEntry {
  return { id, name, path, format: 'obj', category: cat, tags, scale };
}

// ── Enchanted Forest Environment ───────────────────────────────

const EF = `${P}/enchanted-forest`;

export const ENCHANTED_FOREST_PACK: AssetPack = {
  id: 'enchanted-forest',
  name: 'Enchanted Forest',
  description: 'Lush enchanted forest terrain, trees, crystals, mushrooms, and magical flora',
  basePath: EF,
  texturePath: `${EF}/Textures`,
  assets: [
    fbx('ef-tree-ancient',    'Ancient Tree',       `${EF}/FBX/Tree_Ancient.fbx`,       'terrain',  ['tree', 'elf', 'forest'], 0.02),
    fbx('ef-tree-willow',     'Willow Tree',        `${EF}/FBX/Tree_Willow.fbx`,        'terrain',  ['tree', 'elf', 'forest'], 0.02),
    fbx('ef-tree-crystal',    'Crystal Tree',       `${EF}/FBX/Tree_Crystal.fbx`,       'terrain',  ['tree', 'crystal', 'elf'], 0.02),
    fbx('ef-mushroom-lg',     'Large Mushroom',     `${EF}/FBX/Mushroom_Large.fbx`,     'terrain',  ['mushroom', 'elf', 'forest'], 0.02),
    fbx('ef-mushroom-cluster','Mushroom Cluster',   `${EF}/FBX/Mushroom_Cluster.fbx`,   'terrain',  ['mushroom', 'elf'], 0.02),
    fbx('ef-crystal-1',       'Mana Crystal 1',     `${EF}/FBX/Crystal_01.fbx`,         'terrain',  ['crystal', 'mana', 'elf'], 0.02),
    fbx('ef-crystal-2',       'Mana Crystal 2',     `${EF}/FBX/Crystal_02.fbx`,         'terrain',  ['crystal', 'mana', 'elf'], 0.02),
    fbx('ef-fern',            'Enchanted Fern',     `${EF}/FBX/Fern_Enchanted.fbx`,     'terrain',  ['plant', 'elf', 'forest'], 0.02),
    fbx('ef-flower-glow',     'Glowing Flower',     `${EF}/FBX/Flower_Glow.fbx`,        'terrain',  ['flower', 'glow', 'elf'], 0.02),
    fbx('ef-rock-moss',       'Mossy Rock',         `${EF}/FBX/Rock_Mossy.fbx`,         'terrain',  ['rock', 'moss', 'elf'], 0.02),
    fbx('ef-bridge-stone',    'Stone Bridge',       `${EF}/FBX/Bridge_Stone.fbx`,       'structure',['bridge', 'elf'], 0.02),
    fbx('ef-arch-ruin',       'Ruined Arch',        `${EF}/FBX/Arch_Ruin.fbx`,          'structure',['arch', 'ruin', 'elf'], 0.02),
    fbx('ef-lantern',         'Forest Lantern',     `${EF}/FBX/Lantern_Forest.fbx`,     'prop',     ['light', 'lantern', 'elf'], 0.02),
    fbx('ef-shrine',          'Forest Shrine',      `${EF}/FBX/Shrine.fbx`,             'structure',['shrine', 'elf', 'magic'], 0.02),
  ],
};

// ── Elf Weapon Models ──────────────────────────────────────────

const EW = `${P}/elf-weapons`;

export const ELF_WEAPON_PACK: AssetPack = {
  id: 'elf-weapons',
  name: 'Elf Weapons',
  description: 'Low-poly elven weapon models — bows, swords, staves, daggers',
  basePath: EW,
  texturePath: `${EW}/Textures`,
  assets: [
    fbx('ew-bow',      'Elven Bow',      `${EW}/FBX/Elf_Bow.fbx`,      'weapon', ['bow', 'elf', 'ranged'], 0.01),
    fbx('ew-sword',    'Elven Sword',    `${EW}/FBX/Elf_Sword.fbx`,    'weapon', ['sword', 'elf', 'melee'], 0.01),
    fbx('ew-staff',    'Elven Staff',    `${EW}/FBX/Elf_Staff.fbx`,    'weapon', ['staff', 'elf', 'magic'], 0.01),
    fbx('ew-dagger',   'Elven Dagger',   `${EW}/FBX/Elf_Dagger.fbx`,   'weapon', ['dagger', 'elf', 'melee'], 0.01),
    fbx('ew-spear',    'Elven Spear',    `${EW}/FBX/Elf_Spear.fbx`,    'weapon', ['spear', 'elf', 'melee'], 0.01),
    fbx('ew-shield',   'Elven Shield',   `${EW}/FBX/Elf_Shield.fbx`,   'weapon', ['shield', 'elf', 'defense'], 0.01),
  ],
};

// ── Fortress of the Elves ──────────────────────────────────────

const FE = `${P}/elf-fortress`;

export const ELF_FORTRESS_PACK: AssetPack = {
  id: 'elf-fortress',
  name: 'Fortress of the Elves',
  description: 'Elven fortress structures — main keep, walls, gates, watchtowers',
  basePath: FE,
  texturePath: `${FE}/Textures`,
  assets: [
    fbx('fe-fortress',    'Elven Fortress',     `${FE}/FBX/Elf_Fortress.fbx`,      'structure', ['fortress', 'elf', 'castle'], 0.02),
    fbx('fe-gate',        'Elven Gate',         `${FE}/FBX/Elf_Gate.fbx`,          'structure', ['gate', 'elf'], 0.02),
    fbx('fe-wall-1',      'Elven Wall 1',       `${FE}/FBX/Elf_Wall_01.fbx`,       'wall',      ['wall', 'elf'], 0.02),
    fbx('fe-wall-2',      'Elven Wall 2',       `${FE}/FBX/Elf_Wall_02.fbx`,       'wall',      ['wall', 'elf'], 0.02),
    fbx('fe-tower-1',     'Elven Watchtower 1', `${FE}/FBX/Elf_Tower_01.fbx`,      'structure', ['tower', 'elf', 'watch'], 0.02),
    fbx('fe-tower-2',     'Elven Watchtower 2', `${FE}/FBX/Elf_Tower_02.fbx`,      'structure', ['tower', 'elf', 'watch'], 0.02),
    fbx('fe-bridge',      'Elven Bridge',       `${FE}/FBX/Elf_Bridge.fbx`,        'structure', ['bridge', 'elf'], 0.02),
    fbx('fe-balcony',     'Elven Balcony',      `${FE}/FBX/Elf_Balcony.fbx`,       'structure', ['balcony', 'elf'], 0.02),
    fbx('fe-pillar',      'Elven Pillar',       `${FE}/FBX/Elf_Pillar.fbx`,        'prop',      ['pillar', 'elf'], 0.02),
    fbx('fe-banner',      'Elven Banner',       `${FE}/FBX/Elf_Banner.fbx`,        'prop',      ['banner', 'elf', 'flag'], 0.02),
  ],
};

// ── Elven Runes, Stones & Sculptures ───────────────────────────

const ER = `${P}/elf-runes`;

export const ELF_RUNES_PACK: AssetPack = {
  id: 'elf-runes',
  name: 'Elven Runes & Sculptures',
  description: 'Elven rune stones, wooden sculptures, and mystical markers',
  basePath: ER,
  texturePath: `${ER}/Textures`,
  assets: [
    fbx('er-runestone-1',  'Rune Stone 1',      `${ER}/FBX/Rune_Stone_01.fbx`,  'prop', ['rune', 'stone', 'elf', 'magic'], 0.02),
    fbx('er-runestone-2',  'Rune Stone 2',      `${ER}/FBX/Rune_Stone_02.fbx`,  'prop', ['rune', 'stone', 'elf', 'magic'], 0.02),
    fbx('er-runestone-3',  'Rune Stone 3',      `${ER}/FBX/Rune_Stone_03.fbx`,  'prop', ['rune', 'stone', 'elf', 'magic'], 0.02),
    fbx('er-sculpture-1',  'Wood Sculpture 1',  `${ER}/FBX/Sculpture_01.fbx`,   'prop', ['sculpture', 'wood', 'elf'], 0.02),
    fbx('er-sculpture-2',  'Wood Sculpture 2',  `${ER}/FBX/Sculpture_02.fbx`,   'prop', ['sculpture', 'wood', 'elf'], 0.02),
    fbx('er-totem',        'Elven Totem',       `${ER}/FBX/Elven_Totem.fbx`,    'prop', ['totem', 'elf', 'magic'], 0.02),
    fbx('er-altar',        'Rune Altar',        `${ER}/FBX/Rune_Altar.fbx`,     'prop', ['altar', 'rune', 'elf', 'magic'], 0.02),
    fbx('er-waystone',     'Waystone',          `${ER}/FBX/Waystone.fbx`,       'prop', ['waystone', 'elf', 'marker'], 0.02),
  ],
};

// ── Elves Character Pack (NPCs & friendlies) ──────────────────

const EC = `${P}/elf-characters`;

export const ELF_CHARACTER_PACK: AssetPack = {
  id: 'elf-characters',
  name: 'Elves Character Pack',
  description: 'Low-poly elf character models for NPCs and allies',
  basePath: EC,
  texturePath: `${EC}/Textures`,
  assets: [
    fbx('ec-elf-warrior',  'Elf Warrior',   `${EC}/FBX/Elf_Warrior.fbx`,   'character', ['npc', 'elf', 'warrior'], 0.01),
    fbx('ec-elf-archer',   'Elf Archer',    `${EC}/FBX/Elf_Archer.fbx`,    'character', ['npc', 'elf', 'ranger'], 0.01),
    fbx('ec-elf-mage',     'Elf Mage',      `${EC}/FBX/Elf_Mage.fbx`,      'character', ['npc', 'elf', 'mage'], 0.01),
    fbx('ec-elf-druid',    'Elf Druid',     `${EC}/FBX/Elf_Druid.fbx`,     'character', ['npc', 'elf', 'druid'], 0.01),
    fbx('ec-elf-scout',    'Elf Scout',     `${EC}/FBX/Elf_Scout.fbx`,     'character', ['npc', 'elf', 'scout'], 0.01),
  ],
};

// ── Elf Enemy Pack (Elf_Free.zip — corrupted/hostile elves) ────

const EE = `${P}/elf-enemies`;

export const ELF_ENEMY_PACK: AssetPack = {
  id: 'elf-enemies',
  name: 'Elf Enemies',
  description: 'Corrupted elf enemy models for hostile encounters',
  basePath: EE,
  texturePath: `${EE}/Textures`,
  assets: [
    gltf('ee-elf-sentry',     'Corrupted Elf Sentry',    `${EE}/Elf_Sentry.glb`,      'character', ['enemy', 'elf', 'sentry', 'melee'], 1),
    gltf('ee-elf-ranger',     'Corrupted Elf Ranger',    `${EE}/Elf_Ranger.glb`,      'character', ['enemy', 'elf', 'ranger', 'ranged'], 1),
    gltf('ee-elf-spellblade', 'Corrupted Elf Spellblade',`${EE}/Elf_Spellblade.glb`,  'character', ['enemy', 'elf', 'mage', 'melee'], 1),
  ],
};

// ── Golem Enemy Pack (Golem_Free.zip) ──────────────────────────

const GE = `${P}/golem-enemies`;

export const GOLEM_ENEMY_PACK: AssetPack = {
  id: 'golem-enemies',
  name: 'Golem Enemies',
  description: 'Crystal and nature golem enemy models',
  basePath: GE,
  texturePath: `${GE}/Textures`,
  assets: [
    gltf('ge-crystal-golem', 'Crystal Golem',  `${GE}/Crystal_Golem.glb`,  'character', ['enemy', 'golem', 'crystal', 'camp'], 1),
    gltf('ge-nature-golem',  'Nature Golem',   `${GE}/Nature_Golem.glb`,   'character', ['enemy', 'golem', 'nature', 'camp'], 1),
    gltf('ge-moss-golem',    'Moss Golem',     `${GE}/Moss_Golem.glb`,     'character', ['enemy', 'golem', 'moss', 'camp'], 1),
  ],
};

// ── SG Environment (general fantasy nature) ────────────────────

const SG = `${P}/sg-environment`;

export const SG_ENVIRONMENT_PACK: AssetPack = {
  id: 'sg-environment',
  name: 'SG Environment',
  description: 'General fantasy environment props — rocks, trees, grass, water',
  basePath: SG,
  texturePath: `${SG}/Textures`,
  assets: [
    fbx('sg-tree-1',   'Fantasy Tree 1',   `${SG}/FBX/Tree_01.fbx`,    'terrain', ['tree', 'fantasy'], 0.02),
    fbx('sg-tree-2',   'Fantasy Tree 2',   `${SG}/FBX/Tree_02.fbx`,    'terrain', ['tree', 'fantasy'], 0.02),
    fbx('sg-rock-1',   'Fantasy Rock 1',   `${SG}/FBX/Rock_01.fbx`,    'terrain', ['rock', 'fantasy'], 0.02),
    fbx('sg-rock-2',   'Fantasy Rock 2',   `${SG}/FBX/Rock_02.fbx`,    'terrain', ['rock', 'fantasy'], 0.02),
    fbx('sg-grass-1',  'Grass Patch 1',    `${SG}/FBX/Grass_01.fbx`,   'terrain', ['grass', 'fantasy'], 0.02),
    fbx('sg-pond',     'Pond',             `${SG}/FBX/Pond.fbx`,       'terrain', ['water', 'pond', 'fantasy'], 0.02),
    fbx('sg-waterfall', 'Waterfall',       `${SG}/FBX/Waterfall.fbx`,  'terrain', ['water', 'waterfall', 'fantasy'], 0.02),
  ],
};

// ── Highland Fantasy Buildings ──────────────────────────────────

const HF = `${P}/highland-buildings`;

export const HIGHLAND_BUILDINGS_PACK: AssetPack = {
  id: 'highland-buildings',
  name: 'Highland Fantasy Buildings',
  description: 'Fantasy highland structures — trading posts, lodges, stables',
  basePath: HF,
  texturePath: `${HF}/Textures`,
  assets: [
    fbx('hf-trading-post',  'Trading Post',     `${HF}/FBX/Trading_Post.fbx`,     'structure', ['building', 'trading', 'highland'], 0.02),
    fbx('hf-lodge',         'Highland Lodge',    `${HF}/FBX/Lodge.fbx`,            'structure', ['building', 'lodge', 'highland'], 0.02),
    fbx('hf-stable',        'Stable',           `${HF}/FBX/Stable.fbx`,           'structure', ['building', 'stable', 'highland'], 0.02),
    fbx('hf-market-stall',  'Market Stall',     `${HF}/FBX/Market_Stall.fbx`,     'structure', ['market', 'stall', 'highland'], 0.02),
    fbx('hf-shrine',        'Highland Shrine',  `${HF}/FBX/Highland_Shrine.fbx`,  'structure', ['shrine', 'highland'], 0.02),
    fbx('hf-well',          'Stone Well',       `${HF}/FBX/Stone_Well.fbx`,       'prop',      ['well', 'highland'], 0.02),
    fbx('hf-fence',         'Wood Fence',       `${HF}/FBX/Wood_Fence.fbx`,       'prop',      ['fence', 'highland'], 0.02),
    fbx('hf-lamp-post',     'Lamp Post',        `${HF}/FBX/Lamp_Post.fbx`,        'prop',      ['light', 'lamp', 'highland'], 0.02),
  ],
};

// ── Combined exports ───────────────────────────────────────────

/** All elf/fabled-zone asset packs */
export const ELF_ASSET_PACKS: AssetPack[] = [
  ENCHANTED_FOREST_PACK,
  ELF_WEAPON_PACK,
  ELF_FORTRESS_PACK,
  ELF_RUNES_PACK,
  ELF_CHARACTER_PACK,
  ELF_ENEMY_PACK,
  GOLEM_ENEMY_PACK,
  SG_ENVIRONMENT_PACK,
  HIGHLAND_BUILDINGS_PACK,
];

/** Quick lookup of all elf-zone asset entries */
export const ELF_ASSET_ENTRIES: AssetEntry[] = ELF_ASSET_PACKS.flatMap(p => p.assets);

/** Get an elf asset by id */
export function getElfAsset(id: string): AssetEntry | undefined {
  return ELF_ASSET_ENTRIES.find(a => a.id === id);
}

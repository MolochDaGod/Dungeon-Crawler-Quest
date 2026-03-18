/**
 * Asset Pack Registry
 * Maps all extracted asset packs to game-usable model paths and categories.
 * Pirate Kit uses glTF (preferred); towns, dungeon, village use FBX; furniture uses FBX.
 */

const P = '/assets/packs';

// ── Types ──────────────────────────────────────────────────────

export interface AssetEntry {
  id: string;
  name: string;
  path: string;
  format: 'gltf' | 'fbx' | 'obj';
  texturePath?: string;
  category: string;
  scale?: number;       // override scale (default 1)
  tags: string[];
}

export interface AssetPack {
  id: string;
  name: string;
  description: string;
  basePath: string;
  texturePath: string;
  assets: AssetEntry[];
}

// ── Helper ─────────────────────────────────────────────────────

function fbx(id: string, name: string, file: string, cat: string, tags: string[], scale?: number): AssetEntry {
  return { id, name, path: file, format: 'fbx', category: cat, tags, scale };
}
function gltf(id: string, name: string, file: string, cat: string, tags: string[], scale?: number): AssetEntry {
  return { id, name, path: file, format: 'gltf', category: cat, tags, scale };
}

// ── Crusade Town ───────────────────────────────────────────────

export const CRUSADETOWN_PACK: AssetPack = {
  id: 'crusadetown',
  name: 'Crusade Town',
  description: 'Medieval crusader fortress with towers, walls, bridges, barracks',
  basePath: `${P}/crusadetown`,
  texturePath: `${P}/crusadetown/texture`,
  assets: [
    // Full assembled pieces
    fbx('ct-fortress', 'Fortress', `${P}/crusadetown/FBX/FULL/_FORTRESS_FULL.fbx`, 'structure', ['fortress', 'castle', 'crusade'], 0.02),
    fbx('ct-tower-01', 'Tower 1', `${P}/crusadetown/FBX/FULL/_tower_01.fbx`, 'structure', ['tower', 'crusade'], 0.02),
    fbx('ct-tower-02', 'Tower 2', `${P}/crusadetown/FBX/FULL/_TOWER_02_1.fbx`, 'structure', ['tower', 'crusade'], 0.02),
    fbx('ct-tower-03', 'Tower 3', `${P}/crusadetown/FBX/FULL/_tower_03_1_full.fbx`, 'structure', ['tower', 'crusade'], 0.02),
    fbx('ct-tower-04', 'Tower 4', `${P}/crusadetown/FBX/FULL/_TOWER_04_FULL.fbx`, 'structure', ['tower', 'crusade'], 0.02),
    fbx('ct-tower-05', 'Tower 5', `${P}/crusadetown/FBX/FULL/_TOWER_05_FULL.fbx`, 'structure', ['tower', 'crusade'], 0.02),
    fbx('ct-wall-01', 'Wall 1', `${P}/crusadetown/FBX/FULL/_WALL_01_FULL.fbx`, 'wall', ['wall', 'crusade'], 0.02),
    fbx('ct-wall-02', 'Wall 2', `${P}/crusadetown/FBX/FULL/_WALL_02_1.fbx`, 'wall', ['wall', 'crusade'], 0.02),
    fbx('ct-bridge', 'Bridge', `${P}/crusadetown/FBX/FULL/_BRIDGE_FULL.fbx`, 'structure', ['bridge', 'crusade'], 0.02),
    fbx('ct-fence', 'Fence', `${P}/crusadetown/FBX/FULL/_FENSE_FYULL.fbx`, 'prop', ['fence', 'crusade'], 0.02),
    fbx('ct-stairs', 'Stairs', `${P}/crusadetown/FBX/FULL/_STAIRS_FULL1.fbx`, 'prop', ['stairs', 'crusade'], 0.02),
    fbx('ct-props', 'Props', `${P}/crusadetown/FBX/FULL/_PROPS_FULL.fbx`, 'prop', ['props', 'crusade'], 0.02),
    fbx('ct-barracks', 'Barracks', `${P}/crusadetown/FBX/FULL/_BARRACKS.fbx`, 'structure', ['building', 'barracks', 'crusade'], 0.02),
    fbx('ct-armory', 'Armory', `${P}/crusadetown/FBX/FULL/_AMMOURRY.fbx`, 'structure', ['building', 'armory', 'crusade'], 0.02),
    fbx('ct-brazier', 'Brazier', `${P}/crusadetown/FBX/FULL/_BRAZIER.fbx`, 'prop', ['light', 'fire', 'crusade'], 0.02),
    fbx('ct-firebell', 'Fire Bell', `${P}/crusadetown/FBX/FULL/_FIRE_BELL.fbx`, 'prop', ['bell', 'alarm', 'crusade'], 0.02),
    fbx('ct-firewoods', 'Firewoods', `${P}/crusadetown/FBX/FULL/_FIREWOODS.fbx`, 'prop', ['fire', 'camp', 'crusade'], 0.02),
    fbx('ct-gates-1', 'Minor Gates 1', `${P}/crusadetown/FBX/FULL/_Minnor_gates_01.fbx`, 'structure', ['gate', 'crusade'], 0.02),
    fbx('ct-gates-2', 'Minor Gates 2', `${P}/crusadetown/FBX/FULL/_minnor_gates_02.fbx`, 'structure', ['gate', 'crusade'], 0.02),
    fbx('ct-sentry', 'Sentry Hut', `${P}/crusadetown/FBX/FULL/_SENTRY_HURT.fbx`, 'structure', ['sentry', 'crusade'], 0.02),
  ],
};

// ── Fabled Town ────────────────────────────────────────────────

export const FABLEDTOWN_PACK: AssetPack = {
  id: 'fabledtown',
  name: 'Fabled Town',
  description: 'Fantasy town with mystical architecture, towers, bridges',
  basePath: `${P}/fabledtown`,
  texturePath: `${P}/fabledtown/texture`,
  assets: [
    fbx('ft-fortress', 'Fortress', `${P}/fabledtown/fbx/full/fortress_full.fbx`, 'structure', ['fortress', 'fabled'], 0.02),
    fbx('ft-tower-1', 'Tower 1', `${P}/fabledtown/fbx/full/_TOWER_1.fbx`, 'structure', ['tower', 'fabled'], 0.02),
    fbx('ft-tower-2', 'Tower 2', `${P}/fabledtown/fbx/full/_TOWER_2.fbx`, 'structure', ['tower', 'fabled'], 0.02),
    fbx('ft-tower-3', 'Tower 3', `${P}/fabledtown/fbx/full/tower_3_full.fbx`, 'structure', ['tower', 'fabled'], 0.02),
    fbx('ft-tower-4', 'Tower 4', `${P}/fabledtown/fbx/full/tower_4_full.fbx`, 'structure', ['tower', 'fabled'], 0.02),
    fbx('ft-tower-5', 'Tower 5', `${P}/fabledtown/fbx/full/tower_5_full.fbx`, 'structure', ['tower', 'fabled'], 0.02),
    fbx('ft-wall-1', 'Wall 1', `${P}/fabledtown/fbx/full/wall_1_full.fbx`, 'wall', ['wall', 'fabled'], 0.02),
    fbx('ft-wall-2', 'Wall 2', `${P}/fabledtown/fbx/full/_wall_2.fbx`, 'wall', ['wall', 'fabled'], 0.02),
    fbx('ft-bridge', 'Bridge', `${P}/fabledtown/fbx/full/bridge_full.fbx`, 'structure', ['bridge', 'fabled'], 0.02),
    fbx('ft-fence', 'Fence', `${P}/fabledtown/fbx/full/fense_full.fbx`, 'prop', ['fence', 'fabled'], 0.02),
    fbx('ft-stairs', 'Stairs', `${P}/fabledtown/fbx/full/stairs_full.fbx`, 'prop', ['stairs', 'fabled'], 0.02),
    fbx('ft-props', 'Props', `${P}/fabledtown/fbx/full/props_full.fbx`, 'prop', ['props', 'fabled'], 0.02),
    fbx('ft-arsenal', 'Arsenal', `${P}/fabledtown/fbx/full/_arsenal_1.fbx`, 'structure', ['building', 'arsenal', 'fabled'], 0.02),
    fbx('ft-barracks', 'Barracks', `${P}/fabledtown/fbx/full/_kazarm_1.fbx`, 'structure', ['building', 'barracks', 'fabled'], 0.02),
    fbx('ft-brazier', 'Brazier', `${P}/fabledtown/fbx/full/_BRAZIER_1.fbx`, 'prop', ['light', 'fire', 'fabled'], 0.02),
    fbx('ft-andiron', 'Andiron', `${P}/fabledtown/fbx/full/_andiron1.fbx`, 'prop', ['fire', 'fabled'], 0.02),
    fbx('ft-firebell', 'Fire Bell', `${P}/fabledtown/fbx/full/_fire_bell_1.fbx`, 'prop', ['bell', 'alarm', 'fabled'], 0.02),
    fbx('ft-watchtower', 'Watchtower', `${P}/fabledtown/fbx/full/_watchtoer_1.fbx`, 'structure', ['tower', 'watch', 'fabled'], 0.02),
    fbx('ft-gates-1', 'Minor Gates 1', `${P}/fabledtown/fbx/full/_minnor_gates_2.fbx`, 'structure', ['gate', 'fabled'], 0.02),
    fbx('ft-gates-2', 'Minor Gates 2', `${P}/fabledtown/fbx/full/_minnor_gates_4.fbx`, 'structure', ['gate', 'fabled'], 0.02),
  ],
};

// ── Legion Town ────────────────────────────────────────────────

export const LEGIONTOWN_PACK: AssetPack = {
  id: 'legiontown',
  name: 'Legion Town',
  description: 'Military legion outpost with drum towers, arsenal, barracks',
  basePath: `${P}/legiontown`,
  texturePath: `${P}/legiontown/TEXTURE`,
  assets: [
    fbx('lt-fortress', 'Fortress', `${P}/legiontown/FBX/full/FORTRESS_FULL.fbx`, 'structure', ['fortress', 'legion'], 0.02),
    fbx('lt-tower-01', 'Tower 1', `${P}/legiontown/FBX/full/_TOWER_01.fbx`, 'structure', ['tower', 'legion'], 0.02),
    fbx('lt-tower-02', 'Tower 2', `${P}/legiontown/FBX/full/_TOWER_02.fbx`, 'structure', ['tower', 'legion'], 0.02),
    fbx('lt-tower-3', 'Tower 3', `${P}/legiontown/FBX/full/TOWER_3_FULL.fbx`, 'structure', ['tower', 'legion'], 0.02),
    fbx('lt-tower-4', 'Tower 4', `${P}/legiontown/FBX/full/TOWER_4_FULL.fbx`, 'structure', ['tower', 'legion'], 0.02),
    fbx('lt-tower-5', 'Tower 5', `${P}/legiontown/FBX/full/TOWER_5_FULL.fbx`, 'structure', ['tower', 'legion'], 0.02),
    fbx('lt-wall-1', 'Wall 1', `${P}/legiontown/FBX/full/WALL_1_FULL.fbx`, 'wall', ['wall', 'legion'], 0.02),
    fbx('lt-wall-2', 'Wall 2', `${P}/legiontown/FBX/full/_WALL_2_01.fbx`, 'wall', ['wall', 'legion'], 0.02),
    fbx('lt-bridge', 'Bridge', `${P}/legiontown/FBX/full/BRIDGE_FULL.fbx`, 'structure', ['bridge', 'legion'], 0.02),
    fbx('lt-fence', 'Fence', `${P}/legiontown/FBX/full/FENSE_FULL.fbx`, 'prop', ['fence', 'legion'], 0.02),
    fbx('lt-stairs', 'Stairs', `${P}/legiontown/FBX/full/STAIRS_FULL.fbx`, 'prop', ['stairs', 'legion'], 0.02),
    fbx('lt-props', 'Props', `${P}/legiontown/FBX/full/PROPS_FULL.fbx`, 'prop', ['props', 'legion'], 0.02),
    fbx('lt-barracks', 'Barracks', `${P}/legiontown/FBX/full/_BARRACKS.fbx`, 'structure', ['building', 'barracks', 'legion'], 0.02),
    fbx('lt-arsenal', 'Arsenal', `${P}/legiontown/FBX/full/_ARSENAL.fbx`, 'structure', ['building', 'arsenal', 'legion'], 0.02),
    fbx('lt-brazier', 'Brazier', `${P}/legiontown/FBX/full/_BRAZIER_01.fbx`, 'prop', ['light', 'fire', 'legion'], 0.02),
    fbx('lt-drum', 'Alarm Drum', `${P}/legiontown/FBX/full/_ALARM_DRUM.fbx`, 'prop', ['drum', 'alarm', 'legion'], 0.02),
    fbx('lt-firewoods', 'Firewoods', `${P}/legiontown/FBX/full/_FIREWOODS.fbx`, 'prop', ['fire', 'camp', 'legion'], 0.02),
    fbx('lt-shed', 'Shed', `${P}/legiontown/FBX/full/_SHED_01.fbx`, 'structure', ['building', 'shed', 'legion'], 0.02),
    fbx('lt-gates-1', 'Minor Gates 1', `${P}/legiontown/FBX/full/_MINNOR_GATES_01.fbx`, 'structure', ['gate', 'legion'], 0.02),
    fbx('lt-gates-2', 'Minor Gates 2', `${P}/legiontown/FBX/full/_MINNOR_GATES_02.fbx`, 'structure', ['gate', 'legion'], 0.02),
  ],
};

// ── Boss Graveyard ─────────────────────────────────────────────

export const BOSSGRAVEYARD_PACK: AssetPack = {
  id: 'bossgraveyard',
  name: 'Boss Graveyard',
  description: 'Ruined graveyard arena for world boss encounters',
  basePath: `${P}/bossgraveyard`,
  texturePath: `${P}/bossgraveyard/texture`,
  assets: Array.from({ length: 21 }, (_, i) =>
    fbx(`bg-ruin-${i + 1}`, `Ruin ${i + 1}`, `${P}/bossgraveyard/fbx/_ruin_${i + 1}.fbx`, 'ruin', ['ruin', 'graveyard', 'boss'], 0.02)
  ),
};

// ── Pirate Kit ─────────────────────────────────────────────────

export const PIRATE_PACK: AssetPack = {
  id: 'pirate-kit',
  name: 'Pirate Kit',
  description: 'Ships, docks, pirate characters, weapons, tropical environment',
  basePath: `${P}/pirate-kit`,
  texturePath: `${P}/pirate-kit/Pirate Kit - Nov 2023`,
  assets: [
    // Ships
    gltf('pk-ship-large', 'Large Ship', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Ship_Large.gltf`, 'ship', ['ship', 'boat', 'pirate'], 0.5),
    gltf('pk-ship-small', 'Small Ship', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Ship_Small.gltf`, 'ship', ['ship', 'boat', 'pirate'], 0.5),
    // Characters
    gltf('pk-captain', 'Captain Barbarossa', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Captain_Barbarossa.gltf`, 'character', ['npc', 'pirate', 'captain']),
    gltf('pk-anne', 'Anne', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Anne.gltf`, 'character', ['npc', 'pirate']),
    gltf('pk-henry', 'Henry', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Henry.gltf`, 'character', ['npc', 'pirate']),
    gltf('pk-mako', 'Mako', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Mako.gltf`, 'character', ['npc', 'pirate', 'shark']),
    gltf('pk-skeleton', 'Skeleton Pirate', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Skeleton.gltf`, 'character', ['enemy', 'skeleton', 'pirate']),
    gltf('pk-skeleton-headless', 'Headless Skeleton', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Skeleton_Headless.gltf`, 'character', ['enemy', 'skeleton', 'pirate']),
    gltf('pk-shark', 'Shark', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Shark.gltf`, 'character', ['enemy', 'shark', 'sea']),
    gltf('pk-sharky', 'Sharky', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Sharky.gltf`, 'character', ['enemy', 'shark', 'sea']),
    gltf('pk-tentacle', 'Tentacle', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Characters_Tentacle.gltf`, 'character', ['enemy', 'kraken', 'sea']),
    gltf('pk-enemy-tentacle', 'Enemy Tentacle', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Enemy_Tentacle.gltf`, 'character', ['enemy', 'kraken', 'sea']),
    // Environment
    gltf('pk-dock', 'Dock', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Dock.gltf`, 'structure', ['dock', 'pirate', 'port']),
    gltf('pk-dock-broken', 'Broken Dock', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Dock_Broken.gltf`, 'structure', ['dock', 'pirate', 'ruined']),
    gltf('pk-dock-pole', 'Dock Pole', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Dock_Pole.gltf`, 'prop', ['dock', 'pirate']),
    gltf('pk-house-1', 'Pirate House 1', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_House1.gltf`, 'structure', ['building', 'house', 'pirate']),
    gltf('pk-house-2', 'Pirate House 2', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_House2.gltf`, 'structure', ['building', 'house', 'pirate']),
    gltf('pk-house-3', 'Pirate House 3', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_House3.gltf`, 'structure', ['building', 'house', 'pirate']),
    gltf('pk-sawmill', 'Sawmill', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Sawmill.gltf`, 'structure', ['building', 'pirate']),
    gltf('pk-cliff-1', 'Cliff 1', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Cliff1.gltf`, 'terrain', ['cliff', 'pirate', 'island']),
    gltf('pk-cliff-2', 'Cliff 2', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Cliff2.gltf`, 'terrain', ['cliff', 'pirate', 'island']),
    gltf('pk-cliff-3', 'Cliff 3', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Cliff3.gltf`, 'terrain', ['cliff', 'pirate', 'island']),
    gltf('pk-cliff-4', 'Cliff 4', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Cliff4.gltf`, 'terrain', ['cliff', 'pirate', 'island']),
    gltf('pk-palm-1', 'Palm Tree 1', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_PalmTree_1.gltf`, 'vegetation', ['tree', 'palm', 'tropical']),
    gltf('pk-palm-2', 'Palm Tree 2', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_PalmTree_2.gltf`, 'vegetation', ['tree', 'palm', 'tropical']),
    gltf('pk-palm-3', 'Palm Tree 3', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_PalmTree_3.gltf`, 'vegetation', ['tree', 'palm', 'tropical']),
    gltf('pk-rock-1', 'Rock 1', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Rock_1.gltf`, 'terrain', ['rock', 'island']),
    gltf('pk-rock-2', 'Rock 2', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Rock_2.gltf`, 'terrain', ['rock', 'island']),
    gltf('pk-bones', 'Large Bones', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_LargeBones.gltf`, 'prop', ['bones', 'graveyard', 'pirate']),
    gltf('pk-skulls', 'Skulls', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Environment_Skulls.gltf`, 'prop', ['skulls', 'pirate']),
    // Props
    gltf('pk-cannon', 'Cannon', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Cannon.gltf`, 'prop', ['weapon', 'cannon', 'pirate']),
    gltf('pk-anchor', 'Anchor', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Anchor.gltf`, 'prop', ['anchor', 'ship', 'pirate']),
    gltf('pk-barrel', 'Barrel', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Barrel.gltf`, 'prop', ['barrel', 'container', 'pirate']),
    gltf('pk-chest-closed', 'Chest Closed', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Chest_Closed.gltf`, 'prop', ['chest', 'loot', 'pirate']),
    gltf('pk-chest-gold', 'Chest Gold', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Chest_Gold.gltf`, 'prop', ['chest', 'loot', 'treasure', 'pirate']),
    gltf('pk-bomb', 'Bomb', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Bomb.gltf`, 'prop', ['bomb', 'explosive', 'pirate']),
    gltf('pk-bucket', 'Bucket', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Bucket.gltf`, 'prop', ['bucket', 'pirate']),
    gltf('pk-bucket-fish', 'Bucket of Fish', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Bucket_Fishes.gltf`, 'prop', ['bucket', 'fish', 'pirate']),
    gltf('pk-coins', 'Coins', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_Coins.gltf`, 'prop', ['coins', 'gold', 'pirate']),
    gltf('pk-goldbag', 'Gold Bag', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Prop_GoldBag.gltf`, 'prop', ['gold', 'loot', 'pirate']),
    // Weapons
    gltf('pk-cutlass', 'Cutlass', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Cutlass.gltf`, 'weapon', ['sword', 'cutlass', 'pirate']),
    gltf('pk-dagger', 'Pirate Dagger', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Dagger.gltf`, 'weapon', ['dagger', 'pirate']),
    gltf('pk-axe', 'Pirate Axe', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Axe.gltf`, 'weapon', ['axe', 'pirate']),
    gltf('pk-pistol', 'Pistol', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Pistol.gltf`, 'weapon', ['gun', 'pistol', 'pirate']),
    gltf('pk-rifle', 'Rifle', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Rifle.gltf`, 'weapon', ['gun', 'rifle', 'pirate']),
    gltf('pk-sword-1', 'Pirate Sword 1', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Sword_1.gltf`, 'weapon', ['sword', 'pirate']),
    gltf('pk-sword-2', 'Pirate Sword 2', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Sword_2.gltf`, 'weapon', ['sword', 'pirate']),
    gltf('pk-lute', 'Lute', `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF/Weapon_Lute.gltf`, 'weapon', ['instrument', 'lute', 'pirate']),
  ],
};

// ── Medieval Village ───────────────────────────────────────────

const MV = `${P}/medieval-village/Medieval Village Pack - Dec 2020`;

export const MEDIEVAL_VILLAGE_PACK: AssetPack = {
  id: 'medieval-village',
  name: 'Medieval Village',
  description: 'Village buildings, shops, and props for town centers',
  basePath: MV,
  texturePath: MV,
  assets: [
    // Buildings
    fbx('mv-bell-tower', 'Bell Tower', `${MV}/Buildings/FBX/Bell_Tower.fbx`, 'structure', ['building', 'tower', 'village'], 0.02),
    fbx('mv-blacksmith', 'Blacksmith', `${MV}/Buildings/FBX/Blacksmith.fbx`, 'structure', ['building', 'shop', 'smith', 'village'], 0.02),
    fbx('mv-house-1', 'House 1', `${MV}/Buildings/FBX/House_1.fbx`, 'structure', ['building', 'house', 'village'], 0.02),
    fbx('mv-house-2', 'House 2', `${MV}/Buildings/FBX/House_2.fbx`, 'structure', ['building', 'house', 'village'], 0.02),
    fbx('mv-house-3', 'House 3', `${MV}/Buildings/FBX/House_3.fbx`, 'structure', ['building', 'house', 'village'], 0.02),
    fbx('mv-house-4', 'House 4', `${MV}/Buildings/FBX/House_4.fbx`, 'structure', ['building', 'house', 'village'], 0.02),
    fbx('mv-inn', 'Inn', `${MV}/Buildings/FBX/Inn.fbx`, 'structure', ['building', 'inn', 'tavern', 'village'], 0.02),
    fbx('mv-mill', 'Mill', `${MV}/Buildings/FBX/Mill.fbx`, 'structure', ['building', 'mill', 'village'], 0.02),
    fbx('mv-sawmill', 'Sawmill', `${MV}/Buildings/FBX/Sawmill.fbx`, 'structure', ['building', 'sawmill', 'village'], 0.02),
    fbx('mv-stable', 'Stable', `${MV}/Buildings/FBX/Stable.fbx`, 'structure', ['building', 'stable', 'village'], 0.02),
    // Props
    fbx('mv-barrel', 'Barrel', `${MV}/Props/FBX/Barrel.fbx`, 'prop', ['barrel', 'container', 'village'], 0.02),
    fbx('mv-bench-1', 'Bench 1', `${MV}/Props/FBX/Bench_1.fbx`, 'prop', ['bench', 'seat', 'village'], 0.02),
    fbx('mv-bench-2', 'Bench 2', `${MV}/Props/FBX/Bench_2.fbx`, 'prop', ['bench', 'seat', 'village'], 0.02),
    fbx('mv-bonfire', 'Bonfire', `${MV}/Props/FBX/Bonfire_Lit.fbx`, 'prop', ['fire', 'camp', 'village'], 0.02),
    fbx('mv-cart', 'Cart', `${MV}/Props/FBX/Cart.fbx`, 'prop', ['cart', 'transport', 'village'], 0.02),
    fbx('mv-cauldron', 'Cauldron', `${MV}/Props/FBX/Cauldron.fbx`, 'prop', ['cauldron', 'cooking', 'village'], 0.02),
    fbx('mv-crate', 'Crate', `${MV}/Props/FBX/Crate.fbx`, 'prop', ['crate', 'container', 'village'], 0.02),
    fbx('mv-fence', 'Fence', `${MV}/Props/FBX/Fence.fbx`, 'prop', ['fence', 'village'], 0.02),
    fbx('mv-gazebo', 'Gazebo', `${MV}/Props/FBX/Gazebo.fbx`, 'structure', ['gazebo', 'village'], 0.02),
    fbx('mv-hay', 'Hay', `${MV}/Props/FBX/Hay.fbx`, 'prop', ['hay', 'farm', 'village'], 0.02),
    fbx('mv-market-1', 'Market Stand 1', `${MV}/Props/FBX/MarketStand_1.fbx`, 'prop', ['market', 'shop', 'village'], 0.02),
    fbx('mv-market-2', 'Market Stand 2', `${MV}/Props/FBX/MarketStand_2.fbx`, 'prop', ['market', 'shop', 'village'], 0.02),
    fbx('mv-stairs', 'Stairs', `${MV}/Props/FBX/Stairs.fbx`, 'prop', ['stairs', 'village'], 0.02),
    fbx('mv-well', 'Well', `${MV}/Props/FBX/Well.fbx`, 'prop', ['well', 'water', 'village'], 0.02),
    fbx('mv-rock-1', 'Rock 1', `${MV}/Props/FBX/Rock_1.fbx`, 'terrain', ['rock', 'village'], 0.02),
    fbx('mv-rock-2', 'Rock 2', `${MV}/Props/FBX/Rock_2.fbx`, 'terrain', ['rock', 'village'], 0.02),
    fbx('mv-rock-3', 'Rock 3', `${MV}/Props/FBX/Rock_3.fbx`, 'terrain', ['rock', 'village'], 0.02),
  ],
};

// ── Modular Dungeon ────────────────────────────────────────────

const MD = `${P}/modular-dungeon/Modular Dungeon Pack - Jan 2018`;

export const MODULAR_DUNGEON_PACK: AssetPack = {
  id: 'modular-dungeon',
  name: 'Modular Dungeon',
  description: 'Modular dungeon pieces: walls, floors, columns, props',
  basePath: MD,
  texturePath: MD,
  assets: [
    // Structural
    fbx('md-floor', 'Floor', `${MD}/FBX/ModularFloor.fbx`, 'dungeon-structure', ['floor', 'dungeon'], 0.02),
    fbx('md-wall', 'Stone Wall', `${MD}/FBX/ModularStoneWall.fbx`, 'dungeon-structure', ['wall', 'dungeon'], 0.02),
    fbx('md-wall-top', 'Stone Wall Top', `${MD}/FBX/ModularStoneWall_top.fbx`, 'dungeon-structure', ['wall', 'dungeon'], 0.02),
    fbx('md-wall-entrance', 'Wall Entrance', `${MD}/FBX/ModularStoneWall_EntranceTop.fbx`, 'dungeon-structure', ['wall', 'entrance', 'dungeon'], 0.02),
    fbx('md-column', 'Column', `${MD}/FBX/Column.fbx`, 'dungeon-structure', ['column', 'pillar', 'dungeon'], 0.02),
    fbx('md-column-broken', 'Broken Column', `${MD}/FBX/Column_Broken.fbx`, 'dungeon-structure', ['column', 'ruined', 'dungeon'], 0.02),
    fbx('md-column-broken2', 'Broken Column 2', `${MD}/FBX/Column_Broken2.fbx`, 'dungeon-structure', ['column', 'ruined', 'dungeon'], 0.02),
    fbx('md-col-bottom', 'Column Bottom', `${MD}/FBX/ModularColumn_bottom.fbx`, 'dungeon-structure', ['column', 'dungeon'], 0.02),
    fbx('md-col-middle', 'Column Middle', `${MD}/FBX/ModularColumn_middle.fbx`, 'dungeon-structure', ['column', 'dungeon'], 0.02),
    fbx('md-col-top', 'Column Top', `${MD}/FBX/ModularColumn_top.fbx`, 'dungeon-structure', ['column', 'dungeon'], 0.02),
    fbx('md-entrance', 'Entrance', `${MD}/FBX/Entrance.fbx`, 'dungeon-structure', ['entrance', 'door', 'dungeon'], 0.02),
    fbx('md-entrance2', 'Entrance 2', `${MD}/FBX/Entrance2.fbx`, 'dungeon-structure', ['entrance', 'door', 'dungeon'], 0.02),
    fbx('md-stairs', 'Dungeon Stairs', `${MD}/FBX/Stairs.fbx`, 'dungeon-structure', ['stairs', 'dungeon'], 0.02),
    fbx('md-window', 'Window', `${MD}/FBX/Window.fbx`, 'dungeon-structure', ['window', 'dungeon'], 0.02),
    fbx('md-wall-rocks', 'Wall Rocks', `${MD}/FBX/WallRocks.fbx`, 'dungeon-structure', ['rock', 'wall', 'dungeon'], 0.02),
    // Props
    fbx('md-barrel', 'Barrel', `${MD}/FBX/Barrel.fbx`, 'prop', ['barrel', 'container', 'dungeon'], 0.02),
    fbx('md-bars', 'Bars', `${MD}/FBX/Bars.fbx`, 'prop', ['bars', 'prison', 'dungeon'], 0.02),
    fbx('md-bones', 'Bones', `${MD}/FBX/Bones.fbx`, 'prop', ['bones', 'skeleton', 'dungeon'], 0.02),
    fbx('md-bones2', 'Bones 2', `${MD}/FBX/Bones2.fbx`, 'prop', ['bones', 'skeleton', 'dungeon'], 0.02),
    fbx('md-chest', 'Chest', `${MD}/FBX/Chest.fbx`, 'prop', ['chest', 'loot', 'dungeon'], 0.02),
    fbx('md-chest-gold', 'Gold Chest', `${MD}/FBX/Chest_gold.fbx`, 'prop', ['chest', 'treasure', 'dungeon'], 0.02),
    fbx('md-carpet', 'Carpet', `${MD}/FBX/Carpet.fbx`, 'prop', ['carpet', 'decoration', 'dungeon'], 0.02),
    fbx('md-candelabrum', 'Candelabrum', `${MD}/FBX/Candelabrum.fbx`, 'prop', ['light', 'candle', 'dungeon'], 0.02),
    fbx('md-candelabrum-tall', 'Tall Candelabrum', `${MD}/FBX/Candelabrum_tall.fbx`, 'prop', ['light', 'candle', 'dungeon'], 0.02),
    fbx('md-candle', 'Candle', `${MD}/FBX/Candle.fbx`, 'prop', ['light', 'candle', 'dungeon'], 0.02),
    fbx('md-torch', 'Torch', `${MD}/FBX/Torch.fbx`, 'prop', ['light', 'torch', 'dungeon'], 0.02),
    fbx('md-torch-wall', 'Wall Torch', `${MD}/FBX/Torch_wall.fbx`, 'prop', ['light', 'torch', 'wall', 'dungeon'], 0.02),
    fbx('md-book-open', 'Open Book', `${MD}/FBX/Book_Open.fbx`, 'prop', ['book', 'lore', 'dungeon'], 0.02),
    fbx('md-book2', 'Book 2', `${MD}/FBX/Book2.fbx`, 'prop', ['book', 'lore', 'dungeon'], 0.02),
    fbx('md-book3', 'Book 3', `${MD}/FBX/Book3.fbx`, 'prop', ['book', 'lore', 'dungeon'], 0.02),
    // Potions
    fbx('md-potion-1', 'Potion 1', `${MD}/FBX/Potion.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    fbx('md-potion-2', 'Potion 2', `${MD}/FBX/Potion2.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    fbx('md-potion-3', 'Potion 3', `${MD}/FBX/Potion3.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    fbx('md-potion-4', 'Potion 4', `${MD}/FBX/Potion4.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    fbx('md-potion-5', 'Potion 5', `${MD}/FBX/Potion5.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    fbx('md-potion-6', 'Potion 6', `${MD}/FBX/Potion6.fbx`, 'prop', ['potion', 'consumable', 'dungeon'], 0.02),
    // Rocks
    fbx('md-rock-1', 'Rock 1', `${MD}/FBX/Rock1.fbx`, 'terrain', ['rock', 'dungeon'], 0.02),
    fbx('md-rock-2', 'Rock 2', `${MD}/FBX/Rock2.fbx`, 'terrain', ['rock', 'dungeon'], 0.02),
    fbx('md-rock-3', 'Rock 3', `${MD}/FBX/Rock3.fbx`, 'terrain', ['rock', 'dungeon'], 0.02),
    fbx('md-rock-4', 'Rock 4', `${MD}/FBX/Rock4.fbx`, 'terrain', ['rock', 'dungeon'], 0.02),
    fbx('md-rock-5', 'Rock 5', `${MD}/FBX/Rock5.fbx`, 'terrain', ['rock', 'dungeon'], 0.02),
  ],
};

// ── Furniture ──────────────────────────────────────────────────

const FN = `${P}/furniture/Furniture Pack - Oct 2017`;

export const FURNITURE_PACK: AssetPack = {
  id: 'furniture',
  name: 'Furniture',
  description: 'Interior furniture for buildings: beds, tables, chairs, bookcases',
  basePath: FN,
  texturePath: FN,
  assets: [
    fbx('fn-bed', 'Bed', `${FN}/FBX/Bed.fbx`, 'furniture', ['bed', 'bedroom'], 0.02),
    fbx('fn-bed-king', 'King Bed', `${FN}/FBX/BedKing.fbx`, 'furniture', ['bed', 'bedroom', 'royal'], 0.02),
    fbx('fn-bookcase', 'Bookcase', `${FN}/FBX/BookCase.fbx`, 'furniture', ['bookcase', 'library'], 0.02),
    fbx('fn-bookcase-books', 'Bookcase (Books)', `${FN}/FBX/BookCaseBooks.fbx`, 'furniture', ['bookcase', 'library', 'books'], 0.02),
    fbx('fn-bookcase-lg', 'Large Bookcase', `${FN}/FBX/BookCaseLarge.fbx`, 'furniture', ['bookcase', 'library'], 0.02),
    fbx('fn-bookcase-lg-books', 'Large Bookcase (Books)', `${FN}/FBX/BookCaseLargeBooks.fbx`, 'furniture', ['bookcase', 'library', 'books'], 0.02),
    fbx('fn-chair', 'Chair', `${FN}/FBX/Chair.fbx`, 'furniture', ['chair', 'seat'], 0.02),
    fbx('fn-chair-cushion', 'Cushioned Chair', `${FN}/FBX/ChairCushioned.fbx`, 'furniture', ['chair', 'seat', 'royal'], 0.02),
    fbx('fn-chair-handle', 'Chair with Handles', `${FN}/FBX/ChairHandle.fbx`, 'furniture', ['chair', 'seat'], 0.02),
    fbx('fn-closet', 'Closet', `${FN}/FBX/Closet.fbx`, 'furniture', ['closet', 'storage'], 0.02),
    fbx('fn-closet2', 'Closet 2', `${FN}/FBX/Closet2.fbx`, 'furniture', ['closet', 'storage'], 0.02),
    fbx('fn-coffee-table', 'Coffee Table', `${FN}/FBX/CoffeeTable.fbx`, 'furniture', ['table'], 0.02),
    fbx('fn-coffee-table2', 'Coffee Table 2', `${FN}/FBX/CoffeeTable2.fbx`, 'furniture', ['table'], 0.02),
    fbx('fn-lamp', 'Lamp', `${FN}/FBX/Lamp.fbx`, 'furniture', ['lamp', 'light'], 0.02),
    fbx('fn-lamp2', 'Lamp 2', `${FN}/FBX/Lamp2.fbx`, 'furniture', ['lamp', 'light'], 0.02),
    fbx('fn-plant', 'Plant', `${FN}/FBX/Plant.fbx`, 'furniture', ['plant', 'decoration'], 0.02),
    fbx('fn-sofa', 'Sofa', `${FN}/FBX/Sofa.fbx`, 'furniture', ['sofa', 'seat'], 0.02),
    fbx('fn-sofa-double', 'Double Sofa', `${FN}/FBX/SofaDouble.fbx`, 'furniture', ['sofa', 'seat'], 0.02),
    fbx('fn-sofa-long', 'Long Sofa', `${FN}/FBX/SofaLong.fbx`, 'furniture', ['sofa', 'seat'], 0.02),
    fbx('fn-stool', 'Stool', `${FN}/FBX/Stool.fbx`, 'furniture', ['stool', 'seat'], 0.02),
    fbx('fn-table', 'Table', `${FN}/FBX/Table.fbx`, 'furniture', ['table'], 0.02),
    fbx('fn-vase', 'Vase', `${FN}/FBX/Vase.fbx`, 'furniture', ['vase', 'decoration'], 0.02),
    fbx('fn-vase2', 'Vase 2', `${FN}/FBX/Vase2.fbx`, 'furniture', ['vase', 'decoration'], 0.02),
  ],
};

// ── Orc Settlement (Piglin Outpost town) ───────────────────────

const OS = `${P}/orc-settlement/fbx/full`;

export const ORC_SETTLEMENT_PACK: AssetPack = {
  id: 'orc-settlement',
  name: 'Orc Settlement',
  description: 'Orcish village structures for the Piglin Outpost',
  basePath: `${P}/orc-settlement`,
  texturePath: `${P}/orc-settlement/texture`,
  assets: [
    fbx('os-tavern', 'Tavern', `${OS}/tavern.fbx`, 'structure', ['building', 'tavern', 'orc'], 0.02),
    fbx('os-smithy', 'Smithy', `${OS}/smithy.fbx`, 'structure', ['building', 'smith', 'orc'], 0.02),
    fbx('os-brewery', 'Brewery', `${OS}/brewery.fbx`, 'structure', ['building', 'brewery', 'orc'], 0.02),
    fbx('os-bakery', 'Bakery', `${OS}/bakery.fbx`, 'structure', ['building', 'bakery', 'orc'], 0.02),
    fbx('os-herbalist', 'Herbalist Hut', `${OS}/herbalist_hut.fbx`, 'structure', ['building', 'herbalist', 'orc'], 0.02),
    fbx('os-prison', 'Prison', `${OS}/prison.fbx`, 'structure', ['building', 'prison', 'orc'], 0.02),
    fbx('os-huts', 'Huts', `${OS}/huts.fbx`, 'structure', ['building', 'hut', 'orc'], 0.02),
    fbx('os-alchemist', 'Alchemist House', `${OS}/alhemisht_house.fbx`, 'structure', ['building', 'alchemist', 'orc'], 0.02),
    fbx('os-bridge', 'Bridge', `${OS}/bridge_full.fbx`, 'structure', ['bridge', 'orc'], 0.02),
    fbx('os-tent-1', 'Tent 1', `${OS}/tent_1.fbx`, 'structure', ['tent', 'camp', 'orc'], 0.02),
    fbx('os-tent-2', 'Tent 2', `${OS}/tent_2.fbx`, 'structure', ['tent', 'camp', 'orc'], 0.02),
    fbx('os-fountain-1', 'Fountain 1', `${OS}/fontan_1.fbx`, 'prop', ['fountain', 'orc'], 0.02),
    fbx('os-fountain-2', 'Fountain 2', `${OS}/fontan_2.fbx`, 'prop', ['fountain', 'orc'], 0.02),
    fbx('os-statue-1', 'Statue 1', `${OS}/statue_1.fbx`, 'prop', ['statue', 'orc'], 0.02),
    fbx('os-statue-2', 'Statue 2', `${OS}/statue_2.fbx`, 'prop', ['statue', 'orc'], 0.02),
    fbx('os-lamp-1', 'Lamp 1', `${OS}/lamP_1.fbx`, 'prop', ['light', 'lamp', 'orc'], 0.02),
    fbx('os-lamp-2', 'Lamp 2', `${OS}/lamp_2.fbx`, 'prop', ['light', 'lamp', 'orc'], 0.02),
    fbx('os-counter', 'Counter', `${OS}/counter.fbx`, 'prop', ['counter', 'shop', 'orc'], 0.02),
    fbx('os-pointer', 'Pointer Sign', `${OS}/pointer.fbx`, 'prop', ['sign', 'orc'], 0.02),
  ],
};

// ── Orc Fortress (Piglin Outpost walls/towers) ─────────────────

const OF = `${P}/orc-fortress/FBX/full`;

export const ORC_FORTRESS_PACK: AssetPack = {
  id: 'orc-fortress',
  name: 'Orc Fortress',
  description: 'Military orc fortress for Piglin Outpost defenses',
  basePath: `${P}/orc-fortress`,
  texturePath: `${P}/orc-fortress/TEXTURE`,
  assets: [
    fbx('of-fortress', 'Fortress', `${OF}/FORTRESS_FULL.fbx`, 'structure', ['fortress', 'orc'], 0.02),
    fbx('of-tower-1', 'Tower 1', `${OF}/_TOWER_01.fbx`, 'structure', ['tower', 'orc'], 0.02),
    fbx('of-tower-2', 'Tower 2', `${OF}/_TOWER_02.fbx`, 'structure', ['tower', 'orc'], 0.02),
    fbx('of-tower-3', 'Tower 3', `${OF}/TOWER_3_FULL.fbx`, 'structure', ['tower', 'orc'], 0.02),
    fbx('of-tower-4', 'Tower 4', `${OF}/TOWER_4_FULL.fbx`, 'structure', ['tower', 'orc'], 0.02),
    fbx('of-tower-5', 'Tower 5', `${OF}/TOWER_5_FULL.fbx`, 'structure', ['tower', 'orc'], 0.02),
    fbx('of-wall-1', 'Wall 1', `${OF}/WALL_1_FULL.fbx`, 'wall', ['wall', 'orc'], 0.02),
    fbx('of-wall-2', 'Wall 2', `${OF}/_WALL_2_01.fbx`, 'wall', ['wall', 'orc'], 0.02),
    fbx('of-bridge', 'Bridge', `${OF}/BRIDGE_FULL.fbx`, 'structure', ['bridge', 'orc'], 0.02),
    fbx('of-barracks', 'Barracks', `${OF}/_BARRACKS.fbx`, 'structure', ['building', 'barracks', 'orc'], 0.02),
    fbx('of-arsenal', 'Arsenal', `${OF}/_ARSENAL.fbx`, 'structure', ['building', 'arsenal', 'orc'], 0.02),
    fbx('of-gates-1', 'Gates 1', `${OF}/_MINNOR_GATES_01.fbx`, 'structure', ['gate', 'orc'], 0.02),
    fbx('of-gates-2', 'Gates 2', `${OF}/_MINNOR_GATES_02.fbx`, 'structure', ['gate', 'orc'], 0.02),
    fbx('of-drum', 'Alarm Drum', `${OF}/_ALARM_DRUM.fbx`, 'prop', ['drum', 'alarm', 'orc'], 0.02),
    fbx('of-brazier', 'Brazier', `${OF}/_BRAZIER_01.fbx`, 'prop', ['light', 'fire', 'orc'], 0.02),
    fbx('of-shed', 'Shed', `${OF}/_SHED_01.fbx`, 'structure', ['building', 'shed', 'orc'], 0.02),
  ],
};

// ── Volcano (Volcano Rim terrain) ──────────────────────────────

const VL = `${P}/volcano/Fbx`;

export const VOLCANO_PACK: AssetPack = {
  id: 'volcano',
  name: 'Volcano Terrain',
  description: 'Volcanic boulders and volcano models for Volcano Rim zone',
  basePath: `${P}/volcano`,
  texturePath: `${P}/volcano/Texture`,
  assets: [
    ...Array.from({ length: 10 }, (_, i) =>
      fbx(`vl-volcano-${i + 1}`, `Volcano ${i + 1}`, `${VL}/Volcanoe_0${i + 1}.fbx`, 'terrain', ['volcano', 'mountain'], 0.02)),
    ...Array.from({ length: 10 }, (_, i) =>
      fbx(`vl-boulder-${i + 1}`, `Boulder ${i + 1}`, `${VL}/Boulder_0${i + 1}.fbx`, 'terrain', ['boulder', 'rock', 'volcano'], 0.02)),
  ],
};

// ── Stone Terrain (Mountain Pass) ──────────────────────────────

const ST = `${P}/stone-terrain/Fbx`;

export const STONE_TERRAIN_PACK: AssetPack = {
  id: 'stone-terrain',
  name: 'Stone Terrain',
  description: 'Stone formations for Mountain Pass and rocky zones',
  basePath: `${P}/stone-terrain`,
  texturePath: `${P}/stone-terrain/Texture`,
  assets: [
    ...Array.from({ length: 10 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return fbx(`st-big-${i + 1}`, `Big Stone ${i + 1}`, `${ST}/Stone_big_${n}.fbx`, 'terrain', ['stone', 'rock', 'big'], 0.02);
    }),
    ...Array.from({ length: 10 }, (_, i) => {
      const n = String(i + 1).padStart(3, '0');
      return fbx(`st-lit-${i + 1}`, `Small Stone ${i + 1}`, `${ST}/Stone_lit_${n}.fbx`, 'terrain', ['stone', 'rock', 'small'], 0.02);
    }),
  ],
};

// ── Mine (Mining profession nodes) ─────────────────────────────

const MN = `${P}/mine/fbx/full`;

export const MINE_PACK: AssetPack = {
  id: 'mine',
  name: 'Mine & Resources',
  description: 'Mining nodes, crystals, ore veins, tools',
  basePath: `${P}/mine`,
  texturePath: `${P}/mine/texture`,
  assets: [
    fbx('mn-mine-1', 'Mine Entrance 1', `${MN}/_mine_1.fbx`, 'structure', ['mine', 'entrance'], 0.02),
    fbx('mn-mine-2', 'Mine Entrance 2', `${MN}/_mine_2.fbx`, 'structure', ['mine', 'entrance'], 0.02),
    fbx('mn-mine-3', 'Mine Shaft 3', `${MN}/_mine_3.fbx`, 'structure', ['mine'], 0.02),
    fbx('mn-mine-4', 'Mine Shaft 4', `${MN}/_mine_4.fbx`, 'structure', ['mine'], 0.02),
    fbx('mn-coal', 'Coal Deposit', `${MN}/_coal_1.fbx`, 'resource-node', ['mining', 'coal', 'ore'], 0.02),
    fbx('mn-gold-1', 'Gold Vein 1', `${MN}/_gold_1.fbx`, 'resource-node', ['mining', 'gold', 'ore'], 0.02),
    fbx('mn-gold-2', 'Gold Vein 2', `${MN}/_gold_2.fbx`, 'resource-node', ['mining', 'gold', 'ore'], 0.02),
    fbx('mn-crystal-1', 'Crystal 1', `${MN}/_crystal_1.fbx`, 'resource-node', ['mining', 'crystal'], 0.02),
    fbx('mn-crystal-2', 'Crystal 2', `${MN}/_crystal_2.fbx`, 'resource-node', ['mining', 'crystal'], 0.02),
    fbx('mn-crystal-3', 'Crystal 3', `${MN}/_crystal_3.fbx`, 'resource-node', ['mining', 'crystal'], 0.02),
    fbx('mn-sapphire-1', 'Sapphire 1', `${MN}/_sapfir_1.fbx`, 'resource-node', ['mining', 'gem', 'sapphire'], 0.02),
    fbx('mn-sapphire-2', 'Sapphire 2', `${MN}/_sapfir_2.fbx`, 'resource-node', ['mining', 'gem', 'sapphire'], 0.02),
    fbx('mn-stone-coal', 'Stone + Coal', `${MN}/_stone_coal.fbx`, 'resource-node', ['mining', 'coal'], 0.02),
    fbx('mn-stone-gold', 'Stone + Gold', `${MN}/_stone_gold.fbx`, 'resource-node', ['mining', 'gold'], 0.02),
    fbx('mn-stone-diamond', 'Stone + Diamond', `${MN}/_stone_diamond.fbx`, 'resource-node', ['mining', 'diamond'], 0.02),
    fbx('mn-stone-emerald', 'Stone + Emerald', `${MN}/_stone_emerald.fbx`, 'resource-node', ['mining', 'emerald'], 0.02),
    fbx('mn-pick-1', 'Pickaxe 1', `${MN}/_pick_1.fbx`, 'prop', ['tool', 'pickaxe', 'mining'], 0.02),
    fbx('mn-pick-2', 'Pickaxe 2', `${MN}/_pick_2.fbx`, 'prop', ['tool', 'pickaxe', 'mining'], 0.02),
    fbx('mn-wheelbarrow-coal', 'Wheelbarrow Coal', `${MN}/_wheelbarrow_coal.fbx`, 'prop', ['wheelbarrow', 'mining'], 0.02),
    fbx('mn-wheelbarrow-gold', 'Wheelbarrow Gold', `${MN}/_wheelbarrow_gold.fbx`, 'prop', ['wheelbarrow', 'mining'], 0.02),
    fbx('mn-wood-1', 'Wood Pile 1', `${MN}/_wood_1.fbx`, 'resource-node', ['logging', 'wood'], 0.02),
    fbx('mn-wood-2', 'Wood Pile 2', `${MN}/_wood_2.fbx`, 'resource-node', ['logging', 'wood'], 0.02),
    fbx('mn-sawmill', 'Sawmill', `${MN}/_samwill.fbx`, 'structure', ['building', 'sawmill', 'logging'], 0.02),
  ],
};

// ── Defense Towers (MOBA / Tower Defense) ──────────────────────

const DT = `${P}/defense-towers/fbx/fbx_full`;

export const DEFENSE_TOWER_PACK: AssetPack = {
  id: 'defense-towers',
  name: 'Defense Towers',
  description: 'Tower defense models with 4 tiers per type',
  basePath: `${P}/defense-towers`,
  texturePath: `${P}/defense-towers/texture`,
  assets: [
    ...[1, 2, 3, 4].map(lvl => fbx(`dt-archer-${lvl}`, `Archer Tower Lv${lvl}`, `${DT}/_archers_tower_LVL_${lvl}.fbx`, 'tower', ['tower', 'archer', `lv${lvl}`], 0.02)),
    ...[1, 2, 3, 4].map(lvl => fbx(`dt-cannon-${lvl}`, `Cannon Tower Lv${lvl}`, `${DT}/_Cannon_tower_LVL_${lvl}.fbx`, 'tower', ['tower', 'cannon', `lv${lvl}`], 0.02)),
    ...[1, 2, 3, 4].map(lvl => {
      const name = lvl === 3 ? '_Ballist_tower_LVL_3' : `_Ballista_tower_LVL_${lvl}`;
      return fbx(`dt-ballista-${lvl}`, `Ballista Tower Lv${lvl}`, `${DT}/${name}.fbx`, 'tower', ['tower', 'ballista', `lv${lvl}`], 0.02);
    }),
    ...[1, 2, 3, 4].map(lvl => {
      const name = lvl === 3 ? '_Frostly_tower_LVL_3' : `_Frosty_tower_LVL_${lvl}`;
      return fbx(`dt-frost-${lvl}`, `Frost Tower Lv${lvl}`, `${DT}/${name}.fbx`, 'tower', ['tower', 'frost', `lv${lvl}`], 0.02);
    }),
    ...[1, 2, 3, 4].map(lvl => fbx(`dt-wizard-${lvl}`, `Wizard Tower Lv${lvl}`, `${DT}/_Wizard_tower_LVL_${lvl}.fbx`, 'tower', ['tower', 'wizard', `lv${lvl}`], 0.02)),
  ],
};

// ── KayKit Dungeon Remastered ──────────────────────────────────

const KD = `${P}/kaykit-dungeon/KayKit_DungeonRemastered_1.1_FREE/Assets/gltf`;

export const KAYKIT_DUNGEON_PACK: AssetPack = {
  id: 'kaykit-dungeon',
  name: 'KayKit Dungeon Remastered',
  description: 'High-quality dungeon props, barriers, beds, bottles, candles',
  basePath: `${P}/kaykit-dungeon`,
  texturePath: `${P}/kaykit-dungeon`,
  assets: [
    gltf('kd-barrel-lg', 'Large Barrel', `${KD}/barrel_large.gltf`, 'prop', ['barrel', 'dungeon']),
    gltf('kd-barrel-lg-dec', 'Decorated Barrel', `${KD}/barrel_large_decorated.gltf`, 'prop', ['barrel', 'dungeon']),
    gltf('kd-barrel-sm', 'Small Barrel', `${KD}/barrel_small.gltf`, 'prop', ['barrel', 'dungeon']),
    gltf('kd-barrel-stack', 'Barrel Stack', `${KD}/barrel_small_stack.gltf`, 'prop', ['barrel', 'dungeon']),
    gltf('kd-barrier', 'Barrier', `${KD}/barrier.gltf`, 'dungeon-structure', ['barrier', 'dungeon']),
    gltf('kd-barrier-half', 'Barrier Half', `${KD}/barrier_half.gltf`, 'dungeon-structure', ['barrier', 'dungeon']),
    gltf('kd-barrier-corner', 'Barrier Corner', `${KD}/barrier_corner.gltf`, 'dungeon-structure', ['barrier', 'dungeon']),
    gltf('kd-barrier-column', 'Barrier Column', `${KD}/barrier_column.gltf`, 'dungeon-structure', ['barrier', 'column', 'dungeon']),
    gltf('kd-bed-decorated', 'Decorated Bed', `${KD}/bed_decorated.gltf`, 'furniture', ['bed', 'dungeon']),
    gltf('kd-bed-frame', 'Bed Frame', `${KD}/bed_frame.gltf`, 'furniture', ['bed', 'dungeon']),
    gltf('kd-bed-floor', 'Floor Bed', `${KD}/bed_floor.gltf`, 'furniture', ['bed', 'dungeon']),
    gltf('kd-candle-lit', 'Candle Lit', `${KD}/candle_lit.gltf`, 'prop', ['candle', 'light', 'dungeon']),
    gltf('kd-candle-triple', 'Triple Candle', `${KD}/candle_triple.gltf`, 'prop', ['candle', 'light', 'dungeon']),
    gltf('kd-box-lg', 'Large Box', `${KD}/box_large.gltf`, 'prop', ['box', 'container', 'dungeon']),
    gltf('kd-box-sm', 'Small Box', `${KD}/box_small.gltf`, 'prop', ['box', 'container', 'dungeon']),
    gltf('kd-box-stack', 'Stacked Boxes', `${KD}/box_stacked.gltf`, 'prop', ['box', 'container', 'dungeon']),
    gltf('kd-bottle-brown', 'Brown Bottle', `${KD}/bottle_A_brown.gltf`, 'prop', ['bottle', 'potion', 'dungeon']),
    gltf('kd-bottle-green', 'Green Bottle', `${KD}/bottle_A_green.gltf`, 'prop', ['bottle', 'potion', 'dungeon']),
  ],
};

// ── Campfire ───────────────────────────────────────────────────

const CF = `${P}/campfire`;

export const CAMPFIRE_PACK: AssetPack = {
  id: 'campfire',
  name: 'Campfire Spooky Stories',
  description: 'Campfire scene with characters and effects',
  basePath: CF,
  texturePath: CF,
  assets: [],  // Contains non-model assets (scenes/prefabs) — referenced by path
};

// ── All Packs ──────────────────────────────────────────────────

export const ALL_ASSET_PACKS: AssetPack[] = [
  CRUSADETOWN_PACK,
  FABLEDTOWN_PACK,
  LEGIONTOWN_PACK,
  BOSSGRAVEYARD_PACK,
  PIRATE_PACK,
  MEDIEVAL_VILLAGE_PACK,
  MODULAR_DUNGEON_PACK,
  FURNITURE_PACK,
  // New packs
  ORC_SETTLEMENT_PACK,
  ORC_FORTRESS_PACK,
  VOLCANO_PACK,
  STONE_TERRAIN_PACK,
  MINE_PACK,
  DEFENSE_TOWER_PACK,
  KAYKIT_DUNGEON_PACK,
  CAMPFIRE_PACK,
];

/** Flat list of every asset for quick lookups */
export const ALL_ASSETS: AssetEntry[] = ALL_ASSET_PACKS.flatMap(p => p.assets);

/** Lookup asset by ID */
export function getAsset(id: string): AssetEntry | undefined {
  return ALL_ASSETS.find(a => a.id === id);
}

/** Get all assets matching a tag */
export function getAssetsByTag(tag: string): AssetEntry[] {
  return ALL_ASSETS.filter(a => a.tags.includes(tag));
}

/** Get all assets in a category */
export function getAssetsByCategory(category: string): AssetEntry[] {
  return ALL_ASSETS.filter(a => a.category === category);
}

/** Get all assets from a specific pack */
export function getPackAssets(packId: string): AssetEntry[] {
  const pack = ALL_ASSET_PACKS.find(p => p.id === packId);
  return pack ? pack.assets : [];
}

import * as THREE from 'three';

export interface PrefabConfig {
  modelPath: string;
  texturePath?: string;
  scale: number;
  offset: THREE.Vector3;
  rotation?: THREE.Euler;
  animations?: Record<string, string>;
}

export const TOWER_PREFABS: Record<string, PrefabConfig> = {
  archer: {
    modelPath: '/assets/models/towers/archer_tower_1.fbx',
    texturePath: '/assets/textures/tower_texture.png',
    scale: 0.025,
    offset: new THREE.Vector3(0, 0, 0),
  },
  cannon: {
    modelPath: '/assets/models/towers/cannon_tower_1.fbx',
    texturePath: '/assets/textures/tower_texture.png',
    scale: 0.025,
    offset: new THREE.Vector3(0, 0, 0),
  },
  wizard: {
    modelPath: '/assets/models/towers/wizard_tower_1.fbx',
    texturePath: '/assets/textures/tower_texture.png',
    scale: 0.025,
    offset: new THREE.Vector3(0, 0, 0),
  },
  poison: {
    modelPath: '/assets/models/towers/poison_tower_1.fbx',
    texturePath: '/assets/textures/tower_texture.png',
    scale: 0.025,
    offset: new THREE.Vector3(0, 0, 0),
  },
};

export const HERO_PREFABS: Record<string, PrefabConfig> = {
  elf_warrior: {
    modelPath: '/assets/models/heroes/elf/elf_guardian.fbx',
    texturePath: '/assets/textures/elf_texture.png',
    scale: 0.012,
    offset: new THREE.Vector3(0, 0, 0),
  },
  elf_mage: {
    modelPath: '/assets/models/heroes/elf/elf_upper_class_1.fbx',
    texturePath: '/assets/textures/elf_texture.png',
    scale: 0.012,
    offset: new THREE.Vector3(0, 0, 0),
  },
  orc_warrior: {
    modelPath: '/assets/models/heroes/orc/_king.fbx',
    texturePath: '/assets/textures/orc_texture.png',
    scale: 0.012,
    offset: new THREE.Vector3(0, 0, 0),
  },
  orc_ranger: {
    modelPath: '/assets/models/heroes/orc/_orcs_city_dwellers_1.fbx',
    texturePath: '/assets/textures/orc_texture.png',
    scale: 0.012,
    offset: new THREE.Vector3(0, 0, 0),
  },
  racalvin: {
    modelPath: '/assets/models/heroes/racalvin/base_model.fbx',
    scale: 0.012,
    offset: new THREE.Vector3(0, 0, 0),
    animations: {
      idle: '/assets/models/heroes/racalvin/idle.fbx',
      walk: '/assets/models/heroes/racalvin/walk.fbx',
      run: '/assets/models/heroes/racalvin/run.fbx',
      attack: '/assets/models/heroes/racalvin/attack.fbx',
      block: '/assets/models/heroes/racalvin/block.fbx',
      death: '/assets/models/heroes/racalvin/death.fbx',
      slash: '/assets/models/heroes/racalvin/slash.fbx',
    },
  },
};

export const ENV_PREFABS: Record<string, PrefabConfig> = {
  castle: { modelPath: '/assets/models/environment/Castle.glb', scale: 0.5, offset: new THREE.Vector3(0, 0, 0) },
  fortress: { modelPath: '/assets/models/environment/Fortress.glb', scale: 0.3, offset: new THREE.Vector3(0, 0, 0) },
  tree: { modelPath: '/assets/models/environment/Tree.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  rock: { modelPath: '/assets/models/environment/Rock.glb', scale: 0.1, offset: new THREE.Vector3(0, 0, 0) },
  mountain: { modelPath: '/assets/models/environment/Mountain.glb', scale: 0.3, offset: new THREE.Vector3(0, 0, 0) },
  bridge: { modelPath: '/assets/models/environment/Bridge.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  well: { modelPath: '/assets/models/environment/Well.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  campfire: { modelPath: '/assets/models/environment/Campfire.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  tent: { modelPath: '/assets/models/environment/Tent.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  shrine: { modelPath: '/assets/models/environment/Shrine.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  banner: { modelPath: '/assets/models/environment/Banner.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  torch: { modelPath: '/assets/models/environment/Torch.glb', scale: 0.12, offset: new THREE.Vector3(0, 0, 0) },
  statue: { modelPath: '/assets/models/environment/Statue.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0) },
  marketStalls: { modelPath: '/assets/models/environment/MarketStalls.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  villageMarket: { modelPath: '/assets/models/environment/VillageMarket.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  chest: { modelPath: '/assets/models/environment/Chest.glb', scale: 0.1, offset: new THREE.Vector3(0, 0, 0) },
  dragon: { modelPath: '/assets/models/environment/Dragon.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  portalDoor: { modelPath: '/assets/models/environment/PortalDoor.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
};

export const WEAPON_PREFABS: Record<string, PrefabConfig> = {
  sword: { modelPath: '/assets/models/weapons/Sword.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  axe: { modelPath: '/assets/models/weapons/Axe.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  bow: { modelPath: '/assets/models/weapons/Bow.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  staff: { modelPath: '/assets/models/weapons/Staff.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  shield: { modelPath: '/assets/models/weapons/Shield.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  dagger: { modelPath: '/assets/models/weapons/Dagger.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
  mace: { modelPath: '/assets/models/weapons/Mace.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0) },
};

export function getTowerPrefab(team: number, lane: number): string {
  if (team === 0) {
    return lane === 0 ? 'archer' : lane === 1 ? 'wizard' : 'cannon';
  }
  return lane === 0 ? 'poison' : lane === 1 ? 'cannon' : 'archer';
}

export function getHeroPrefabKey(race: string, heroClass: string): string {
  const key = `${race.toLowerCase()}_${heroClass.toLowerCase()}`;
  if (HERO_PREFABS[key]) return key;
  if (race.toLowerCase() === 'elf') return 'elf_warrior';
  if (race.toLowerCase() === 'orc') return 'orc_warrior';
  if (race.toLowerCase() === 'barbarian' && heroClass.toLowerCase() === 'ranger') return 'racalvin';
  return 'elf_warrior';
}

export function getWeaponForClass(heroClass: string): string {
  switch (heroClass.toLowerCase()) {
    case 'warrior': return 'sword';
    case 'worg': return 'axe';
    case 'mage': return 'staff';
    case 'ranger': return 'bow';
    default: return 'sword';
  }
}

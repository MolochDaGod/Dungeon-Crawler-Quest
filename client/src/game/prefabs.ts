import * as THREE from 'three';

export interface PrefabConfig {
  modelPath: string;
  texturePath?: string;
  scale: number;
  offset: THREE.Vector3;
  rotation?: THREE.Euler;
  animations?: Record<string, string>;
  format?: 'glb' | 'fbx';
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
  human_warrior: {
    modelPath: '/assets/models/characters/crusaders_knight.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  human_worg: {
    modelPath: '/assets/models/characters/berserker.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  human_mage: {
    modelPath: '/assets/models/characters/Animated_Wizard.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  human_ranger: {
    modelPath: '/assets/models/characters/Anne.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  barbarian_warrior: {
    modelPath: '/assets/models/characters/BarbarianGlad.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  barbarian_worg: {
    modelPath: '/assets/models/characters/humandeathgiver.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  barbarian_mage: {
    modelPath: '/assets/models/characters/fabledworker.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  barbarian_ranger: {
    modelPath: '/assets/models/characters/Pirate_Captain.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  dwarf_warrior: {
    modelPath: '/assets/models/characters/dwarf_enforcer.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  dwarf_worg: {
    modelPath: '/assets/models/characters/Character_Toon_Animated.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  dwarf_mage: {
    modelPath: '/assets/models/characters/Animated_Character_Base.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  dwarf_ranger: {
    modelPath: '/assets/models/characters/survivealtoon.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  elf_warrior: {
    modelPath: '/assets/models/characters/elf_enforcer.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  elf_worg: {
    modelPath: '/assets/models/characters/Animated_Woman.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  elf_mage: {
    modelPath: '/assets/models/characters/Animated_Wizard.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  elf_ranger: {
    modelPath: '/assets/models/characters/ElfRanger.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  orc_warrior: {
    modelPath: '/assets/models/characters/graatorc.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  orc_worg: {
    modelPath: '/assets/models/characters/orcpeon.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  orc_mage: {
    modelPath: '/assets/models/characters/Animated_Zombie.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  orc_ranger: {
    modelPath: '/assets/models/characters/Animated_Human.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  undead_warrior: {
    modelPath: '/assets/models/characters/skeletong_warrior.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  undead_worg: {
    modelPath: '/assets/models/characters/undeadworker.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  undead_mage: {
    modelPath: '/assets/models/characters/Animated_Zombie.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  undead_ranger: {
    modelPath: '/assets/models/characters/Skeleton.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  racalvin: {
    modelPath: '/assets/models/characters/Pirate_Captain.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  pirate: {
    modelPath: '/assets/models/characters/Pirate_Captain.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
};

export const CREATURE_PREFABS: Record<string, PrefabConfig> = {
  wolf: {
    modelPath: '/assets/models/creatures/Wolf.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  dragon: {
    modelPath: '/assets/models/creatures/Red_Dragon.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  raptor: {
    modelPath: '/assets/models/creatures/Velociraptor.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  shark: {
    modelPath: '/assets/models/creatures/Shark.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  tentacle: {
    modelPath: '/assets/models/creatures/Tentacle.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  sea_monster: {
    modelPath: '/assets/models/creatures/Sea_Monster_Scene.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  skeleton: {
    modelPath: '/assets/models/characters/Skeleton.glb',
    scale: 0.008,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  goblin: {
    modelPath: '/assets/models/creatures/GoblinCr3w.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  skullgoon: {
    modelPath: '/assets/models/creatures/skullgoon.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
};

export const MINION_PREFABS: Record<string, PrefabConfig> = {
  melee_team0: {
    modelPath: '/assets/models/characters/crusaders_knight.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  melee_team1: {
    modelPath: '/assets/models/characters/Skeleton.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  ranged_team0: {
    modelPath: '/assets/models/characters/Animated_Human.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  ranged_team1: {
    modelPath: '/assets/models/characters/Animated_Zombie.glb',
    scale: 0.005,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  siege_team0: {
    modelPath: '/assets/models/characters/BarbarianGlad.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
  },
  siege_team1: {
    modelPath: '/assets/models/characters/skeletong_warrior.glb',
    scale: 0.006,
    offset: new THREE.Vector3(0, 0, 0),
    format: 'glb',
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
  portalDoor: { modelPath: '/assets/models/environment/PortalDoor.glb', scale: 0.2, offset: new THREE.Vector3(0, 0, 0) },
  sail_ship: { modelPath: '/assets/models/props/Sail_Ship.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0), format: 'glb' },
  sail_boat: { modelPath: '/assets/models/props/Sail_Boat.glb', scale: 0.1, offset: new THREE.Vector3(0, 0, 0), format: 'glb' },
  ship_wreck: { modelPath: '/assets/models/props/Ship_Wreck.glb', scale: 0.1, offset: new THREE.Vector3(0, 0, 0), format: 'glb' },
  port: { modelPath: '/assets/models/props/Port.glb', scale: 0.15, offset: new THREE.Vector3(0, 0, 0), format: 'glb' },
  weaponschest: { modelPath: '/assets/models/props/weaponschest.glb', scale: 0.08, offset: new THREE.Vector3(0, 0, 0), format: 'glb' },
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

export function getHeroPrefabKey(race: string, heroClass: string, heroName?: string): string {
  if (heroName) {
    const lowerName = heroName.toLowerCase();
    if (lowerName.includes('racalvin') || lowerName.includes('pirate')) return 'racalvin';
  }
  const key = `${race.toLowerCase()}_${heroClass.toLowerCase()}`;
  if (HERO_PREFABS[key]) return key;
  return 'human_warrior';
}

export function getMinionPrefabKey(minionType: string, team: number): string {
  if (minionType === 'siege' || minionType === 'super') return `siege_team${team}`;
  if (minionType === 'ranged') return `ranged_team${team}`;
  return `melee_team${team}`;
}

export function getJungleMobPrefab(mobType: string): string {
  switch (mobType) {
    case 'buff': return 'dragon';
    case 'medium': return 'wolf';
    case 'small':
    default: return 'raptor';
  }
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

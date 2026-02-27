import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  mixer?: THREE.AnimationMixer;
}

const modelCache = new Map<string, LoadedModel>();
const textureCache = new Map<string, THREE.Texture>();
const loadingPromises = new Map<string, Promise<LoadedModel>>();

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();

export function getTexture(path: string): THREE.Texture {
  if (textureCache.has(path)) return textureCache.get(path)!;
  const tex = textureLoader.load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

export async function loadGLB(path: string): Promise<LoadedModel> {
  if (modelCache.has(path)) {
    const cached = modelCache.get(path)!;
    return { scene: cached.scene.clone(), animations: cached.animations };
  }
  if (loadingPromises.has(path)) return loadingPromises.get(path)!;

  const promise = new Promise<LoadedModel>((resolve, reject) => {
    gltfLoader.load(path, (gltf) => {
      const model: LoadedModel = { scene: gltf.scene, animations: gltf.animations };
      modelCache.set(path, model);
      loadingPromises.delete(path);
      resolve({ scene: model.scene.clone(), animations: model.animations });
    }, undefined, reject);
  });
  loadingPromises.set(path, promise);
  return promise;
}

export async function loadFBX(path: string, texturePath?: string): Promise<LoadedModel> {
  if (modelCache.has(path)) {
    const cached = modelCache.get(path)!;
    return { scene: cached.scene.clone(), animations: cached.animations };
  }
  if (loadingPromises.has(path)) return loadingPromises.get(path)!;

  const promise = new Promise<LoadedModel>((resolve, reject) => {
    fbxLoader.load(path, (fbx) => {
      if (texturePath) {
        const tex = getTexture(texturePath);
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(m => { (m as THREE.MeshStandardMaterial).map = tex; });
            } else {
              (mesh.material as THREE.MeshStandardMaterial).map = tex;
            }
          }
        });
      }
      const model: LoadedModel = { scene: fbx, animations: fbx.animations };
      modelCache.set(path, model);
      loadingPromises.delete(path);
      resolve({ scene: model.scene.clone(), animations: model.animations });
    }, undefined, reject);
  });
  loadingPromises.set(path, promise);
  return promise;
}

export function cloneModel(model: LoadedModel): LoadedModel {
  return { scene: model.scene.clone(), animations: model.animations };
}

const animClipCache = new Map<string, THREE.AnimationClip>();
const animLoadingPromises = new Map<string, Promise<THREE.AnimationClip | null>>();

export async function loadAnimationClip(path: string): Promise<THREE.AnimationClip | null> {
  if (animClipCache.has(path)) return animClipCache.get(path)!;
  if (animLoadingPromises.has(path)) return animLoadingPromises.get(path)!;

  const promise = new Promise<THREE.AnimationClip | null>((resolve) => {
    fbxLoader.load(path, (fbx) => {
      if (fbx.animations && fbx.animations.length > 0) {
        const clip = fbx.animations[0];
        const name = path.split('/').pop()?.replace('.fbx', '').toLowerCase() || 'unknown';
        clip.name = name;
        animClipCache.set(path, clip);
        animLoadingPromises.delete(path);
        resolve(clip);
      } else {
        animLoadingPromises.delete(path);
        resolve(null);
      }
    }, undefined, () => {
      animLoadingPromises.delete(path);
      resolve(null);
    });
  });
  animLoadingPromises.set(path, promise);
  return promise;
}

export async function loadAnimationSet(paths: Record<string, string>): Promise<Map<string, THREE.AnimationClip>> {
  const result = new Map<string, THREE.AnimationClip>();
  const entries = Object.entries(paths);
  const promises = entries.map(async ([name, path]) => {
    const clip = await loadAnimationClip(path);
    if (clip) {
      clip.name = name.toLowerCase();
      result.set(name.toLowerCase(), clip);
    }
  });
  await Promise.allSettled(promises);
  return result;
}

export function applyAnimationsToEntity(entity: AnimatedEntity, clips: Map<string, THREE.AnimationClip>) {
  for (const [name, clip] of Array.from(clips)) {
    if (!entity.actions.has(name)) {
      const action = entity.mixer.clipAction(clip);
      entity.actions.set(name, action);
    }
  }
}

export const ANIMATION_PATHS = {
  idle: '/assets/models/animations/Idle.fbx',
  run: '/assets/models/animations/Run.fbx',
  attack: '/assets/models/animations/Attack.fbx',
  death: '/assets/models/animations/Death.fbx',
  hit: '/assets/models/animations/Hit.fbx',
};

export const MODEL_PATHS = {
  towers: {
    archer1: '/assets/models/towers/archer_tower_1.fbx',
    archer3: '/assets/models/towers/archer_tower_3.fbx',
    cannon1: '/assets/models/towers/cannon_tower_1.fbx',
    wizard1: '/assets/models/towers/wizard_tower_1.fbx',
    poison1: '/assets/models/towers/poison_tower_1.fbx',
  },
  heroes: {
    elfGuardian: '/assets/models/heroes/elf/elf_guardian.fbx',
    elfCommoner: '/assets/models/heroes/elf/elf_commoner_1.fbx',
    elfUpperClass: '/assets/models/heroes/elf/elf_upper_class_1.fbx',
    orcKing: '/assets/models/heroes/orc/_king.fbx',
    orcDweller1: '/assets/models/heroes/orc/_orcs_city_dwellers_1.fbx',
    orcPeasant1: '/assets/models/heroes/orc/_peasant_1.fbx',
    racalvinBase: '/assets/models/heroes/racalvin/base_model.fbx',
    racalvinIdle: '/assets/models/heroes/racalvin/idle.fbx',
    racalvinWalk: '/assets/models/heroes/racalvin/walk.fbx',
    racalvinRun: '/assets/models/heroes/racalvin/run.fbx',
    racalvinAttack: '/assets/models/heroes/racalvin/attack.fbx',
    racalvinBlock: '/assets/models/heroes/racalvin/block.fbx',
    racalvinDeath: '/assets/models/heroes/racalvin/death.fbx',
    racalvinSlash: '/assets/models/heroes/racalvin/slash.fbx',
    racalvinJump: '/assets/models/heroes/racalvin/jump.fbx',
  },
  environment: {
    castle: '/assets/models/environment/Castle.glb',
    fortress: '/assets/models/environment/Fortress.glb',
    tree: '/assets/models/environment/Tree.glb',
    rock: '/assets/models/environment/Rock.glb',
    mountain: '/assets/models/environment/Mountain.glb',
    bridge: '/assets/models/environment/Bridge.glb',
    well: '/assets/models/environment/Well.glb',
    campfire: '/assets/models/environment/Campfire.glb',
    tent: '/assets/models/environment/Tent.glb',
    shrine: '/assets/models/environment/Shrine.glb',
    banner: '/assets/models/environment/Banner.glb',
    torch: '/assets/models/environment/Torch.glb',
    statue: '/assets/models/environment/Statue.glb',
    marketStalls: '/assets/models/environment/MarketStalls.glb',
    villageMarket: '/assets/models/environment/VillageMarket.glb',
    throne: '/assets/models/environment/Throne.glb',
    stone: '/assets/models/environment/Stone.glb',
    flag: '/assets/models/environment/Flag.glb',
    dragon: '/assets/models/environment/Dragon.glb',
    portalDoor: '/assets/models/environment/PortalDoor.glb',
    chest: '/assets/models/environment/Chest.glb',
    treasureChest: '/assets/models/environment/TreasureChest.glb',
    boat: '/assets/models/environment/Boat.fbx',
    palmTree: '/assets/models/environment/PalmTree.fbx',
    lantern: '/assets/models/environment/Lantern_1.fbx',
    rowboat: '/assets/models/environment/Rowboat.fbx',
  },
  dungeon: {
    armor: '/assets/models/dungeon/Armor_01_001.fbx',
    door: '/assets/models/dungeon/Door_03_001.fbx',
    doorFrame: '/assets/models/dungeon/DoorFrame_02_001.fbx',
    floorCorner: '/assets/models/dungeon/Floor_Corner_01_001.fbx',
    pillar: '/assets/models/dungeon/Pillar_03_001.fbx',
    plinth: '/assets/models/dungeon/Plinth_Big_01_001.fbx',
    redBanner: '/assets/models/dungeon/RedBanner_Small_01_001.fbx',
    smallChest: '/assets/models/dungeon/SmallChest_02_001.fbx',
    smallChestTop: '/assets/models/dungeon/SmallChest_Top_02_001.fbx',
    torchWall: '/assets/models/dungeon/Torch_Wall_01_001.fbx',
    wallBrick: '/assets/models/dungeon/WallBrick_Tall_01_001.fbx',
  },
  weapons: {
    sword: '/assets/models/weapons/Sword.glb',
    axe: '/assets/models/weapons/Axe.glb',
    bow: '/assets/models/weapons/Bow.glb',
    staff: '/assets/models/weapons/Staff.glb',
    shield: '/assets/models/weapons/Shield.glb',
    dagger: '/assets/models/weapons/Dagger.glb',
    mace: '/assets/models/weapons/Mace.glb',
    spellbook: '/assets/models/weapons/Spellbook.glb',
  },
  textures: {
    tower: '/assets/textures/tower_texture.png',
    elf: '/assets/textures/elf_texture.png',
    orc: '/assets/textures/orc_texture.png',
    orcBase: '/assets/textures/orcbase_texture.png',
    orcWeapons: '/assets/textures/orcweapons_texture.png',
    hammer: '/assets/textures/hammer_texture.png',
  },
  portraits: (race: string, heroClass: string) =>
    `/assets/portraits/${race.toLowerCase()}_${heroClass.toLowerCase()}.png`,
  spellIcon: (name: string) => `/assets/icons/${name}.png`,
};

export interface AnimatedEntity {
  group: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  currentAction: string;
}

export function createAnimatedEntity(model: LoadedModel): AnimatedEntity {
  const mixer = new THREE.AnimationMixer(model.scene);
  const actions = new Map<string, THREE.AnimationAction>();
  model.animations.forEach(clip => {
    const action = mixer.clipAction(clip);
    actions.set(clip.name.toLowerCase(), action);
  });
  return { group: model.scene, mixer, actions, currentAction: '' };
}

export function playAnimation(entity: AnimatedEntity, name: string, crossFade: number = 0.2) {
  const lowerName = name.toLowerCase();
  if (entity.currentAction === lowerName) return;
  const action = entity.actions.get(lowerName);
  if (!action) return;

  if (entity.currentAction) {
    const prev = entity.actions.get(entity.currentAction);
    if (prev) {
      action.reset();
      action.play();
      prev.crossFadeTo(action, crossFade, true);
    } else {
      action.reset().play();
    }
  } else {
    action.reset().play();
  }
  entity.currentAction = lowerName;
}

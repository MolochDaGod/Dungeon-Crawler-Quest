/**
 * Neutral creeps (WC3-style farming camps) from threejs-games.github.io
 *
 * Source: https://threejs-games.github.io/examples/65-characters/
 * CDN models: https://threejs-games.github.io/assets/models/character/<slug>/model.fbx
 *
 * LICENSE: RigModels.com — free for personal / student use; commercial shipping
 * requires Premium. Do not treat as production commercial art until re-licensed
 * or replaced with owned/baked packs (grudge-convert → R2).
 *
 * Era tag for audit: legacy-external (cdn hotlink) until mirrored + baked.
 */

import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { generateGrudgeUUID } from "@/lib/grudge-uuid";

export const THREEJS_GAMES_CDN =
  "https://threejs-games.github.io/assets/models/character";

/** Preferred production CDN after mirror (ObjectStore script). Falls back to threejs-games. */
export const CREEP_R2_CDN =
  "https://assets.grudge-studio.com/models/creeps/threejs-games";

/**
 * Prefer R2 first — keys live on assets.grudge-studio.com after creeps:mirror:upload.
 * Opt out: localStorage grudge_creeps_r2=0
 * Fleet catalog: https://objectstore.grudge-studio.com/api/v1/neutral-creeps.json
 */
export const PREFER_R2_CREEPS = (() => {
  try {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("grudge_creeps_r2");
    if (v === "0" || v === "false") return false;
    return true;
  } catch {
    return true;
  }
})();

export type CreepFaction = "neutral" | "hostile";
export type CreepFamily = "fantasy" | "horror";

export interface CreepLootEntry {
  id: string;
  name: string;
  kind: "gold" | "material" | "consumable" | "equipment";
  weight: number;
  min: number;
  max: number;
  /** Optional ObjectStore material / item id for bag hooks */
  osId?: string;
}

export interface NeutralCreepDef {
  id: string;
  label: string;
  family: CreepFamily;
  /** Folder under assets/models/character/ */
  slug: string;
  /** Prefer model.fbx; some horror use named fbx */
  modelFile: string;
  /** Target height metres (SI) */
  heightM: number;
  /** Y rotation offset after load (many packs face -Z) */
  yawOffset: number;
  hp: number;
  damage: number;
  speed: number;
  /** Gold range on kill */
  goldMin: number;
  goldMax: number;
  /** XP / farm score */
  xp: number;
  loot: CreepLootEntry[];
  /** Tint for ring / UI */
  color: number;
  license: "rigmodels-personal";
}

/** Fantasy neutrals — user list */
export const FANTASY_CREEPS: NeutralCreepDef[] = [
  {
    id: "creep_demon",
    label: "Demon",
    family: "fantasy",
    slug: "demon",
    modelFile: "model.fbx",
    heightM: 2.2,
    yawOffset: Math.PI,
    hp: 90,
    damage: 14,
    speed: 2.4,
    goldMin: 12,
    goldMax: 28,
    xp: 40,
    color: 0xcc2222,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 12, max: 28 },
      {
        id: "demon_horn",
        name: "Demon Horn",
        kind: "material",
        weight: 35,
        min: 1,
        max: 2,
        osId: "mat-demon-horn",
      },
      {
        id: "infernal_ember",
        name: "Infernal Ember",
        kind: "material",
        weight: 15,
        min: 1,
        max: 1,
      },
    ],
  },
  {
    id: "creep_goblin",
    label: "Goblin",
    family: "fantasy",
    slug: "goblin",
    modelFile: "model.fbx",
    heightM: 1.35,
    yawOffset: Math.PI,
    hp: 35,
    damage: 6,
    speed: 3.2,
    goldMin: 3,
    goldMax: 10,
    xp: 12,
    color: 0x44aa44,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 3, max: 10 },
      {
        id: "goblin_ear",
        name: "Goblin Ear",
        kind: "material",
        weight: 40,
        min: 1,
        max: 3,
      },
      {
        id: "rusty_dagger",
        name: "Rusty Dagger",
        kind: "equipment",
        weight: 8,
        min: 1,
        max: 1,
      },
    ],
  },
  {
    id: "creep_golem",
    label: "Golem",
    family: "fantasy",
    slug: "golem",
    modelFile: "model.fbx",
    heightM: 2.4,
    yawOffset: Math.PI,
    hp: 140,
    damage: 16,
    speed: 1.6,
    goldMin: 18,
    goldMax: 40,
    xp: 55,
    color: 0x888888,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 18, max: 40 },
      {
        id: "stone_core",
        name: "Stone Core",
        kind: "material",
        weight: 45,
        min: 1,
        max: 2,
      },
      {
        id: "iron_ore",
        name: "Iron Ore",
        kind: "material",
        weight: 50,
        min: 1,
        max: 4,
      },
    ],
  },
  {
    id: "creep_orc",
    label: "Orc",
    family: "fantasy",
    slug: "orc",
    modelFile: "model.fbx",
    heightM: 1.85,
    yawOffset: Math.PI,
    hp: 55,
    damage: 10,
    speed: 2.6,
    goldMin: 6,
    goldMax: 16,
    xp: 20,
    color: 0x558833,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 6, max: 16 },
      {
        id: "orc_tusk",
        name: "Orc Tusk",
        kind: "material",
        weight: 35,
        min: 1,
        max: 2,
      },
      {
        id: "leather_scrap",
        name: "Leather Scrap",
        kind: "material",
        weight: 40,
        min: 1,
        max: 3,
      },
    ],
  },
  {
    id: "creep_orc_ogre",
    label: "Orc Ogre",
    family: "fantasy",
    slug: "orc-ogre",
    modelFile: "model.fbx",
    heightM: 2.5,
    yawOffset: Math.PI,
    hp: 160,
    damage: 18,
    speed: 1.8,
    goldMin: 22,
    goldMax: 48,
    xp: 65,
    color: 0x668822,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 22, max: 48 },
      {
        id: "ogre_club",
        name: "Broken Club",
        kind: "equipment",
        weight: 12,
        min: 1,
        max: 1,
      },
      {
        id: "ogre_hide",
        name: "Ogre Hide",
        kind: "material",
        weight: 40,
        min: 1,
        max: 2,
      },
    ],
  },
  {
    id: "creep_sorceress",
    label: "Sorceress",
    family: "fantasy",
    slug: "sorceress",
    modelFile: "model.fbx",
    heightM: 1.75,
    yawOffset: Math.PI,
    hp: 45,
    damage: 12,
    speed: 2.5,
    goldMin: 8,
    goldMax: 20,
    xp: 28,
    color: 0x8866cc,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 8, max: 20 },
      {
        id: "arcane_dust",
        name: "Arcane Dust",
        kind: "material",
        weight: 50,
        min: 1,
        max: 3,
      },
      {
        id: "mana_potion",
        name: "Mana Potion",
        kind: "consumable",
        weight: 20,
        min: 1,
        max: 1,
      },
    ],
  },
  {
    id: "creep_troll",
    label: "Troll",
    family: "fantasy",
    slug: "troll",
    modelFile: "model.fbx",
    heightM: 2.3,
    yawOffset: Math.PI,
    hp: 110,
    damage: 13,
    speed: 2.0,
    goldMin: 14,
    goldMax: 32,
    xp: 45,
    color: 0x449966,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 14, max: 32 },
      {
        id: "troll_blood",
        name: "Troll Blood",
        kind: "material",
        weight: 40,
        min: 1,
        max: 2,
      },
      {
        id: "regen_herb",
        name: "Regen Herb",
        kind: "consumable",
        weight: 25,
        min: 1,
        max: 2,
      },
    ],
  },
  {
    id: "creep_witch",
    label: "Witch",
    family: "fantasy",
    slug: "witch",
    modelFile: "model.fbx",
    heightM: 1.7,
    yawOffset: Math.PI,
    hp: 48,
    damage: 11,
    speed: 2.4,
    goldMin: 9,
    goldMax: 22,
    xp: 30,
    color: 0x6644aa,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 9, max: 22 },
      {
        id: "witch_herb",
        name: "Witch Herb",
        kind: "material",
        weight: 45,
        min: 1,
        max: 3,
      },
      {
        id: "hex_charm",
        name: "Hex Charm",
        kind: "material",
        weight: 18,
        min: 1,
        max: 1,
      },
    ],
  },
];

/** Horror neutrals — farmable undead camps */
export const HORROR_CREEPS: NeutralCreepDef[] = [
  {
    id: "creep_skeleton",
    label: "Skeleton",
    family: "horror",
    slug: "skeleton",
    modelFile: "model.fbx",
    heightM: 1.8,
    yawOffset: Math.PI,
    hp: 40,
    damage: 8,
    speed: 2.3,
    goldMin: 4,
    goldMax: 12,
    xp: 15,
    color: 0xccccaa,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 4, max: 12 },
      {
        id: "bone_shard",
        name: "Bone Shard",
        kind: "material",
        weight: 55,
        min: 1,
        max: 4,
      },
    ],
  },
  {
    id: "creep_zombie_barefoot",
    label: "Zombie",
    family: "horror",
    slug: "zombie",
    modelFile: "zombie-barefoot.fbx",
    heightM: 1.75,
    yawOffset: Math.PI,
    hp: 50,
    damage: 9,
    speed: 1.5,
    goldMin: 3,
    goldMax: 11,
    xp: 14,
    color: 0x668855,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 3, max: 11 },
      {
        id: "rot_cloth",
        name: "Rot Cloth",
        kind: "material",
        weight: 50,
        min: 1,
        max: 2,
      },
    ],
  },
  {
    id: "creep_zombie_cop",
    label: "Zombie Cop",
    family: "horror",
    slug: "zombie",
    modelFile: "zombie-cop.fbx",
    heightM: 1.8,
    yawOffset: Math.PI,
    hp: 60,
    damage: 10,
    speed: 1.7,
    goldMin: 5,
    goldMax: 14,
    xp: 18,
    color: 0x445566,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 5, max: 14 },
      {
        id: "badge",
        name: "Tarnished Badge",
        kind: "material",
        weight: 20,
        min: 1,
        max: 1,
      },
    ],
  },
  {
    id: "creep_zombie_guard",
    label: "Zombie Guard",
    family: "horror",
    slug: "zombie",
    modelFile: "zombie-guard.fbx",
    heightM: 1.85,
    yawOffset: Math.PI,
    hp: 70,
    damage: 11,
    speed: 1.6,
    goldMin: 6,
    goldMax: 16,
    xp: 22,
    color: 0x556644,
    license: "rigmodels-personal",
    loot: [
      { id: "gold", name: "Gold", kind: "gold", weight: 100, min: 6, max: 16 },
      {
        id: "rusted_plate",
        name: "Rusted Plate",
        kind: "material",
        weight: 30,
        min: 1,
        max: 2,
      },
    ],
  },
];

export const ALL_NEUTRAL_CREEPS: NeutralCreepDef[] = [
  ...FANTASY_CREEPS,
  ...HORROR_CREEPS,
];

export function creepModelUrl(def: NeutralCreepDef, preferR2 = PREFER_R2_CREEPS): string {
  if (preferR2) {
    return `${CREEP_R2_CDN}/${def.slug}/${def.modelFile}`;
  }
  return `${THREEJS_GAMES_CDN}/${def.slug}/${def.modelFile}`;
}

/** Try R2 first, fall back to threejs-games on 404 (async HEAD). */
export async function resolveCreepModelUrl(def: NeutralCreepDef): Promise<string> {
  const r2 = creepModelUrl(def, true);
  try {
    const res = await fetch(r2, { method: "HEAD", signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      try {
        localStorage.setItem("grudge_creeps_r2", "1");
      } catch {
        /* ignore */
      }
      return r2;
    }
  } catch {
    /* fall through */
  }
  return creepModelUrl(def, false);
}

export function pickCreep(
  family?: CreepFamily,
  rng = Math.random,
): NeutralCreepDef {
  const pool =
    family === "horror"
      ? HORROR_CREEPS
      : family === "fantasy"
        ? FANTASY_CREEPS
        : ALL_NEUTRAL_CREEPS;
  return pool[Math.floor(rng() * pool.length)]!;
}

export interface RolledLoot {
  id: string;
  name: string;
  kind: CreepLootEntry["kind"];
  qty: number;
  instanceId: string;
}

/** WC3-style: always gold band + 0–2 extra weighted rolls */
export function rollCreepLoot(
  def: NeutralCreepDef,
  rng = Math.random,
): RolledLoot[] {
  const out: RolledLoot[] = [];
  const gold = def.loot.find((l) => l.kind === "gold");
  if (gold) {
    const qty =
      gold.min + Math.floor(rng() * (gold.max - gold.min + 1));
    out.push({
      id: gold.id,
      name: gold.name,
      kind: "gold",
      qty,
      instanceId: generateGrudgeUUID("ITEM"),
    });
  }
  const extras = def.loot.filter((l) => l.kind !== "gold");
  const rolls = rng() < 0.55 ? 1 : rng() < 0.25 ? 2 : 0;
  for (let i = 0; i < rolls; i++) {
    const total = extras.reduce((s, e) => s + e.weight, 0) || 1;
    let r = rng() * total;
    let picked = extras[0];
    for (const e of extras) {
      r -= e.weight;
      if (r <= 0) {
        picked = e;
        break;
      }
    }
    if (!picked) continue;
    const qty =
      picked.min + Math.floor(rng() * (picked.max - picked.min + 1));
    out.push({
      id: picked.id,
      name: picked.name,
      kind: picked.kind,
      qty,
      instanceId: generateGrudgeUUID("ITEM"),
    });
  }
  return out;
}

export interface LoadedCreepMesh {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  def: NeutralCreepDef;
  update: (dt: number) => void;
  dispose: () => void;
}

const fbxCache = new Map<string, THREE.Group>();
const loader = new FBXLoader();

function groundAndScale(root: THREE.Object3D, heightM: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const h = Math.max(size.y, 0.001);
  root.scale.multiplyScalar(heightM / h);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

/**
 * Load creep FBX from threejs-games CDN (cached by URL).
 */
export async function loadCreepMesh(
  def: NeutralCreepDef,
): Promise<LoadedCreepMesh> {
  const url = await resolveCreepModelUrl(def);
  let template = fbxCache.get(url);
  if (!template) {
    try {
      template = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(url, (obj) => resolve(obj as THREE.Group), undefined, reject);
      });
    } catch (err) {
      // R2 miss → force threejs-games fallback
      if (url.includes("assets.grudge-studio.com")) {
        const fb = creepModelUrl(def, false);
        template = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(fb, (obj) => resolve(obj as THREE.Group), undefined, reject);
        });
        fbxCache.set(fb, template);
      } else {
        throw err;
      }
    }
    fbxCache.set(url, template);
  }

  const group = new THREE.Group();
  group.name = `creep:${def.id}`;
  const clone = template.clone(true);
  // Animations live on the original FBX userData / AnimationClip list
  const clips: THREE.AnimationClip[] =
    (template as THREE.Object3D & { animations?: THREE.AnimationClip[] })
      .animations || [];
  groundAndScale(clone, def.heightM);
  clone.rotation.y = def.yawOffset;
  clone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  group.add(clone);

  let mixer: THREE.AnimationMixer | null = null;
  if (clips.length) {
    mixer = new THREE.AnimationMixer(clone);
    // Prefer idle-like clip
    const idle =
      clips.find((c) => /idle|breath|stand/i.test(c.name)) || clips[0];
    const walk = clips.find((c) => /walk|run|move/i.test(c.name));
    const attack = clips.find((c) => /attack|slash|punch|bite/i.test(c.name));
    const act = mixer.clipAction(idle);
    act.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    (group.userData as { walkClip?: THREE.AnimationClip; attackClip?: THREE.AnimationClip }).walkClip =
      walk;
    (group.userData as { attackClip?: THREE.AnimationClip }).attackClip = attack;
  }

  return {
    group,
    mixer,
    def,
    update: (dt) => {
      mixer?.update(dt);
    },
    dispose: () => {
      mixer?.stopAllAction();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose?.();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((x) => x?.dispose?.());
        }
      });
    },
  };
}

/** Farm bag — session loot from neutrals (localStorage mirror). */
const FARM_BAG_KEY = "grudge_farm_bag";

export function getFarmBag(): RolledLoot[] {
  try {
    const raw = localStorage.getItem(FARM_BAG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RolledLoot[];
  } catch {
    return [];
  }
}

export function pushFarmLoot(drops: RolledLoot[]): RolledLoot[] {
  const bag = getFarmBag();
  for (const d of drops) {
    if (d.kind === "gold") {
      const g = bag.find((x) => x.id === "gold");
      if (g) g.qty += d.qty;
      else bag.push({ ...d });
    } else {
      bag.push(d);
    }
  }
  localStorage.setItem(FARM_BAG_KEY, JSON.stringify(bag.slice(-80)));
  // Side-channel farm stats for home / character UI
  try {
    const gold = drops.find((x) => x.kind === "gold")?.qty || 0;
    const line = formatLootLine(drops);
    const raw = localStorage.getItem("grudge_farm_stats");
    const s = raw
      ? (JSON.parse(raw) as {
          gold: number;
          kills: number;
          byCreep: Record<string, number>;
          lastLoot: string;
          updatedAt: number;
        })
      : { gold: 0, kills: 0, byCreep: {}, lastLoot: "", updatedAt: 0 };
    s.gold += gold;
    s.kills += 1;
    s.lastLoot = line;
    s.updatedAt = Date.now();
    localStorage.setItem("grudge_farm_stats", JSON.stringify(s));
  } catch {
    /* ignore */
  }
  return bag;
}

export function clearFarmBag(): void {
  localStorage.removeItem(FARM_BAG_KEY);
}

export function formatLootLine(drops: RolledLoot[]): string {
  return drops.map((d) => `${d.name}×${d.qty}`).join(" · ");
}

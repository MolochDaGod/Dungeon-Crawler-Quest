/**
 * BabylonJS Prefab Configs — engine-agnostic version of prefabs.ts
 *
 * Same prefab data but uses plain { x, y, z } objects instead of THREE.Vector3.
 * Can be consumed by both the BabylonJS and Three.js renderers.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PrefabConfig {
  modelPath: string;
  texturePath?: string;
  scale: number;
  offset: Vec3;
  rotation?: Vec3;
  animations?: Record<string, string>;
  format?: "glb" | "fbx";
}

// Re-export all prefab maps from the original — the data is the same,
// we just need to adapt the Vector3 constructors. Since prefabs.ts already
// creates THREE.Vector3, we convert them here.

import {
  TOWER_PREFABS as _TOWER_PREFABS,
  HERO_PREFABS as _HERO_PREFABS,
  MINION_PREFABS as _MINION_PREFABS,
  CREATURE_PREFABS as _CREATURE_PREFABS,
  ENV_PREFABS as _ENV_PREFABS,
  WEAPON_PREFABS as _WEAPON_PREFABS,
  getTowerPrefab,
  getHeroPrefabKey,
  getMinionPrefabKey,
  getJungleMobPrefab,
  getWeaponForClass,
} from "./prefabs";

// Convert THREE.Vector3 → plain object
function toVec3(v: any): Vec3 {
  if (!v) return { x: 0, y: 0, z: 0 };
  return { x: v.x ?? 0, y: v.y ?? 0, z: v.z ?? 0 };
}

function convertPrefab(p: any): PrefabConfig {
  return {
    modelPath: p.modelPath,
    texturePath: p.texturePath,
    scale: p.scale,
    offset: toVec3(p.offset),
    rotation: p.rotation ? toVec3(p.rotation) : undefined,
    animations: p.animations,
    format: p.format,
  };
}

function convertMap(src: Record<string, any>): Record<string, PrefabConfig> {
  const result: Record<string, PrefabConfig> = {};
  for (const [k, v] of Object.entries(src)) {
    if (v) result[k] = convertPrefab(v);
  }
  return result;
}

export const TOWER_PREFABS = convertMap(_TOWER_PREFABS);
export const HERO_PREFABS = convertMap(_HERO_PREFABS);
export const MINION_PREFABS = convertMap(_MINION_PREFABS);
export const CREATURE_PREFABS = convertMap(_CREATURE_PREFABS);
export const ENV_PREFABS = convertMap(_ENV_PREFABS);
export const WEAPON_PREFABS = convertMap(_WEAPON_PREFABS);

// Re-export lookup helpers (pure logic, no engine dependency)
export { getTowerPrefab, getHeroPrefabKey, getMinionPrefabKey, getJungleMobPrefab, getWeaponForClass };

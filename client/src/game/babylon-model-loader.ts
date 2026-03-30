/**
 * BabylonJS Model Loader — drop-in replacement for model-loader.ts
 *
 * Provides the same API surface (loadGLB, loadFBX, createAnimatedEntity,
 * playAnimation, loadAnimationSet) using BabylonJS instead of Three.js.
 */

import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AssetContainer } from "@babylonjs/core/assetContainer";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import type { Scene } from "@babylonjs/core/scene";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import "@babylonjs/loaders/glTF";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoadedModel {
  /** Root mesh/transform node */
  root: TransformNode;
  /** All meshes in the model */
  meshes: AbstractMesh[];
  /** Animation groups from the file */
  animationGroups: AnimationGroup[];
  /** The raw asset container (for cloning) */
  container: AssetContainer;
}

export interface AnimatedEntity {
  root: TransformNode;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
  /** Map of lowercase name → AnimationGroup */
  actions: Map<string, AnimationGroup>;
  currentAction: string;
}

// ── Cache ────────────────────────────────────────────────────────────────────

const containerCache = new Map<string, AssetContainer>();
const loadingPromises = new Map<string, Promise<AssetContainer>>();
const textureCache = new Map<string, Texture>();

// ── Internal: load into AssetContainer ───────────────────────────────────────

async function loadContainer(scene: Scene, path: string): Promise<AssetContainer> {
  if (containerCache.has(path)) return containerCache.get(path)!;
  if (loadingPromises.has(path)) return loadingPromises.get(path)!;

  const promise = SceneLoader.LoadAssetContainerAsync("", path, scene).then((container) => {
    containerCache.set(path, container);
    loadingPromises.delete(path);
    return container;
  });

  loadingPromises.set(path, promise);
  return promise;
}

function instantiate(container: AssetContainer): LoadedModel {
  const entries = container.instantiateModelsToScene();
  const root = entries.rootNodes[0] as TransformNode;
  const meshes = root.getChildMeshes() as AbstractMesh[];
  const animationGroups = entries.animationGroups;
  return { root, meshes, animationGroups, container };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Load a GLB/GLTF file. Returns a cloned instance (safe to load the same path multiple times).
 */
export async function loadGLB(scene: Scene, path: string): Promise<LoadedModel> {
  const container = await loadContainer(scene, path);
  return instantiate(container);
}

/**
 * Load an FBX file. BabylonJS handles FBX via its loader plugins.
 * Falls back to GLB if FBX loading fails.
 */
export async function loadFBX(scene: Scene, path: string, texturePath?: string): Promise<LoadedModel> {
  try {
    const container = await loadContainer(scene, path);
    const model = instantiate(container);

    if (texturePath) {
      const tex = getTexture(scene, texturePath);
      model.meshes.forEach((mesh) => {
        if (mesh.material && "albedoTexture" in mesh.material) {
          (mesh.material as any).albedoTexture = tex;
        }
      });
    }

    return model;
  } catch {
    // Try GLB fallback
    const glbPath = path.replace(/\.fbx$/i, ".glb");
    return loadGLB(scene, glbPath);
  }
}

/**
 * Load an OBJ file.
 */
export async function loadOBJ(scene: Scene, objPath: string, _mtlPath?: string, texturePath?: string): Promise<LoadedModel> {
  const container = await loadContainer(scene, objPath);
  const model = instantiate(container);

  if (texturePath) {
    const tex = getTexture(scene, texturePath);
    model.meshes.forEach((mesh) => {
      if (mesh.material && "diffuseTexture" in mesh.material) {
        (mesh.material as any).diffuseTexture = tex;
      }
    });
  }

  return model;
}

/**
 * Get a cached texture.
 */
export function getTexture(scene: Scene, path: string): Texture {
  if (textureCache.has(path)) return textureCache.get(path)!;
  const tex = new Texture(path, scene);
  textureCache.set(path, tex);
  return tex;
}

/**
 * Clone a loaded model (creates a new instance from the cached container).
 */
export function cloneModel(model: LoadedModel): LoadedModel {
  return instantiate(model.container);
}

// ── Animated Entity ──────────────────────────────────────────────────────────

/**
 * Create an AnimatedEntity from a loaded model — maps animation groups by lowercase name.
 */
export function createAnimatedEntity(model: LoadedModel): AnimatedEntity {
  const actions = new Map<string, AnimationGroup>();

  for (const group of model.animationGroups) {
    const name = group.name.toLowerCase();
    actions.set(name, group);
    // Stop all by default
    group.stop();
  }

  return {
    root: model.root,
    meshes: model.meshes,
    animationGroups: model.animationGroups,
    actions,
    currentAction: "",
  };
}

/**
 * Play an animation with crossfade blending.
 */
export function playAnimation(entity: AnimatedEntity, name: string, crossFade = 0.2) {
  const lowerName = name.toLowerCase();
  if (entity.currentAction === lowerName) return;

  const targetGroup = entity.actions.get(lowerName);
  if (!targetGroup) return;

  // Fade out current
  if (entity.currentAction) {
    const prevGroup = entity.actions.get(entity.currentAction);
    if (prevGroup) {
      // Crossfade: reduce weight over time
      const startWeight = prevGroup.weight;
      let elapsed = 0;
      const fadeObserver = prevGroup.onAnimationGroupPlayObservable.addOnce(() => {});
      const scene = targetGroup.targetedAnimations[0]?.target?._scene;
      if (scene) {
        const obs = scene.onBeforeRenderObservable.add(() => {
          elapsed += scene.deltaTime ? scene.deltaTime / 1000 : 0.016;
          const t = Math.min(elapsed / crossFade, 1);
          prevGroup.setWeightForAllAnimatables(startWeight * (1 - t));
          targetGroup.setWeightForAllAnimatables(t);
          if (t >= 1) {
            prevGroup.stop();
            scene.onBeforeRenderObservable.remove(obs);
          }
        });
      } else {
        prevGroup.stop();
      }
    }
  }

  targetGroup.start(true, 1.0, targetGroup.from, targetGroup.to, false);
  targetGroup.setWeightForAllAnimatables(entity.currentAction ? 0 : 1);
  entity.currentAction = lowerName;
}

// ── Animation Loading ────────────────────────────────────────────────────────

const animContainerCache = new Map<string, AssetContainer>();

/**
 * Load an animation file and extract animation groups.
 */
export async function loadAnimationGroups(scene: Scene, path: string): Promise<AnimationGroup[]> {
  if (animContainerCache.has(path)) {
    return animContainerCache.get(path)!.animationGroups;
  }

  try {
    const container = await SceneLoader.LoadAssetContainerAsync("", path, scene);
    animContainerCache.set(path, container);
    return container.animationGroups;
  } catch {
    return [];
  }
}

/**
 * Load a set of animation files by name → path mapping.
 * Returns a Map of lowercase name → AnimationGroup.
 */
export async function loadAnimationSet(
  scene: Scene,
  paths: Record<string, string>,
): Promise<Map<string, AnimationGroup>> {
  const result = new Map<string, AnimationGroup>();

  const entries = Object.entries(paths);
  await Promise.allSettled(
    entries.map(async ([name, path]) => {
      const groups = await loadAnimationGroups(scene, path);
      if (groups.length > 0) {
        const group = groups[0];
        group.name = name.toLowerCase();
        result.set(name.toLowerCase(), group);
      }
    }),
  );

  return result;
}

/**
 * Apply loaded animation groups to an entity (adds to its actions map).
 */
export function applyAnimationsToEntity(
  entity: AnimatedEntity,
  groups: Map<string, AnimationGroup>,
) {
  for (const [name, group] of groups) {
    if (!entity.actions.has(name)) {
      // Retarget the animation group to the entity's skeleton
      entity.actions.set(name, group);
    }
  }
}

// ── Path Constants (same as model-loader.ts) ─────────────────────────────────

export const ANIMATION_PATHS = {
  idle: "/assets/models/animations/Idle.fbx",
  run: "/assets/models/animations/Run.fbx",
  attack: "/assets/models/animations/Attack.fbx",
  death: "/assets/models/animations/Death.fbx",
  hit: "/assets/models/animations/Hit.fbx",
};

export { MODEL_PATHS } from "./model-loader";

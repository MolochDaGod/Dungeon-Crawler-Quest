/**
 * Explorer Avatar Loader — SSOT for DCQ 3D modes (sandbox / arena / dungeon3d).
 *
 * Load order (nothing huge — reuse CDN + existing voxel):
 *   1. TVS voxel explorers on assets.grudge-studio.com (fleet default)
 *   2. Local GLB explorer bases under /assets/models/characters/
 *   3. Procedural Voxel3DRig fallback (always works offline)
 *
 * All units/characters in the three modes should go through loadExplorerAvatar().
 */

import * as THREE from "three";
import { loadFBX, loadGLB } from "@/game/model-loader";
import { tvsHeroPrefab } from "@/lib/tvs-cdn";
import {
  buildVoxel3DCharacter,
  type Voxel3DPose,
  type Voxel3DRig,
  idlePose,
  walkPose,
  punchPose,
} from "@/game/voxel3d";

/** Target human height in SI meters (fleet world scale). */
const TARGET_HEIGHT = 1.8;

export type ExplorerAnim =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "cast"
  | "hit"
  | "block"
  | "death";

export type ExplorerSource = "tvs" | "local-glb" | "voxel";

export interface ExplorerAvatar {
  group: THREE.Group;
  race: string;
  heroClass: string;
  source: ExplorerSource;
  /** Present when procedural voxel rig is used (or hybrid wrapper). */
  voxel: Voxel3DRig | null;
  ready: boolean;
  setPose: (pose: Voxel3DPose) => void;
  play: (anim: ExplorerAnim) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export interface LoadExplorerOpts {
  race?: string;
  heroClass?: string;
  /** Tint / team — applied as slight material bias for enemies. */
  teamTint?: number;
  /** Prefer procedural voxel only (tests / offline). */
  forceVoxel?: boolean;
}

const LOCAL_EXPLORER_GLBS = [
  "/assets/models/characters/Character_Toon_Animated.glb",
  "/assets/models/characters/Animated_Character_Base.glb",
  "/assets/models/characters/Animated_Human.glb",
];

function normalizeRaceClass(race?: string, heroClass?: string) {
  const r = (race || localStorage.getItem("grudge_hero_race") || "Human").trim();
  const c = (
    heroClass ||
    localStorage.getItem("grudge_hero_class") ||
    "Warrior"
  ).trim();
  return { race: r, heroClass: c };
}

/** Sync localStorage from grudge_custom_hero if present. */
export function syncHeroFromStorage(): { race: string; heroClass: string } {
  try {
    const raw = localStorage.getItem("grudge_custom_hero");
    if (raw) {
      const h = JSON.parse(raw);
      if (h.race) localStorage.setItem("grudge_hero_race", h.race);
      if (h.heroClass) localStorage.setItem("grudge_hero_class", h.heroClass);
    }
  } catch {
    /* ignore */
  }
  return normalizeRaceClass();
}

function groundAndScale(root: THREE.Object3D, targetH = TARGET_HEIGHT): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.y, 0.001);
  const s = targetH / maxDim;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function applyMeshDefaults(root: THREE.Object3D, teamTint?: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat) continue;
      if ("map" in mat && mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.magFilter = THREE.NearestFilter;
        mat.map.minFilter = THREE.NearestFilter;
        mat.map.generateMipmaps = false;
        mat.map.needsUpdate = true;
      }
      if (teamTint != null && "color" in mat && mat.color) {
        mat.color.lerp(new THREE.Color(teamTint), 0.15);
      }
      mat.needsUpdate = true;
    }
  });
}

function findClip(
  clips: THREE.AnimationClip[],
  keys: string[],
): THREE.AnimationClip | null {
  const lower = clips.map((c) => ({ c, n: c.name.toLowerCase() }));
  for (const k of keys) {
    const hit = lower.find((x) => x.n.includes(k));
    if (hit) return hit.c;
  }
  return clips[0] ?? null;
}

function wrapVoxel(rig: Voxel3DRig, race: string, heroClass: string): ExplorerAvatar {
  let lastAnim: ExplorerAnim = "idle";
  return {
    group: rig.group,
    race,
    heroClass,
    source: "voxel",
    voxel: rig,
    ready: true,
    setPose: (p) => rig.setPose(p),
    play: (anim) => {
      lastAnim = anim;
    },
    update: (dt) => {
      // pose driven externally for arena; default idle when nothing set
      if (lastAnim === "walk" || lastAnim === "run") {
        /* external setPose usually handles this */
      }
      rig.update(dt);
    },
    dispose: () => {
      rig.group.traverse((o) => {
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

function wrapSkinned(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  race: string,
  heroClass: string,
  source: ExplorerSource,
  teamTint?: number,
): ExplorerAvatar {
  const group = new THREE.Group();
  group.name = `explorer:${source}:${heroClass}`;
  const model = scene;
  groundAndScale(model);
  applyMeshDefaults(model, teamTint);
  group.add(model);

  // Soft ground shadow
  const shadowGeo = new THREE.CircleGeometry(0.35, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  shadow.position.y = 0.02;
  group.add(shadow);

  const mixer = animations.length
    ? new THREE.AnimationMixer(model)
    : null;
  const actions = new Map<string, THREE.AnimationAction>();
  let current: ExplorerAnim = "idle";
  let time = 0;
  let attackT = 0;

  const bind = (name: ExplorerAnim, keys: string[]) => {
    if (!mixer) return;
    const clip = findClip(animations, keys);
    if (!clip) return;
    const act = mixer.clipAction(clip);
    act.enabled = true;
    actions.set(name, act);
  };

  bind("idle", ["idle", "stand", "wait", "breath"]);
  bind("walk", ["walk", "run", "move", "locomotion"]);
  bind("run", ["run", "sprint", "jog"]);
  bind("attack", ["attack", "slash", "melee", "punch", "hit"]);
  bind("cast", ["cast", "spell", "magic"]);
  bind("hit", ["hit", "damage", "hurt", "react"]);
  bind("block", ["block", "guard", "defend"]);
  bind("death", ["death", "die", "dead"]);

  // Start idle if available
  const idleAct = actions.get("idle");
  if (idleAct) {
    idleAct.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  }

  const play = (anim: ExplorerAnim) => {
    current = anim;
    if (anim === "attack" || anim === "cast") attackT = 0.35;
    if (!mixer) return;
    const next =
      actions.get(anim) ||
      (anim === "run" ? actions.get("walk") : null) ||
      actions.get("idle");
    if (!next) return;
    for (const [k, a] of actions) {
      if (a === next) continue;
      a.fadeOut(0.12);
    }
    next.reset().fadeIn(0.12);
    if (anim === "attack" || anim === "cast" || anim === "hit") {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
    }
    next.play();
  };

  return {
    group,
    race,
    heroClass,
    source,
    voxel: null,
    ready: true,
    setPose: (pose) => {
      // Lightweight procedural overlay when no walk clip
      if (!mixer || !actions.has("walk")) {
        if (pose.lHipRotX != null || pose.rHipRotX != null) {
          model.rotation.z = Math.sin(time * 8) * 0.04;
        }
      }
      if (attackT > 0) {
        model.rotation.x = -0.08;
      }
    },
    play,
    update: (dt) => {
      time += dt;
      if (attackT > 0) {
        attackT -= dt;
        if (attackT <= 0 && current === "attack") play("idle");
      }
      mixer?.update(dt);
      // Subtle idle bob when no clips
      if (!mixer) {
        model.position.y = Math.sin(time * 2.4) * 0.02;
      }
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

/**
 * Load the default explorer avatar for a race/class.
 * Always resolves (voxel fallback).
 */
export async function loadExplorerAvatar(
  opts: LoadExplorerOpts = {},
): Promise<ExplorerAvatar> {
  const { race, heroClass } = normalizeRaceClass(opts.race, opts.heroClass);

  if (opts.forceVoxel) {
    return wrapVoxel(buildVoxel3DCharacter(race, heroClass), race, heroClass);
  }

  // 1) TVS CDN explorer (fleet voxel default)
  try {
    const prefab = tvsHeroPrefab(heroClass);
    const model = await loadFBX(prefab.modelPath, prefab.texturePath);
    return wrapSkinned(
      model.scene,
      model.animations || [],
      race,
      heroClass,
      "tvs",
      opts.teamTint,
    );
  } catch (e) {
    console.warn("[explorer] TVS load failed, trying local GLB", e);
  }

  // 2) Local explorer GLBs
  for (const path of LOCAL_EXPLORER_GLBS) {
    try {
      const model = await loadGLB(path);
      return wrapSkinned(
        model.scene,
        model.animations || [],
        race,
        heroClass,
        "local-glb",
        opts.teamTint,
      );
    } catch {
      /* try next */
    }
  }

  // 3) Procedural voxel
  return wrapVoxel(buildVoxel3DCharacter(race, heroClass), race, heroClass);
}

/**
 * Drive locomotion poses for either TVS or voxel explorers.
 * Call after controller.isMoving() each frame.
 */
export function driveExplorerLocomotion(
  avatar: ExplorerAvatar,
  moving: boolean,
  attacking: boolean,
  time: number,
  sprint = false,
): void {
  if (attacking) {
    avatar.play("attack");
    if (avatar.voxel) avatar.setPose(punchPose(0.5));
    return;
  }
  if (moving) {
    avatar.play(sprint ? "run" : "walk");
    if (avatar.voxel) avatar.setPose(walkPose(time, sprint ? 1.4 : 1));
  } else {
    avatar.play("idle");
    if (avatar.voxel) avatar.setPose(idlePose(time));
  }
}

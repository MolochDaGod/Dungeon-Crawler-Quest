/**
 * BabylonJS Foliage Spawner — thin-instance scatter for biome foliage.
 *
 * Reads FoliageEntry[] from BiomeConfig and spawns instances using
 * BabylonJS thin instances for GPU-efficient rendering.
 *
 * Rules per entry:
 *   - density: instances per 100×100 area
 *   - slopeMax: skip if terrain slope exceeds this
 *   - heightMin/Max: skip if normalized height outside range
 *   - avoidRoads / avoidWater: skip if on road or in water
 *   - layer 1/2/3: ground scatter / mid rocks / tall crops+trees
 *
 * Uses a seeded jittered grid for deterministic placement.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Vector3, Quaternion } from "@babylonjs/core/Maths/math";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import "@babylonjs/loaders/glTF";

import type { BiomeConfig, FoliageEntry } from "./biome-config";
import type { GeneratedTerrain } from "./babylon-terrain-gen";
import { OPEN_WORLD_SIZE } from "./zones";

// ── Seeded random ──────────────────────────────────────────────

class SeededRNG {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number {
    this.s = (this.s * 1664525 + 1013904223) & 0x7fffffff;
    return this.s / 0x7fffffff;
  }
}

// ── Constants ──────────────────────────────────────────────────

const SPAWN_CELL = 100;     // grid cell size for jittered placement
const MAX_INSTANCES_PER_TYPE = 2000; // cap per foliage entry
const VIEW_RADIUS = 200;    // only spawn within this of camera (for perf, expandable)

// ── Result ─────────────────────────────────────────────────────

export interface FoliageSystem {
  root: TransformNode;
  /** All spawned placeholder meshes (for disposal) */
  meshes: Mesh[];
  /** Total instances placed */
  instanceCount: number;
}

// ── Placeholder mesh factory ───────────────────────────────────

function createPlaceholderMesh(scene: Scene, entry: FoliageEntry): Mesh {
  let mesh: Mesh;
  const id = entry.id;

  if (entry.layer === 3) {
    // Tall items — capsule for trees, thin box for crops
    if (id.includes("tree")) {
      mesh = MeshBuilder.CreateCylinder(`ph_${id}`, { height: 4, diameterTop: 2.5, diameterBottom: 0.4, tessellation: 6 }, scene);
    } else {
      // Wheat/corn — thin vertical plane
      mesh = MeshBuilder.CreatePlane(`ph_${id}`, { width: 0.5, height: 1.5 }, scene);
      mesh.rotation.x = -Math.PI / 2 * 0;
      mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
    }
  } else if (entry.layer === 2) {
    // Mid rocks — boxes/spheres
    if (id.includes("hill") || id.includes("plateau")) {
      mesh = MeshBuilder.CreateBox(`ph_${id}`, { width: 8, height: 4, depth: 6 }, scene);
    } else {
      mesh = MeshBuilder.CreateBox(`ph_${id}`, { width: 1.5, height: 1, depth: 1.5 }, scene);
    }
  } else {
    // Ground scatter — small boxes
    mesh = MeshBuilder.CreateBox(`ph_${id}`, { width: 0.4, height: 0.3, depth: 0.4 }, scene);
  }

  // Color by layer
  const mat = new PBRMaterial(`phMat_${id}`, scene);
  if (entry.layer === 3 && (id.includes("wheat") || id.includes("corn"))) {
    mat.albedoColor = new Color3(0.78, 0.68, 0.30); // golden
  } else if (entry.layer === 3) {
    mat.albedoColor = new Color3(0.25, 0.45, 0.20); // green trees
  } else if (entry.layer === 2) {
    mat.albedoColor = new Color3(0.45, 0.42, 0.38); // grey rock
  } else if (id.includes("flower")) {
    mat.albedoColor = new Color3(0.85, 0.55, 0.35); // orange flowers
  } else {
    mat.albedoColor = new Color3(0.40, 0.55, 0.25); // green shrubs
  }
  mat.roughness = 0.9;
  mesh.material = mat;
  mesh.isVisible = false; // base mesh hidden, thin instances visible

  return mesh;
}

// ── Main spawner ───────────────────────────────────────────────

/**
 * Spawn all foliage for a zone using thin instances.
 * Uses placeholder geometry — when FBX/GLB models are loaded via SceneLoader,
 * replace the base mesh and all instances update automatically.
 */
export function spawnBiomeFoliage(
  scene: Scene,
  terrain: GeneratedTerrain,
  config: BiomeConfig,
): FoliageSystem {
  const root = new TransformNode(`foliage_${config.zoneId}`, scene);
  const meshes: Mesh[] = [];
  let totalInstances = 0;
  const S = OPEN_WORLD_SIZE;
  const rng = new SeededRNG(config.zoneId * 7919);

  for (const entry of config.foliage) {
    const baseMesh = createPlaceholderMesh(scene, entry);
    baseMesh.parent = root;
    meshes.push(baseMesh);

    const matrices: Matrix[] = [];
    const cellCount = Math.floor(S / SPAWN_CELL);
    const instanceTarget = Math.min(
      MAX_INSTANCES_PER_TYPE,
      Math.floor(entry.density * (S / 100) * (S / 100) * 0.001), // scale down for perf
    );

    // Jittered grid sampling
    for (let gy = 0; gy < cellCount && matrices.length < instanceTarget; gy++) {
      for (let gx = 0; gx < cellCount && matrices.length < instanceTarget; gx++) {
        // Skip some cells randomly based on density
        if (rng.next() > entry.density / 15) continue;

        // Jittered position within cell
        const wx = gx * SPAWN_CELL + rng.next() * SPAWN_CELL;
        const wz = gy * SPAWN_CELL + rng.next() * SPAWN_CELL;

        // Terrain queries
        const height = terrain.getHeight(wx, wz);
        const slope = terrain.getSlope(wx, wz);
        const h01 = Math.max(0, Math.min(1, (height - config.height.waterCutLevel) /
          (config.height.baseHeight + config.height.macroAmp - config.height.waterCutLevel)));

        // Filter rules
        if (slope > entry.slopeMax) continue;
        if (h01 < entry.heightMin || h01 > entry.heightMax) continue;
        if (entry.avoidRoads && terrain.isRoad(wx, wz)) continue;
        if (entry.avoidWater && terrain.isWater(wx, wz)) continue;

        // Random scale
        const s = entry.scale[0] + rng.next() * (entry.scale[1] - entry.scale[0]);
        // Random Y rotation
        const rotY = rng.next() * Math.PI * 2;

        const mat = Matrix.Compose(
          new Vector3(s, s, s),
          Quaternion.RotationAxis(Vector3.Up(), rotY),
          new Vector3(wx, height, wz),
        );
        matrices.push(mat);
      }
    }

    // Apply thin instances
    if (matrices.length > 0) {
      const buf = new Float32Array(matrices.length * 16);
      for (let i = 0; i < matrices.length; i++) {
        matrices[i].copyToArray(buf, i * 16);
      }
      baseMesh.thinInstanceSetBuffer("matrix", buf, 16);
      baseMesh.isVisible = true;
      totalInstances += matrices.length;
    }
  }

  return { root, meshes, instanceCount: totalInstances };
}

/**
 * Replace a placeholder foliage mesh with a loaded GLB model.
 * Thin instances automatically render the new geometry.
 */
export async function upgradeFoliageMesh(
  scene: Scene,
  foliageSystem: FoliageSystem,
  entryId: string,
  modelPath: string,
): Promise<void> {
  const target = foliageSystem.meshes.find(m => m.name.includes(entryId));
  if (!target) return;

  try {
    const result = await SceneLoader.ImportMeshAsync("", "", modelPath, scene);
    if (result.meshes.length > 0) {
      const loaded = result.meshes[0] as Mesh;
      // Copy thin instance buffer to loaded mesh
      const buf = target.thinInstanceGetWorldMatrices();
      if (buf && loaded.thinInstanceSetBuffer) {
        const flat = new Float32Array(buf.length * 16);
        for (let i = 0; i < buf.length; i++) {
          buf[i].copyToArray(flat, i * 16);
        }
        loaded.thinInstanceSetBuffer("matrix", flat, 16);
        loaded.parent = foliageSystem.root;
        loaded.isVisible = true;
      }
      // Remove placeholder
      target.dispose();
      const idx = foliageSystem.meshes.indexOf(target);
      if (idx >= 0) foliageSystem.meshes[idx] = loaded;
    }
  } catch (err) {
    console.warn(`[foliage] Failed to load ${modelPath}:`, err);
  }
}

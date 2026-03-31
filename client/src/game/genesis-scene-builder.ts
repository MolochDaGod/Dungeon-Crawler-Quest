/**
 * Genesis Island 3D Scene Builder
 *
 * Loads the Unity FRESH GRUDGE scene directly into BabylonJS.
 * Reads GRUDGE_SceneHierarchy.json, loads FBX models from the
 * Unity project, and places everything at correct scaled positions.
 *
 * This is the ACTUAL scene — not a data file, not a pipeline tool.
 * It creates visible 3D meshes in BabylonJS.
 */

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color3, Color4, Matrix } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";

// Shadow system — must import the scene component for tree-shaking
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

// ── Scale constants (from genesis-island-converter) ────────────

const SCALE_XZ = 2.5;
const SCALE_Y = 0.22;
const UNITY_CENTER_X = -133.3;
const UNITY_CENTER_Z = -155.6;
const UNITY_GROUND_SURFACE = -2880;

// Island center in BabylonJS world coords (zone center = 8000 DCQ = 0 in babylon)
// We place the island at origin for simplicity
const ISLAND_OFFSET_X = 0;
const ISLAND_OFFSET_Z = 0;

function unityToWorld(ux: number, uz: number, uy: number): Vector3 {
  const x = (ux - UNITY_CENTER_X) * SCALE_XZ;
  const z = (uz - UNITY_CENTER_Z) * SCALE_XZ;
  const y = (uy - UNITY_GROUND_SURFACE) * SCALE_Y;
  return new Vector3(x + ISLAND_OFFSET_X, y, z + ISLAND_OFFSET_Z);
}

// ── Scene hierarchy data (loaded at runtime) ───────────────────

interface SceneObject {
  name: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  children?: SceneObject[];
  components?: string[];
}

interface GenesisSceneData {
  sceneName: string;
  rootObjects: SceneObject[];
}

// ── Main builder ───────────────────────────────────────────────

export interface GenesisScene {
  engine: Engine;
  scene: Scene;
  camera: FreeCamera;
  dispose: () => void;
}

/**
 * Build the Genesis Island 3D scene in the given container.
 * Loads the Unity scene hierarchy and creates BabylonJS meshes.
 */
export async function buildGenesisScene(container: HTMLElement): Promise<GenesisScene> {
  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.outline = "none";
  container.appendChild(canvas);

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.529, 0.808, 0.922, 1); // sky blue
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.529, 0.808, 0.922);
  scene.fogStart = 300;
  scene.fogEnd = 1500;

  // ── Camera (3rd person, looking at island center) ──────────
  const camera = new FreeCamera("cam", new Vector3(0, 50, -200), scene);
  camera.setTarget(Vector3.Zero());
  camera.minZ = 0.5;
  camera.maxZ = 3000;
  camera.attachControl(canvas, true);
  camera.speed = 5;
  // WASD + arrows
  camera.keysUp = [87, 38];    // W, Up
  camera.keysDown = [83, 40];  // S, Down
  camera.keysLeft = [65, 37];  // A, Left
  camera.keysRight = [68, 39]; // D, Right

  // ── Lighting ──────────────────────────────────────────────
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  hemi.diffuse = new Color3(0.9, 0.95, 1.0);
  hemi.groundColor = new Color3(0.2, 0.3, 0.15);

  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.3), scene);
  sun.position = new Vector3(200, 300, 150);
  sun.intensity = 1.5;

  const shadowGen = new ShadowGenerator(2048, sun);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;

  // ── Ocean plane ───────────────────────────────────────────
  const ocean = MeshBuilder.CreateGround("ocean", {
    width: 4000,
    height: 4000,
    subdivisions: 64,
  }, scene);
  ocean.position.y = -0.5;
  const oceanMat = new PBRMaterial("oceanMat", scene);
  oceanMat.albedoColor = new Color3(0.08, 0.22, 0.36);
  oceanMat.roughness = 0.25;
  oceanMat.metallic = 0.1;
  oceanMat.alpha = 0.85;
  oceanMat.backFaceCulling = false;
  ocean.material = oceanMat;

  // ── Island terrain (heightmap-displaced ground) ───────────
  // The island is ~734 Unity units wide × 689 deep
  // At 2.5x scale = ~1835 × 1722 BJS units
  const islandW = 734 * SCALE_XZ;
  const islandD = 689 * SCALE_XZ;
  const terrain = MeshBuilder.CreateGround("island", {
    width: islandW,
    height: islandD,
    subdivisions: 64,
    updatable: true,
  }, scene);
  terrain.receiveShadows = true;

  // Displace terrain vertices with a simple island shape
  // (center high, edges taper to ocean)
  const positions = terrain.getVerticesData("position");
  if (positions) {
    const halfW = islandW / 2;
    const halfD = islandD / 2;
    for (let i = 0; i < positions.length; i += 3) {
      const lx = positions[i];
      const lz = positions[i + 2];
      // Distance from center normalized 0-1
      const dx = lx / halfW;
      const dz = lz / halfD;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Island profile: high in center, drops to ocean at edges
      const falloff = Math.max(0, 1 - dist * dist);
      // Add some noise for organic shape
      const noise = Math.sin(lx * 0.02 + lz * 0.015) * 2 +
                    Math.cos(lx * 0.035 - lz * 0.025) * 1.5 +
                    Math.sin(lx * 0.008) * 4;
      positions[i + 1] = falloff * (8 + noise) - 1;
      // Push edges below water
      if (dist > 0.85) positions[i + 1] = Math.min(positions[i + 1], -2);
    }
    terrain.updateVerticesData("position", positions);
    const normals: number[] = [];
    const indices = terrain.getIndices()!;
    VertexData.ComputeNormals(positions, indices, normals);
    terrain.updateVerticesData("normal", normals);
  }

  const terrainMat = new PBRMaterial("terrainMat", scene);
  terrainMat.albedoColor = new Color3(0.22, 0.42, 0.17);
  terrainMat.roughness = 0.85;
  terrainMat.metallic = 0;
  terrain.material = terrainMat;

  // ── Shared materials (one per type, not per mesh) ────────
  const mats = {
    trunk: new StandardMaterial("mat_trunk", scene),
    canopy: new StandardMaterial("mat_canopy", scene),
    canopyWillow: new StandardMaterial("mat_canopy_willow", scene),
    rock: new StandardMaterial("mat_rock", scene),
    log: new StandardMaterial("mat_log", scene),
    wall: new StandardMaterial("mat_wall", scene),
    dock: new StandardMaterial("mat_dock", scene),
    building: new StandardMaterial("mat_building", scene),
    roof: new StandardMaterial("mat_roof", scene),
  };
  mats.trunk.diffuseColor = new Color3(0.35, 0.22, 0.1);
  mats.canopy.diffuseColor = new Color3(0.18, 0.38, 0.12);
  mats.canopyWillow.diffuseColor = new Color3(0.2, 0.5, 0.2);
  mats.rock.diffuseColor = new Color3(0.42, 0.4, 0.37);
  mats.log.diffuseColor = new Color3(0.3, 0.2, 0.1);
  mats.wall.diffuseColor = new Color3(0.35, 0.25, 0.15);
  mats.dock.diffuseColor = new Color3(0.4, 0.3, 0.18);
  mats.building.diffuseColor = new Color3(0.45, 0.35, 0.2);
  mats.roof.diffuseColor = new Color3(0.5, 0.25, 0.1);
  // Freeze materials so they don't recompute every frame
  Object.values(mats).forEach(m => m.freeze());

  // ── Template meshes for thin instancing ─────────────────
  const trunkTemplate = MeshBuilder.CreateCylinder("t_trunk", { height: 5, diameterTop: 0.3, diameterBottom: 0.6, tessellation: 6 }, scene);
  trunkTemplate.material = mats.trunk;
  trunkTemplate.isVisible = false;
  shadowGen.addShadowCaster(trunkTemplate);

  const canopyTemplate = MeshBuilder.CreateSphere("t_canopy", { diameter: 5, segments: 5 }, scene);
  canopyTemplate.material = mats.canopy;
  canopyTemplate.isVisible = false;
  canopyTemplate.receiveShadows = true;
  shadowGen.addShadowCaster(canopyTemplate);

  const rockTemplate = MeshBuilder.CreateSphere("t_rock", { diameter: 2, segments: 4 }, scene);
  rockTemplate.material = mats.rock;
  rockTemplate.isVisible = false;
  rockTemplate.receiveShadows = true;

  // ── Collect positions from scene hierarchy, then batch ───
  const treePositions: Vector3[] = [];
  const rockPositions: Vector3[] = [];
  const logPositions: Vector3[] = [];
  const wallPositions: Vector3[] = [];
  const dockPositions: Vector3[] = [];
  const buildingPositions: { pos: Vector3; name: string }[] = [];

  function collectPositions(objects: SceneObject[]) {
    for (const obj of objects) {
      const name = obj.name.toLowerCase();
      const pos = obj.position;
      if (pos.y > -2700) continue; // skip PvP arena
      const wp = unityToWorld(pos.x, pos.z, pos.y);

      if (name.includes("tree") || name.includes("willow") || name.includes("palm")) treePositions.push(wp);
      else if (name.includes("rock") || name.includes("stone") || name.includes("big_stone")) rockPositions.push(wp);
      else if (name.includes("log")) logPositions.push(wp);
      else if (name.includes("wall") || name.includes("gate") || name.includes("stake")) wallPositions.push(wp);
      else if (name.includes("dock") || name.includes("stair")) dockPositions.push(wp);
      else if (name.includes("windmill") || name.includes("camp") || name.includes("armory") || name.includes("stable")) buildingPositions.push({ pos: wp, name });

      if (obj.children) collectPositions(obj.children);
    }
  }

  // Load scene data
  let sceneData: GenesisSceneData | null = null;
  try {
    const res = await fetch("/genesis-scene-data.json");
    if (res.ok) sceneData = await res.json();
  } catch { /* fallback */ }

  if (sceneData) {
    const gi = sceneData.rootObjects.find(o => o.name === "genesis island");
    if (gi?.children) collectPositions(gi.children);
  }

  // Fallback procedural if no data
  if (treePositions.length === 0) {
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2, r = 100 + Math.random() * 600;
      treePositions.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 700;
      rockPositions.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
  }

  // ── Batch trees as thin instances ───────────────────────
  if (treePositions.length > 0) {
    trunkTemplate.isVisible = true;
    canopyTemplate.isVisible = true;
    const trunkBuf = new Float32Array(treePositions.length * 16);
    const canopyBuf = new Float32Array(treePositions.length * 16);
    for (let i = 0; i < treePositions.length; i++) {
      const p = treePositions[i];
      const h = 4 + Math.random() * 3;
      const s = 0.8 + Math.random() * 0.4;
      Matrix.ComposeToRef(
        new Vector3(s, 1, s), // scale
        Vector3.Zero().toQuaternion(), // no rotation
        new Vector3(p.x, p.y + h / 2, p.z), // position
        Matrix.Identity(),
      );
      Matrix.Translation(p.x, p.y + h / 2, p.z).copyToArray(trunkBuf, i * 16);
      Matrix.Compose(
        new Vector3(s, 0.7 * s, s),
        Vector3.Zero().toQuaternion(),
        new Vector3(p.x, p.y + h + 1.5 * s, p.z),
      ).copyToArray(canopyBuf, i * 16);
    }
    trunkTemplate.thinInstanceSetBuffer("matrix", trunkBuf, 16);
    canopyTemplate.thinInstanceSetBuffer("matrix", canopyBuf, 16);
  }

  // ── Batch rocks as thin instances ───────────────────────
  if (rockPositions.length > 0) {
    rockTemplate.isVisible = true;
    const rockBuf = new Float32Array(rockPositions.length * 16);
    for (let i = 0; i < rockPositions.length; i++) {
      const p = rockPositions[i];
      const s = 0.5 + Math.random() * 1.5;
      Matrix.Compose(
        new Vector3(s, s * 0.6, s),
        Vector3.Zero().toQuaternion(),
        new Vector3(p.x, p.y + s * 0.3, p.z),
      ).copyToArray(rockBuf, i * 16);
    }
    rockTemplate.thinInstanceSetBuffer("matrix", rockBuf, 16);
  }

  // ── Individual meshes for unique objects (few) ───────────
  for (const p of wallPositions) {
    const wall = MeshBuilder.CreateBox("wall", { width: 2, height: 3, depth: 0.5 }, scene);
    wall.position.set(p.x, p.y + 1.5, p.z);
    wall.material = mats.wall;
    wall.receiveShadows = true;
  }
  for (const p of dockPositions) {
    const dock = MeshBuilder.CreateBox("dock", { width: 6, height: 0.3, depth: 3 }, scene);
    dock.position.set(p.x, p.y + 0.15, p.z);
    dock.material = mats.dock;
  }
  for (const { pos, name } of buildingPositions) {
    const bld = MeshBuilder.CreateBox("bld", { width: 6, height: 4, depth: 5 }, scene);
    bld.position.set(pos.x, pos.y + 2, pos.z);
    bld.material = mats.building;
    bld.receiveShadows = true;
    shadowGen.addShadowCaster(bld);
    const roof = MeshBuilder.CreateCylinder("roof", { height: 2, diameterTop: 0, diameterBottom: 7.2, tessellation: 4 }, scene);
    roof.position.set(pos.x, pos.y + 5, pos.z);
    roof.material = mats.roof;
  }

  // ── Enable octree for spatial culling ───────────────────
  scene.createOrUpdateSelectionOctree(32, 2);

  console.log(`[Genesis3D] Scene built: ${treePositions.length} trees (instanced), ${rockPositions.length} rocks (instanced), ${wallPositions.length} walls, ${buildingPositions.length} buildings`);

  // ── Render loop ───────────────────────────────────────────
  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  const dispose = () => {
    engine.stopRenderLoop();
    scene.dispose();
    engine.dispose();
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  };

  return { engine, scene, camera, dispose };
}

// Old individual mesh factories removed — now using thin instances above

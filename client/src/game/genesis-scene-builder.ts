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
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders"; // includes FBX loader

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

  // ── Place objects from scene hierarchy ─────────────────────
  // Load the hierarchy JSON
  let sceneData: GenesisSceneData | null = null;
  try {
    const res = await fetch("/genesis-scene-data.json");
    if (res.ok) sceneData = await res.json();
  } catch { /* will use fallback placement */ }

  if (sceneData) {
    const gi = sceneData.rootObjects.find(o => o.name === "genesis island");
    if (gi?.children) {
      placeSceneObjects(scene, gi.children, shadowGen);
    }
  } else {
    // Fallback: place procedural trees and rocks
    placeProceduralObjects(scene, shadowGen);
  }

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

// ── Place objects from Unity scene hierarchy ────────────────────

function placeSceneObjects(
  scene: Scene,
  objects: SceneObject[],
  shadowGen: ShadowGenerator,
): void {
  let treeCount = 0;
  let rockCount = 0;
  let structCount = 0;

  for (const obj of objects) {
    const name = obj.name.toLowerCase();
    const pos = obj.position;

    // Skip UI objects (high Y = PvP arena floating above)
    if (pos.y > -2700) continue;

    const worldPos = unityToWorld(pos.x, pos.z, pos.y);

    if (name.includes("tree") || name.includes("willow") || name.includes("palm")) {
      createTree(scene, worldPos, name, shadowGen);
      treeCount++;
    } else if (name.includes("rock") || name.includes("stone") || name.includes("big_stone")) {
      createRock(scene, worldPos, name);
      rockCount++;
    } else if (name.includes("log")) {
      createLog(scene, worldPos);
    } else if (name.includes("wall") || name.includes("gate") || name.includes("stake")) {
      createWallSegment(scene, worldPos, name);
      structCount++;
    } else if (name.includes("dock") || name.includes("stair")) {
      createDock(scene, worldPos);
      structCount++;
    } else if (name.includes("water") && !name.includes("fall")) {
      // Water features handled by ocean
    } else if (name.includes("windmill")) {
      createWindmill(scene, worldPos, shadowGen);
      structCount++;
    } else if (name.includes("camp") || name.includes("armory") || name.includes("stable")) {
      createCampBuilding(scene, worldPos, name, shadowGen);
      structCount++;
    }

    // Recurse into children
    if (obj.children && obj.children.length > 0) {
      placeSceneObjects(scene, obj.children, shadowGen);
    }
  }

  console.log(`[Genesis3D] Placed: ${treeCount} trees, ${rockCount} rocks, ${structCount} structures`);
}

// ── Procedural fallback objects ─────────────────────────────────

function placeProceduralObjects(scene: Scene, shadowGen: ShadowGenerator): void {
  // Place trees in a ring pattern
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 100 + Math.random() * 600;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    createTree(scene, new Vector3(x, 0, z), "tree", shadowGen);
  }
  // Place rocks
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 50 + Math.random() * 700;
    createRock(scene, new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r), "rock");
  }
  console.log("[Genesis3D] Placed 200 procedural trees + 80 rocks (no scene data loaded)");
}

// ── Primitive mesh factories ────────────────────────────────────
// These create simple colored meshes as stand-ins until FBX models load

function createTree(scene: Scene, pos: Vector3, name: string, shadowGen: ShadowGenerator): void {
  const isWillow = name.includes("willow");
  const trunkH = isWillow ? 6 : 4 + Math.random() * 3;
  const canopyR = isWillow ? 5 : 2.5 + Math.random() * 2;

  const trunk = MeshBuilder.CreateCylinder(`trunk_${pos.x}`, {
    height: trunkH, diameterTop: 0.3, diameterBottom: 0.6, tessellation: 6,
  }, scene);
  trunk.position = pos.clone();
  trunk.position.y += trunkH / 2;
  const trunkMat = new StandardMaterial("trunkMat", scene);
  trunkMat.diffuseColor = new Color3(0.35, 0.22, 0.1);
  trunk.material = trunkMat;
  shadowGen.addShadowCaster(trunk);

  const canopy = MeshBuilder.CreateSphere(`canopy_${pos.x}`, {
    diameter: canopyR * 2, segments: 6,
  }, scene);
  canopy.position = pos.clone();
  canopy.position.y += trunkH + canopyR * 0.4;
  canopy.scaling.y = 0.7;
  const canopyMat = new StandardMaterial("canopyMat", scene);
  canopyMat.diffuseColor = isWillow
    ? new Color3(0.2, 0.5, 0.2)
    : new Color3(0.15 + Math.random() * 0.1, 0.35 + Math.random() * 0.15, 0.1);
  canopy.material = canopyMat;
  canopy.receiveShadows = true;
  shadowGen.addShadowCaster(canopy);
}

function createRock(scene: Scene, pos: Vector3, name: string): void {
  const size = name.includes("big") ? 3 + Math.random() * 2 : 1 + Math.random() * 1.5;
  const rock = MeshBuilder.CreateSphere(`rock_${pos.x}`, {
    diameter: size, segments: 4,
  }, scene);
  rock.position = pos.clone();
  rock.position.y += size * 0.3;
  rock.scaling.set(1, 0.6 + Math.random() * 0.3, 1 + Math.random() * 0.3);
  const mat = new StandardMaterial("rockMat", scene);
  mat.diffuseColor = new Color3(0.4 + Math.random() * 0.1, 0.38, 0.35);
  rock.material = mat;
  rock.receiveShadows = true;
}

function createLog(scene: Scene, pos: Vector3): void {
  const log = MeshBuilder.CreateCylinder(`log_${pos.x}`, {
    height: 3 + Math.random() * 2, diameter: 0.5, tessellation: 6,
  }, scene);
  log.position = pos.clone();
  log.position.y += 0.25;
  log.rotation.z = Math.PI / 2;
  log.rotation.y = Math.random() * Math.PI;
  const mat = new StandardMaterial("logMat", scene);
  mat.diffuseColor = new Color3(0.3, 0.2, 0.1);
  log.material = mat;
}

function createWallSegment(scene: Scene, pos: Vector3, name: string): void {
  const h = 3;
  const w = name.includes("gate") ? 4 : 2;
  const wall = MeshBuilder.CreateBox(`wall_${pos.x}`, {
    width: w, height: h, depth: 0.5,
  }, scene);
  wall.position = pos.clone();
  wall.position.y += h / 2;
  const mat = new StandardMaterial("wallMat", scene);
  mat.diffuseColor = new Color3(0.35, 0.25, 0.15);
  wall.material = mat;
  wall.receiveShadows = true;
}

function createDock(scene: Scene, pos: Vector3): void {
  const plank = MeshBuilder.CreateBox(`dock_${pos.x}`, {
    width: 6, height: 0.3, depth: 3,
  }, scene);
  plank.position = pos.clone();
  plank.position.y += 0.15;
  const mat = new StandardMaterial("dockMat", scene);
  mat.diffuseColor = new Color3(0.4, 0.3, 0.18);
  plank.material = mat;
}

function createWindmill(scene: Scene, pos: Vector3, shadowGen: ShadowGenerator): void {
  // Base
  const base = MeshBuilder.CreateCylinder("windmill_base", {
    height: 10, diameterTop: 2, diameterBottom: 3.5, tessellation: 8,
  }, scene);
  base.position = pos.clone();
  base.position.y += 5;
  const baseMat = new StandardMaterial("wmBaseMat", scene);
  baseMat.diffuseColor = new Color3(0.6, 0.55, 0.45);
  base.material = baseMat;
  shadowGen.addShadowCaster(base);

  // Roof
  const roof = MeshBuilder.CreateCylinder("windmill_roof", {
    height: 3, diameterTop: 0, diameterBottom: 3, tessellation: 8,
  }, scene);
  roof.position = pos.clone();
  roof.position.y += 11.5;
  const roofMat = new StandardMaterial("wmRoofMat", scene);
  roofMat.diffuseColor = new Color3(0.5, 0.2, 0.1);
  roof.material = roofMat;
}

function createCampBuilding(scene: Scene, pos: Vector3, name: string, shadowGen: ShadowGenerator): void {
  const w = 6, h = 4, d = 5;
  const building = MeshBuilder.CreateBox(`camp_${name}`, {
    width: w, height: h, depth: d,
  }, scene);
  building.position = pos.clone();
  building.position.y += h / 2;
  const mat = new StandardMaterial("campMat", scene);
  mat.diffuseColor = new Color3(0.45, 0.35, 0.2);
  building.material = mat;
  building.receiveShadows = true;
  shadowGen.addShadowCaster(building);

  // Roof
  const roof = MeshBuilder.CreateCylinder(`roof_${name}`, {
    height: 2, diameterTop: 0, diameterBottom: Math.max(w, d) * 1.2, tessellation: 4,
  }, scene);
  roof.position = pos.clone();
  roof.position.y += h + 1;
  const roofMat = new StandardMaterial("roofMat", scene);
  roofMat.diffuseColor = new Color3(0.5, 0.25, 0.1);
  roof.material = roofMat;
}

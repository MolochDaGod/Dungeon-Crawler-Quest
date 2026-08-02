/**
 * BabylonJS 9 + Havok — Playable Genesis Scene
 *
 * A complete, self-contained 3D scene you can drop into a <div> and play.
 * Creates terrain, ocean, player character, camera, lighting, physics, and input.
 *
 * Usage:
 *   const genesis = await createGenesisScene(containerDiv);
 *   // game loop driven internally by engine.runRenderLoop
 *   // cleanup:
 *   genesis.dispose();
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Animation } from "@babylonjs/core/Animations/animation";
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Helpers/sceneHelpers";

// ── Constants ──────────────────────────────────────────────────

const TERRAIN_SIZE = 500;       // world units
const TERRAIN_SUBDIVS = 128;    // vertex density
const PLAYER_SPEED = 12;        // units/sec
const PLAYER_SPRINT = 20;
const CAMERA_ALPHA = -Math.PI / 2;
const CAMERA_BETA = 1.1;        // slightly above horizontal
const CAMERA_RADIUS = 15;
const OCEAN_SNIPPET = "#3FU5FG#1";

// ── Simple Noise (deterministic, no dependencies) ──────────────

function noise2D(x: number, z: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function fbmNoise(x: number, z: number, octaves = 4): number {
  let value = 0, amplitude = 1, frequency = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, z * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / max;
}

/** Sample terrain height at world (x, z) */
function sampleTerrainHeight(x: number, z: number): number {
  // Macro hills
  const macro = fbmNoise(x * 0.005, z * 0.005, 3) * 8;
  // Ridge
  const ridge = Math.abs(fbmNoise(x * 0.02, z * 0.02, 2) - 0.5) * 6;
  // Detail
  const detail = fbmNoise(x * 0.05, z * 0.05, 2) * 1.5;

  let y = macro + ridge + detail - 4;

  // Island mask — sink edges into ocean
  const cx = x - TERRAIN_SIZE / 2;
  const cz = z - TERRAIN_SIZE / 2;
  const dist = Math.sqrt(cx * cx + cz * cz);
  const edgeFade = 1 - Math.max(0, Math.min(1, (dist - TERRAIN_SIZE * 0.35) / (TERRAIN_SIZE * 0.15)));
  y = y * edgeFade + (-3) * (1 - edgeFade);

  return y;
}

// ── Result ─────────────────────────────────────────────────────

export interface GenesisScene {
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  player: TransformNode;
  dispose: () => void;
}

// ── Main Factory ───────────────────────────────────────────────

export async function createGenesisScene(container: HTMLElement): Promise<GenesisScene> {
  // ── Canvas & Engine ──────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.outline = "none";
  canvas.tabIndex = 1;
  container.appendChild(canvas);

  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.314, 0.427, 0.522, 1); // ocean palette
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.314, 0.427, 0.522);
  scene.fogStart = 80;
  scene.fogEnd = 200;
  scene.collisionsEnabled = true;

  // ── Physics (Havok) ──────────────────────────────────────────
  const hk = await HavokPhysics();
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, hk));

  // ── Camera (3rd-person arc) ──────────────────────────────────
  const camera = new ArcRotateCamera("cam", CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS,
    new Vector3(TERRAIN_SIZE / 2, 2, TERRAIN_SIZE / 2), scene);
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2 - 0.1;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 40;
  camera.wheelPrecision = 20;
  camera.attachControl(canvas, true);
  camera.minZ = 0.5;
  camera.maxZ = 300;

  // ── Lighting ─────────────────────────────────────────────────
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  hemi.diffuse = new Color3(0.8, 0.85, 0.9);
  hemi.groundColor = new Color3(0.2, 0.3, 0.15);

  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.3), scene);
  sun.position = new Vector3(TERRAIN_SIZE / 2 + 50, 80, TERRAIN_SIZE / 2 + 40);
  sun.intensity = 1.6;

  const shadowGen = new ShadowGenerator(2048, sun);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;

  // ── Terrain ──────────────────────────────────────────────────
  const ground = MeshBuilder.CreateGround("terrain", {
    width: TERRAIN_SIZE,
    height: TERRAIN_SIZE,
    subdivisions: TERRAIN_SUBDIVS,
    updatable: true,
  }, scene);
  ground.position.set(TERRAIN_SIZE / 2, 0, TERRAIN_SIZE / 2);
  ground.receiveShadows = true;

  // Displace terrain vertices
  const positions = ground.getVerticesData("position")!;
  for (let i = 0; i < positions.length; i += 3) {
    const wx = positions[i] + TERRAIN_SIZE / 2;
    const wz = positions[i + 2] + TERRAIN_SIZE / 2;
    positions[i + 1] = sampleTerrainHeight(wx, wz);
  }
  ground.updateVerticesData("position", positions);

  // Recompute normals
  const normals: number[] = [];
  const indices = ground.getIndices()!;
  VertexData.ComputeNormals(positions, indices, normals);
  ground.updateVerticesData("normal", normals);

  // Terrain material
  const groundMat = new PBRMaterial("groundMat", scene);
  groundMat.albedoColor = new Color3(0.22, 0.42, 0.16);
  groundMat.roughness = 0.85;
  groundMat.metallic = 0.0;
  ground.material = groundMat;

  // Terrain physics
  new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0, friction: 0.8 }, scene);

  // ── Ocean ────────────────────────────────────────────────────
  const oceanSize = TERRAIN_SIZE * 3;
  const ocean = MeshBuilder.CreateGround("ocean", {
    width: oceanSize, height: oceanSize, subdivisions: 128,
  }, scene);
  ocean.position.set(TERRAIN_SIZE / 2, -0.3, TERRAIN_SIZE / 2);

  try {
    const oceanMat = await NodeMaterial.ParseFromSnippetAsync(OCEAN_SNIPPET, scene);
    ocean.material = oceanMat;
  } catch {
    const fallbackMat = new PBRMaterial("oceanFallback", scene);
    fallbackMat.albedoColor = new Color3(0.08, 0.22, 0.36);
    fallbackMat.roughness = 0.25;
    fallbackMat.metallic = 0.1;
    fallbackMat.alpha = 0.85;
    fallbackMat.backFaceCulling = false;
    ocean.material = fallbackMat;
  }

  // ── Player Character ─────────────────────────────────────────
  const playerRoot = new TransformNode("player", scene);
  const spawnX = TERRAIN_SIZE / 2;
  const spawnZ = TERRAIN_SIZE / 2;
  const spawnY = sampleTerrainHeight(spawnX, spawnZ) + 1;
  playerRoot.position.set(spawnX, spawnY, spawnZ);

  // Body capsule
  const body = MeshBuilder.CreateCapsule("playerBody", {
    radius: 0.4, height: 1.8, tessellation: 16, subdivisions: 6,
  }, scene);
  body.position.y = 0.9;
  body.parent = playerRoot;
  shadowGen.addShadowCaster(body);

  const bodyMat = new PBRMaterial("bodyMat", scene);
  bodyMat.albedoColor = new Color3(0.8, 0.3, 0.2);
  bodyMat.roughness = 0.5;
  bodyMat.metallic = 0.2;
  body.material = bodyMat;

  // Head
  const head = MeshBuilder.CreateSphere("playerHead", { diameter: 0.55, segments: 12 }, scene);
  head.position.y = 1.95;
  head.parent = playerRoot;
  shadowGen.addShadowCaster(head);

  const headMat = new PBRMaterial("headMat", scene);
  headMat.albedoColor = new Color3(0.87, 0.73, 0.67);
  headMat.roughness = 0.6;
  head.material = headMat;

  // Shadow decal
  const shadowDisc = MeshBuilder.CreateDisc("playerShadow", { radius: 0.6, tessellation: 16 }, scene);
  shadowDisc.rotation.x = Math.PI / 2;
  shadowDisc.position.y = 0.02;
  shadowDisc.parent = playerRoot;
  const shadowMat = new StandardMaterial("shadowMat", scene);
  shadowMat.diffuseColor = Color3.Black();
  shadowMat.alpha = 0.3;
  shadowMat.disableLighting = true;
  shadowDisc.material = shadowMat;

  // Player physics
  new PhysicsAggregate(body, PhysicsShapeType.CAPSULE, {
    mass: 70, friction: 0.5, restitution: 0.1,
  }, scene);

  // ── Scatter Trees ────────────────────────────────────────────
  const treeMat = new PBRMaterial("treeMat", scene);
  treeMat.albedoColor = new Color3(0.15, 0.35, 0.12);
  treeMat.roughness = 0.9;

  const trunkMat = new PBRMaterial("trunkMat", scene);
  trunkMat.albedoColor = new Color3(0.35, 0.22, 0.12);
  trunkMat.roughness = 0.9;

  for (let i = 0; i < 200; i++) {
    const tx = 30 + Math.random() * (TERRAIN_SIZE - 60);
    const tz = 30 + Math.random() * (TERRAIN_SIZE - 60);
    const ty = sampleTerrainHeight(tx, tz);
    if (ty < 0.5) continue; // skip water

    const trunkH = 2 + Math.random() * 3;
    const trunk = MeshBuilder.CreateCylinder(`trunk_${i}`, {
      diameterTop: 0.15, diameterBottom: 0.3, height: trunkH, tessellation: 6,
    }, scene);
    trunk.position.set(tx, ty + trunkH / 2, tz);
    trunk.material = trunkMat;
    trunk.receiveShadows = true;
    shadowGen.addShadowCaster(trunk);

    const canopyR = 1 + Math.random() * 1.5;
    const canopy = MeshBuilder.CreateSphere(`canopy_${i}`, {
      diameter: canopyR * 2, segments: 6,
    }, scene);
    canopy.position.set(tx, ty + trunkH + canopyR * 0.6, tz);
    canopy.scaling.y = 0.7;
    canopy.material = treeMat;
    canopy.receiveShadows = true;
    shadowGen.addShadowCaster(canopy);
  }

  // ── Scatter Rocks ────────────────────────────────────────────
  const rockMat = new PBRMaterial("rockMat", scene);
  rockMat.albedoColor = new Color3(0.45, 0.42, 0.38);
  rockMat.roughness = 0.9;

  for (let i = 0; i < 80; i++) {
    const rx = 20 + Math.random() * (TERRAIN_SIZE - 40);
    const rz = 20 + Math.random() * (TERRAIN_SIZE - 40);
    const ry = sampleTerrainHeight(rx, rz);
    if (ry < 0) continue;

    const s = 0.5 + Math.random() * 1.5;
    const rock = MeshBuilder.CreatePolyhedron(`rock_${i}`, { type: 1, size: s * 0.5 }, scene);
    rock.position.set(rx, ry + s * 0.3, rz);
    rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI * 2, Math.random() * 0.3);
    rock.material = rockMat;
    rock.receiveShadows = true;
    shadowGen.addShadowCaster(rock);
  }

  // ── Post-Processing ──────────────────────────────────────────
  const pipeline = new DefaultRenderingPipeline("pipeline", false, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.2;
  pipeline.bloomWeight = 0.3;
  pipeline.bloomKernel = 32;
  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.1;

  // ── Input (WASD movement) ────────────────────────────────────
  const keys = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("keyup", onKeyUp);
  canvas.focus();

  // ── Game Loop ────────────────────────────────────────────────
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    // Movement
    let mx = 0, mz = 0;
    if (keys.has("w") || keys.has("arrowup")) mz = 1;
    if (keys.has("s") || keys.has("arrowdown")) mz = -1;
    if (keys.has("a") || keys.has("arrowleft")) mx = -1;
    if (keys.has("d") || keys.has("arrowright")) mx = 1;

    if (mx !== 0 || mz !== 0) {
      const len = Math.sqrt(mx * mx + mz * mz);
      mx /= len; mz /= len;

      const speed = keys.has("shift") ? PLAYER_SPRINT : PLAYER_SPEED;

      // Camera-relative movement
      const camForward = camera.getForwardRay().direction;
      camForward.y = 0;
      camForward.normalize();
      const camRight = Vector3.Cross(Vector3.Up(), camForward).normalize();

      const move = camForward.scale(mz).add(camRight.scale(-mx)).normalize().scale(speed * dt);

      const newX = playerRoot.position.x + move.x;
      const newZ = playerRoot.position.z + move.z;

      // Clamp to terrain bounds
      const clampedX = Math.max(2, Math.min(TERRAIN_SIZE - 2, newX));
      const clampedZ = Math.max(2, Math.min(TERRAIN_SIZE - 2, newZ));

      // Sample terrain height at new position
      const newY = sampleTerrainHeight(clampedX, clampedZ);

      // Only walk on land (above water)
      if (newY > -0.3) {
        playerRoot.position.x = clampedX;
        playerRoot.position.z = clampedZ;
        playerRoot.position.y += (newY + 0.05 - playerRoot.position.y) * 0.2; // smooth height follow

        // Face movement direction
        const angle = Math.atan2(move.x, move.z);
        playerRoot.rotation.y += (angle - playerRoot.rotation.y) * 0.15;
      }
    }

    // Camera follows player
    camera.target.copyFrom(playerRoot.position);
    camera.target.y += 1.2;

    // Sun follows camera
    sun.position.set(
      playerRoot.position.x + 50,
      80,
      playerRoot.position.z + 40,
    );
  });

  // ── Render Loop ──────────────────────────────────────────────
  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  // ── Dispose ──────────────────────────────────────────────────
  const dispose = () => {
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("keyup", onKeyUp);
    engine.stopRenderLoop();
    scene.dispose();
    engine.dispose();
    if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
  };

  return { engine, scene, canvas, player: playerRoot, dispose };
}

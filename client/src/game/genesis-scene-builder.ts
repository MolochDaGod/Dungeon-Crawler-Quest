/**
 * Genesis Island 3D Scene Builder — BabylonJS 9
 *
 * Uses: WebGPU (auto-fallback WebGL2), IBL environment, DefaultRenderingPipeline,
 * PBR terrain textures, animated water, thin-instanced foliage, GLB model placement
 * from the Unity scene hierarchy.
 */

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3, Color3, Color4, Matrix } from "@babylonjs/core/Maths/math";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

// Side-effect imports (BJS9 tree-shaking)
import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Culling/Octrees/octreeSceneComponent";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
import "@babylonjs/core/Shaders/imageProcessing.fragment";
import "@babylonjs/core/Shaders/pass.fragment";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";

import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { GenesisGameBridge } from "./genesis-game-bridge";
import { GenesisPlayerController } from "./genesis-player-controller";
import { GenesisHUD } from "./genesis-hud";

// ── Constants ──────────────────────────────────────────────────
const SCALE_XZ = 2.5;
const SCALE_Y = 0.22;
const UNITY_CENTER_X = -133.3;
const UNITY_CENTER_Z = -155.6;
const UNITY_GROUND_SURFACE = -2880;

function unityToWorld(ux: number, uz: number, uy: number): Vector3 {
  return new Vector3(
    (ux - UNITY_CENTER_X) * SCALE_XZ,
    (uy - UNITY_GROUND_SURFACE) * SCALE_Y,
    (uz - UNITY_CENTER_Z) * SCALE_XZ,
  );
}

// ── Types ──────────────────────────────────────────────────────
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

export interface GenesisScene {
  engine: AbstractEngine;
  scene: Scene;
  camera: FreeCamera;
  bridge: GenesisGameBridge;
  controller: GenesisPlayerController | null;
  hud: GenesisHUD | null;
  dispose: () => void;
}

// ── GLB loader with auto-scale ─────────────────────────────────
async function loadGLB(
  scene: Scene,
  path: string,
  targetHeight: number,
  pos: Vector3,
  shadowGen?: ShadowGenerator,
): Promise<TransformNode | null> {
  try {
    const result = await SceneLoader.ImportMeshAsync("", path, "", scene);
    const root = result.meshes[0];
    // Auto-scale based on bounding info
    let maxY = 0;
    result.meshes.forEach(m => {
      if (m.getBoundingInfo) {
        const ext = m.getBoundingInfo().boundingBox.extendSize;
        maxY = Math.max(maxY, ext.y * 2);
      }
    });
    const s = maxY > 0 ? targetHeight / maxY : 1;
    root.scaling.setAll(s);
    root.position = pos;
    result.meshes.forEach(m => {
      m.receiveShadows = true;
      if (shadowGen) shadowGen.addShadowCaster(m);
    });
    return root as TransformNode;
  } catch (err) {
    console.warn(`[Genesis] Failed loading ${path}`, err);
    return null;
  }
}

// ── Main builder ───────────────────────────────────────────────
export async function buildGenesisScene(container: HTMLElement): Promise<GenesisScene> {
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.outline = "none";
  container.appendChild(canvas);

  // ── Engine (WebGL2, reliable) ──────────────────────────────
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.setHardwareScalingLevel(1 / dpr);
  console.log("[Genesis] Engine created:", engine.description);

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.55, 0.78, 0.95, 1);
  scene.ambientColor = new Color3(0.3, 0.3, 0.35);

  // ── IBL Environment ───────────────────────────────────────
  try {
    const envTex = CubeTexture.CreateFromPrefilteredData("/assets/env/environment.env", scene);
    scene.environmentTexture = envTex;
    scene.environmentIntensity = 0.8;
    scene.createDefaultSkybox(envTex, true, 5000, 0.3, false);
  } catch (e) {
    console.warn("[Genesis] Skybox/IBL failed, using fallback", e);
  }

  // ── Camera ────────────────────────────────────────────────
  const camera = new FreeCamera("cam", new Vector3(0, 40, -150), scene);
  camera.setTarget(new Vector3(0, 5, 0));
  camera.minZ = 0.5;
  camera.maxZ = 5000;
  camera.attachControl(canvas, true);
  camera.speed = 4;
  camera.keysUp = [87, 38];
  camera.keysDown = [83, 40];
  camera.keysLeft = [65, 37];
  camera.keysRight = [68, 39];

  // ── Lighting ──────────────────────────────────────────────
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.5;
  hemi.diffuse = new Color3(0.95, 0.95, 1.0);
  hemi.groundColor = new Color3(0.15, 0.2, 0.1);

  const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3).normalize(), scene);
  sun.position = new Vector3(300, 400, 200);
  sun.intensity = 1.8;
  sun.diffuse = new Color3(1.0, 0.95, 0.85);

  const shadowGen = new ShadowGenerator(2048, sun);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;

  // ── DefaultRenderingPipeline ──────────────────────────────
  const pipeline = new DefaultRenderingPipeline("pipeline", true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.8;
  pipeline.bloomWeight = 0.3;
  pipeline.bloomKernel = 64;
  pipeline.fxaaEnabled = true;
  pipeline.imageProcessingEnabled = true;
  if (pipeline.imageProcessing) {
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = 1; // ACES
    pipeline.imageProcessing.exposure = 1.1;
    pipeline.imageProcessing.contrast = 1.15;
    pipeline.imageProcessing.vignetteEnabled = true;
    pipeline.imageProcessing.vignetteWeight = 1.2;
    pipeline.imageProcessing.vignetteCameraFov = 0.6;
    pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0.4);
  }

  // ── Fog ───────────────────────────────────────────────────
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.55, 0.78, 0.95);
  scene.fogDensity = 0.0008;

  // ── Terrain ───────────────────────────────────────────────
  const islandW = 734 * SCALE_XZ;
  const islandD = 689 * SCALE_XZ;
  const terrain = MeshBuilder.CreateGround("island", {
    width: islandW, height: islandD, subdivisions: 128, updatable: true,
  }, scene);
  terrain.receiveShadows = true;

  const positions = terrain.getVerticesData("position");
  if (positions) {
    const halfW = islandW / 2, halfD = islandD / 2;
    for (let i = 0; i < positions.length; i += 3) {
      const lx = positions[i], lz = positions[i + 2];
      const dx = lx / halfW, dz = lz / halfD;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const falloff = Math.max(0, 1 - dist * dist);
      const noise = Math.sin(lx * 0.02 + lz * 0.015) * 3 +
                    Math.cos(lx * 0.035 - lz * 0.025) * 2 +
                    Math.sin(lx * 0.008) * 5 +
                    Math.sin(lz * 0.012 + lx * 0.006) * 3;
      positions[i + 1] = falloff * (12 + noise) - 2;
      if (dist > 0.85) positions[i + 1] = Math.min(positions[i + 1], -3);
    }
    terrain.updateVerticesData("position", positions);
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, terrain.getIndices()!, normals);
    terrain.updateVerticesData("normal", normals);
  }

  // PBR terrain with real grass texture
  const terrainMat = new PBRMaterial("terrainMat", scene);
  const grassAlbedo = new Texture("/assets/textures/terrain/Grass_3_Albedo.png", scene);
  grassAlbedo.uScale = 40; grassAlbedo.vScale = 40;
  terrainMat.albedoTexture = grassAlbedo;
  const grassNormal = new Texture("/assets/textures/terrain/Grass_3_Normal.png", scene);
  grassNormal.uScale = 40; grassNormal.vScale = 40;
  terrainMat.bumpTexture = grassNormal;
  terrainMat.roughness = 0.85;
  terrainMat.metallic = 0;
  terrainMat.environmentIntensity = 0.4;
  terrain.material = terrainMat;

  // ── Ocean ─────────────────────────────────────────────────
  const ocean = MeshBuilder.CreateGround("ocean", {
    width: 8000, height: 8000, subdivisions: 128,
  }, scene);
  ocean.position.y = -0.5;

  const oceanMat = new PBRMaterial("oceanMat", scene);
  oceanMat.albedoColor = new Color3(0.05, 0.18, 0.32);
  oceanMat.roughness = 0.15;
  oceanMat.metallic = 0.0;
  oceanMat.alpha = 0.82;
  oceanMat.subSurface.isRefractionEnabled = true;
  oceanMat.subSurface.refractionIntensity = 0.4;
  oceanMat.subSurface.tintColor = new Color3(0.02, 0.12, 0.2);
  oceanMat.backFaceCulling = false;
  ocean.material = oceanMat;

  // Animate ocean waves
  const oceanVerts = ocean.getVerticesData("position");
  const oceanOrigY = oceanVerts ? Float32Array.from(oceanVerts) : null;
  let waveTime = 0;
  scene.onBeforeRenderObservable.add(() => {
    if (!oceanVerts || !oceanOrigY) return;
    waveTime += engine.getDeltaTime() * 0.001;
    for (let i = 0; i < oceanVerts.length; i += 3) {
      const ox = oceanOrigY[i], oz = oceanOrigY[i + 2];
      oceanVerts[i + 1] = oceanOrigY[i + 1] +
        Math.sin(ox * 0.008 + waveTime * 1.2) * 0.6 +
        Math.cos(oz * 0.01 + waveTime * 0.8) * 0.4 +
        Math.sin((ox + oz) * 0.005 + waveTime * 0.5) * 0.3;
    }
    ocean.updateVerticesData("position", oceanVerts);
  });

  // ── Load scene hierarchy ──────────────────────────────────
  let sceneData: GenesisSceneData | null = null;
  try {
    const res = await fetch("/genesis-scene-data.json");
    if (res.ok) sceneData = await res.json();
  } catch { /* fallback procedural */ }

  // ── Classify objects ──────────────────────────────────────
  const treePositions: Vector3[] = [];
  const rockPositions: Vector3[] = [];
  const buildingPositions: { pos: Vector3; name: string }[] = [];
  const npcPositions: { pos: Vector3; name: string }[] = [];
  const spawnerPositions: { pos: Vector3; name: string; level: number }[] = [];
  const craftingPositions: { pos: Vector3; name: string }[] = [];
  const raceStarts: Record<string, Vector3> = {};
  let airshipPos: Vector3 | null = null;

  function classify(objects: SceneObject[], parentName = "") {
    for (const obj of objects) {
      const name = obj.name.toLowerCase();
      const p = obj.position;
      const wp = unityToWorld(p.x, p.z, p.y);

      // Race starts
      if (name.includes("start") && !name.includes("pvp")) {
        for (const race of ["barbarian", "human", "dwarf", "elf", "undead", "orc"]) {
          if (name.includes(race)) raceStarts[race] = wp;
        }
      }
      if (name.includes("airship") && !name.includes("rotator")) airshipPos = wp;

      // NPCs
      if (/dealer|vendor|trainer|watchman|scout|guard|commander|defender|cavalry|arsenal/.test(name)) {
        npcPositions.push({ pos: wp, name: obj.name });
      }
      // Spawners
      const lvMatch = name.match(/lv(\d+)/);
      if (name.includes("spawner") && lvMatch) {
        spawnerPositions.push({ pos: wp, name: obj.name, level: parseInt(lvMatch[1]) });
      }
      // Crafting
      if (/furnace|sawmill|tannery|refinery/.test(name)) {
        craftingPositions.push({ pos: wp, name: obj.name });
      }

      // Island terrain objects
      if (/genesis island|harbor|mine|cave/.test(parentName)) {
        if (/tree|willow|palm|pine|oak|birch/.test(name)) treePositions.push(wp);
        else if (/rock|stone|boulder/.test(name)) rockPositions.push(wp);
        else if (/house|building|tavern|windmill|camp|armory|stable|dock|gate|wall|tower/.test(name)) {
          buildingPositions.push({ pos: wp, name: obj.name });
        }
      }

      if (obj.children && !name.includes("pvp arena")) classify(obj.children, name);
    }
  }

  if (sceneData) {
    classify(sceneData.rootObjects);
    const gi = sceneData.rootObjects.find(o => o.name === "genesis island");
    if (gi?.children) classify(gi.children, "genesis island");
  }

  // Fallback procedural
  if (treePositions.length === 0) {
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2, r = 80 + Math.random() * 700;
      treePositions.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 750;
      rockPositions.push(new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
  }

  console.log(`[Genesis] Classified: ${treePositions.length} trees, ${rockPositions.length} rocks, ${buildingPositions.length} buildings, ${npcPositions.length} NPCs, ${spawnerPositions.length} spawners, ${Object.keys(raceStarts).length} race starts`);

  // ── Shared fallback material ──────────────────────────────
  const fallbackMat = new PBRMaterial("fallbackMat", scene);
  fallbackMat.albedoColor = new Color3(0.42, 0.4, 0.37);
  fallbackMat.roughness = 0.9;
  fallbackMat.metallic = 0;

  // ── Trees (thin instances across 4 GLB types) ─────────────
  const treeGLBs = [
    "/assets/grudge-legacy/environment/pine_tree.glb",
    "/assets/grudge-legacy/environment/oak_tree.glb",
    "/assets/grudge-legacy/environment/birch_tree.glb",
    "/assets/grudge-legacy/environment/willow_tree.glb",
  ];
  const treesPerModel = Math.ceil(treePositions.length / treeGLBs.length);

  for (let ti = 0; ti < treeGLBs.length; ti++) {
    const subset = treePositions.slice(ti * treesPerModel, (ti + 1) * treesPerModel);
    if (subset.length === 0) continue;
    try {
      const result = await SceneLoader.ImportMeshAsync("", treeGLBs[ti], "", scene);
      const root = result.meshes[0];
      const template = result.meshes.find(m => m !== root && (m as Mesh).getTotalVertices?.() > 0) as Mesh | undefined;
      if (template) {
        root.setEnabled(false);
        template.isVisible = true;
        template.refreshBoundingInfo(true);
        const ext = template.getBoundingInfo().boundingBox.extendSize;
        const maxExt = Math.max(ext.x, ext.y, ext.z) * 2;
        const baseScale = maxExt > 0 ? 8 / maxExt : 0.02;

        const buf = new Float32Array(subset.length * 16);
        for (let i = 0; i < subset.length; i++) {
          const p = subset[i];
          const s = baseScale * (0.6 + Math.random() * 0.8);
          Matrix.Compose(
            new Vector3(s, s, s),
            Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2),
            p,
          ).copyToArray(buf, i * 16);
        }
        template.thinInstanceSetBuffer("matrix", buf, 16);
        template.receiveShadows = true;
        shadowGen.addShadowCaster(template);
        console.log(`[Genesis] Trees: ${subset.length}x ${treeGLBs[ti].split("/").pop()}`);
      }
    } catch (err) {
      console.warn(`[Genesis] Tree GLB failed: ${treeGLBs[ti]}`, err);
    }
  }

  // ── Rocks (thin instances) ────────────────────────────────
  if (rockPositions.length > 0) {
    const rockTpl = MeshBuilder.CreateSphere("rock_t", { diameter: 2, segments: 4 }, scene);
    rockTpl.material = fallbackMat;
    rockTpl.receiveShadows = true;
    const buf = new Float32Array(rockPositions.length * 16);
    for (let i = 0; i < rockPositions.length; i++) {
      const p = rockPositions[i];
      const s = 0.5 + Math.random() * 2;
      Matrix.Compose(
        new Vector3(s, s * 0.6, s * (0.8 + Math.random() * 0.4)),
        Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2),
        new Vector3(p.x, p.y + s * 0.2, p.z),
      ).copyToArray(buf, i * 16);
    }
    rockTpl.thinInstanceSetBuffer("matrix", buf, 16);
    console.log(`[Genesis] Rocks: ${rockPositions.length} thin instances`);
  }

  // ── Buildings ─────────────────────────────────────────────
  const bldgMap: Record<string, string> = {
    house: "/assets/grudge-legacy/building/wooden_house.glb",
    tavern: "/assets/grudge-legacy/building/tavern.glb",
    windmill: "/assets/grudge-legacy/building/windmill.glb",
    wall: "/assets/grudge-legacy/building/wall.glb",
    tower: "/assets/grudge-legacy/building/wall_tower.glb",
  };
  const bldgGroups: Record<string, Vector3[]> = {};
  for (const b of buildingPositions) {
    const n = b.name.toLowerCase();
    let type = "house";
    if (n.includes("tavern")) type = "tavern";
    else if (n.includes("windmill")) type = "windmill";
    else if (n.includes("tower")) type = "tower";
    else if (/wall|gate|stake/.test(n)) type = "wall";
    (bldgGroups[type] ||= []).push(b.pos);
  }

  for (const [type, posArr] of Object.entries(bldgGroups)) {
    const glbPath = bldgMap[type] || bldgMap.house;
    const cap = Math.min(posArr.length, 20);
    try {
      const result = await SceneLoader.ImportMeshAsync("", glbPath, "", scene);
      const root = result.meshes[0];
      let maxY = 1;
      result.meshes.forEach(m => {
        const e = m.getBoundingInfo?.()?.boundingBox?.extendSize;
        if (e) maxY = Math.max(maxY, e.y * 2);
      });
      const targetH = type === "wall" ? 4 : type === "tower" ? 8 : 6;
      root.scaling.setAll(maxY > 0 ? targetH / maxY : 1);
      root.position = posArr[0];
      result.meshes.forEach(m => { m.receiveShadows = true; shadowGen.addShadowCaster(m); });
      for (let i = 1; i < cap; i++) {
        const clone = root.clone(`${type}_${i}`, null);
        if (clone) {
          clone.position = posArr[i];
          (clone as Mesh).rotation = new Vector3(0, Math.random() * Math.PI * 2, 0);
        }
      }
      console.log(`[Genesis] Buildings: ${cap}x ${type}`);
    } catch {
      for (const p of posArr.slice(0, cap)) {
        const box = MeshBuilder.CreateBox("fb", { width: 4, height: 4, depth: 4 }, scene);
        box.position.set(p.x, p.y + 2, p.z);
        box.material = fallbackMat;
        box.receiveShadows = true;
      }
    }
  }

  // ── NPCs ──────────────────────────────────────────────────
  const npcModels = [
    "/assets/grudge-legacy/character/bambi.glb",
    "/assets/grudge-legacy/character/basefemale.glb",
    "/assets/grudge-legacy/character/villhelm.glb",
  ];
  for (let i = 0; i < Math.min(npcPositions.length, 15); i++) {
    const npc = npcPositions[i];
    const node = await loadGLB(scene, npcModels[i % npcModels.length], 1.8, npc.pos, shadowGen);
    if (!node) {
      const cap = MeshBuilder.CreateCapsule("npc", { height: 1.8, radius: 0.3 }, scene);
      cap.position = npc.pos; cap.position.y += 0.9;
      const m = new PBRMaterial("nm", scene);
      m.albedoColor = new Color3(0.7, 0.5, 0.3); m.roughness = 0.8;
      cap.material = m;
    }
  }
  console.log(`[Genesis] NPCs: ${Math.min(npcPositions.length, 15)} placed`);

  // ── Monsters at spawners ──────────────────────────────────
  const monsterMap: Record<number, string[]> = {
    5: ["/assets/grudge-legacy/monster/wolf.glb", "/assets/grudge-legacy/monster/bat.glb"],
    10: ["/assets/grudge-legacy/monster/bear.glb", "/assets/grudge-legacy/monster/arachnid.glb"],
    15: ["/assets/grudge-legacy/monster/gargoyle.glb", "/assets/grudge-legacy/monster/reptilian.glb"],
    20: ["/assets/grudge-legacy/monster/juggernaut.glb", "/assets/grudge-legacy/monster/hunter_boss.glb"],
  };
  for (const sp of spawnerPositions.slice(0, 20)) {
    const models = monsterMap[sp.level] || monsterMap[5];
    await loadGLB(scene, models[Math.floor(Math.random() * models.length)], 1 + sp.level * 0.1, sp.pos, shadowGen);
  }
  console.log(`[Genesis] Monsters: ${Math.min(spawnerPositions.length, 20)} at spawners`);

  // ── Crafting stations ─────────────────────────────────────
  for (const cs of craftingPositions) {
    const node = await loadGLB(scene, "/assets/grudge-legacy/prop/chest.glb", 1.5, cs.pos);
    if (!node) {
      const box = MeshBuilder.CreateBox("craft", { size: 1.5 }, scene);
      box.position = cs.pos; box.position.y += 0.75;
      box.material = fallbackMat;
    }
  }

  // ── Airship ───────────────────────────────────────────────
  if (airshipPos) {
    const hull = MeshBuilder.CreateBox("airship", { width: 12, height: 3, depth: 30 }, scene);
    hull.position = airshipPos.clone(); hull.position.y += 30;
    const hMat = new PBRMaterial("hullMat", scene);
    hMat.albedoColor = new Color3(0.4, 0.25, 0.12); hMat.roughness = 0.7;
    hull.material = hMat; hull.receiveShadows = true; shadowGen.addShadowCaster(hull);

    const balloon = MeshBuilder.CreateSphere("balloon", { diameterX: 14, diameterY: 8, diameterZ: 28 }, scene);
    balloon.position = hull.position.clone(); balloon.position.y += 10;
    const bMat = new PBRMaterial("balloonMat", scene);
    bMat.albedoColor = new Color3(0.7, 0.15, 0.1); bMat.roughness = 0.5;
    balloon.material = bMat;

    const baseY = hull.position.y;
    scene.onBeforeRenderObservable.add(() => {
      hull.position.y = baseY + Math.sin(waveTime * 0.3) * 0.5;
      balloon.position.y = hull.position.y + 10;
    });
    console.log("[Genesis] Airship placed");
  }

  // ── Point lights at key locations ─────────────────────────
  const lightSpots = [...craftingPositions.map(c => c.pos), ...npcPositions.slice(0, 5).map(n => n.pos)];
  for (let i = 0; i < Math.min(lightSpots.length, 8); i++) {
    const lp = lightSpots[i];
    const pl = new PointLight(`torch_${i}`, new Vector3(lp.x, lp.y + 3, lp.z), scene);
    pl.intensity = 15; pl.diffuse = new Color3(1.0, 0.7, 0.3); pl.range = 30;
  }

  // ── Player character ──────────────────────────────────────
  const spawnPos = raceStarts.barbarian || raceStarts.human || unityToWorld(-380.52, 27.13, -2862.59);
  const playerNode = await loadGLB(scene, "/assets/grudge-legacy/character/bambi.glb", 1.8, spawnPos, shadowGen);
  if (playerNode) playerNode.position.y += 1;
  else {
    const cap = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    cap.position = spawnPos.clone(); cap.position.y += 1;
    const pm = new PBRMaterial("playerMat", scene);
    pm.albedoColor = new Color3(0.2, 0.6, 0.9); pm.roughness = 0.6;
    cap.material = pm; shadowGen.addShadowCaster(cap);
  }
  camera.position = new Vector3(spawnPos.x, spawnPos.y + 15, spawnPos.z - 30);
  camera.setTarget(spawnPos);

  // ── Octree ────────────────────────────────────────────────
  if (scene.createOrUpdateSelectionOctree) scene.createOrUpdateSelectionOctree(32, 2);

  // ── Game Bridge (connects all game systems to 3D world) ──
  const bridge = new GenesisGameBridge(scene);

  // Register resource nodes at tree/rock positions for harvesting
  bridge.spawnNodesForBiome("forest", treePositions.slice(0, 50));
  bridge.spawnNodesForBiome("cave", rockPositions.slice(0, 30));

  const snap = bridge.getSnapshot();
  console.log(`[Genesis] Bridge active: ${snap.name} (${snap.race} ${snap.heroClass}) Lv${snap.level} HP:${snap.maxHp} MP:${snap.maxMp}`);

  // ── Player controller (replaces FreeCamera with ArcRotate 3rd person) ──
  let controller: GenesisPlayerController | null = null;
  const playerMesh = playerNode || scene.getMeshByName("player");
  if (playerMesh) {
    controller = new GenesisPlayerController(scene, bridge, playerMesh as TransformNode, camera, canvas);
    console.log("[Genesis] 3rd-person controller active");
  }

  // ── HUD ────────────────────────────────────────────────────
  const hud = new GenesisHUD(scene, bridge);
  console.log("[Genesis] HUD active");

  // ── Render loop (includes bridge update) ──────────────────
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() * 0.001;
    bridge.update(dt);
    scene.render();
  });
  window.addEventListener("resize", () => engine.resize());

  console.log("[Genesis] Scene complete");
  return {
    engine, scene, camera, bridge, controller, hud,
    dispose: () => {
      hud.dispose();
      controller?.dispose();
      bridge.dispose();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    },
  };
}

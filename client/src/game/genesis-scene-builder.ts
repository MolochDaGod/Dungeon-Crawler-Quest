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
import { buildCharacterSelectScene, type CharacterSelectResult } from "./genesis-character-select";

// ── Constants ──────────────────────────────────────────────────
const MODEL_PATHS = [
  "/assets/grudge-legacy/character/bambi.glb",
  "/assets/grudge-legacy/character/basefemale.glb",
  "/assets/grudge-legacy/character/villhelm.glb",
];
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

// ── Main builder ─────────────────────────────────────────────────
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

  // ── Character Select Screen (runs first) ─────────────────
  const charSelect = await buildCharacterSelectScene(canvas, engine);
  engine.runRenderLoop(() => charSelect.scene.render());
  console.log("[Genesis] Character select screen active");

  // Wait for player to pick race + class and click Enter World
  const selection = await charSelect.waitForSelection();
  engine.stopRenderLoop();
  console.log(`[Genesis] Selected: ${selection.race} ${selection.heroClass}`);

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

  // DefaultRenderingPipeline created AFTER player controller (needs final camera)

  // ── Fog (light, doesn't hide geometry) ───────────────────
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.55, 0.78, 0.95);
  scene.fogStart = 400;
  scene.fogEnd = 2500;

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

  // ── Ocean (simple, no subsurface — renders reliably) ───────
  const ocean = MeshBuilder.CreateGround("ocean", {
    width: 6000, height: 6000, subdivisions: 32,
  }, scene);
  ocean.position.y = -1;

  const oceanMat = new PBRMaterial("oceanMat", scene);
  oceanMat.albedoColor = new Color3(0.06, 0.2, 0.35);
  oceanMat.roughness = 0.2;
  oceanMat.metallic = 0.0;
  oceanMat.alpha = 0.85;
  oceanMat.backFaceCulling = false;
  ocean.material = oceanMat;
  let waveTime = 0;

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

  // ── Data for background loading ──────────────────────────
  const treeGLBs = [
    "/assets/grudge-legacy/environment/pine_tree.glb",
    "/assets/grudge-legacy/environment/oak_tree.glb",
    "/assets/grudge-legacy/environment/birch_tree.glb",
    "/assets/grudge-legacy/environment/willow_tree.glb",
  ];
  const treesPerModel = Math.ceil(treePositions.length / treeGLBs.length);

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
  const npcModels = [
    "/assets/grudge-legacy/character/bambi.glb",
    "/assets/grudge-legacy/character/basefemale.glb",
    "/assets/grudge-legacy/character/villhelm.glb",
  ];
  const monsterMap: Record<number, string[]> = {
    5: ["/assets/grudge-legacy/monster/wolf.glb", "/assets/grudge-legacy/monster/bat.glb"],
    10: ["/assets/grudge-legacy/monster/bear.glb", "/assets/grudge-legacy/monster/arachnid.glb"],
    15: ["/assets/grudge-legacy/monster/gargoyle.glb", "/assets/grudge-legacy/monster/reptilian.glb"],
    20: ["/assets/grudge-legacy/monster/juggernaut.glb", "/assets/grudge-legacy/monster/hunter_boss.glb"],
  }

  // Rocks (instant — primitive thin instances, no GLB needed)
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

  // ── Player (capsule placeholder — instant, no GLB wait) ──────
  const spawnPos = new Vector3(0, 10, 0);
  const playerCap = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
  playerCap.position = spawnPos.clone();
  playerCap.position.y += 1;
  const playerMat = new PBRMaterial("playerMat", scene);
  playerMat.albedoColor = new Color3(0.2, 0.6, 0.9);
  playerMat.roughness = 0.6;
  playerCap.material = playerMat;
  shadowGen.addShadowCaster(playerCap);

  camera.position = new Vector3(0, 25, -30);
  camera.setTarget(spawnPos);

  // ── Game Bridge ─────────────────────────────────────────
  const bridge = new GenesisGameBridge(scene);
  bridge.spawnNodesForBiome("forest", treePositions.slice(0, 50));
  bridge.spawnNodesForBiome("cave", rockPositions.slice(0, 30));

  // ── Player controller ───────────────────────────────────
  const controller = new GenesisPlayerController(scene, bridge, playerCap as any, camera, canvas);

  // ── HUD ─────────────────────────────────────────────────
  const hud = new GenesisHUD(scene, bridge);

  // ── START RENDER LOOP NOW (terrain + player visible immediately) ──
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() * 0.001;
    bridge.update(dt);
    scene.render();
  });
  window.addEventListener("resize", () => engine.resize());
  console.log("[Genesis] Render loop started — terrain + player visible");

  // ── BACKGROUND: load all GLB models (doesn't block rendering) ──
  (async () => {
    // Load player character GLB and replace capsule
    const charModel = MODEL_PATHS[selection.modelIndex] || MODEL_PATHS[0];
    const charNode = await loadGLB(scene, charModel, 1.8, spawnPos, shadowGen);
    if (charNode) {
      charNode.name = "player_model";
      charNode.position.y = spawnPos.y + 1;
      // Hide capsule, parent model to capsule position
      playerCap.isVisible = false;
      scene.onBeforeRenderObservable.add(() => {
        charNode.position.copyFrom(playerCap.position);
        charNode.position.y -= 0.9;
        charNode.rotation.copyFrom(playerCap.rotation);
      });
      console.log("[Genesis] Player model loaded");
    }

    // Trees
    for (let ti = 0; ti < treeGLBs.length; ti++) {
      const subset = treePositions.slice(ti * treesPerModel, (ti + 1) * treesPerModel);
      if (subset.length === 0) continue;
      try {
        const result = await SceneLoader.ImportMeshAsync("", treeGLBs[ti], "", scene);
        const root = result.meshes[0];
        const tpl = result.meshes.find(m => m !== root && (m as Mesh).getTotalVertices?.() > 0) as Mesh | undefined;
        if (tpl) {
          root.setEnabled(false);
          tpl.isVisible = true;
          tpl.refreshBoundingInfo(true);
          const ext = tpl.getBoundingInfo().boundingBox.extendSize;
          const maxE = Math.max(ext.x, ext.y, ext.z) * 2;
          const bs = maxE > 0 ? 8 / maxE : 0.02;
          const buf = new Float32Array(subset.length * 16);
          for (let i = 0; i < subset.length; i++) {
            const s = bs * (0.6 + Math.random() * 0.8);
            Matrix.Compose(
              new Vector3(s, s, s),
              Quaternion.RotationAxis(Vector3.Up(), Math.random() * Math.PI * 2),
              subset[i],
            ).copyToArray(buf, i * 16);
          }
          tpl.thinInstanceSetBuffer("matrix", buf, 16);
          tpl.receiveShadows = true;
        }
        console.log(`[Genesis] Trees: ${subset.length}x ${treeGLBs[ti].split("/").pop()}`);
      } catch { /* skip failed tree */ }
    }

    // Buildings (limit 5 per type for speed)
    for (const [type, posArr] of Object.entries(bldgGroups)) {
      const glbPath = bldgMap[type] || bldgMap.house;
      const cap = Math.min(posArr.length, 5);
      try {
        const result = await SceneLoader.ImportMeshAsync("", glbPath, "", scene);
        const root = result.meshes[0];
        let maxY = 1;
        result.meshes.forEach(m => { const e = m.getBoundingInfo?.()?.boundingBox?.extendSize; if (e) maxY = Math.max(maxY, e.y * 2); });
        const targetH = type === "wall" ? 4 : type === "tower" ? 8 : 6;
        root.scaling.setAll(maxY > 0 ? targetH / maxY : 1);
        root.position = posArr[0];
        result.meshes.forEach(m => { m.receiveShadows = true; });
        for (let i = 1; i < cap; i++) {
          const cl = root.clone(`${type}_${i}`, null);
          if (cl) { cl.position = posArr[i]; (cl as Mesh).rotation = new Vector3(0, Math.random() * Math.PI * 2, 0); }
        }
        console.log(`[Genesis] Buildings: ${cap}x ${type}`);
      } catch { /* skip */ }
    }

    // NPCs (limit 5)
    for (let i = 0; i < Math.min(npcPositions.length, 5); i++) {
      await loadGLB(scene, npcModels[i % npcModels.length], 1.8, npcPositions[i].pos);
    }

    // Monsters (limit 5)
    for (const sp of spawnerPositions.slice(0, 5)) {
      const models = monsterMap[sp.level] || monsterMap[5];
      await loadGLB(scene, models[Math.floor(Math.random() * models.length)], 1 + sp.level * 0.1, sp.pos);
    }

    console.log("[Genesis] Background loading complete");
  })();

  return {
    engine, scene, camera, bridge, controller, hud,
    dispose: () => {
      hud.dispose();
      controller.dispose();
      bridge.dispose();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    },
  };
}

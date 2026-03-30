/**
 * BabylonJS MOBA Renderer — port of three-renderer.ts
 *
 * Replaces Three.js + cannon-es with BabylonJS 9.0 + Havok.
 * Same public API: constructor(container), loadModels(state), render(state), dispose().
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { ParticleSystem } from "@babylonjs/core/Particles/particleSystem";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Helpers/sceneHelpers";

import { loadGLB, loadFBX, createAnimatedEntity, playAnimation, loadAnimationSet, applyAnimationsToEntity, ANIMATION_PATHS, type LoadedModel, type AnimatedEntity } from "./babylon-model-loader";
import { TOWER_PREFABS, HERO_PREFABS, MINION_PREFABS, CREATURE_PREFABS, ENV_PREFABS, getTowerPrefab, getHeroPrefabKey, getMinionPrefabKey, getJungleMobPrefab } from "./babylon-prefabs";
import { autoRetargetAnimationGroup, retargetAllAnimations } from "./babylon-retarget";
import type { MobaState, MobaHero, MobaMinion, MobaTower, MobaNexus, JungleMob } from "./types";
import { HEROES, MAP_SIZE, TEAM_COLORS, LANE_WAYPOINTS, CLASS_COLORS, getHeroById } from "./types";

// ── Constants ────────────────────────────────────────────────────────────────

const WORLD_SCALE = 0.05;

function gameToWorld(x: number, y: number, z = 0): Vector3 {
  return new Vector3(x * WORLD_SCALE, z * WORLD_SCALE, y * WORLD_SCALE);
}

// ── Entity3D ─────────────────────────────────────────────────────────────────

interface Entity3D {
  root: TransformNode;
  entity?: AnimatedEntity;
  healthBar?: Rectangle;
  healthLabel?: TextBlock;
  lastAnim?: string;
}

// ── Renderer ─────────────────────────────────────────────────────────────────

export class BabylonRenderer {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private canvas: HTMLCanvasElement;

  private sunLight!: DirectionalLight;
  private shadowGenerator!: ShadowGenerator;
  private guiTexture!: AdvancedDynamicTexture;

  private heroMeshes = new Map<number, Entity3D>();
  private minionMeshes = new Map<number, Entity3D>();
  private towerMeshes = new Map<number, Entity3D>();
  private nexusMeshes = new Map<number, Entity3D>();
  private jungleMobMeshes = new Map<number, Entity3D>();

  private loadedModels = new Map<string, LoadedModel>();
  private modelLoadQueue = new Set<string>();
  private sharedAnims = new Map<string, AnimationGroup>();
  private initialized = false;
  private loadingComplete = false;

  private cameraTarget = Vector3.Zero();
  private cameraSmooth = Vector3.Zero();
  private elapsedTime = 0;

  constructor(private container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.outline = "none";
    container.appendChild(this.canvas);

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.05, 0.08, 0.12, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP;
    this.scene.fogColor = new Color3(0.05, 0.08, 0.12);
    this.scene.fogDensity = 0.0015;

    // Camera
    this.camera = new FreeCamera("cam", new Vector3(0, 18, 18), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.1;

    // Init Havok + scene setup (async)
    this._initAsync();
  }

  private async _initAsync() {
    // Physics
    const hk = await HavokPhysics();
    this.scene.enablePhysics(new Vector3(0, -9.82, 0), new HavokPlugin(true, hk));

    this._setupLighting();
    this._setupGround();
    this._setupGUI();

    // Render loop
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());

    this.initialized = true;
  }

  // ── Lighting ─────────────────────────────────────────────────────────────

  private _setupLighting() {
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.5;
    hemi.specular = Color3.Black();

    this.sunLight = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.3), this.scene);
    this.sunLight.position = new Vector3(60, 100, 40);
    this.sunLight.intensity = 1.4;

    this.shadowGenerator = new ShadowGenerator(2048, this.sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;

    const fill = new DirectionalLight("fill", new Vector3(0.5, -0.5, -0.3), this.scene);
    fill.intensity = 0.3;
  }

  // ── Ground ───────────────────────────────────────────────────────────────

  private _setupGround() {
    const size = MAP_SIZE * WORLD_SCALE;
    const ground = MeshBuilder.CreateGround("ground", { width: size, height: size, subdivisions: 128 }, this.scene);
    ground.receiveShadows = true;

    const mat = new PBRMaterial("groundMat", this.scene);
    mat.albedoColor = new Color3(0.15, 0.35, 0.1);
    mat.roughness = 0.92;
    mat.metallic = 0.02;
    ground.material = mat;

    // Static physics
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
  }

  // ── GUI (health bars) ────────────────────────────────────────────────────

  private _setupGUI() {
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("HUD", true, this.scene);
  }

  private _createHealthBar(node: TransformNode, width = 120): { bar: Rectangle; label: TextBlock } {
    const container = new Rectangle("hpContainer");
    container.width = `${width}px`;
    container.height = "14px";
    container.cornerRadius = 2;
    container.color = "#111";
    container.thickness = 1;
    container.background = "#111111dd";
    this.guiTexture.addControl(container);
    container.linkWithMesh(node);
    container.linkOffsetY = -60;

    const bar = new Rectangle("hpBar");
    bar.width = 1;
    bar.height = 1;
    bar.horizontalAlignment = 0; // left
    bar.background = "#22cc22";
    bar.color = "transparent";
    bar.thickness = 0;
    container.addControl(bar);

    const label = new TextBlock("hpLabel");
    label.text = "";
    label.color = "white";
    label.fontSize = 9;
    container.addControl(label);

    return { bar, label };
  }

  private _updateHealthBar(entity: Entity3D, hp: number, maxHp: number) {
    if (!entity.healthBar) return;
    const ratio = Math.max(0, hp / maxHp);
    entity.healthBar.width = ratio;
    if (ratio > 0.6) entity.healthBar.background = "#22cc22";
    else if (ratio > 0.3) entity.healthBar.background = "#ddcc22";
    else entity.healthBar.background = "#cc2222";
  }

  // ── Model Loading ────────────────────────────────────────────────────────

  private async _loadModel(prefab: { modelPath: string; texturePath?: string; format?: string }): Promise<void> {
    if (this.loadedModels.has(prefab.modelPath) || this.modelLoadQueue.has(prefab.modelPath)) return;
    this.modelLoadQueue.add(prefab.modelPath);

    try {
      const isGlb = prefab.format === "glb" || prefab.modelPath.endsWith(".glb") || prefab.modelPath.endsWith(".gltf");
      const model = isGlb
        ? await loadGLB(this.scene, prefab.modelPath)
        : await loadFBX(this.scene, prefab.modelPath, prefab.texturePath);
      this.loadedModels.set(prefab.modelPath, model);
      // Hide until placed
      model.root.setEnabled(false);
    } catch {
      // Model load failed — fallback to primitives
    }
  }

  async loadModels(state: MobaState) {
    const promises: Promise<void>[] = [];

    for (const tower of state.towers) {
      const key = getTowerPrefab(tower.team, tower.lane);
      const prefab = TOWER_PREFABS[key];
      if (prefab) promises.push(this._loadModel(prefab));
    }

    for (const hero of state.heroes) {
      const heroData = getHeroById(hero.heroDataId);
      if (!heroData) continue;
      const key = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
      const prefab = HERO_PREFABS[key];
      if (prefab) promises.push(this._loadModel(prefab));
    }

    // Shared animations
    promises.push(
      loadAnimationSet(this.scene, ANIMATION_PATHS).then((anims) => {
        this.sharedAnims = anims;
      }),
    );

    await Promise.allSettled(promises);
    this.loadingComplete = true;
  }

  // ── Entity Creation ──────────────────────────────────────────────────────

  private _getOrCreateHero(hero: MobaHero): Entity3D | null {
    if (this.heroMeshes.has(hero.id)) return this.heroMeshes.get(hero.id)!;

    const heroData = getHeroById(hero.heroDataId);
    if (!heroData) return null;

    const key = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
    const prefab = HERO_PREFABS[key];
    const model = prefab ? this.loadedModels.get(prefab.modelPath) : null;

    let root: TransformNode;
    let entity: AnimatedEntity | undefined;

    if (model) {
      const clone = loadGLB(this.scene, prefab!.modelPath).then((m) => m); // Use cached
      // Synchronous clone from container
      const inst = model.container.instantiateModelsToScene();
      root = inst.rootNodes[0] as TransformNode;
      root.scaling.setAll(prefab!.scale);

      // Enable shadows
      root.getChildMeshes().forEach((m) => {
        m.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(m);
      });

      entity = createAnimatedEntity({
        root,
        meshes: root.getChildMeshes() as AbstractMesh[],
        animationGroups: inst.animationGroups,
        container: model.container,
      });

      // Apply shared anims
      applyAnimationsToEntity(entity, this.sharedAnims);
    } else {
      // Fallback: capsule primitive
      root = new TransformNode(`hero_${hero.id}`, this.scene);
      const capsule = MeshBuilder.CreateCapsule(`hero_capsule_${hero.id}`, { height: 1.8, radius: 0.3 }, this.scene);
      const mat = new PBRMaterial(`hero_mat_${hero.id}`, this.scene);
      const classColor = CLASS_COLORS[heroData.heroClass] || "#888888";
      mat.albedoColor = Color3.FromHexString(classColor);
      mat.roughness = 0.45;
      mat.metallic = 0.25;
      capsule.material = mat;
      capsule.position.y = 0.9;
      capsule.parent = root;
      capsule.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(capsule);
    }

    // Health bar
    const { bar, label } = this._createHealthBar(root, 120);

    const entity3D: Entity3D = { root, entity, healthBar: bar, healthLabel: label };
    this.heroMeshes.set(hero.id, entity3D);
    return entity3D;
  }

  private _getOrCreateTower(tower: MobaTower): Entity3D {
    if (this.towerMeshes.has(tower.id)) return this.towerMeshes.get(tower.id)!;

    const root = new TransformNode(`tower_${tower.id}`, this.scene);
    const teamColor = Color3.FromHexString(TEAM_COLORS[tower.team]);

    // Base
    const base = MeshBuilder.CreateCylinder(`tbase_${tower.id}`, { diameterTop: 1.4, diameterBottom: 1.8, height: 0.5, tessellation: 8 }, this.scene);
    const baseMat = new PBRMaterial(`tbaseMat_${tower.id}`, this.scene);
    baseMat.albedoColor = new Color3(0.27, 0.2, 0.13);
    baseMat.roughness = 0.9;
    base.material = baseMat;
    base.position.y = 0.25;
    base.parent = root;

    // Body
    const body = MeshBuilder.CreateCylinder(`tbody_${tower.id}`, { diameterTop: 0.9, diameterBottom: 1.2, height: 2.8, tessellation: 8 }, this.scene);
    const bodyMat = new PBRMaterial(`tbodyMat_${tower.id}`, this.scene);
    bodyMat.albedoColor = new Color3(0.4, 0.33, 0.27);
    bodyMat.roughness = 0.75;
    body.material = bodyMat;
    body.position.y = 1.9;
    body.parent = root;
    body.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(body);

    // Top cone
    const top = MeshBuilder.CreateCylinder(`ttop_${tower.id}`, { diameterTop: 0, diameterBottom: 1.1, height: 1.0, tessellation: 8 }, this.scene);
    const topMat = new PBRMaterial(`ttopMat_${tower.id}`, this.scene);
    topMat.albedoColor = teamColor;
    topMat.emissiveColor = teamColor.scale(0.1);
    topMat.roughness = 0.4;
    topMat.metallic = 0.35;
    top.material = topMat;
    top.position.y = 4.1;
    top.parent = root;

    // Orb
    const orb = MeshBuilder.CreateSphere(`torb_${tower.id}`, { diameter: 0.36, segments: 16 }, this.scene);
    const orbMat = new PBRMaterial(`torbMat_${tower.id}`, this.scene);
    orbMat.albedoColor = teamColor;
    orbMat.emissiveColor = teamColor;
    orbMat.roughness = 0.1;
    orbMat.metallic = 0.5;
    orb.material = orbMat;
    orb.position.y = 4.7;
    orb.parent = root;

    // Light
    const light = new PointLight(`tlight_${tower.id}`, new Vector3(0, 4.7, 0), this.scene);
    light.diffuse = teamColor;
    light.intensity = 1.0;
    light.range = 10;
    light.parent = root;

    const { bar, label } = this._createHealthBar(root, 150);

    const entity3D: Entity3D = { root, healthBar: bar, healthLabel: label };
    this.towerMeshes.set(tower.id, entity3D);
    return entity3D;
  }

  private _getOrCreateNexus(nexus: MobaNexus): Entity3D {
    if (this.nexusMeshes.has(nexus.id)) return this.nexusMeshes.get(nexus.id)!;

    const root = new TransformNode(`nexus_${nexus.id}`, this.scene);
    const teamColor = Color3.FromHexString(TEAM_COLORS[nexus.team]);

    // Base
    const base = MeshBuilder.CreateCylinder(`nbase_${nexus.id}`, { diameterTop: 3, diameterBottom: 4, height: 0.6, tessellation: 12 }, this.scene);
    const baseMat = new PBRMaterial(`nbaseMat_${nexus.id}`, this.scene);
    baseMat.albedoColor = new Color3(0.23, 0.17, 0.1);
    baseMat.roughness = 0.85;
    base.material = baseMat;
    base.position.y = 0.3;
    base.parent = root;
    base.receiveShadows = true;

    // Crystal
    const crystal = MeshBuilder.CreatePolyhedron(`ncrystal_${nexus.id}`, { type: 1, size: 0.8 }, this.scene);
    const crystalMat = new PBRMaterial(`ncrystalMat_${nexus.id}`, this.scene);
    crystalMat.albedoColor = teamColor;
    crystalMat.emissiveColor = teamColor.scale(0.7);
    crystalMat.roughness = 0.05;
    crystalMat.metallic = 0.85;
    crystalMat.alpha = 0.85;
    crystal.material = crystalMat;
    crystal.position.y = 2.0;
    crystal.parent = root;
    this.shadowGenerator.addShadowCaster(crystal);

    // Light
    const light = new PointLight(`nlight_${nexus.id}`, new Vector3(0, 2, 0), this.scene);
    light.diffuse = teamColor;
    light.intensity = 2.0;
    light.range = 18;
    light.parent = root;

    const { bar, label } = this._createHealthBar(root, 200);

    const entity3D: Entity3D = { root, healthBar: bar, healthLabel: label };
    this.nexusMeshes.set(nexus.id, entity3D);
    return entity3D;
  }

  // ── Animation State Mapping ──────────────────────────────────────────────

  private _mapAnimState(animState: string, dead: boolean, entity?: AnimatedEntity): string {
    if (dead) return "death";
    const has = (n: string) => entity?.actions.has(n) ?? false;
    switch (animState) {
      case "walk": return has("walk") ? "walk" : "run";
      case "attack": return "attack";
      case "combo_finisher": return has("slash") ? "slash" : "attack";
      case "lunge_slash": return has("slash") ? "slash" : "attack";
      case "dash_attack": return "attack";
      case "ability": return has("slash") ? "slash" : "attack";
      case "dodge": return has("jump") ? "jump" : "hit";
      case "block": return has("block") ? "block" : "hit";
      case "death": return "death";
      default: return "idle";
    }
  }

  // ── Main Render ──────────────────────────────────────────────────────────

  render(state: MobaState) {
    if (!this.initialized) return;

    const dt = this.engine.getDeltaTime() / 1000;
    this.elapsedTime += dt;

    if (!this.loadingComplete) {
      this.loadModels(state);
    }

    // ── Camera follow player ──────────────────────────────────────────
    const player = state.heroes[state.playerHeroIndex];
    if (player) {
      const targetX = (player.x - MAP_SIZE / 2) * WORLD_SCALE;
      const targetZ = (player.y - MAP_SIZE / 2) * WORLD_SCALE;
      const camDist = 22 / state.camera.zoom;
      const camHeight = 16 / state.camera.zoom;

      this.cameraTarget.set(targetX, 0, targetZ);
      Vector3.LerpToRef(this.cameraSmooth, this.cameraTarget, 0.06, this.cameraSmooth);

      const camX = this.cameraSmooth.x - camDist * 0.3;
      const camY = camHeight;
      const camZ = this.cameraSmooth.z + camDist;

      this.camera.position.x += (camX - this.camera.position.x) * 0.1;
      this.camera.position.y += (camY - this.camera.position.y) * 0.1;
      this.camera.position.z += (camZ - this.camera.position.z) * 0.1;
      this.camera.setTarget(this.cameraSmooth);
    }

    // ── Heroes ────────────────────────────────────────────────────────
    for (const hero of state.heroes) {
      if (hero.dead) {
        const e = this.heroMeshes.get(hero.id);
        if (e) e.root.setEnabled(false);
        continue;
      }
      const e = this._getOrCreateHero(hero);
      if (!e) continue;
      e.root.setEnabled(true);
      e.root.position = gameToWorld(hero.x - MAP_SIZE / 2, hero.y - MAP_SIZE / 2);
      e.root.rotation.y = -hero.facing + Math.PI / 2;

      if (e.entity) {
        const targetAnim = this._mapAnimState(hero.animState, hero.dead, e.entity);
        if (e.lastAnim !== targetAnim) {
          playAnimation(e.entity, targetAnim, 0.15);
          e.lastAnim = targetAnim;
        }
      }

      this._updateHealthBar(e, hero.hp, hero.maxHp);
    }

    // ── Towers ────────────────────────────────────────────────────────
    for (const tower of state.towers) {
      if (tower.dead) {
        const e = this.towerMeshes.get(tower.id);
        if (e) e.root.setEnabled(false);
        continue;
      }
      const e = this._getOrCreateTower(tower);
      e.root.setEnabled(true);
      e.root.position = gameToWorld(tower.x - MAP_SIZE / 2, tower.y - MAP_SIZE / 2);
      this._updateHealthBar(e, tower.hp, tower.maxHp);
    }

    // ── Nexuses ───────────────────────────────────────────────────────
    for (const nexus of state.nexuses) {
      if (nexus.dead) {
        const e = this.nexusMeshes.get(nexus.id);
        if (e) e.root.setEnabled(false);
        continue;
      }
      const e = this._getOrCreateNexus(nexus);
      e.root.setEnabled(true);
      e.root.position = gameToWorld(nexus.x - MAP_SIZE / 2, nexus.y - MAP_SIZE / 2);

      // Rotate crystal
      const crystal = e.root.getChildMeshes().find((m) => m.name.includes("crystal"));
      if (crystal) crystal.rotation.y += dt * 0.5;

      this._updateHealthBar(e, nexus.hp, nexus.maxHp);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  dispose() {
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}

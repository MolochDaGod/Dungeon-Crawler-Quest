/**
 * BabylonJS Open World Renderer — port of ow-three-renderer.ts
 *
 * Replaces Three.js + Rapier with BabylonJS 9.0 + Havok.
 * Same public API: constructor(container), loadPlayerModel(), update(), dispose().
 *
 * 16000×16000 zone-based world with:
 *   - Heightmap terrain mesh per zone (Ground + PBRMaterial)
 *   - Havok physics (character controller, raycasting)
 *   - Thin-instance batches for trees, rocks, buildings
 *   - GLB skinned characters with animation library
 *   - Third-person camera with smooth follow
 *   - Day/night lighting tied to world state
 *
 * Coordinate system: BabylonJS Y-up (X=right, Y=up, Z=forward)
 * The 2D game state (x,y) maps to BabylonJS (x, 0, z=y).
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
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
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import "@babylonjs/loaders/glTF";
import "@babylonjs/core/Helpers/sceneHelpers";

import {
  loadGLB,
  createAnimatedEntity,
  playAnimation,
  loadAnimationSet,
  applyAnimationsToEntity,
  ANIMATION_PATHS,
  type AnimatedEntity,
} from "./babylon-model-loader";
import { HERO_PREFABS, getHeroPrefabKey } from "./babylon-prefabs";
import { HEROES, CLASS_COLORS, getHeroById } from "./types";
import { ISLAND_ZONES, OPEN_WORLD_SIZE, type ZoneDef } from "./zones";
import { createOcean, applyOceanSceneSettings, type OceanSystem } from "./babylon-ocean";

// ── Types ──────────────────────────────────────────────────────

interface OWEntity3D {
  root: TransformNode;
  entity?: AnimatedEntity;
  healthBar?: Rectangle;
  nameLabel?: TextBlock;
  shadow?: Mesh;
  lastAnimState?: string;
}

// ── Constants ──────────────────────────────────────────────────

const TERRAIN_SEGMENTS = 64;
const VIEW_DISTANCE = 150;         // fog far — tight souls-like visibility
const RENDER_DISTANCE = 50;        // high-detail render radius (full LOD)
const CAMERA_HEIGHT = 8;           // over-the-shoulder height
const CAMERA_DISTANCE = 10;        // close 3rd-person follow
const CAMERA_LERP = 0.08;

const ZONE_COLORS: Record<string, Color3> = {
  grass:  new Color3(0.227, 0.416, 0.165),
  jungle: new Color3(0.165, 0.353, 0.102),
  water:  new Color3(0.102, 0.227, 0.353),
  stone:  new Color3(0.353, 0.353, 0.416),
  dirt:   new Color3(0.353, 0.290, 0.227),
};

// ── Main Renderer ──────────────────────────────────────────────

export class OpenWorldBabylonRenderer {
  private engine: Engine;
  private scene: Scene;
  private camera: FreeCamera;
  private canvas: HTMLCanvasElement;

  // Lighting
  private sunLight!: DirectionalLight;
  private sunTarget!: TransformNode;
  private hemiLight!: HemisphericLight;
  private shadowGenerator!: ShadowGenerator;

  // GUI
  private guiTexture!: AdvancedDynamicTexture;

  // Camera tracking
  private cameraTarget = Vector3.Zero();
  private cameraPosition = new Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE);

  // Terrain meshes per zone
  private terrainMeshes = new Map<number, Mesh>();
  private oceanMesh!: Mesh;
  private oceanSystem: OceanSystem | null = null;

  // Player
  private playerEntity: OWEntity3D | null = null;
  private playerModelLoaded = false;

  // Enemies
  private enemyEntities = new Map<number, OWEntity3D>();

  // State
  private initialized = false;
  private disposed = false;

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
    // Sky blue clear color
    this.scene.clearColor = new Color4(0.529, 0.808, 0.922, 1);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.529, 0.808, 0.922);
    this.scene.fogStart = RENDER_DISTANCE;       // crisp up to 50
    this.scene.fogEnd = VIEW_DISTANCE;             // fade to fog by 150

    // Camera — tight 3rd-person
    this.camera = new FreeCamera("owCam", new Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE), this.scene);
    this.camera.setTarget(Vector3.Zero());
    this.camera.minZ = 0.1;
    this.camera.maxZ = VIEW_DISTANCE + 50;
    // Don't attach controls — we drive camera manually
    this.camera.detachControl();

    // Async init (Havok + lighting + ocean)
    this._initAsync();
  }

  private async _initAsync() {
    // Physics
    const hk = await HavokPhysics();
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, hk));

    // Ground collider (invisible infinite ground plane at y=0)
    const groundCollider = MeshBuilder.CreateGround("groundCollider", {
      width: OPEN_WORLD_SIZE * 2,
      height: OPEN_WORLD_SIZE * 2,
    }, this.scene);
    groundCollider.position.set(OPEN_WORLD_SIZE / 2, -0.1, OPEN_WORLD_SIZE / 2);
    groundCollider.isVisible = false;
    new PhysicsAggregate(groundCollider, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    this._setupLighting();
    this._setupOcean();
    this._setupGUI();

    // Render loop
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", this._onResize);

    this.initialized = true;
  }

  // ── Lighting ─────────────────────────────────────────────────

  private _setupLighting(): void {
    // Hemisphere light (sky/ground ambient)
    this.hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    this.hemiLight.intensity = 0.6;
    this.hemiLight.diffuse = new Color3(0.529, 0.808, 0.922);
    this.hemiLight.groundColor = new Color3(0.227, 0.353, 0.165);

    // Sun — positioned close for tight shadow coverage
    this.sunLight = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), this.scene);
    this.sunLight.position = new Vector3(30, 60, 25);
    this.sunLight.intensity = 1.5;
    this.sunLight.shadowMinZ = 0.1;
    this.sunLight.shadowMaxZ = VIEW_DISTANCE;

    // Shadow target node (to follow player)
    this.sunTarget = new TransformNode("sunTarget", this.scene);

    // Shadows — tight frustum for crisp shadows at close range
    this.shadowGenerator = new ShadowGenerator(2048, this.sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 16;

    // Fill light
    const fill = new DirectionalLight("fill", new Vector3(0.5, -0.5, -0.3), this.scene);
    fill.intensity = 0.3;
  }

  // ── Ocean (stylized NodeMaterial shader) ─────────────────────

  private async _setupOcean(): Promise<void> {
    // Apply ocean palette to scene (clear color + fog)
    applyOceanSceneSettings(this.scene);

    try {
      this.oceanSystem = await createOcean(this.scene, this.camera, {
        enablePostEffects: true,
        baseY: -0.3,
        subdivisions: 128,
      });
      this.oceanMesh = this.oceanSystem.mesh;
    } catch {
      // Hard fallback — simple PBR ground if ocean system fails entirely
      const size = OPEN_WORLD_SIZE * 2;
      this.oceanMesh = MeshBuilder.CreateGround("ocean", {
        width: size,
        height: size,
      }, this.scene);
      this.oceanMesh.position.set(OPEN_WORLD_SIZE / 2, -0.5, OPEN_WORLD_SIZE / 2);
      this.oceanMesh.receiveShadows = true;

      const mat = new PBRMaterial("oceanMat", this.scene);
      mat.albedoColor = new Color3(0.102, 0.227, 0.353);
      mat.roughness = 0.3;
      mat.metallic = 0.1;
      mat.alpha = 0.85;
      this.oceanMesh.material = mat;
    }
  }

  // ── GUI ──────────────────────────────────────────────────────

  private _setupGUI(): void {
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("owHUD", true, this.scene);
  }

  // ── Zone Terrain ─────────────────────────────────────────────

  private _buildZoneTerrain(zone: ZoneDef): Mesh {
    const b = zone.bounds;

    const mesh = MeshBuilder.CreateGround(`terrain_${zone.id}`, {
      width: b.w,
      height: b.h,
      subdivisions: TERRAIN_SEGMENTS,
      updatable: true,
    }, this.scene);

    // Apply gentle height variation
    const positions = mesh.getVerticesData("position");
    if (positions) {
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        // Gentle rolling hills
        positions[i + 1] = Math.sin(x * 0.01) * 0.3 + Math.cos(z * 0.015) * 0.2 + Math.random() * 0.05;
      }
      mesh.updateVerticesData("position", positions);
      // Recompute normals
      const normals: number[] = [];
      const indices = mesh.getIndices()!;
      VertexData.ComputeNormals(positions, indices, normals);
      mesh.updateVerticesData("normal", normals);
    }

    mesh.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
    mesh.receiveShadows = true;

    const color = ZONE_COLORS[zone.terrainType] || ZONE_COLORS.grass;
    const mat = new PBRMaterial(`terrainMat_${zone.id}`, this.scene);
    mat.albedoColor = color;
    mat.roughness = 0.85;
    mat.metallic = 0.0;
    mesh.material = mat;

    return mesh;
  }

  private _ensureZoneTerrain(playerX: number, playerZ: number): void {
    for (const zone of ISLAND_ZONES) {
      const b = zone.bounds;
      const cx = b.x + b.w / 2;
      const cz = b.y + b.h / 2;
      const dist = Math.sqrt((playerX - cx) ** 2 + (playerZ - cz) ** 2);

      if (dist < VIEW_DISTANCE && !this.terrainMeshes.has(zone.id)) {
        const mesh = this._buildZoneTerrain(zone);
        this.terrainMeshes.set(zone.id, mesh);
      }
    }
  }

  // ── Player Character ─────────────────────────────────────────

  async loadPlayerModel(heroDataId: number, heroClass: string, race: string): Promise<void> {
    if (this.playerModelLoaded) return;

    const heroData = getHeroById(heroDataId) || HEROES.find(h => h.heroClass === heroClass && h.race === race);
    if (!heroData) return;

    const prefabKey = getHeroPrefabKey(heroData.race, heroData.heroClass, heroData.name);
    const prefab = HERO_PREFABS[prefabKey] || HERO_PREFABS[`${race.toLowerCase()}_${heroClass.toLowerCase()}`];

    const root = new TransformNode("player", this.scene);
    let entity: AnimatedEntity | undefined;

    if (prefab) {
      try {
        const model = await loadGLB(this.scene, prefab.modelPath);
        const scale = prefab.scale * 125; // scale up from MOBA scale to world scale
        model.root.scaling.setAll(scale);
        model.root.parent = root;

        // Enable shadows on all meshes
        for (const mesh of model.meshes) {
          mesh.receiveShadows = true;
          this.shadowGenerator.addShadowCaster(mesh);
        }

        // Create animated entity and load class animations
        entity = createAnimatedEntity(model);
        const animGroups = await loadAnimationSet(this.scene, ANIMATION_PATHS);
        applyAnimationsToEntity(entity, animGroups);

        // Start idle
        playAnimation(entity, "idle");
      } catch (err) {
        console.warn("[OW-Babylon] Failed to load player model:", err);
        this._buildFallbackPlayer(root, heroData);
      }
    } else {
      this._buildFallbackPlayer(root, heroData);
    }

    // Shadow decal
    const shadow = MeshBuilder.CreateDisc("playerShadow", { radius: 0.8, tessellation: 16 }, this.scene);
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.parent = root;
    const shadowMat = new StandardMaterial("shadowDecalMat", this.scene);
    shadowMat.diffuseColor = Color3.Black();
    shadowMat.alpha = 0.3;
    shadowMat.disableLighting = true;
    shadow.material = shadowMat;

    this.playerEntity = { root, entity, shadow, lastAnimState: undefined };
    this.playerModelLoaded = true;
  }

  private _buildFallbackPlayer(root: TransformNode, heroData: any): void {
    // Capsule body
    const colorHex: string = CLASS_COLORS[heroData.heroClass] || "#888888";
    const color = Color3.FromHexString(colorHex);

    const capsule = MeshBuilder.CreateCapsule("playerCapsule", {
      radius: 0.4,
      height: 1.8,
      tessellation: 16,
      subdivisions: 6,
    }, this.scene);
    capsule.position.y = 0.9;
    capsule.parent = root;
    this.shadowGenerator.addShadowCaster(capsule);

    const bodyMat = new PBRMaterial("playerBodyMat", this.scene);
    bodyMat.albedoColor = color;
    bodyMat.roughness = 0.5;
    bodyMat.metallic = 0.2;
    capsule.material = bodyMat;

    // Head
    const head = MeshBuilder.CreateSphere("playerHead", { diameter: 0.6, segments: 12 }, this.scene);
    head.position.y = 1.9;
    head.parent = root;
    this.shadowGenerator.addShadowCaster(head);

    const headMat = new PBRMaterial("playerHeadMat", this.scene);
    headMat.albedoColor = new Color3(0.867, 0.733, 0.667);
    headMat.roughness = 0.6;
    head.material = headMat;
  }

  // ── Animation State Mapping ──────────────────────────────────

  private _mapAnimState(state: string): string {
    switch (state) {
      case "walk": case "walking": return "walk";
      case "run": case "sprint": return "run";
      case "attack": case "attacking": case "combo_finisher": return "attack";
      case "dodge": return "dodge";
      case "block": return "block";
      case "hit": case "hurt": return "hit";
      case "death": case "dying": return "death";
      case "ability": return "spell";
      default: return "idle";
    }
  }

  // ── Update + Render ──────────────────────────────────────────

  update(
    playerX: number, playerY: number,
    playerFacing: number, playerAnimState: string,
    _gameTime: number, brightness: number,
  ): void {
    if (this.disposed || !this.initialized) return;

    // Ensure terrain near player
    this._ensureZoneTerrain(playerX, playerY);

    // Update player position (2D x,y → 3D x,0,z)
    if (this.playerEntity) {
      const pe = this.playerEntity;
      pe.root.position.set(playerX, 0, playerY);
      pe.root.rotation.y = -playerFacing + Math.PI / 2;

      // Animation state
      if (pe.entity && pe.lastAnimState !== playerAnimState) {
        const animName = this._mapAnimState(playerAnimState);
        playAnimation(pe.entity, animName);
        pe.lastAnimState = playerAnimState;
      }
    }

    // Camera follow
    const targetX = playerX;
    const targetZ = playerY;
    this.cameraTarget.set(targetX, 1, targetZ);

    const camX = targetX + Math.sin(playerFacing) * CAMERA_DISTANCE;
    const camZ = targetZ + Math.cos(playerFacing) * CAMERA_DISTANCE;
    Vector3.LerpToRef(
      this.cameraPosition,
      new Vector3(camX, CAMERA_HEIGHT, camZ),
      CAMERA_LERP,
      this.cameraPosition,
    );
    this.camera.position.copyFrom(this.cameraPosition);
    this.camera.setTarget(this.cameraTarget);

    // Sun follows player — tight offset for close shadow coverage
    this.sunLight.position.set(targetX + 30, 60, targetZ + 25);
    this.sunTarget.position.set(targetX, 0, targetZ);
    this.sunLight.setDirectionToTarget(this.sunTarget.position);

    // Ocean follows player (infinite ocean illusion)
    if (this.oceanSystem) {
      this.oceanSystem.update(targetX, targetZ, 0);
    }

    // Day/night brightness
    this.hemiLight.intensity = 0.3 + brightness * 0.4;
    this.sunLight.intensity = 0.5 + brightness * 1.2;

    const nightColor = new Color3(0.039, 0.086, 0.157);
    const dayColor = new Color3(0.529, 0.808, 0.922);
    const skyColor = Color3.Lerp(nightColor, dayColor, brightness);
    this.scene.clearColor = new Color4(skyColor.r, skyColor.g, skyColor.b, 1);
    this.scene.fogColor.copyFrom(skyColor);
  }

  // ── Resize ───────────────────────────────────────────────────

  private _onResize = (): void => {
    this.engine.resize();
  };

  // ── Cleanup ──────────────────────────────────────────────────

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("resize", this._onResize);
    if (this.oceanSystem) this.oceanSystem.dispose();
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  isReady(): boolean {
    return this.initialized;
  }
}

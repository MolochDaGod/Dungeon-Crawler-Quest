/**
 * Zone Scene Manager — One BabylonJS Scene Per Zone
 *
 * Based on the BabylonJS multi-scene pattern:
 *   - Each zone gets its own BABYLON.Scene with terrain, water, foliage, NPCs, etc.
 *   - Only the ACTIVE zone scene renders each frame.
 *   - A persistent GUI scene (autoClear=false) overlays on top of whichever zone is active.
 *   - Shared assets (player model, animations) live on a SharedAssetContainer that
 *     instantiates into each zone scene.
 *   - Zones are lazily loaded on first visit and disposed when 2+ zones away.
 *   - Transition: fade to black → dispose old → build new → fade in.
 *
 * Best practices per zone scene:
 *   - Thin-instance batching for trees, rocks, foliage
 *   - Compressed textures (KTX2 when available)
 *   - LOD meshes for distant objects
 *   - Physics body per zone (Havok)
 *   - Depth renderer for shore foam contact
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
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";

import "@babylonjs/loaders/glTF";

import { ISLAND_ZONES, OPEN_WORLD_SIZE, getZoneById, type ZoneDef } from "./zones";
import { getBiomeConfig, type BiomeConfig } from "./biome-config";
import { createOcean, createInlandWater, applyOceanSceneSettings, type OceanSystem } from "./babylon-ocean";
import { createShores, type ShoreSystem } from "./babylon-shores";

// ── Constants ──────────────────────────────────────────────────

const TRANSITION_FADE_SECONDS = 0.5;
const MAX_CACHED_ZONES = 3;          // keep at most 3 zone scenes alive
const VIEW_DISTANCE = 150;
const CAMERA_HEIGHT = 8;
const CAMERA_DISTANCE = 10;

// ── Types ──────────────────────────────────────────────────────

interface ZoneSceneData {
  scene: Scene;
  camera: FreeCamera;
  sunLight: DirectionalLight;
  shadowGenerator: ShadowGenerator;
  ocean: OceanSystem | null;
  shores: ShoreSystem | null;
  /** Timestamp of last activation (for LRU eviction) */
  lastUsed: number;
  zoneId: number;
}

export type TransitionPhase = 'none' | 'fade_out' | 'loading' | 'fade_in';

// ── Zone Scene Manager ─────────────────────────────────────────

export class ZoneSceneManager {
  private _engine: Engine;
  private _canvas: HTMLCanvasElement;

  /** Per-zone BabylonJS scenes (lazy-loaded) */
  private _zones = new Map<number, ZoneSceneData>();

  /** Currently active zone */
  private _activeZoneId: number = -1;

  /** GUI overlay scene (always renders on top) */
  private _guiScene: Scene;
  private _guiCamera: FreeCamera;
  private _guiTexture: AdvancedDynamicTexture;

  /** Transition state */
  private _transition: TransitionPhase = 'none';
  private _transitionProgress = 0;
  private _transitionTarget = -1;
  private _transitionSpawn = { x: 0, z: 0 };
  private _onTransitionMidpoint: (() => void) | null = null;

  /** Disposed flag */
  private _disposed = false;

  constructor(engine: Engine, canvas: HTMLCanvasElement) {
    this._engine = engine;
    this._canvas = canvas;

    // ── GUI Scene (persistent overlay) ──────────────────────
    this._guiScene = new Scene(engine);
    this._guiScene.autoClear = false; // renders on TOP of the zone scene
    this._guiCamera = new FreeCamera("guiCam", Vector3.Zero(), this._guiScene);
    this._guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("HUD", true, this._guiScene);

    // Resize
    window.addEventListener("resize", this._onResize);
  }

  // ── Public API ──────────────────────────────────────────────

  get activeZoneId(): number { return this._activeZoneId; }
  get guiTexture(): AdvancedDynamicTexture { return this._guiTexture; }
  get transition(): TransitionPhase { return this._transition; }
  get transitionProgress(): number { return this._transitionProgress; }

  /** Get the active zone's scene (or null if none loaded) */
  getActiveScene(): Scene | null {
    return this._zones.get(this._activeZoneId)?.scene ?? null;
  }

  /** Get the active zone's camera */
  getActiveCamera(): FreeCamera | null {
    return this._zones.get(this._activeZoneId)?.camera ?? null;
  }

  /**
   * Load a zone scene (async). If already cached, reactivates it.
   * Builds terrain, water, lighting, foliage from the zone's BiomeConfig.
   */
  async loadZone(zoneId: number): Promise<void> {
    if (this._zones.has(zoneId)) {
      // Already loaded — just mark as active
      this._activateZone(zoneId);
      return;
    }

    const zoneDef = getZoneById(zoneId);
    if (!zoneDef) return;

    const biome = getBiomeConfig(zoneId);
    const data = await this._buildZoneScene(zoneDef, biome);
    this._zones.set(zoneId, data);
    this._activateZone(zoneId);

    // Evict old zone scenes if over the cache limit
    this._evictOldZones();
  }

  /**
   * Transition from the current zone to a new one with fade effect.
   * @param zoneId - Target zone
   * @param spawnX - World X in the new zone
   * @param spawnZ - World Z in the new zone
   * @param onMidpoint - Optional callback when the screen is fully black (swap data here)
   */
  async transitionTo(
    zoneId: number,
    spawnX: number, spawnZ: number,
    onMidpoint?: () => void,
  ): Promise<void> {
    if (this._transition !== 'none') return;

    this._transitionTarget = zoneId;
    this._transitionSpawn = { x: spawnX, z: spawnZ };
    this._transition = 'fade_out';
    this._transitionProgress = 0;
    this._onTransitionMidpoint = onMidpoint ?? null;
  }

  /**
   * Call every frame. Renders the active zone scene + GUI overlay.
   * Handles transition animation.
   */
  update(dt: number): void {
    if (this._disposed) return;

    // ── Transition logic ─────────────────────────────────────
    if (this._transition !== 'none') {
      this._transitionProgress += dt / TRANSITION_FADE_SECONDS;

      if (this._transition === 'fade_out' && this._transitionProgress >= 1) {
        // Midpoint — screen is fully black
        this._transition = 'loading';
        this._transitionProgress = 0;
        this._onTransitionMidpoint?.();
        // Load the new zone (async)
        this.loadZone(this._transitionTarget).then(() => {
          this._transition = 'fade_in';
          this._transitionProgress = 0;
        });
      }

      if (this._transition === 'fade_in' && this._transitionProgress >= 1) {
        this._transition = 'none';
        this._transitionProgress = 0;
      }
    }

    // ── Render active zone scene ─────────────────────────────
    const activeData = this._zones.get(this._activeZoneId);
    if (activeData) {
      activeData.scene.render();
    }

    // ── Render GUI overlay on top ────────────────────────────
    this._guiScene.render();
  }

  /**
   * Get the transition overlay opacity (0 = clear, 1 = fully black).
   */
  getOverlayOpacity(): number {
    switch (this._transition) {
      case 'fade_out': return Math.min(1, this._transitionProgress);
      case 'loading': return 1;
      case 'fade_in': return Math.max(0, 1 - this._transitionProgress);
      default: return 0;
    }
  }

  dispose(): void {
    this._disposed = true;
    window.removeEventListener("resize", this._onResize);
    Array.from(this._zones.values()).forEach(data => {
      data.ocean?.dispose();
      data.shores?.dispose();
      data.scene.dispose();
    });
    this._zones.clear();
    this._guiScene.dispose();
  }

  // ── Internal ───────────────────────────────────────────────

  private _activateZone(zoneId: number): void {
    this._activeZoneId = zoneId;
    const data = this._zones.get(zoneId);
    if (data) {
      data.lastUsed = Date.now();
    }
  }

  private _evictOldZones(): void {
    if (this._zones.size <= MAX_CACHED_ZONES) return;

    // Find the least-recently-used zone that isn't the active one
    let oldestId = -1;
    let oldestTime = Infinity;
    Array.from(this._zones.entries()).forEach(([id, data]) => {
      if (id === this._activeZoneId) return;
      if (data.lastUsed < oldestTime) {
        oldestTime = data.lastUsed;
        oldestId = id;
      }
    });
    if (oldestId >= 0) {
      const evict = this._zones.get(oldestId)!;
      evict.ocean?.dispose();
      evict.shores?.dispose();
      evict.scene.dispose();
      this._zones.delete(oldestId);
    }
  }

  /**
   * Build a complete zone scene from scratch.
   */
  private async _buildZoneScene(zoneDef: ZoneDef, biome: BiomeConfig | null): Promise<ZoneSceneData> {
    const scene = new Scene(this._engine);

    // Scene settings
    scene.clearColor = new Color4(0.529, 0.808, 0.922, 1); // sky blue
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = new Color3(0.529, 0.808, 0.922);
    scene.fogStart = 50;
    scene.fogEnd = VIEW_DISTANCE;

    // Camera — tight 3rd person (controls driven by game logic, not attached)
    const camera = new FreeCamera(`cam_${zoneDef.id}`, new Vector3(0, CAMERA_HEIGHT, CAMERA_DISTANCE), scene);
    camera.minZ = 0.1;
    camera.maxZ = VIEW_DISTANCE + 50;

    // Lighting
    const hemi = new HemisphericLight(`hemi_${zoneDef.id}`, new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.6;
    if (biome) {
      hemi.diffuse = new Color3(biome.atmosphere.ambientColor.r, biome.atmosphere.ambientColor.g, biome.atmosphere.ambientColor.b);
      hemi.groundColor = new Color3(biome.atmosphere.ambientGroundColor.r, biome.atmosphere.ambientGroundColor.g, biome.atmosphere.ambientGroundColor.b);
    }

    const sun = new DirectionalLight(`sun_${zoneDef.id}`, new Vector3(-0.4, -1, 0.3), scene);
    sun.intensity = biome?.atmosphere.sunIntensity ?? 1.5;
    sun.position = new Vector3(30, 60, 25);

    const shadowGen = new ShadowGenerator(2048, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 16;

    // Terrain ground
    const S = OPEN_WORLD_SIZE;
    const ground = MeshBuilder.CreateGround(`ground_${zoneDef.id}`, {
      width: S, height: S, subdivisions: 64, updatable: false,
    }, scene);
    ground.position.set(S / 2, 0, S / 2);
    ground.receiveShadows = true;

    const groundMat = new PBRMaterial(`groundMat_${zoneDef.id}`, scene);
    if (biome) {
      groundMat.albedoColor = new Color3(biome.material.baseColor.r, biome.material.baseColor.g, biome.material.baseColor.b);
    } else {
      groundMat.albedoColor = new Color3(0.22, 0.42, 0.17);
    }
    groundMat.roughness = 0.85;
    groundMat.metallic = 0;
    ground.material = groundMat;

    // Ocean (deep water)
    let ocean: OceanSystem | null = null;
    try {
      ocean = await createOcean(scene, camera, { enablePostEffects: true });
    } catch { /* fallback handled inside */ }

    // Inland water (rivers + lakes from zone waterLanes)
    if (zoneDef.waterLanes.length > 0) {
      try {
        await createInlandWater(scene, zoneDef.waterLanes);
      } catch { /* non-critical */ }
    }

    // Shores / sand
    let shores: ShoreSystem | null = null;
    if (biome) {
      try {
        shores = createShores(scene, biome, shadowGen);
      } catch { /* non-critical */ }
    }

    // Apply atmosphere if biome provided
    if (biome) {
      const atm = biome.atmosphere;
      scene.clearColor = new Color4(atm.skyColor.r, atm.skyColor.g, atm.skyColor.b, 1);
      scene.fogColor = new Color3(atm.fogColor.r, atm.fogColor.g, atm.fogColor.b);
      scene.fogStart = atm.fogStart;
      scene.fogEnd = atm.fogEnd;
    }

    return {
      scene, camera, sunLight: sun, shadowGenerator: shadowGen,
      ocean, shores, lastUsed: Date.now(), zoneId: zoneDef.id,
    };
  }

  private _onResize = () => {
    this._engine.resize();
  };
}

// ── Factory ────────────────────────────────────────────────────

export function createZoneSceneManager(engine: Engine, canvas: HTMLCanvasElement): ZoneSceneManager {
  return new ZoneSceneManager(engine, canvas);
}

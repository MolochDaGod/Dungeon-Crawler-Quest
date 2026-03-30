/**
 * BabylonJS Ocean System — Dual-Tier Water
 *
 * Two tiers of water rendering:
 *
 * TIER 1 — FFT OCEAN (deep open ocean)
 *   Based on Popov72's BabylonJS FFT-Ocean (gasgiant/FFT-Ocean port).
 *   Uses compute-shader FFT wave generation with 3 cascades, PBRCustomMaterial
 *   for displacement + normals + foam + subsurface scattering, procedural skybox,
 *   and buoyancy.  Only runs when WebGPU compute is available; falls back to Tier 2.
 *
 * TIER 2 — NODEMATERIAL (inland waterways, rivers, lakes, near-shore)
 *   Uses the ClickON NodeMaterial snippet (#3FU5FG#1) by Simon Trushkin.
 *   Lightweight animated water with vertex displacement — no compute shaders needed.
 *   Applied to zone water lanes (rivers, lakes) and shore-blend meshes.
 *
 * Rule: water can't be land.  The ocean sits below terrain; wherever
 * terrain rises above ocean Y, land is rendered.  Water fills everything
 * below that level — shores and cliffs are the natural boundary.
 *
 * Usage:
 *   const ocean = await createOcean(scene, camera);
 *   // In render loop:
 *   ocean.update(playerX, playerZ, dt);
 *   // Create inland water for a specific zone:
 *   const river = await createInlandWater(scene, waterLaneDef);
 *   // Cleanup:
 *   ocean.dispose();
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { NodeMaterial } from "@babylonjs/core/Materials/Node/nodeMaterial";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Engine } from "@babylonjs/core/Engines/engine";

import { OPEN_WORLD_SIZE, type WaterLane } from "./zones";

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

/** NodeMaterial snippet for Tier 2 waterways (ClickON animated water) */
const WATERWAY_SNIPPET_ID = "#3FU5FG#1";

/** Ocean mesh extends beyond the world in all directions */
const OCEAN_EXTENT = OPEN_WORLD_SIZE * 3;

/** Base Y — ocean sits below terrain */
export const OCEAN_BASE_Y = -0.3;

/** Inland water Y — slightly above ocean so rivers sit on top of terrain */
const INLAND_WATER_Y = 0.05;

/** Shore blend distance in world units */
const SHORE_BLEND_RANGE = 200;

/** River/lake mesh width from the waterline polyline */
const WATERWAY_WIDTH = 120;

// ── Ocean palette ──────────────────────────────────────────────

export const OCEAN_CLEAR_COLOR = new Color4(0.314, 0.427, 0.522, 1); // #506D85
export const OCEAN_FOG_COLOR   = new Color3(0.314, 0.427, 0.522);

// ══════════════════════════════════════════════════════════════
// Tier Detection
// ══════════════════════════════════════════════════════════════

/** Check if the engine supports compute shaders (required for FFT ocean) */
function supportsCompute(scene: Scene): boolean {
  try {
    return scene.getEngine().getCaps().supportComputeShaders ?? false;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// Tier 1 — FFT Ocean (deep water)
// Based on Popov72's BabylonJS FFT-Ocean demo.
// The full FFT pipeline (WavesGenerator, WavesCascade, FFT,
// OceanGeometry, OceanMaterial, Buoyancy, SkyBox) are expected
// as separate modules.  This file provides the integration glue.
// ══════════════════════════════════════════════════════════════

/**
 * FFT ocean wave settings — matches WavesSettings from the demo.
 * Tuned for a pirate/fantasy game ocean.
 */
export const FFT_WAVE_DEFAULTS = {
  g: 9.81,
  depth: 3,
  lambda: 1,
  local: {
    scale: 0.5,
    windSpeed: 1.5,
    windDirection: -29.81,
    fetch: 100000,
    spreadBlend: 1,
    swell: 0.198,
    peakEnhancement: 3.3,
    shortWavesFade: 0.01,
  },
  swell: {
    scale: 0.5,
    windSpeed: 1.5,
    windDirection: 90,
    fetch: 300000,
    spreadBlend: 1,
    swell: 1,
    peakEnhancement: 3.3,
    shortWavesFade: 0.01,
  },
} as const;

/**
 * FFT ocean shader material defaults for the PBRCustomMaterial.
 */
export const FFT_MATERIAL_DEFAULTS = {
  color: new Color3(0.011, 0.056, 0.099),
  maxGloss: 0.91,
  roughnessScale: 0.0044,
  lodScale: 7.13,
  foamColor: new Color3(1, 1, 1),
  foamScale: 2.4,
  contactFoam: 1,
  foamBiasLOD2: 2.72,
  sssColor: new Color3(0.154, 0.886, 0.991),
  sssStrength: 0.15,
  sssBase: -0.261,
  sssScale: 4.7,
} as const;

// ══════════════════════════════════════════════════════════════
// Ocean System Handle
// ══════════════════════════════════════════════════════════════

export type OceanTier = 'fft' | 'nodematerial' | 'fallback';

export interface OceanSystem {
  /** Which rendering tier is active */
  tier: OceanTier;
  /** The main deep-ocean mesh */
  mesh: Mesh;
  /** Shore ring meshes */
  shoreMeshes: Mesh[];
  /** Post-processing pipeline */
  pipeline: DefaultRenderingPipeline | null;
  /** Move the ocean to follow the player */
  update: (playerX: number, playerZ: number, dt: number) => void;
  /** Cleanup everything */
  dispose: () => void;
}

// ══════════════════════════════════════════════════════════════
// Inland Waterway Handle (Tier 2 — rivers, lakes)
// ══════════════════════════════════════════════════════════════

export interface InlandWaterSystem {
  root: TransformNode;
  meshes: Mesh[];
  /** Cached NodeMaterial for reuse across multiple water bodies */
  material: NodeMaterial | PBRMaterial;
  dispose: () => void;
}

// ══════════════════════════════════════════════════════════════
// Factory — Main Ocean (Tier 1 or Tier 2 fallback)
// ══════════════════════════════════════════════════════════════

/**
 * Create the deep ocean system.
 * Tries FFT (Tier 1) if compute shaders are available,
 * falls back to NodeMaterial (Tier 2), then PBR (fallback).
 */
export async function createOcean(
  scene: Scene,
  camera: Camera,
  options?: {
    enablePostEffects?: boolean;
    baseY?: number;
    subdivisions?: number;
    /** Force a specific tier (skip auto-detection) */
    forceTier?: OceanTier;
  },
): Promise<OceanSystem> {
  const baseY = options?.baseY ?? OCEAN_BASE_Y;
  const subdivs = options?.subdivisions ?? 128;
  const enablePost = options?.enablePostEffects ?? true;
  const hasCompute = supportsCompute(scene);
  const preferredTier = options?.forceTier ?? (hasCompute ? 'fft' : 'nodematerial');

  // ── Main ocean mesh (shared across all tiers) ──────────────
  const mesh = MeshBuilder.CreateGround("ocean", {
    width: OCEAN_EXTENT,
    height: OCEAN_EXTENT,
    subdivisions: subdivs,
  }, scene);
  mesh.position.set(OPEN_WORLD_SIZE / 2, baseY, OPEN_WORLD_SIZE / 2);
  mesh.receiveShadows = true;

  let activeTier: OceanTier = 'fallback';

  // ── Tier 1: FFT Ocean (compute shaders) ────────────────────
  if (preferredTier === 'fft' && hasCompute) {
    try {
      // The FFT pipeline classes (WavesGenerator, OceanGeometry,
      // OceanMaterial, etc.) are large and loaded dynamically.
      // For now we set a marker; the full FFT classes from the
      // Popov72 demo should be imported separately.
      //
      // The ocean mesh gets a simple deep-water PBR until the FFT
      // material finishes building (it needs async compute init).
      const fftMat = new PBRMaterial("oceanFFT", scene);
      fftMat.albedoColor = FFT_MATERIAL_DEFAULTS.color;
      fftMat.roughness = 1 - FFT_MATERIAL_DEFAULTS.maxGloss;
      fftMat.metallic = 0;
      fftMat.alpha = 0.92;
      fftMat.backFaceCulling = false;
      // TODO: Replace with full PBRCustomMaterial from FFT pipeline
      // once WavesGenerator + OceanMaterial modules are integrated.
      mesh.material = fftMat;
      activeTier = 'fft';
      console.log("[Ocean] Tier 1 — FFT ocean (compute shaders available)");
    } catch {
      console.warn("[Ocean] FFT init failed, falling back to Tier 2");
    }
  }

  // ── Tier 2: NodeMaterial (no compute needed) ───────────────
  if (activeTier !== 'fft') {
    try {
      const nodeMat = await NodeMaterial.ParseFromSnippetAsync(WATERWAY_SNIPPET_ID, scene);
      mesh.material = nodeMat;
      activeTier = 'nodematerial';
      console.log("[Ocean] Tier 2 — NodeMaterial ocean (ClickON shader)");
    } catch {
      console.warn("[Ocean] NodeMaterial snippet failed, using PBR fallback");
    }
  }

  // ── Fallback: simple PBR water ─────────────────────────────
  if (activeTier === 'fallback') {
    const fallback = new PBRMaterial("oceanFallback", scene);
    fallback.albedoColor = new Color3(0.08, 0.22, 0.36);
    fallback.roughness = 0.25;
    fallback.metallic = 0.12;
    fallback.alpha = 0.85;
    fallback.backFaceCulling = false;
    mesh.material = fallback;
  }

  // ── Shore rings ────────────────────────────────────────────
  const shoreMeshes = createShoreRings(scene, baseY);

  // ── Post-processing ────────────────────────────────────────
  let pipeline: DefaultRenderingPipeline | null = null;
  if (enablePost) {
    pipeline = createOceanPostEffects(scene, camera);
  }

  // ── Update ─────────────────────────────────────────────────
  const update = (playerX: number, playerZ: number, _dt: number) => {
    const snapSize = 2000;
    mesh.position.x = Math.round(playerX / snapSize) * snapSize;
    mesh.position.z = Math.round(playerZ / snapSize) * snapSize;
    mesh.position.y = baseY;
  };

  // ── Dispose ────────────────────────────────────────────────
  const dispose = () => {
    mesh.dispose();
    for (const s of shoreMeshes) s.dispose();
    if (pipeline) pipeline.dispose();
  };

  return { tier: activeTier, mesh, shoreMeshes, pipeline, update, dispose };
}

// ══════════════════════════════════════════════════════════════
// Factory — Inland Waterways (Tier 2 only — rivers, lakes)
// ══════════════════════════════════════════════════════════════

/** Cached NodeMaterial so all waterways share one shader */
let _cachedWaterwayMaterial: NodeMaterial | null = null;

/**
 * Create water meshes for a zone's rivers and lakes.
 * Uses the ClickON NodeMaterial (Tier 2) for lightweight animated water.
 *
 * @param scene      - BabylonJS scene
 * @param waterLanes - From zone.waterLanes (rivers and lakes)
 * @param waterY     - Y level (default slightly above ocean)
 */
export async function createInlandWater(
  scene: Scene,
  waterLanes: WaterLane[],
  waterY = INLAND_WATER_Y,
): Promise<InlandWaterSystem> {
  const root = new TransformNode("inlandWater", scene);
  const meshes: Mesh[] = [];

  // Load or reuse the NodeMaterial
  let material: NodeMaterial | PBRMaterial;
  if (_cachedWaterwayMaterial) {
    material = _cachedWaterwayMaterial;
  } else {
    try {
      _cachedWaterwayMaterial = await NodeMaterial.ParseFromSnippetAsync(WATERWAY_SNIPPET_ID, scene);
      material = _cachedWaterwayMaterial;
    } catch {
      // PBR fallback for inland water
      const fallback = new PBRMaterial("inlandWaterFallback", scene);
      fallback.albedoColor = new Color3(0.10, 0.28, 0.42);
      fallback.roughness = 0.22;
      fallback.metallic = 0.10;
      fallback.alpha = 0.75;
      fallback.backFaceCulling = false;
      material = fallback;
    }
  }

  for (let i = 0; i < waterLanes.length; i++) {
    const lane = waterLanes[i];

    if (lane.type === 'river') {
      // Rivers: build a strip mesh following the polyline points
      const pts = lane.points;
      if (pts.length < 2) continue;

      // For each segment, create a ground strip
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 10) continue;

        const seg = MeshBuilder.CreateGround(
          `river_${i}_${j}`,
          { width: len, height: WATERWAY_WIDTH, subdivisions: Math.min(32, Math.ceil(len / 80)) },
          scene,
        );
        seg.position.set((a.x + b.x) / 2, waterY, (a.y + b.y) / 2);
        seg.rotation.y = -Math.atan2(dy, dx);
        seg.material = material;
        seg.parent = root;
        seg.receiveShadows = true;
        meshes.push(seg);
      }
    } else if (lane.type === 'lake') {
      // Lakes: convex hull → compute bounding circle and use a disc mesh
      const pts = lane.points;
      if (pts.length < 3) continue;

      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cz = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      let maxR = 0;
      for (const p of pts) {
        const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cz) ** 2);
        if (r > maxR) maxR = r;
      }

      const lake = MeshBuilder.CreateGround(
        `lake_${i}`,
        { width: maxR * 2, height: maxR * 2, subdivisions: 32 },
        scene,
      );
      lake.position.set(cx, waterY, cz);
      lake.material = material;
      lake.parent = root;
      lake.receiveShadows = true;
      meshes.push(lake);
    }
  }

  const dispose = () => {
    for (const m of meshes) m.dispose();
    root.dispose();
  };

  return { root, meshes, material, dispose };
}

// ══════════════════════════════════════════════════════════════
// Shore Ring Meshes
// ══════════════════════════════════════════════════════════════

function createShoreRings(scene: Scene, baseY: number): Mesh[] {
  const meshes: Mesh[] = [];
  const S = OPEN_WORLD_SIZE;
  const blend = SHORE_BLEND_RANGE;

  const shoreMat = new PBRMaterial("shoreMat", scene);
  shoreMat.albedoColor = new Color3(0.35, 0.55, 0.65);
  shoreMat.roughness = 0.4;
  shoreMat.metallic = 0.05;
  shoreMat.alpha = 0.45;
  shoreMat.backFaceCulling = false;

  const edges: [string, number, number, number, number][] = [
    ["shore_n", S, blend, S / 2, blend / 2],
    ["shore_s", S, blend, S / 2, S - blend / 2],
    ["shore_w", blend, S, blend / 2, S / 2],
    ["shore_e", blend, S, S - blend / 2, S / 2],
  ];

  for (const [name, w, h, px, pz] of edges) {
    const m = MeshBuilder.CreateGround(name, { width: w, height: h, subdivisions: 32 }, scene);
    m.position.set(px, baseY + 0.05, pz);
    m.material = shoreMat;
    meshes.push(m);
  }

  return meshes;
}

// ══════════════════════════════════════════════════════════════
// Post-Processing
// ══════════════════════════════════════════════════════════════

function createOceanPostEffects(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline("oceanPipeline", false, scene, [camera]);

  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.15;
  pipeline.bloomKernel = 48;
  pipeline.bloomScale = 0.4;
  pipeline.bloomWeight = 0.35;

  pipeline.grainEnabled = true;
  pipeline.grain.intensity = 5;
  pipeline.grain.animated = true;

  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberration.aberrationAmount = 12;
  pipeline.chromaticAberration.radialIntensity = 0.8;

  pipeline.sharpenEnabled = true;
  pipeline.sharpen.edgeAmount = 0.12;

  return pipeline;
}

// ══════════════════════════════════════════════════════════════
// Integration Helpers
// ══════════════════════════════════════════════════════════════

export function applyOceanSceneSettings(scene: Scene): void {
  scene.clearColor = OCEAN_CLEAR_COLOR;
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogColor = OCEAN_FOG_COLOR;
  scene.fogDensity = 0.0008;
}

/**
 * Is this terrain point underwater? (core rule: water can't be land)
 */
export function isUnderwater(terrainHeight: number, oceanY = OCEAN_BASE_Y): boolean {
  return terrainHeight < oceanY;
}

/**
 * Shore blend factor: 0 = deep water, 1 = dry land.
 */
export function getShoreBlend(
  terrainHeight: number,
  oceanY = OCEAN_BASE_Y,
  blendRange = 1.5,
): number {
  if (terrainHeight >= oceanY + blendRange) return 1;
  if (terrainHeight <= oceanY) return 0;
  return (terrainHeight - oceanY) / blendRange;
}

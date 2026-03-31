/**
 * BabylonJS Shores & Sand System
 *
 * Creates beach/sand terrain at the transition between ocean and land.
 * Rule: water can't be land — sand fills the band where terrain height
 * is between OCEAN_BASE_Y and the first solid land elevation.
 *
 * Architecture:
 *   - Per-zone shore mesh: heightmap-displaced ground at the coastline
 *   - Sand material with diffuse texture + specular suppression
 *   - Foam strip at the waterline (animated alpha blend)
 *   - Integrates with babylon-ocean.ts for Y levels and biome-config.ts
 *     for coastline polygons
 *
 * Inspired by BabylonJS CreateGroundFromHeightMap pattern.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Color3 } from "@babylonjs/core/Maths/math";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";

import { OPEN_WORLD_SIZE } from "./zones";
import type { CoastlineDef, HeightConfig, BiomeConfig } from "./biome-config";

// ── Constants ──────────────────────────────────────────────────

/** Y level of the ocean surface (must match babylon-ocean.ts) */
const OCEAN_Y = -0.3;

/** Max vertical extent of shore above ocean — sand can't go above this */
const SHORE_MAX_HEIGHT = 2.5;

/** Shore band width in world units — how far inland the sand extends */
const SHORE_BAND_WIDTH = 400;

/** Shore mesh subdivisions per side */
const SHORE_SUBDIVS = 64;

/** Foam strip width (world units at the waterline) */
const FOAM_WIDTH = 60;

// ── Sand Palette ───────────────────────────────────────────────

export const SAND_COLORS = {
  /** Warm dry sand — above waterline */
  dry:     new Color3(0.82, 0.73, 0.55),
  /** Wet sand — near waterline */
  wet:     new Color3(0.60, 0.52, 0.38),
  /** Foam/surf — animated white at water edge */
  foam:    new Color3(0.88, 0.92, 0.95),
  /** Dark sand — shaded / under cliffs */
  shadow:  new Color3(0.42, 0.36, 0.25),
};

// ── Shore Result ───────────────────────────────────────────────

export interface ShoreSystem {
  root: TransformNode;
  /** Sand terrain meshes (one per cardinal edge, or per coastline segment) */
  sandMeshes: Mesh[];
  /** Animated foam strip mesh at the waterline */
  foamMesh: Mesh | null;
  /** Update foam animation */
  update: (time: number) => void;
  /** Cleanup */
  dispose: () => void;
}

// ── Factory ────────────────────────────────────────────────────

/**
 * Create the shore/sand system for a zone.
 *
 * @param scene    - BabylonJS scene
 * @param config   - Biome config for the zone (provides coastline + height data)
 * @param shadow   - Optional shadow generator to receive shadows on sand
 * @param textures - Optional texture paths for sand diffuse + normal
 */
export function createShores(
  scene: Scene,
  config: BiomeConfig,
  shadow?: ShadowGenerator,
  textures?: {
    sandDiffuse?: string;
    sandNormal?: string;
    heightMap?: string;
  },
): ShoreSystem {
  const root = new TransformNode(`shores_${config.zoneId}`, scene);
  const S = OPEN_WORLD_SIZE;
  const h = config.height;
  const sandMeshes: Mesh[] = [];

  // ── Sand material ───────────────────────────────────────────
  const sandMat = createSandMaterial(scene, config.zoneId, textures);

  // ── Build shore meshes along each zone edge ─────────────────
  // North
  const northShore = buildShorePlane(scene, `shore_sand_n_${config.zoneId}`, S, SHORE_BAND_WIDTH, SHORE_SUBDIVS);
  northShore.position.set(S / 2, 0, SHORE_BAND_WIDTH / 2);
  northShore.parent = root;
  northShore.material = sandMat;
  northShore.receiveShadows = true;
  if (shadow) shadow.addShadowCaster(northShore);
  displaceShoreVertices(northShore, h, 'north');
  sandMeshes.push(northShore);

  // South
  const southShore = buildShorePlane(scene, `shore_sand_s_${config.zoneId}`, S, SHORE_BAND_WIDTH, SHORE_SUBDIVS);
  southShore.position.set(S / 2, 0, S - SHORE_BAND_WIDTH / 2);
  southShore.parent = root;
  southShore.material = sandMat;
  southShore.receiveShadows = true;
  if (shadow) shadow.addShadowCaster(southShore);
  displaceShoreVertices(southShore, h, 'south');
  sandMeshes.push(southShore);

  // West
  const westShore = buildShorePlane(scene, `shore_sand_w_${config.zoneId}`, SHORE_BAND_WIDTH, S, SHORE_SUBDIVS);
  westShore.position.set(SHORE_BAND_WIDTH / 2, 0, S / 2);
  westShore.parent = root;
  westShore.material = sandMat;
  westShore.receiveShadows = true;
  if (shadow) shadow.addShadowCaster(westShore);
  displaceShoreVertices(westShore, h, 'west');
  sandMeshes.push(westShore);

  // East
  const eastShore = buildShorePlane(scene, `shore_sand_e_${config.zoneId}`, SHORE_BAND_WIDTH, S, SHORE_SUBDIVS);
  eastShore.position.set(S - SHORE_BAND_WIDTH / 2, 0, S / 2);
  eastShore.parent = root;
  eastShore.material = sandMat;
  eastShore.receiveShadows = true;
  if (shadow) shadow.addShadowCaster(eastShore);
  displaceShoreVertices(eastShore, h, 'east');
  sandMeshes.push(eastShore);

  // ── Coastline-traced sand (if polygon available) ────────────
  if (h.coastline) {
    const coastSand = buildCoastlineSand(scene, config, sandMat, root);
    sandMeshes.push(...coastSand);
  }

  // ── Foam strip ──────────────────────────────────────────────
  const foamMesh = buildFoamStrip(scene, config.zoneId, root);

  // ── Update (animate foam) ──────────────────────────────────
  const update = (time: number) => {
    if (foamMesh && foamMesh.material) {
      // Animate foam alpha for wave lapping effect
      const wave = 0.3 + Math.sin(time * 0.002) * 0.15 + Math.sin(time * 0.005) * 0.1;
      (foamMesh.material as PBRMaterial).alpha = wave;
    }
  };

  // ── Dispose ─────────────────────────────────────────────────
  const dispose = () => {
    for (const m of sandMeshes) m.dispose();
    if (foamMesh) foamMesh.dispose();
    root.dispose();
  };

  return { root, sandMeshes, foamMesh, update, dispose };
}

// ── Sand Material ──────────────────────────────────────────────

function createSandMaterial(
  scene: Scene,
  zoneId: number,
  textures?: { sandDiffuse?: string; sandNormal?: string },
): PBRMaterial {
  const mat = new PBRMaterial(`sandMat_${zoneId}`, scene);
  mat.albedoColor = SAND_COLORS.dry;
  mat.roughness = 0.92;
  mat.metallic = 0.0;

  // Suppress specular — sand doesn't shine
  mat.specularIntensity = 0.05;

  // Load diffuse texture if provided
  if (textures?.sandDiffuse) {
    const diffTex = new Texture(textures.sandDiffuse, scene);
    diffTex.uScale = 6;
    diffTex.vScale = 6;
    mat.albedoTexture = diffTex;
  }

  // Load normal map if provided
  if (textures?.sandNormal) {
    mat.bumpTexture = new Texture(textures.sandNormal, scene);
    (mat.bumpTexture as Texture).uScale = 6;
    (mat.bumpTexture as Texture).vScale = 6;
    mat.bumpTexture.level = 0.5;
  }

  return mat;
}

// ── Shore Ground Plane ─────────────────────────────────────────

function buildShorePlane(
  scene: Scene, name: string, width: number, depth: number, subdivs: number,
): Mesh {
  return MeshBuilder.CreateGround(name, {
    width,
    height: depth,
    subdivisions: subdivs,
    updatable: true,
  }, scene);
}

// ── Height Displacement ────────────────────────────────────────

/**
 * Displace shore vertices so they slope gently from OCEAN_Y up to
 * SHORE_MAX_HEIGHT, creating a natural beach gradient.
 * The inland edge rises to meet the terrain; the ocean edge stays at OCEAN_Y.
 */
function displaceShoreVertices(
  mesh: Mesh,
  h: HeightConfig,
  edge: 'north' | 'south' | 'east' | 'west',
): void {
  const positions = mesh.getVerticesData("position");
  if (!positions) return;

  for (let i = 0; i < positions.length; i += 3) {
    const lx = positions[i];     // local X
    const lz = positions[i + 2]; // local Z

    // Compute a 0→1 gradient: 0 at the ocean edge, 1 at the land edge
    let t: number;
    const halfBand = SHORE_BAND_WIDTH / 2;

    switch (edge) {
      case 'north': t = (lz + halfBand) / SHORE_BAND_WIDTH; break;       // z grows toward land
      case 'south': t = 1 - (lz + halfBand) / SHORE_BAND_WIDTH; break;   // z shrinks toward land
      case 'west':  t = (lx + halfBand) / SHORE_BAND_WIDTH; break;
      case 'east':  t = 1 - (lx + halfBand) / SHORE_BAND_WIDTH; break;
    }

    t = Math.max(0, Math.min(1, t));

    // Smooth ease-in curve for natural beach slope
    const eased = t * t * (3 - 2 * t); // smoothstep

    // Some noise for organic shape (deterministic from position)
    const nx = (positions[i] + mesh.position.x) * 0.003;
    const nz = (positions[i + 2] + mesh.position.z) * 0.003;
    const noiseVal = Math.sin(nx * 7.3 + nz * 4.1) * 0.3 + Math.cos(nx * 3.7 - nz * 5.9) * 0.2;

    positions[i + 1] = OCEAN_Y + eased * (SHORE_MAX_HEIGHT - OCEAN_Y) + noiseVal * eased * 0.5;
  }

  mesh.updateVerticesData("position", positions);

  // Recompute normals
  const normals: number[] = [];
  const indices = mesh.getIndices()!;
  VertexData.ComputeNormals(positions, indices, normals);
  mesh.updateVerticesData("normal", normals);
}

// ── Coastline-Traced Sand ──────────────────────────────────────

/**
 * Build sand patches that follow the authored coastline polygon.
 * Each polygon edge gets a sand strip that slopes from OCEAN_Y to land.
 */
function buildCoastlineSand(
  scene: Scene,
  config: BiomeConfig,
  sandMat: PBRMaterial,
  parent: TransformNode,
): Mesh[] {
  const coast = config.height.coastline;
  if (!coast) return [];

  const meshes: Mesh[] = [];
  const poly = coast.landPolygon;
  const bandW = Math.min(SHORE_BAND_WIDTH, coast.beachWidth * 1.5);

  // For each edge of the coastline polygon, create a sand strip
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];

    // Edge vector and perpendicular (pointing outward = toward ocean)
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 50) continue; // skip tiny edges

    // Perpendicular (90° CCW) pointing outward from land
    const nx = -dy / len;
    const ny = dx / len;

    // Create a thin ground strip along this edge
    const stripMesh = MeshBuilder.CreateGround(
      `coastSand_${config.zoneId}_${i}`,
      { width: len, height: bandW, subdivisions: Math.min(32, Math.ceil(len / 50)) },
      scene,
    );

    // Position at edge midpoint
    const mx = (a.x + b.x) / 2;
    const mz = (a.y + b.y) / 2;
    stripMesh.position.set(mx, OCEAN_Y + 0.05, mz);

    // Rotate to align with edge direction
    const angle = Math.atan2(dy, dx);
    stripMesh.rotation.y = -angle;

    stripMesh.parent = parent;
    stripMesh.material = sandMat;
    stripMesh.receiveShadows = true;

    // Displace: inland side rises, ocean side stays at OCEAN_Y
    const positions = stripMesh.getVerticesData("position");
    if (positions) {
      const halfH = bandW / 2;
      for (let vi = 0; vi < positions.length; vi += 3) {
        const localZ = positions[vi + 2]; // perpendicular to edge
        const t = Math.max(0, Math.min(1, (localZ + halfH) / bandW));
        const eased = t * t * (3 - 2 * t);
        positions[vi + 1] = eased * SHORE_MAX_HEIGHT * 0.6;
      }
      stripMesh.updateVerticesData("position", positions);
      const normals: number[] = [];
      const indices = stripMesh.getIndices()!;
      VertexData.ComputeNormals(positions, indices, normals);
      stripMesh.updateVerticesData("normal", normals);
    }

    meshes.push(stripMesh);
  }

  return meshes;
}

// ── Foam Strip ─────────────────────────────────────────────────

/**
 * Build an animated foam ring at the waterline.
 * This is a thin, semi-transparent white mesh that sits right at OCEAN_Y
 * around the zone perimeter.
 */
function buildFoamStrip(scene: Scene, zoneId: number, parent: TransformNode): Mesh | null {
  const S = OPEN_WORLD_SIZE;

  // A single large ground plane at OCEAN_Y that covers just the foam band
  const foam = MeshBuilder.CreateGround(`foam_${zoneId}`, {
    width: S + FOAM_WIDTH * 2,
    height: S + FOAM_WIDTH * 2,
    subdivisions: 32,
  }, scene);
  foam.position.set(S / 2, OCEAN_Y + 0.08, S / 2);
  foam.parent = parent;

  const foamMat = new PBRMaterial(`foamMat_${zoneId}`, scene);
  foamMat.albedoColor = SAND_COLORS.foam;
  foamMat.roughness = 0.6;
  foamMat.metallic = 0.0;
  foamMat.alpha = 0.35;
  foamMat.backFaceCulling = false;
  foam.material = foamMat;

  // Displace foam vertices: only keep vertices near the zone edge,
  // push interior and far-exterior vertices below ocean to hide them
  const positions = foam.getVerticesData("position");
  if (positions) {
    const halfSize = (S + FOAM_WIDTH * 2) / 2;
    for (let i = 0; i < positions.length; i += 3) {
      const wx = positions[i] + S / 2;
      const wz = positions[i + 2] + S / 2;

      // Distance from nearest zone edge
      const distFromEdge = Math.min(wx, wz, S - wx, S - wz);

      // Only foam within FOAM_WIDTH of the edge
      if (distFromEdge > FOAM_WIDTH || distFromEdge < -FOAM_WIDTH) {
        positions[i + 1] = -5; // hide below ocean
      } else {
        // Gentle wave shape
        const wave = Math.sin(wx * 0.02 + wz * 0.015) * 0.05;
        positions[i + 1] = wave;
      }
    }
    foam.updateVerticesData("position", positions);
  }

  return foam;
}

// ── Query Helpers ──────────────────────────────────────────────

/**
 * Is this world position on a sandy shore?
 * Returns true if the position is within the shore band and
 * terrain height is between OCEAN_Y and SHORE_MAX_HEIGHT.
 */
export function isOnShore(
  x: number, z: number,
  terrainHeight: number,
): boolean {
  const S = OPEN_WORLD_SIZE;
  const distFromEdge = Math.min(x, z, S - x, S - z);
  if (distFromEdge > SHORE_BAND_WIDTH) return false;
  return terrainHeight >= OCEAN_Y && terrainHeight <= SHORE_MAX_HEIGHT;
}

/**
 * Get sand blend factor for this position (0 = no sand, 1 = full sand).
 * Used by terrain materials to blend sand texture at beaches.
 */
export function getSandBlend(
  x: number, z: number,
  terrainHeight: number,
): number {
  const S = OPEN_WORLD_SIZE;
  const distFromEdge = Math.min(x, z, S - x, S - z);
  if (distFromEdge > SHORE_BAND_WIDTH) return 0;
  if (terrainHeight < OCEAN_Y || terrainHeight > SHORE_MAX_HEIGHT) return 0;

  // Blend based on distance from edge (closer = more sand)
  const edgeFactor = 1 - (distFromEdge / SHORE_BAND_WIDTH);
  // And height (lower = more sand)
  const heightFactor = 1 - ((terrainHeight - OCEAN_Y) / (SHORE_MAX_HEIGHT - OCEAN_Y));

  return Math.max(0, Math.min(1, edgeFactor * 0.6 + heightFactor * 0.4));
}

/**
 * Get the sand movement speed modifier.
 * Walking on sand is slower than walking on grass.
 */
export function getSandSpeedModifier(sandBlend: number): number {
  // Full sand = 85% speed, no sand = 100%
  return 1 - sandBlend * 0.15;
}

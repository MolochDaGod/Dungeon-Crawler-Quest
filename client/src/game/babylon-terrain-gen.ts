/**
 * BabylonJS Terrain Generator — 3-layer biome-driven terrain.
 *
 * Layer 1: Base ground mesh — subdivided plane displaced by layered simplex noise.
 * Layer 2: Rock/cliff detail — thin-instanced stone/boulder meshes on steep slopes.
 * Layer 3: Tall foliage — thin-instanced wheat, corn, trees on flat areas.
 *
 * Reads BiomeConfig for height params, material colors, foliage entries.
 * Reuses SimplexNoise from ai-map-gen.ts for deterministic generation.
 */

import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Matrix, Color3, Color4 } from "@babylonjs/core/Maths/math";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import "@babylonjs/loaders/glTF";

import type { BiomeConfig, HeightConfig, HeightRegion, CoastlineDef, MaterialConfig, FoliageEntry, TerrainColor, ZonePointOfInterest } from "./biome-config";
import { SimplexNoise } from "./ai-map-gen";
import { OPEN_WORLD_SIZE } from "./zones";

// ── Constants ──────────────────────────────────────────────────

const TERRAIN_SUBDIVS = 128;        // vertices per side of ground mesh
const ROAD_HALF_WIDTH = 80;         // world units half-width of roads
const SAFE_ZONE_FLATTEN = 0.1;      // flatten factor inside safe zones
const WATER_SUBDIVS = 64;           // water plane subdivisions

// ── Seeded noise instance ──────────────────────────────────────

const noise = new SimplexNoise(42);

// ── Height sampling ────────────────────────────────────────────

/** Sample terrain height at world (x, z) using biome config noise layers */
export function sampleHeight(x: number, z: number, h: HeightConfig): number {
  const macro = noise.fbm(x * h.macroFreq, z * h.macroFreq, 3, 2.0, 0.5);
  const ridge = Math.abs(noise.noise2D(x * h.ridgeFreq, z * h.ridgeFreq));
  const detail = noise.noise2D(x * h.detailFreq, z * h.detailFreq);

  let height = h.baseHeight + macro * h.macroAmp + ridge * h.ridgeAmp + detail * h.detailAmp;

  // Water cut — clamp below water level
  if (height < h.waterCutLevel) {
    height = h.waterCutLevel - 0.5; // push under water
  }

  return height;
}

/** Compute slope (0=flat, 1=vertical) from normal */
export function computeSlope(normal: Vector3): number {
  return 1.0 - Math.abs(Vector3.Dot(normal, Vector3.Up()));
}

/** Normalize height to 0..1 range */
export function normalizeHeight(y: number, h: HeightConfig): number {
  const minH = h.waterCutLevel;
  const maxH = h.baseHeight + h.macroAmp + h.ridgeAmp + h.detailAmp;
  return Math.max(0, Math.min(1, (y - minH) / (maxH - minH)));
}

// ── Road / Safe Zone detection ─────────────────────────────────

function isOnRoad(x: number, z: number, pois: ZonePointOfInterest[]): boolean {
  const roadPois = pois.filter(p => p.type === "road");
  // Check proximity to road waypoint lines
  for (let i = 0; i < roadPois.length - 1; i++) {
    const a = roadPois[i];
    const b = roadPois[i + 1];
    // Only connect sequential roads with same prefix (ns, ew, etc.)
    const aPrefix = a.id.replace(/\d+$/, "");
    const bPrefix = b.id.replace(/\d+$/, "");
    if (aPrefix !== bPrefix) continue;

    const dist = pointToSegmentDist(x, z, a.x, a.y, b.x, b.y);
    if (dist < ROAD_HALF_WIDTH) return true;
  }
  return false;
}

function isInSafeZone(x: number, z: number, pois: ZonePointOfInterest[]): boolean {
  for (const p of pois) {
    if (p.type === "trading_post" || p.type === "graveyard" || p.type === "safe_zone") {
      const r = p.radius ?? 400;
      const dx = x - p.x, dz = z - p.y;
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}

function pointToSegmentDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax, abz = bz - az;
  const apx = px - ax, apz = pz - az;
  const ab2 = abx * abx + abz * abz;
  if (ab2 === 0) return Math.sqrt(apx * apx + apz * apz);
  let t = (apx * abx + apz * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx, cz = az + t * abz;
  const dx = px - cx, dz = pz - cz;
  return Math.sqrt(dx * dx + dz * dz);
}

// ── Polygon point-in-polygon test (ray casting) ────────────

function pointInPolygon(px: number, pz: number, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if ((yi > pz) !== (yj > pz) && px < (xj - xi) * (pz - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Signed distance to polygon edge (positive = inside, negative = outside) */
function distToPolygonEdge(px: number, pz: number, poly: { x: number; y: number }[]): number {
  let minDist = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = pointToSegmentDist(px, pz, poly[i].x, poly[i].y, poly[j].x, poly[j].y);
    if (d < minDist) minDist = d;
  }
  const inside = pointInPolygon(px, pz, poly);
  return inside ? minDist : -minDist;
}

// ── Coastline mask (replaces circular island mask) ──────────

/** Returns 0 (ocean) to 1 (full land) using authored coastline polygon */
function coastlineMask(x: number, z: number, coast: CoastlineDef): number {
  // Check main land polygon
  let dist = distToPolygonEdge(x, z, coast.landPolygon);

  // Check islands — if inside any island, override
  if (coast.islands) {
    for (const island of coast.islands) {
      const islandDist = distToPolygonEdge(x, z, island);
      if (islandDist > dist) dist = islandDist;
    }
  }

  // Perturb edge with noise for organic coastline
  const edgeNoise = noise.fbm(x * 0.0005, z * 0.0005, 3, 2, 0.5) * coast.beachWidth * 0.3;
  dist += edgeNoise;

  if (dist < 0) return 0;                              // ocean
  if (dist < coast.beachWidth) return dist / coast.beachWidth; // beach fade
  return 1;                                            // land
}

// ── Height region blending ─────────────────────────────────

/** Sample height with authored regions blended over noise base */
function sampleRegionHeight(x: number, z: number, h: HeightConfig): number {
  // Start with noise-based height
  let baseY = sampleHeight(x, z, h);

  if (!h.regions || h.regions.length === 0) return baseY;

  // Blend each region
  for (const region of h.regions) {
    const dist = distToPolygonEdge(x, z, region.points);
    if (dist <= -region.falloff) continue; // too far outside

    // Compute blend weight (0 = no effect, 1 = full region control)
    let weight: number;
    if (dist >= region.falloff) {
      weight = 1; // deep inside
    } else if (dist >= 0) {
      weight = dist / region.falloff; // inside but near edge
    } else {
      weight = 0; // outside — but within falloff range?
      // Smooth falloff outside the polygon
      weight = Math.max(0, 1 + dist / region.falloff);
    }

    if (weight <= 0) continue;

    // Region height: forced base + scaled noise
    const regionNoise = sampleHeight(x, z, h) - h.baseHeight;
    const regionY = region.forcedHeight + regionNoise * region.noiseScale;

    // Blend
    baseY = baseY * (1 - weight) + regionY * weight;
  }

  return baseY;
}

// ── Terrain Result ─────────────────────────────────────────────

export interface GeneratedTerrain {
  root: TransformNode;
  groundMesh: Mesh;
  waterMesh: Mesh;
  /** Sample height at any world position */
  getHeight: (x: number, z: number) => number;
  /** Sample slope at any world position */
  getSlope: (x: number, z: number) => number;
  /** Is this position on a road? */
  isRoad: (x: number, z: number) => boolean;
  /** Is this position in water? */
  isWater: (x: number, z: number) => boolean;
}

// ── Main Generator ─────────────────────────────────────────────

export function generateBiomeTerrain(scene: Scene, config: BiomeConfig): GeneratedTerrain {
  const root = new TransformNode(`terrain_${config.zoneId}`, scene);
  const h = config.height;
  const mat = config.material;
  const S = OPEN_WORLD_SIZE;

  // ── Layer 1: Ground mesh ─────────────────────────────────────
  const groundMesh = MeshBuilder.CreateGround(`ground_${config.zoneId}`, {
    width: S + h.coastBuffer * 2,
    height: S + h.coastBuffer * 2,
    subdivisions: TERRAIN_SUBDIVS,
    updatable: false,
  }, scene);
  groundMesh.parent = root;
  groundMesh.position.set(S / 2, 0, S / 2);
  groundMesh.receiveShadows = true;

  // Displace vertices with noise
  const positions = groundMesh.getVerticesData("position");
  if (positions) {
    const halfExtent = (S + h.coastBuffer * 2) / 2;

    for (let i = 0; i < positions.length; i += 3) {
      // Convert mesh-local to world coords
      const wx = positions[i] + S / 2;
      const wz = positions[i + 2] + S / 2;

      let y = sampleRegionHeight(wx, wz, h);

      // Coastline mask — sink edges into ocean using authored polygon
      const land = h.coastline
        ? coastlineMask(wx, wz, h.coastline)
        : 1; // no coastline = all land (e.g. interior zones)
      if (land < 1) {
        y = y * land + h.waterCutLevel * (1 - land) - 2;
      }

      // Flatten safe zones
      if (isInSafeZone(wx, wz, config.pois)) {
        y = y * SAFE_ZONE_FLATTEN + h.baseHeight * (1 - SAFE_ZONE_FLATTEN);
      }

      // Flatten roads slightly
      if (isOnRoad(wx, wz, config.pois)) {
        const roadY = h.baseHeight * 0.8;
        y = y * 0.3 + roadY * 0.7;
      }

      positions[i + 1] = y;
    }

    groundMesh.updateVerticesData("position", positions);

    // Recompute normals
    const normals: number[] = [];
    const indices = groundMesh.getIndices()!;
    VertexData.ComputeNormals(positions, indices, normals);
    groundMesh.updateVerticesData("normal", normals);

    // Vertex colors for slope/height-based material blending
    const colors = new Float32Array((positions.length / 3) * 4);
    for (let i = 0; i < positions.length; i += 3) {
      const vi = (i / 3) * 4;
      const wx = positions[i] + S / 2;
      const wz = positions[i + 2] + S / 2;
      const y = positions[i + 1];
      const nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
      const slope = 1.0 - Math.abs(ny);
      const height01 = normalizeHeight(y, h);
      const onRoad = isOnRoad(wx, wz, config.pois) ? 1 : 0;

      // R = slope, G = height01, B = moisture, A = road
      colors[vi] = slope;
      colors[vi + 1] = height01;
      colors[vi + 2] = mat.moisture;
      colors[vi + 3] = onRoad;
    }
    groundMesh.setVerticesData("color", colors, false, 4);
  }

  // Apply terrain material
  const groundMat = createTerrainMaterial(scene, config);
  groundMesh.material = groundMat;

  // ── Water plane ──────────────────────────────────────────────
  const waterMesh = MeshBuilder.CreateGround(`water_${config.zoneId}`, {
    width: S + h.coastBuffer * 4,
    height: S + h.coastBuffer * 4,
    subdivisions: WATER_SUBDIVS,
  }, scene);
  waterMesh.parent = root;
  waterMesh.position.set(S / 2, h.waterCutLevel, S / 2);
  waterMesh.receiveShadows = true;

  const waterMat = new PBRMaterial(`waterMat_${config.zoneId}`, scene);
  waterMat.albedoColor = new Color3(0.12, 0.28, 0.42);
  waterMat.roughness = 0.2;
  waterMat.metallic = 0.15;
  waterMat.alpha = 0.75;
  waterMat.backFaceCulling = false;
  waterMesh.material = waterMat;

  // ── Query functions ──────────────────────────────────────────
  const getHeight = (x: number, z: number): number => {
    let y = sampleRegionHeight(x, z, h);
    const land = h.coastline ? coastlineMask(x, z, h.coastline) : 1;
    if (land < 1) y = y * land + h.waterCutLevel * (1 - land) - 2;
    if (isInSafeZone(x, z, config.pois)) y = y * SAFE_ZONE_FLATTEN + h.baseHeight * (1 - SAFE_ZONE_FLATTEN);
    if (isOnRoad(x, z, config.pois)) y = y * 0.3 + h.baseHeight * 0.8 * 0.7;
    return y;
  };

  const getSlope = (x: number, z: number): number => {
    const d = 2;
    const hL = getHeight(x - d, z), hR = getHeight(x + d, z);
    const hD = getHeight(x, z - d), hU = getHeight(x, z + d);
    const nx = hL - hR, nz = hD - hU, ny = 2 * d;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    return 1.0 - Math.abs(ny / len);
  };

  const isRoadFn = (x: number, z: number): boolean => isOnRoad(x, z, config.pois);
  const isWaterFn = (x: number, z: number): boolean => getHeight(x, z) < h.waterCutLevel;

  return { root, groundMesh, waterMesh, getHeight, getSlope, isRoad: isRoadFn, isWater: isWaterFn };
}

// ── Terrain Material ───────────────────────────────────────────

function createTerrainMaterial(scene: Scene, config: BiomeConfig): PBRMaterial {
  const mat = config.material;
  const m = new PBRMaterial(`terrainMat_${config.zoneId}`, scene);

  // Base albedo from biome — vertex colors will modulate at render time
  // For now use a weighted average based on moisture
  const base = mat.baseColor;
  m.albedoColor = new Color3(base.r, base.g, base.b);
  m.roughness = 0.85;
  m.metallic = 0.02;

  // Vertex colors stored for future splat-map shader
  // PBRMaterial reads vertex colors automatically when present on the mesh

  // When proper splat-map textures are provided, swap to NodeMaterial
  return m;
}

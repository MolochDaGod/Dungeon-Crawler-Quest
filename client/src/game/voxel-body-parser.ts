/**
 * Voxel Body Part Parser
 * Splits a hero voxel model into 8 independent body part mini-models,
 * each with its own pivot point for canvas-level rotation/scale/translation.
 */

type VoxelModel = (string | null)[][][];

export interface BodyPartVoxels {
  /** Mini voxel grid for just this part */
  model: VoxelModel;
  /** Dimensions of the mini grid */
  width: number;
  height: number;
  depth: number;
  /** Pivot point in the mini grid's local space (for rotation center) */
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  /** Offset from full model origin to this part's mini grid origin */
  originX: number;
  originY: number;
  originZ: number;
}

export interface ParsedBody {
  leftLeg: BodyPartVoxels;
  rightLeg: BodyPartVoxels;
  chest: BodyPartVoxels;
  head: BodyPartVoxels;
  leftArm: BodyPartVoxels;
  rightArm: BodyPartVoxels;
  weapon: BodyPartVoxels;
  hat: BodyPartVoxels;
}

export type BodyPartName = keyof ParsedBody;

/** Body part region definitions: [xMin, xMax, zMin, zMax] in the 8x8x16 hero grid */
interface PartRegion {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
  zMin: number; zMax: number;
  pivotX: number; pivotY: number; pivotZ: number;
}

const PART_REGIONS: Record<BodyPartName, PartRegion> = {
  leftLeg:  { xMin: 2, xMax: 3, yMin: 0, yMax: 7, zMin: 0, zMax: 2, pivotX: 2.5, pivotY: 3, pivotZ: 1 },
  rightLeg: { xMin: 4, xMax: 5, yMin: 0, yMax: 7, zMin: 0, zMax: 2, pivotX: 4.5, pivotY: 3, pivotZ: 1 },
  chest:    { xMin: 1, xMax: 6, yMin: 0, yMax: 7, zMin: 3, zMax: 7, pivotX: 3.5, pivotY: 3, pivotZ: 5 },
  leftArm:  { xMin: 0, xMax: 1, yMin: 0, yMax: 7, zMin: 3, zMax: 7, pivotX: 1,   pivotY: 3, pivotZ: 5 },
  rightArm: { xMin: 6, xMax: 7, yMin: 0, yMax: 7, zMin: 3, zMax: 7, pivotX: 6,   pivotY: 3, pivotZ: 5 },
  head:     { xMin: 2, xMax: 5, yMin: 0, yMax: 7, zMin: 8, zMax: 10, pivotX: 3.5, pivotY: 3, pivotZ: 9 },
  hat:      { xMin: 1, xMax: 6, yMin: 0, yMax: 7, zMin: 11, zMax: 15, pivotX: 3.5, pivotY: 3, pivotZ: 12 },
  weapon:   { xMin: 0, xMax: 1, yMin: 0, yMax: 3, zMin: 2, zMax: 15, pivotX: 0,   pivotY: 1, pivotZ: 5 },
};

function createEmptyModel(w: number, d: number, h: number): VoxelModel {
  const model: VoxelModel = [];
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < d; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) {
        model[z][y][x] = null;
      }
    }
  }
  return model;
}

function slicePart(fullModel: VoxelModel, region: PartRegion): BodyPartVoxels {
  const w = region.xMax - region.xMin + 1;
  const d = region.yMax - region.yMin + 1;
  const h = region.zMax - region.zMin + 1;
  const mini = createEmptyModel(w, d, h);

  const fullH = fullModel.length;
  const fullD = fullModel[0]?.length ?? 0;
  const fullW = fullModel[0]?.[0]?.length ?? 0;

  for (let z = region.zMin; z <= region.zMax; z++) {
    if (z < 0 || z >= fullH) continue;
    const layer = fullModel[z];
    if (!layer) continue;
    for (let y = region.yMin; y <= region.yMax; y++) {
      if (y < 0 || y >= fullD) continue;
      const row = layer[y];
      if (!row) continue;
      for (let x = region.xMin; x <= region.xMax; x++) {
        if (x < 0 || x >= fullW) continue;
        const color = row[x];
        if (color) {
          const lz = z - region.zMin;
          const ly = y - region.yMin;
          const lx = x - region.xMin;
          if (mini[lz]?.[ly]) {
            mini[lz][ly][lx] = color;
          }
        }
      }
    }
  }

  return {
    model: mini,
    width: w,
    height: h,
    depth: d,
    pivotX: region.pivotX - region.xMin,
    pivotY: region.pivotY - region.yMin,
    pivotZ: region.pivotZ - region.zMin,
    originX: region.xMin,
    originY: region.yMin,
    originZ: region.zMin,
  };
}

/**
 * Parse a full 8x8x16 hero VoxelModel into 8 independent body parts.
 * The input should be the idle model (no pose offsets applied).
 */
export function parseModelIntoParts(fullModel: VoxelModel): ParsedBody {
  return {
    leftLeg:  slicePart(fullModel, PART_REGIONS.leftLeg),
    rightLeg: slicePart(fullModel, PART_REGIONS.rightLeg),
    chest:    slicePart(fullModel, PART_REGIONS.chest),
    leftArm:  slicePart(fullModel, PART_REGIONS.leftArm),
    rightArm: slicePart(fullModel, PART_REGIONS.rightArm),
    head:     slicePart(fullModel, PART_REGIONS.head),
    hat:      slicePart(fullModel, PART_REGIONS.hat),
    weapon:   slicePart(fullModel, PART_REGIONS.weapon),
  };
}

/** Cache key for parsed bodies */
function makeCacheKey(race: string, heroClass: string, heroName?: string): string {
  return `${race}:${heroClass}:${heroName ?? ''}`;
}

const parsedBodyCache = new Map<string, ParsedBody>();

/**
 * Get or create a parsed body from cache.
 * Pass the idle model (built with zero poses) so parts don't have
 * baked-in animation offsets.
 */
export function getCachedParsedBody(
  race: string,
  heroClass: string,
  idleModel: VoxelModel,
  heroName?: string
): ParsedBody {
  const key = makeCacheKey(race, heroClass, heroName);
  let cached = parsedBodyCache.get(key);
  if (!cached) {
    cached = parseModelIntoParts(idleModel);
    parsedBodyCache.set(key, cached);
  }
  return cached;
}

/**
 * Render order for body parts based on facing direction.
 * Parts further from camera render first (painter's algorithm).
 */
export function getPartRenderOrder(facing: number): BodyPartName[] {
  const a = ((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Facing right (default)
  if (a < Math.PI * 0.25 || a >= Math.PI * 1.75) {
    return ['leftLeg', 'leftArm', 'chest', 'rightLeg', 'rightArm', 'weapon', 'head', 'hat'];
  }
  // Facing down
  if (a < Math.PI * 0.75) {
    return ['leftLeg', 'rightLeg', 'leftArm', 'chest', 'rightArm', 'weapon', 'head', 'hat'];
  }
  // Facing left
  if (a < Math.PI * 1.25) {
    return ['rightLeg', 'rightArm', 'chest', 'leftLeg', 'leftArm', 'weapon', 'head', 'hat'];
  }
  // Facing up
  return ['rightLeg', 'leftLeg', 'rightArm', 'chest', 'leftArm', 'weapon', 'head', 'hat'];
}

/** Screen-space offsets for each body part's origin (in voxel grid units) */
export const PART_SCREEN_OFFSETS: Record<BodyPartName, { dx: number; dy: number; dz: number }> = {
  leftLeg:  { dx: 2, dy: 0, dz: 0 },
  rightLeg: { dx: 4, dy: 0, dz: 0 },
  chest:    { dx: 1, dy: 0, dz: 3 },
  leftArm:  { dx: 0, dy: 0, dz: 3 },
  rightArm: { dx: 6, dy: 0, dz: 3 },
  head:     { dx: 2, dy: 0, dz: 8 },
  hat:      { dx: 1, dy: 0, dz: 11 },
  weapon:   { dx: 0, dy: 0, dz: 2 },
};

// ── V2 Modular: 12×12×24 part regions ──────────────────────────

const MODULAR_PART_REGIONS: Record<BodyPartName, PartRegion> = {
  leftLeg:  { xMin: 2, xMax: 5,  yMin: 0, yMax: 11, zMin: 0,  zMax: 3,  pivotX: 3.5,  pivotY: 5, pivotZ: 2 },
  rightLeg: { xMin: 6, xMax: 9,  yMin: 0, yMax: 11, zMin: 0,  zMax: 3,  pivotX: 7.5,  pivotY: 5, pivotZ: 2 },
  chest:    { xMin: 2, xMax: 9,  yMin: 0, yMax: 11, zMin: 8,  zMax: 15, pivotX: 5.5,  pivotY: 5, pivotZ: 11 },
  leftArm:  { xMin: 0, xMax: 2,  yMin: 0, yMax: 11, zMin: 8,  zMax: 15, pivotX: 2,    pivotY: 5, pivotZ: 11 },
  rightArm: { xMin: 9, xMax: 11, yMin: 0, yMax: 11, zMin: 8,  zMax: 15, pivotX: 9,    pivotY: 5, pivotZ: 11 },
  head:     { xMin: 3, xMax: 8,  yMin: 0, yMax: 11, zMin: 16, zMax: 21, pivotX: 5.5,  pivotY: 5, pivotZ: 18 },
  hat:      { xMin: 2, xMax: 9,  yMin: 0, yMax: 11, zMin: 21, zMax: 23, pivotX: 5.5,  pivotY: 5, pivotZ: 22 },
  weapon:   { xMin: 0, xMax: 2,  yMin: 0, yMax: 5,  zMin: 4,  zMax: 23, pivotX: 0,    pivotY: 2, pivotZ: 10 },
};

const modularParsedCache = new Map<string, ParsedBody>();

/** Parse a V2 modular 12×12×24 model into body parts. */
export function parseModularIntoParts(fullModel: VoxelModel): ParsedBody {
  return {
    leftLeg:  slicePart(fullModel, MODULAR_PART_REGIONS.leftLeg),
    rightLeg: slicePart(fullModel, MODULAR_PART_REGIONS.rightLeg),
    chest:    slicePart(fullModel, MODULAR_PART_REGIONS.chest),
    leftArm:  slicePart(fullModel, MODULAR_PART_REGIONS.leftArm),
    rightArm: slicePart(fullModel, MODULAR_PART_REGIONS.rightArm),
    head:     slicePart(fullModel, MODULAR_PART_REGIONS.head),
    hat:      slicePart(fullModel, MODULAR_PART_REGIONS.hat),
    weapon:   slicePart(fullModel, MODULAR_PART_REGIONS.weapon),
  };
}

/** Get or create a parsed modular body from cache. */
export function getCachedModularParsedBody(
  cacheKey: string,
  model: VoxelModel,
): ParsedBody {
  let cached = modularParsedCache.get(cacheKey);
  if (!cached) {
    cached = parseModularIntoParts(model);
    modularParsedCache.set(cacheKey, cached);
    if (modularParsedCache.size > 50) {
      const first = modularParsedCache.keys().next().value;
      if (first) modularParsedCache.delete(first);
    }
  }
  return cached;
}

/** Screen-space offsets for V2 modular parts */
export const MODULAR_PART_SCREEN_OFFSETS: Record<BodyPartName, { dx: number; dy: number; dz: number }> = {
  leftLeg:  { dx: 2,  dy: 0, dz: 0 },
  rightLeg: { dx: 6,  dy: 0, dz: 0 },
  chest:    { dx: 2,  dy: 0, dz: 8 },
  leftArm:  { dx: 0,  dy: 0, dz: 8 },
  rightArm: { dx: 9,  dy: 0, dz: 8 },
  head:     { dx: 3,  dy: 0, dz: 16 },
  hat:      { dx: 2,  dy: 0, dz: 21 },
  weapon:   { dx: 0,  dy: 0, dz: 4 },
};

/**
 * Sprite Asset Catalog — Master registry of all 2D sprites available for world rendering.
 *
 * Maps decoration types + biomes → actual sprite sheet paths + source rectangles.
 * Used by ai-map-worker.ts to produce sprite-ready placement data.
 *
 * Sprite sheets:
 *   Plants.png         512×560  — trees (rows 5-8), bushes, crops, flowers
 *   Ground_grass_details.png 336×224 — pebbles, grass clumps, small herbs
 *   Houses.png         496×304  — building pieces, wells, fences, carts
 *   tropical-city/decor/  — 18 decor + 5 greenery + 7 stones + 2 trees (individual 256px PNGs)
 */

// ── Sheet paths ────────────────────────────────────────────────

const FARM = '/assets/sprites/farm-animals/PNG';
const TC   = '/assets/packs/tropical-city';

// ── Types ──────────────────────────────────────────────────────

export interface SpriteDef {
  sheet: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  drawW: number;
  drawH: number;
}

export type DecoCategory =
  | 'tree' | 'bush' | 'rock' | 'flower' | 'herb'
  | 'grass' | 'mushroom' | 'crop' | 'fern'
  | 'decor' | 'fence' | 'campfire' | 'barrel'
  | 'well' | 'signpost' | 'cart' | 'chest'
  | 'crystal' | 'fish_node' | 'stump';

// ── Plants.png sprite map (512×560) ────────────────────────────
// Row layout from visual inspection:
//   Row 0 (y=0..47):     Small crops/vegetables — 16×16 sprites, 16 cols
//   Row 1 (y=48..95):    Bushes/shrubs — various sizes
//   Row 2 (y=96..143):   Small plants/seedlings
//   Row 3 (y=144..191):  Flowers + decorative plants
//   Row 4 (y=192..255):  Medium bushes + fruit plants
//   Row 5 (y=256..335):  Medium trees (oak, fruit) — ~64×80 each
//   Row 6 (y=336..415):  Medium trees row 2
//   Row 7 (y=416..487):  Large trees — ~80×72
//   Row 8 (y=488..559):  Largest trees — ~100×72

const P = `${FARM}/Plants.png`;

const PLANTS_TREES: SpriteDef[] = [
  // Row 5: medium trees (6 trees across ~512px)
  { sheet: P, sx: 0,   sy: 256, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Oak
  { sheet: P, sx: 85,  sy: 256, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Fruit tree
  { sheet: P, sx: 170, sy: 256, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Red tree
  { sheet: P, sx: 255, sy: 256, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Round tree
  { sheet: P, sx: 340, sy: 256, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Citrus tree
  // Row 6: second medium tree row
  { sheet: P, sx: 0,   sy: 336, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Bush tree
  { sheet: P, sx: 85,  sy: 336, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Red bush tree
  { sheet: P, sx: 170, sy: 336, sw: 80,  sh: 80,  drawW: 80,  drawH: 100 },  // Ornamental
  // Row 7: large trees
  { sheet: P, sx: 0,   sy: 416, sw: 100, sh: 72,  drawW: 100, drawH: 90  },  // Wide oak
  { sheet: P, sx: 105, sy: 416, sw: 100, sh: 72,  drawW: 100, drawH: 90  },  // Wide bush
  { sheet: P, sx: 210, sy: 416, sw: 100, sh: 72,  drawW: 100, drawH: 90  },  // Conifer
  // Row 8: largest trees
  { sheet: P, sx: 0,   sy: 488, sw: 110, sh: 72,  drawW: 110, drawH: 90  },  // Grand oak
  { sheet: P, sx: 120, sy: 488, sw: 110, sh: 72,  drawW: 110, drawH: 90  },  // Grand pine
  { sheet: P, sx: 240, sy: 488, sw: 110, sh: 72,  drawW: 110, drawH: 90  },  // Canopy
  { sheet: P, sx: 360, sy: 488, sw: 110, sh: 72,  drawW: 110, drawH: 90  },  // Globe tree
];

const PLANTS_BUSHES: SpriteDef[] = [
  { sheet: P, sx: 0,   sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
  { sheet: P, sx: 32,  sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
  { sheet: P, sx: 64,  sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
  { sheet: P, sx: 96,  sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
  { sheet: P, sx: 128, sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
  { sheet: P, sx: 160, sy: 48,  sw: 32, sh: 32, drawW: 36, drawH: 36 },
];

const PLANTS_FLOWERS: SpriteDef[] = [
  { sheet: P, sx: 0,   sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
  { sheet: P, sx: 32,  sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
  { sheet: P, sx: 64,  sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
  { sheet: P, sx: 96,  sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
  { sheet: P, sx: 128, sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
  { sheet: P, sx: 160, sy: 144, sw: 32, sh: 32, drawW: 28, drawH: 28 },
];

const PLANTS_CROPS: SpriteDef[] = [
  { sheet: P, sx: 0,   sy: 0, sw: 16, sh: 16, drawW: 20, drawH: 20 },
  { sheet: P, sx: 16,  sy: 0, sw: 16, sh: 16, drawW: 20, drawH: 20 },
  { sheet: P, sx: 32,  sy: 0, sw: 16, sh: 16, drawW: 20, drawH: 20 },
  { sheet: P, sx: 48,  sy: 0, sw: 16, sh: 16, drawW: 20, drawH: 20 },
  { sheet: P, sx: 64,  sy: 0, sw: 16, sh: 16, drawW: 20, drawH: 20 },
];

// ── Ground_grass_details.png (336×224) ─────────────────────────
// Pebbles, small rocks, grass clumps, ground herbs

const GG = `${FARM}/Ground_grass_details.png`;

const GROUND_PEBBLES: SpriteDef[] = [
  { sheet: GG, sx: 0,   sy: 0,   sw: 48, sh: 32, drawW: 28, drawH: 18 },
  { sheet: GG, sx: 48,  sy: 0,   sw: 48, sh: 32, drawW: 28, drawH: 18 },
  { sheet: GG, sx: 96,  sy: 0,   sw: 48, sh: 32, drawW: 28, drawH: 18 },
  { sheet: GG, sx: 144, sy: 0,   sw: 48, sh: 32, drawW: 28, drawH: 18 },
];

const GROUND_GRASS: SpriteDef[] = [
  { sheet: GG, sx: 0,   sy: 176, sw: 32, sh: 32, drawW: 24, drawH: 24 },
  { sheet: GG, sx: 32,  sy: 176, sw: 32, sh: 32, drawW: 24, drawH: 24 },
  { sheet: GG, sx: 64,  sy: 176, sw: 32, sh: 32, drawW: 24, drawH: 24 },
  { sheet: GG, sx: 96,  sy: 176, sw: 32, sh: 32, drawW: 24, drawH: 24 },
  { sheet: GG, sx: 128, sy: 176, sw: 32, sh: 32, drawW: 24, drawH: 24 },
];

// ── Tropical-city individual PNGs (256×256 native) ─────────────

function tcDecor(name: string, dw: number, dh: number): SpriteDef {
  return { sheet: `${TC}/decor/${name}`, sx: 0, sy: 0, sw: 256, sh: 256, drawW: dw, drawH: dh };
}

const TC_TREES: SpriteDef[] = [
  tcDecor('tree_1.png', 90, 130),
  tcDecor('tree_2.png', 100, 120),
];

const TC_STONES: SpriteDef[] = Array.from({ length: 7 }, (_, i) =>
  tcDecor(`stones_${i + 1}.png`, 40 + i * 4, 30 + i * 3)
);

const TC_GREENERY: SpriteDef[] = Array.from({ length: 5 }, (_, i) =>
  tcDecor(`greenery_${i + 1}.png`, 36, 50)
);

const TC_DECOR: SpriteDef[] = Array.from({ length: 18 }, (_, i) =>
  tcDecor(`decor_${i + 1}.png`, 30, 60)
);

// ── Houses.png (496×304) sprite regions ────────────────────────

const H = `${FARM}/Houses.png`;

const HOUSE_WELL:     SpriteDef = { sheet: H, sx: 100, sy: 130, sw: 40, sh: 40, drawW: 36, drawH: 36 };
const HOUSE_CART:     SpriteDef = { sheet: H, sx: 310, sy: 70,  sw: 60, sh: 60, drawW: 60, drawH: 60 };
const HOUSE_BARREL:   SpriteDef = { sheet: H, sx: 400, sy: 200, sw: 24, sh: 24, drawW: 24, drawH: 24 };
const HOUSE_FENCE:    SpriteDef = { sheet: H, sx: 0,   sy: 200, sw: 80, sh: 30, drawW: 60, drawH: 20 };
const HOUSE_CAMPFIRE: SpriteDef = { sheet: H, sx: 310, sy: 140, sw: 32, sh: 32, drawW: 36, drawH: 36 };
const HOUSE_SIGNPOST: SpriteDef = { sheet: H, sx: 260, sy: 200, sw: 16, sh: 32, drawW: 20, drawH: 40 };

// ── Resource Node Sprite Keys → SpriteDef ──────────────────────
// Maps spriteKeys from resource-nodes.ts to real sprite data

const RESOURCE_NODE_SPRITES: Record<string, SpriteDef> = {
  // Trees (from Plants.png large tree rows)
  Tree1:          PLANTS_TREES[0],
  Tree2:          PLANTS_TREES[1],
  Autumn_tree1:   PLANTS_TREES[2],
  Moss_tree1:     PLANTS_TREES[3],
  Snow_tree1:     PLANTS_TREES[4],
  Palm_tree1_1:   TC_TREES[0],
  Fruit_tree1:    PLANTS_TREES[4],
  // Stumps
  Broken_tree1:   { sheet: P, sx: 425, sy: 256, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree2:   { sheet: P, sx: 425, sy: 290, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree3:   { sheet: P, sx: 425, sy: 324, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree4:   { sheet: P, sx: 425, sy: 324, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree5:   { sheet: P, sx: 425, sy: 324, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree6:   { sheet: P, sx: 425, sy: 256, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  Broken_tree7:   { sheet: P, sx: 425, sy: 290, sw: 48, sh: 32, drawW: 48, drawH: 32 },
  // Crystals (use tropical-city stones as stand-in, tinted by renderer)
  Green_crystal_4:  TC_STONES[0],
  Red_crystal_4:    TC_STONES[1],
  Yellow_crystal_4: TC_STONES[2],
  Blue_crystal_4:   TC_STONES[3],
  Violet_crystal_4: TC_STONES[4],
  Black_crystal_4:  TC_STONES[5],
  White_crystal_4:  TC_STONES[6],
  // Flowers / Herbs
  White_blue_1:   PLANTS_FLOWERS[0],
  Lavender_1:     PLANTS_FLOWERS[1],
  'Black-red_1':  PLANTS_FLOWERS[2],
  Sunflowers_1:   PLANTS_FLOWERS[3],
  Mushrooms_1:    PLANTS_FLOWERS[4],
  Wheat_1:        PLANTS_CROPS[0],
};

// ── Biome → Decoration Type → Sprite Pool ──────────────────────

interface BiomeSpritePool {
  trees:    SpriteDef[];
  bushes:   SpriteDef[];
  rocks:    SpriteDef[];
  flowers:  SpriteDef[];
  grass:    SpriteDef[];
  props:    SpriteDef[];
}

const BIOME_SPRITE_POOLS: Record<string, BiomeSpritePool> = {
  grass: {
    trees:   [...TC_TREES, ...PLANTS_TREES.slice(0, 5)],
    bushes:  [...PLANTS_BUSHES, ...TC_GREENERY],
    rocks:   [...TC_STONES.slice(0, 4), ...GROUND_PEBBLES],
    flowers: PLANTS_FLOWERS,
    grass:   GROUND_GRASS,
    props:   TC_DECOR.slice(0, 6),
  },
  jungle: {
    trees:   [...PLANTS_TREES.slice(5, 15), ...TC_TREES],
    bushes:  [...PLANTS_BUSHES, ...TC_GREENERY, ...PLANTS_FLOWERS],
    rocks:   [...TC_STONES.slice(0, 3), ...GROUND_PEBBLES],
    flowers: PLANTS_FLOWERS,
    grass:   GROUND_GRASS,
    props:   TC_DECOR.slice(4, 12),
  },
  water: {
    trees:   [...TC_TREES],
    bushes:  [...PLANTS_BUSHES.slice(0, 3)],
    rocks:   [...TC_STONES.slice(0, 3)],
    flowers: [PLANTS_FLOWERS[0], PLANTS_FLOWERS[4]],
    grass:   GROUND_GRASS.slice(0, 2),
    props:   TC_DECOR.slice(10, 14),
  },
  stone: {
    trees:   PLANTS_TREES.slice(10, 14),
    bushes:  PLANTS_BUSHES.slice(0, 2),
    rocks:   [...TC_STONES, ...GROUND_PEBBLES],
    flowers: [PLANTS_FLOWERS[2]],
    grass:   GROUND_PEBBLES,
    props:   TC_DECOR.slice(6, 14),
  },
  dirt: {
    trees:   [...PLANTS_TREES.slice(2, 6), ...TC_TREES],
    bushes:  [...PLANTS_BUSHES.slice(0, 4)],
    rocks:   [...TC_STONES.slice(2, 7), ...GROUND_PEBBLES],
    flowers: [PLANTS_FLOWERS[2], PLANTS_FLOWERS[4]],
    grass:   GROUND_PEBBLES,
    props:   TC_DECOR.slice(8, 16),
  },
};

// ── Public API ─────────────────────────────────────────────────

/** Get a sprite pool for a biome. Falls back to grass. */
export function getBiomeSpritePool(biome: string): BiomeSpritePool {
  return BIOME_SPRITE_POOLS[biome] || BIOME_SPRITE_POOLS.grass;
}

/** Pick a random sprite from a pool using a seed value. */
export function pickSprite(pool: SpriteDef[], seed: number): SpriteDef {
  return pool[Math.abs(seed) % pool.length];
}

/** Get the sprite for a resource node spriteKey. */
export function getResourceNodeSprite(spriteKey: string): SpriteDef | null {
  return RESOURCE_NODE_SPRITES[spriteKey] || null;
}

/** Prop sprites (campfire, well, barrel, fence, signpost, cart). */
export function getPropSprite(type: string): SpriteDef {
  switch (type) {
    case 'campfire': return HOUSE_CAMPFIRE;
    case 'well':     return HOUSE_WELL;
    case 'barrel':   return HOUSE_BARREL;
    case 'fence':    return HOUSE_FENCE;
    case 'signpost': return HOUSE_SIGNPOST;
    case 'cart':     return HOUSE_CART;
    default:         return HOUSE_BARREL;
  }
}

/** Get all tropical-city decor sprites (for general decoration). */
export function getAllDecorSprites(): SpriteDef[] { return TC_DECOR; }

/** Get all tree sprites across all sources. */
export function getAllTreeSprites(): SpriteDef[] { return [...TC_TREES, ...PLANTS_TREES]; }

export { RESOURCE_NODE_SPRITES, BIOME_SPRITE_POOLS };
export type { BiomeSpritePool };

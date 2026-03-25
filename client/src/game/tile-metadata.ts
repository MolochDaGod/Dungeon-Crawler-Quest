/**
 * Tile Metadata Registry — Master catalog of every 16px tile sprite.
 *
 * Every tile the engine can place has an entry here with:
 *   - sheet path + source rect
 *   - biome/placement rules
 *   - passability + adjacency rules
 *
 * Sprite sheets (dimensions audited):
 *   ground_grass_bricks.png   352×368  — terrain, cobble, hedges, fences, wells (16px grid)
 *   Ground_grass_details.png  336×224  — pebbles, grass clumps (16px grid)
 *   Houses.png                496×304  — windmills, houses, stalls, gates (composite)
 *   Doors_windows_fire.png    192×448  — doors, windows, lanterns (16px grid)
 *   Plants.png                512×560  — trees, bushes, flowers, crops (mixed sizes)
 *   Water_coasts.png          176×384  — water edge tiles (16px grid)
 *   grassland/ground_grasss.png 336×256 — 16px grass terrain variants
 *   grassland/Trees_rocks.png   256×544 — 16px trees + rocks
 *   grassland/Details.png       192×224 — 16px ground details
 *   grassland/Water_coasts.png  272×576 — 16px water transitions
 *   FieldsTileset.png           256×256 — 32px field tiles (8×8 grid)
 *   house-constructor/tiles/    130 individual 32px tiles
 */

// ── Constants ──────────────────────────────────────────────────

export const TILE_PX = 16;           // base tile size in pixels
export const TILES_PER_ZONE = 1000;  // 1000×1000 tiles per zone
export const CHUNK_TILES = 125;      // 125×125 tiles per chunk
export const CHUNKS_PER_ZONE = 8;    // 8×8 chunks per zone

// ── Sheet Paths ────────────────────────────────────────────────

const FA = '/assets/sprites/farm-animals/PNG';
const GL = '/assets/packs/tilesets/grassland/PNG';
const DG = '/assets/packs/tilesets/dungeon/PNG';
const CD = '/assets/packs/castle-defense/tiles';
const TC = '/assets/packs/tropical-city';
const HC = '/assets/packs/house-constructor/tiles';

// ── Types ──────────────────────────────────────────────────────

export type TileType = 'terrain' | 'structure' | 'prop' | 'road' | 'blocker' | 'water' | 'actor';

export type TileCategory =
  | 'grass' | 'dirt' | 'cobble' | 'sand' | 'mud' | 'water_deep' | 'water_shallow'
  | 'water_edge' | 'beach'
  | 'tree' | 'bush' | 'rock' | 'flower' | 'crop' | 'mushroom' | 'fern'
  | 'house' | 'roof' | 'wall_stone' | 'wall_wood' | 'door' | 'window' | 'chimney'
  | 'fence' | 'gate' | 'lamp' | 'barrel' | 'crate' | 'well' | 'cart' | 'sign'
  | 'market_stall' | 'windmill' | 'bridge'
  | 'road_dirt' | 'road_stone' | 'road_cobble'
  | 'mountain' | 'cliff'
  | 'hedge' | 'path_edge'
  | 'dungeon_wall' | 'dungeon_floor' | 'torch' | 'column' | 'stairs';

export type BiomeId =
  | 'grass' | 'forest' | 'stone' | 'dirt' | 'water' | 'jungle'
  | 'beach' | 'mountain' | 'ruins' | 'city' | 'dock' | 'swamp' | 'any';

export interface TileMeta {
  /** Unique tile ID */
  id: string;
  /** Path to sprite sheet */
  sheet: string;
  /** Source rect in sprite sheet (pixels) */
  sx: number; sy: number; sw: number; sh: number;
  /** Tile type for layer assignment */
  type: TileType;
  /** Visual/functional category */
  category: TileCategory;
  /** Which biomes this tile can appear in */
  biomes: BiomeId[];
  /** Native tile size (16 or 32) */
  tileSize: number;
  /** How many tiles wide this sprite occupies */
  widthTiles: number;
  /** How many tiles tall */
  heightTiles: number;
  /** Can entities walk through this? */
  passable: boolean;
  /** What terrain types this can be placed on */
  placeOn: TileCategory[];
  /** What categories it shouldn't be adjacent to */
  avoidNear: TileCategory[];
  /** Placement frequency weight (0-1, higher = more common) */
  rarity: number;
  /** Searchable tags */
  tags: string[];
}

// ── Registry ───────────────────────────────────────────────────

const _registry: TileMeta[] = [];
const _byId = new Map<string, TileMeta>();
const _byCategory = new Map<TileCategory, TileMeta[]>();
const _byBiome = new Map<BiomeId, TileMeta[]>();

function reg(t: TileMeta): TileMeta {
  _registry.push(t);
  _byId.set(t.id, t);
  // Index by category
  if (!_byCategory.has(t.category)) _byCategory.set(t.category, []);
  _byCategory.get(t.category)!.push(t);
  // Index by biome
  for (const b of t.biomes) {
    if (!_byBiome.has(b)) _byBiome.set(b, []);
    _byBiome.get(b)!.push(t);
  }
  return t;
}

// Helper: register a grid of 16px tiles from a sprite sheet
function regGrid16(
  idPrefix: string, sheet: string,
  cols: number, rows: number,
  type: TileType, category: TileCategory,
  biomes: BiomeId[], passable: boolean,
  placeOn: TileCategory[], tags: string[],
  rarity = 0.5,
  startRow = 0, startCol = 0, count?: number,
): void {
  let n = 0;
  for (let r = startRow; r < rows; r++) {
    for (let c = startCol; c < cols; c++) {
      if (count != null && n >= count) return;
      reg({
        id: `${idPrefix}_r${r}_c${c}`,
        sheet, sx: c * 16, sy: r * 16, sw: 16, sh: 16,
        type, category, biomes, tileSize: 16,
        widthTiles: 1, heightTiles: 1,
        passable, placeOn, avoidNear: [], rarity, tags,
      });
      n++;
    }
    startCol = 0; // reset col after first row
  }
}

// ════════════════════════════════════════════════════════════════
// TERRAIN — ground_grass_bricks.png (352×368, 22×23 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GGB = `${FA}/ground_grass_bricks.png`;

// Rows 0-3: grass terrain variants (pure grass, grass edges, dirt transitions)
regGrid16('ggb_grass', GGB, 22, 4, 'terrain', 'grass',
  ['grass', 'forest', 'city', 'any'], true, [], ['terrain', 'ground', 'grass'], 0.8);

// Rows 4-7: dirt/mud terrain
regGrid16('ggb_dirt', GGB, 22, 4, 'terrain', 'dirt',
  ['dirt', 'city', 'ruins', 'any'], true, [], ['terrain', 'ground', 'dirt'], 0.6, 4);

// Rows 8-11: cobblestone path tiles
regGrid16('ggb_cobble', GGB, 22, 4, 'road', 'cobble',
  ['city', 'dock', 'any'], true, [], ['road', 'path', 'cobblestone', 'city'], 0.7, 8);

// Rows 12-15: hedges, small fences, decorative borders
regGrid16('ggb_hedge', GGB, 22, 4, 'prop', 'hedge',
  ['grass', 'city', 'forest'], false, ['grass', 'dirt'], ['hedge', 'border', 'garden'], 0.3, 12);

// Rows 16-19: stone walls, wells, small structures
regGrid16('ggb_stone', GGB, 22, 4, 'structure', 'wall_stone',
  ['city', 'ruins', 'stone', 'any'], false, ['grass', 'dirt', 'cobble'], ['wall', 'stone', 'structure'], 0.3, 16);

// Rows 20-22: more stone, path edges
regGrid16('ggb_path_edge', GGB, 22, 3, 'terrain', 'path_edge',
  ['grass', 'city', 'any'], true, [], ['path', 'edge', 'transition'], 0.5, 20);

// ════════════════════════════════════════════════════════════════
// TERRAIN — grassland/ground_grasss.png (336×256, 21×16 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GG = `${GL}/ground_grasss.png`;

regGrid16('gl_grass', GG, 21, 16, 'terrain', 'grass',
  ['grass', 'forest', 'jungle', 'any'], true, [], ['terrain', 'grassland', 'ground'], 0.9);

// ════════════════════════════════════════════════════════════════
// WATER — Water_coasts.png (176×384, 11×24 grid of 16px)
// ════════════════════════════════════════════════════════════════

const WC = `${FA}/Water_coasts.png`;

regGrid16('wc_water', WC, 11, 24, 'water', 'water_edge',
  ['water', 'beach', 'dock', 'any'], false, [], ['water', 'coast', 'shore', 'transition'], 0.7);

// ════════════════════════════════════════════════════════════════
// WATER — grassland/Water_coasts.png (272×576, 17×36 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GWC = `${GL}/Water_coasts.png`;

regGrid16('gl_water', GWC, 17, 36, 'water', 'water_edge',
  ['water', 'grass', 'beach', 'any'], false, [], ['water', 'grassland', 'coast'], 0.7);

// ════════════════════════════════════════════════════════════════
// DETAILS — Ground_grass_details.png (336×224, 21×14 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GGD = `${FA}/Ground_grass_details.png`;

// Rows 0-6: pebbles, small rocks
regGrid16('ggd_pebble', GGD, 21, 7, 'prop', 'rock',
  ['grass', 'dirt', 'stone', 'any'], true, ['grass', 'dirt'], ['pebble', 'rock', 'small', 'ground-detail'], 0.4);

// Rows 7-10: grass clumps
regGrid16('ggd_grass_clump', GGD, 21, 4, 'prop', 'grass',
  ['grass', 'forest', 'jungle'], true, ['grass'], ['grass', 'clump', 'detail'], 0.5, 7);

// Rows 11-13: small herbs/plants
regGrid16('ggd_herb', GGD, 21, 3, 'prop', 'flower',
  ['grass', 'forest', 'jungle'], true, ['grass'], ['herb', 'flower', 'small', 'harvestable'], 0.3, 11);

// ════════════════════════════════════════════════════════════════
// DETAILS — grassland/Details.png (192×224, 12×14 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GLD = `${GL}/Details.png`;

regGrid16('gl_detail', GLD, 12, 14, 'prop', 'grass',
  ['grass', 'forest', 'any'], true, ['grass'], ['detail', 'grassland', 'ground'], 0.4);

// ════════════════════════════════════════════════════════════════
// TREES & ROCKS — grassland/Trees_rocks.png (256×544, 16×34 grid of 16px)
// ════════════════════════════════════════════════════════════════

const GTR = `${GL}/Trees_rocks.png`;

// Trees: multi-tile sprites (rows 0-20 roughly)
// Register as 2×3 tile composites for trees
for (let i = 0; i < 8; i++) {
  const col = (i % 4) * 4;
  const row = Math.floor(i / 4) * 6;
  reg({
    id: `gl_tree_${i}`,
    sheet: GTR, sx: col * 16, sy: row * 16, sw: 64, sh: 96,
    type: 'prop', category: 'tree',
    biomes: ['grass', 'forest', 'jungle'],
    tileSize: 16, widthTiles: 4, heightTiles: 6,
    passable: false, placeOn: ['grass', 'dirt'], avoidNear: ['road_cobble', 'house'],
    rarity: 0.5, tags: ['tree', 'nature', 'blocker', 'logging'],
  });
}

// Rocks: rows 20+ in the sheet
for (let i = 0; i < 6; i++) {
  reg({
    id: `gl_rock_${i}`,
    sheet: GTR, sx: (i % 4) * 48, sy: (20 + Math.floor(i / 4) * 3) * 16, sw: 48, sh: 48,
    type: 'prop', category: 'rock',
    biomes: ['grass', 'stone', 'mountain', 'any'],
    tileSize: 16, widthTiles: 3, heightTiles: 3,
    passable: false, placeOn: ['grass', 'dirt', 'sand'], avoidNear: ['road_cobble'],
    rarity: 0.3, tags: ['rock', 'nature', 'blocker', 'mining'],
  });
}

// ════════════════════════════════════════════════════════════════
// STRUCTURES — Houses.png (496×304, composite sprites)
// ════════════════════════════════════════════════════════════════

const HO = `${FA}/Houses.png`;

// Windmill (top-left ~160×160)
reg({
  id: 'house_windmill', sheet: HO, sx: 0, sy: 0, sw: 160, sh: 160,
  type: 'structure', category: 'windmill',
  biomes: ['grass', 'city'], tileSize: 16, widthTiles: 10, heightTiles: 10,
  passable: false, placeOn: ['grass', 'dirt'], avoidNear: ['water_deep'],
  rarity: 0.1, tags: ['building', 'windmill', 'landmark', 'city'],
});

// Market stall red-stripe (~80×64, top area)
reg({
  id: 'house_market_red', sheet: HO, sx: 160, sy: 0, sw: 80, sh: 64,
  type: 'structure', category: 'market_stall',
  biomes: ['city', 'dock', 'any'], tileSize: 16, widthTiles: 5, heightTiles: 4,
  passable: false, placeOn: ['cobble', 'dirt', 'grass'], avoidNear: ['water_deep'],
  rarity: 0.2, tags: ['market', 'vendor', 'shop', 'city'],
});

// Market stall blue-stripe
reg({
  id: 'house_market_blue', sheet: HO, sx: 240, sy: 0, sw: 80, sh: 64,
  type: 'structure', category: 'market_stall',
  biomes: ['city', 'dock', 'any'], tileSize: 16, widthTiles: 5, heightTiles: 4,
  passable: false, placeOn: ['cobble', 'dirt', 'grass'], avoidNear: ['water_deep'],
  rarity: 0.2, tags: ['market', 'vendor', 'shop', 'city'],
});

// House small (blue roof, ~96×96)
reg({
  id: 'house_small_1', sheet: HO, sx: 320, sy: 0, sw: 96, sh: 96,
  type: 'structure', category: 'house',
  biomes: ['city', 'grass'], tileSize: 16, widthTiles: 6, heightTiles: 6,
  passable: false, placeOn: ['grass', 'cobble', 'dirt'], avoidNear: ['water_deep'],
  rarity: 0.4, tags: ['house', 'building', 'city', 'residential'],
});

// House large (bottom-center ~128×120)
reg({
  id: 'house_large_1', sheet: HO, sx: 160, sy: 128, sw: 128, sh: 128,
  type: 'structure', category: 'house',
  biomes: ['city', 'grass'], tileSize: 16, widthTiles: 8, heightTiles: 8,
  passable: false, placeOn: ['grass', 'cobble', 'dirt'], avoidNear: ['water_deep'],
  rarity: 0.3, tags: ['house', 'building', 'city', 'large'],
});

// Church/guild (bottom-right ~128×160)
reg({
  id: 'house_guild', sheet: HO, sx: 368, sy: 96, sw: 128, sh: 160,
  type: 'structure', category: 'house',
  biomes: ['city'], tileSize: 16, widthTiles: 8, heightTiles: 10,
  passable: false, placeOn: ['cobble', 'grass'], avoidNear: [],
  rarity: 0.1, tags: ['guild', 'church', 'building', 'landmark', 'city'],
});

// Fence row (bottom ~80×16)
reg({
  id: 'house_fence', sheet: HO, sx: 0, sy: 256, sw: 80, sh: 16,
  type: 'prop', category: 'fence',
  biomes: ['grass', 'city', 'any'], tileSize: 16, widthTiles: 5, heightTiles: 1,
  passable: false, placeOn: ['grass', 'dirt', 'cobble'], avoidNear: ['water_deep'],
  rarity: 0.4, tags: ['fence', 'border', 'wood'],
});

// ════════════════════════════════════════════════════════════════
// DOORS & WINDOWS — Doors_windows_fire.png (192×448, 12×28 grid of 16px)
// ════════════════════════════════════════════════════════════════

const DWF = `${FA}/Doors_windows_fire.png`;

// Doors: rows 0-6 (various door styles)
regGrid16('dwf_door', DWF, 12, 7, 'structure', 'door',
  ['city', 'ruins', 'any'], false, ['wall_stone', 'wall_wood'], ['door', 'entrance', 'building'], 0.3);

// Windows: rows 7-14
regGrid16('dwf_window', DWF, 12, 8, 'structure', 'window',
  ['city', 'any'], false, ['wall_stone', 'wall_wood'], ['window', 'building', 'detail'], 0.3, 7);

// Lanterns/fire: rows 15-20
regGrid16('dwf_lamp', DWF, 12, 6, 'prop', 'lamp',
  ['city', 'dock', 'ruins', 'any'], true, ['cobble', 'dirt', 'grass'], ['lamp', 'light', 'lantern'], 0.3, 15);

// ════════════════════════════════════════════════════════════════
// PLANTS — Plants.png (512×560, mixed sizes)
// ════════════════════════════════════════════════════════════════

const PL = `${FA}/Plants.png`;

// Small crops (rows 0-2, 16px each)
regGrid16('pl_crop', PL, 32, 3, 'prop', 'crop',
  ['grass', 'city', 'any'], true, ['grass', 'dirt'], ['crop', 'farm', 'harvestable'], 0.3);

// Bushes (rows 3-5, 32px sprites)
for (let i = 0; i < 8; i++) {
  reg({
    id: `pl_bush_${i}`, sheet: PL,
    sx: (i % 8) * 32, sy: 48 + Math.floor(i / 8) * 32, sw: 32, sh: 32,
    type: 'prop', category: 'bush',
    biomes: ['grass', 'forest', 'jungle', 'any'],
    tileSize: 16, widthTiles: 2, heightTiles: 2,
    passable: true, placeOn: ['grass', 'dirt'], avoidNear: ['road_cobble'],
    rarity: 0.5, tags: ['bush', 'nature', 'greenery'],
  });
}

// Flowers (row ~9, 32px)
for (let i = 0; i < 6; i++) {
  reg({
    id: `pl_flower_${i}`, sheet: PL,
    sx: i * 32, sy: 144, sw: 32, sh: 32,
    type: 'prop', category: 'flower',
    biomes: ['grass', 'forest', 'city', 'any'],
    tileSize: 16, widthTiles: 2, heightTiles: 2,
    passable: true, placeOn: ['grass'], avoidNear: ['cobble', 'road_stone'],
    rarity: 0.3, tags: ['flower', 'nature', 'harvestable', 'herbalism'],
  });
}

// Trees (rows 16-35, 80×80 to 110×72 sprites)
for (let i = 0; i < 15; i++) {
  const row = Math.floor(i / 5);
  const col = i % 5;
  const w = row < 2 ? 80 : row < 3 ? 100 : 110;
  const h = row < 2 ? 80 : 72;
  reg({
    id: `pl_tree_${i}`, sheet: PL,
    sx: col * (w + 5), sy: 256 + row * (h + 4), sw: w, sh: h,
    type: 'prop', category: 'tree',
    biomes: ['grass', 'forest', 'jungle', 'city'],
    tileSize: 16, widthTiles: Math.ceil(w / 16), heightTiles: Math.ceil(h / 16),
    passable: false, placeOn: ['grass', 'dirt'], avoidNear: ['road_cobble', 'house', 'market_stall'],
    rarity: 0.5, tags: ['tree', 'nature', 'blocker', 'logging', 'large'],
  });
}

// ════════════════════════════════════════════════════════════════
// DUNGEON — dungeon tileset (16px grid)
// ════════════════════════════════════════════════════════════════

const DW = `${DG}/walls_floor.png`;
const DT = `${DG}/torches.png`;

regGrid16('dg_floor', DW, 16, 16, 'terrain', 'dungeon_floor',
  ['ruins', 'stone', 'any'], true, [], ['dungeon', 'floor', 'stone'], 0.8, 0, 0, 64);

regGrid16('dg_wall', DW, 16, 16, 'blocker', 'dungeon_wall',
  ['ruins', 'stone'], false, [], ['dungeon', 'wall', 'blocker'], 0.6, 4, 0, 64);

// ════════════════════════════════════════════════════════════════
// CASTLE DEFENSE — FieldsTileset.png (256×256, 8×8 grid of 32px)
// ════════════════════════════════════════════════════════════════

const CF = `${CD}/FieldsTileset.png`;

for (let r = 0; r < 8; r++) {
  for (let c = 0; c < 8; c++) {
    reg({
      id: `cf_field_r${r}_c${c}`, sheet: CF,
      sx: c * 32, sy: r * 32, sw: 32, sh: 32,
      type: 'terrain', category: r < 2 ? 'grass' : r < 4 ? 'dirt' : r < 6 ? 'cobble' : 'sand',
      biomes: ['grass', 'city', 'dirt', 'any'],
      tileSize: 32, widthTiles: 2, heightTiles: 2,
      passable: true, placeOn: [], avoidNear: [], rarity: 0.6,
      tags: ['field', 'terrain', 'castle'],
    });
  }
}

// ════════════════════════════════════════════════════════════════
// TROPICAL CITY DECOR — individual 256px PNGs (already in sprite-asset-catalog)
// ════════════════════════════════════════════════════════════════

for (let i = 1; i <= 7; i++) {
  reg({
    id: `tc_stone_${i}`, sheet: `${TC}/decor/stones_${i}.png`,
    sx: 0, sy: 0, sw: 256, sh: 256,
    type: 'prop', category: 'rock',
    biomes: ['grass', 'stone', 'dirt', 'any'],
    tileSize: 16, widthTiles: 3, heightTiles: 2,
    passable: false, placeOn: ['grass', 'dirt', 'sand'], avoidNear: ['road_cobble'],
    rarity: 0.3, tags: ['rock', 'stone', 'nature', 'mining'],
  });
}

for (let i = 1; i <= 5; i++) {
  reg({
    id: `tc_greenery_${i}`, sheet: `${TC}/decor/greenery_${i}.png`,
    sx: 0, sy: 0, sw: 256, sh: 256,
    type: 'prop', category: 'bush',
    biomes: ['grass', 'jungle', 'forest'],
    tileSize: 16, widthTiles: 2, heightTiles: 3,
    passable: true, placeOn: ['grass', 'dirt'], avoidNear: [],
    rarity: 0.4, tags: ['greenery', 'plant', 'nature'],
  });
}

for (let i = 1; i <= 2; i++) {
  reg({
    id: `tc_tree_${i}`, sheet: `${TC}/decor/tree_${i}.png`,
    sx: 0, sy: 0, sw: 256, sh: 256,
    type: 'prop', category: 'tree',
    biomes: ['grass', 'jungle', 'city'],
    tileSize: 16, widthTiles: 6, heightTiles: 8,
    passable: false, placeOn: ['grass', 'dirt'], avoidNear: ['house', 'market_stall'],
    rarity: 0.3, tags: ['tree', 'palm', 'tropical', 'large'],
  });
}

for (let i = 1; i <= 18; i++) {
  reg({
    id: `tc_decor_${i}`, sheet: `${TC}/decor/decor_${i}.png`,
    sx: 0, sy: 0, sw: 256, sh: 256,
    type: 'prop', category: i <= 6 ? 'lamp' : i <= 12 ? 'barrel' : 'sign',
    biomes: ['city', 'dock', 'any'],
    tileSize: 16, widthTiles: 2, heightTiles: 4,
    passable: true, placeOn: ['cobble', 'dirt', 'grass'], avoidNear: [],
    rarity: 0.2, tags: ['decor', 'city', 'prop'],
  });
}

// ════════════════════════════════════════════════════════════════
// MOUNTAIN / BLOCKER tiles (synthesized from stone terrain)
// ════════════════════════════════════════════════════════════════

reg({
  id: 'mountain_block', sheet: GGB,
  sx: 0, sy: 16 * 16, sw: 16, sh: 16,
  type: 'blocker', category: 'mountain',
  biomes: ['mountain', 'stone', 'any'], tileSize: 16, widthTiles: 1, heightTiles: 1,
  passable: false, placeOn: [], avoidNear: [],
  rarity: 1.0, tags: ['mountain', 'impassable', 'blocker'],
});

reg({
  id: 'cliff_block', sheet: GGB,
  sx: 16, sy: 16 * 16, sw: 16, sh: 16,
  type: 'blocker', category: 'cliff',
  biomes: ['mountain', 'stone', 'any'], tileSize: 16, widthTiles: 1, heightTiles: 1,
  passable: false, placeOn: [], avoidNear: [],
  rarity: 1.0, tags: ['cliff', 'impassable', 'blocker'],
});

// Deep water (non-walkable)
reg({
  id: 'water_deep', sheet: WC,
  sx: 0, sy: 0, sw: 16, sh: 16,
  type: 'water', category: 'water_deep',
  biomes: ['water', 'any'], tileSize: 16, widthTiles: 1, heightTiles: 1,
  passable: false, placeOn: [], avoidNear: [],
  rarity: 1.0, tags: ['water', 'deep', 'ocean', 'impassable'],
});

// Shallow water (walkable with boat)
reg({
  id: 'water_shallow', sheet: WC,
  sx: 16, sy: 0, sw: 16, sh: 16,
  type: 'water', category: 'water_shallow',
  biomes: ['water', 'beach', 'dock'], tileSize: 16, widthTiles: 1, heightTiles: 1,
  passable: false, placeOn: [], avoidNear: [],
  rarity: 0.8, tags: ['water', 'shallow', 'coast'],
});

// Sand/beach
reg({
  id: 'terrain_sand', sheet: GGB,
  sx: 16 * 4, sy: 16 * 4, sw: 16, sh: 16,
  type: 'terrain', category: 'sand',
  biomes: ['beach', 'dock', 'water'], tileSize: 16, widthTiles: 1, heightTiles: 1,
  passable: true, placeOn: [], avoidNear: [],
  rarity: 0.7, tags: ['sand', 'beach', 'terrain'],
});

// ════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════

/** Get a tile by its unique ID */
export function getTileMeta(id: string): TileMeta | undefined {
  return _byId.get(id);
}

/** Get all tiles in a category */
export function getTilesByCategory(category: TileCategory): TileMeta[] {
  return _byCategory.get(category) ?? [];
}

/** Get all tiles valid for a biome */
export function getTilesForBiome(biome: BiomeId): TileMeta[] {
  return _byBiome.get(biome) ?? [];
}

/** Get tiles matching biome + type */
export function queryTiles(biome: BiomeId, type: TileType): TileMeta[] {
  const biomeTiles = _byBiome.get(biome) ?? [];
  return biomeTiles.filter(t => t.type === type);
}

/** Get tiles matching biome + category */
export function queryTilesByCat(biome: BiomeId, category: TileCategory): TileMeta[] {
  const biomeTiles = _byBiome.get(biome) ?? [];
  return biomeTiles.filter(t => t.category === category);
}

/** Get tiles by tag */
export function queryTilesByTag(tag: string): TileMeta[] {
  return _registry.filter(t => t.tags.includes(tag));
}

/** Get all registered tiles */
export function getAllTiles(): readonly TileMeta[] {
  return _registry;
}

/** Total number of registered tiles */
export function getTileCount(): number {
  return _registry.length;
}

/** Pick a random tile from a list using a seed */
export function pickTileSeeded(tiles: TileMeta[], seed: number): TileMeta {
  return tiles[Math.abs(seed) % tiles.length];
}

/**
 * Pick a tile using weighted rarity.
 * Higher rarity = more likely to be picked.
 */
export function pickTileWeighted(tiles: TileMeta[], rng: () => number): TileMeta {
  const totalWeight = tiles.reduce((s, t) => s + t.rarity, 0);
  let r = rng() * totalWeight;
  for (const t of tiles) {
    r -= t.rarity;
    if (r <= 0) return t;
  }
  return tiles[tiles.length - 1];
}

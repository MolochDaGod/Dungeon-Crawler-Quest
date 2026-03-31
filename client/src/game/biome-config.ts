/**
 * Biome Config — data-driven zone presets for the BabylonJS terrain system.
 *
 * Each zone gets a BiomeConfig that drives:
 *   - 3-layer terrain heightmap generation (macro + ridge + detail noise)
 *   - Material blending (slope + height + moisture → texture weights)
 *   - Foliage scatter (thin instances, density, slope/height constraints)
 *   - Atmosphere (fog, lighting, sky, particles)
 *   - Enemy spawn weighting
 *
 * Asset paths are relative to /assets/ (served from public/).
 */

import { OPEN_WORLD_SIZE } from "./zones";

// ── Types ──────────────────────────────────────────────────────

/** Authored polygon region that overrides noise height */
export interface HeightRegion {
  /** Polygon vertices (world x,y pairs — y maps to z in 3D) */
  points: { x: number; y: number }[];
  /** What this region forces */
  type: "mountain" | "ridge" | "water" | "flat" | "hill" | "valley" | "beach";
  /** Forced base height (mountain=high, water=below cut, flat=baseHeight) */
  forcedHeight: number;
  /** How much noise is allowed on top (0=perfectly flat, 1=full noise) */
  noiseScale: number;
  /** Edge falloff in world units — blends into surrounding terrain */
  falloff: number;
}

/** Coastline polygon — defines the land/ocean boundary */
export interface CoastlineDef {
  /** Outer coastline polygon vertices (world coords). Inside = land, outside = ocean. */
  landPolygon: { x: number; y: number }[];
  /** Optional island polygons (separate land masses outside main coast) */
  islands?: { x: number; y: number }[][];
  /** Beach width in world units */
  beachWidth: number;
}

export interface HeightConfig {
  baseHeight: number;      // base Y offset
  macroAmp: number;        // broad low-freq hills amplitude
  macroFreq: number;       // macro noise frequency
  ridgeAmp: number;        // ridge band amplitude
  ridgeFreq: number;       // ridge noise frequency
  detailAmp: number;       // high-freq detail amplitude
  detailFreq: number;      // detail noise frequency
  waterCutLevel: number;   // Y below which is water
  coastBuffer: number;     // extra units into water for islands (1000 default)
  /** Authored regions — mountains, water inlets, flat areas matching the map */
  regions: HeightRegion[];
  /** Coastline definition — replaces circular island mask */
  coastline: CoastlineDef;
}

export interface TerrainColor {
  r: number; g: number; b: number;
}

export interface MaterialConfig {
  moisture: number;        // 0=desert, 1=swamp — drives grass vs dirt
  rockiness: number;       // 0=smooth, 1=rugged — drives cliff coverage
  snowLine: number;        // height01 above which snow/crystal appears
  sandLine: number;        // height01 below which sand/beach appears
  baseColor: TerrainColor; // flat ground albedo
  slopeColor: TerrainColor; // steep cliff albedo
  lowColor: TerrainColor;  // near-water albedo
  highColor: TerrainColor; // high elevation albedo
  roadColor: TerrainColor; // packed earth roads
}

export interface FoliageEntry {
  id: string;              // unique key
  model: string;           // path relative to /assets/
  scale: [number, number]; // [min, max] random scale
  density: number;         // instances per 100x100 unit area
  slopeMax: number;        // max slope (0-1) where this can spawn
  heightMin: number;       // min normalized height
  heightMax: number;       // max normalized height
  avoidRoads: boolean;     // don't spawn on roads
  avoidWater: boolean;     // don't spawn in water
  layer: 1 | 2 | 3;       // which terrain layer (1=ground scatter, 2=mid props, 3=tall crops/trees)
}

export interface AtmosphereConfig {
  fogColor: TerrainColor;
  fogStart: number;
  fogEnd: number;
  fogMode: "linear" | "exp2";
  skyColor: TerrainColor;
  sunColor: TerrainColor;
  sunIntensity: number;
  sunDirection: [number, number, number];
  ambientColor: TerrainColor;
  ambientGroundColor: TerrainColor;
  ambientIntensity: number;
  particleType: "none" | "dust" | "leaves" | "ash" | "snow" | "embers" | "mist" | "sparkle";
}

export interface EnemyCampDef {
  id: string;
  x: number; y: number;
  radius: number;         // camp area
  enemies: { type: string; count: number; level: number }[];
  isBoss?: boolean;
  eventType?: "patrol" | "camp" | "convoy" | "siege" | "boss";
}

export interface ZonePointOfInterest {
  id: string;
  x: number; y: number;
  type: "road" | "dock" | "gold_mine" | "enemy_camp" | "boss" | "dungeon" | "safe_zone" | "graveyard" | "treasure" | "harvest_node" | "trading_post";
  radius?: number;
  data?: Record<string, any>;
}

export interface BiomeConfig {
  zoneId: number;
  name: string;
  template: "plains" | "forest" | "frozen" | "ash" | "volcanic" | "water" | "crystal";
  height: HeightConfig;
  material: MaterialConfig;
  foliage: FoliageEntry[];
  atmosphere: AtmosphereConfig;
  enemyCamps: EnemyCampDef[];
  pois: ZonePointOfInterest[];
  animals: { type: string; model: string; count: number; speed: number }[];
  loadingImage: string;   // zone loading screen
}

// ── Color helpers ──────────────────────────────────────────────

function rgb(r: number, g: number, b: number): TerrainColor { return { r, g, b }; }

// ── Zone size helpers ──────────────────────────────────────────

const S = OPEN_WORLD_SIZE; // 16000
const H = S / 2;           // 8000
const Q = S / 4;           // 4000
const CELL = S / 4;        // 4x4 grid cell = 4000

/** Convert 4x4 grid col,row (0-3) to world center x,y */
function gridCenter(col: number, row: number): [number, number] {
  return [col * CELL + CELL / 2, row * CELL + CELL / 2];
}

// ── Asset path prefixes ────────────────────────────────────────

const ROCKS = "/assets/rocks/desert-stone/FBX/";
const MOUNTAINS = "/assets/rocks/desert-mountain/FBX/";
const PLANTS = "/assets/foliage/desert-plants/FBX/";
const CACTUS_TREE = "/assets/foliage/desert-cactus-tree/FBX/";
const CROPS = "/assets/foliage/farming-crops/FBX/";
const SHRUBS = "/assets/foliage/shrubs-flowers-mushrooms/FBX/";
const BUILDINGS = "/assets/structures/medieval-buildings/FBX/";
const RUINS = "/assets/structures/ruins/FBX/";
const WILDLIFE = "/assets/enemies/wildlife/FBX/";
const MINES = "/assets/props/gold-mines/FBX/";
const CHESTS = "/assets/props/chests/FBX/";
const TREASURE = "/assets/props/treasure/FBX/";

// ══════════════════════════════════════════════════════════════
// ZONE 1 — GOLDEN CRUSADE
// Rolling highlands, wheat-gold plains, broken ridgelines,
// fortified hills. Warm frontier feel.
// ══════════════════════════════════════════════════════════════

export const ZONE_1_GOLDEN_CRUSADE: BiomeConfig = {
  zoneId: 1,
  name: "Golden Crusade",
  template: "plains",
  loadingImage: "/assets/zone-data/zone1.png",

  // ── Height ─────────────────────────────────────────────────
  // Zone 1 sits TOP-LEFT in the world grid.
  // East edge → Fabled Zone (land). South edge → Solden Tuisds (land).
  // North + West edges face open ocean. NW corner is deep water.
  // Peninsula shape: wide SE quadrant tapering to NW with islands.
  height: {
    baseHeight: 2,
    macroAmp: 8,        // gentler macro — regions do the heavy lifting
    macroFreq: 0.0008,
    ridgeAmp: 3,
    ridgeFreq: 0.003,
    detailAmp: 1.5,
    detailFreq: 0.012,
    waterCutLevel: -0.5,
    coastBuffer: 1000,

    // ── Coastline traced from the top-down map ──────────────
    // Clockwise from SE corner. East + South are land borders.
    // North + West are ocean coasts with bays and inlets.
    coastline: {
      landPolygon: [
        // SE corner — land border junction (Fabled + Solden Tuisds)
        { x: 16000, y: 16000 },
        // East edge — full land border with Fabled Zone
        { x: 16000, y: 0 },
        // NE coast starts — land pulls away from north edge
        { x: 13000, y: 200 },
        { x: 11000, y: 600 },
        // Northern mountain coast — jagged cliff line
        { x: 9000, y: 1200 },
        { x: 7500, y: 1800 },
        { x: 6000, y: 2400 },
        // NW peninsula narrows — the "neck"
        { x: 4500, y: 2800 },
        { x: 3500, y: 3500 },
        { x: 2500, y: 4200 },
        // Western bay inlet cuts in
        { x: 1800, y: 5000 },
        { x: 1200, y: 5800 },
        { x: 800, y: 6500 },
        // Bay curves back out
        { x: 1000, y: 7500 },
        { x: 1500, y: 8200 },
        // Mid-west coast — another smaller indent
        { x: 1200, y: 9500 },
        { x: 800, y: 10500 },
        { x: 600, y: 11500 },
        // SW coast approaches land border with Solden Tuisds
        { x: 500, y: 13000 },
        { x: 300, y: 14500 },
        // South edge — full land border with Solden Tuisds
        { x: 0, y: 16000 },
      ],
      // Scattered islands off the western/NW coast
      islands: [
        // Large island NW
        [{ x: 1000, y: 1500 }, { x: 2200, y: 1200 }, { x: 2800, y: 1800 }, { x: 2400, y: 2600 }, { x: 1200, y: 2400 }],
        // Small island W
        [{ x: 200, y: 4000 }, { x: 800, y: 3800 }, { x: 1000, y: 4400 }, { x: 400, y: 4600 }],
        // Tiny island SW
        [{ x: 300, y: 8800 }, { x: 700, y: 8600 }, { x: 800, y: 9000 }, { x: 400, y: 9200 }],
      ],
      beachWidth: 300,
    },

    // ── Authored height regions matching the map ─────────────
    regions: [
      // ── Northern mountain ridge — runs E-W across top third
      {
        points: [
          { x: 5000, y: 2000 }, { x: 8000, y: 1500 }, { x: 12000, y: 1000 },
          { x: 15000, y: 1200 }, { x: 15000, y: 4000 }, { x: 12000, y: 4500 },
          { x: 8000, y: 4800 }, { x: 5000, y: 4500 },
        ],
        type: "mountain", forcedHeight: 18, noiseScale: 0.7, falloff: 1500,
      },
      // ── NW mountain cluster — near the peninsula tip
      {
        points: [
          { x: 2800, y: 3000 }, { x: 4500, y: 2500 }, { x: 5500, y: 3500 },
          { x: 5000, y: 5000 }, { x: 3000, y: 5200 }, { x: 2000, y: 4200 },
        ],
        type: "mountain", forcedHeight: 15, noiseScale: 0.6, falloff: 1000,
      },
      // ── Eastern ridge — cliffs along Fabled Zone border
      {
        points: [
          { x: 14000, y: 4000 }, { x: 16000, y: 3500 }, { x: 16000, y: 7000 },
          { x: 14500, y: 7500 }, { x: 13500, y: 6000 },
        ],
        type: "ridge", forcedHeight: 12, noiseScale: 0.5, falloff: 800,
      },
      // ── Central plains — flat wheat fields, the heart of Golden Crusade
      {
        points: [
          { x: 5000, y: 6000 }, { x: 11000, y: 5500 }, { x: 13000, y: 7000 },
          { x: 13000, y: 12000 }, { x: 10000, y: 13000 }, { x: 6000, y: 13000 },
          { x: 3000, y: 11000 }, { x: 3000, y: 8000 },
        ],
        type: "flat", forcedHeight: 2.5, noiseScale: 0.3, falloff: 1200,
      },
      // ── Trading town plateau — flat safe area
      {
        points: [
          { x: 3000, y: 7000 }, { x: 5200, y: 7000 }, { x: 5200, y: 9200 },
          { x: 3000, y: 9200 },
        ],
        type: "flat", forcedHeight: 2, noiseScale: 0.1, falloff: 400,
      },
      // ── Southern hills — rolling terrain near Solden Tuisds border
      {
        points: [
          { x: 2000, y: 13000 }, { x: 8000, y: 13500 }, { x: 10000, y: 14500 },
          { x: 8000, y: 15500 }, { x: 3000, y: 15500 }, { x: 1000, y: 14500 },
        ],
        type: "hill", forcedHeight: 6, noiseScale: 0.6, falloff: 800,
      },
      // ── SE plateau — Sunwall Bastion area, fortified high ground
      {
        points: [
          { x: 12500, y: 7500 }, { x: 15500, y: 7500 }, { x: 15500, y: 10000 },
          { x: 13000, y: 10500 }, { x: 12000, y: 9000 },
        ],
        type: "hill", forcedHeight: 8, noiseScale: 0.5, falloff: 600,
      },
      // ── Western bay water inlet — ocean cuts into the land
      {
        points: [
          { x: 0, y: 5500 }, { x: 2000, y: 5800 }, { x: 2500, y: 6800 },
          { x: 2000, y: 7800 }, { x: 0, y: 7500 },
        ],
        type: "water", forcedHeight: -2, noiseScale: 0.2, falloff: 400,
      },
      // ── NW island mountain peak
      {
        points: [
          { x: 1400, y: 1600 }, { x: 2200, y: 1500 }, { x: 2500, y: 2100 },
          { x: 1800, y: 2300 },
        ],
        type: "hill", forcedHeight: 8, noiseScale: 0.4, falloff: 300,
      },
    ],
  },

  // ── Material ───────────────────────────────────────────────
  material: {
    moisture: 0.5,
    rockiness: 0.3,
    snowLine: 0.95,          // almost never snows in golden zone
    sandLine: 0.08,
    baseColor: rgb(0.72, 0.62, 0.35),   // wheat gold
    slopeColor: rgb(0.42, 0.40, 0.38),  // grey stone cliff
    lowColor: rgb(0.52, 0.42, 0.28),    // dry soil / packed dirt
    highColor: rgb(0.55, 0.50, 0.35),   // pale highland grass
    roadColor: rgb(0.45, 0.35, 0.22),   // packed earth
  },

  // ── Atmosphere ─────────────────────────────────────────────
  atmosphere: {
    fogColor: rgb(0.82, 0.75, 0.55),    // warm golden haze
    fogStart: 50,
    fogEnd: 150,
    fogMode: "linear",
    skyColor: rgb(0.55, 0.70, 0.90),    // warm blue
    sunColor: rgb(1.0, 0.92, 0.75),     // warm sun
    sunIntensity: 1.6,
    sunDirection: [-0.4, -1, 0.3],
    ambientColor: rgb(0.65, 0.60, 0.45),
    ambientGroundColor: rgb(0.35, 0.30, 0.18),
    ambientIntensity: 0.6,
    particleType: "dust",
  },

  // ── Foliage (3 layers) ─────────────────────────────────────
  foliage: [
    // Layer 1 — ground scatter: grass, small plants, shrubs
    { id: "grass_short", model: SHRUBS + "_grass_1.fbx", scale: [0.8, 1.4], density: 8, slopeMax: 0.4, heightMin: 0.05, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "grass_tall", model: SHRUBS + "_grass_2.fbx", scale: [0.9, 1.5], density: 5, slopeMax: 0.35, heightMin: 0.05, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "flowers_1", model: SHRUBS + "_flowers_1.fbx", scale: [0.7, 1.2], density: 2, slopeMax: 0.3, heightMin: 0.05, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "flowers_2", model: SHRUBS + "_flowers_2.fbx", scale: [0.7, 1.0], density: 1.5, slopeMax: 0.3, heightMin: 0.05, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "mushroom_1", model: SHRUBS + "_mushroom_1.fbx", scale: [0.6, 1.0], density: 0.5, slopeMax: 0.4, heightMin: 0.02, heightMax: 0.5, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "bush_1", model: SHRUBS + "_bush_1.fbx", scale: [0.8, 1.3], density: 1.5, slopeMax: 0.35, heightMin: 0.05, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "desert_plant_small", model: PLANTS + "Desert_plant_001.fbx", scale: [0.5, 0.9], density: 1, slopeMax: 0.5, heightMin: 0.0, heightMax: 0.9, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "stones_1", model: SHRUBS + "_stones_1.fbx", scale: [0.7, 1.2], density: 1, slopeMax: 0.6, heightMin: 0.0, heightMax: 1.0, avoidRoads: false, avoidWater: true, layer: 1 },

    // Layer 2 — mid props: rocks, boulders, stone formations
    { id: "rock_small_1", model: ROCKS + "Stone_desert_small_001.fbx", scale: [0.8, 1.5], density: 1.2, slopeMax: 0.7, heightMin: 0.0, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "rock_small_2", model: ROCKS + "Stone_desert_small_005.fbx", scale: [0.8, 1.5], density: 0.8, slopeMax: 0.7, heightMin: 0.0, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "rock_big_1", model: ROCKS + "Stone_desert_big_001.fbx", scale: [0.6, 1.0], density: 0.3, slopeMax: 0.8, heightMin: 0.1, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "rock_big_2", model: ROCKS + "Stone_desert_big_005.fbx", scale: [0.5, 0.9], density: 0.2, slopeMax: 0.8, heightMin: 0.2, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "hill_1", model: MOUNTAINS + "Hill_desert_001.fbx", scale: [0.3, 0.6], density: 0.08, slopeMax: 0.9, heightMin: 0.3, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "plateau_1", model: MOUNTAINS + "Plateau_desert_001.fbx", scale: [0.2, 0.5], density: 0.05, slopeMax: 0.9, heightMin: 0.4, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },

    // Layer 3 — tall: wheat, corn, trees (the golden fields)
    { id: "wheat_1", model: CROPS + "wheat1.fbx", scale: [0.9, 1.3], density: 12, slopeMax: 0.2, heightMin: 0.05, heightMax: 0.5, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "wheat_2", model: CROPS + "wheat2.fbx", scale: [0.9, 1.3], density: 10, slopeMax: 0.2, heightMin: 0.05, heightMax: 0.5, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "corn_1", model: CROPS + "corn1.fbx", scale: [0.8, 1.2], density: 4, slopeMax: 0.2, heightMin: 0.05, heightMax: 0.45, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "corn_2", model: CROPS + "corn2.fbx", scale: [0.8, 1.2], density: 3, slopeMax: 0.2, heightMin: 0.05, heightMax: 0.45, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "tree_desert_1", model: CACTUS_TREE + "Tree_Desert_001.fbx", scale: [0.7, 1.2], density: 0.4, slopeMax: 0.35, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "tree_desert_2", model: CACTUS_TREE + "Tree_Desert_005.fbx", scale: [0.7, 1.1], density: 0.3, slopeMax: 0.35, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "tree_desert_3", model: CACTUS_TREE + "Tree_Desert_010.fbx", scale: [0.6, 1.0], density: 0.2, slopeMax: 0.35, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
  ],

  // ── Animals ────────────────────────────────────────────────
  animals: [
    { type: "owl", model: WILDLIFE + "owl.fbx", count: 8, speed: 20 },
    { type: "boar", model: WILDLIFE + "boar.fbx", count: 12, speed: 40 },
    { type: "wolf", model: WILDLIFE + "wolf.fbx", count: 10, speed: 55 },
  ],

  // ── Points of Interest (map key layout) ────────────────────
  // Following user's zone map key:
  //   black=roads, brown=docks, gold=treasure/mine,
  //   red=enemy camps, orange=boss, purple=dungeon,
  //   green=safe (graveyards + trading town)
  pois: [
    // ── SAFE ZONES (green) ──────────────────────────────────
    // Trading town — center-west area
    { id: "trading_post", x: 4000, y: 8000, type: "trading_post", radius: 1200 },
    // Graveyard 1 — near exit to Zone 2 (west edge, south)
    { id: "graveyard_west", x: 800, y: 12000, type: "graveyard", radius: 400 },
    // Graveyard 2 — near exit to Zone 4 (south edge, east)
    { id: "graveyard_south", x: 12000, y: 15200, type: "graveyard", radius: 400 },

    // ── DOCKS (brown) ───────────────────────────────────────
    { id: "dock_north", x: 8000, y: 500, type: "dock", radius: 600 },
    { id: "dock_east", x: 15500, y: 6000, type: "dock", radius: 500 },
    { id: "dock_south", x: 6000, y: 15800, type: "dock", radius: 500 },

    // ── GOLD MINES (gold dots) ──────────────────────────────
    { id: "mine_nw", x: 3000, y: 3000, type: "gold_mine", radius: 300, data: { tier: 3, respawn: 120 } },
    { id: "mine_ne", x: 13000, y: 2000, type: "gold_mine", radius: 300, data: { tier: 4, respawn: 150 } },
    { id: "mine_center", x: 9000, y: 7000, type: "gold_mine", radius: 300, data: { tier: 2, respawn: 90 } },
    { id: "mine_sw", x: 2000, y: 13000, type: "gold_mine", radius: 300, data: { tier: 3, respawn: 120 } },
    { id: "mine_se", x: 14000, y: 11000, type: "gold_mine", radius: 300, data: { tier: 5, respawn: 180 } },

    // ── TREASURE SPOTS (gold dots, random spawns) ────────────
    { id: "treasure_1", x: 5000, y: 4000, type: "treasure", radius: 200 },
    { id: "treasure_2", x: 11000, y: 5000, type: "treasure", radius: 200 },
    { id: "treasure_3", x: 7000, y: 11000, type: "treasure", radius: 200 },
    { id: "treasure_4", x: 3000, y: 9000, type: "treasure", radius: 200 },
    { id: "treasure_5", x: 13000, y: 14000, type: "treasure", radius: 200 },

    // ── HARVEST NODES (scattered, shrubs/flowers/mushrooms) ──
    { id: "harvest_nw", x: 2500, y: 5000, type: "harvest_node", radius: 500 },
    { id: "harvest_ne", x: 12000, y: 4000, type: "harvest_node", radius: 500 },
    { id: "harvest_center", x: 8000, y: 9000, type: "harvest_node", radius: 600 },
    { id: "harvest_sw", x: 4000, y: 12000, type: "harvest_node", radius: 500 },
    { id: "harvest_se", x: 11000, y: 13000, type: "harvest_node", radius: 500 },

    // ── DUNGEONS (purple) ───────────────────────────────────
    { id: "dungeon_catacombs", x: 6000, y: 3000, type: "dungeon", radius: 400, data: { name: "Holy Catacombs", level: 3, floors: 4 } },
    { id: "dungeon_mine", x: 10000, y: 10000, type: "dungeon", radius: 400, data: { name: "Abandoned Gold Mine", level: 6, floors: 5 } },
    { id: "dungeon_fortress", x: 14000, y: 8000, type: "dungeon", radius: 500, data: { name: "Sunwall Bastion (Stronghold)", level: 8, floors: 6 } },

    // ── ROADS (black) — defined as connected waypoints ──────
    // Main north-south road
    { id: "road_ns_1", x: 8000, y: 800, type: "road" },
    { id: "road_ns_2", x: 8000, y: 4000, type: "road" },
    { id: "road_ns_3", x: 8000, y: 8000, type: "road" },
    { id: "road_ns_4", x: 8000, y: 12000, type: "road" },
    { id: "road_ns_5", x: 8000, y: 15200, type: "road" },
    // Main east-west road
    { id: "road_ew_1", x: 800, y: 8000, type: "road" },
    { id: "road_ew_2", x: 4000, y: 8000, type: "road" },
    { id: "road_ew_3", x: 12000, y: 8000, type: "road" },
    { id: "road_ew_4", x: 15200, y: 8000, type: "road" },
    // Diagonal spur to NE mine
    { id: "road_ne_spur", x: 11000, y: 4000, type: "road" },
  ],

  // ── Enemy Camps (red dots) + Bosses (orange) ───────────────
  // 4x4 grid: each cell has at least one camp/event
  enemyCamps: [
    // Row 0 (north strip)
    { id: "camp_0_0", ...gc(0, 0), radius: 500, enemies: [{ type: "Bandit", count: 4, level: 2 }], eventType: "camp" },
    { id: "camp_1_0", ...gc(1, 0), radius: 500, enemies: [{ type: "Skeleton", count: 3, level: 3 }, { type: "Dark Archer", count: 2, level: 3 }], eventType: "patrol" },
    { id: "camp_2_0", ...gc(2, 0), radius: 600, enemies: [{ type: "Bandit", count: 5, level: 3 }], eventType: "convoy" },
    { id: "camp_3_0", ...gc(3, 0), radius: 500, enemies: [{ type: "Timber Wolf", count: 4, level: 3 }], eventType: "camp" },
    // Row 1
    { id: "camp_0_1", ...gc(0, 1), radius: 600, enemies: [{ type: "Golem", count: 2, level: 5 }], eventType: "camp" },
    { id: "camp_1_1", ...gc(1, 1), radius: 700, enemies: [{ type: "Bandit", count: 6, level: 4 }, { type: "Bandit Chief", count: 1, level: 6 }], eventType: "siege", isBoss: false },
    { id: "camp_2_1", ...gc(2, 1), radius: 600, enemies: [{ type: "Skeleton", count: 5, level: 4 }], eventType: "camp" },
    { id: "camp_3_1", ...gc(3, 1), radius: 600, enemies: [{ type: "Corrupted Knight", count: 3, level: 5 }], eventType: "patrol" },
    // Row 2
    { id: "camp_0_2", ...gc(0, 2), radius: 500, enemies: [{ type: "Spider", count: 4, level: 3 }], eventType: "camp" },
    { id: "camp_1_2", ...gc(1, 2), radius: 600, enemies: [{ type: "Orc Grunt", count: 4, level: 4 }], eventType: "camp" },
    { id: "camp_2_2", ...gc(2, 2), radius: 800, enemies: [{ type: "Dark Mage", count: 2, level: 6 }, { type: "Skeleton", count: 4, level: 5 }], eventType: "siege" },
    { id: "camp_3_2", ...gc(3, 2), radius: 700, enemies: [{ type: "Iron Sentinel", count: 2, level: 7 }], eventType: "camp" },
    // Row 3 (south strip)
    { id: "camp_0_3", ...gc(0, 3), radius: 500, enemies: [{ type: "Bandit", count: 3, level: 3 }], eventType: "camp" },
    { id: "camp_1_3", ...gc(1, 3), radius: 600, enemies: [{ type: "Spider", count: 5, level: 4 }, { type: "Cave Bear", count: 1, level: 6 }], eventType: "camp" },
    { id: "camp_2_3", ...gc(2, 3), radius: 600, enemies: [{ type: "Dire Wolf", count: 4, level: 5 }], eventType: "patrol" },
    { id: "camp_3_3", ...gc(3, 3), radius: 900, enemies: [{ type: "Bandit Chief", count: 2, level: 8 }, { type: "Bandit", count: 6, level: 5 }], eventType: "siege" },
    // BOSS — Sunwall Bastion (orange dot, NE quadrant)
    { id: "boss_aurek", x: 14000, y: 4000, radius: 1000, enemies: [
      { type: "Corrupted Knight", count: 4, level: 8 },
      { type: "Iron Sentinel", count: 2, level: 9 },
      { type: "Bandit Chief", count: 1, level: 10 }, // Aurek Sunbrand stand-in
    ], eventType: "boss", isBoss: true },
  ],
};

// Helper to spread grid center into { x, y }
function gc(col: number, row: number): { x: number; y: number } {
  const [x, y] = gridCenter(col, row);
  return { x, y };
}

// ══════════════════════════════════════════════════════════════
// ZONE 2 — FABLED SHORE (Enchanted Elf Forest)
// Dense enchanted forest with crystal groves, ancient trees,
// glowing rivers, dwarven mines. Elf & Dwarf homeland.
// ══════════════════════════════════════════════════════════════

// Asset paths for enchanted forest
const EF_TREES = "/assets/packs/enchanted-forest/FBX/";
const EF_PROPS = "/assets/packs/enchanted-forest/FBX/";
const ELF_RUNE = "/assets/packs/elf-runes/FBX/";
const ELF_FORT = "/assets/packs/elf-fortress/FBX/";
const SG_ENV   = "/assets/packs/sg-environment/FBX/";
const HL_BUILD = "/assets/packs/highland-buildings/FBX/";
const Z2_WILD  = "/assets/enemies/wildlife/FBX/";

export const ZONE_2_FABLED_SHORE: BiomeConfig = {
  zoneId: 2,
  name: "Fabled Shore",
  template: "forest",
  loadingImage: "/assets/zone-data/zone2.png",

  // ── Height ─────────────────────────────────────────────────
  height: {
    baseHeight: 2.5,
    macroAmp: 6,
    macroFreq: 0.0006,
    ridgeAmp: 4,
    ridgeFreq: 0.0025,
    detailAmp: 2,
    detailFreq: 0.015,
    waterCutLevel: -0.5,
    coastBuffer: 1000,

    coastline: {
      landPolygon: [
        // Clockwise. East=exit to Travelers Town, North=exit to NW Wilds, South=exit to SW Wilds
        // West coast faces open ocean
        { x: 16000, y: 16000 },
        { x: 16000, y: 0 },
        { x: 14000, y: 200 },
        { x: 11000, y: 500 },
        { x: 8000, y: 800 },
        { x: 5000, y: 1200 },
        { x: 3000, y: 2000 },
        { x: 1500, y: 3500 },
        { x: 600, y: 5000 },
        { x: 300, y: 7000 },
        { x: 200, y: 9000 },
        { x: 400, y: 11000 },
        { x: 800, y: 13000 },
        { x: 1500, y: 14500 },
        { x: 3000, y: 15500 },
        { x: 5000, y: 15800 },
        { x: 8000, y: 16000 },
      ],
      islands: [
        // Small island off NW coast
        [{ x: 800, y: 2000 }, { x: 1800, y: 1800 }, { x: 2000, y: 2800 }, { x: 1000, y: 3000 }],
      ],
      beachWidth: 250,
    },

    regions: [
      // Crystal Groves — NW, elevated with crystal formations
      {
        points: [
          { x: 800, y: 800 }, { x: 5800, y: 800 }, { x: 5800, y: 4800 },
          { x: 3000, y: 5000 }, { x: 800, y: 4000 },
        ],
        type: "hill", forcedHeight: 6, noiseScale: 0.5, falloff: 800,
      },
      // Fabled Citadel — center plateau, flattened for fortress
      {
        points: [
          { x: 7200, y: 7200 }, { x: 8800, y: 7200 }, { x: 8800, y: 8800 },
          { x: 7200, y: 8800 },
        ],
        type: "flat", forcedHeight: 3, noiseScale: 0.1, falloff: 500,
      },
      // Crystal Market — NW trading post, flat
      {
        points: [
          { x: 2400, y: 1800 }, { x: 4000, y: 1800 }, { x: 4000, y: 3000 },
          { x: 2400, y: 3000 },
        ],
        type: "flat", forcedHeight: 3.5, noiseScale: 0.1, falloff: 300,
      },
      // Dwarven Mines — SE, mountainous
      {
        points: [
          { x: 10000, y: 10000 }, { x: 15000, y: 10000 }, { x: 15000, y: 14000 },
          { x: 10000, y: 14000 },
        ],
        type: "mountain", forcedHeight: 12, noiseScale: 0.6, falloff: 1200,
      },
      // Moonstone Ridge — NE, rocky ridge
      {
        points: [
          { x: 11500, y: 4500 }, { x: 15000, y: 4200 }, { x: 15000, y: 7500 },
          { x: 11500, y: 7500 },
        ],
        type: "ridge", forcedHeight: 10, noiseScale: 0.5, falloff: 700,
      },
      // Waterfall Lake — SW, water basin
      {
        points: [
          { x: 1500, y: 10000 }, { x: 6000, y: 10000 }, { x: 6000, y: 14000 },
          { x: 1500, y: 14000 },
        ],
        type: "valley", forcedHeight: 0, noiseScale: 0.3, falloff: 600,
      },
      // Riverstone Bazaar — SE trading, flat
      {
        points: [
          { x: 11000, y: 10800 }, { x: 12600, y: 10800 }, { x: 12600, y: 12000 },
          { x: 11000, y: 12000 },
        ],
        type: "flat", forcedHeight: 4, noiseScale: 0.1, falloff: 300,
      },
    ],
  },

  // ── Material ───────────────────────────────────────────────
  material: {
    moisture: 0.75,
    rockiness: 0.35,
    snowLine: 0.92,
    sandLine: 0.06,
    baseColor: rgb(0.18, 0.42, 0.16),   // lush dark green
    slopeColor: rgb(0.38, 0.36, 0.34),  // mossy stone
    lowColor: rgb(0.12, 0.30, 0.20),    // wet moss near water
    highColor: rgb(0.25, 0.50, 0.30),   // bright canopy green
    roadColor: rgb(0.35, 0.28, 0.18),   // forest path
  },

  // ── Atmosphere ─────────────────────────────────────────────
  atmosphere: {
    fogColor: rgb(0.20, 0.40, 0.35),    // enchanted green mist
    fogStart: 40,
    fogEnd: 130,
    fogMode: "linear",
    skyColor: rgb(0.40, 0.60, 0.70),    // forest sky, slightly overcast
    sunColor: rgb(0.80, 0.90, 0.75),    // filtered through canopy
    sunIntensity: 1.2,
    sunDirection: [-0.3, -1, 0.4],
    ambientColor: rgb(0.30, 0.50, 0.35),
    ambientGroundColor: rgb(0.15, 0.25, 0.12),
    ambientIntensity: 0.7,
    particleType: "leaves",
  },

  // ── Foliage (3 layers) ─────────────────────────────────────
  foliage: [
    // Layer 1 — ground: grass, ferns, mushrooms, flowers, herbs
    { id: "z2_grass_1",    model: SHRUBS + "_grass_1.fbx",     scale: [0.9, 1.5], density: 10, slopeMax: 0.4, heightMin: 0.04, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_grass_2",    model: SHRUBS + "_grass_2.fbx",     scale: [0.8, 1.4], density: 7,  slopeMax: 0.35, heightMin: 0.04, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_fern",       model: EF_PROPS + "Fern_Enchanted.fbx",  scale: [0.7, 1.2], density: 4,  slopeMax: 0.4, heightMin: 0.03, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_flower_glow",model: EF_PROPS + "Flower_Glow.fbx",     scale: [0.5, 0.9], density: 3,  slopeMax: 0.3, heightMin: 0.04, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_flowers_1",  model: SHRUBS + "_flowers_1.fbx",   scale: [0.7, 1.1], density: 2.5,slopeMax: 0.3, heightMin: 0.04, heightMax: 0.65, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_flowers_2",  model: SHRUBS + "_flowers_2.fbx",   scale: [0.6, 1.0], density: 2,  slopeMax: 0.3, heightMin: 0.04, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_mushroom_1", model: EF_PROPS + "Mushroom_Large.fbx",   scale: [0.5, 1.0], density: 1.5,slopeMax: 0.4, heightMin: 0.02, heightMax: 0.5, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_mushroom_cl",model: EF_PROPS + "Mushroom_Cluster.fbx", scale: [0.4, 0.8], density: 1,  slopeMax: 0.4, heightMin: 0.02, heightMax: 0.5, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_bush",       model: SHRUBS + "_bush_1.fbx",      scale: [0.8, 1.3], density: 2,  slopeMax: 0.35, heightMin: 0.05, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 1 },
    { id: "z2_herb_common",model: SHRUBS + "_flowers_2.fbx",   scale: [0.5, 0.8], density: 1.5,slopeMax: 0.3, heightMin: 0.05, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 1 },

    // Layer 2 — mid: rocks, boulders, rune stones, crystals
    { id: "z2_rock_moss",   model: EF_PROPS + "Rock_Mossy.fbx",    scale: [0.8, 1.4], density: 1.5, slopeMax: 0.7, heightMin: 0.0, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_rock_1",      model: SG_ENV + "Rock_01.fbx",         scale: [0.8, 1.5], density: 1.0, slopeMax: 0.7, heightMin: 0.0, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_rock_2",      model: SG_ENV + "Rock_02.fbx",         scale: [0.7, 1.3], density: 0.8, slopeMax: 0.7, heightMin: 0.0, heightMax: 1.0, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_crystal_1",   model: EF_PROPS + "Crystal_01.fbx",    scale: [0.5, 1.0], density: 0.6, slopeMax: 0.5, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_crystal_2",   model: EF_PROPS + "Crystal_02.fbx",    scale: [0.5, 0.9], density: 0.4, slopeMax: 0.5, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_runestone_1", model: ELF_RUNE + "Rune_Stone_01.fbx", scale: [0.6, 1.0], density: 0.15,slopeMax: 0.4, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_runestone_2", model: ELF_RUNE + "Rune_Stone_02.fbx", scale: [0.5, 0.9], density: 0.1, slopeMax: 0.4, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_sculpture",   model: ELF_RUNE + "Sculpture_01.fbx",  scale: [0.6, 1.0], density: 0.06,slopeMax: 0.3, heightMin: 0.1, heightMax: 0.7, avoidRoads: true, avoidWater: true, layer: 2 },
    { id: "z2_arch_ruin",   model: EF_PROPS + "Arch_Ruin.fbx",     scale: [0.4, 0.7], density: 0.04,slopeMax: 0.5, heightMin: 0.1, heightMax: 0.9, avoidRoads: true, avoidWater: true, layer: 2 },

    // Layer 3 — tall: ancient trees, willows, crystal trees
    { id: "z2_tree_ancient", model: EF_TREES + "Tree_Ancient.fbx",  scale: [0.6, 1.1], density: 1.5, slopeMax: 0.35, heightMin: 0.08, heightMax: 0.85, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_tree_willow",  model: EF_TREES + "Tree_Willow.fbx",   scale: [0.7, 1.2], density: 1.0, slopeMax: 0.3, heightMin: 0.05, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_tree_crystal", model: EF_TREES + "Tree_Crystal.fbx",  scale: [0.5, 0.9], density: 0.4, slopeMax: 0.3, heightMin: 0.1, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_tree_sg_1",    model: SG_ENV + "Tree_01.fbx",         scale: [0.7, 1.2], density: 1.2, slopeMax: 0.35, heightMin: 0.06, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_tree_sg_2",    model: SG_ENV + "Tree_02.fbx",         scale: [0.6, 1.0], density: 0.8, slopeMax: 0.35, heightMin: 0.06, heightMax: 0.8, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_shrine",       model: EF_PROPS + "Shrine.fbx",        scale: [0.4, 0.7], density: 0.03,slopeMax: 0.2, heightMin: 0.1, heightMax: 0.6, avoidRoads: true, avoidWater: true, layer: 3 },
    { id: "z2_lantern",      model: EF_PROPS + "Lantern_Forest.fbx",scale: [0.6, 0.9], density: 0.2, slopeMax: 0.3, heightMin: 0.05, heightMax: 0.7, avoidRoads: false, avoidWater: true, layer: 3 },
  ],

  // ── Animals ────────────────────────────────────────────────
  animals: [
    { type: "rabbit", model: Z2_WILD + "rabbit.fbx",  count: 20, speed: 35 },
    { type: "deer",   model: Z2_WILD + "deer.fbx",    count: 14, speed: 45 },
    { type: "wolf",   model: Z2_WILD + "wolf.fbx",    count: 8,  speed: 55 },
    { type: "owl",    model: Z2_WILD + "owl.fbx",     count: 6,  speed: 20 },
    { type: "fox",    model: Z2_WILD + "fox.fbx",     count: 10, speed: 42 },
  ],

  // ── Points of Interest ─────────────────────────────────────
  pois: [
    // ── SAFE ZONES ──
    { id: "z2_citadel",       x: 8000, y: 8000, type: "safe_zone", radius: 800 },
    { id: "z2_crystal_market",x: 3200, y: 2400, type: "trading_post", radius: 800 },
    { id: "z2_riverstone",    x: 11800, y: 11200, type: "trading_post", radius: 800 },
    { id: "z2_graveyard_nw",  x: 1200, y: 4000, type: "graveyard", radius: 400 },
    { id: "z2_graveyard_se",  x: 14000, y: 14000, type: "graveyard", radius: 400 },

    // ── GOLD MINES (dwarven) ──
    { id: "z2_mine_crystal",  x: 2500, y: 3500, type: "gold_mine", radius: 350, data: { tier: 2, respawn: 90, name: "Crystal Vein" } },
    { id: "z2_mine_moonstone",x: 12500, y: 5500, type: "gold_mine", radius: 350, data: { tier: 3, respawn: 120, name: "Moonstone Deposit" } },
    { id: "z2_mine_mithril",  x: 12000, y: 12000, type: "gold_mine", radius: 400, data: { tier: 4, respawn: 150, name: "Mithril Seam" } },
    { id: "z2_mine_emerald",  x: 14000, y: 11000, type: "gold_mine", radius: 350, data: { tier: 4, respawn: 150, name: "Emerald Pocket" } },
    { id: "z2_mine_sapphire", x: 11000, y: 13000, type: "gold_mine", radius: 300, data: { tier: 5, respawn: 180, name: "Sapphire Grotto" } },
    { id: "z2_mine_center",   x: 9500, y: 7500, type: "gold_mine", radius: 300, data: { tier: 2, respawn: 90, name: "Iron Root Mine" } },

    // ── HARVEST NODES — Logging (ancient trees) ──
    { id: "z2_log_nw",     x: 2000, y: 2000, type: "harvest_node", radius: 600, data: { prof: "logging", tier: 2 } },
    { id: "z2_log_n",      x: 7000, y: 2500, type: "harvest_node", radius: 600, data: { prof: "logging", tier: 2 } },
    { id: "z2_log_ne",     x: 12000, y: 3000, type: "harvest_node", radius: 500, data: { prof: "logging", tier: 3 } },
    { id: "z2_log_center", x: 6500, y: 6000, type: "harvest_node", radius: 500, data: { prof: "logging", tier: 3 } },
    { id: "z2_log_sw",     x: 3000, y: 11000, type: "harvest_node", radius: 600, data: { prof: "logging", tier: 2 } },
    { id: "z2_log_se",     x: 13500, y: 9000, type: "harvest_node", radius: 500, data: { prof: "logging", tier: 3 } },

    // ── HARVEST NODES — Herbalism (glowing flowers, mushrooms, herbs) ──
    { id: "z2_herb_grove",   x: 3500, y: 4000, type: "harvest_node", radius: 500, data: { prof: "herbalism", tier: 2 } },
    { id: "z2_herb_glade",   x: 1500, y: 7000, type: "harvest_node", radius: 500, data: { prof: "herbalism", tier: 2 } },
    { id: "z2_herb_heartwood",x: 8500, y: 5500, type: "harvest_node", radius: 500, data: { prof: "herbalism", tier: 3 } },
    { id: "z2_herb_silver",  x: 2000, y: 9500, type: "harvest_node", radius: 500, data: { prof: "herbalism", tier: 3 } },
    { id: "z2_herb_bramble", x: 6000, y: 13000, type: "harvest_node", radius: 500, data: { prof: "herbalism", tier: 2 } },
    { id: "z2_herb_frost",   x: 13000, y: 13500, type: "harvest_node", radius: 400, data: { prof: "herbalism", tier: 3 } },

    // ── HARVEST NODES — Mining (rocks, crystals, ore veins) ──
    { id: "z2_mine_node_nw",   x: 4000, y: 1500, type: "harvest_node", radius: 400, data: { prof: "mining", tier: 2 } },
    { id: "z2_mine_node_ridge",x: 13000, y: 6000, type: "harvest_node", radius: 500, data: { prof: "mining", tier: 3 } },
    { id: "z2_mine_node_se1",  x: 11500, y: 11500, type: "harvest_node", radius: 500, data: { prof: "mining", tier: 4 } },
    { id: "z2_mine_node_se2",  x: 14000, y: 12500, type: "harvest_node", radius: 400, data: { prof: "mining", tier: 4 } },
    { id: "z2_mine_node_center",x: 9000, y: 8500, type: "harvest_node", radius: 400, data: { prof: "mining", tier: 2 } },

    // ── HARVEST NODES — Skinning (near animal habitats) ──
    { id: "z2_skin_nw",    x: 1800, y: 5500, type: "harvest_node", radius: 500, data: { prof: "skinning", tier: 2 } },
    { id: "z2_skin_center",x: 7000, y: 10000, type: "harvest_node", radius: 500, data: { prof: "skinning", tier: 3 } },
    { id: "z2_skin_ne",    x: 14000, y: 3000, type: "harvest_node", radius: 400, data: { prof: "skinning", tier: 2 } },
    { id: "z2_skin_sw",    x: 4000, y: 12000, type: "harvest_node", radius: 500, data: { prof: "skinning", tier: 3 } },

    // ── HARVEST NODES — Fishing (rivers, lake, waterfall) ──
    { id: "z2_fish_river_n",  x: 5500, y: 3000, type: "harvest_node", radius: 400, data: { prof: "fishing", tier: 2 } },
    { id: "z2_fish_river_mid",x: 4500, y: 6500, type: "harvest_node", radius: 400, data: { prof: "fishing", tier: 2 } },
    { id: "z2_fish_lake",     x: 3000, y: 11500, type: "harvest_node", radius: 600, data: { prof: "fishing", tier: 3 } },
    { id: "z2_fish_stream_e", x: 11000, y: 7000, type: "harvest_node", radius: 400, data: { prof: "fishing", tier: 3 } },

    // ── HARVEST NODES — Scavenging (ruins, old structures) ──
    { id: "z2_scav_ruins_1",  x: 3000, y: 3200, type: "harvest_node", radius: 400, data: { prof: "scavenging", tier: 2 } },
    { id: "z2_scav_ruins_2",  x: 10500, y: 2500, type: "harvest_node", radius: 400, data: { prof: "scavenging", tier: 3 } },
    { id: "z2_scav_library",  x: 11000, y: 3000, type: "harvest_node", radius: 500, data: { prof: "scavenging", tier: 3 } },
    { id: "z2_scav_mine_junk",x: 13500, y: 11500, type: "harvest_node", radius: 400, data: { prof: "scavenging", tier: 4 } },

    // ── TREASURE ──
    { id: "z2_treasure_1", x: 4500, y: 3500, type: "treasure", radius: 200 },
    { id: "z2_treasure_2", x: 9000, y: 5000, type: "treasure", radius: 200 },
    { id: "z2_treasure_3", x: 2500, y: 10500, type: "treasure", radius: 200 },
    { id: "z2_treasure_4", x: 13000, y: 8000, type: "treasure", radius: 200 },
    { id: "z2_treasure_5", x: 7000, y: 13000, type: "treasure", radius: 200 },
    { id: "z2_treasure_6", x: 14500, y: 13500, type: "treasure", radius: 200 },

    // ── DUNGEONS ──
    { id: "z2_dungeon_ruins", x: 3000, y: 3000, type: "dungeon", radius: 400, data: { name: "Elven Ruins", level: 4, floors: 4 } },
    { id: "z2_dungeon_arcane",x: 11000, y: 3000, type: "dungeon", radius: 500, data: { name: "Arcane Depths", level: 8, floors: 6 } },

    // ── DOCKS ──
    { id: "z2_dock_east", x: 15800, y: 8000, type: "dock", radius: 500 },
    { id: "z2_dock_south",x: 8000, y: 15800, type: "dock", radius: 500 },

    // ── ROADS ──
    // Main N-S road through center
    { id: "z2_road_ns_1", x: 8000, y: 800,   type: "road" },
    { id: "z2_road_ns_2", x: 8000, y: 4000,  type: "road" },
    { id: "z2_road_ns_3", x: 8000, y: 8000,  type: "road" },
    { id: "z2_road_ns_4", x: 8000, y: 12000, type: "road" },
    { id: "z2_road_ns_5", x: 8000, y: 15200, type: "road" },
    // E-W road through center
    { id: "z2_road_ew_1", x: 800,   y: 8000, type: "road" },
    { id: "z2_road_ew_2", x: 4000,  y: 8000, type: "road" },
    { id: "z2_road_ew_3", x: 12000, y: 8000, type: "road" },
    { id: "z2_road_ew_4", x: 15200, y: 8000, type: "road" },
    // Crystal Market spur
    { id: "z2_road_cm",   x: 3200,  y: 4000, type: "road" },
    // Riverstone spur
    { id: "z2_road_rs",   x: 11800, y: 10000,type: "road" },
  ],

  // ── Enemy Camps ────────────────────────────────────────────
  enemyCamps: [
    // Row 0 (north)
    { id: "z2_camp_0_0", ...gc(0, 0), radius: 500, enemies: [{ type: "Spider", count: 4, level: 2 }], eventType: "camp" },
    { id: "z2_camp_1_0", ...gc(1, 0), radius: 500, enemies: [{ type: "Treant", count: 3, level: 3 }], eventType: "patrol" },
    { id: "z2_camp_2_0", ...gc(2, 0), radius: 600, enemies: [{ type: "Harpy", count: 3, level: 3 }, { type: "Spider", count: 3, level: 2 }], eventType: "camp" },
    { id: "z2_camp_3_0", ...gc(3, 0), radius: 500, enemies: [{ type: "Treant", count: 2, level: 4 }, { type: "Spider", count: 2, level: 3 }], eventType: "camp" },
    // Row 1
    { id: "z2_camp_0_1", ...gc(0, 1), radius: 600, enemies: [{ type: "Golem", count: 2, level: 5 }], eventType: "camp" },
    { id: "z2_camp_1_1", ...gc(1, 1), radius: 700, enemies: [{ type: "Treant", count: 3, level: 5 }, { type: "Harpy", count: 3, level: 4 }], eventType: "siege" },
    { id: "z2_camp_2_1", ...gc(2, 1), radius: 600, enemies: [{ type: "Harpy", count: 4, level: 5 }], eventType: "patrol" },
    { id: "z2_camp_3_1", ...gc(3, 1), radius: 600, enemies: [{ type: "Golem", count: 3, level: 5 }], eventType: "camp" },
    // Row 2
    { id: "z2_camp_0_2", ...gc(0, 2), radius: 500, enemies: [{ type: "Spider", count: 5, level: 4 }], eventType: "camp" },
    { id: "z2_camp_1_2", ...gc(1, 2), radius: 600, enemies: [{ type: "Treant", count: 3, level: 6 }], eventType: "camp" },
    { id: "z2_camp_2_2", ...gc(2, 2), radius: 800, enemies: [{ type: "Golem", count: 2, level: 7 }, { type: "Harpy", count: 3, level: 5 }], eventType: "siege" },
    { id: "z2_camp_3_2", ...gc(3, 2), radius: 700, enemies: [{ type: "Golem", count: 2, level: 6 }], eventType: "camp" },
    // Row 3 (south)
    { id: "z2_camp_0_3", ...gc(0, 3), radius: 500, enemies: [{ type: "Spider", count: 4, level: 4 }], eventType: "camp" },
    { id: "z2_camp_1_3", ...gc(1, 3), radius: 600, enemies: [{ type: "Treant", count: 4, level: 5 }], eventType: "patrol" },
    { id: "z2_camp_2_3", ...gc(2, 3), radius: 600, enemies: [{ type: "Golem", count: 3, level: 6 }], eventType: "camp" },
    { id: "z2_camp_3_3", ...gc(3, 3), radius: 900, enemies: [{ type: "Treant", count: 3, level: 8 }, { type: "Golem", count: 2, level: 7 }], eventType: "siege" },
    // BOSS — Ancient Grove Guardian (deep in Crystal Groves)
    { id: "z2_boss_grove", x: 3000, y: 3000, radius: 1000, enemies: [
      { type: "Treant", count: 3, level: 8 },
      { type: "Golem", count: 2, level: 9 },
    ], eventType: "boss", isBoss: true },
    // BOSS — Mithril Sentinel (Dwarven Mines)
    { id: "z2_boss_mines", x: 12000, y: 12000, radius: 800, enemies: [
      { type: "Golem", count: 3, level: 9 },
      { type: "Iron Sentinel", count: 1, level: 10 },
    ], eventType: "boss", isBoss: true },
  ],
};

// ── Zone Config Registry ───────────────────────────────────────

const BIOME_CONFIGS: Map<number, BiomeConfig> = new Map();
BIOME_CONFIGS.set(1, ZONE_1_GOLDEN_CRUSADE);
BIOME_CONFIGS.set(2, ZONE_2_FABLED_SHORE);

export function getBiomeConfig(zoneId: number): BiomeConfig | null {
  return BIOME_CONFIGS.get(zoneId) ?? null;
}

export function registerBiomeConfig(config: BiomeConfig): void {
  BIOME_CONFIGS.set(config.zoneId, config);
}

/** All registered biome configs */
export function getAllBiomeConfigs(): BiomeConfig[] {
  return Array.from(BIOME_CONFIGS.values());
}

/**
 * Cube World Asset Registry
 *
 * Manifest-driven lookup for Cube World voxel assets on R2.
 * Used by the 2D canvas renderers (voxel.ts, dungeon-tile-renderer,
 * world-editor, world-decorations) — NOT by Three.js or BabylonJS.
 *
 * Provides:
 *   - Block color palettes for terrain rendering
 *   - Enemy/animal color data for voxel sprite drawing
 *   - Environment prop catalog for the world editor
 *   - R2 URL resolver for any asset by category + filename
 *   - Texture atlas preloading (Atlas.png, Blocks_PixelArt.png)
 */

// ── Types ────────────────────────────────────────────────────────
export interface CubeWorldAssetEntry {
  id: string;
  filename: string;
  category: string;
  key: string;
  url: string;
  size: number;
}

export interface CubeWorldManifest {
  pack: string;
  version: string;
  uploadedAt: string;
  baseUrl: string;
  assets: CubeWorldAssetEntry[];
}

export type CubeWorldCategory =
  | 'cubeworld-characters'
  | 'cubeworld-enemies'
  | 'cubeworld-animals'
  | 'cubeworld-environment'
  | 'cubeworld-blocks'
  | 'cubeworld-pixel-blocks'
  | 'cubeworld-tools'
  | 'cubeworld-textures';

// ── Constants ────────────────────────────────────────────────────
const R2_BASE = 'https://grudgeassets.grudge.workers.dev';

/**
 * Block color palettes extracted from Cube World pixel blocks.
 * Used by TERRAIN_PALETTES in voxel.ts and dungeon tile rendering.
 */
export const CUBEWORLD_BLOCK_COLORS: Record<string, { base: string[]; accent: string[] }> = {
  grass:        { base: ['#4a8a3a', '#3a7a2d', '#357025', '#2e6320'], accent: ['#5aa04a', '#286018'] },
  dirt:         { base: ['#8b6914', '#7a5c30', '#6b4a23', '#5e3b1a'], accent: ['#a07040', '#4a3010'] },
  stone:        { base: ['#7a7a8a', '#6a6a7a', '#5a5a6a', '#4e4e5e'], accent: ['#8a8a9a', '#3a3a4a'] },
  snow:         { base: ['#e8e8f0', '#d8d8e8', '#c8c8d8', '#b8b8c8'], accent: ['#f0f0ff', '#a0a0b0'] },
  ice:          { base: ['#88ccee', '#78bbdd', '#68aacc', '#5899bb'], accent: ['#aaddff', '#4488aa'] },
  wood:         { base: ['#8b6914', '#7a5830', '#6b4a20', '#5e3b18'], accent: ['#a07040', '#4a3010'] },
  wood_planks:  { base: ['#a07850', '#907040', '#806030', '#705020'], accent: ['#b08860', '#604020'] },
  diamond:      { base: ['#44ddee', '#33ccdd', '#22bbcc', '#11aabb'], accent: ['#66eeff', '#009999'] },
  coal:         { base: ['#2a2a2a', '#222222', '#1a1a1a', '#333333'], accent: ['#444444', '#111111'] },
  metal:        { base: ['#8a8a9a', '#7a7a8a', '#6a6a7a', '#9a9aaa'], accent: ['#aaaacc', '#555566'] },
  brick:        { base: ['#8b4513', '#7a3b10', '#6b300d', '#9b5520'], accent: ['#aa5520', '#553010'] },
  brick_grey:   { base: ['#6a6a6a', '#5a5a5a', '#4a4a4a', '#7a7a7a'], accent: ['#888888', '#3a3a3a'] },
  brick_dark:   { base: ['#3a3a3a', '#2a2a2a', '#1a1a1a', '#4a4a4a'], accent: ['#555555', '#111111'] },
  brick_red:    { base: ['#aa3333', '#992828', '#882020', '#bb4040'], accent: ['#cc4444', '#661818'] },
  brick_yellow: { base: ['#ccaa44', '#bb9933', '#aa8822', '#ddbb55'], accent: ['#eedd66', '#887722'] },
  crystal:      { base: ['#aa44ff', '#9933ee', '#8822dd', '#bb55ff'], accent: ['#cc66ff', '#6600cc'] },
  cheese:       { base: ['#ffcc33', '#eebb22', '#ddaa11', '#ffdd44'], accent: ['#ffee66', '#cc8800'] },
  crate:        { base: ['#8b6914', '#7a5830', '#6b4a20', '#9a7830'], accent: ['#aa8840', '#4a3010'] },
  leaves:       { base: ['#2a6a1a', '#1e5612', '#163e0e', '#358025'], accent: ['#3a8a2a', '#0e3808'] },
};

/** Cube World enemy colors for 2D voxel sprite rendering */
export const CUBEWORLD_ENEMY_COLORS: Record<string, string> = {
  Skeleton:       '#d4d4d8',
  Skeleton_Armor: '#8b8b8b',
  Zombie:         '#5a8a3a',
  Goblin:         '#4a7a23',
  Wizard:         '#7c3aed',
  Demon:          '#cc2222',
  Giant:          '#a57850',
  Yeti:           '#c8c8d8',
  Hedgehog:       '#78716c',
};

/** Cube World animal colors for open-world decorations */
export const CUBEWORLD_ANIMAL_COLORS: Record<string, string> = {
  Wolf: '#6b7280', Dog: '#8b6914', Cat: '#a07850',
  Sheep: '#e8e8f0', Pig: '#f0a0a0', Horse: '#6b4423',
  Chicken: '#ffcc33', Chick: '#ffee66', Raccoon: '#5a5a6a',
};

/** Environment props available in the Cube World pack */
export const CUBEWORLD_ENVIRONMENT_PROPS = [
  'Tree_1', 'Tree_2', 'Tree_3',
  'DeadTree_1', 'DeadTree_2', 'DeadTree_3',
  'Rock1', 'Rock2', 'Bush', 'Mushroom',
  'Crystal_Big', 'Crystal_Small',
  'Chest_Closed', 'Chest_Open',
  'Bamboo', 'Bamboo_Mid', 'Bamboo_Small',
  'Flowers_1', 'Flowers_2',
  'Grass_Big', 'Grass_Small',
  'Fence_Center', 'Fence_Corner', 'Fence_End', 'Fence_T',
  'Cart', 'Key', 'Door_Closed',
  'Lever_Left', 'Lever_Right',
  'Button', 'Button_Pressed',
  'Rail_Straight', 'Rail_Corner', 'Rail_Incline',
  'Plant_2', 'Plant_3',
] as const;

/** Tool/weapon types and material tiers */
export const CUBEWORLD_TOOL_TYPES = ['Sword', 'Axe', 'Pickaxe', 'Shovel'] as const;
export const CUBEWORLD_TOOL_MATERIALS = ['Wood', 'Stone', 'Gold', 'Diamond'] as const;

// ── Manifest ─────────────────────────────────────────────────────
let manifest: CubeWorldManifest | null = null;
let manifestPromise: Promise<CubeWorldManifest> | null = null;
const categoryIndex = new Map<string, Map<string, CubeWorldAssetEntry>>();

async function fetchManifest(): Promise<CubeWorldManifest> {
  if (manifest) return manifest;
  try {
    const res = await fetch('/cubeworld-manifest.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = await res.json() as CubeWorldManifest;
    for (const asset of manifest.assets) {
      if (!categoryIndex.has(asset.category)) categoryIndex.set(asset.category, new Map());
      categoryIndex.get(asset.category)!.set(asset.filename, asset);
    }
    return manifest;
  } catch (err) {
    console.warn('[CubeWorld] Manifest unavailable:', err);
    manifest = { pack: 'Cube World - Aug 2023', version: '0.0.0', uploadedAt: '', baseUrl: R2_BASE, assets: [] };
    return manifest;
  }
}

export async function getCubeWorldManifest(): Promise<CubeWorldManifest> {
  if (!manifestPromise) manifestPromise = fetchManifest();
  return manifestPromise;
}

// ── URL helpers ──────────────────────────────────────────────────

/** Get R2 download URL for a specific asset */
export function getAssetUrl(category: CubeWorldCategory, filename: string): string | null {
  const cat = categoryIndex.get(category);
  const entry = cat?.get(filename);
  return entry ? `${R2_BASE}/v1/assets/${entry.id}/file` : null;
}

/** List all assets in a category */
export function getAssetsByCategory(category: CubeWorldCategory): CubeWorldAssetEntry[] {
  return Array.from(categoryIndex.get(category)?.values() ?? []);
}

/** Summary for editor UIs */
export function getCubeWorldSummary() {
  if (!manifest) return { totalAssets: 0, categories: [] as { name: string; count: number; assets: string[] }[] };
  const cats = new Map<string, string[]>();
  for (const a of manifest.assets) {
    if (!cats.has(a.category)) cats.set(a.category, []);
    cats.get(a.category)!.push(a.filename);
  }
  return {
    totalAssets: manifest.assets.length,
    categories: Array.from(cats.entries()).map(([name, assets]) => ({ name, count: assets.length, assets })),
  };
}

// ── Texture atlas preloading (for 2D canvas) ─────────────────────
const imageCache = new Map<string, HTMLImageElement>();

/** Preload Cube World texture atlases as HTMLImageElements */
export async function preloadCubeWorldTextures(): Promise<void> {
  await getCubeWorldManifest();
  for (const name of ['Atlas.png', 'Blocks_PixelArt.png']) {
    const url = getAssetUrl('cubeworld-textures', name);
    if (!url || imageCache.has(name)) continue;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed: ${name}`));
        img.src = url;
      });
      imageCache.set(name, img);
    } catch (err) {
      console.warn(`[CubeWorld] Preload failed: ${name}`, err);
    }
  }
}

/** Get a preloaded texture atlas image for canvas drawImage() */
export function getCubeWorldTexture(name: string): HTMLImageElement | null {
  return imageCache.get(name) ?? null;
}

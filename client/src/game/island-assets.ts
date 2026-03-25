/**
 * Island Tileset Asset Loader
 * Loads and caches images from:
 *  - Forest Top-Down Tileset (ground tiles, environment, buildings)
 *  - Pirate Topic Asset Pack (boats, sand, palms, water, props)
 */

const FOREST_BASE = '/assets/tilesets/forest/PNG';
const PIRATE_BASE = '/assets/tilesets/pirate/PNG';

// ── Asset manifest ─────────────────────────────────────────────

interface AssetEntry {
  key: string;
  path: string;
}

const FOREST_GROUND: AssetEntry[] = Array.from({ length: 56 }, (_, i) => ({
  key: `ground-${String(i + 1).padStart(2, '0')}`,
  path: `${FOREST_BASE}/Ground Tiles/Top-Down Forest Tileset_Ground ${String(i + 1).padStart(2, '0')}.png`,
}));

const FOREST_ENV: AssetEntry[] = [
  { key: 'tree-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Tree 01.png` },
  { key: 'tree-02', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Tree 02.png` },
  { key: 'tree-03', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Tree 03.png` },
  { key: 'rock-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Rock 01.png` },
  { key: 'rock-02', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Rock 02.png` },
  { key: 'rock-03', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Rock 03.png` },
  { key: 'rock-04', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Rock 04.png` },
  { key: 'rock-05', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Rock 05.png` },
  { key: 'stump-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Stump 01.png` },
  { key: 'stump-02', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Stump 02.png` },
  { key: 'stump-03', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Stump 03.png` },
  { key: 'stump-04', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Stump 04.png` },
  { key: 'grass-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Grass 01.png` },
  { key: 'grass-02', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Grass 02.png` },
  { key: 'grass-03', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Grass 03.png` },
  { key: 'fence-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Fence 01.png` },
  { key: 'log', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Log.png` },
  { key: 'well', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Well.png` },
  { key: 'spikes', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Spikes.png` },
  { key: 'ground-env-01', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Ground 01.png` },
  { key: 'ground-env-02', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Ground 02.png` },
  { key: 'ground-env-03', path: `${FOREST_BASE}/Environment/Top-Down Forest Tileset_Environment - Ground 03.png` },
];

const FOREST_BUILDINGS: AssetEntry[] = [
  { key: 'forest-castle', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Castle.png` },
  { key: 'forest-tower', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Archer Tower Front.png` },
  { key: 'forest-knight', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Knight Post Front.png` },
  { key: 'forest-house', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Villager House Front.png` },
  { key: 'forest-tribal', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Tribal House Front.png` },
  { key: 'forest-well', path: `${FOREST_BASE}/Buildings/Top-Down Forest Tileset_Building - Castle Tower Front.png` },
];

const PIRATE_ASSETS: AssetEntry[] = Array.from({ length: 38 }, (_, i) => ({
  key: `pirate-${String(i + 1).padStart(2, '0')}`,
  path: `${PIRATE_BASE}/${String(i + 1).padStart(2, '0')}.png`,
}));

// ── Named pirate asset aliases ─────────────────────────────────

const PIRATE_ALIASES: Record<string, string> = {
  'pirate-boat': 'pirate-04',       // purple boat
  'pirate-boat-red': 'pirate-05',   // red boat
  'pirate-boat-teal': 'pirate-02',  // teal boat
  'pirate-sand-01': 'pirate-06',    // sand with water
  'pirate-sand-02': 'pirate-09',    // plain sand
  'pirate-palm': 'pirate-15',       // palm tree
  'pirate-cannon': 'pirate-17',     // cannon
  'pirate-rocks': 'pirate-19',      // rocks
  'pirate-barrel': 'pirate-21',     // barrel
  'pirate-chest': 'pirate-22',      // treasure chest
  'pirate-treasure': 'pirate-23',   // treasure + gold
  'pirate-logs': 'pirate-27',       // log pile
  'pirate-crab': 'pirate-35',       // crab
  'pirate-water-01': 'pirate-37',   // water foam
  'pirate-water-02': 'pirate-38',   // water deep
  'pirate-dock': 'pirate-30',       // dock/planks
};

// ── Asset Loader Class ─────────────────────────────────────────

export class IslandAssetLoader {
  private cache = new Map<string, HTMLImageElement>();
  private loading = false;
  loaded = false;
  progress = 0;

  /** Load priority assets first (what's visible immediately) */
  async loadAll(): Promise<void> {
    if (this.loading || this.loaded) return;
    this.loading = true;

    // Priority: a few ground tiles, key environment, buildings, pirate assets
    const priorityKeys = [
      ...FOREST_GROUND.slice(0, 12),
      ...FOREST_ENV.slice(0, 8),
      ...FOREST_BUILDINGS,
      ...PIRATE_ASSETS.slice(0, 24),
    ];

    const allEntries = [...FOREST_GROUND, ...FOREST_ENV, ...FOREST_BUILDINGS, ...PIRATE_ASSETS];
    let loaded = 0;

    // Load priority first
    await Promise.all(priorityKeys.map(e => this.loadImage(e.key, e.path)));
    loaded = priorityKeys.length;
    this.progress = loaded / allEntries.length;

    // Load remaining in background
    const remaining = allEntries.filter(e => !this.cache.has(e.key));
    for (const entry of remaining) {
      this.loadImage(entry.key, entry.path).then(() => {
        loaded++;
        this.progress = loaded / allEntries.length;
      });
    }

    this.loaded = true;
    this.loading = false;
  }

  private loadImage(key: string, path: string): Promise<void> {
    if (this.cache.has(key)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(key, img);
        resolve();
      };
      img.onerror = () => resolve(); // silently skip failed loads
      img.src = path;
    });
  }

  get(key: string): HTMLImageElement | null {
    // Check direct key
    const direct = this.cache.get(key);
    if (direct) return direct;
    // Check aliases
    const aliasKey = PIRATE_ALIASES[key];
    if (aliasKey) return this.cache.get(aliasKey) || null;
    return null;
  }

  /** Get a forest ground tile image by number (1-56) */
  getGround(num: number): HTMLImageElement | null {
    return this.cache.get(`ground-${String(num).padStart(2, '0')}`) || null;
  }

  /** Get a forest environment asset */
  getEnv(key: string): HTMLImageElement | null {
    return this.cache.get(key) || null;
  }

  /** Get a pirate asset by number (1-38) */
  getPirate(num: number): HTMLImageElement | null {
    return this.cache.get(`pirate-${String(num).padStart(2, '0')}`) || null;
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _instance: IslandAssetLoader | null = null;

export function getIslandAssets(): IslandAssetLoader {
  if (!_instance) _instance = new IslandAssetLoader();
  return _instance;
}

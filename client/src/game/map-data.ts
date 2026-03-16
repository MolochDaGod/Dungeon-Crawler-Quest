import { MAP_SIZE, LANE_WAYPOINTS, Vec2 } from './types';

export const TILE_SIZE = 80;
export const GRID_SIZE = Math.ceil(MAP_SIZE / TILE_SIZE);

export interface MapDecoration {
  id: number;
  x: number;
  y: number;
  type: string;
  seed: number;
  scale: number;
  rotation: number;
}

export interface MapCampDef {
  x: number;
  y: number;
  type: 'small' | 'medium' | 'buff' | 'boss';
  mobCount?: number;
}

export interface MapBossPit {
  x: number;
  y: number;
  radius: number;
}

export interface MapCampfire {
  x: number;
  y: number;
  team: number;
}

export interface MapData {
  version: number;
  mapSize: number;
  tileSize: number;
  gridSize: number;
  terrain: number[][];
  heightmap: number[][];
  collision: boolean[][];
  decorations: MapDecoration[];
  camps: MapCampDef[];
  bossPit: MapBossPit | null;
  campfires: MapCampfire[];
  laneWaypoints: Vec2[][];
  basePositions: Vec2[];
  nextDecoId: number;
}

const STORAGE_KEY = 'grudge_moba_map';

export function createDefaultMapData(): MapData {
  const terrain: number[][] = [];
  const heightmap: number[][] = [];
  const collision: boolean[][] = [];
  for (let ty = 0; ty < GRID_SIZE; ty++) {
    terrain[ty] = [];
    heightmap[ty] = [];
    collision[ty] = [];
    for (let tx = 0; tx < GRID_SIZE; tx++) {
      terrain[ty][tx] = 0; // grass
      heightmap[ty][tx] = 1;
      collision[ty][tx] = false;
    }
  }

  return {
    version: 1,
    mapSize: MAP_SIZE,
    tileSize: TILE_SIZE,
    gridSize: GRID_SIZE,
    terrain,
    heightmap,
    collision,
    decorations: [],
    camps: [
      { x: 1000, y: 1000, type: 'small' },
      { x: 1500, y: 2500, type: 'medium' },
      { x: 800, y: 2200, type: 'buff' },
      { x: 1800, y: 1200, type: 'small' },
      { x: 3000, y: 3000, type: 'small' },
      { x: 2500, y: 1500, type: 'medium' },
      { x: 3200, y: 1800, type: 'buff' },
      { x: 2200, y: 2800, type: 'small' },
    ],
    bossPit: { x: MAP_SIZE / 2 + 400, y: MAP_SIZE / 2 - 400, radius: 200 },
    campfires: [
      { x: 300 - 100, y: 3700 + 100, team: 0 },
      { x: 3700 + 100, y: 300 - 100, team: 1 },
    ],
    laneWaypoints: LANE_WAYPOINTS.map(lane => [...lane]),
    basePositions: [
      { x: 300, y: 3700 },
      { x: 3700, y: 300 },
    ],
    nextDecoId: 1,
  };
}

export function saveMapData(data: MapData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save map data:', e);
  }
}

export function loadMapData(): MapData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as MapData;
    if (!data.version || !data.terrain || !data.terrain.length) return null;
    return data;
  } catch (e) {
    console.error('Failed to load map data:', e);
    return null;
  }
}

export function clearMapData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportMapJSON(data: MapData): string {
  return JSON.stringify(data, null, 2);
}

export function importMapJSON(json: string): MapData | null {
  try {
    const data = JSON.parse(json) as MapData;
    if (!data.version || !data.terrain) return null;
    return data;
  } catch {
    return null;
  }
}

export function downloadMapJSON(data: MapData): void {
  const json = exportMapJSON(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'grudge-moba-map.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Terrain type indices matching TERRAIN_LOOKUP in engine.ts
export const TERRAIN_TYPES = [
  { id: 0, name: 'Grass', color: '#2a5c1a' },
  { id: 1, name: 'Dirt', color: '#6b4423' },
  { id: 2, name: 'Stone', color: '#5a5a6a' },
  { id: 3, name: 'Water', color: '#1a4a8a' },
  { id: 4, name: 'Lane', color: '#4a4030' },
  { id: 5, name: 'Jungle', color: '#1a3a12' },
  { id: 6, name: 'Base Blue', color: '#1a2a5a' },
  { id: 7, name: 'Base Red', color: '#5a1a1a' },
  { id: 8, name: 'River', color: '#1a5a7a' },
  { id: 9, name: 'Jungle Path', color: '#3a3020' },
] as const;

export const DECORATION_CATEGORIES = [
  'Trees', 'Rocks & Mountains', 'Volcano', 'Nature', 'Buildings', 'Effects', 'Misc'
] as const;

export const DECORATION_TYPES = [
  // Trees
  { id: 'tree', name: 'Common Tree', icon: '🌲', color: '#2a5c1a', category: 'Trees' },
  { id: 'pine_tree', name: 'Pine Tree', icon: '🌲', color: '#1a4a12', category: 'Trees' },
  { id: 'birch_tree', name: 'Birch Tree', icon: '🌳', color: '#7aaa5a', category: 'Trees' },
  { id: 'dead_tree', name: 'Dead Tree', icon: '🌳', color: '#5a4a3a', category: 'Trees' },
  { id: 'tree_large', name: 'Large Tree', icon: '🌲', color: '#1a5a0a', category: 'Trees' },
  { id: 'tree_lava', name: 'Lava Tree', icon: '🔥', color: '#ff4400', category: 'Trees' },
  { id: 'tree_house', name: 'Tree House', icon: '🏡', color: '#4a7a2a', category: 'Trees' },
  { id: 'tree_twisted', name: 'Twisted Tree', icon: '🌳', color: '#3a3a20', category: 'Trees' },
  // Rocks & Mountains
  { id: 'rock', name: 'Rock', icon: '🪨', color: '#5a5a6a', category: 'Rocks & Mountains' },
  { id: 'rock_large', name: 'Large Rock', icon: '🪨', color: '#4a4a5a', category: 'Rocks & Mountains' },
  { id: 'mountain_rock_0', name: 'Mountain Rock 1', icon: '⛰️', color: '#7a6040', category: 'Rocks & Mountains' },
  { id: 'mountain_rock_1', name: 'Mountain Rock 2', icon: '⛰️', color: '#8a7050', category: 'Rocks & Mountains' },
  { id: 'mountain_rock_2', name: 'Mountain Rock 3', icon: '⛰️', color: '#6a5030', category: 'Rocks & Mountains' },
  { id: 'mountain_rock_3', name: 'Mountain Rock 4', icon: '⛰️', color: '#9a8060', category: 'Rocks & Mountains' },
  { id: 'mountain_rock_4', name: 'Mountain Rock 5', icon: '⛰️', color: '#5a4020', category: 'Rocks & Mountains' },
  { id: 'pebble', name: 'Pebble', icon: '⚫', color: '#6a6a7a', category: 'Rocks & Mountains' },
  // Volcano
  { id: 'volcano_1', name: 'Volcano 1', icon: '🌋', color: '#8a2a0a', category: 'Volcano' },
  { id: 'volcano_2', name: 'Volcano 2', icon: '🌋', color: '#7a2808', category: 'Volcano' },
  { id: 'volcano_3', name: 'Volcano 3', icon: '🌋', color: '#9a3010', category: 'Volcano' },
  { id: 'boulder_1', name: 'Volcano Boulder 1', icon: '🪨', color: '#5a3020', category: 'Volcano' },
  { id: 'boulder_2', name: 'Volcano Boulder 2', icon: '🪨', color: '#6a4030', category: 'Volcano' },
  { id: 'boulder_3', name: 'Volcano Boulder 3', icon: '🪨', color: '#4a2818', category: 'Volcano' },
  { id: 'lava_pool', name: 'Lava Pool', icon: '🔥', color: '#ff4400', category: 'Volcano' },
  // Nature
  { id: 'bush', name: 'Bush', icon: '🌿', color: '#3a7a2a', category: 'Nature' },
  { id: 'bush_flowers', name: 'Flower Bush', icon: '💐', color: '#5a8a3a', category: 'Nature' },
  { id: 'fern', name: 'Fern', icon: '🌿', color: '#2a6a1a', category: 'Nature' },
  { id: 'mushroom', name: 'Mushroom', icon: '🍄', color: '#aa4444', category: 'Nature' },
  { id: 'flower', name: 'Flower', icon: '🌸', color: '#ee66aa', category: 'Nature' },
  { id: 'grass_tall', name: 'Tall Grass', icon: '🌾', color: '#4a8a2a', category: 'Nature' },
  { id: 'grass_short', name: 'Short Grass', icon: '🌾', color: '#3a7a1a', category: 'Nature' },
  { id: 'clover', name: 'Clover', icon: '☘️', color: '#2a8a2a', category: 'Nature' },
  { id: 'plant', name: 'Plant', icon: '🌱', color: '#3a9a3a', category: 'Nature' },
  // Buildings
  { id: 'coliseum', name: 'Coliseum', icon: '🏛️', color: '#8a8a6a', category: 'Buildings' },
  { id: 'barracks', name: 'Barracks', icon: '🏠', color: '#6a5530', category: 'Buildings' },
  { id: 'forge', name: 'Forge', icon: '⚒️', color: '#aa5500', category: 'Buildings' },
  { id: 'crypt', name: 'Crypt', icon: '⚰️', color: '#3a2a3a', category: 'Buildings' },
  { id: 'arch', name: 'Arch', icon: '🏗️', color: '#8a8a8a', category: 'Buildings' },
  { id: 'cabin_shed', name: 'Cabin', icon: '🛖', color: '#7a5a3a', category: 'Buildings' },
  { id: 'tower_deco', name: 'Tower', icon: '🗼', color: '#888888', category: 'Buildings' },
  // Effects
  { id: 'camp_fire_glb', name: 'Camp Fire', icon: '🔥', color: '#ff8800', category: 'Effects' },
  { id: 'campfire', name: 'Fountain Fire', icon: '🏕️', color: '#ffaa00', category: 'Effects' },
  { id: 'magic_trap_spikes', name: 'Spike Trap', icon: '⚡', color: '#aa44aa', category: 'Effects' },
  { id: 'magic_trap_rune', name: 'Rune Trap', icon: '✨', color: '#6644cc', category: 'Effects' },
  // Misc
  { id: 'gravestone', name: 'Gravestone', icon: '🪦', color: '#555555', category: 'Misc' },
  { id: 'tank', name: 'Tank', icon: '🛡️', color: '#556b2f', category: 'Misc' },
] as const;

export const CAMP_TYPES = [
  { id: 'small' as const, name: 'Small Camp', color: '#65a30d', mobCount: 3 },
  { id: 'medium' as const, name: 'Medium Camp', color: '#3b82f6', mobCount: 2 },
  { id: 'buff' as const, name: 'Buff Camp', color: '#a855f7', mobCount: 1 },
  { id: 'boss' as const, name: 'Boss Pit', color: '#ef4444', mobCount: 1 },
] as const;

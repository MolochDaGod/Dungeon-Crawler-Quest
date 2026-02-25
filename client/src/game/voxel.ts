type VoxelModel = (string | null)[][][];

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function blend(hex1: string, hex2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function seededRandom(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

const RACE_SKIN: Record<string, string> = {
  Human: '#c4956a',
  Barbarian: '#a57850',
  Dwarf: '#d4a574',
  Elf: '#e8d5b8',
  Orc: '#5a8a3a',
  Undead: '#7a8a7a'
};

const CLASS_ARMOR: Record<string, { primary: string; secondary: string; weapon: string }> = {
  Warrior: { primary: '#8b8b8b', secondary: '#c0c0c0', weapon: '#d4d4d4' },
  Worg: { primary: '#6b4423', secondary: '#8b6914', weapon: '#a0522d' },
  Mage: { primary: '#4a3080', secondary: '#6b46c1', weapon: '#9333ea' },
  Ranger: { primary: '#2d5016', secondary: '#4a7c23', weapon: '#854d0e' }
};

export type TerrainType = 'grass' | 'dirt' | 'stone' | 'water' | 'lane' | 'jungle' | 'base_blue' | 'base_red' | 'river';
export type DungeonTileVoxelType = 'floor' | 'wall' | 'wall_top' | 'door' | 'trap' | 'stairs' | 'chest';

const TERRAIN_PALETTES: Record<TerrainType, { base: string[]; accent: string[]; height: number }> = {
  grass:     { base: ['#2a5c1a', '#357025', '#2e6320', '#3a7a2d'], accent: ['#4a8a3a', '#286018'], height: 1 },
  dirt:      { base: ['#6b4423', '#7a5030', '#5e3b1a', '#8a6040'], accent: ['#4a3010', '#9a7050'], height: 1 },
  stone:     { base: ['#5a5a6a', '#666678', '#4e4e5e', '#72728a'], accent: ['#3a3a4a', '#8a8a9a'], height: 1 },
  water:     { base: ['#1a4a8a', '#2060a0', '#153d7a', '#2570b0'], accent: ['#3080c0', '#1040a0'], height: 0 },
  lane:      { base: ['#4a4030', '#564a38', '#3e3628', '#605040'], accent: ['#706050', '#2e2820'], height: 1 },
  jungle:    { base: ['#1a3a12', '#1e4216', '#163210', '#224a1a'], accent: ['#0e2808', '#2a5220'], height: 1 },
  base_blue: { base: ['#1a2a5a', '#203470', '#162450', '#283e80'], accent: ['#3050a0', '#101a40'], height: 2 },
  base_red:  { base: ['#5a1a1a', '#702020', '#501616', '#802828'], accent: ['#a03030', '#401010'], height: 2 },
  river:     { base: ['#1a5a7a', '#206a8a', '#154a6a', '#207a9a'], accent: ['#3090b0', '#104060'], height: 0 },
};

const DUNGEON_PALETTES: Record<DungeonTileVoxelType, { base: string[]; accent: string[] }> = {
  floor:    { base: ['#3a3a2e', '#353528', '#2e2e22', '#404032'], accent: ['#4a4a3a', '#2a2a1e'] },
  wall:     { base: ['#2a2a3e', '#252540', '#202038', '#303048'], accent: ['#1a1a2e', '#3a3a50'] },
  wall_top: { base: ['#353550', '#303048', '#3a3a58', '#282840'], accent: ['#404060', '#202038'] },
  door:     { base: ['#6b4423', '#7a5030', '#5e3b1a', '#8a6040'], accent: ['#c5a059', '#4a3010'] },
  trap:     { base: ['#4a2020', '#552828', '#3e1818', '#603030'], accent: ['#802020', '#f59e0b'] },
  stairs:   { base: ['#2a4a2a', '#305530', '#224022', '#386038'], accent: ['#ffd700', '#1a3a1a'] },
  chest:    { base: ['#a16207', '#8a5506', '#7a4a05', '#b87008'], accent: ['#ffd700', '#6b4006'] },
};

function buildHeroModel(race: string, heroClass: string, animState: string, animTimer: number): VoxelModel {
  const skin = RACE_SKIN[race] || '#c4956a';
  const armor = CLASS_ARMOR[heroClass] || CLASS_ARMOR.Warrior;
  const hair = race === 'Elf' ? '#e8d090' : race === 'Orc' ? '#2a2a2a' : race === 'Undead' ? '#444444' : race === 'Dwarf' ? '#a0522d' : '#3a2a1a';
  const eye = race === 'Undead' ? '#ff4444' : race === 'Orc' ? '#ffaa00' : '#2244aa';

  const model: VoxelModel = [];
  for (let z = 0; z < 12; z++) {
    model[z] = [];
    for (let y = 0; y < 6; y++) {
      model[z][y] = [];
      for (let x = 0; x < 6; x++) {
        model[z][y][x] = null;
      }
    }
  }

  const atkSwing = animState === 'attack' ? Math.sin(animTimer * 12) : 0;
  const abPulse = animState === 'ability' ? Math.sin(animTimer * 6) * 0.5 + 0.5 : 0;

  const setV = (z: number, y: number, x: number, c: string) => {
    if (z >= 0 && z < 12 && y >= 0 && y < 6 && x >= 0 && x < 6) {
      model[z][y][x] = abPulse > 0 ? blend(c, '#ffd700', abPulse * 0.3) : c;
    }
  };

  for (let x = 1; x <= 4; x++) {
    for (let y = 1; y <= 4; y++) {
      setV(0, y, x, armor.primary);
      setV(1, y, x, armor.primary);
    }
  }

  const legOffset = animState === 'walk' ? Math.round(Math.sin(animTimer * 8)) : 0;
  setV(0, 2, 1 + (legOffset > 0 ? 1 : 0), skin);
  setV(0, 2, 4 - (legOffset > 0 ? 1 : 0), skin);
  setV(1, 2, 1, armor.secondary);
  setV(1, 2, 4, armor.secondary);

  for (let x = 1; x <= 4; x++) {
    for (let y = 1; y <= 4; y++) {
      setV(2, y, x, armor.primary);
      setV(3, y, x, armor.primary);
      setV(4, y, x, armor.secondary);
    }
  }

  if (heroClass === 'Warrior') {
    setV(3, 1, 0, armor.secondary);
    setV(4, 1, 0, armor.secondary);
  }

  for (let x = 1; x <= 4; x++) {
    for (let y = 1; y <= 4; y++) {
      setV(5, y, x, armor.primary);
    }
  }

  const armLZ = animState === 'attack' ? 4 + Math.round(atkSwing) : 3;
  const armRZ = 3;
  setV(armLZ, 1, 0, skin);
  setV(armRZ, 4, 5, skin);
  setV(4, 1, 0, armor.secondary);
  setV(4, 4, 5, armor.secondary);

  for (let x = 1; x <= 4; x++) {
    for (let y = 1; y <= 4; y++) {
      setV(6, y, x, skin);
      setV(7, y, x, skin);
    }
  }
  setV(7, 2, 1, eye);
  setV(7, 2, 4, eye);
  setV(6, 3, 1, skin);
  setV(6, 3, 4, skin);

  for (let x = 1; x <= 4; x++) {
    for (let y = 1; y <= 2; y++) {
      setV(8, y, x, hair);
    }
    setV(8, 3, x, hair);
    setV(8, 4, x, hair);
  }

  if (heroClass === 'Warrior') {
    for (let x = 1; x <= 4; x++) setV(9, 2, x, '#888888');
    setV(9, 1, 2, '#888888');
    setV(9, 1, 3, '#888888');
  }

  if (heroClass === 'Mage') {
    setV(9, 2, 2, armor.secondary);
    setV(9, 2, 3, armor.secondary);
    setV(10, 2, 2, armor.weapon);
    setV(10, 2, 3, armor.weapon);
  }

  if (race === 'Dwarf') {
    setV(5, 2, 1, hair); setV(5, 2, 4, hair);
    setV(5, 3, 2, hair); setV(5, 3, 3, hair);
  }
  if (race === 'Elf') { setV(7, 1, 1, skin); setV(7, 1, 4, skin); }
  if (race === 'Orc') {
    setV(6, 3, 0, skin); setV(6, 3, 5, skin);
    setV(6, 2, 2, '#445522'); setV(6, 2, 3, '#445522');
  }
  if (race === 'Undead') {
    if (Math.random() > 0.7) setV(6, 2, 1, '#333333');
    setV(7, 3, 2, '#555555'); setV(7, 3, 3, '#555555');
  }

  if (heroClass === 'Ranger') {
    const weapZ = animState === 'attack' ? 5 + Math.round(atkSwing) : 5;
    setV(weapZ, 0, 0, armor.weapon); setV(weapZ + 1, 0, 0, armor.weapon); setV(weapZ + 2, 0, 0, armor.weapon);
    setV(3, 1, 0, '#666666');
  }
  if (heroClass === 'Warrior') {
    const swordZ = animState === 'attack' ? 3 + Math.round(atkSwing * 2) : 3;
    setV(swordZ, 0, 0, armor.weapon); setV(swordZ + 1, 0, 0, armor.weapon); setV(swordZ + 2, 0, 0, shade(armor.weapon, 0.8));
    setV(4, 5, 5, '#aaaaaa'); setV(5, 5, 5, '#aaaaaa');
  }
  if (heroClass === 'Worg') {
    setV(2, 0, 0, armor.weapon); setV(3, 0, 0, armor.weapon); setV(4, 0, 0, shade(armor.weapon, 0.7));
  }
  if (heroClass === 'Mage') {
    for (let z = 2; z < 10; z++) setV(z, 0, 0, '#553300');
    setV(10, 0, 0, armor.weapon); setV(11, 0, 0, shade(armor.weapon, 1.3));
  }

  return model;
}

function buildMinionModel(color: string, minionType: string, animTimer: number): VoxelModel {
  const model: VoxelModel = [];
  const h = minionType === 'siege' ? 6 : 4;
  const w = minionType === 'siege' ? 5 : 3;

  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) {
        model[z][y][x] = null;
      }
    }
  }

  const dark = shade(color, 0.6);
  const light = shade(color, 1.2);
  const bob = Math.sin(animTimer * 6);

  if (minionType === 'siege') {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < w; y++) {
        model[0][y][x] = dark;
        model[1][y][x] = color;
        model[2][y][x] = color;
        model[3][y][x] = color;
      }
    }
    model[4][1][1] = light;
    model[4][2][2] = light;
    model[5][1][1] = shade(light, 1.2);
  } else {
    const center = Math.floor(w / 2);
    model[0][center][0] = dark;
    model[0][center][w - 1] = dark;
    model[1][center][center] = color;
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < w; y++) {
        if (Math.abs(x - center) + Math.abs(y - center) <= 1) model[2][y][x] = color;
      }
    }
    model[3][center][center] = light;
    if (bob > 0) {
      model[0][center][0] = null;
      model[0][center - 1 >= 0 ? center - 1 : 0][0] = dark;
    }
  }

  return model;
}

function buildTreeModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 8 + (seed % 3);
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < 5; y++) {
      model[z][y] = [];
      for (let x = 0; x < 5; x++) model[z][y][x] = null;
    }
  }
  const trunkH = 3 + (seed % 2);
  for (let z = 0; z < trunkH; z++) {
    model[z][2][2] = shade('#553322', 0.8 + (seed % 3) * 0.1);
    if (z > 0 && seed % 3 === 0) model[z][2][3] = shade('#4a2d1a', 0.9);
  }
  const leafColors = ['#1a5a1a', '#2a6a2a', '#1e5e1e', '#2e7a2e', '#186818'];
  for (let z = trunkH; z < h; z++) {
    const r = z < h - 2 ? 2 : (z < h - 1 ? 1 : 0);
    for (let y = 2 - r; y <= 2 + r; y++) {
      for (let x = 2 - r; x <= 2 + r; x++) {
        if (y >= 0 && y < 5 && x >= 0 && x < 5) {
          const leafSeed = (seed + x * 7 + y * 13 + z * 23) % leafColors.length;
          model[z][y][x] = leafColors[leafSeed];
        }
      }
    }
  }
  return model;
}

function buildRockModel(seed: number): VoxelModel {
  const model: VoxelModel = [];
  const sz = 2 + (seed % 2);
  for (let z = 0; z < sz + 1; z++) {
    model[z] = [];
    for (let y = 0; y < 3; y++) {
      model[z][y] = [];
      for (let x = 0; x < 3; x++) model[z][y][x] = null;
    }
  }
  const rockColors = ['#5a5a6a', '#4e4e5e', '#666678', '#585868'];
  for (let z = 0; z < sz; z++) {
    const r = z === 0 ? 1 : 0;
    for (let y = 1 - r; y <= 1 + r; y++) {
      for (let x = 1 - r; x <= 1 + r; x++) {
        if (y >= 0 && y < 3 && x >= 0 && x < 3) {
          model[z][y][x] = rockColors[(seed + x + y + z) % rockColors.length];
        }
      }
    }
  }
  return model;
}

function buildTowerModel(teamColor: string, tier: number): VoxelModel {
  const model: VoxelModel = [];
  const h = 10 + tier * 2;
  const w = 5;
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) model[z][y][x] = null;
    }
  }
  const stoneBase = '#3a3a4a';
  const stoneDark = '#2a2a3e';
  for (let z = 0; z < h - 3; z++) {
    const r = z < 2 ? 2 : (z < h - 5 ? 1 : 1);
    for (let y = 2 - r; y <= 2 + r; y++) {
      for (let x = 2 - r; x <= 2 + r; x++) {
        if (y >= 0 && y < w && x >= 0 && x < w) {
          model[z][y][x] = (x + y + z) % 3 === 0 ? stoneDark : stoneBase;
        }
      }
    }
  }
  for (let i = h - 3; i < h; i++) {
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        if ((y === 0 || y === w - 1 || x === 0 || x === w - 1) && (y + x) % 2 === 0) {
          model[i][y][x] = teamColor;
        }
      }
    }
  }
  model[h - 1][2][2] = shade(teamColor, 1.4);
  return model;
}

function buildNexusModel(teamColor: string): VoxelModel {
  const model: VoxelModel = [];
  const h = 8;
  const w = 7;
  for (let z = 0; z < h; z++) {
    model[z] = [];
    for (let y = 0; y < w; y++) {
      model[z][y] = [];
      for (let x = 0; x < w; x++) model[z][y][x] = null;
    }
  }
  for (let z = 0; z < 3; z++) {
    for (let y = 1; y < w - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const d = Math.abs(x - 3) + Math.abs(y - 3);
        if (d <= 2 + z) {
          model[z][y][x] = z === 0 ? '#1a1a2e' : shade(teamColor, 0.5 + z * 0.15);
        }
      }
    }
  }
  for (let z = 3; z < 6; z++) {
    for (let y = 2; y < w - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        if ((y === 2 || y === w - 3 || x === 2 || x === w - 3)) {
          model[z][y][x] = teamColor;
        }
      }
    }
  }
  model[5][3][3] = shade(teamColor, 1.5);
  model[6][3][3] = shade(teamColor, 1.3);
  model[7][3][3] = '#ffd700';
  return model;
}

export class VoxelRenderer {
  private spriteCache = new Map<string, ImageBitmap>();
  private tileCache = new Map<string, HTMLCanvasElement>();
  private cubeSize = 4;

  drawHeroVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    raceColor: string, classColor: string,
    heroClass: string, facing: number,
    animState: string, animTimer: number,
    race: string
  ) {
    const model = buildHeroModel(race, heroClass, animState, animTimer);
    this.renderVoxelModel(ctx, x, y - 16, model, this.cubeSize, facing);
  }

  drawMinionVoxel(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    color: string, _size: number,
    _facing: number, animTimer: number,
    minionType: string
  ) {
    const model = buildMinionModel(color, minionType, animTimer);
    this.renderVoxelModel(ctx, x, y - 6, model, 3, 0);
  }

  drawTowerVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string, tier: number) {
    const model = buildTowerModel(teamColor, tier);
    this.renderVoxelModel(ctx, x, y - 40, model, 3, 0);
  }

  drawNexusVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, teamColor: string) {
    const model = buildNexusModel(teamColor);
    this.renderVoxelModel(ctx, x, y - 20, model, 4, 0);
  }

  drawTreeVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const cacheKey = `tree_${seed % 6}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 60;
      offscreen.height = 80;
      const oc = offscreen.getContext('2d')!;
      const model = buildTreeModel(seed % 6);
      this.renderVoxelModel(oc, 30, 60, model, 3, 0);
      return offscreen;
    });
    ctx.drawImage(cached, x - 30, y - 60);
  }

  drawRockVoxel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
    const cacheKey = `rock_${seed % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = 30;
      offscreen.height = 30;
      const oc = offscreen.getContext('2d')!;
      const model = buildRockModel(seed % 4);
      this.renderVoxelModel(oc, 15, 20, model, 2, 0);
      return offscreen;
    });
    ctx.drawImage(cached, x - 15, y - 20);
  }

  drawTerrainTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, terrain: TerrainType, tileX: number, tileY: number) {
    const cacheKey = `terrain_${terrain}_${tileX % 4}_${tileY % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = tileSize;
      offscreen.height = tileSize;
      const oc = offscreen.getContext('2d')!;
      this.renderTerrainOnCanvas(oc, tileSize, terrain, tileX, tileY);
      return offscreen;
    });
    ctx.drawImage(cached, x, y);
  }

  drawDungeonTile(ctx: CanvasRenderingContext2D, x: number, y: number, tileSize: number, tileType: DungeonTileVoxelType, tileX: number, tileY: number) {
    const cacheKey = `dng_${tileType}_${tileX % 4}_${tileY % 4}`;
    const cached = this.getCachedTile(cacheKey, () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = tileSize;
      offscreen.height = tileSize + (tileType === 'wall' ? 16 : 0);
      const oc = offscreen.getContext('2d')!;
      this.renderDungeonTileOnCanvas(oc, tileSize, tileType, tileX, tileY);
      return offscreen;
    });
    const yOff = tileType === 'wall' ? -16 : 0;
    ctx.drawImage(cached, x, y + yOff);
  }

  private getCachedTile(key: string, builder: () => HTMLCanvasElement): HTMLCanvasElement {
    let cached = this.tileCache.get(key);
    if (!cached) {
      cached = builder();
      this.tileCache.set(key, cached);
      if (this.tileCache.size > 500) {
        const firstKey = this.tileCache.keys().next().value;
        if (firstKey) this.tileCache.delete(firstKey);
      }
    }
    return cached;
  }

  private renderTerrainOnCanvas(ctx: CanvasRenderingContext2D, tileSize: number, terrain: TerrainType, tx: number, ty: number) {
    const palette = TERRAIN_PALETTES[terrain];
    const voxelSize = tileSize / 8;
    const gridSize = 8;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const seed = seededRandom(tx * gridSize + gx, ty * gridSize + gy);
        const colorIdx = Math.floor(seed * palette.base.length);
        let color = palette.base[colorIdx];

        if (seed > 0.85) {
          const accentIdx = Math.floor((seed * 37) % palette.accent.length);
          color = palette.accent[accentIdx];
        }

        const px = gx * voxelSize;
        const py = gy * voxelSize;

        if (terrain === 'water' || terrain === 'river') {
          const wave = Math.sin((gx + gy) * 0.8 + (tx + ty) * 2.1) * 0.1;
          color = shade(color, 0.9 + wave);
        }

        ctx.fillStyle = color;
        ctx.fillRect(px, py, voxelSize + 0.5, voxelSize + 0.5);

        if (palette.height > 0 && seed > 0.7) {
          const highlights = shade(color, 1.15);
          ctx.fillStyle = highlights;
          ctx.fillRect(px, py, voxelSize * 0.5, voxelSize * 0.5);
        }
      }
    }

    if (terrain === 'grass' || terrain === 'jungle') {
      const grassCount = terrain === 'jungle' ? 5 : 3;
      for (let i = 0; i < grassCount; i++) {
        const gx = seededRandom(tx * 100 + i, ty * 100) * tileSize;
        const gy = seededRandom(tx * 100, ty * 100 + i) * tileSize;
        const grassColor = terrain === 'jungle' ? '#1a4a12' : '#3a8a2a';
        ctx.fillStyle = shade(grassColor, 0.8 + seededRandom(tx + i, ty) * 0.4);
        ctx.fillRect(gx, gy, 1.5, 4);
        ctx.fillRect(gx + 1, gy + 1, 1.5, 3);
      }
    }

    if (terrain === 'lane') {
      ctx.strokeStyle = 'rgba(100,90,70,0.15)';
      ctx.lineWidth = 0.5;
      if ((tx + ty) % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(0, tileSize * 0.3);
        ctx.lineTo(tileSize, tileSize * 0.3);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, tileSize, tileSize);
  }

  private renderDungeonTileOnCanvas(ctx: CanvasRenderingContext2D, tileSize: number, tileType: DungeonTileVoxelType, tx: number, ty: number) {
    const palette = DUNGEON_PALETTES[tileType];
    const voxelSize = tileSize / 6;
    const gridSize = 6;

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const seed = seededRandom(tx * gridSize + gx, ty * gridSize + gy);
        const colorIdx = Math.floor(seed * palette.base.length);
        let color = palette.base[colorIdx];

        if (seed > 0.8) {
          color = palette.accent[Math.floor((seed * 17) % palette.accent.length)];
        }

        const px = gx * voxelSize;
        const py = (tileType === 'wall' ? 16 : 0) + gy * voxelSize;

        ctx.fillStyle = color;
        ctx.fillRect(px, py, voxelSize + 0.5, voxelSize + 0.5);

        if (seed > 0.6) {
          ctx.fillStyle = shade(color, 1.1);
          ctx.fillRect(px, py, voxelSize * 0.4, voxelSize * 0.4);
        }
      }
    }

    if (tileType === 'wall') {
      const wallPalette = DUNGEON_PALETTES.wall_top;
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
          const seed = seededRandom(tx * gridSize + gx + 100, ty * gridSize + gy + 100);
          const color = wallPalette.base[Math.floor(seed * wallPalette.base.length)];
          ctx.fillStyle = color;
          const px = gx * voxelSize;
          const py = gy * (16 / 3);
          ctx.fillRect(px, py, voxelSize + 0.5, 16 / 3 + 0.5);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(0, 12, tileSize, 4);
    }

    if (tileType === 'trap') {
      ctx.strokeStyle = '#f59e0b44';
      ctx.lineWidth = 1;
      const inset = tileSize * 0.2;
      const yOff = 0;
      ctx.strokeRect(inset, yOff + inset, tileSize - inset * 2, tileSize - inset * 2);
      ctx.beginPath();
      ctx.moveTo(tileSize * 0.3, yOff + tileSize * 0.3);
      ctx.lineTo(tileSize * 0.7, yOff + tileSize * 0.7);
      ctx.moveTo(tileSize * 0.7, yOff + tileSize * 0.3);
      ctx.lineTo(tileSize * 0.3, yOff + tileSize * 0.7);
      ctx.stroke();
    }

    if (tileType === 'stairs') {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼', tileSize / 2, tileSize / 2 + 5);
    }

    if (tileType === 'door') {
      ctx.strokeStyle = '#c5a05988';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tileSize / 2, tileSize / 2, tileSize * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  renderVoxelModel(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    model: VoxelModel,
    cubeSize: number,
    _facing: number
  ) {
    const cs = cubeSize;
    const isoX = cs;
    const isoY = cs * 0.5;

    for (let z = 0; z < model.length; z++) {
      const layer = model[z];
      if (!layer) continue;
      for (let y = layer.length - 1; y >= 0; y--) {
        const row = layer[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x++) {
          const color = row[x];
          if (!color) continue;
          const screenX = cx + (x - y) * isoX;
          const screenY = cy + (x + y) * isoY - z * cs;
          this.drawIsoCube(ctx, screenX, screenY, cs, color);
        }
      }
    }
  }

  drawIsoCube(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const s = size;
    const hs = s * 0.5;

    ctx.fillStyle = shade(color, 1.2);
    ctx.beginPath();
    ctx.moveTo(x, y - hs);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(color, 0.7);
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x - s, y + s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(color, 0.85);
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x + s, y + s);
    ctx.closePath();
    ctx.fill();
  }
}

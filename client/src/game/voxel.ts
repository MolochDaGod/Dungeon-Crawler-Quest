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

  const walkBob = animState === 'walk' ? Math.sin(animTimer * 8) * 0.5 : 0;
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
    for (let x = 1; x <= 4; x++) {
      setV(9, 2, x, '#888888');
    }
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
    setV(5, 2, 1, hair);
    setV(5, 2, 4, hair);
    setV(5, 3, 2, hair);
    setV(5, 3, 3, hair);
  }

  if (race === 'Elf') {
    setV(7, 1, 1, skin);
    setV(7, 1, 4, skin);
  }

  if (race === 'Orc') {
    setV(6, 3, 0, skin);
    setV(6, 3, 5, skin);
    setV(6, 2, 2, '#445522');
    setV(6, 2, 3, '#445522');
  }

  if (race === 'Undead') {
    if (Math.random() > 0.7) {
      setV(6, 2, 1, '#333333');
    }
    setV(7, 3, 2, '#555555');
    setV(7, 3, 3, '#555555');
  }

  if (heroClass === 'Ranger') {
    const weapZ = animState === 'attack' ? 5 + Math.round(atkSwing) : 5;
    setV(weapZ, 0, 0, armor.weapon);
    setV(weapZ + 1, 0, 0, armor.weapon);
    setV(weapZ + 2, 0, 0, armor.weapon);
    setV(3, 1, 0, '#666666');
  }

  if (heroClass === 'Warrior') {
    const swordZ = animState === 'attack' ? 3 + Math.round(atkSwing * 2) : 3;
    setV(swordZ, 0, 0, armor.weapon);
    setV(swordZ + 1, 0, 0, armor.weapon);
    setV(swordZ + 2, 0, 0, shade(armor.weapon, 0.8));
    setV(4, 5, 5, '#aaaaaa');
    setV(5, 5, 5, '#aaaaaa');
  }

  if (heroClass === 'Worg') {
    setV(2, 0, 0, armor.weapon);
    setV(3, 0, 0, armor.weapon);
    setV(4, 0, 0, shade(armor.weapon, 0.7));
  }

  if (heroClass === 'Mage') {
    const staffZ = 2;
    for (let z = staffZ; z < 10; z++) {
      setV(z, 0, 0, '#553300');
    }
    setV(10, 0, 0, armor.weapon);
    setV(11, 0, 0, shade(armor.weapon, 1.3));
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
        if (Math.abs(x - center) + Math.abs(y - center) <= 1) {
          model[2][y][x] = color;
        }
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

export class VoxelRenderer {
  private spriteCache = new Map<string, ImageBitmap>();
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

  private renderVoxelModel(
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

  private drawIsoCube(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    const s = size;
    const hs = s * 0.5;

    const topColor = shade(color, 1.2);
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(x, y - hs);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fill();

    const leftColor = shade(color, 0.7);
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x - s, y + s);
    ctx.closePath();
    ctx.fill();

    const rightColor = shade(color, 0.85);
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(x + s, y);
    ctx.lineTo(x, y + hs);
    ctx.lineTo(x, y + hs + s);
    ctx.lineTo(x + s, y + s);
    ctx.closePath();
    ctx.fill();
  }
}

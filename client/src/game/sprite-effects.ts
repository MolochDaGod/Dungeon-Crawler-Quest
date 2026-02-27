export type SpriteEffectType =
  | 'mage_ability'
  | 'mage_attack'
  | 'frost'
  | 'channel'
  | 'magic_impact'
  | 'fire_ability'
  | 'warrior_spin'
  | 'shield'
  | 'buff'
  | 'melee_impact'
  | 'fire_attack'
  | 'ultimate'
  | 'dash'
  | 'undead'
  | 'charging'
  | 'holy'
  | 'dark_magic'
  | 'shadow'
  | 'ice'
  | 'healing';

interface SpritesheetInfo {
  image: HTMLImageElement;
  frameSize: number;
  cols: number;
  rows: number;
  totalFrames: number;
  loaded: boolean;
}

interface ActiveEffect {
  type: SpriteEffectType;
  x: number;
  y: number;
  scale: number;
  duration: number;
  elapsed: number;
  currentFrame: number;
}

const EFFECT_FILE_MAP: Record<SpriteEffectType, string> = {
  mage_ability: '1_magicspell_spritesheet.png',
  mage_attack: '2_magic8_spritesheet.png',
  frost: '3_bluefire_spritesheet.png',
  channel: '4_casting_spritesheet.png',
  magic_impact: '5_magickahit_spritesheet.png',
  fire_ability: '6_flamelash_spritesheet.png',
  warrior_spin: '7_firespin_spritesheet.png',
  shield: '8_protectioncircle_spritesheet.png',
  buff: '9_brightfire_spritesheet.png',
  melee_impact: '10_weaponhit_spritesheet.png',
  fire_attack: '11_fire_spritesheet.png',
  ultimate: '12_nebula_spritesheet.png',
  dash: '13_vortex_spritesheet.png',
  undead: '14_phantom_spritesheet.png',
  charging: '15_loading_spritesheet.png',
  holy: '16_sunburn_spritesheet.png',
  dark_magic: '17_felspell_spritesheet.png',
  shadow: '18_midnight_spritesheet.png',
  ice: '19_freezing_spritesheet.png',
  healing: '20_magicbubbles_spritesheet.png',
};

const FRAME_SIZE = 100;

export class SpriteEffectSystem {
  private spritesheets: Map<SpriteEffectType, SpritesheetInfo> = new Map();
  private activeEffects: ActiveEffect[] = [];
  private loaded = false;

  constructor() {
    this.preload();
  }

  private preload(): void {
    const entries = Object.entries(EFFECT_FILE_MAP) as [SpriteEffectType, string][];
    let remaining = entries.length;

    for (const [type, filename] of entries) {
      const img = new Image();
      img.src = `/assets/effects/pixel/${filename}`;

      const info: SpritesheetInfo = {
        image: img,
        frameSize: FRAME_SIZE,
        cols: 1,
        rows: 1,
        totalFrames: 1,
        loaded: false,
      };

      img.onload = () => {
        info.cols = Math.max(1, Math.floor(img.width / FRAME_SIZE));
        info.rows = Math.max(1, Math.floor(img.height / FRAME_SIZE));
        info.totalFrames = Math.max(1, info.cols * info.rows);
        info.loaded = true;
        remaining--;
        if (remaining <= 0) {
          this.loaded = true;
        }
      };

      img.onerror = () => {
        remaining--;
        if (remaining <= 0) {
          this.loaded = true;
        }
      };

      this.spritesheets.set(type, info);
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  playEffect(type: SpriteEffectType, x: number, y: number, scale = 1, durationMs = 600): void {
    this.activeEffects.push({
      type,
      x,
      y,
      scale,
      duration: durationMs / 1000,
      elapsed: 0,
      currentFrame: 0,
    });
  }

  update(dt: number): void {
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const effect = this.activeEffects[i];
      effect.elapsed += dt;

      if (effect.elapsed >= effect.duration) {
        this.activeEffects.splice(i, 1);
        continue;
      }

      const sheet = this.spritesheets.get(effect.type);
      if (!sheet || !sheet.loaded) continue;

      const progress = effect.elapsed / effect.duration;
      effect.currentFrame = Math.min(
        Math.floor(progress * sheet.totalFrames),
        sheet.totalFrames - 1
      );
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const effect of this.activeEffects) {
      const sheet = this.spritesheets.get(effect.type);
      if (!sheet || !sheet.loaded) continue;

      const col = effect.currentFrame % sheet.cols;
      const row = Math.floor(effect.currentFrame / sheet.cols);

      const sx = col * sheet.frameSize;
      const sy = row * sheet.frameSize;

      const drawSize = sheet.frameSize * effect.scale;
      const dx = effect.x - drawSize / 2;
      const dy = effect.y - drawSize / 2;

      ctx.drawImage(
        sheet.image,
        sx,
        sy,
        sheet.frameSize,
        sheet.frameSize,
        dx,
        dy,
        drawSize,
        drawSize
      );
    }
  }

  getActiveCount(): number {
    return this.activeEffects.length;
  }

  clearAll(): void {
    this.activeEffects.length = 0;
  }
}

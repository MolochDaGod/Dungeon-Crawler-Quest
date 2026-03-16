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
  | 'healing'
  // New magic-sprites pack effects
  | 'lightning'
  | 'lightning_bolt'
  | 'midas_touch'
  | 'sun_strike'
  | 'explosion'
  | 'spikes'
  | 'fire_wall'
  | 'shield_spell'
  | 'black_hole'
  | 'fire_ball';

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

const EFFECT_FILE_MAP: Record<SpriteEffectType, { path: string; basePath?: string }> = {
  mage_ability: { path: '/assets/effects/pixel/1_magicspell_spritesheet.png' },
  mage_attack: { path: '/assets/effects/pixel/2_magic8_spritesheet.png' },
  frost: { path: '/assets/effects/pixel/3_bluefire_spritesheet.png' },
  channel: { path: '/assets/effects/pixel/4_casting_spritesheet.png' },
  magic_impact: { path: '/assets/effects/pixel/5_magickahit_spritesheet.png' },
  fire_ability: { path: '/assets/effects/pixel/6_flamelash_spritesheet.png' },
  warrior_spin: { path: '/assets/effects/pixel/7_firespin_spritesheet.png' },
  shield: { path: '/assets/effects/pixel/8_protectioncircle_spritesheet.png' },
  buff: { path: '/assets/effects/pixel/9_brightfire_spritesheet.png' },
  melee_impact: { path: '/assets/effects/pixel/10_weaponhit_spritesheet.png' },
  fire_attack: { path: '/assets/effects/pixel/11_fire_spritesheet.png' },
  ultimate: { path: '/assets/effects/pixel/12_nebula_spritesheet.png' },
  dash: { path: '/assets/effects/pixel/13_vortex_spritesheet.png' },
  undead: { path: '/assets/effects/pixel/14_phantom_spritesheet.png' },
  charging: { path: '/assets/effects/pixel/15_loading_spritesheet.png' },
  holy: { path: '/assets/effects/pixel/16_sunburn_spritesheet.png' },
  dark_magic: { path: '/assets/effects/pixel/17_felspell_spritesheet.png' },
  shadow: { path: '/assets/effects/pixel/18_midnight_spritesheet.png' },
  ice: { path: '/assets/effects/pixel/19_freezing_spritesheet.png' },
  healing: { path: '/assets/effects/pixel/20_magicbubbles_spritesheet.png' },
  // New magic-sprites pack — horizontal sprite strip PNGs
  lightning: { path: '/assets/packs/vfx/magic-sprites/1 Lightning/Lightning.png' },
  lightning_bolt: { path: '/assets/packs/vfx/magic-sprites/2 Lightning bolt/Lightning bolt.png' },
  midas_touch: { path: '/assets/packs/vfx/magic-sprites/3 Midas touch/Midas touch.png' },
  sun_strike: { path: '/assets/packs/vfx/magic-sprites/4 Sun strike/Sun strike.png' },
  explosion: { path: '/assets/packs/vfx/magic-sprites/5 Explosion/Explosion.png' },
  spikes: { path: '/assets/packs/vfx/magic-sprites/6 Spikes/Spikes.png' },
  fire_wall: { path: '/assets/packs/vfx/magic-sprites/7 Fire wall/Fire wall.png' },
  shield_spell: { path: '/assets/packs/vfx/magic-sprites/8 Shield/Shield.png' },
  black_hole: { path: '/assets/packs/vfx/magic-sprites/9 Black hole/Black hole.png' },
  fire_ball: { path: '/assets/packs/vfx/magic-sprites/10 Fire ball/Fire ball.png' },
};

/** Class→spell VFX mapping for ability casts */
export const CLASS_SPELL_VFX: Record<string, SpriteEffectType[]> = {
  Mage: ['fire_ball', 'lightning', 'black_hole', 'midas_touch'],
  Warrior: ['sun_strike', 'explosion', 'spikes', 'fire_wall'],
  Ranger: ['lightning_bolt', 'explosion', 'fire_ball', 'spikes'],
  Worg: ['spikes', 'fire_wall', 'black_hole', 'shield_spell'],
};

const LEGACY_FRAME_SIZE = 100;

export class SpriteEffectSystem {
  private spritesheets: Map<SpriteEffectType, SpritesheetInfo> = new Map();
  private activeEffects: ActiveEffect[] = [];
  private loaded = false;

  constructor() {
    this.preload();
  }

  private preload(): void {
    const entries = Object.entries(EFFECT_FILE_MAP) as [SpriteEffectType, { path: string }][];
    let remaining = entries.length;

    for (const [type, { path }] of entries) {
      const img = new Image();
      img.src = path;

      const info: SpritesheetInfo = {
        image: img,
        frameSize: LEGACY_FRAME_SIZE,
        cols: 1,
        rows: 1,
        totalFrames: 1,
        loaded: false,
      };

      img.onload = () => {
        // New sprite packs are horizontal strips: frame height = image height, square frames
        const isHorizontalStrip = img.height < img.width * 0.5;
        if (isHorizontalStrip) {
          info.frameSize = img.height;
          info.cols = Math.max(1, Math.round(img.width / img.height));
          info.rows = 1;
        } else {
          info.frameSize = LEGACY_FRAME_SIZE;
          info.cols = Math.max(1, Math.floor(img.width / LEGACY_FRAME_SIZE));
          info.rows = Math.max(1, Math.floor(img.height / LEGACY_FRAME_SIZE));
        }
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

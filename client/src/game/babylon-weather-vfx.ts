/**
 * Weather VFX — BabylonJS Particle Systems
 *
 * Particle textures from Brady Games VFX Pack (Unity package converted):
 *   /assets/vfx/weather/water-drop.png   — rain droplets
 *   /assets/vfx/weather/leaf-shape.png   — generic falling leaves
 *   /assets/vfx/weather/maple-leaves.png — maple/autumn leaf sheet
 *
 * Weather types supported:
 *   'rain'        — heavy vertical rain  (water-drop.png)
 *   'rainfall'    — light drizzle
 *   'snowfall'    — medium snowfall
 *   'snowfall-calm' — slow, gentle snow
 *   'falling-leaves' — autumn leaf drift  (maple-leaves.png)
 *   'falling-peach'  — cherry blossom petals (leaf-shape.png, tinted)
 *
 * Usage:
 *   import { WeatherSystem } from './babylon-weather-vfx';
 *   const wx = new WeatherSystem(scene);
 *   wx.setWeather('rain');       // start rain
 *   wx.setWeather('none');       // clear weather
 *   wx.setIntensity(0.5);        // 0–1 intensity scalar
 *   wx.dispose();
 */

import type * as BABYLON from '@babylonjs/core';

// ── Weather types ────────────────────────────────────────────────

export type WeatherType =
  | 'none'
  | 'rain'
  | 'rainfall'
  | 'snowfall'
  | 'snowfall-calm'
  | 'falling-leaves'
  | 'falling-peach';

// ── Config ────────────────────────────────────────────────────────

const VFX_BASE = '/assets/vfx/weather';

interface WeatherConfig {
  texture: string;
  /** particles per second at intensity 1 */
  emitRate: number;
  /** min / max particle lifetime (s) */
  minLifetime: number;
  maxLifetime: number;
  /** min / max particle size */
  minSize: number;
  maxSize: number;
  /** gravity multiplier on Y */
  gravity: number;
  /** emission box half-width around camera (world units) */
  spreadXZ: number;
  /** emission height above camera */
  spawnY: number;
  /** horizontal wind drift (world units/s) */
  windX: number;
  windZ: number;
  /** particle color tint */
  color1: [number, number, number, number];
  color2: [number, number, number, number];
  /** spin speed (rad/s) */
  minAngularSpeed: number;
  maxAngularSpeed: number;
}

const WEATHER_CONFIGS: Record<WeatherType, WeatherConfig | null> = {
  none: null,

  rain: {
    texture: `${VFX_BASE}/water-drop.png`,
    emitRate: 800,
    minLifetime: 0.6, maxLifetime: 1.2,
    minSize: 0.04, maxSize: 0.12,
    gravity: -28,
    spreadXZ: 30, spawnY: 20,
    windX: -2, windZ: 0,
    color1: [0.7, 0.85, 1.0, 0.85],
    color2: [0.6, 0.75, 1.0, 0.6],
    minAngularSpeed: 0, maxAngularSpeed: 0,
  },

  rainfall: {
    texture: `${VFX_BASE}/water-drop.png`,
    emitRate: 220,
    minLifetime: 0.8, maxLifetime: 1.5,
    minSize: 0.03, maxSize: 0.08,
    gravity: -18,
    spreadXZ: 25, spawnY: 18,
    windX: -0.8, windZ: 0,
    color1: [0.75, 0.88, 1.0, 0.6],
    color2: [0.65, 0.78, 1.0, 0.4],
    minAngularSpeed: 0, maxAngularSpeed: 0,
  },

  snowfall: {
    texture: `${VFX_BASE}/leaf-shape.png`,
    emitRate: 200,
    minLifetime: 3.0, maxLifetime: 5.0,
    minSize: 0.08, maxSize: 0.22,
    gravity: -1.5,
    spreadXZ: 28, spawnY: 22,
    windX: 0.5, windZ: 0.3,
    color1: [1.0, 1.0, 1.0, 0.95],
    color2: [0.88, 0.92, 1.0, 0.75],
    minAngularSpeed: -0.3, maxAngularSpeed: 0.3,
  },

  'snowfall-calm': {
    texture: `${VFX_BASE}/leaf-shape.png`,
    emitRate: 80,
    minLifetime: 4.0, maxLifetime: 7.0,
    minSize: 0.06, maxSize: 0.18,
    gravity: -0.8,
    spreadXZ: 25, spawnY: 20,
    windX: 0.2, windZ: 0.1,
    color1: [1.0, 1.0, 1.0, 0.9],
    color2: [0.9, 0.95, 1.0, 0.7],
    minAngularSpeed: -0.15, maxAngularSpeed: 0.15,
  },

  'falling-leaves': {
    texture: `${VFX_BASE}/maple-leaves.png`,
    emitRate: 40,
    minLifetime: 4.0, maxLifetime: 8.0,
    minSize: 0.15, maxSize: 0.4,
    gravity: -2.0,
    spreadXZ: 22, spawnY: 18,
    windX: 1.5, windZ: 0.8,
    color1: [0.9, 0.55, 0.15, 0.95],
    color2: [0.7, 0.35, 0.05, 0.8],
    minAngularSpeed: -1.2, maxAngularSpeed: 1.2,
  },

  'falling-peach': {
    texture: `${VFX_BASE}/leaf-shape.png`,
    emitRate: 55,
    minLifetime: 3.5, maxLifetime: 7.0,
    minSize: 0.08, maxSize: 0.25,
    gravity: -1.2,
    spreadXZ: 20, spawnY: 16,
    windX: 0.8, windZ: 0.4,
    color1: [1.0, 0.75, 0.78, 0.92],
    color2: [1.0, 0.60, 0.65, 0.7],
    minAngularSpeed: -0.8, maxAngularSpeed: 0.8,
  },
};

// ── WeatherSystem class ──────────────────────────────────────────

export class WeatherSystem {
  private scene: BABYLON.Scene;
  private ps: BABYLON.ParticleSystem | null = null;
  private currentType: WeatherType = 'none';
  private intensity = 1.0;
  private baseEmitRate = 0;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  get current(): WeatherType { return this.currentType; }

  /** Switch weather type. Pass 'none' to clear. */
  setWeather(type: WeatherType): void {
    if (type === this.currentType) return;
    this._destroyPS();
    this.currentType = type;
    const cfg = WEATHER_CONFIGS[type];
    if (!cfg) return;
    this._buildPS(cfg);
  }

  /** 0–1 scalar applied to emitRate. Call after setWeather. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value));
    if (this.ps) {
      this.ps.emitRate = Math.round(this.baseEmitRate * this.intensity);
    }
  }

  dispose(): void {
    this._destroyPS();
  }

  // ── Private ────────────────────────────────────────────────────

  private _buildPS(cfg: WeatherConfig): void {
    const BABYLON = (this.scene as any).__BABYLON__ ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).BABYLON;

    // Dynamically use whatever BabylonJS instance is in scope
    const ParticleSystem = BABYLON?.ParticleSystem;
    const Vector3       = BABYLON?.Vector3;
    const Color4        = BABYLON?.Color4;
    const Texture       = BABYLON?.Texture;

    if (!ParticleSystem || !Vector3 || !Color4 || !Texture) {
      console.warn('[WeatherVFX] BabylonJS core not available for particle system');
      return;
    }

    this.baseEmitRate = cfg.emitRate;

    const ps: BABYLON.ParticleSystem = new ParticleSystem(
      `weather-${this.currentType}`,
      cfg.emitRate * 2,       // capacity
      this.scene,
    );

    ps.particleTexture = new Texture(cfg.texture, this.scene);

    // Emitter tracks the camera — box emitter overhead
    ps.emitter = Vector3.Zero(); // updated in scene observer
    ps.minEmitBox = new Vector3(-cfg.spreadXZ, 0, -cfg.spreadXZ);
    ps.maxEmitBox = new Vector3( cfg.spreadXZ, 1,  cfg.spreadXZ);

    ps.minLifeTime = cfg.minLifetime;
    ps.maxLifeTime = cfg.maxLifetime;
    ps.minSize     = cfg.minSize;
    ps.maxSize     = cfg.maxSize;
    ps.emitRate    = Math.round(cfg.emitRate * this.intensity);

    ps.gravity = new Vector3(cfg.windX, cfg.gravity, cfg.windZ);

    ps.minAngularSpeed = cfg.minAngularSpeed;
    ps.maxAngularSpeed = cfg.maxAngularSpeed;

    ps.color1     = new Color4(...cfg.color1);
    ps.color2     = new Color4(...cfg.color2);
    ps.colorDead  = new Color4(0.5, 0.5, 0.5, 0);

    ps.minEmitPower = 0;
    ps.maxEmitPower = 0.2;
    ps.updateSpeed  = 0.016;

    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    // Move emitter to camera position + spawnY each frame
    const obs = this.scene.onBeforeRenderObservable.add(() => {
      const cam = this.scene.activeCamera;
      if (!cam) return;
      const pos = cam.position;
      ps.emitter = new Vector3(pos.x, pos.y + cfg.spawnY, pos.z);
    });

    (ps as any)._grudgeWeatherObs = obs;

    ps.start();
    this.ps = ps;
  }

  private _destroyPS(): void {
    if (!this.ps) return;
    const obs = (this.ps as any)._grudgeWeatherObs;
    if (obs) this.scene.onBeforeRenderObservable.remove(obs);
    this.ps.stop();
    this.ps.dispose();
    this.ps = null;
  }
}

// ── Singleton helper ──────────────────────────────────────────────

let _instance: WeatherSystem | null = null;

export function getWeatherSystem(scene?: BABYLON.Scene): WeatherSystem | null {
  if (scene && !_instance) _instance = new WeatherSystem(scene);
  return _instance;
}

export function disposeWeatherSystem(): void {
  _instance?.dispose();
  _instance = null;
}

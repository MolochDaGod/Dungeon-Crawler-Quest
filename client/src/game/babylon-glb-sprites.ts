/**
 * BabylonJS GLB Sprite Loader — port of glb-sprites.ts
 *
 * Renders 3D GLB models to 2D sprite frames using an offscreen BabylonJS
 * Engine. Used for spell projectiles, shields, and effect overlays in the
 * 2D canvas game. Same public API as the Three.js version.
 */

import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Vector3, Color4 } from "@babylonjs/core/Maths/math";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";

import "@babylonjs/loaders/glTF";

// ── Types (identical to Three.js version) ──────────────────────

export interface GLBSprite {
  name: string;
  frames: ImageBitmap[];
  frameCount: number;
  width: number;
  height: number;
  loaded: boolean;
}

export interface GLBSpriteLibrary {
  sprites: Map<string, GLBSprite>;
  ready: boolean;
}

// ── GLB → Effect Mapping (re-export unchanged) ─────────────────

export const GLB_EFFECT_MAP: Record<string, { file: string; label: string }> = {
  fireball:       { file: "Fireball.glb",              label: "Fireball" },
  ice_lance:      { file: "Ice Lance.glb",             label: "Ice Lance" },
  ice_lance_2:    { file: "Ice Lance 2.glb",           label: "Ice Lance II" },
  ice_lance_3:    { file: "Ice Lance 3.glb",           label: "Ice Lance III" },
  ice_rock:       { file: "Ice Rock.glb",              label: "Ice Rock" },
  nature_shield:  { file: "Nature_Shield.glb",         label: "Nature Shield" },
  dark_shield:    { file: "Dark_Shield.glb",           label: "Dark Shield" },
  distortion:     { file: "Distortion.glb",            label: "Distortion" },
  crystal:        { file: "Crystal.glb",               label: "Crystal" },
  potion:         { file: "Potion.glb",                label: "Potion" },
  rock_icicle:    { file: "Rock Icicle.glb",           label: "Rock Icicle" },
  root:           { file: "Root.glb",                  label: "Root" },
  skull:          { file: "Skull.glb",                  label: "Skull" },
  tome:           { file: "Tome.glb",                  label: "Tome" },
  book:           { file: "Book.glb",                  label: "Book" },
};

export const CLASS_PROJECTILE_SPRITE: Record<string, string> = {
  Mage: "ice_lance",
  Warrior: "fireball",
  Ranger: "ice_rock",
  Worg: "skull",
};

export const CLASS_SHIELD_SPRITE: Record<string, string> = {
  Mage: "nature_shield",
  Warrior: "dark_shield",
  Ranger: "nature_shield",
  Worg: "dark_shield",
};

export const CLASS_SPECIAL_SPRITE: Record<string, string> = {
  Mage: "crystal",
  Warrior: "distortion",
  Ranger: "crystal",
  Worg: "distortion",
};

// ── Offscreen Renderer ─────────────────────────────────────────

const SPRITE_SIZE = 64;
const FRAME_COUNT = 12;

let offscreenEngine: Engine | null = null;
let offscreenScene: Scene | null = null;
let offscreenCamera: FreeCamera | null = null;
let offscreenCanvas: HTMLCanvasElement | null = null;

function ensureOffscreenRenderer(): boolean {
  if (offscreenEngine) return true;
  try {
    offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = SPRITE_SIZE;
    offscreenCanvas.height = SPRITE_SIZE;

    offscreenEngine = new Engine(offscreenCanvas, true, {
      preserveDrawingBuffer: true,
      alpha: true,
    });

    offscreenScene = new Scene(offscreenEngine);
    offscreenScene.clearColor = new Color4(0, 0, 0, 0); // transparent

    offscreenCamera = new FreeCamera("spriteCam", new Vector3(0, 1, 3), offscreenScene);
    offscreenCamera.setTarget(Vector3.Zero());
    offscreenCamera.minZ = 0.1;
    offscreenCamera.maxZ = 100;

    // Lighting
    const hemi = new HemisphericLight("spriteHemi", new Vector3(0, 1, 0), offscreenScene);
    hemi.intensity = 0.7;

    const dir = new DirectionalLight("spriteDir", new Vector3(-0.5, -1, 0.5), offscreenScene);
    dir.position = new Vector3(2, 3, 2);
    dir.intensity = 1.0;

    return true;
  } catch (e) {
    console.warn("GLB sprite renderer init failed:", e);
    return false;
  }
}

// ── Load a single GLB and render frames ────────────────────────

async function renderGLBToFrames(filePath: string): Promise<ImageBitmap[]> {
  if (!ensureOffscreenRenderer() || !offscreenEngine || !offscreenScene || !offscreenCanvas) {
    return [];
  }

  try {
    const result = await SceneLoader.ImportMeshAsync("", "", filePath, offscreenScene);
    const root = result.meshes[0] as TransformNode;
    const meshes = result.meshes as AbstractMesh[];

    // Compute bounding box for auto-centering and scaling
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const mesh of meshes) {
      mesh.refreshBoundingInfo({});
      const bounds = mesh.getBoundingInfo().boundingBox;
      const worldMin = bounds.minimumWorld;
      const worldMax = bounds.maximumWorld;
      minX = Math.min(minX, worldMin.x);
      minY = Math.min(minY, worldMin.y);
      minZ = Math.min(minZ, worldMin.z);
      maxX = Math.max(maxX, worldMax.x);
      maxY = Math.max(maxY, worldMax.y);
      maxZ = Math.max(maxZ, worldMax.z);
    }

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxDim = Math.max(sizeX, sizeY, sizeZ) || 1;
    const scale = 1.5 / maxDim;

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    root.scaling.setAll(scale);
    root.position.set(-centerX * scale, -centerY * scale, -centerZ * scale);

    const frames: ImageBitmap[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const angle = (i / FRAME_COUNT) * Math.PI * 2;
      root.rotation.y = angle;

      offscreenScene!.render();

      try {
        const bitmap = await createImageBitmap(offscreenCanvas);
        frames.push(bitmap);
      } catch {
        // Skip frame on failure
      }
    }

    // Dispose loaded meshes
    for (const mesh of meshes) {
      mesh.dispose(false, true);
    }
    // Dispose animation groups that may have been loaded
    for (const ag of result.animationGroups) {
      ag.dispose();
    }

    return frames;
  } catch {
    return [];
  }
}

// ── Public API ─────────────────────────────────────────────────

const globalLibrary: GLBSpriteLibrary = {
  sprites: new Map(),
  ready: false,
};

/**
 * Initialize the GLB sprite library by loading all effect models.
 * Call once at startup. Non-blocking — sprites become available as they load.
 */
export async function initGLBSprites(basePath: string = "/effects/"): Promise<GLBSpriteLibrary> {
  if (globalLibrary.ready) return globalLibrary;

  if (!ensureOffscreenRenderer()) {
    console.warn("WebGL not available for GLB sprite rendering");
    globalLibrary.ready = true;
    return globalLibrary;
  }

  const loadPromises: Promise<void>[] = [];

  for (const [key, info] of Object.entries(GLB_EFFECT_MAP)) {
    const placeholder: GLBSprite = {
      name: info.label,
      frames: [],
      frameCount: 0,
      width: SPRITE_SIZE,
      height: SPRITE_SIZE,
      loaded: false,
    };
    globalLibrary.sprites.set(key, placeholder);

    const promise = renderGLBToFrames(basePath + info.file).then((frames) => {
      placeholder.frames = frames;
      placeholder.frameCount = frames.length;
      placeholder.loaded = frames.length > 0;
    });
    loadPromises.push(promise);
  }

  // Don't await all — let them load in background
  Promise.allSettled(loadPromises).then(() => {
    globalLibrary.ready = true;
    const loaded = Array.from(globalLibrary.sprites.values()).filter(s => s.loaded).length;
    console.log(`GLB sprites loaded: ${loaded}/${globalLibrary.sprites.size}`);
  });

  return globalLibrary;
}

/**
 * Get the global sprite library (may still be loading).
 */
export function getGLBSpriteLibrary(): GLBSpriteLibrary {
  return globalLibrary;
}

/**
 * Get a specific sprite by key (returns null if not loaded yet).
 */
export function getGLBSprite(key: string): GLBSprite | null {
  const sprite = globalLibrary.sprites.get(key);
  return sprite?.loaded ? sprite : null;
}

/**
 * Draw a GLB sprite frame onto a 2D canvas context.
 * Automatically selects frame based on time for rotation animation.
 */
export function drawGLBSprite(
  ctx: CanvasRenderingContext2D,
  spriteKey: string,
  x: number,
  y: number,
  time: number,
  scale: number = 1.0,
  alpha: number = 1.0,
  rotation: number = 0,
): boolean {
  const sprite = getGLBSprite(spriteKey);
  if (!sprite || sprite.frameCount === 0) return false;

  const frameIndex = Math.floor((time * 8) % sprite.frameCount);
  const frame = sprite.frames[frameIndex];
  if (!frame) return false;

  const w = sprite.width * scale;
  const h = sprite.height * scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.drawImage(frame, -w / 2, -h / 2, w, h);
  ctx.restore();

  return true;
}

/**
 * Draw a GLB sprite as a projectile (with glow effect).
 */
export function drawGLBProjectile(
  ctx: CanvasRenderingContext2D,
  spriteKey: string,
  x: number,
  y: number,
  time: number,
  scale: number = 0.6,
  glowColor: string = "#ffffff",
): boolean {
  // Glow behind
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = glowColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  return drawGLBSprite(ctx, spriteKey, x, y, time, scale);
}

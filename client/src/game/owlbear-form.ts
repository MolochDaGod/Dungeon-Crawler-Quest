/**
 * Owlbear Bear Form — Worg Class Shapeshift
 *
 * Uses the owlbear.glb model (from D:\Downloads\owlbear.zip) for the Worg
 * class bear transformation.  Each race gets a unique color tint applied
 * to the base model via material color override.
 *
 * Integration:
 *   - 3D renderers (BabylonJS / Three.js): load owlbear.glb, clone per race,
 *     apply tint via albedoColor / diffuseColor on all child meshes.
 *   - 2D voxel renderer: buildBearModel() in voxel.ts uses the race tint
 *     as the primary body color.
 *
 * The owlbear model should be extracted to:
 *   public/assets/models/creatures/owlbear/owlbear.glb
 *
 * Animations expected in the GLB (or retargeted from Mixamo):
 *   idle, walk, run, attack, roar, death, hit
 */

// ── Race → Bear Color Tint ─────────────────────────────────────
//
// Each race's Worg has a visually distinct bear form color.
// These are HSL-shifted versions of the base owlbear texture,
// applied as a multiplicative tint on the material albedo.

export interface BearFormTint {
  /** Display name for the tinted form */
  name: string;
  /** Primary body tint (hex) — applied to fur/body meshes */
  bodyColor: string;
  /** Accent tint (hex) — applied to feathers/beak/claws if present */
  accentColor: string;
  /** Emissive glow color (hex) — subtle glow on eyes/runes */
  emissiveColor: string;
  /** Scale multiplier (some races are bulkier) */
  scale: number;
}

export const RACE_BEAR_TINTS: Record<string, BearFormTint> = {
  Human: {
    name: 'Brown Owlbear',
    bodyColor:     '#6b4226',   // warm brown — classic bear
    accentColor:   '#8b6914',   // golden-brown feathers
    emissiveColor: '#ff8c00',   // amber eyes
    scale: 1.0,
  },
  Barbarian: {
    name: 'Frost Owlbear',
    bodyColor:     '#8fa5b5',   // icy grey-blue
    accentColor:   '#c8d8e4',   // white frost feathers
    emissiveColor: '#4fc3f7',   // ice-blue eyes
    scale: 1.1,                  // barbarians are bigger
  },
  Dwarf: {
    name: 'Iron Owlbear',
    bodyColor:     '#5a4a3a',   // dark iron-brown
    accentColor:   '#8a7050',   // bronze feathers
    emissiveColor: '#f59e0b',   // molten gold eyes
    scale: 0.85,                 // compact and stocky
  },
  Elf: {
    name: 'Sylvan Owlbear',
    bodyColor:     '#2d5a2d',   // forest green
    accentColor:   '#4a8a4a',   // emerald feathers
    emissiveColor: '#22d3ee',   // cyan spirit eyes
    scale: 0.95,                 // sleek and lean
  },
  Orc: {
    name: 'Dire Owlbear',
    bodyColor:     '#3a3a2a',   // dark olive
    accentColor:   '#5a5030',   // war-paint tan
    emissiveColor: '#ef4444',   // blood-red eyes
    scale: 1.15,                 // largest bear form
  },
  Undead: {
    name: 'Rotting Owlbear',
    bodyColor:     '#3a2a3a',   // necrotic purple-grey
    accentColor:   '#5a3a5a',   // dark violet feathers
    emissiveColor: '#a855f7',   // soul-purple eyes
    scale: 1.05,
  },
};

/** Fallback tint if race not found */
export const DEFAULT_BEAR_TINT: BearFormTint = RACE_BEAR_TINTS.Human;

/** Get the bear form tint for a race */
export function getBearTint(race: string): BearFormTint {
  return RACE_BEAR_TINTS[race] ?? DEFAULT_BEAR_TINT;
}

// ── GLB Model Path ─────────────────────────────────────────────

/** Path to the owlbear GLB model (extracted from owlbear.zip) */
export const OWLBEAR_MODEL_PATH = '/assets/models/creatures/owlbear/owlbear.glb';

/** Animations expected on the owlbear GLB or applied via retarget */
export const OWLBEAR_ANIMATIONS: Record<string, string> = {
  idle:   '/assets/models/creatures/owlbear/idle.fbx',
  walk:   '/assets/models/creatures/owlbear/walk.fbx',
  run:    '/assets/models/creatures/owlbear/run.fbx',
  attack: '/assets/models/creatures/owlbear/attack.fbx',
  roar:   '/assets/models/creatures/owlbear/roar.fbx',
  death:  '/assets/models/creatures/owlbear/death.fbx',
  hit:    '/assets/models/creatures/owlbear/hit.fbx',
};

// ── Prefab Config (Three.js) ───────────────────────────────────

/**
 * Get a Three.js prefab config for the owlbear bear form.
 * Used by prefabs.ts for the 3D MOBA/OW renderers.
 */
export function getOwlbearPrefab(race: string) {
  const tint = getBearTint(race);
  return {
    modelPath: OWLBEAR_MODEL_PATH,
    scale: 0.012 * tint.scale,
    offset: { x: 0, y: 0, z: 0 },
    format: 'glb' as const,
    animations: OWLBEAR_ANIMATIONS,
    tint: {
      body: tint.bodyColor,
      accent: tint.accentColor,
      emissive: tint.emissiveColor,
    },
  };
}

// ── BabylonJS Tint Application ─────────────────────────────────

/**
 * Apply race-specific tint to an owlbear mesh hierarchy in BabylonJS.
 * Call after loading/cloning the owlbear model.
 *
 * @param root - The root TransformNode of the cloned owlbear
 * @param race - Player's race string
 * @param scene - BabylonJS scene (for creating materials)
 */
export function applyBearTintBabylon(
  root: any, // TransformNode — kept as `any` to avoid hard BabylonJS import
  race: string,
  scene: any, // Scene
): void {
  const tint = getBearTint(race);

  // Dynamically import BabylonJS types (avoids circular deps)
  const Color3 = (globalThis as any).BABYLON?.Color3;
  const PBRMaterial = (globalThis as any).BABYLON?.PBRMaterial;
  if (!Color3 || !PBRMaterial) return;

  const bodyColor = Color3.FromHexString(tint.bodyColor);
  const accentColor = Color3.FromHexString(tint.accentColor);
  const emissiveColor = Color3.FromHexString(tint.emissiveColor);

  const meshes = root.getChildMeshes?.() ?? [];
  for (const mesh of meshes) {
    if (!mesh.material) continue;

    // Clone material so other instances aren't affected
    const mat = mesh.material.clone(`owlbear_${race}_${mesh.name}`);
    mesh.material = mat;

    const name = mesh.name.toLowerCase();

    if (name.includes('eye') || name.includes('glow') || name.includes('rune')) {
      // Eyes / glow elements → emissive
      if ('emissiveColor' in mat) mat.emissiveColor = emissiveColor;
      if ('albedoColor' in mat) mat.albedoColor = emissiveColor;
    } else if (name.includes('feather') || name.includes('beak') || name.includes('claw') || name.includes('horn')) {
      // Accent parts → accent color
      if ('albedoColor' in mat) mat.albedoColor = accentColor;
    } else {
      // Body / fur → body color
      if ('albedoColor' in mat) mat.albedoColor = bodyColor;
    }
  }

  // Apply scale
  if (root.scaling) {
    const s = 1.0 * tint.scale;
    root.scaling.setAll?.(s) ?? root.scaling.set?.(s, s, s);
  }
}

// ── Three.js Tint Application ──────────────────────────────────

/**
 * Apply race-specific tint to an owlbear mesh hierarchy in Three.js.
 * Call after loading/cloning the owlbear model.
 *
 * @param root - The root Object3D of the cloned owlbear
 * @param race - Player's race string
 */
export function applyBearTintThree(
  root: any, // THREE.Object3D
  race: string,
): void {
  const tint = getBearTint(race);
  const THREE = (globalThis as any).THREE;
  if (!THREE) return;

  const bodyColor = new THREE.Color(tint.bodyColor);
  const accentColor = new THREE.Color(tint.accentColor);
  const emissiveColor = new THREE.Color(tint.emissiveColor);

  root.traverse?.((child: any) => {
    if (!child.isMesh || !child.material) return;

    // Clone material
    child.material = child.material.clone();
    const mat = child.material;
    const name = (child.name || '').toLowerCase();

    if (name.includes('eye') || name.includes('glow') || name.includes('rune')) {
      if (mat.emissive) mat.emissive.copy(emissiveColor);
      if (mat.color) mat.color.copy(emissiveColor);
    } else if (name.includes('feather') || name.includes('beak') || name.includes('claw') || name.includes('horn')) {
      if (mat.color) mat.color.copy(accentColor);
    } else {
      if (mat.color) mat.color.copy(bodyColor);
    }
  });

  // Apply scale
  const s = tint.scale;
  root.scale?.setScalar?.(s);
}

// ── 2D Voxel Color (for buildBearModel in voxel.ts) ────────────

/**
 * Get the primary voxel body color for the bear form.
 * Used by the 2D isometric voxel renderer's buildBearModel().
 */
export function getBearVoxelColor(race: string): string {
  return getBearTint(race).bodyColor;
}

/**
 * Get the accent voxel color for bear form details.
 */
export function getBearVoxelAccent(race: string): string {
  return getBearTint(race).accentColor;
}

/**
 * Get the emissive/glow voxel color for bear form eyes.
 */
export function getBearVoxelGlow(race: string): string {
  return getBearTint(race).emissiveColor;
}

// ── Bear Form Stats Modifiers ──────────────────────────────────
//
// When a Worg transforms into bear form, their stats change.
// These are multipliers applied on top of the hero's base stats.

export interface BearFormStats {
  hpMult: number;
  atkMult: number;
  defMult: number;
  spdMult: number;
  rngMult: number;
}

/** Bear form makes you tankier but slower, with shorter range */
export const BEAR_FORM_STATS: BearFormStats = {
  hpMult:  1.40,  // +40% HP
  atkMult: 1.25,  // +25% ATK
  defMult: 1.35,  // +35% DEF
  spdMult: 0.85,  // -15% SPD (big and heavy)
  rngMult: 0.60,  // -40% RNG (melee-locked)
};

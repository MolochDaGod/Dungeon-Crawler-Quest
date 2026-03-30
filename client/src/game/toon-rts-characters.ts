/**
 * Toon RTS Modular Race Character System
 * ========================================
 * SINGLE source of truth for all playable race + class character configs.
 *
 * Assets originate from:   D:\Desktop\MouseWithoutBorders\Toon_RTS.zip
 * Extracted to:            public/assets/packs/toon-rts/Toon_RTS/
 * Same mesh pipeline used by the Unity uMMORPG "Toon RTS" pack
 * and the GDevelop character editor.
 *
 * Architecture:
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │  getToonRTSConfig(race, heroClass)                          │
 *  │    └→ ToonRTSCharacterConfig (serialisable JSON)           │
 *  │         ├─ modelPath   FBX base mesh (BabylonJS 3D mode)   │
 *  │         ├─ texturePath Per-race TGA skin (BabylonJS)       │
 *  │         ├─ animations  Game-state → FBX animation file     │
 *  │         ├─ weapons     Weapon FBX paths for this race       │
 *  │         └─ modularConfig  Voxel fallback for 2D canvas     │
 *  │                                                             │
 *  │  loadToonRTSCharacter(scene, race, heroClass)               │
 *  │    └→ BabylonJS AnimatedEntity (3D scene instance)         │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * Race → Toon RTS asset race (only Barbarians, Dwarves, Elves in pack):
 *   Human     → Barbarians  (humanoid frame, standard skin)
 *   Barbarian → Barbarians  (brown skin variant)
 *   Dwarf     → Dwarves     (standard skin)
 *   Elf       → Elves       (Dark Elf blue texture)
 *   Orc       → Barbarians  (brown texture — bulkiest body)
 *   Undead    → Elves       (Dark Elf blue texture — pale/gaunt)
 */

import type { Scene } from '@babylonjs/core/scene';
import { loadFBX, createAnimatedEntity, type AnimatedEntity, type LoadedModel } from './babylon-model-loader';
import { autoRetargetAnimationGroup } from './babylon-retarget';
import { defaultModularConfig, type ModularVoxelConfig } from './voxel-modular';

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = '/assets/packs/toon-rts/Toon_RTS';

/** The 3 Toon RTS asset races in the pack */
export type ToonAssetRace = 'Barbarians' | 'Dwarves' | 'Elves';

/** Game animation states mapped to Toon RTS animation files */
export type ToonAnimState =
  | 'idle'      // standing at rest
  | 'walk'      // slow movement
  | 'run'       // normal combat speed
  | 'runBack'   // reverse movement
  | 'runDiag'   // diagonal strafe
  | 'attack'    // melee / ranged attack
  | 'cast'      // magic cast (Mage class)
  | 'death'     // die
  | 'dash';     // charge / leap

// ── Asset Path Tables ──────────────────────────────────────────────────────────

/** FBX base mesh per Toon RTS asset race */
const MODEL_PATH: Record<ToonAssetRace, string> = {
  Barbarians: `${BASE}/Barbarians/models/BRB_Characters_customizable.FBX`,
  Dwarves:    `${BASE}/Dwarves/models/DWF_Characters_customizable.FBX`,
  Elves:      `${BASE}/Elves/models/ELF_Characters_customizable.FBX`,
};

/** Default skin texture per Toon RTS asset race */
const TEXTURE_DEFAULT: Record<ToonAssetRace, string> = {
  Barbarians: `${BASE}/Barbarians/models/Materials/BRB_StandardUnits_texture.tga`,
  Dwarves:    `${BASE}/Dwarves/models/Materials/DWF_Standard_Units.tga`,
  Elves:      `${BASE}/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Blue.tga`,
};

/** Alternate colour skin (brown variant) per Toon RTS asset race */
const TEXTURE_ALT: Record<ToonAssetRace, string> = {
  Barbarians: `${BASE}/Barbarians/models/Materials/Color/textures/BRB_Standard_Units_brown.tga`,
  Dwarves:    `${BASE}/Dwarves/models/Materials/Colors/Textures/DWF_Units_Brown.tga`,
  Elves:      `${BASE}/Elves/models/Materials/Color/DarkElves/textures/ELF_DarkElves_Blue.tga`,
};

/**
 * Animation FBX files per Toon RTS asset race, organised by game animation state.
 * Multiple entries per state are listed in priority order; first file wins.
 */
const ANIMS: Record<ToonAssetRace, Partial<Record<ToonAnimState, string[]>>> = {
  Barbarians: {
    // Only Mage & Spearman animation clips shipped in partial zip extract
    attack: [
      `${BASE}/Barbarians/animation/Spearman/BRB_spearman_07_attack.FBX`,
    ],
    cast: [
      `${BASE}/Barbarians/animation/Mage/BRB_mage_11_cast_B.FBX`,
    ],
    // idle / run / death: use Dwarves Worker clips as fallback (same rig family)
    idle:    [`${BASE}/Dwarves/animation/Worker/_idle.FBX`],
    walk:    [`${BASE}/Dwarves/animation/Worker/run.FBX`],
    run:     [`${BASE}/Dwarves/animation/Worker/run.FBX`],
    runBack: [`${BASE}/Dwarves/animation/Worker/run Reverse.FBX`],
    runDiag: [`${BASE}/Dwarves/animation/Worker/run diagonal.FBX`],
    death:   [`${BASE}/Dwarves/animation/Worker/DWF_worker_10_death_B.FBX`],
    dash:    [`${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_04_charge.FBX`],
  },
  Dwarves: {
    idle:    [`${BASE}/Dwarves/animation/Worker/_idle.FBX`],
    walk:    [`${BASE}/Dwarves/animation/Worker/run.FBX`],
    run:     [`${BASE}/Dwarves/animation/Worker/run.FBX`],
    runBack: [`${BASE}/Dwarves/animation/Worker/run Reverse.FBX`],
    runDiag: [`${BASE}/Dwarves/animation/Worker/run diagonal.FBX`],
    attack:  [`${BASE}/Dwarves/animation/Worker/DWF_worker_07_attack.FBX`],
    cast:    [`${BASE}/Barbarians/animation/Mage/BRB_mage_11_cast_B.FBX`],
    death:   [`${BASE}/Dwarves/animation/Worker/DWF_worker_10_death_B.FBX`],
    dash:    [`${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_04_charge.FBX`],
  },
  Elves: {
    idle:    [
      `${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_05_combat_idle.FBX`,
      `${BASE}/Elves/animation/BoltThrower/ELF_boltthrower_01_idle.FBX`,
    ],
    walk:    [`${BASE}/Elves/animation/BoltThrower/ELF_boltthrower_02_move.FBX`],
    run:     [`${BASE}/Elves/animation/BoltThrower/ELF_boltthrower_02_move.FBX`],
    attack:  [
      `${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_07_attack.FBX`,
      `${BASE}/Elves/animation/BoltThrower/ELF_boltthrower_03_attack.FBX`,
    ],
    cast:    [`${BASE}/Elves/animation/Cavalry_Mage/ELF_cavalry_mage_08_attack_B.FBX`],
    death:   [
      `${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_10_death_A.FBX`,
      `${BASE}/Elves/animation/BoltThrower/ELF_boltthrower_04_death.FBX`,
    ],
    dash:    [`${BASE}/Elves/animation/Cavalry_Spear/ELF_cavalry_spear_04_charge.FBX`],
  },
};

/** Race-specific weapon FBX extras */
const WEAPON_PATHS: Record<ToonAssetRace, Record<string, string>> = {
  Barbarians: {
    sword:  `${BASE}/Barbarians/models/extra models/Equipment/BRB_weapon_sword_B.FBX`,
    spear:  `${BASE}/Barbarians/models/extra models/Equipment/BRB_weapon_spear.FBX`,
    staff:  `${BASE}/Barbarians/models/extra models/Equipment/BRB_weapon_staff_B.FBX`,
    hammer: `${BASE}/Barbarians/models/extra models/Equipment/BRB_weapon_hammer_B.FBX`,
  },
  Dwarves: {},   // no weapon extras extracted
  Elves: {
    spear: `${BASE}/Elves/models/extra models/equipment/ELF_weapon_spear.FBX`,
    staff: `${BASE}/Elves/models/extra models/equipment/ELF_weapon_staff_C.FBX`,
  },
};

// ── Race → Asset Race / Texture Selection ─────────────────────────────────────

interface RaceAssetMapping {
  assetRace: ToonAssetRace;
  /** true = use ALT (brown) texture, false = use default */
  useAltTexture: boolean;
}

const RACE_ASSET_MAP: Record<string, RaceAssetMapping> = {
  Human:     { assetRace: 'Barbarians', useAltTexture: false },
  Barbarian: { assetRace: 'Barbarians', useAltTexture: true  },
  Dwarf:     { assetRace: 'Dwarves',    useAltTexture: false },
  Elf:       { assetRace: 'Elves',      useAltTexture: false },
  Orc:       { assetRace: 'Barbarians', useAltTexture: true  },
  Undead:    { assetRace: 'Elves',      useAltTexture: false },
};

// ── Class → Animation Priority Override ───────────────────────────────────────
// Certain classes prefer different animation clips within their asset race.
// 'default' means "use whatever the asset race table has".

interface ClassAnimOverride {
  /** Override which animation file is preferred for 'attack' */
  attackOverride?: ToonAssetRace;
  /** Override which animation file is preferred for 'cast' */
  castOverride?: ToonAssetRace;
  /** Override which animation file is preferred for 'idle' */
  idleOverride?: ToonAssetRace;
}

const CLASS_ANIM_OVERRIDE: Record<string, ClassAnimOverride> = {
  Warrior: {},
  Mage:    { castOverride: undefined }, // use whatever the race provides
  Ranger:  {},
  Worg:    {},
};

// ── ToonRTSCharacterConfig ─────────────────────────────────────────────────────

/**
 * Complete, serialisable config for a Toon RTS player character.
 * Passed to BabylonJS loader for 3D mode, or to voxel system for 2D mode.
 * This is the SINGLE config object shared between the game engine,
 * the GDevelop character editor, and the Grudge backend.
 */
export interface ToonRTSCharacterConfig {
  /** Game race */
  race: string;
  /** Game class */
  heroClass: string;
  /** Which Toon RTS asset race's files are actually loaded */
  assetRace: ToonAssetRace;
  /** FBX base mesh path (under public/) */
  modelPath: string;
  /** Skin texture TGA path */
  texturePath: string;
  /**
   * Game-state → resolved FBX animation path.
   * Only states where a file exists are populated.
   */
  animations: Partial<Record<ToonAnimState, string>>;
  /** Race-specific weapon FBX paths */
  weapons: Record<string, string>;
  /** World scale to apply when instantiating the FBX */
  modelScale: number;
  /** 2D canvas fallback — drives the voxel modular renderer */
  modularConfig: ModularVoxelConfig;
}

// ── Core Factory ──────────────────────────────────────────────────────────────

/**
 * Build a complete ToonRTSCharacterConfig for any race + class combination.
 *
 * This is the singular entry point for all character configuration in the game.
 * Used by:
 *  - BabylonJS 3D renderer (`loadToonRTSCharacter`)
 *  - 2D canvas voxel renderer (via `config.modularConfig`)
 *  - GDevelop character editor (via JSON serialisation)
 *  - Grudge backend (stored per character record)
 */
export function getToonRTSConfig(race: string, heroClass: string): ToonRTSCharacterConfig {
  const mapping = RACE_ASSET_MAP[race] ?? RACE_ASSET_MAP.Human;
  const { assetRace, useAltTexture } = mapping;

  const modelPath   = MODEL_PATH[assetRace];
  const texturePath = useAltTexture ? TEXTURE_ALT[assetRace] : TEXTURE_DEFAULT[assetRace];
  const raceAnims   = ANIMS[assetRace];

  // Resolve each game state to the first available FBX path in the priority list
  const animations: Partial<Record<ToonAnimState, string>> = {};
  for (const [state, paths] of Object.entries(raceAnims) as [ToonAnimState, string[]][]) {
    if (paths && paths.length > 0) {
      animations[state] = paths[0]; // first path = highest priority
    }
  }

  // Mage class: prefer 'cast' over 'attack' where both exist
  // (no change needed — cast is already a separate key)

  const weapons = WEAPON_PATHS[assetRace] ?? {};

  // Scale chosen so a ~180 unit-tall FBX maps to ~2 BabylonJS units
  const MODEL_SCALES: Record<ToonAssetRace, number> = {
    Barbarians: 0.01,
    Dwarves:    0.01,
    Elves:      0.01,
  };

  return {
    race,
    heroClass,
    assetRace,
    modelPath,
    texturePath,
    animations,
    weapons,
    modelScale: MODEL_SCALES[assetRace],
    modularConfig: defaultModularConfig(race, heroClass),
  };
}

// ── Pre-built Config Table (all 24 race+class combos) ────────────────────────

/** The 6 playable races */
export const PLAYABLE_RACES = ['Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'] as const;
/** The 4 playable classes */
export const PLAYABLE_CLASSES = ['Warrior', 'Mage', 'Ranger', 'Worg'] as const;

export type PlayableRace  = typeof PLAYABLE_RACES[number];
export type PlayableClass = typeof PLAYABLE_CLASSES[number];

/**
 * All 24 configs pre-built at module load time.
 * Index with `ALL_TOON_RTS_CONFIGS['Elf:Ranger']`.
 */
export const ALL_TOON_RTS_CONFIGS: Record<string, ToonRTSCharacterConfig> = (() => {
  const out: Record<string, ToonRTSCharacterConfig> = {};
  for (const race of PLAYABLE_RACES) {
    for (const cls of PLAYABLE_CLASSES) {
      out[`${race}:${cls}`] = getToonRTSConfig(race, cls);
    }
  }
  return out;
})();

// ── BabylonJS Loader ───────────────────────────────────────────────────────────

export interface ToonRTSCharacterInstance {
  /** BabylonJS animated entity (play animations, control root transform) */
  entity: AnimatedEntity;
  /** The resolved config used to create this instance */
  config: ToonRTSCharacterConfig;
  /**
   * Map of game-state name → retargeted AnimationGroup.
   * e.g. play('attack') to trigger the attack animation.
   */
  play: (state: ToonAnimState, loop?: boolean, crossFade?: number) => void;
}

/**
 * Load, instantiate, and retarget all animations for a Toon RTS player character.
 *
 * @param scene      Active BabylonJS scene
 * @param race       Game race string (e.g. 'Elf')
 * @param heroClass  Game class string (e.g. 'Ranger')
 *
 * @example
 * const char = await loadToonRTSCharacter(scene, 'Elf', 'Ranger');
 * char.play('run');
 */
export async function loadToonRTSCharacter(
  scene: Scene,
  race: string,
  heroClass: string,
): Promise<ToonRTSCharacterInstance> {
  const config = getToonRTSConfig(race, heroClass);

  // 1. Load base mesh
  const baseModel: LoadedModel = await loadFBX(scene, config.modelPath, config.texturePath);
  baseModel.root.scaling.setAll(config.modelScale);

  // 2. Create animated entity (any animations baked into the base FBX)
  const entity = createAnimatedEntity(baseModel);

  // 3. Load and retarget each unique animation FBX
  const animValues = Object.values(config.animations).filter((v): v is string => !!v);
  const seen = new Set<string>();
  const uniqueAnimFiles = animValues.filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });

  for (const animPath of uniqueAnimFiles) {
    try {
      const animModel: LoadedModel = await loadFBX(scene, animPath);
      for (const group of animModel.animationGroups) {
        // Derive a clean game-state name from the animation file path
        const stateName = resolveStateFromPath(config.animations, animPath);
        try {
          const retargeted = autoRetargetAnimationGroup(entity.root, group);
          // Register under both the raw group name and the game-state name
          entity.actions.set(group.name.toLowerCase(), retargeted);
          if (stateName) entity.actions.set(stateName, retargeted);
          retargeted.stop();
        } catch (retargetErr) {
          console.warn(`[toon-rts] Retarget failed for "${animPath}":`, retargetErr);
        }
      }
      // Dispose the animation-only model's meshes (we only needed the AnimationGroups)
      animModel.root.dispose();
    } catch (loadErr) {
      console.warn(`[toon-rts] Animation load failed for "${animPath}":`, loadErr);
    }
  }

  // 4. Start idle animation if available
  const idleGroup = entity.actions.get('idle');
  if (idleGroup) { idleGroup.start(true); entity.currentAction = 'idle'; }

  // 5. Convenience play() helper
  function play(state: ToonAnimState, loop = true, crossFade = 0.2): void {
    const group = entity.actions.get(state);
    if (!group) return;
    if (entity.currentAction === state) return;
    const prev = entity.actions.get(entity.currentAction);
    if (prev) prev.stop();
    group.start(loop);
    entity.currentAction = state;
    void crossFade; // crossfade is handled by playAnimation() from model-loader if needed
  }

  return { entity, config, play };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given the animation file path, find which game-state key it belongs to.
 * Returns the first matching game-state key.
 */
function resolveStateFromPath(
  animations: Partial<Record<ToonAnimState, string>>,
  animPath: string,
): ToonAnimState | null {
  for (const [state, path] of Object.entries(animations) as [ToonAnimState, string][]) {
    if (path === animPath) return state;
  }
  return null;
}

// ── Quick lookup helpers ───────────────────────────────────────────────────────

/** Get the model path for a specific race (useful for NPC/enemy instantiation) */
export function getToonRTSModelPath(race: string): string {
  const mapping = RACE_ASSET_MAP[race] ?? RACE_ASSET_MAP.Human;
  return MODEL_PATH[mapping.assetRace];
}

/** Get all weapon paths for a given race */
export function getToonRTSWeapons(race: string): Record<string, string> {
  const mapping = RACE_ASSET_MAP[race] ?? RACE_ASSET_MAP.Human;
  return WEAPON_PATHS[mapping.assetRace] ?? {};
}

/** Get the voxel fallback config for a race+class (for 2D mode) */
export function getToonRTSVoxelFallback(race: string, heroClass: string): ModularVoxelConfig {
  return defaultModularConfig(race, heroClass);
}

/**
 * Mount / Cavalry System
 *
 * Each race has a signature mount derived from the Toon_RTS cavalry FBX models.
 * Players can mount/dismount with a hotkey, gaining a speed bonus and switching
 * to cavalry animations. Mounts are unlocked after level 10 (bikes rule).
 *
 * The cavalry GLBs contain rider + mount as a single rigged model, so mounting
 * swaps the rendered model from the infantry GLB to the cavalry GLB.
 */

import { RACE_TOON_RTS } from './player-characters';

// ── Types ──────────────────────────────────────────────────────

export type MountAnimState = 'idle' | 'walk' | 'run' | 'attack' | 'death' | 'dismount';

export interface MountDef {
  /** Display name */
  name: string;
  /** Which game races can use this mount */
  compatibleRaces: string[];
  /** Toon_RTS cavalry GLB path */
  cavalryGlb: string;
  /** Multiplicative speed bonus while mounted (e.g. 1.6 = 60% faster) */
  speedMultiplier: number;
  /** Minimum player level required */
  minLevel: number;
  /** Turn rate multiplier while mounted (lower = wider turns) */
  turnRateMultiplier: number;
  /** Can the player attack while mounted? */
  canAttackMounted: boolean;
  /** Mount-specific animation GLB paths (keyed by MountAnimState) */
  animGlbs: Partial<Record<MountAnimState, string>>;
  /** Visual scale multiplier for the cavalry model */
  modelScale: number;
  /** Description for UI */
  description: string;
}

export interface MountState {
  /** Currently mounted? */
  isMounted: boolean;
  /** Which mount def key is equipped (null = none) */
  equippedMountId: string | null;
  /** Mounting/dismounting transition timer (0 = not transitioning) */
  transitionTimer: number;
  /** Is currently in mount/dismount animation? */
  isTransitioning: boolean;
  /** Cooldown before can mount again after dismounting (seconds) */
  mountCooldown: number;
}

// ── Mount Definitions ──────────────────────────────────────────

export const MOUNT_DEFS: Record<string, MountDef> = {
  war_horse: {
    name: 'War Horse',
    compatibleRaces: ['Human'],
    cavalryGlb: '/models/toon-rts/western_kingdoms/WK_Cavalry_customizable.glb',
    speedMultiplier: 1.6,
    minLevel: 10,
    turnRateMultiplier: 0.7,
    canAttackMounted: true,
    animGlbs: {
      idle: '/models/toon-rts/western_kingdoms/anims/WK_cavalry_idle.glb',
      run: '/models/toon-rts/western_kingdoms/anims/WK_cavalry_run.glb',
      death: '/models/toon-rts/western_kingdoms/anims/WK_cavalry_death.glb',
    },
    modelScale: 0.008,
    description: 'A sturdy warhorse of the Western Kingdoms. Reliable and fast.',
  },

  war_bear: {
    name: 'War Bear',
    compatibleRaces: ['Barbarian'],
    cavalryGlb: '/models/toon-rts/barbarians/BRB_Cavalry_customizable.glb',
    speedMultiplier: 1.4,
    minLevel: 10,
    turnRateMultiplier: 0.6,
    canAttackMounted: true,
    animGlbs: {},
    modelScale: 0.009,
    description: 'A massive war bear from the frozen north. Slower but hits harder.',
  },

  war_ram: {
    name: 'War Ram',
    compatibleRaces: ['Dwarf'],
    cavalryGlb: '/models/toon-rts/dwarves/DWF_Cavalry_customizable.glb',
    speedMultiplier: 1.5,
    minLevel: 10,
    turnRateMultiplier: 0.75,
    canAttackMounted: true,
    animGlbs: {
      idle: '/models/toon-rts/dwarves/anims/DWF_cavalry_idle.glb',
      run: '/models/toon-rts/dwarves/anims/DWF_cavalry_run.glb',
      death: '/models/toon-rts/dwarves/anims/DWF_cavalry_death.glb',
    },
    modelScale: 0.008,
    description: 'Armored mountain ram. Compact, agile, and charges through enemies.',
  },

  elven_stag: {
    name: 'Elven Stag',
    compatibleRaces: ['Elf'],
    cavalryGlb: '/models/toon-rts/elves/ELF_Cavalry_customizable.glb',
    speedMultiplier: 1.7,
    minLevel: 10,
    turnRateMultiplier: 0.85,
    canAttackMounted: true,
    animGlbs: {
      idle: '/models/toon-rts/elves/anims/ELF_cavalry_spear_idle.glb',
      run: '/models/toon-rts/elves/anims/ELF_cavalry_spear_run.glb',
      attack: '/models/toon-rts/elves/anims/ELF_cavalry_spear_attack.glb',
      death: '/models/toon-rts/elves/anims/ELF_cavalry_spear_death.glb',
    },
    modelScale: 0.008,
    description: 'Graceful elven stag. The fastest mount with nimble turning.',
  },

  war_wolf: {
    name: 'War Wolf',
    compatibleRaces: ['Orc'],
    cavalryGlb: '/models/toon-rts/orcs/ORC_Cavalry_Customizable.glb',
    speedMultiplier: 1.65,
    minLevel: 10,
    turnRateMultiplier: 0.8,
    canAttackMounted: true,
    animGlbs: {
      idle: '/models/toon-rts/orcs/anims/ORC_cavalry_idle.glb',
      run: '/models/toon-rts/orcs/anims/ORC_cavalry_run.glb',
      death: '/models/toon-rts/orcs/anims/ORC_cavalry_death.glb',
    },
    modelScale: 0.008,
    description: 'Fearsome wolf mount. Fast, vicious, and terrifying to enemies.',
  },

  skeletal_horse: {
    name: 'Skeletal Horse',
    compatibleRaces: ['Undead'],
    cavalryGlb: '/models/toon-rts/undead/UD_Cavalry_customizable.glb',
    speedMultiplier: 1.55,
    minLevel: 10,
    turnRateMultiplier: 0.75,
    canAttackMounted: true,
    animGlbs: {},
    modelScale: 0.008,
    description: 'Reanimated warhorse. Tireless and immune to fear.',
  },
};

// ── State Factory ──────────────────────────────────────────────

/** Create a default (dismounted) mount state */
export function createMountState(): MountState {
  return {
    isMounted: false,
    equippedMountId: null,
    transitionTimer: 0,
    isTransitioning: false,
    mountCooldown: 0,
  };
}

// ── Mount Helpers ──────────────────────────────────────────────

const MOUNT_TRANSITION_TIME = 1.0;  // seconds for mount/dismount animation
const DISMOUNT_COOLDOWN = 3.0;      // seconds before can remount

/** Get the default mount for a given race */
export function getDefaultMountForRace(race: string): string | null {
  for (const [id, def] of Object.entries(MOUNT_DEFS)) {
    if (def.compatibleRaces.includes(race)) return id;
  }
  return null;
}

/** Get all mounts compatible with a race */
export function getMountsForRace(race: string): { id: string; def: MountDef }[] {
  return Object.entries(MOUNT_DEFS)
    .filter(([, def]) => def.compatibleRaces.includes(race))
    .map(([id, def]) => ({ id, def }));
}

/** Check if a player can mount right now */
export function canMount(state: MountState, playerLevel: number, race: string): boolean {
  if (state.isMounted || state.isTransitioning) return false;
  if (state.mountCooldown > 0) return false;
  const mountId = state.equippedMountId || getDefaultMountForRace(race);
  if (!mountId) return false;
  const def = MOUNT_DEFS[mountId];
  if (!def) return false;
  return playerLevel >= def.minLevel;
}

/** Check if player can dismount */
export function canDismount(state: MountState): boolean {
  return state.isMounted && !state.isTransitioning;
}

/** Begin mounting — returns updated state */
export function beginMount(state: MountState, race: string): MountState {
  const mountId = state.equippedMountId || getDefaultMountForRace(race);
  return {
    ...state,
    equippedMountId: mountId,
    isTransitioning: true,
    transitionTimer: MOUNT_TRANSITION_TIME,
    mountCooldown: 0,
  };
}

/** Begin dismounting — returns updated state */
export function beginDismount(state: MountState): MountState {
  return {
    ...state,
    isTransitioning: true,
    transitionTimer: MOUNT_TRANSITION_TIME,
  };
}

/** Tick the mount state each frame. Returns updated state. */
export function tickMountState(state: MountState, dt: number): MountState {
  if (!state.isTransitioning && !state.isMounted && state.mountCooldown <= 0) return state;

  let next = { ...state };

  // Tick cooldown
  if (next.mountCooldown > 0) {
    next.mountCooldown = Math.max(0, next.mountCooldown - dt);
  }

  // Tick transition
  if (next.isTransitioning) {
    next.transitionTimer -= dt;
    if (next.transitionTimer <= 0) {
      next.transitionTimer = 0;
      next.isTransitioning = false;
      if (next.isMounted) {
        // Was mounted → dismount complete
        next.isMounted = false;
        next.mountCooldown = DISMOUNT_COOLDOWN;
      } else {
        // Was dismounted → mount complete
        next.isMounted = true;
      }
    }
  }

  return next;
}

/** Get the current cavalry GLB path if mounted, else null */
export function getMountedModelGlb(state: MountState): string | null {
  if (!state.isMounted || !state.equippedMountId) return null;
  return MOUNT_DEFS[state.equippedMountId]?.cavalryGlb ?? null;
}

/** Get the speed multiplier for the current mount state */
export function getMountSpeedMultiplier(state: MountState): number {
  if (!state.isMounted || !state.equippedMountId) return 1.0;
  if (state.isTransitioning) return 0.3; // Slow during mount/dismount
  return MOUNT_DEFS[state.equippedMountId]?.speedMultiplier ?? 1.0;
}

/** Get the turn rate multiplier for the current mount state */
export function getMountTurnMultiplier(state: MountState): number {
  if (!state.isMounted || !state.equippedMountId) return 1.0;
  return MOUNT_DEFS[state.equippedMountId]?.turnRateMultiplier ?? 1.0;
}

/** Can the player attack in the current mount state? */
export function canAttackWhileMounted(state: MountState): boolean {
  if (!state.isMounted || state.isTransitioning) return !state.isMounted;
  return MOUNT_DEFS[state.equippedMountId ?? '']?.canAttackMounted ?? false;
}

/** Get the mount animation GLB for a given animation state */
export function getMountAnimGlb(state: MountState, animState: MountAnimState): string | null {
  if (!state.equippedMountId) return null;
  return MOUNT_DEFS[state.equippedMountId]?.animGlbs[animState] ?? null;
}

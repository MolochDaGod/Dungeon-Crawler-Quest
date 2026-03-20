/**
 * Portal / Waypoint System — Diablo-style teleport network
 *
 * Portal Types:
 *   - Boss Death Portal (large sprite) — spawns after boss death, returns to town
 *   - Town Portal (small sprite) — placed in towns/safe zones, press E to unlock
 *   - World Map Portal — once unlocked, press E on any portal to open destination UI
 *
 * Sprites: large portal from dungeon-objects pack, small from same
 */

export interface PortalLocation {
  id: string;
  name: string;
  zone: string; // 'town', 'dungeon', 'open_world'
  worldX: number;
  worldY: number;
  unlocked: boolean;
  spriteType: 'large' | 'small';
  destinationType: 'town' | 'dungeon_entrance' | 'waypoint' | 'boss_exit';
}

export interface PortalState {
  unlockedPortals: string[]; // IDs of portals the player has discovered
  lastUsedPortalId: string | null;
}

// ── Predefined portal locations ──

export const WORLD_PORTALS: PortalLocation[] = [
  { id: 'town_main',     name: 'Grudge Town',         zone: 'town',       worldX: 200,  worldY: 200,  unlocked: true,  spriteType: 'small', destinationType: 'town' },
  { id: 'town_harbor',   name: 'Harbor District',     zone: 'town',       worldX: 800,  worldY: 300,  unlocked: false, spriteType: 'small', destinationType: 'town' },
  { id: 'wp_forest',     name: 'Darkwood Clearing',   zone: 'open_world', worldX: 1200, worldY: 600,  unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'wp_caves',      name: 'Crystal Caverns',     zone: 'open_world', worldX: 1800, worldY: 400,  unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'wp_ruins',      name: 'Ancient Ruins',       zone: 'open_world', worldX: 2200, worldY: 900,  unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'wp_volcano',    name: 'Ember Peak',          zone: 'open_world', worldX: 2800, worldY: 1200, unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'wp_swamp',      name: 'Rotting Marshes',     zone: 'open_world', worldX: 600,  worldY: 1400, unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'wp_peak',       name: 'Frostwind Summit',    zone: 'open_world', worldX: 3200, worldY: 200,  unlocked: false, spriteType: 'small', destinationType: 'waypoint' },
  { id: 'dng_goblin',    name: 'Goblin Warren',       zone: 'dungeon',    worldX: 1400, worldY: 800,  unlocked: false, spriteType: 'small', destinationType: 'dungeon_entrance' },
  { id: 'dng_crypt',     name: 'Undead Crypt',        zone: 'dungeon',    worldX: 2000, worldY: 500,  unlocked: false, spriteType: 'small', destinationType: 'dungeon_entrance' },
  { id: 'dng_fortress',  name: 'Shadow Fortress',     zone: 'dungeon',    worldX: 2600, worldY: 1000, unlocked: false, spriteType: 'small', destinationType: 'dungeon_entrance' },
];

// ── Storage ──

const PORTAL_STORAGE_KEY = 'grudge_portal_state';

export function loadPortalState(): PortalState {
  try {
    const raw = localStorage.getItem(PORTAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { unlockedPortals: ['town_main'], lastUsedPortalId: null };
}

export function savePortalState(state: PortalState): void {
  localStorage.setItem(PORTAL_STORAGE_KEY, JSON.stringify(state));
}

// ── Actions ──

export function unlockPortal(state: PortalState, portalId: string): PortalState {
  if (state.unlockedPortals.includes(portalId)) return state;
  const updated = { ...state, unlockedPortals: [...state.unlockedPortals, portalId] };
  savePortalState(updated);
  console.log(`[Portal] Unlocked: ${portalId}`);
  return updated;
}

export function getUnlockedPortals(state: PortalState): PortalLocation[] {
  return WORLD_PORTALS.filter(p => state.unlockedPortals.includes(p.id));
}

export function isPortalUnlocked(state: PortalState, portalId: string): boolean {
  return state.unlockedPortals.includes(portalId);
}

export function getNearbyPortal(
  worldX: number,
  worldY: number,
  interactionRadius = 60
): PortalLocation | null {
  for (const portal of WORLD_PORTALS) {
    const dx = worldX - portal.worldX;
    const dy = worldY - portal.worldY;
    if (Math.sqrt(dx * dx + dy * dy) < interactionRadius) {
      return portal;
    }
  }
  return null;
}

/**
 * Handle E key press near a portal:
 * - If portal is not unlocked → unlock it, show "Portal Discovered!" message
 * - If portal is unlocked → open waypoint selection UI (caller handles UI display)
 */
export function interactWithPortal(
  state: PortalState,
  portalId: string
): { action: 'unlocked' | 'open_map'; state: PortalState; portal: PortalLocation | undefined } {
  const portal = WORLD_PORTALS.find(p => p.id === portalId);
  if (!portal) return { action: 'open_map', state, portal: undefined };

  if (!state.unlockedPortals.includes(portalId)) {
    const newState = unlockPortal(state, portalId);
    return { action: 'unlocked', state: newState, portal };
  }

  return { action: 'open_map', state, portal };
}

/**
 * Create a boss-death portal (large sprite) at a position.
 * This is a temporary portal that teleports player back to town.
 */
export function createBossDeathPortal(x: number, y: number): {
  x: number; y: number;
  type: 'boss_exit';
  spriteType: 'large';
  destinationId: string;
} {
  return {
    x, y,
    type: 'boss_exit',
    spriteType: 'large',
    destinationId: 'town_main',
  };
}

// ── Sprite paths for rendering ──

export const PORTAL_SPRITES = {
  large: '/assets/packs/dungeon-objects/pedestals.png', // Large portal (boss death)
  small: '/assets/packs/dungeon-objects/Other_objects.png', // Small portal (town waypoint)
  fire_trap: '/assets/packs/dungeon-objects/fire_trap.png',
  trap_saw: '/assets/packs/dungeon-objects/trap_saw.png',
  trap_plate: '/assets/packs/dungeon-objects/trap_plate.png',
};

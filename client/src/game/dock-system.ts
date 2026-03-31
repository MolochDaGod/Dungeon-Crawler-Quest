/**
 * Dock Ownership + Boat Crafting System
 *
 * Docks are key world objectives placed at brown-marked coastal positions.
 *
 * Ownership rules:
 *   Zones 2, 4, 5, 6: Faction-owned docks (Fabled, Solden Tuisds, Neutral, Legion).
 *     Cannot be captured — always belong to their faction.
 *   Zones 1, 3, 7, 8, 9: Player-capturable docks.
 *     Capture by: killing the current owner NPC, or standing on dock for CAPTURE_TIME
 *     if owner is absent. After 1 hour with no player, NPC defenders respawn.
 *     Ownership goes to the capturing player/party/guild.
 *
 * Dock layout (built from WoodenDock + Houses_on_water packs):
 *   1. Waterfront house (Houses_on_water) at the dock start (land side)
 *   2. Wooden dock extends out over water (Floor_Dock pieces)
 *   3. Boat crafting circle at the dock end (over water)
 *      → Standing in circle opens UI for boat crafting
 *      → If player already has a boat, opens deploy UI instead
 *
 * Boat deploy options:
 *   - "Fast Travel" — teleport to another owned/friendly dock
 *   - "Take Off" — spawn boat in water, player boards and controls it
 */

// ── Types ──────────────────────────────────────────────────────

export type DockOwnerType = "player" | "faction" | "npc" | "none";

export interface DockState {
  id: string;
  zoneId: number;
  /** World position of the dock start (land side, where house sits) */
  startX: number;
  startY: number;
  /** World position of the dock end (over water, boat crafting circle) */
  endX: number;
  endY: number;
  /** Facing angle of the dock (radians, toward water) */
  facing: number;
  /** Current owner */
  owner: DockOwnerType;
  ownerPlayerId: string | null;
  ownerGuildId: string | null;
  ownerFaction: string | null;
  /** Can this dock be captured by players? */
  capturable: boolean;
  /** NPC defenders (respawn after DEFENDER_RESPAWN_TIME if no player) */
  defenders: DockDefenderDef[];
  defendersAlive: number;
  /** Time since last player was at this dock (seconds) */
  timeSincePlayerPresent: number;
  /** Capture progress (0 to CAPTURE_TIME) when enemy standing on dock */
  captureProgress: number;
  capturePlayerId: string | null;
  /** Is the boat crafting circle active (player standing in it)? */
  craftingCircleActive: boolean;
}

export interface DockDefenderDef {
  type: string;
  level: number;
  alive: boolean;
  respawnTimer: number;
}

export interface BoatDef {
  id: string;
  name: string;
  /** Materials required to craft */
  materials: { item: string; count: number }[];
  speed: number;
  hp: number;
  /** Passenger capacity */
  seats: number;
  model: string;
}

export interface PlayerBoat {
  boatId: string;
  /** Which dock it's stored at (null = in player inventory) */
  dockedAt: string | null;
  hp: number;
  maxHp: number;
  deployed: boolean;
  worldX: number;
  worldY: number;
}

// ── Constants ──────────────────────────────────────────────────

/** Seconds to stand on dock to capture (if owner absent) */
export const CAPTURE_TIME = 30;

/** Seconds before NPC defenders respawn after no player presence */
export const DEFENDER_RESPAWN_TIME = 3600; // 1 hour

/** Radius of the boat crafting circle at dock end */
export const CRAFT_CIRCLE_RADIUS = 150;

/** Radius to detect player "on dock" for capture */
export const DOCK_INTERACT_RADIUS = 200;

/** Zones where docks are faction-owned (cannot be captured) */
const FACTION_DOCK_ZONES: Record<number, string> = {
  2: "Fabled",
  4: "Solden Tuisds",
  5: "Neutral",
  6: "Legion",
};

// ── Asset paths ────────────────────────────────────────────────

export const DOCK_ASSETS = {
  // Dock structure pieces (WoodenDock pack)
  floorDock: "/assets/structures/wooden-dock/Fbx/Floor_Dock.fbx",
  floorDockEnd: "/assets/structures/wooden-dock/Fbx/Floor_Dock_End.fbx",
  floorDockHalf: "/assets/structures/wooden-dock/Fbx/Floor_Dock_Half.fbx",
  floorSupport: "/assets/structures/wooden-dock/Fbx/Floor_Support.fbx",
  bollard: "/assets/structures/wooden-dock/Fbx/Dock_Bollard_1.fbx",
  fencePost: "/assets/structures/wooden-dock/Fbx/Fence_Post.fbx",
  fencePlane: "/assets/structures/wooden-dock/Fbx/Fence_Plane.fbx",
  lantern: "/assets/structures/wooden-dock/Fbx/Lantern_Body.fbx",
  post: "/assets/structures/wooden-dock/Fbx/Post.fbx",
  barrel: "/assets/structures/wooden-dock/Fbx/Props_Barrel.fbx",
  crate: "/assets/structures/wooden-dock/Fbx/Props_Crate.fbx",
  boatSmall: "/assets/structures/wooden-dock/Fbx/Boat_A_1.fbx",
  boatMedium: "/assets/structures/wooden-dock/Fbx/Boat_B_1.fbx",
  boatStand: "/assets/structures/wooden-dock/Fbx/Boat_Stand.fbx",
  roofA: "/assets/structures/wooden-dock/Fbx/Roof_A.fbx",
  wallA: "/assets/structures/wooden-dock/Fbx/Wall_A.fbx",
  wallWindow: "/assets/structures/wooden-dock/Fbx/Wall_A_Window.fbx",
  wallDoor: "/assets/structures/wooden-dock/Fbx/Wall_A_Door.fbx",
  fullDockGLB: "/assets/structures/wooden-dock/Glb/WoodenDockSet.glb",
};

// ── Boat recipes ───────────────────────────────────────────────

export const BOAT_RECIPES: BoatDef[] = [
  {
    id: "rowboat",
    name: "Rowboat",
    materials: [{ item: "wood", count: 20 }, { item: "rope", count: 5 }],
    speed: 60, hp: 100, seats: 2,
    model: DOCK_ASSETS.boatSmall,
  },
  {
    id: "sailboat",
    name: "Sailboat",
    materials: [{ item: "wood", count: 50 }, { item: "rope", count: 15 }, { item: "cloth", count: 10 }],
    speed: 100, hp: 250, seats: 4,
    model: DOCK_ASSETS.boatMedium,
  },
  {
    id: "warship",
    name: "War Galley",
    materials: [{ item: "wood", count: 120 }, { item: "rope", count: 30 }, { item: "iron", count: 20 }, { item: "cloth", count: 25 }],
    speed: 80, hp: 600, seats: 8,
    model: DOCK_ASSETS.boatMedium,
  },
];

// ── Factory ────────────────────────────────────────────────────

export function createDockState(
  id: string, zoneId: number,
  startX: number, startY: number,
  endX: number, endY: number,
  facing: number,
): DockState {
  const factionOwner = FACTION_DOCK_ZONES[zoneId] ?? null;
  const capturable = !factionOwner;

  const defenders: DockDefenderDef[] = capturable
    ? [
        { type: "Dock Guard", level: 5, alive: true, respawnTimer: 0 },
        { type: "Dock Guard", level: 5, alive: true, respawnTimer: 0 },
        { type: "Dock Captain", level: 7, alive: true, respawnTimer: 0 },
      ]
    : [];

  return {
    id, zoneId, startX, startY, endX, endY, facing,
    owner: factionOwner ? "faction" : "npc",
    ownerPlayerId: null, ownerGuildId: null,
    ownerFaction: factionOwner,
    capturable,
    defenders,
    defendersAlive: defenders.filter(d => d.alive).length,
    timeSincePlayerPresent: 0,
    captureProgress: 0, capturePlayerId: null,
    craftingCircleActive: false,
  };
}

// ── Update ─────────────────────────────────────────────────────

export interface DockUpdateResult {
  captured: boolean;
  capturedBy: string | null;
  defendersRespawned: boolean;
  openCraftUI: boolean;
  openDeployUI: boolean;
}

export function updateDock(
  dock: DockState, dt: number,
  playerX: number, playerY: number,
  playerId: string, playerHasBoat: boolean, isOwner: boolean,
): DockUpdateResult {
  const result: DockUpdateResult = {
    captured: false, capturedBy: null,
    defendersRespawned: false,
    openCraftUI: false, openDeployUI: false,
  };

  if (!dock.capturable) return result;

  const distStart = Math.sqrt((playerX - dock.startX) ** 2 + (playerY - dock.startY) ** 2);
  const distEnd = Math.sqrt((playerX - dock.endX) ** 2 + (playerY - dock.endY) ** 2);
  const playerNearDock = distStart < DOCK_INTERACT_RADIUS * 3;
  const playerOnDock = distStart < DOCK_INTERACT_RADIUS;
  const playerInCraftCircle = distEnd < CRAFT_CIRCLE_RADIUS;

  // Player presence tracking
  if (playerNearDock) {
    dock.timeSincePlayerPresent = 0;
  } else {
    dock.timeSincePlayerPresent += dt;
  }

  // NPC defender respawn (1 hour no player)
  if (dock.timeSincePlayerPresent >= DEFENDER_RESPAWN_TIME && dock.owner !== "player") {
    for (const def of dock.defenders) {
      def.alive = true;
      def.respawnTimer = 0;
    }
    dock.defendersAlive = dock.defenders.length;
    dock.owner = "npc";
    dock.ownerPlayerId = null;
    dock.ownerGuildId = null;
    dock.captureProgress = 0;
    result.defendersRespawned = true;
  }

  // Capture logic
  dock.defendersAlive = dock.defenders.filter(d => d.alive).length;

  if (playerOnDock && !isOwner && dock.defendersAlive === 0) {
    dock.capturePlayerId = playerId;
    dock.captureProgress += dt;
    if (dock.captureProgress >= CAPTURE_TIME) {
      dock.owner = "player";
      dock.ownerPlayerId = playerId;
      dock.captureProgress = 0;
      dock.capturePlayerId = null;
      result.captured = true;
      result.capturedBy = playerId;
    }
  } else if (dock.capturePlayerId === playerId) {
    dock.captureProgress = Math.max(0, dock.captureProgress - dt * 2);
  }

  // Boat crafting / deploy circle
  if (playerInCraftCircle) {
    dock.craftingCircleActive = true;
    result.openDeployUI = playerHasBoat;
    result.openCraftUI = !playerHasBoat;
  } else {
    dock.craftingCircleActive = false;
  }

  return result;
}

// ── Helpers ────────────────────────────────────────────────────

export function computeDockEndpoints(
  poiX: number, poiY: number, facing: number, length: number = 400,
): { startX: number; startY: number; endX: number; endY: number } {
  return {
    startX: poiX,
    startY: poiY,
    endX: poiX + Math.cos(facing) * length,
    endY: poiY + Math.sin(facing) * length,
  };
}

export function createZoneDocks(
  zoneId: number,
  dockPois: { id: string; x: number; y: number }[],
): DockState[] {
  return dockPois.map(poi => {
    const cx = 8000, cy = 8000;
    const facing = Math.atan2(poi.y - cy, poi.x - cx);
    const { startX, startY, endX, endY } = computeDockEndpoints(poi.x, poi.y, facing, 400);
    return createDockState(poi.id, zoneId, startX, startY, endX, endY, facing);
  });
}

// ── Global asset registries ────────────────────────────────────

/** Harvestable rocks — used in ALL zones for mining profession */
export const GLOBAL_ROCK_ASSETS = {
  rockSet: "/assets/rocks/rocks-set-global/RockSet.gltf",
  rockSetFBX: "/assets/rocks/rocks-set-global/RockSet.fbx",
};

/** Dungeon interior models — used for ALL dungeon instances */
export const DUNGEON_ASSETS_PATH = "/assets/structures/dungeon-remastered/";

/** Fantasy props — loot drops, world decorations, set pieces */
export const FANTASY_PROPS_PATH = "/assets/props/fantasy-megakit/";

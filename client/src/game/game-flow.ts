/**
 * DCQ game flow SSOT — modes, handoff, farm progression.
 * Creeps (WC3 neutrals) are part of the 3D dungeon / sandbox farm loop.
 */

export type GameModeId =
  | "arena"
  | "openworld"
  | "dungeon"
  | "dungeon3d"
  | "sandbox"
  | "arena_fighter"
  | "spaceconquest";

export interface GameModeDef {
  id: GameModeId;
  label: string;
  route: string;
  blurb: string;
  features: string[];
}

export const GAME_MODES: GameModeDef[] = [
  {
    id: "openworld",
    label: "Open World",
    route: "/open-world",
    blurb: "Villages, farms, camps — TVS world content.",
    features: ["explorer", "villages"],
  },
  {
    id: "arena",
    label: "MOBA Arena",
    route: "/game",
    blurb: "Top-down 5v5 MOBA.",
    features: ["moba"],
  },
  {
    id: "dungeon",
    label: "DCQ Crypt",
    route: "/dungeon",
    blurb: "Top-down crypt · 10 floors.",
    features: ["2d-dungeon"],
  },
  {
    id: "dungeon3d",
    label: "3D Dungeon Farm",
    route: "/dungeon3d",
    blurb: "TPS dungeon + WC3-style neutral creeps that drop gold & materials.",
    features: ["explorer", "soft-lock", "weapon-skills", "neutral-creeps", "farm-loot"],
  },
  {
    id: "sandbox",
    label: "Sandbox",
    route: "/sandbox",
    blurb: "Physics sandbox — spawn creeps (N), props (M), skills 1–4.",
    features: ["explorer", "physics", "neutral-creeps", "farm-loot"],
  },
  {
    id: "arena_fighter",
    label: "Arena Fighter",
    route: "/arena",
    blurb: "1v1 explorer fighters.",
    features: ["explorer", "melee"],
  },
];

const MODE_KEY = "grudge_mode";
const FARM_STATS_KEY = "grudge_farm_stats";

export function setActiveMode(id: GameModeId): void {
  localStorage.setItem(MODE_KEY, id);
}

export function getActiveMode(): GameModeId {
  const m = localStorage.getItem(MODE_KEY) as GameModeId | null;
  return m || "openworld";
}

export function routeForMode(id: GameModeId): string {
  return GAME_MODES.find((m) => m.id === id)?.route || "/";
}

export interface FarmStats {
  gold: number;
  kills: number;
  byCreep: Record<string, number>;
  lastLoot: string;
  updatedAt: number;
}

export function getFarmStats(): FarmStats {
  try {
    const raw = localStorage.getItem(FARM_STATS_KEY);
    if (raw) return JSON.parse(raw) as FarmStats;
  } catch {
    /* ignore */
  }
  return { gold: 0, kills: 0, byCreep: {}, lastLoot: "", updatedAt: 0 };
}

export function recordFarmKill(
  creepId: string,
  gold: number,
  lootLine: string,
): FarmStats {
  const s = getFarmStats();
  s.gold += gold;
  s.kills += 1;
  s.byCreep[creepId] = (s.byCreep[creepId] || 0) + 1;
  s.lastLoot = lootLine;
  s.updatedAt = Date.now();
  localStorage.setItem(FARM_STATS_KEY, JSON.stringify(s));
  return s;
}

/** R2 keys once mirrored (see ObjectStore scripts/mirror-neutral-creeps.mjs). */
export const CREEP_R2_PREFIX = "models/creeps/threejs-games";
export const CREEP_CDN =
  "https://assets.grudge-studio.com/" + CREEP_R2_PREFIX;

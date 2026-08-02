/**
 * TVS Voxel CDN SSOT for DCQ MOBA + Dungeon modes (GrudgeDot fleet).
 * Binary assets: https://assets.grudge-studio.com/models/voxels/tvs/
 * Roster: unit-roster.json · Settlements: settlements.json (VoxGrudge pipeline)
 */

export const TVS_CDN = "https://assets.grudge-studio.com";
export const TVS_PREFIX = `${TVS_CDN}/models/voxels/tvs`;
export const TVS_ROSTER_URL = `${TVS_PREFIX}/unit-roster.json`;
export const TVS_CATALOG_URL = `${TVS_PREFIX}/catalog.json`;
export const TVS_SETTLEMENTS_URL = "/tvs/settlements.json";

export function tvsEnv(pack: string, slug: string): string {
  return `${TVS_PREFIX}/${pack}/environment/${slug}.fbx`;
}

export function tvsProp(pack: string, slug: string): string {
  return `${TVS_PREFIX}/${pack}/props/${slug}.fbx`;
}

export function tvsChar(pack: string, slug: string): string {
  return `${TVS_PREFIX}/${pack}/characters/${slug}.fbx`;
}

export function tvsTex(pack: string, slug: string): string {
  return `${TVS_PREFIX}/${pack}/textures/${slug}-texture.png`;
}

/** MOBA tower / nexus / lane structures */
export const TVS_MOBA = {
  tower: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-tower"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-tower"),
    scale: 0.012,
  },
  towerDoor: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-tower-with-door"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-tower-with-door"),
    scale: 0.012,
  },
  keep: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-keep"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-keep"),
    scale: 0.01,
  },
  wall: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-wall"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-wall"),
    scale: 0.012,
  },
  gate: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-gate"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-gate"),
    scale: 0.012,
  },
  rangerTower: {
    modelPath: tvsEnv("voxel-rangers", "voxel-rangers-tower"),
    texturePath: tvsTex("voxel-rangers", "voxel-rangers-tower"),
    scale: 0.012,
  },
  wizardTower: {
    modelPath: tvsEnv("voxel-wizards", "voxel-wizards-tower"),
    texturePath: tvsTex("voxel-wizards", "voxel-wizards-tower"),
    scale: 0.01,
  },
  banner: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-banner"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-banner"),
    scale: 0.015,
  },
  campfire: {
    modelPath: tvsEnv("voxel-rangers", "voxel-rangers-campfire-frame1"),
    texturePath: tvsTex("voxel-rangers", "voxel-rangers-campfire-frame1"),
    scale: 0.02,
  },
  tent: {
    modelPath: tvsEnv("voxel-rangers", "voxel-rangers-tent"),
    texturePath: tvsTex("voxel-rangers", "voxel-rangers-tent"),
    scale: 0.015,
  },
} as const;

/** Dungeon / crypt dressing */
export const TVS_DUNGEON = {
  cathedral: {
    modelPath: tvsEnv("voxel-cathedral", "voxel-cathedral-cathedral"),
    texturePath: tvsTex("voxel-cathedral", "voxel-cathedral-cathedral"),
    scale: 0.008,
  },
  statue: {
    modelPath: tvsEnv("voxel-cathedral", "voxel-cathedral-statue"),
    texturePath: tvsTex("voxel-cathedral", "voxel-cathedral-statue"),
    scale: 0.015,
  },
  grave: {
    modelPath: tvsEnv("voxel-cathedral", "voxel-cathedral-grave"),
    texturePath: tvsTex("voxel-cathedral", "voxel-cathedral-grave"),
    scale: 0.02,
  },
  swordStone: {
    modelPath: tvsEnv("voxel-wizards", "voxel-wizards-sword-in-stone"),
    texturePath: tvsTex("voxel-wizards", "voxel-wizards-sword-in-stone"),
    scale: 0.02,
  },
  chest: {
    modelPath: tvsEnv("voxel-knights", "voxel-knights-chest"),
    texturePath: tvsTex("voxel-knights", "voxel-knights-chest"),
    scale: 0.02,
  },
  torch: {
    modelPath: tvsProp("voxel-cathedral", "voxel-cathedral-staff"),
    texturePath: tvsTex("voxel-cathedral", "voxel-cathedral-staff"),
    scale: 0.02,
  },
} as const;

/** Class → TVS unit roster preference (CDN FBX) */
export const TVS_HERO_BY_CLASS: Record<string, { pack: string; slug: string }> = {
  warrior: { pack: "voxel-knights", slug: "voxel-knights-champion" },
  melee: { pack: "voxel-knights", slug: "voxel-knights-knight" },
  ranger: { pack: "voxel-rangers", slug: "voxel-rangers-archer" },
  ranged: { pack: "voxel-rangers", slug: "voxel-rangers-long-hair" },
  mage: { pack: "voxel-wizards", slug: "voxel-wizards-wizard" },
  magic: { pack: "voxel-wizards", slug: "voxel-wizards-warlock" },
  worge: { pack: "voxel-knights", slug: "voxel-knights-captain" },
  paladin: { pack: "voxel-cathedral", slug: "voxel-cathedral-crusader" },
  priest: { pack: "voxel-cathedral", slug: "voxel-cathedral-priest" },
};

export function tvsHeroPrefab(heroClass: string): {
  modelPath: string;
  texturePath: string;
  scale: number;
  format: "fbx";
} {
  const key = (heroClass || "warrior").toLowerCase();
  const m = TVS_HERO_BY_CLASS[key] || TVS_HERO_BY_CLASS.warrior;
  return {
    modelPath: tvsChar(m.pack, m.slug),
    texturePath: tvsTex(m.pack, m.slug),
    scale: 0.012,
    format: "fbx",
  };
}

export interface TvsUnitRow {
  unitId: string;
  displayName: string;
  modelUrl: string;
  textureUrl?: string;
  classHint?: string;
  grudgeUuid?: string;
  pack?: string;
}

let rosterCache: { units: TvsUnitProps[] } | null = null;

export async function loadTvsRoster(force = false): Promise<{ units: TvsUnitProps[] }> {
  if (rosterCache && !force) return rosterCache;
  try {
    const res = await fetch(TVS_ROSTER_URL, { mode: "cors" });
    if (!res.ok) throw new Error(String(res.status));
    rosterCache = await res.json();
    return rosterCache!;
  } catch {
    return { units: [] };
  }
}

export function pickTvsUnit(
  roster: { units: TvsUnitProps[] },
  classHint: string,
): TvsUnitProps | null {
  const units = roster.units || [];
  return units.find((u) => u.classHint === classHint) || units[0] || null;
}

/** Feature flag — prefer TVS CDN over local /assets when true */
export const USE_TVS_CDN =
  typeof window === "undefined" ||
  localStorage.getItem("grudge_tvs_cdn") !== "0";

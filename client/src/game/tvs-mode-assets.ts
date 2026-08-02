/**
 * Mode-specific TVS placement for MOBA (top-down) and Dungeon Crawler.
 * Builds decoration lists for three-renderer / dungeon3d / GrudgeDot embeds.
 */
import {
  TVS_MOBA,
  TVS_DUNGEON,
  tvsChar,
  tvsTex,
  tvsEnv,
  type TvsUnitProps,
  loadTvsRoster,
  pickTvsUnit,
} from "@/lib/tvs-cdn";

export type ModePlacement = {
  id: string;
  modelPath: string;
  texturePath?: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY?: number;
  role: "tower" | "nexus" | "decor" | "jungle" | "dungeon" | "hero" | "minion";
  format?: "fbx" | "glb";
};

/** Classic 3-lane MOBA layout in world units (matches engine ~4000 map scaled down for 3D). */
export function planMobaTvsDecor(mapScale = 1): ModePlacement[] {
  const s = mapScale;
  const lanes = [-1, 0, 1];
  const out: ModePlacement[] = [];

  // Nexus (keeps)
  out.push({
    id: "nexus-blue",
    ...TVS_MOBA.keep,
    x: 0,
    y: 0,
    z: 38 * s,
    role: "nexus",
    format: "fbx",
  });
  out.push({
    id: "nexus-red",
    ...TVS_MOBA.keep,
    x: 0,
    y: 0,
    z: -38 * s,
    role: "nexus",
    format: "fbx",
  });

  // Outer + inner towers per lane
  lanes.forEach((lane, i) => {
    const x = lane * 18 * s;
    const towerKinds = [TVS_MOBA.tower, TVS_MOBA.rangerTower, TVS_MOBA.wizardTower];
    const kind = towerKinds[i % 3];
    out.push({
      id: `tower-blue-outer-${lane}`,
      ...kind,
      x,
      y: 0,
      z: 22 * s,
      role: "tower",
      format: "fbx",
    });
    out.push({
      id: `tower-blue-inner-${lane}`,
      ...TVS_MOBA.towerDoor,
      x,
      y: 0,
      z: 30 * s,
      role: "tower",
      format: "fbx",
    });
    out.push({
      id: `tower-red-outer-${lane}`,
      ...kind,
      x,
      y: 0,
      z: -22 * s,
      role: "tower",
      format: "fbx",
    });
    out.push({
      id: `tower-red-inner-${lane}`,
      ...TVS_MOBA.towerDoor,
      x,
      y: 0,
      z: -30 * s,
      role: "tower",
      format: "fbx",
    });
  });

  // Jungle camps (ranger tents + campfires)
  const jungle = [
    { x: -28, z: 8 },
    { x: 28, z: 8 },
    { x: -28, z: -8 },
    { x: 28, z: -8 },
  ];
  jungle.forEach((p, i) => {
    out.push({
      id: `jungle-tent-${i}`,
      ...TVS_MOBA.tent,
      x: p.x * s,
      y: 0,
      z: p.z * s,
      role: "jungle",
      format: "fbx",
    });
    out.push({
      id: `jungle-fire-${i}`,
      ...TVS_MOBA.campfire,
      x: (p.x + 3) * s,
      y: 0,
      z: p.z * s,
      role: "jungle",
      format: "fbx",
    });
  });

  // Base walls
  [-1, 1].forEach((side, i) => {
    out.push({
      id: `wall-blue-${i}`,
      ...TVS_MOBA.wall,
      x: side * 10 * s,
      y: 0,
      z: 34 * s,
      role: "decor",
      format: "fbx",
    });
    out.push({
      id: `wall-red-${i}`,
      ...TVS_MOBA.wall,
      x: side * 10 * s,
      y: 0,
      z: -34 * s,
      role: "decor",
      format: "fbx",
    });
  });

  return out;
}

/** Dungeon floor dressing — crypt/cathedral props for top-down or 3D. */
export function planDungeonTvsDressing(
  floor: number,
  roomCenters: { x: number; z: number; type?: string }[],
): ModePlacement[] {
  const out: ModePlacement[] = [];
  roomCenters.forEach((r, i) => {
    const t = r.type || "normal";
    if (t === "boss" || floor % 3 === 0) {
      out.push({
        id: `d-statue-${i}`,
        ...TVS_DUNGEON.statue,
        x: r.x,
        y: 0,
        z: r.z,
        role: "dungeon",
        format: "fbx",
      });
    } else if (t === "treasure") {
      out.push({
        id: `d-chest-${i}`,
        ...TVS_DUNGEON.chest,
        x: r.x,
        y: 0,
        z: r.z,
        role: "dungeon",
        format: "fbx",
      });
    } else if (t === "crypt") {
      out.push({
        id: `d-grave-${i}`,
        ...TVS_DUNGEON.grave,
        x: r.x,
        y: 0,
        z: r.z,
        role: "dungeon",
        format: "fbx",
      });
    } else if (i === 0) {
      out.push({
        id: `d-sword-${i}`,
        ...TVS_DUNGEON.swordStone,
        x: r.x,
        y: 0,
        z: r.z,
        role: "dungeon",
        format: "fbx",
      });
    }
  });
  return out;
}

export async function resolveMobaMinionUnits(): Promise<{
  melee: TvsUnitProps | null;
  ranged: TvsUnitProps | null;
  magic: TvsUnitProps | null;
}> {
  const roster = await loadTvsRoster();
  return {
    melee: pickTvsUnit(roster, "melee"),
    ranged: pickTvsUnit(roster, "ranged"),
    magic: pickTvsUnit(roster, "magic"),
  };
}

export function villageCampPrefabs() {
  return {
    inn: {
      modelPath: tvsEnv("voxel-village", "voxel-village-inn"),
      texturePath: tvsTex("voxel-village", "voxel-village-inn"),
      scale: 0.012,
      format: "fbx" as const,
    },
    house: {
      modelPath: tvsEnv("voxel-village", "voxel-village-house"),
      texturePath: tvsTex("voxel-village", "voxel-village-house"),
      scale: 0.012,
      format: "fbx" as const,
    },
    shop: {
      modelPath: tvsEnv("voxel-village", "voxel-village-shop"),
      texturePath: tvsTex("voxel-village", "voxel-village-shop"),
      scale: 0.012,
      format: "fbx" as const,
    },
  };
}

export function tvsChampionPaths(classHint: string) {
  const map: Record<string, string> = {
    melee: "voxel-knights-champion",
    ranged: "voxel-rangers-archer",
    magic: "voxel-wizards-wizard",
    warrior: "voxel-knights-champion",
    ranger: "voxel-rangers-archer",
    mage: "voxel-wizards-wizard",
  };
  const slug = map[classHint] || map.melee;
  const pack = slug.startsWith("voxel-knights")
    ? "voxel-knights"
    : slug.startsWith("voxel-rangers")
      ? "voxel-rangers"
      : "voxel-wizards";
  return {
    modelPath: tvsChar(pack, slug),
    texturePath: tvsTex(pack, slug),
    scale: 0.012,
    format: "fbx" as const,
  };
}

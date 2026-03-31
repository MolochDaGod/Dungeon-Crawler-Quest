/**
 * Town Buildings — Enterable structures placed in safe-zone towns.
 * Each building has a world-space door trigger, an interior layout,
 * and zero or more interior NPCs.
 */

// ── Types ──────────────────────────────────────────────────────

export type BuildingType = 'inn' | 'blacksmith' | 'guild' | 'shop' | 'trainer' | 'barracks' | 'armory';

export interface InteriorFurniture {
  type: 'table' | 'shelf' | 'barrel' | 'chest' | 'anvil' | 'bed' | 'counter' | 'fireplace' | 'bookcase' | 'rack';
  ix: number; // interior x (0..1 relative to room)
  iy: number; // interior y (0..1 relative to room)
}

export interface InteriorNPCDef {
  name: string;
  role: 'vendor' | 'innkeeper' | 'trainer' | 'quest' | 'blacksmith' | 'guard';
  appearance?: 'default' | 'blacksmith' | 'hunter' | 'child';
  assetId?: string;
  ix: number; // interior x (0..1)
  iy: number; // interior y (0..1)
  /** Greeting lines (one picked randomly) */
  dialogue: string[];
}

export interface TownBuilding {
  id: string;
  name: string;
  type: BuildingType;
  zoneId: number;
  /** World-space door position (where player presses E to enter) */
  doorX: number;
  doorY: number;
  /** Building exterior rect (for drawing) */
  wx: number; wy: number; ww: number; wh: number;
  /** Interior room pixel dimensions */
  roomW: number; roomH: number;
  furniture: InteriorFurniture[];
  npcs: InteriorNPCDef[];
  /** Floor color */
  floorColor: string;
  /** Wall color */
  wallColor: string;
}

// ── Building definitions per zone ─────────────────────────────

/** Helper: make a building, placing door at the bottom centre */
function makeBldg(
  id: string, name: string, type: BuildingType, zoneId: number,
  wx: number, wy: number, ww: number, wh: number,
  furniture: InteriorFurniture[], npcs: InteriorNPCDef[],
  floorColor = '#8b6914', wallColor = '#5a3a1a',
): TownBuilding {
  return {
    id, name, type, zoneId,
    doorX: wx + ww / 2,
    doorY: wy + wh + 4,
    wx, wy, ww, wh,
    roomW: 320, roomH: 260,
    furniture, npcs,
    floorColor, wallColor,
  };
}

// ── Zone 0: Starting Village ───────────────────────────────────
// Village centre is ~4000, 4000

const Z0_CX = 4000, Z0_CY = 4000;

export const ZONE0_BUILDINGS: TownBuilding[] = [
  makeBldg('z0-inn', 'The Rusty Flagon Inn', 'inn', 0,
    Z0_CX + 260, Z0_CY + 80, 90, 70,
    [
      { type: 'fireplace', ix: 0.5, iy: 0.15 },
      { type: 'table', ix: 0.3, iy: 0.4 },
      { type: 'table', ix: 0.7, iy: 0.4 },
      { type: 'barrel', ix: 0.15, iy: 0.7 },
      { type: 'barrel', ix: 0.85, iy: 0.7 },
      { type: 'bed', ix: 0.2, iy: 0.8 },
      { type: 'bed', ix: 0.8, iy: 0.8 },
    ],
    [{ name: 'Innkeeper Rose', role: 'innkeeper', ix: 0.5, iy: 0.25, dialogue: ['Welcome, weary traveler!', 'Rest thy sword, friend.', 'A warm bed awaits for 10 gold.'] }],
    '#6b4218', '#4a2e10',
  ),
  makeBldg('z0-smith', 'Dunn\'s Forge', 'blacksmith', 0,
    Z0_CX + 160, Z0_CY - 80, 80, 65,
    [
      { type: 'anvil', ix: 0.4, iy: 0.35 },
      { type: 'fireplace', ix: 0.75, iy: 0.3 },
      { type: 'rack', ix: 0.15, iy: 0.4 },
      { type: 'barrel', ix: 0.8, iy: 0.7 },
    ],
    [{ name: 'Forge-Master Dunn', role: 'blacksmith', appearance: 'blacksmith', assetId: 'gc-villager-blacksmith', ix: 0.45, iy: 0.5, dialogue: ['Bring me ore and I\'ll craft wonders.', 'The anvil never rests.', 'What do you need forged?'] }],
    '#5a4030', '#3a2818',
  ),
  makeBldg('z0-shop', 'Gilda\'s General Store', 'shop', 0,
    Z0_CX - 180, Z0_CY + 160, 80, 60,
    [
      { type: 'counter', ix: 0.5, iy: 0.25 },
      { type: 'shelf', ix: 0.15, iy: 0.4 },
      { type: 'shelf', ix: 0.85, iy: 0.4 },
      { type: 'chest', ix: 0.15, iy: 0.75 },
      { type: 'barrel', ix: 0.85, iy: 0.7 },
    ],
    [
      { name: 'Merchant Gilda', role: 'vendor', appearance: 'hunter', assetId: 'gc-villager-hunter', ix: 0.42, iy: 0.4, dialogue: ['Best prices in town!', 'Looking to buy or sell?', 'Fresh stock from the capital.'] },
      { name: 'Pip the Runner', role: 'vendor', appearance: 'child', assetId: 'gc-villager-child', ix: 0.68, iy: 0.46, dialogue: ['I can carry small orders for you!', 'Need quick camp supplies?', 'The caravans brought fresh goods today.'] },
    ],
    '#7a6040', '#5a4020',
  ),
  makeBldg('z0-trainer', 'Combat Hall', 'trainer', 0,
    Z0_CX - 280, Z0_CY - 30, 80, 65,
    [
      { type: 'rack', ix: 0.2, iy: 0.3 },
      { type: 'rack', ix: 0.8, iy: 0.3 },
      { type: 'bookcase', ix: 0.15, iy: 0.6 },
      { type: 'table', ix: 0.5, iy: 0.55 },
    ],
    [{ name: 'Combat Tutor', role: 'trainer', ix: 0.5, iy: 0.35, dialogue: ['I\'ll help you grow stronger.', 'Your attributes need balance.', 'Training sharpens the mind and blade.'] }],
    '#4a4030', '#2a2018',
  ),
  makeBldg('z0-guild', 'Heroes Guild', 'guild', 0,
    Z0_CX - 60, Z0_CY - 140, 110, 80,
    [
      { type: 'table', ix: 0.5, iy: 0.35 },
      { type: 'bookcase', ix: 0.1, iy: 0.4 },
      { type: 'bookcase', ix: 0.9, iy: 0.4 },
      { type: 'chest', ix: 0.2, iy: 0.75 },
      { type: 'chest', ix: 0.8, iy: 0.75 },
      { type: 'fireplace', ix: 0.5, iy: 0.12 },
    ],
    [
      { name: 'Elder Maren', role: 'quest', ix: 0.35, iy: 0.5, dialogue: ['The village needs your aid, adventurer.', 'Dark tidings from the forest...', 'Will you answer the call?'] },
      { name: 'Guild Archivist', role: 'vendor', appearance: 'hunter', assetId: 'gc-villager-hunter', ix: 0.65, iy: 0.5, dialogue: ['All mission records are here.', 'I can issue you a contract.'] },
    ],
    '#5a4a30', '#3a2e18',
  ),
];

// ── Zone 8: Crusade Island ─────────────────────────────────────
const Z8_CX = 10250, Z8_CY = 3250;

export const ZONE8_BUILDINGS: TownBuilding[] = [
  makeBldg('z8-inn', 'Crusader\'s Rest', 'inn', 8,
    Z8_CX - 160, Z8_CY + 120, 90, 70,
    [
      { type: 'fireplace', ix: 0.5, iy: 0.15 },
      { type: 'table', ix: 0.3, iy: 0.45 },
      { type: 'table', ix: 0.7, iy: 0.45 },
      { type: 'bed', ix: 0.2, iy: 0.78 },
      { type: 'bed', ix: 0.8, iy: 0.78 },
    ],
    [{ name: 'Innkeeper Vera', role: 'innkeeper', ix: 0.5, iy: 0.28, dialogue: ['The crusaders keep me busy.', 'Rest and prepare for battle!'] }],
    '#6b4218', '#4a2e10',
  ),
  makeBldg('z8-barracks', 'Crusader Barracks', 'barracks', 8,
    Z8_CX + 80, Z8_CY - 100, 100, 75,
    [
      { type: 'bed', ix: 0.2, iy: 0.3 }, { type: 'bed', ix: 0.5, iy: 0.3 }, { type: 'bed', ix: 0.8, iy: 0.3 },
      { type: 'rack', ix: 0.15, iy: 0.6 }, { type: 'rack', ix: 0.85, iy: 0.6 },
      { type: 'chest', ix: 0.5, iy: 0.78 },
    ],
    [{ name: 'Captain Aldric', role: 'guard', ix: 0.5, iy: 0.5, dialogue: ['Hold the line, adventurer!', 'The crusade depends on warriors like you.'] }],
    '#5a5040', '#3a3020',
  ),
  makeBldg('z8-armory', 'Crusader Armory', 'armory', 8,
    Z8_CX + 180, Z8_CY + 60, 85, 65,
    [
      { type: 'rack', ix: 0.2, iy: 0.3 }, { type: 'rack', ix: 0.5, iy: 0.3 }, { type: 'rack', ix: 0.8, iy: 0.3 },
      { type: 'anvil', ix: 0.3, iy: 0.6 },
      { type: 'counter', ix: 0.65, iy: 0.6 },
    ],
    [{ name: 'Armorer Brik', role: 'vendor', ix: 0.5, iy: 0.45, dialogue: ['Top-grade crusader gear.', 'Reinforced plate, swords, shields.'] }],
    '#5a4030', '#3a2818',
  ),
];

// ── Zone 9: Fabled Island ──────────────────────────────────────
const Z9_CX = 13250, Z9_CY = 5250;

export const ZONE9_BUILDINGS: TownBuilding[] = [
  makeBldg('z9-inn', 'Tower Rest', 'inn', 9,
    Z9_CX - 120, Z9_CY + 100, 85, 65,
    [
      { type: 'fireplace', ix: 0.5, iy: 0.15 },
      { type: 'table', ix: 0.4, iy: 0.45 },
      { type: 'bed', ix: 0.25, iy: 0.75 }, { type: 'bed', ix: 0.75, iy: 0.75 },
    ],
    [{ name: 'Innkeeper Solenne', role: 'innkeeper', ix: 0.5, iy: 0.3, dialogue: ['The mages bring odd guests.', 'Stay as long as you need.'] }],
    '#3a5060', '#1a3040',
  ),
  makeBldg('z9-guild', 'Arcane Archive', 'guild', 9,
    Z9_CX + 80, Z9_CY - 80, 100, 75,
    [
      { type: 'bookcase', ix: 0.15, iy: 0.35 }, { type: 'bookcase', ix: 0.85, iy: 0.35 },
      { type: 'table', ix: 0.5, iy: 0.4 },
      { type: 'chest', ix: 0.3, iy: 0.72 }, { type: 'chest', ix: 0.7, iy: 0.72 },
    ],
    [{ name: 'Archmage Voss', role: 'quest', ix: 0.5, iy: 0.52, dialogue: ['Ancient lore awaits the scholarly.', 'Seek wisdom beyond the veil.'] }],
    '#2a3a50', '#1a2030',
  ),
];

// ── Zone 10: Legion Outpost ────────────────────────────────────
const Z10_CX = 10250, Z10_CY = 8250;

export const ZONE10_BUILDINGS: TownBuilding[] = [
  makeBldg('z10-barracks', 'Legion Barracks', 'barracks', 10,
    Z10_CX - 140, Z10_CY - 80, 100, 75,
    [
      { type: 'bed', ix: 0.2, iy: 0.3 }, { type: 'bed', ix: 0.5, iy: 0.3 }, { type: 'bed', ix: 0.8, iy: 0.3 },
      { type: 'rack', ix: 0.15, iy: 0.65 }, { type: 'rack', ix: 0.85, iy: 0.65 },
      { type: 'table', ix: 0.5, iy: 0.65 },
    ],
    [{ name: 'Centurion Maxus', role: 'guard', ix: 0.5, iy: 0.5, dialogue: ['The Legion never rests.', 'Report for duty, soldier.'] }],
    '#4a4a3a', '#2a2a1a',
  ),
  makeBldg('z10-armory', 'Legion Armory', 'armory', 10,
    Z10_CX + 120, Z10_CY + 80, 85, 65,
    [
      { type: 'rack', ix: 0.25, iy: 0.3 }, { type: 'rack', ix: 0.75, iy: 0.3 },
      { type: 'anvil', ix: 0.4, iy: 0.6 },
      { type: 'chest', ix: 0.8, iy: 0.75 },
    ],
    [{ name: 'Quartermaster Dren', role: 'vendor', ix: 0.5, iy: 0.45, dialogue: ['Legion-grade equipment only.', 'Prove your rank, soldier.'] }],
    '#5a4030', '#3a2818',
  ),
];

// ── Zone 14: Fisherman's Haven ────────────────────────────────
const Z14_CX = 15200, Z14_CY = 2750;

export const ZONE14_BUILDINGS: TownBuilding[] = [
  makeBldg('z14-inn', 'The Net & Hook Inn', 'inn', 14,
    Z14_CX - 80, Z14_CY + 80, 80, 65,
    [
      { type: 'fireplace', ix: 0.5, iy: 0.15 },
      { type: 'table', ix: 0.35, iy: 0.45 },
      { type: 'barrel', ix: 0.8, iy: 0.5 },
      { type: 'bed', ix: 0.25, iy: 0.78 }, { type: 'bed', ix: 0.75, iy: 0.78 },
    ],
    [{ name: 'Innkeeper Marta', role: 'innkeeper', ix: 0.5, iy: 0.3, dialogue: ['Fresh fish stew tonight!', 'Quiet harbor, warm beds.'] }],
    '#6b4218', '#4a2e10',
  ),
  makeBldg('z14-smith', 'Harborside Forge', 'blacksmith', 14,
    Z14_CX + 80, Z14_CY - 60, 75, 60,
    [
      { type: 'anvil', ix: 0.4, iy: 0.4 },
      { type: 'fireplace', ix: 0.8, iy: 0.3 },
      { type: 'barrel', ix: 0.15, iy: 0.65 },
    ],
    [{ name: 'Blacksmith Crane', role: 'blacksmith', ix: 0.45, iy: 0.55, dialogue: ['Anchors, hooks, and blades.', 'Coastal steel is the best.'] }],
    '#5a4030', '#3a2818',
  ),
];

// ── All buildings, indexed by zone ────────────────────────────

export const ALL_TOWN_BUILDINGS: TownBuilding[] = [
  ...ZONE0_BUILDINGS,
  ...ZONE8_BUILDINGS,
  ...ZONE9_BUILDINGS,
  ...ZONE10_BUILDINGS,
  ...ZONE14_BUILDINGS,
];

export function getBuildingsInZone(zoneId: number): TownBuilding[] {
  return ALL_TOWN_BUILDINGS.filter(b => b.zoneId === zoneId);
}

/** Returns the nearest enterable building door within `range` world units */
export function getBuildingNear(x: number, y: number, range: number): TownBuilding | null {
  let nearest: TownBuilding | null = null;
  let nearestDist = range;
  for (const b of ALL_TOWN_BUILDINGS) {
    const dx = b.doorX - x, dy = b.doorY - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < nearestDist) { nearestDist = d; nearest = b; }
  }
  return nearest;
}

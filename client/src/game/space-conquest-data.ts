/**
 * Space Conquest — Data Definitions
 * Planets, resource types, ship blueprints, neutral defender configs.
 */

// ── Resource Types ─────────────────────────────────────────────

export interface Resources {
  minerals: number;
  gas: number;
  energy: number;
  bioMatter: number;
}

export const EMPTY_RESOURCES: Resources = { minerals: 0, gas: 0, energy: 0, bioMatter: 0 };

export function addResources(a: Resources, b: Resources): Resources {
  return {
    minerals: a.minerals + b.minerals,
    gas: a.gas + b.gas,
    energy: a.energy + b.energy,
    bioMatter: a.bioMatter + b.bioMatter,
  };
}

export function canAfford(have: Resources, cost: Resources): boolean {
  return have.minerals >= cost.minerals && have.gas >= cost.gas
    && have.energy >= cost.energy && have.bioMatter >= cost.bioMatter;
}

export function subtractResources(a: Resources, b: Resources): Resources {
  return {
    minerals: a.minerals - b.minerals,
    gas: a.gas - b.gas,
    energy: a.energy - b.energy,
    bioMatter: a.bioMatter - b.bioMatter,
  };
}

// ── Neutral Unit Types ─────────────────────────────────────────

export type NeutralUnitType = 'scout' | 'sentinel' | 'warship' | 'boss';

export interface NeutralUnitDef {
  type: NeutralUnitType;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  attackCooldown: number;
  xpValue: number;
  color: string;
  size: number;       // draw radius
  /** Boss-only: enrage threshold (0-1 hp %) */
  enrageThreshold?: number;
  /** Boss-only: shield activation threshold */
  shieldThreshold?: number;
}

const NEUTRAL_TEMPLATES: Record<NeutralUnitType, Omit<NeutralUnitDef, 'type'>> = {
  scout:    { name: 'Patrol Drone',     hp: 60,   maxHp: 60,   atk: 8,  def: 2,  spd: 120, rng: 100, attackCooldown: 1.2, xpValue: 15,  color: '#6ee7b7', size: 6 },
  sentinel: { name: 'Sentinel Cruiser', hp: 180,  maxHp: 180,  atk: 18, def: 8,  spd: 60,  rng: 150, attackCooldown: 2.0, xpValue: 40,  color: '#fbbf24', size: 10 },
  warship:  { name: 'War Frigate',      hp: 350,  maxHp: 350,  atk: 30, def: 14, spd: 40,  rng: 200, attackCooldown: 2.5, xpValue: 80,  color: '#f97316', size: 14 },
  boss:     { name: 'Guardian Titan',   hp: 1200, maxHp: 1200, atk: 55, def: 25, spd: 25,  rng: 250, attackCooldown: 3.0, xpValue: 250, color: '#ef4444', size: 22, enrageThreshold: 0.2, shieldThreshold: 0.5 },
};

export function createNeutralUnit(type: NeutralUnitType, scaleFactor = 1): NeutralUnitDef {
  const t = NEUTRAL_TEMPLATES[type];
  return {
    type,
    ...t,
    hp: Math.round(t.hp * scaleFactor),
    maxHp: Math.round(t.maxHp * scaleFactor),
    atk: Math.round(t.atk * scaleFactor),
    def: Math.round(t.def * scaleFactor),
  };
}

// ── Planet Definitions ─────────────────────────────────────────

export interface NeutralGarrison {
  units: { type: NeutralUnitType; count: number }[];
}

export interface PlanetDef {
  id: number;
  name: string;
  color: string;          // primary planet color
  glowColor: string;      // orbit/highlight glow
  size: number;           // visual radius
  orbitRadius: number;    // distance from center star
  orbitSpeed: number;     // radians per second
  startAngle: number;     // initial orbital angle
  /** Resources generated per 30-second tick */
  resourceRate: Resources;
  /** Neutral defenders guarding this planet */
  garrison: NeutralGarrison;
  /** Scale factor applied to garrison units */
  garrisonScale: number;
  /** Which ship types can be built here once conquered */
  buildableShips: ShipType[];
  description: string;
  biome: string;
}

export type ShipType = 'scout' | 'frigate' | 'destroyer' | 'cruiser' | 'carrier' | 'dreadnought';

export const PLANETS: PlanetDef[] = [
  {
    id: 0, name: 'Verdania', color: '#4ade80', glowColor: '#22c55e',
    size: 28, orbitRadius: 120, orbitSpeed: 0.12, startAngle: 0,
    resourceRate: { minerals: 5, gas: 2, energy: 3, bioMatter: 8 },
    garrison: { units: [{ type: 'scout', count: 4 }, { type: 'sentinel', count: 1 }] },
    garrisonScale: 0.8,
    buildableShips: ['scout', 'frigate'],
    description: 'Lush bio-world. Rich in organic matter.', biome: 'forest',
  },
  {
    id: 1, name: 'Ferros Prime', color: '#f59e0b', glowColor: '#d97706',
    size: 34, orbitRadius: 180, orbitSpeed: 0.09, startAngle: Math.PI * 0.4,
    resourceRate: { minerals: 12, gas: 3, energy: 4, bioMatter: 1 },
    garrison: { units: [{ type: 'scout', count: 3 }, { type: 'sentinel', count: 2 }, { type: 'warship', count: 1 }] },
    garrisonScale: 1.0,
    buildableShips: ['scout', 'frigate', 'destroyer'],
    description: 'Iron-rich desert planet. Prime mining colony.', biome: 'desert',
  },
  {
    id: 2, name: 'Glacius VII', color: '#7dd3fc', glowColor: '#38bdf8',
    size: 30, orbitRadius: 240, orbitSpeed: 0.07, startAngle: Math.PI * 0.85,
    resourceRate: { minerals: 4, gas: 10, energy: 6, bioMatter: 2 },
    garrison: { units: [{ type: 'sentinel', count: 3 }, { type: 'warship', count: 1 }] },
    garrisonScale: 1.0,
    buildableShips: ['frigate', 'destroyer', 'cruiser'],
    description: 'Frozen gas giant. Massive helium-3 reserves.', biome: 'ice',
  },
  {
    id: 3, name: 'Pyranthos', color: '#ef4444', glowColor: '#dc2626',
    size: 26, orbitRadius: 300, orbitSpeed: 0.055, startAngle: Math.PI * 1.3,
    resourceRate: { minerals: 8, gas: 6, energy: 10, bioMatter: 0 },
    garrison: { units: [{ type: 'scout', count: 6 }, { type: 'sentinel', count: 2 }, { type: 'warship', count: 2 }] },
    garrisonScale: 1.1,
    buildableShips: ['destroyer', 'cruiser'],
    description: 'Volcanic world. Geothermal energy powerhouse.', biome: 'volcanic',
  },
  {
    id: 4, name: 'Nebulon', color: '#a78bfa', glowColor: '#8b5cf6',
    size: 38, orbitRadius: 370, orbitSpeed: 0.04, startAngle: Math.PI * 1.7,
    resourceRate: { minerals: 6, gas: 14, energy: 8, bioMatter: 3 },
    garrison: { units: [{ type: 'sentinel', count: 4 }, { type: 'warship', count: 2 }, { type: 'boss', count: 1 }] },
    garrisonScale: 1.0,
    buildableShips: ['cruiser', 'carrier'],
    description: 'Shrouded in cosmic nebula. Ancient relics within.', biome: 'nebula',
  },
  {
    id: 5, name: 'Adamantia', color: '#94a3b8', glowColor: '#64748b',
    size: 32, orbitRadius: 440, orbitSpeed: 0.033, startAngle: Math.PI * 0.2,
    resourceRate: { minerals: 18, gas: 2, energy: 5, bioMatter: 0 },
    garrison: { units: [{ type: 'warship', count: 4 }, { type: 'boss', count: 1 }] },
    garrisonScale: 1.2,
    buildableShips: ['destroyer', 'cruiser', 'dreadnought'],
    description: 'Dense metallic core. Rare alloys abound.', biome: 'metallic',
  },
  {
    id: 6, name: 'Solara', color: '#fbbf24', glowColor: '#f59e0b',
    size: 24, orbitRadius: 500, orbitSpeed: 0.027, startAngle: Math.PI * 0.6,
    resourceRate: { minerals: 3, gas: 5, energy: 20, bioMatter: 2 },
    garrison: { units: [{ type: 'scout', count: 8 }, { type: 'sentinel', count: 3 }, { type: 'warship', count: 2 }, { type: 'boss', count: 1 }] },
    garrisonScale: 1.15,
    buildableShips: ['carrier', 'dreadnought'],
    description: 'Binary star proximity. Unlimited solar energy.', biome: 'solar',
  },
  {
    id: 7, name: 'Void Bastion', color: '#e879f9', glowColor: '#d946ef',
    size: 42, orbitRadius: 580, orbitSpeed: 0.02, startAngle: Math.PI * 1.1,
    resourceRate: { minerals: 10, gas: 10, energy: 10, bioMatter: 10 },
    garrison: { units: [{ type: 'sentinel', count: 5 }, { type: 'warship', count: 4 }, { type: 'boss', count: 2 }] },
    garrisonScale: 1.4,
    buildableShips: ['scout', 'frigate', 'destroyer', 'cruiser', 'carrier', 'dreadnought'],
    description: 'The final bastion. Master this to rule the sector.', biome: 'void',
  },
];

// ── Ship Blueprints ────────────────────────────────────────────

export interface ShipBlueprintDef {
  type: ShipType;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  attackCooldown: number;
  cost: Resources;
  buildTime: number;      // seconds
  color: string;
  size: number;           // draw radius
  description: string;
  /** How many supply slots this ship takes */
  supply: number;
}

export const SHIP_BLUEPRINTS: ShipBlueprintDef[] = [
  {
    type: 'scout', name: 'Scout', hp: 40, atk: 6, def: 1, spd: 180, rng: 80, attackCooldown: 0.8,
    cost: { minerals: 5, gas: 2, energy: 2, bioMatter: 0 }, buildTime: 5,
    color: '#86efac', size: 5, description: 'Fast recon ship. Low firepower.', supply: 1,
  },
  {
    type: 'frigate', name: 'Frigate', hp: 100, atk: 14, def: 5, spd: 100, rng: 120, attackCooldown: 1.4,
    cost: { minerals: 12, gas: 5, energy: 4, bioMatter: 0 }, buildTime: 10,
    color: '#60a5fa', size: 8, description: 'Balanced warship. Good all-rounder.', supply: 2,
  },
  {
    type: 'destroyer', name: 'Destroyer', hp: 200, atk: 28, def: 10, spd: 70, rng: 160, attackCooldown: 2.0,
    cost: { minerals: 25, gas: 10, energy: 8, bioMatter: 0 }, buildTime: 18,
    color: '#f97316', size: 11, description: 'Heavy assault vessel. Punishing firepower.', supply: 3,
  },
  {
    type: 'cruiser', name: 'Cruiser', hp: 350, atk: 22, def: 18, spd: 55, rng: 200, attackCooldown: 2.2,
    cost: { minerals: 40, gas: 15, energy: 12, bioMatter: 5 }, buildTime: 25,
    color: '#a78bfa', size: 14, description: 'Armored command ship. Absorbs heavy fire.', supply: 4,
  },
  {
    type: 'carrier', name: 'Carrier', hp: 500, atk: 12, def: 22, spd: 35, rng: 300, attackCooldown: 3.0,
    cost: { minerals: 60, gas: 25, energy: 20, bioMatter: 10 }, buildTime: 35,
    color: '#fbbf24', size: 18, description: 'Deploys drone swarms. Massive range.', supply: 6,
  },
  {
    type: 'dreadnought', name: 'Dreadnought', hp: 900, atk: 50, def: 30, spd: 20, rng: 250, attackCooldown: 3.5,
    cost: { minerals: 100, gas: 40, energy: 35, bioMatter: 15 }, buildTime: 50,
    color: '#ef4444', size: 22, description: 'Planet-killer flagship. Supreme destruction.', supply: 10,
  },
];

export function getShipBlueprint(type: ShipType): ShipBlueprintDef {
  return SHIP_BLUEPRINTS.find(s => s.type === type)!;
}

// ── Resource Labels & Colors ───────────────────────────────────

export const RESOURCE_INFO: Record<keyof Resources, { label: string; color: string; icon: string }> = {
  minerals:  { label: 'Minerals',   color: '#94a3b8', icon: '⛏' },
  gas:       { label: 'Gas',        color: '#a78bfa', icon: '☁' },
  energy:    { label: 'Energy',     color: '#fbbf24', icon: '⚡' },
  bioMatter: { label: 'BioMatter',  color: '#4ade80', icon: '🧬' },
};

// ── Pirate Raid Config ─────────────────────────────────────────

export interface PirateWaveDef {
  /** Seconds after first conquest before raids begin */
  startDelay: number;
  /** Seconds between raids */
  interval: number;
  /** Units per raid (scales with number of conquered planets) */
  baseUnits: { type: NeutralUnitType; count: number }[];
  scaleFactor: number;
}

export const PIRATE_RAID: PirateWaveDef = {
  startDelay: 120,
  interval: 90,
  baseUnits: [{ type: 'scout', count: 3 }, { type: 'sentinel', count: 1 }],
  scaleFactor: 0.5,   // +50% per additional conquered planet
};

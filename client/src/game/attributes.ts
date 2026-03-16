/**
 * Attributes System — Phase 3
 * 8 primary attributes (STR/INT/VIT/DEX/END/WIS/AGI/TAC) from ObjectStore.
 * Players get attribute points per level and allocate them freely.
 * Attributes modify derived stats (hp, atk, def, spd, mp, crit, evasion, etc.).
 */

// ── Attribute Definitions ──────────────────────────────────────

export interface AttributeDef {
  id: string;
  name: string;
  short: string;   // 3-letter abbrev
  color: string;
  emoji: string;
  description: string;
  formula: string;
}

export const ATTRIBUTES: AttributeDef[] = [
  { id: 'strength',  name: 'Strength',  short: 'STR', color: '#ef4444', emoji: '💪', description: 'Increases physical attack damage', formula: 'Physical Damage = Base × (1 + STR × 0.05)' },
  { id: 'intellect', name: 'Intellect', short: 'INT', color: '#8b5cf6', emoji: '🧠', description: 'Increases magical damage and max mana pool', formula: 'Magic Damage = Base × (1 + INT × 0.05)' },
  { id: 'vitality',  name: 'Vitality',  short: 'VIT', color: '#22c55e', emoji: '❤️', description: 'Increases maximum HP', formula: 'Max HP = 100 + (VIT × 12)' },
  { id: 'dexterity', name: 'Dexterity', short: 'DEX', color: '#f59e0b', emoji: '🎯', description: 'Increases critical hit chance and ranged damage', formula: 'Crit Chance = 5% + (DEX × 1.5%)' },
  { id: 'endurance', name: 'Endurance', short: 'END', color: '#6366f1', emoji: '🛡️', description: 'Increases physical defense and stamina', formula: 'Defense = 2 + (END × 2)' },
  { id: 'wisdom',    name: 'Wisdom',    short: 'WIS', color: '#06b6d4', emoji: '✨', description: 'Increases magical defense, heal power, mana regen', formula: 'Heal Power = Base × (1 + WIS × 0.04)' },
  { id: 'agility',   name: 'Agility',   short: 'AGI', color: '#10b981', emoji: '⚡', description: 'Increases evasion and movement speed', formula: 'Evasion = AGI × 1.2%, Speed = 50 + AGI × 2' },
  { id: 'tactics',   name: 'Tactics',   short: 'TAC', color: '#f97316', emoji: '📜', description: 'Increases buff/debuff effectiveness', formula: 'Ability Bonus = TAC × 2%' },
];

export const ATTR_IDS = ['strength', 'intellect', 'vitality', 'dexterity', 'endurance', 'wisdom', 'agility', 'tactics'] as const;
export type AttributeId = typeof ATTR_IDS[number];

// ── Player Attributes State ────────────────────────────────────

export interface PlayerAttributes {
  /** Base attribute values (from points spent) */
  base: Record<AttributeId, number>;
  /** Bonus from gear, buffs, etc. */
  bonus: Record<AttributeId, number>;
  /** Unspent attribute points */
  unspentPoints: number;
  /** Total points ever allocated */
  totalAllocated: number;
}

/** Points granted per level-up */
export const POINTS_PER_LEVEL = 3;

/** Class-based starting attribute distributions */
const CLASS_STARTING_ATTRS: Record<string, Partial<Record<AttributeId, number>>> = {
  Warrior: { strength: 5, vitality: 4, endurance: 4, dexterity: 1, agility: 1 },
  Mage:    { intellect: 5, wisdom: 4, vitality: 2, tactics: 3, agility: 1 },
  Ranger:  { dexterity: 5, agility: 4, strength: 2, endurance: 1, wisdom: 1, tactics: 2 },
  Worg:    { agility: 5, strength: 3, dexterity: 3, vitality: 2, endurance: 2 },
};

function emptyAttrs(): Record<AttributeId, number> {
  return { strength: 0, intellect: 0, vitality: 0, dexterity: 0, endurance: 0, wisdom: 0, agility: 0, tactics: 0 };
}

export function createPlayerAttributes(heroClass: string): PlayerAttributes {
  const base = emptyAttrs();
  const classStart = CLASS_STARTING_ATTRS[heroClass] || CLASS_STARTING_ATTRS.Warrior;
  for (const [key, val] of Object.entries(classStart)) {
    base[key as AttributeId] = val!;
  }
  return {
    base,
    bonus: emptyAttrs(),
    unspentPoints: 0,
    totalAllocated: Object.values(base).reduce((s, v) => s + v, 0),
  };
}

// ── Point Allocation ───────────────────────────────────────────

export function allocatePoint(attrs: PlayerAttributes, attrId: AttributeId): boolean {
  if (attrs.unspentPoints <= 0) return false;
  attrs.base[attrId]++;
  attrs.unspentPoints--;
  attrs.totalAllocated++;
  return true;
}

export function deallocatePoint(attrs: PlayerAttributes, attrId: AttributeId): boolean {
  if (attrs.base[attrId] <= 0) return false;
  // Don't let base go below class starting values
  attrs.base[attrId]--;
  attrs.unspentPoints++;
  attrs.totalAllocated--;
  return true;
}

export function grantLevelUpPoints(attrs: PlayerAttributes): void {
  attrs.unspentPoints += POINTS_PER_LEVEL;
}

/** Get total (base + bonus) for an attribute */
export function getAttr(attrs: PlayerAttributes, id: AttributeId): number {
  return attrs.base[id] + attrs.bonus[id];
}

// ── Derived Stats ──────────────────────────────────────────────

export interface DerivedStats {
  bonusHp: number;         // from VIT
  bonusMp: number;         // from INT/WIS
  bonusAtk: number;        // from STR
  bonusMagicDmg: number;   // from INT
  bonusDef: number;        // from END
  bonusSpd: number;        // from AGI
  critChance: number;      // from DEX (percentage 0-100)
  evasionChance: number;   // from AGI (percentage 0-100)
  healPower: number;       // from WIS (multiplier)
  abilityBonus: number;    // from TAC (multiplier)
  manaRegen: number;       // from WIS
  physDmgMult: number;     // from STR (multiplier)
  magicDmgMult: number;    // from INT (multiplier)
}

export function computeDerivedStats(attrs: PlayerAttributes): DerivedStats {
  const str = getAttr(attrs, 'strength');
  const int = getAttr(attrs, 'intellect');
  const vit = getAttr(attrs, 'vitality');
  const dex = getAttr(attrs, 'dexterity');
  const end = getAttr(attrs, 'endurance');
  const wis = getAttr(attrs, 'wisdom');
  const agi = getAttr(attrs, 'agility');
  const tac = getAttr(attrs, 'tactics');

  return {
    bonusHp: vit * 12,
    bonusMp: int * 5 + wis * 3,
    bonusAtk: Math.floor(str * 2),
    bonusMagicDmg: Math.floor(int * 2),
    bonusDef: Math.floor(end * 2),
    bonusSpd: Math.floor(agi * 2),
    critChance: Math.min(75, 5 + dex * 1.5),
    evasionChance: Math.min(40, agi * 1.2),
    healPower: 1 + wis * 0.04,
    abilityBonus: 1 + tac * 0.02,
    manaRegen: 1 + wis * 0.3,
    physDmgMult: 1 + str * 0.05,
    magicDmgMult: 1 + int * 0.05,
  };
}

/**
 * Apply attribute bonuses to base hero stats.
 * Call this whenever stats need recalculation (level up, gear change, etc.).
 */
export function applyAttributeBonus(
  baseStats: { hp: number; atk: number; def: number; spd: number; mp: number },
  attrs: PlayerAttributes,
  heroClass: string,
): { hp: number; atk: number; def: number; spd: number; mp: number } {
  const derived = computeDerivedStats(attrs);
  const isMagic = heroClass === 'Mage';

  return {
    hp: baseStats.hp + derived.bonusHp,
    atk: baseStats.atk + (isMagic ? derived.bonusMagicDmg : derived.bonusAtk),
    def: baseStats.def + derived.bonusDef,
    spd: baseStats.spd + derived.bonusSpd,
    mp: baseStats.mp + derived.bonusMp,
  };
}

// ── Persistence ────────────────────────────────────────────────

const ATTR_STORAGE_KEY = 'grudge_player_attributes';

export function saveAttributes(attrs: PlayerAttributes): void {
  try {
    localStorage.setItem(ATTR_STORAGE_KEY, JSON.stringify({
      base: attrs.base,
      bonus: attrs.bonus,
      unspentPoints: attrs.unspentPoints,
      totalAllocated: attrs.totalAllocated,
    }));
  } catch {}
}

export function loadAttributes(heroClass: string): PlayerAttributes {
  try {
    const raw = localStorage.getItem(ATTR_STORAGE_KEY);
    if (!raw) return createPlayerAttributes(heroClass);
    const saved = JSON.parse(raw);
    return {
      base: { ...emptyAttrs(), ...saved.base },
      bonus: { ...emptyAttrs(), ...saved.bonus },
      unspentPoints: saved.unspentPoints ?? 0,
      totalAllocated: saved.totalAllocated ?? 0,
    };
  } catch {
    return createPlayerAttributes(heroClass);
  }
}

// ── Summary for UI ─────────────────────────────────────────────

export interface AttributeSummary {
  attrs: { id: AttributeId; name: string; short: string; color: string; base: number; bonus: number; total: number }[];
  derived: DerivedStats;
  unspentPoints: number;
}

export function getAttributeSummary(attrs: PlayerAttributes): AttributeSummary {
  return {
    attrs: ATTR_IDS.map(id => {
      const def = ATTRIBUTES.find(a => a.id === id)!;
      return {
        id,
        name: def.name,
        short: def.short,
        color: def.color,
        base: attrs.base[id],
        bonus: attrs.bonus[id],
        total: attrs.base[id] + attrs.bonus[id],
      };
    }),
    derived: computeDerivedStats(attrs),
    unspentPoints: attrs.unspentPoints,
  };
}

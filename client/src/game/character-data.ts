/**
 * Character Data — Unified data layer for character UI
 * Loads all character state from localStorage into a single CharacterData object.
 * Can also be hydrated from live OWHudState for in-game use.
 */

import { HEROES, HeroData, CLASS_ABILITIES, AbilityDef } from './types';
import {
  loadEquipment, computeEquipmentStats, computeSetBonuses,
  PlayerEquipment, EquipmentStatTotals, SetBonus,
  EQUIP_SLOTS, EquipSlot, EquipmentInstance,
  loadEquipmentBag, EquipmentBag,
} from './equipment';
import {
  loadAttributes, getAttributeSummary, PlayerAttributes,
  AttributeSummary, allocatePoint, saveAttributes, AttributeId,
} from './attributes';
import {
  loadProfessions, getProfessionSummaries, ProfessionSummaryItem,
} from './professions-system';
import { loadMissionLog, MissionLog } from './missions';
import { loadPlayerProgress, PlayerProgress, getReputationRank, getReputationColor } from './player-progress';
import { loadSavedLoadoutSelections } from './weapon-skills';

// ── CharacterData Interface ────────────────────────────────────

export interface CharacterData {
  // Hero identity
  hero: HeroData | null;
  heroClass: string;
  heroRace: string;
  heroName: string;
  level: number;

  // Resource bars (from progress or defaults)
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  stamina: number; maxStamina: number;

  // Core stats
  atk: number;
  def: number;
  spd: number;
  gold: number;

  // XP
  xp: number;
  xpToNext: number;

  // Equipment
  equipment: PlayerEquipment;
  equipStats: EquipmentStatTotals;
  setBonuses: SetBonus[];
  equipSlots: { slot: EquipSlot; label: string; icon: string; item: EquipmentInstance | null }[];

  // Equipment bag
  bagItems: EquipmentBag;

  // Attributes
  attributes: PlayerAttributes;
  attributeSummary: AttributeSummary;

  // Professions
  gatheringProfs: ProfessionSummaryItem[];
  craftingProfs: ProfessionSummaryItem[];

  // Missions
  missionLog: MissionLog;
  activeMissions: { id: string; name: string; status: string; objectives: { type: string; target: string; current: number; required: number }[] }[];

  // Class abilities
  classAbilities: AbilityDef[];

  // Weapon skills
  weaponType: string;
  weaponLoadoutReady: boolean;
  abilityNames: string[];
  abilityDescs: string[];

  // Progress
  progress: PlayerProgress;
  reputationRank: string;
  reputationColor: string;
  zonesDiscovered: number;
  monstersSlain: number;
  bossesDefeated: number;

  // Allocate attribute points (mutates + saves)
  allocateAttribute: (attrId: AttributeId) => void;
}

// ── Load from localStorage ─────────────────────────────────────

export function loadCharacterData(): CharacterData {
  const heroId = localStorage.getItem('grudge_hero_id');
  // Support custom-created heroes stored in localStorage
  let hero = HEROES.find(h => String(h.id) === heroId) ?? null;
  if (!hero) {
    try {
      const custom = localStorage.getItem('grudge_custom_hero');
      if (custom) {
        const parsed = JSON.parse(custom) as HeroData;
        if (String(parsed.id) === heroId) {
          hero = parsed;
          // Ensure it's in the runtime array
          if (!HEROES.find(h => h.id === parsed.id)) HEROES.push(parsed);
        }
      }
    } catch { /* ignore parse errors */ }
  }
  // Always fall back to first hero so /character never shows a blank screen
  if (!hero && HEROES.length > 0) hero = HEROES[0];
  const heroClass = hero?.heroClass ?? 'Warrior';
  const heroRace = hero?.race ?? 'Human';

  // Equipment
  const equipment = loadEquipment();
  const equipStats = computeEquipmentStats(equipment);
  const setBonuses = computeSetBonuses(equipment);
  const equipSlots = EQUIP_SLOTS.map(s => ({
    slot: s.id,
    label: s.label,
    icon: s.icon,
    item: equipment.slots[s.id],
  }));

  // Attributes
  const attributes = loadAttributes(heroClass);
  const attributeSummary = getAttributeSummary(attributes);

  // Professions
  const profs = loadProfessions();
  const profSummaries = getProfessionSummaries(profs);

  // Missions
  const missionLog = loadMissionLog();
  const activeMissions = missionLog.active.map(m => ({
    id: m.def.id,
    name: m.def.name,
    status: m.status,
    objectives: m.objectives.map(o => ({
      type: o.type,
      target: o.target,
      current: o.current,
      required: o.required,
    })),
  }));

  // Progress
  const progress = loadPlayerProgress();

  // Bag
  const bagItems = loadEquipmentBag();

  // Weapon loadout info
  const savedLoadout = loadSavedLoadoutSelections();
  const weaponType = savedLoadout?.weaponType ?? '';
  const weaponLoadoutReady = !!savedLoadout;

  // Class abilities
  const classAbilities = CLASS_ABILITIES[heroClass] || [];

  // Computed stats (hero base + attribute bonuses + gear)
  const baseHp = hero ? hero.hp + attributeSummary.derived.bonusHp + equipStats.hp : 100;
  const baseMp = hero ? hero.mp + attributeSummary.derived.bonusMp + equipStats.mp : 50;
  const baseAtk = hero ? hero.atk + attributeSummary.derived.bonusAtk + equipStats.atk : 10;
  const baseDef = hero ? hero.def + attributeSummary.derived.bonusDef + equipStats.def : 5;
  const baseSpd = hero ? hero.spd + attributeSummary.derived.bonusSpd + equipStats.spd : 50;

  const allocateAttribute = (attrId: AttributeId) => {
    allocatePoint(attributes, attrId);
    saveAttributes(attributes);
  };

  return {
    hero,
    heroClass,
    heroRace,
    heroName: hero?.name ?? 'Unknown',
    level: progress.highestLevel || 1,
    hp: baseHp, maxHp: baseHp,
    mp: baseMp, maxMp: baseMp,
    stamina: 100, maxStamina: 100,
    atk: baseAtk,
    def: baseDef,
    spd: baseSpd,
    gold: progress.totalGoldEarned || 0,
    xp: 0,
    xpToNext: 80,
    equipment,
    equipStats,
    setBonuses,
    equipSlots,
    bagItems,
    attributes,
    attributeSummary,
    gatheringProfs: profSummaries.gathering,
    craftingProfs: profSummaries.crafting,
    missionLog,
    activeMissions,
    classAbilities,
    weaponType,
    weaponLoadoutReady,
    abilityNames: [],
    abilityDescs: [],
    progress,
    reputationRank: getReputationRank(progress.reputation),
    reputationColor: getReputationColor(progress.reputation),
    zonesDiscovered: progress.zonesDiscovered.length,
    monstersSlain: progress.monstersSlain,
    bossesDefeated: progress.bossesDefeated,
    allocateAttribute,
  };
}

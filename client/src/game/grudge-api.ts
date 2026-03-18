/**
 * Grudge ObjectStore API Client
 * Fetches authoritative game data from the ObjectStore GitHub Pages API.
 * Caches in memory with 5-min TTL, falls back to bundled defaults offline.
 */

const BASE_URL = 'https://molochdagod.github.io/ObjectStore';
const CACHE_TTL = 5 * 60 * 1000;

// ── Typed Interfaces ───────────────────────────────────────────

export interface OSWeaponSkillOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  cooldown: number;
  manaCost: number;
  damageMultiplier?: number;
  effect?: string;
  slot: string;
  slotLabel: string;
}

export interface OSWeaponSpecific {
  slot4: OSWeaponSkillOption[];
  slot5: OSWeaponSkillOption | OSWeaponSkillOption[];
}

export interface OSWeaponTypeSkills {
  name: string;
  emoji: string;
  sharedSkills: {
    slot1: OSWeaponSkillOption[];
    slot2: OSWeaponSkillOption[];
    slot3: OSWeaponSkillOption[];
  };
  weapons: Record<string, OSWeaponSpecific>;
}

export interface OSWeaponSkillsData {
  version: string;
  weaponTypes: Record<string, OSWeaponTypeSkills>;
}

export interface OSWeaponStats {
  damageBase: number; damagePerTier: number;
  speedBase: number; speedPerTier: number;
  comboBase: number; comboPerTier: number;
  critBase: number; critPerTier: number;
  blockBase: number; blockPerTier: number;
  defenseBase: number; defensePerTier: number;
}

export interface OSWeaponItem {
  id: string;
  name: string;
  primaryStat: string;
  secondaryStat: string;
  emoji: string;
  lore: string;
  category: string;
  stats: OSWeaponStats;
  basicAbility: string;
  abilities: string[];
  signatureAbility: string;
  passives: string[];
  craftedBy: string;
  spritePath: string;
}

export interface OSWeaponCategory {
  iconBase: string;
  iconMax: number;
  items: OSWeaponItem[];
}

export interface OSWeaponsData {
  version: string;
  total: number;
  tiers: number;
  categories: Record<string, OSWeaponCategory>;
}

export interface OSAttribute {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  formula: string;
  emoji: string;
}

export interface OSAttributesData {
  version: string;
  total: number;
  attributes: OSAttribute[];
}

export interface OSGatheringMilestone {
  level: number;
  unlock: string;
  description: string;
}

export interface OSGatheringProfession {
  icon: string;
  color: string;
  resources: string[];
  tierResources: Record<string, string[]>;
  feedsInto: string[];
}

export interface OSProfessionSkillNode {
  id: number;
  name: string;
  x: number;
  y: number;
  reqLevel: number;
  parent: number | null;
  branch: string;
  nodeType: string;
  desc?: string;
  bonuses?: { type: string; value: number; target: string }[];
  unlocks?: string[];
}

export interface OSCraftingProfession {
  name: string;
  role: string;
  icon: string;
  color: string;
  specializations: string[];
  crafts: string[];
  gathers: string[];
  tools: string[];
  skillTree: OSProfessionSkillNode[];
  recipeCount: number;
  recipeTypes: string[];
}

export interface OSProfessionsData {
  version: string;
  tierNames: string[];
  tierColors: Record<string, string>;
  xpTable: Record<string, number>;
  gatheringMilestones: OSGatheringMilestone[];
  gathering: Record<string, OSGatheringProfession>;
  professions: Record<string, OSCraftingProfession>;
}

export interface OSArmorItem {
  id: string;
  name: string;
  type: string;
  material: string;
  lore: string;
  emoji: string;
  stats: {
    hpBase: number; hpPerTier: number;
    manaBase: number; manaPerTier: number;
    critBase: number; critPerTier: number;
    blockBase: number; blockPerTier: number;
    defenseBase: number; defensePerTier: number;
  };
  passive: string;
  attribute: string;
  effect: string;
  proc: string;
  setBonus: string;
  spritePath: string;
}

export interface OSArmorData {
  version: string;
  total: number;
  sets: string[];
  materials: Record<string, { name: string; description: string; primaryAttribute: string; count: number; items: OSArmorItem[] }>;
}

export interface OSEquipmentTier {
  name: string;
  color: string;
  multiplier: number;
}

export interface OSEquipmentData {
  slots: string[];
  tiers: Record<string, OSEquipmentTier>;
  tierFlatBonus: Record<string, number>;
  displayStatMap: Record<string, { label: string; color: string; icon: string }>;
  upgradeCosts: Record<string, number>;
  weaponTypes: Record<string, { name: string; icon: string; iconUrl: string; hand: string }>;
}

export interface OSVoxelAssetItem {
  id: string;
  name: string;
  voxelSize: [number, number, number];
  colors: string[];
  animated: boolean;
  description: string;
}

export interface OSVoxelAssetCategory {
  name: string;
  emoji: string;
  items: OSVoxelAssetItem[];
}

export interface OSVoxelAssetsData {
  version: string;
  description: string;
  totalAssets: number;
  categories: Record<string, OSVoxelAssetCategory>;
}

// ── Cache ──────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; timestamp: number; }
const cache = new Map<string, CacheEntry<any>>();

async function fetchCached<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(url, { data, timestamp: Date.now() });
    return data;
  } catch (e) {
    // Return cached even if expired, or throw
    if (cached) return cached.data;
    throw e;
  }
}

// ── Public API ─────────────────────────────────────────────────

export const grudgeApi = {
  clearCache() { cache.clear(); },

  async getWeaponSkills(): Promise<OSWeaponSkillsData> {
    return fetchCached('/api/v1/weaponSkills.json');
  },

  async getWeapons(): Promise<OSWeaponsData> {
    return fetchCached('/api/v1/weapons.json');
  },

  async getAttributes(): Promise<OSAttributesData> {
    return fetchCached('/api/v1/attributes.json');
  },

  async getProfessions(): Promise<OSProfessionsData> {
    return fetchCached('/api/v1/professions.json');
  },

  async getArmor(): Promise<OSArmorData> {
    return fetchCached('/api/v1/armor.json');
  },

  async getEquipment(): Promise<OSEquipmentData> {
    return fetchCached('/api/v1/equipment.json');
  },

  async getVoxelAssets(): Promise<OSVoxelAssetsData> {
    return fetchCached('/api/v1/voxelAssets.json');
  },

  /** Get a specific weapon by ID across all categories */
  async getWeapon(weaponId: string): Promise<OSWeaponItem | null> {
    const data = await this.getWeapons();
    for (const cat of Object.values(data.categories)) {
      const w = cat.items.find(i => i.id === weaponId);
      if (w) return w;
    }
    return null;
  },

  /** Get weapon category key for a specific weapon ID */
  async getWeaponCategory(weaponId: string): Promise<string | null> {
    const data = await this.getWeapons();
    for (const [catKey, cat] of Object.entries(data.categories)) {
      if (cat.items.some(i => i.id === weaponId)) return catKey;
    }
    return null;
  },

  /** Get skill options for a weapon type */
  async getWeaponTypeSkills(weaponType: string): Promise<OSWeaponTypeSkills | null> {
    const data = await this.getWeaponSkills();
    return data.weaponTypes[weaponType] || null;
  },

  /** Get weapon-specific skills (slot4/5) for a named weapon */
  async getWeaponSpecificSkills(weaponType: string, weaponId: string): Promise<OSWeaponSpecific | null> {
    const typeSkills = await this.getWeaponTypeSkills(weaponType);
    if (!typeSkills) return null;
    return typeSkills.weapons[weaponId] || null;
  },
};

// ── Bundled Fallback Defaults ──────────────────────────────────
// Minimal attribute data so the game works offline without fetching

export const FALLBACK_VOXEL_ASSET_CATEGORIES = [
  'trees', 'rocks', 'mountains', 'terrain_props', 'structures', 'animals', 'enemies',
] as const;

export const FALLBACK_ATTRIBUTES: OSAttribute[] = [
  { id: 'strength', name: 'Strength', icon: 'battle', color: '#ef4444', description: 'Increases physical attack damage.', formula: 'Physical Damage = Base × (1 + STR × 0.05)', emoji: '💪' },
  { id: 'intellect', name: 'Intellect', icon: 'crystal', color: '#8b5cf6', description: 'Increases magical damage and max mana.', formula: 'Magic Damage = Base × (1 + INT × 0.05)', emoji: '🧠' },
  { id: 'vitality', name: 'Vitality', icon: 'heart', color: '#22c55e', description: 'Increases maximum HP.', formula: 'Max HP = 100 + (VIT × 12)', emoji: '❤️' },
  { id: 'dexterity', name: 'Dexterity', icon: 'target', color: '#f59e0b', description: 'Increases crit chance and ranged damage.', formula: 'Crit Chance = 5% + (DEX × 1.5%)', emoji: '🎯' },
  { id: 'endurance', name: 'Endurance', icon: 'shield', color: '#6366f1', description: 'Increases physical defense and stamina.', formula: 'Defense = 2 + (END × 2)', emoji: '🛡️' },
  { id: 'wisdom', name: 'Wisdom', icon: 'sparkle', color: '#06b6d4', description: 'Increases magical defense, heal power, mana regen.', formula: 'Heal Power = Base × (1 + WIS × 0.04)', emoji: '✨' },
  { id: 'agility', name: 'Agility', icon: 'energy', color: '#10b981', description: 'Increases evasion and action speed.', formula: 'Evasion = AGI × 1.2%, Speed = 50 + AGI × 2', emoji: '⚡' },
  { id: 'tactics', name: 'Tactics', icon: 'scroll', color: '#f97316', description: 'Increases buff/debuff effectiveness.', formula: 'Ability Bonus = TAC × 2%', emoji: '📜' },
];

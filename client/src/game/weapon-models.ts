/**
 * Weapon Model Registry
 * Maps the game's 17 weapon types to 3D low-poly FBX model paths.
 * Each type has up to 8 tier variants (matching equipment tier 1-8).
 * Integrates with equipment.ts weaponType + model-loader.ts loadFBX.
 */

const P = '/assets/packs';

// ── Types ──────────────────────────────────────────────────────

export interface WeaponModel {
  id: string;
  type: string;
  tier: number;
  path: string;
  format: 'fbx' | 'gltf';
  texturePath?: string;
  scale: number;
}

export interface WeaponTypeConfig {
  type: string;
  label: string;
  basePath: string;
  filePattern: (tier: number) => string;
  format: 'fbx' | 'gltf';
  texturePath?: string;
  scale: number;
  maxTier: number;
}

// ── Weapon Type Configurations ─────────────────────────────────

const WEAPON_CONFIGS: WeaponTypeConfig[] = [
  {
    type: 'swords', label: 'Sword', basePath: `${P}/weapons-sword/fbx`,
    filePattern: (t) => `_sword_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-sword/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'daggers', label: 'Dagger', basePath: `${P}/weapons-dagger/fbx`,
    filePattern: (t) => `_dagger_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-dagger/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'bows', label: 'Bow', basePath: `${P}/weapons-bow/fbx/bow_full`,
    filePattern: (t) => `_bow_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-bow/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'crossbows', label: 'Crossbow', basePath: `${P}/weapons-crossbow/fbx/fbx_full`,
    filePattern: (t) => `_crossbow_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-crossbow/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'shields', label: 'Shield', basePath: `${P}/weapons-shield/fbx`,
    filePattern: (t) => `_shield_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-shield/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'maces', label: 'Mace/Hammer', basePath: `${P}/weapons-hammer/fbx`,
    filePattern: (t) => `_hammer_${String(t).padStart(2, '0')}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-hammer/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: 'hammers', label: 'Hammer', basePath: `${P}/weapons-hammer/fbx`,
    filePattern: (t) => `_hammer_${String(t + 8).padStart(2, '0')}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-hammer/texture`, scale: 0.02, maxTier: 7,
  },
  {
    type: 'spears', label: 'Spear/Polearm', basePath: `${P}/weapons-polearm/fbx`,
    filePattern: (t) => `_polearm_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-polearm/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: '2h-weapons', label: 'Two-Handed Axe', basePath: `${P}/weapons-axe/fbx`,
    filePattern: (t) => `_axe_${t}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-axe/texture`, scale: 0.02, maxTier: 8,
  },
  {
    type: '2h-swords', label: 'Two-Handed Sword', basePath: `${P}/weapons-sword/fbx`,
    filePattern: (t) => `_sword_${t + 14}.fbx`, format: 'fbx',
    texturePath: `${P}/weapons-sword/texture`, scale: 0.025, maxTier: 8,
  },
  // Elf-specific weapons (race-bound)
  {
    type: 'elf-bow', label: 'Elf Bow', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: (t) => t === 1 ? '_BOW_1.fbx' : '_BOW_2.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 2,
  },
  {
    type: 'elf-shield', label: 'Elf Shield', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: (t) => t === 1 ? '_SHIELD_1.fbx' : '_SHIELD_2.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 2,
  },
  {
    type: 'elf-axe', label: 'Elf Axe', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: (t) => t === 1 ? '_AX_1.fbx' : '_DOUBLE_AXE_1.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 2,
  },
  {
    type: 'elf-spear', label: 'Elf Spear', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: () => '_SPAIR_1.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 1,
  },
  {
    type: 'elf-halberd', label: 'Elf Halberd', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: () => '_HALLBERT.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 1,
  },
  // Pirate weapons (from pirate-kit, gltf)
  {
    type: 'guns', label: 'Pistol', basePath: `${P}/pirate-kit/Pirate Kit - Nov 2023/glTF`,
    filePattern: (t) => t <= 4 ? 'Weapon_Pistol.gltf' : 'Weapon_Rifle.gltf', format: 'gltf',
    scale: 1.0, maxTier: 8,
  },
  {
    type: 'staffs', label: 'Staff/Wand', basePath: `${P}/weapons-elf/FBX/FBX_ORDINAR`,
    filePattern: () => '_DARTBOARD.fbx', format: 'fbx',
    texturePath: `${P}/weapons-elf/TEXTURE`, scale: 0.02, maxTier: 1,
  },
];

// ── Build Model Registry ───────────────────────────────────────

const _modelRegistry = new Map<string, WeaponModel[]>();

for (const cfg of WEAPON_CONFIGS) {
  const models: WeaponModel[] = [];
  for (let tier = 1; tier <= cfg.maxTier; tier++) {
    models.push({
      id: `${cfg.type}-t${tier}`,
      type: cfg.type,
      tier,
      path: `${cfg.basePath}/${cfg.filePattern(tier)}`,
      format: cfg.format,
      texturePath: cfg.texturePath,
      scale: cfg.scale,
    });
  }
  _modelRegistry.set(cfg.type, models);
}

// ── Public API ─────────────────────────────────────────────────

/** Get a weapon model for a specific type and tier */
export function getWeaponModel(weaponType: string, tier: number): WeaponModel | null {
  const models = _modelRegistry.get(weaponType);
  if (!models || models.length === 0) return null;
  // Clamp tier to available range
  const idx = Math.max(0, Math.min(models.length - 1, tier - 1));
  return models[idx];
}

/** Get all models for a weapon type */
export function getWeaponModels(weaponType: string): WeaponModel[] {
  return _modelRegistry.get(weaponType) || [];
}

/** Get all registered weapon types */
export function getRegisteredWeaponTypes(): string[] {
  return Array.from(_modelRegistry.keys());
}

/** Get config for a weapon type */
export function getWeaponTypeConfig(weaponType: string): WeaponTypeConfig | undefined {
  return WEAPON_CONFIGS.find(c => c.type === weaponType);
}

/** Map equipment system weapon types to model types */
export const EQUIP_TO_MODEL_TYPE: Record<string, string> = {
  swords: 'swords',
  daggers: 'daggers',
  bows: 'bows',
  crossbows: 'crossbows',
  guns: 'guns',
  staffs: 'staffs',
  wands: 'staffs',
  tomes: 'staffs',
  maces: 'maces',
  hammers: 'hammers',
  shields: 'shields',
  spears: 'spears',
  '2h-swords': '2h-swords',
  '2h-weapons': '2h-weapons',
  'off-hand relics': 'shields',
  capes: 'shields',
};

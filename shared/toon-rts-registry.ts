/**
 * Toon_RTS Asset Registry
 *
 * Maps the 6 Toon_RTS race packs to structured asset definitions used by
 * Dungeon-Crawler-Quest (BabylonJS), GDevelop Assistant, and Grudge-Engine-Web.
 *
 * Source FBX location:
 *   GRUDGE-sourse/GRUDGE-NFT-Island-2026/source/Assets/Toon_RTS/{Race}/
 *
 * After conversion the GLB files live under:
 *   public/models/toon-rts/{raceKey}/
 */

// ── Types ──────────────────────────────────────────────────────

export type ToonRtsRaceKey = 'barbarians' | 'dwarves' | 'elves' | 'orcs' | 'undead' | 'western_kingdoms';

/** One FBX animation clip */
export interface ToonRtsAnimClip {
  /** Human-readable name */
  name: string;
  /** Relative path from the race root, e.g. "animation/Cavalry/DWF_cavalry_01_idle.FBX" */
  fbxPath: string;
  /** Expected GLB output path under public/ */
  glbPath: string;
  /** Category for grouping in the editor */
  category: 'cavalry' | 'infantry' | 'worker' | 'mage' | 'siege' | 'boltthrower' | 'misc';
}

/** One equipment piece (weapon, shield, prop) */
export interface ToonRtsEquipment {
  name: string;
  fbxPath: string;
  glbPath: string;
  type: 'weapon' | 'shield' | 'prop';
}

/** Material / texture reference */
export interface ToonRtsMaterial {
  name: string;
  matFile: string;
  texturePath: string;
  /** Color-variant sub-materials (e.g. ELF has DarkElf/HighElf/WoodElf) */
  variants?: { name: string; matFile: string; texturePath: string }[];
}

/** Full race definition */
export interface ToonRtsRaceDef {
  /** Internal key */
  key: ToonRtsRaceKey;
  /** Asset prefix used in filenames (BRB, DWF, ELF, ORC, UD, WK) */
  prefix: string;
  /** Display name */
  displayName: string;
  /** Corresponding Grudge game race */
  gameRace: string;
  /** Grudge faction */
  faction: string;

  // ── Models ──
  /** Infantry customizable FBX */
  characterFbx: string;
  characterGlb: string;
  /** Cavalry (rider + mount) customizable FBX */
  cavalryFbx: string;
  cavalryGlb: string;
  /** Optional siege / special FBX */
  siegeFbx?: string;
  siegeGlb?: string;

  // ── Mount info ──
  mountType: string;
  mountMaterial?: string;

  // ── Sub-assets ──
  equipment: ToonRtsEquipment[];
  materials: ToonRtsMaterial[];
  animations: ToonRtsAnimClip[];
}

// ── Helpers ─────────────────────────────────────────────────────

const SRC = 'Toon_RTS';
const OUT = '/models/toon-rts';

function glb(raceKey: ToonRtsRaceKey, file: string): string {
  return `${OUT}/${raceKey}/${file}`;
}

function fbx(race: string, ...parts: string[]): string {
  return `${SRC}/${race}/${parts.join('/')}`;
}

// ── Registry ────────────────────────────────────────────────────

export const TOON_RTS_RACES: ToonRtsRaceDef[] = [
  // ═══════════════════════════════════════════════════════════════
  // BARBARIANS (BRB) → Game Race: Barbarian, Faction: Crusade
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'barbarians',
    prefix: 'BRB',
    displayName: 'Barbarians',
    gameRace: 'Barbarian',
    faction: 'Crusade',

    characterFbx: fbx('Barbarians', 'models', 'BRB_Characters_customizable.FBX'),
    characterGlb: glb('barbarians', 'BRB_Characters_customizable.glb'),
    cavalryFbx: fbx('Barbarians', 'models', 'BRB_Cavalry_customizable.FBX'),
    cavalryGlb: glb('barbarians', 'BRB_Cavalry_customizable.glb'),

    mountType: 'War Bear',

    equipment: [
      { name: 'Hammer B', fbxPath: fbx('Barbarians', 'models', 'extra models', 'Equipment', 'BRB_weapon_hammer_B.FBX'), glbPath: glb('barbarians', 'equipment/BRB_weapon_hammer_B.glb'), type: 'weapon' },
      { name: 'Spear', fbxPath: fbx('Barbarians', 'models', 'extra models', 'Equipment', 'BRB_weapon_spear.FBX'), glbPath: glb('barbarians', 'equipment/BRB_weapon_spear.glb'), type: 'weapon' },
      { name: 'Staff B', fbxPath: fbx('Barbarians', 'models', 'extra models', 'Equipment', 'BRB_weapon_staff_B.FBX'), glbPath: glb('barbarians', 'equipment/BRB_weapon_staff_B.glb'), type: 'weapon' },
      { name: 'Sword B', fbxPath: fbx('Barbarians', 'models', 'extra models', 'Equipment', 'BRB_weapon_sword_B.FBX'), glbPath: glb('barbarians', 'equipment/BRB_weapon_sword_B.glb'), type: 'weapon' },
      { name: 'Bag', fbxPath: fbx('Barbarians', 'models', 'extra models', 'BRB_bag.FBX'), glbPath: glb('barbarians', 'equipment/BRB_bag.glb'), type: 'prop' },
    ],

    materials: [
      {
        name: 'Standard Units',
        matFile: fbx('Barbarians', 'models', 'Materials', 'BRB_Standard_Units.mat'),
        texturePath: fbx('Barbarians', 'models', 'Materials', 'BRB_StandardUnits_texture.tga'),
      },
    ],

    animations: [
      { name: 'Mage Cast', fbxPath: fbx('Barbarians', 'animation', 'Mage', 'BRB_mage_11_cast_.FBX'), glbPath: glb('barbarians', 'anims/BRB_mage_cast.glb'), category: 'mage' },
      { name: 'Spearman Anim', fbxPath: fbx('Barbarians', 'animation', 'Spearman', 'BRB_spearman_.FBX'), glbPath: glb('barbarians', 'anims/BRB_spearman.glb'), category: 'infantry' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // DWARVES (DWF) → Game Race: Dwarf, Faction: Fabled
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'dwarves',
    prefix: 'DWF',
    displayName: 'Dwarves',
    gameRace: 'Dwarf',
    faction: 'Fabled',

    characterFbx: fbx('Dwarves', 'models', 'DWF_Characters_customizable.FBX'),
    characterGlb: glb('dwarves', 'DWF_Characters_customizable.glb'),
    cavalryFbx: fbx('Dwarves', 'models', 'DWF_Cavalry_customizable.FBX'),
    cavalryGlb: glb('dwarves', 'DWF_Cavalry_customizable.glb'),

    mountType: 'War Ram',

    equipment: [],

    materials: [
      {
        name: 'Standard Units',
        matFile: fbx('Dwarves', 'models', 'Materials', 'DWF_Standard_Units.mat'),
        texturePath: fbx('Dwarves', 'models', 'Materials', 'DWF_Standard_Units.tga'),
      },
    ],

    animations: [
      { name: 'Cavalry Idle', fbxPath: fbx('Dwarves', 'animation', 'Cavalry', 'DWF_cavalry_01_idle.FBX'), glbPath: glb('dwarves', 'anims/DWF_cavalry_idle.glb'), category: 'cavalry' },
      { name: 'Cavalry Run', fbxPath: fbx('Dwarves', 'animation', 'Cavalry', 'DWF_cavalry_03_run.FBX'), glbPath: glb('dwarves', 'anims/DWF_cavalry_run.glb'), category: 'cavalry' },
      { name: 'Cavalry Death', fbxPath: fbx('Dwarves', 'animation', 'Cavalry', 'DWF_cavalry_10_death.FBX'), glbPath: glb('dwarves', 'anims/DWF_cavalry_death.glb'), category: 'cavalry' },
      { name: 'Worker Attack', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'DWF_worker_07_attack.FBX'), glbPath: glb('dwarves', 'anims/DWF_worker_attack.glb'), category: 'worker' },
      { name: 'Worker Death', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'DWF_worker_10_death.FBX'), glbPath: glb('dwarves', 'anims/DWF_worker_death.glb'), category: 'worker' },
      { name: 'Idle', fbxPath: fbx('Dwarves', 'animation', 'Worker', '_idle.FBX'), glbPath: glb('dwarves', 'anims/DWF_idle.glb'), category: 'infantry' },
      { name: 'Run', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'run.FBX'), glbPath: glb('dwarves', 'anims/DWF_run.glb'), category: 'infantry' },
      { name: 'Run Reverse', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'run Reverse.FBX'), glbPath: glb('dwarves', 'anims/DWF_run_reverse.glb'), category: 'infantry' },
      { name: 'Run Diagonal', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'run diagonal.FBX'), glbPath: glb('dwarves', 'anims/DWF_run_diagonal.glb'), category: 'infantry' },
      { name: 'Run Diagonal 1', fbxPath: fbx('Dwarves', 'animation', 'Worker', 'run diagonal 1.FBX'), glbPath: glb('dwarves', 'anims/DWF_run_diagonal_1.glb'), category: 'infantry' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ELVES (ELF) → Game Race: Elf, Faction: Fabled
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'elves',
    prefix: 'ELF',
    displayName: 'Elves',
    gameRace: 'Elf',
    faction: 'Fabled',

    characterFbx: fbx('Elves', 'models', 'ELF_Characters_customizable.FBX'),
    characterGlb: glb('elves', 'ELF_Characters_customizable.glb'),
    cavalryFbx: fbx('Elves', 'models', 'ELF_Cavalry_customizable.FBX'),
    cavalryGlb: glb('elves', 'ELF_Cavalry_customizable.glb'),
    siegeFbx: fbx('Elves', 'models', 'ELF_BoltThrower.FBX'),
    siegeGlb: glb('elves', 'ELF_BoltThrower.glb'),

    mountType: 'Elven Stag',

    equipment: [
      { name: 'Spear', fbxPath: fbx('Elves', 'models', 'extra models', 'equipment', 'ELF_weapon_spear.FBX'), glbPath: glb('elves', 'equipment/ELF_weapon_spear.glb'), type: 'weapon' },
      { name: 'Staff C', fbxPath: fbx('Elves', 'models', 'extra models', 'equipment', 'ELF_weapon_staff_C.FBX'), glbPath: glb('elves', 'equipment/ELF_weapon_staff_C.glb'), type: 'weapon' },
      { name: 'Bolt Projectile', fbxPath: fbx('Elves', 'models', 'extra models', 'ELF_bolt.FBX'), glbPath: glb('elves', 'equipment/ELF_bolt.glb'), type: 'prop' },
    ],

    materials: [
      {
        name: 'Elf Standard Units',
        matFile: '',
        texturePath: '',
        variants: [
          { name: 'Dark Elf', matFile: fbx('Elves', 'models', 'Materials', 'ELF_DarkElf_Standard_Units.mat'), texturePath: fbx('Elves', 'models', 'Materials', 'ELF_DarkElves_Texture.tga') },
          { name: 'High Elf', matFile: fbx('Elves', 'models', 'Materials', 'ELF_HighElf_Standard_Units.mat'), texturePath: fbx('Elves', 'models', 'Materials', 'ELF_HighElves_Texture.tga') },
          { name: 'Wood Elf', matFile: fbx('Elves', 'models', 'Materials', 'ELF_WoodElf_Standard_Units.mat'), texturePath: fbx('Elves', 'models', 'Materials', 'ELF_WoodElves_Texture.tga') },
        ],
      },
    ],

    animations: [
      // BoltThrower
      { name: 'BoltThrower Idle', fbxPath: fbx('Elves', 'animation', 'BoltThrower', 'ELF_boltthrower_idle.FBX'), glbPath: glb('elves', 'anims/ELF_boltthrower_idle.glb'), category: 'boltthrower' },
      { name: 'BoltThrower Attack', fbxPath: fbx('Elves', 'animation', 'BoltThrower', 'ELF_boltthrower_attack.FBX'), glbPath: glb('elves', 'anims/ELF_boltthrower_attack.glb'), category: 'boltthrower' },
      { name: 'BoltThrower Move', fbxPath: fbx('Elves', 'animation', 'BoltThrower', 'ELF_boltthrower_move.FBX'), glbPath: glb('elves', 'anims/ELF_boltthrower_move.glb'), category: 'boltthrower' },
      { name: 'BoltThrower Death', fbxPath: fbx('Elves', 'animation', 'BoltThrower', 'ELF_boltthrower_death.FBX'), glbPath: glb('elves', 'anims/ELF_boltthrower_death.glb'), category: 'boltthrower' },
      // Cavalry Mage
      { name: 'Cavalry Mage', fbxPath: fbx('Elves', 'animation', 'Cavalry_Mage', 'ELF_cavalry_mage.FBX'), glbPath: glb('elves', 'anims/ELF_cavalry_mage.glb'), category: 'cavalry' },
      // Cavalry Spear
      { name: 'Cavalry Spear Idle', fbxPath: fbx('Elves', 'animation', 'Cavalry_Spear', 'ELF_cavalry_spear_idle.FBX'), glbPath: glb('elves', 'anims/ELF_cavalry_spear_idle.glb'), category: 'cavalry' },
      { name: 'Cavalry Spear Run', fbxPath: fbx('Elves', 'animation', 'Cavalry_Spear', 'ELF_cavalry_spear_run.FBX'), glbPath: glb('elves', 'anims/ELF_cavalry_spear_run.glb'), category: 'cavalry' },
      { name: 'Cavalry Spear Attack', fbxPath: fbx('Elves', 'animation', 'Cavalry_Spear', 'ELF_cavalry_spear_attack.FBX'), glbPath: glb('elves', 'anims/ELF_cavalry_spear_attack.glb'), category: 'cavalry' },
      { name: 'Cavalry Spear Death', fbxPath: fbx('Elves', 'animation', 'Cavalry_Spear', 'ELF_cavalry_spear_death.FBX'), glbPath: glb('elves', 'anims/ELF_cavalry_spear_death.glb'), category: 'cavalry' },
      // Infantry
      { name: 'Infantry', fbxPath: fbx('Elves', 'animation', 'Infantry', 'ELF_infantry.FBX'), glbPath: glb('elves', 'anims/ELF_infantry.glb'), category: 'infantry' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ORCS (ORC) → Game Race: Orc, Faction: Legion
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'orcs',
    prefix: 'ORC',
    displayName: 'Orcs',
    gameRace: 'Orc',
    faction: 'Legion',

    characterFbx: fbx('Orcs', 'models', 'ORC_Characters_Customizable.FBX'),
    characterGlb: glb('orcs', 'ORC_Characters_Customizable.glb'),
    cavalryFbx: fbx('Orcs', 'models', 'ORC_Cavalry_Customizable.FBX'),
    cavalryGlb: glb('orcs', 'ORC_Cavalry_Customizable.glb'),
    siegeFbx: fbx('Orcs', 'models', 'ORC_Catapult.FBX'),
    siegeGlb: glb('orcs', 'ORC_Catapult.glb'),

    mountType: 'War Wolf',
    mountMaterial: fbx('Orcs', 'models', 'Materials', 'ORC_Wolf_A.mat'),

    equipment: [
      { name: 'Shield D', fbxPath: fbx('Orcs', 'models', 'extra_models', 'Equipment', 'ORC_Shield_D.FBX'), glbPath: glb('orcs', 'equipment/ORC_Shield_D.glb'), type: 'shield' },
      { name: 'Axe A', fbxPath: fbx('Orcs', 'models', 'extra_models', 'Equipment', 'ORC_weapon_Axe_A.FBX'), glbPath: glb('orcs', 'equipment/ORC_weapon_Axe_A.glb'), type: 'weapon' },
      { name: 'Staff B', fbxPath: fbx('Orcs', 'models', 'extra_models', 'Equipment', 'ORC_weapon_staff_B.FBX'), glbPath: glb('orcs', 'equipment/ORC_weapon_staff_B.glb'), type: 'weapon' },
    ],

    materials: [
      {
        name: 'Standard Units',
        matFile: fbx('Orcs', 'models', 'Materials', 'ORC_Standard_Units.mat'),
        texturePath: '',
      },
      {
        name: 'Wolf Mount',
        matFile: fbx('Orcs', 'models', 'Materials', 'ORC_Wolf_A.mat'),
        texturePath: '',
      },
    ],

    animations: [
      // Catapult
      { name: 'Catapult Idle', fbxPath: fbx('Orcs', 'animation', 'Catapult', 'ORC_catapult_01_idle.FBX'), glbPath: glb('orcs', 'anims/ORC_catapult_idle.glb'), category: 'siege' },
      { name: 'Catapult Move', fbxPath: fbx('Orcs', 'animation', 'Catapult', 'ORC_catapult_02_move.FBX'), glbPath: glb('orcs', 'anims/ORC_catapult_move.glb'), category: 'siege' },
      { name: 'Catapult Attack', fbxPath: fbx('Orcs', 'animation', 'Catapult', 'ORC_catapult_03_attack.FBX'), glbPath: glb('orcs', 'anims/ORC_catapult_attack.glb'), category: 'siege' },
      { name: 'Catapult Death', fbxPath: fbx('Orcs', 'animation', 'Catapult', 'ORC_catapult_04_death.FBX'), glbPath: glb('orcs', 'anims/ORC_catapult_death.glb'), category: 'siege' },
      // Cavalry
      { name: 'Cavalry Idle', fbxPath: fbx('Orcs', 'animation', 'Cavalry', 'ORC_cavalry_01_idle.FBX'), glbPath: glb('orcs', 'anims/ORC_cavalry_idle.glb'), category: 'cavalry' },
      { name: 'Cavalry Run', fbxPath: fbx('Orcs', 'animation', 'Cavalry', 'ORC_cavalry_03_run.FBX'), glbPath: glb('orcs', 'anims/ORC_cavalry_run.glb'), category: 'cavalry' },
      { name: 'Cavalry Death', fbxPath: fbx('Orcs', 'animation', 'Cavalry', 'ORC_cavalry_10_death.FBX'), glbPath: glb('orcs', 'anims/ORC_cavalry_death.glb'), category: 'cavalry' },
      // Worker
      { name: 'Worker Working', fbxPath: fbx('Orcs', 'animation', 'Worker', 'ORC_worker_12_working.FBX'), glbPath: glb('orcs', 'anims/ORC_worker_working.glb'), category: 'worker' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // UNDEAD (UD) → Game Race: Undead, Faction: Legion
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'undead',
    prefix: 'UD',
    displayName: 'Undead',
    gameRace: 'Undead',
    faction: 'Legion',

    characterFbx: fbx('Undead', 'models', 'UD_Characters_customizable.FBX'),
    characterGlb: glb('undead', 'UD_Characters_customizable.glb'),
    cavalryFbx: fbx('Undead', 'models', 'UD_Cavalry_customizable.FBX'),
    cavalryGlb: glb('undead', 'UD_Cavalry_customizable.glb'),

    mountType: 'Skeletal Horse',

    equipment: [
      { name: 'Shield C', fbxPath: fbx('Undead', 'models', 'extra_models', 'Equipment', 'UD_Shield_C.FBX'), glbPath: glb('undead', 'equipment/UD_Shield_C.glb'), type: 'shield' },
      { name: 'Spear', fbxPath: fbx('Undead', 'models', 'extra_models', 'Equipment', 'UD_weapon_Spear.FBX'), glbPath: glb('undead', 'equipment/UD_weapon_Spear.glb'), type: 'weapon' },
      { name: 'Staff B', fbxPath: fbx('Undead', 'models', 'extra_models', 'Equipment', 'UD_weapon_staff_B.FBX'), glbPath: glb('undead', 'equipment/UD_weapon_staff_B.glb'), type: 'weapon' },
      { name: 'Sword C', fbxPath: fbx('Undead', 'models', 'extra_models', 'Equipment', 'UD_weapon_Sword_C.FBX'), glbPath: glb('undead', 'equipment/UD_weapon_Sword_C.glb'), type: 'weapon' },
    ],

    materials: [
      {
        name: 'Standard Units',
        matFile: fbx('Undead', 'models', 'Materials', 'UD_Standard_Units.mat'),
        texturePath: fbx('Undead', 'models', 'Materials', 'UD_Standard_Units.tga'),
      },
    ],

    animations: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // WESTERN KINGDOMS (WK) → Game Race: Human, Faction: Crusade
  // ═══════════════════════════════════════════════════════════════
  {
    key: 'western_kingdoms',
    prefix: 'WK',
    displayName: 'Western Kingdoms',
    gameRace: 'Human',
    faction: 'Crusade',

    characterFbx: fbx('WesternKingdoms', 'models', 'WK_Characters_customizable.FBX'),
    characterGlb: glb('western_kingdoms', 'WK_Characters_customizable.glb'),
    cavalryFbx: fbx('WesternKingdoms', 'models', 'WK_Cavalry_customizable.FBX'),
    cavalryGlb: glb('western_kingdoms', 'WK_Cavalry_customizable.glb'),
    siegeFbx: fbx('WesternKingdoms', 'models', 'WK_Catapult.FBX'),
    siegeGlb: glb('western_kingdoms', 'WK_Catapult.glb'),

    mountType: 'War Horse',
    mountMaterial: fbx('WesternKingdoms', 'models', 'Materials', 'WK_Horse_A.mat'),

    equipment: [
      { name: 'Staff B', fbxPath: fbx('WesternKingdoms', 'models', 'extra models', 'equipment', 'WK_weapon_staff_B.FBX'), glbPath: glb('western_kingdoms', 'equipment/WK_weapon_staff_B.glb'), type: 'weapon' },
      { name: 'Sword A', fbxPath: fbx('WesternKingdoms', 'models', 'extra models', 'equipment', 'WK_weapon_sword_A.FBX'), glbPath: glb('western_kingdoms', 'equipment/WK_weapon_sword_A.glb'), type: 'weapon' },
    ],

    materials: [
      {
        name: 'Standard Units',
        matFile: fbx('WesternKingdoms', 'models', 'Materials', 'WK_Standard_Units.mat'),
        texturePath: '',
      },
      {
        name: 'Horse Mount',
        matFile: fbx('WesternKingdoms', 'models', 'Materials', 'WK_Horse_A.mat'),
        texturePath: '',
      },
    ],

    animations: [
      // Catapult
      { name: 'Catapult Idle', fbxPath: fbx('WesternKingdoms', 'animation', 'Catapult', 'WK_catapult_idle.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_catapult_idle.glb'), category: 'siege' },
      { name: 'Catapult Move', fbxPath: fbx('WesternKingdoms', 'animation', 'Catapult', 'WK_catapult_move.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_catapult_move.glb'), category: 'siege' },
      { name: 'Catapult Attack', fbxPath: fbx('WesternKingdoms', 'animation', 'Catapult', 'WK_catapult_attack.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_catapult_attack.glb'), category: 'siege' },
      { name: 'Catapult Death', fbxPath: fbx('WesternKingdoms', 'animation', 'Catapult', 'WK_catapult_death.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_catapult_death.glb'), category: 'siege' },
      // Cavalry
      { name: 'Cavalry Idle', fbxPath: fbx('WesternKingdoms', 'animation', 'Cavalry', 'WK_cavalry_idle.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_cavalry_idle.glb'), category: 'cavalry' },
      { name: 'Cavalry Run', fbxPath: fbx('WesternKingdoms', 'animation', 'Cavalry', 'WK_cavalry_run.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_cavalry_run.glb'), category: 'cavalry' },
      { name: 'Cavalry Death', fbxPath: fbx('WesternKingdoms', 'animation', 'Cavalry', 'WK_cavalry_death.FBX'), glbPath: glb('western_kingdoms', 'anims/WK_cavalry_death.glb'), category: 'cavalry' },
    ],
  },
];

// ── Lookup Helpers ──────────────────────────────────────────────

/** Map from game race name → ToonRtsRaceDef */
export const TOON_RTS_BY_GAME_RACE: Record<string, ToonRtsRaceDef> = {};
for (const race of TOON_RTS_RACES) {
  TOON_RTS_BY_GAME_RACE[race.gameRace] = race;
}

/** Map from Toon_RTS prefix → ToonRtsRaceDef */
export const TOON_RTS_BY_PREFIX: Record<string, ToonRtsRaceDef> = {};
for (const race of TOON_RTS_RACES) {
  TOON_RTS_BY_PREFIX[race.prefix] = race;
}

/** Get the Toon_RTS race def for a game race name */
export function getToonRtsRace(gameRace: string): ToonRtsRaceDef | undefined {
  return TOON_RTS_BY_GAME_RACE[gameRace];
}

/** Get all cavalry animation clips for a game race */
export function getCavalryAnims(gameRace: string): ToonRtsAnimClip[] {
  const def = TOON_RTS_BY_GAME_RACE[gameRace];
  return def?.animations.filter(a => a.category === 'cavalry') ?? [];
}

/** Get all equipment for a game race */
export function getRaceEquipment(gameRace: string): ToonRtsEquipment[] {
  return TOON_RTS_BY_GAME_RACE[gameRace]?.equipment ?? [];
}

/** Collect every FBX path in the registry (for the conversion script) */
export function allFbxPaths(): { fbx: string; glb: string }[] {
  const result: { fbx: string; glb: string }[] = [];
  for (const race of TOON_RTS_RACES) {
    result.push({ fbx: race.characterFbx, glb: race.characterGlb });
    result.push({ fbx: race.cavalryFbx, glb: race.cavalryGlb });
    if (race.siegeFbx && race.siegeGlb) {
      result.push({ fbx: race.siegeFbx, glb: race.siegeGlb });
    }
    for (const eq of race.equipment) {
      result.push({ fbx: eq.fbxPath, glb: eq.glbPath });
    }
    for (const anim of race.animations) {
      result.push({ fbx: anim.fbxPath, glb: anim.glbPath });
    }
  }
  return result;
}

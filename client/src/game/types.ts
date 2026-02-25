export interface Attributes {
  strength: number;
  intellect: number;
  vitality: number;
  dexterity: number;
  endurance: number;
  wisdom: number;
  agility: number;
  tactics: number;
}

export interface DerivedStats {
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  damage: number;
  magicDamage: number;
  defense: number;
  blockChance: number;
  evasion: number;
  accuracy: number;
  criticalChance: number;
  criticalDamage: number;
  attackSpeed: number;
  movementSpeed: number;
  resistance: number;
  armorPenetration: number;
  drainHealth: number;
  manaRegen: number;
  healthRegen: number;
  cooldownReduction: number;
}

export interface CharacterClass {
  id: string;
  name: string;
  description: string;
  lore: string;
  modelFile: string;
  baseAttributes: Attributes;
  color: string;
  secondaryColor: string;
  abilities: Ability[];
  icon: string;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  damageMultiplier: number;
  manaCost: number;
  cooldown: number;
  range: number;
  aoeRadius: number;
  type: 'melee' | 'ranged' | 'magic' | 'buff';
  color: string;
  key: string;
}

export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  classId: string;
  level: number;
  experience: number;
  experienceToLevel: number;
  attributes: Attributes;
  unallocatedPoints: number;
  stats: DerivedStats;
  position: Position;
  velocity: Position;
  radius: number;
  color: string;
  abilities: Ability[];
  abilityCooldowns: Record<string, number>;
  equipment: Equipment;
  inventory: Item[];
  isAttacking: boolean;
  attackTarget: string | null;
  lastAttackTime: number;
  facingAngle: number;
  currentHealth: number;
  currentMana: number;
  currentStamina: number;
  isDead: boolean;
  respawnTimer: number;
  dashCooldown: number;
  lastDashTime: number;
}

export interface Enemy {
  id: string;
  name: string;
  type: EnemyType;
  level: number;
  health: number;
  maxHealth: number;
  damage: number;
  defense: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  position: Position;
  velocity: Position;
  radius: number;
  color: string;
  patrolTarget: Position | null;
  isBoss: boolean;
  experienceReward: number;
  goldReward: number;
  facingAngle: number;
  hitFlash: number;
  deathTimer: number;
}

export type EnemyType = 'skeleton' | 'zombie' | 'demon' | 'spider' | 'wraith' | 'golem' | 'dragon' | 'necromancer';

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  slot?: EquipmentSlot;
  stats: Partial<DerivedStats>;
  attributeBonus?: Partial<Attributes>;
  level: number;
  icon: string;
  color: string;
}

export type ItemType = 'weapon' | 'armor' | 'accessory' | 'consumable';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type EquipmentSlot = 'weapon' | 'helmet' | 'chest' | 'legs' | 'boots' | 'gloves' | 'ring' | 'amulet';

export interface Equipment {
  weapon: Item | null;
  helmet: Item | null;
  chest: Item | null;
  legs: Item | null;
  boots: Item | null;
  gloves: Item | null;
  ring: Item | null;
  amulet: Item | null;
}

export interface DungeonTile {
  type: 'wall' | 'floor' | 'door' | 'stairs_down' | 'stairs_up' | 'chest' | 'trap';
  explored: boolean;
  visible: boolean;
  variant: number;
}

export interface DungeonRoom {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'normal' | 'treasure' | 'boss' | 'start' | 'exit';
  connected: boolean;
}

export interface DungeonFloor {
  width: number;
  height: number;
  tiles: DungeonTile[][];
  rooms: DungeonRoom[];
  enemies: Enemy[];
  items: DroppedItem[];
  floor: number;
  chests: ChestEntity[];
}

export interface ChestEntity {
  id: string;
  position: Position;
  opened: boolean;
  loot: Item[];
}

export interface DroppedItem {
  id: string;
  item: Item;
  position: Position;
  sparkleTimer: number;
}

export interface Particle {
  position: Position;
  velocity: Position;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'damage' | 'heal' | 'loot' | 'levelup' | 'hit' | 'death' | 'ability';
  text?: string;
}

export interface FloatingText {
  text: string;
  position: Position;
  color: string;
  life: number;
  maxLife: number;
  fontSize: number;
}

export interface GameState {
  player: Player;
  dungeon: DungeonFloor;
  particles: Particle[];
  camera: Position;
  gameTime: number;
  isPaused: boolean;
  showInventory: boolean;
  showCharacterSheet: boolean;
  showMap: boolean;
  currentFloor: number;
  killCount: number;
  itemsCollected: number;
  floatingTexts: FloatingText[];
  gold: number;
  mouseWorldPos: Position;
  screenShake: number;
  gameOver: boolean;
}

export const TILE_SIZE = 48;
export const PLAYER_RADIUS = 14;
export const ENEMY_RADIUS = 12;
export const BOSS_RADIUS = 20;
export const PICKUP_RANGE = 40;
export const CHEST_RANGE = 50;

export const RARITY_COLORS: Record<ItemRarity, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export const ENEMY_COLORS: Record<EnemyType, string> = {
  skeleton: '#d4c5a9',
  zombie: '#4a7c59',
  demon: '#dc2626',
  spider: '#6b21a8',
  wraith: '#67e8f9',
  golem: '#78716c',
  dragon: '#ef4444',
  necromancer: '#7c3aed',
};

export function calculateDerivedStats(attrs: Attributes): DerivedStats {
  const { strength, intellect, vitality, dexterity, endurance, wisdom, agility, tactics } = attrs;

  return {
    maxHealth: 250 + vitality * 8 + strength * 3 + endurance * 2,
    health: 250 + vitality * 8 + strength * 3 + endurance * 2,
    maxMana: 100 + intellect * 5 + wisdom * 3,
    mana: 100 + intellect * 5 + wisdom * 3,
    maxStamina: 100 + endurance * 4 + vitality * 2 + agility * 1,
    stamina: 100 + endurance * 4 + vitality * 2 + agility * 1,
    damage: strength * 2.5 + dexterity * 1.2 + tactics * 0.8,
    magicDamage: intellect * 3 + wisdom * 1.5,
    defense: endurance * 2 + strength * 1 + vitality * 0.5,
    blockChance: Math.min(0.5, (endurance * 0.8 + strength * 0.3) / 100),
    evasion: Math.min(0.4, (agility * 1.2 + dexterity * 0.5) / 100),
    accuracy: 0.7 + Math.min(0.3, (dexterity * 0.8 + tactics * 0.4) / 100),
    criticalChance: Math.min(0.5, (dexterity * 0.8 + tactics * 0.3 + agility * 0.2) / 100),
    criticalDamage: 1.5 + (dexterity * 0.5 + tactics * 0.3) / 100,
    attackSpeed: 1.0 + (agility * 0.8 + dexterity * 0.4) / 100,
    movementSpeed: 3.0 + (agility * 0.5 + dexterity * 0.2) / 100,
    resistance: (wisdom * 1.5 + endurance * 0.5 + intellect * 0.3) / 100,
    armorPenetration: (tactics * 1.5 + strength * 0.3) / 100,
    drainHealth: (strength * 0.15 + vitality * 0.05) / 100,
    manaRegen: 1 + (wisdom * 0.3 + intellect * 0.2),
    healthRegen: 1 + (vitality * 0.4 + endurance * 0.1),
    cooldownReduction: Math.min(0.4, (intellect * 0.4 + wisdom * 0.3) / 100),
  };
}

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: 'crusader',
    name: 'Crusader Knight',
    description: 'Holy warrior clad in blessed armor. Excels at defense and divine retribution.',
    lore: 'Sworn to the Order of the Eternal Light, Crusader Knights channel divine power through their blessed armor to smite the unholy.',
    modelFile: 'crusaders_knight_1771998910057.glb',
    baseAttributes: { strength: 25, intellect: 5, vitality: 25, dexterity: 10, endurance: 30, wisdom: 15, agility: 5, tactics: 10 },
    color: '#c9a94e',
    secondaryColor: '#8b7332',
    icon: 'shield',
    abilities: [
      { id: 'holy_strike', name: 'Holy Strike', description: 'A powerful strike blessed with divine power', damageMultiplier: 2.0, manaCost: 15, cooldown: 3, range: 60, aoeRadius: 0, type: 'melee', color: '#fbbf24', key: '1' },
      { id: 'divine_shield', name: 'Divine Shield', description: 'Become invulnerable for 3 seconds', damageMultiplier: 0, manaCost: 30, cooldown: 15, range: 0, aoeRadius: 0, type: 'buff', color: '#f0f0f0', key: '2' },
      { id: 'consecration', name: 'Consecration', description: 'Damage all enemies in an area around you', damageMultiplier: 1.5, manaCost: 25, cooldown: 8, range: 0, aoeRadius: 120, type: 'magic', color: '#fde68a', key: '3' },
      { id: 'judgment', name: 'Judgment', description: 'Call down holy judgment on a target', damageMultiplier: 3.0, manaCost: 40, cooldown: 12, range: 200, aoeRadius: 60, type: 'magic', color: '#fffbeb', key: '4' },
    ],
  },
  {
    id: 'berserker',
    name: 'Berserker',
    description: 'Unleashes primal fury in devastating melee attacks. Grows stronger as health drops.',
    lore: 'Born of the northern wastes, Berserkers tap into a rage so deep it borders on madness, trading defense for overwhelming destructive power.',
    modelFile: 'berserker_1771998910063.glb',
    baseAttributes: { strength: 35, intellect: 0, vitality: 30, dexterity: 15, endurance: 15, wisdom: 0, agility: 15, tactics: 15 },
    color: '#dc2626',
    secondaryColor: '#991b1b',
    icon: 'axe',
    abilities: [
      { id: 'whirlwind', name: 'Whirlwind', description: 'Spin in a circle dealing damage to all nearby', damageMultiplier: 1.8, manaCost: 20, cooldown: 5, range: 0, aoeRadius: 100, type: 'melee', color: '#ef4444', key: '1' },
      { id: 'blood_rage', name: 'Blood Rage', description: 'Enter a rage, boosting damage by 50%', damageMultiplier: 0, manaCost: 10, cooldown: 20, range: 0, aoeRadius: 0, type: 'buff', color: '#b91c1c', key: '2' },
      { id: 'cleave', name: 'Cleave', description: 'A wide sweeping attack hitting all in front', damageMultiplier: 2.5, manaCost: 15, cooldown: 4, range: 80, aoeRadius: 80, type: 'melee', color: '#f87171', key: '3' },
      { id: 'execute', name: 'Execute', description: 'Devastating blow that deals more damage to low HP enemies', damageMultiplier: 4.0, manaCost: 35, cooldown: 10, range: 60, aoeRadius: 0, type: 'melee', color: '#7f1d1d', key: '4' },
    ],
  },
  {
    id: 'elf_ranger',
    name: 'Elf Ranger',
    description: 'Master of ranged combat with unmatched precision and deadly traps.',
    lore: 'Guardians of the ancient forests, Elf Rangers can strike from the shadows with arrows that never miss their mark.',
    modelFile: 'ElfRanger_1771998910060.glb',
    baseAttributes: { strength: 5, intellect: 10, vitality: 10, dexterity: 35, endurance: 5, wisdom: 10, agility: 30, tactics: 20 },
    color: '#22c55e',
    secondaryColor: '#166534',
    icon: 'bow',
    abilities: [
      { id: 'power_shot', name: 'Power Shot', description: 'A charged arrow dealing massive damage', damageMultiplier: 2.8, manaCost: 12, cooldown: 3, range: 350, aoeRadius: 0, type: 'ranged', color: '#4ade80', key: '1' },
      { id: 'rain_of_arrows', name: 'Rain of Arrows', description: 'Shower an area with arrows', damageMultiplier: 1.5, manaCost: 30, cooldown: 10, range: 300, aoeRadius: 120, type: 'ranged', color: '#86efac', key: '2' },
      { id: 'shadow_step', name: 'Shadow Step', description: 'Teleport a short distance', damageMultiplier: 0, manaCost: 15, cooldown: 6, range: 200, aoeRadius: 0, type: 'buff', color: '#064e3b', key: '3' },
      { id: 'multi_shot', name: 'Multi Shot', description: 'Fire three arrows in a cone', damageMultiplier: 1.8, manaCost: 20, cooldown: 5, range: 300, aoeRadius: 90, type: 'ranged', color: '#a7f3d0', key: '4' },
    ],
  },
  {
    id: 'necromancer',
    name: 'Human Deathgiver',
    description: 'Commands the forces of death. Drains life from enemies and raises the fallen.',
    lore: 'Walking the thin line between life and death, Deathgivers harvest souls to fuel their dark magic and command armies of the undead.',
    modelFile: 'humandeathgiver_1771998910062.glb',
    baseAttributes: { strength: 5, intellect: 35, vitality: 15, dexterity: 5, endurance: 5, wisdom: 30, agility: 5, tactics: 25 },
    color: '#7c3aed',
    secondaryColor: '#4c1d95',
    icon: 'skull',
    abilities: [
      { id: 'soul_drain', name: 'Soul Drain', description: 'Drain life from an enemy, healing yourself', damageMultiplier: 1.5, manaCost: 20, cooldown: 4, range: 200, aoeRadius: 0, type: 'magic', color: '#a78bfa', key: '1' },
      { id: 'corpse_explosion', name: 'Corpse Explosion', description: 'Detonate nearby corpses for massive AoE damage', damageMultiplier: 3.0, manaCost: 25, cooldown: 8, range: 0, aoeRadius: 150, type: 'magic', color: '#581c87', key: '2' },
      { id: 'bone_armor', name: 'Bone Armor', description: 'Shield yourself with bones, absorbing damage', damageMultiplier: 0, manaCost: 20, cooldown: 12, range: 0, aoeRadius: 0, type: 'buff', color: '#e2e8f0', key: '3' },
      { id: 'death_wave', name: 'Death Wave', description: 'Unleash a wave of death energy', damageMultiplier: 2.5, manaCost: 35, cooldown: 10, range: 250, aoeRadius: 100, type: 'magic', color: '#6d28d9', key: '4' },
    ],
  },
  {
    id: 'dwarf_enforcer',
    name: 'Dwarf Enforcer',
    description: 'Unyielding fortress of steel. Specializes in crowd control and area denial.',
    lore: 'From the deepest mountain holds, Dwarf Enforcers carry the weight of ancient grudges and the strength of stone itself.',
    modelFile: 'dwarf_enforcer_1771998910058.glb',
    baseAttributes: { strength: 30, intellect: 5, vitality: 20, dexterity: 5, endurance: 35, wisdom: 5, agility: 5, tactics: 20 },
    color: '#f59e0b',
    secondaryColor: '#b45309',
    icon: 'hammer',
    abilities: [
      { id: 'ground_slam', name: 'Ground Slam', description: 'Slam the ground, stunning nearby enemies', damageMultiplier: 2.0, manaCost: 20, cooldown: 6, range: 0, aoeRadius: 100, type: 'melee', color: '#d97706', key: '1' },
      { id: 'fortress', name: 'Fortress', description: 'Become immovable, greatly increasing defense', damageMultiplier: 0, manaCost: 15, cooldown: 15, range: 0, aoeRadius: 0, type: 'buff', color: '#92400e', key: '2' },
      { id: 'hammer_throw', name: 'Hammer Throw', description: 'Hurl your hammer at a distant target', damageMultiplier: 2.2, manaCost: 15, cooldown: 4, range: 250, aoeRadius: 40, type: 'ranged', color: '#fbbf24', key: '3' },
      { id: 'earthquake', name: 'Earthquake', description: 'Cause the earth to shatter around you', damageMultiplier: 3.5, manaCost: 40, cooldown: 15, range: 0, aoeRadius: 180, type: 'melee', color: '#78350f', key: '4' },
    ],
  },
  {
    id: 'gladiator',
    name: 'Barbarian Gladiator',
    description: 'Arena champion who combines brutal strength with tactical precision.',
    lore: 'Forged in the blood-soaked arenas of the southern empires, Gladiators fight with calculated ferocity and showmanship.',
    modelFile: 'BarbarianGlad_1771998910063.glb',
    baseAttributes: { strength: 25, intellect: 5, vitality: 20, dexterity: 20, endurance: 20, wisdom: 0, agility: 20, tactics: 15 },
    color: '#ea580c',
    secondaryColor: '#9a3412',
    icon: 'sword',
    abilities: [
      { id: 'lunging_strike', name: 'Lunging Strike', description: 'Dash forward and strike with tremendous force', damageMultiplier: 2.2, manaCost: 12, cooldown: 3, range: 120, aoeRadius: 0, type: 'melee', color: '#fb923c', key: '1' },
      { id: 'war_cry', name: 'War Cry', description: 'Boost attack speed and damage for a duration', damageMultiplier: 0, manaCost: 20, cooldown: 18, range: 0, aoeRadius: 0, type: 'buff', color: '#f97316', key: '2' },
      { id: 'arena_sweep', name: 'Arena Sweep', description: 'Sweeping attack in a full circle', damageMultiplier: 1.8, manaCost: 18, cooldown: 5, range: 0, aoeRadius: 90, type: 'melee', color: '#fdba74', key: '3' },
      { id: 'finishing_blow', name: 'Finishing Blow', description: 'Ultimate execution attack', damageMultiplier: 5.0, manaCost: 50, cooldown: 20, range: 60, aoeRadius: 0, type: 'melee', color: '#7c2d12', key: '4' },
    ],
  },
];

export function getEnemyTemplate(type: EnemyType, floor: number, isBoss: boolean = false): Partial<Enemy> {
  const levelBase = floor * 2 + Math.floor(Math.random() * 3);
  const bossMultiplier = isBoss ? 3 : 1;

  const templates: Record<EnemyType, Partial<Enemy>> = {
    skeleton: {
      name: isBoss ? 'Skeleton Lord' : 'Skeleton Warrior',
      damage: (8 + levelBase * 2) * bossMultiplier,
      maxHealth: (50 + levelBase * 15) * bossMultiplier,
      defense: (2 + levelBase) * bossMultiplier,
      speed: 1.8,
      detectionRange: 180,
      attackRange: 45,
      attackCooldown: 1200,
      experienceReward: (15 + levelBase * 5) * bossMultiplier,
      goldReward: (5 + levelBase * 2) * bossMultiplier,
    },
    zombie: {
      name: isBoss ? 'Zombie Abomination' : 'Shambling Zombie',
      damage: (12 + levelBase * 2.5) * bossMultiplier,
      maxHealth: (80 + levelBase * 20) * bossMultiplier,
      defense: (5 + levelBase * 1.5) * bossMultiplier,
      speed: 1.2,
      detectionRange: 150,
      attackRange: 40,
      attackCooldown: 1500,
      experienceReward: (20 + levelBase * 6) * bossMultiplier,
      goldReward: (8 + levelBase * 3) * bossMultiplier,
    },
    demon: {
      name: isBoss ? 'Arch Demon' : 'Lesser Demon',
      damage: (15 + levelBase * 3) * bossMultiplier,
      maxHealth: (70 + levelBase * 18) * bossMultiplier,
      defense: (4 + levelBase * 1.2) * bossMultiplier,
      speed: 2.2,
      detectionRange: 220,
      attackRange: 50,
      attackCooldown: 1000,
      experienceReward: (25 + levelBase * 7) * bossMultiplier,
      goldReward: (12 + levelBase * 4) * bossMultiplier,
    },
    spider: {
      name: isBoss ? 'Spider Queen' : 'Giant Spider',
      damage: (10 + levelBase * 2) * bossMultiplier,
      maxHealth: (40 + levelBase * 12) * bossMultiplier,
      defense: (1 + levelBase * 0.8) * bossMultiplier,
      speed: 2.8,
      detectionRange: 200,
      attackRange: 35,
      attackCooldown: 800,
      experienceReward: (12 + levelBase * 4) * bossMultiplier,
      goldReward: (4 + levelBase * 2) * bossMultiplier,
    },
    wraith: {
      name: isBoss ? 'Wraith King' : 'Spectral Wraith',
      damage: (14 + levelBase * 2.8) * bossMultiplier,
      maxHealth: (35 + levelBase * 10) * bossMultiplier,
      defense: (1 + levelBase * 0.5) * bossMultiplier,
      speed: 2.5,
      detectionRange: 250,
      attackRange: 60,
      attackCooldown: 900,
      experienceReward: (22 + levelBase * 6) * bossMultiplier,
      goldReward: (10 + levelBase * 3) * bossMultiplier,
    },
    golem: {
      name: isBoss ? 'Ancient Golem' : 'Stone Golem',
      damage: (18 + levelBase * 3.5) * bossMultiplier,
      maxHealth: (120 + levelBase * 25) * bossMultiplier,
      defense: (10 + levelBase * 2) * bossMultiplier,
      speed: 1.0,
      detectionRange: 160,
      attackRange: 50,
      attackCooldown: 2000,
      experienceReward: (30 + levelBase * 8) * bossMultiplier,
      goldReward: (15 + levelBase * 5) * bossMultiplier,
    },
    dragon: {
      name: isBoss ? 'Elder Dragon' : 'Drake',
      damage: (20 + levelBase * 4) * bossMultiplier,
      maxHealth: (100 + levelBase * 22) * bossMultiplier,
      defense: (8 + levelBase * 1.8) * bossMultiplier,
      speed: 2.0,
      detectionRange: 280,
      attackRange: 70,
      attackCooldown: 1100,
      experienceReward: (35 + levelBase * 10) * bossMultiplier,
      goldReward: (20 + levelBase * 6) * bossMultiplier,
    },
    necromancer: {
      name: isBoss ? 'Lich Lord' : 'Dark Necromancer',
      damage: (16 + levelBase * 3) * bossMultiplier,
      maxHealth: (60 + levelBase * 16) * bossMultiplier,
      defense: (3 + levelBase * 1) * bossMultiplier,
      speed: 1.5,
      detectionRange: 240,
      attackRange: 80,
      attackCooldown: 1300,
      experienceReward: (28 + levelBase * 8) * bossMultiplier,
      goldReward: (14 + levelBase * 5) * bossMultiplier,
    },
  };

  return templates[type];
}

export function generateLoot(floor: number, enemyLevel: number, isBoss: boolean): Item | null {
  const dropChance = isBoss ? 1.0 : 0.35;
  if (Math.random() > dropChance) return null;

  const rarityRoll = Math.random() + (isBoss ? 0.3 : 0) + floor * 0.02;
  let rarity: ItemRarity = 'common';
  if (rarityRoll > 0.95) rarity = 'legendary';
  else if (rarityRoll > 0.85) rarity = 'epic';
  else if (rarityRoll > 0.65) rarity = 'rare';
  else if (rarityRoll > 0.4) rarity = 'uncommon';

  const rarityMultiplier = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 }[rarity];
  const level = enemyLevel + Math.floor(Math.random() * 3) - 1;

  const slots: EquipmentSlot[] = ['weapon', 'helmet', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet'];
  const slot = slots[Math.floor(Math.random() * slots.length)];

  const weaponNames = ['Blade', 'Axe', 'Mace', 'Sword', 'Dagger', 'Staff', 'Hammer', 'Scythe'];
  const armorNames: Record<string, string[]> = {
    helmet: ['Helm', 'Crown', 'Hood', 'Circlet'],
    chest: ['Plate', 'Chainmail', 'Robes', 'Breastplate'],
    legs: ['Greaves', 'Leggings', 'Tassets', 'Pants'],
    boots: ['Boots', 'Sabatons', 'Treads', 'Sandals'],
    gloves: ['Gauntlets', 'Gloves', 'Grips', 'Bracers'],
    ring: ['Ring', 'Band', 'Loop', 'Signet'],
    amulet: ['Amulet', 'Pendant', 'Talisman', 'Necklace'],
  };

  const prefixes: Record<ItemRarity, string[]> = {
    common: ['Old', 'Worn', 'Simple', 'Basic'],
    uncommon: ['Sturdy', 'Fine', 'Sharp', 'Polished'],
    rare: ['Enchanted', 'Tempered', 'Rune-forged', 'Blessed'],
    epic: ['Shadowforged', 'Demonslayer', 'Arcane', 'Dragonbone'],
    legendary: ['Godforged', 'Abyssal', 'Celestial', 'Primordial'],
  };

  const prefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];
  const baseName = slot === 'weapon'
    ? weaponNames[Math.floor(Math.random() * weaponNames.length)]
    : (armorNames[slot] || ['Item'])[Math.floor(Math.random() * (armorNames[slot]?.length || 1))];

  const stats: Partial<DerivedStats> = {};
  const statPool = level * rarityMultiplier;

  if (slot === 'weapon') {
    stats.damage = Math.floor(statPool * 2 + Math.random() * statPool);
    if (Math.random() > 0.5) stats.criticalChance = +(Math.random() * 0.05 * rarityMultiplier).toFixed(3);
    if (Math.random() > 0.5) stats.attackSpeed = +(Math.random() * 0.1 * rarityMultiplier).toFixed(3);
  } else {
    stats.defense = Math.floor(statPool * 1.5 + Math.random() * statPool);
    if (Math.random() > 0.5) stats.maxHealth = Math.floor(statPool * 5);
    if (Math.random() > 0.6) stats.evasion = +(Math.random() * 0.03 * rarityMultiplier).toFixed(3);
    if (Math.random() > 0.7) stats.resistance = +(Math.random() * 0.03 * rarityMultiplier).toFixed(3);
  }

  const icons: Record<EquipmentSlot, string> = {
    weapon: 'W', helmet: 'H', chest: 'C', legs: 'L', boots: 'B', gloves: 'G', ring: 'R', amulet: 'A'
  };

  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${prefix} ${baseName}`,
    description: `A ${rarity} ${baseName.toLowerCase()} of level ${level}`,
    type: slot === 'weapon' ? 'weapon' : (slot === 'ring' || slot === 'amulet' ? 'accessory' : 'armor'),
    rarity,
    slot,
    stats,
    level,
    icon: icons[slot],
    color: RARITY_COLORS[rarity],
  };
}

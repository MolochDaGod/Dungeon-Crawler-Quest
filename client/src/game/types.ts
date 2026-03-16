export interface HeroData {
  id: number;
  name: string;
  title: string;
  race: string;
  heroClass: string;
  faction: string;
  rarity: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  mp: number;
  quote: string;
  isSecret?: boolean;
  equippedWeaponId?: string;
}

export interface AbilityDef {
  name: string;
  key: string;
  cooldown: number;
  manaCost: number;
  damage: number;
  range: number;
  radius: number;
  duration: number;
  type: 'damage' | 'buff' | 'debuff' | 'heal' | 'aoe' | 'dash' | 'summon';
  castType: 'targeted' | 'skillshot' | 'ground_aoe' | 'self_cast' | 'cone' | 'line';
  description: string;
  maxCharges?: number;
  chargeRechargeTime?: number;
  effect?: string;
  slot?: 'attack' | 'core' | 'defensive' | 'ultimate';
  weaponSkillId?: string;
  damageMultiplier?: number;
}

export interface ItemDef {
  id: number;
  name: string;
  cost: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  mp: number;
  description: string;
  tier: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface GameEntity {
  id: number;
  x: number;
  y: number;
  team: number;
  hp: number;
  maxHp: number;
  dead: boolean;
}

export interface StatusEffectDisplay {
  name: string;
  icon: string;
  color: string;
  remaining: number;
  stacks: number;
}

export interface MobaHero extends GameEntity {
  heroDataId: number;
  level: number;
  xp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  gold: number;
  kills: number;
  deaths: number;
  assists: number;
  items: (ItemDef | null)[];
  abilityCooldowns: number[];
  autoAttackTimer: number;
  targetId: number | null;
  moveTarget: Vec2 | null;
  attackMoveTarget: Vec2 | null;
  isAttackMoving: boolean;
  stopCommand: boolean;
  vx: number;
  vy: number;
  facing: number;
  animState: string;
  animTimer: number;
  attackAnimPhase: number;
  respawnTimer: number;
  isPlayer: boolean;
  stunTimer: number;
  buffTimer: number;
  shieldHp: number;
  lastDamagedBy: number[];
  activeEffects: any[];
  ccImmunityTimers: Map<string, number>;
  dodgeCooldown: number;
  dodgeTimer: number;
  dodgeDir: number;
  dashAttackCooldown: number;
  dashAttackTimer: number;
  lungeSlashTimer: number;
  lungeSlashCooldown: number;
  comboCount: number;
  comboTimer: number;
  blockActive: boolean;
  blockTimer: number;
  blockCooldown: number;
  iFrames: number;
  assignedLane: number;
  abilityCharges: number[];
  abilityChargeTimers: number[];
  abilityLevels: number[];
  abilityPoints: number;
  attackWindup: number;
  attackBackswing: number;
  pendingAttackTarget: number | null;
  aiChatTimer: number;
  killStreak: number;
}

export interface MobaMinion extends GameEntity {
  lane: number;
  waypointIndex: number;
  targetId: number | null;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  autoAttackTimer: number;
  minionType: 'melee' | 'ranged' | 'siege' | 'super';
  facing: number;
  animTimer: number;
  goldValue: number;
  xpValue: number;
  attackWindup: number;
  attackBackswing: number;
  pendingTarget: number | null;
}

export interface MobaTower extends GameEntity {
  lane: number;
  tierIndex: number;
  atk: number;
  rng: number;
  autoAttackTimer: number;
  targetId: number | null;
  isNexusTower: boolean;
}

export interface MobaNexus extends GameEntity {
  destroyed: boolean;
}

export interface JungleMob {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  rng: number;
  dead: boolean;
  facing: number;
  animTimer: number;
  autoAttackTimer: number;
  targetId: number | null;
  goldValue: number;
  xpValue: number;
  mobType: 'small' | 'medium' | 'buff';
  homeX: number;
  homeY: number;
  leashRange: number;
}

export interface JungleCamp {
  id: number;
  x: number;
  y: number;
  mobs: JungleMob[];
  respawnTimer: number;
  respawnDelay: number;
  campType: 'small' | 'medium' | 'buff';
  allDead: boolean;
}

export interface SpellProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  radius: number;
  team: number;
  sourceId: number;
  color: string;
  trailColor: string;
  piercing: boolean;
  hitIds: number[];
  life: number;
  maxLife: number;
  spellName: string;
  aoeRadius: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  targetType: 'hero' | 'minion' | 'tower' | 'nexus';
  damage: number;
  speed: number;
  team: number;
  sourceId: number;
  color: string;
  size: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'hit' | 'death' | 'levelup' | 'gold' | 'heal' | 'ability' | 'tower' | 'dodge' | 'block' | 'combo' | 'slash' | 'spark';
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
  size: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface MobaState {
  heroes: MobaHero[];
  minions: MobaMinion[];
  towers: MobaTower[];
  nexuses: MobaNexus[];
  jungleCamps: JungleCamp[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  camera: Camera;
  gameTime: number;
  nextMinionWave: number;
  playerHeroIndex: number;
  gameOver: boolean;
  winner: number;
  paused: boolean;
  nextEntityId: number;
  mouseWorld: Vec2;
  selectedAbility: number;
  showShop: boolean;
  showScoreboard: boolean;
  killFeed: { text: string; color: string; time: number }[];
  terrainMap: number[][];
  decorations: { x: number; y: number; type: string; seed: number }[];
  cursorMode: 'default' | 'attack' | 'ability' | 'move' | 'attackmove';
  hoveredEntityId: number | null;
  aKeyHeld: boolean;
  autoAttackEnabled: boolean;
  _ambientTimer: number;
  spellEffects: SpellEffect[];
  spellProjectiles: SpellProjectile[];
  screenShake: number;
  areaDamageZones: AreaDamageZoneState[];
  pendingSpriteEffects: { type: string; x: number; y: number; scale: number; duration: number }[];
  firstBloodClaimed: boolean;
}

export interface AreaDamageZoneState {
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  team: number;
  sourceId: number;
  tickInterval: number;
  tickTimer: number;
  ticksRemaining: number;
  life: number;
  maxLife: number;
  stunChance: number;
  stunTime: number;
  color: string;
  hitThisTick: number[];
  zoneType: 'fire' | 'frost' | 'poison' | 'lightning' | 'holy' | 'shadow';
}

export interface SpellEffect {
  x: number;
  y: number;
  type: 'slash_arc' | 'impact_ring' | 'dash_trail' | 'shield_flash' | 'combo_burst' | 'ground_slam' | 'fire_ring' | 'frost_ring' | 'meteor_shadow' | 'meteor_impact' | 'arrow_rain' | 'whirlwind_slash' | 'ground_scorch' | 'ground_frost' | 'cast_circle' | 'telegraph_circle' | 'axe_chop' | 'spear_thrust' | 'glaive_sweep' | 'blood_fury_aura' | 'fear_wave' | 'cleave_arc' | 'dance_blades';
  life: number;
  maxLife: number;
  radius: number;
  color: string;
  angle: number;
  data?: any;
}

export interface HudState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  kills: number;
  deaths: number;
  assists: number;
  items: (ItemDef | null)[];
  abilityCooldowns: number[];
  gameTime: number;
  heroName: string;
  heroTitle: string;
  heroClass: string;
  heroRace: string;
  gameOver: boolean;
  winner: number;
  team: number;
  showShop: boolean;
  showScoreboard: boolean;
  allHeroes: { name: string; kills: number; deaths: number; assists: number; level: number; team: number; hp: number; maxHp: number; heroRace: string; heroClass: string; items: (ItemDef | null)[] }[];
  killFeed: { text: string; color: string; time: number }[];
  atk: number;
  def: number;
  spd: number;
  rng: number;
  dead: boolean;
  respawnTimer: number;
  activeEffects: StatusEffectDisplay[];
  dodgeCooldown: number;
  dashAttackCooldown: number;
  lungeSlashCooldown: number;
  comboCount: number;
  comboTimer: number;
  blockActive: boolean;
  blockCooldown: number;
  autoAttackEnabled: boolean;
  abilityCharges: number[];
  abilityMaxCharges: number[];
  abilityLevels: number[];
  abilityPoints: number;
  minimapEntities: { x: number; y: number; type: 'player' | 'ally_hero' | 'enemy_hero' | 'ally_tower' | 'enemy_tower' | 'ally_nexus' | 'enemy_nexus' | 'ally_minion' | 'enemy_minion' | 'jungle_small' | 'jungle_medium' | 'jungle_buff'; dead?: boolean }[];
  cameraViewport: { x: number; y: number; w: number; h: number };
  targetInfo: TargetInfo | null;
}

export interface TargetInfo {
  name: string;
  entityType: 'hero' | 'minion' | 'tower' | 'nexus' | 'jungle_mob';
  hp: number;
  maxHp: number;
  level: number;
  team: number;
  isAlly: boolean;
  heroClass?: string;
  heroRace?: string;
  atk?: number;
  def?: number;
  activeEffects: StatusEffectDisplay[];
}

export const HEROES: HeroData[] = [
  { id: 0, name: "Sir Aldric Valorheart", title: "The Iron Bastion", race: "Human", heroClass: "Warrior", faction: "Crusade", rarity: "Rare", hp: 245, atk: 23, def: 19, spd: 57, rng: 1.5, mp: 95, quote: "The shield breaks before the will does." },
  { id: 1, name: "Gareth Moonshadow", title: "The Twilight Stalker", race: "Human", heroClass: "Worg", faction: "Crusade", rarity: "Rare", hp: 235, atk: 22, def: 16, spd: 67, rng: 1.5, mp: 100, quote: "The beast within is not my curse. It is my salvation." },
  { id: 2, name: "Archmage Elara Brightspire", title: "The Storm Caller", race: "Human", heroClass: "Mage", faction: "Crusade", rarity: "Epic", hp: 175, atk: 21, def: 9, spd: 62, rng: 5.5, mp: 155, quote: "Knowledge is the flame. I am merely the torch." },
  { id: 3, name: "Kael Shadowblade", title: "The Shadow Blade", race: "Human", heroClass: "Ranger", faction: "Crusade", rarity: "Rare", hp: 185, atk: 22, def: 11, spd: 72, rng: 6.5, mp: 115, quote: "You never see the arrow that kills you." },
  { id: 4, name: "Ulfgar Bonecrusher", title: "The Mountain Breaker", race: "Barbarian", heroClass: "Warrior", faction: "Crusade", rarity: "Rare", hp: 255, atk: 26, def: 17, spd: 58, rng: 1.5, mp: 85, quote: "I do not fight to survive. I fight because the mountain told me to." },
  { id: 5, name: "Hrothgar Fangborn", title: "The Beast of the North", race: "Barbarian", heroClass: "Worg", faction: "Crusade", rarity: "Epic", hp: 245, atk: 25, def: 14, spd: 68, rng: 1.5, mp: 90, quote: "The pack does not forgive. The pack does not forget." },
  { id: 6, name: "Volka Stormborn", title: "The Frost Witch", race: "Barbarian", heroClass: "Mage", faction: "Crusade", rarity: "Epic", hp: 185, atk: 24, def: 7, spd: 63, rng: 5.5, mp: 145, quote: "Winter does not come. I bring it." },
  { id: 7, name: "Svala Windrider", title: "The Silent Huntress", race: "Barbarian", heroClass: "Ranger", faction: "Crusade", rarity: "Rare", hp: 195, atk: 25, def: 9, spd: 73, rng: 6.5, mp: 105, quote: "The wind tells me where you hide." },
  { id: 8, name: "Thane Ironshield", title: "The Mountain Guardian", race: "Dwarf", heroClass: "Warrior", faction: "Fabled", rarity: "Epic", hp: 260, atk: 24, def: 23, spd: 52, rng: 1.5, mp: 90, quote: "Deeper than stone. Harder than iron. We endure." },
  { id: 9, name: "Bromm Earthshaker", title: "The Cavern Beast", race: "Dwarf", heroClass: "Worg", faction: "Fabled", rarity: "Legendary", hp: 250, atk: 23, def: 20, spd: 57, rng: 1.5, mp: 95, quote: "The mountain has teeth. I am its bite." },
  { id: 10, name: "Runa Forgekeeper", title: "The Runesmith", race: "Dwarf", heroClass: "Mage", faction: "Fabled", rarity: "Epic", hp: 190, atk: 22, def: 13, spd: 52, rng: 5.5, mp: 150, quote: "Every rune tells a story. Mine tells of fire." },
  { id: 11, name: "Durin Tunnelwatcher", title: "The Deep Scout", race: "Dwarf", heroClass: "Ranger", faction: "Fabled", rarity: "Rare", hp: 200, atk: 23, def: 15, spd: 62, rng: 6.5, mp: 110, quote: "In the deep, every sound is a target." },
  { id: 12, name: "Thalion Bladedancer", title: "The Graceful Death", race: "Elf", heroClass: "Warrior", faction: "Fabled", rarity: "Rare", hp: 230, atk: 22, def: 16, spd: 65, rng: 1.5, mp: 120, quote: "A blade is a brush. Combat is art." },
  { id: 13, name: "Sylara Wildheart", title: "The Forest Spirit", race: "Elf", heroClass: "Worg", faction: "Fabled", rarity: "Legendary", hp: 220, atk: 21, def: 13, spd: 70, rng: 1.5, mp: 115, quote: "The forest breathes through me. And it is angry." },
  { id: 14, name: "Lyra Stormweaver", title: "The Storm Weaver", race: "Elf", heroClass: "Mage", faction: "Fabled", rarity: "Legendary", hp: 160, atk: 20, def: 6, spd: 65, rng: 5.5, mp: 170, quote: "Magic is not power. It is understanding. I understand everything." },
  { id: 15, name: "Aelindra Swiftbow", title: "The Wind Walker", race: "Elf", heroClass: "Ranger", faction: "Fabled", rarity: "Epic", hp: 170, atk: 21, def: 8, spd: 75, rng: 6.5, mp: 130, quote: "I loosed the arrow yesterday. It arrives tomorrow. You die today." },
  { id: 16, name: "Grommash Ironjaw", title: "The Warchief", race: "Orc", heroClass: "Warrior", faction: "Legion", rarity: "Epic", hp: 250, atk: 27, def: 19, spd: 57, rng: 1.5, mp: 80, quote: "BLOOD AND THUNDER!" },
  { id: 17, name: "Fenris Bloodfang", title: "The Alpha", race: "Orc", heroClass: "Worg", faction: "Legion", rarity: "Legendary", hp: 240, atk: 26, def: 16, spd: 67, rng: 1.5, mp: 85, quote: "I am the alpha. There is no omega." },
  { id: 18, name: "Zul'jin the Hexmaster", title: "The Blood Shaman", race: "Orc", heroClass: "Mage", faction: "Legion", rarity: "Epic", hp: 180, atk: 25, def: 9, spd: 62, rng: 5.5, mp: 140, quote: "Your blood screams louder than you do." },
  { id: 19, name: "Razak Deadeye", title: "The Trophy Hunter", race: "Orc", heroClass: "Ranger", faction: "Legion", rarity: "Rare", hp: 190, atk: 26, def: 11, spd: 72, rng: 6.5, mp: 100, quote: "Every head on my wall was once the strongest in its land." },
  { id: 20, name: "Lord Malachar", title: "The Deathless Knight", race: "Undead", heroClass: "Warrior", faction: "Legion", rarity: "Epic", hp: 265, atk: 23, def: 20, spd: 52, rng: 1.5, mp: 95, quote: "I cannot die. I have tried." },
  { id: 21, name: "The Ghoulfather", title: "The Abomination", race: "Undead", heroClass: "Worg", faction: "Legion", rarity: "Legendary", hp: 255, atk: 22, def: 17, spd: 62, rng: 1.5, mp: 100, quote: "We... are... HUNGRY." },
  { id: 22, name: "Necromancer Vexis", title: "The Soul Harvester", race: "Undead", heroClass: "Mage", faction: "Legion", rarity: "Epic", hp: 195, atk: 21, def: 10, spd: 57, rng: 5.5, mp: 155, quote: "Death is not the end. It is the door to real power." },
  { id: 23, name: "Shade Whisper", title: "The Phantom Archer", race: "Undead", heroClass: "Ranger", faction: "Legion", rarity: "Rare", hp: 205, atk: 22, def: 12, spd: 67, rng: 6.5, mp: 115, quote: "I remember your face. I remember all their faces." },
  { id: 24, name: "Racalvin the Pirate King", title: "The Scourge of the Seven Seas", race: "Barbarian", heroClass: "Ranger", faction: "Pirates", rarity: "Legendary", hp: 225, atk: 30, def: 9, spd: 78, rng: 6.5, mp: 105, quote: "The sea does not bow. Neither do I.", isSecret: true },
  { id: 25, name: "Cpt. John Wayne", title: "The Sky Captain", race: "Human", heroClass: "Warrior", faction: "Pirates", rarity: "Legendary", hp: 240, atk: 30, def: 18, spd: 60, rng: 2.5, mp: 90, quote: "The ground is for those who've given up dreaming.", isSecret: true }
];

export const RACE_COLORS: Record<string, string> = {
  Human: '#94a3b8', Barbarian: '#f43f5e', Dwarf: '#f59e0b',
  Elf: '#22d3ee', Orc: '#65a30d', Undead: '#a78bfa'
};

export const CLASS_COLORS: Record<string, string> = {
  Warrior: '#ef4444', Worg: '#d97706', Mage: '#8b5cf6', Ranger: '#22c55e'
};

export const FACTION_COLORS: Record<string, string> = {
  Crusade: '#ef4444', Fabled: '#06b6d4', Legion: '#a855f7', Pirates: '#d4a017'
};

export const RARITY_COLORS: Record<string, string> = {
  Common: '#9ca3af', Uncommon: '#22c55e', Rare: '#3b82f6', Epic: '#a855f7', Legendary: '#ffd700'
};

export const STAT_COLORS: Record<string, string> = {
  hp: '#ef4444', atk: '#f59e0b', def: '#3b82f6', spd: '#22c55e', rng: '#06b6d4', mp: '#a855f7'
};

export const CLASS_ABILITIES: Record<string, AbilityDef[]> = {
  Human_Warrior: [
    { name: "Slash", key: "Q", cooldown: 0, manaCost: 0, damage: 35, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Basic sword slash attack", slot: 'attack', weaponSkillId: 'sword-slash', damageMultiplier: 1.0 },
    { name: "Power Strike", key: "E", cooldown: 6, manaCost: 15, damage: 55, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Powerful overhead strike dealing 150% damage", slot: 'core', weaponSkillId: 'sword-power-strike', damageMultiplier: 1.5 },
    { name: "Parry", key: "Space", cooldown: 8, manaCost: 10, damage: 0, range: 0, radius: 0, duration: 1.5, type: 'buff', castType: 'self_cast', description: "Block incoming attack and counter for 50% damage", slot: 'defensive', weaponSkillId: 'sword-parry', effect: 'block + counter' },
    { name: "Avatar", key: "R", cooldown: 60, manaCost: 80, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Transform into a giant, +50% HP and ATK for 10s", slot: 'ultimate' }
  ],
  Orc_Warrior: [
    { name: "Heavy Chop", key: "Q", cooldown: 0, manaCost: 0, damage: 45, range: 90, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Brutal overhead axe chop", slot: 'attack', weaponSkillId: 'ga-heavy-chop', damageMultiplier: 1.0 },
    { name: "Brutal Cleave", key: "E", cooldown: 7, manaCost: 20, damage: 60, range: 0, radius: 150, duration: 0, type: 'aoe', castType: 'cone', description: "Massive frontal cleave hitting all enemies in a cone", slot: 'core', weaponSkillId: 'ga-cleave', damageMultiplier: 1.4 },
    { name: "Charge", key: "Space", cooldown: 10, manaCost: 15, damage: 30, range: 250, radius: 0, duration: 0, type: 'dash', castType: 'targeted', description: "Bull rush forward, stunning on impact", slot: 'defensive', weaponSkillId: 'ga-charge', effect: 'stun 1s' },
    { name: "Blood Fury", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Enter blood rage: +40% ATK, +30% lifesteal, +20% move speed for 10s", slot: 'ultimate' }
  ],
  Elf_Warrior: [
    { name: "Spear Thrust", key: "Q", cooldown: 0, manaCost: 0, damage: 38, range: 120, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Long-range spear thrust attack", slot: 'attack', weaponSkillId: 'spear-thrust', damageMultiplier: 1.0 },
    { name: "Impale", key: "E", cooldown: 6, manaCost: 18, damage: 55, range: 120, radius: 0, duration: 3, type: 'damage', castType: 'targeted', description: "Impale target, pinning them and dealing bleed damage", slot: 'core', weaponSkillId: 'spear-impale', damageMultiplier: 1.4, effect: 'bleed 3s' },
    { name: "Vault", key: "Space", cooldown: 8, manaCost: 12, damage: 0, range: 200, radius: 0, duration: 0.5, type: 'dash', castType: 'ground_aoe', description: "Pole vault forward, dodging all attacks", slot: 'defensive', weaponSkillId: 'spear-vault', effect: 'dodge + i-frames' },
    { name: "Dance of Blades", key: "R", cooldown: 50, manaCost: 75, damage: 25, range: 0, radius: 160, duration: 3, type: 'aoe', castType: 'self_cast', description: "3s flurry of 8 rapid strikes on nearby enemies", slot: 'ultimate' }
  ],
  Barbarian_Warrior: [
    { name: "Smash", key: "Q", cooldown: 0, manaCost: 0, damage: 42, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Crushing hammer smash", slot: 'attack', weaponSkillId: 'hammer-smash', damageMultiplier: 1.0 },
    { name: "Earthquake", key: "E", cooldown: 8, manaCost: 25, damage: 50, range: 0, radius: 140, duration: 2, type: 'aoe', castType: 'self_cast', description: "Slam ground causing earthquake, stunning enemies", slot: 'core', weaponSkillId: 'hammer-quake', damageMultiplier: 1.3, effect: 'stun 2s' },
    { name: "Bull Rush", key: "Space", cooldown: 9, manaCost: 15, damage: 25, range: 200, radius: 0, duration: 0, type: 'dash', castType: 'targeted', description: "Charge forward knocking enemies aside", slot: 'defensive', weaponSkillId: 'hammer-charge', effect: 'knockback' },
    { name: "Titan's Wrath", key: "R", cooldown: 60, manaCost: 85, damage: 0, range: 0, radius: 0, duration: 12, type: 'buff', castType: 'self_cast', description: "Become unstoppable: +60% ATK, immune to CC for 12s", slot: 'ultimate' }
  ],
  Dwarf_Warrior: [
    { name: "Chop", key: "Q", cooldown: 0, manaCost: 0, damage: 36, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Quick axe chop attack", slot: 'attack', weaponSkillId: 'axe-chop', damageMultiplier: 1.0 },
    { name: "Double Chop", key: "E", cooldown: 5, manaCost: 15, damage: 45, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Twin axe strikes hitting twice rapidly", slot: 'core', weaponSkillId: 'axe-double-chop', damageMultiplier: 1.6, maxCharges: 2, chargeRechargeTime: 5 },
    { name: "Axe Block", key: "Space", cooldown: 7, manaCost: 10, damage: 0, range: 0, radius: 0, duration: 2, type: 'buff', castType: 'self_cast', description: "Raise shield and axe, blocking 80% damage", slot: 'defensive', weaponSkillId: 'axe-block', effect: 'block 80%' },
    { name: "Ironclad", key: "R", cooldown: 55, manaCost: 65, damage: 0, range: 0, radius: 200, duration: 8, type: 'buff', castType: 'self_cast', description: "Iron skin: +50% DEF, reflect 20% melee damage for 8s", slot: 'ultimate' }
  ],
  Undead_Warrior: [
    { name: "Heavy Slash", key: "Q", cooldown: 0, manaCost: 0, damage: 44, range: 90, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Heavy greatsword slash", slot: 'attack', weaponSkillId: 'gs-heavy-slash', damageMultiplier: 1.0 },
    { name: "Whirlwind", key: "E", cooldown: 8, manaCost: 22, damage: 50, range: 0, radius: 130, duration: 0, type: 'aoe', castType: 'self_cast', description: "Spinning greatsword whirlwind hitting all nearby", slot: 'core', weaponSkillId: 'gs-whirlwind', damageMultiplier: 1.3 },
    { name: "Iron Guard", key: "Space", cooldown: 9, manaCost: 12, damage: 0, range: 0, radius: 0, duration: 2, type: 'buff', castType: 'self_cast', description: "Defensive stance, -50% damage taken for 2s", slot: 'defensive', weaponSkillId: 'gs-guard', effect: 'damage reduction 50%' },
    { name: "Death's Embrace", key: "R", cooldown: 60, manaCost: 80, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Undying form: lifesteal +50%, cannot die for 3s on lethal hit", slot: 'ultimate' }
  ],
  Human_Worg: [
    { name: "Quick Stab", key: "Q", cooldown: 0, manaCost: 0, damage: 28, range: 70, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Lightning-fast dagger stab", slot: 'attack', weaponSkillId: 'dagger-stab', damageMultiplier: 1.0 },
    { name: "Blade Flurry", key: "E", cooldown: 5, manaCost: 15, damage: 20, range: 70, radius: 80, duration: 1.5, type: 'aoe', castType: 'self_cast', description: "Rapid flurry of dagger strikes on nearby enemies", slot: 'core', weaponSkillId: 'dagger-flurry', damageMultiplier: 0.6, effect: 'hits 5x' },
    { name: "Shadow Step", key: "Space", cooldown: 6, manaCost: 10, damage: 0, range: 200, radius: 0, duration: 1, type: 'dash', castType: 'ground_aoe', description: "Teleport behind target, becoming invisible for 1s", slot: 'defensive', weaponSkillId: 'dagger-dodge', effect: 'dodge + stealth 1s' },
    { name: "Death Mark", key: "R", cooldown: 50, manaCost: 70, damage: 0, range: 80, radius: 0, duration: 6, type: 'debuff', castType: 'targeted', description: "Mark target for death: +50% damage taken, explodes for 200 after 6s", slot: 'ultimate' }
  ],
  Elf_Worg: [
    { name: "Slice", key: "Q", cooldown: 0, manaCost: 0, damage: 30, range: 70, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Graceful dagger slice", slot: 'attack', weaponSkillId: 'dagger-slash', damageMultiplier: 1.0 },
    { name: "Eviscerate", key: "E", cooldown: 6, manaCost: 18, damage: 65, range: 70, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Devastating strike dealing massive damage to bleeding targets", slot: 'core', weaponSkillId: 'dagger-eviscerate', damageMultiplier: 1.8, effect: '+50% vs bleeding' },
    { name: "Vanish", key: "Space", cooldown: 10, manaCost: 15, damage: 0, range: 0, radius: 0, duration: 3, type: 'buff', castType: 'self_cast', description: "Become invisible for 3s, next attack crits", slot: 'defensive', weaponSkillId: 'dagger-vanish', effect: 'stealth + crit' },
    { name: "Primal Fury", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 12, type: 'buff', castType: 'self_cast', description: "Enter frenzy, +40% ATK SPD and lifesteal for 12s", slot: 'ultimate' }
  ],
  Barbarian_Worg: [
    { name: "Reap", key: "Q", cooldown: 0, manaCost: 0, damage: 40, range: 90, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Sweeping scythe reap", slot: 'attack', weaponSkillId: 'scythe-reap', damageMultiplier: 1.0 },
    { name: "Soul Harvest", key: "E", cooldown: 7, manaCost: 20, damage: 50, range: 0, radius: 120, duration: 5, type: 'aoe', castType: 'self_cast', description: "Harvest souls in area, healing per enemy hit", slot: 'core', weaponSkillId: 'scythe-harvest', damageMultiplier: 1.2, effect: 'heal 15% per kill' },
    { name: "Death Step", key: "Space", cooldown: 8, manaCost: 12, damage: 0, range: 180, radius: 0, duration: 0, type: 'dash', castType: 'ground_aoe', description: "Phase through enemies, becoming untargetable", slot: 'defensive', weaponSkillId: 'scythe-phase', effect: 'phase + i-frames' },
    { name: "Reaper's Call", key: "R", cooldown: 55, manaCost: 75, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Become the Reaper: +35% ATK, attacks apply death mark", slot: 'ultimate' }
  ],
  Orc_Worg: [
    { name: "Crescent Slash", key: "Q", cooldown: 0, manaCost: 0, damage: 38, range: 90, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Wide crescent scythe slash", slot: 'attack', weaponSkillId: 'scythe-slash', damageMultiplier: 1.0 },
    { name: "Reaper Spin", key: "E", cooldown: 6, manaCost: 18, damage: 45, range: 0, radius: 130, duration: 0, type: 'aoe', castType: 'self_cast', description: "Spinning scythe hitting all nearby enemies", slot: 'core', weaponSkillId: 'scythe-spin', damageMultiplier: 1.3 },
    { name: "Reaper Fear", key: "Space", cooldown: 10, manaCost: 15, damage: 0, range: 0, radius: 200, duration: 2, type: 'debuff', castType: 'self_cast', description: "Emit terror, fearing enemies for 2s", slot: 'defensive', weaponSkillId: 'scythe-fear', effect: 'fear 2s' },
    { name: "Blood Pact", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 8, type: 'buff', castType: 'self_cast', description: "Sacrifice 20% HP for +60% ATK and lifesteal for 8s", slot: 'ultimate' }
  ],
  Dwarf_Worg: [
    { name: "Hack", key: "Q", cooldown: 0, manaCost: 0, damage: 34, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Vicious axe hack", slot: 'attack', weaponSkillId: 'axe-hack', damageMultiplier: 1.0 },
    { name: "Whirlwind", key: "E", cooldown: 7, manaCost: 20, damage: 40, range: 0, radius: 110, duration: 0, type: 'aoe', castType: 'self_cast', description: "Spinning axe whirlwind", slot: 'core', weaponSkillId: 'axe-spin', damageMultiplier: 1.2 },
    { name: "Throw Axe", key: "Space", cooldown: 6, manaCost: 10, damage: 35, range: 300, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl your axe at range, slowing target", slot: 'defensive', weaponSkillId: 'axe-throw', effect: 'slow 30% 2s' },
    { name: "Berserker Rage", key: "R", cooldown: 55, manaCost: 65, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Gain +50% ATK SPD, each hit heals 5% max HP", slot: 'ultimate' }
  ],
  Undead_Worg: [
    { name: "Piercing Thrust", key: "Q", cooldown: 0, manaCost: 0, damage: 42, range: 90, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Deadly scythe thrust", slot: 'attack', weaponSkillId: 'scythe-thrust', damageMultiplier: 1.0 },
    { name: "Death Mark", key: "E", cooldown: 8, manaCost: 22, damage: 0, range: 80, radius: 0, duration: 6, type: 'debuff', castType: 'targeted', description: "Mark target: +30% damage taken, detonates after 6s", slot: 'core', weaponSkillId: 'scythe-doom', effect: 'doom 6s' },
    { name: "Life Drain", key: "Space", cooldown: 10, manaCost: 15, damage: 40, range: 80, radius: 0, duration: 3, type: 'damage', castType: 'targeted', description: "Channel life drain, healing yourself", slot: 'defensive', weaponSkillId: 'scythe-drain', effect: 'lifesteal 100%' },
    { name: "Ghoul Frenzy", key: "R", cooldown: 55, manaCost: 75, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Undead frenzy: +40% ATK, immune to fear/charm for 10s", slot: 'ultimate' }
  ],
  Human_Mage: [
    { name: "Arcane Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 45, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Fire a bolt of arcane energy", slot: 'attack', weaponSkillId: 'arcane-bolt', damageMultiplier: 1.0 },
    { name: "Arcane Barrage", key: "E", cooldown: 6, manaCost: 25, damage: 60, range: 350, radius: 80, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Rain arcane missiles on an area", slot: 'core', weaponSkillId: 'arcane-barrage', damageMultiplier: 1.4 },
    { name: "Mana Shield", key: "Space", cooldown: 14, manaCost: 30, damage: 0, range: 0, radius: 0, duration: 4, type: 'buff', castType: 'self_cast', description: "Create a mana shield absorbing 120 damage", slot: 'defensive', weaponSkillId: 'arcane-shield', effect: 'shield 120' },
    { name: "Arcane Cataclysm", key: "R", cooldown: 55, manaCost: 90, damage: 130, range: 500, radius: 160, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Massive arcane explosion dealing devastating damage", slot: 'ultimate' }
  ],
  Elf_Mage: [
    { name: "Thorn Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 40, range: 380, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Shoot a bolt of thorny nature energy", slot: 'attack', weaponSkillId: 'nature-bolt', damageMultiplier: 1.0 },
    { name: "Rejuvenation", key: "E", cooldown: 8, manaCost: 30, damage: 0, range: 0, radius: 0, duration: 6, type: 'heal', castType: 'self_cast', description: "Heal over time, restoring 40% HP over 6s", slot: 'core', weaponSkillId: 'nature-heal', effect: 'HoT 40%' },
    { name: "Barkskin", key: "Space", cooldown: 12, manaCost: 20, damage: 0, range: 0, radius: 0, duration: 4, type: 'buff', castType: 'self_cast', description: "Harden skin, +40% DEF for 4s", slot: 'defensive', weaponSkillId: 'nature-bark', effect: '+40% DEF' },
    { name: "Wrath of Nature", key: "R", cooldown: 55, manaCost: 85, damage: 100, range: 0, radius: 200, duration: 4, type: 'aoe', castType: 'self_cast', description: "Roots and thorns erupt, rooting all enemies and dealing damage", slot: 'ultimate', effect: 'root 3s' }
  ],
  Orc_Mage: [
    { name: "Fire Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 48, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl a bolt of fire", slot: 'attack', weaponSkillId: 'fire-bolt', damageMultiplier: 1.0, maxCharges: 2, chargeRechargeTime: 3 },
    { name: "Flame Burst", key: "E", cooldown: 6, manaCost: 25, damage: 65, range: 0, radius: 120, duration: 0, type: 'aoe', castType: 'self_cast', description: "Explode in flames, burning all nearby enemies", slot: 'core', weaponSkillId: 'fire-burst', damageMultiplier: 1.5, effect: 'burn 3s' },
    { name: "Fire Shield", key: "Space", cooldown: 12, manaCost: 20, damage: 0, range: 0, radius: 0, duration: 5, type: 'buff', castType: 'self_cast', description: "Fire barrier, melee attackers take 20 fire damage", slot: 'defensive', weaponSkillId: 'fire-shield', effect: 'thorns fire 20' },
    { name: "Meteor", key: "R", cooldown: 50, manaCost: 90, damage: 120, range: 500, radius: 150, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Call down a meteor dealing massive AoE fire damage", slot: 'ultimate' }
  ],
  Barbarian_Mage: [
    { name: "Lightning Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 42, range: 420, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl a bolt of lightning", slot: 'attack', weaponSkillId: 'lightning-bolt', damageMultiplier: 1.0 },
    { name: "Chain Lightning", key: "E", cooldown: 7, manaCost: 28, damage: 50, range: 350, radius: 150, duration: 0, type: 'aoe', castType: 'targeted', description: "Lightning bounces between 4 enemies", slot: 'core', weaponSkillId: 'lightning-chain', damageMultiplier: 1.3, effect: 'chain 4 targets' },
    { name: "Lightning Dash", key: "Space", cooldown: 8, manaCost: 15, damage: 25, range: 200, radius: 0, duration: 0, type: 'dash', castType: 'ground_aoe', description: "Dash as lightning, damaging enemies in path", slot: 'defensive', weaponSkillId: 'lightning-dash', effect: 'dash + damage' },
    { name: "Thunder Storm", key: "R", cooldown: 55, manaCost: 85, damage: 90, range: 0, radius: 200, duration: 5, type: 'aoe', castType: 'self_cast', description: "Summon a storm, random lightning strikes for 5s", slot: 'ultimate', effect: 'stun chance 20%' }
  ],
  Dwarf_Mage: [
    { name: "Fire Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 46, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl a bolt of dwarven fire", slot: 'attack', weaponSkillId: 'fire-bolt', damageMultiplier: 1.0 },
    { name: "Searing Beam", key: "E", cooldown: 7, manaCost: 25, damage: 55, range: 350, radius: 0, duration: 2, type: 'damage', castType: 'line', description: "Channel a beam of fire in a line, dealing sustained damage", slot: 'core', weaponSkillId: 'fire-beam', damageMultiplier: 1.4 },
    { name: "Flame Dash", key: "Space", cooldown: 10, manaCost: 18, damage: 20, range: 180, radius: 0, duration: 0, type: 'dash', castType: 'ground_aoe', description: "Blink forward in a burst of flame", slot: 'defensive', weaponSkillId: 'fire-blink', effect: 'blink + burn trail' },
    { name: "Inferno", key: "R", cooldown: 55, manaCost: 85, damage: 100, range: 400, radius: 140, duration: 4, type: 'aoe', castType: 'ground_aoe', description: "Create an inferno zone dealing massive burn damage", slot: 'ultimate', effect: 'burn zone 4s' }
  ],
  Undead_Mage: [
    { name: "Frost Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 40, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl a bolt of frost energy", slot: 'attack', weaponSkillId: 'frost-bolt', damageMultiplier: 1.0, effect: 'slow 15% 2s' },
    { name: "Frost Nova", key: "E", cooldown: 8, manaCost: 28, damage: 45, range: 0, radius: 160, duration: 2, type: 'aoe', castType: 'self_cast', description: "Freeze all nearby enemies, dealing damage and rooting", slot: 'core', weaponSkillId: 'frost-nova', damageMultiplier: 1.2, effect: 'freeze 2s' },
    { name: "Ice Armor", key: "Space", cooldown: 14, manaCost: 22, damage: 0, range: 0, radius: 0, duration: 6, type: 'buff', castType: 'self_cast', description: "Encase in ice armor, +30% DEF and slow attackers", slot: 'defensive', weaponSkillId: 'frost-armor', effect: '+30% DEF + slow attackers' },
    { name: "Blizzard", key: "R", cooldown: 55, manaCost: 90, damage: 85, range: 400, radius: 180, duration: 5, type: 'aoe', castType: 'ground_aoe', description: "Summon a blizzard, slowing and damaging enemies in area", slot: 'ultimate', effect: 'slow 40% + damage' }
  ],
  Human_Ranger: [
    { name: "Quick Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 35, range: 450, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire a quick arrow", slot: 'attack', weaponSkillId: 'bow-shot', damageMultiplier: 1.0 },
    { name: "Aimed Shot", key: "E", cooldown: 5, manaCost: 15, damage: 65, range: 500, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Carefully aimed shot dealing high damage", slot: 'core', weaponSkillId: 'bow-aimed', damageMultiplier: 1.8 },
    { name: "Evasive Roll", key: "Space", cooldown: 6, manaCost: 8, damage: 0, range: 180, radius: 0, duration: 0.5, type: 'dash', castType: 'ground_aoe', description: "Quick dodge roll with i-frames", slot: 'defensive', weaponSkillId: 'bow-roll', effect: 'dodge + i-frames' },
    { name: "Storm of Arrows", key: "R", cooldown: 55, manaCost: 80, damage: 80, range: 400, radius: 200, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Rain arrows over an area for 3s", slot: 'ultimate' }
  ],
  Elf_Ranger: [
    { name: "Steady Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 38, range: 480, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Precise elven arrow", slot: 'attack', weaponSkillId: 'bow-steady', damageMultiplier: 1.0 },
    { name: "Multi Shot", key: "E", cooldown: 6, manaCost: 18, damage: 30, range: 400, radius: 120, duration: 0, type: 'aoe', castType: 'cone', description: "Fire 3 arrows in a spread pattern", slot: 'core', weaponSkillId: 'bow-multi', damageMultiplier: 0.8, effect: 'hits 3 targets' },
    { name: "Backflip", key: "Space", cooldown: 7, manaCost: 10, damage: 0, range: 150, radius: 0, duration: 0.5, type: 'dash', castType: 'self_cast', description: "Leap backwards, gaining distance", slot: 'defensive', weaponSkillId: 'bow-leap', effect: 'backward leap' },
    { name: "Moonfire Volley", key: "R", cooldown: 55, manaCost: 85, damage: 90, range: 450, radius: 180, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Enchanted arrows rain from the sky for 3s", slot: 'ultimate', effect: 'magic damage' }
  ],
  Orc_Ranger: [
    { name: "Bolt Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 40, range: 420, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire a heavy crossbow bolt", slot: 'attack', weaponSkillId: 'xbow-shot', damageMultiplier: 1.0 },
    { name: "Bolt Volley", key: "E", cooldown: 7, manaCost: 20, damage: 35, range: 380, radius: 100, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Rapid fire volley of bolts in an area", slot: 'core', weaponSkillId: 'xbow-volley', damageMultiplier: 1.1, maxCharges: 2, chargeRechargeTime: 7 },
    { name: "Tactical Roll", key: "Space", cooldown: 6, manaCost: 8, damage: 0, range: 160, radius: 0, duration: 0.5, type: 'dash', castType: 'ground_aoe', description: "Combat roll to reposition", slot: 'defensive', weaponSkillId: 'xbow-roll', effect: 'dodge + i-frames' },
    { name: "Siege Barrage", key: "R", cooldown: 55, manaCost: 80, damage: 100, range: 450, radius: 160, duration: 2, type: 'aoe', castType: 'ground_aoe', description: "Unleash a devastating barrage of explosive bolts", slot: 'ultimate' }
  ],
  Barbarian_Ranger: [
    { name: "Heavy Bolt", key: "Q", cooldown: 0, manaCost: 0, damage: 42, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire a heavy crossbow bolt", slot: 'attack', weaponSkillId: 'xbow-heavy', damageMultiplier: 1.0 },
    { name: "Snipe", key: "E", cooldown: 6, manaCost: 18, damage: 75, range: 500, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Precision sniper shot dealing massive damage", slot: 'core', weaponSkillId: 'xbow-snipe', damageMultiplier: 2.0 },
    { name: "Bolt Trap", key: "Space", cooldown: 10, manaCost: 12, damage: 30, range: 200, radius: 60, duration: 3, type: 'debuff', castType: 'ground_aoe', description: "Place a trap that fires bolts when triggered", slot: 'defensive', weaponSkillId: 'xbow-trap', effect: 'root 2s' },
    { name: "Death Rain", key: "R", cooldown: 55, manaCost: 85, damage: 85, range: 400, radius: 200, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Rain of poisoned bolts over an area for 3s", slot: 'ultimate', effect: 'poison 4s' }
  ],
  Dwarf_Ranger: [
    { name: "Quick Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 38, range: 380, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire your dwarven firearm", slot: 'attack', weaponSkillId: 'gun-shot', damageMultiplier: 1.0 },
    { name: "Explosive Round", key: "E", cooldown: 7, manaCost: 22, damage: 55, range: 350, radius: 80, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Fire an explosive round dealing AoE damage", slot: 'core', weaponSkillId: 'gun-explosive', damageMultiplier: 1.4, effect: 'AoE explosion' },
    { name: "Combat Roll", key: "Space", cooldown: 6, manaCost: 8, damage: 0, range: 160, radius: 0, duration: 0.5, type: 'dash', castType: 'ground_aoe', description: "Combat roll to safety", slot: 'defensive', weaponSkillId: 'gun-roll', effect: 'dodge + i-frames' },
    { name: "Lead Storm", key: "R", cooldown: 55, manaCost: 80, damage: 70, range: 350, radius: 0, duration: 4, type: 'damage', castType: 'cone', description: "Suppressive fire in a cone for 4s", slot: 'ultimate', effect: 'slow + damage' }
  ],
  Undead_Ranger: [
    { name: "Aimed Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 40, range: 380, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Precise undead marksman shot", slot: 'attack', weaponSkillId: 'gun-aimed', damageMultiplier: 1.0 },
    { name: "Burst Fire", key: "E", cooldown: 5, manaCost: 18, damage: 20, range: 350, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire 3 rapid shots at target", slot: 'core', weaponSkillId: 'gun-burst', damageMultiplier: 0.7, effect: 'hits 3x', maxCharges: 2, chargeRechargeTime: 5 },
    { name: "Smoke Bomb", key: "Space", cooldown: 12, manaCost: 15, damage: 0, range: 0, radius: 120, duration: 3, type: 'debuff', castType: 'self_cast', description: "Drop smoke, becoming invisible and blinding enemies", slot: 'defensive', weaponSkillId: 'gun-smoke', effect: 'stealth + blind 2s' },
    { name: "Phantom Barrage", key: "R", cooldown: 55, manaCost: 80, damage: 90, range: 400, radius: 150, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Spectral bullets rain down on area for 3s", slot: 'ultimate', effect: 'armor pen 50%' }
  ],
  Warrior: [
    { name: "Slash", key: "Q", cooldown: 0, manaCost: 0, damage: 35, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Basic sword slash attack", slot: 'attack' },
    { name: "Power Strike", key: "E", cooldown: 6, manaCost: 15, damage: 55, range: 80, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Powerful overhead strike dealing 150% damage", slot: 'core' },
    { name: "Parry", key: "Space", cooldown: 8, manaCost: 10, damage: 0, range: 0, radius: 0, duration: 1.5, type: 'buff', castType: 'self_cast', description: "Block incoming attack and counter", slot: 'defensive' },
    { name: "Avatar", key: "R", cooldown: 60, manaCost: 80, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Transform into a giant, +50% HP and ATK for 10s", slot: 'ultimate' }
  ],
  Worg: [
    { name: "Quick Stab", key: "Q", cooldown: 0, manaCost: 0, damage: 30, range: 70, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Quick melee strike", slot: 'attack' },
    { name: "Blade Flurry", key: "E", cooldown: 5, manaCost: 15, damage: 20, range: 70, radius: 80, duration: 1.5, type: 'aoe', castType: 'self_cast', description: "Rapid flurry of strikes", slot: 'core' },
    { name: "Shadow Step", key: "Space", cooldown: 6, manaCost: 10, damage: 0, range: 200, radius: 0, duration: 1, type: 'dash', castType: 'ground_aoe', description: "Teleport and become invisible for 1s", slot: 'defensive' },
    { name: "Primal Fury", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 12, type: 'buff', castType: 'self_cast', description: "Enter frenzy, +40% ATK SPD and lifesteal for 12s", slot: 'ultimate' }
  ],
  Mage: [
    { name: "Arcane Bolt", key: "Q", cooldown: 0, manaCost: 5, damage: 45, range: 400, radius: 0, duration: 0, type: 'damage', castType: 'skillshot', description: "Fire a bolt of magical energy", slot: 'attack' },
    { name: "Arcane Barrage", key: "E", cooldown: 6, manaCost: 25, damage: 60, range: 350, radius: 80, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Rain magic on an area", slot: 'core' },
    { name: "Mana Shield", key: "Space", cooldown: 14, manaCost: 30, damage: 0, range: 0, radius: 0, duration: 4, type: 'buff', castType: 'self_cast', description: "Create a mana shield absorbing damage", slot: 'defensive' },
    { name: "Meteor", key: "R", cooldown: 50, manaCost: 90, damage: 120, range: 500, radius: 150, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Call down a meteor dealing massive AoE damage", slot: 'ultimate' }
  ],
  Ranger: [
    { name: "Quick Shot", key: "Q", cooldown: 0, manaCost: 0, damage: 35, range: 450, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire a quick shot", slot: 'attack' },
    { name: "Aimed Shot", key: "E", cooldown: 5, manaCost: 15, damage: 65, range: 500, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Carefully aimed shot dealing high damage", slot: 'core' },
    { name: "Evasive Roll", key: "Space", cooldown: 6, manaCost: 8, damage: 0, range: 180, radius: 0, duration: 0.5, type: 'dash', castType: 'ground_aoe', description: "Quick dodge roll with i-frames", slot: 'defensive' },
    { name: "Storm of Arrows", key: "R", cooldown: 55, manaCost: 80, damage: 80, range: 400, radius: 200, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Rain arrows over an area for 3s", slot: 'ultimate' }
  ]
};

export const ITEMS: ItemDef[] = [
  { id: 0, name: "Short Sword", cost: 300, hp: 0, atk: 10, def: 0, spd: 0, mp: 0, description: "+10 Attack", tier: 1 },
  { id: 1, name: "Iron Shield", cost: 300, hp: 0, atk: 0, def: 10, spd: 0, mp: 0, description: "+10 Defense", tier: 1 },
  { id: 2, name: "Swift Boots", cost: 350, hp: 0, atk: 0, def: 0, spd: 12, mp: 0, description: "+12 Speed", tier: 1 },
  { id: 3, name: "Mana Crystal", cost: 300, hp: 0, atk: 0, def: 0, spd: 0, mp: 30, description: "+30 Mana", tier: 1 },
  { id: 4, name: "Health Pendant", cost: 400, hp: 60, atk: 0, def: 0, spd: 0, mp: 0, description: "+60 Health", tier: 1 },
  { id: 5, name: "Flaming Blade", cost: 850, hp: 0, atk: 25, def: 0, spd: 0, mp: 0, description: "+25 Attack", tier: 2 },
  { id: 6, name: "Fortress Shield", cost: 900, hp: 100, atk: 0, def: 20, spd: 0, mp: 0, description: "+20 DEF +100 HP", tier: 2 },
  { id: 7, name: "Arcane Staff", cost: 850, hp: 0, atk: 20, def: 0, spd: 0, mp: 50, description: "+20 ATK +50 MP", tier: 2 },
  { id: 8, name: "Shadow Cloak", cost: 750, hp: 0, atk: 10, def: 0, spd: 18, mp: 0, description: "+10 ATK +18 SPD", tier: 2 },
  { id: 9, name: "Divine Armor", cost: 1500, hp: 200, atk: 0, def: 30, spd: 0, mp: 0, description: "+30 DEF +200 HP", tier: 3 },
  { id: 10, name: "Doom Blade", cost: 1600, hp: 0, atk: 40, def: 0, spd: 5, mp: 0, description: "+40 ATK +5 SPD", tier: 3 },
  { id: 11, name: "Staff of Ages", cost: 1400, hp: 50, atk: 30, def: 0, spd: 0, mp: 80, description: "+30 ATK +80 MP +50 HP", tier: 3 },
  { id: 12, name: "Divine Rapier", cost: 2200, hp: 0, atk: 60, def: 0, spd: 8, mp: 0, description: "+60 ATK +8 SPD. Dropped on death!", tier: 3 }
];

export const MAP_SIZE = 4000;
export const TILE_SIZE = 40;

export const LANE_WAYPOINTS: Vec2[][] = [
  [{ x: 300, y: 3700 }, { x: 300, y: 300 }, { x: 3700, y: 300 }],
  [{ x: 400, y: 3600 }, { x: 2000, y: 2000 }, { x: 3600, y: 400 }],
  [{ x: 300, y: 3700 }, { x: 3700, y: 3700 }, { x: 3700, y: 300 }]
];

export const TEAM_COLORS = ['#3b82f6', '#ef4444'];
export const TEAM_NAMES = ['Crusade', 'Legion'];

export function xpForLevel(level: number): number {
  return 100 + level * 60;
}

export function heroStatsAtLevel(hero: HeroData, level: number): { hp: number; atk: number; def: number; spd: number; mp: number } {
  const scale = 1 + (level - 1) * 0.08;
  return {
    hp: Math.floor(hero.hp * scale),
    atk: Math.floor(hero.atk * scale),
    def: Math.floor(hero.def * scale),
    spd: hero.spd + Math.floor(level * 0.5),
    mp: Math.floor(hero.mp * scale)
  };
}

export function calcDamage(atk: number, def: number): number {
  const reduction = def / (def + 50);
  const raw = atk * (1 + Math.random() * 0.2 - 0.1);
  return Math.max(1, Math.floor(raw * (1 - reduction)));
}

export type WeaponType = 'sword_shield' | 'heavy_axe' | 'spear' | 'war_hammer' | 'axe_shield' | 'greatsword' | 'claws' | 'bow' | 'staff' | 'pistol' | 'swords' | 'axes1h' | 'greataxes' | 'hammers' | 'daggers' | 'crossbows' | 'guns' | 'scythes' | 'fireStaves' | 'frostStaves' | 'arcaneStaves' | 'natureStaves' | 'lightningStaves' | 'holyStaves';

export type GrudgeWeaponCategory = 'swords' | 'axes1h' | 'greataxes' | 'greatswords' | 'hammers' | 'daggers' | 'spears' | 'bows' | 'crossbows' | 'guns' | 'scythes' | 'fireStaves' | 'frostStaves' | 'arcaneStaves' | 'natureStaves' | 'lightningStaves' | 'holyStaves';

export const HERO_WEAPONS: Record<string, WeaponType> = {
  Human_Warrior: 'swords',
  Orc_Warrior: 'greataxes',
  Elf_Warrior: 'spear',
  Barbarian_Warrior: 'hammers',
  Dwarf_Warrior: 'axes1h',
  Undead_Warrior: 'greatsword',
  Human_Worg: 'daggers',
  Barbarian_Worg: 'scythes',
  Orc_Worg: 'scythes',
  Elf_Worg: 'daggers',
  Dwarf_Worg: 'axes1h',
  Undead_Worg: 'scythes',
  Human_Ranger: 'bow',
  Elf_Ranger: 'bow',
  Orc_Ranger: 'crossbows',
  Barbarian_Ranger: 'crossbows',
  Dwarf_Ranger: 'guns',
  Undead_Ranger: 'guns',
  Human_Mage: 'arcaneStaves',
  Elf_Mage: 'natureStaves',
  Orc_Mage: 'fireStaves',
  Barbarian_Mage: 'lightningStaves',
  Dwarf_Mage: 'fireStaves',
  Undead_Mage: 'frostStaves',
};

export const WEAPON_RENDER_TYPE: Record<string, WeaponType> = {
  swords: 'sword_shield',
  axes1h: 'axe_shield',
  greataxes: 'heavy_axe',
  greatswords: 'greatsword',
  hammers: 'war_hammer',
  daggers: 'claws',
  spears: 'spear',
  bows: 'bow',
  crossbows: 'bow',
  guns: 'pistol',
  scythes: 'greatsword',
  fireStaves: 'staff',
  frostStaves: 'staff',
  arcaneStaves: 'staff',
  natureStaves: 'staff',
  lightningStaves: 'staff',
  holyStaves: 'staff',
  spear: 'spear',
  greatsword: 'greatsword',
  bow: 'bow',
};

export function getHeroWeapon(race: string, heroClass: string): WeaponType {
  return HERO_WEAPONS[`${race}_${heroClass}`] || (heroClass === 'Warrior' ? 'swords' : heroClass === 'Ranger' ? 'bow' : heroClass === 'Mage' ? 'arcaneStaves' : 'daggers');
}

export function getWeaponRenderType(weaponType: WeaponType): WeaponType {
  return WEAPON_RENDER_TYPE[weaponType] || weaponType;
}

export function getHeroAbilities(race: string, heroClass: string): AbilityDef[] {
  const raceKey = `${race}_${heroClass}`;
  return CLASS_ABILITIES[raceKey] || CLASS_ABILITIES[heroClass] || [];
}

export const ABILITY_ICONS: Record<string, string> = {
  'Shield Bash': '/assets/abilities/shield_bash.png',
  'Rally': '/assets/abilities/rally.png',
  'Blade Storm': '/assets/abilities/blade_storm.png',
  'Avatar': '/assets/abilities/avatar.png',
  'Skull Splitter': '/assets/abilities/skull_splitter.png',
  'War Cry': '/assets/abilities/war_cry.png',
  'Cleave': '/assets/abilities/cleave.png',
  'Blood Fury': '/assets/abilities/blood_fury.png',
  'Piercing Strike': '/assets/abilities/piercing_strike.png',
  'Wind Walk': '/assets/abilities/wind_walk.png',
  'Glaive Sweep': '/assets/abilities/glaive_sweep.png',
  'Dance of Blades': '/assets/abilities/dance_of_blades.png',
  'Feral Charge': '/assets/abilities/feral_charge.png',
  'Howl': '/assets/abilities/howl.png',
  'Rend': '/assets/abilities/rend.png',
  'Primal Fury': '/assets/abilities/primal_fury.png',
  'Fireball': '/assets/abilities/fireball.png',
  'Frost Nova': '/assets/abilities/frost_nova.png',
  'Arcane Barrier': '/assets/abilities/arcane_barrier.png',
  'Meteor': '/assets/abilities/meteor.png',
  'Power Shot': '/assets/abilities/power_shot.png',
  'Trap': '/assets/abilities/trap.png',
  'Shadow Step': '/assets/abilities/shadow_step.png',
  'Storm of Arrows': '/assets/abilities/storm_of_arrows.png',
  'Slash': '/assets/abilities/blade_storm.png',
  'Power Strike': '/assets/abilities/shield_bash.png',
  'Parry': '/assets/abilities/rally.png',
  'Heavy Chop': '/assets/abilities/skull_splitter.png',
  'Brutal Cleave': '/assets/abilities/cleave.png',
  'Charge': '/assets/abilities/feral_charge.png',
  'Spear Thrust': '/assets/abilities/piercing_strike.png',
  'Impale': '/assets/abilities/piercing_strike.png',
  'Vault': '/assets/abilities/wind_walk.png',
  'Smash': '/assets/abilities/skull_splitter.png',
  'Earthquake': '/assets/abilities/blade_storm.png',
  'Bull Rush': '/assets/abilities/feral_charge.png',
  'Chop': '/assets/abilities/cleave.png',
  'Double Chop': '/assets/abilities/cleave.png',
  'Axe Block': '/assets/abilities/rally.png',
  'Heavy Slash': '/assets/abilities/blade_storm.png',
  'Whirlwind': '/assets/abilities/blade_storm.png',
  'Iron Guard': '/assets/abilities/rally.png',
  'Quick Stab': '/assets/abilities/shadow_step.png',
  'Blade Flurry': '/assets/abilities/dance_of_blades.png',
  'Slice': '/assets/abilities/dance_of_blades.png',
  'Eviscerate': '/assets/abilities/blood_fury.png',
  'Vanish': '/assets/abilities/shadow_step.png',
  'Reap': '/assets/abilities/cleave.png',
  'Soul Harvest': '/assets/abilities/blood_fury.png',
  'Death Step': '/assets/abilities/shadow_step.png',
  'Crescent Slash': '/assets/abilities/glaive_sweep.png',
  'Reaper Spin': '/assets/abilities/blade_storm.png',
  'Reaper Fear': '/assets/abilities/howl.png',
  'Hack': '/assets/abilities/cleave.png',
  'Throw Axe': '/assets/abilities/power_shot.png',
  'Piercing Thrust': '/assets/abilities/piercing_strike.png',
  'Death Mark': '/assets/abilities/skull_splitter.png',
  'Life Drain': '/assets/abilities/blood_fury.png',
  'Arcane Bolt': '/assets/abilities/fireball.png',
  'Arcane Barrage': '/assets/abilities/meteor.png',
  'Mana Shield': '/assets/abilities/arcane_barrier.png',
  'Thorn Bolt': '/assets/abilities/power_shot.png',
  'Rejuvenation': '/assets/abilities/rally.png',
  'Barkskin': '/assets/abilities/arcane_barrier.png',
  'Fire Bolt': '/assets/abilities/fireball.png',
  'Flame Burst': '/assets/abilities/fireball.png',
  'Fire Shield': '/assets/abilities/arcane_barrier.png',
  'Lightning Bolt': '/assets/abilities/fireball.png',
  'Chain Lightning': '/assets/abilities/storm_of_arrows.png',
  'Lightning Dash': '/assets/abilities/wind_walk.png',
  'Frost Bolt': '/assets/abilities/frost_nova.png',
  'Ice Armor': '/assets/abilities/arcane_barrier.png',
  'Searing Beam': '/assets/abilities/fireball.png',
  'Flame Dash': '/assets/abilities/wind_walk.png',
  'Quick Shot': '/assets/abilities/power_shot.png',
  'Aimed Shot': '/assets/abilities/power_shot.png',
  'Evasive Roll': '/assets/abilities/wind_walk.png',
  'Steady Shot': '/assets/abilities/power_shot.png',
  'Multi Shot': '/assets/abilities/storm_of_arrows.png',
  'Backflip': '/assets/abilities/wind_walk.png',
  'Bolt Shot': '/assets/abilities/power_shot.png',
  'Bolt Volley': '/assets/abilities/storm_of_arrows.png',
  'Tactical Roll': '/assets/abilities/wind_walk.png',
  'Heavy Bolt': '/assets/abilities/power_shot.png',
  'Snipe': '/assets/abilities/power_shot.png',
  'Bolt Trap': '/assets/abilities/trap.png',
  'Explosive Round': '/assets/abilities/meteor.png',
  'Combat Roll': '/assets/abilities/wind_walk.png',
  'Burst Fire': '/assets/abilities/storm_of_arrows.png',
  'Smoke Bomb': '/assets/abilities/shadow_step.png',
};

// ObjectStore weapon skill names get generic icons by pattern
export function getAbilityIconPath(abilityName: string): string | null {
  if (ABILITY_ICONS[abilityName]) return ABILITY_ICONS[abilityName];
  // Pattern match for weapon skills from ObjectStore
  const lower = abilityName.toLowerCase();
  if (lower.includes('slash') || lower.includes('strike') || lower.includes('chop')) return '/assets/abilities/blade_storm.png';
  if (lower.includes('thrust') || lower.includes('impale') || lower.includes('pierce')) return '/assets/abilities/piercing_strike.png';
  if (lower.includes('parry') || lower.includes('block') || lower.includes('guard') || lower.includes('shield')) return '/assets/abilities/rally.png';
  if (lower.includes('dodge') || lower.includes('roll') || lower.includes('dash') || lower.includes('step') || lower.includes('vault') || lower.includes('leap')) return '/assets/abilities/wind_walk.png';
  if (lower.includes('shot') || lower.includes('bolt') || lower.includes('arrow') || lower.includes('snipe')) return '/assets/abilities/power_shot.png';
  if (lower.includes('fire') || lower.includes('flame') || lower.includes('burn') || lower.includes('inferno')) return '/assets/abilities/fireball.png';
  if (lower.includes('frost') || lower.includes('ice') || lower.includes('blizzard') || lower.includes('freeze')) return '/assets/abilities/frost_nova.png';
  if (lower.includes('heal') || lower.includes('rejuv') || lower.includes('regen')) return '/assets/abilities/rally.png';
  if (lower.includes('whirl') || lower.includes('spin') || lower.includes('cleave') || lower.includes('sweep')) return '/assets/abilities/blade_storm.png';
  if (lower.includes('fear') || lower.includes('howl') || lower.includes('cry')) return '/assets/abilities/howl.png';
  if (lower.includes('trap') || lower.includes('snare') || lower.includes('root')) return '/assets/abilities/trap.png';
  if (lower.includes('stealth') || lower.includes('vanish') || lower.includes('invisible') || lower.includes('shadow')) return '/assets/abilities/shadow_step.png';
  if (lower.includes('storm') || lower.includes('rain') || lower.includes('volley') || lower.includes('barrage')) return '/assets/abilities/storm_of_arrows.png';
  if (lower.includes('meteor') || lower.includes('cataclysm') || lower.includes('explosion')) return '/assets/abilities/meteor.png';
  return null;
}

export function getPortraitPath(race: string, heroClass: string, heroName?: string): string {
  if (heroName && (heroName.includes('Racalvin') || heroName.includes('Pirate King'))) {
    return '/assets/portraits/pirate_king.png';
  }
  return `/assets/portraits/${race.toLowerCase()}_${heroClass.toLowerCase()}.png`;
}

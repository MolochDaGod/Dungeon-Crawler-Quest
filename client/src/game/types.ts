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
  Warrior: [
    { name: "Shield Bash", key: "Q", cooldown: 6, manaCost: 20, damage: 30, range: 80, radius: 0, duration: 1.5, type: 'damage', castType: 'targeted', description: "Bash target, dealing damage and stunning for 1.5s" },
    { name: "Rally", key: "W", cooldown: 15, manaCost: 30, damage: 0, range: 0, radius: 200, duration: 5, type: 'buff', castType: 'self_cast', description: "Rally allies, boosting ATK by 25% for 5s" },
    { name: "Blade Storm", key: "E", cooldown: 10, manaCost: 35, damage: 50, range: 0, radius: 120, duration: 0, type: 'aoe', castType: 'self_cast', description: "Spin with your blade dealing AoE damage" },
    { name: "Avatar", key: "R", cooldown: 60, manaCost: 80, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Transform into a giant, +50% HP and ATK for 10s" }
  ],
  Orc_Warrior: [
    { name: "Skull Splitter", key: "Q", cooldown: 7, manaCost: 25, damage: 50, range: 90, radius: 0, duration: 4, type: 'damage', castType: 'targeted', description: "Overhead axe chop dealing heavy damage and shredding -20% DEF for 4s" },
    { name: "War Cry", key: "W", cooldown: 14, manaCost: 30, damage: 0, range: 0, radius: 250, duration: 5, type: 'debuff', castType: 'self_cast', description: "Terrifying war cry: fear enemies 1.5s, +30% ATK for 5s" },
    { name: "Cleave", key: "E", cooldown: 8, manaCost: 30, damage: 45, range: 0, radius: 150, duration: 0, type: 'aoe', castType: 'cone', description: "Wide frontal axe cleave hitting all enemies in a cone" },
    { name: "Blood Fury", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 10, type: 'buff', castType: 'self_cast', description: "Enter blood rage: +40% ATK, +30% lifesteal, +20% move speed for 10s" }
  ],
  Elf_Warrior: [
    { name: "Piercing Strike", key: "Q", cooldown: 5, manaCost: 20, damage: 40, range: 120, radius: 0, duration: 0, type: 'damage', castType: 'targeted', description: "Long-range spear thrust dealing high damage" },
    { name: "Wind Walk", key: "W", cooldown: 12, manaCost: 30, damage: 0, range: 200, radius: 0, duration: 1, type: 'dash', castType: 'ground_aoe', description: "Dash forward, dodging all attacks for 1s" },
    { name: "Glaive Sweep", key: "E", cooldown: 9, manaCost: 35, damage: 40, range: 0, radius: 130, duration: 2, type: 'aoe', castType: 'self_cast', description: "Spinning glaive sweep dealing AoE damage and slowing 25% for 2s" },
    { name: "Dance of Blades", key: "R", cooldown: 50, manaCost: 75, damage: 25, range: 0, radius: 160, duration: 3, type: 'aoe', castType: 'self_cast', description: "3s flurry of 8 rapid strikes on nearby enemies" }
  ],
  Worg: [
    { name: "Feral Charge", key: "Q", cooldown: 8, manaCost: 25, damage: 40, range: 300, radius: 0, duration: 0, type: 'dash', castType: 'targeted', description: "Dash to target, dealing damage on impact" },
    { name: "Howl", key: "W", cooldown: 12, manaCost: 20, damage: 0, range: 0, radius: 250, duration: 3, type: 'debuff', castType: 'self_cast', description: "Howl, slowing enemies by 30% for 3s" },
    { name: "Rend", key: "E", cooldown: 5, manaCost: 15, damage: 60, range: 80, radius: 0, duration: 3, type: 'damage', castType: 'targeted', description: "Rend target, dealing damage over 3s" },
    { name: "Primal Fury", key: "R", cooldown: 55, manaCost: 70, damage: 0, range: 0, radius: 0, duration: 12, type: 'buff', castType: 'self_cast', description: "Enter frenzy, +40% ATK SPD and lifesteal for 12s" }
  ],
  Mage: [
    { name: "Fireball", key: "Q", cooldown: 4, manaCost: 25, damage: 55, range: 400, radius: 60, duration: 0, type: 'damage', castType: 'skillshot', description: "Hurl a fireball dealing AoE damage", maxCharges: 2, chargeRechargeTime: 4 },
    { name: "Frost Nova", key: "W", cooldown: 12, manaCost: 35, damage: 30, range: 0, radius: 180, duration: 2, type: 'aoe', castType: 'self_cast', description: "Freeze nearby enemies, dealing damage and slowing" },
    { name: "Arcane Barrier", key: "E", cooldown: 18, manaCost: 40, damage: 0, range: 0, radius: 0, duration: 4, type: 'heal', castType: 'self_cast', description: "Create a magic shield absorbing 100 damage" },
    { name: "Meteor", key: "R", cooldown: 50, manaCost: 90, damage: 120, range: 500, radius: 150, duration: 0, type: 'aoe', castType: 'ground_aoe', description: "Call down a meteor dealing massive AoE damage" }
  ],
  Ranger: [
    { name: "Power Shot", key: "Q", cooldown: 5, manaCost: 20, damage: 45, range: 500, radius: 0, duration: 0, type: 'damage', castType: 'line', description: "Fire a piercing shot dealing high damage", maxCharges: 3, chargeRechargeTime: 5 },
    { name: "Trap", key: "W", cooldown: 14, manaCost: 25, damage: 20, range: 300, radius: 50, duration: 2, type: 'debuff', castType: 'ground_aoe', description: "Place a trap that roots for 2s" },
    { name: "Shadow Step", key: "E", cooldown: 10, manaCost: 30, damage: 0, range: 250, radius: 0, duration: 0, type: 'dash', castType: 'ground_aoe', description: "Teleport to location, becoming invisible for 1s" },
    { name: "Storm of Arrows", key: "R", cooldown: 55, manaCost: 80, damage: 80, range: 400, radius: 200, duration: 3, type: 'aoe', castType: 'ground_aoe', description: "Rain arrows over an area for 3s" }
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

export type WeaponType = 'sword_shield' | 'heavy_axe' | 'spear' | 'war_hammer' | 'axe_shield' | 'greatsword' | 'claws' | 'bow' | 'staff' | 'pistol';

export const HERO_WEAPONS: Record<string, WeaponType> = {
  Human_Warrior: 'sword_shield',
  Orc_Warrior: 'heavy_axe',
  Elf_Warrior: 'spear',
  Barbarian_Warrior: 'war_hammer',
  Dwarf_Warrior: 'axe_shield',
  Undead_Warrior: 'greatsword',
  Human_Worg: 'claws',
  Barbarian_Worg: 'claws',
  Orc_Worg: 'claws',
  Elf_Worg: 'claws',
  Dwarf_Worg: 'claws',
  Undead_Worg: 'claws',
  Human_Ranger: 'bow',
  Elf_Ranger: 'bow',
  Orc_Ranger: 'bow',
  Barbarian_Ranger: 'bow',
  Dwarf_Ranger: 'bow',
  Undead_Ranger: 'bow',
  Human_Mage: 'staff',
  Elf_Mage: 'staff',
  Orc_Mage: 'staff',
  Barbarian_Mage: 'staff',
  Dwarf_Mage: 'staff',
  Undead_Mage: 'staff',
};

export function getHeroWeapon(race: string, heroClass: string): WeaponType {
  return HERO_WEAPONS[`${race}_${heroClass}`] || (heroClass === 'Warrior' ? 'sword_shield' : heroClass === 'Ranger' ? 'bow' : heroClass === 'Mage' ? 'staff' : 'claws');
}

export function getHeroAbilities(race: string, heroClass: string): AbilityDef[] {
  const raceKey = `${race}_${heroClass}`;
  return CLASS_ABILITIES[raceKey] || CLASS_ABILITIES[heroClass] || [];
}

export function getPortraitPath(race: string, heroClass: string, heroName?: string): string {
  if (heroName && (heroName.includes('Racalvin') || heroName.includes('Pirate King'))) {
    return '/assets/portraits/pirate_king.png';
  }
  return `/assets/portraits/${race.toLowerCase()}_${heroClass.toLowerCase()}.png`;
}

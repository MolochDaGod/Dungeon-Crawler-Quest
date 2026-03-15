import * as THREE from 'three';

// ── Monster AI States ──
export type MonsterAIState = 'idle' | 'patrol' | 'chase' | 'attack' | 'retreat' | 'dead';

// ── Monster Template (static data) ──
export interface MonsterTemplate {
  id: string;
  name: string;
  modelType: 'obj' | 'fbx' | 'glb';
  modelPath: string;
  mtlPath?: string;
  texturePath?: string;
  scale: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  xpValue: number;
  goldValue: number;
  isBoss: boolean;
  color: number;
}

// ── Live Monster Instance ──
export interface OpenWorldMonster {
  id: number;
  templateId: string;
  x: number;
  y: number; // height
  z: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  state: MonsterAIState;
  facing: number;
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  homeX: number;
  homeZ: number;
  leashRange: number;
  patrolAngle: number;
  patrolRadius: number;
  targetId: number | null;
  mesh: THREE.Group | null;
  deathTimer: number;
  hitFlash: number;
}

// ── Dungeon Entrance ──
export interface DungeonEntrance {
  id: number;
  name: string;
  x: number;
  z: number;
  dungeonLevel: number;
  minPlayerLevel: number;
  color: number;
  portalMesh: THREE.Group | null;
  bossGuardId?: string; // template id of boss guarding this entrance
}

// ── Safe House ──
export interface SafeHouse {
  x: number;
  z: number;
  radius: number;
  healRate: number; // hp/sec when inside
  mesh: THREE.Group | null;
}

// ── Biome Zone ──
export type BiomeType = 'grassland' | 'forest' | 'wasteland' | 'haunted' | 'volcanic' | 'coastal';

export interface OpenWorldZone {
  id: number;
  name: string;
  biome: BiomeType;
  centerX: number;
  centerZ: number;
  radius: number;
  level: number;
  groundColor: number;
  fogColor: number;
  spawnTable: string[]; // monster template ids
  maxMonsters: number;
}

// ── Floating combat text ──
export interface OpenWorldFloatingText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

// ── Player state for open world ──
export interface OpenWorldPlayerState {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  atk: number;
  def: number;
  spd: number;
  kills: number;
  inCombat: boolean;
  attackTimer: number;
  attackCooldown: number;
  targetMonsterId: number | null;
}

// ═══════════════════════════════════════════════
// MONSTER TEMPLATES
// ═══════════════════════════════════════════════
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    id: 'recon_bot',
    name: 'Recon Bot',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/ReconBot/Package/ReconBot.obj',
    mtlPath: '/assets/packs/monsters/ReconBot/Package/ReconBot.mtl',
    texturePath: '/assets/packs/monsters/ReconBot/Package/ReconBot.png',
    scale: 0.08,
    hp: 80, atk: 12, def: 5, spd: 18,
    aggroRange: 60, attackRange: 8, attackCooldown: 1.5,
    xpValue: 25, goldValue: 10,
    isBoss: false, color: 0x44aaff,
  },
  {
    id: 'field_fighter',
    name: 'Field Fighter',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/FieldFighter/Package/FieldFighter.obj',
    mtlPath: '/assets/packs/monsters/FieldFighter/Package/FieldFighter.mtl',
    texturePath: '/assets/packs/monsters/FieldFighter/Package/FieldFighter.png',
    scale: 0.08,
    hp: 120, atk: 18, def: 8, spd: 15,
    aggroRange: 50, attackRange: 10, attackCooldown: 1.8,
    xpValue: 40, goldValue: 15,
    isBoss: false, color: 0xff6644,
  },
  {
    id: 'mecha_trooper',
    name: 'Mecha Trooper',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/MechaTrooper/Package/MechaTrooper.obj',
    mtlPath: '/assets/packs/monsters/MechaTrooper/Package/MechaTrooper.mtl',
    texturePath: '/assets/packs/monsters/MechaTrooper/Package/MechaTrooper.png',
    scale: 0.08,
    hp: 150, atk: 22, def: 12, spd: 12,
    aggroRange: 55, attackRange: 10, attackCooldown: 2.0,
    xpValue: 55, goldValue: 20,
    isBoss: false, color: 0x88cc44,
  },
  {
    id: 'companion_bot',
    name: 'Rogue Companion',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/CompanionBot/Package/Companion-bot.obj',
    mtlPath: '/assets/packs/monsters/CompanionBot/Package/Companion-bot.mtl',
    texturePath: '/assets/packs/monsters/CompanionBot/Package/Companion-bot.png',
    scale: 0.08,
    hp: 100, atk: 15, def: 6, spd: 20,
    aggroRange: 65, attackRange: 8, attackCooldown: 1.2,
    xpValue: 35, goldValue: 12,
    isBoss: false, color: 0xcc88ff,
  },
  // ── BOSSES ──
  {
    id: 'mech_golem',
    name: 'Mech Golem',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/MechGolem/Package/MechaGolem.obj',
    mtlPath: '/assets/packs/monsters/MechGolem/Package/MechaGolem.mtl',
    texturePath: '/assets/packs/monsters/MechGolem/Package/MechaGolem.png',
    scale: 0.15,
    hp: 500, atk: 35, def: 20, spd: 8,
    aggroRange: 80, attackRange: 15, attackCooldown: 2.5,
    xpValue: 200, goldValue: 80,
    isBoss: true, color: 0xff4444,
  },
  {
    id: 'arachnodroid',
    name: 'Arachnodroid',
    modelType: 'obj',
    modelPath: '/assets/packs/monsters/Arachnodroid/Package/Arachnoid.obj',
    mtlPath: '/assets/packs/monsters/Arachnodroid/Package/Arachnoid.mtl',
    texturePath: '/assets/packs/monsters/Arachnodroid/Package/Arachnoid.png',
    scale: 0.15,
    hp: 400, atk: 40, def: 15, spd: 14,
    aggroRange: 90, attackRange: 12, attackCooldown: 1.8,
    xpValue: 180, goldValue: 70,
    isBoss: true, color: 0xffaa00,
  },
];

// ═══════════════════════════════════════════════
// WORLD ZONES
// ═══════════════════════════════════════════════
export const WORLD_ZONES: OpenWorldZone[] = [
  {
    id: 0, name: 'Greenhollow', biome: 'grassland',
    centerX: 0, centerZ: 0, radius: 250, level: 1,
    groundColor: 0x2a5a2a, fogColor: 0x1a3a2a,
    spawnTable: ['recon_bot', 'companion_bot'], maxMonsters: 8,
  },
  {
    id: 1, name: 'Darkwood Forest', biome: 'forest',
    centerX: -350, centerZ: -300, radius: 300, level: 3,
    groundColor: 0x1a3a1a, fogColor: 0x0a2a1a,
    spawnTable: ['recon_bot', 'field_fighter', 'companion_bot'], maxMonsters: 12,
  },
  {
    id: 2, name: 'Iron Wasteland', biome: 'wasteland',
    centerX: 400, centerZ: 200, radius: 280, level: 5,
    groundColor: 0x4a3a2a, fogColor: 0x2a1a0a,
    spawnTable: ['field_fighter', 'mecha_trooper'], maxMonsters: 10,
  },
  {
    id: 3, name: 'Haunted Moors', biome: 'haunted',
    centerX: -100, centerZ: 450, radius: 260, level: 7,
    groundColor: 0x2a1a3a, fogColor: 0x1a0a2a,
    spawnTable: ['mecha_trooper', 'companion_bot', 'field_fighter'], maxMonsters: 10,
  },
  {
    id: 4, name: 'Ember Peaks', biome: 'volcanic',
    centerX: 350, centerZ: -400, radius: 250, level: 9,
    groundColor: 0x3a1a0a, fogColor: 0x2a0a00,
    spawnTable: ['mecha_trooper', 'field_fighter'], maxMonsters: 8,
  },
];

// ═══════════════════════════════════════════════
// DUNGEON ENTRANCES
// ═══════════════════════════════════════════════
export const DUNGEON_ENTRANCE_CONFIGS: Omit<DungeonEntrance, 'portalMesh'>[] = [
  { id: 0, name: 'Crypt of Shadows', x: -200, z: -180, dungeonLevel: 1, minPlayerLevel: 1, color: 0x8866ff, bossGuardId: undefined },
  { id: 1, name: 'Darkwood Caverns', x: -450, z: -400, dungeonLevel: 3, minPlayerLevel: 3, color: 0x44ff88, bossGuardId: 'mech_golem' },
  { id: 2, name: 'Iron Forge Depths', x: 500, z: 300, dungeonLevel: 5, minPlayerLevel: 5, color: 0xff8844, bossGuardId: 'arachnodroid' },
  { id: 3, name: 'Abyssal Sanctum', x: -50, z: 550, dungeonLevel: 8, minPlayerLevel: 7, color: 0xff44ff, bossGuardId: 'mech_golem' },
];

// ═══════════════════════════════════════════════
// SAFE HOUSE CONFIG
// ═══════════════════════════════════════════════
export const SAFE_HOUSE_CONFIG = {
  x: 30,
  z: 30,
  radius: 25,
  healRate: 15,
};

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
export function getMonsterTemplate(id: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES.find(t => t.id === id);
}

export function getZoneAtPosition(x: number, z: number): OpenWorldZone | null {
  for (const zone of WORLD_ZONES) {
    const dx = x - zone.centerX;
    const dz = z - zone.centerZ;
    if (Math.sqrt(dx * dx + dz * dz) < zone.radius) return zone;
  }
  return null;
}

export function distXZ(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

let nextMonsterId = 1000;
export function spawnMonster(templateId: string, x: number, z: number): OpenWorldMonster | null {
  const tmpl = getMonsterTemplate(templateId);
  if (!tmpl) return null;
  const id = nextMonsterId++;
  return {
    id, templateId, x, y: 0, z,
    hp: tmpl.hp, maxHp: tmpl.hp,
    atk: tmpl.atk, def: tmpl.def, spd: tmpl.spd,
    state: 'idle', facing: Math.random() * Math.PI * 2,
    aggroRange: tmpl.aggroRange, attackRange: tmpl.attackRange,
    attackCooldown: tmpl.attackCooldown, attackTimer: 0,
    homeX: x, homeZ: z, leashRange: tmpl.aggroRange * 2.5,
    patrolAngle: Math.random() * Math.PI * 2,
    patrolRadius: 15 + Math.random() * 25,
    targetId: null, mesh: null,
    deathTimer: 0, hitFlash: 0,
  };
}

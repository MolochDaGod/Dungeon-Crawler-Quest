/**
 * Zone Events System
 * Dynamic world events: invasions, bosses, resource surges, caravans, storms.
 * Integrates with SpawnerManager for event-linked spawners and
 * WorldState for announcements.
 */

import { SpawnerManager, SpawnerDef } from './spawner-system';

// ── Types ──────────────────────────────────────────────────────

export type ZoneEventType =
  | 'invasion'        // enemy faction attacks a safe zone
  | 'world_boss'      // boss spawns with global announcement
  | 'resource_surge'  // bonus resource nodes spawn temporarily
  | 'caravan'         // escort NPC caravan between zones
  | 'treasure_hunt'   // random chest spawns
  | 'storm';          // weather + empowered enemies

export type EventTrigger = 'timed' | 'level_threshold' | 'kill_count' | 'random';

export interface EventReward {
  xp: number;
  gold: number;
  equipTier?: number;  // generates random equipment of this tier
}

export interface ZoneEventDef {
  id: string;
  name: string;
  description: string;
  type: ZoneEventType;
  zoneIds: number[];         // which zones this event affects
  duration: number;          // seconds
  cooldown: number;          // seconds between occurrences
  trigger: EventTrigger;
  triggerValue?: number;     // for level_threshold or kill_count
  rewards: EventReward;
  spawnOverrides?: Partial<SpawnerDef>[]; // extra spawners during event
  announceColor: string;     // color for kill feed
  icon: string;              // emoji for UI
}

export interface ActiveEvent {
  def: ZoneEventDef;
  timeRemaining: number;
  killCount: number;         // kills during this event
  completed: boolean;
  rewardClaimed: boolean;
}

// ── Pre-Built Events ───────────────────────────────────────────

export const ZONE_EVENTS: ZoneEventDef[] = [
  {
    id: 'piglin_invasion',
    name: 'Piglin Invasion',
    description: 'Piglins are attacking Crusade Island! Defend the stronghold!',
    type: 'invasion',
    zoneIds: [8],  // Crusade Island
    duration: 300, // 5 minutes
    cooldown: 600,
    trigger: 'timed',
    rewards: { xp: 500, gold: 300, equipTier: 4 },
    spawnOverrides: [
      { id: 'evt-piglin-1', zoneId: 8, x: 9200, y: 2500, type: 'camp', enemyTypes: [{ type: 'Piglin Grunt', level: 12, count: 5, weight: 3 }, { type: 'Piglin Brute', level: 14, count: 2, weight: 1 }], respawnTime: 20, maxAlive: 7, aggroLink: true, eventId: 'piglin_invasion' },
      { id: 'evt-piglin-2', zoneId: 8, x: 11000, y: 4000, type: 'camp', enemyTypes: [{ type: 'Piglin Grunt', level: 13, count: 4, weight: 2 }, { type: 'Boar Dragon', level: 15, count: 1, weight: 1 }], respawnTime: 30, maxAlive: 5, aggroLink: true, eventId: 'piglin_invasion' },
    ],
    announceColor: '#ff4444',
    icon: '⚔️',
  },
  {
    id: 'sea_monster',
    name: 'Sea Monster Rising',
    description: 'A Sea Serpent has surfaced in Pirate Cove!',
    type: 'world_boss',
    zoneIds: [11], // Pirate Cove
    duration: 240,
    cooldown: 900,
    trigger: 'random',
    rewards: { xp: 800, gold: 500, equipTier: 5 },
    spawnOverrides: [
      { id: 'evt-serpent', zoneId: 11, x: 14000, y: 9000, type: 'boss_encounter', enemyTypes: [{ type: 'Sea Serpent', level: 20, count: 1, weight: 1 }], respawnTime: 999, maxAlive: 1, aggroLink: true, bossPhases: 2, eventId: 'sea_monster' },
    ],
    announceColor: '#0077be',
    icon: '🐉',
  },
  {
    id: 'volcanic_eruption',
    name: 'Volcanic Eruption',
    description: 'The volcano erupts! Fire drakes swarm the rim!',
    type: 'storm',
    zoneIds: [6], // Volcano Rim
    duration: 180,
    cooldown: 720,
    trigger: 'timed',
    rewards: { xp: 400, gold: 250, equipTier: 4 },
    spawnOverrides: [
      { id: 'evt-drake-1', zoneId: 6, x: 1000, y: 6200, type: 'single', enemyTypes: [{ type: 'Fire Drake', level: 17, count: 3, weight: 1 }], respawnTime: 15, maxAlive: 3, aggroLink: false, eventId: 'volcanic_eruption' },
      { id: 'evt-drake-2', zoneId: 6, x: 2200, y: 7000, type: 'single', enemyTypes: [{ type: 'Fire Drake', level: 18, count: 2, weight: 1 }], respawnTime: 20, maxAlive: 2, aggroLink: false, eventId: 'volcanic_eruption' },
    ],
    announceColor: '#ff6b2b',
    icon: '🌋',
  },
  {
    id: 'titan_awakening',
    name: "Titan's Awakening",
    description: 'An ancient titan stirs in the Graveyard! Defeat it before it fully awakens!',
    type: 'world_boss',
    zoneIds: [13], // Graveyard of Titans
    duration: 360,
    cooldown: 1200,
    trigger: 'level_threshold',
    triggerValue: 18,
    rewards: { xp: 1200, gold: 800, equipTier: 6 },
    spawnOverrides: [
      { id: 'evt-titan', zoneId: 13, x: 13750, y: 2250, type: 'boss_encounter', enemyTypes: [{ type: 'Infernal Colossus', level: 25, count: 1, weight: 1 }], respawnTime: 999, maxAlive: 1, aggroLink: true, bossPhases: 3, eventId: 'titan_awakening' },
    ],
    announceColor: '#ff3300',
    icon: '🗿',
  },
  {
    id: 'harvest_moon',
    name: 'Harvest Moon',
    description: 'The Harvest Moon rises! Resource nodes yield double!',
    type: 'resource_surge',
    zoneIds: [1, 2, 3, 4, 5, 6, 8, 9, 11, 12, 15], // all non-safe combat zones
    duration: 180,
    cooldown: 480,
    trigger: 'timed',
    rewards: { xp: 100, gold: 50 },
    announceColor: '#ffd700',
    icon: '🌕',
  },
  {
    id: 'undead_siege',
    name: 'Undead Siege',
    description: 'Skeletons march from the Crypts toward the Forest!',
    type: 'invasion',
    zoneIds: [1], // Forest of Whispers
    duration: 240,
    cooldown: 600,
    trigger: 'kill_count',
    triggerValue: 50,
    rewards: { xp: 350, gold: 200, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-undead-1', zoneId: 1, x: 2800, y: 3200, type: 'camp', enemyTypes: [{ type: 'Skeleton', level: 6, count: 6, weight: 3 }, { type: 'Dark Mage', level: 7, count: 2, weight: 1 }], respawnTime: 15, maxAlive: 8, aggroLink: true, eventId: 'undead_siege' },
      { id: 'evt-undead-2', zoneId: 1, x: 1900, y: 4000, type: 'camp', enemyTypes: [{ type: 'Skeleton', level: 5, count: 5, weight: 3 }, { type: 'Wraith', level: 8, count: 1, weight: 1 }], respawnTime: 18, maxAlive: 6, aggroLink: true, eventId: 'undead_siege' },
    ],
    announceColor: '#b0b0d0',
    icon: '💀',
  },

  // ═══════════════════════════════════════════════════════════════
  // Zone 2 — Fabled Shore Tower Defense Events (16 towers)
  // Each tower has enemies that siege it on a timer.  Players must
  // defend captured towers or recapture lost ones.
  // ═══════════════════════════════════════════════════════════════

  // ── Row 1: Outer towers (north) — Lv3-4 enemies ──────────────
  {
    id: 'z2_tower_01', name: 'Siege of Moonveil Spire',
    description: 'Corrupted treants assault the Moonveil Spire! Defend or recapture it!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 360, trigger: 'timed',
    rewards: { xp: 120, gold: 80, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t01', zoneId: 2, x: 1800, y: 1800, type: 'camp', enemyTypes: [{ type: 'Treant', level: 4, count: 3, weight: 2 }, { type: 'Spider', level: 3, count: 4, weight: 3 }], respawnTime: 25, maxAlive: 6, aggroLink: true, eventId: 'z2_tower_01' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_02', name: 'Siege of Starwood Beacon',
    description: 'Harpies swarm the Starwood Beacon from above!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 380, trigger: 'timed',
    rewards: { xp: 120, gold: 80, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t02', zoneId: 2, x: 5200, y: 2200, type: 'camp', enemyTypes: [{ type: 'Harpy', level: 3, count: 4, weight: 3 }, { type: 'Spider', level: 3, count: 3, weight: 2 }], respawnTime: 22, maxAlive: 6, aggroLink: true, eventId: 'z2_tower_02' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_03', name: 'Siege of Crystalvein Watch',
    description: 'Crystal golems march on the Crystalvein Watch!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 400, trigger: 'timed',
    rewards: { xp: 130, gold: 90, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t03', zoneId: 2, x: 9200, y: 1600, type: 'camp', enemyTypes: [{ type: 'Golem', level: 4, count: 2, weight: 2 }, { type: 'Spider', level: 3, count: 4, weight: 3 }], respawnTime: 28, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_03' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_04', name: 'Siege of Thornguard Tower',
    description: 'Thorn-twisted treants besiege the eastern tower!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 370, trigger: 'timed',
    rewards: { xp: 120, gold: 80, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t04', zoneId: 2, x: 13200, y: 2000, type: 'camp', enemyTypes: [{ type: 'Treant', level: 4, count: 3, weight: 2 }, { type: 'Harpy', level: 3, count: 3, weight: 2 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_04' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },

  // ── Row 2: Inner towers (north-center) — Lv5-6 enemies ────────
  {
    id: 'z2_tower_05', name: 'Siege of Whispering Arch',
    description: 'Dark spirits assault the Whispering Arch!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 420, trigger: 'timed',
    rewards: { xp: 180, gold: 120, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t05', zoneId: 2, x: 2200, y: 5200, type: 'camp', enemyTypes: [{ type: 'Treant', level: 6, count: 2, weight: 2 }, { type: 'Harpy', level: 5, count: 3, weight: 2 }, { type: 'Golem', level: 5, count: 1, weight: 1 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_05' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },
  {
    id: 'z2_tower_06', name: 'Siege of Runestone Tower',
    description: 'Corrupted magic taints the rune stones — golems attack!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 440, trigger: 'timed',
    rewards: { xp: 180, gold: 120, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t06', zoneId: 2, x: 5400, y: 5800, type: 'camp', enemyTypes: [{ type: 'Golem', level: 6, count: 2, weight: 2 }, { type: 'Spider', level: 5, count: 4, weight: 3 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_06' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },
  {
    id: 'z2_tower_07', name: 'Siege of Heartwood Bastion',
    description: 'The heartwood is under attack by forest beasts!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 430, trigger: 'timed',
    rewards: { xp: 180, gold: 120, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t07', zoneId: 2, x: 8800, y: 5600, type: 'camp', enemyTypes: [{ type: 'Treant', level: 6, count: 3, weight: 2 }, { type: 'Harpy', level: 5, count: 3, weight: 2 }], respawnTime: 22, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_07' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },
  {
    id: 'z2_tower_08', name: 'Siege of Jadescale Watch',
    description: 'River beasts swarm the Jadescale Watch!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 450, trigger: 'timed',
    rewards: { xp: 180, gold: 120, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t08', zoneId: 2, x: 13000, y: 5400, type: 'camp', enemyTypes: [{ type: 'Harpy', level: 5, count: 3, weight: 2 }, { type: 'Golem', level: 5, count: 2, weight: 2 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_08' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },

  // ── Row 3: Inner towers (south-center) — Lv6-8 enemies ────────
  {
    id: 'z2_tower_09', name: 'Siege of Silverbloom Tower',
    description: 'Corrupted flora overruns the Silverbloom Tower!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 420, trigger: 'timed',
    rewards: { xp: 200, gold: 140, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t09', zoneId: 2, x: 1600, y: 9600, type: 'camp', enemyTypes: [{ type: 'Treant', level: 6, count: 3, weight: 2 }, { type: 'Spider', level: 5, count: 3, weight: 2 }], respawnTime: 22, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_09' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },
  {
    id: 'z2_tower_10', name: 'Siege of Gladekeeper Spire',
    description: 'Elite corrupted forces target the sacred Gladekeeper Spire!',
    type: 'invasion', zoneIds: [2], duration: 240, cooldown: 480, trigger: 'timed',
    rewards: { xp: 280, gold: 200, equipTier: 4 },
    spawnOverrides: [
      { id: 'evt-z2t10', zoneId: 2, x: 5000, y: 9200, type: 'camp', enemyTypes: [{ type: 'Treant', level: 8, count: 2, weight: 2 }, { type: 'Golem', level: 7, count: 2, weight: 2 }, { type: 'Harpy', level: 6, count: 2, weight: 1 }], respawnTime: 28, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_10' },
    ],
    announceColor: '#0ea5e9', icon: '🛡️',
  },
  {
    id: 'z2_tower_11', name: 'Siege of Sunfire Pinnacle',
    description: 'The eternal flame flickers — a dragon leads the assault!',
    type: 'invasion', zoneIds: [2], duration: 240, cooldown: 500, trigger: 'timed',
    rewards: { xp: 300, gold: 220, equipTier: 4 },
    spawnOverrides: [
      { id: 'evt-z2t11a', zoneId: 2, x: 9400, y: 9800, type: 'camp', enemyTypes: [{ type: 'Treant', level: 8, count: 2, weight: 2 }, { type: 'Harpy', level: 6, count: 3, weight: 2 }], respawnTime: 25, maxAlive: 4, aggroLink: true, eventId: 'z2_tower_11' },
      { id: 'evt-z2t11b', zoneId: 2, x: 9600, y: 10200, type: 'boss_encounter', enemyTypes: [{ type: 'Golem', level: 8, count: 2, weight: 1 }], respawnTime: 60, maxAlive: 2, aggroLink: true, eventId: 'z2_tower_11' },
    ],
    announceColor: '#0ea5e9', icon: '🛡️',
  },
  {
    id: 'z2_tower_12', name: 'Siege of Mossheart Tower',
    description: 'Moss golems emerge from the earth to claim the tower!',
    type: 'invasion', zoneIds: [2], duration: 210, cooldown: 440, trigger: 'timed',
    rewards: { xp: 200, gold: 140, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z2t12', zoneId: 2, x: 13400, y: 9400, type: 'camp', enemyTypes: [{ type: 'Golem', level: 6, count: 2, weight: 2 }, { type: 'Treant', level: 5, count: 3, weight: 2 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_12' },
    ],
    announceColor: '#06b6d4', icon: '⚔️',
  },

  // ── Row 4: Outer towers (south) — Lv3-5 enemies ──────────────
  {
    id: 'z2_tower_13', name: 'Siege of Duskfen Watch',
    description: 'Swamp creatures crawl out of the fen toward the watchtower!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 360, trigger: 'timed',
    rewards: { xp: 130, gold: 85, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t13', zoneId: 2, x: 2000, y: 13200, type: 'camp', enemyTypes: [{ type: 'Spider', level: 4, count: 4, weight: 3 }, { type: 'Treant', level: 4, count: 2, weight: 2 }], respawnTime: 22, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_13' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_14', name: 'Siege of Bramblegate Tower',
    description: 'Thorned beasts push through the brambles!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 380, trigger: 'timed',
    rewards: { xp: 130, gold: 85, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t14', zoneId: 2, x: 5600, y: 13000, type: 'camp', enemyTypes: [{ type: 'Treant', level: 5, count: 3, weight: 2 }, { type: 'Harpy', level: 4, count: 3, weight: 2 }], respawnTime: 24, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_14' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_15', name: 'Siege of Willowshade Spire',
    description: 'Shadow creatures lurk beneath the willows and strike!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 390, trigger: 'timed',
    rewards: { xp: 130, gold: 85, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t15', zoneId: 2, x: 9000, y: 13400, type: 'camp', enemyTypes: [{ type: 'Harpy', level: 4, count: 4, weight: 3 }, { type: 'Spider', level: 4, count: 3, weight: 2 }], respawnTime: 22, maxAlive: 6, aggroLink: true, eventId: 'z2_tower_15' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },
  {
    id: 'z2_tower_16', name: 'Siege of Frostpetal Lookout',
    description: 'Frost-touched golems assault the southern lookout!',
    type: 'invasion', zoneIds: [2], duration: 180, cooldown: 370, trigger: 'timed',
    rewards: { xp: 140, gold: 90, equipTier: 2 },
    spawnOverrides: [
      { id: 'evt-z2t16', zoneId: 2, x: 13000, y: 13200, type: 'camp', enemyTypes: [{ type: 'Golem', level: 4, count: 2, weight: 2 }, { type: 'Spider', level: 3, count: 4, weight: 3 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z2_tower_16' },
    ],
    announceColor: '#22d3ee', icon: '🏰',
  },

  // ═════════════════════════════════════════════════════════════════
  // Zone 3 — Sloarscorth Events (Frozen Crystal Highlands)
  // 3 events: crystal storm, KASA roaming, SHOGUN awakening
  // ═════════════════════════════════════════════════════════════════

  {
    id: 'z3_crystal_storm',
    name: 'Crystal Storm',
    description: 'A mana storm rages across Sloarscorth! Crystals shatter and empowered golems roam the highlands!',
    type: 'storm',
    zoneIds: [3],
    duration: 240,
    cooldown: 600,
    trigger: 'timed',
    rewards: { xp: 350, gold: 220, equipTier: 3 },
    spawnOverrides: [
      { id: 'evt-z3-storm-1', zoneId: 3, x: 3000, y: 6000, type: 'camp', enemyTypes: [{ type: 'Crystal Golem', level: 8, count: 3, weight: 2 }, { type: 'Ice Wraith', level: 7, count: 2, weight: 1 }], respawnTime: 20, maxAlive: 5, aggroLink: true, eventId: 'z3_crystal_storm' },
      { id: 'evt-z3-storm-2', zoneId: 3, x: 10000, y: 5500, type: 'camp', enemyTypes: [{ type: 'Crystal Golem', level: 9, count: 2, weight: 2 }, { type: 'Frost Wolf', level: 6, count: 4, weight: 3 }], respawnTime: 18, maxAlive: 6, aggroLink: false, eventId: 'z3_crystal_storm' },
      { id: 'evt-z3-storm-3', zoneId: 3, x: 7000, y: 8000, type: 'single', enemyTypes: [{ type: 'Ice Wraith', level: 8, count: 3, weight: 1 }], respawnTime: 15, maxAlive: 3, aggroLink: false, eventId: 'z3_crystal_storm' },
    ],
    announceColor: '#7dd3fc',
    icon: '❄️',
  },
  {
    id: 'z3_kasa_roams',
    name: 'KASA Roams the Plateau',
    description: 'The ancient beast KASA has emerged from the Stoneage Depths! Hunt it before it retreats!',
    type: 'world_boss',
    zoneIds: [3],
    duration: 300,
    cooldown: 900,
    trigger: 'random',
    rewards: { xp: 800, gold: 500, equipTier: 5 },
    spawnOverrides: [
      { id: 'evt-z3-kasa', zoneId: 3, x: 3000, y: 10500, type: 'boss_encounter', enemyTypes: [{ type: 'KASA', level: 14, count: 1, weight: 1 }], respawnTime: 999, maxAlive: 1, aggroLink: true, bossPhases: 2, eventId: 'z3_kasa_roams' },
      { id: 'evt-z3-kasa-adds', zoneId: 3, x: 3500, y: 11000, type: 'camp', enemyTypes: [{ type: 'Stoneage Brute', level: 10, count: 3, weight: 2 }, { type: 'Crystal Golem', level: 9, count: 2, weight: 1 }], respawnTime: 30, maxAlive: 4, aggroLink: true, eventId: 'z3_kasa_roams' },
    ],
    announceColor: '#f97316',
    icon: '🐲',
  },
  {
    id: 'z3_shogun_awakens',
    name: 'SHOGUN Awakens',
    description: 'The SHOGUN stirs within the Shattered Spire! Dark energy pulses across the frozen ruins!',
    type: 'world_boss',
    zoneIds: [3],
    duration: 360,
    cooldown: 1200,
    trigger: 'level_threshold',
    triggerValue: 10,
    rewards: { xp: 1000, gold: 650, equipTier: 5 },
    spawnOverrides: [
      { id: 'evt-z3-shogun', zoneId: 3, x: 12500, y: 4000, type: 'boss_encounter', enemyTypes: [{ type: 'SHOGUN', level: 15, count: 1, weight: 1 }], respawnTime: 999, maxAlive: 1, aggroLink: true, bossPhases: 3, eventId: 'z3_shogun_awakens' },
      { id: 'evt-z3-shogun-guard-1', zoneId: 3, x: 12000, y: 3500, type: 'camp', enemyTypes: [{ type: 'Frozen Skeleton', level: 10, count: 4, weight: 3 }, { type: 'Undead Warden', level: 11, count: 2, weight: 1 }], respawnTime: 25, maxAlive: 5, aggroLink: true, eventId: 'z3_shogun_awakens' },
      { id: 'evt-z3-shogun-guard-2', zoneId: 3, x: 13000, y: 4500, type: 'camp', enemyTypes: [{ type: 'Ice Wraith', level: 10, count: 3, weight: 2 }, { type: 'Crystal Golem', level: 11, count: 1, weight: 1 }], respawnTime: 28, maxAlive: 4, aggroLink: true, eventId: 'z3_shogun_awakens' },
    ],
    announceColor: '#dc2626',
    icon: '⚔️',
  },
];

// ── Zone Event Manager ─────────────────────────────────────────

export class ZoneEventManager {
  private cooldowns: Map<string, number> = new Map();
  private killCounter = 0;
  activeEvents: ActiveEvent[] = [];

  constructor() {
    // Initialize cooldowns so events don't all fire immediately
    for (const evt of ZONE_EVENTS) {
      this.cooldowns.set(evt.id, evt.cooldown * 0.3 + Math.random() * evt.cooldown * 0.7);
    }
  }

  /** Update event timers and trigger logic */
  update(
    dt: number,
    playerLevel: number,
    spawnerManager: SpawnerManager,
  ): EventUpdate[] {
    const updates: EventUpdate[] = [];

    // Update active events
    for (let i = this.activeEvents.length - 1; i >= 0; i--) {
      const active = this.activeEvents[i];
      active.timeRemaining -= dt;

      if (active.timeRemaining <= 0 && !active.completed) {
        active.completed = true;
        spawnerManager.deactivateEvent(active.def.id);
        updates.push({
          type: 'ended',
          event: active.def,
          message: `${active.def.name} has ended!`,
          color: active.def.announceColor,
        });
        // Reset cooldown
        this.cooldowns.set(active.def.id, active.def.cooldown);
        this.activeEvents.splice(i, 1);
      }
    }

    // Check for new event triggers
    for (const def of ZONE_EVENTS) {
      // Skip if already active
      if (this.activeEvents.some(a => a.def.id === def.id)) continue;

      // Check cooldown
      const cd = this.cooldowns.get(def.id) ?? 0;
      if (cd > 0) {
        this.cooldowns.set(def.id, cd - dt);
        continue;
      }

      // Check trigger conditions
      let shouldTrigger = false;

      switch (def.trigger) {
        case 'timed':
          shouldTrigger = true; // cooldown expired = trigger
          break;
        case 'random':
          shouldTrigger = Math.random() < 0.001 * dt; // ~0.1% per second
          break;
        case 'level_threshold':
          shouldTrigger = playerLevel >= (def.triggerValue ?? 1);
          break;
        case 'kill_count':
          shouldTrigger = this.killCounter >= (def.triggerValue ?? 50);
          if (shouldTrigger) this.killCounter = 0;
          break;
      }

      if (shouldTrigger) {
        this.startEvent(def, spawnerManager);
        updates.push({
          type: 'started',
          event: def,
          message: `${def.icon} ${def.name}: ${def.description}`,
          color: def.announceColor,
        });
      }
    }

    return updates;
  }

  /** Start an event */
  private startEvent(def: ZoneEventDef, spawnerManager: SpawnerManager): void {
    this.activeEvents.push({
      def,
      timeRemaining: def.duration,
      killCount: 0,
      completed: false,
      rewardClaimed: false,
    });

    // Activate event-linked spawners
    spawnerManager.activateEvent(def.id);
  }

  /** Notify a kill happened (for kill_count trigger) */
  onKill(): void {
    this.killCounter++;
    for (const active of this.activeEvents) {
      active.killCount++;
    }
  }

  /** Claim rewards for a completed event */
  claimReward(eventId: string): EventReward | null {
    const active = this.activeEvents.find(a => a.def.id === eventId && a.completed && !a.rewardClaimed);
    if (!active) return null;
    active.rewardClaimed = true;
    return active.def.rewards;
  }

  /** Check if resource surge is active (for double harvest) */
  isResourceSurgeActive(): boolean {
    return this.activeEvents.some(a => a.def.type === 'resource_surge' && !a.completed);
  }

  /** Get active event for a specific zone */
  getActiveEventForZone(zoneId: number): ActiveEvent | null {
    return this.activeEvents.find(a => a.def.zoneIds.includes(zoneId) && !a.completed) ?? null;
  }

  /** Get all active events */
  getActiveEvents(): ActiveEvent[] {
    return this.activeEvents.filter(a => !a.completed);
  }
}

export interface EventUpdate {
  type: 'started' | 'ended';
  event: ZoneEventDef;
  message: string;
  color: string;
}

// ── Factory ────────────────────────────────────────────────────

export function createZoneEventManager(): ZoneEventManager {
  return new ZoneEventManager();
}

/**
 * Faction Quest System — Hero NPC Quest Givers
 *
 * Each faction dock has 3 hero NPCs:
 *   - Faction Commander: kill quests + boss deployment quests
 *   - Supply Master: harvest turn-in + crafting turn-in quests
 *   - Scout/Trainer: exploration + dungeon quests
 *
 * Kill quests spawn enemy camps at map locations on accept.
 * Boss quests deploy a mini-boss at a given location on accept.
 * Harvest/crafting quests use existing profession and crafting systems.
 */

import type { MissionDef, MissionObjective, MissionReward, MissionType } from './missions';
import { FACTION_DOCKS, type FactionDock } from './faction-spawn';
import { HEROES, type HeroData } from './types';

// ── NPC Definitions ────────────────────────────────────────────

/** Where a hero NPC is stationed */
export type HeroNPCStation = 'dock_vendor' | 'zone_patrol';

export interface FactionHeroNPC {
  id: string;
  /** The original HEROES[] id */
  heroId: number;
  name: string;
  faction: string;
  role: 'commander' | 'supply_master' | 'quartermaster' | 'patrol';
  /** dock_vendor = Warriors + Worgs at dock; zone_patrol = Rangers + Mages roaming */
  station: HeroNPCStation;
  race: string;
  heroClass: string;
  /** Position in world coords */
  x: number;
  y: number;
  /** Dialog lines when player interacts */
  greetings: string[];
  /** Available quest pool (dock vendors only) */
  questIds: string[];
}

// ── Build NPC roster from HEROES[] ─────────────────────────────
// Warriors + Worgs → dock vendors (stationed at faction dock)
// Rangers + Mages → zone patrol AI (roaming faction patrol zones)

function buildFactionNPCs(): FactionHeroNPC[] {
  const npcs: FactionHeroNPC[] = [];
  const docks = FACTION_DOCKS;

  // Group heroes by faction
  const factions: Record<string, HeroData[]> = {};
  for (const h of HEROES) {
    if (!h.faction) continue;
    (factions[h.faction] ??= []).push(h);
  }

  for (const [faction, heroes] of Object.entries(factions)) {
    const dock = docks[faction];
    if (!dock) continue;
    const dx = dock.dockSpawn.x;
    const dy = dock.dockSpawn.y;

    // Separate by class role
    const warriors = heroes.filter(h => h.heroClass === 'Warrior');
    const worgs    = heroes.filter(h => h.heroClass === 'Worg');
    const mages    = heroes.filter(h => h.heroClass === 'Mage');
    const rangers  = heroes.filter(h => h.heroClass === 'Ranger');

    // ── Dock Vendors (Warriors + Worgs) ──────────────────────
    // Warriors are Commanders (kill/boss quests)
    warriors.forEach((h, i) => {
      npcs.push({
        id: `${faction.toLowerCase()}-warrior-${i}`,
        heroId: h.id,
        name: h.name,
        faction,
        role: 'commander',
        station: 'dock_vendor',
        race: h.race,
        heroClass: h.heroClass,
        x: dx - 80 + i * 60,
        y: dy + 60 + i * 30,
        greetings: [h.quote || 'The fight awaits.', `${h.title}. I have missions for you.`],
        questIds: FACTION_QUEST_IDS[faction]?.kill ?? [],
      });
    });

    // Worgs are Quartermasters (supply/crafting quests + shops)
    worgs.forEach((h, i) => {
      npcs.push({
        id: `${faction.toLowerCase()}-worg-${i}`,
        heroId: h.id,
        name: h.name,
        faction,
        role: 'quartermaster',
        station: 'dock_vendor',
        race: h.race,
        heroClass: h.heroClass,
        x: dx + 80 + i * 60,
        y: dy + 60 + i * 30,
        greetings: [h.quote || 'Need supplies?', `${h.title}. Trade with me.`],
        questIds: FACTION_QUEST_IDS[faction]?.supply ?? [],
      });
    });

    // ── Zone Patrol AI (Rangers + Mages) ─────────────────────
    // These spawn OUT in the faction's patrol zones, not at dock

    rangers.forEach((h, i) => {
      npcs.push({
        id: `${faction.toLowerCase()}-ranger-${i}`,
        heroId: h.id,
        name: h.name,
        faction,
        role: 'patrol',
        station: 'zone_patrol',
        race: h.race,
        heroClass: h.heroClass,
        // Start position: center of first patrol zone (or dock fallback)
        x: dx + 200 + i * 150,
        y: dy - 200 - i * 100,
        greetings: [h.quote || 'On patrol.', `${h.title}. The wilds are dangerous.`],
        questIds: FACTION_QUEST_IDS[faction]?.scout ?? [],
      });
    });

    mages.forEach((h, i) => {
      npcs.push({
        id: `${faction.toLowerCase()}-mage-${i}`,
        heroId: h.id,
        name: h.name,
        faction,
        role: 'patrol',
        station: 'zone_patrol',
        race: h.race,
        heroClass: h.heroClass,
        x: dx - 200 - i * 150,
        y: dy - 200 - i * 100,
        greetings: [h.quote || 'Knowledge is power.', `${h.title}. Magic guides my path.`],
        questIds: FACTION_QUEST_IDS[faction]?.scout ?? [],
      });
    });
  }

  return npcs;
}

/** Quest ID pools per faction, keyed by vendor role */
const FACTION_QUEST_IDS: Record<string, { kill: string[]; supply: string[]; scout: string[] }> = {
  Crusade: {
    kill:   ['fq-crusade-kill-bandits', 'fq-crusade-kill-undead', 'fq-crusade-boss-serpent'],
    supply: ['fq-crusade-harvest-herbs', 'fq-crusade-harvest-ore', 'fq-crusade-craft-weapons'],
    scout:  ['fq-crusade-explore-forest', 'fq-crusade-dungeon-crypt'],
  },
  Fabled: {
    kill:   ['fq-fabled-kill-spiders', 'fq-fabled-kill-treants', 'fq-fabled-boss-drake'],
    supply: ['fq-fabled-harvest-wood', 'fq-fabled-harvest-fish', 'fq-fabled-craft-armor'],
    scout:  ['fq-fabled-explore-temple', 'fq-fabled-dungeon-ruins'],
  },
  Legion: {
    kill:   ['fq-legion-kill-knights', 'fq-legion-kill-wraiths', 'fq-legion-boss-colossus'],
    supply: ['fq-legion-harvest-bones', 'fq-legion-harvest-crystals', 'fq-legion-craft-relics'],
    scout:  ['fq-legion-explore-harbor', 'fq-legion-dungeon-catacombs'],
  },
  Pirates: {
    kill:   ['fq-pirate-kill-navy', 'fq-pirate-kill-serpents', 'fq-pirate-boss-kraken'],
    supply: ['fq-pirate-harvest-fish', 'fq-pirate-harvest-wood', 'fq-pirate-craft-bombs'],
    scout:  ['fq-pirate-explore-cove', 'fq-pirate-dungeon-depths'],
  },
};

// ── Hero NPC Registry (built from HEROES[]) ────────────────────

export const FACTION_HERO_NPCS: FactionHeroNPC[] = buildFactionNPCs();

// ── Quest Definitions ──────────────────────────────────────────

export type FactionQuestType = MissionType | 'craft';

export interface FactionQuestDef extends Omit<MissionDef, 'objectives'> {
  objectives: (MissionObjective & { spawnCamp?: CampSpawnDef; spawnBoss?: BossSpawnDef })[];
  npcId: string;
  faction: string;
}

/** Camp spawn config for kill quests */
export interface CampSpawnDef {
  enemyType: string;
  count: number;
  level: number;
  /** Offset from a random point in the zone */
  radius: number;
}

/** Boss spawn config for boss quests */
export interface BossSpawnDef {
  bossType: string;
  level: number;
  /** Scales with player level */
  levelScale: boolean;
}

// ── All Faction Quests ─────────────────────────────────────────

export const FACTION_QUESTS: FactionQuestDef[] = [
  // ── Crusade Kill Quests ──
  {
    id: 'fq-crusade-kill-bandits', name: 'Coastal Defense', npcId: 'crusade-commander', faction: 'Crusade',
    description: 'Bandits raid our supply wagons. Find their camp and eliminate them.',
    zoneId: 16, requiredLevel: 3, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Bandit', required: 6, current: 0,
      spawnCamp: { enemyType: 'Bandit', count: 6, level: 4, radius: 200 },
    }],
    reward: { xp: 120, gold: 40, reputation: 10 },
  },
  {
    id: 'fq-crusade-kill-undead', name: 'Purge the Risen', npcId: 'crusade-commander', faction: 'Crusade',
    description: 'Undead crawl from the northern shores at night. Put them to rest.',
    zoneId: 16, requiredLevel: 4, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Skeleton', required: 8, current: 0,
      spawnCamp: { enemyType: 'Skeleton', count: 8, level: 4, radius: 250 },
    }],
    reward: { xp: 150, gold: 50, reputation: 12 },
  },
  {
    id: 'fq-crusade-boss-serpent', name: 'Sea Serpent Hunt', npcId: 'crusade-commander', faction: 'Crusade',
    description: 'A sea serpent threatens our harbor. Slay the beast!',
    zoneId: 16, requiredLevel: 6, repeatable: true,
    objectives: [{
      type: 'boss', target: 'Sea Serpent', required: 1, current: 0,
      spawnBoss: { bossType: 'Sea Serpent', level: 8, levelScale: true },
    }],
    reward: { xp: 300, gold: 120, reputation: 25, equipmentTier: 3 },
  },

  // ── Crusade Harvest / Craft Quests ──
  {
    id: 'fq-crusade-harvest-herbs', name: 'Healer\'s Bounty', npcId: 'crusade-supply', faction: 'Crusade',
    description: 'Our healers need medicinal herbs. Gather what you can.',
    zoneId: 16, requiredLevel: 2, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Herb', required: 8, current: 0 }],
    reward: { xp: 80, gold: 30, reputation: 8 },
  },
  {
    id: 'fq-crusade-harvest-ore', name: 'Iron for the Forge', npcId: 'crusade-supply', faction: 'Crusade',
    description: 'The blacksmith needs iron ore. Mine it from the nearby cliffs.',
    zoneId: 16, requiredLevel: 3, repeatable: true,
    objectives: [{ type: 'collect', target: 'Iron Ore', required: 6, current: 0 }],
    reward: { xp: 100, gold: 35, reputation: 8 },
  },
  {
    id: 'fq-crusade-craft-weapons', name: 'Arm the Garrison', npcId: 'crusade-supply', faction: 'Crusade',
    description: 'Craft swords for the garrison. The forge is yours to use.',
    zoneId: 16, requiredLevel: 4, repeatable: true,
    objectives: [{ type: 'collect', target: 'Iron Sword', required: 3, current: 0 }],
    reward: { xp: 200, gold: 80, reputation: 15 },
  },

  // ── Crusade Scout Quests ──
  {
    id: 'fq-crusade-explore-forest', name: 'Forest Reconnaissance', npcId: 'crusade-scout', faction: 'Crusade',
    description: 'Scout the Forest of Whispers for enemy movements.',
    zoneId: 16, requiredLevel: 2, repeatable: false,
    objectives: [{ type: 'explore', target: 'Forest of Whispers', required: 1, current: 0 }],
    reward: { xp: 80, gold: 25, reputation: 10 },
    chain: 'fq-crusade-dungeon-crypt',
  },
  {
    id: 'fq-crusade-dungeon-crypt', name: 'Clear the Crypt', npcId: 'crusade-scout', faction: 'Crusade',
    description: 'An undead crypt was discovered. Clear it out.',
    zoneId: 16, requiredLevel: 5, repeatable: false,
    objectives: [{ type: 'dungeon', target: 'forest-crypt', required: 1, current: 0 }],
    reward: { xp: 250, gold: 100, reputation: 20, equipmentTier: 2 },
  },

  // ── Fabled Kill Quests ──
  {
    id: 'fq-fabled-kill-spiders', name: 'Web Clearance', npcId: 'fabled-commander', faction: 'Fabled',
    description: 'Giant spiders infest our sacred groves. Purge them.',
    zoneId: 17, requiredLevel: 5, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Spider', required: 6, current: 0,
      spawnCamp: { enemyType: 'Spider', count: 6, level: 5, radius: 200 },
    }],
    reward: { xp: 130, gold: 45, reputation: 10 },
  },
  {
    id: 'fq-fabled-kill-treants', name: 'Corrupted Guardians', npcId: 'fabled-commander', faction: 'Fabled',
    description: 'The treants have been corrupted. Free their spirits.',
    zoneId: 17, requiredLevel: 6, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Treant', required: 4, current: 0,
      spawnCamp: { enemyType: 'Treant', count: 4, level: 6, radius: 180 },
    }],
    reward: { xp: 160, gold: 55, reputation: 12 },
  },
  {
    id: 'fq-fabled-boss-drake', name: 'Fire Drake Assault', npcId: 'fabled-commander', faction: 'Fabled',
    description: 'A fire drake nests near our temple. Slay it before it burns everything.',
    zoneId: 17, requiredLevel: 8, repeatable: true,
    objectives: [{
      type: 'boss', target: 'Fire Drake', required: 1, current: 0,
      spawnBoss: { bossType: 'Fire Drake', level: 10, levelScale: true },
    }],
    reward: { xp: 350, gold: 140, reputation: 25, equipmentTier: 3 },
  },

  // ── Fabled Harvest / Craft Quests ──
  {
    id: 'fq-fabled-harvest-wood', name: 'Lumber for the Fleet', npcId: 'fabled-supply', faction: 'Fabled',
    description: 'We need quality timber for shipbuilding.',
    zoneId: 17, requiredLevel: 4, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Wood', required: 10, current: 0 }],
    reward: { xp: 90, gold: 30, reputation: 8 },
  },
  {
    id: 'fq-fabled-harvest-fish', name: 'Feast Preparations', npcId: 'fabled-supply', faction: 'Fabled',
    description: 'The Festival of Stars approaches. We need fresh fish.',
    zoneId: 17, requiredLevel: 3, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Fish', required: 8, current: 0 }],
    reward: { xp: 70, gold: 25, reputation: 6 },
  },
  {
    id: 'fq-fabled-craft-armor', name: 'Elven Armaments', npcId: 'fabled-supply', faction: 'Fabled',
    description: 'Craft leather armor for our rangers.',
    zoneId: 17, requiredLevel: 6, repeatable: true,
    objectives: [{ type: 'collect', target: 'Leather Chest', required: 2, current: 0 }],
    reward: { xp: 220, gold: 90, reputation: 15 },
  },

  // ── Fabled Scout Quests ──
  {
    id: 'fq-fabled-explore-temple', name: 'Temple Survey', npcId: 'fabled-scout', faction: 'Fabled',
    description: 'Scout the ancient temple ruins on the far shore.',
    zoneId: 17, requiredLevel: 5, repeatable: false,
    objectives: [{ type: 'explore', target: 'Fabled Island', required: 1, current: 0 }],
    reward: { xp: 100, gold: 35, reputation: 12 },
  },
  {
    id: 'fq-fabled-dungeon-ruins', name: 'Delve the Ruins', npcId: 'fabled-scout', faction: 'Fabled',
    description: 'Explore the dungeon beneath the ancient ruins.',
    zoneId: 17, requiredLevel: 8, repeatable: false,
    objectives: [{ type: 'dungeon', target: 'fabled-ruins', required: 1, current: 0 }],
    reward: { xp: 300, gold: 120, reputation: 22, equipmentTier: 3 },
  },

  // ── Legion Kill Quests ──
  {
    id: 'fq-legion-kill-knights', name: 'Crush the Crusaders', npcId: 'legion-commander', faction: 'Legion',
    description: 'Crusade scouts encroach on our territory. Destroy them.',
    zoneId: 18, requiredLevel: 8, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Corrupted Knight', required: 5, current: 0,
      spawnCamp: { enemyType: 'Corrupted Knight', count: 5, level: 9, radius: 220 },
    }],
    reward: { xp: 200, gold: 70, reputation: 12 },
  },
  {
    id: 'fq-legion-kill-wraiths', name: 'Bind the Spirits', npcId: 'legion-commander', faction: 'Legion',
    description: 'Rogue wraiths break free from our control. Recapture their essence.',
    zoneId: 18, requiredLevel: 9, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Wraith', required: 6, current: 0,
      spawnCamp: { enemyType: 'Wraith', count: 6, level: 9, radius: 200 },
    }],
    reward: { xp: 180, gold: 65, reputation: 10 },
  },
  {
    id: 'fq-legion-boss-colossus', name: 'Infernal Challenge', npcId: 'legion-commander', faction: 'Legion',
    description: 'Summon and defeat the Infernal Colossus to prove your worth to the Legion.',
    zoneId: 18, requiredLevel: 12, repeatable: true,
    objectives: [{
      type: 'boss', target: 'Infernal Colossus', required: 1, current: 0,
      spawnBoss: { bossType: 'Infernal Colossus', level: 14, levelScale: true },
    }],
    reward: { xp: 500, gold: 200, reputation: 30, equipmentTier: 5 },
  },

  // ── Legion Harvest / Craft Quests ──
  {
    id: 'fq-legion-harvest-bones', name: 'Bone Collection', npcId: 'legion-supply', faction: 'Legion',
    description: 'Gather bones from fallen creatures. The necromancers require them.',
    zoneId: 18, requiredLevel: 7, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Bone', required: 10, current: 0 }],
    reward: { xp: 110, gold: 40, reputation: 8 },
  },
  {
    id: 'fq-legion-harvest-crystals', name: 'Dark Crystal Mining', npcId: 'legion-supply', faction: 'Legion',
    description: 'Mine dark crystals from the harbor caves.',
    zoneId: 18, requiredLevel: 8, repeatable: true,
    objectives: [{ type: 'collect', target: 'Shadow Crystal', required: 5, current: 0 }],
    reward: { xp: 140, gold: 55, reputation: 10 },
  },
  {
    id: 'fq-legion-craft-relics', name: 'Forge Dark Relics', npcId: 'legion-supply', faction: 'Legion',
    description: 'Craft dark relics for the Legion war effort.',
    zoneId: 18, requiredLevel: 10, repeatable: true,
    objectives: [{ type: 'collect', target: 'Dark Relic', required: 2, current: 0 }],
    reward: { xp: 280, gold: 110, reputation: 18 },
  },

  // ── Legion Scout Quests ──
  {
    id: 'fq-legion-explore-harbor', name: 'Harbor Patrol', npcId: 'legion-scout', faction: 'Legion',
    description: 'Patrol the harbor perimeter and report back.',
    zoneId: 18, requiredLevel: 7, repeatable: false,
    objectives: [{ type: 'explore', target: 'Legion Harbor', required: 1, current: 0 }],
    reward: { xp: 90, gold: 30, reputation: 10 },
  },
  {
    id: 'fq-legion-dungeon-catacombs', name: 'Catacombs Cleansing', npcId: 'legion-scout', faction: 'Legion',
    description: 'Descend into the harbor catacombs and clear the way.',
    zoneId: 18, requiredLevel: 10, repeatable: false,
    objectives: [{ type: 'dungeon', target: 'catacombs', required: 1, current: 0 }],
    reward: { xp: 400, gold: 160, reputation: 25, equipmentTier: 4 },
  },

  // ── Pirate Kill Quests ──
  {
    id: 'fq-pirate-kill-navy', name: 'Sink the Navy', npcId: 'pirate-commander', faction: 'Pirates',
    description: 'Navy patrols threaten our operations. Eliminate the scouts.',
    zoneId: 19, requiredLevel: 6, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Bandit', required: 8, current: 0,
      spawnCamp: { enemyType: 'Bandit', count: 8, level: 7, radius: 250 },
    }],
    reward: { xp: 160, gold: 55, reputation: 10 },
  },
  {
    id: 'fq-pirate-kill-serpents', name: 'Serpent Slaughter', npcId: 'pirate-commander', faction: 'Pirates',
    description: 'Sea serpents block our trade routes. Clear them out.',
    zoneId: 19, requiredLevel: 7, repeatable: true,
    objectives: [{
      type: 'kill', target: 'Skeleton', required: 10, current: 0,
      spawnCamp: { enemyType: 'Skeleton', count: 10, level: 7, radius: 300 },
    }],
    reward: { xp: 180, gold: 65, reputation: 12 },
  },
  {
    id: 'fq-pirate-boss-kraken', name: 'Kraken\'s End', npcId: 'pirate-commander', faction: 'Pirates',
    description: 'The Bandit Chief controls these waters. End his reign.',
    zoneId: 19, requiredLevel: 9, repeatable: true,
    objectives: [{
      type: 'boss', target: 'Bandit Chief', required: 1, current: 0,
      spawnBoss: { bossType: 'Bandit Chief', level: 10, levelScale: true },
    }],
    reward: { xp: 350, gold: 150, reputation: 25, equipmentTier: 3 },
  },

  // ── Pirate Harvest / Craft Quests ──
  {
    id: 'fq-pirate-harvest-fish', name: 'Feed the Crew', npcId: 'pirate-supply', faction: 'Pirates',
    description: 'The crew is hungry. Catch fish from the bay.',
    zoneId: 19, requiredLevel: 4, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Fish', required: 10, current: 0 }],
    reward: { xp: 80, gold: 25, reputation: 6 },
  },
  {
    id: 'fq-pirate-harvest-wood', name: 'Ship Repairs', npcId: 'pirate-supply', faction: 'Pirates',
    description: 'Our ships need patching. Gather timber.',
    zoneId: 19, requiredLevel: 5, repeatable: true,
    objectives: [{ type: 'collect', target: 'Common Wood', required: 8, current: 0 }],
    reward: { xp: 90, gold: 30, reputation: 8 },
  },
  {
    id: 'fq-pirate-craft-bombs', name: 'Explosive Ordinance', npcId: 'pirate-supply', faction: 'Pirates',
    description: 'Craft explosive devices for the next raid.',
    zoneId: 19, requiredLevel: 7, repeatable: true,
    objectives: [{ type: 'collect', target: 'Fire Bomb', required: 3, current: 0 }],
    reward: { xp: 240, gold: 100, reputation: 15 },
  },

  // ── Pirate Scout Quests ──
  {
    id: 'fq-pirate-explore-cove', name: 'Hidden Coves', npcId: 'pirate-scout', faction: 'Pirates',
    description: 'Explore the hidden coves south of the bay.',
    zoneId: 19, requiredLevel: 5, repeatable: false,
    objectives: [{ type: 'explore', target: 'Pirate Cove', required: 1, current: 0 }],
    reward: { xp: 80, gold: 25, reputation: 10 },
  },
  {
    id: 'fq-pirate-dungeon-depths', name: 'Sunken Treasure', npcId: 'pirate-scout', faction: 'Pirates',
    description: 'Dive into the underwater ruins for legendary treasure.',
    zoneId: 19, requiredLevel: 8, repeatable: false,
    objectives: [{ type: 'dungeon', target: 'sunken-ruins', required: 1, current: 0 }],
    reward: { xp: 320, gold: 130, reputation: 22, equipmentTier: 3 },
  },
];

// ── Lookup Helpers ──────────────────────────────────────────────

/** Get all hero NPCs for a given faction */
export function getFactionNPCs(faction: string): FactionHeroNPC[] {
  return FACTION_HERO_NPCS.filter(n => n.faction === faction);
}

/** Get quests available from a specific NPC */
export function getNPCQuests(npcId: string): FactionQuestDef[] {
  const npc = FACTION_HERO_NPCS.find(n => n.id === npcId);
  if (!npc) return [];
  return FACTION_QUESTS.filter(q => npc.questIds.includes(q.id));
}

/** Get all faction quests for a zone */
export function getFactionQuestsForZone(zoneId: number): FactionQuestDef[] {
  return FACTION_QUESTS.filter(q => q.zoneId === zoneId);
}

/** Get a specific faction quest by ID */
export function getFactionQuest(questId: string): FactionQuestDef | undefined {
  return FACTION_QUESTS.find(q => q.id === questId);
}

/** Get the NPC that offers a specific quest */
export function getQuestNPC(questId: string): FactionHeroNPC | undefined {
  const quest = getFactionQuest(questId);
  if (!quest) return undefined;
  return FACTION_HERO_NPCS.find(n => n.id === quest.npcId);
}

// ── Camp / Boss Spawn Helpers ──────────────────────────────────

/**
 * Calculate camp spawn position for a kill quest.
 * Returns a position near the zone center, offset by the camp radius.
 */
export function calculateCampPosition(
  zoneId: number,
  campDef: CampSpawnDef,
  seed: number,
): { x: number; y: number } {
  // Use zone center as base, then offset
  const zones = require('./zones');
  const zone = zones.getZoneById(zoneId);
  if (!zone) return { x: 0, y: 0 };

  const cx = zone.bounds.x + zone.bounds.w / 2;
  const cy = zone.bounds.y + zone.bounds.h / 2;
  const angle = (seed * 137.5) % (Math.PI * 2);
  const dist = campDef.radius + Math.random() * 100;

  return {
    x: Math.round(cx + Math.cos(angle) * dist),
    y: Math.round(cy + Math.sin(angle) * dist),
  };
}

/**
 * Calculate boss spawn position for a boss quest.
 * Places the boss at a meaningful location in the zone.
 */
export function calculateBossPosition(
  zoneId: number,
  seed: number,
): { x: number; y: number } {
  const zones = require('./zones');
  const zone = zones.getZoneById(zoneId);
  if (!zone) return { x: 0, y: 0 };

  // Place boss slightly off-center in a dramatic location
  const cx = zone.bounds.x + zone.bounds.w * 0.3 + (seed % 4) * zone.bounds.w * 0.1;
  const cy = zone.bounds.y + zone.bounds.h * 0.3 + (seed % 3) * zone.bounds.h * 0.1;

  return { x: Math.round(cx), y: Math.round(cy) };
}

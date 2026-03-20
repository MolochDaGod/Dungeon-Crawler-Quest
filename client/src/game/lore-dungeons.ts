/**
 * Lore Dungeons — Static hand-crafted dungeon definitions
 *
 * Each lore dungeon has:
 * - Fixed layout (rooms, hallways, boss room)
 * - Set boss + 2-4 minion groups per zone
 * - Specific loot tables
 * - Story/lore text triggers on room entry
 */

import type { DungeonFormat } from './dungeon-generators';

export interface LoreMinionGroup {
  type: string;
  count: number;
  level: number;
}

export interface LoreBoss {
  type: string;
  name: string;
  title: string;
  level: number;
  hpMultiplier: number; // Multiplied against base boss HP
  abilities: string[]; // Special ability IDs
  summonOnHp?: number; // HP% threshold to summon minions
  summonType?: string;
  summonCount?: number;
}

export interface LoreLootEntry {
  itemId: string;
  name: string;
  dropChance: number; // 0-1
  minQuantity: number;
  maxQuantity: number;
  tier: number;
}

export interface LoreStoryTrigger {
  roomIndex: number;
  text: string;
  speaker?: string; // NPC name or narrator
  type: 'narration' | 'dialogue' | 'lore_item' | 'warning';
}

export interface LoreDungeon {
  id: string;
  name: string;
  description: string;
  difficulty: number; // 1-10
  recommendedLevel: number;
  format: DungeonFormat;
  portalId: string; // Links to portal-system WORLD_PORTALS id
  boss: LoreBoss;
  minionGroups: LoreMinionGroup[];
  lootTable: LoreLootEntry[];
  storyTriggers: LoreStoryTrigger[];
  ambientColor: string; // Tint for dungeon lighting
  musicTrack?: string;
}

// ═══════════════════════════════════════════════════════════════
// Lore Dungeon Definitions
// ═══════════════════════════════════════════════════════════════

export const LORE_DUNGEONS: LoreDungeon[] = [
  {
    id: 'goblin_warren',
    name: 'The Goblin Warren',
    description: 'A network of tunnels crawling with goblin raiders. Their king hoards stolen treasures in the deepest chamber.',
    difficulty: 2,
    recommendedLevel: 3,
    format: 'dungeon_maze',
    portalId: 'dng_goblin',
    boss: {
      type: 'golem_king',
      name: 'King Grizznak',
      title: 'The Hoarder King',
      level: 5,
      hpMultiplier: 0.8,
      abilities: ['summon_goblins', 'gold_toss', 'enrage'],
      summonOnHp: 50,
      summonType: 'slime',
      summonCount: 3,
    },
    minionGroups: [
      { type: 'slime', count: 4, level: 2 },
      { type: 'slime', count: 3, level: 3 },
      { type: 'skeleton', count: 2, level: 3 },
    ],
    lootTable: [
      { itemId: 'gold_pile', name: 'Gold Pile', dropChance: 1.0, minQuantity: 30, maxQuantity: 80, tier: 1 },
      { itemId: 'goblin_dagger', name: 'Goblin Dagger', dropChance: 0.3, minQuantity: 1, maxQuantity: 1, tier: 1 },
      { itemId: 'health_potion', name: 'Health Potion', dropChance: 0.5, minQuantity: 1, maxQuantity: 3, tier: 1 },
      { itemId: 'crown_fragment', name: 'Crown Fragment', dropChance: 0.1, minQuantity: 1, maxQuantity: 1, tier: 2 },
    ],
    storyTriggers: [
      { roomIndex: 0, text: 'The stench of goblins fills the tunnel. Crude torches flicker on the walls, casting dancing shadows.', type: 'narration' },
      { roomIndex: 2, text: '"Turn back, fleshling! The King sees all!" a goblin shrieks before fleeing.', speaker: 'Goblin Scout', type: 'dialogue' },
      { roomIndex: -1, text: 'The Hoarder King sits atop a mountain of stolen gold, his beady eyes gleaming with malice.', type: 'warning' },
    ],
    ambientColor: '#4a3728',
  },
  {
    id: 'undead_crypt',
    name: 'The Undead Crypt',
    description: 'Ancient burial chambers corrupted by necromantic energy. The dead walk here, and their master waits in the ossuary.',
    difficulty: 5,
    recommendedLevel: 8,
    format: 'dungeon_maze',
    portalId: 'dng_crypt',
    boss: {
      type: 'lich_boss',
      name: 'Archlich Veranthos',
      title: 'The Bone Sovereign',
      level: 10,
      hpMultiplier: 1.2,
      abilities: ['soul_drain', 'bone_wall', 'raise_dead', 'frost_nova'],
      summonOnHp: 60,
      summonType: 'skeleton',
      summonCount: 4,
    },
    minionGroups: [
      { type: 'skeleton', count: 4, level: 6 },
      { type: 'skeleton', count: 3, level: 7 },
      { type: 'wraith', count: 2, level: 8 },
      { type: 'golem', count: 1, level: 7 },
    ],
    lootTable: [
      { itemId: 'gold_pile', name: 'Gold Pile', dropChance: 1.0, minQuantity: 60, maxQuantity: 150, tier: 2 },
      { itemId: 'bone_staff', name: 'Staff of Bones', dropChance: 0.2, minQuantity: 1, maxQuantity: 1, tier: 3 },
      { itemId: 'health_potion', name: 'Health Potion', dropChance: 0.6, minQuantity: 2, maxQuantity: 5, tier: 2 },
      { itemId: 'mana_crystal', name: 'Mana Crystal', dropChance: 0.4, minQuantity: 1, maxQuantity: 2, tier: 2 },
      { itemId: 'lich_phylactery', name: "Veranthos' Phylactery", dropChance: 0.05, minQuantity: 1, maxQuantity: 1, tier: 3 },
    ],
    storyTriggers: [
      { roomIndex: 0, text: 'Cold air seeps from the crypt entrance. The sound of scraping bone echoes from within.', type: 'narration' },
      { roomIndex: 1, text: 'Ancient runes glow faintly on the walls — wards that once kept the dead at rest, now shattered.', type: 'lore_item' },
      { roomIndex: 3, text: '"You disturb my eternal study. How... inconvenient." The Archlich rises from his throne of skulls.', speaker: 'Archlich Veranthos', type: 'dialogue' },
      { roomIndex: -1, text: 'The ossuary trembles. Bones rattle in their alcoves as necromantic power surges.', type: 'warning' },
    ],
    ambientColor: '#1a1a2e',
  },
  {
    id: 'shadow_fortress',
    name: 'The Shadow Fortress',
    description: 'A fortress warped by shadow magic. The Shadow Lord commands legions of darkness from within.',
    difficulty: 8,
    recommendedLevel: 15,
    format: 'boss_arena',
    portalId: 'dng_fortress',
    boss: {
      type: 'shadow_lord',
      name: 'Umbral Tyrant Xalathor',
      title: 'The Void Emperor',
      level: 18,
      hpMultiplier: 1.5,
      abilities: ['shadow_step', 'void_nova', 'summon_shades', 'dark_binding', 'execute'],
      summonOnHp: 75,
      summonType: 'wraith',
      summonCount: 3,
    },
    minionGroups: [
      { type: 'wraith', count: 3, level: 13 },
      { type: 'orc', count: 3, level: 14 },
      { type: 'golem', count: 2, level: 15 },
      { type: 'wraith', count: 4, level: 12 },
    ],
    lootTable: [
      { itemId: 'gold_pile', name: 'Gold Pile', dropChance: 1.0, minQuantity: 150, maxQuantity: 400, tier: 3 },
      { itemId: 'shadow_blade', name: 'Shadowreaper', dropChance: 0.15, minQuantity: 1, maxQuantity: 1, tier: 3 },
      { itemId: 'void_armor', name: 'Void-Touched Armor', dropChance: 0.1, minQuantity: 1, maxQuantity: 1, tier: 3 },
      { itemId: 'health_potion', name: 'Health Potion', dropChance: 0.7, minQuantity: 3, maxQuantity: 6, tier: 3 },
      { itemId: 'shadow_essence', name: 'Shadow Essence', dropChance: 0.3, minQuantity: 1, maxQuantity: 3, tier: 3 },
      { itemId: 'void_shard', name: 'Void Shard', dropChance: 0.02, minQuantity: 1, maxQuantity: 1, tier: 3 },
    ],
    storyTriggers: [
      { roomIndex: 0, text: 'The fortress gates creak open by themselves. Within, shadows move with purpose.', type: 'narration' },
      { roomIndex: -1, text: '"You dare enter MY domain? I who have consumed a thousand worlds? Amusing." Shadow tendrils coil around the arena pillars.', speaker: 'Umbral Tyrant Xalathor', type: 'dialogue' },
    ],
    ambientColor: '#0d0d1a',
    musicTrack: 'boss_epic',
  },
];

// ── Lookup helpers ──

export function getLoreDungeon(id: string): LoreDungeon | undefined {
  return LORE_DUNGEONS.find(d => d.id === id);
}

export function getLoreDungeonByPortalId(portalId: string): LoreDungeon | undefined {
  return LORE_DUNGEONS.find(d => d.portalId === portalId);
}

export function getStoryTriggerForRoom(dungeonId: string, roomIndex: number): LoreStoryTrigger | undefined {
  const dungeon = getLoreDungeon(dungeonId);
  if (!dungeon) return undefined;
  // -1 means boss room trigger
  return dungeon.storyTriggers.find(t => t.roomIndex === roomIndex);
}

export function rollLoot(lootTable: LoreLootEntry[]): { itemId: string; name: string; quantity: number; tier: number }[] {
  const drops: { itemId: string; name: string; quantity: number; tier: number }[] = [];
  for (const entry of lootTable) {
    if (Math.random() <= entry.dropChance) {
      const quantity = entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1));
      drops.push({ itemId: entry.itemId, name: entry.name, quantity, tier: entry.tier });
    }
  }
  return drops;
}

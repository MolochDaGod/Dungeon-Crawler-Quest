/**
 * Island Auto-Harvesting System
 * Deploy heroes to islands for passive resource gathering.
 * Calculates offline gains based on elapsed time × hero profession level.
 */

import { HEROES, HeroData } from './types';
import { ISLAND_ZONES, ZoneDef } from './zones';
import {
  GATHERING_PROFESSIONS, loadProfessions, saveProfessions,
  gainProfessionXp, getTierForLevel, PlayerProfessions, GatheringProfDef,
} from './professions-system';
import {
  addResource, ResourceInventory, createResourceInventory,
} from './professions-system';
import { loadPlayerProgress } from './player-progress';

// ── Zone → Gathering Profession mapping ────────────────────────

const ZONE_PROFESSIONS: Record<number, string[]> = {
  0: ['herbalism', 'scavenging'],           // Starting Village
  1: ['logging', 'herbalism'],               // Forest of Whispers
  2: ['fishing', 'herbalism'],               // Cursed Swamp
  3: ['mining', 'skinning'],                 // Mountain Pass
  4: ['skinning', 'mining'],                 // Dragon's Reach
  5: ['scavenging', 'mining'],               // Undead Crypts
  6: ['mining', 'scavenging'],               // Volcano Rim
  7: ['scavenging', 'skinning'],             // Boss Arena
  8: ['herbalism', 'logging'],               // Crusade Island
  9: ['herbalism', 'fishing'],               // Fabled Island
  10: ['mining', 'scavenging'],              // Legion Outpost
  11: ['fishing', 'logging'],                // Pirate Cove
  12: ['mining', 'scavenging'],              // Dungeon Depths
  13: ['skinning', 'mining'],                // Graveyard of Titans
  14: ['fishing', 'herbalism'],              // Fisherman's Haven
  15: ['skinning', 'scavenging'],            // Piglin Outpost
};

export function getZoneProfessions(zoneId: number): GatheringProfDef[] {
  const ids = ZONE_PROFESSIONS[zoneId] || ['herbalism'];
  return ids.map(id => GATHERING_PROFESSIONS.find(g => g.id === id)!).filter(Boolean);
}

// ── Deployment Types ───────────────────────────────────────────

export interface IslandDeployment {
  heroId: number;
  zoneId: number;
  professionId: string;
  deployedAt: number;       // epoch ms
  lastTickAt: number;       // epoch ms — last time harvest was calculated
  totalHarvested: number;   // total resources collected this deployment
}

export interface IslandHarvestState {
  deployments: IslandDeployment[];
  maxDeployments: number;
  harvestLog: HarvestLogEntry[];
}

export interface HarvestLogEntry {
  timestamp: number;
  heroName: string;
  zoneName: string;
  resourceName: string;
  quantity: number;
  xpGained: number;
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'grudge_island_deployments';
const MAX_LOG_ENTRIES = 50;
const HARVEST_INTERVAL_MS = 60_000; // 1 minute per harvest tick

// ── Create / Load / Save ───────────────────────────────────────

export function createIslandHarvestState(): IslandHarvestState {
  return { deployments: [], maxDeployments: 3, harvestLog: [] };
}

export function saveIslandState(state: IslandHarvestState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      deployments: state.deployments,
      maxDeployments: state.maxDeployments,
      harvestLog: state.harvestLog.slice(0, MAX_LOG_ENTRIES),
    }));
  } catch {}
}

export function loadIslandState(): IslandHarvestState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createIslandHarvestState();
    const saved = JSON.parse(raw);
    return {
      deployments: saved.deployments || [],
      maxDeployments: saved.maxDeployments || 3,
      harvestLog: saved.harvestLog || [],
    };
  } catch {
    return createIslandHarvestState();
  }
}

// ── Deploy / Recall ────────────────────────────────────────────

export function deployHeroToIsland(
  state: IslandHarvestState,
  heroId: number,
  zoneId: number,
  professionId: string,
): boolean {
  if (state.deployments.length >= state.maxDeployments) return false;
  if (state.deployments.some(d => d.heroId === heroId)) return false;

  const zone = ISLAND_ZONES.find(z => z.id === zoneId);
  if (!zone) return false;

  const now = Date.now();
  state.deployments.push({
    heroId,
    zoneId,
    professionId,
    deployedAt: now,
    lastTickAt: now,
    totalHarvested: 0,
  });
  saveIslandState(state);
  return true;
}

export function recallHeroFromIsland(state: IslandHarvestState, heroId: number): IslandDeployment | null {
  const idx = state.deployments.findIndex(d => d.heroId === heroId);
  if (idx === -1) return null;
  const deployment = state.deployments.splice(idx, 1)[0];
  saveIslandState(state);
  return deployment;
}

// ── Tick: Calculate offline gains ──────────────────────────────

export interface TickResult {
  newEntries: HarvestLogEntry[];
  totalResourcesGained: number;
}

/**
 * Process all deployments and calculate resources gathered since last tick.
 * Call this on page load or periodically.
 */
export function tickIslandHarvest(
  state: IslandHarvestState,
  profs: PlayerProfessions,
  inv: ResourceInventory,
): TickResult {
  const now = Date.now();
  const newEntries: HarvestLogEntry[] = [];
  let totalResourcesGained = 0;

  for (const dep of state.deployments) {
    const elapsed = now - dep.lastTickAt;
    const ticks = Math.floor(elapsed / HARVEST_INTERVAL_MS);
    if (ticks <= 0) continue;

    const zone = ISLAND_ZONES.find(z => z.id === dep.zoneId);
    if (!zone) continue;

    const hero = HEROES.find(h => h.id === dep.heroId);
    if (!hero) continue;

    const profState = profs.gathering[dep.professionId];
    if (!profState) continue;

    const profDef = GATHERING_PROFESSIONS.find(g => g.id === dep.professionId);
    if (!profDef) continue;

    const maxTier = getTierForLevel(profState.level);
    const harvestTier = Math.min(maxTier, Math.max(1, Math.ceil(zone.requiredLevel / 4)));

    const tierResources = profDef.tierResources[harvestTier] || profDef.tierResources[1] || [];
    if (tierResources.length === 0) continue;

    // Each tick: 1-2 resources, XP based on tier
    for (let t = 0; t < ticks; t++) {
      const resourceName = tierResources[Math.floor(Math.random() * tierResources.length)];
      const quantity = 1 + Math.floor(Math.random() * 2);
      const xpGained = Math.floor(harvestTier * 8 * (1 + profState.level * 0.01));

      addResource(inv, resourceName, harvestTier, quantity);
      gainProfessionXp(profs, 'gathering', dep.professionId, xpGained);
      dep.totalHarvested += quantity;
      totalResourcesGained += quantity;

      newEntries.push({
        timestamp: dep.lastTickAt + (t + 1) * HARVEST_INTERVAL_MS,
        heroName: hero.name,
        zoneName: zone.name,
        resourceName,
        quantity,
        xpGained,
      });
    }

    dep.lastTickAt = dep.lastTickAt + ticks * HARVEST_INTERVAL_MS;
  }

  // Prepend new entries to log, cap at MAX_LOG_ENTRIES
  state.harvestLog = [...newEntries.reverse(), ...state.harvestLog].slice(0, MAX_LOG_ENTRIES);

  // Auto-save
  saveIslandState(state);
  saveProfessions(profs);

  return { newEntries, totalResourcesGained };
}

// ── Helpers ────────────────────────────────────────────────────

export function getDeployedHeroIds(state: IslandHarvestState): Set<number> {
  return new Set(state.deployments.map(d => d.heroId));
}

export function getEstimatedYieldPerHour(profLevel: number, zoneTier: number): number {
  const harvestTier = Math.min(getTierForLevel(profLevel), Math.max(1, Math.ceil(zoneTier / 4)));
  // ~60 ticks per hour, 1.5 avg resources per tick
  return Math.floor(60 * 1.5 * (1 + profLevel * 0.01) * harvestTier * 0.5);
}

export function getAvailableHeroes(deployedIds: Set<number>): HeroData[] {
  return HEROES.filter(h => !deployedIds.has(h.id));
}

export function getDiscoveredZones(): ZoneDef[] {
  const progress = loadPlayerProgress();
  if (progress.zonesDiscovered.length === 0) {
    // Always allow Starting Village
    return [ISLAND_ZONES[0]];
  }
  return progress.zonesDiscovered.map(id => ISLAND_ZONES.find(z => z.id === id)).filter(Boolean) as ZoneDef[];
}

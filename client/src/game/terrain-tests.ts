/**
 * Runtime Terrain & Systems Validation Suite
 * Runs on game init (dev builds) to catch misconfigurations.
 * Each test returns { pass, msg } — failures are logged as warnings.
 */

import { WorldHeightmap } from './terrain-heightmap';
import { findPath } from './pathfinding';
import { SpawnerManager } from './spawner-system';
import { ZONE_EVENTS } from './zone-events';
import { BOAT_DOCKS } from './boats';
import { ISLAND_ZONES } from './zones';

// ── Types ──────────────────────────────────────────────────────

interface TestResult {
  name: string;
  pass: boolean;
  msg: string;
}

// ── Individual Tests ───────────────────────────────────────────

/** Verify heightmap has cell coverage for a zone */
function testHeightmapCoverage(hm: WorldHeightmap, zoneDef: typeof ISLAND_ZONES[0]): TestResult {
  const name = `heightmap-coverage:${zoneDef.name}`;
  const b = zoneDef.bounds;
  // Sample a few points inside zone to verify cells exist
  let found = 0;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const testPts = [
    { x: cx, y: cy },
    { x: b.x + 50, y: b.y + 50 },
    { x: b.x + b.w - 50, y: b.y + b.h - 50 },
  ];
  for (const p of testPts) {
    if (hm.getCell(p.x, p.y)) found++;
  }
  if (found >= 2) return { name, pass: true, msg: `${found}/${testPts.length} sample points have cells` };
  return { name, pass: false, msg: `Only ${found}/${testPts.length} sample points covered` };
}

/** Verify spawn point and NPC positions are walkable */
function testSpawnWalkability(hm: WorldHeightmap, zoneDef: typeof ISLAND_ZONES[0]): TestResult {
  const name = `spawn-walkable:${zoneDef.name}`;
  const issues: string[] = [];

  for (const sp of zoneDef.playerSpawns) {
    if (!hm.isWalkable(sp.x, sp.y, false)) {
      issues.push(`player-spawn(${sp.x},${sp.y})`);
    }
  }
  for (const npc of zoneDef.npcPositions) {
    if (!hm.isWalkable(npc.x, npc.y, false)) {
      issues.push(`npc(${npc.x},${npc.y})`);
    }
  }
  for (const p of zoneDef.portalPositions) {
    if (!hm.isWalkable(p.x, p.y, false)) {
      issues.push(`portal(${p.x},${p.y})`);
    }
  }

  if (issues.length === 0) return { name, pass: true, msg: 'All points walkable' };
  return { name, pass: false, msg: `Unwalkable: ${issues.join(', ')}` };
}

/** Verify pathfinding connectivity between zone spawn and portal */
function testPathConnectivity(hm: WorldHeightmap, zoneDef: typeof ISLAND_ZONES[0]): TestResult {
  const name = `path-connectivity:${zoneDef.name}`;
  const spawns = zoneDef.playerSpawns;
  const portals = zoneDef.portalPositions;
  if (spawns.length === 0 || portals.length === 0) {
    return { name, pass: true, msg: 'Skipped (no spawns or portals)' };
  }

  const issues: string[] = [];
  const sp = spawns[0];
  for (const p of portals) {
    const result = findPath(sp.x, sp.y, p.x, p.y, hm);
    if (!result.found) {
      issues.push(`spawn→portal(${p.x},${p.y})`);
    }
  }

  if (issues.length === 0) return { name, pass: true, msg: `${portals.length} portals reachable` };
  return { name, pass: false, msg: `Unreachable: ${issues.join(', ')}` };
}

/** Verify spawner positions are on walkable terrain */
function testSpawnerValidity(
  hm: WorldHeightmap,
  spawnerMgr: SpawnerManager,
  zoneId: number,
): TestResult {
  const name = `spawner-validity:zone${zoneId}`;
  const spawners = spawnerMgr.spawners.filter(s => s.def.zoneId === zoneId);
  const issues: string[] = [];

  for (const s of spawners) {
    if (!hm.isWalkable(s.def.x, s.def.y, false)) {
      issues.push(`spawner:${s.def.id}(${s.def.x},${s.def.y})`);
    }
  }

  if (spawners.length === 0) return { name, pass: true, msg: 'No spawners' };
  if (issues.length === 0) return { name, pass: true, msg: `${spawners.length} spawners valid` };
  return { name, pass: false, msg: `Invalid: ${issues.join(', ')}` };
}

/** Verify zone events have valid zone references and sane timing */
function testEventValidity(): TestResult {
  const name = 'event-validity';
  const issues: string[] = [];

  for (const e of ZONE_EVENTS) {
    if (e.duration <= 0) issues.push(`${e.id}:duration≤0`);
    if (e.cooldown < e.duration) issues.push(`${e.id}:cooldown<duration`);
    if (e.zoneIds.length === 0) issues.push(`${e.id}:no-zones`);
  }

  if (issues.length === 0) return { name, pass: true, msg: `${ZONE_EVENTS.length} events valid` };
  return { name, pass: false, msg: issues.join(', ') };
}

/** Verify boat docks are on walkable or near-water terrain */
function testBoatDockAccessibility(hm: WorldHeightmap): TestResult {
  const name = 'boat-dock-access';
  const issues: string[] = [];

  for (const dock of BOAT_DOCKS) {
    if (!hm.isWalkable(dock.x, dock.y, false) && !hm.isWater(dock.x, dock.y)) {
      issues.push(`dock:${dock.id}-not-accessible`);
    }
  }

  if (BOAT_DOCKS.length === 0) return { name, pass: true, msg: 'No docks generated' };
  if (issues.length === 0) return { name, pass: true, msg: `${BOAT_DOCKS.length} docks valid` };
  return { name, pass: false, msg: issues.join(', ') };
}

/** Verify zone connectivity via connectedZoneIds */
function testZoneConnectivity(): TestResult {
  const name = 'zone-connectivity';
  const issues: string[] = [];

  for (const z of ISLAND_ZONES) {
    for (const connId of z.connectedZoneIds) {
      const target = ISLAND_ZONES.find(tz => tz.id === connId);
      if (!target) {
        issues.push(`${z.name}→zone${connId}:missing`);
        continue;
      }
      if (!target.connectedZoneIds.includes(z.id)) {
        issues.push(`${z.name}↔${target.name}:one-way`);
      }
    }
  }

  if (issues.length === 0) return { name, pass: true, msg: `${ISLAND_ZONES.length} zones connected` };
  return { name, pass: false, msg: issues.join(', ') };
}

// ── Runner ─────────────────────────────────────────────────────

export interface ValidationReport {
  passed: number;
  failed: number;
  results: TestResult[];
}

/**
 * Run all validation tests. Call once during game init.
 * @param heightmap The world heightmap
 * @param spawnerMgr SpawnerManager instance
 */
export function runTerrainValidation(
  heightmap: WorldHeightmap,
  spawnerMgr: SpawnerManager,
): ValidationReport {
  const results: TestResult[] = [];

  // Per-zone tests
  for (const zone of ISLAND_ZONES) {
    results.push(testHeightmapCoverage(heightmap, zone));
    results.push(testSpawnWalkability(heightmap, zone));
    results.push(testPathConnectivity(heightmap, zone));
    results.push(testSpawnerValidity(heightmap, spawnerMgr, zone.id));
  }

  // Global tests
  results.push(testEventValidity());
  results.push(testZoneConnectivity());
  results.push(testBoatDockAccessibility(heightmap));

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  // Log results
  console.group(`🗺️ Terrain Validation: ${passed}/${results.length} passed`);
  for (const r of results) {
    if (r.pass) {
      console.log(`  ✓ ${r.name}: ${r.msg}`);
    } else {
      console.warn(`  ✗ ${r.name}: ${r.msg}`);
    }
  }
  console.groupEnd();

  return { passed, failed, results };
}

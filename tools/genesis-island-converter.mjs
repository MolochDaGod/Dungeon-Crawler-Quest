#!/usr/bin/env node
/**
 * Genesis Island Converter — Unity Scene → DCQ Zone Definition
 *
 * Reads the GRUDGE_SceneHierarchy.json exported from the Unity MOBILE scene
 * and converts it into a properly scaled DCQ zone definition (Zone 10).
 *
 * SCALE CALIBRATION:
 *   Unity wall segment = 14.3 units → DCQ wall = ~36 units
 *   → Horizontal scale: 2.5 DCQ units per Unity unit
 *
 *   Unity terrain height variation: ~80 units → DCQ max height: ~18
 *   → Vertical scale: 0.22 DCQ units per Unity unit
 *
 *   Unity 1 unit ≈ 1 meter (standard Unity convention)
 *   DCQ 1 unit ≈ 0.4 meters (derived from 2.5x scale)
 *
 * The island is centered in the 16000×16000 zone at (8000, 8000).
 * Ocean fills everything outside the island footprint.
 *
 * Usage: node tools/genesis-island-converter.mjs
 * Output: tools/genesis-zone-10.json (zone definition data)
 */

import { readFile, writeFile } from 'fs/promises';

// ── Scale Constants ────────────────────────────────────────────

/** DCQ units per Unity unit (horizontal: X and Z) */
const SCALE_XZ = 2.5;

/** DCQ units per Unity unit (vertical: Y) — compressed to fit DCQ height budget */
const SCALE_Y = 0.22;

/** DCQ zone size */
const ZONE_SIZE = 16000;
const ZONE_CENTER = ZONE_SIZE / 2; // 8000

/** Ocean base Y in DCQ (from babylon-ocean.ts) */
const OCEAN_Y = -0.3;

// ── Unity Scene Reference Points ───────────────────────────────
// These are measured from the scan:
//   X: -500 to 233.5   center = -133.3
//   Z: -500 to 188.8   center = -155.6
//   Y: -2901 (terrain base), surface at ~-2880 to -2820

const UNITY_CENTER_X = -133.3;
const UNITY_CENTER_Z = -155.6;
const UNITY_GROUND_BASE = -2901; // terrain mesh Y position
const UNITY_GROUND_SURFACE = -2880; // approximate average ground level

// ── Conversion Functions ───────────────────────────────────────

function unityToDcqX(ux) {
  return ZONE_CENTER + (ux - UNITY_CENTER_X) * SCALE_XZ;
}

function unityToDcqZ(uz) {
  // Unity Z → DCQ Y (2D top-down Y axis)
  return ZONE_CENTER + (uz - UNITY_CENTER_Z) * SCALE_XZ;
}

function unityToDcqY(uy) {
  // Unity Y → DCQ height (terrain elevation)
  return (uy - UNITY_GROUND_SURFACE) * SCALE_Y;
}

function unityToDcqPos(upos) {
  return {
    x: Math.round(unityToDcqX(upos.x)),
    y: Math.round(unityToDcqZ(upos.z)),  // Unity Z → DCQ Y (top-down)
    height: parseFloat(unityToDcqY(upos.y).toFixed(2)),
  };
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  const raw = await readFile('D:/GitHub/Crown/GRUDGE-NFT-Island/FRESH GRUDGE/Assets/GRUDGE_SceneHierarchy.json', 'utf-8');
  const scene = JSON.parse(raw);
  const gi = scene.rootObjects.find(o => o.name === 'genesis island');
  if (!gi) { console.error('genesis island not found'); return; }

  console.log('Converting Genesis Island to DCQ Zone 10...');
  console.log(`Scale: XZ=${SCALE_XZ}x, Y=${SCALE_Y}x`);
  console.log(`Zone center: (${ZONE_CENTER}, ${ZONE_CENTER})`);

  // ── Collect all positioned objects ────────────────────────
  function collectAll(obj, depth = 0, parent = null) {
    const items = [];
    if (obj.position && obj.position.y < -2700) { // filter to world objects
      items.push({
        name: obj.name,
        unityPos: obj.position,
        dcqPos: unityToDcqPos(obj.position),
        components: obj.components || [],
        childCount: obj.children ? obj.children.length : 0,
        depth,
        parent: parent?.name || null,
      });
    }
    if (obj.children) {
      for (const child of obj.children) {
        items.push(...collectAll(child, depth + 1, obj));
      }
    }
    return items;
  }

  const allObjects = collectAll(gi);
  console.log(`Total world objects: ${allObjects.length}`);

  // ── Categorize ───────────────────────────────────────────
  const monsterSpawns = [];
  const harvestables = [];
  const npcs = [];
  const structures = [];
  const terrain = [];
  const spawnerPoints = [];
  const playerSpawns = [];

  for (const obj of allObjects) {
    const n = obj.name.toLowerCase();
    const comps = obj.components.join(',').toLowerCase();
    const parentName = (obj.parent || '').toLowerCase();

    // Spawner children (parent is 'Monster Spawner', 'Harbor Spawner', etc.)
    if (parentName.includes('spawner')) {
      spawnerPoints.push(obj);
    } else if (comps.includes('monster') || comps.includes('networkidentity') && comps.includes('combat')) {
      if (comps.includes('npc')) {
        npcs.push(obj);
      } else {
        monsterSpawns.push(obj);
      }
    } else if (n.includes('harvest') || n.includes('imposter') || n.includes('hemp') || n.includes('metal') || n.includes('sulfer')) {
      harvestables.push(obj);
    } else if (n.includes('tree') || n.includes('log') || n.includes('bush') || n.includes('shrub') || n.includes('water') || n.includes('stone') || n.includes('rock')) {
      terrain.push(obj);
    } else if (n.includes('house') || n.includes('wall') || n.includes('gate') || n.includes('dock') || n.includes('camp') || n.includes('tower') || n.includes('stable') || n.includes('furnace') || n.includes('sawmill') || n.includes('anvil') || n.includes('refinery') || n.includes('tannery') || n.includes('arsenal')) {
      structures.push(obj);
    } else if (n.includes('start') && obj.depth === 1) {
      playerSpawns.push(obj);
    } else if (comps.includes('npc') || n.includes('vendor') || n.includes('dealer') || n.includes('trainer') || n.includes('blacksmith') || n.includes('commander') || n.includes('scout') || n.includes('watchman')) {
      npcs.push(obj);
    }
  }

  console.log(`\nCategorized:`);
  console.log(`  Monster spawns: ${monsterSpawns.length}`);
  console.log(`  Spawner points: ${spawnerPoints.length}`);
  console.log(`  Harvestables:   ${harvestables.length}`);
  console.log(`  NPCs:           ${npcs.length}`);
  console.log(`  Structures:     ${structures.length}`);
  console.log(`  Terrain props:  ${terrain.length}`);

  // ── Build Zone Definition ────────────────────────────────

  // Island bounds (centered, with actual footprint)
  const islandWidth = 734 * SCALE_XZ;   // ~1835
  const islandDepth = 689 * SCALE_XZ;   // ~1722
  const islandLeft = ZONE_CENTER - islandWidth / 2;
  const islandTop = ZONE_CENTER - islandDepth / 2;

  const zoneDef = {
    id: 10,
    name: 'Genesis Island',
    description: 'A small island accessible by boat. Guilds can claim and defend it as their own. The birthplace of the GRUDGE legacy.',
    bounds: { x: 0, y: 0, w: ZONE_SIZE, h: ZONE_SIZE },

    // Scale reference (for renderers and future imports)
    _scaleRef: {
      unityToXZ: SCALE_XZ,
      unityToY: SCALE_Y,
      unityCenterX: UNITY_CENTER_X,
      unityCenterZ: UNITY_CENTER_Z,
      unityGroundBase: UNITY_GROUND_BASE,
      unityGroundSurface: UNITY_GROUND_SURFACE,
      islandBounds: {
        x: Math.round(islandLeft),
        y: Math.round(islandTop),
        w: Math.round(islandWidth),
        h: Math.round(islandDepth),
      },
      note: '1 Unity unit ≈ 1 meter ≈ 2.5 DCQ units. Height compressed 0.22x. Island is ~1835×1722 DCQ units centered in 16000×16000 zone.',
    },

    requiredLevel: 5,
    isPvP: true,
    isSafeZone: false,
    terrainType: 'grass',
    ambientColor: '#4a7a3a',
    islandType: 'village',
    claimable: true,
    faction: null, // guild-owned

    // Player spawns (from START area)
    playerSpawns: [
      unityToDcqPos({ x: -380.52, y: -2862.59, z: 27.13 }), // START position
    ],

    // Convert monster spawns (from all 4 spawner groups)
    monsterSpawns: spawnerPoints.map(sp => {
      // Determine enemy type from parent spawner + child name
      const parent = (sp.parent || '').toLowerCase();
      let type = 'Bandit';
      let level = 5;
      if (parent.includes('harbor')) { type = 'Crab'; level = 3; }
      else if (parent.includes('mine')) { type = 'Spider'; level = 6; }
      else if (parent.includes('cave')) { type = 'Cave Hound'; level = 8; }
      else if (sp.name.includes('Fish')) { type = 'Crab'; level = 2; }
      return { x: sp.dcqPos.x, y: sp.dcqPos.y, type, level, respawnTime: 30, count: 1 };
    }),

    // NPC positions
    npcPositions: npcs.map(npc => ({
      x: npc.dcqPos.x,
      y: npc.dcqPos.y,
      name: npc.name,
    })),

    // Harvestable positions (for resource node generation)
    harvestablePositions: harvestables.map(h => ({
      x: h.dcqPos.x,
      y: h.dcqPos.y,
      type: h.name.includes('Tree') ? 'logging'
        : h.name.includes('Hemp') ? 'herbalism'
        : h.name.includes('Metal') || h.name.includes('Stone') ? 'mining'
        : h.name.includes('Fish') ? 'fishing'
        : 'scavenging',
      name: h.name,
    })),

    // Structure positions (buildings, walls, docks)
    structurePositions: structures.map(s => ({
      x: s.dcqPos.x,
      y: s.dcqPos.y,
      name: s.name,
      type: s.name.toLowerCase().includes('wall') ? 'wall'
        : s.name.toLowerCase().includes('dock') ? 'dock'
        : s.name.toLowerCase().includes('gate') ? 'gate'
        : s.name.toLowerCase().includes('camp') ? 'camp'
        : 'building',
    })),

    // Terrain decoration positions (trees, rocks, etc.)
    terrainDecorations: terrain.map(t => ({
      x: t.dcqPos.x,
      y: t.dcqPos.y,
      height: t.dcqPos.height,
      name: t.name,
      type: t.name.toLowerCase().includes('tree') ? 'tree'
        : t.name.toLowerCase().includes('water') ? 'water'
        : t.name.toLowerCase().includes('log') ? 'log'
        : t.name.toLowerCase().includes('stone') || t.name.toLowerCase().includes('rock') ? 'rock'
        : t.name.toLowerCase().includes('willow') ? 'willow'
        : 'prop',
    })),

    // Sub-zones derived from the Unity layout
    subZones: [
      { name: 'Harbor', bounds: { x: Math.round(unityToDcqX(-220)), y: Math.round(unityToDcqZ(-220)), w: 250, h: 250 }, terrainType: 'water', safe: true, description: 'Docked ships and fishing boats. Safe harbor for arriving players.' },
      { name: 'Mine', bounds: { x: Math.round(unityToDcqX(27)), y: Math.round(unityToDcqZ(-220)), w: 400, h: 200 }, terrainType: 'stone', safe: false, description: 'Rich ore deposits. Mining carts and crystal veins.' },
      { name: 'Cave Entrance', bounds: { x: Math.round(unityToDcqX(2)), y: Math.round(unityToDcqZ(-352)), w: 150, h: 150 }, terrainType: 'stone', safe: false, description: 'Dark cave entrance leading underground. Spiders lurk within.' },
      { name: 'Barbarian Camp', bounds: { x: Math.round(unityToDcqX(-381)), y: Math.round(unityToDcqZ(27)), w: 200, h: 200 }, terrainType: 'grass', safe: true, description: 'Fortified starting camp with palisade walls, armory, and stables.' },
      { name: 'PvP Arena Platform', bounds: { x: ZONE_CENTER - 500, y: 1000, w: 1000, h: 1000 }, terrainType: 'stone', safe: false, description: 'Elevated stone platform with tiered arenas for duels and crew battles.' },
    ],

    // Water (ocean surrounds the island)
    waterLanes: [
      // The entire zone is ocean except the island
      { type: 'lake', points: [
        { x: 0, y: 0 }, { x: ZONE_SIZE, y: 0 },
        { x: ZONE_SIZE, y: ZONE_SIZE }, { x: 0, y: ZONE_SIZE },
      ]},
    ],

    cliffWalls: [],

    dungeons: [
      {
        id: 'genesis-cave',
        name: 'Genesis Cave',
        x: Math.round(unityToDcqX(2)),
        y: Math.round(unityToDcqZ(-352)),
        requiredLevel: 5,
        description: 'Winding cave beneath the island. Spiders, bats, and hidden treasure.',
        difficulty: 'normal',
        icon: '🕸️',
        floors: 3,
      },
    ],

    exits: [],  // No walking exits — boat/portal only
    connectedZoneIds: [4], // Reachable from Pirate Bay by boat
    portalPositions: [
      { x: Math.round(unityToDcqX(-197)), y: Math.round(unityToDcqZ(-200)), targetZoneId: 4 },
    ],
  };

  // Write output
  await writeFile('tools/genesis-zone-10.json', JSON.stringify(zoneDef, null, 2));

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Zone definition written to: tools/genesis-zone-10.json`);
  console.log(`Island bounds in DCQ: ${Math.round(islandLeft)},${Math.round(islandTop)} → ${Math.round(islandLeft+islandWidth)},${Math.round(islandTop+islandDepth)}`);
  console.log(`Island size: ${Math.round(islandWidth)} × ${Math.round(islandDepth)} DCQ units`);
  console.log(`Monster spawns: ${zoneDef.monsterSpawns.length}`);
  console.log(`NPCs: ${zoneDef.npcPositions.length}`);
  console.log(`Harvestables: ${zoneDef.harvestablePositions.length}`);
  console.log(`Structures: ${zoneDef.structurePositions.length}`);
  console.log(`Terrain decorations: ${zoneDef.terrainDecorations.length}`);
}

main().catch(console.error);

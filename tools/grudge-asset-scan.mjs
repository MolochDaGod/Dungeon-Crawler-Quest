#!/usr/bin/env node
/**
 * GRUDGE Legacy Asset Scanner
 *
 * Scans the FRESH GRUDGE Unity project for all FBX/OBJ 3D models,
 * categorizes them by folder structure, and outputs a manifest JSON
 * for the batch conversion pipeline.
 *
 * Usage:  node tools/grudge-asset-scan.mjs
 * Output: tools/grudge-asset-manifest.json
 */

import { readdir, stat, writeFile } from 'fs/promises';
import { join, extname, basename, relative, sep } from 'path';

// ── Config ─────────────────────────────────────────────────────

const SOURCE_ROOT = 'D:\\GitHub\\Crown\\GRUDGE-NFT-Island\\FRESH GRUDGE\\Assets';
const OUTPUT_FILE = 'tools/grudge-asset-manifest.json';
const MODEL_EXTS = new Set(['.fbx', '.obj']);

// ── Category Rules ─────────────────────────────────────────────
// Match folder path segments to categories

const CATEGORY_RULES = [
  // Monsters & bosses
  { pattern: /Monster|Boss|Creature|Titan|Drake|Dragon|Demon|Golem|Spider|Skeleton|Bandit|Ogre|Yeti|Kraken|Minotaur|Cyclop|Troll|Scorpion|Raptor|Rhino|Crab|Wolf|Bear|bat_carb|Devil|Bulldog|EgyptMonster/i, category: 'monster' },
  // Mounts
  { pattern: /Mount|Horse|Ram|Saber|Drake Mount|Mecha|Vehicle|Air Ship|Boat|Catamaran|Sailboat|Glider|Siege Tower|Yolocopter/i, category: 'mount' },
  // Pets
  { pattern: /Pet[s]?\\/i, category: 'pet' },
  // NPCs
  { pattern: /NPC|Blacksmith|Commander|Scholar|Guardian|Alchemist|Dealer|Storage|Bounty|Traveler|Watchman|Scout/i, category: 'npc' },
  // Players / characters
  { pattern: /Player|Character|AllStar|Bambi|VillHelm|warrior\+|Enchanter|Brute Warrior|2 Handed Warrior|Cartoon Heroes/i, category: 'character' },
  // Weapons
  { pattern: /Weapon|Sword|Axe|Bow|Shield|Staff|Mace|Spear|Dagger|Blunt|Arrow|DKSword|Elven Weapon|Hammer/i, category: 'weapon' },
  // Harvestables
  { pattern: /Harvest|Hemp|Metal Ore|Stone|Sulfer|Crystal_Mine|Tree Imposter|fish\.prefab|mine\.prefab|Imposter/i, category: 'harvestable' },
  // VFX / Effects
  { pattern: /FX|Effect|Particle|Casting|Aura|Buff|Explosion|Projectile|Lightning|Smoke|Fire|Frost|Portal|Shrine/i, category: 'vfx' },
  // Animations (standalone anim files)
  { pattern: /Animation[s]?\\|RootAnims|@/i, category: 'animation' },
  // Buildings / structures
  { pattern: /House|Town|Village|Castle|Tower|Wall|Gate|Dungeon|Temple|Forge|Tavern|Windmill|Crypt|Cemeter|Ruins|Stronghold|Camp|Tent|Orc Hut|Barracks|Storage1/i, category: 'building' },
  // Environment / nature
  { pattern: /Tree|Bush|Fern|Grass|Rock|Stone|Flower|Mushroom|Foliage|Nature|Forest|Terrain|Mountain|Beach|coastal|Skull Platform/i, category: 'environment' },
  // Props
  { pattern: /Barrel|Bag|Box|Crate|Cart|Fence|Lantern|Banner|Flag|Chest|Candle|Table|Chair|Bed|Bottle|Food|Furniture/i, category: 'prop' },
];

function categorize(relPath) {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(relPath)) return rule.category;
  }
  return 'uncategorized';
}

// ── Scan ───────────────────────────────────────────────────────

async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip Unity meta folders and Library
      if (['Library', 'Temp', 'obj', 'Logs', 'node_modules', '.git'].includes(entry.name)) continue;
      yield* walkDir(full);
    } else {
      const ext = extname(entry.name).toLowerCase();
      if (MODEL_EXTS.has(ext)) {
        yield full;
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`Scanning: ${SOURCE_ROOT}`);
  
  const manifest = {
    sourceRoot: SOURCE_ROOT,
    scannedAt: new Date().toISOString(),
    totalFiles: 0,
    categories: {},
    files: [],
  };

  const categoryCounts = {};

  for await (const filePath of walkDir(SOURCE_ROOT)) {
    const relPath = relative(SOURCE_ROOT, filePath);
    const ext = extname(filePath).toLowerCase();
    const name = basename(filePath, extname(filePath));
    const category = categorize(relPath);

    // Generate a clean output name
    const cleanName = name
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();

    const outputPath = `grudge-legacy/${category}/${cleanName}.glb`;

    manifest.files.push({
      source: relPath,
      sourceFormat: ext.replace('.', ''),
      name,
      cleanName,
      category,
      outputPath,
      outputFormat: 'glb',
    });

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    manifest.totalFiles++;
  }

  manifest.categories = categoryCounts;

  // Write manifest
  await writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

  console.log(`\nScan complete!`);
  console.log(`Total models: ${manifest.totalFiles}`);
  console.log(`\nCategories:`);
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(16)} ${count}`);
  }
  console.log(`\nManifest written to: ${OUTPUT_FILE}`);
}

main().catch(console.error);

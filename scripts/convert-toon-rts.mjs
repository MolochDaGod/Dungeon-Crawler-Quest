#!/usr/bin/env node
/**
 * convert-toon-rts.mjs
 *
 * Batch-converts Toon_RTS FBX files → GLB for web rendering.
 *
 * Prerequisites:
 *   npm install -g fbx2gltf   (or place FBX2glTF.exe on PATH)
 *
 * Usage:
 *   node scripts/convert-toon-rts.mjs [--source <path>] [--out <path>] [--dry-run]
 *
 * Defaults:
 *   --source  C:/Users/jonbe/OneDrive/Desktop/GRUDGE-sourse/GRUDGE-NFT-Island-2026/source/Assets
 *   --out     D:/Games/Dungeon-Crawler-Quest/public/models/toon-rts
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';

// ── CLI args ────────────────────────────────────────────────────

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}
const dryRun = args.includes('--dry-run');

const SOURCE_ROOT = flag('source') ||
  'C:/Users/jonbe/OneDrive/Desktop/GRUDGE-sourse/GRUDGE-NFT-Island-2026/source/Assets';
const OUT_ROOT = flag('out') ||
  'D:/Games/Dungeon-Crawler-Quest/public/models/toon-rts';
const TOON_RTS = join(SOURCE_ROOT, 'Toon_RTS');

// ── Race folder → output key mapping ────────────────────────────

const RACE_MAP = {
  Barbarians: 'barbarians',
  Dwarves: 'dwarves',
  Elves: 'elves',
  Orcs: 'orcs',
  Undead: 'undead',
  WesternKingdoms: 'western_kingdoms',
};

// ── Collect all FBX files recursively ───────────────────────────

function collectFbx(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFbx(full, results);
    } else if (extname(entry).toLowerCase() === '.fbx') {
      results.push(full);
    }
  }
  return results;
}

// ── Convert one FBX → GLB ───────────────────────────────────────

function convertFile(fbxPath, glbPath) {
  const dir = dirname(glbPath);
  if (!dryRun) mkdirSync(dir, { recursive: true });

  // Try local D:\FBX2glTF.exe first, then global installs
  const cmds = [
    `"D:\\FBX2glTF.exe" --input "${fbxPath}" --output "${glbPath}" --binary`,
    `fbx2gltf -i "${fbxPath}" -o "${glbPath}" --binary`,
    `FBX2glTF --input "${fbxPath}" --output "${glbPath}" --binary`,
  ];

  for (const cmd of cmds) {
    try {
      if (dryRun) {
        console.log(`  [dry-run] ${cmd}`);
        return true;
      }
      execSync(cmd, { stdio: 'pipe', timeout: 60_000 });
      return true;
    } catch {
      // try next command
    }
  }
  return false;
}

// ── Main ────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════╗');
console.log('║  Toon_RTS FBX → GLB Batch Converter             ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`Source: ${TOON_RTS}`);
console.log(`Output: ${OUT_ROOT}`);
if (dryRun) console.log('MODE: DRY RUN (no files will be written)\n');

if (!existsSync(TOON_RTS)) {
  console.error(`ERROR: Source not found: ${TOON_RTS}`);
  process.exit(1);
}

let total = 0;
let converted = 0;
let skipped = 0;
let failed = 0;

for (const [folder, outKey] of Object.entries(RACE_MAP)) {
  const raceDir = join(TOON_RTS, folder);
  if (!existsSync(raceDir)) {
    console.warn(`⚠ Race folder missing: ${folder}`);
    continue;
  }

  console.log(`\n── ${folder} (→ ${outKey}) ──`);
  const fbxFiles = collectFbx(raceDir);
  console.log(`   Found ${fbxFiles.length} FBX files`);

  for (const fbxPath of fbxFiles) {
    total++;
    // Compute relative path from race dir
    const rel = fbxPath.slice(raceDir.length + 1).replace(/\\/g, '/');
    // Build output GLB path: keep folder structure, swap extension
    const glbRel = rel.replace(/\.fbx$/i, '.glb');
    const glbPath = join(OUT_ROOT, outKey, glbRel);

    // Skip .meta files that got through (shouldn't happen)
    if (rel.endsWith('.meta')) { skipped++; continue; }

    // Skip if already converted
    if (!dryRun && existsSync(glbPath)) {
      console.log(`   ✓ [exists] ${glbRel}`);
      skipped++;
      continue;
    }

    const ok = convertFile(fbxPath, glbPath);
    if (ok) {
      console.log(`   ✅ ${glbRel}`);
      converted++;
    } else {
      console.log(`   ❌ FAILED: ${glbRel}`);
      failed++;
    }
  }
}

console.log('\n════════════════════════════════════════════════════');
console.log(`Total: ${total} | Converted: ${converted} | Skipped: ${skipped} | Failed: ${failed}`);
console.log('════════════════════════════════════════════════════');

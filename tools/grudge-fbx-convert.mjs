#!/usr/bin/env node
/**
 * GRUDGE Legacy Asset Converter — FBX/OBJ → GLB
 *
 * Reads the manifest from grudge-asset-scan.mjs and batch converts
 * all models to GLB format for BabylonJS.
 *
 * Conversion methods (tried in order):
 *   1. fbx2gltf (Facebook's converter) — best for FBX with animations
 *   2. obj2gltf (npm) — for OBJ files
 *   3. gltf-pipeline (npm) — for post-processing (Draco compression)
 *
 * Usage:
 *   node tools/grudge-fbx-convert.mjs                    # convert all
 *   node tools/grudge-fbx-convert.mjs --category monster  # only monsters
 *   node tools/grudge-fbx-convert.mjs --limit 50          # first 50 only
 *   node tools/grudge-fbx-convert.mjs --dry-run            # preview only
 *
 * Prerequisites:
 *   npm install -D obj2gltf gltf-pipeline
 *   # For FBX: download fbx2gltf from https://github.com/godotengine/FBX2glTF/releases
 *   #   and place fbx2gltf.exe in PATH or tools/bin/
 */

import { readFile, mkdir, access, copyFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { execSync, exec } from 'child_process';
import { constants } from 'fs';

// ── Config ─────────────────────────────────────────────────────

const MANIFEST_PATH = 'tools/grudge-asset-manifest.json';
const OUTPUT_ROOT = 'public/assets/grudge-legacy';
const FBX2GLTF_PATHS = [
  'tools/bin/FBX2glTF.exe',
  'tools/bin/fbx2gltf.exe',
  'FBX2glTF',
  'fbx2gltf',
];

// ── Args ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const categoryFilter = args.includes('--category') ? args[args.indexOf('--category') + 1] : null;
const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity;

// ── Helpers ────────────────────────────────────────────────────

async function fileExists(path) {
  try { await access(path, constants.F_OK); return true; } catch { return false; }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function findFbx2gltf() {
  for (const p of FBX2GLTF_PATHS) {
    try {
      execSync(`"${p}" --help`, { stdio: 'ignore' });
      return p;
    } catch { /* not found */ }
  }
  return null;
}

// ── Converters ─────────────────────────────────────────────────

async function convertFbxWithFbx2gltf(sourcePath, outputPath, fbx2gltfPath) {
  const outBase = outputPath.replace(/\.glb$/, '');
  const cmd = `"${fbx2gltfPath}" -i "${sourcePath}" -o "${outBase}" --binary`;
  return new Promise((resolve) => {
    exec(cmd, { timeout: 60000 }, (err) => {
      resolve(!err);
    });
  });
}

async function convertObjWithObj2gltf(sourcePath, outputPath) {
  try {
    const { default: obj2gltf } = await import('obj2gltf');
    const glb = await obj2gltf(sourcePath, { binary: true });
    const { writeFile: wf } = await import('fs/promises');
    await wf(outputPath, glb);
    return true;
  } catch {
    return false;
  }
}

async function convertFbxFallback(sourcePath, outputPath) {
  // Fallback: just copy the FBX as-is (BabylonJS can load FBX via loaders)
  // This isn't ideal but ensures we don't block the pipeline
  const fallbackPath = outputPath.replace(/\.glb$/, '.fbx');
  try {
    await copyFile(sourcePath, fallbackPath);
    return 'copied-fbx';
  } catch {
    return false;
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  // Load manifest
  const manifestRaw = await readFile(MANIFEST_PATH, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  console.log(`Loaded manifest: ${manifest.totalFiles} files`);
  console.log(`Source root: ${manifest.sourceRoot}`);
  console.log(`Output root: ${OUTPUT_ROOT}`);
  if (categoryFilter) console.log(`Category filter: ${categoryFilter}`);
  if (dryRun) console.log(`DRY RUN — no files will be written`);

  // Find FBX converter
  const fbx2gltfPath = findFbx2gltf();
  if (fbx2gltfPath) {
    console.log(`FBX2glTF found: ${fbx2gltfPath}`);
  } else {
    console.log(`FBX2glTF not found — FBX files will be copied as-is (BabylonJS FBX loader fallback)`);
  }

  // Filter files
  let files = manifest.files;
  if (categoryFilter) {
    files = files.filter(f => f.category === categoryFilter);
  }
  files = files.slice(0, limitArg);

  console.log(`\nProcessing ${files.length} files...\n`);

  const stats = { converted: 0, skipped: 0, failed: 0, copiedFbx: 0 };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const sourcePath = join(manifest.sourceRoot, file.source);
    const outputPath = join(OUTPUT_ROOT, file.outputPath);
    const progress = `[${i + 1}/${files.length}]`;

    // Skip if already converted
    if (await fileExists(outputPath)) {
      stats.skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`${progress} ${file.category.padEnd(14)} ${file.cleanName} → ${file.outputPath}`);
      stats.converted++;
      continue;
    }

    // Ensure output directory
    await ensureDir(dirname(outputPath));

    // Convert based on format
    let success = false;

    if (file.sourceFormat === 'obj') {
      success = await convertObjWithObj2gltf(sourcePath, outputPath);
    } else if (file.sourceFormat === 'fbx') {
      if (fbx2gltfPath) {
        success = await convertFbxWithFbx2gltf(sourcePath, outputPath, fbx2gltfPath);
      }
      if (!success) {
        const fallback = await convertFbxFallback(sourcePath, outputPath);
        if (fallback === 'copied-fbx') {
          stats.copiedFbx++;
          if (i % 50 === 0) console.log(`${progress} copied-fbx   ${file.cleanName}`);
          continue;
        }
      }
    }

    if (success) {
      stats.converted++;
      if (i % 20 === 0) console.log(`${progress} converted    ${file.cleanName}`);
    } else {
      stats.failed++;
      if (stats.failed <= 20) console.log(`${progress} FAILED       ${file.cleanName} (${file.source})`);
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Conversion complete!`);
  console.log(`  Converted:  ${stats.converted}`);
  console.log(`  Skipped:    ${stats.skipped} (already exist)`);
  console.log(`  Copied FBX: ${stats.copiedFbx} (no GLB converter — BabylonJS FBX fallback)`);
  console.log(`  Failed:     ${stats.failed}`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * Upload Game Assets to ObjectStore R2
 *
 * Uploads all sprites, textures, and existing GLB models to
 * objectstore.grudge-studio.com with SHA256 dedup.
 *
 * Usage:
 *   node scripts/upload-assets.js --api-key=YOUR_KEY
 *   node scripts/upload-assets.js --api-key=YOUR_KEY --dry-run
 *
 * Categories:
 *   sprite-bear          — werebear sprite sheets
 *   sprite-environment   — island/gothic isometric sprites
 *   texture-island       — boat-island UV textures
 *   texture-dungeon      — shop 4K diffuse maps
 *   model-character      — existing hero GLB models
 *   model-weapon         — weapon GLB models
 *   model-environment    — environment GLB models
 *   model-creature       — creature GLB models
 *   model-ancient        — ancient voxel OBJ/VOX models
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORKER_URL = 'https://objectstore.grudge-studio.com';
const ROOT = path.resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const apiKey = args.find(a => a.startsWith('--api-key='))?.split('=')[1];
const dryRun = args.includes('--dry-run');

if (!apiKey && !dryRun) {
  console.error('Usage: node scripts/upload-assets.js --api-key=YOUR_KEY [--dry-run]');
  process.exit(1);
}

// ── Asset Manifest ─────────────────────────────────────────────

const ASSET_GROUPS = [
  // Bear sprite sheets
  ...fs.readdirSync(path.join(ROOT, 'public/assets/models/bears'))
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      localPath: `public/assets/models/bears/${f}`,
      category: 'sprite-bear',
      tags: [f.replace('.png', '').replace('werebear_', '')],
    })),

  // Island sprites
  ...safeReadDir('attached_assets/staging/island/Free Sample')
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      localPath: `attached_assets/staging/island/Free Sample/${f}`,
      category: 'sprite-environment-island',
      tags: [f.replace('.png', '')],
    })),

  // Gothic sprites
  ...safeReadDir('attached_assets/staging/enemyassets/FreeSample')
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      localPath: `attached_assets/staging/enemyassets/FreeSample/${f}`,
      category: 'sprite-environment-gothic',
      tags: [f.replace('.png', '')],
    })),

  // Boat-island textures (only textures, models are duplicates)
  ...safeReadDir('attached_assets/staging/boat-island/FreeSample/Textures')
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      localPath: `attached_assets/staging/boat-island/FreeSample/Textures/${f}`,
      category: 'texture-island',
      tags: [f.replace('.png', '')],
    })),

  // Shop textures (only textures, models are duplicates)
  ...safeReadDir('attached_assets/staging/shop/FreeSample/Textures/Diffuse')
    .filter(f => f.endsWith('.png'))
    .map(f => ({
      localPath: `attached_assets/staging/shop/FreeSample/Textures/Diffuse/${f}`,
      category: 'texture-dungeon',
      tags: [f.replace('.png', '')],
    })),

  // Ancient voxel models (OBJ + VOX)
  ...findFilesRecursive('attached_assets/staging', /^ancient-/, /\.(obj|vox)$/i)
    .map(f => ({
      localPath: f,
      category: f.includes('.vox') ? 'voxel-source' : 'model-ancient',
      tags: [path.basename(f).replace(/\.(obj|vox)$/i, ''), path.basename(path.dirname(path.dirname(f)))],
    })),

  // Existing GLB models in public/assets/models
  ...findFilesRecursive('public/assets/models', null, /\.glb$/i)
    .map(f => ({
      localPath: f,
      category: categorizeGlb(f),
      tags: [path.basename(f).replace('.glb', '')],
    })),

  // KayKit weapons (already glTF!)
  ...safeReadDir('attached_assets/staging/kaykit-weapons/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf')
    .filter(f => f.endsWith('.gltf'))
    .map(f => ({
      localPath: `attached_assets/staging/kaykit-weapons/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf/${f}`,
      category: 'model-weapon-kaykit',
      tags: [f.replace('.gltf', '')],
    })),

  // Voxel Weapons (FBX + VOX)
  ...safeReadDir('attached_assets/staging/voxel-weapons/Voxel Weapons')
    .filter(f => f.endsWith('.fbx') || f.endsWith('.vox'))
    .map(f => ({
      localPath: `attached_assets/staging/voxel-weapons/Voxel Weapons/${f}`,
      category: f.endsWith('.vox') ? 'voxel-source' : 'model-weapon-voxel',
      tags: [f.replace(/\.(fbx|vox)$/i, '')],
    })),

  // Bike mounts (OBJ)
  ...['bike-tracer', 'bike-cross', 'bike-scooter', 'bike-chopper', 'bike-gunbike']
    .flatMap(dir => safeReadDir(`attached_assets/staging/${dir}/Package`)
      .filter(f => f.endsWith('.obj'))
      .map(f => ({
        localPath: `attached_assets/staging/${dir}/Package/${f}`,
        category: 'model-mount-bike',
        tags: [dir.replace('bike-', ''), f.replace('.obj', '')],
      }))
    ),

  // Voxel RPG character palette texture
  {
    localPath: 'attached_assets/staging/voxel-rpg-characters/Content/Textures/DungeonCrawler_Character.png',
    category: 'texture-character-palette',
    tags: ['dungeon-crawler', 'palette', '256x1'],
  },
];

// ── Helpers ─────────────────────────────────────────────────────

function safeReadDir(relPath) {
  const full = path.join(ROOT, relPath);
  try { return fs.readdirSync(full); } catch { return []; }
}

function findFilesRecursive(relBase, dirFilter, fileFilter) {
  const results = [];
  const base = path.join(ROOT, relBase);
  try {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!dirFilter || dirFilter.test(entry.name)) {
          const subDir = path.join(relBase, entry.name);
          const subFull = path.join(ROOT, subDir);
          walkDir(subFull, subDir, fileFilter, results);
        }
      }
    }
  } catch {}
  return results;
}

function walkDir(fullDir, relDir, filter, results) {
  try {
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const fullPath = path.join(fullDir, entry.name);
      const relPath = path.join(relDir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath, relPath, filter, results);
      } else if (filter.test(entry.name)) {
        results.push(relPath);
      }
    }
  } catch {}
}

function categorizeGlb(filePath) {
  if (filePath.includes('characters')) return 'model-character';
  if (filePath.includes('weapons')) return 'model-weapon';
  if (filePath.includes('creatures')) return 'model-creature';
  if (filePath.includes('environment') || filePath.includes('structures') || filePath.includes('props')) return 'model-environment';
  if (filePath.includes('turrets') || filePath.includes('towers')) return 'model-tower';
  if (filePath.includes('dungeon')) return 'model-dungeon';
  return 'model-other';
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function uploadAsset(asset) {
  const fullPath = path.join(ROOT, asset.localPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP (missing): ${asset.localPath}`);
    return null;
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const hash = sha256(fileBuffer);
  const filename = path.basename(asset.localPath);
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
    '.fbx': 'application/octet-stream', '.obj': 'application/octet-stream',
    '.vox': 'application/octet-stream',
  };

  if (dryRun) {
    const sizeKB = (fileBuffer.length / 1024).toFixed(1);
    console.log(`  DRY: ${filename} (${sizeKB}KB) → ${asset.category} [${asset.tags.join(', ')}] sha256=${hash.slice(0, 12)}...`);
    return { filename, hash, category: asset.category };
  }

  try {
    const resp = await fetch(`${WORKER_URL}/v1/assets`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'X-Filename': filename,
        'X-Category': asset.category,
        'X-Tags': JSON.stringify(asset.tags),
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (resp.ok) {
      const data = await resp.json();
      console.log(`  OK: ${filename} → ${data.id} (${asset.category})`);
      return data;
    } else if (resp.status === 409) {
      console.log(`  DEDUP: ${filename} already exists`);
      return { filename, deduplicated: true };
    } else {
      const errText = await resp.text();
      console.log(`  FAIL (${resp.status}): ${filename} — ${errText}`);
      return null;
    }
  } catch (err) {
    console.log(`  ERROR: ${filename} — ${err.message}`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== ObjectStore Asset Upload ===`);
  console.log(`Worker: ${WORKER_URL}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPLOAD'}`);
  console.log(`Assets to process: ${ASSET_GROUPS.length}\n`);

  const manifest = {};
  let uploaded = 0, skipped = 0, failed = 0, deduped = 0;

  for (const asset of ASSET_GROUPS) {
    const result = await uploadAsset(asset);
    if (result) {
      if (result.deduplicated) deduped++;
      else uploaded++;
      manifest[asset.localPath] = result;
    } else {
      skipped++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Deduplicated: ${deduped}`);
  console.log(`Skipped/Missing: ${skipped}`);
  console.log(`Failed: ${failed}`);

  // Write manifest
  const manifestPath = path.join(ROOT, 'scripts', 'asset-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);
}

main().catch(console.error);

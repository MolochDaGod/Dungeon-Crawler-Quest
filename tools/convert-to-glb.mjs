#!/usr/bin/env node
/**
 * Asset Conversion Pipeline — converts 3D models to GLB for BabylonJS.
 *
 * Supported input formats:
 *   .obj → GLB via obj2gltf
 *   .gltf → GLB via gltf-pipeline
 *   .dae (COLLADA) → OBJ intermediate → GLB (basic geometry extraction)
 *   .fbx → loaded natively by BabylonJS (no conversion needed, but can optimize)
 *
 * Usage:
 *   node tools/convert-to-glb.mjs <input-file> [output-dir]
 *   node tools/convert-to-glb.mjs --batch <directory> [output-dir]
 *
 * Tools required (installed as devDependencies):
 *   npm install --save-dev obj2gltf gltf-pipeline
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, basename, extname, dirname } from "path";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
Asset Converter — 3D models to GLB for BabylonJS

Usage:
  node tools/convert-to-glb.mjs <input-file> [output-dir]
  node tools/convert-to-glb.mjs --batch <directory> [output-dir]

Supported formats:
  .obj  → GLB (via obj2gltf)
  .gltf → GLB (via gltf-pipeline)  
  .dae  → GLB (COLLADA geometry extraction)
  .fbx  → No conversion needed (BabylonJS loads FBX natively)

Install requirements:
  npm install --save-dev obj2gltf gltf-pipeline
`);
  process.exit(0);
}

// ── Convert single file ────────────────────────────────────────

function convertFile(inputPath, outputDir) {
  const ext = extname(inputPath).toLowerCase();
  const name = basename(inputPath, ext);
  const outDir = outputDir || dirname(inputPath);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const glbPath = join(outDir, `${name}.glb`);

  switch (ext) {
    case ".obj":
      console.log(`[OBJ→GLB] ${name}`);
      try {
        execSync(`npx obj2gltf -i "${inputPath}" -o "${glbPath}"`, { stdio: "pipe" });
        console.log(`  ✓ ${glbPath}`);
      } catch (e) {
        console.error(`  ✗ Failed: ${e.message}`);
      }
      break;

    case ".gltf":
      console.log(`[glTF→GLB] ${name}`);
      try {
        execSync(`npx gltf-pipeline -i "${inputPath}" -o "${glbPath}"`, { stdio: "pipe" });
        console.log(`  ✓ ${glbPath}`);
      } catch (e) {
        console.error(`  ✗ Failed: ${e.message}`);
      }
      break;

    case ".dae":
      console.log(`[DAE→GLB] ${name} (COLLADA)`);
      convertDAE(inputPath, glbPath);
      break;

    case ".fbx":
      console.log(`[FBX] ${name} — BabylonJS loads FBX natively, no conversion needed`);
      console.log(`  → Use SceneLoader.ImportMeshAsync("", "", "${inputPath}", scene)`);
      break;

    default:
      console.log(`[SKIP] ${name}${ext} — unsupported format`);
  }
}

// ── COLLADA (.dae) converter ───────────────────────────────────
// Extracts geometry from COLLADA XML and writes a minimal glTF/GLB.
// This handles simple meshes. For complex scenes with animations,
// use Blender or Assimp CLI.

function convertDAE(daePath, glbPath) {
  try {
    const xml = readFileSync(daePath, "utf8");

    // Extract float arrays from the COLLADA mesh
    const posMatch = xml.match(/<float_array[^>]*positions[^>]*count="(\d+)"[^>]*>([\s\S]*?)<\/float_array>/i);
    if (!posMatch) {
      // Try alternate naming
      const altMatch = xml.match(/<float_array[^>]*mesh-positions[^>]*count="(\d+)"[^>]*>([\s\S]*?)<\/float_array>/i);
      if (!altMatch) {
        console.error("  ✗ No position data found in DAE");
        return;
      }
    }

    // For proper conversion, write an intermediate OBJ then convert
    // Extract all mesh position data
    const floatArrays = [...xml.matchAll(/<float_array[^>]*id="([^"]*)"[^>]*count="(\d+)"[^>]*>([\s\S]*?)<\/float_array>/gi)];

    let positions = null;
    let normals = null;
    for (const match of floatArrays) {
      const id = match[1].toLowerCase();
      const nums = match[3].trim().split(/\s+/).map(Number);
      if (id.includes("position") || id.includes("mesh-positions")) positions = nums;
      if (id.includes("normal")) normals = nums;
    }

    if (!positions || positions.length < 3) {
      console.error("  ✗ No valid position data in DAE");
      return;
    }

    // Extract triangle indices
    const pMatch = xml.match(/<p>([\s\S]*?)<\/p>/i);
    const indices = pMatch ? pMatch[1].trim().split(/\s+/).map(Number) : null;

    // Write OBJ
    const objPath = glbPath.replace(/\.glb$/, ".obj");
    let obj = `# Converted from ${basename(daePath)}\n`;

    // Vertices (COLLADA Z-up → Y-up)
    for (let i = 0; i < positions.length; i += 3) {
      obj += `v ${positions[i]} ${positions[i + 2]} ${-positions[i + 1]}\n`;
    }

    // Normals
    if (normals) {
      for (let i = 0; i < normals.length; i += 3) {
        obj += `vn ${normals[i]} ${normals[i + 2]} ${-normals[i + 1]}\n`;
      }
    }

    // Faces — COLLADA indices can be interleaved (pos/normal/texcoord)
    if (indices) {
      const stride = normals ? 2 : 1; // pos + normal per vertex (simplified)
      obj += "g mesh\n";
      for (let i = 0; i + stride * 3 - 1 < indices.length; i += stride * 3) {
        if (normals) {
          const v1 = indices[i] + 1, n1 = indices[i + 1] + 1;
          const v2 = indices[i + 2] + 1, n2 = indices[i + 3] + 1;
          const v3 = indices[i + 4] + 1, n3 = indices[i + 5] + 1;
          obj += `f ${v1}//${n1} ${v2}//${n2} ${v3}//${n3}\n`;
        } else {
          const v1 = indices[i] + 1;
          const v2 = indices[i + 1] + 1;
          const v3 = indices[i + 2] + 1;
          obj += `f ${v1} ${v2} ${v3}\n`;
        }
      }
    } else {
      // No indices — assume sequential triangles
      obj += "g mesh\n";
      const vertCount = positions.length / 3;
      for (let i = 0; i + 2 < vertCount; i += 3) {
        obj += `f ${i + 1} ${i + 2} ${i + 3}\n`;
      }
    }

    writeFileSync(objPath, obj);
    console.log(`  → Intermediate OBJ: ${positions.length / 3} vertices`);

    // Convert OBJ → GLB
    try {
      execSync(`npx obj2gltf -i "${objPath}" -o "${glbPath}"`, { stdio: "pipe" });
      console.log(`  ✓ ${glbPath}`);
    } catch (e) {
      console.error(`  ✗ OBJ→GLB failed: ${e.message}`);
    }
  } catch (e) {
    console.error(`  ✗ DAE parse error: ${e.message}`);
  }
}

// ── Batch mode ─────────────────────────────────────────────────

function batchConvert(dir, outputDir) {
  const files = readdirSync(dir);
  let converted = 0;
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      batchConvert(fullPath, outputDir || fullPath);
      continue;
    }
    const ext = extname(file).toLowerCase();
    if ([".obj", ".gltf", ".dae"].includes(ext)) {
      convertFile(fullPath, outputDir);
      converted++;
    }
  }
  if (converted > 0) console.log(`\nConverted ${converted} files from ${dir}`);
}

// ── Main ───────────────────────────────────────────────────────

if (args[0] === "--batch") {
  const dir = args[1];
  const outDir = args[2] || null;
  if (!dir || !existsSync(dir)) {
    console.error("Directory not found:", dir);
    process.exit(1);
  }
  batchConvert(dir, outDir);
} else {
  const inputPath = args[0];
  const outputDir = args[1] || null;
  if (!existsSync(inputPath)) {
    console.error("File not found:", inputPath);
    process.exit(1);
  }
  convertFile(inputPath, outputDir);
}

#!/usr/bin/env node
/**
 * Pesca DAE → OBJ converter
 *
 * Handles multi-mesh COLLADA files with interleaved indices (VERTEX/NORMAL/TEXCOORD).
 * Converts Z-up (COLLADA) to Y-up (OBJ/BabylonJS).
 *
 * Usage:
 *   node tools/dae-to-obj-pesca.mjs
 */

import fs from 'fs';

const daePath  = 'D:/Dungeon-Crawler-Quest/Dungeon-Crawler-Quest/public/assets/props/pesca/Pesca/Pesca.dae';
const objPath  = 'D:/Dungeon-Crawler-Quest/Dungeon-Crawler-Quest/public/assets/props/pesca/Pesca/Pesca_fixed.obj';

const xml = fs.readFileSync(daePath, 'utf8');

// ── Diagnostics ────────────────────────────────────────────────
const triCount  = (xml.match(/<triangles /g)  || []).length;
const polyCount = (xml.match(/<polylist /g)   || []).length;
console.log('triangles elements:', triCount);
console.log('polylist elements:', polyCount);

// Extract input semantics → offsets
const inputMatches = [...xml.matchAll(/<input[^>]*semantic="([^"]*)"[^>]*offset="(\d+)"/gi)];
const offsets = {};
for (const m of inputMatches) {
  offsets[m[1]] = offsets[m[1]] || [];
  offsets[m[1]].push(parseInt(m[2]));
}
console.log('Input semantics:', offsets);

// ── Per-mesh extraction ────────────────────────────────────────
const meshBlocks = [...xml.matchAll(/<mesh>([\s\S]*?)<\/mesh>/gi)];

let objStr   = '';
let vOffset  = 0;
let vnOffset = 0;
let vtOffset = 0;

for (let gi = 0; gi < meshBlocks.length; gi++) {
  const block = meshBlocks[gi][1];

  // Collect float_array sources
  const floatArrays = [
    ...block.matchAll(/<float_array[^>]*id="([^"]*)"[^>]*count="(\d+)"[^>]*>([\s\S]*?)<\/float_array>/gi)
  ];

  let pos  = null;
  let norm = null;
  let uv   = null;

  for (const fa of floatArrays) {
    const id   = fa[1].toLowerCase();
    const nums = fa[3].trim().split(/\s+/).map(Number);
    if      (id.includes('position'))                                      pos  = nums;
    else if (id.includes('normal'))                                        norm = nums;
    else if (id.includes('map') || id.includes('uv') || id.includes('texcoord')) uv = nums;
  }

  if (!pos) continue;

  objStr += 'g mesh_' + gi + '\n';

  // Vertices — Z-up → Y-up
  for (let i = 0; i < pos.length; i += 3) {
    objStr += 'v ' + pos[i] + ' ' + pos[i + 2] + ' ' + (-pos[i + 1]) + '\n';
  }

  // Normals — Z-up → Y-up
  if (norm) {
    for (let i = 0; i < norm.length; i += 3) {
      objStr += 'vn ' + norm[i] + ' ' + norm[i + 2] + ' ' + (-norm[i + 1]) + '\n';
    }
  }

  // UVs
  if (uv) {
    for (let i = 0; i < uv.length; i += 2) {
      objStr += 'vt ' + uv[i] + ' ' + uv[i + 1] + '\n';
    }
  }

  // Faces — stride 3 = VERTEX / NORMAL / TEXCOORD per vertex
  const pMatch = block.match(/<p>([\s\S]*?)<\/p>/);
  if (pMatch) {
    const idx    = pMatch[1].trim().split(/\s+/).map(Number);
    const stride = 3; // one index per semantic input

    for (let i = 0; i + stride * 3 - 1 < idx.length; i += stride * 3) {
      const v1 = idx[i]     + 1 + vOffset,  n1 = idx[i + 1] + 1 + vnOffset, t1 = idx[i + 2] + 1 + vtOffset;
      const v2 = idx[i + 3] + 1 + vOffset,  n2 = idx[i + 4] + 1 + vnOffset, t2 = idx[i + 5] + 1 + vtOffset;
      const v3 = idx[i + 6] + 1 + vOffset,  n3 = idx[i + 7] + 1 + vnOffset, t3 = idx[i + 8] + 1 + vtOffset;
      objStr += 'f ' + v1 + '/' + t1 + '/' + n1 + ' ' + v2 + '/' + t2 + '/' + n2 + ' ' + v3 + '/' + t3 + '/' + n3 + '\n';
    }
  }

  vOffset  += pos.length  / 3;
  vnOffset += norm ? norm.length / 3 : 0;
  vtOffset += uv   ? uv.length   / 2 : 0;
}

// ── Write output ───────────────────────────────────────────────
fs.writeFileSync(objPath, objStr);
console.log('OBJ written:', vOffset, 'verts,', vnOffset, 'normals,', vtOffset, 'UVs');

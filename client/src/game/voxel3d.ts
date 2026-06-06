/**
 * voxel3d.ts — Three.js Voxel Character Builder
 *
 * Ports the 2D voxel-parts.ts rig to 3D InstancedMesh characters.
 * Each body part is a group of tiny cube voxels attached to pivot joints,
 * producing the same race/class look from the 2D renderer but in full 3D.
 *
 * Usage:
 *   const rig = buildVoxel3DCharacter('Human', 'Warrior');
 *   scene.add(rig.group);
 *   // animate:
 *   rig.setPose({ ... });
 *   rig.update(dt);
 */

import * as THREE from 'three';
import { getRigColors, type RigColors } from './voxel-parts';

// ── Constants ──────────────────────────────────────────────────

/** Size of each individual voxel cube in world units */
const VOXEL_SIZE = 0.06;
/** Small gap between voxels for that blocky grid look */
const VOXEL_GAP = 0.005;
const FULL = VOXEL_SIZE + VOXEL_GAP;

// ── VM (Voxel Model) helpers — mirrors voxel-parts.ts exactly ──

type VM = (string | null)[][][];

function emptyVM(w: number, d: number, h: number): VM {
  return Array.from({ length: h }, () =>
    Array.from({ length: d }, () => Array(w).fill(null) as (string | null)[]),
  );
}

function sv(m: VM, z: number, y: number, x: number, c: string) {
  if (z >= 0 && z < m.length && y >= 0 && y < (m[0]?.length ?? 0) && x >= 0 && x < (m[0]?.[0]?.length ?? 0))
    m[z][y][x] = c;
}

function fill(m: VM, z0: number, z1: number, y0: number, y1: number, x0: number, x1: number, c: string) {
  for (let z = z0; z <= z1; z++)
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) sv(m, z, y, x, c);
}

function shade(hex: string, f: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => cl(v * f).toString(16).padStart(2, '0')).join('');
}

function blend(a: string, b: string, t: number): string {
  const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
  const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [cl(ra + (rb - ra) * t), cl(ga + (gb - ga) * t), cl(ba + (bb - ba) * t)]
    .map(v => v.toString(16).padStart(2, '0')).join('');
}

// ── Part builders (identical logic to voxel-parts.ts) ──────────

function buildHead(c: RigColors, race: string): VM {
  const m = emptyVM(6, 4, 7); const sk = c.skin;
  fill(m, 1, 5, 1, 3, 0, 5, sk);
  fill(m, 5, 6, 1, 3, 1, 4, c.hair);
  sv(m, 5, 1, 0, c.hair); sv(m, 5, 1, 5, c.hair);
  sv(m, 4, 1, 1, c.eye); sv(m, 4, 1, 4, c.eye);
  sv(m, 4, 1, 2, shade(c.eye, 1.4)); sv(m, 4, 1, 3, shade(c.eye, 1.4));
  sv(m, 3, 1, 2, shade(sk, 0.84)); sv(m, 3, 1, 3, shade(sk, 0.84));
  sv(m, 2, 1, 2, shade(sk, 0.76)); sv(m, 2, 1, 3, shade(sk, 0.76));
  fill(m, 0, 1, 1, 3, 1, 4, shade(sk, 0.9));
  if (race === 'Elf') { sv(m, 5, 0, 0, sk); sv(m, 5, 0, 5, sk); sv(m, 4, 0, 0, sk); sv(m, 4, 0, 5, sk); }
  if (race === 'Orc') { fill(m, 0, 1, 1, 3, 0, 5, shade(sk, 0.88)); sv(m, 0, 1, 2, '#fffde8'); sv(m, 0, 1, 3, '#fffde8'); }
  if (race === 'Undead') { sv(m, 4, 1, 1, '#ff4444'); sv(m, 4, 1, 4, '#ff4444'); sv(m, 3, 1, 2, '#222'); sv(m, 3, 1, 3, '#222'); }
  if (race === 'Dwarf') { fill(m, 0, 2, 1, 2, 1, 4, shade(c.hair, 1.1)); sv(m, 0, 2, 0, c.hair); sv(m, 0, 2, 5, c.hair); }
  return m;
}

function buildTorso(c: RigColors, heroClass: string): VM {
  const m = emptyVM(8, 4, 9); const p = c.armorPrimary, s = c.armorSecondary;
  fill(m, 0, 1, 1, 3, 1, 6, shade(p, 0.8));
  fill(m, 2, 3, 1, 3, 1, 6, p);
  fill(m, 2, 2, 1, 3, 1, 6, shade(s, 0.88));
  fill(m, 4, 5, 1, 3, 1, 6, shade(s, 0.92));
  fill(m, 6, 8, 1, 3, 0, 7, p);
  fill(m, 7, 8, 1, 2, 2, 5, shade(s, 1.1));
  fill(m, 8, 8, 1, 3, 0, 7, shade(s, 1.18));
  if (heroClass === 'Warrior') { sv(m, 8, 1, 0, '#666'); sv(m, 8, 3, 0, '#555'); sv(m, 8, 1, 7, '#666'); sv(m, 8, 3, 7, '#555'); fill(m, 7, 8, 1, 2, 3, 4, shade(s, 1.3)); }
  if (heroClass === 'Mage') { fill(m, 3, 5, 1, 3, 2, 5, shade(s, 1.2)); fill(m, 6, 8, 1, 2, 2, 5, blend(p, '#9333ea', 0.38)); }
  if (heroClass === 'Ranger') { fill(m, 8, 8, 1, 2, 1, 6, shade(p, 0.78)); sv(m, 8, 1, 0, '#5a3a1a'); sv(m, 8, 1, 7, '#5a3a1a'); }
  if (heroClass === 'Worg') { fill(m, 7, 8, 1, 3, 0, 7, blend(p, '#4a2a12', 0.3)); }
  return m;
}

function buildUpperArm(c: RigColors, heroClass: string): VM {
  const m = emptyVM(8, 3, 3); const s = c.armorSecondary;
  fill(m, 0, 2, 0, 2, 0, 0, shade(s, 1.18));
  fill(m, 0, 2, 0, 2, 1, 6, s);
  fill(m, 0, 2, 0, 2, 7, 7, blend(s, c.skin, 0.42));
  if (heroClass === 'Warrior') fill(m, 0, 2, 0, 2, 2, 3, shade(s, 0.78));
  if (heroClass === 'Mage') fill(m, 0, 2, 0, 2, 4, 5, blend(s, '#9333ea', 0.42));
  return m;
}

function buildForearm(c: RigColors): VM {
  const m = emptyVM(7, 2, 2); const s = c.armorSecondary, sk = c.skin;
  fill(m, 0, 1, 0, 1, 0, 0, shade(s, 0.88));
  fill(m, 0, 1, 0, 1, 1, 4, s);
  fill(m, 0, 1, 0, 1, 5, 5, blend(s, sk, 0.45));
  fill(m, 0, 1, 0, 1, 6, 6, sk);
  return m;
}

function buildThigh(c: RigColors): VM {
  const m = emptyVM(3, 3, 7); const p = c.armorPrimary;
  fill(m, 5, 6, 0, 2, 0, 2, shade(p, 0.88));
  fill(m, 2, 4, 0, 2, 0, 2, p);
  fill(m, 0, 1, 0, 2, 0, 1, shade(p, 0.95));
  return m;
}

function buildShin(c: RigColors): VM {
  const m = emptyVM(3, 3, 8); const p = c.armorPrimary, b = c.boot;
  fill(m, 6, 7, 0, 2, 0, 1, shade(p, 0.85));
  fill(m, 3, 5, 0, 2, 0, 1, p);
  fill(m, 2, 2, 0, 2, 0, 2, shade(b, 1.15));
  fill(m, 0, 1, 0, 2, 0, 2, b);
  sv(m, 1, 0, 2, shade(b, 1.2)); sv(m, 0, 0, 2, shade(b, 1.1));
  return m;
}

// ── VM → InstancedMesh converter ───────────────────────────────

const _voxelGeo = new THREE.BoxGeometry(VOXEL_SIZE * 0.95, VOXEL_SIZE * 0.95, VOXEL_SIZE * 0.95);

/** Color cache to avoid creating duplicate materials */
const _matCache = new Map<string, THREE.MeshStandardMaterial>();

function getMat(hex: string): THREE.MeshStandardMaterial {
  let m = _matCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.6, metalness: 0.2 });
    _matCache.set(hex, m);
  }
  return m;
}

/**
 * Converts a VM (z=height, y=depth, x=width) into a THREE.Group of individual
 * voxel Meshes. Grouped by color into InstancedMeshes for performance.
 *
 * The model is centered on X/Y and Z=0 is bottom.
 */
function vmToGroup(vm: VM, pivotZ: 'bottom' | 'top' | 'center' = 'bottom'): THREE.Group {
  const h = vm.length;
  const d = vm[0]?.length ?? 0;
  const w = vm[0]?.[0]?.length ?? 0;

  // Collect voxels by color
  const colorMap = new Map<string, THREE.Vector3[]>();
  for (let z = 0; z < h; z++) {
    for (let y = 0; y < d; y++) {
      for (let x = 0; x < w; x++) {
        const c = vm[z][y][x];
        if (!c) continue;
        let arr = colorMap.get(c);
        if (!arr) { arr = []; colorMap.set(c, arr); }
        // Center X/Y, Z from bottom
        const px = (x - w / 2 + 0.5) * FULL;
        const py = (y - d / 2 + 0.5) * FULL;
        let pz = z * FULL;
        if (pivotZ === 'top') pz = (z - h) * FULL;
        else if (pivotZ === 'center') pz = (z - h / 2 + 0.5) * FULL;
        arr.push(new THREE.Vector3(px, pz, py)); // Y-up in Three.js
      }
    }
  }

  const group = new THREE.Group();
  const dummy = new THREE.Object3D();

  for (const [hex, positions] of colorMap) {
    const im = new THREE.InstancedMesh(_voxelGeo, getMat(hex), positions.length);
    im.castShadow = true;
    im.receiveShadow = true;
    for (let i = 0; i < positions.length; i++) {
      dummy.position.copy(positions[i]);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
    }
    group.add(im);
  }

  return group;
}

// ── Rig Types ──────────────────────────────────────────────────

export interface Voxel3DPose {
  torsoRotX?: number;
  torsoRotY?: number;
  headRotX?: number;
  lShoulderRotX?: number;
  lShoulderRotZ?: number;
  lElbowRotX?: number;
  rShoulderRotX?: number;
  rShoulderRotZ?: number;
  rElbowRotX?: number;
  lHipRotX?: number;
  lKneeRotX?: number;
  rHipRotX?: number;
  rKneeRotX?: number;
  torsoY?: number; // bounce offset
}

export interface Voxel3DRig {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  lShoulder: THREE.Object3D;
  rShoulder: THREE.Object3D;
  lUpperArm: THREE.Group;
  lForearm: THREE.Group;
  rUpperArm: THREE.Group;
  rForearm: THREE.Group;
  lHip: THREE.Object3D;
  rHip: THREE.Object3D;
  lThigh: THREE.Group;
  lShin: THREE.Group;
  rThigh: THREE.Group;
  rShin: THREE.Group;
  /** Shadow decal on ground */
  shadow: THREE.Mesh;
  /** Race and class this rig was built for */
  race: string;
  heroClass: string;
  /** Apply a pose to all joints */
  setPose: (pose: Voxel3DPose) => void;
  /** Animate idle breathing + pose interpolation */
  update: (dt: number) => void;
}

// ── Scale factors to convert voxel grid units to world units ───

const HEAD_SCALE = 1.0;
const TORSO_SCALE = 1.0;
const ARM_SCALE = 0.9;
const LEG_SCALE = 0.9;

// Torso center height (torso is 9 voxels tall, centered)
const TORSO_H = 9 * FULL * TORSO_SCALE;
const HEAD_H = 7 * FULL * HEAD_SCALE;
const UARM_LEN = 8 * FULL * ARM_SCALE;
const FARM_LEN = 7 * FULL * ARM_SCALE;
const THIGH_LEN = 7 * FULL * LEG_SCALE;
const SHIN_LEN = 8 * FULL * LEG_SCALE;

// ── Builder ────────────────────────────────────────────────────

export function buildVoxel3DCharacter(race: string, heroClass: string): Voxel3DRig {
  const c = getRigColors(race, heroClass);

  // Build each body part VM and convert to 3D groups
  const headMesh = vmToGroup(buildHead(c, race), 'bottom');
  headMesh.scale.setScalar(HEAD_SCALE);

  const torsoMesh = vmToGroup(buildTorso(c, heroClass), 'center');
  torsoMesh.scale.setScalar(TORSO_SCALE);

  const lUpperArmMesh = vmToGroup(buildUpperArm(c, heroClass), 'bottom');
  lUpperArmMesh.scale.set(-ARM_SCALE, ARM_SCALE, ARM_SCALE); // mirror for left
  const lForearmMesh = vmToGroup(buildForearm(c), 'bottom');
  lForearmMesh.scale.set(-ARM_SCALE, ARM_SCALE, ARM_SCALE);

  const rUpperArmMesh = vmToGroup(buildUpperArm(c, heroClass), 'bottom');
  rUpperArmMesh.scale.setScalar(ARM_SCALE);
  const rForearmMesh = vmToGroup(buildForearm(c), 'bottom');
  rForearmMesh.scale.setScalar(ARM_SCALE);

  const lThighMesh = vmToGroup(buildThigh(c), 'top');
  lThighMesh.scale.setScalar(LEG_SCALE);
  const lShinMesh = vmToGroup(buildShin(c), 'top');
  lShinMesh.scale.setScalar(LEG_SCALE);

  const rThighMesh = vmToGroup(buildThigh(c), 'top');
  rThighMesh.scale.setScalar(LEG_SCALE);
  const rShinMesh = vmToGroup(buildShin(c), 'top');
  rShinMesh.scale.setScalar(LEG_SCALE);

  // ── Assemble hierarchy ─────────────────────────────────

  // Root group — positioned in world space
  const group = new THREE.Group();

  // Torso pivot (center of body)
  const torso = new THREE.Group();
  torso.position.y = THIGH_LEN + SHIN_LEN + TORSO_H * 0.3; // Stand on legs
  torso.add(torsoMesh);
  group.add(torso);

  // Head pivot (top of torso)
  const head = new THREE.Group();
  head.position.y = TORSO_H * 0.5;
  head.add(headMesh);
  torso.add(head);

  // Shoulder pivots (top-sides of torso)
  const lShoulder = new THREE.Object3D();
  lShoulder.position.set(-(4 * FULL * TORSO_SCALE), TORSO_H * 0.4, 0);
  torso.add(lShoulder);

  const rShoulder = new THREE.Object3D();
  rShoulder.position.set(4 * FULL * TORSO_SCALE, TORSO_H * 0.4, 0);
  torso.add(rShoulder);

  // Upper arms pivot at shoulder, hang down
  const lUpperArm = new THREE.Group();
  lUpperArm.add(lUpperArmMesh);
  lShoulder.add(lUpperArm);

  const rUpperArm = new THREE.Group();
  rUpperArm.add(rUpperArmMesh);
  rShoulder.add(rUpperArm);

  // Forearms pivot at elbow
  const lForearm = new THREE.Group();
  lForearm.position.y = -UARM_LEN;
  lForearm.add(lForearmMesh);
  lUpperArm.add(lForearm);

  const rForearm = new THREE.Group();
  rForearm.position.y = -UARM_LEN;
  rForearm.add(rForearmMesh);
  rUpperArm.add(rForearm);

  // Hip pivots (bottom of torso)
  const lHip = new THREE.Object3D();
  lHip.position.set(-(1.5 * FULL * TORSO_SCALE), -TORSO_H * 0.45, 0);
  torso.add(lHip);

  const rHip = new THREE.Object3D();
  rHip.position.set(1.5 * FULL * TORSO_SCALE, -TORSO_H * 0.45, 0);
  torso.add(rHip);

  // Thighs pivot at hip
  const lThigh = new THREE.Group();
  lThigh.add(lThighMesh);
  lHip.add(lThigh);

  const rThigh = new THREE.Group();
  rThigh.add(rThighMesh);
  rHip.add(rThigh);

  // Shins pivot at knee
  const lShin = new THREE.Group();
  lShin.position.y = -THIGH_LEN;
  lShin.add(lShinMesh);
  lThigh.add(lShin);

  const rShin = new THREE.Group();
  rShin.position.y = -THIGH_LEN;
  rShin.add(rShinMesh);
  rThigh.add(rShin);

  // Shadow decal
  const shadowGeo = new THREE.CircleGeometry(0.25, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.01;
  group.add(shadow);

  // ── Pose + update ──────────────────────────────────────

  const baseY = torso.position.y;
  let time = 0;
  let currentPose: Voxel3DPose = {};

  const setPose = (pose: Voxel3DPose) => { currentPose = pose; };

  const update = (dt: number) => {
    time += dt;
    const p = currentPose;

    // Idle breathing
    const breath = Math.sin(time * 2.5) * 0.003;
    torso.position.y = baseY + (p.torsoY ?? 0) + breath;

    torso.rotation.x = p.torsoRotX ?? 0;
    torso.rotation.y = p.torsoRotY ?? 0;
    head.rotation.x = p.headRotX ?? 0;

    lShoulder.rotation.x = p.lShoulderRotX ?? 0;
    lShoulder.rotation.z = p.lShoulderRotZ ?? 0;
    lForearm.rotation.x = p.lElbowRotX ?? 0;

    rShoulder.rotation.x = p.rShoulderRotX ?? 0;
    rShoulder.rotation.z = p.rShoulderRotZ ?? 0;
    rForearm.rotation.x = p.rElbowRotX ?? 0;

    lHip.rotation.x = p.lHipRotX ?? 0;
    lShin.rotation.x = p.lKneeRotX ?? 0;

    rHip.rotation.x = p.rHipRotX ?? 0;
    rShin.rotation.x = p.rKneeRotX ?? 0;
  };

  return {
    group, torso, head,
    lShoulder, rShoulder,
    lUpperArm, lForearm,
    rUpperArm, rForearm,
    lHip, rHip,
    lThigh, lShin,
    rThigh, rShin,
    shadow,
    race, heroClass,
    setPose, update,
  };
}

// ── Preset Poses ───────────────────────────────────────────────

export function idlePose(t: number): Voxel3DPose {
  const s = Math.sin(t * 2.5);
  return {
    torsoY: Math.abs(s) * 0.005,
    lShoulderRotX: -0.3,
    lShoulderRotZ: 0.4,
    lElbowRotX: -1.2,
    rShoulderRotX: -0.5,
    rShoulderRotZ: -0.4,
    rElbowRotX: -1.5,
    lHipRotX: -0.15,
    rHipRotX: 0.15,
  };
}

export function walkPose(t: number, speed: number = 1): Voxel3DPose {
  const s = Math.sin(t * 8 * speed);
  return {
    torsoY: Math.abs(s) * 0.008,
    lShoulderRotX: -s * 0.4,
    rShoulderRotX: s * 0.4,
    lHipRotX: s * 0.6,
    lKneeRotX: s > 0 ? s * 0.4 : 0,
    rHipRotX: -s * 0.6,
    rKneeRotX: -s > 0 ? -s * 0.4 : 0,
  };
}

export function punchPose(progress: number): Voxel3DPose {
  const ext = Math.sin(progress * Math.PI);
  return {
    torsoRotY: -0.3 * ext,
    rShoulderRotX: -1.5 * ext,
    rElbowRotX: -0.2,
  };
}

export function kickPose(progress: number): Voxel3DPose {
  const ext = Math.sin(progress * Math.PI);
  return {
    rHipRotX: -1.3 * ext,
    rKneeRotX: 0.4 * ext,
  };
}

export function blockPose(): Voxel3DPose {
  return {
    lShoulderRotX: -1.5,
    lElbowRotX: -2.2,
    rShoulderRotX: -1.5,
    rElbowRotX: -2.2,
    headRotX: 0.3,
  };
}

export function hitPose(): Voxel3DPose {
  return {
    torsoRotX: -0.4,
    headRotX: -0.3,
  };
}

export function grabPose(progress: number): Voxel3DPose {
  const ext = Math.sin(progress * Math.PI);
  return {
    lShoulderRotZ: 1.2 * ext,
    rShoulderRotZ: -1.2 * ext,
    lShoulderRotX: -1.2,
    rShoulderRotX: -1.2,
  };
}

export function dropkickPose(progress: number): Voxel3DPose {
  const jump = 4 * progress * (1 - progress);
  const ext = Math.sin(progress * Math.PI);
  return {
    torsoY: jump * 0.15,
    torsoRotX: -0.5 * ext,
    lHipRotX: -1.3 * ext,
    rHipRotX: -1.3 * ext,
    lShoulderRotZ: 1.5 * ext,
    rShoulderRotZ: -1.5 * ext,
  };
}

/**
 * sandbox-physics.ts — Sandbox Physics Engine
 *
 * Extends Cannon-ES with sandbox capabilities:
 * - Tool system (23 tools from the reference sandbox)
 * - Constraint manager (weld, rope, hinge, motor)
 * - Compound prop factory (furniture, barriers, etc.)
 * - Vehicle system (RaycastVehicle)
 * - Ragdoll creator (voxel body + physics joints)
 * - Scripting system (per-object movement commands)
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { generateGrudgeUUID, registerUUID } from '@/lib/grudge-uuid';
import { saveWorld as saveWorldToR2, loadWorld as loadWorldFromR2, type WorldSaveData } from '@/lib/grudge-objectstore';

// ── Tool Definitions ───────────────────────────────────────────

export enum SandboxTool {
  Hand = 1,
  Pistol = 2,
  RPG = 3,
  C4 = 4,
  Turret = 5,
  Bat = 6,
  Car = 7,
  Void = 8,
  Build = 9,
  PhysGun = 10,
  ZeroG = 11,
  Balloon = 12,
  Thruster = 13,
  Freeze = 14,
  Align = 15,
  Script = 16,
  Paint = 17,
  Weld = 18,
  Rope = 19,
  Hinge = 20,
  Motor = 21,
  Button = 22,
  Wire = 23,
}

// ── Physics Object ─────────────────────────────────────────────

export interface SandboxObject {
  mesh: THREE.Object3D;
  body: CANNON.Body;
  type: string;
  name?: string;
  age?: number;
  isFrozen?: boolean;
  script?: ScriptCommand[];
  scriptState?: { index: number; timer: number };
  logicId?: string;
}

export interface ScriptCommand {
  type: 'move' | 'spin' | 'wait';
  dir?: { x: number; y: number; z: number };
  time: number;
  label: string;
}

// ── Constraint Visual ──────────────────────────────────────────

export interface VisualConstraint {
  type: 'rope' | 'weld';
  constraint: CANNON.Constraint;
  line: THREE.Line;
  bodyA: CANNON.Body;
  bodyB: CANNON.Body;
}

// ── Compound Prop Definition ───────────────────────────────────

export interface PropPartDef {
  /** size [w, h, d] */
  s: [number, number, number];
  /** position offset [x, y, z] */
  p: [number, number, number];
  /** color hex */
  c: number;
}

// ── Prop Catalog ───────────────────────────────────────────────

export const PROP_CATALOG: Record<string, { name: string; parts: PropPartDef[]; mass: number }> = {
  crate: { name: 'Crate', parts: [{ s: [1, 1, 1], p: [0, 0.5, 0], c: 0x885533 }], mass: 10 },
  barrel: { name: 'Barrel', parts: [{ s: [0.8, 1.2, 0.8], p: [0, 0.6, 0], c: 0x3366cc }], mass: 15 },
  sofa: {
    name: 'Sofa', mass: 20, parts: [
      { s: [2, 0.5, 1], p: [0, 0.25, 0], c: 0xaa3333 },
      { s: [2, 0.8, 0.3], p: [0, 0.65, -0.35], c: 0xaa3333 },
      { s: [0.4, 0.6, 1], p: [-0.8, 0.55, 0], c: 0xaa3333 },
      { s: [0.4, 0.6, 1], p: [0.8, 0.55, 0], c: 0xaa3333 },
    ],
  },
  chair: {
    name: 'Chair', mass: 10, parts: [
      { s: [0.6, 0.1, 0.6], p: [0, 0.5, 0], c: 0x553311 },
      { s: [0.6, 0.6, 0.1], p: [0, 0.8, -0.25], c: 0x553311 },
      { s: [0.1, 0.5, 0.1], p: [-0.2, 0.25, -0.2], c: 0x332211 },
      { s: [0.1, 0.5, 0.1], p: [0.2, 0.25, -0.2], c: 0x332211 },
      { s: [0.1, 0.5, 0.1], p: [-0.2, 0.25, 0.2], c: 0x332211 },
      { s: [0.1, 0.5, 0.1], p: [0.2, 0.25, 0.2], c: 0x332211 },
    ],
  },
  table: {
    name: 'Table', mass: 15, parts: [
      { s: [2, 0.1, 1.2], p: [0, 0.8, 0], c: 0x8b4513 },
      { s: [0.15, 0.8, 0.15], p: [-0.8, 0.4, -0.4], c: 0x553311 },
      { s: [0.15, 0.8, 0.15], p: [0.8, 0.4, -0.4], c: 0x553311 },
      { s: [0.15, 0.8, 0.15], p: [-0.8, 0.4, 0.4], c: 0x553311 },
      { s: [0.15, 0.8, 0.15], p: [0.8, 0.4, 0.4], c: 0x553311 },
    ],
  },
  barrier: {
    name: 'Barrier', mass: 15, parts: [
      { s: [2, 0.8, 0.2], p: [0, 0.4, 0], c: 0xffaa00 },
      { s: [0.4, 0.1, 0.6], p: [-0.8, 0.05, 0], c: 0x222222 },
      { s: [0.4, 0.1, 0.6], p: [0.8, 0.05, 0], c: 0x222222 },
    ],
  },
  dumpster: {
    name: 'Dumpster', mass: 80, parts: [
      { s: [2, 1.2, 1.2], p: [0, 0.6, 0], c: 0x225522 },
      { s: [2.1, 0.1, 1.3], p: [0, 1.25, 0], c: 0x111111 },
    ],
  },
  hydrant: {
    name: 'Hydrant', mass: 50, parts: [
      { s: [0.3, 1.0, 0.3], p: [0, 0.5, 0], c: 0xff0000 },
      { s: [0.5, 0.2, 0.3], p: [0, 0.8, 0], c: 0xff0000 },
      { s: [0.1, 0.2, 0.1], p: [0, 1.1, 0], c: 0xcccccc },
    ],
  },
  pallet: {
    name: 'Pallet', mass: 10, parts: [
      { s: [1.2, 0.15, 1.2], p: [0, 0.075, 0], c: 0xccaa88 },
      { s: [1.2, 0.05, 0.1], p: [0, 0.15, -0.4], c: 0xccaa88 },
      { s: [1.2, 0.05, 0.1], p: [0, 0.15, 0], c: 0xccaa88 },
      { s: [1.2, 0.05, 0.1], p: [0, 0.15, 0.4], c: 0xccaa88 },
    ],
  },
  vending: {
    name: 'Vending', mass: 80, parts: [
      { s: [1.0, 2.0, 0.8], p: [0, 1.0, 0], c: 0xcc2222 },
      { s: [0.8, 1.2, 0.1], p: [0, 1.2, 0.4], c: 0x88ccff },
      { s: [0.8, 0.2, 0.1], p: [0, 0.4, 0.4], c: 0x222222 },
    ],
  },
};

// ── Sandbox World ──────────────────────────────────────────────

export class SandboxWorld {
  world: CANNON.World;
  objects: SandboxObject[] = [];
  constraints: VisualConstraint[] = [];
  scene: THREE.Scene;

  private defaultMat: CANNON.Material;
  private bouncyMat: CANNON.Material;

  constructor(scene: THREE.Scene, gravity = -9.8) {
    this.scene = scene;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, gravity, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 20;
    this.world.allowSleep = true;

    this.defaultMat = new CANNON.Material('default');
    this.bouncyMat = new CANNON.Material('bouncy');

    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.defaultMat, this.defaultMat, { friction: 0.5, restitution: 0.1 },
    ));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.defaultMat, this.bouncyMat, { friction: 0.5, restitution: 0.9 },
    ));

    // Ground plane
    const ground = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.defaultMat,
    });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(ground);
  }

  // ── Primitive creators ─────────────────────────────────

  createBox(w: number, h: number, d: number, x: number, y: number, z: number, mass: number, color = 0x888888): SandboxObject {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      material: this.defaultMat,
    });
    body.position.set(x, y, z);
    body.allowSleep = true;
    body.sleepSpeedLimit = 1.5;
    body.sleepTimeLimit = 0.2;
    this.world.addBody(body);

    const obj: SandboxObject = { mesh, body, type: 'box' };
    this.objects.push(obj);
    return obj;
  }

  createSphere(radius: number, x: number, y: number, z: number, mass: number, color = 0xff0000, bouncy = false): SandboxObject {
    const geo = new THREE.SphereGeometry(radius, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Sphere(radius),
      material: bouncy ? this.bouncyMat : this.defaultMat,
    });
    body.position.set(x, y, z);
    body.allowSleep = true;
    this.world.addBody(body);

    const obj: SandboxObject = { mesh, body, type: 'sphere' };
    this.objects.push(obj);
    return obj;
  }

  createCylinder(radius: number, height: number, x: number, y: number, z: number, mass: number, color = 0x00ff00): SandboxObject {
    const geo = new THREE.CylinderGeometry(radius, radius, height, 16);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const shape = new CANNON.Cylinder(radius, radius, height, 16);
    const body = new CANNON.Body({ mass, material: this.defaultMat });
    body.addShape(shape);
    body.position.set(x, y, z);
    body.allowSleep = true;
    this.world.addBody(body);

    const obj: SandboxObject = { mesh, body, type: 'cylinder' };
    this.objects.push(obj);
    return obj;
  }

  // ── Compound Prop ──────────────────────────────────────

  spawnProp(type: string, pos: THREE.Vector3): SandboxObject | null {
    const def = PROP_CATALOG[type];
    if (!def) return null;

    // Compute bounding box for physics shape
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of def.parts) {
      min.x = Math.min(min.x, p.p[0] - p.s[0] / 2);
      min.y = Math.min(min.y, p.p[1] - p.s[1] / 2);
      min.z = Math.min(min.z, p.p[2] - p.s[2] / 2);
      max.x = Math.max(max.x, p.p[0] + p.s[0] / 2);
      max.y = Math.max(max.y, p.p[1] + p.s[1] / 2);
      max.z = Math.max(max.z, p.p[2] + p.s[2] / 2);
    }
    const size = new THREE.Vector3().subVectors(max, min);
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    // Visual group
    const group = new THREE.Group();
    for (const p of def.parts) {
      const geo = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]);
      const mat = new THREE.MeshStandardMaterial({ color: p.c, roughness: 0.6 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(p.p[0] - center.x, p.p[1] - center.y, p.p[2] - center.z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }

    const finalPos = new THREE.Vector3(pos.x, pos.y + size.y / 2, pos.z);
    group.position.copy(finalPos);
    this.scene.add(group);

    // Physics
    const body = new CANNON.Body({
      mass: def.mass,
      shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
      material: this.defaultMat,
    });
    body.position.set(finalPos.x, finalPos.y, finalPos.z);
    body.allowSleep = true;
    this.world.addBody(body);

    const obj: SandboxObject = { mesh: group, body, type: 'prop', name: def.name };
    this.objects.push(obj);
    return obj;
  }

  // ── Constraints ────────────────────────────────────────

  createWeld(a: CANNON.Body, b: CANNON.Body): void {
    const c = new CANNON.LockConstraint(a, b);
    this.world.addConstraint(c);

    // Visual marker line
    const mat = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().copy(a.position as any),
      new THREE.Vector3().copy(b.position as any),
    ]);
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.constraints.push({ type: 'weld', constraint: c, line, bodyA: a, bodyB: b });
  }

  createRope(a: CANNON.Body, b: CANNON.Body): void {
    const dist = a.position.distanceTo(b.position);
    const c = new CANNON.DistanceConstraint(a, b, dist);
    this.world.addConstraint(c);

    const mat = new THREE.LineBasicMaterial({ color: 0x000000 });
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().copy(a.position as any),
      new THREE.Vector3().copy(b.position as any),
    ]);
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.constraints.push({ type: 'rope', constraint: c, line, bodyA: a, bodyB: b });
  }

  createHinge(a: CANNON.Body, b: CANNON.Body, worldPoint: THREE.Vector3): CANNON.HingeConstraint {
    const pt = new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z);
    const c = new CANNON.HingeConstraint(a, b, {
      pivotA: a.pointToLocalFrame(pt),
      pivotB: b.pointToLocalFrame(pt),
      axisA: new CANNON.Vec3(0, 1, 0),
      axisB: new CANNON.Vec3(0, 1, 0),
      collideConnected: false,
    });
    this.world.addConstraint(c);
    return c;
  }

  createMotor(a: CANNON.Body, b: CANNON.Body, worldPoint: THREE.Vector3, speed = 5): CANNON.HingeConstraint {
    const c = this.createHinge(a, b, worldPoint);
    (c as any).enableMotor = true;
    (c as any).motorEquation.maxForce = 1000;
    (c as any).motorEquation.minForce = -1000;
    c.setMotorSpeed(speed);
    return c;
  }

  // ── Freeze / Unfreeze ──────────────────────────────────

  freezeObject(obj: SandboxObject): void {
    obj.body.type = CANNON.Body.STATIC;
    obj.body.mass = 0;
    obj.body.updateMassProperties();
    obj.body.velocity.set(0, 0, 0);
    obj.body.angularVelocity.set(0, 0, 0);
    obj.isFrozen = true;
  }

  unfreezeObject(obj: SandboxObject, mass = 5): void {
    obj.body.type = CANNON.Body.DYNAMIC;
    obj.body.mass = mass;
    obj.body.updateMassProperties();
    obj.body.wakeUp();
    obj.isFrozen = false;
  }

  unfreezeAll(): number {
    let count = 0;
    for (const obj of this.objects) {
      if (obj.isFrozen) { this.unfreezeObject(obj); count++; }
    }
    return count;
  }

  // ── Explosion ──────────────────────────────────────────

  explode(pos: THREE.Vector3, radius: number, force: number): void {
    const cPos = new CANNON.Vec3(pos.x, pos.y, pos.z);
    for (const body of this.world.bodies) {
      if (body.mass <= 0) continue;
      const dist = body.position.distanceTo(cPos);
      if (dist < radius) {
        const dir = new CANNON.Vec3();
        body.position.vsub(cPos, dir);
        dir.normalize();
        dir.scale(force * (1 - dist / radius), dir);
        body.applyImpulse(dir, body.position);
        body.wakeUp();
      }
    }

    // Particle debris
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, 0.15),
        new THREE.MeshBasicMaterial({ color: 0xff5500 }),
      );
      m.position.copy(pos);
      this.scene.add(m);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        Math.random() * 10,
        (Math.random() - 0.5) * 15,
      );
      // Simple particle — will be cleaned up in update
      this.objects.push({ mesh: m, body: null as any, type: 'particle', age: 0 });
      (m as any)._vel = vel;
    }
  }

  // ── Remove ─────────────────────────────────────────────

  removeObject(obj: SandboxObject): void {
    if (obj.body) this.world.removeBody(obj.body);
    this.scene.remove(obj.mesh);
    const idx = this.objects.indexOf(obj);
    if (idx >= 0) this.objects.splice(idx, 1);
  }

  // ── Step ───────────────────────────────────────────────

  step(dt: number, timeScale = 1.0): void {
    this.world.step(1 / 60 * timeScale, dt * timeScale, 5);

    // Sync mesh ← body
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];

      if (obj.type === 'particle') {
        obj.age = (obj.age ?? 0) + dt;
        if (obj.age > 1.0) {
          this.scene.remove(obj.mesh);
          this.objects.splice(i, 1);
          continue;
        }
        const vel = (obj.mesh as any)._vel as THREE.Vector3;
        if (vel) {
          vel.y -= 15 * dt;
          obj.mesh.position.addScaledVector(vel, dt);
          obj.mesh.scale.setScalar(Math.max(0, 1 - obj.age));
        }
        continue;
      }

      if (obj.body) {
        obj.mesh.position.copy(obj.body.position as any);
        obj.mesh.quaternion.copy(obj.body.quaternion as any);
      }

      // Script execution
      if (obj.script && obj.script.length > 0 && obj.scriptState) {
        const st = obj.scriptState;
        const cmd = obj.script[st.index];
        if (cmd.type === 'move' && cmd.dir) {
          const s = 5;
          obj.body.position.x += cmd.dir.x * s * dt;
          obj.body.position.y += cmd.dir.y * s * dt;
          obj.body.position.z += cmd.dir.z * s * dt;
        } else if (cmd.type === 'spin') {
          const q = new CANNON.Quaternion();
          q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 2 * dt);
          obj.body.quaternion = obj.body.quaternion.mult(q);
        }
        st.timer += dt;
        if (st.timer >= cmd.time) {
          st.timer = 0;
          st.index = (st.index + 1) % obj.script.length;
        }
      }
    }

    // Update constraint visuals (ropes)
    for (const c of this.constraints) {
      const pos = c.line.geometry.attributes.position.array as Float32Array;
      pos[0] = c.bodyA.position.x; pos[1] = c.bodyA.position.y; pos[2] = c.bodyA.position.z;
      pos[3] = c.bodyB.position.x; pos[4] = c.bodyB.position.y; pos[5] = c.bodyB.position.z;
      c.line.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ── Raycast helper ─────────────────────────────────────

  findObjectByMesh(mesh: THREE.Object3D): SandboxObject | null {
    return this.objects.find(o =>
      o.mesh === mesh || (mesh.parent && o.mesh === mesh.parent) ||
      (mesh.parent?.parent && o.mesh === mesh.parent.parent),
    ) ?? null;
  }

  // ── World Serialization ─────────────────────────────────

  /** Serialize all objects to a JSON-compatible array */
  serializeWorld(): object[] {
    return this.objects
      .filter(o => o.type !== 'particle' && o.body)
      .map(obj => {
        const geo = (obj.mesh as THREE.Mesh).geometry;
        const params: any = (geo as any)?.parameters ?? {};
        return {
          type: obj.type,
          name: obj.name,
          pos: { x: obj.body.position.x, y: obj.body.position.y, z: obj.body.position.z },
          quat: { x: obj.body.quaternion.x, y: obj.body.quaternion.y, z: obj.body.quaternion.z, w: obj.body.quaternion.w },
          mass: obj.body.mass,
          frozen: obj.isFrozen ?? false,
          color: (obj.mesh as THREE.Mesh).material
            ? ((obj.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.getHex() ?? 0x888888
            : 0x888888,
          w: params.width, h: params.height, d: params.depth,
          radius: params.radius, radiusTop: params.radiusTop,
        };
      });
  }

  /** Deserialize objects from a JSON array and recreate them in the world */
  deserializeWorld(items: any[]): void {
    for (const item of items) {
      let obj: SandboxObject | null = null;
      if (item.type === 'box' || item.type === 'prop') {
        obj = this.createBox(item.w || 1, item.h || 1, item.d || 1, item.pos.x, item.pos.y, item.pos.z, item.mass, item.color);
      } else if (item.type === 'sphere') {
        obj = this.createSphere(item.radius || 0.5, item.pos.x, item.pos.y, item.pos.z, item.mass, item.color);
      } else if (item.type === 'cylinder') {
        obj = this.createCylinder(item.radiusTop || 0.5, item.h || 1, item.pos.x, item.pos.y, item.pos.z, item.mass, item.color);
      }
      if (obj && item.quat) {
        obj.body.quaternion.set(item.quat.x, item.quat.y, item.quat.z, item.quat.w);
      }
      if (obj && item.frozen) {
        this.freezeObject(obj);
      }
    }
  }

  /** Save the current world to R2 cloud storage */
  async saveToCloud(name: string, gameMode: WorldSaveData['gameMode'] = 'sandbox'): Promise<boolean> {
    const worldId = generateGrudgeUUID('WRLD');
    registerUUID(worldId, 'WRLD', name);
    const result = await saveWorldToR2({
      worldId,
      grudgeId: '',
      name,
      createdAt: new Date().toISOString(),
      updatedAt: '',
      gameMode,
      data: this.serializeWorld(),
    });
    return result.success;
  }

  /** Load a world from R2 cloud storage and populate the scene */
  async loadFromCloud(worldId: string): Promise<boolean> {
    const world = await loadWorldFromR2(worldId);
    if (!world || !Array.isArray(world.data)) return false;
    this.deserializeWorld(world.data as any[]);
    return true;
  }

  // ── Cleanup ────────────────────────────────────────────

  dispose(): void {
    for (const c of this.constraints) this.scene.remove(c.line);
    for (const obj of this.objects) {
      if (obj.body) this.world.removeBody(obj.body);
      this.scene.remove(obj.mesh);
    }
    this.objects = [];
    this.constraints = [];
  }
}

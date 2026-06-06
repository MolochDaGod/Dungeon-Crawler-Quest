/**
 * arena-fighter.ts — Arena Fighter System
 *
 * Ports PolyFighter's hitbox/frame/damage system for 1v1 voxel combat.
 * Each fighter wraps a Voxel3DRig with combat state, animation poses,
 * hitbox frame data, HP, and damage calculations.
 *
 * Stats (speed, power, reach) are derived from Grudge character attributes.
 */

import * as THREE from 'three';
import {
  type Voxel3DRig, type Voxel3DPose,
  idlePose, walkPose, punchPose, kickPose,
  blockPose, hitPose, grabPose, dropkickPose,
} from './voxel3d';

// ── Types ──────────────────────────────────────────────────────

export type FighterAction =
  | 'idle' | 'walk' | 'punch' | 'kick'
  | 'headbutt' | 'dropkick' | 'grab'
  | 'block' | 'hit' | 'stunned';

export interface FighterStats {
  speed: number;  // 0.5–2.0, affects move speed + anim speed
  power: number;  // 0.5–2.0, affects damage
  reach: number;  // 0.5–2.0, affects hitbox range
}

export interface HitboxData {
  damage: number;
  type: 'mid' | 'high' | 'low' | 'grab';
  range: number;
}

/** Frame data for each attack — start/end are frame counts at 60fps equivalent */
const FRAME_DATA: Record<string, { totalFrames: number; activeStart: number; activeEnd: number; baseDamage: number; rangeMult: number; type: HitboxData['type'] }> = {
  punch:    { totalFrames: 20, activeStart: 5,  activeEnd: 15, baseDamage: 10, rangeMult: 1.8, type: 'mid' },
  kick:     { totalFrames: 30, activeStart: 10, activeEnd: 20, baseDamage: 15, rangeMult: 2.5, type: 'mid' },
  headbutt: { totalFrames: 25, activeStart: 8,  activeEnd: 18, baseDamage: 22, rangeMult: 2.0, type: 'high' },
  dropkick: { totalFrames: 35, activeStart: 10, activeEnd: 25, baseDamage: 25, rangeMult: 3.0, type: 'high' },
  grab:     { totalFrames: 40, activeStart: 10, activeEnd: 30, baseDamage: 25, rangeMult: 1.0, type: 'grab' },
  hit:      { totalFrames: 25, activeStart: 0,  activeEnd: 0,  baseDamage: 0,  rangeMult: 0,   type: 'mid' },
};

// ── Fighter Class ──────────────────────────────────────────────

export class ArenaFighter {
  rig: Voxel3DRig;
  stats: FighterStats;
  hp: number;
  maxHp: number;
  action: FighterAction = 'idle';
  frame = 0;
  totalFrames = 0;
  hasHit = false; // prevent multi-hit per attack
  direction = 1; // 1 = facing right, -1 = facing left
  velocity = new THREE.Vector3();
  isPlayer: boolean;

  private time = 0;

  constructor(rig: Voxel3DRig, stats: FighterStats, isPlayer: boolean, startX: number) {
    this.rig = rig;
    this.stats = stats;
    this.isPlayer = isPlayer;
    this.maxHp = 100;
    this.hp = 100;
    rig.group.position.set(startX, 0, 0);
  }

  setAction(action: FighterAction): void {
    // Can't interrupt hit stun early
    if (this.action === 'hit' && action !== 'idle' && this.frame < 20) return;
    if (this.action === action) return;

    this.action = action;
    this.frame = 0;
    this.hasHit = false;
    this.totalFrames = FRAME_DATA[action]?.totalFrames ?? 0;
  }

  /** Returns active hitbox if currently in active attack frames, null otherwise */
  getActiveHitbox(): HitboxData | null {
    if (this.hasHit) return null;
    const fd = FRAME_DATA[this.action];
    if (!fd || fd.baseDamage === 0) return null;
    if (this.frame >= fd.activeStart && this.frame <= fd.activeEnd) {
      return {
        damage: fd.baseDamage * this.stats.power,
        type: fd.type,
        range: fd.rangeMult * this.stats.reach,
      };
    }
    return null;
  }

  /** Per-frame update — handles animation, physics, facing */
  update(dt: number, opponent: ArenaFighter): void {
    this.time += dt;

    // Face opponent
    const dx = opponent.rig.group.position.x - this.rig.group.position.x;
    this.direction = dx > 0 ? 1 : -1;
    this.rig.group.rotation.y = this.direction > 0 ? Math.PI / 2 : -Math.PI / 2;

    // Apply velocity + friction
    this.rig.group.position.addScaledVector(this.velocity, dt);
    this.velocity.multiplyScalar(0.9);

    // Boundaries
    this.rig.group.position.x = Math.max(-12, Math.min(12, this.rig.group.position.x));

    // Advance frames and auto-return to idle
    if (this.action !== 'idle' && this.action !== 'walk' && this.action !== 'block') {
      this.frame++;
      if (this.frame > this.totalFrames) this.setAction('idle');
    }

    // Apply pose based on action
    const progress = this.totalFrames > 0 ? this.frame / this.totalFrames : 0;
    let pose: Voxel3DPose;

    switch (this.action) {
      case 'idle':    pose = idlePose(this.time); break;
      case 'walk':    pose = walkPose(this.time, this.stats.speed); break;
      case 'punch':   pose = punchPose(progress); break;
      case 'kick':    pose = kickPose(progress); break;
      case 'headbutt': pose = punchPose(progress); break; // reuse punch anim for now
      case 'dropkick': pose = dropkickPose(progress); break;
      case 'grab':    pose = grabPose(progress); break;
      case 'block':   pose = blockPose(); break;
      case 'hit':     pose = hitPose(); break;
      default:        pose = idlePose(this.time); break;
    }

    this.rig.setPose(pose);
    this.rig.update(dt);
  }

  /** Take damage — returns true if KO */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.setAction('hit');
    // Knockback
    this.rig.group.position.x -= this.direction * 0.3;
    return this.hp <= 0;
  }
}

// ── Combat Resolver ────────────────────────────────────────────

export interface CombatResult {
  hit: boolean;
  blocked: boolean;
  damage: number;
  ko: boolean;
}

/**
 * Checks if attacker's hitbox connects with defender.
 * Returns combat result with damage applied.
 */
export function resolveCombat(attacker: ArenaFighter, defender: ArenaFighter): CombatResult {
  const hitbox = attacker.getActiveHitbox();
  if (!hitbox) return { hit: false, blocked: false, damage: 0, ko: false };

  const dist = attacker.rig.group.position.distanceTo(defender.rig.group.position);
  if (dist > hitbox.range) return { hit: false, blocked: false, damage: 0, ko: false };

  attacker.hasHit = true;

  if (defender.action === 'block') {
    // Blocked — reduced knockback, no damage
    defender.rig.group.position.x += attacker.direction * 0.2;
    return { hit: true, blocked: true, damage: 0, ko: false };
  }

  const ko = defender.takeDamage(hitbox.damage);
  return { hit: true, blocked: false, damage: hitbox.damage, ko };
}

// ── Simple CPU AI ──────────────────────────────────────────────

export function updateCPU(cpu: ArenaFighter, player: ArenaFighter, dt: number): void {
  if (cpu.action !== 'idle' && cpu.action !== 'walk') return;

  const dist = cpu.rig.group.position.distanceTo(player.rig.group.position);
  const dirToPlayer = Math.sign(player.rig.group.position.x - cpu.rig.group.position.x);

  if (dist > 2.5) {
    // Approach
    if (Math.random() < 0.02) {
      cpu.setAction('dropkick');
    } else {
      cpu.setAction('walk');
      cpu.velocity.x = dirToPlayer * 4.0 * cpu.stats.speed;
    }
  } else {
    // Close range — pick a move
    cpu.velocity.x = 0;
    cpu.setAction('idle');
    const rand = Math.random();
    if (rand < 0.025) cpu.setAction('punch');
    else if (rand < 0.05) cpu.setAction('kick');
    else if (rand < 0.06) cpu.setAction('grab');
    else if (rand < 0.07) cpu.setAction('headbutt');
    else if (rand < 0.08) cpu.setAction('block');
  }

  // Release block randomly
  if ((cpu.action as string) === 'block' && Math.random() > 0.95) cpu.setAction('idle');
}

// ── Particle System ────────────────────────────────────────────

interface Particle3D {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class ArenaParticles {
  private particles: Particle3D[] = [];
  private scene: THREE.Scene;
  private geo = new THREE.BoxGeometry(0.04, 0.04, 0.04);

  constructor(scene: THREE.Scene) { this.scene = scene; }

  emit(pos: THREE.Vector3, color: number, count: number, speed: number): void {
    const mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          (Math.random() * 0.5 + 0.5) * speed,
          (Math.random() - 0.5) * speed,
        ),
        life: 1.0,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * 2;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      } else {
        p.vel.y -= 9.8 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(Math.max(0, p.life));
      }
    }
  }

  dispose(): void {
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }
}

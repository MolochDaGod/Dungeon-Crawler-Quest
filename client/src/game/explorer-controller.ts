/**
 * explorer-controller.ts — Fleet-style explorer character controller
 *
 * Ports the Open / Danger Room control + camera + soft-lock contract into DCQ
 * Three.js (no Rapier dependency). Used by /dungeon3d.
 *
 * Controls (fleet soft-lock + combat targeting):
 *   WASD        — camera-relative move (A/D = strafe)
 *   Shift       — sprint
 *   Space       — jump
 *   Mouse look  — pointer-lock freelook (click canvas); yaw/pitch
 *   Wheel       — camera distance
 *   LMB         — light attack / confirm skill
 *   RMB click   — toggle hard lock-on (face + strafe target)
 *   Tab         — cycle soft-lock target (re-arm soft-lock)
 *   Alt+Tab     — free camera (exit soft-lock)
 *   1–4 / Q E R F — weapon skill slots
 *   X           — dodge roll (lateral)
 *   C           — parry / block pulse
 *
 * Soft-lock: always-on gentle yaw assist toward nearest/Tab'd living foe.
 * Hard lock: RMB seizes camera yaw + body facing; A/D strafe around target.
 * Camera: right-shoulder third-person with pitch, zoom, wall pull-in.
 */

import * as THREE from 'three';

// ── Config (SI metres, ~1.8 m hero) ────────────────────────────

const MOVE_SPEED = 6.5;
const SPRINT_MULT = 1.75;
const JUMP_FORCE = 9;
const GRAVITY = -28;
const CAM_DIST_DEFAULT = 4.2;
const CAM_DIST_MIN = 2.2;
const CAM_DIST_MAX = 9;
const CAM_HEIGHT = 1.55;       // look-at height (chest)
const CAM_SHOULDER = 0.55;     // right-shoulder offset
const CAM_PITCH_MIN = 0.12;
const CAM_PITCH_MAX = 1.15;
const MOUSE_SENS = 0.0022;
const SOFT_LOCK_CONE = 1.05;   // rad ~60°
const SOFT_LOCK_RATE = 1.5;    // yaw assist strength
const HARD_LOCK_RATE = 9;
const YAW_FACE_RATE = 12;
const DODGE_DURATION = 0.35;
const DODGE_DIST = 3.2;
const DODGE_CD = 0.65;
const ATTACK_LMB_CD = 0.35;
const ATTACK_RMB_CD = 0.55;

export interface SoftLockTarget {
  id: string;
  /** Aim point (chest), world space */
  point: THREE.Vector3;
  mesh?: THREE.Object3D;
  alive: boolean;
}

export interface ExplorerEvents {
  onAttack?: (type: 'lmb' | 'rmb', aim: THREE.Vector3) => void;
  onSkill?: (slot: number, aim: THREE.Vector3, target: SoftLockTarget | null) => void;
  onDodge?: (dir: THREE.Vector3) => void;
  onParry?: () => void;
  onJump?: () => void;
  onLockChange?: (locked: boolean, target: SoftLockTarget | null) => void;
  onSoftLockChange?: (target: SoftLockTarget | null) => void;
}

export interface ExplorerState {
  keys: Set<string>;
  yaw: number;
  pitch: number;
  camDistance: number;
  velocityY: number;
  grounded: boolean;
  playerY: number;
  softLockEnabled: boolean;
  hardLocked: boolean;
  softTarget: SoftLockTarget | null;
  hardTarget: SoftLockTarget | null;
  pointerLocked: boolean;
  lookActive: boolean;
  dodgeT: number;
  dodgeCd: number;
  attackCd: number;
  moving: boolean;
  sprinting: boolean;
  disposed: boolean;
}

export class ExplorerController {
  state: ExplorerState;
  events: ExplorerEvents;

  private camera: THREE.PerspectiveCamera;
  private player: THREE.Object3D;
  private canvas: HTMLCanvasElement;
  private occluders: THREE.Object3D[] = [];
  private targets: SoftLockTarget[] = [];
  private camRay = new THREE.Raycaster();
  private mouseDx = 0;
  private mouseDy = 0;
  private mouseWheel = 0;
  private dodgeDir = new THREE.Vector3();
  private _tmp = new THREE.Vector3();
  private _fwd = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _aim = new THREE.Vector3();

  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onWheel: (e: WheelEvent) => void;
  private _onContext: (e: Event) => void;
  private _onPointerLockChange: () => void;
  private _onBlur: () => void;

  /** Hot-swap player mesh (TVS explorer upgrade after voxel first paint). */
  setPlayer(player: THREE.Object3D): void {
    this.player = player;
    this.state.playerY = player.position.y;
  }

  constructor(
    camera: THREE.PerspectiveCamera,
    player: THREE.Object3D,
    canvas: HTMLCanvasElement,
    events: ExplorerEvents = {},
  ) {
    this.camera = camera;
    this.player = player;
    this.canvas = canvas;
    this.events = events;

    this.state = {
      keys: new Set(),
      yaw: 0,
      pitch: 0.35,
      camDistance: CAM_DIST_DEFAULT,
      velocityY: 0,
      grounded: true,
      playerY: player.position.y,
      softLockEnabled: true,
      hardLocked: false,
      softTarget: null,
      hardTarget: null,
      pointerLocked: false,
      lookActive: false,
      dodgeT: 0,
      dodgeCd: 0,
      attackCd: 0,
      moving: false,
      sprinting: false,
      disposed: false,
    };

    this._onKeyDown = (e) => {
      if (this.state.disposed) return;
      const key = e.key.toLowerCase();
      // Don't capture typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      this.state.keys.add(key);

      if (key === 'tab') {
        e.preventDefault();
        if (e.altKey) {
          this.exitSoftLock();
        } else {
          this.enableSoftLock();
          this.cycleSoftTarget(e.shiftKey ? -1 : 1);
        }
        return;
      }

      if (key === ' ' && this.state.grounded && this.state.dodgeT <= 0) {
        this.state.velocityY = JUMP_FORCE;
        this.state.grounded = false;
        this.events.onJump?.();
      }

      // Skills: 1-4 and Q E R F (fleet map)
      const skillMap: Record<string, number> = {
        '1': 0, '2': 1, '3': 2, '4': 3,
        q: 0, e: 1, r: 2, f: 3,
      };
      if (key in skillMap) {
        this.fireSkill(skillMap[key]);
      }

      if (key === 'x') this.tryDodge();
      if (key === 'c') this.events.onParry?.();
    };

    this._onKeyUp = (e) => {
      if (this.state.disposed) return;
      this.state.keys.delete(e.key.toLowerCase());
    };

    this._onMouseDown = (e) => {
      if (this.state.disposed) return;
      if (e.button === 0) {
        // Request pointer lock on first LMB if not locked
        if (!this.state.pointerLocked) {
          this.canvas.requestPointerLock?.();
        }
        this.tryAttack('lmb');
      }
      if (e.button === 2) {
        // RMB click toggles hard lock (fleet contract)
        this.toggleHardLock();
      }
    };

    this._onMouseUp = (_e) => {
      // hard lock is toggle, not hold
    };

    this._onMouseMove = (e) => {
      if (this.state.disposed) return;
      if (this.state.pointerLocked || this.state.lookActive) {
        this.mouseDx += e.movementX || 0;
        this.mouseDy += e.movementY || 0;
      }
    };

    this._onWheel = (e) => {
      if (this.state.disposed) return;
      this.mouseWheel += e.deltaY;
      e.preventDefault();
    };

    this._onContext = (e) => e.preventDefault();

    this._onPointerLockChange = () => {
      this.state.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.state.pointerLocked) {
        this.mouseDx = 0;
        this.mouseDy = 0;
      }
    };

    this._onBlur = () => {
      this.state.keys.clear();
      this.mouseDx = 0;
      this.mouseDy = 0;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this._onContext);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    window.addEventListener('blur', this._onBlur);
  }

  // ── Public API ─────────────────────────────────────────────

  setOccluders(meshes: THREE.Object3D[]) {
    this.occluders = meshes;
  }

  /** Register living hostiles for soft/hard lock. Call each room spawn / death. */
  setTargets(list: SoftLockTarget[]) {
    this.targets = list.filter((t) => t.alive);
    // Refresh current soft/hard refs
    if (this.state.softTarget) {
      const still = this.targets.find((t) => t.id === this.state.softTarget!.id);
      this.state.softTarget = still ?? null;
    }
    if (this.state.hardTarget) {
      const still = this.targets.find((t) => t.id === this.state.hardTarget!.id);
      if (!still) {
        this.state.hardLocked = false;
        this.state.hardTarget = null;
      } else {
        this.state.hardTarget = still;
      }
    }
  }

  enableSoftLock() {
    this.state.softLockEnabled = true;
  }

  exitSoftLock() {
    this.state.softLockEnabled = false;
    this.state.softTarget = null;
    if (!this.state.hardLocked) {
      this.events.onSoftLockChange?.(null);
    }
  }

  toggleHardLock() {
    if (this.state.hardLocked) {
      this.state.hardLocked = false;
      this.state.hardTarget = null;
      this.events.onLockChange?.(false, null);
      return;
    }
    const pick =
      this.state.softTarget && this.state.softTarget.alive
        ? this.state.softTarget
        : this.acquireNearest(this.player.position);
    if (pick) {
      this.state.hardLocked = true;
      this.state.softLockEnabled = true;
      this.state.hardTarget = pick;
      this.state.softTarget = pick;
      this.events.onLockChange?.(true, pick);
      this.events.onSoftLockChange?.(pick);
    }
  }

  cycleSoftTarget(dir = 1) {
    const living = this.targets.filter((t) => t.alive);
    if (living.length === 0) {
      this.state.softTarget = null;
      this.events.onSoftLockChange?.(null);
      return;
    }
    const curIdx = living.findIndex((t) => t.id === this.state.softTarget?.id);
    const next = living[(curIdx + dir + living.length) % living.length];
    this.state.softTarget = next;
    if (this.state.hardLocked) this.state.hardTarget = next;
    this.events.onSoftLockChange?.(next);
  }

  /** Camera-forward aim point at chest height, or soft/hard target chest. */
  resolveAimPoint(): THREE.Vector3 {
    const t = this.state.hardTarget ?? this.state.softTarget;
    if (t && t.alive) {
      this._aim.copy(t.point);
      return this._aim;
    }
    const fwd = this.forward();
    this._aim.set(
      this.player.position.x + fwd.x * 4,
      this.player.position.y + CAM_HEIGHT,
      this.player.position.z + fwd.z * 4,
    );
    return this._aim;
  }

  forward(): THREE.Vector3 {
    this._fwd.set(Math.sin(this.state.yaw), 0, Math.cos(this.state.yaw));
    return this._fwd;
  }

  isMoving(): boolean {
    return this.state.moving;
  }

  // ── Frame update ───────────────────────────────────────────

  update(dt: number) {
    if (this.state.disposed) return;
    const s = this.state;
    const pp = this.player.position;
    const dx = this.mouseDx;
    const dy = this.mouseDy;
    this.mouseDx = 0;
    this.mouseDy = 0;
    const wheel = this.mouseWheel;
    this.mouseWheel = 0;

    // ── Look ───────────────────────────────────────────────
    if (s.pointerLocked || s.lookActive) {
      if (!s.hardLocked) {
        s.yaw -= dx * MOUSE_SENS;
      }
      s.pitch = THREE.MathUtils.clamp(
        s.pitch + dy * MOUSE_SENS,
        CAM_PITCH_MIN,
        CAM_PITCH_MAX,
      );
    }
    if (wheel !== 0) {
      s.camDistance = THREE.MathUtils.clamp(
        s.camDistance + wheel * 0.005,
        CAM_DIST_MIN,
        CAM_DIST_MAX,
      );
    }

    // ── Soft / hard lock yaw ───────────────────────────────
    // Refresh soft target each frame when enabled
    if (s.hardLocked && s.hardTarget?.alive) {
      // Drive yaw to put target in front of player
      const toT = this._tmp.set(
        s.hardTarget.point.x - pp.x,
        0,
        s.hardTarget.point.z - pp.z,
      );
      if (toT.lengthSq() > 1e-4) {
        const desired = Math.atan2(toT.x, toT.z);
        s.yaw += this.shortestDelta(desired, s.yaw) * Math.min(1, HARD_LOCK_RATE * dt);
      }
    } else if (s.softLockEnabled) {
      // Keep Tab pick, else nearest living
      if (!s.softTarget?.alive) {
        s.softTarget = this.acquireNearest(pp);
        if (s.softTarget) this.events.onSoftLockChange?.(s.softTarget);
      } else {
        // Update point from mesh if present
        if (s.softTarget.mesh) {
          s.softTarget.point.set(
            s.softTarget.mesh.position.x,
            s.softTarget.mesh.position.y + 1.1,
            s.softTarget.mesh.position.z,
          );
        }
      }
      if (s.softTarget && (s.pointerLocked || s.lookActive) && Math.abs(dx) < 2) {
        const toS = this._tmp.set(
          s.softTarget.point.x - pp.x,
          0,
          s.softTarget.point.z - pp.z,
        );
        if (toS.lengthSq() > 1e-4) {
          const desired = Math.atan2(toS.x, toS.z);
          const d = this.shortestDelta(desired, s.yaw);
          if (Math.abs(d) < SOFT_LOCK_CONE) {
            s.yaw += d * Math.min(1, SOFT_LOCK_RATE * dt) * 0.5;
          }
        }
      }
    }

    // ── Movement ───────────────────────────────────────────
    const fwd = this.forward();
    // Screen-right: (-fwd.z, 0, fwd.x) so D = right
    this._right.set(-fwd.z, 0, fwd.x);
    const move = this._tmp.set(0, 0, 0);

    if (s.dodgeT > 0) {
      s.dodgeT -= dt;
      pp.x += this.dodgeDir.x * (DODGE_DIST / DODGE_DURATION) * dt;
      pp.z += this.dodgeDir.z * (DODGE_DIST / DODGE_DURATION) * dt;
      s.moving = true;
      s.sprinting = false;
    } else {
      if (s.keys.has('w')) move.add(fwd);
      if (s.keys.has('s')) move.sub(fwd);
      if (s.keys.has('d')) move.add(this._right);
      if (s.keys.has('a')) move.sub(this._right);

      s.sprinting = s.keys.has('shift') && move.lengthSq() > 0.01;
      const speed = MOVE_SPEED * (s.sprinting ? SPRINT_MULT : 1);
      s.moving = move.lengthSq() > 0.01;
      if (s.moving) {
        move.normalize();
        pp.x += move.x * speed * dt;
        pp.z += move.z * speed * dt;
      }
    }

    // Body facing: hard lock / focus → camera-forward; free move → travel heading
    let faceYaw = s.yaw;
    if (!s.hardLocked && s.moving && s.dodgeT <= 0) {
      faceYaw = Math.atan2(move.x, move.z);
    }
    // Smooth yaw on mesh
    let bodyYaw = this.player.rotation.y;
    let dFace = this.shortestDelta(faceYaw, bodyYaw);
    bodyYaw += dFace * Math.min(1, YAW_FACE_RATE * dt);
    this.player.rotation.y = bodyYaw;

    // Gravity + jump
    s.velocityY += GRAVITY * dt;
    s.playerY += s.velocityY * dt;
    if (s.playerY <= 0) {
      s.playerY = 0;
      s.velocityY = 0;
      s.grounded = true;
    }
    pp.y = s.playerY;

    if (s.dodgeCd > 0) s.dodgeCd -= dt;
    if (s.attackCd > 0) s.attackCd -= dt;

    // Sync hard/soft target points from meshes
    for (const t of this.targets) {
      if (t.mesh && t.alive) {
        t.point.set(t.mesh.position.x, t.mesh.position.y + 1.1, t.mesh.position.z);
      }
    }

    this.updateCamera(dt);
  }

  // ── Internals ──────────────────────────────────────────────

  private tryAttack(type: 'lmb' | 'rmb') {
    const cd = type === 'lmb' ? ATTACK_LMB_CD : ATTACK_RMB_CD;
    if (this.state.attackCd > 0) return;
    this.state.attackCd = cd;
    this.events.onAttack?.(type, this.resolveAimPoint().clone());
  }

  private fireSkill(slot: number) {
    this.events.onSkill?.(
      slot,
      this.resolveAimPoint().clone(),
      this.state.hardTarget ?? this.state.softTarget,
    );
  }

  private tryDodge() {
    if (this.state.dodgeCd > 0 || this.state.dodgeT > 0) return;
    const fwd = this.forward();
    this._right.set(-fwd.z, 0, fwd.x);
    // Prefer A/D lateral; else backstep
    if (this.state.keys.has('a')) this.dodgeDir.copy(this._right).multiplyScalar(-1);
    else if (this.state.keys.has('d')) this.dodgeDir.copy(this._right);
    else if (this.state.keys.has('s')) this.dodgeDir.copy(fwd).multiplyScalar(-1);
    else this.dodgeDir.copy(fwd).multiplyScalar(-1);
    this.dodgeDir.y = 0;
    if (this.dodgeDir.lengthSq() < 1e-4) this.dodgeDir.set(0, 0, -1);
    this.dodgeDir.normalize();
    this.state.dodgeT = DODGE_DURATION;
    this.state.dodgeCd = DODGE_CD;
    this.events.onDodge?.(this.dodgeDir.clone());
  }

  private acquireNearest(from: THREE.Vector3): SoftLockTarget | null {
    let best: SoftLockTarget | null = null;
    let bestD = Infinity;
    for (const t of this.targets) {
      if (!t.alive) continue;
      const d = from.distanceToSquared(t.point);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  private shortestDelta(desired: number, current: number): number {
    let d = desired - current;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private updateCamera(dt: number) {
    const s = this.state;
    const pp = this.player.position;
    const lookAt = this._tmp.set(pp.x, pp.y + CAM_HEIGHT, pp.z);

    // Spherical orbit behind character + right-shoulder bias (fleet Controller)
    const dist = s.camDistance;
    const cosP = Math.cos(s.pitch);
    const offset = new THREE.Vector3(
      Math.sin(s.yaw) * cosP * -dist,
      Math.sin(s.pitch) * dist * 0.85 + 0.4,
      Math.cos(s.yaw) * cosP * -dist,
    );
    const shoulderR = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw)).multiplyScalar(CAM_SHOULDER);
    const desired = lookAt.clone().add(offset).add(shoulderR);

    // Occlusion pull-in (dungeon walls)
    if (this.occluders.length > 0) {
      const dir = new THREE.Vector3().subVectors(desired, lookAt);
      const len = dir.length();
      if (len > 1e-3) {
        dir.divideScalar(len);
        this.camRay.set(lookAt, dir);
        this.camRay.far = len;
        const hits = this.camRay.intersectObjects(this.occluders, true);
        if (hits.length > 0) {
          const d = Math.max(0.6, hits[0].distance - 0.25);
          desired.copy(lookAt).addScaledVector(dir, d);
        }
      }
    }

    const lerp = Math.min(1, 14 * dt);
    this.camera.position.lerp(desired, lerp);
    this.camera.lookAt(lookAt);
  }

  dispose() {
    this.state.disposed = true;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    window.removeEventListener('blur', this._onBlur);
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }
  }
}

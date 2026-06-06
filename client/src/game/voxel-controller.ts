/**
 * voxel-controller.ts — Unified 3D Player Controller
 *
 * Shared across sandbox, arena, and dungeon3d modes.
 * - Over-the-shoulder camera (Fortnite-style W=forward from camera)
 * - WASD movement with A/D turn, Q/E strafe
 * - Tab toggles combat/harvest mode
 * - LMB/RMB maps to combat actions
 * - 1-9 tool hotbar
 * - E interaction key
 * - Space jump, Shift sprint
 */

import * as THREE from 'three';
import { SandboxTool } from './sandbox-physics';

// ── Config ─────────────────────────────────────────────────────

const MOVE_SPEED = 8;
const SPRINT_MULT = 1.8;
const TURN_SPEED = 3.0;
const JUMP_FORCE = 12;
const GRAVITY = -25;
const CAM_DISTANCE = 4;
const CAM_HEIGHT = 2.5;
const CAM_SHOULDER = 0.8;
const CAM_LERP = 0.08;

// ── Controller State ───────────────────────────────────────────

export interface ControllerState {
  /** Currently pressed keys */
  keys: Set<string>;
  /** Left mouse button held */
  lmbDown: boolean;
  /** Right mouse button held */
  rmbDown: boolean;
  /** Current facing angle (radians) */
  facing: number;
  /** Camera orbit angle */
  cameraAlpha: number;
  /** Vertical velocity */
  velocityY: number;
  /** Whether player is on ground */
  grounded: boolean;
  /** Player Y position */
  playerY: number;
  /** Combat vs harvest mode */
  combatMode: boolean;
  /** Active tool index */
  activeTool: SandboxTool;
  /** Is controller disposed */
  disposed: boolean;
}

// ── Events emitted by controller ───────────────────────────────

export interface ControllerEvents {
  onAttack?: (type: 'lmb' | 'rmb') => void;
  onAbility?: (slot: number) => void;
  onInteract?: () => void;
  onToolChange?: (tool: SandboxTool) => void;
  onJump?: () => void;
  onBlock?: (active: boolean) => void;
}

// ── Controller Class ───────────────────────────────────────────

export class VoxelController {
  state: ControllerState;
  events: ControllerEvents;

  private camera: THREE.PerspectiveCamera;
  private playerMesh: THREE.Object3D;
  private canvas: HTMLCanvasElement;
  private terrainMesh: THREE.Mesh | null;
  private raycaster = new THREE.Raycaster();

  // Bound handlers for cleanup
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onContext: (e: Event) => void;

  constructor(
    camera: THREE.PerspectiveCamera,
    playerMesh: THREE.Object3D,
    canvas: HTMLCanvasElement,
    terrainMesh: THREE.Mesh | null = null,
    events: ControllerEvents = {},
  ) {
    this.camera = camera;
    this.playerMesh = playerMesh;
    this.canvas = canvas;
    this.terrainMesh = terrainMesh;
    this.events = events;

    this.state = {
      keys: new Set(),
      lmbDown: false,
      rmbDown: false,
      facing: 0,
      cameraAlpha: Math.PI,
      velocityY: 0,
      grounded: true,
      playerY: playerMesh.position.y,
      combatMode: false,
      activeTool: SandboxTool.Hand,
      disposed: false,
    };

    // ── Bind event handlers ──────────────────────────────

    this._onKeyDown = (e: KeyboardEvent) => {
      if (this.state.disposed) return;
      const key = e.key.toLowerCase();
      this.state.keys.add(key);

      // Ability keys 1-5
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        this.events.onAbility?.(num - 1);
        // Also set tool
        if (num <= 9) {
          this.state.activeTool = num as SandboxTool;
          this.events.onToolChange?.(this.state.activeTool);
        }
      }

      // Tab = combat mode toggle
      if (key === 'tab') { e.preventDefault(); this.state.combatMode = !this.state.combatMode; }

      // Jump
      if (key === ' ' && this.state.grounded) {
        this.state.velocityY = JUMP_FORCE;
        this.state.grounded = false;
        this.events.onJump?.();
      }

      // Interact
      if (key === 'e') this.events.onInteract?.();

      // Block (hold)
      if (key === 'shift') this.events.onBlock?.(true);
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      if (this.state.disposed) return;
      const key = e.key.toLowerCase();
      this.state.keys.delete(key);
      if (key === 'shift') this.events.onBlock?.(false);
    };

    this._onMouseDown = (e: MouseEvent) => {
      if (this.state.disposed) return;
      if (e.button === 0) {
        this.state.lmbDown = true;
        this.events.onAttack?.('lmb');
      }
      if (e.button === 2) {
        this.state.rmbDown = true;
        this.events.onAttack?.('rmb');
      }
    };

    this._onMouseUp = (e: MouseEvent) => {
      if (this.state.disposed) return;
      if (e.button === 0) this.state.lmbDown = false;
      if (e.button === 2) this.state.rmbDown = false;
    };

    this._onMouseMove = (e: MouseEvent) => {
      if (this.state.disposed || !this.state.lmbDown) return;
      this.state.cameraAlpha -= e.movementX * 0.005;
    };

    this._onContext = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  // ── Per-frame update ─────────────────────────────────────

  update(dt: number): void {
    if (this.state.disposed) return;
    const s = this.state;
    const pp = this.playerMesh.position;

    const sprinting = s.keys.has('shift');
    const speed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);

    // Camera forward on XZ
    const camFwd = new THREE.Vector3(
      Math.sin(s.cameraAlpha), 0, Math.cos(s.cameraAlpha),
    ).normalize();
    const camRight = new THREE.Vector3(camFwd.z, 0, -camFwd.x);

    const moveDir = new THREE.Vector3();
    if (s.keys.has('w')) moveDir.add(camFwd);
    if (s.keys.has('s')) moveDir.sub(camFwd);
    if (s.keys.has('a')) s.facing += TURN_SPEED * dt;
    if (s.keys.has('d')) s.facing -= TURN_SPEED * dt;
    if (s.keys.has('q')) moveDir.sub(camRight);
    if (s.keys.has('e') && !s.keys.has('shift')) moveDir.add(camRight);

    if (moveDir.lengthSq() > 0.01) {
      s.facing = Math.atan2(moveDir.x, moveDir.z);
      moveDir.normalize();
      pp.x += moveDir.x * speed * dt;
      pp.z += moveDir.z * speed * dt;
    }

    // Gravity
    s.velocityY += GRAVITY * dt;
    s.playerY += s.velocityY * dt;

    // Ground check via raycast
    let groundY = 0;
    if (this.terrainMesh) {
      const origin = new THREE.Vector3(pp.x, pp.y + 50, pp.z);
      this.raycaster.set(origin, new THREE.Vector3(0, -1, 0));
      this.raycaster.far = 100;
      const hits = this.raycaster.intersectObject(this.terrainMesh);
      if (hits.length > 0) groundY = hits[0].point.y;
    }

    if (s.playerY <= groundY) {
      s.playerY = groundY;
      s.velocityY = 0;
      s.grounded = true;
    }
    pp.y = s.playerY + 0.5; // character center offset
    this.playerMesh.rotation.y = s.facing;

    // Camera follow (over-the-shoulder)
    const targetPos = new THREE.Vector3(
      pp.x - Math.sin(s.cameraAlpha) * CAM_DISTANCE + camRight.x * CAM_SHOULDER,
      pp.y + CAM_HEIGHT,
      pp.z - Math.cos(s.cameraAlpha) * CAM_DISTANCE + camRight.z * CAM_SHOULDER,
    );
    this.camera.position.lerp(targetPos, CAM_LERP);
    this.camera.lookAt(pp.x, pp.y + 0.8, pp.z);
  }

  // ── Helpers ──────────────────────────────────────────────

  isMoving(): boolean {
    const s = this.state;
    return s.keys.has('w') || s.keys.has('s') || s.keys.has('q');
  }

  getMovementDirection(): THREE.Vector3 {
    const s = this.state;
    const camFwd = new THREE.Vector3(Math.sin(s.cameraAlpha), 0, Math.cos(s.cameraAlpha)).normalize();
    const camRight = new THREE.Vector3(camFwd.z, 0, -camFwd.x);
    const dir = new THREE.Vector3();
    if (s.keys.has('w')) dir.add(camFwd);
    if (s.keys.has('s')) dir.sub(camFwd);
    if (s.keys.has('q')) dir.sub(camRight);
    if (dir.lengthSq() > 0.01) dir.normalize();
    return dir;
  }

  // ── Cleanup ──────────────────────────────────────────────

  dispose(): void {
    this.state.disposed = true;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}

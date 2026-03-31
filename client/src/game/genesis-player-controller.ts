/**
 * Genesis 3rd-Person Player Controller
 *
 * Controls (per user rules):
 *   W        — move forward (away from camera, Fortnite-style)
 *   S        — move backward
 *   A / D    — turn character (camera follows behind)
 *   Q / E    — strafe left / right
 *   Mouse    — hold LMB to rotate camera (orbit around player)
 *   Tab      — cycle target selection (WoW-style)
 *   1-4      — ability slots → bridge.useAbility()
 *   F        — class ability
 *   R        — ultimate
 *   LMB      — attack (combat mode)
 *   RMB      — heavy/block (combat mode)
 *   Space    — jump / dodge
 *   Shift    — sprint (drains stamina)
 *
 * Camera: over-the-shoulder, follows behind player character.
 * In combat mode (Tab toggle), direction faces mouse cursor target.
 * In harvest mode, direction follows movement.
 */

import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { Ray } from "@babylonjs/core/Culling/ray";
import type { GenesisGameBridge } from "./genesis-game-bridge";

// ── Config ─────────────────────────────────────────────────────

const MOVE_SPEED = 8;         // units/sec
const SPRINT_MULT = 1.8;
const TURN_SPEED = 3.0;       // radians/sec
const STRAFE_SPEED = 6;
const JUMP_FORCE = 12;
const GRAVITY = -25;
const CAM_DISTANCE = 12;
const CAM_HEIGHT_OFFSET = 4;
const CAM_SHOULDER_OFFSET = 2; // right shoulder
const CAM_LERP = 0.08;
const TARGET_RANGE = 50;
const STAMINA_SPRINT_DRAIN = 15; // per second
const INTERACT_RANGE = 4;

// ── Controller ─────────────────────────────────────────────────

export class GenesisPlayerController {
  private scene: Scene;
  private bridge: GenesisGameBridge;
  private playerNode: TransformNode;
  private camera: ArcRotateCamera;
  private canvas: HTMLCanvasElement;

  // Input state
  private keys = new Set<string>();
  private lmbDown = false;
  private rmbDown = false;
  private pointerLocked = false;

  // Physics
  private velocityY = 0;
  private grounded = true;
  private playerY = 0;
  private facing = 0; // radians

  // Combat mode
  private combatMode = false;
  private targetMeshes: AbstractMesh[] = [];
  private currentTargetIdx = -1;
  private currentTarget: AbstractMesh | null = null;

  // Interaction
  private nearbyInteractable: { type: string; name: string; mesh: AbstractMesh } | null = null;

  constructor(
    scene: Scene,
    bridge: GenesisGameBridge,
    playerNode: TransformNode,
    oldCamera: FreeCamera,
    canvas: HTMLCanvasElement,
  ) {
    this.scene = scene;
    this.bridge = bridge;
    this.playerNode = playerNode;
    this.canvas = canvas;

    // Switch to ArcRotateCamera for 3rd person (don't dispose old — just detach)
    oldCamera.detachControl();

    this.camera = new ArcRotateCamera(
      "thirdPerson",
      Math.PI,       // alpha (behind player)
      Math.PI / 3.5, // beta (above)
      CAM_DISTANCE,
      playerNode.position.clone(),
      scene,
    );
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 25;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = Math.PI / 2.2;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 5000;
    this.camera.wheelPrecision = 30;
    this.camera.panningSensibility = 0;
    this.camera.attachControl(canvas, true);
    this.camera.inputs.removeByType("ArcRotateCameraPointersInput");
    scene.activeCamera = this.camera;

    this.playerY = playerNode.position.y;

    // ── Keyboard ────────────────────────────────────────────
    scene.onKeyboardObservable.add(ev => {
      const key = ev.event.key.toLowerCase();
      if (ev.type === KeyboardEventTypes.KEYDOWN) {
        this.keys.add(key);
        this.onKeyDown(key, ev.event);
      } else {
        this.keys.delete(key);
        this.onKeyUp(key);
      }
    });

    // ── Pointer ─────────────────────────────────────────────
    scene.onPointerObservable.add(ev => {
      if (ev.type === PointerEventTypes.POINTERDOWN) {
        if (ev.event.button === 0) { this.lmbDown = true; this.onLMBDown(); }
        if (ev.event.button === 2) { this.rmbDown = true; this.onRMBDown(); }
      }
      if (ev.type === PointerEventTypes.POINTERUP) {
        if (ev.event.button === 0) { this.lmbDown = false; this.bridge.sendCombatEvent({ type: 'LMB_UP' }); }
        if (ev.event.button === 2) { this.rmbDown = false; this.bridge.sendCombatEvent({ type: 'RMB_UP' }); }
      }
      if (ev.type === PointerEventTypes.POINTERMOVE && this.lmbDown) {
        // Rotate camera with LMB drag
        const dx = ev.event.movementX || 0;
        const dy = ev.event.movementY || 0;
        this.camera.alpha -= dx * 0.005;
        this.camera.beta -= dy * 0.005;
        this.camera.beta = Math.max(this.camera.lowerBetaLimit!, Math.min(this.camera.upperBetaLimit!, this.camera.beta));
      }
    });

    // Prevent context menu
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // ── Frame update ────────────────────────────────────────
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  // ── Key handlers ─────────────────────────────────────────────

  private onKeyDown(key: string, ev: KeyboardEvent): void {
    // Ability keys
    if (key === '1') this.bridge.useAbility(0);
    if (key === '2') this.bridge.useAbility(1);
    if (key === '3') this.bridge.useAbility(2);
    if (key === '4') this.bridge.useAbility(3);
    if (key === 'f') this.bridge.useAbility(4);
    if (key === 'r') this.bridge.useAbility(5);

    // Combat mode toggle
    if (key === 'tab') {
      ev.preventDefault();
      this.cycleTarget();
    }

    // Jump
    if (key === ' ') {
      if (this.grounded) {
        this.velocityY = JUMP_FORCE;
        this.grounded = false;
      }
      this.bridge.sendCombatEvent({ type: 'SPACE_DOWN' });
    }

    // Shift (sprint)
    if (key === 'shift') this.bridge.sendCombatEvent({ type: 'SHIFT_DOWN' });

    // E (interact / block)
    if (key === 'e') {
      if (this.nearbyInteractable) {
        this.interact(this.nearbyInteractable);
      } else {
        this.bridge.sendCombatEvent({ type: 'E_DOWN' });
      }
    }
  }

  private onKeyUp(key: string): void {
    if (key === ' ') this.bridge.sendCombatEvent({ type: 'SPACE_UP' });
    if (key === 'shift') this.bridge.sendCombatEvent({ type: 'SHIFT_UP' });
    if (key === 'e') this.bridge.sendCombatEvent({ type: 'E_UP' });
    if (key === 'r') this.bridge.sendCombatEvent({ type: 'R_UP' });
  }

  private onLMBDown(): void {
    this.bridge.sendCombatEvent({ type: 'LMB_DOWN' });
  }

  private onRMBDown(): void {
    this.bridge.sendCombatEvent({ type: 'RMB_DOWN' });
  }

  // ── Target cycling (WoW-style Tab targeting) ─────────────────

  private cycleTarget(): void {
    // Gather targetable meshes in range
    const pp = this.playerNode.position;
    this.targetMeshes = this.scene.meshes.filter(m => {
      if (!m.isEnabled() || !m.isVisible) return false;
      if (m.name === "player" || m.name.startsWith("island") || m.name.startsWith("ocean") ||
          m.name.startsWith("rock_t") || m.name.startsWith("skybox")) return false;
      const dist = Vector3.Distance(m.absolutePosition, pp);
      return dist < TARGET_RANGE && dist > 1;
    }).sort((a, b) =>
      Vector3.Distance(a.absolutePosition, pp) - Vector3.Distance(b.absolutePosition, pp)
    );

    if (this.targetMeshes.length === 0) {
      this.currentTarget = null;
      this.currentTargetIdx = -1;
      this.combatMode = false;
      return;
    }

    this.currentTargetIdx = (this.currentTargetIdx + 1) % this.targetMeshes.length;
    this.currentTarget = this.targetMeshes[this.currentTargetIdx];
    this.combatMode = true;
  }

  // ── Interaction ──────────────────────────────────────────────

  private interact(target: { type: string; name: string; mesh: AbstractMesh }): void {
    if (target.type === "harvest") {
      // Hit the resource node
      const atk = this.bridge.getSnapshot().atk;
      this.bridge.harvestNode(target.mesh.name, atk);
    } else if (target.type === "npc") {
      this.bridge.events.onInteractionPrompt.notifyObservers({
        type: "npc",
        name: target.name,
        worldPos: target.mesh.absolutePosition,
      });
    } else if (target.type === "crafting") {
      this.bridge.events.onInteractionPrompt.notifyObservers({
        type: "crafting",
        name: target.name,
        worldPos: target.mesh.absolutePosition,
      });
    }
  }

  // ── Frame update ─────────────────────────────────────────────

  private update(): void {
    const dt = this.scene.getEngine().getDeltaTime() * 0.001;
    const pp = this.playerNode.position;

    // ── Movement ────────────────────────────────────────────
    const sprinting = this.keys.has("shift");
    const speed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);

    // Camera forward direction (XZ plane)
    const camForward = new Vector3(
      Math.sin(this.camera.alpha),
      0,
      Math.cos(this.camera.alpha),
    ).normalize();
    const camRight = new Vector3(camForward.z, 0, -camForward.x);

    let moveDir = Vector3.Zero();

    // W = forward from camera (Fortnite-style)
    if (this.keys.has("w")) moveDir.addInPlace(camForward);
    if (this.keys.has("s")) moveDir.subtractInPlace(camForward);

    // A/D = turn character (camera follows)
    if (this.keys.has("a")) this.facing += TURN_SPEED * dt;
    if (this.keys.has("d")) this.facing -= TURN_SPEED * dt;

    // Q/E = strafe
    if (this.keys.has("q")) moveDir.subtractInPlace(camRight);
    if (this.keys.has("e") && !this.nearbyInteractable) moveDir.addInPlace(camRight);

    // In combat mode, face the target
    if (this.combatMode && this.currentTarget) {
      const toTarget = this.currentTarget.absolutePosition.subtract(pp);
      this.facing = Math.atan2(toTarget.x, toTarget.z);
    } else if (moveDir.lengthSquared() > 0.01) {
      // Face movement direction
      this.facing = Math.atan2(moveDir.x, moveDir.z);
    }

    // Apply movement
    if (moveDir.lengthSquared() > 0.01) {
      moveDir.normalize();
      pp.x += moveDir.x * speed * dt;
      pp.z += moveDir.z * speed * dt;
    }

    // Sprint stamina drain
    if (sprinting && moveDir.lengthSquared() > 0.01) {
      const snap = this.bridge.getSnapshot();
      if (snap.stamina > 0) {
        // Bridge handles stamina internally, we just signal sprint
      }
    }

    // ── Gravity / Jump + terrain raycast ──────────────────
    this.velocityY += GRAVITY * dt;
    this.playerY += this.velocityY * dt;

    // Raycast down to find terrain height
    let groundY = 0;
    const terrain = this.scene.getMeshByName("island");
    if (terrain) {
      const ray = new Ray(new Vector3(pp.x, pp.y + 50, pp.z), new Vector3(0, -1, 0), 100);
      const hit = ray.intersectsMesh(terrain as any);
      if (hit.hit && hit.pickedPoint) {
        groundY = hit.pickedPoint.y;
      }
    }
    if (this.playerY <= groundY) {
      this.playerY = groundY;
      this.velocityY = 0;
      this.grounded = true;
    }
    pp.y = this.playerY + 0.9;

    // Apply facing rotation
    this.playerNode.rotation = new Vector3(0, this.facing, 0);

    // ── Camera follow ───────────────────────────────────────
    const targetCamPos = new Vector3(
      pp.x - Math.sin(this.camera.alpha) * CAM_DISTANCE + camRight.x * CAM_SHOULDER_OFFSET,
      pp.y + CAM_HEIGHT_OFFSET,
      pp.z - Math.cos(this.camera.alpha) * CAM_DISTANCE + camRight.z * CAM_SHOULDER_OFFSET,
    );
    this.camera.target = Vector3.Lerp(this.camera.target, pp.add(new Vector3(0, 1.5, 0)), CAM_LERP);

    // ── Nearby interactable check ───────────────────────────
    this.nearbyInteractable = null;
    // Check resource nodes from bridge
    for (const [key, entry] of this.bridge.getResourceNodes()) {
      if (entry.instance.depleted) continue;
      const nodePos = new Vector3(entry.instance.worldX, pp.y, entry.instance.worldY);
      if (Vector3.Distance(nodePos, pp) < INTERACT_RANGE) {
        this.nearbyInteractable = {
          type: "harvest",
          name: entry.def.name,
          mesh: { name: key, absolutePosition: nodePos } as any,
        };
        break;
      }
    }

    // Show interaction prompt
    if (this.nearbyInteractable) {
      this.bridge.events.onInteractionPrompt.notifyObservers({
        type: this.nearbyInteractable.type,
        name: this.nearbyInteractable.name,
        worldPos: this.nearbyInteractable.mesh.absolutePosition,
      });
    } else {
      this.bridge.events.onInteractionPrompt.notifyObservers(null);
    }
  }

  // ── Public API ───────────────────────────────────────────────

  getCamera(): ArcRotateCamera { return this.camera; }
  getPlayerPosition(): Vector3 { return this.playerNode.position.clone(); }
  getFacing(): number { return this.facing; }
  isInCombatMode(): boolean { return this.combatMode; }
  getCurrentTarget(): AbstractMesh | null { return this.currentTarget; }

  dispose(): void {
    // Observers auto-clean with scene disposal
  }
}

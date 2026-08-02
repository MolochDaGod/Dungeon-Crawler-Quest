/**
 * Genesis Island 3D Scene Builder — Three.js
 *
 * Port of genesis-scene-builder.ts from BabylonJS to Three.js.
 * Uses: WebGL2, PBR terrain, animated water, instanced foliage,
 * GLB model loading, DOM-based character select & HUD overlays.
 */

import * as THREE from 'three';
import { loadGLB, createAnimatedEntity, playAnimation, type AnimatedEntity } from './model-loader';
import { GenesisGameBridge, type CharacterSnapshot, type HotbarSlot } from './genesis-game-bridge';
import { HEROES, CLASS_COLORS } from './types';

// ── Constants ──────────────────────────────────────────────────

const MODEL_PATHS = [
  '/assets/grudge-legacy/character/bambi.glb',
  '/assets/grudge-legacy/character/basefemale.glb',
  '/assets/grudge-legacy/character/villhelm.glb',
];
const SCALE_XZ = 2.5;
const SCALE_Y = 0.22;
const UNITY_CENTER_X = -133.3;
const UNITY_CENTER_Z = -155.6;
const UNITY_GROUND_SURFACE = -2880;

function unityToWorld(ux: number, uz: number, uy: number): THREE.Vector3 {
  return new THREE.Vector3(
    (ux - UNITY_CENTER_X) * SCALE_XZ,
    (uy - UNITY_GROUND_SURFACE) * SCALE_Y,
    (uz - UNITY_CENTER_Z) * SCALE_XZ,
  );
}

// ── Types ──────────────────────────────────────────────────────

interface SceneObject {
  name: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  children?: SceneObject[];
  components?: string[];
}

interface GenesisSceneData {
  sceneName: string;
  rootObjects: SceneObject[];
}

export interface CharacterSelectResult {
  race: string;
  heroClass: string;
  modelIndex: number;
}

export interface GenesisScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  bridge: GenesisGameBridge;
  controller: ThreePlayerController | null;
  hud: ThreeHUD | null;
  dispose: () => void;
}

// ── GLB loader with auto-scale ─────────────────────────────────

async function loadAndPlaceGLB(
  scene: THREE.Scene,
  path: string,
  targetHeight: number,
  pos: THREE.Vector3,
  castShadow = true,
): Promise<THREE.Group | null> {
  try {
    const model = await loadGLB(path);
    const root = model.scene;

    // Auto-scale based on bounding box
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxY = size.y || 1;
    const s = targetHeight / maxY;
    root.scale.setScalar(s);
    root.position.copy(pos);

    root.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = castShadow;
        child.receiveShadow = true;
      }
    });

    scene.add(root);
    return root;
  } catch (err) {
    console.warn(`[Genesis] Failed loading ${path}`, err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  DOM-Based Character Select (replaces BabylonJS GUI version)
// ══════════════════════════════════════════════════════════════

const RACES = ['Barbarian', 'Human', 'Dwarf', 'Elf', 'Undead', 'Orc'];
const CLASSES = ['Warrior', 'Mage', 'Ranger', 'Worg'];
const CLASS_COLORS_HEX: Record<string, string> = {
  Warrior: '#ef4444',
  Mage: '#8b5cf6',
  Ranger: '#22c55e',
  Worg: '#d97706',
};
const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: 'Melee powerhouse. Shields, swords, heavy armor.',
  Mage: 'Arcane spellcaster. Staves, tomes, cloth armor.',
  Ranger: 'Ranged precision. Bows, daggers, leather armor.',
  Worg: 'Shapeshifter. Bear, raptor, bird forms.',
};

function buildCharacterSelectOverlay(container: HTMLElement): {
  overlay: HTMLDivElement;
  previewCanvas: HTMLCanvasElement;
  waitForSelection: () => Promise<CharacterSelectResult>;
} {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute;inset:0;z-index:100;background:#0a0a1a;
    display:flex;align-items:center;justify-content:center;
    font-family:'Oxanium',monospace;color:#ccc;
  `;

  // 3D preview canvas (center)
  const previewCanvas = document.createElement('canvas');
  previewCanvas.style.cssText = 'width:400px;height:500px;border-radius:8px;';
  previewCanvas.width = 400;
  previewCanvas.height = 500;

  // Title
  const title = document.createElement('div');
  title.textContent = 'GENESIS ISLAND';
  title.style.cssText = `
    position:absolute;top:8%;width:100%;text-align:center;
    font-size:28px;color:#c5a059;font-family:'Cinzel',serif;
    text-shadow:0 0 12px rgba(197,160,89,0.4);
  `;

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Choose Your Champion';
  subtitle.style.cssText = 'position:absolute;top:14%;width:100%;text-align:center;font-size:14px;color:#888;';

  // Race panel (left)
  const racePanel = document.createElement('div');
  racePanel.style.cssText = `
    position:absolute;left:5%;top:50%;transform:translateY(-50%);
    background:rgba(0,0,0,0.7);border-radius:8px;border:1px solid #c5a05940;
    padding:16px;width:160px;
  `;
  const raceTitle = document.createElement('div');
  raceTitle.textContent = 'RACE';
  raceTitle.style.cssText = 'color:#c5a059;font-size:14px;margin-bottom:12px;text-align:center;';
  racePanel.appendChild(raceTitle);

  // Class panel (right)
  const classPanel = document.createElement('div');
  classPanel.style.cssText = `
    position:absolute;right:5%;top:50%;transform:translateY(-50%);
    background:rgba(0,0,0,0.7);border-radius:8px;border:1px solid #c5a05940;
    padding:16px;width:180px;
  `;
  const classTitle = document.createElement('div');
  classTitle.textContent = 'CLASS';
  classTitle.style.cssText = 'color:#c5a059;font-size:14px;margin-bottom:12px;text-align:center;';
  classPanel.appendChild(classTitle);

  const classDesc = document.createElement('div');
  classDesc.style.cssText = 'color:#888;font-size:11px;margin-top:12px;text-align:center;min-height:50px;';

  // Enter button
  const enterBtn = document.createElement('button');
  enterBtn.textContent = '⚔ ENTER WORLD ⚔';
  enterBtn.style.cssText = `
    position:absolute;bottom:8%;left:50%;transform:translateX(-50%);
    background:linear-gradient(135deg,#c5a059,#8b6914);color:#fff;
    border:none;padding:14px 40px;font-size:16px;cursor:pointer;
    border-radius:6px;font-family:'Cinzel',serif;
    box-shadow:0 0 20px rgba(197,160,89,0.4);transition:all 0.2s;
  `;
  enterBtn.onmouseenter = () => { enterBtn.style.transform = 'translateX(-50%) scale(1.05)'; };
  enterBtn.onmouseleave = () => { enterBtn.style.transform = 'translateX(-50%) scale(1)'; };

  overlay.append(title, subtitle, racePanel, previewCanvas, classPanel, enterBtn);
  container.appendChild(overlay);

  // State
  let selectedRace = 0;
  let selectedClass = 0;
  let selectedModel = 0;

  const raceButtons: HTMLButtonElement[] = [];
  const classButtons: HTMLButtonElement[] = [];

  const btnStyle = (active: boolean, color = '#c5a059') => `
    display:block;width:100%;padding:8px;margin:4px 0;
    background:${active ? color + '30' : 'rgba(30,30,40,0.8)'};
    color:${active ? color : '#888'};
    border:1px solid ${active ? color : '#333'};border-radius:4px;
    cursor:pointer;font-size:13px;font-family:'Oxanium',monospace;
    transition:all 0.15s;
  `;

  function updateRace(idx: number) {
    selectedRace = idx;
    selectedModel = idx % MODEL_PATHS.length;
    raceButtons.forEach((b, i) => { b.style.cssText = btnStyle(i === idx); });
  }

  function updateClass(idx: number) {
    selectedClass = idx;
    classButtons.forEach((b, i) => {
      b.style.cssText = btnStyle(i === idx, CLASS_COLORS_HEX[CLASSES[i]]);
    });
    classDesc.textContent = CLASS_DESCRIPTIONS[CLASSES[idx]] || '';
  }

  RACES.forEach((race, i) => {
    const btn = document.createElement('button');
    btn.textContent = race;
    btn.onclick = () => updateRace(i);
    racePanel.appendChild(btn);
    raceButtons.push(btn);
  });

  CLASSES.forEach((cls, i) => {
    const btn = document.createElement('button');
    btn.textContent = cls;
    btn.onclick = () => updateClass(i);
    classPanel.appendChild(btn);
    classButtons.push(btn);
  });
  classPanel.appendChild(classDesc);

  updateRace(0);
  updateClass(0);

  const waitForSelection = () => new Promise<CharacterSelectResult>(resolve => {
    enterBtn.onclick = () => {
      resolve({
        race: RACES[selectedRace],
        heroClass: CLASSES[selectedClass],
        modelIndex: selectedModel,
      });
    };
  });

  return { overlay, previewCanvas, waitForSelection };
}

// ══════════════════════════════════════════════════════════════
//  DOM-Based HUD (replaces BabylonJS GUI)
// ══════════════════════════════════════════════════════════════

class ThreeHUD {
  private root: HTMLDivElement;
  private hpFill!: HTMLDivElement;
  private mpFill!: HTMLDivElement;
  private staminaFill!: HTMLDivElement;
  private hpText!: HTMLSpanElement;
  private mpText!: HTMLSpanElement;
  private xpFill!: HTMLDivElement;
  private nameText!: HTMLDivElement;
  private levelText!: HTMLDivElement;
  private goldText!: HTMLDivElement;
  private interactPrompt!: HTMLDivElement;
  private hotbarSlots: HTMLDivElement[] = [];

  constructor(private container: HTMLElement, private bridge: GenesisGameBridge) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:10;font-family:"Oxanium",monospace;';
    container.appendChild(this.root);

    this.buildPlayerFrame();
    this.buildResourceBars();
    this.buildHotbar();
    this.buildXPBar();
    this.buildInteractPrompt();

    bridge.events.onStatsChanged.add(snap => this.updateStats(snap));
    bridge.events.onInteractionPrompt.add(data => {
      this.interactPrompt.style.display = data ? 'block' : 'none';
      if (data) this.interactPrompt.textContent = `[E] ${data.name}`;
    });

    this.updateStats(bridge.getSnapshot());
  }

  private buildPlayerFrame(): void {
    const f = document.createElement('div');
    f.style.cssText = 'position:absolute;top:12px;left:12px;background:rgba(0,0,0,0.75);border-radius:6px;border:1px solid #c5a05960;padding:8px 12px;';
    this.nameText = this.el('div', '#c5a059', '13px');
    this.levelText = this.el('div', '#888', '11px');
    this.goldText = this.el('div', '#f59e0b', '11px');
    f.append(this.nameText, this.levelText, this.goldText);
    this.root.appendChild(f);
  }

  private buildResourceBars(): void {
    const c = document.createElement('div');
    c.style.cssText = 'position:absolute;top:12px;left:265px;display:flex;flex-direction:column;gap:3px;';

    const hp = this.createBar('#ef4444', '#7f1d1d', 22);
    this.hpFill = hp.fill; this.hpText = hp.text;

    const mp = this.createBar('#3b82f6', '#1e3a5f', 18);
    this.mpFill = mp.fill; this.mpText = mp.text;

    const sta = this.createBar('#f59e0b', '#78350f', 10);
    this.staminaFill = sta.fill;

    c.append(hp.bar, mp.bar, sta.bar);
    this.root.appendChild(c);
  }

  private createBar(fillColor: string, bgColor: string, h: number) {
    const bar = document.createElement('div');
    bar.style.cssText = `width:220px;height:${h}px;background:${bgColor};border-radius:${h / 2}px;position:relative;overflow:hidden;`;
    const fill = document.createElement('div');
    fill.style.cssText = `height:100%;background:${fillColor};border-radius:${h / 2}px;width:100%;transition:width 0.2s;`;
    const text = document.createElement('span');
    text.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.min(h - 4, 12)}px;text-shadow:0 1px 2px #000;`;
    bar.append(fill, text);
    return { bar, fill, text };
  }

  private buildHotbar(): void {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:4px;background:rgba(0,0,0,0.7);border-radius:8px;border:1px solid #c5a05940;padding:6px;';
    const keys = ['1', '2', '3', '4', '', 'F', 'R', '7', '8'];
    const colors = ['#ef4444', '#ef4444', '#ef4444', '#ef4444', '', '#8b5cf6', '#8b5cf6', '#22c55e', '#22c55e'];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      if (i === 4) {
        slot.style.cssText = 'width:8px;';
      } else {
        slot.style.cssText = `width:46px;height:46px;background:rgba(20,20,30,0.8);border-radius:4px;border:1px solid ${colors[i]};position:relative;display:flex;align-items:center;justify-content:center;`;
        const key = document.createElement('span');
        key.textContent = keys[i];
        key.style.cssText = 'position:absolute;top:2px;left:4px;font-size:9px;color:#888;';
        slot.appendChild(key);
      }
      bg.appendChild(slot);
      this.hotbarSlots.push(slot);
    }
    this.root.appendChild(bg);
  }

  private buildXPBar(): void {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:440px;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;';
    this.xpFill = document.createElement('div');
    this.xpFill.style.cssText = 'height:100%;background:#22d3ee;border-radius:3px;width:0%;transition:width 0.3s;';
    bg.appendChild(this.xpFill);
    this.root.appendChild(bg);
  }

  private buildInteractPrompt(): void {
    this.interactPrompt = document.createElement('div');
    this.interactPrompt.style.cssText = `
      position:absolute;top:55%;left:50%;transform:translateX(-50%);
      background:rgba(0,0,0,0.7);border-radius:6px;border:1px solid #22d3ee40;
      padding:8px 16px;color:#22d3ee;font-size:13px;display:none;
    `;
    this.root.appendChild(this.interactPrompt);
  }

  private el(tag: string, color: string, size: string): HTMLDivElement {
    const e = document.createElement(tag) as HTMLDivElement;
    e.style.cssText = `color:${color};font-size:${size};`;
    return e;
  }

  private updateStats(snap: CharacterSnapshot): void {
    const hpPct = snap.maxHp > 0 ? snap.hp / snap.maxHp * 100 : 0;
    const mpPct = snap.maxMp > 0 ? snap.mp / snap.maxMp * 100 : 0;
    const staPct = snap.maxStamina > 0 ? snap.stamina / snap.maxStamina * 100 : 0;
    this.hpFill.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;
    this.mpFill.style.width = `${Math.max(0, Math.min(100, mpPct))}%`;
    this.staminaFill.style.width = `${Math.max(0, Math.min(100, staPct))}%`;
    this.hpText.textContent = `${Math.floor(snap.hp)} / ${snap.maxHp}`;
    this.mpText.textContent = `${Math.floor(snap.mp)} / ${snap.maxMp}`;

    const xpPct = snap.xpToNext > 0 ? snap.xp / snap.xpToNext * 100 : 0;
    this.xpFill.style.width = `${Math.max(0, Math.min(100, xpPct))}%`;

    this.nameText.textContent = snap.name;
    this.levelText.textContent = `${snap.race} ${snap.heroClass} · Lv${snap.level}`;
    this.goldText.textContent = `💰 ${snap.gold}`;
  }

  dispose(): void {
    this.root.remove();
  }
}

// ══════════════════════════════════════════════════════════════
//  Three.js Player Controller (replaces BabylonJS version)
// ══════════════════════════════════════════════════════════════

const MOVE_SPEED = 8;
const SPRINT_MULT = 1.8;
const TURN_SPEED = 3.0;
const JUMP_FORCE = 12;
const CTRL_GRAVITY = -25;
const CAM_DISTANCE = 12;
const CAM_HEIGHT_OFFSET = 4;
const CAM_SHOULDER_OFFSET = 2;
const CAM_LERP = 0.08;
const INTERACT_RANGE = 4;

class ThreePlayerController {
  private keys = new Set<string>();
  private lmbDown = false;
  private velocityY = 0;
  private grounded = true;
  private playerY = 0;
  private facing = 0;
  private cameraAlpha = Math.PI; // behind player
  private combatMode = false;
  private disposed = false;

  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;
  private _onMouseDown: (e: MouseEvent) => void;
  private _onMouseUp: (e: MouseEvent) => void;
  private _onMouseMove: (e: MouseEvent) => void;
  private _onContext: (e: Event) => void;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private bridge: GenesisGameBridge,
    private playerMesh: THREE.Object3D,
    private terrainMesh: THREE.Mesh,
    private canvas: HTMLCanvasElement,
  ) {
    this.playerY = playerMesh.position.y;

    // Raycaster for terrain
    const raycaster = new THREE.Raycaster();
    const downDir = new THREE.Vector3(0, -1, 0);

    this._onKeyDown = (e: KeyboardEvent) => {
      if (this.disposed) return;
      const key = e.key.toLowerCase();
      this.keys.add(key);
      if (key === '1') this.bridge.useAbility(0);
      if (key === '2') this.bridge.useAbility(1);
      if (key === '3') this.bridge.useAbility(2);
      if (key === '4') this.bridge.useAbility(3);
      if (key === 'f') this.bridge.useAbility(4);
      if (key === 'r') this.bridge.useAbility(5);
      if (key === 'tab') { e.preventDefault(); this.combatMode = !this.combatMode; }
      if (key === ' ' && this.grounded) {
        this.velocityY = JUMP_FORCE;
        this.grounded = false;
        this.bridge.sendCombatEvent({ type: 'SPACE_DOWN' });
      }
      if (key === 'shift') this.bridge.sendCombatEvent({ type: 'SHIFT_DOWN' });
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      if (this.disposed) return;
      const key = e.key.toLowerCase();
      this.keys.delete(key);
      if (key === ' ') this.bridge.sendCombatEvent({ type: 'SPACE_UP' });
      if (key === 'shift') this.bridge.sendCombatEvent({ type: 'SHIFT_UP' });
    };

    this._onMouseDown = (e: MouseEvent) => {
      if (this.disposed) return;
      if (e.button === 0) { this.lmbDown = true; this.bridge.sendCombatEvent({ type: 'LMB_DOWN' }); }
      if (e.button === 2) this.bridge.sendCombatEvent({ type: 'RMB_DOWN' });
    };

    this._onMouseUp = (e: MouseEvent) => {
      if (this.disposed) return;
      if (e.button === 0) { this.lmbDown = false; this.bridge.sendCombatEvent({ type: 'LMB_UP' }); }
      if (e.button === 2) this.bridge.sendCombatEvent({ type: 'RMB_UP' });
    };

    this._onMouseMove = (e: MouseEvent) => {
      if (this.disposed || !this.lmbDown) return;
      this.cameraAlpha -= e.movementX * 0.005;
    };

    this._onContext = (e: Event) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  update(dt: number): void {
    if (this.disposed) return;
    const pp = this.playerMesh.position;

    const sprinting = this.keys.has('shift');
    const speed = MOVE_SPEED * (sprinting ? SPRINT_MULT : 1);

    // Camera forward on XZ plane
    const camForward = new THREE.Vector3(
      Math.sin(this.cameraAlpha), 0, Math.cos(this.cameraAlpha),
    ).normalize();
    const camRight = new THREE.Vector3(camForward.z, 0, -camForward.x);

    const moveDir = new THREE.Vector3();
    if (this.keys.has('w')) moveDir.add(camForward);
    if (this.keys.has('s')) moveDir.sub(camForward);
    if (this.keys.has('a')) this.facing += TURN_SPEED * dt;
    if (this.keys.has('d')) this.facing -= TURN_SPEED * dt;
    if (this.keys.has('q')) moveDir.sub(camRight);
    if (this.keys.has('e')) moveDir.add(camRight);

    if (moveDir.lengthSq() > 0.01) {
      this.facing = Math.atan2(moveDir.x, moveDir.z);
      moveDir.normalize();
      pp.x += moveDir.x * speed * dt;
      pp.z += moveDir.z * speed * dt;
    }

    // Gravity + terrain raycast
    this.velocityY += CTRL_GRAVITY * dt;
    this.playerY += this.velocityY * dt;

    // Simple ground check via raycaster
    const rayOrigin = new THREE.Vector3(pp.x, pp.y + 50, pp.z);
    const raycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, 100);
    const hits = raycaster.intersectObject(this.terrainMesh);
    let groundY = 0;
    if (hits.length > 0) groundY = hits[0].point.y;

    if (this.playerY <= groundY) {
      this.playerY = groundY;
      this.velocityY = 0;
      this.grounded = true;
    }
    pp.y = this.playerY + 0.9;
    this.playerMesh.rotation.y = this.facing;

    // Camera follow (over-the-shoulder)
    const targetPos = new THREE.Vector3(
      pp.x - Math.sin(this.cameraAlpha) * CAM_DISTANCE + camRight.x * CAM_SHOULDER_OFFSET,
      pp.y + CAM_HEIGHT_OFFSET,
      pp.z - Math.cos(this.cameraAlpha) * CAM_DISTANCE + camRight.z * CAM_SHOULDER_OFFSET,
    );
    this.camera.position.lerp(targetPos, CAM_LERP);
    const lookTarget = new THREE.Vector3(pp.x, pp.y + 1.5, pp.z);
    this.camera.lookAt(lookTarget);

    // Interaction proximity
    let nearNode = false;
    for (const [key, entry] of this.bridge.getResourceNodes()) {
      if (entry.instance.depleted) continue;
      const nodePos = new THREE.Vector3(entry.instance.worldX, pp.y, entry.instance.worldY);
      if (nodePos.distanceTo(pp) < INTERACT_RANGE) {
        this.bridge.events.onInteractionPrompt.notifyObservers({
          type: 'harvest', name: entry.def.name, worldPos: nodePos,
        });
        nearNode = true;
        break;
      }
    }
    if (!nearNode) this.bridge.events.onInteractionPrompt.notifyObservers(null);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}

// ══════════════════════════════════════════════════════════════
//  Main Builder
// ══════════════════════════════════════════════════════════════

export async function buildGenesisScene(container: HTMLElement): Promise<GenesisScene> {
  // ── Character Select (DOM overlay) ───────────────────────
  const charSelect = buildCharacterSelectOverlay(container);

  // Small Three.js preview scene for character model in select screen
  const previewRenderer = new THREE.WebGLRenderer({
    canvas: charSelect.previewCanvas,
    antialias: true,
    alpha: true,
  });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  previewRenderer.setSize(400, 500);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const previewScene = new THREE.Scene();
  const previewCam = new THREE.PerspectiveCamera(35, 400 / 500, 0.1, 50);
  previewCam.position.set(0, 1.2, 4);
  previewCam.lookAt(0, 0.8, 0);

  previewScene.add(new THREE.HemisphereLight(0x6688bb, 0x2d1f0a, 0.8));
  const previewKey = new THREE.DirectionalLight(0xffeedd, 1.5);
  previewKey.position.set(-2, 4, 3);
  previewScene.add(previewKey);

  // Pedestal
  const pedestalGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32);
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x251e18, roughness: 0.3, metalness: 0.6 });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = -0.15;
  previewScene.add(pedestal);

  // Load first character preview model
  let previewModel: THREE.Group | null = null;
  try {
    const m = await loadGLB(MODEL_PATHS[0]);
    previewModel = m.scene;
    const box = new THREE.Box3().setFromObject(previewModel);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    previewModel.scale.setScalar(1.8 / (sz.y || 1));
    previewScene.add(previewModel);
  } catch { /* fallback: just pedestal */ }

  // Spin preview
  let previewRot = 0;
  let previewRunning = true;
  const animatePreview = () => {
    if (!previewRunning) return;
    previewRot += 0.005;
    if (previewModel) previewModel.rotation.y = previewRot;
    previewRenderer.render(previewScene, previewCam);
    requestAnimationFrame(animatePreview);
  };
  animatePreview();

  // Wait for player to choose
  const selection = await charSelect.waitForSelection();
  previewRunning = false;
  previewRenderer.dispose();
  charSelect.overlay.remove();
  console.log(`[Genesis] Selected: ${selection.race} ${selection.heroClass}`);

  // ── Main canvas + renderer ─────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;outline:none;display:block;';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ── Scene ──────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8cc6f2);
  scene.fog = new THREE.Fog(0x8cc6f2, 400, 2500);

  // ── Camera ─────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.5, 5000,
  );
  camera.position.set(0, 25, -30);
  camera.lookAt(0, 5, 0);

  // ── Lighting ───────────────────────────────────────────
  const hemiLight = new THREE.HemisphereLight(0xf0f0ff, 0x283420, 0.5);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d9, 1.8);
  sunLight.position.set(300, 400, 200);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -200;
  sunLight.shadow.camera.right = 200;
  sunLight.shadow.camera.top = 200;
  sunLight.shadow.camera.bottom = -200;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 1000;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  scene.add(sunLight);

  // ── Terrain ────────────────────────────────────────────
  const islandW = 734 * SCALE_XZ;
  const islandD = 689 * SCALE_XZ;
  const terrainGeo = new THREE.PlaneGeometry(islandW, islandD, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);

  // Apply island heightmap (procedural hills with falloff)
  const positions = terrainGeo.attributes.position;
  const halfW = islandW / 2;
  const halfD = islandD / 2;
  for (let i = 0; i < positions.count; i++) {
    const lx = positions.getX(i);
    const lz = positions.getZ(i);
    const dx = lx / halfW;
    const dz = lz / halfD;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const falloff = Math.max(0, 1 - dist * dist);
    const noise = Math.sin(lx * 0.02 + lz * 0.015) * 3 +
                  Math.cos(lx * 0.035 - lz * 0.025) * 2 +
                  Math.sin(lx * 0.008) * 5 +
                  Math.sin(lz * 0.012 + lx * 0.006) * 3;
    let y = falloff * (12 + noise) - 2;
    if (dist > 0.85) y = Math.min(y, -3);
    positions.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  // Grass texture
  const textureLoader = new THREE.TextureLoader();
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x4a7a3a,
    roughness: 0.85,
    metalness: 0,
  });
  try {
    const grassAlbedo = textureLoader.load('/assets/textures/terrain/Grass_3_Albedo.png');
    grassAlbedo.wrapS = grassAlbedo.wrapT = THREE.RepeatWrapping;
    grassAlbedo.repeat.set(40, 40);
    terrainMat.map = grassAlbedo;

    const grassNormal = textureLoader.load('/assets/textures/terrain/Grass_3_Normal.png');
    grassNormal.wrapS = grassNormal.wrapT = THREE.RepeatWrapping;
    grassNormal.repeat.set(40, 40);
    terrainMat.normalMap = grassNormal;
  } catch { /* fallback color only */ }

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // ── Ocean ──────────────────────────────────────────────
  const oceanGeo = new THREE.PlaneGeometry(6000, 6000, 32, 32);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x0f3359,
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
  oceanMesh.position.y = -1;
  oceanMesh.receiveShadow = true;
  scene.add(oceanMesh);

  // ── Load scene hierarchy ───────────────────────────────
  let sceneData: GenesisSceneData | null = null;
  try {
    const res = await fetch('/genesis-scene-data.json');
    if (res.ok) sceneData = await res.json();
  } catch { /* fallback procedural */ }

  // ── Classify objects ───────────────────────────────────
  const treePositions: THREE.Vector3[] = [];
  const rockPositions: THREE.Vector3[] = [];
  const buildingPositions: { pos: THREE.Vector3; name: string }[] = [];
  const npcPositions: { pos: THREE.Vector3; name: string }[] = [];
  const spawnerPositions: { pos: THREE.Vector3; name: string; level: number }[] = [];
  const raceStarts: Record<string, THREE.Vector3> = {};

  function classify(objects: SceneObject[], parentName = '') {
    for (const obj of objects) {
      const name = obj.name.toLowerCase();
      const p = obj.position;
      const wp = unityToWorld(p.x, p.z, p.y);

      if (name.includes('start') && !name.includes('pvp')) {
        for (const race of ['barbarian', 'human', 'dwarf', 'elf', 'undead', 'orc']) {
          if (name.includes(race)) raceStarts[race] = wp;
        }
      }

      if (/dealer|vendor|trainer|watchman|scout|guard|commander/.test(name)) {
        npcPositions.push({ pos: wp, name: obj.name });
      }
      const lvMatch = name.match(/lv(\d+)/);
      if (name.includes('spawner') && lvMatch) {
        spawnerPositions.push({ pos: wp, name: obj.name, level: parseInt(lvMatch[1]) });
      }

      if (/genesis island|harbor|mine|cave/.test(parentName)) {
        if (/tree|willow|palm|pine|oak|birch/.test(name)) treePositions.push(wp);
        else if (/rock|stone|boulder/.test(name)) rockPositions.push(wp);
        else if (/house|building|tavern|windmill|camp|armory|stable|dock|gate|wall|tower/.test(name)) {
          buildingPositions.push({ pos: wp, name: obj.name });
        }
      }

      if (obj.children && !name.includes('pvp arena')) classify(obj.children, name);
    }
  }

  if (sceneData) {
    classify(sceneData.rootObjects);
    const gi = sceneData.rootObjects.find(o => o.name === 'genesis island');
    if (gi?.children) classify(gi.children, 'genesis island');
  }

  // Fallback procedural
  if (treePositions.length === 0) {
    for (let i = 0; i < 300; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 700;
      treePositions.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 50 + Math.random() * 750;
      rockPositions.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
  }

  console.log(
    `[Genesis] Classified: ${treePositions.length} trees, ${rockPositions.length} rocks, ` +
    `${buildingPositions.length} buildings, ${npcPositions.length} NPCs, ` +
    `${spawnerPositions.length} spawners, ${Object.keys(raceStarts).length} race starts`,
  );

  // ── Rocks (instanced mesh — immediate) ─────────────────
  if (rockPositions.length > 0) {
    const rockGeo = new THREE.SphereGeometry(1, 6, 4);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.9, metalness: 0 });
    const rockIM = new THREE.InstancedMesh(rockGeo, rockMat, rockPositions.length);
    rockIM.receiveShadow = true;
    rockIM.castShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < rockPositions.length; i++) {
      const p = rockPositions[i];
      const s = 0.5 + Math.random() * 2;
      dummy.position.set(p.x, p.y + s * 0.2, p.z);
      dummy.scale.set(s, s * 0.6, s * (0.8 + Math.random() * 0.4));
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.updateMatrix();
      rockIM.setMatrixAt(i, dummy.matrix);
    }
    scene.add(rockIM);
    console.log(`[Genesis] Rocks: ${rockPositions.length} instanced`);
  }

  // ── Player capsule placeholder ─────────────────────────
  const spawnPos = new THREE.Vector3(0, 10, 0);
  const playerGeo = new THREE.CapsuleGeometry(0.4, 1.0, 8, 16);
  const playerMat = new THREE.MeshStandardMaterial({ color: 0x3399ee, roughness: 0.6 });
  const playerCap = new THREE.Mesh(playerGeo, playerMat);
  playerCap.position.copy(spawnPos);
  playerCap.position.y += 1;
  playerCap.castShadow = true;
  scene.add(playerCap);

  camera.position.set(0, 25, -30);
  camera.lookAt(spawnPos);

  // ── Game Bridge ────────────────────────────────────────
  const bridge = new GenesisGameBridge(scene);
  bridge.spawnNodesForBiome('forest', treePositions.slice(0, 50));
  bridge.spawnNodesForBiome('cave', rockPositions.slice(0, 30));

  // ── Player Controller ──────────────────────────────────
  const controller = new ThreePlayerController(scene, camera, bridge, playerCap, terrainMesh, canvas);

  // ── HUD ────────────────────────────────────────────────
  const hud = new ThreeHUD(container, bridge);

  // ── Render loop ────────────────────────────────────────
  const clock = new THREE.Clock();
  let animFrameId = 0;
  let disposed = false;

  function renderLoop() {
    if (disposed) return;
    animFrameId = requestAnimationFrame(renderLoop);
    const dt = clock.getDelta();
    bridge.update(dt);
    controller.update(dt);
    renderer.render(scene, camera);
  }
  renderLoop();

  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);
  console.log('[Genesis] Render loop started — terrain + player visible');

  // ── Background: load GLB models ────────────────────────
  const treeGLBs = [
    '/assets/grudge-legacy/environment/pine_tree.glb',
    '/assets/grudge-legacy/environment/oak_tree.glb',
    '/assets/grudge-legacy/environment/birch_tree.glb',
    '/assets/grudge-legacy/environment/willow_tree.glb',
  ];
  const treesPerModel = Math.ceil(treePositions.length / treeGLBs.length);

  const bldgMap: Record<string, string> = {
    house: '/assets/grudge-legacy/building/wooden_house.glb',
    tavern: '/assets/grudge-legacy/building/tavern.glb',
    windmill: '/assets/grudge-legacy/building/windmill.glb',
    wall: '/assets/grudge-legacy/building/wall.glb',
    tower: '/assets/grudge-legacy/building/wall_tower.glb',
  };
  const npcModels = [
    '/assets/grudge-legacy/character/bambi.glb',
    '/assets/grudge-legacy/character/basefemale.glb',
    '/assets/grudge-legacy/character/villhelm.glb',
  ];
  const monsterMap: Record<number, string[]> = {
    5: ['/assets/grudge-legacy/monster/wolf.glb', '/assets/grudge-legacy/monster/bat.glb'],
    10: ['/assets/grudge-legacy/monster/bear.glb', '/assets/grudge-legacy/monster/arachnid.glb'],
    15: ['/assets/grudge-legacy/monster/gargoyle.glb', '/assets/grudge-legacy/monster/reptilian.glb'],
    20: ['/assets/grudge-legacy/monster/juggernaut.glb', '/assets/grudge-legacy/monster/hunter_boss.glb'],
  };

  (async () => {
    // Load player character GLB
    const charGlb = MODEL_PATHS[selection.modelIndex] || MODEL_PATHS[0];
    const charNode = await loadAndPlaceGLB(scene, charGlb, 1.8, spawnPos);
    if (charNode) {
      charNode.name = 'player_model';
      charNode.position.y = spawnPos.y + 0.1;
      playerCap.visible = false;
      // Follow capsule position each frame (piggybacked on render loop)
      const followPlayer = () => {
        if (disposed) return;
        charNode.position.set(playerCap.position.x, playerCap.position.y - 0.9, playerCap.position.z);
        charNode.rotation.copy(playerCap.rotation);
        requestAnimationFrame(followPlayer);
      };
      followPlayer();
      console.log('[Genesis] Player model loaded');
    }

    // Trees (instanced per GLB type)
    for (let ti = 0; ti < treeGLBs.length; ti++) {
      const subset = treePositions.slice(ti * treesPerModel, (ti + 1) * treesPerModel);
      if (subset.length === 0) continue;
      try {
        const model = await loadGLB(treeGLBs[ti]);
        const root = model.scene;

        // Measure
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxE = Math.max(size.x, size.y, size.z);
        const bs = maxE > 0 ? 8 / maxE : 0.02;

        // Create instanced mesh from first mesh in the GLB
        let templateGeometry: THREE.BufferGeometry | null = null;
        let templateMaterial: THREE.Material | THREE.Material[] | null = null;
        root.traverse(child => {
          if (!templateGeometry && (child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            templateGeometry = m.geometry;
            templateMaterial = m.material;
          }
        });

        if (templateGeometry) {
          const im = new THREE.InstancedMesh(
            templateGeometry,
            templateMaterial || new THREE.MeshStandardMaterial({ color: 0x2a5a1a }),
            subset.length,
          );
          im.castShadow = true;
          im.receiveShadow = true;
          const dummy = new THREE.Object3D();
          for (let i = 0; i < subset.length; i++) {
            const s = bs * (0.6 + Math.random() * 0.8);
            dummy.position.copy(subset[i]);
            dummy.scale.setScalar(s);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
          }
          scene.add(im);
        }

        console.log(`[Genesis] Trees: ${subset.length}x ${treeGLBs[ti].split('/').pop()}`);
      } catch { /* skip failed tree */ }
    }

    // Buildings (limit 5 per type)
    const bldgGroups: Record<string, THREE.Vector3[]> = {};
    for (const b of buildingPositions) {
      const n = b.name.toLowerCase();
      let type = 'house';
      if (n.includes('tavern')) type = 'tavern';
      else if (n.includes('windmill')) type = 'windmill';
      else if (n.includes('tower')) type = 'tower';
      else if (/wall|gate|stake/.test(n)) type = 'wall';
      (bldgGroups[type] ||= []).push(b.pos);
    }

    for (const [type, posArr] of Object.entries(bldgGroups)) {
      const glbPath = bldgMap[type] || bldgMap.house;
      const cap = Math.min(posArr.length, 5);
      const targetH = type === 'wall' ? 4 : type === 'tower' ? 8 : 6;
      for (let i = 0; i < cap; i++) {
        await loadAndPlaceGLB(scene, glbPath, targetH, posArr[i]);
      }
      console.log(`[Genesis] Buildings: ${cap}x ${type}`);
    }

    // NPCs (limit 5)
    for (let i = 0; i < Math.min(npcPositions.length, 5); i++) {
      await loadAndPlaceGLB(scene, npcModels[i % npcModels.length], 1.8, npcPositions[i].pos);
    }

    // Monsters (limit 5)
    for (const sp of spawnerPositions.slice(0, 5)) {
      const models = monsterMap[sp.level] || monsterMap[5];
      await loadAndPlaceGLB(scene, models[Math.floor(Math.random() * models.length)], 1 + sp.level * 0.1, sp.pos);
    }

    console.log('[Genesis] Background loading complete');
  })();

  return {
    renderer, scene, camera, bridge, controller, hud,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(animFrameId);
      hud.dispose();
      controller.dispose();
      bridge.dispose();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.clear();
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    },
  };
}

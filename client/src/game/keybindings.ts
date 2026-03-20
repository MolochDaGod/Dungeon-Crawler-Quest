/**
 * Unified Keybind System — One controller for ALL game modes
 * Albion-style layout: Q/W/E weapon skills, R ultimate, 1-2 consumables
 * WASD movement, LMB attack, RMB ranged, Shift sprint, Space dodge
 */
export enum KeybindAction {
  // ── Movement (all modes) ──
  MoveUp = 'MoveUp',
  MoveDown = 'MoveDown',
  MoveLeft = 'MoveLeft',
  MoveRight = 'MoveRight',
  Sprint = 'Sprint',

  // ── Combat (unified — same in MMO, Arena, Dungeon) ──
  LightAttack = 'LightAttack',       // LMB — melee auto-attack
  RangedAttack = 'RangedAttack',     // RMB — class ranged attack
  DodgeRoll = 'DodgeRoll',           // Space — dodge with i-frames

  // ── Weapon Skills (Q/W/E — from equipped weapon, Albion style) ──
  WeaponQ = 'WeaponQ',               // Q — fast weapon skill (2-5s CD)
  WeaponW = 'WeaponW',               // W — secondary weapon skill (10-15s CD)
  WeaponE = 'WeaponE',               // E — weapon unique skill
  ClassUltimate = 'ClassUltimate',   // R — class ultimate (always)

  // ── Consumables ──
  Consumable1 = 'Consumable1',       // 1 — health potion / food
  Consumable2 = 'Consumable2',       // 2 — mana potion / buff

  // ── Interaction ──
  Interact = 'Interact',             // F — NPC, chest, harvest, doors
  TargetLock = 'TargetLock',         // Tab — cycle nearest enemy

  // ── UI Toggles ──
  ToggleInventory = 'ToggleInventory',   // I
  ToggleCharPanel = 'ToggleCharPanel',   // C
  ToggleMissions = 'ToggleMissions',     // J
  ToggleSkillTree = 'ToggleSkillTree',   // N
  ToggleShop = 'ToggleShop',             // B
  ToggleScoreboard = 'ToggleScoreboard', // (Arena only)
  Pause = 'Pause',                       // Escape

  // ── Camera ──
  ZoomIn = 'ZoomIn',
  ZoomOut = 'ZoomOut',

  // ── Legacy aliases (kept for backward compat, map to unified actions) ──
  Ability1 = 'Ability1',   // alias for WeaponQ
  Ability2 = 'Ability2',   // alias for WeaponW
  Ability3 = 'Ability3',   // alias for WeaponE
  Ability4 = 'Ability4',   // alias for ClassUltimate
  Ability5 = 'Ability5',   // alias for Consumable1
  Ability6 = 'Ability6',   // alias for Consumable2
  DungeonAbility1 = 'DungeonAbility1', // alias for WeaponQ
  DungeonAbility2 = 'DungeonAbility2', // alias for WeaponW
  DungeonAbility3 = 'DungeonAbility3', // alias for WeaponE
  DungeonAbility4 = 'DungeonAbility4', // alias for ClassUltimate
  DungeonAbility5 = 'DungeonAbility5', // alias for Consumable1
  HeavyAttack = 'HeavyAttack',         // alias for RangedAttack
  LevelUpAbility1 = 'LevelUpAbility1',
  LevelUpAbility2 = 'LevelUpAbility2',
  LevelUpAbility3 = 'LevelUpAbility3',
  LevelUpAbility4 = 'LevelUpAbility4',
  LevelUpAbility5 = 'LevelUpAbility5',
  LevelUpAbility6 = 'LevelUpAbility6',
  Attack = 'Attack',           // alias for LightAttack
  AttackMove = 'AttackMove',   // deprecated
  MoveToTarget = 'MoveToTarget', // deprecated
  CameraPan = 'CameraPan',
  CenterCamera = 'CenterCamera',
  StopMove = 'StopMove',
  Dodge = 'Dodge',             // alias for DodgeRoll
  DashAttack = 'DashAttack',   // deprecated
  Block = 'Block',             // deprecated (use DodgeRoll)
  Item1 = 'Item1',             // alias for Consumable1
  Item2 = 'Item2',             // alias for Consumable2
  Item3 = 'Item3',
  Item4 = 'Item4',
  Item5 = 'Item5',
  Item6 = 'Item6',
}

// Unified categories — no more MOBA vs MMO split
export const ACTION_CATEGORIES: Record<string, KeybindAction[]> = {
  Movement: [KeybindAction.MoveUp, KeybindAction.MoveDown, KeybindAction.MoveLeft, KeybindAction.MoveRight, KeybindAction.Sprint],
  Combat: [KeybindAction.LightAttack, KeybindAction.RangedAttack, KeybindAction.DodgeRoll],
  'Weapon Skills': [KeybindAction.WeaponQ, KeybindAction.WeaponW, KeybindAction.WeaponE, KeybindAction.ClassUltimate],
  Consumables: [KeybindAction.Consumable1, KeybindAction.Consumable2],
  Interaction: [KeybindAction.Interact, KeybindAction.TargetLock],
  UI: [KeybindAction.ToggleInventory, KeybindAction.ToggleCharPanel, KeybindAction.ToggleMissions, KeybindAction.ToggleSkillTree, KeybindAction.ToggleShop, KeybindAction.Pause],
  Camera: [KeybindAction.ZoomIn, KeybindAction.ZoomOut],
};

// Unified labels — primary actions + legacy aliases
export const ACTION_LABELS: Record<KeybindAction, string> = {
  // Primary unified actions
  [KeybindAction.MoveUp]: 'Move Up (W)',
  [KeybindAction.MoveDown]: 'Move Down (S)',
  [KeybindAction.MoveLeft]: 'Move Left (A)',
  [KeybindAction.MoveRight]: 'Move Right (D)',
  [KeybindAction.Sprint]: 'Sprint (Shift)',
  [KeybindAction.LightAttack]: 'Attack (LMB)',
  [KeybindAction.RangedAttack]: 'Ranged Attack (RMB)',
  [KeybindAction.DodgeRoll]: 'Dodge Roll (Space)',
  [KeybindAction.WeaponQ]: 'Weapon Skill Q',
  [KeybindAction.WeaponW]: 'Weapon Skill W',
  [KeybindAction.WeaponE]: 'Weapon Skill E',
  [KeybindAction.ClassUltimate]: 'Class Ultimate (R)',
  [KeybindAction.Consumable1]: 'Potion / Food (1)',
  [KeybindAction.Consumable2]: 'Buff / Mana Pot (2)',
  [KeybindAction.Interact]: 'Interact (F)',
  [KeybindAction.TargetLock]: 'Target Lock (Tab)',
  [KeybindAction.ToggleInventory]: 'Inventory (I)',
  [KeybindAction.ToggleCharPanel]: 'Character (C)',
  [KeybindAction.ToggleMissions]: 'Missions (J)',
  [KeybindAction.ToggleSkillTree]: 'Skill Tree (N)',
  [KeybindAction.ToggleShop]: 'Shop (B)',
  [KeybindAction.ToggleScoreboard]: 'Scoreboard',
  [KeybindAction.Pause]: 'Menu (Esc)',
  [KeybindAction.ZoomIn]: 'Zoom In (+)',
  [KeybindAction.ZoomOut]: 'Zoom Out (-)',
  // Legacy aliases (same keys, backward compat)
  [KeybindAction.Ability1]: 'Weapon Q', [KeybindAction.Ability2]: 'Weapon W',
  [KeybindAction.Ability3]: 'Weapon E', [KeybindAction.Ability4]: 'Ultimate R',
  [KeybindAction.Ability5]: 'Consumable 1', [KeybindAction.Ability6]: 'Consumable 2',
  [KeybindAction.DungeonAbility1]: 'Weapon Q', [KeybindAction.DungeonAbility2]: 'Weapon W',
  [KeybindAction.DungeonAbility3]: 'Weapon E', [KeybindAction.DungeonAbility4]: 'Ultimate R',
  [KeybindAction.DungeonAbility5]: 'Consumable 1',
  [KeybindAction.Attack]: 'Attack (LMB)', [KeybindAction.HeavyAttack]: 'Ranged (RMB)',
  [KeybindAction.AttackMove]: 'Deprecated', [KeybindAction.MoveToTarget]: 'Deprecated',
  [KeybindAction.CameraPan]: 'Camera Pan', [KeybindAction.CenterCamera]: 'Center Camera',
  [KeybindAction.StopMove]: 'Stop',
  [KeybindAction.LevelUpAbility1]: 'Level Up Q', [KeybindAction.LevelUpAbility2]: 'Level Up W',
  [KeybindAction.LevelUpAbility3]: 'Level Up E', [KeybindAction.LevelUpAbility4]: 'Level Up R',
  [KeybindAction.LevelUpAbility5]: 'Level Up D', [KeybindAction.LevelUpAbility6]: 'Level Up F',
  [KeybindAction.Dodge]: 'Dodge', [KeybindAction.DashAttack]: 'Deprecated', [KeybindAction.Block]: 'Deprecated',
  [KeybindAction.Item1]: 'Potion 1', [KeybindAction.Item2]: 'Potion 2',
  [KeybindAction.Item3]: 'Item 3', [KeybindAction.Item4]: 'Item 4',
  [KeybindAction.Item5]: 'Item 5', [KeybindAction.Item6]: 'Item 6',
};

export interface KeyBind {
  key: string;
  isMouseButton: boolean;
  mouseButton: number;
  modifiers: { shift: boolean; ctrl: boolean; alt: boolean };
}

export type KeybindConfig = Record<KeybindAction, KeyBind>;

export function makeKeyBind(key: string, shift = false, ctrl = false, alt = false): KeyBind {
  return { key: key.toLowerCase(), isMouseButton: false, mouseButton: -1, modifiers: { shift, ctrl, alt } };
}

export function makeMouseBind(button: number, shift = false, ctrl = false, alt = false): KeyBind {
  return { key: '', isMouseButton: true, mouseButton: button, modifiers: { shift, ctrl, alt } };
}

export function getDefaultBindings(): KeybindConfig {
  return {
    // ── Movement ──
    [KeybindAction.MoveUp]: makeKeyBind('w'),
    [KeybindAction.MoveDown]: makeKeyBind('s'),
    [KeybindAction.MoveLeft]: makeKeyBind('a'),
    [KeybindAction.MoveRight]: makeKeyBind('d'),
    [KeybindAction.Sprint]: makeKeyBind('shift'),

    // ── Combat (unified) ──
    [KeybindAction.LightAttack]: makeMouseBind(0),     // LMB = melee
    [KeybindAction.RangedAttack]: makeMouseBind(2),    // RMB = ranged
    [KeybindAction.DodgeRoll]: makeKeyBind(' '),        // Space = dodge

    // ── Weapon Skills (Albion style: Q/W/E) ──
    [KeybindAction.WeaponQ]: makeKeyBind('q'),          // Fast weapon skill
    [KeybindAction.WeaponW]: makeKeyBind('w'),          // NOTE: conflicts with MoveUp in direct WASD
    // In practice, W is only used as ability when NOT moving (tap vs hold)
    // But safer to bind to a number key for clarity:
    [KeybindAction.WeaponE]: makeKeyBind('e'),          // Weapon unique
    [KeybindAction.ClassUltimate]: makeKeyBind('r'),    // Class ultimate

    // ── Consumables ──
    [KeybindAction.Consumable1]: makeKeyBind('1'),      // Potion
    [KeybindAction.Consumable2]: makeKeyBind('2'),      // Buff

    // ── Interaction ──
    [KeybindAction.Interact]: makeKeyBind('f'),         // F = interact (Albion style)
    [KeybindAction.TargetLock]: makeKeyBind('tab'),

    // ── UI ──
    [KeybindAction.ToggleInventory]: makeKeyBind('i'),
    [KeybindAction.ToggleCharPanel]: makeKeyBind('c'),
    [KeybindAction.ToggleMissions]: makeKeyBind('j'),
    [KeybindAction.ToggleSkillTree]: makeKeyBind('n'),
    [KeybindAction.ToggleShop]: makeKeyBind('b'),
    [KeybindAction.ToggleScoreboard]: makeKeyBind('tab'),
    [KeybindAction.Pause]: makeKeyBind('escape'),
    [KeybindAction.ZoomIn]: makeKeyBind('='),
    [KeybindAction.ZoomOut]: makeKeyBind('-'),

    // ── Legacy aliases (all point to same keys for backward compat) ──
    [KeybindAction.Ability1]: makeKeyBind('q'),
    [KeybindAction.Ability2]: makeKeyBind('w'),
    [KeybindAction.Ability3]: makeKeyBind('e'),
    [KeybindAction.Ability4]: makeKeyBind('r'),
    [KeybindAction.Ability5]: makeKeyBind('1'),
    [KeybindAction.Ability6]: makeKeyBind('2'),
    [KeybindAction.DungeonAbility1]: makeKeyBind('q'),
    [KeybindAction.DungeonAbility2]: makeKeyBind('w'),
    [KeybindAction.DungeonAbility3]: makeKeyBind('e'),
    [KeybindAction.DungeonAbility4]: makeKeyBind('r'),
    [KeybindAction.DungeonAbility5]: makeKeyBind('1'),
    [KeybindAction.Attack]: makeMouseBind(0),
    [KeybindAction.HeavyAttack]: makeMouseBind(2),
    [KeybindAction.AttackMove]: makeKeyBind('a'),
    [KeybindAction.MoveToTarget]: makeMouseBind(2),
    [KeybindAction.CameraPan]: makeMouseBind(1),
    [KeybindAction.CenterCamera]: makeKeyBind('f1'),
    [KeybindAction.StopMove]: makeKeyBind('s'),
    [KeybindAction.LevelUpAbility1]: makeKeyBind('q', false, true),
    [KeybindAction.LevelUpAbility2]: makeKeyBind('w', false, true),
    [KeybindAction.LevelUpAbility3]: makeKeyBind('e', false, true),
    [KeybindAction.LevelUpAbility4]: makeKeyBind('r', false, true),
    [KeybindAction.LevelUpAbility5]: makeKeyBind('1', false, true),
    [KeybindAction.LevelUpAbility6]: makeKeyBind('2', false, true),
    [KeybindAction.Dodge]: makeKeyBind(' '),
    [KeybindAction.DashAttack]: makeKeyBind('f'),
    [KeybindAction.Block]: makeKeyBind('v'),
    [KeybindAction.Item1]: makeKeyBind('1'),
    [KeybindAction.Item2]: makeKeyBind('2'),
    [KeybindAction.Item3]: makeKeyBind('3'),
    [KeybindAction.Item4]: makeKeyBind('4'),
    [KeybindAction.Item5]: makeKeyBind('5'),
    [KeybindAction.Item6]: makeKeyBind('6'),
  };
}

const STORAGE_KEY = 'grudge_keybindings';

export function loadKeybindings(): KeybindConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const defaults = getDefaultBindings();
      for (const action of Object.values(KeybindAction)) {
        if (!parsed[action]) parsed[action] = defaults[action];
      }
      return parsed;
    }
  } catch {}
  return getDefaultBindings();
}

export function saveKeybindings(config: KeybindConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetKeybindings(): KeybindConfig {
  const defaults = getDefaultBindings();
  saveKeybindings(defaults);
  return defaults;
}

export function keyBindLabel(bind: KeyBind): string {
  const parts: string[] = [];
  if (bind.modifiers.ctrl) parts.push('Ctrl');
  if (bind.modifiers.shift) parts.push('Shift');
  if (bind.modifiers.alt) parts.push('Alt');

  if (bind.isMouseButton) {
    const mouseLabels: Record<number, string> = { 0: 'LMB', 1: 'MMB', 2: 'RMB', 3: 'Mouse4', 4: 'Mouse5' };
    parts.push(mouseLabels[bind.mouseButton] || `Mouse${bind.mouseButton}`);
  } else {
    const keyLabels: Record<string, string> = {
      ' ': 'Space', 'arrowup': 'Up', 'arrowdown': 'Down', 'arrowleft': 'Left', 'arrowright': 'Right',
      'tab': 'Tab', 'escape': 'Esc', 'enter': 'Enter', 'backspace': 'Bksp', 'delete': 'Del',
      'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5',
      'control': 'Ctrl', 'shift': 'Shift', 'alt': 'Alt',
    };
    parts.push(keyLabels[bind.key] || bind.key.toUpperCase());
  }
  return parts.join('+');
}

export function matchesKeyDown(bind: KeyBind, e: KeyboardEvent): boolean {
  if (bind.isMouseButton) return false;
  if (bind.key !== e.key.toLowerCase()) return false;
  if (bind.modifiers.shift !== e.shiftKey) return false;
  if (bind.modifiers.ctrl !== e.ctrlKey) return false;
  if (bind.modifiers.alt !== e.altKey) return false;
  return true;
}

export function matchesMouseDown(bind: KeyBind, e: MouseEvent): boolean {
  if (!bind.isMouseButton) return false;
  if (bind.mouseButton !== e.button) return false;
  if (bind.modifiers.shift !== e.shiftKey) return false;
  if (bind.modifiers.ctrl !== e.ctrlKey) return false;
  if (bind.modifiers.alt !== e.altKey) return false;
  return true;
}

export class GameInputHandler {
  private bindings: KeybindConfig;
  private activeKeys: Set<string> = new Set();
  private activeMouseButtons: Set<number> = new Set();
  private actionCallbacks: Map<KeybindAction, () => void> = new Map();
  private mouseWorldPos: { x: number; y: number } = { x: 0, y: 0 };
  private isPanning: boolean = false;
  private panStart: { x: number; y: number } = { x: 0, y: 0 };
  private panCameraStart: { x: number; y: number } = { x: 0, y: 0 };

  constructor(bindings?: KeybindConfig) {
    this.bindings = bindings || loadKeybindings();
  }

  updateBindings(bindings: KeybindConfig) {
    this.bindings = bindings;
  }

  onAction(action: KeybindAction, callback: () => void) {
    this.actionCallbacks.set(action, callback);
  }

  isActionHeld(action: KeybindAction): boolean {
    const bind = this.bindings[action];
    if (!bind) return false;
    if (bind.isMouseButton) {
      return this.activeMouseButtons.has(bind.mouseButton);
    }
    return this.activeKeys.has(bind.key);
  }

  get isMoveUp() { return this.isActionHeld(KeybindAction.MoveUp); }
  get isMoveDown() { return this.isActionHeld(KeybindAction.MoveDown); }
  get isMoveLeft() { return this.isActionHeld(KeybindAction.MoveLeft); }
  get isMoveRight() { return this.isActionHeld(KeybindAction.MoveRight); }
  get panning() { return this.isPanning; }
  get mouseWorld() { return this.mouseWorldPos; }

  handleKeyDown(e: KeyboardEvent): KeybindAction | null {
    this.activeKeys.add(e.key.toLowerCase());

    for (const [action, bind] of Object.entries(this.bindings) as [KeybindAction, KeyBind][]) {
      if (matchesKeyDown(bind, e)) {
        const cb = this.actionCallbacks.get(action);
        if (cb) cb();
        return action;
      }
    }
    return null;
  }

  handleKeyUp(e: KeyboardEvent) {
    this.activeKeys.delete(e.key.toLowerCase());
  }

  handleMouseDown(e: MouseEvent, worldX: number, worldY: number): KeybindAction | null {
    this.activeMouseButtons.add(e.button);
    this.mouseWorldPos = { x: worldX, y: worldY };

    if (matchesMouseDown(this.bindings[KeybindAction.CameraPan], e)) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      return KeybindAction.CameraPan;
    }

    for (const [action, bind] of Object.entries(this.bindings) as [KeybindAction, KeyBind][]) {
      if (matchesMouseDown(bind, e)) {
        const cb = this.actionCallbacks.get(action);
        if (cb) cb();
        return action;
      }
    }
    return null;
  }

  handleMouseUp(e: MouseEvent) {
    this.activeMouseButtons.delete(e.button);
    if (matchesMouseDown(this.bindings[KeybindAction.CameraPan], e)) {
      this.isPanning = false;
    }
  }

  handleMouseMove(e: MouseEvent, worldX: number, worldY: number, camera?: { x: number; y: number; zoom: number }) {
    this.mouseWorldPos = { x: worldX, y: worldY };

    if (this.isPanning && camera) {
      const dx = (e.clientX - this.panStart.x) / camera.zoom;
      const dy = (e.clientY - this.panStart.y) / camera.zoom;
      camera.x = this.panCameraStart.x - dx;
      camera.y = this.panCameraStart.y - dy;
    }
  }

  startPan(camera: { x: number; y: number }) {
    this.panCameraStart = { x: camera.x, y: camera.y };
  }

  handleWheel(deltaY: number): 'zoomIn' | 'zoomOut' | null {
    if (deltaY < 0) return 'zoomIn';
    if (deltaY > 0) return 'zoomOut';
    return null;
  }

  getMovementVector(): { mx: number; my: number } {
    let mx = 0, my = 0;
    if (this.isMoveUp) my = -1;
    if (this.isMoveDown) my = 1;
    if (this.isMoveLeft) mx = -1;
    if (this.isMoveRight) mx = 1;
    return { mx, my };
  }
}

export enum KeybindAction {
  MoveUp = 'MoveUp',
  MoveDown = 'MoveDown',
  MoveLeft = 'MoveLeft',
  MoveRight = 'MoveRight',
  Ability1 = 'Ability1',
  Ability2 = 'Ability2',
  Ability3 = 'Ability3',
  Ability4 = 'Ability4',
  Attack = 'Attack',
  AttackMove = 'AttackMove',
  MoveToTarget = 'MoveToTarget',
  CameraPan = 'CameraPan',
  ToggleShop = 'ToggleShop',
  ToggleScoreboard = 'ToggleScoreboard',
  CenterCamera = 'CenterCamera',
  Pause = 'Pause',
  Item1 = 'Item1',
  Item2 = 'Item2',
  Item3 = 'Item3',
  Item4 = 'Item4',
  Item5 = 'Item5',
  Item6 = 'Item6',
  ZoomIn = 'ZoomIn',
  ZoomOut = 'ZoomOut',
  StopMove = 'StopMove',
  LevelUpAbility1 = 'LevelUpAbility1',
  LevelUpAbility2 = 'LevelUpAbility2',
  LevelUpAbility3 = 'LevelUpAbility3',
  LevelUpAbility4 = 'LevelUpAbility4',
  Dodge = 'Dodge',
  DashAttack = 'DashAttack',
  Block = 'Block',
  HeavyAttack = 'HeavyAttack',
  LightAttack = 'LightAttack',
  // Dungeon/OpenWorld specific ability keys (1-4)
  DungeonAbility1 = 'DungeonAbility1',
  DungeonAbility2 = 'DungeonAbility2',
  DungeonAbility3 = 'DungeonAbility3',
  DungeonAbility4 = 'DungeonAbility4',
  // MMO controls
  Sprint = 'Sprint',
  DodgeRoll = 'DodgeRoll',
  Interact = 'Interact',
  TargetLock = 'TargetLock',
  // UI toggles (Open World)
  ToggleInventory = 'ToggleInventory',
  ToggleCharPanel = 'ToggleCharPanel',
  ToggleMissions = 'ToggleMissions',
}

export const ACTION_CATEGORIES: Record<string, KeybindAction[]> = {
  Movement: [KeybindAction.MoveUp, KeybindAction.MoveDown, KeybindAction.MoveLeft, KeybindAction.MoveRight, KeybindAction.StopMove],
  'MOBA Combat': [KeybindAction.Attack, KeybindAction.AttackMove, KeybindAction.MoveToTarget, KeybindAction.Dodge, KeybindAction.DashAttack, KeybindAction.Block],
  'MOBA Abilities (Q/W/E/R)': [KeybindAction.Ability1, KeybindAction.Ability2, KeybindAction.Ability3, KeybindAction.Ability4],
  'Dungeon/OW Combat': [KeybindAction.LightAttack, KeybindAction.HeavyAttack, KeybindAction.DodgeRoll, KeybindAction.Sprint],
  'Dungeon/OW Abilities (1-4)': [KeybindAction.DungeonAbility1, KeybindAction.DungeonAbility2, KeybindAction.DungeonAbility3, KeybindAction.DungeonAbility4],
  'Interaction': [KeybindAction.Interact, KeybindAction.TargetLock, KeybindAction.ToggleInventory, KeybindAction.ToggleCharPanel, KeybindAction.ToggleMissions],
  'Level Up': [KeybindAction.LevelUpAbility1, KeybindAction.LevelUpAbility2, KeybindAction.LevelUpAbility3, KeybindAction.LevelUpAbility4],
  Items: [KeybindAction.Item1, KeybindAction.Item2, KeybindAction.Item3, KeybindAction.Item4, KeybindAction.Item5, KeybindAction.Item6],
  Camera: [KeybindAction.CameraPan, KeybindAction.CenterCamera, KeybindAction.ZoomIn, KeybindAction.ZoomOut],
  UI: [KeybindAction.ToggleShop, KeybindAction.ToggleScoreboard, KeybindAction.Pause],
};

export const ACTION_LABELS: Record<KeybindAction, string> = {
  [KeybindAction.MoveUp]: 'Move Up',
  [KeybindAction.MoveDown]: 'Move Down',
  [KeybindAction.MoveLeft]: 'Move Left',
  [KeybindAction.MoveRight]: 'Move Right',
  [KeybindAction.Ability1]: 'Spell 1 (Q)',
  [KeybindAction.Ability2]: 'Spell 2 (W)',
  [KeybindAction.Ability3]: 'Spell 3 (E)',
  [KeybindAction.Ability4]: 'Ultimate (R)',
  [KeybindAction.Attack]: 'Attack / Select',
  [KeybindAction.AttackMove]: 'Attack Move (A)',
  [KeybindAction.MoveToTarget]: 'Move / Target',
  [KeybindAction.CameraPan]: 'Camera Pan',
  [KeybindAction.ToggleShop]: 'Toggle Shop',
  [KeybindAction.ToggleScoreboard]: 'Scoreboard',
  [KeybindAction.CenterCamera]: 'Center Camera',
  [KeybindAction.Pause]: 'Pause / Menu',
  [KeybindAction.Item1]: 'Use Item 1',
  [KeybindAction.Item2]: 'Use Item 2',
  [KeybindAction.Item3]: 'Use Item 3',
  [KeybindAction.Item4]: 'Use Item 4',
  [KeybindAction.Item5]: 'Use Item 5',
  [KeybindAction.Item6]: 'Use Item 6',
  [KeybindAction.ZoomIn]: 'Zoom In',
  [KeybindAction.ZoomOut]: 'Zoom Out',
  [KeybindAction.StopMove]: 'Stop / Hold',
  [KeybindAction.LevelUpAbility1]: 'Level Up Q',
  [KeybindAction.LevelUpAbility2]: 'Level Up W',
  [KeybindAction.LevelUpAbility3]: 'Level Up E',
  [KeybindAction.LevelUpAbility4]: 'Level Up R',
  [KeybindAction.Dodge]: 'Dodge Roll',
  [KeybindAction.DashAttack]: 'Dash Attack',
  [KeybindAction.Block]: 'Shield Block',
  [KeybindAction.HeavyAttack]: 'Heavy Attack (RMB)',
  [KeybindAction.LightAttack]: 'Light Attack (LMB)',
  [KeybindAction.DungeonAbility1]: 'Ability 1 (1)',
  [KeybindAction.DungeonAbility2]: 'Ability 2 (2)',
  [KeybindAction.DungeonAbility3]: 'Ability 3 (3)',
  [KeybindAction.DungeonAbility4]: 'Ability 4 (4)',
  [KeybindAction.Sprint]: 'Sprint (Shift)',
  [KeybindAction.DodgeRoll]: 'Dodge Roll (Space)',
  [KeybindAction.Interact]: 'Interact (E)',
  [KeybindAction.TargetLock]: 'Target Lock (Tab)',
  [KeybindAction.ToggleInventory]: 'Toggle Inventory (I)',
  [KeybindAction.ToggleCharPanel]: 'Toggle Character Panel (C)',
  [KeybindAction.ToggleMissions]: 'Toggle Missions (J)',
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
    [KeybindAction.MoveUp]: makeKeyBind('w'),
    [KeybindAction.MoveDown]: makeKeyBind('s'),
    [KeybindAction.MoveLeft]: makeKeyBind('a'),
    [KeybindAction.MoveRight]: makeKeyBind('d'),
    // MOBA: Q/W/E/R for spells, mouse to move, A+LMB attack-move
    [KeybindAction.Ability1]: makeKeyBind('q'),
    [KeybindAction.Ability2]: makeKeyBind('w'),
    [KeybindAction.Ability3]: makeKeyBind('e'),
    [KeybindAction.Ability4]: makeKeyBind('r'),
    [KeybindAction.Attack]: makeMouseBind(0),
    [KeybindAction.AttackMove]: makeKeyBind('a'),
    [KeybindAction.MoveToTarget]: makeMouseBind(2),
    [KeybindAction.CameraPan]: makeMouseBind(1),
    [KeybindAction.ToggleShop]: makeKeyBind('b'),
    [KeybindAction.ToggleScoreboard]: makeKeyBind('tab'),
    [KeybindAction.CenterCamera]: makeKeyBind('f1'),
    [KeybindAction.Pause]: makeKeyBind('escape'),
    [KeybindAction.Item1]: makeKeyBind('1'),
    [KeybindAction.Item2]: makeKeyBind('2'),
    [KeybindAction.Item3]: makeKeyBind('3'),
    [KeybindAction.Item4]: makeKeyBind('4'),
    [KeybindAction.Item5]: makeKeyBind('5'),
    [KeybindAction.Item6]: makeKeyBind('6'),
    [KeybindAction.ZoomIn]: makeKeyBind('='),
    [KeybindAction.ZoomOut]: makeKeyBind('-'),
    [KeybindAction.StopMove]: makeKeyBind('s'),
    [KeybindAction.LevelUpAbility1]: makeKeyBind('q', false, true),
    [KeybindAction.LevelUpAbility2]: makeKeyBind('w', false, true),
    [KeybindAction.LevelUpAbility3]: makeKeyBind('e', false, true),
    [KeybindAction.LevelUpAbility4]: makeKeyBind('r', false, true),
    [KeybindAction.Dodge]: makeKeyBind('c'),
    [KeybindAction.DashAttack]: makeKeyBind('f'),
    [KeybindAction.Block]: makeKeyBind('v'),
    // Dungeon/OpenWorld: LMB light, RMB heavy, 1-4 abilities
    [KeybindAction.HeavyAttack]: makeMouseBind(2),
    [KeybindAction.LightAttack]: makeMouseBind(0),
    [KeybindAction.DungeonAbility1]: makeKeyBind('1'),
    [KeybindAction.DungeonAbility2]: makeKeyBind('2'),
    [KeybindAction.DungeonAbility3]: makeKeyBind('3'),
    [KeybindAction.DungeonAbility4]: makeKeyBind('4'),
    [KeybindAction.Sprint]: makeKeyBind('shift'),
    [KeybindAction.DodgeRoll]: makeKeyBind(' '),
    [KeybindAction.Interact]: makeKeyBind('e'),
    [KeybindAction.TargetLock]: makeKeyBind('tab'),
    [KeybindAction.ToggleInventory]: makeKeyBind('i'),
    [KeybindAction.ToggleCharPanel]: makeKeyBind('c'),
    [KeybindAction.ToggleMissions]: makeKeyBind('j'),
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

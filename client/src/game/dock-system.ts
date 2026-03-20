/**
 * Dock System — 9-zone port network with fast travel.
 * Each zone edge has a dock acting as a safe zone + travel hub.
 * NPCs: Dock Master (fast travel), Fish Vendor, Dock Boy (quests), Kobold (rare lures).
 */

// ── Dock Definitions ───────────────────────────────────────────

export interface DockDef {
  nodeId: number;
  name: string;
  worldX: number;
  worldY: number;
  facing: 'N' | 'S' | 'E' | 'W';
  discovered: boolean;
  hasShop: boolean;
  hasDockMaster: boolean;
}

export const DOCKS: DockDef[] = [
  { nodeId: 1, name: 'Frostport',         worldX: 5000,  worldY: 9500,  facing: 'S', discovered: false, hasShop: true,  hasDockMaster: true },
  { nodeId: 2, name: 'Deadwater Pier',    worldX: 15000, worldY: 9500,  facing: 'S', discovered: false, hasShop: false, hasDockMaster: true },
  { nodeId: 3, name: 'Titan\'s Landing',  worldX: 25000, worldY: 9500,  facing: 'S', discovered: false, hasShop: true,  hasDockMaster: true },
  { nodeId: 4, name: 'Dragonmaw Wharf',   worldX: 9500,  worldY: 15000, facing: 'E', discovered: false, hasShop: false, hasDockMaster: true },
  { nodeId: 5, name: 'Riverwatch Dock',   worldX: 15000, worldY: 18000, facing: 'S', discovered: true,  hasShop: true,  hasDockMaster: true },
  { nodeId: 6, name: 'Crusade Harbor',    worldX: 20500, worldY: 15000, facing: 'W', discovered: false, hasShop: true,  hasDockMaster: true },
  { nodeId: 7, name: 'Ashport',           worldX: 5000,  worldY: 20500, facing: 'N', discovered: false, hasShop: false, hasDockMaster: true },
  { nodeId: 8, name: 'Arena Pier',        worldX: 15000, worldY: 20500, facing: 'N', discovered: false, hasShop: false, hasDockMaster: true },
  { nodeId: 9, name: 'Pirate Cove Port',  worldX: 25000, worldY: 20500, facing: 'N', discovered: false, hasShop: true,  hasDockMaster: true },
];

// ── NPC Types ──────────────────────────────────────────────────

export interface DockNPC {
  type: 'dock_master' | 'fish_vendor' | 'dock_boy' | 'kobold';
  name: string;
  dialogue: string[];
  offsetX: number;
  offsetY: number;
}

export const DOCK_NPCS: Record<string, DockNPC[]> = {
  dock_master: [{ type: 'dock_master', name: 'Old Salt', dialogue: ['Where to, traveler?', 'The seas be calm today.'], offsetX: -30, offsetY: 0 }],
  fish_vendor: [{ type: 'fish_vendor', name: 'Granny Pearl', dialogue: ['Fresh fish! Best prices!', 'Need bait? I got plenty.'], offsetX: 30, offsetY: 0 }],
  dock_boy:    [{ type: 'dock_boy', name: 'Finn', dialogue: ['Got a fishing challenge for ya!', 'Catch me 5 trout and I\'ll pay well.'], offsetX: 0, offsetY: 30 }],
  kobold:      [{ type: 'kobold', name: 'Krikkit', dialogue: ['Psst... rare lures, very shiny.', 'You no tell anyone about Krikkit.'], offsetX: 40, offsetY: 20 }],
};

// ── Travel Cost ────────────────────────────────────────────────

/** Gold cost to travel between docks. Adjacent=50, diagonal=100, far=200. */
export function getTravelCost(from: DockDef, to: DockDef): number {
  const dx = Math.abs(from.worldX - to.worldX);
  const dy = Math.abs(from.worldY - to.worldY);
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 12000) return 50;
  if (dist < 20000) return 100;
  return 200;
}

/** Get all discovered docks. */
export function getDiscoveredDocks(): DockDef[] {
  return DOCKS.filter(d => d.discovered);
}

/** Mark a dock as discovered (call when player enters the zone). */
export function discoverDock(nodeId: number): void {
  const dock = DOCKS.find(d => d.nodeId === nodeId);
  if (dock) dock.discovered = true;
}

// ── Sailing Cutscene ───────────────────────────────────────────

export interface SailingCutscene {
  active: boolean;
  from: DockDef;
  to: DockDef;
  progress: number; // 0→1
  duration: number; // seconds
  boatX: number;
  boatY: number;
}

export function startSailing(from: DockDef, to: DockDef): SailingCutscene {
  const dx = Math.abs(from.worldX - to.worldX);
  const dy = Math.abs(from.worldY - to.worldY);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const duration = 3 + (dist / 10000) * 2; // 3-5 seconds
  return {
    active: true, from, to,
    progress: 0, duration,
    boatX: from.worldX, boatY: from.worldY,
  };
}

export function updateSailing(scene: SailingCutscene, dt: number): boolean {
  if (!scene.active) return false;
  scene.progress = Math.min(1, scene.progress + dt / scene.duration);
  scene.boatX = scene.from.worldX + (scene.to.worldX - scene.from.worldX) * scene.progress;
  scene.boatY = scene.from.worldY + (scene.to.worldY - scene.from.worldY) * scene.progress;
  if (scene.progress >= 1) {
    scene.active = false;
    return true; // arrived
  }
  return false;
}

// ── Boat Ownership ─────────────────────────────────────────────

export interface PlayerBoat {
  owned: boolean;
  lastDockId: number;
}

export const BOAT_PRICE = 500;

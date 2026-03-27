/**
 * charConfig — Persistent per-hero collider & override storage.
 *
 * ColliderDef describes one named collision zone (rect or ellipse) in
 * *preview-canvas* coordinates relative to the character anchor (0,0).
 *
 * CharOverrides stores the full set of colliders + optional future
 * overrides (stats, anim, etc.) for a single hero.
 */

// ── Types ──────────────────────────────────────────────────────

export interface ColliderDef {
  id: string;
  label: string;
  type: 'rect' | 'ellipse';
  /** X offset from character anchor (px, preview-space) */
  x: number;
  /** Y offset from character anchor (px, preview-space) */
  y: number;
  /** Width (px) */
  w: number;
  /** Height (px) */
  h: number;
  /** Display colour (CSS colour string) */
  color: string;
}

export interface CharOverrides {
  heroId: number;
  colliders: ColliderDef[];
  // Future extension slots — kept compatible with save/load:
  statMults?: Record<string, number>;
  abilityEffects?: Record<string, string>;
}

// ── Defaults ───────────────────────────────────────────────────

let _nextId = 1;

/** Generate a unique collider id */
export function nextColliderId(): string {
  return `col_${Date.now()}_${_nextId++}`;
}

/**
 * Build a sensible set of default colliders for any hero.
 * Values are in *preview canvas* space at scale=3.5 (the scale used
 * by the admin preview canvas).
 */
export function buildDefaultColliders(): ColliderDef[] {
  return [
    {
      id: nextColliderId(),
      label: 'Head',
      type: 'ellipse',
      x: 0,
      y: -32,
      w: 16,
      h: 16,
      color: 'rgba(59,130,246,0.5)',  // blue
    },
    {
      id: nextColliderId(),
      label: 'Body',
      type: 'rect',
      x: -12,
      y: -20,
      w: 24,
      h: 24,
      color: 'rgba(34,197,94,0.5)',   // green
    },
    {
      id: nextColliderId(),
      label: 'Legs',
      type: 'rect',
      x: -10,
      y: 4,
      w: 20,
      h: 18,
      color: 'rgba(234,179,8,0.5)',   // amber
    },
    {
      id: nextColliderId(),
      label: 'Weapon',
      type: 'rect',
      x: 14,
      y: -26,
      w: 14,
      h: 30,
      color: 'rgba(239,68,68,0.5)',   // red
    },
  ];
}

// ── Persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'grudge_char_overrides';

function loadAll(): Record<number, CharOverrides> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<number, CharOverrides>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Load overrides for a specific hero, filling in defaults if absent. */
export function loadOverrides(heroId: number): CharOverrides {
  const map = loadAll();
  if (map[heroId]) return map[heroId];
  return { heroId, colliders: buildDefaultColliders() };
}

/** Persist overrides for a specific hero. */
export function saveOverrides(overrides: CharOverrides): void {
  const map = loadAll();
  map[overrides.heroId] = overrides;
  saveAll(map);
}

/** Export overrides for a hero as a JSON string. */
export function exportOverrides(heroId: number): string {
  return JSON.stringify(loadOverrides(heroId), null, 2);
}

/** Import overrides from a JSON string. Returns the parsed overrides. */
export function importOverrides(json: string): CharOverrides {
  const parsed = JSON.parse(json) as CharOverrides;
  saveOverrides(parsed);
  return parsed;
}

/**
 * Zone Cluster Manager — Albion-Style Active Zone System
 *
 * Only ONE zone is loaded/rendered at a time. This module tracks which
 * zone is active, detects when the player walks into a zone exit,
 * and orchestrates the transition (save → swap → reposition → load).
 */

import {
  ZoneDef, ZoneExit, ISLAND_ZONES, OPEN_WORLD_SIZE,
  getZoneById, checkZoneExit,
} from './zones';

// ── Types ──────────────────────────────────────────────────────

export interface ZoneClusterState {
  /** Currently loaded zone ID */
  activeZoneId: number;
  /** Transition in progress? */
  transitioning: boolean;
  /** Transition progress (0..1, for loading screen animation) */
  transitionProgress: number;
  /** Target zone ID during transition */
  targetZoneId: number;
  /** Where to spawn in the target zone */
  targetSpawnX: number;
  targetSpawnY: number;
  /** Zone enter banner timer (shows zone name on entry) */
  bannerTimer: number;
  bannerText: string;
  bannerColor: string;
}

// ── Create ─────────────────────────────────────────────────────

export function createZoneClusterState(startZoneId: number): ZoneClusterState {
  const zone = getZoneById(startZoneId) || ISLAND_ZONES[0];
  return {
    activeZoneId: zone.id,
    transitioning: false,
    transitionProgress: 0,
    targetZoneId: zone.id,
    targetSpawnX: 0,
    targetSpawnY: 0,
    bannerTimer: 3.0, // show zone name for 3 seconds on first load
    bannerText: zone.name,
    bannerColor: zone.isSafeZone ? '#22c55e' : zone.isPvP ? '#ef4444' : '#f59e0b',
  };
}

// ── Get Active Zone ────────────────────────────────────────────

export function getActiveZone(cluster: ZoneClusterState): ZoneDef {
  return getZoneById(cluster.activeZoneId) || ISLAND_ZONES[0];
}

// ── Check Zone Exit ────────────────────────────────────────────

/**
 * Check if the player is standing on a zone exit.
 * Returns the exit if so, null otherwise.
 */
export function checkPlayerZoneExit(
  cluster: ZoneClusterState,
  playerX: number,
  playerY: number,
): ZoneExit | null {
  if (cluster.transitioning) return null;
  const zone = getActiveZone(cluster);
  return checkZoneExit(zone, playerX, playerY);
}

// ── Begin Transition ───────────────────────────────────────────

/**
 * Start a zone transition. Sets transitioning=true and stores target.
 * The game loop should:
 *   1. Show loading overlay
 *   2. Call completeTransition() after a brief delay
 */
export function beginZoneTransition(
  cluster: ZoneClusterState,
  exit: ZoneExit,
): void {
  if (cluster.transitioning) return;
  cluster.transitioning = true;
  cluster.transitionProgress = 0;
  cluster.targetZoneId = exit.targetZoneId;
  cluster.targetSpawnX = exit.spawnX;
  cluster.targetSpawnY = exit.spawnY;
}

/**
 * Begin a direct transition (e.g., from faction spawn, portal, etc.)
 */
export function beginDirectTransition(
  cluster: ZoneClusterState,
  targetZoneId: number,
  spawnX: number,
  spawnY: number,
): void {
  if (cluster.transitioning) return;
  cluster.transitioning = true;
  cluster.transitionProgress = 0;
  cluster.targetZoneId = targetZoneId;
  cluster.targetSpawnX = spawnX;
  cluster.targetSpawnY = spawnY;
}

// ── Update Transition ──────────────────────────────────────────

const TRANSITION_DURATION = 0.6; // seconds for fade in/out

/**
 * Update the transition animation. Returns true when the midpoint
 * is reached (time to swap zone data and reposition player).
 */
export function updateTransition(cluster: ZoneClusterState, dt: number): boolean {
  if (!cluster.transitioning) return false;

  cluster.transitionProgress += dt / TRANSITION_DURATION;

  // At the midpoint (progress >= 0.5), the swap should happen
  if (cluster.transitionProgress >= 0.5 && cluster.activeZoneId !== cluster.targetZoneId) {
    return true; // signal to caller: swap now
  }

  // Transition complete
  if (cluster.transitionProgress >= 1.0) {
    cluster.transitioning = false;
    cluster.transitionProgress = 0;
    // Show zone banner
    const zone = getActiveZone(cluster);
    cluster.bannerTimer = 3.0;
    cluster.bannerText = zone.name;
    cluster.bannerColor = zone.isSafeZone ? '#22c55e' : zone.isPvP ? '#ef4444' : '#f59e0b';
  }

  return false;
}

/**
 * Complete the zone swap. Call this when updateTransition() returns true.
 * - Sets activeZoneId to the target
 * - Returns the spawn position for the player
 */
export function completeZoneSwap(cluster: ZoneClusterState): { x: number; y: number; zone: ZoneDef } {
  cluster.activeZoneId = cluster.targetZoneId;
  const zone = getActiveZone(cluster);
  return {
    x: cluster.targetSpawnX,
    y: cluster.targetSpawnY,
    zone,
  };
}

// ── Banner Update ──────────────────────────────────────────────

export function updateBanner(cluster: ZoneClusterState, dt: number): void {
  if (cluster.bannerTimer > 0) {
    cluster.bannerTimer -= dt;
  }
}

// ── Render Helpers ─────────────────────────────────────────────

/**
 * Get the transition overlay opacity (0 = transparent, 1 = fully black).
 * Fades to black at 0.5, then fades back in.
 */
export function getTransitionOpacity(cluster: ZoneClusterState): number {
  if (!cluster.transitioning) return 0;
  const p = cluster.transitionProgress;
  // Triangle wave: 0→1→0 over the transition
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

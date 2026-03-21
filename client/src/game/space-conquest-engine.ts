/**
 * Space Conquest — Core Engine
 * State management, game loop update, combat resolution, neutral AI,
 * resource generation, ship building, fleet movement.
 */

import {
  Resources, EMPTY_RESOURCES, addResources, subtractResources, canAfford,
  PLANETS, PlanetDef, ShipType, ShipBlueprintDef, getShipBlueprint,
  NeutralUnitDef, NeutralUnitType, createNeutralUnit, PIRATE_RAID,
} from './space-conquest-data';

// ── IDs ────────────────────────────────────────────────────────

let _nextId = 1;
function nextId(): number { return _nextId++; }

// ── Live Unit (ship or neutral) ────────────────────────────────

export interface SpaceUnit {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  rng: number;
  attackCooldown: number;
  attackTimer: number;
  dead: boolean;
  facing: number;
  size: number;
  color: string;
  /** 'player' | 'neutral' | 'pirate' */
  owner: string;
  /** Ship type or neutral unit type */
  unitType: string;
  /** Animation state */
  animState: 'idle' | 'moving' | 'attacking' | 'dying' | 'shielding';
  animTimer: number;
  /** Movement target */
  targetX: number;
  targetY: number;
  /** Current attack target ID */
  targetId: number | null;
  /** For boss: shield active */
  shieldActive: boolean;
  /** For boss: enraged */
  enraged: boolean;
  /** Home planet ID */
  homePlanetId: number;
  /** Bob animation offset */
  bobPhase: number;
}

// ── Build Queue Entry ──────────────────────────────────────────

export interface BuildQueueEntry {
  shipType: ShipType;
  remaining: number;   // seconds left
  total: number;       // total build time
}

// ── Planet Runtime State ───────────────────────────────────────

export interface PlanetState {
  def: PlanetDef;
  conquered: boolean;
  /** Current orbital angle */
  angle: number;
  /** World position (computed from orbit) */
  wx: number;
  wy: number;
  /** Neutral garrison alive units */
  neutrals: SpaceUnit[];
  /** Player ships stationed here */
  playerShips: SpaceUnit[];
  /** Build queue */
  buildQueue: BuildQueueEntry[];
  /** Active combat flag */
  inCombat: boolean;
  /** Conquest animation progress (0-1) */
  conquestAnim: number;
}

// ── Combat VFX ─────────────────────────────────────────────────

export interface SpaceVFX {
  id: number;
  x: number;
  y: number;
  type: 'laser' | 'explosion' | 'shield_hit' | 'conquest_beam' | 'muzzle_flash';
  life: number;
  maxLife: number;
  color: string;
  angle: number;
  radius: number;
  /** For laser: target position */
  tx?: number;
  ty?: number;
}

// ── Particle ───────────────────────────────────────────────────

export interface SpaceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// ── Fleet Movement ─────────────────────────────────────────────

export interface FleetTransit {
  id: number;
  ships: SpaceUnit[];
  fromPlanetId: number;
  toPlanetId: number;
  progress: number;    // 0-1
  speed: number;       // progress per second (based on slowest ship)
  /** Bezier control point for curved path */
  cx: number;
  cy: number;
}

// ── Event Log ──────────────────────────────────────────────────

export interface SpaceLogEntry {
  text: string;
  color: string;
  time: number;
}

// ── Game State ─────────────────────────────────────────────────

export interface SpaceConquestState {
  gameTime: number;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;

  planets: PlanetState[];
  resources: Resources;
  fleets: FleetTransit[];
  vfx: SpaceVFX[];
  particles: SpaceParticle[];
  log: SpaceLogEntry[];

  /** Currently selected planet ID (-1 = none) */
  selectedPlanetId: number;
  /** Hovered planet ID (-1 = none) */
  hoveredPlanetId: number;

  /** Camera */
  camera: { x: number; y: number; zoom: number };
  /** Mouse world position */
  mouseWorld: { x: number; y: number };

  /** Resource tick accumulator */
  resourceTickTimer: number;
  /** Pirate raid timer */
  pirateRaidTimer: number;
  pirateRaidsStarted: boolean;

  /** Total conquest score */
  score: number;

  /** Center star position */
  starX: number;
  starY: number;
}

// ── Create Initial State ───────────────────────────────────────

export function createSpaceConquestState(): SpaceConquestState {
  const starX = 0;
  const starY = 0;

  const planets: PlanetState[] = PLANETS.map(def => {
    const angle = def.startAngle;
    const wx = starX + Math.cos(angle) * def.orbitRadius;
    const wy = starY + Math.sin(angle) * def.orbitRadius;

    // Create neutral garrison
    const neutrals: SpaceUnit[] = [];
    for (const entry of def.garrison.units) {
      for (let i = 0; i < entry.count; i++) {
        const unitDef = createNeutralUnit(entry.type, def.garrisonScale);
        const offsetAngle = (i / Math.max(entry.count, 1)) * Math.PI * 2;
        const offsetR = def.size + 15 + Math.random() * 20;
        neutrals.push(createSpaceUnit(unitDef, wx + Math.cos(offsetAngle) * offsetR, wy + Math.sin(offsetAngle) * offsetR, 'neutral', def.id));
      }
    }

    return {
      def,
      conquered: false,
      angle,
      wx, wy,
      neutrals,
      playerShips: [],
      buildQueue: [],
      inCombat: false,
      conquestAnim: 0,
    };
  });

  return {
    gameTime: 0,
    paused: false,
    gameOver: false,
    victory: false,
    planets,
    resources: { minerals: 30, gas: 15, energy: 20, bioMatter: 10 },
    fleets: [],
    vfx: [],
    particles: [],
    log: [{ text: 'Sector scan complete. 8 planets detected.', color: '#c5a059', time: 0 }],
    selectedPlanetId: -1,
    hoveredPlanetId: -1,
    camera: { x: 0, y: 0, zoom: 0.85 },
    mouseWorld: { x: 0, y: 0 },
    resourceTickTimer: 0,
    pirateRaidTimer: PIRATE_RAID.startDelay,
    pirateRaidsStarted: false,
    score: 0,
    starX,
    starY,
  };
}

function createSpaceUnit(def: NeutralUnitDef, x: number, y: number, owner: string, homePlanetId: number): SpaceUnit {
  return {
    id: nextId(),
    x, y,
    hp: def.hp, maxHp: def.maxHp,
    atk: def.atk, def: def.def,
    spd: def.spd, rng: def.rng,
    attackCooldown: def.attackCooldown,
    attackTimer: 0,
    dead: false,
    facing: Math.random() * Math.PI * 2,
    size: def.size,
    color: def.color,
    owner,
    unitType: def.type,
    animState: 'idle',
    animTimer: 0,
    targetX: x, targetY: y,
    targetId: null,
    shieldActive: false,
    enraged: false,
    homePlanetId,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

export function createPlayerShip(type: ShipType, x: number, y: number, homePlanetId: number): SpaceUnit {
  const bp = getShipBlueprint(type);
  return {
    id: nextId(),
    x, y,
    hp: bp.hp, maxHp: bp.hp,
    atk: bp.atk, def: bp.def,
    spd: bp.spd, rng: bp.rng,
    attackCooldown: bp.attackCooldown,
    attackTimer: 0,
    dead: false,
    facing: 0,
    size: bp.size,
    color: bp.color,
    owner: 'player',
    unitType: type,
    animState: 'idle',
    animTimer: 0,
    targetX: x, targetY: y,
    targetId: null,
    shieldActive: false,
    enraged: false,
    homePlanetId,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

// ── Main Update ────────────────────────────────────────────────

export function updateSpaceConquest(state: SpaceConquestState, dt: number): void {
  if (state.paused || state.gameOver) return;
  state.gameTime += dt;

  // Update planet orbits
  updateOrbits(state, dt);

  // Update combat at each planet
  for (const planet of state.planets) {
    updatePlanetCombat(state, planet, dt);
  }

  // Update fleet transits
  updateFleets(state, dt);

  // Build queues
  updateBuildQueues(state, dt);

  // Resource ticks
  updateResourceTicks(state, dt);

  // Pirate raids
  updatePirateRaids(state, dt);

  // VFX
  updateVFX(state, dt);

  // Particles
  updateParticles(state, dt);

  // Unit animations (bob)
  for (const planet of state.planets) {
    for (const u of [...planet.neutrals, ...planet.playerShips]) {
      if (!u.dead) {
        u.bobPhase += dt * 2.5;
        u.animTimer += dt;
      }
    }
  }

  // Check victory (all planets conquered)
  if (state.planets.every(p => p.conquered) && !state.victory) {
    state.victory = true;
    state.gameOver = true;
    state.log.push({ text: '🏆 SECTOR CONQUERED! Total victory!', color: '#ffd700', time: state.gameTime });
  }
}

// ── Orbit Update ───────────────────────────────────────────────

function updateOrbits(state: SpaceConquestState, dt: number): void {
  for (const planet of state.planets) {
    planet.angle += planet.def.orbitSpeed * dt;
    const oldWx = planet.wx;
    const oldWy = planet.wy;
    planet.wx = state.starX + Math.cos(planet.angle) * planet.def.orbitRadius;
    planet.wy = state.starY + Math.sin(planet.angle) * planet.def.orbitRadius;

    // Move all units with the planet
    const dx = planet.wx - oldWx;
    const dy = planet.wy - oldWy;
    for (const u of [...planet.neutrals, ...planet.playerShips]) {
      u.x += dx;
      u.y += dy;
      u.targetX += dx;
      u.targetY += dy;
    }
  }
}

// ── Combat ─────────────────────────────────────────────────────

function updatePlanetCombat(state: SpaceConquestState, planet: PlanetState, dt: number): void {
  const aliveNeutrals = planet.neutrals.filter(u => !u.dead);
  const aliveShips = planet.playerShips.filter(u => !u.dead);

  planet.inCombat = aliveNeutrals.length > 0 && aliveShips.length > 0;

  if (!planet.inCombat) {
    // Check conquest
    if (!planet.conquered && aliveNeutrals.length === 0 && aliveShips.length > 0) {
      planet.conquered = true;
      planet.conquestAnim = 1.0;
      state.score += 100 * (planet.def.garrisonScale + 0.5);
      state.log.push({ text: `★ ${planet.def.name} CONQUERED!`, color: planet.def.color, time: state.gameTime });

      if (!state.pirateRaidsStarted) {
        state.pirateRaidsStarted = true;
        state.pirateRaidTimer = PIRATE_RAID.startDelay;
      }
    }
    // Decay conquest anim
    if (planet.conquestAnim > 0) planet.conquestAnim = Math.max(0, planet.conquestAnim - dt * 0.5);
    return;
  }

  // Combat: each player ship attacks nearest neutral, and vice versa
  for (const ship of aliveShips) {
    runUnitCombat(state, ship, aliveNeutrals, planet, dt);
  }

  for (const neutral of aliveNeutrals) {
    // Boss AI: shield phase & enrage
    if (neutral.unitType === 'boss') {
      updateBossAI(neutral);
    }
    runUnitCombat(state, neutral, aliveShips, planet, dt);
  }

  // Clean dead units
  planet.neutrals = planet.neutrals.filter(u => !u.dead || u.animTimer < 1.5);
  planet.playerShips = planet.playerShips.filter(u => !u.dead || u.animTimer < 1.5);
}

function runUnitCombat(state: SpaceConquestState, unit: SpaceUnit, enemies: SpaceUnit[], planet: PlanetState, dt: number): void {
  if (unit.dead) return;

  // Find closest alive enemy
  let closest: SpaceUnit | null = null;
  let closestDist = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = dist(unit, e);
    if (d < closestDist) { closestDist = d; closest = e; }
  }

  if (!closest) return;

  unit.facing = Math.atan2(closest.y - unit.y, closest.x - unit.x);

  if (closestDist > unit.rng) {
    // Move toward target
    const speed = unit.spd * dt;
    const dx = closest.x - unit.x;
    const dy = closest.y - unit.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      unit.x += (dx / len) * speed;
      unit.y += (dy / len) * speed;
    }
    unit.animState = 'moving';
  } else {
    // Attack
    unit.animState = 'attacking';
    unit.attackTimer -= dt;
    if (unit.attackTimer <= 0) {
      unit.attackTimer = unit.attackCooldown * (unit.enraged ? 0.6 : 1);

      // Calculate damage
      let dmg = Math.max(1, unit.atk - closest.def * 0.5);
      if (unit.enraged) dmg *= 1.5;
      if (closest.shieldActive) dmg *= 0.3;

      closest.hp -= dmg;

      // Spawn laser VFX
      state.vfx.push({
        id: nextId(),
        x: unit.x, y: unit.y,
        type: 'laser',
        life: 0.25, maxLife: 0.25,
        color: unit.color,
        angle: unit.facing,
        radius: 3,
        tx: closest.x, ty: closest.y,
      });

      // Muzzle flash
      state.vfx.push({
        id: nextId(),
        x: unit.x + Math.cos(unit.facing) * unit.size,
        y: unit.y + Math.sin(unit.facing) * unit.size,
        type: 'muzzle_flash',
        life: 0.15, maxLife: 0.15,
        color: unit.color,
        angle: unit.facing,
        radius: unit.size * 0.6,
      });

      // Impact particles
      for (let i = 0; i < 3; i++) {
        state.particles.push({
          x: closest.x, y: closest.y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          life: 0.4, maxLife: 0.4,
          color: closest.shieldActive ? '#7dd3fc' : '#fbbf24',
          size: 2 + Math.random() * 2,
        });
      }

      if (closest.shieldActive) {
        state.vfx.push({
          id: nextId(),
          x: closest.x, y: closest.y,
          type: 'shield_hit',
          life: 0.3, maxLife: 0.3,
          color: '#7dd3fc',
          angle: 0,
          radius: closest.size + 5,
        });
      }

      // Death check
      if (closest.hp <= 0) {
        closest.hp = 0;
        closest.dead = true;
        closest.animState = 'dying';
        closest.animTimer = 0;

        // Explosion
        state.vfx.push({
          id: nextId(),
          x: closest.x, y: closest.y,
          type: 'explosion',
          life: 0.6, maxLife: 0.6,
          color: closest.color,
          angle: 0,
          radius: closest.size * 2,
        });

        // Explosion particles
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          state.particles.push({
            x: closest.x, y: closest.y,
            vx: Math.cos(a) * (40 + Math.random() * 80),
            vy: Math.sin(a) * (40 + Math.random() * 80),
            life: 0.8, maxLife: 0.8,
            color: closest.color,
            size: 2 + Math.random() * 3,
          });
        }

        state.score += 10;
      }
    }
  }
}

function updateBossAI(boss: SpaceUnit): void {
  const hpPct = boss.hp / boss.maxHp;

  // Shield at 50%
  if (hpPct <= 0.5 && hpPct > 0.2 && !boss.enraged) {
    boss.shieldActive = true;
    boss.animState = 'shielding';
  } else {
    boss.shieldActive = false;
  }

  // Enrage at 20%
  if (hpPct <= 0.2) {
    boss.enraged = true;
    boss.shieldActive = false;
    boss.color = '#ff2222';
  }
}

// ── Fleet Transit ──────────────────────────────────────────────

function updateFleets(state: SpaceConquestState, dt: number): void {
  for (let i = state.fleets.length - 1; i >= 0; i--) {
    const fleet = state.fleets[i];
    fleet.progress += fleet.speed * dt;

    if (fleet.progress >= 1) {
      // Arrive at destination
      const dest = state.planets[fleet.toPlanetId];
      if (dest) {
        for (const ship of fleet.ships) {
          ship.x = dest.wx + (Math.random() - 0.5) * dest.def.size * 2;
          ship.y = dest.wy + (Math.random() - 0.5) * dest.def.size * 2;
          ship.homePlanetId = dest.def.id;
          ship.animState = 'idle';
          dest.playerShips.push(ship);
        }
        state.log.push({ text: `Fleet arrived at ${dest.def.name}`, color: '#60a5fa', time: state.gameTime });
      }
      state.fleets.splice(i, 1);
    } else {
      // Update ship positions along bezier path
      const from = state.planets[fleet.fromPlanetId];
      const to = state.planets[fleet.toPlanetId];
      if (from && to) {
        const t = fleet.progress;
        const invT = 1 - t;
        // Quadratic bezier
        const bx = invT * invT * from.wx + 2 * invT * t * fleet.cx + t * t * to.wx;
        const by = invT * invT * from.wy + 2 * invT * t * fleet.cy + t * t * to.wy;
        const facing = Math.atan2(to.wy - from.wy, to.wx - from.wx);

        for (let j = 0; j < fleet.ships.length; j++) {
          const offset = (j - fleet.ships.length / 2) * 8;
          fleet.ships[j].x = bx + Math.cos(facing + Math.PI / 2) * offset;
          fleet.ships[j].y = by + Math.sin(facing + Math.PI / 2) * offset;
          fleet.ships[j].facing = facing;
          fleet.ships[j].animState = 'moving';
        }

        // Trail particles
        if (Math.random() < 0.3) {
          state.particles.push({
            x: bx + (Math.random() - 0.5) * 10,
            y: by + (Math.random() - 0.5) * 10,
            vx: -Math.cos(facing) * 20,
            vy: -Math.sin(facing) * 20,
            life: 0.5, maxLife: 0.5,
            color: '#60a5fa',
            size: 1.5,
          });
        }
      }
    }
  }
}

// ── Send Fleet ─────────────────────────────────────────────────

export function sendFleet(state: SpaceConquestState, fromPlanetId: number, toPlanetId: number, shipIds: number[]): boolean {
  if (fromPlanetId === toPlanetId) return false;
  const from = state.planets[fromPlanetId];
  const to = state.planets[toPlanetId];
  if (!from || !to) return false;

  const ships: SpaceUnit[] = [];
  for (const id of shipIds) {
    const idx = from.playerShips.findIndex(s => s.id === id && !s.dead);
    if (idx >= 0) {
      ships.push(from.playerShips.splice(idx, 1)[0]);
    }
  }
  if (ships.length === 0) return false;

  // Compute speed from slowest ship
  const minSpd = Math.min(...ships.map(s => s.spd));
  const distance = dist(from, to);
  const travelTime = Math.max(2, distance / (minSpd * 0.5));
  const speed = 1 / travelTime;

  // Bezier control point (perpendicular offset for curved path)
  const mx = (from.wx + to.wx) / 2;
  const my = (from.wy + to.wy) / 2;
  const perpAngle = Math.atan2(to.wy - from.wy, to.wx - from.wx) + Math.PI / 2;
  const curveMag = distance * 0.2 * (Math.random() > 0.5 ? 1 : -1);

  state.fleets.push({
    id: nextId(),
    ships,
    fromPlanetId,
    toPlanetId,
    progress: 0,
    speed,
    cx: mx + Math.cos(perpAngle) * curveMag,
    cy: my + Math.sin(perpAngle) * curveMag,
  });

  state.log.push({ text: `Fleet dispatched: ${from.def.name} → ${to.def.name} (${ships.length} ships)`, color: '#c5a059', time: state.gameTime });
  return true;
}

// ── Build Ships ────────────────────────────────────────────────

export function queueShipBuild(state: SpaceConquestState, planetId: number, shipType: ShipType): boolean {
  const planet = state.planets[planetId];
  if (!planet || !planet.conquered) return false;
  if (!planet.def.buildableShips.includes(shipType)) return false;

  const bp = getShipBlueprint(shipType);
  if (!canAfford(state.resources, bp.cost)) return false;

  state.resources = subtractResources(state.resources, bp.cost);
  planet.buildQueue.push({ shipType, remaining: bp.buildTime, total: bp.buildTime });
  state.log.push({ text: `Building ${bp.name} at ${planet.def.name}`, color: bp.color, time: state.gameTime });
  return true;
}

function updateBuildQueues(state: SpaceConquestState, dt: number): void {
  for (const planet of state.planets) {
    if (!planet.conquered || planet.buildQueue.length === 0) continue;
    const entry = planet.buildQueue[0];
    entry.remaining -= dt;
    if (entry.remaining <= 0) {
      planet.buildQueue.shift();
      const ship = createPlayerShip(
        entry.shipType,
        planet.wx + (Math.random() - 0.5) * planet.def.size,
        planet.wy + (Math.random() - 0.5) * planet.def.size,
        planet.def.id,
      );
      planet.playerShips.push(ship);
      state.log.push({ text: `${getShipBlueprint(entry.shipType).name} completed at ${planet.def.name}!`, color: '#4ade80', time: state.gameTime });
    }
  }
}

// ── Resource Ticks ─────────────────────────────────────────────

function updateResourceTicks(state: SpaceConquestState, dt: number): void {
  state.resourceTickTimer += dt;
  if (state.resourceTickTimer >= 30) {
    state.resourceTickTimer -= 30;
    for (const planet of state.planets) {
      if (planet.conquered) {
        state.resources = addResources(state.resources, planet.def.resourceRate);
      }
    }
  }
}

// ── Pirate Raids ───────────────────────────────────────────────

function updatePirateRaids(state: SpaceConquestState, dt: number): void {
  if (!state.pirateRaidsStarted) return;
  state.pirateRaidTimer -= dt;
  if (state.pirateRaidTimer <= 0) {
    state.pirateRaidTimer = PIRATE_RAID.interval;

    const conqueredPlanets = state.planets.filter(p => p.conquered);
    if (conqueredPlanets.length === 0) return;

    // Pick a random conquered planet to raid
    const target = conqueredPlanets[Math.floor(Math.random() * conqueredPlanets.length)];
    const scale = 1 + (conqueredPlanets.length - 1) * PIRATE_RAID.scaleFactor;

    for (const entry of PIRATE_RAID.baseUnits) {
      const count = Math.ceil(entry.count * scale);
      for (let i = 0; i < count; i++) {
        const def = createNeutralUnit(entry.type, scale * 0.8);
        const angle = Math.random() * Math.PI * 2;
        const r = target.def.size + 60 + Math.random() * 40;
        const pirate = createSpaceUnit(def, target.wx + Math.cos(angle) * r, target.wy + Math.sin(angle) * r, 'pirate', target.def.id);
        pirate.color = '#f472b6'; // Pink for pirates
        target.neutrals.push(pirate);
      }
    }

    state.log.push({ text: `⚠ Pirate raid on ${target.def.name}!`, color: '#f472b6', time: state.gameTime });
  }
}

// ── VFX Update ─────────────────────────────────────────────────

function updateVFX(state: SpaceConquestState, dt: number): void {
  for (let i = state.vfx.length - 1; i >= 0; i--) {
    state.vfx[i].life -= dt;
    if (state.vfx[i].life <= 0) {
      state.vfx.splice(i, 1);
    }
  }
}

function updateParticles(state: SpaceConquestState, dt: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────

function dist(a: { wx?: number; wy?: number; x?: number; y?: number }, b: { wx?: number; wy?: number; x?: number; y?: number }): number {
  const ax = a.wx ?? a.x ?? 0;
  const ay = a.wy ?? a.y ?? 0;
  const bx = b.wx ?? b.x ?? 0;
  const by = b.wy ?? b.y ?? 0;
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

/** Get planet position at current time */
export function getPlanetPos(state: SpaceConquestState, planetId: number): { x: number; y: number } {
  const p = state.planets[planetId];
  return p ? { x: p.wx, y: p.wy } : { x: 0, y: 0 };
}

/** Get total fleet supply at a planet */
export function getPlanetSupply(planet: PlanetState): number {
  let total = 0;
  for (const s of planet.playerShips) {
    if (!s.dead) {
      const bp = getShipBlueprint(s.unitType as ShipType);
      if (bp) total += bp.supply;
    }
  }
  return total;
}

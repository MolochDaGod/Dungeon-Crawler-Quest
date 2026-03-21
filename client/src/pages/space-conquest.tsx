import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  createSpaceConquestState, updateSpaceConquest, SpaceConquestState,
  PlanetState, sendFleet, queueShipBuild, getPlanetSupply, SpaceUnit,
} from '@/game/space-conquest-engine';
import { renderSpaceConquest, hitTestPlanet } from '@/game/space-conquest-renderer';
import {
  RESOURCE_INFO, Resources, SHIP_BLUEPRINTS, ShipType, canAfford,
  getShipBlueprint, PLANETS,
} from '@/game/space-conquest-data';

// ── Helper: format time ────────────────────────────────────────

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Helper: resource tick countdown ────────────────────────────

function fmtTickCountdown(timer: number): string {
  const remaining = Math.max(0, 30 - timer);
  return `${Math.ceil(remaining)}s`;
}

// ── Main Page ──────────────────────────────────────────────────

export default function SpaceConquestPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SpaceConquestState | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [sendMode, setSendMode] = useState(false);
  const [selectedShipIds, setSelectedShipIds] = useState<number[]>([]);
  const panRef = useRef({ active: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  useEffect(() => {
    const state = createSpaceConquestState();
    stateRef.current = state;

    const canvas = canvasRef.current!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();
    let hudTimer = 0;
    let animId = 0;

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      updateSpaceConquest(state, dt);

      const ctx = canvas.getContext('2d');
      if (ctx) renderSpaceConquest(ctx, state, canvas.width, canvas.height);

      hudTimer += dt;
      if (hudTimer > 0.1) {
        hudTimer = 0;
        setHud(takeSnapshot(state));
      }

      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    // ── Input ──
    const getWorldPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left - canvas.width / 2;
      const sy = e.clientY - rect.top - canvas.height / 2;
      return {
        x: sx / state.camera.zoom + state.camera.x,
        y: sy / state.camera.zoom + state.camera.y,
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      const wp = getWorldPos(e);
      state.mouseWorld.x = wp.x;
      state.mouseWorld.y = wp.y;
      state.hoveredPlanetId = hitTestPlanet(state, wp.x, wp.y);

      if (panRef.current.active) {
        const dx = (e.clientX - panRef.current.startX) / state.camera.zoom;
        const dy = (e.clientY - panRef.current.startY) / state.camera.zoom;
        state.camera.x = panRef.current.camStartX - dx;
        state.camera.y = panRef.current.camStartY - dy;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        const wp = getWorldPos(e);
        const hitId = hitTestPlanet(state, wp.x, wp.y);
        if (hitId >= 0) {
          state.selectedPlanetId = hitId;
        } else {
          state.selectedPlanetId = -1;
        }
      }
      if (e.button === 1) {
        e.preventDefault();
        panRef.current = { active: true, startX: e.clientX, startY: e.clientY, camStartX: state.camera.x, camStartY: state.camera.y };
      }
      // Right-click: send fleet if in send mode
      if (e.button === 2) {
        e.preventDefault();
        const wp = getWorldPos(e);
        const hitId = hitTestPlanet(state, wp.x, wp.y);
        if (hitId >= 0 && state.selectedPlanetId >= 0 && hitId !== state.selectedPlanetId) {
          // Send all ships from selected planet to right-clicked planet
          const from = state.planets[state.selectedPlanetId];
          if (from) {
            const ids = from.playerShips.filter(s => !s.dead).map(s => s.id);
            if (ids.length > 0) {
              sendFleet(state, state.selectedPlanetId, hitId, ids);
            }
          }
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) panRef.current.active = false;
    };

    const onWheel = (e: WheelEvent) => {
      state.camera.zoom = Math.max(0.3, Math.min(2.5, state.camera.zoom - e.deltaY * 0.001));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        state.selectedPlanetId = -1;
        setSendMode(false);
      }
      if (e.key === 'p') state.paused = !state.paused;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleBuildShip = useCallback((shipType: ShipType) => {
    if (stateRef.current && stateRef.current.selectedPlanetId >= 0) {
      queueShipBuild(stateRef.current, stateRef.current.selectedPlanetId, shipType);
    }
  }, []);

  const handleSendAll = useCallback((toPlanetId: number) => {
    const state = stateRef.current;
    if (!state || state.selectedPlanetId < 0) return;
    const from = state.planets[state.selectedPlanetId];
    if (!from) return;
    const ids = from.playerShips.filter(s => !s.dead).map(s => s.id);
    if (ids.length > 0) sendFleet(state, state.selectedPlanetId, toPlanetId, ids);
  }, []);

  const selectedPlanet = hud ? hud.planets.find(p => p.id === hud.selectedPlanetId) : null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black" style={{ fontFamily: "'Oxanium', sans-serif" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ cursor: 'crosshair' }} />

      {hud && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>

          {/* ── Top Resource Bar ── */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center pointer-events-auto"
            style={{
              background: 'linear-gradient(to bottom, rgba(10,10,26,0.95), rgba(5,5,16,0.9))',
              borderBottom: '2px solid #c5a059',
              borderLeft: '1px solid #c5a05960',
              borderRight: '1px solid #c5a05960',
              borderRadius: '0 0 12px 12px',
              padding: '6px 20px', gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
            }}
          >
            {(Object.keys(RESOURCE_INFO) as (keyof Resources)[]).map(key => (
              <div key={key} className="flex items-center" style={{ gap: 4 }}>
                <span style={{ fontSize: 12 }}>{RESOURCE_INFO[key].icon}</span>
                <span className="text-xs font-bold" style={{ color: RESOURCE_INFO[key].color }}>
                  {Math.floor(hud.resources[key])}
                </span>
              </div>
            ))}
            <div style={{ width: 1, height: 20, background: '#c5a05940' }} />
            <div className="flex flex-col items-center" style={{ gap: 1 }}>
              <span className="text-[9px]" style={{ color: '#888' }}>TIME</span>
              <span className="text-xs font-bold" style={{ color: '#c5a059' }}>{fmtTime(hud.gameTime)}</span>
            </div>
            <div className="flex flex-col items-center" style={{ gap: 1 }}>
              <span className="text-[9px]" style={{ color: '#888' }}>TICK</span>
              <span className="text-[10px] font-bold" style={{ color: '#fbbf24' }}>{fmtTickCountdown(hud.resourceTickTimer)}</span>
            </div>
            <div style={{ width: 1, height: 20, background: '#c5a05940' }} />
            <div className="flex flex-col items-center" style={{ gap: 1 }}>
              <span className="text-[9px]" style={{ color: '#888' }}>SCORE</span>
              <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{Math.floor(hud.score)}</span>
            </div>
            <div className="flex items-center" style={{ gap: 2 }}>
              <span className="text-[9px] font-bold" style={{ color: '#4ade80' }}>
                {hud.planetsConquered}/{hud.planetsTotal}
              </span>
              <span className="text-[8px]" style={{ color: '#888' }}>PLANETS</span>
            </div>
          </div>

          {/* ── Bottom Left: Planet Info ── */}
          <div className="absolute bottom-2 left-2 pointer-events-auto" style={{ width: 260 }}>
            {selectedPlanet ? (
              <PlanetInfoPanel planet={selectedPlanet} resources={hud.resources} />
            ) : (
              <div className="p-3 rounded-lg"
                style={{
                  background: 'linear-gradient(to bottom, rgba(10,10,26,0.9), rgba(5,5,16,0.9))',
                  border: '1px solid #333',
                  boxShadow: '0 0 15px rgba(0,0,0,0.7)',
                }}
              >
                <span className="text-xs" style={{ color: '#555' }}>Click a planet to view info</span>
              </div>
            )}

            {/* Event Log */}
            <div className="mt-2 p-2 rounded text-xs overflow-y-auto"
              style={{
                maxHeight: 120,
                background: 'linear-gradient(to bottom, rgba(10,10,26,0.85), rgba(5,5,16,0.85))',
                border: '1px solid #222',
              }}
            >
              <div className="text-[9px] font-bold mb-1" style={{ color: '#c5a059' }}>EVENT LOG</div>
              {hud.log.slice(-8).map((entry, i) => (
                <div key={i} style={{ color: entry.color, fontSize: 9, lineHeight: 1.4 }}>{entry.text}</div>
              ))}
            </div>
          </div>

          {/* ── Bottom Right: Ship Builder ── */}
          <div className="absolute bottom-2 right-2 pointer-events-auto" style={{ width: 280 }}>
            {selectedPlanet && selectedPlanet.conquered ? (
              <ShipBuilderPanel
                planet={selectedPlanet}
                resources={hud.resources}
                onBuild={handleBuildShip}
                allPlanets={hud.planets}
                onSendFleet={handleSendAll}
              />
            ) : selectedPlanet ? (
              <div className="p-3 rounded-lg"
                style={{
                  background: 'linear-gradient(to bottom, rgba(10,10,26,0.9), rgba(5,5,16,0.9))',
                  border: '1px solid #ef444433',
                  boxShadow: '0 0 15px rgba(0,0,0,0.7)',
                }}
              >
                <span className="text-xs" style={{ color: '#ef4444' }}>
                  ⚠ Defeat neutrals to conquer {selectedPlanet.name}
                </span>
                <div className="mt-1 text-[10px]" style={{ color: '#888' }}>
                  Garrison: {selectedPlanet.neutralCount} hostiles
                </div>
                <div className="mt-1 text-[9px]" style={{ color: '#555' }}>
                  Right-click another planet to send your fleet here
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg"
                style={{
                  background: 'linear-gradient(to bottom, rgba(10,10,26,0.9), rgba(5,5,16,0.9))',
                  border: '1px solid #333',
                  boxShadow: '0 0 15px rgba(0,0,0,0.7)',
                }}
              >
                <span className="text-xs" style={{ color: '#555' }}>Select a conquered planet to build ships</span>
              </div>
            )}
          </div>

          {/* ── Pause Overlay ── */}
          {hud.paused && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="text-4xl font-black" style={{ color: '#c5a059', textShadow: '0 0 30px rgba(197,160,89,0.5)' }}>
                PAUSED
              </div>
            </div>
          )}

          {/* ── Victory / Game Over ── */}
          {hud.gameOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="text-center">
                <h1 className="text-6xl font-black mb-4"
                  style={{ color: '#ffd700', textShadow: '0 0 60px rgba(255,215,0,0.5)' }}
                >
                  SECTOR CONQUERED
                </h1>
                <p className="text-gray-400 mb-2">Score: {Math.floor(hud.score)}</p>
                <p className="text-gray-500 mb-6">Time: {fmtTime(hud.gameTime)}</p>
                <button
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-lg hover:from-red-500 hover:to-red-700 transition-all cursor-pointer"
                  onClick={() => setLocation('/')}
                >
                  RETURN TO MENU
                </button>
              </div>
            </div>
          )}

          {/* ── Controls hint ── */}
          <div className="absolute top-14 right-3" style={{ fontSize: 9, color: '#555' }}>
            <div>LMB: Select planet</div>
            <div>RMB: Send fleet</div>
            <div>MMB: Pan camera</div>
            <div>Scroll: Zoom</div>
            <div>P: Pause</div>
            <div>ESC: Deselect</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Planet Info Panel ───────────────────────────────────────────

interface PlanetHudInfo {
  id: number;
  name: string;
  color: string;
  conquered: boolean;
  inCombat: boolean;
  biome: string;
  description: string;
  resourceRate: Resources;
  neutralCount: number;
  playerShipCount: number;
  buildableShips: ShipType[];
  buildQueue: { shipType: ShipType; remaining: number; total: number }[];
  playerShips: { id: number; unitType: string; hp: number; maxHp: number }[];
}

function PlanetInfoPanel({ planet, resources }: { planet: PlanetHudInfo; resources: Resources }) {
  return (
    <div className="p-3 rounded-lg"
      style={{
        background: 'linear-gradient(to bottom, rgba(10,10,26,0.95), rgba(5,5,16,0.95))',
        border: `1px solid ${planet.color}40`,
        boxShadow: `0 0 15px rgba(0,0,0,0.7), 0 0 4px ${planet.color}15`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center" style={{ gap: 6 }}>
          <div className="w-3 h-3 rounded-full" style={{ background: planet.color, boxShadow: `0 0 6px ${planet.color}` }} />
          <span className="text-sm font-black" style={{ color: planet.color }}>{planet.name}</span>
        </div>
        <span className="text-[9px] font-bold" style={{ color: planet.conquered ? '#4ade80' : planet.inCombat ? '#ef4444' : '#888' }}>
          {planet.conquered ? '★ OWNED' : planet.inCombat ? '⚔ COMBAT' : '◆ HOSTILE'}
        </span>
      </div>

      <p className="text-[10px] mb-2" style={{ color: '#888' }}>{planet.description}</p>

      <div className="text-[9px] font-bold mb-1" style={{ color: '#c5a059' }}>RESOURCES / 30s</div>
      <div className="flex flex-wrap mb-2" style={{ gap: 6 }}>
        {(Object.keys(RESOURCE_INFO) as (keyof Resources)[]).map(key => (
          planet.resourceRate[key] > 0 ? (
            <div key={key} className="flex items-center" style={{ gap: 2 }}>
              <span style={{ fontSize: 10 }}>{RESOURCE_INFO[key].icon}</span>
              <span className="text-[10px] font-bold" style={{ color: RESOURCE_INFO[key].color }}>
                +{planet.resourceRate[key]}
              </span>
            </div>
          ) : null
        ))}
      </div>

      <div className="flex justify-between text-[10px]" style={{ borderTop: '1px solid #222', paddingTop: 4 }}>
        <div>
          <span style={{ color: '#888' }}>Neutrals: </span>
          <span className="font-bold" style={{ color: planet.neutralCount > 0 ? '#ef4444' : '#4ade80' }}>
            {planet.neutralCount}
          </span>
        </div>
        <div>
          <span style={{ color: '#888' }}>Your ships: </span>
          <span className="font-bold" style={{ color: '#60a5fa' }}>{planet.playerShipCount}</span>
        </div>
      </div>

      {planet.playerShips.length > 0 && (
        <div className="mt-2" style={{ borderTop: '1px solid #222', paddingTop: 4 }}>
          <div className="text-[9px] font-bold mb-1" style={{ color: '#60a5fa' }}>FLEET</div>
          <div className="flex flex-wrap" style={{ gap: 3 }}>
            {planet.playerShips.map(s => {
              const bp = getShipBlueprint(s.unitType as ShipType);
              return (
                <div key={s.id} className="flex items-center" style={{
                  gap: 2, padding: '1px 4px', borderRadius: 2,
                  background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                }}>
                  <span className="text-[8px] font-bold" style={{ color: bp?.color || '#60a5fa' }}>
                    {bp?.name || s.unitType}
                  </span>
                  <span className="text-[7px]" style={{ color: '#888' }}>
                    {Math.floor(s.hp)}/{s.maxHp}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ship Builder Panel ─────────────────────────────────────────

function ShipBuilderPanel({ planet, resources, onBuild, allPlanets, onSendFleet }: {
  planet: PlanetHudInfo;
  resources: Resources;
  onBuild: (type: ShipType) => void;
  allPlanets: PlanetHudInfo[];
  onSendFleet: (toPlanetId: number) => void;
}) {
  return (
    <div className="p-3 rounded-lg"
      style={{
        background: 'linear-gradient(to bottom, rgba(10,10,26,0.95), rgba(5,5,16,0.95))',
        border: `1px solid ${planet.color}40`,
        boxShadow: `0 0 15px rgba(0,0,0,0.7), 0 0 4px ${planet.color}15`,
      }}
    >
      <div className="text-[10px] font-black mb-2" style={{ color: '#c5a059' }}>
        BUILD SHIPS — {planet.name}
      </div>

      {/* Build queue */}
      {planet.buildQueue.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] font-bold mb-1" style={{ color: '#fbbf24' }}>BUILDING</div>
          {planet.buildQueue.map((entry, i) => {
            const bp = getShipBlueprint(entry.shipType);
            const pct = ((entry.total - entry.remaining) / entry.total) * 100;
            return (
              <div key={i} className="flex items-center mb-1" style={{ gap: 4 }}>
                <span className="text-[9px] font-bold" style={{ color: bp?.color || '#888', width: 60 }}>{bp?.name}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a2e' }}>
                  <div className="h-full transition-all" style={{ width: `${pct}%`, background: bp?.color || '#fbbf24' }} />
                </div>
                <span className="text-[8px]" style={{ color: '#888' }}>{Math.ceil(entry.remaining)}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Buildable ships grid */}
      <div className="space-y-1.5">
        {planet.buildableShips.map(type => {
          const bp = SHIP_BLUEPRINTS.find(s => s.type === type)!;
          const affordable = canAfford(resources, bp.cost);
          return (
            <button
              key={type}
              className={`w-full text-left p-1.5 rounded border transition-all ${
                affordable ? 'cursor-pointer hover:border-opacity-100' : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: affordable ? `${bp.color}08` : '#0a0a15',
                border: `1px solid ${affordable ? bp.color + '40' : '#222'}`,
              }}
              onClick={() => affordable && onBuild(type)}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold" style={{ color: bp.color }}>{bp.name}</span>
                <span className="text-[8px]" style={{ color: '#888' }}>{bp.buildTime}s</span>
              </div>
              <p className="text-[8px]" style={{ color: '#555' }}>{bp.description}</p>
              <div className="flex flex-wrap mt-0.5" style={{ gap: 4 }}>
                {(Object.keys(RESOURCE_INFO) as (keyof Resources)[]).map(key => (
                  bp.cost[key] > 0 ? (
                    <span key={key} className="text-[8px]" style={{ color: resources[key] >= bp.cost[key] ? RESOURCE_INFO[key].color : '#ef4444' }}>
                      {RESOURCE_INFO[key].icon}{bp.cost[key]}
                    </span>
                  ) : null
                ))}
              </div>
              <div className="flex mt-0.5" style={{ gap: 6 }}>
                <span className="text-[8px]" style={{ color: '#f87171' }}>ATK {bp.atk}</span>
                <span className="text-[8px]" style={{ color: '#60a5fa' }}>DEF {bp.def}</span>
                <span className="text-[8px]" style={{ color: '#4ade80' }}>HP {bp.hp}</span>
                <span className="text-[8px]" style={{ color: '#fbbf24' }}>SPD {bp.spd}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Send fleet controls */}
      {planet.playerShipCount > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: '1px solid #222' }}>
          <div className="text-[9px] font-bold mb-1" style={{ color: '#60a5fa' }}>
            SEND FLEET ({planet.playerShipCount} ships)
          </div>
          <div className="text-[8px] mb-1" style={{ color: '#555' }}>Right-click a planet to dispatch all ships</div>
          <div className="flex flex-wrap" style={{ gap: 3 }}>
            {allPlanets.filter(p => p.id !== planet.id).map(p => (
              <button
                key={p.id}
                className="text-[8px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all hover:brightness-125"
                style={{
                  background: `${p.color}15`,
                  border: `1px solid ${p.color}30`,
                  color: p.color,
                }}
                onClick={() => onSendFleet(p.id)}
              >
                → {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HUD Snapshot (extracted from state each tick) ───────────────

interface HudSnapshot {
  gameTime: number;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  resources: Resources;
  resourceTickTimer: number;
  score: number;
  selectedPlanetId: number;
  planetsConquered: number;
  planetsTotal: number;
  planets: PlanetHudInfo[];
  log: { text: string; color: string }[];
}

function takeSnapshot(state: SpaceConquestState): HudSnapshot {
  return {
    gameTime: state.gameTime,
    paused: state.paused,
    gameOver: state.gameOver,
    victory: state.victory,
    resources: { ...state.resources },
    resourceTickTimer: state.resourceTickTimer,
    score: state.score,
    selectedPlanetId: state.selectedPlanetId,
    planetsConquered: state.planets.filter(p => p.conquered).length,
    planetsTotal: state.planets.length,
    planets: state.planets.map(p => ({
      id: p.def.id,
      name: p.def.name,
      color: p.def.color,
      conquered: p.conquered,
      inCombat: p.inCombat,
      biome: p.def.biome,
      description: p.def.description,
      resourceRate: p.def.resourceRate,
      neutralCount: p.neutrals.filter(u => !u.dead).length,
      playerShipCount: p.playerShips.filter(u => !u.dead).length,
      buildableShips: p.def.buildableShips,
      buildQueue: p.buildQueue.map(q => ({ ...q })),
      playerShips: p.playerShips.filter(u => !u.dead).map(u => ({
        id: u.id, unitType: u.unitType, hp: u.hp, maxHp: u.maxHp,
      })),
    })),
    log: state.log.slice(-10).map(l => ({ text: l.text, color: l.color })),
  };
}

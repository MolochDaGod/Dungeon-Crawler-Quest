import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  ISLAND_ZONES, OPEN_WORLD_SIZE, getZoneColor, DUNGEON_ENTRANCES,
  ZONE_ROADS, ZONE_BUILDINGS,
} from '@/game/zones';
import {
  generateFullWorld, generateZoneData, saveGeneratedWorld,
  loadGeneratedWorld, clearGeneratedWorld, GeneratedWorldData,
  GeneratedZoneData, BIOME_CONFIGS,
} from '@/game/ai-map-gen';

interface Camera { x: number; y: number; zoom: number; }
type EditorTool = 'select' | 'pan' | 'move-deco' | 'move-building' | 'move-entrance';

export default function WorldEditorPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Camera>({ x: OPEN_WORLD_SIZE / 2, y: OPEN_WORLD_SIZE / 2, zoom: 0.06 });
  const animRef = useRef(0);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });

  const [worldData, setWorldData] = useState<GeneratedWorldData | null>(() => loadGeneratedWorld());
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [tool, setTool] = useState<EditorTool>('select');
  const [seed, setSeed] = useState(42);
  const [showDecos, setShowDecos] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showEnemies, setShowEnemies] = useState(true);
  const [showDungeons, setShowDungeons] = useState(true);
  const [showCodeData, setShowCodeData] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const worldRef = useRef(worldData);
  useEffect(() => { worldRef.current = worldData; }, [worldData]);

  const flash = (msg: string) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(''), 2500); };

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const cam = camRef.current;
    return { wx: (sx - canvas.width / 2) / cam.zoom + cam.x, wy: (sy - canvas.height / 2) / cam.zoom + cam.y };
  }, []);

  // ── Generate ─────────────────────────────────────────────────

  const handleGenerateAll = useCallback(() => {
    const data = generateFullWorld(seed);
    setWorldData(data);
    saveGeneratedWorld(data);
    flash(`World generated (seed: ${seed}, ${data.zones.reduce((s, z) => s + z.decorations.length, 0)} decorations)`);
  }, [seed]);

  const handleGenerateZone = useCallback(() => {
    if (selectedZoneId === null) return;
    const zone = ISLAND_ZONES.find(z => z.id === selectedZoneId);
    if (!zone) return;

    const zoneData = generateZoneData(
      zone.id, zone.bounds, zone.terrainType,
      zone.requiredLevel, zone.isSafeZone, zone.islandType, seed + zone.id * 137,
    );

    setWorldData(prev => {
      const base = prev || { version: 1, zones: [], globalRoads: [], timestamp: Date.now() };
      const zones = base.zones.filter(z => z.zoneId !== selectedZoneId);
      zones.push(zoneData);
      const next = { ...base, zones, timestamp: Date.now() };
      saveGeneratedWorld(next);
      return next;
    });
    flash(`Zone "${zone.name}" generated (${zoneData.decorations.length} decos, ${zoneData.buildings.length} buildings)`);
  }, [selectedZoneId, seed]);

  const handleClear = useCallback(() => {
    clearGeneratedWorld();
    setWorldData(null);
    flash('Generated data cleared');
  }, []);

  const handleSave = useCallback(() => {
    if (worldData) { saveGeneratedWorld(worldData); flash('Saved to localStorage'); }
  }, [worldData]);

  // ── Mouse Handlers ───────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanningRef.current = true;
      panStartRef.current = { mx: sx, my: sy, cx: camRef.current.x, cy: camRef.current.y };
      return;
    }

    if (e.button === 0 && tool === 'select') {
      const { wx, wy } = screenToWorld(sx, sy);
      let found: number | null = null;
      for (const zone of ISLAND_ZONES) {
        const b = zone.bounds;
        if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
          found = zone.id;
          break;
        }
      }
      setSelectedZoneId(found);
    }
  }, [tool, screenToWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanningRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const cam = camRef.current;
    cam.x = panStartRef.current.cx - (sx - panStartRef.current.mx) / cam.zoom;
    cam.y = panStartRef.current.cy - (sy - panStartRef.current.my) / cam.zoom;
  }, []);

  const handleMouseUp = useCallback(() => { isPanningRef.current = false; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const cam = camRef.current;
    cam.zoom = Math.max(0.01, Math.min(0.5, cam.zoom * (e.deltaY < 0 ? 1.15 : 0.87)));
  }, []);

  // ── Canvas Resize ────────────────────────────────────────────

  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (c) { c.width = window.innerWidth; c.height = window.innerHeight; }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ── Render Loop ──────────────────────────────────────────────

  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) { animRef.current = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      const cam = camRef.current;
      const wd = worldRef.current;

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.x, -cam.y);

      // World boundary
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, OPEN_WORLD_SIZE, OPEN_WORLD_SIZE);

      // Draw zones
      for (const zone of ISLAND_ZONES) {
        const b = zone.bounds;
        const isSelected = zone.id === selectedZoneId;
        const color = getZoneColor(zone);

        // Zone fill
        ctx.fillStyle = color + '30';
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // Zone border
        ctx.strokeStyle = isSelected ? '#ffd700' : color;
        ctx.lineWidth = isSelected ? 4 : 2;
        if (isSelected) { ctx.setLineDash([12, 6]); }
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);

        // Zone label
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(12, 14 / cam.zoom * 0.01)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(zone.name, b.x + b.w / 2, b.y + b.h / 2 - 10);
        ctx.font = `${Math.max(9, 10 / cam.zoom * 0.01)}px sans-serif`;
        ctx.fillStyle = '#888';
        ctx.fillText(`Lv${zone.requiredLevel} • ${zone.terrainType}`, b.x + b.w / 2, b.y + b.h / 2 + 10);
      }

      // Code-defined data
      if (showCodeData) {
        // Zone roads
        if (showRoads) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = '#7a5c3a';
          ctx.lineWidth = 8;
          ctx.lineCap = 'round';
          for (const road of ZONE_ROADS) {
            ctx.beginPath();
            ctx.moveTo(road.from.x, road.from.y);
            ctx.lineTo(road.to.x, road.to.y);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }

        // Zone buildings
        if (showBuildings) {
          ctx.globalAlpha = 0.5;
          for (const bld of ZONE_BUILDINGS) {
            ctx.fillStyle = bld.color;
            ctx.fillRect(bld.x - bld.w / 2, bld.y - bld.h / 2, bld.w, bld.h);
          }
          ctx.globalAlpha = 1;
        }

        // Dungeon entrances
        if (showDungeons) {
          for (const ent of DUNGEON_ENTRANCES) {
            ctx.fillStyle = '#ef444480';
            ctx.beginPath();
            ctx.arc(ent.x, ent.y, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ent.name, ent.x, ent.y - 30);
          }
        }
      }

      // Generated world data
      if (wd) {
        // Generated roads
        if (showRoads) {
          ctx.globalAlpha = 0.5;
          ctx.lineCap = 'round';
          for (const road of wd.globalRoads) {
            ctx.strokeStyle = road.type === 'stone' ? '#8a8a9a' : road.type === 'bridge' ? '#a07040' : '#7a5c3a';
            ctx.lineWidth = road.width;
            if (road.points.length > 1) {
              ctx.beginPath();
              ctx.moveTo(road.points[0].x, road.points[0].y);
              for (let i = 1; i < road.points.length; i++) ctx.lineTo(road.points[i].x, road.points[i].y);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        }

        // Zone-specific generated data
        for (const zd of wd.zones) {
          const zone = ISLAND_ZONES.find(z => z.id === zd.zoneId);
          if (!zone) continue;

          // Decorations
          if (showDecos) {
            ctx.globalAlpha = 0.6;
            for (const d of zd.decorations) {
              const size = 4 * d.scale;
              const isTree = d.type.includes('tree') || d.type === 'pine_tree';
              const isRock = d.type.includes('rock') || d.type.includes('boulder') || d.type === 'pebble';
              ctx.fillStyle = isTree ? '#2a5c1a' : isRock ? '#5a5a6a' : '#3a7a2a';
              if (isTree) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y - size);
                ctx.lineTo(d.x - size * 0.7, d.y + size * 0.3);
                ctx.lineTo(d.x + size * 0.7, d.y + size * 0.3);
                ctx.fill();
              } else if (isRock) {
                ctx.beginPath();
                ctx.ellipse(d.x, d.y, size * 0.7, size * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(d.x, d.y, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.globalAlpha = 1;
          }

          // Buildings
          if (showBuildings) {
            for (const b of zd.buildings) {
              ctx.fillStyle = b.color;
              ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
              ctx.fillStyle = b.roofColor;
              ctx.beginPath();
              ctx.moveTo(b.x - b.w / 2 - 3, b.y - b.h / 2);
              ctx.lineTo(b.x, b.y - b.h / 2 - 10);
              ctx.lineTo(b.x + b.w / 2 + 3, b.y - b.h / 2);
              ctx.closePath();
              ctx.fill();
            }
          }

          // Enemy camps
          if (showEnemies) {
            for (const camp of zd.enemyCamps) {
              ctx.strokeStyle = '#ef444460';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(camp.x, camp.y, camp.radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = '#ef4444';
              ctx.font = '8px sans-serif';
              ctx.textAlign = 'center';
              const label = camp.enemies.map(e => `${e.count}x ${e.type}`).join(', ');
              ctx.fillText(label, camp.x, camp.y + 4);
            }
          }
        }
      }

      // Monster spawn points from code
      if (showEnemies && showCodeData) {
        for (const zone of ISLAND_ZONES) {
          for (const ms of zone.monsterSpawns) {
            ctx.fillStyle = '#ff444430';
            ctx.beginPath();
            ctx.arc(ms.x, ms.y, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ff8888';
            ctx.font = '7px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${ms.type} L${ms.level}`, ms.x, ms.y + 3);
          }
        }
      }

      // NPC positions
      if (showCodeData) {
        for (const zone of ISLAND_ZONES) {
          for (const npc of zone.npcPositions) {
            ctx.fillStyle = '#22c55e80';
            ctx.beginPath();
            ctx.arc(npc.x, npc.y, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#22c55e';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('NPC', npc.x, npc.y + 3);
          }
        }
      }

      ctx.restore();

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W - 220, H - 30, 220, 30);
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Zoom: ${(cam.zoom * 100).toFixed(0)}%  |  ${Math.round(cam.x)}, ${Math.round(cam.y)}`, W - 10, H - 10);

      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [selectedZoneId, showDecos, showBuildings, showRoads, showEnemies, showDungeons, showCodeData]);

  const selectedZone = selectedZoneId !== null ? ISLAND_ZONES.find(z => z.id === selectedZoneId) : null;
  const selectedZoneGen = selectedZoneId !== null ? worldData?.zones.find(z => z.zoneId === selectedZoneId) : null;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none" onContextMenu={e => e.preventDefault()}>
      <canvas ref={canvasRef} className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onWheel={handleWheel} />

      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gray-900/90 border-b border-gray-700 flex items-center px-3 gap-2 z-10">
        <button onClick={() => setLocation('/')} className="text-gray-400 hover:text-white text-sm mr-2">← Home</button>
        <div className="text-amber-400 font-bold text-sm mr-4">🗺️ WORLD EDITOR</div>

        <div className="flex items-center gap-1 mr-4">
          <span className="text-gray-500 text-xs">Seed:</span>
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
            className="w-16 bg-gray-800 border border-gray-600 rounded text-xs text-white px-2 py-1" />
        </div>

        <button onClick={handleGenerateAll}
          className="px-3 py-1 bg-purple-700 rounded text-xs text-white font-bold hover:bg-purple-600">
          ⚡ Generate All
        </button>
        <button onClick={handleGenerateZone} disabled={selectedZoneId === null}
          className={`px-3 py-1 rounded text-xs font-bold ${selectedZoneId !== null ? 'bg-blue-700 text-white hover:bg-blue-600' : 'bg-gray-800 text-gray-600'}`}>
          🎯 Generate Zone
        </button>
        <button onClick={handleSave}
          className="px-3 py-1 bg-green-700 rounded text-xs text-white font-bold hover:bg-green-600">
          💾 Save
        </button>
        <button onClick={handleClear}
          className="px-2 py-1 bg-red-900 rounded text-xs text-gray-300 hover:bg-red-800">
          Clear
        </button>

        <div className="flex-1" />
        {statusMsg && <div className="text-green-400 text-xs font-bold animate-pulse">{statusMsg}</div>}
      </div>

      {/* Left Sidebar */}
      <div className="absolute top-12 left-0 w-56 bottom-0 bg-gray-900/90 border-r border-gray-700 overflow-y-auto z-10 p-3 space-y-3">
        <div className="text-xs text-gray-400 uppercase font-bold">Zones</div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {ISLAND_ZONES.map(z => (
            <button key={z.id} onClick={() => setSelectedZoneId(z.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition-colors ${selectedZoneId === z.id
                ? 'bg-amber-900/50 border border-amber-500 text-amber-300'
                : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400 border border-transparent'}`}>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: getZoneColor(z) }} />
                <span className="font-bold truncate">{z.name}</span>
              </div>
              <div className="text-[9px] text-gray-600 ml-4">Lv{z.requiredLevel} • {z.terrainType}</div>
            </button>
          ))}
        </div>

        {/* View Toggles */}
        <div className="border-t border-gray-700 pt-3">
          <div className="text-xs text-gray-400 uppercase font-bold mb-2">Layers</div>
          {[
            { label: 'Decorations', value: showDecos, setter: setShowDecos },
            { label: 'Buildings', value: showBuildings, setter: setShowBuildings },
            { label: 'Roads', value: showRoads, setter: setShowRoads },
            { label: 'Enemies', value: showEnemies, setter: setShowEnemies },
            { label: 'Dungeons', value: showDungeons, setter: setShowDungeons },
            { label: 'Code Data', value: showCodeData, setter: setShowCodeData },
          ].map(tog => (
            <label key={tog.label} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer mb-1">
              <input type="checkbox" checked={tog.value} onChange={() => tog.setter((v: boolean) => !v)} className="accent-amber-500" />
              {tog.label}
            </label>
          ))}
        </div>

        {/* Stats */}
        {worldData && (
          <div className="border-t border-gray-700 pt-3">
            <div className="text-xs text-gray-400 uppercase font-bold mb-1">Generated Stats</div>
            <div className="text-[10px] text-gray-500 space-y-0.5">
              <div>Zones: {worldData.zones.length}</div>
              <div>Decorations: {worldData.zones.reduce((s, z) => s + z.decorations.length, 0)}</div>
              <div>Buildings: {worldData.zones.reduce((s, z) => s + z.buildings.length, 0)}</div>
              <div>Enemy Camps: {worldData.zones.reduce((s, z) => s + z.enemyCamps.length, 0)}</div>
              <div>Roads: {worldData.globalRoads.length}</div>
              <div>Seed: {worldData.zones[0]?.seed ?? '-'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Selected Zone */}
      {selectedZone && (
        <div className="absolute top-12 right-0 w-64 bg-gray-900/90 border-l border-gray-700 z-10 p-3 space-y-3 max-h-[calc(100vh-3rem)] overflow-y-auto">
          <div className="text-xs text-gray-400 uppercase font-bold">Selected Zone</div>
          <div className="bg-gray-800 rounded p-2 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-bold" style={{ color: getZoneColor(selectedZone) }}>{selectedZone.name}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="text-white">{selectedZone.id}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Level</span><span className="text-amber-400">{selectedZone.requiredLevel}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Terrain</span><span className="text-white">{selectedZone.terrainType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Size</span><span className="text-white">{selectedZone.bounds.w}x{selectedZone.bounds.h}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">PvP</span><span className={selectedZone.isPvP ? 'text-red-400' : 'text-gray-600'}>{selectedZone.isPvP ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Safe</span><span className={selectedZone.isSafeZone ? 'text-green-400' : 'text-gray-600'}>{selectedZone.isSafeZone ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Spawns</span><span className="text-white">{selectedZone.monsterSpawns.length} points</span></div>
            <div className="flex justify-between"><span className="text-gray-500">NPCs</span><span className="text-white">{selectedZone.npcPositions.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Portals</span><span className="text-white">{selectedZone.portalPositions.length}</span></div>
          </div>

          <div className="text-[10px] text-gray-600">{selectedZone.description}</div>

          {/* Biome info */}
          {BIOME_CONFIGS[selectedZone.terrainType] && (
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-[10px] text-gray-500 font-bold mb-1">BIOME CONFIG</div>
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <div>Density: {BIOME_CONFIGS[selectedZone.terrainType].density}/100px²</div>
                <div>Height var: {BIOME_CONFIGS[selectedZone.terrainType].heightVariation}</div>
                <div>Road type: {BIOME_CONFIGS[selectedZone.terrainType].roadType}</div>
                <div>Enemy types: {BIOME_CONFIGS[selectedZone.terrainType].enemyTypes.map(e => e.type).join(', ')}</div>
              </div>
            </div>
          )}

          {/* Generated data for this zone */}
          {selectedZoneGen && (
            <div className="bg-gray-800/50 rounded p-2">
              <div className="text-[10px] text-green-500 font-bold mb-1">✓ GENERATED DATA</div>
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <div>Decorations: {selectedZoneGen.decorations.length}</div>
                <div>Buildings: {selectedZoneGen.buildings.length}</div>
                <div>Enemy camps: {selectedZoneGen.enemyCamps.length}</div>
                <div>Seed: {selectedZoneGen.seed}</div>
              </div>
            </div>
          )}

          {!selectedZoneGen && (
            <div className="text-[10px] text-gray-600 italic">No generated data. Click "Generate Zone" to create.</div>
          )}

          <button onClick={handleGenerateZone}
            className="w-full px-3 py-2 bg-blue-700 rounded text-xs text-white font-bold hover:bg-blue-600">
            ⚡ {selectedZoneGen ? 'Regenerate' : 'Generate'} Zone
          </button>

          {/* Focus camera on zone */}
          <button onClick={() => {
            camRef.current.x = selectedZone.bounds.x + selectedZone.bounds.w / 2;
            camRef.current.y = selectedZone.bounds.y + selectedZone.bounds.h / 2;
            camRef.current.zoom = Math.min(0.3, 800 / Math.max(selectedZone.bounds.w, selectedZone.bounds.h));
          }}
            className="w-full px-3 py-1.5 bg-gray-800 rounded text-xs text-gray-300 hover:bg-gray-700">
            📍 Focus Camera
          </button>
        </div>
      )}
    </div>
  );
}

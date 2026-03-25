import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { HEROES, RACE_COLORS, CLASS_COLORS } from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import { GATHERING_PROFESSIONS, loadProfessions, createResourceInventory } from '@/game/professions-system';
import {
  loadIslandState, tickIslandHarvest, deployHeroToIsland, recallHeroFromIsland,
  getDeployedHeroIds, getAvailableHeroes,
  getEstimatedYieldPerHour, IslandHarvestState,
} from '@/game/island-harvest';
import {
  generateHomeIsland, IslandMapData, IslandResourceNode, TILE, TILE_SIZE, TILE_COLORS, tileName,
} from '@/game/island-map';
import { getIslandAssets, IslandAssetLoader } from '@/game/island-assets';

// ── Constants ──────────────────────────────────────────────────

const CANVAS_W = 800;
const CANVAS_H = 600;
const MINIMAP_SIZE = 140;
const WATER_ANIM_SPEED = 0.8;

// Ground tile index per terrain type (maps to forest ground tile numbers)
const TERRAIN_GROUND_TILES: Record<number, number[]> = {
  [TILE.GRASS]: [3, 4, 5],
  [TILE.DENSE_GRASS]: [1, 2, 6],
  [TILE.SAND]: [7, 8, 9],
  [TILE.DIRT]: [10, 11, 12],
  [TILE.STONE]: [1, 2, 3],
};

// Decoration sprite keys
const DECO_KEYS: Record<string, string[]> = {
  tree: ['tree-01', 'tree-02', 'tree-03'],
  rock: ['rock-01', 'rock-02', 'rock-03', 'rock-04', 'rock-05'],
  stump: ['stump-01', 'stump-02', 'stump-03', 'stump-04'],
  bush: ['grass-01', 'grass-02', 'grass-03'],
  flower: ['grass-01', 'grass-02', 'grass-03'],
  palm: ['pirate-palm', 'pirate-palm'],
};

// ── Component ──────────────────────────────────────────────────

export default function IslandPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);
  const assetsRef = useRef<IslandAssetLoader>(getIslandAssets());
  const mapRef = useRef<IslandMapData>(generateHomeIsland());

  // Camera state
  const camRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false, lastX: 0, lastY: 0,
  });
  const keysRef = useRef<Set<string>>(new Set());

  // Game state
  const [islandState, setIslandState] = useState<IslandHarvestState>(() => loadIslandState());
  const [profs] = useState(() => loadProfessions());
  const [inv] = useState(() => createResourceInventory());
  const [selectedNode, setSelectedNode] = useState<IslandResourceNode | null>(null);
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [, forceUpdate] = useState(0);

  const deployedIds = getDeployedHeroIds(islandState);
  const availableHeroes = getAvailableHeroes(deployedIds);

  // Center camera on island spawn point
  useEffect(() => {
    const map = mapRef.current;
    camRef.current.x = map.spawnTile.x * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
    camRef.current.y = map.spawnTile.y * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
  }, []);

  // Load assets
  useEffect(() => {
    assetsRef.current.loadAll().then(() => {
      setAssetsLoaded(true);
    });
  }, []);

  // Tick harvests on mount
  useEffect(() => {
    const result = tickIslandHarvest(islandState, profs, inv);
    if (result.totalResourcesGained > 0) setIslandState({ ...islandState });
  }, []);

  // Auto-tick every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      tickIslandHarvest(islandState, profs, inv);
      setIslandState({ ...islandState });
      forceUpdate(n => n + 1);
    }, 60_000);
    return () => clearInterval(timer);
  }, [islandState]);

  // ── Keyboard camera ──────────────────────────────────────────

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Mouse drag ───────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    camRef.current.x -= dx;
    camRef.current.y -= dy;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  // ── Click to select node ─────────────────────────────────────

  const onClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX + camRef.current.x;
    const clickY = (e.clientY - rect.top) * scaleY + camRef.current.y;
    const tileX = Math.floor(clickX / TILE_SIZE);
    const tileY = Math.floor(clickY / TILE_SIZE);

    const map = mapRef.current;
    const node = map.resourceNodes.find(n => n.tileX === tileX && n.tileY === tileY);
    if (node) {
      setSelectedNode(node);
      setSelectedProfId(node.professionId);
    } else {
      setSelectedNode(null);
    }
  }, []);

  // ── Deploy / Recall ──────────────────────────────────────────

  const handleDeploy = useCallback(() => {
    if (!selectedHeroId || !selectedProfId) return;
    // Use zone 0 (starting village) as the island zone for harvest system
    const ok = deployHeroToIsland(islandState, selectedHeroId, 0, selectedProfId);
    if (ok) {
      setIslandState({ ...islandState });
      setSelectedHeroId(null);
      setSelectedProfId('');
      setSelectedNode(null);
    }
  }, [islandState, selectedHeroId, selectedProfId]);

  const handleRecall = useCallback((heroId: number) => {
    recallHeroFromIsland(islandState, heroId);
    setIslandState({ ...islandState });
  }, [islandState]);

  // ── Canvas render loop ───────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;
    const assets = assetsRef.current;
    const map = mapRef.current;
    const T = TILE_SIZE;

    let animId = 0;
    let t = 0;

    const render = () => {
      t += 0.016;

      // Keyboard camera movement
      const keys = keysRef.current;
      const speed = 6;
      if (keys.has('w') || keys.has('arrowup')) camRef.current.y -= speed;
      if (keys.has('s') || keys.has('arrowdown')) camRef.current.y += speed;
      if (keys.has('a') || keys.has('arrowleft')) camRef.current.x -= speed;
      if (keys.has('d') || keys.has('arrowright')) camRef.current.x += speed;

      const cam = camRef.current;
      const W = CANVAS_W;
      const H = CANVAS_H;

      // Visible tile range
      const startTX = Math.max(0, Math.floor(cam.x / T) - 1);
      const startTY = Math.max(0, Math.floor(cam.y / T) - 1);
      const endTX = Math.min(map.width, Math.ceil((cam.x + W) / T) + 1);
      const endTY = Math.min(map.height, Math.ceil((cam.y + H) / T) + 1);

      // ── Layer 0: Background ────────────────────────────────
      ctx.fillStyle = TILE_COLORS[TILE.DEEP_WATER];
      ctx.fillRect(0, 0, W, H);

      // ── Layer 1: Ground tiles ──────────────────────────────
      for (let ty = startTY; ty < endTY; ty++) {
        for (let tx = startTX; tx < endTX; tx++) {
          const tile = map.tiles[ty]?.[tx];
          if (tile === undefined || tile === TILE.DEEP_WATER) continue;

          const sx = tx * T - cam.x;
          const sy = ty * T - cam.y;

          // Try tileset image
          const groundNums = TERRAIN_GROUND_TILES[tile];
          let drawn = false;
          if (groundNums) {
            const idx = (tx + ty * 7) % groundNums.length;
            const img = assets.getGround(groundNums[idx]);
            if (img) {
              ctx.drawImage(img, sx, sy, T, T);
              drawn = true;
            }
          }

          if (!drawn) {
            // Fallback: colored tile
            ctx.fillStyle = TILE_COLORS[tile] || '#333';
            ctx.fillRect(sx, sy, T, T);
          }

          // Water: animated waves for shallow water
          if (tile === TILE.SHALLOW_WATER) {
            const wave = Math.sin(t * WATER_ANIM_SPEED + tx * 0.7 + ty * 0.5) * 0.15 + 0.3;
            ctx.fillStyle = `rgba(30, 140, 200, ${wave})`;
            ctx.fillRect(sx, sy, T, T);
          }
        }
      }

      // ── Layer 2: Decorations ───────────────────────────────
      for (let ty = startTY; ty < endTY; ty++) {
        for (let tx = startTX; tx < endTX; tx++) {
          const deco = map.decorations.get(`${tx},${ty}`);
          if (!deco) continue;

          const sx = tx * T - cam.x;
          const sy = ty * T - cam.y;
          const decoKeys = DECO_KEYS[deco.type];
          const key = decoKeys?.[deco.variant % (decoKeys?.length || 1)];
          const img = key ? assets.get(key) || assets.getEnv(key) : null;

          if (img) {
            // Trees render larger, overlapping above their tile
            const scale = deco.type === 'tree' ? 1.5 : deco.type === 'palm' ? 1.3 : 0.7;
            const dw = T * scale;
            const dh = T * scale;
            const ox = (T - dw) / 2;
            const oy = deco.type === 'tree' || deco.type === 'palm' ? -dh * 0.4 : (T - dh) / 2;
            ctx.drawImage(img, sx + ox, sy + oy, dw, dh);
          } else {
            // Fallback mini shapes
            if (deco.type === 'tree') {
              ctx.fillStyle = '#1a5a12';
              ctx.beginPath();
              ctx.arc(sx + T / 2, sy + T / 4, T * 0.35, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#5a3a1a';
              ctx.fillRect(sx + T / 2 - 3, sy + T / 4, 6, T * 0.5);
            } else if (deco.type === 'rock') {
              ctx.fillStyle = '#8a8a92';
              ctx.beginPath();
              ctx.ellipse(sx + T / 2, sy + T / 2, T * 0.25, T * 0.18, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // ── Layer 3: Structures ────────────────────────────────
      for (const s of map.structures) {
        const sx = s.tileX * T - cam.x;
        const sy = s.tileY * T - cam.y;
        const sw = s.tileW * T;
        const sh = s.tileH * T;

        // Off screen check
        if (sx + sw < 0 || sx > W || sy + sh < 0 || sy > H) continue;

        const img = assets.get(s.assetKey);
        if (img) {
          ctx.drawImage(img, sx, sy - sh * 0.2, sw, sh * 1.2);
        } else {
          // Fallback
          const colors: Record<string, string> = {
            castle: '#6a6a7a', dock: '#5a4030', house: '#6a5030',
            well: '#5a5a6a', tower: '#7a7a8a', boat: '#4a3020', palm: '#2a7a12',
          };
          ctx.fillStyle = colors[s.type] || '#555';
          ctx.fillRect(sx + 4, sy + 4, sw - 8, sh - 8);
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.strokeRect(sx + 4, sy + 4, sw - 8, sh - 8);
        }

        // Label
        if (s.label) {
          ctx.fillStyle = '#f5e2c1';
          ctx.font = "bold 9px 'JetBrains Mono', monospace";
          ctx.textAlign = 'center';
          ctx.fillText(s.label, sx + sw / 2, sy - 4);
        }
      }

      // ── Layer 4: Resource nodes ────────────────────────────
      for (const node of map.resourceNodes) {
        const nx = node.tileX * T - cam.x;
        const ny = node.tileY * T - cam.y;
        if (nx + T < 0 || nx > W || ny + T < 0 || ny > H) continue;

        const bob = Math.sin(t * 1.5 + node.id * 0.7) * 3;
        const isSelected = selectedNode?.id === node.id;

        // Glow ring
        if (isSelected) {
          ctx.strokeStyle = '#c5a059';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(nx + T / 2, ny + T / 2, T * 0.45, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Profession color indicator
        const prof = GATHERING_PROFESSIONS.find(g => g.id === node.professionId);
        ctx.fillStyle = (prof?.color || '#888') + '30';
        ctx.beginPath();
        ctx.arc(nx + T / 2, ny + T / 2, T * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.icon, nx + T / 2, ny + T / 2 + 6 + bob);

        // Tier indicator dot
        const tierColor = node.tier >= 3 ? '#8b5cf6' : node.tier >= 2 ? '#3b82f6' : '#9ca3af';
        ctx.fillStyle = tierColor;
        ctx.beginPath();
        ctx.arc(nx + T - 8, ny + 8, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Layer 5: Deployed heroes ───────────────────────────
      const deployments = islandState.deployments;
      deployments.forEach((dep, i) => {
        const hero = HEROES.find(h => h.id === dep.heroId);
        if (!hero) return;

        // Position hero near their profession's resource nodes
        const profNodes = map.resourceNodes.filter(n => n.professionId === dep.professionId);
        const targetNode = profNodes[i % profNodes.length] || map.resourceNodes[0];
        const hx = (targetNode ? targetNode.tileX + 1 : map.spawnTile.x) * T - cam.x;
        const hy = (targetNode ? targetNode.tileY : map.spawnTile.y) * T - cam.y;

        if (hx < -T || hx > W + T || hy < -T || hy > H + T) return;

        const raceColor = RACE_COLORS[hero.race] || '#888';
        const classColor = CLASS_COLORS[hero.heroClass] || '#888';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(hx + T / 2, hy + T - 4, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hero voxel sprite
        voxel.drawHeroVoxel(
          ctx, hx + T / 2, hy + T / 2,
          raceColor, classColor, hero.heroClass,
          Math.sin(t * 0.3 + i) * 0.15, 'idle', t + i, hero.race, hero.name,
        );

        // Harvesting swing animation
        const prof = GATHERING_PROFESSIONS.find(g => g.id === dep.professionId);
        if (prof) {
          const swing = Math.sin(t * 2.5 + i * 1.7) * 5;
          ctx.font = '14px serif';
          ctx.textAlign = 'center';
          ctx.fillText(prof.icon, hx + T / 2 + 18 + swing, hy + T / 2 - 18);
        }

        // Name tag
        ctx.fillStyle = '#f5e2c1';
        ctx.font = "bold 8px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(hero.name, hx + T / 2, hy + T + 10);
      });

      // ── Layer 6: Minimap ───────────────────────────────────
      const mmX = W - MINIMAP_SIZE - 8;
      const mmY = 8;
      const mmScale = MINIMAP_SIZE / (map.width * T);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(mmX - 2, mmY - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);

      for (let ty = 0; ty < map.height; ty++) {
        for (let tx = 0; tx < map.width; tx++) {
          const tile = map.tiles[ty][tx];
          ctx.fillStyle = TILE_COLORS[tile] || '#000';
          ctx.fillRect(
            mmX + tx * (MINIMAP_SIZE / map.width),
            mmY + ty * (MINIMAP_SIZE / map.height),
            Math.ceil(MINIMAP_SIZE / map.width),
            Math.ceil(MINIMAP_SIZE / map.height),
          );
        }
      }

      // Minimap resource dots
      for (const node of map.resourceNodes) {
        const prof = GATHERING_PROFESSIONS.find(g => g.id === node.professionId);
        ctx.fillStyle = prof?.color || '#fff';
        ctx.fillRect(
          mmX + node.tileX * (MINIMAP_SIZE / map.width) - 1,
          mmY + node.tileY * (MINIMAP_SIZE / map.height) - 1,
          3, 3,
        );
      }

      // Minimap camera viewport box
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        mmX + cam.x * mmScale,
        mmY + cam.y * mmScale,
        W * mmScale,
        H * mmScale,
      );

      // ── HUD overlay ────────────────────────────────────────
      // Tile info at cursor position
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(8, H - 24, 180, 20);
      ctx.fillStyle = '#aaa';
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = 'left';
      const hoverTX = Math.floor((cam.x + W / 2) / T);
      const hoverTY = Math.floor((cam.y + H / 2) / T);
      const hoverTile = map.tiles[hoverTY]?.[hoverTX];
      ctx.fillText(`${tileName(hoverTile ?? 0)} (${hoverTX},${hoverTY})`, 14, H - 10);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [assetsLoaded, islandState.deployments, selectedNode]);

  // ── Time formatter ───────────────────────────────────────────

  const formatTime = (ms: number) => {
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0f0a]/95 backdrop-blur border-b border-[#c5a059]/30 px-4 py-2">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black tracking-wider" style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}>
              \uD83C\uDFDD\uFE0F HOME ISLAND
            </h1>
            <span className="text-[10px] text-gray-500 border border-gray-700 rounded px-2 py-0.5">
              WASD / Drag to pan
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{islandState.deployments.length}/{islandState.maxDeployments} deployed</span>
            <Button variant="outline" size="sm" onClick={() => setLocation('/character')}>Character</Button>
            <Button variant="outline" size="sm" onClick={() => setLocation('/')}>Home</Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-3 flex gap-4">
        {/* Left: Island Canvas */}
        <div className="flex-1 min-w-0">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full rounded-lg border border-gray-800 cursor-grab active:cursor-grabbing"
            style={{ imageRendering: 'pixelated' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={onClick}
          />

          {/* Selected Node Info / Deploy Panel */}
          <div className="mt-3 rounded-lg border border-gray-800 bg-[#111318] p-4">
            {selectedNode ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{selectedNode.icon}</span>
                  <h3 className="text-sm font-bold text-[#c5a059]">{selectedNode.name}</h3>
                  <span className="text-[10px] text-gray-500 border border-gray-700 rounded px-1">
                    Tier {selectedNode.tier} \u00b7 {selectedNode.professionId}
                  </span>
                </div>
                {islandState.deployments.length >= islandState.maxDeployments ? (
                  <p className="text-xs text-gray-500">All slots full. Recall a hero first.</p>
                ) : (
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] text-gray-500 block mb-1">Deploy Hero</label>
                      <select
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300"
                        value={selectedHeroId ?? ''}
                        onChange={e => setSelectedHeroId(Number(e.target.value) || null)}
                      >
                        <option value="">Select hero...</option>
                        {availableHeroes.map(h => (
                          <option key={h.id} value={h.id}>{h.name} ({h.race} {h.heroClass})</option>
                        ))}
                      </select>
                    </div>
                    {selectedProfId && (
                      <div className="text-[10px] text-gray-500">
                        ~{getEstimatedYieldPerHour(profs.gathering[selectedProfId]?.level || 1, 1)} res/hr
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="bg-[#c5a059] text-black font-bold hover:bg-[#d4b068]"
                      onClick={handleDeploy}
                      disabled={!selectedHeroId || !selectedProfId}
                    >
                      Deploy to {selectedNode.name}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h3 className="text-xs uppercase tracking-widest text-[#c5a059] mb-2">Deploy Heroes</h3>
                <p className="text-xs text-gray-500">Click a resource node on the island to deploy a hero there.</p>
                {islandState.deployments.length < islandState.maxDeployments && (
                  <div className="flex gap-3 items-end flex-wrap mt-3">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] text-gray-500 block mb-1">Hero</label>
                      <select
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300"
                        value={selectedHeroId ?? ''}
                        onChange={e => setSelectedHeroId(Number(e.target.value) || null)}
                      >
                        <option value="">Select hero...</option>
                        {availableHeroes.map(h => (
                          <option key={h.id} value={h.id}>{h.name} ({h.race} {h.heroClass})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] text-gray-500 block mb-1">Profession</label>
                      <select
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300"
                        value={selectedProfId}
                        onChange={e => setSelectedProfId(e.target.value)}
                      >
                        <option value="">Select profession...</option>
                        {GATHERING_PROFESSIONS.map(p => (
                          <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[#c5a059] text-black font-bold hover:bg-[#d4b068]"
                      onClick={handleDeploy}
                      disabled={!selectedHeroId || !selectedProfId}
                    >
                      Deploy
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Deployments + Harvest Log */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* Island Legend */}
          <div className="rounded-lg border border-gray-800 bg-[#111318] p-3">
            <h3 className="text-[10px] uppercase tracking-widest text-[#c5a059] mb-2">Resource Zones</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {GATHERING_PROFESSIONS.map(p => {
                const count = mapRef.current.resourceNodes.filter(n => n.professionId === p.id).length;
                return (
                  <div key={p.id} className="flex items-center gap-1.5 text-[10px]">
                    <span>{p.icon}</span>
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span className="text-gray-600">\u00d7{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Deployments */}
          <div className="rounded-lg border border-gray-800 bg-[#111318] p-3">
            <h3 className="text-[10px] uppercase tracking-widest text-[#c5a059] mb-2">Active Deployments</h3>
            {islandState.deployments.length === 0 ? (
              <p className="text-[10px] text-gray-600">No heroes deployed yet.</p>
            ) : (
              <div className="space-y-2">
                {islandState.deployments.map(dep => {
                  const hero = HEROES.find(h => h.id === dep.heroId);
                  const prof = GATHERING_PROFESSIONS.find(g => g.id === dep.professionId);
                  if (!hero) return null;
                  return (
                    <div key={dep.heroId} className="rounded border border-gray-700 bg-gray-900/50 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: RACE_COLORS[hero.race] }}>{hero.name}</span>
                        <button
                          className="text-[9px] text-red-400 hover:text-red-300 border border-red-400/30 rounded px-1.5 py-0.5"
                          onClick={() => handleRecall(dep.heroId)}
                        >Recall</button>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {prof?.icon} {prof?.name} \u00b7 {dep.totalHarvested} gathered
                      </div>
                      <div className="text-[10px] text-gray-600">
                        Deployed {formatTime(dep.deployedAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Harvest Log */}
          <div className="rounded-lg border border-gray-800 bg-[#111318] p-3 flex-1 overflow-hidden">
            <h3 className="text-[10px] uppercase tracking-widest text-[#c5a059] mb-2">Harvest Log</h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {islandState.harvestLog.length === 0 ? (
                <p className="text-[10px] text-gray-600">No harvests yet.</p>
              ) : (
                islandState.harvestLog.map((entry, i) => (
                  <div key={i} className="text-[10px] text-gray-400">
                    <span className="text-gray-300">{entry.heroName}</span>
                    {' '}\u2192{' '}
                    <span className="text-[#c5a059]">{entry.quantity}x {entry.resourceName}</span>
                    <span className="text-gray-600 ml-1">{formatTime(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

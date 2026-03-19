import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { HEROES, RACE_COLORS, CLASS_COLORS } from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import { ISLAND_ZONES, ZoneDef } from '@/game/zones';
import { GATHERING_PROFESSIONS, loadProfessions, createResourceInventory } from '@/game/professions-system';
import {
  loadIslandState, tickIslandHarvest, deployHeroToIsland, recallHeroFromIsland,
  getZoneProfessions, getDeployedHeroIds, getAvailableHeroes, getDiscoveredZones,
  getEstimatedYieldPerHour, IslandHarvestState, HarvestLogEntry,
} from '@/game/island-harvest';

// ── Resource node icon positions (procedural per zone) ─────────
function getNodePositions(zone: ZoneDef, seed: number): { x: number; y: number; icon: string }[] {
  const icons = ['⛏️', '🪓', '🌿', '🎣', '🔪', '🧲'];
  const nodes: { x: number; y: number; icon: string }[] = [];
  let rng = seed;
  for (let i = 0; i < 12; i++) {
    rng = (rng * 16807 + 7) % 2147483647;
    const x = 40 + (rng % 320);
    rng = (rng * 16807 + 7) % 2147483647;
    const y = 40 + (rng % 240);
    nodes.push({ x, y, icon: icons[i % icons.length] });
  }
  return nodes;
}

export default function IslandPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);

  const [islandState, setIslandState] = useState<IslandHarvestState>(() => loadIslandState());
  const [profs] = useState(() => loadProfessions());
  const [inv] = useState(() => createResourceInventory());
  const [selectedZone, setSelectedZone] = useState<ZoneDef>(() => {
    const discovered = getDiscoveredZones();
    return discovered[0] || ISLAND_ZONES[0];
  });
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  const [, forceUpdate] = useState(0);

  const discoveredZones = getDiscoveredZones();
  const deployedIds = getDeployedHeroIds(islandState);
  const availableHeroes = getAvailableHeroes(deployedIds);
  const zoneProfessions = getZoneProfessions(selectedZone.id);

  // Tick on mount to calculate offline gains
  useEffect(() => {
    const result = tickIslandHarvest(islandState, profs, inv);
    if (result.totalResourcesGained > 0) {
      setIslandState({ ...islandState });
    }
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

  // ── Canvas rendering ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;

    let animId = 0;
    let t = 0;
    const nodes = getNodePositions(selectedZone, selectedZone.id * 1337);

    const animate = () => {
      t += 0.016;
      const w = canvas.width;
      const h = canvas.height;

      // Background — zone ambient color
      ctx.fillStyle = selectedZone.ambientColor;
      ctx.fillRect(0, 0, w, h);

      // Terrain texture overlay
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let gx = 0; gx < w; gx += 20) {
        for (let gy = 0; gy < h; gy += 20) {
          if ((gx + gy) % 40 === 0) ctx.fillRect(gx, gy, 20, 20);
        }
      }

      // Zone name
      ctx.fillStyle = '#f5e2c1';
      ctx.font = "bold 16px 'Oxanium', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(selectedZone.name, w / 2, 24);
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = '#9b7d52';
      ctx.fillText(`Lv${selectedZone.requiredLevel}+ · ${selectedZone.terrainType}`, w / 2, 38);

      // Resource nodes
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      for (const node of nodes) {
        const bobY = Math.sin(t * 1.5 + node.x * 0.1) * 2;
        ctx.fillText(node.icon, node.x, node.y + bobY);
      }

      // Draw deployed hero sprites on this island
      const zoneDeployments = islandState.deployments.filter(d => d.zoneId === selectedZone.id);
      zoneDeployments.forEach((dep, i) => {
        const hero = HEROES.find(h => h.id === dep.heroId);
        if (!hero) return;

        const hx = 80 + i * 100;
        const hy = h / 2 + 40;
        const raceColor = RACE_COLORS[hero.race] || '#888';
        const classColor = CLASS_COLORS[hero.heroClass] || '#888';

        // Subtle glow
        ctx.fillStyle = raceColor + '20';
        ctx.beginPath();
        ctx.arc(hx, hy, 24, 0, Math.PI * 2);
        ctx.fill();

        // Hero voxel sprite (mini)
        voxel.drawHeroVoxel(ctx, hx, hy, raceColor, classColor, hero.heroClass, Math.sin(t * 0.3 + i) * 0.2, 'idle', t + i, hero.race, hero.name);

        // Name tag
        ctx.fillStyle = '#f5e2c1';
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'center';
        ctx.fillText(hero.name, hx, hy + 36);

        // Harvesting animation — pickaxe swing indicator
        const prof = GATHERING_PROFESSIONS.find(g => g.id === dep.professionId);
        if (prof) {
          const swingPhase = Math.sin(t * 2 + i * 1.5);
          ctx.font = '12px serif';
          ctx.fillText(prof.icon, hx + 18 + swingPhase * 4, hy - 16);
        }
      });

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [selectedZone, islandState.deployments]);

  // ── Deploy handler ───────────────────────────────────────────
  const handleDeploy = useCallback(() => {
    if (!selectedHeroId || !selectedProfId) return;
    const ok = deployHeroToIsland(islandState, selectedHeroId, selectedZone.id, selectedProfId);
    if (ok) {
      setIslandState({ ...islandState });
      setSelectedHeroId(null);
      setSelectedProfId('');
    }
  }, [islandState, selectedHeroId, selectedZone, selectedProfId]);

  const handleRecall = useCallback((heroId: number) => {
    recallHeroFromIsland(islandState, heroId);
    setIslandState({ ...islandState });
  }, [islandState]);

  const formatTime = (ms: number) => {
    const mins = Math.floor((Date.now() - ms) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0f0a]/95 backdrop-blur border-b border-[#c5a059]/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black tracking-wider" style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}>
            ISLAND CAMP
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{islandState.deployments.length}/{islandState.maxDeployments} deployed</span>
            <Button variant="outline" size="sm" onClick={() => setLocation('/character')}>Character</Button>
            <Button variant="outline" size="sm" onClick={() => setLocation('/')}>Home</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 flex gap-4">
        {/* Left: Island Canvas + Zone Selector */}
        <div className="flex-1">
          {/* Zone selector */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {discoveredZones.map(z => (
              <button
                key={z.id}
                className={`px-3 py-1.5 text-xs rounded border transition-all ${selectedZone.id === z.id ? 'border-[#c5a059] text-[#c5a059] bg-[#c5a059]/10' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                onClick={() => setSelectedZone(z)}
              >
                {z.name}
              </button>
            ))}
          </div>

          {/* Island canvas */}
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            className="w-full rounded-lg border border-gray-800"
            style={{ maxWidth: 600, imageRendering: 'pixelated' }}
          />

          {/* Deploy Panel */}
          <div className="mt-4 rounded-lg border border-gray-800 bg-[#111318] p-4">
            <h3 className="text-xs uppercase tracking-widest text-[#c5a059] mb-3">Deploy Hero to {selectedZone.name}</h3>

            {islandState.deployments.length >= islandState.maxDeployments ? (
              <p className="text-xs text-gray-500">All deployment slots full. Recall a hero to deploy another.</p>
            ) : (
              <div className="flex gap-3 items-end flex-wrap">
                {/* Hero picker */}
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

                {/* Profession picker */}
                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] text-gray-500 block mb-1">Profession</label>
                  <select
                    className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300"
                    value={selectedProfId}
                    onChange={e => setSelectedProfId(e.target.value)}
                  >
                    <option value="">Select profession...</option>
                    {zoneProfessions.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Yield estimate */}
                {selectedProfId && (
                  <div className="text-[10px] text-gray-500">
                    ~{getEstimatedYieldPerHour(profs.gathering[selectedProfId]?.level || 1, selectedZone.requiredLevel)} res/hr
                  </div>
                )}

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
        </div>

        {/* Right: Active Deployments + Harvest Log */}
        <div className="w-80 shrink-0 flex flex-col gap-4">
          {/* Active Deployments */}
          <div className="rounded-lg border border-gray-800 bg-[#111318] p-4">
            <h3 className="text-xs uppercase tracking-widest text-[#c5a059] mb-3">Active Deployments</h3>
            {islandState.deployments.length === 0 ? (
              <p className="text-xs text-gray-600">No heroes deployed. Select an island and deploy a hero.</p>
            ) : (
              <div className="space-y-3">
                {islandState.deployments.map(dep => {
                  const hero = HEROES.find(h => h.id === dep.heroId);
                  const zone = ISLAND_ZONES.find(z => z.id === dep.zoneId);
                  const prof = GATHERING_PROFESSIONS.find(g => g.id === dep.professionId);
                  if (!hero || !zone) return null;
                  return (
                    <div key={dep.heroId} className="rounded border border-gray-700 bg-gray-900/50 p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: RACE_COLORS[hero.race] }}>{hero.name}</span>
                        <button
                          className="text-[9px] text-red-400 hover:text-red-300 border border-red-400/30 rounded px-2 py-0.5"
                          onClick={() => handleRecall(dep.heroId)}
                        >Recall</button>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {zone.name} · {prof?.icon} {prof?.name}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Deployed {formatTime(dep.deployedAt)} · {dep.totalHarvested} harvested
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Harvest Log */}
          <div className="rounded-lg border border-gray-800 bg-[#111318] p-4 flex-1 overflow-hidden">
            <h3 className="text-xs uppercase tracking-widest text-[#c5a059] mb-3">Harvest Log</h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {islandState.harvestLog.length === 0 ? (
                <p className="text-[10px] text-gray-600">No harvests yet. Deploy heroes to start gathering.</p>
              ) : (
                islandState.harvestLog.map((entry, i) => (
                  <div key={i} className="text-[10px] text-gray-400 flex justify-between">
                    <span>
                      <span className="text-gray-300">{entry.heroName}</span>
                      {' '}gathered{' '}
                      <span className="text-[#c5a059]">{entry.quantity}x {entry.resourceName}</span>
                      {' '}at {entry.zoneName}
                    </span>
                    <span className="text-gray-600 shrink-0 ml-2">{formatTime(entry.timestamp)}</span>
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

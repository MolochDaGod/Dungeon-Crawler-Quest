import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { HEROES, FACTION_COLORS } from '@/game/types';

interface AIHeroDebugData {
  heroId: number;
  name: string;
  faction: string;
  heroClass: string;
  race: string;
  x: number; y: number;
  hp: number; maxHp: number;
  mp: number; maxMp: number;
  level: number; xp: number; gold: number;
  state: string;
  activeMissionId: string | null;
  animState: string;
  currentZoneId: number;
  dead: boolean;
  decisionLog: string[];
  chatBubble: string | null;
  path: { x: number; y: number }[];
}

export default function AIDebugPage() {
  const [, setLocation] = useLocation();
  const [heroes, setHeroes] = useState<AIHeroDebugData[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [factionFilter, setFactionFilter] = useState('all');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Poll server for hero data
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/npc/heroes');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setHeroes(data.map((h: any) => ({
              heroId: h.heroId,
              name: HEROES[h.heroId]?.name ?? `Hero ${h.heroId}`,
              faction: HEROES[h.heroId]?.faction ?? 'Unknown',
              heroClass: HEROES[h.heroId]?.heroClass ?? '',
              race: HEROES[h.heroId]?.race ?? '',
              x: h.x, y: h.y,
              hp: h.hp, maxHp: HEROES[h.heroId]?.hp ?? 100,
              mp: h.mp, maxMp: HEROES[h.heroId]?.mp ?? 100,
              level: h.level, xp: h.xp, gold: h.gold,
              state: h.state,
              activeMissionId: h.activeMissionId,
              animState: 'idle',
              currentZoneId: -1,
              dead: h.hp <= 0,
              decisionLog: [],
              chatBubble: null,
              path: [],
            })));
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  // If no server data, show all heroes from static data
  const displayHeroes = heroes.length > 0 ? heroes : HEROES.map((h, i) => ({
    heroId: i, name: h.name, faction: h.faction,
    heroClass: h.heroClass, race: h.race,
    x: 4000 + (i % 6) * 200, y: 4000 + Math.floor(i / 6) * 200,
    hp: h.hp, maxHp: h.hp, mp: h.mp, maxMp: h.mp,
    level: 1, xp: 0, gold: 100,
    state: 'idle_town', activeMissionId: null,
    animState: 'idle', currentZoneId: 0, dead: false,
    decisionLog: [], chatBubble: null, path: [],
  }));

  const filtered = displayHeroes.filter(h => {
    if (factionFilter !== 'all' && h.faction !== factionFilter) return false;
    if (filter && !h.name.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const selected = selectedId !== null ? displayHeroes.find(h => h.heroId === selectedId) : null;

  // Mini-map render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const mapSize = 16000;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 10; i++) {
      const p = (i / 10) * W;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    }

    // Heroes
    for (const h of filtered) {
      const sx = (h.x / mapSize) * W;
      const sy = (h.y / mapSize) * H;
      const fc = (FACTION_COLORS as any)[h.faction] || '#888';
      const isSelected = h.heroId === selectedId;

      ctx.fillStyle = fc;
      ctx.globalAlpha = h.dead ? 0.3 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Path
        if (h.path.length > 0) {
          ctx.strokeStyle = fc;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          for (const wp of h.path) {
            ctx.lineTo((wp.x / mapSize) * W, (wp.y / mapSize) * H);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      ctx.globalAlpha = 1;
    }
  }, [filtered, selectedId]);

  const STATE_COLORS: Record<string, string> = {
    idle_town: '#22c55e', resting: '#60a5fa', take_mission: '#f59e0b',
    travel: '#06b6d4', combat: '#ef4444', harvest: '#a16207',
    camp_destroy: '#dc2626', explore: '#8b5cf6', return_home: '#3b82f6',
    social: '#ec4899', dead: '#6b7280',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setLocation('/')} className="text-gray-400 hover:text-white text-sm">← Home</button>
        <h1 className="text-xl font-bold text-amber-400">AI HERO DEBUG</h1>
        <span className="text-gray-500 text-sm">{displayHeroes.length} heroes active</span>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search hero..." className="bg-gray-800 text-white text-sm rounded px-3 py-1 w-48" />
        <select value={factionFilter} onChange={e => setFactionFilter(e.target.value)}
          className="bg-gray-800 text-white text-sm rounded px-2 py-1">
          <option value="all">All Factions</option>
          <option value="Crusade">Crusade</option>
          <option value="Fabled">Fabled</option>
          <option value="Legion">Legion</option>
          <option value="Pirates">Pirates</option>
        </select>
      </div>

      <div className="flex gap-4">
        {/* Mini-map */}
        <div className="flex-shrink-0">
          <canvas ref={canvasRef} width={300} height={300} className="rounded border border-gray-700" />
          <div className="flex gap-2 mt-2 text-[10px]">
            {['Crusade', 'Fabled', 'Legion', 'Pirates'].map(f => (
              <span key={f} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: (FACTION_COLORS as any)[f] }} />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Hero list */}
        <div className="flex-1 max-h-[70vh] overflow-y-auto space-y-1">
          {filtered.map(h => (
            <button key={h.heroId} onClick={() => setSelectedId(h.heroId)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left text-sm ${selectedId === h.heroId ? 'ring-2 ring-amber-500 bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'}`}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: (FACTION_COLORS as any)[h.faction] }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{h.name}</span>
                  <span className="text-gray-500 text-[10px]">Lv{h.level} {h.race} {h.heroClass}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span style={{ color: STATE_COLORS[h.state] || '#888' }}>{h.state}</span>
                  <span className="text-gray-600">HP:{h.hp}/{h.maxHp}</span>
                  <span className="text-gray-600">G:{h.gold}</span>
                  <span className="text-gray-600">({Math.round(h.x)},{Math.round(h.y)})</span>
                  {h.activeMissionId && <span className="text-yellow-500">📋 {h.activeMissionId}</span>}
                </div>
              </div>
              {h.dead && <span className="text-red-500 text-xs font-bold">DEAD</span>}
            </button>
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 bg-gray-900 rounded p-3 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="text-lg font-bold" style={{ color: (FACTION_COLORS as any)[selected.faction] }}>{selected.name}</div>
            <div className="text-sm text-gray-400">{selected.race} {selected.heroClass} — {selected.faction}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">State</div>
                <div className="font-bold" style={{ color: STATE_COLORS[selected.state] }}>{selected.state}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Level</div>
                <div className="font-bold text-amber-400">{selected.level}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">HP</div>
                <div className="font-bold text-red-400">{selected.hp}/{selected.maxHp}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Gold</div>
                <div className="font-bold text-yellow-400">{selected.gold}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Position</div>
                <div className="font-bold text-white">{Math.round(selected.x)}, {Math.round(selected.y)}</div>
              </div>
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-500">Mission</div>
                <div className="font-bold text-blue-400">{selected.activeMissionId || 'None'}</div>
              </div>
            </div>

            {selected.chatBubble && (
              <div className="bg-gray-800 rounded p-2 text-sm">
                <div className="text-gray-500 text-[10px]">CHAT BUBBLE</div>
                <div className="text-white">{selected.chatBubble}</div>
              </div>
            )}

            <div className="border-t border-gray-700 pt-2">
              <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Decision Log</div>
              <div className="space-y-0.5 text-[10px] text-gray-400 max-h-40 overflow-y-auto">
                {selected.decisionLog.length === 0 && <div className="text-gray-600">(No decisions yet — waiting for server data)</div>}
                {selected.decisionLog.slice(-15).map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

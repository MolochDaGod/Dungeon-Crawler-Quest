import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ISLAND_ZONES, ZoneDef, MonsterSpawnDef } from '@/game/zones';
import { WeatherType, WEATHER_INFO } from '@/game/world-state';

/* ─── localStorage keys for admin overrides ─── */
const ZONE_OVERRIDE_KEY = 'grudge_zone_overrides';
const WORLD_OVERRIDE_KEY = 'grudge_world_overrides';

type Tab = 'zones' | 'spawners' | 'world' | 'items';

interface WorldOverrides {
  dayDurationMinutes: number;
  sunriseHour: number;
  sunsetHour: number;
  weatherChangeInterval: number;
  worldBossSpawnInterval: number;
  defaultWeather: WeatherType;
}

interface ItemDropDef {
  name: string;
  weight: number;
  minLevel: number;
}

const DEFAULT_WORLD: WorldOverrides = {
  dayDurationMinutes: 20,
  sunriseHour: 6,
  sunsetHour: 18,
  weatherChangeInterval: 300,
  worldBossSpawnInterval: 600,
  defaultWeather: WeatherType.Clear,
};

const ENEMY_TYPES = ['Slime', 'Skeleton', 'Orc Grunt', 'Dark Mage', 'Spider', 'Golem', 'Dragon', 'Lich'];
const TERRAIN_TYPES = ['grass', 'jungle', 'water', 'stone', 'dirt'];

function loadZoneOverrides(): ZoneDef[] {
  try {
    const raw = localStorage.getItem(ZONE_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return JSON.parse(JSON.stringify(ISLAND_ZONES));
}

function loadWorldOverrides(): WorldOverrides {
  try {
    const raw = localStorage.getItem(WORLD_OVERRIDE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...DEFAULT_WORLD };
}

/* ─── Reusable styled components ─── */

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(to bottom, rgba(15,10,5,0.97), rgba(10,5,0,0.92))',
  border: '1px solid #c5a059',
  borderRadius: 6,
  padding: 12,
};

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #333',
  borderRadius: 4,
  color: '#ddd',
  padding: '4px 8px',
  fontSize: 12,
  width: '100%',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const btnStyle = (active?: boolean): React.CSSProperties => ({
  background: active ? 'rgba(197,160,89,0.25)' : 'rgba(30,30,40,0.8)',
  border: `1px solid ${active ? '#c5a059' : '#444'}`,
  borderRadius: 4,
  color: active ? '#c5a059' : '#888',
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s',
});

const dangerBtnStyle: React.CSSProperties = {
  ...btnStyle(false),
  border: '1px solid #ef4444',
  color: '#ef4444',
};

const labelStyle: React.CSSProperties = { color: '#888', fontSize: 10, marginBottom: 2, display: 'block' };

function NumberField({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number;
}) {
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        style={inputStyle}
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <label style={labelStyle}>{label}</label>
      <input type="text" style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 100 }}>
      <label style={labelStyle}>{label}</label>
      <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CheckboxField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#aaa' }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} style={{ accentColor: '#c5a059' }} />
      {label}
    </label>
  );
}

/* ─── Main Page ─── */

export default function WorldAdminPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('zones');
  const [zones, setZones] = useState<ZoneDef[]>(loadZoneOverrides);
  const [worldCfg, setWorldCfg] = useState<WorldOverrides>(loadWorldOverrides);
  const [selectedZoneId, setSelectedZoneId] = useState(0);
  const [status, setStatus] = useState('');
  const [itemDrops, setItemDrops] = useState<ItemDropDef[]>(() => {
    try { const r = localStorage.getItem('grudge_item_drops'); return r ? JSON.parse(r) : []; } catch { return []; }
  });

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const saveAll = useCallback(() => {
    localStorage.setItem(ZONE_OVERRIDE_KEY, JSON.stringify(zones));
    localStorage.setItem(WORLD_OVERRIDE_KEY, JSON.stringify(worldCfg));
    localStorage.setItem('grudge_item_drops', JSON.stringify(itemDrops));
    flash('✓ All settings saved');
  }, [zones, worldCfg, itemDrops]);

  const resetAll = useCallback(() => {
    setZones(JSON.parse(JSON.stringify(ISLAND_ZONES)));
    setWorldCfg({ ...DEFAULT_WORLD });
    setItemDrops([]);
    localStorage.removeItem(ZONE_OVERRIDE_KEY);
    localStorage.removeItem(WORLD_OVERRIDE_KEY);
    localStorage.removeItem('grudge_item_drops');
    flash('✓ Reset to defaults');
  }, []);

  const updateZone = useCallback((id: number, partial: Partial<ZoneDef>) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...partial } : z));
  }, []);

  const updateZoneBounds = useCallback((id: number, key: 'x' | 'y' | 'w' | 'h', val: number) => {
    setZones(prev => prev.map(z => z.id === id ? { ...z, bounds: { ...z.bounds, [key]: val } } : z));
  }, []);

  const updateSpawn = useCallback((zoneId: number, spawnIdx: number, partial: Partial<MonsterSpawnDef>) => {
    setZones(prev => prev.map(z => {
      if (z.id !== zoneId) return z;
      const spawns = z.monsterSpawns.map((s, i) => i === spawnIdx ? { ...s, ...partial } : s);
      return { ...z, monsterSpawns: spawns };
    }));
  }, []);

  const addSpawn = useCallback((zoneId: number) => {
    setZones(prev => prev.map(z => {
      if (z.id !== zoneId) return z;
      const cx = z.bounds.x + z.bounds.w / 2;
      const cy = z.bounds.y + z.bounds.h / 2;
      return { ...z, monsterSpawns: [...z.monsterSpawns, { x: cx, y: cy, type: 'Slime', level: z.requiredLevel, respawnTime: 30, count: 2 }] };
    }));
  }, []);

  const removeSpawn = useCallback((zoneId: number, spawnIdx: number) => {
    setZones(prev => prev.map(z => {
      if (z.id !== zoneId) return z;
      return { ...z, monsterSpawns: z.monsterSpawns.filter((_, i) => i !== spawnIdx) };
    }));
  }, []);

  const selectedZone = zones.find(z => z.id === selectedZoneId) || zones[0];

  const exportJSON = () => {
    const data = { zones, world: worldCfg, itemDrops };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'world-config.json'; a.click();
    URL.revokeObjectURL(url);
    flash('✓ Exported JSON');
  };

  const importJSON = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.zones) setZones(data.zones);
          if (data.world) setWorldCfg(data.world);
          if (data.itemDrops) setItemDrops(data.itemDrops);
          flash('✓ Imported config');
        } catch { flash('✗ Invalid JSON'); }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-[#080808] flex flex-col" style={{ fontFamily: "'Oxanium', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#c5a059]/30"
        style={{ background: 'linear-gradient(to right, rgba(15,10,5,0.98), rgba(10,5,0,0.95))' }}
      >
        <div className="flex items-center gap-4">
          <button style={btnStyle()} onClick={() => setLocation('/')}>← Home</button>
          <h1 className="text-lg font-black text-[#c5a059]">WORLD ADMIN</h1>
          <div className="flex gap-1">
            {(['zones', 'spawners', 'world', 'items'] as Tab[]).map(t => (
              <button key={t} style={btnStyle(tab === t)} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs text-green-400">{status}</span>}
          <button style={btnStyle(true)} onClick={saveAll}>💾 Save</button>
          <button style={btnStyle()} onClick={exportJSON}>📤 Export</button>
          <button style={btnStyle()} onClick={importJSON}>📥 Import</button>
          <button style={dangerBtnStyle} onClick={resetAll}>⟲ Reset</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Zone selector sidebar (shown for zones and spawners tabs) */}
        {(tab === 'zones' || tab === 'spawners') && (
          <div className="w-52 border-r border-gray-800 overflow-y-auto p-2 flex flex-col gap-1"
            style={{ background: 'rgba(10,10,20,0.9)' }}
          >
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1 px-1">Zones</div>
            {zones.map(z => (
              <button
                key={z.id}
                style={{
                  ...btnStyle(z.id === selectedZoneId),
                  textAlign: 'left',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => setSelectedZoneId(z.id)}
              >
                <span>{z.name}</span>
                <span className="text-[9px]" style={{ color: z.isPvP ? '#ef4444' : z.isSafeZone ? '#22c55e' : '#666' }}>
                  {z.isPvP ? 'PVP' : z.isSafeZone ? 'SAFE' : `L${z.requiredLevel}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-4" style={{ background: 'rgba(5,5,10,0.95)' }}>
          {/* ─── ZONES TAB ─── */}
          {tab === 'zones' && selectedZone && (
            <div className="flex flex-col gap-4 max-w-3xl">
              <div style={panelStyle}>
                <h2 className="text-sm font-bold text-[#c5a059] mb-3">Zone Properties: {selectedZone.name}</h2>
                <div className="flex flex-wrap gap-3 mb-3">
                  <TextField label="Name" value={selectedZone.name} onChange={v => updateZone(selectedZone.id, { name: v })} />
                  <SelectField label="Terrain" value={selectedZone.terrainType} options={TERRAIN_TYPES}
                    onChange={v => updateZone(selectedZone.id, { terrainType: v })} />
                  <NumberField label="Required Level" value={selectedZone.requiredLevel} min={1} max={30}
                    onChange={v => updateZone(selectedZone.id, { requiredLevel: v })} />
                </div>
                <div className="flex flex-wrap gap-3 mb-3">
                  <CheckboxField label="PvP Zone" value={selectedZone.isPvP}
                    onChange={v => updateZone(selectedZone.id, { isPvP: v })} />
                  <CheckboxField label="Safe Zone" value={selectedZone.isSafeZone}
                    onChange={v => updateZone(selectedZone.id, { isSafeZone: v })} />
                </div>
                <div className="flex flex-wrap gap-3 mb-3">
                  <TextField label="Ambient Color" value={selectedZone.ambientColor}
                    onChange={v => updateZone(selectedZone.id, { ambientColor: v })} />
                  <TextField label="Description" value={selectedZone.description}
                    onChange={v => updateZone(selectedZone.id, { description: v })} />
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="text-xs font-bold text-[#c5a059] mb-2">Bounds</h3>
                <div className="flex flex-wrap gap-3">
                  <NumberField label="X" value={selectedZone.bounds.x} onChange={v => updateZoneBounds(selectedZone.id, 'x', v)} />
                  <NumberField label="Y" value={selectedZone.bounds.y} onChange={v => updateZoneBounds(selectedZone.id, 'y', v)} />
                  <NumberField label="Width" value={selectedZone.bounds.w} min={100}
                    onChange={v => updateZoneBounds(selectedZone.id, 'w', v)} />
                  <NumberField label="Height" value={selectedZone.bounds.h} min={100}
                    onChange={v => updateZoneBounds(selectedZone.id, 'h', v)} />
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="text-xs font-bold text-[#c5a059] mb-2">Connected Zones</h3>
                <div className="flex flex-wrap gap-2">
                  {zones.map(z => (
                    <label key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#aaa', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedZone.connectedZoneIds.includes(z.id)}
                        style={{ accentColor: '#c5a059' }}
                        disabled={z.id === selectedZone.id}
                        onChange={e => {
                          const conn = e.target.checked
                            ? [...selectedZone.connectedZoneIds, z.id]
                            : selectedZone.connectedZoneIds.filter(id => id !== z.id);
                          updateZone(selectedZone.id, { connectedZoneIds: conn });
                        }}
                      />
                      {z.name}
                    </label>
                  ))}
                </div>
              </div>

              <div style={panelStyle}>
                <h3 className="text-xs font-bold text-[#c5a059] mb-2">Player Spawns ({selectedZone.playerSpawns.length})</h3>
                {selectedZone.playerSpawns.map((sp, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 w-4">{i + 1}</span>
                    <input type="number" style={{ ...inputStyle, width: 80 }} value={sp.x}
                      onChange={e => {
                        const spawns = [...selectedZone.playerSpawns];
                        spawns[i] = { ...spawns[i], x: parseFloat(e.target.value) || 0 };
                        updateZone(selectedZone.id, { playerSpawns: spawns });
                      }}
                    />
                    <input type="number" style={{ ...inputStyle, width: 80 }} value={sp.y}
                      onChange={e => {
                        const spawns = [...selectedZone.playerSpawns];
                        spawns[i] = { ...spawns[i], y: parseFloat(e.target.value) || 0 };
                        updateZone(selectedZone.id, { playerSpawns: spawns });
                      }}
                    />
                    <button style={dangerBtnStyle} onClick={() => {
                      const spawns = selectedZone.playerSpawns.filter((_, j) => j !== i);
                      updateZone(selectedZone.id, { playerSpawns: spawns });
                    }}>✕</button>
                  </div>
                ))}
                <button style={btnStyle()} onClick={() => {
                  const cx = selectedZone.bounds.x + selectedZone.bounds.w / 2;
                  const cy = selectedZone.bounds.y + selectedZone.bounds.h / 2;
                  updateZone(selectedZone.id, { playerSpawns: [...selectedZone.playerSpawns, { x: cx, y: cy }] });
                }}>+ Add Spawn Point</button>
              </div>
            </div>
          )}

          {/* ─── SPAWNERS TAB ─── */}
          {tab === 'spawners' && selectedZone && (
            <div className="flex flex-col gap-3 max-w-4xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#c5a059]">
                  Spawners: {selectedZone.name} ({selectedZone.monsterSpawns.length} groups)
                </h2>
                <button style={btnStyle(true)} onClick={() => addSpawn(selectedZone.id)}>+ Add Spawner</button>
              </div>
              {selectedZone.monsterSpawns.length === 0 && (
                <div className="text-gray-600 text-sm text-center py-8">No spawners in this zone</div>
              )}
              {selectedZone.monsterSpawns.map((sp, i) => (
                <div key={i} style={panelStyle}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#c5a059]">Spawner #{i + 1}</span>
                    <button style={dangerBtnStyle} onClick={() => removeSpawn(selectedZone.id, i)}>Remove</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <SelectField label="Enemy Type" value={sp.type} options={ENEMY_TYPES}
                      onChange={v => updateSpawn(selectedZone.id, i, { type: v })} />
                    <NumberField label="Level" value={sp.level} min={1} max={30}
                      onChange={v => updateSpawn(selectedZone.id, i, { level: v })} />
                    <NumberField label="Count" value={sp.count} min={1} max={20}
                      onChange={v => updateSpawn(selectedZone.id, i, { count: v })} />
                    <NumberField label="Respawn (s)" value={sp.respawnTime} min={5} max={600}
                      onChange={v => updateSpawn(selectedZone.id, i, { respawnTime: v })} />
                    <NumberField label="X" value={sp.x}
                      onChange={v => updateSpawn(selectedZone.id, i, { x: v })} />
                    <NumberField label="Y" value={sp.y}
                      onChange={v => updateSpawn(selectedZone.id, i, { y: v })} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── WORLD TAB ─── */}
          {tab === 'world' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div style={panelStyle}>
                <h2 className="text-sm font-bold text-[#c5a059] mb-3">Day/Night Cycle</h2>
                <div className="flex flex-wrap gap-3">
                  <NumberField label="Day Duration (minutes)" value={worldCfg.dayDurationMinutes} min={1} max={120} step={1}
                    onChange={v => setWorldCfg(prev => ({ ...prev, dayDurationMinutes: v }))} />
                  <NumberField label="Sunrise Hour" value={worldCfg.sunriseHour} min={0} max={23}
                    onChange={v => setWorldCfg(prev => ({ ...prev, sunriseHour: v }))} />
                  <NumberField label="Sunset Hour" value={worldCfg.sunsetHour} min={0} max={23}
                    onChange={v => setWorldCfg(prev => ({ ...prev, sunsetHour: v }))} />
                </div>
              </div>

              <div style={panelStyle}>
                <h2 className="text-sm font-bold text-[#c5a059] mb-3">Weather</h2>
                <div className="flex flex-wrap gap-3 mb-3">
                  <NumberField label="Change Interval (s)" value={worldCfg.weatherChangeInterval} min={10} max={3600}
                    onChange={v => setWorldCfg(prev => ({ ...prev, weatherChangeInterval: v }))} />
                  <SelectField label="Default Weather" value={worldCfg.defaultWeather}
                    options={Object.values(WeatherType)}
                    onChange={v => setWorldCfg(prev => ({ ...prev, defaultWeather: v as WeatherType }))} />
                </div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(WEATHER_INFO).map(([key, info]) => (
                    <div key={key} className="flex items-center gap-2 text-xs" style={{ color: '#aaa', minWidth: 130 }}>
                      <span>{info.icon}</span>
                      <span>{info.label}</span>
                      <span className="text-gray-600">spd×{info.speedMod} amb×{info.ambientMod}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={panelStyle}>
                <h2 className="text-sm font-bold text-[#c5a059] mb-3">World Boss</h2>
                <div className="flex flex-wrap gap-3">
                  <NumberField label="Spawn Interval (s)" value={worldCfg.worldBossSpawnInterval} min={60} max={7200}
                    onChange={v => setWorldCfg(prev => ({ ...prev, worldBossSpawnInterval: v }))} />
                </div>
              </div>

              <div style={panelStyle}>
                <h2 className="text-sm font-bold text-[#c5a059] mb-3">Enemy Templates (read-only reference)</h2>
                <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-400">
                  <span className="font-bold text-gray-300">Type</span>
                  <span className="font-bold text-gray-300">HP / ATK / DEF</span>
                  <span className="font-bold text-gray-300">Speed / Range</span>
                  <span className="font-bold text-gray-300">XP / Gold</span>
                  {ENEMY_TYPES.map(et => (
                    <EnemyRow key={et} type={et} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── ITEMS TAB ─── */}
          {tab === 'items' && (
            <div className="flex flex-col gap-3 max-w-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#c5a059]">Item Drop Table ({itemDrops.length} entries)</h2>
                <button style={btnStyle(true)} onClick={() => setItemDrops(prev => [...prev, { name: 'New Item', weight: 10, minLevel: 1 }])}>
                  + Add Drop
                </button>
              </div>
              {itemDrops.length === 0 && (
                <div className="text-gray-600 text-sm text-center py-8">No custom item drops configured — default loot tables apply</div>
              )}
              {itemDrops.map((drop, i) => (
                <div key={i} style={panelStyle}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#c5a059]">Drop #{i + 1}</span>
                    <button style={dangerBtnStyle} onClick={() => setItemDrops(prev => prev.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <TextField label="Item Name" value={drop.name}
                      onChange={v => setItemDrops(prev => prev.map((d, j) => j === i ? { ...d, name: v } : d))} />
                    <NumberField label="Weight" value={drop.weight} min={1} max={1000}
                      onChange={v => setItemDrops(prev => prev.map((d, j) => j === i ? { ...d, weight: v } : d))} />
                    <NumberField label="Min Level" value={drop.minLevel} min={1} max={30}
                      onChange={v => setItemDrops(prev => prev.map((d, j) => j === i ? { ...d, minLevel: v } : d))} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Small helper components ─── */

function EnemyRow({ type }: { type: string }) {
  const templates: Record<string, { hp: number; atk: number; def: number; spd: number; rng: number; xp: number; gold: number }> = {
    Slime:       { hp: 80,  atk: 8,  def: 2,  spd: 40,  rng: 50,  xp: 15,  gold: 8   },
    Skeleton:    { hp: 100, atk: 12, def: 5,  spd: 55,  rng: 60,  xp: 25,  gold: 12  },
    'Orc Grunt': { hp: 150, atk: 18, def: 8,  spd: 50,  rng: 60,  xp: 35,  gold: 18  },
    'Dark Mage': { hp: 90,  atk: 22, def: 4,  spd: 45,  rng: 200, xp: 40,  gold: 22  },
    Spider:      { hp: 70,  atk: 14, def: 3,  spd: 70,  rng: 50,  xp: 20,  gold: 10  },
    Golem:       { hp: 300, atk: 25, def: 20, spd: 30,  rng: 60,  xp: 60,  gold: 35  },
    Dragon:      { hp: 800, atk: 40, def: 18, spd: 45,  rng: 150, xp: 200, gold: 150 },
    Lich:        { hp: 600, atk: 35, def: 12, spd: 40,  rng: 250, xp: 180, gold: 120 },
  };
  const t = templates[type];
  if (!t) return null;
  return (
    <>
      <span style={{ color: '#ccc' }}>{type}</span>
      <span>{t.hp} / {t.atk} / {t.def}</span>
      <span>{t.spd} / {t.rng}</span>
      <span>{t.xp} / {t.gold}</span>
    </>
  );
}

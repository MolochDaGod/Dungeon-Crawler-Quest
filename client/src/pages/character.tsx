import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  HEROES, HeroData, RACE_COLORS, CLASS_COLORS,
  RARITY_COLORS, STAT_COLORS, CLASS_ABILITIES
} from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import {
  EQUIP_SLOTS, EquipSlot, EquipmentInstance,
  loadEquipment, computeEquipmentStats, computeSetBonuses,
} from '@/game/equipment';

const LEFT_SLOTS: EquipSlot[] = ['helm', 'shoulder', 'chest', 'hands', 'feet'];
const RIGHT_SLOTS: EquipSlot[] = ['mainhand', 'offhand', 'ring', 'necklace', 'cape'];

const SLOT_META = Object.fromEntries(EQUIP_SLOTS.map(s => [s.id, s])) as Record<EquipSlot, { label: string; icon: string }>;

const TIER_COLORS: Record<number, string> = {
  1: '#9ca3af', 2: '#22c55e', 3: '#3b82f6', 4: '#a855f7',
  5: '#f59e0b', 6: '#ef4444', 7: '#f97316', 8: '#ffd700',
};

export default function CharacterPage() {
  const [, setLocation] = useLocation();

  const heroId = localStorage.getItem('grudge_hero_id');
  const hero = useMemo(() => HEROES.find(h => String(h.id) === heroId) ?? null, [heroId]);
  const equipment = useMemo(() => loadEquipment(), []);
  const stats = useMemo(() => computeEquipmentStats(equipment), [equipment]);
  const setBonuses = useMemo(() => computeSetBonuses(equipment), [equipment]);

  const [selectedSlot, setSelectedSlot] = useState<EquipSlot | null>(null);

  // Animated hero preview
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);

  useEffect(() => {
    if (!hero || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;

    let animId = 0;
    let t = 0;
    const animate = () => {
      t += 0.016;
      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle glow behind hero
      const raceColor = RACE_COLORS[hero.race] || '#888';
      const classColor = CLASS_COLORS[hero.heroClass] || '#888';
      ctx.fillStyle = raceColor + '0a';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, Math.PI * 2);
      ctx.fill();

      voxel.drawHeroVoxel(
        ctx,
        canvas.width / 2,
        canvas.height / 2 + 20,
        raceColor, classColor,
        hero.heroClass,
        Math.sin(t * 0.4) * 0.2, // slow idle rotation
        'idle', t,
        hero.race,
        hero.name
      );

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [hero]);

  if (!hero) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] text-white flex items-center justify-center flex-col gap-4">
        <p className="text-gray-400">No hero selected.</p>
        <Button variant="outline" onClick={() => setLocation('/character-select')}>Select Hero</Button>
      </div>
    );
  }

  const rarityColor = RARITY_COLORS[hero.rarity] || '#888';
  const raceColor = RACE_COLORS[hero.race] || '#888';
  const classColor = CLASS_COLORS[hero.heroClass] || '#888';
  const selectedItem = selectedSlot ? equipment.slots[selectedSlot] : null;

  const renderSlot = (slotId: EquipSlot) => {
    const meta = SLOT_META[slotId];
    const item = equipment.slots[slotId];
    const isSelected = selectedSlot === slotId;
    const tierColor = item ? (TIER_COLORS[item.tier] || '#9ca3af') : '#333';

    return (
      <button
        key={slotId}
        onClick={() => setSelectedSlot(isSelected ? null : slotId)}
        className="relative w-full flex items-center gap-2 px-3 py-2 rounded border transition-all"
        style={{
          borderColor: isSelected ? '#c5a059' : item ? tierColor + '55' : '#333',
          backgroundColor: isSelected ? '#c5a05912' : item ? tierColor + '08' : '#111318',
        }}
      >
        <span className="text-xl w-8 text-center shrink-0">{meta.icon}</span>
        <div className="flex-1 text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: '#666' }}>{meta.label}</div>
          {item ? (
            <div className="text-xs font-semibold truncate" style={{ color: tierColor }}>{item.name}</div>
          ) : (
            <div className="text-xs text-gray-600 italic">Empty</div>
          )}
        </div>
        {item && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: tierColor + '20', color: tierColor }}>
            T{item.tier}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0f0a]/95 backdrop-blur border-b border-[#c5a059]/30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1
              className="text-xl font-black tracking-wider"
              style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}
            >
              CHARACTER
            </h1>
            <span className="text-sm font-bold" style={{ color: rarityColor }}>{hero.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded border border-gray-700" style={{ color: raceColor }}>{hero.race}</span>
            <span className="text-xs px-1.5 py-0.5 rounded border border-gray-700" style={{ color: classColor }}>{hero.heroClass}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation('/character-select')}>Switch Hero</Button>
            <Button variant="outline" size="sm" onClick={() => setLocation('/')}>Back</Button>
          </div>
        </div>
      </div>

      {/* Main Layout: Left Slots | Hero Portrait | Right Slots */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-4 items-start justify-center">
          {/* Left Slots */}
          <div className="w-52 flex flex-col gap-2 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 px-1">Armor</div>
            {LEFT_SLOTS.map(renderSlot)}
          </div>

          {/* Center: Hero Portrait + Stats */}
          <div className="flex flex-col items-center gap-3 flex-1 max-w-xs">
            <div
              className="rounded-lg border overflow-hidden relative"
              style={{ borderColor: rarityColor + '44', backgroundColor: '#0a0f0a' }}
            >
              <canvas
                ref={canvasRef}
                width={200}
                height={240}
                className="block"
              />
              {/* Name plate */}
              <div
                className="absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-bold tracking-wider"
                style={{
                  background: 'linear-gradient(transparent, #0a0f0aee)',
                  color: rarityColor,
                }}
              >
                {hero.title}
              </div>
            </div>

            {/* Gear Stats Summary */}
            <div className="w-full rounded border border-gray-800 bg-[#111318] px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Gear Stats</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {([
                  ['HP', stats.hp, STAT_COLORS?.hp || '#ef4444'],
                  ['MP', stats.mp, STAT_COLORS?.mp || '#3b82f6'],
                  ['ATK', stats.atk, STAT_COLORS?.atk || '#f59e0b'],
                  ['DEF', stats.def, STAT_COLORS?.def || '#22c55e'],
                  ['SPD', stats.spd, STAT_COLORS?.spd || '#8b5cf6'],
                  ['CRIT', stats.crit, STAT_COLORS?.crit || '#ec4899'],
                  ['BLOCK', stats.block, STAT_COLORS?.block || '#06b6d4'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
                    <span className="text-xs text-gray-300">+{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Set Bonuses */}
            {setBonuses.length > 0 && (
              <div className="w-full rounded border border-[#c5a059]/20 bg-[#c5a05908] px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-[#c5a059] mb-1">Set Bonuses</div>
                {setBonuses.map(sb => (
                  <div key={sb.setName} className="text-xs text-gray-300">
                    <span className="text-[#c5a059] font-semibold">{sb.setName}</span>
                    <span className="text-gray-500"> ({sb.pieces}pc)</span>
                    {sb.bonuses.map(b => (
                      <span key={b.label} className="ml-2 text-gray-400">
                        {b.label}: {b.hp ? `+${b.hp}HP ` : ''}{b.atk ? `+${b.atk}ATK ` : ''}{b.def ? `+${b.def}DEF ` : ''}{b.special || ''}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Slots */}
          <div className="w-52 flex flex-col gap-2 shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 px-1">Weapons & Accessories</div>
            {RIGHT_SLOTS.map(renderSlot)}
          </div>
        </div>

        {/* Selected Item Detail Panel */}
        {selectedItem && (
          <div className="max-w-md mx-auto mt-6 rounded-lg border border-gray-700 bg-[#111318] px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold" style={{ color: TIER_COLORS[selectedItem.tier] || '#ccc' }}>
                {selectedItem.name}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: (TIER_COLORS[selectedItem.tier] || '#666') + '20', color: TIER_COLORS[selectedItem.tier] || '#ccc' }}
              >
                Tier {selectedItem.tier} · {selectedItem.material}
              </span>
            </div>
            {selectedItem.setName && (
              <div className="text-[10px] text-[#c5a059] mb-2">Set: {selectedItem.setName}</div>
            )}
            <div className="grid grid-cols-4 gap-2 text-xs">
              {([
                ['HP', selectedItem.hp], ['MP', selectedItem.mp],
                ['ATK', selectedItem.atk], ['DEF', selectedItem.def],
                ['SPD', selectedItem.spd], ['CRIT', selectedItem.crit],
                ['BLOCK', selectedItem.block],
              ] as [string, number][]).filter(([, v]) => v > 0).map(([label, val]) => (
                <div key={label} className="bg-gray-800/50 rounded px-2 py-1 text-center">
                  <div className="text-[9px] text-gray-500">{label}</div>
                  <div className="text-gray-200 font-semibold">+{val}</div>
                </div>
              ))}
            </div>
            {(selectedItem.passive || selectedItem.effect || selectedItem.proc) && (
              <div className="mt-2 text-[10px] text-gray-400 space-y-0.5">
                {selectedItem.passive && <div>Passive: <span className="text-gray-200">{selectedItem.passive}</span></div>}
                {selectedItem.effect && <div>Effect: <span className="text-gray-200">{selectedItem.effect}</span></div>}
                {selectedItem.proc && <div>Proc: <span className="text-[#c5a059]">{selectedItem.proc}</span></div>}
              </div>
            )}
          </div>
        )}

        {/* Class Abilities Preview */}
        {CLASS_ABILITIES[hero.heroClass] && (
          <div className="max-w-2xl mx-auto mt-6">
            <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Class Abilities</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CLASS_ABILITIES[hero.heroClass].map((ability, i) => (
                <div key={i} className="rounded border border-gray-800 bg-[#111318] px-3 py-2">
                  <div className="text-xs font-bold" style={{ color: classColor }}>{ability.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{ability.desc}</div>
                  <div className="text-[9px] text-gray-600 mt-1">Key: {ability.key} · CD: {ability.cooldown}s</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

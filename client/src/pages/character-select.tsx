import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  HEROES, HeroData, RACE_COLORS, CLASS_COLORS, FACTION_COLORS,
  RARITY_COLORS, STAT_COLORS, CLASS_ABILITIES
} from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';

const RACES = ['All', 'Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'];
const CLASSES = ['All', 'Warrior', 'Worg', 'Mage', 'Ranger'];

export default function CharacterSelect() {
  const [, setLocation] = useLocation();
  const [selectedHero, setSelectedHero] = useState<HeroData | null>(null);
  const [raceFilter, setRaceFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const previewRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);

  const filteredHeroes = HEROES.filter(h => {
    if (raceFilter !== 'All' && h.race !== raceFilter) return false;
    if (classFilter !== 'All' && h.heroClass !== classFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!selectedHero || !previewRef.current) return;
    const canvas = previewRef.current;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;

    let animId = 0;
    let t = 0;
    const animate = () => {
      t += 0.016;
      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255,215,0,0.03)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
      ctx.fill();

      const raceColor = RACE_COLORS[selectedHero.race] || '#888';
      const classColor = CLASS_COLORS[selectedHero.heroClass] || '#888';

      voxel.drawHeroVoxel(
        ctx,
        canvas.width / 2,
        canvas.height / 2 + 10,
        raceColor, classColor,
        selectedHero.heroClass,
        Math.sin(t * 0.5) * 0.3,
        'idle', t,
        selectedHero.race
      );

      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [selectedHero]);

  const startGame = () => {
    if (!selectedHero) return;
    localStorage.setItem('grudge_hero_id', String(selectedHero.id));
    localStorage.setItem('grudge_team', '0');
    const mode = localStorage.getItem('grudge_mode') || 'moba';
    setLocation(mode === 'dungeon' ? '/dungeon' : '/game');
  };

  const statBar = (label: string, value: number, max: number, color: string) => (
    <div className="flex items-center gap-2" key={label}>
      <span className="text-xs font-bold w-8" style={{ color }}>{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-300 w-8 text-right">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white" data-testid="character-select-page">
      <div className="sticky top-0 z-50 bg-[#0a0f0a]/95 backdrop-blur border-b border-[#c5a059]/30 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1
            className="text-2xl font-black tracking-wider"
            style={{ fontFamily: "'Oxanium', sans-serif", color: '#c5a059' }}
            data-testid="text-page-title"
          >
            HERO SELECT
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">{filteredHeroes.length} heroes</span>
            <Button variant="outline" size="sm" onClick={() => setLocation('/')} data-testid="button-back">Back</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-3 flex-wrap mb-3">
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-500 mr-1">Race:</span>
            {RACES.map(r => (
              <button
                key={r}
                className={`px-3 py-1 text-xs rounded border transition-all ${raceFilter === r ? 'border-[#c5a059] text-[#c5a059] bg-[#c5a059]/10' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                onClick={() => setRaceFilter(r)}
                data-testid={`filter-race-${r.toLowerCase()}`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-500 mr-1">Class:</span>
            {CLASSES.map(c => (
              <button
                key={c}
                className={`px-3 py-1 text-xs rounded border transition-all ${classFilter === c ? 'border-[#c5a059] text-[#c5a059] bg-[#c5a059]/10' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                onClick={() => setClassFilter(c)}
                data-testid={`filter-class-${c.toLowerCase()}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {filteredHeroes.map(hero => {
              const isSelected = selectedHero?.id === hero.id;
              const rarityColor = RARITY_COLORS[hero.rarity] || '#888';
              return (
                <Card
                  key={hero.id}
                  className={`cursor-pointer transition-all p-3 bg-[#1a1a2e] border hover:border-[#c5a059]/50 ${isSelected ? 'border-[#c5a059] ring-1 ring-[#c5a059]/30' : 'border-gray-800'} ${hero.isSecret ? 'bg-gradient-to-br from-[#1a1a2e] to-[#281432]' : ''}`}
                  onClick={() => setSelectedHero(hero)}
                  data-testid={`card-hero-${hero.id}`}
                >
                  {hero.isSecret && <span className="text-[10px] bg-gradient-to-r from-[#c5a059] to-amber-600 text-black px-2 py-0.5 rounded font-bold tracking-wider">SECRET</span>}
                  <div className="mt-1">
                    <h3 className="text-sm font-bold truncate" style={{ color: rarityColor }}>{hero.name}</h3>
                    <p className="text-[10px] text-gray-500 italic truncate">{hero.title}</p>
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: RACE_COLORS[hero.race] }}>{hero.race}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: CLASS_COLORS[hero.heroClass] }}>{hero.heroClass}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: FACTION_COLORS[hero.faction] }}>{hero.faction}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span style={{ color: STAT_COLORS.hp }}>HP {hero.hp}</span>
                      <span style={{ color: STAT_COLORS.atk }}>ATK {hero.atk}</span>
                      <span style={{ color: STAT_COLORS.def }}>DEF {hero.def}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="w-80 shrink-0">
            {selectedHero ? (
              <div className="sticky top-20 bg-[#1a1a2e] border border-gray-800 rounded-xl p-4" data-testid="hero-detail-panel">
                <div className="flex justify-center mb-4">
                  <canvas ref={previewRef} width={200} height={160} className="rounded-lg bg-[#0a0f0a]" data-testid="canvas-hero-preview" />
                </div>

                <h2 className="text-xl font-bold" style={{ fontFamily: "'Oxanium', sans-serif", color: RARITY_COLORS[selectedHero.rarity] }}>
                  {selectedHero.name}
                </h2>
                <p className="text-sm text-gray-500 italic mb-3">{selectedHero.title}</p>

                <div className="flex gap-2 mb-4">
                  <span className="text-xs px-2 py-1 rounded" style={{ color: RACE_COLORS[selectedHero.race], borderWidth: '1px', borderStyle: 'solid', borderColor: RACE_COLORS[selectedHero.race] }}>{selectedHero.race}</span>
                  <span className="text-xs px-2 py-1 rounded" style={{ color: CLASS_COLORS[selectedHero.heroClass], borderWidth: '1px', borderStyle: 'solid', borderColor: CLASS_COLORS[selectedHero.heroClass] }}>{selectedHero.heroClass}</span>
                  <span className="text-xs px-2 py-1 rounded" style={{ color: RARITY_COLORS[selectedHero.rarity], borderWidth: '1px', borderStyle: 'solid', borderColor: RARITY_COLORS[selectedHero.rarity] }}>{selectedHero.rarity}</span>
                </div>

                <div className="space-y-2 mb-4">
                  {statBar('HP', selectedHero.hp, 300, STAT_COLORS.hp)}
                  {statBar('ATK', selectedHero.atk, 35, STAT_COLORS.atk)}
                  {statBar('DEF', selectedHero.def, 25, STAT_COLORS.def)}
                  {statBar('SPD', selectedHero.spd, 80, STAT_COLORS.spd)}
                  {statBar('RNG', selectedHero.rng, 7, STAT_COLORS.rng)}
                  {statBar('MP', selectedHero.mp, 180, STAT_COLORS.mp)}
                </div>

                <div className="mb-4">
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Abilities</h3>
                  <div className="space-y-2">
                    {(CLASS_ABILITIES[selectedHero.heroClass] || []).map((ab, i) => (
                      <div key={i} className="bg-black/30 rounded p-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold" style={{ color: CLASS_COLORS[selectedHero.heroClass] }}>[{ab.key}] {ab.name}</span>
                          <span className="text-[10px] text-gray-500">{ab.cooldown}s CD</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{ab.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-600 italic text-center mb-4">"{selectedHero.quote}"</p>

                <Button
                  className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 font-bold tracking-wider"
                  style={{ fontFamily: "'Oxanium', sans-serif" }}
                  onClick={startGame}
                  data-testid="button-start-game"
                >
                  ENTER BATTLE
                </Button>
              </div>
            ) : (
              <div className="sticky top-20 bg-[#1a1a2e] border border-gray-800 rounded-xl p-8 text-center" data-testid="hero-detail-empty">
                <p className="text-gray-500">Select a hero to view details</p>
                <p className="text-gray-700 text-sm mt-2">26 heroes across 6 races and 4 classes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

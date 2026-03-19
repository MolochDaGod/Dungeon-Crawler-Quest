import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  HEROES, HeroData, RACE_COLORS, CLASS_COLORS, FACTION_COLORS,
  RARITY_COLORS, STAT_COLORS, CLASS_ABILITIES
} from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import {
  getCodexHeroId, getCodexPortraitUrl, getCodexSpriteFallbackUrl, getSkillIconUrl,
  CODEX_FACTION_STYLES, CODEX_RARITY_CONFIG, RACIAL_TRAITS,
  CODEX_CLASS_ABILITIES, CODEX_HERO_META,
} from '@/game/hero-codex';

const sharedVoxel = new VoxelRenderer();

/* ------------------------------------------------------------------ */
/*  Hero Codex Popup (grudge-heros.puter.site card)                     */
/* ------------------------------------------------------------------ */

type CodexTab = 'lore' | 'stats' | 'skills';

function HeroCodexPopup({ hero, onClose }: {
  hero: HeroData;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<CodexTab>('lore');
  const [imgError, setImgError] = useState(false);

  const codexId = getCodexHeroId(hero);
  const meta = CODEX_HERO_META[codexId];
  const fs = CODEX_FACTION_STYLES[hero.faction] || CODEX_FACTION_STYLES.Crusade;
  const rarCfg = CODEX_RARITY_CONFIG[hero.rarity] || CODEX_RARITY_CONFIG.Common;
  const border = fs.border;
  const traits = [...(RACIAL_TRAITS[hero.race] || []), ...(meta?.extraTraits || [])];
  const abilities = CODEX_CLASS_ABILITIES[hero.heroClass] || [];

  const stars = Array.from({ length: rarCfg.stars }, (_, i) => (
    <span key={i} style={{
      display: 'inline-block', width: 13, height: 13,
      clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
      background: rarCfg.color, filter: `drop-shadow(0 0 2px ${rarCfg.color}60)`,
    }} />
  ));

  const statBoxes = [
    { label: 'Health',  value: hero.hp,  color: '#22c55e' },
    { label: 'Attack',  value: hero.atk, color: '#ef4444' },
    { label: 'Defense', value: hero.def, color: '#3b82f6' },
    { label: 'Speed',   value: hero.spd, color: '#f59e0b' },
    { label: 'Range',   value: hero.rng, color: '#06b6d4' },
    { label: 'Mana',    value: hero.mp,  color: '#8b5cf6' },
  ];

  const diffColor = (d: string) =>
    d === 'Expert' ? '#ef4444' : d === 'Advanced' ? '#f59e0b' : d === 'Intermediate' ? '#3b82f6' : '#22c55e';

  /* ---- Lore tab ---- */
  const loreContent = meta ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 12, fontStyle: 'italic', color: border, lineHeight: 1.6 }}>"{hero.quote}"</p>
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#888', marginBottom: 4 }}>Lore</div>
        <p style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{meta.lore}</p>
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#888', marginBottom: 4 }}>Backstory</div>
        <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>{meta.backstory}</p>
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#888', marginBottom: 4 }}>Racial Traits</div>
        {traits.map(t => (
          <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ddd' }}>{t.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: border }}>{t.effect}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, fontStyle: 'italic', textAlign: 'center', color: '#666', paddingTop: 4 }}>{meta.flavorText}</div>
    </div>
  ) : <p style={{ color: '#666', fontSize: 12 }}>No codex data available.</p>;

  /* ---- Stats tab ---- */
  const statsContent = meta ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {statBoxes.map(s => (
          <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 9, textTransform: 'uppercase', color: '#888' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#888', marginBottom: 4 }}>Combat Profile</div>
        {[
          ['Combat Style', meta.combatStyle],
          ['Weapons', meta.weapons],
          ['Difficulty', meta.difficulty],
          ['Primary Attr', meta.primaryAttribute],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
            <span style={{ color: '#aaa' }}>{label}</span>
            <span style={{ color: label === 'Difficulty' ? diffColor(value) : label === 'Primary Attr' ? border : '#ddd', fontWeight: label === 'Primary Attr' ? 700 : 400, maxWidth: 180, textAlign: 'right' as const }}>{value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: '#aaa' }}>Rarity</span>
          <span style={{ display: 'flex', gap: 2 }}>{stars}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>Strengths</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {meta.strengths.map(s => <li key={s} style={{ fontSize: 10, color: '#aaa', display: 'flex', gap: 4, padding: '2px 0' }}><span style={{ color: '#22c55e' }}>+</span> {s}</li>)}
          </ul>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Weaknesses</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {meta.weaknesses.map(w => <li key={w} style={{ fontSize: 10, color: '#aaa', display: 'flex', gap: 4, padding: '2px 0' }}><span style={{ color: '#ef4444' }}>-</span> {w}</li>)}
          </ul>
        </div>
      </div>
    </div>
  ) : null;

  /* ---- Skills tab ---- */
  const skillsContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {abilities.map(a => (
        <div key={a.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${border}20`, border: `1px solid ${border}40` }}>
            <img src={getSkillIconUrl(a.icon)} alt="" style={{ width: 20, height: 20, imageRendering: 'pixelated', filter: `drop-shadow(0 0 2px ${border})` }} crossOrigin="anonymous" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ddd' }}>{a.name}</span>
              {a.manaCost > 0
                ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{a.manaCost} MP</span>
                : <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Passive</span>}
            </div>
            <p style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{a.description}</p>
          </div>
        </div>
      ))}
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: '#888', marginBottom: 4 }}>Racial Traits</div>
        {traits.map(t => (
          <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ddd' }}>{t.name}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: border }}>{t.effect}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const tabContent: Record<CodexTab, React.ReactNode> = { lore: loreContent, stats: statsContent, skills: skillsContent };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card container */}
      <div style={{
        display: 'flex', flexDirection: 'row', maxWidth: 850, width: '95vw', maxHeight: '88vh',
        borderRadius: 16, overflow: 'hidden',
        border: `2px solid ${border}`,
        boxShadow: `0 0 40px ${fs.glow}, 0 8px 40px rgba(0,0,0,0.6)`,
        background: fs.gradient,
      }}>
        {/* Left — portrait */}
        <div style={{ position: 'relative', width: 320, flexShrink: 0, minHeight: 300 }}>
          <img
            src={imgError ? getCodexSpriteFallbackUrl(hero) : getCodexPortraitUrl(hero)}
            alt={hero.name}
            onError={() => !imgError && setImgError(true)}
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 300, maxHeight: 500 }}
          />
          {/* gradients */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 30%, transparent 60%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent 60%, rgba(0,0,0,0.8) 100%)' }} />
          {/* tags */}
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.75)', border: `1px solid ${rarCfg.color}40`, display: 'flex', gap: 3 }}>{stars}</div>
            <span style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.75)', fontSize: 10, fontWeight: 700, color: border, border: `1px solid ${border}50` }}>{hero.faction}</span>
          </div>
          {/* name area */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}>
            <div style={{ fontFamily: "'Cinzel','Oxanium',serif", fontSize: '1.25rem', fontWeight: 700, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{hero.name}</div>
            <div style={{ fontSize: 14, fontStyle: 'italic', color: border }}>{hero.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#ccc' }}>{hero.race}</span>
              <span style={{ fontSize: 11, color: '#888' }}>/</span>
              <span style={{ fontSize: 11, color: '#ccc' }}>{hero.heroClass}</span>
              {meta && <><span style={{ fontSize: 11, color: '#888' }}>/</span><span style={{ fontSize: 11, color: border, fontWeight: 700 }}>{meta.alignment}</span></>}
            </div>
          </div>
        </div>

        {/* Right — tabbed content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {(['lore', 'stats', 'skills'] as CodexTab[]).map(t => (
              <button
                key={t}
                onClick={(e) => { e.stopPropagation(); setTab(t); }}
                style={{
                  flex: 1, padding: '10px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: 1, background: tab === t ? 'rgba(255,255,255,0.03)' : 'transparent',
                  border: 'none', borderBottom: `2px solid ${tab === t ? border : 'transparent'}`,
                  cursor: 'pointer', fontFamily: "'Jost','Segoe UI',sans-serif",
                  color: tab === t ? border : '#888', transition: 'all 0.2s',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, maxHeight: 400 }}>
            {tabContent[tab]}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HeroPortraitCanvas({ hero, width, height, className, style, testId }: {
  hero: HeroData; width: number; height: number; className?: string; style?: React.CSSProperties; testId?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0f0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const raceColor = RACE_COLORS[hero.race] || '#888';
    ctx.fillStyle = raceColor + '08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    sharedVoxel.drawHeroPortrait(ctx, 0, 0, canvas.width, canvas.height, hero.race, hero.heroClass, hero.name);
  }, [hero.id, hero.race, hero.heroClass, hero.name]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={style}
      data-testid={testId}
    />
  );
}

const RACES = ['All', 'Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'];
const CLASSES = ['All', 'Warrior', 'Worg', 'Mage', 'Ranger'];

export default function CharacterSelect() {
  const [, setLocation] = useLocation();
  const [selectedHero, setSelectedHero] = useState<HeroData | null>(null);
  const [raceFilter, setRaceFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [codexHero, setCodexHero] = useState<HeroData | null>(null);
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
        selectedHero.race,
        selectedHero.name
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
    setLocation(mode === 'dungeon' ? '/dungeon' : mode === 'openworld' ? '/open-world' : '/game');
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
                  className={`cursor-pointer transition-all overflow-hidden bg-[#1a1a2e] border hover:border-[#c5a059]/50 ${isSelected ? 'border-[#c5a059] ring-1 ring-[#c5a059]/30' : 'border-gray-800'} ${hero.isSecret ? 'bg-gradient-to-br from-[#1a1a2e] to-[#281432]' : ''}`}
                  onClick={() => {
                    setSelectedHero(hero);
                    setCodexHero(hero);
                  }}
                  data-testid={`card-hero-${hero.id}`}
                >
                  <div className="relative">
                    {hero.isSecret && <span className="absolute top-1 right-1 z-10 text-[9px] bg-gradient-to-r from-[#c5a059] to-amber-600 text-black px-1.5 py-0.5 rounded font-bold tracking-wider">SECRET</span>}
                    <HeroPortraitCanvas
                      hero={hero}
                      width={160}
                      height={112}
                      className="w-full h-28 rounded-t"
                      style={{ borderBottom: `2px solid ${rarityColor}44` }}
                      testId={`img-hero-card-portrait-${hero.id}`}
                    />
                  </div>
                  <div className="px-2.5 mt-1.5">
                    <h3 className="text-sm font-bold truncate" style={{ color: rarityColor }}>{hero.name}</h3>
                    <p className="text-[10px] text-gray-500 italic truncate">{hero.title}</p>
                  </div>
                  <div className="flex gap-1 mt-1.5 flex-wrap px-2.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: RACE_COLORS[hero.race] }}>{hero.race}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: CLASS_COLORS[hero.heroClass] }}>{hero.heroClass}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-gray-700" style={{ color: FACTION_COLORS[hero.faction] }}>{hero.faction}</span>
                  </div>
                  <div className="mt-1.5 space-y-1 px-2.5 pb-2.5">
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
                <div className="flex gap-3 mb-4 items-start">
                  <HeroPortraitCanvas
                    hero={selectedHero}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-lg shrink-0"
                    style={{ border: '2px solid rgba(197,160,89,0.4)' }}
                    testId="img-detail-portrait"
                  />
                  <canvas ref={previewRef} width={200} height={160} className="rounded-lg bg-[#0a0f0a] flex-1" data-testid="canvas-hero-preview" />
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
      {/* Codex click popup */}
      {codexHero && (
        <HeroCodexPopup
          hero={codexHero}
          onClose={() => setCodexHero(null)}
        />
      )}
    </div>
  );
}

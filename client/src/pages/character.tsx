import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { RACE_COLORS, CLASS_COLORS, RARITY_COLORS } from '@/game/types';
import { VoxelRenderer } from '@/game/voxel';
import { loadCharacterData, CharacterData } from '@/game/character-data';
import css from '@/components/MainPanel.module.css';
import {
  EquipmentTab, AttributesTab, ClassSkillsTab, WeaponSkillsTab,
  UpgradesTab, CraftingTab, QuestsTab, GuildTab,
} from '@/components/character-tabs';

type Tab = 'equip' | 'attrs' | 'class' | 'weapon' | 'upgrades' | 'crafting' | 'quests' | 'guild';
const TABS: { id: Tab; label: string }[] = [
  { id: 'equip', label: 'Equipment' },
  { id: 'attrs', label: 'Attributes' },
  { id: 'class', label: 'Class Skills' },
  { id: 'weapon', label: 'Weapon Skills' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'quests', label: 'Quests' },
  { id: 'guild', label: 'Guild' },
];

export default function CharacterPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('equip');
  const data = useMemo<CharacterData>(() => loadCharacterData(), []);

  // Animated hero preview
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);

  useEffect(() => {
    if (!data.hero || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    const voxel = voxelRef.current;
    const hero = data.hero;

    let animId = 0;
    let t = 0;
    const animate = () => {
      t += 0.016;
      ctx.fillStyle = '#0a0f0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const raceColor = RACE_COLORS[hero.race] || '#888';
      const classColor = CLASS_COLORS[hero.heroClass] || '#888';
      ctx.fillStyle = raceColor + '0a';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, Math.PI * 2);
      ctx.fill();
      voxel.drawHeroVoxel(ctx, canvas.width / 2, canvas.height / 2 + 20, raceColor, classColor, hero.heroClass, Math.sin(t * 0.4) * 0.2, 'idle', t, hero.race, hero.name);
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animId);
  }, [data.hero]);

  if (!data.hero) {
    return (
      <div className="min-h-screen bg-[#0a0f0a] text-white flex items-center justify-center flex-col gap-4">
        <p className="text-gray-400">No hero selected.</p>
        <Button variant="outline" onClick={() => setLocation('/character-select')}>Select Hero</Button>
      </div>
    );
  }

  const rarityColor = RARITY_COLORS[data.hero.rarity] || '#888';
  const hpPct = data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0;
  const mpPct = data.maxMp > 0 ? (data.mp / data.maxMp) * 100 : 0;

  return (
    <div className={css.overlay} style={{ position: 'relative' }}>
      {/* ═══ TOP BAR ═══ */}
      <div className={css.topBar}>
        <div className={css.logo}>
          <h1 className={css.logoTitle}>Grudge Warlords</h1>
          <span className={css.logoSub}>— {data.heroClass} —</span>
        </div>

        <div className={css.resourceBars}>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.hpFill}`} style={{ width: `${hpPct}%` }} />
            <span className={css.resLabel}>{data.hp}/{data.maxHp}</span>
          </div>
          <div className={css.resBar}>
            <div className={`${css.resFill} ${css.mpFill}`} style={{ width: `${mpPct}%` }} />
            <span className={css.resLabel}>{data.mp}/{data.maxMp}</span>
          </div>
        </div>

        <div className={css.playerInfo}>
          <span className={css.playerName}>{data.heroName}</span>
          <span className={css.playerLevel}>Lv{data.level} {data.heroRace} {data.heroClass}</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="outline" size="sm" onClick={() => setLocation('/character-select')}>Switch Hero</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/island')}>Islands</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/open-world')}>Play</Button>
          <Button variant="outline" size="sm" onClick={() => setLocation('/')}>Home</Button>
        </div>
      </div>

      {/* ═══ MAIN BODY ═══ */}
      <div className={css.mainBody}>

        {/* ── Left Column: Character Preview + Stats ── */}
        <div className={css.leftCol}>
          <div className={css.charPreview}>
            <canvas ref={canvasRef} width={200} height={200} style={{ display: 'block', borderRadius: 8 }} />
            <div style={{ textAlign: 'center', marginTop: 4, fontSize: 11, color: rarityColor, fontWeight: 700 }}>{data.hero.title}</div>
          </div>

          {/* Core Stats */}
          <div className={css.statSection}>
            <h3>Core Stats</h3>
            <div className={css.statRow}><span className={css.statKey}>ATK</span><span className={css.statVal}>{data.atk}</span></div>
            <div className={css.statRow}><span className={css.statKey}>DEF</span><span className={css.statVal}>{data.def}</span></div>
            <div className={css.statRow}><span className={css.statKey}>SPD</span><span className={css.statVal}>{data.spd}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Level</span><span className={css.statVal}>{data.level}</span></div>
          </div>

          {/* Derived Stats */}
          {data.attributeSummary && (
            <div className={css.statSection}>
              <h3>Derived Stats</h3>
              <div className={css.statRow}><span className={css.statKey}>Bonus HP</span><span className={css.statValGreen}>+{data.attributeSummary.derived.bonusHp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Bonus MP</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusMp}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Phys ATK</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusAtk}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Mag ATK</span><span className={css.statVal}>+{data.attributeSummary.derived.bonusMagicDmg}</span></div>
              <div className={css.statRow}><span className={css.statKey}>Crit</span><span className={css.statVal}>{data.attributeSummary.derived.critChance.toFixed(1)}%</span></div>
              <div className={css.statRow}><span className={css.statKey}>Evasion</span><span className={css.statVal}>{data.attributeSummary.derived.evasionChance.toFixed(1)}%</span></div>
            </div>
          )}

          {/* Progress */}
          <div className={css.statSection}>
            <h3>Progress</h3>
            <div className={css.statRow}><span className={css.statKey}>Reputation</span><span className={css.statVal} style={{ color: data.reputationColor }}>{data.reputationRank}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Zones</span><span className={css.statVal}>{data.zonesDiscovered}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Kills</span><span className={css.statVal}>{data.monstersSlain}</span></div>
            <div className={css.statRow}><span className={css.statKey}>Bosses</span><span className={css.statVal}>{data.bossesDefeated}</span></div>
          </div>
        </div>

        {/* ── Center Column: Tabs ── */}
        <div className={css.centerCol}>
          <div className={css.tabStrip}>
            {TABS.map(t => (
              <button
                key={t.id}
                className={tab === t.id ? css.tabBtnActive : css.tabBtn}
                onClick={() => setTab(t.id)}
              >{t.label}</button>
            ))}
          </div>
          <div className={css.contentArea}>
            {tab === 'equip' && <EquipmentTab data={data} />}
            {tab === 'attrs' && <AttributesTab data={data} />}
            {tab === 'class' && <ClassSkillsTab data={data} />}
            {tab === 'weapon' && <WeaponSkillsTab data={data} />}
            {tab === 'upgrades' && <UpgradesTab />}
            {tab === 'crafting' && <CraftingTab data={data} />}
            {tab === 'quests' && <QuestsTab data={data} />}
            {tab === 'guild' && <GuildTab />}
          </div>
        </div>

        {/* ── Right Column: Inventory ── */}
        <div className={css.rightCol}>
          <div className={css.invHeader}>
            <h3>Inventory</h3>
            <span className={css.goldDisplay}>🪙 {data.gold}</span>
          </div>
          <div className={css.invGrid}>
            {Array.from({ length: 36 }).map((_, i) => {
              const item = data.bagItems.items[i];
              return (
                <div key={i} className={`${css.invCell} ${item ? css.invCellFilled : ''}`} title={item ? `T${item.tier} ${item.name}` : 'Empty'}>
                  {item && <span style={{ fontSize: 9, color: '#f5e2c1', textAlign: 'center', display: 'block', lineHeight: '1.1', padding: 2, overflow: 'hidden' }}>{item.name}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

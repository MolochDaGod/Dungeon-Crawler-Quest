import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  HEROES, HeroData, RACE_COLORS, CLASS_COLORS, FACTION_COLORS, CLASS_ABILITIES,
} from '@/game/types';
import {
  ATTRIBUTES, AttributeId, ATTR_IDS, createPlayerAttributes, allocatePoint, deallocatePoint,
  computeDerivedStats, saveAttributes, STARTING_POINTS,
} from '@/game/attributes';

/* ── Constants ── */

const RACES = ['Human', 'Barbarian', 'Dwarf', 'Elf', 'Orc', 'Undead'] as const;
const CLASSES = ['Warrior', 'Mage', 'Ranger', 'Worg'] as const;

const RACE_FACTIONS: Record<string, string> = {
  Human: 'Crusade', Barbarian: 'Crusade', Dwarf: 'Fabled', Elf: 'Fabled', Orc: 'Legion', Undead: 'Legion',
};

const RACE_DESCRIPTIONS: Record<string, string> = {
  Human: 'Versatile fighters with balanced stats and strong leadership.',
  Barbarian: 'Ferocious warriors from the north. High damage, resilient.',
  Dwarf: 'Stout and tough. Exceptional defense and crafting.',
  Elf: 'Graceful and fast. Magical affinity and precision.',
  Orc: 'Brutal strength. Devastating attacks, aggressive playstyle.',
  Undead: 'Risen warriors. Lifesteal, dark magic, relentless.',
};

const CLASS_DESCRIPTIONS: Record<string, string> = {
  Warrior: 'Melee frontline. Heavy armor, shields, and devastating strikes.',
  Mage: 'Ranged spellcaster. AoE damage, CC, and arcane power.',
  Ranger: 'Ranged attacker. Bows, crossbows, traps, and mobility.',
  Worg: 'Agile shapeshifter. Fast attacks, lifesteal, stealth.',
};

const RACE_STAT_BONUSES: Record<string, Partial<Record<string, number>>> = {
  Human: { hp: 10, atk: 2, def: 2, spd: 5, mp: 10 },
  Barbarian: { hp: 15, atk: 5, def: -2, spd: 3, mp: -5 },
  Dwarf: { hp: 20, atk: 1, def: 6, spd: -5, mp: 5 },
  Elf: { hp: -10, atk: -1, def: -3, spd: 10, mp: 20 },
  Orc: { hp: 10, atk: 6, def: 2, spd: 2, mp: -10 },
  Undead: { hp: 25, atk: 1, def: 4, spd: -5, mp: 10 },
};

const CLASS_BASE_STATS: Record<string, { hp: number; atk: number; def: number; spd: number; rng: number; mp: number }> = {
  Warrior: { hp: 220, atk: 22, def: 18, spd: 55, rng: 1.5, mp: 90 },
  Mage:    { hp: 160, atk: 20, def: 7,  spd: 60, rng: 5.5, mp: 150 },
  Ranger:  { hp: 180, atk: 21, def: 10, spd: 70, rng: 6.5, mp: 110 },
  Worg:    { hp: 210, atk: 23, def: 14, spd: 65, rng: 1.5, mp: 95 },
};

type Step = 'race' | 'class' | 'name' | 'attributes' | 'avatar' | 'confirm';

/* ── Component ── */

export default function CreateCharacter() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>('race');
  const [race, setRace] = useState<string | null>(null);
  const [heroClass, setHeroClass] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [attrs, setAttrs] = useState(() => createPlayerAttributes('Warrior'));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Recompute attributes when class changes
  const resetAttrs = (cls: string) => setAttrs(createPlayerAttributes(cls));

  // Compute final stats
  const finalStats = useMemo(() => {
    if (!race || !heroClass) return null;
    const base = CLASS_BASE_STATS[heroClass];
    const bonus = RACE_STAT_BONUSES[race] || {};
    return {
      hp: base.hp + (bonus.hp || 0),
      atk: base.atk + (bonus.atk || 0),
      def: base.def + (bonus.def || 0),
      spd: base.spd + (bonus.spd || 0),
      rng: base.rng,
      mp: base.mp + (bonus.mp || 0),
    };
  }, [race, heroClass]);

  const derived = useMemo(() => computeDerivedStats(attrs), [attrs]);

  // Abilities for selected race+class combo
  const abilities = useMemo(() => {
    if (!race || !heroClass) return [];
    return CLASS_ABILITIES[`${race}_${heroClass}`] || CLASS_ABILITIES[heroClass] || [];
  }, [race, heroClass]);

  /* ── Avatar Generation ── */
  const generateAvatar = async () => {
    if (!race || !heroClass || !name.trim()) return;
    setIsGenerating(true);
    try {
      if ((window as any).puter?.ai?.txt2img) {
        const prompt = `Cartoon-style RPG character portrait: a ${race} ${heroClass} named ${name}. Fantasy voxel art style, vibrant colors, head and shoulders, dark gradient background.`;
        const img = await (window as any).puter.ai.txt2img(prompt, { model: 'gpt-image-1', quality: 'medium' });
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          // Name overlay
          const oh = c.height * 0.22;
          const g = ctx.createLinearGradient(0, c.height - oh, 0, c.height);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(0.4, 'rgba(0,0,0,0.7)');
          g.addColorStop(1, 'rgba(0,0,0,0.9)');
          ctx.fillStyle = g;
          ctx.fillRect(0, c.height - oh, c.width, oh);
          const fs = Math.floor(c.height * 0.07);
          ctx.font = `bold ${fs}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillStyle = RACE_COLORS[race] || '#fbbf24';
          ctx.fillText(name.substring(0, 20), c.width / 2, c.height - oh / 2);
          ctx.font = `${Math.floor(c.height * 0.04)}px Arial`;
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(`${race} ${heroClass}`.toUpperCase(), c.width / 2, c.height - oh / 2 - fs * 0.8);
        }
        setAvatarUrl(c.toDataURL('image/webp', 0.7));
      }
    } catch (err) {
      console.warn('[CreateChar] Avatar gen failed:', err);
    }
    setIsGenerating(false);
  };

  /* ── Save & Start ── */
  const createCharacter = async () => {
    if (!race || !heroClass || !name.trim() || !finalStats) return;
    setIsCreating(true);
    try {
      const faction = RACE_FACTIONS[race] || 'Crusade';

      // Create a new hero entry with a unique ID
      const newId = 100 + Math.floor(Math.random() * 9000);
      const newHero: HeroData = {
        id: newId,
        name: name.trim(),
        title: `The ${heroClass}`,
        race,
        heroClass,
        faction,
        rarity: 'Rare',
        hp: finalStats.hp,
        atk: finalStats.atk,
        def: finalStats.def,
        spd: finalStats.spd,
        rng: finalStats.rng,
        mp: finalStats.mp,
        quote: `A new ${race} ${heroClass} joins the fight.`,
      };

      // Save to localStorage (matches existing loadCharacterData flow)
      localStorage.setItem('grudge_hero_id', String(newId));
      localStorage.setItem('grudge_custom_hero', JSON.stringify(newHero));
      localStorage.setItem('grudge_avatar_url', avatarUrl || '');
      saveAttributes(attrs);

      // Also push into the HEROES array at runtime so other code can find it
      if (!HEROES.find(h => h.id === newId)) {
        HEROES.push(newHero);
      }

      // Try to save to Grudge backend
      try {
        const userData = JSON.parse(localStorage.getItem('grudge_current_user') || '{}');
        await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            raceId: race.toLowerCase(),
            classId: heroClass.toLowerCase(),
            attributes: attrs.base,
            avatarUrl: avatarUrl && !avatarUrl.startsWith('data:') ? avatarUrl : null,
            accountId: userData.accountId || userData.id,
            grudgeId: userData.grudgeId,
          }),
        });
      } catch { /* offline fallback — character saved locally */ }

      setLocation('/game');
    } catch (err) {
      console.error('[CreateChar] Error:', err);
    }
    setIsCreating(false);
  };

  /* ── UI Helpers ── */
  const stepIndex = ['race', 'class', 'name', 'attributes', 'avatar', 'confirm'].indexOf(step);
  const stepLabels = ['Race', 'Class', 'Name', 'Stats', 'Avatar', 'Confirm'];

  const canNext = () => {
    if (step === 'race') return !!race;
    if (step === 'class') return !!heroClass;
    if (step === 'name') return name.trim().length >= 2;
    if (step === 'attributes') return true;
    if (step === 'avatar') return true;
    return true;
  };

  const goNext = () => {
    const steps: Step[] = ['race', 'class', 'name', 'attributes', 'avatar', 'confirm'];
    const i = steps.indexOf(step);
    if (i < steps.length - 1) setStep(steps[i + 1]);
  };
  const goBack = () => {
    const steps: Step[] = ['race', 'class', 'name', 'attributes', 'avatar', 'confirm'];
    const i = steps.indexOf(step);
    if (i > 0) setStep(steps[i - 1]);
    else setLocation('/');
  };

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f23 0%, #1a0a2e 50%, #0f1923 100%)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24' }}>CHARACTER CREATION</h1>
          <p style={{ fontSize: 12, color: '#888' }}>Forge your legend</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stepLabels.map((l, i) => (
            <div key={l} style={{
              padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600,
              background: i === stepIndex ? '#fbbf24' : 'rgba(255,255,255,0.05)',
              color: i === stepIndex ? '#000' : i < stepIndex ? '#fbbf24' : '#555',
              border: `1px solid ${i <= stepIndex ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`,
            }}>{l}</div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* STEP: Race */}
        {step === 'race' && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#fbbf24' }}>Choose Your Race</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {RACES.map(r => (
                <div key={r} onClick={() => setRace(r)} style={{
                  padding: 16, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                  background: race === r ? `${RACE_COLORS[r]}20` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${race === r ? RACE_COLORS[r] : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: race === r ? `0 0 20px ${RACE_COLORS[r]}30` : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: RACE_COLORS[r] }}>{r}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${FACTION_COLORS[RACE_FACTIONS[r]]}20`, color: FACTION_COLORS[RACE_FACTIONS[r]] }}>{RACE_FACTIONS[r]}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>{RACE_DESCRIPTIONS[r]}</p>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {Object.entries(RACE_STAT_BONUSES[r] || {}).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.05)', color: (v as number) > 0 ? '#4ade80' : '#f87171' }}>
                        {(v as number) > 0 ? '+' : ''}{v} {k.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP: Class */}
        {step === 'class' && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#fbbf24' }}>Choose Your Class</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {CLASSES.map(c => {
                const ab = CLASS_ABILITIES[`${race}_${c}`] || CLASS_ABILITIES[c] || [];
                return (
                  <div key={c} onClick={() => { setHeroClass(c); resetAttrs(c); }} style={{
                    padding: 16, borderRadius: 12, cursor: 'pointer',
                    background: heroClass === c ? `${CLASS_COLORS[c]}20` : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${heroClass === c ? CLASS_COLORS[c] : 'rgba(255,255,255,0.08)'}`,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: CLASS_COLORS[c], marginBottom: 4 }}>{c}</div>
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{CLASS_DESCRIPTIONS[c]}</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {ab.slice(0, 4).map(a => (
                        <span key={a.name} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#ccc' }}>
                          [{a.key}] {a.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Name */}
        {step === 'name' && (
          <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#fbbf24' }}>Name Your Hero</h2>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              placeholder="Enter hero name..."
              autoFocus
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 8, fontSize: 18, textAlign: 'center',
                background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)', color: '#fff',
                outline: 'none',
              }}
            />
            <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{name.length}/20 characters</p>
            {race && heroClass && (
              <p style={{ fontSize: 14, marginTop: 16 }}>
                <span style={{ color: RACE_COLORS[race] }}>{race}</span>{' '}
                <span style={{ color: CLASS_COLORS[heroClass] }}>{heroClass}</span>{' '}
                of the <span style={{ color: FACTION_COLORS[RACE_FACTIONS[race!]] }}>{RACE_FACTIONS[race!]}</span>
              </p>
            )}
          </div>
        )}

        {/* STEP: Attributes */}
        {step === 'attributes' && (
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4, color: '#fbbf24' }}>Allocate Attributes</h2>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
              Points remaining: <span style={{ color: attrs.unspentPoints > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{attrs.unspentPoints}</span> / {STARTING_POINTS}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {ATTRIBUTES.map(a => {
                const val = attrs.base[a.id as AttributeId];
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ fontSize: 18 }}>{a.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: '#666' }}>{a.description.split(':')[0]}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={() => { const copy = { ...attrs, base: { ...attrs.base } }; if (deallocatePoint(copy, a.id as AttributeId)) setAttrs(copy); }}
                        style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 14 }}>-</button>
                      <span style={{ width: 28, textAlign: 'center', fontSize: 16, fontWeight: 700, color: a.color }}>{val}</span>
                      <button onClick={() => { const copy = { ...attrs, base: { ...attrs.base }, unspentPoints: attrs.unspentPoints, totalAllocated: attrs.totalAllocated }; if (allocatePoint(copy, a.id as AttributeId)) setAttrs(copy); }}
                        disabled={attrs.unspentPoints <= 0}
                        style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: attrs.unspentPoints > 0 ? '#fbbf24' : 'rgba(255,255,255,0.05)', color: '#000', cursor: attrs.unspentPoints > 0 ? 'pointer' : 'default', fontSize: 14 }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP: Avatar */}
        {step === 'avatar' && (
          <div style={{ textAlign: 'center', maxWidth: 500, margin: '0 auto' }}>
            <h2 style={{ fontSize: 20, marginBottom: 16, color: '#fbbf24' }}>Generate Avatar</h2>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: 256, height: 256, borderRadius: 12, border: '3px solid #fbbf24', objectFit: 'cover', margin: '0 auto 16px' }} />
            ) : (
              <div style={{ width: 256, height: 256, borderRadius: 12, border: '2px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#555' }}>
                {isGenerating ? 'Generating...' : 'No avatar yet'}
              </div>
            )}
            <Button onClick={generateAvatar} disabled={isGenerating} style={{ marginRight: 8 }}>
              {isGenerating ? 'Generating...' : avatarUrl ? 'Regenerate' : 'Generate Avatar'}
            </Button>
            <Button variant="outline" onClick={goNext}>Skip</Button>
          </div>
        )}

        {/* STEP: Confirm */}
        {step === 'confirm' && finalStats && (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, marginBottom: 4, color: '#fbbf24' }}>{name}</h2>
            <p style={{ color: '#888', marginBottom: 16 }}>
              <span style={{ color: RACE_COLORS[race!] }}>{race}</span>{' '}
              <span style={{ color: CLASS_COLORS[heroClass!] }}>{heroClass}</span>{' — '}
              <span style={{ color: FACTION_COLORS[RACE_FACTIONS[race!]] }}>{RACE_FACTIONS[race!]}</span>
            </p>
            {avatarUrl && <img src={avatarUrl} alt="" style={{ width: 128, height: 128, borderRadius: 12, border: `2px solid ${RACE_COLORS[race!]}`, objectFit: 'cover', margin: '0 auto 16px' }} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 400, margin: '0 auto 24px' }}>
              {[
                { label: 'HP', value: finalStats.hp, color: '#ef4444' },
                { label: 'ATK', value: finalStats.atk, color: '#f59e0b' },
                { label: 'DEF', value: finalStats.def, color: '#3b82f6' },
                { label: 'SPD', value: finalStats.spd, color: '#22c55e' },
                { label: 'RNG', value: finalStats.rng, color: '#06b6d4' },
                { label: 'MP', value: finalStats.mp, color: '#a855f7' },
              ].map(s => (
                <div key={s.label} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <Button onClick={createCharacter} disabled={isCreating} style={{ padding: '12px 48px', fontSize: 16 }}>
              {isCreating ? 'Creating...' : 'Begin Adventure'}
            </Button>
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="ghost" onClick={goBack}>{step === 'race' ? 'Cancel' : '← Back'}</Button>
        {step !== 'confirm' && step !== 'avatar' && (
          <Button onClick={goNext} disabled={!canNext()} style={{ background: canNext() ? '#fbbf24' : undefined, color: canNext() ? '#000' : undefined }}>
            Continue →
          </Button>
        )}
      </div>
    </div>
  );
}

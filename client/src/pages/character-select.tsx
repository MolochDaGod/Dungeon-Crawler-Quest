import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, Sword, Crosshair, Skull, Hammer, Trophy,
  ChevronLeft, ChevronRight, Plus, Minus, RotateCcw,
  Heart, Droplets, Zap, Target, Swords, ShieldCheck, Wind,
} from 'lucide-react';
import { CHARACTER_CLASSES, Attributes, calculateDerivedStats, CharacterClass } from '@/game/types';

const TOTAL_POINTS = 160;

const ATTRIBUTE_INFO: { key: keyof Attributes; label: string; icon: typeof Heart; color: string; desc: string }[] = [
  { key: 'strength', label: 'Strength', icon: Swords, color: '#ef4444', desc: 'Physical damage, defense, health' },
  { key: 'intellect', label: 'Intellect', icon: Zap, color: '#3b82f6', desc: 'Magic damage, mana, cooldown reduction' },
  { key: 'vitality', label: 'Vitality', icon: Heart, color: '#22c55e', desc: 'Max health, health regen, stamina' },
  { key: 'dexterity', label: 'Dexterity', icon: Target, color: '#f59e0b', desc: 'Crit chance, accuracy, attack speed' },
  { key: 'endurance', label: 'Endurance', icon: ShieldCheck, color: '#8b5cf6', desc: 'Defense, stamina, block, resistance' },
  { key: 'wisdom', label: 'Wisdom', icon: Droplets, color: '#06b6d4', desc: 'Mana regen, resistance, spell accuracy' },
  { key: 'agility', label: 'Agility', icon: Wind, color: '#10b981', desc: 'Evasion, movement speed, attack speed' },
  { key: 'tactics', label: 'Tactics', icon: Crosshair, color: '#f97316', desc: 'Armor pen, defense break, combo power' },
];

const CLASS_ICONS: Record<string, typeof Shield> = {
  crusader: Shield,
  berserker: Sword,
  elf_ranger: Crosshair,
  necromancer: Skull,
  dwarf_enforcer: Hammer,
  gladiator: Trophy,
};

export default function CharacterSelect() {
  const [, setLocation] = useLocation();
  const [selectedClassIndex, setSelectedClassIndex] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [customAttributes, setCustomAttributes] = useState<Attributes | null>(null);

  const selectedClass = CHARACTER_CLASSES[selectedClassIndex];
  const attrs = customAttributes || selectedClass.baseAttributes;
  const totalAllocated = Object.values(attrs).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - totalAllocated;
  const derivedStats = calculateDerivedStats(attrs);

  function selectClass(index: number) {
    setSelectedClassIndex(index);
    setCustomAttributes(null);
  }

  function adjustAttribute(key: keyof Attributes, delta: number) {
    const current = customAttributes || { ...selectedClass.baseAttributes };
    const newVal = Math.max(0, Math.min(80, current[key] + delta));
    const newAttrs = { ...current, [key]: newVal };
    const newTotal = Object.values(newAttrs).reduce((a, b) => a + b, 0);
    if (newTotal <= TOTAL_POINTS) {
      setCustomAttributes(newAttrs);
    }
  }

  function resetAttributes() {
    setCustomAttributes(null);
  }

  function randomizeAttributes() {
    const newAttrs: Attributes = { strength: 0, intellect: 0, vitality: 0, dexterity: 0, endurance: 0, wisdom: 0, agility: 0, tactics: 0 };
    let pts = TOTAL_POINTS;
    const keys = Object.keys(newAttrs) as (keyof Attributes)[];
    while (pts > 0) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      const add = Math.min(pts, Math.floor(Math.random() * 5) + 1);
      if (newAttrs[k] + add <= 80) {
        newAttrs[k] += add;
        pts -= add;
      }
    }
    setCustomAttributes(newAttrs);
  }

  function startGame() {
    if (!playerName.trim()) return;
    const gameData = {
      classId: selectedClass.id,
      playerName: playerName.trim(),
      attributes: attrs,
    };
    localStorage.setItem('grudge_new_game', JSON.stringify(gameData));
    setLocation('/game');
  }

  const ClassIcon = CLASS_ICONS[selectedClass.id] || Shield;

  return (
    <div className="h-screen w-screen bg-[#0a0808] text-neutral-100 overflow-hidden" data-testid="page-character-select">
      <div className="absolute inset-0 bg-gradient-to-b from-red-950/10 via-transparent to-purple-950/10" />

      <div className="relative z-10 h-full flex flex-col">
        <header className="flex items-center justify-between gap-2 px-6 py-4 border-b border-neutral-800/50">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="text-neutral-400"
            data-testid="button-back-home"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl tracking-[0.3em] text-red-400/80" style={{ fontFamily: 'Oxanium, sans-serif' }}>
            CHOOSE YOUR CHAMPION
          </h1>
          <div className="w-20" />
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 border-r border-neutral-800/50 flex flex-col">
            <div className="p-4">
              <p className="text-xs text-neutral-500 tracking-wider mb-3" style={{ fontFamily: 'Oxanium, sans-serif' }}>
                CHARACTER CLASS
              </p>
            </div>
            <ScrollArea className="flex-1 px-3">
              <div className="space-y-2 pb-4">
                {CHARACTER_CLASSES.map((cls, i) => {
                  const Icon = CLASS_ICONS[cls.id] || Shield;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => selectClass(i)}
                      className={`w-full text-left p-3 rounded-md transition-all duration-200 flex items-center gap-3 ${
                        i === selectedClassIndex
                          ? 'bg-red-950/40 border border-red-800/50'
                          : 'bg-neutral-900/30 border border-transparent hover:bg-neutral-800/30'
                      }`}
                      data-testid={`button-class-${cls.id}`}
                    >
                      <div
                        className="w-10 h-10 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${cls.color}20`, borderColor: cls.color, borderWidth: 1 }}
                      >
                        <Icon className="w-5 h-5" style={{ color: cls.color }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-200">{cls.name}</p>
                        <p className="text-xs text-neutral-500 line-clamp-1">{cls.description.split('.')[0]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-6 flex flex-col overflow-auto">
                <div className="flex items-start gap-6 mb-6">
                  <div
                    className="w-24 h-24 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${selectedClass.color}15`, border: `2px solid ${selectedClass.color}40` }}
                  >
                    <ClassIcon className="w-12 h-12" style={{ color: selectedClass.color }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold" style={{ color: selectedClass.color, fontFamily: 'Oxanium, sans-serif' }}>
                      {selectedClass.name}
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1 max-w-md">{selectedClass.description}</p>
                    <p className="text-xs text-neutral-600 mt-2 italic max-w-md">{selectedClass.lore}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-xs text-neutral-500 tracking-wider" style={{ fontFamily: 'Oxanium, sans-serif' }}>
                      ATTRIBUTES ({totalAllocated} / {TOTAL_POINTS})
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {remaining} pts remaining
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={randomizeAttributes} data-testid="button-randomize">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={resetAttributes} data-testid="button-reset">
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {ATTRIBUTE_INFO.map(({ key, label, icon: AttrIcon, color, desc }) => (
                      <div key={key} className="flex items-center gap-2 bg-neutral-900/40 rounded-md p-2">
                        <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                          <AttrIcon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-medium text-neutral-300 truncate">{label}</span>
                            <span className="text-xs font-bold" style={{ color }}>{attrs[key]}</span>
                          </div>
                          <Progress value={(attrs[key] / 80) * 100} className="h-1.5 mt-1" />
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => adjustAttribute(key, -5)}
                            className="w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
                            data-testid={`button-attr-minus-${key}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => adjustAttribute(key, 5)}
                            className="w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
                            disabled={remaining <= 0}
                            data-testid={`button-attr-plus-${key}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-neutral-500 tracking-wider mb-3" style={{ fontFamily: 'Oxanium, sans-serif' }}>
                    ABILITIES
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedClass.abilities.map((ability) => (
                      <div key={ability.id} className="bg-neutral-900/40 rounded-md p-2.5 flex items-start gap-2.5">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center shrink-0 text-sm font-bold"
                          style={{ backgroundColor: `${ability.color}20`, color: ability.color, border: `1px solid ${ability.color}40` }}
                        >
                          {ability.key}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-200">{ability.name}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">{ability.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-blue-400">{ability.manaCost} mana</span>
                            <span className="text-xs text-neutral-600">|</span>
                            <span className="text-xs text-amber-400">{ability.cooldown}s cd</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-64 border-l border-neutral-800/50 p-4 overflow-auto">
                <p className="text-xs text-neutral-500 tracking-wider mb-3" style={{ fontFamily: 'Oxanium, sans-serif' }}>
                  DERIVED STATS
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'Health', value: derivedStats.maxHealth, color: '#22c55e', icon: Heart },
                    { label: 'Mana', value: derivedStats.maxMana, color: '#3b82f6', icon: Droplets },
                    { label: 'Stamina', value: derivedStats.maxStamina, color: '#f59e0b', icon: Zap },
                    { label: 'Damage', value: derivedStats.damage.toFixed(1), color: '#ef4444', icon: Swords },
                    { label: 'Magic DMG', value: derivedStats.magicDamage.toFixed(1), color: '#a855f7', icon: Zap },
                    { label: 'Defense', value: derivedStats.defense.toFixed(1), color: '#6366f1', icon: ShieldCheck },
                    { label: 'Accuracy', value: `${(derivedStats.accuracy * 100).toFixed(1)}%`, color: '#f97316', icon: Target },
                    { label: 'Crit Chance', value: `${(derivedStats.criticalChance * 100).toFixed(1)}%`, color: '#fbbf24', icon: Target },
                    { label: 'Crit DMG', value: `${(derivedStats.criticalDamage * 100).toFixed(0)}%`, color: '#fbbf24', icon: Swords },
                    { label: 'Atk Speed', value: derivedStats.attackSpeed.toFixed(2), color: '#14b8a6', icon: Wind },
                    { label: 'Move Speed', value: derivedStats.movementSpeed.toFixed(2), color: '#10b981', icon: Wind },
                    { label: 'Block', value: `${(derivedStats.blockChance * 100).toFixed(1)}%`, color: '#8b5cf6', icon: Shield },
                    { label: 'Evasion', value: `${(derivedStats.evasion * 100).toFixed(1)}%`, color: '#06b6d4', icon: Wind },
                    { label: 'Resistance', value: `${(derivedStats.resistance * 100).toFixed(1)}%`, color: '#8b5cf6', icon: ShieldCheck },
                    { label: 'Health Regen', value: `${derivedStats.healthRegen.toFixed(1)}/s`, color: '#22c55e', icon: Heart },
                    { label: 'Mana Regen', value: `${derivedStats.manaRegen.toFixed(1)}/s`, color: '#3b82f6', icon: Droplets },
                    { label: 'Lifesteal', value: `${(derivedStats.drainHealth * 100).toFixed(1)}%`, color: '#dc2626', icon: Heart },
                    { label: 'CDR', value: `${(derivedStats.cooldownReduction * 100).toFixed(1)}%`, color: '#06b6d4', icon: RotateCcw },
                    { label: 'Armor Pen', value: `${(derivedStats.armorPenetration * 100).toFixed(1)}%`, color: '#f97316', icon: Target },
                  ].map(({ label, value, color, icon: StatIcon }) => (
                    <div key={label} className="flex items-center justify-between gap-2 py-1 border-b border-neutral-800/30">
                      <div className="flex items-center gap-1.5">
                        <StatIcon className="w-3 h-3" style={{ color }} />
                        <span className="text-xs text-neutral-400">{label}</span>
                      </div>
                      <span className="text-xs font-medium" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-800/50 p-4 flex items-center justify-between gap-4 bg-neutral-950/50">
              <div className="flex items-center gap-3">
                <label className="text-xs text-neutral-500 tracking-wider shrink-0" style={{ fontFamily: 'Oxanium, sans-serif' }}>
                  HERO NAME
                </label>
                <Input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name..."
                  className="max-w-xs bg-neutral-900/60 border-neutral-700/50 text-neutral-200"
                  maxLength={20}
                  data-testid="input-player-name"
                />
              </div>
              <Button
                size="lg"
                onClick={startGame}
                disabled={!playerName.trim() || totalAllocated > TOTAL_POINTS}
                className="px-8 tracking-wider bg-gradient-to-r from-red-800 to-red-700 border-red-600 text-red-100"
                style={{ fontFamily: 'Oxanium, sans-serif' }}
                data-testid="button-start-game"
              >
                <Sword className="w-4 h-4 mr-2" />
                ENTER THE DUNGEON
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { VoxelRenderer } from "@/game/voxel";
import { SpriteEffectSystem, SpriteEffectType } from "@/game/sprite-effects";
import { HEROES, RACE_COLORS, CLASS_COLORS, CLASS_ABILITIES, ITEMS, HeroData } from "@/game/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Play, Pause, SkipForward, SkipBack, RotateCcw, Download,
  Swords, Wand2, Shield, Zap, Bot, Sparkles, User, Eye, EyeOff,
  Copy, RefreshCw, Save, Repeat
} from "lucide-react";

const RACES = ["Human", "Barbarian", "Dwarf", "Elf", "Orc", "Undead"];
const CLASSES = ["Warrior", "Worg", "Mage", "Ranger"];
const ANIM_STATES = [
  "idle", "walk", "attack", "combo_finisher", "ability",
  "dodge", "block", "dash_attack", "lunge_slash", "death",
];
const BODY_PARTS = ["leftLeg", "rightLeg", "leftArm", "rightArm", "torso", "head", "weapon"] as const;

const SPRITE_EFFECT_TYPES: SpriteEffectType[] = [
  'mage_ability', 'mage_attack', 'frost', 'channel', 'magic_impact',
  'fire_ability', 'warrior_spin', 'shield', 'buff', 'melee_impact',
  'fire_attack', 'ultimate', 'dash', 'undead', 'charging',
  'holy', 'dark_magic', 'shadow', 'ice', 'healing'
];

const WEAPON_TYPES = ["Sword", "Claws", "Staff", "Bow", "Gun", "Rapier", "Axe", "Hammer"];

const AI_PRESETS: Record<string, AIProfile> = {
  Aggressive: {
    name: "Aggressive",
    retreatThreshold: 0.15, aggroRange: 600, heroWeight: 1.5, minionWeight: 0.3, towerWeight: 0.1,
    abilityScoreWeight: 1.2, ultimateThreshold: 1, healThreshold: 0.3,
    kiteEnabled: false, kiteRangePercent: 40, pushAggression: 0.9,
    chatFrequency: 0.8, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 1.5, classDefWeight: 0.5, classHpWeight: 0.5, classSpdWeight: 1.0
  },
  Defensive: {
    name: "Defensive",
    retreatThreshold: 0.4, aggroRange: 350, heroWeight: 0.5, minionWeight: 0.8, towerWeight: 0.2,
    abilityScoreWeight: 0.8, ultimateThreshold: 3, healThreshold: 0.6,
    kiteEnabled: true, kiteRangePercent: 50, pushAggression: 0.3,
    chatFrequency: 0.4, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 0.5, classDefWeight: 1.5, classHpWeight: 1.5, classSpdWeight: 0.8
  },
  Balanced: {
    name: "Balanced",
    retreatThreshold: 0.25, aggroRange: 500, heroWeight: 1.0, minionWeight: 0.6, towerWeight: 0.15,
    abilityScoreWeight: 1.0, ultimateThreshold: 2, healThreshold: 0.5,
    kiteEnabled: true, kiteRangePercent: 40, pushAggression: 0.5,
    chatFrequency: 0.5, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 1.0, classDefWeight: 1.0, classHpWeight: 1.0, classSpdWeight: 1.0
  },
  Support: {
    name: "Support",
    retreatThreshold: 0.35, aggroRange: 400, heroWeight: 0.4, minionWeight: 0.5, towerWeight: 0.1,
    abilityScoreWeight: 1.5, ultimateThreshold: 2, healThreshold: 0.7,
    kiteEnabled: true, kiteRangePercent: 55, pushAggression: 0.2,
    chatFrequency: 0.7, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 0.3, classDefWeight: 1.2, classHpWeight: 1.3, classSpdWeight: 0.8
  },
  Assassin: {
    name: "Assassin",
    retreatThreshold: 0.2, aggroRange: 550, heroWeight: 2.0, minionWeight: 0.2, towerWeight: 0.05,
    abilityScoreWeight: 1.3, ultimateThreshold: 1, healThreshold: 0.25,
    kiteEnabled: false, kiteRangePercent: 30, pushAggression: 0.4,
    chatFrequency: 0.3, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 2.0, classDefWeight: 0.3, classHpWeight: 0.5, classSpdWeight: 1.5
  },
  Tank: {
    name: "Tank",
    retreatThreshold: 0.12, aggroRange: 450, heroWeight: 0.8, minionWeight: 0.5, towerWeight: 0.3,
    abilityScoreWeight: 0.7, ultimateThreshold: 2, healThreshold: 0.4,
    kiteEnabled: false, kiteRangePercent: 30, pushAggression: 0.6,
    chatFrequency: 0.5, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 0.5, classDefWeight: 2.0, classHpWeight: 2.0, classSpdWeight: 0.3
  },
  Kiter: {
    name: "Kiter",
    retreatThreshold: 0.3, aggroRange: 600, heroWeight: 1.2, minionWeight: 0.4, towerWeight: 0.1,
    abilityScoreWeight: 1.1, ultimateThreshold: 2, healThreshold: 0.5,
    kiteEnabled: true, kiteRangePercent: 60, pushAggression: 0.4,
    chatFrequency: 0.4, chatEnabled: true, buyTier1: 300, buyTier2: 750, buyTier3: 1400,
    classAtkWeight: 1.3, classDefWeight: 0.6, classHpWeight: 0.7, classSpdWeight: 1.8
  },
  Pusher: {
    name: "Pusher",
    retreatThreshold: 0.2, aggroRange: 400, heroWeight: 0.3, minionWeight: 1.5, towerWeight: 1.0,
    abilityScoreWeight: 0.8, ultimateThreshold: 3, healThreshold: 0.4,
    kiteEnabled: false, kiteRangePercent: 40, pushAggression: 1.0,
    chatFrequency: 0.6, chatEnabled: true, buyTier1: 250, buyTier2: 650, buyTier3: 1200,
    classAtkWeight: 1.2, classDefWeight: 0.8, classHpWeight: 1.0, classSpdWeight: 1.0
  }
};

interface AIProfile {
  name: string;
  retreatThreshold: number;
  aggroRange: number;
  heroWeight: number;
  minionWeight: number;
  towerWeight: number;
  abilityScoreWeight: number;
  ultimateThreshold: number;
  healThreshold: number;
  kiteEnabled: boolean;
  kiteRangePercent: number;
  pushAggression: number;
  chatFrequency: number;
  chatEnabled: boolean;
  buyTier1: number;
  buyTier2: number;
  buyTier3: number;
  classAtkWeight: number;
  classDefWeight: number;
  classHpWeight: number;
  classSpdWeight: number;
}

type TabId = "characters" | "animations" | "effects" | "weapons" | "ai-config" | "ai-generator";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "characters", label: "Characters", icon: User },
  { id: "animations", label: "Animations", icon: Play },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "weapons", label: "Weapons", icon: Swords },
  { id: "ai-config", label: "AI Config", icon: Bot },
  { id: "ai-generator", label: "AI Generator", icon: Zap },
];

function getAnimPosesForPreview(heroClass: string, animState: string, t: number) {
  const idle = {
    leftLeg: { ox: 0, oy: 0, oz: 0 }, rightLeg: { ox: 0, oy: 0, oz: 0 },
    leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
    torso: { ox: 0, oy: 0, oz: Math.round(Math.sin(t * 2) * 0.3) },
    head: { ox: 0, oy: 0, oz: 0 }, weapon: { ox: 0, oy: 0, oz: 0 }, weaponGlow: 0
  };
  if (animState === "idle") return idle;
  if (animState === "walk") {
    const freq = 10, phase = Math.sin(t * freq), phase2 = Math.cos(t * freq);
    const stride = 2.0, liftH = 0.8, bounce = Math.abs(Math.sin(t * freq * 2)) * 0.6;
    return {
      leftLeg: { ox: Math.round(phase * stride), oy: 0, oz: Math.round(Math.max(0, -phase) * liftH) },
      rightLeg: { ox: Math.round(-phase * stride), oy: 0, oz: Math.round(Math.max(0, phase) * liftH) },
      leftArm: { ox: Math.round(-phase * 1.5), oy: 0, oz: Math.round(Math.max(0, phase2) * 0.5) },
      rightArm: { ox: Math.round(phase * 1.5), oy: 0, oz: Math.round(Math.max(0, -phase2) * 0.5) },
      torso: { ox: 0, oy: Math.round(Math.sin(t * freq) * 0.4), oz: Math.round(bounce * 0.3) },
      head: { ox: 0, oy: 0, oz: Math.round(Math.sin(t * freq * 2 + 0.5) * 0.35) },
      weapon: { ox: Math.round(phase * 0.8), oy: 0, oz: Math.round(bounce * 0.2) }, weaponGlow: 0
    };
  }
  if (animState === "attack") {
    const windup = Math.min(1, t * 3), swing = t >= 0.3 && t < 0.55 ? (t - 0.3) / 0.25 : 0;
    const recover = t >= 0.55 ? Math.min(1, (t - 0.55) / 0.3) : 0;
    const power = Math.sin(swing * Math.PI);
    return {
      leftLeg: { ox: Math.round(windup * 2 - recover), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(-windup + recover * 0.5), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(windup * 4 + power * 3 - recover * 3), oy: Math.round(-power * 3), oz: Math.round(windup * 2 + power * 5 - recover * 4) },
      rightArm: { ox: Math.round(windup * 2 - recover), oy: Math.round(power), oz: Math.round(windup + power * 2 - recover * 2) },
      torso: { ox: Math.round(windup * 2 - recover), oy: Math.round(power * 0.5), oz: Math.round(power * 0.5) },
      head: { ox: Math.round(windup - recover * 0.5), oy: 0, oz: Math.round(power * 0.3) },
      weapon: { ox: Math.round(windup * 5 + power * 4 - recover * 3), oy: Math.round(-power * 5), oz: Math.round(windup * 3 + power * 6 - recover * 5) },
      weaponGlow: swing > 0.1 ? 1.0 : windup > 0.7 ? 0.5 : 0
    };
  }
  if (animState === "combo_finisher") {
    const phase2 = t * 28, spin = Math.sin(phase2), power = Math.abs(Math.sin(phase2 * 0.5));
    const slam = Math.max(0, Math.sin(phase2 * 0.5 + 1.2));
    return {
      leftLeg: { ox: Math.round(spin * 4), oy: 0, oz: Math.round(Math.max(0, -spin) * 2.5) },
      rightLeg: { ox: Math.round(-spin * 4), oy: 0, oz: Math.round(Math.max(0, spin) * 2.5) },
      leftArm: { ox: Math.round(spin * 7), oy: Math.round(-power * 5.5), oz: Math.round(power * 7 + slam * 4) },
      rightArm: { ox: Math.round(-spin * 6), oy: Math.round(power * 3), oz: Math.round(power * 6 + slam * 3) },
      torso: { ox: Math.round(spin * 3), oy: 0, oz: Math.round(power * 2 - slam * 3) },
      head: { ox: Math.round(spin * 2), oy: 0, oz: Math.round(power * 1.5 - slam * 2.5) },
      weapon: { ox: Math.round(spin * 10 + power * 6), oy: Math.round(-power * 7 + slam * 4), oz: Math.round(power * 10 - slam * 6) },
      weaponGlow: 1.0
    };
  }
  if (animState === "ability") {
    const channel = Math.min(1, t * 3), pulse = Math.sin(t * 8) * 0.5 + 0.5;
    return {
      leftLeg: { ox: 0, oy: 0, oz: 0 }, rightLeg: { ox: 0, oy: 0, oz: 0 },
      leftArm: { ox: Math.round(-channel * 2), oy: Math.round(-channel * 3), oz: Math.round(channel * 5 + pulse * 2) },
      rightArm: { ox: Math.round(channel * 2), oy: Math.round(-channel * 2), oz: Math.round(channel * 4 + pulse) },
      torso: { ox: 0, oy: 0, oz: Math.round(channel * 0.5) },
      head: { ox: 0, oy: 0, oz: Math.round(channel * 0.5 + pulse * 0.3) },
      weapon: { ox: Math.round(pulse * 2.5), oy: 0, oz: Math.round(pulse * 5 + channel) },
      weaponGlow: Math.max(pulse, channel * 0.6) * 0.95
    };
  }
  if (animState === "dodge") {
    const roll = Math.min(1, t * 8), spin2 = Math.sin(roll * Math.PI * 2);
    return {
      leftLeg: { ox: Math.round(spin2 * 2), oy: 0, oz: Math.round(-roll * 2) },
      rightLeg: { ox: Math.round(-spin2 * 2), oy: 0, oz: Math.round(-roll * 2) },
      leftArm: { ox: Math.round(-spin2 * 1.5), oy: Math.round(-roll), oz: Math.round(-roll * 3) },
      rightArm: { ox: Math.round(spin2 * 1.5), oy: Math.round(roll), oz: Math.round(-roll * 3) },
      torso: { ox: Math.round(spin2 * 0.5), oy: 0, oz: Math.round(-roll * 4) },
      head: { ox: Math.round(spin2 * 0.3), oy: 0, oz: Math.round(-roll * 5) },
      weapon: { ox: Math.round(-spin2 * 2), oy: 0, oz: Math.round(-roll * 3) }, weaponGlow: 0
    };
  }
  if (animState === "block") {
    const brace = Math.min(1, t * 6);
    return {
      leftLeg: { ox: Math.round(-brace * 0.5), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(brace * 0.5), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(-brace * 2), oy: Math.round(brace), oz: Math.round(brace * 2) },
      rightArm: { ox: Math.round(brace), oy: Math.round(-brace * 0.5), oz: Math.round(brace * 1.5) },
      torso: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(brace * 0.3) },
      head: { ox: Math.round(-brace * 0.5), oy: 0, oz: Math.round(brace * 0.3) },
      weapon: { ox: Math.round(-brace), oy: Math.round(brace * 2), oz: Math.round(brace * 3) },
      weaponGlow: 0.2
    };
  }
  if (animState === "death") {
    const fall = Math.min(1, t * 2);
    return {
      leftLeg: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 3) },
      rightLeg: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 3) },
      leftArm: { ox: Math.round(fall * 3), oy: Math.round(-fall), oz: Math.round(-fall * 2) },
      rightArm: { ox: Math.round(fall * 3), oy: Math.round(fall), oz: Math.round(-fall * 2) },
      torso: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 4) },
      head: { ox: Math.round(fall * 3), oy: 0, oz: Math.round(-fall * 5) },
      weapon: { ox: Math.round(fall * 4), oy: Math.round(-fall * 2), oz: Math.round(-fall * 4) }, weaponGlow: 0
    };
  }
  if (animState === "lunge_slash") {
    const progress = Math.min(1, t / 0.4), lunge = progress < 0.4 ? progress / 0.4 : 1;
    const slash = progress >= 0.35 && progress < 0.6 ? (progress - 0.35) / 0.25 : 0;
    const recover = progress >= 0.6 ? (progress - 0.6) / 0.4 : 0;
    const slashArc = Math.sin(slash * Math.PI);
    return {
      leftLeg: { ox: Math.round(lunge * 4 - recover * 2), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(-lunge * 2 + recover), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(lunge * 5 + slashArc * 3 - recover * 3), oy: Math.round(-slashArc * 4), oz: Math.round(lunge * 3 + slashArc * 5 - recover * 4) },
      rightArm: { ox: Math.round(lunge * 2 - recover), oy: Math.round(slashArc * 1.5), oz: Math.round(lunge * 2 + slashArc * 2 - recover * 2) },
      torso: { ox: Math.round(lunge * 3.5 - recover * 1.5), oy: Math.round(slashArc * 0.8), oz: Math.round(-slashArc * 0.5 + lunge * 0.5) },
      head: { ox: Math.round(lunge * 2.5 + slashArc * 0.5 - recover), oy: Math.round(slashArc * 0.5), oz: Math.round(lunge * 0.5 - slashArc * 0.3) },
      weapon: { ox: Math.round(lunge * 6 + slashArc * 4 - recover * 3), oy: Math.round(-slashArc * 6 + recover * 2), oz: Math.round(lunge * 4 + slashArc * 6 - recover * 5) },
      weaponGlow: slash > 0.1 ? 1.0 : lunge > 0.7 ? 0.6 : recover > 0 ? 0.3 : 0
    };
  }
  if (animState === "dash_attack") {
    const thrust = Math.min(1, t * 6), extend = Math.sin(thrust * Math.PI);
    return {
      leftLeg: { ox: Math.round(-extend * 2), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(extend * 2), oy: 0, oz: 0 },
      leftArm: { ox: Math.round(extend * 3), oy: Math.round(-extend), oz: Math.round(extend * 2) },
      rightArm: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend) },
      torso: { ox: Math.round(extend * 2), oy: 0, oz: Math.round(extend * 0.5) },
      head: { ox: Math.round(extend * 1.5), oy: 0, oz: Math.round(extend * 0.5) },
      weapon: { ox: Math.round(extend * 4), oy: Math.round(-extend * 2), oz: Math.round(extend * 3) },
      weaponGlow: extend > 0.5 ? extend : 0
    };
  }
  return idle;
}

function LabeledSlider({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1" data-testid={`slider-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-amber-400 font-mono">{value.toFixed(step < 1 ? 2 : 0)}{suffix || ''}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-sm font-bold text-amber-400 border-b border-amber-900/30 pb-1 mb-3 uppercase tracking-wider">{title}</h3>;
}

function CharactersTab({ hero, race, heroClass, setRace, setHeroClass, facing, setFacing }: {
  hero: HeroData; race: string; heroClass: string; setRace: (r: string) => void;
  setHeroClass: (c: string) => void; facing: number; setFacing: (f: number) => void;
}) {
  const [statMults, setStatMults] = useState({ hp: 100, atk: 100, def: 100, spd: 100, rng: 100, mp: 100 });

  return (
    <div className="space-y-4">
      <SectionHeader title="Character Config" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Race</label>
          <Select value={race} onValueChange={setRace}>
            <SelectTrigger data-testid="select-race"><SelectValue /></SelectTrigger>
            <SelectContent>{RACES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Class</label>
          <Select value={heroClass} onValueChange={setHeroClass}>
            <SelectTrigger data-testid="select-class"><SelectValue /></SelectTrigger>
            <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
        onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />

      <SectionHeader title="Hero Info" />
      <div className="bg-black/30 rounded p-3 space-y-1">
        <p className="text-amber-300 font-bold text-sm">{hero.name}</p>
        <p className="text-gray-400 text-xs italic">{hero.title}</p>
        <p className="text-gray-500 text-xs">"{hero.quote}"</p>
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 text-purple-300">{hero.race}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-300">{hero.heroClass}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{hero.faction}</span>
        </div>
      </div>

      <SectionHeader title="Base Stats" />
      <div className="grid grid-cols-3 gap-2">
        {(["hp", "atk", "def", "spd", "rng", "mp"] as const).map(stat => (
          <div key={stat} className="bg-black/20 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase">{stat}</div>
            <div className="text-amber-300 font-mono text-sm">{hero[stat]}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Stat Multipliers" />
      {(["hp", "atk", "def", "spd", "rng", "mp"] as const).map(stat => (
        <LabeledSlider key={stat} label={stat.toUpperCase()} value={statMults[stat]}
          min={50} max={200} step={5} onChange={v => setStatMults(s => ({ ...s, [stat]: v }))} suffix="%" />
      ))}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" data-testid="btn-reset-stats"
          onClick={() => setStatMults({ hp: 100, atk: 100, def: 100, spd: 100, rng: 100, mp: 100 })}>
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
        <Button variant="outline" size="sm" className="flex-1 text-xs" data-testid="btn-export-stats"
          onClick={() => {
            const data = { hero: hero.name, race, heroClass, stats: hero, multipliers: statMults };
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
          }}>
          <Copy className="w-3 h-3 mr-1" /> Export
        </Button>
      </div>
    </div>
  );
}

function AnimationsTab({ animState, setAnimState, playing, setPlaying, speed, setSpeed,
  animTimer, resetTimer, stepFrame, stepBack, facing, setFacing, heroClass, showVFX, setShowVFX }: {
  animState: string; setAnimState: (s: string) => void; playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void; animTimer: number; resetTimer: () => void;
  stepFrame: () => void; stepBack: () => void; facing: number; setFacing: (f: number) => void;
  heroClass: string; showVFX: boolean; setShowVFX: (v: boolean) => void;
}) {
  const poses = getAnimPosesForPreview(heroClass, animState, animTimer);

  return (
    <div className="space-y-4">
      <SectionHeader title="Animation State" />
      <div className="grid grid-cols-2 gap-2">
        {ANIM_STATES.map(state => (
          <Button key={state} size="sm" data-testid={`btn-anim-${state}`}
            variant={animState === state ? "default" : "outline"}
            className={`text-xs ${animState === state ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={() => { setAnimState(state); resetTimer(); }}>
            {state.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>

      <SectionHeader title="Playback" />
      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={stepBack} data-testid="btn-step-back">
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)} data-testid="btn-play-pause"
          className={playing ? 'bg-green-900/40 border-green-700' : ''}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={stepFrame} data-testid="btn-step-forward">
          <SkipForward className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={resetTimer} data-testid="btn-reset-timer">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
      <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
        onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />

      <div className="bg-black/30 rounded p-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Timer</span>
          <span className="text-amber-400 font-mono">{animTimer.toFixed(3)}s</span>
        </div>
        <div className="h-2 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-amber-500 rounded transition-all" style={{ width: `${Math.min(100, (animTimer % 2) * 50)}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowVFX(!showVFX)} data-testid="btn-toggle-vfx"
          className={showVFX ? 'bg-purple-900/40 border-purple-700' : ''}>
          {showVFX ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />}
          VFX {showVFX ? 'ON' : 'OFF'}
        </Button>
      </div>

      <SectionHeader title="Body Part Poses" />
      <div className="space-y-1">
        {BODY_PARTS.map(part => {
          const p = poses[part];
          return (
            <div key={part} className="flex justify-between text-xs bg-black/20 rounded px-2 py-1">
              <span className="text-gray-400 w-20">{part}</span>
              <span className="text-red-400 font-mono w-10">x:{p.ox}</span>
              <span className="text-green-400 font-mono w-10">y:{p.oy}</span>
              <span className="text-blue-400 font-mono w-10">z:{p.oz}</span>
            </div>
          );
        })}
        <div className="flex justify-between text-xs bg-black/20 rounded px-2 py-1">
          <span className="text-gray-400 w-20">glow</span>
          <span className="text-yellow-400 font-mono">{poses.weaponGlow.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function EffectsTab({ hero, heroClass, onPlayEffect }: {
  hero: HeroData; heroClass: string; onPlayEffect: (type: SpriteEffectType, scale: number, durationMs: number) => void;
}) {
  const abilities = CLASS_ABILITIES[heroClass] || [];
  const [selectedEffect, setSelectedEffect] = useState<SpriteEffectType>('melee_impact');
  const [effectScale, setEffectScale] = useState(1.0);
  const [effectDuration, setEffectDuration] = useState(600);
  const [abilityEffects, setAbilityEffects] = useState<Record<string, SpriteEffectType>>({
    Q: heroClass === 'Warrior' ? 'warrior_spin' : heroClass === 'Mage' ? 'mage_ability' : heroClass === 'Ranger' ? 'buff' : 'fire_ability',
    W: heroClass === 'Warrior' ? 'shield' : heroClass === 'Mage' ? 'frost' : heroClass === 'Ranger' ? 'dark_magic' : 'channel',
    E: heroClass === 'Warrior' ? 'melee_impact' : heroClass === 'Mage' ? 'shield' : heroClass === 'Ranger' ? 'dash' : 'fire_attack',
    R: 'ultimate',
  });

  return (
    <div className="space-y-4">
      <SectionHeader title="Hero Abilities" />
      {abilities.map((ab, i) => (
        <Card key={i} className="bg-black/30 border-gray-800 p-3" data-testid={`ability-card-${ab.key}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-amber-400 font-bold text-xs mr-2">[{ab.key}]</span>
              <span className="text-white text-sm font-semibold">{ab.name}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300">{ab.type}</span>
          </div>
          <p className="text-gray-400 text-xs mb-2">{ab.description}</p>
          <div className="grid grid-cols-4 gap-1 text-[10px]">
            <div className="bg-black/30 rounded p-1 text-center">
              <div className="text-gray-500">DMG</div>
              <div className="text-red-400 font-mono">{ab.damage}</div>
            </div>
            <div className="bg-black/30 rounded p-1 text-center">
              <div className="text-gray-500">CD</div>
              <div className="text-blue-400 font-mono">{ab.cooldown}s</div>
            </div>
            <div className="bg-black/30 rounded p-1 text-center">
              <div className="text-gray-500">MANA</div>
              <div className="text-cyan-400 font-mono">{ab.manaCost}</div>
            </div>
            <div className="bg-black/30 rounded p-1 text-center">
              <div className="text-gray-500">RANGE</div>
              <div className="text-green-400 font-mono">{ab.range}</div>
            </div>
          </div>
          <div className="mt-2">
            <label className="text-[10px] text-gray-500 block mb-1">Effect mapping</label>
            <Select value={abilityEffects[ab.key]} onValueChange={v => setAbilityEffects(s => ({ ...s, [ab.key]: v as SpriteEffectType }))}>
              <SelectTrigger className="h-7 text-xs" data-testid={`select-effect-${ab.key}`}><SelectValue /></SelectTrigger>
              <SelectContent>{SPRITE_EFFECT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" className="mt-2 w-full text-xs h-7"
            data-testid={`btn-preview-ability-${ab.key}`}
            onClick={() => onPlayEffect(abilityEffects[ab.key], effectScale, effectDuration)}>
            <Sparkles className="w-3 h-3 mr-1" /> Preview Effect
          </Button>
        </Card>
      ))}

      <SectionHeader title="Effect Preview" />
      <Select value={selectedEffect} onValueChange={v => setSelectedEffect(v as SpriteEffectType)}>
        <SelectTrigger data-testid="select-effect-type"><SelectValue /></SelectTrigger>
        <SelectContent>{SPRITE_EFFECT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
      </Select>
      <LabeledSlider label="Scale" value={effectScale} min={0.1} max={3.0} step={0.1} onChange={setEffectScale} suffix="x" />
      <LabeledSlider label="Duration" value={effectDuration} min={100} max={2000} step={50} onChange={setEffectDuration} suffix="ms" />
      <Button variant="outline" className="w-full text-xs" data-testid="btn-play-effect"
        onClick={() => onPlayEffect(selectedEffect, effectScale, effectDuration)}>
        <Sparkles className="w-3 h-3 mr-1" /> Play Effect
      </Button>
    </div>
  );
}

function WeaponsTab({ heroClass }: { heroClass: string }) {
  const defaultWeapon = heroClass === 'Warrior' ? 'Sword' : heroClass === 'Worg' ? 'Claws' : heroClass === 'Mage' ? 'Staff' : 'Bow';
  const [weaponType, setWeaponType] = useState(defaultWeapon);
  const [primaryColor, setPrimaryColor] = useState('#d4d4d4');
  const [secondaryColor, setSecondaryColor] = useState('#c0c0c0');
  const [glowColor, setGlowColor] = useState('#ffffff');
  const [glowIntensity, setGlowIntensity] = useState(0.5);
  const [sizeMultiplier, setSizeMultiplier] = useState(1.0);
  const [trailColor, setTrailColor] = useState(CLASS_COLORS[heroClass] || '#ef4444');
  const [hasRapier, setHasRapier] = useState(false);

  useEffect(() => {
    const def = heroClass === 'Warrior' ? 'Sword' : heroClass === 'Worg' ? 'Claws' : heroClass === 'Mage' ? 'Staff' : 'Bow';
    setWeaponType(def);
    setTrailColor(CLASS_COLORS[heroClass] || '#ef4444');
  }, [heroClass]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Weapon Type" />
      <div className="grid grid-cols-4 gap-2">
        {WEAPON_TYPES.map(w => (
          <Button key={w} size="sm" data-testid={`btn-weapon-${w.toLowerCase()}`}
            variant={weaponType === w ? "default" : "outline"}
            className={`text-xs ${weaponType === w ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={() => setWeaponType(w)}>
            {w}
          </Button>
        ))}
      </div>

      <SectionHeader title="Weapon Colors" />
      {[
        { label: "Primary", value: primaryColor, set: setPrimaryColor },
        { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
        { label: "Glow", value: glowColor, set: setGlowColor },
        { label: "Trail", value: trailColor, set: setTrailColor },
      ].map(({ label, value, set }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-20">{label}</span>
          <input type="color" value={value} onChange={e => set(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700"
            data-testid={`color-weapon-${label.toLowerCase()}`} />
          <span className="text-xs text-gray-500 font-mono">{value}</span>
        </div>
      ))}

      <SectionHeader title="Weapon Settings" />
      <LabeledSlider label="Glow Intensity" value={glowIntensity} min={0} max={1} step={0.05} onChange={setGlowIntensity} />
      <LabeledSlider label="Size Multiplier" value={sizeMultiplier} min={0.5} max={2.0} step={0.1} onChange={setSizeMultiplier} suffix="x" />

      <SectionHeader title="Special Items" />
      <div className="flex items-center gap-3 bg-black/30 rounded p-3">
        <input type="checkbox" checked={hasRapier} onChange={e => setHasRapier(e.target.checked)}
          className="rounded" data-testid="check-rapier" />
        <div>
          <p className="text-amber-400 text-sm font-semibold">Divine Rapier</p>
          <p className="text-gray-500 text-xs">+60 ATK +8 SPD. Dropped on death!</p>
        </div>
      </div>

      <SectionHeader title="Items Shop" />
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {ITEMS.map(item => (
          <div key={item.id} className="flex justify-between text-xs bg-black/20 rounded px-2 py-1.5"
            data-testid={`item-${item.id}`}>
            <span className={`${item.tier === 3 ? 'text-amber-400' : item.tier === 2 ? 'text-blue-400' : 'text-gray-300'}`}>{item.name}</span>
            <span className="text-yellow-500 font-mono">{item.cost}g</span>
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-weapon"
        onClick={() => {
          const data = { weaponType, primaryColor, secondaryColor, glowColor, glowIntensity, sizeMultiplier, trailColor, hasRapier };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Config
      </Button>
    </div>
  );
}

function AIConfigTab({ hero }: { hero: HeroData }) {
  const [config, setConfig] = useState<AIProfile>({ ...AI_PRESETS.Balanced, name: "Custom" });
  const [useCustom, setUseCustom] = useState(false);

  const updateConfig = (key: keyof AIProfile, value: any) => {
    setConfig(c => ({ ...c, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-black/30 rounded p-3">
        <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)}
          className="rounded" data-testid="check-custom-ai" />
        <div>
          <p className="text-amber-400 text-sm font-semibold">Custom AI for {hero.name}</p>
          <p className="text-gray-500 text-xs">Override global defaults with hero-specific config</p>
        </div>
      </div>

      <SectionHeader title="Retreat Behavior" />
      <LabeledSlider label="Retreat HP Threshold" value={config.retreatThreshold} min={0.1} max={0.5} step={0.01}
        onChange={v => updateConfig('retreatThreshold', v)} suffix="" />

      <SectionHeader title="Aggro Settings" />
      <LabeledSlider label="Aggro Range" value={config.aggroRange} min={100} max={800} step={25}
        onChange={v => updateConfig('aggroRange', v)} suffix="px" />
      <LabeledSlider label="Hero Priority" value={config.heroWeight} min={0} max={3} step={0.1}
        onChange={v => updateConfig('heroWeight', v)} />
      <LabeledSlider label="Minion Priority" value={config.minionWeight} min={0} max={2} step={0.1}
        onChange={v => updateConfig('minionWeight', v)} />
      <LabeledSlider label="Tower Priority" value={config.towerWeight} min={0} max={2} step={0.1}
        onChange={v => updateConfig('towerWeight', v)} />

      <SectionHeader title="Ability Usage" />
      <LabeledSlider label="Ability Score Weight" value={config.abilityScoreWeight} min={0} max={2} step={0.1}
        onChange={v => updateConfig('abilityScoreWeight', v)} />
      <LabeledSlider label="Ultimate Min Enemies" value={config.ultimateThreshold} min={1} max={5} step={1}
        onChange={v => updateConfig('ultimateThreshold', v)} />
      <LabeledSlider label="Heal Target HP%" value={config.healThreshold} min={0.1} max={0.8} step={0.05}
        onChange={v => updateConfig('healThreshold', v)} />

      <SectionHeader title="Item Buy Logic" />
      <LabeledSlider label="Tier 1 Gold" value={config.buyTier1} min={200} max={500} step={25}
        onChange={v => updateConfig('buyTier1', v)} suffix="g" />
      <LabeledSlider label="Tier 2 Gold" value={config.buyTier2} min={500} max={1200} step={50}
        onChange={v => updateConfig('buyTier2', v)} suffix="g" />
      <LabeledSlider label="Tier 3 Gold" value={config.buyTier3} min={1000} max={2500} step={100}
        onChange={v => updateConfig('buyTier3', v)} suffix="g" />

      <SectionHeader title="Class Weights (Item Preference)" />
      <LabeledSlider label="ATK Weight" value={config.classAtkWeight} min={0} max={3} step={0.1}
        onChange={v => updateConfig('classAtkWeight', v)} />
      <LabeledSlider label="DEF Weight" value={config.classDefWeight} min={0} max={3} step={0.1}
        onChange={v => updateConfig('classDefWeight', v)} />
      <LabeledSlider label="HP Weight" value={config.classHpWeight} min={0} max={3} step={0.1}
        onChange={v => updateConfig('classHpWeight', v)} />
      <LabeledSlider label="SPD Weight" value={config.classSpdWeight} min={0} max={3} step={0.1}
        onChange={v => updateConfig('classSpdWeight', v)} />

      <SectionHeader title="Kiting" />
      <div className="flex items-center gap-3 mb-2">
        <input type="checkbox" checked={config.kiteEnabled} onChange={e => updateConfig('kiteEnabled', e.target.checked)}
          className="rounded" data-testid="check-kite" />
        <span className="text-xs text-gray-400">Enable Kiting</span>
      </div>
      <LabeledSlider label="Kite Range %" value={config.kiteRangePercent} min={20} max={70} step={5}
        onChange={v => updateConfig('kiteRangePercent', v)} suffix="%" />

      <SectionHeader title="Laning & Push" />
      <LabeledSlider label="Push Aggression" value={config.pushAggression} min={0} max={1} step={0.05}
        onChange={v => updateConfig('pushAggression', v)} />

      <SectionHeader title="Chat" />
      <div className="flex items-center gap-3 mb-2">
        <input type="checkbox" checked={config.chatEnabled} onChange={e => updateConfig('chatEnabled', e.target.checked)}
          className="rounded" data-testid="check-chat" />
        <span className="text-xs text-gray-400">Enable Chat</span>
      </div>
      <LabeledSlider label="Chat Frequency" value={config.chatFrequency} min={0} max={1} step={0.05}
        onChange={v => updateConfig('chatFrequency', v)} />

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-ai"
        onClick={() => navigator.clipboard.writeText(JSON.stringify(config, null, 2))}>
        <Copy className="w-3 h-3 mr-1" /> Export AI Config
      </Button>
    </div>
  );
}

function AIGeneratorTab({ hero }: { hero: HeroData }) {
  const [currentProfile, setCurrentProfile] = useState<AIProfile>({ ...AI_PRESETS.Balanced });
  const [compareProfile, setCompareProfile] = useState<AIProfile | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<AIProfile[]>([]);
  const [profileName, setProfileName] = useState("Custom Profile");

  const applyPreset = (name: string) => {
    if (AI_PRESETS[name]) {
      setCurrentProfile({ ...AI_PRESETS[name] });
    }
  };

  const randomize = () => {
    const r = (min: number, max: number, step: number = 0.01) => {
      const range = (max - min) / step;
      return min + Math.round(Math.random() * range) * step;
    };
    setCurrentProfile({
      name: "Random",
      retreatThreshold: r(0.1, 0.45),
      aggroRange: r(200, 700, 25),
      heroWeight: r(0.2, 2.5, 0.1),
      minionWeight: r(0.1, 1.5, 0.1),
      towerWeight: r(0.05, 1.0, 0.05),
      abilityScoreWeight: r(0.5, 2.0, 0.1),
      ultimateThreshold: r(1, 4, 1),
      healThreshold: r(0.2, 0.7, 0.05),
      kiteEnabled: Math.random() > 0.4,
      kiteRangePercent: r(25, 60, 5),
      pushAggression: r(0.1, 1.0, 0.05),
      chatFrequency: r(0.1, 0.9, 0.05),
      chatEnabled: true,
      buyTier1: r(250, 400, 25),
      buyTier2: r(600, 900, 50),
      buyTier3: r(1100, 1800, 100),
      classAtkWeight: r(0.3, 2.5, 0.1),
      classDefWeight: r(0.3, 2.5, 0.1),
      classHpWeight: r(0.3, 2.5, 0.1),
      classSpdWeight: r(0.3, 2.0, 0.1)
    });
  };

  const getBehaviorDescription = (p: AIProfile): string => {
    const traits: string[] = [];
    if (p.retreatThreshold < 0.2) traits.push("fights to the death");
    else if (p.retreatThreshold > 0.35) traits.push("retreats early when damaged");
    if (p.heroWeight > 1.3) traits.push("prioritizes killing enemy heroes");
    if (p.minionWeight > 1.0) traits.push("focuses on farming minions");
    if (p.towerWeight > 0.5) traits.push("pushes towers aggressively");
    if (p.kiteEnabled) traits.push("kites enemies at range");
    if (p.pushAggression > 0.7) traits.push("pushes lanes hard");
    if (p.pushAggression < 0.3) traits.push("plays passively near tower");
    if (p.abilityScoreWeight > 1.2) traits.push("uses abilities frequently");
    if (p.classAtkWeight > 1.5) traits.push("builds damage items");
    if (p.classDefWeight > 1.5) traits.push("builds tanky items");
    return traits.length > 0 ? traits.join(", ") + "." : "Balanced playstyle with no strong preferences.";
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Preset Profiles" />
      <div className="grid grid-cols-4 gap-2">
        {Object.keys(AI_PRESETS).map(name => (
          <Button key={name} size="sm" variant="outline" className="text-xs" data-testid={`btn-preset-${name.toLowerCase()}`}
            onClick={() => applyPreset(name)}>
            {name}
          </Button>
        ))}
      </div>

      <Button variant="outline" className="w-full text-xs" onClick={randomize} data-testid="btn-randomize">
        <RefreshCw className="w-3 h-3 mr-1" /> Randomize Profile
      </Button>

      <SectionHeader title="Current Profile" />
      <div className="bg-black/30 rounded p-3">
        <div className="flex gap-2 mb-2">
          <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
            className="flex-1 bg-black/50 border border-gray-700 rounded px-2 py-1 text-xs text-white"
            data-testid="input-profile-name" />
          <Button size="sm" variant="outline" className="text-xs" data-testid="btn-save-profile"
            onClick={() => setSavedProfiles(s => [...s, { ...currentProfile, name: profileName }])}>
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
        <p className="text-amber-300 text-sm font-semibold mb-1">{currentProfile.name}</p>
        <p className="text-gray-400 text-xs italic">{getBehaviorDescription(currentProfile)}</p>
      </div>

      <div className="space-y-1.5">
        {([
          ['Retreat HP', currentProfile.retreatThreshold, '%'],
          ['Aggro Range', currentProfile.aggroRange, 'px'],
          ['Hero Priority', currentProfile.heroWeight, ''],
          ['Minion Priority', currentProfile.minionWeight, ''],
          ['Tower Priority', currentProfile.towerWeight, ''],
          ['Ability Weight', currentProfile.abilityScoreWeight, ''],
          ['Ult Threshold', currentProfile.ultimateThreshold, ''],
          ['Kite Enabled', currentProfile.kiteEnabled ? 'Yes' : 'No', ''],
          ['Push Aggression', currentProfile.pushAggression, ''],
          ['ATK Weight', currentProfile.classAtkWeight, ''],
          ['DEF Weight', currentProfile.classDefWeight, ''],
        ] as [string, any, string][]).map(([label, val, suffix]) => (
          <div key={label} className="flex justify-between text-xs bg-black/20 rounded px-2 py-1">
            <span className="text-gray-400">{label}</span>
            <span className="text-amber-400 font-mono">
              {typeof val === 'number' ? val.toFixed(2) : val}{suffix}
              {compareProfile && (() => {
                const key = label.toLowerCase().replace(/\s+/g, '') as keyof AIProfile;
                const cv = compareProfile[key];
                if (cv !== undefined && cv !== val) {
                  return <span className="text-red-400 ml-2">({typeof cv === 'number' ? (cv as number).toFixed(2) : String(cv)})</span>;
                }
                return null;
              })()}
            </span>
          </div>
        ))}
      </div>

      {compareProfile && (
        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setCompareProfile(null)}
          data-testid="btn-clear-compare">
          Clear Comparison
        </Button>
      )}

      {savedProfiles.length > 0 && (
        <>
          <SectionHeader title="Saved Profiles" />
          <div className="space-y-1">
            {savedProfiles.map((p, i) => (
              <div key={i} className="flex justify-between items-center bg-black/20 rounded px-2 py-1.5">
                <span className="text-xs text-gray-300">{p.name}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                    onClick={() => setCurrentProfile({ ...p })} data-testid={`btn-load-profile-${i}`}>Load</Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                    onClick={() => setCompareProfile({ ...p })} data-testid={`btn-compare-profile-${i}`}>Compare</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Button variant="outline" className="w-full text-xs" data-testid="btn-apply-profile"
        onClick={() => {
          const data = { hero: hero.name, profile: currentProfile };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Download className="w-3 h-3 mr-1" /> Apply to {hero.name}
      </Button>
    </div>
  );
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);
  const spriteEffectsRef = useRef<SpriteEffectSystem | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [activeTab, setActiveTab] = useState<TabId>("characters");
  const [selectedHeroId, setSelectedHeroId] = useState(0);
  const [race, setRace] = useState("Human");
  const [heroClass, setHeroClass] = useState("Warrior");
  const [animState, setAnimState] = useState("idle");
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [animTimer, setAnimTimer] = useState(0);
  const [facing, setFacing] = useState(0);
  const [showVFX, setShowVFX] = useState(true);

  const animTimerRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const animStateRef = useRef("idle");
  const raceRef = useRef("Human");
  const heroClassRef = useRef("Warrior");
  const facingRef = useRef(0);
  const showVFXRef = useRef(true);

  const hero = HEROES[selectedHeroId] || HEROES[0];

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { animStateRef.current = animState; }, [animState]);
  useEffect(() => { raceRef.current = race; }, [race]);
  useEffect(() => { heroClassRef.current = heroClass; }, [heroClass]);
  useEffect(() => { facingRef.current = facing; }, [facing]);
  useEffect(() => { showVFXRef.current = showVFX; }, [showVFX]);

  useEffect(() => {
    const h = HEROES[selectedHeroId];
    if (h) {
      setRace(h.race);
      setHeroClass(h.heroClass);
    }
  }, [selectedHeroId]);

  useEffect(() => {
    const match = HEROES.find(h => h.race === race && h.heroClass === heroClass);
    if (match) setSelectedHeroId(match.id);
  }, [race, heroClass]);

  const resetTimer = useCallback(() => {
    animTimerRef.current = 0;
    setAnimTimer(0);
  }, []);

  const stepFrame = useCallback(() => {
    setPlaying(false);
    animTimerRef.current += 1 / 60;
    setAnimTimer(animTimerRef.current);
  }, []);

  const stepBack = useCallback(() => {
    setPlaying(false);
    animTimerRef.current = Math.max(0, animTimerRef.current - 1 / 60);
    setAnimTimer(animTimerRef.current);
  }, []);

  const playEffect = useCallback((type: SpriteEffectType, scale: number, durationMs: number) => {
    if (!spriteEffectsRef.current) {
      spriteEffectsRef.current = new SpriteEffectSystem();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    spriteEffectsRef.current.playEffect(type, canvas.width / 2, canvas.height / 2 + 10, scale, durationMs);
  }, []);

  const renderFrame = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) { animFrameRef.current = requestAnimationFrame(renderFrame); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!voxelRef.current) voxelRef.current = new VoxelRenderer();
    if (!spriteEffectsRef.current) spriteEffectsRef.current = new SpriteEffectSystem();

    const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = timestamp;

    if (playingRef.current) {
      animTimerRef.current += dt * speedRef.current;
      setAnimTimer(animTimerRef.current);
    }

    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = 20;
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < canvas.width; gx += gridSize) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    }
    for (let gy = 0; gy < canvas.height; gy += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 20;

    ctx.save();
    ctx.beginPath();
    const shadowGrad = ctx.createRadialGradient(cx, cy + 25, 0, cx, cy + 25, 40);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.ellipse(cx, cy + 25, 40, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    const scale = 3.5;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const raceColor = RACE_COLORS[raceRef.current] || "#94a3b8";
    const classColor = CLASS_COLORS[heroClassRef.current] || "#ef4444";

    voxelRef.current.drawHeroVoxel(
      ctx, 0, 0, raceColor, classColor,
      heroClassRef.current, facingRef.current,
      animStateRef.current, animTimerRef.current,
      raceRef.current, hero.name
    );
    ctx.restore();

    spriteEffectsRef.current.update(dt);
    spriteEffectsRef.current.render(ctx);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px monospace";
    ctx.fillText(`${animStateRef.current}  t:${animTimerRef.current.toFixed(3)}  ${speedRef.current.toFixed(1)}x`, 8, canvas.height - 8);

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [hero.name]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [renderFrame]);

  return (
    <div className="h-screen flex bg-[#0a0a14] text-white overflow-hidden" data-testid="admin-page">
      <div className="w-14 bg-[#0d0d1a] border-r border-gray-800/50 flex flex-col items-center py-3 gap-1">
        <Button variant="ghost" size="sm" className="w-10 h-10 p-0 mb-3" data-testid="btn-back"
          onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Button>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} data-testid={`tab-${tab.id}`}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all
                ${activeTab === tab.id
                  ? 'bg-amber-900/40 text-amber-400 shadow-lg shadow-amber-900/20'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <div className="h-12 bg-[#0d0d1a] border-b border-gray-800/50 flex items-center px-4 gap-4">
            <h1 className="text-amber-400 font-bold text-sm tracking-wider uppercase">GRUDGE Admin</h1>
            <div className="flex-1" />
            <Select value={String(selectedHeroId)} onValueChange={v => setSelectedHeroId(Number(v))}>
              <SelectTrigger className="w-64 h-8 text-xs" data-testid="select-hero">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEROES.map(h => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} — {h.race} {h.heroClass}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 flex items-center justify-center bg-[#08080f] relative">
            <canvas ref={canvasRef} width={560} height={480}
              className="rounded-lg border border-gray-800/30"
              data-testid="preview-canvas" />
            <div className="absolute bottom-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-gray-400">
                {hero.race} {hero.heroClass}
              </div>
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-amber-400">
                {hero.name}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 bg-[#0d0d1a] border-l border-gray-800/50 flex flex-col">
          <div className="h-12 border-b border-gray-800/50 flex items-center px-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {activeTab === "characters" && (
              <CharactersTab hero={hero} race={race} heroClass={heroClass}
                setRace={setRace} setHeroClass={setHeroClass}
                facing={facing} setFacing={setFacing} />
            )}
            {activeTab === "animations" && (
              <AnimationsTab animState={animState} setAnimState={setAnimState}
                playing={playing} setPlaying={setPlaying}
                speed={speed} setSpeed={setSpeed} animTimer={animTimer}
                resetTimer={resetTimer} stepFrame={stepFrame} stepBack={stepBack}
                facing={facing} setFacing={setFacing}
                heroClass={heroClass} showVFX={showVFX} setShowVFX={setShowVFX} />
            )}
            {activeTab === "effects" && (
              <EffectsTab hero={hero} heroClass={heroClass} onPlayEffect={playEffect} />
            )}
            {activeTab === "weapons" && (
              <WeaponsTab heroClass={heroClass} />
            )}
            {activeTab === "ai-config" && (
              <AIConfigTab hero={hero} />
            )}
            {activeTab === "ai-generator" && (
              <AIGeneratorTab hero={hero} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

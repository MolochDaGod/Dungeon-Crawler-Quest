import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { VoxelRenderer } from "@/game/voxel";
import { SpriteEffectSystem, SpriteEffectType } from "@/game/sprite-effects";
import { sampleMotion, type MotionPrimitive, type Keyframe as MotionKeyframe, type BodyPartPose, type FullPose } from "@/game/voxel-motion";
import { HEROES, RACE_COLORS, CLASS_COLORS, CLASS_ABILITIES, ITEMS, HeroData } from "@/game/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Play, Pause, SkipForward, SkipBack, RotateCcw, Download,
  Swords, User, Sparkles, TreePine, Castle, Bug, Footprints,
  Copy, Eye, EyeOff, Zap, ChevronLeft, ChevronRight,
  Plus, Minus, Clock, Layers, Film
} from "lucide-react";

const RACES = ["Human", "Barbarian", "Dwarf", "Elf", "Orc", "Undead"];
const CLASSES = ["Warrior", "Worg", "Mage", "Ranger"];
const ANIM_STATES = [
  "idle", "walk", "attack", "combo_finisher", "ability",
  "dodge", "block", "dash_attack", "lunge_slash", "death",
];
const BODY_PARTS = ["leftLeg", "rightLeg", "leftArm", "rightArm", "torso", "head", "weapon"] as const;
const MINION_TYPES = ["melee", "ranged", "siege", "super"];
const MOB_TYPES = ["small", "medium", "buff"];
const TEAM_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"];

const SPRITE_EFFECT_TYPES: SpriteEffectType[] = [
  'mage_ability', 'mage_attack', 'frost', 'channel', 'magic_impact',
  'fire_ability', 'warrior_spin', 'shield', 'buff', 'melee_impact',
  'fire_attack', 'ultimate', 'dash', 'undead', 'charging',
  'holy', 'dark_magic', 'shadow', 'ice', 'healing'
];

type TabId = "heroes" | "minions" | "monsters" | "structures" | "effects" | "environment";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "heroes", label: "Heroes", icon: User },
  { id: "minions", label: "Minions", icon: Footprints },
  { id: "monsters", label: "Monsters", icon: Bug },
  { id: "structures", label: "Structures", icon: Castle },
  { id: "effects", label: "Effects", icon: Sparkles },
  { id: "environment", label: "Environment", icon: TreePine },
];

interface EditorState {
  race: string;
  heroClass: string;
  animState: string;
  facing: number;
  minionType: string;
  minionColor: string;
  mobType: string;
  towerTeamColor: string;
  towerTier: number;
  nexusTeamColor: string;
  treeSeed: number;
  rockSeed: number;
  effectType: SpriteEffectType;
  effectScale: number;
  effectDuration: number;
  structSubType: "tower" | "nexus";
  envSubType: "tree" | "rock";
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

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-20">{label}</span>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-700"
        data-testid={`color-${label.toLowerCase().replace(/\s+/g, '-')}`} />
      <span className="text-xs text-gray-500 font-mono">{value}</span>
    </div>
  );
}

const EASING_OPTIONS: MotionKeyframe['easing'][] = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'overshoot', 'bounce'];
const TIMELINE_BODY_PARTS = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'] as const;
const PART_LABELS: Record<string, string> = {
  leftLeg: 'L.Leg', rightLeg: 'R.Leg', leftArm: 'L.Arm', rightArm: 'R.Arm',
  torso: 'Torso', head: 'Head', weapon: 'Weapon'
};
const PART_COLORS: Record<string, string> = {
  leftLeg: '#3b82f6', rightLeg: '#6366f1', leftArm: '#22c55e', rightArm: '#10b981',
  torso: '#f59e0b', head: '#ef4444', weapon: '#a855f7'
};

interface TimelineState {
  enabled: boolean;
  name: string;
  duration: number;
  loop: boolean;
  startTime: number;
  endTime: number;
  keyframes: MotionKeyframe[];
  selectedKeyframeIdx: number;
  expandedPart: string | null;
}

function defaultTimelineState(): TimelineState {
  return {
    enabled: false,
    name: 'custom_anim',
    duration: 1.0,
    loop: true,
    startTime: 0,
    endTime: 1.0,
    keyframes: [
      { time: 0, pose: {}, easing: 'easeInOut' },
      { time: 1.0, pose: {}, easing: 'easeInOut' },
    ],
    selectedKeyframeIdx: 0,
    expandedPart: null,
  };
}

function KeyframeTimelineEditor({ timeline, setTimeline, animTimer, setAnimTimerDirect, playing, setPlaying }: {
  timeline: TimelineState;
  setTimeline: (t: TimelineState | ((prev: TimelineState) => TimelineState)) => void;
  animTimer: number;
  setAnimTimerDirect: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
}) {
  const kf = timeline.keyframes[timeline.selectedKeyframeIdx];
  const timelineBarRef = useRef<HTMLDivElement>(null);

  const addKeyframe = () => {
    const mid = timeline.duration / 2;
    let bestTime = mid;
    const sorted = [...timeline.keyframes].sort((a, b) => a.time - b.time);
    let maxGap = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].time - sorted[i].time;
      if (gap > maxGap) { maxGap = gap; bestTime = sorted[i].time + gap / 2; }
    }
    const newKf: MotionKeyframe = { time: parseFloat(bestTime.toFixed(3)), pose: {}, easing: 'easeInOut' };
    const newKeyframes = [...timeline.keyframes, newKf].sort((a, b) => a.time - b.time);
    const newIdx = newKeyframes.indexOf(newKf);
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes, selectedKeyframeIdx: newIdx }));
  };

  const removeKeyframe = () => {
    if (timeline.keyframes.length <= 2) return;
    const newKeyframes = timeline.keyframes.filter((_, i) => i !== timeline.selectedKeyframeIdx);
    setTimeline(prev => ({
      ...prev,
      keyframes: newKeyframes,
      selectedKeyframeIdx: Math.min(prev.selectedKeyframeIdx, newKeyframes.length - 1),
    }));
  };

  const updateKeyframeTime = (newTime: number) => {
    const clamped = Math.max(0, Math.min(timeline.duration, parseFloat(newTime.toFixed(3))));
    const newKeyframes = timeline.keyframes.map((k, i) => i === timeline.selectedKeyframeIdx ? { ...k, time: clamped } : k);
    newKeyframes.sort((a, b) => a.time - b.time);
    const newIdx = newKeyframes.findIndex(k => k.time === clamped);
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes, selectedKeyframeIdx: newIdx >= 0 ? newIdx : 0 }));
  };

  const updateKeyframeEasing = (easing: MotionKeyframe['easing']) => {
    const newKeyframes = timeline.keyframes.map((k, i) => i === timeline.selectedKeyframeIdx ? { ...k, easing } : k);
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes }));
  };

  const updateKeyframeGlow = (glow: number) => {
    const newKeyframes = timeline.keyframes.map((k, i) => i === timeline.selectedKeyframeIdx ? { ...k, glow } : k);
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes }));
  };

  const updatePartPose = (part: string, axis: 'ox' | 'oy' | 'oz', value: number) => {
    const rounded = Math.round(value);
    const newKeyframes = timeline.keyframes.map((k, i) => {
      if (i !== timeline.selectedKeyframeIdx) return k;
      const existingPart = k.pose[part as keyof typeof k.pose] || {};
      return {
        ...k,
        pose: {
          ...k.pose,
          [part]: { ...existingPart, [axis]: rounded },
        },
      };
    });
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes }));
  };

  const getPartValue = (part: string, axis: 'ox' | 'oy' | 'oz'): number => {
    if (!kf) return 0;
    const p = kf.pose[part as keyof typeof kf.pose];
    if (!p) return 0;
    return (p as any)[axis] ?? 0;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineBarRef.current) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * timeline.duration;
    setPlaying(false);
    setAnimTimerDirect(t);
  };

  const exportMotionPrimitive = (): MotionPrimitive => ({
    name: timeline.name,
    duration: timeline.duration,
    keyframes: timeline.keyframes,
    loop: timeline.loop,
  });

  const playbackPct = timeline.duration > 0 ? Math.min(1, (animTimer % timeline.duration) / timeline.duration) : 0;
  const startPct = timeline.duration > 0 ? timeline.startTime / timeline.duration : 0;
  const endPct = timeline.duration > 0 ? timeline.endTime / timeline.duration : 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionHeader title="Animation Timeline" />
        <Button size="sm" variant={timeline.enabled ? "default" : "outline"} data-testid="btn-toggle-timeline"
          className={`text-[10px] h-6 ${timeline.enabled ? 'bg-purple-700 hover:bg-purple-800' : ''}`}
          onClick={() => setTimeline(prev => ({ ...prev, enabled: !prev.enabled }))}>
          <Film className="w-3 h-3 mr-1" /> {timeline.enabled ? 'ON' : 'OFF'}
        </Button>
      </div>

      {timeline.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Name</label>
              <input type="text" value={timeline.name} data-testid="input-anim-name"
                onChange={e => setTimeline(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-xs text-white" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">Duration (s)</label>
              <input type="number" value={timeline.duration} min={0.1} max={10} step={0.05} data-testid="input-anim-duration"
                onChange={e => {
                  const d = parseFloat(e.target.value) || 0.1;
                  setTimeline(prev => ({ ...prev, duration: d, endTime: Math.min(prev.endTime, d) }));
                }}
                className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <LabeledSlider label="Start Time" value={timeline.startTime} min={0} max={timeline.duration} step={0.01}
              onChange={v => setTimeline(prev => ({ ...prev, startTime: Math.min(v, prev.endTime - 0.01) }))} suffix="s" />
            <LabeledSlider label="End Time" value={timeline.endTime} min={0} max={timeline.duration} step={0.01}
              onChange={v => setTimeline(prev => ({ ...prev, endTime: Math.max(v, prev.startTime + 0.01) }))} suffix="s" />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={timeline.loop} data-testid="check-loop"
                onChange={e => setTimeline(prev => ({ ...prev, loop: e.target.checked }))}
                className="rounded border-gray-700 bg-black/40" />
              Loop
            </label>
          </div>

          <div className="bg-black/30 rounded p-2 space-y-1.5">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>0s</span>
              <span className="text-amber-400 font-mono">{animTimer.toFixed(3)}s</span>
              <span>{timeline.duration.toFixed(2)}s</span>
            </div>
            <div ref={timelineBarRef} className="relative h-8 bg-gray-900 rounded cursor-pointer select-none" data-testid="timeline-bar"
              onClick={handleTimelineClick}>
              <div className="absolute inset-y-0 bg-purple-900/20 rounded"
                style={{ left: `${startPct * 100}%`, width: `${(endPct - startPct) * 100}%` }} />

              {timeline.keyframes.map((k, i) => {
                const pct = timeline.duration > 0 ? (k.time / timeline.duration) * 100 : 0;
                return (
                  <div key={i} data-testid={`keyframe-marker-${i}`}
                    className={`absolute top-0 bottom-0 w-0.5 cursor-pointer transition-colors ${
                      i === timeline.selectedKeyframeIdx ? 'bg-amber-400' : 'bg-purple-400/60 hover:bg-purple-300'
                    }`}
                    style={{ left: `${pct}%` }}
                    onClick={(e) => { e.stopPropagation(); setTimeline(prev => ({ ...prev, selectedKeyframeIdx: i })); }}>
                    <div className={`absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 ${
                      i === timeline.selectedKeyframeIdx
                        ? 'bg-amber-400 border-amber-300'
                        : 'bg-purple-500 border-purple-400'
                    }`} />
                    <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 font-mono whitespace-nowrap">
                      {k.time.toFixed(2)}
                    </div>
                  </div>
                );
              })}

              <div className="absolute top-0 bottom-0 w-0.5 bg-green-400 pointer-events-none"
                style={{ left: `${playbackPct * 100}%` }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-green-400" />
              </div>
            </div>
          </div>

          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7" onClick={addKeyframe} data-testid="btn-add-keyframe">
              <Plus className="w-3 h-3 mr-1" /> Add KF
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7" onClick={removeKeyframe} data-testid="btn-remove-keyframe"
              disabled={timeline.keyframes.length <= 2}>
              <Minus className="w-3 h-3 mr-1" /> Remove KF
            </Button>
          </div>

          {kf && (
            <div className="bg-black/30 rounded p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 font-bold uppercase">
                  Keyframe {timeline.selectedKeyframeIdx + 1} / {timeline.keyframes.length}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" data-testid="btn-prev-keyframe"
                    onClick={() => setTimeline(prev => ({ ...prev, selectedKeyframeIdx: Math.max(0, prev.selectedKeyframeIdx - 1) }))}
                    disabled={timeline.selectedKeyframeIdx === 0}>
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" data-testid="btn-next-keyframe"
                    onClick={() => setTimeline(prev => ({ ...prev, selectedKeyframeIdx: Math.min(prev.keyframes.length - 1, prev.selectedKeyframeIdx + 1) }))}
                    disabled={timeline.selectedKeyframeIdx >= timeline.keyframes.length - 1}>
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <LabeledSlider label="Time" value={kf.time} min={0} max={timeline.duration} step={0.01}
                onChange={updateKeyframeTime} suffix="s" />

              <div>
                <label className="text-[10px] text-gray-500 block mb-0.5">Easing</label>
                <Select value={kf.easing || 'easeInOut'} onValueChange={v => updateKeyframeEasing(v as MotionKeyframe['easing'])}>
                  <SelectTrigger className="h-7 text-xs" data-testid="select-easing"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EASING_OPTIONS.map(e => <SelectItem key={e} value={e!}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <LabeledSlider label="Weapon Glow" value={kf.glow ?? 0} min={0} max={1} step={0.05}
                onChange={updateKeyframeGlow} />

              <div className="space-y-1 mt-1">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Body Part Poses</span>
                {TIMELINE_BODY_PARTS.map(part => {
                  const expanded = timeline.expandedPart === part;
                  return (
                    <div key={part} className="bg-black/20 rounded">
                      <button className="w-full flex items-center justify-between px-2 py-1 text-xs" data-testid={`btn-expand-${part}`}
                        onClick={() => setTimeline(prev => ({ ...prev, expandedPart: expanded ? null : part }))}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PART_COLORS[part] }} />
                          <span className="text-gray-300">{PART_LABELS[part]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-600 font-mono">
                            {getPartValue(part, 'ox')},{getPartValue(part, 'oy')},{getPartValue(part, 'oz')}
                          </span>
                          <ChevronRight className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-2 pb-2 space-y-1">
                          <LabeledSlider label="ox (left-right)" value={getPartValue(part, 'ox')} min={-8} max={8} step={1}
                            onChange={v => updatePartPose(part, 'ox', v)} />
                          <LabeledSlider label="oy (fwd-back)" value={getPartValue(part, 'oy')} min={-8} max={8} step={1}
                            onChange={v => updatePartPose(part, 'oy', v)} />
                          <LabeledSlider label="oz (height)" value={getPartValue(part, 'oz')} min={-8} max={8} step={1}
                            onChange={v => updatePartPose(part, 'oz', v)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <Button variant="outline" className="flex-1 text-[10px] h-7" data-testid="btn-export-motion"
              onClick={() => {
                const data = exportMotionPrimitive();
                navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              }}>
              <Copy className="w-3 h-3 mr-1" /> Copy JSON
            </Button>
            <Button variant="outline" className="flex-1 text-[10px] h-7" data-testid="btn-download-motion"
              onClick={() => {
                const data = exportMotionPrimitive();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${timeline.name}.json`; a.click();
                URL.revokeObjectURL(url);
              }}>
              <Download className="w-3 h-3 mr-1" /> Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroesPanel({ state, setState, playing, setPlaying, speed, setSpeed,
  animTimer, resetTimer, stepFrame, stepBack, timeline, setTimeline, setAnimTimerDirect }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void;
  animTimer: number; resetTimer: () => void;
  stepFrame: () => void; stepBack: () => void;
  timeline: TimelineState; setTimeline: (t: TimelineState | ((prev: TimelineState) => TimelineState)) => void;
  setAnimTimerDirect: (t: number) => void;
}) {
  const hero = HEROES.find(h => h.race === state.race && h.heroClass === state.heroClass) || HEROES[0];

  return (
    <div className="space-y-4">
      <SectionHeader title="Character" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Race</label>
          <Select value={state.race} onValueChange={v => setState({ race: v })}>
            <SelectTrigger data-testid="select-hero-race"><SelectValue /></SelectTrigger>
            <SelectContent>{RACES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Class</label>
          <Select value={state.heroClass} onValueChange={v => setState({ heroClass: v })}>
            <SelectTrigger data-testid="select-hero-class"><SelectValue /></SelectTrigger>
            <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-black/30 rounded p-3 space-y-1">
        <p className="text-amber-300 font-bold text-sm">{hero.name}</p>
        <p className="text-gray-400 text-xs italic">{hero.title}</p>
        <div className="flex gap-2 mt-2">
          <span className="text-xs px-2 py-0.5 rounded bg-purple-900/40 text-purple-300">{hero.race}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-300">{hero.heroClass}</span>
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

      {!timeline.enabled && (
        <>
          <SectionHeader title="Animation" />
          <div className="grid grid-cols-2 gap-2">
            {ANIM_STATES.map(s => (
              <Button key={s} size="sm" data-testid={`btn-anim-${s}`}
                variant={state.animState === s ? "default" : "outline"}
                className={`text-xs ${state.animState === s ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                onClick={() => { setState({ animState: s }); resetTimer(); }}>
                {s.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </>
      )}

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
      <LabeledSlider label="Facing" value={Math.round(state.facing * 180 / Math.PI)} min={0} max={360} step={1}
        onChange={v => setState({ facing: v * Math.PI / 180 })} suffix="deg" />

      <div className="bg-black/30 rounded p-2">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Timer</span>
          <span className="text-amber-400 font-mono">{animTimer.toFixed(3)}s</span>
        </div>
        <div className="h-2 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-amber-500 rounded transition-all" style={{ width: `${Math.min(100, (animTimer % 2) * 50)}%` }} />
        </div>
      </div>

      <KeyframeTimelineEditor timeline={timeline} setTimeline={setTimeline} animTimer={animTimer}
        setAnimTimerDirect={setAnimTimerDirect} playing={playing} setPlaying={setPlaying} />

      <SectionHeader title="Abilities" />
      <div className="space-y-2">
        {(CLASS_ABILITIES[state.heroClass] || []).map((ab, i) => (
          <div key={i} className="bg-black/20 rounded p-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-amber-400 font-bold text-xs mr-1">[{ab.key}]</span>
                <span className="text-white text-xs font-semibold">{ab.name}</span>
              </div>
              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-900/40 text-purple-300">{ab.type}</span>
            </div>
            <p className="text-gray-500 text-[10px] mt-1">{ab.description}</p>
            <div className="grid grid-cols-4 gap-1 mt-1 text-[10px]">
              <div className="text-center"><span className="text-gray-500">DMG</span> <span className="text-red-400">{ab.damage}</span></div>
              <div className="text-center"><span className="text-gray-500">CD</span> <span className="text-blue-400">{ab.cooldown}s</span></div>
              <div className="text-center"><span className="text-gray-500">MP</span> <span className="text-cyan-400">{ab.manaCost}</span></div>
              <div className="text-center"><span className="text-gray-500">RNG</span> <span className="text-green-400">{ab.range}</span></div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-hero"
        onClick={() => {
          const data = { hero: hero.name, race: state.race, heroClass: state.heroClass, stats: { hp: hero.hp, atk: hero.atk, def: hero.def, spd: hero.spd, rng: hero.rng, mp: hero.mp } };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Hero Data
      </Button>
    </div>
  );
}

function MinionsPanel({ state, setState, playing, setPlaying, speed, setSpeed,
  animTimer, resetTimer }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void;
  animTimer: number; resetTimer: () => void;
}) {
  const PRESET_COLORS: { label: string; color: string }[] = [
    { label: "Blue (Team 1)", color: "#3b82f6" },
    { label: "Red (Team 2)", color: "#ef4444" },
    { label: "Green", color: "#22c55e" },
    { label: "Gold", color: "#f59e0b" },
    { label: "Purple", color: "#8b5cf6" },
    { label: "Teal", color: "#14b8a6" },
  ];

  const minionStats: Record<string, { hp: number; atk: number; def: number; spd: number; gold: number; xp: number }> = {
    melee: { hp: 300, atk: 20, def: 5, spd: 1.8, gold: 20, xp: 60 },
    ranged: { hp: 250, atk: 25, def: 3, spd: 1.6, gold: 15, xp: 50 },
    siege: { hp: 600, atk: 35, def: 8, spd: 1.2, gold: 40, xp: 90 },
    super: { hp: 800, atk: 45, def: 12, spd: 2.0, gold: 60, xp: 120 },
  };

  const stats = minionStats[state.minionType] || minionStats.melee;

  return (
    <div className="space-y-4">
      <SectionHeader title="Minion Type" />
      <div className="grid grid-cols-2 gap-2">
        {MINION_TYPES.map(type => (
          <Button key={type} size="sm" data-testid={`btn-minion-${type}`}
            variant={state.minionType === type ? "default" : "outline"}
            className={`text-xs capitalize ${state.minionType === type ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={() => { setState({ minionType: type }); resetTimer(); }}>
            {type}
          </Button>
        ))}
      </div>

      <SectionHeader title="Team Color" />
      <ColorPicker label="Color" value={state.minionColor} onChange={v => setState({ minionColor: v })} />
      <div className="grid grid-cols-3 gap-2 mt-2">
        {PRESET_COLORS.map(p => (
          <button key={p.color} data-testid={`btn-minion-color-${p.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`text-[10px] rounded px-2 py-1.5 border transition-all ${
              state.minionColor === p.color
                ? 'border-amber-500 bg-amber-900/30 text-amber-300'
                : 'border-gray-700 bg-black/30 text-gray-400 hover:border-gray-500'}`}
            onClick={() => setState({ minionColor: p.color })}>
            <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: p.color }} />
            {p.label}
          </button>
        ))}
      </div>

      <SectionHeader title="Stats" />
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} className="bg-black/20 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase">{key}</div>
            <div className="text-amber-300 font-mono text-sm">{val}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Description" />
      <div className="bg-black/20 rounded p-3 text-xs text-gray-400 space-y-1">
        {state.minionType === 'melee' && <p>Front-line melee minion. Tough enough to absorb tower shots. Spawns in groups of 3 per wave.</p>}
        {state.minionType === 'ranged' && <p>Ranged minion that attacks from behind melee line. Deals moderate damage but is fragile.</p>}
        {state.minionType === 'siege' && <p>Heavy siege minion. Deals bonus damage to structures. Spawns every 3rd wave.</p>}
        {state.minionType === 'super' && <p>Super minion spawned when an inhibitor falls. Very high stats and gold bounty armor.</p>}
      </div>

      <SectionHeader title="Playback" />
      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)} data-testid="btn-minion-play-pause"
          className={playing ? 'bg-green-900/40 border-green-700' : ''}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={resetTimer} data-testid="btn-minion-reset">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
      <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
      <LabeledSlider label="Facing" value={Math.round(state.facing * 180 / Math.PI)} min={0} max={360} step={1}
        onChange={v => setState({ facing: v * Math.PI / 180 })} suffix="deg" />

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-minion"
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify({ minionType: state.minionType, color: state.minionColor, stats }, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Minion Data
      </Button>
    </div>
  );
}

function MonstersPanel({ state, setState, playing, setPlaying, speed, setSpeed,
  animTimer, resetTimer }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void;
  animTimer: number; resetTimer: () => void;
}) {
  const mobStats: Record<string, { hp: number; atk: number; def: number; gold: number; xp: number; leash: number }> = {
    small: { hp: 200, atk: 15, def: 2, gold: 15, xp: 40, leash: 300 },
    medium: { hp: 500, atk: 30, def: 6, gold: 30, xp: 80, leash: 400 },
    buff: { hp: 1200, atk: 50, def: 10, gold: 80, xp: 200, leash: 500 },
  };

  const stats = mobStats[state.mobType] || mobStats.small;

  const mobDescriptions: Record<string, { name: string; desc: string; color: string }> = {
    small: { name: "Crawler", desc: "Small jungle creature. Easy to kill solo. Found in pairs at small camps.", color: "#65a30d" },
    medium: { name: "Wolf", desc: "Medium jungle beast. Moderate difficulty. Grants decent gold and XP. Found in groups of 2-3.", color: "#3b82f6" },
    buff: { name: "Ancient Beast", desc: "Powerful buff monster. Grants a team-wide buff when slain. Purple aura with horns. Respawns every 5 minutes.", color: "#6b21a8" },
  };

  const info = mobDescriptions[state.mobType] || mobDescriptions.small;

  return (
    <div className="space-y-4">
      <SectionHeader title="Monster Type" />
      <div className="grid grid-cols-3 gap-2">
        {MOB_TYPES.map(type => (
          <Button key={type} size="sm" data-testid={`btn-mob-${type}`}
            variant={state.mobType === type ? "default" : "outline"}
            className={`text-xs capitalize ${state.mobType === type ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={() => { setState({ mobType: type }); resetTimer(); }}>
            {type}
          </Button>
        ))}
      </div>

      <div className="bg-black/30 rounded p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} />
          <p className="text-amber-300 font-bold text-sm">{info.name}</p>
        </div>
        <p className="text-gray-400 text-xs">{info.desc}</p>
      </div>

      <SectionHeader title="Stats" />
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} className="bg-black/20 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase">{key}</div>
            <div className="text-amber-300 font-mono text-sm">{val}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Behavior" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Leash Range</span><span className="text-amber-400">{stats.leash}px</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Aggro Type</span><span className="text-red-400">Proximity</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Returns Home</span><span className="text-green-400">Yes</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Respawn Timer</span><span className="text-blue-400">{state.mobType === 'buff' ? '300s' : state.mobType === 'medium' ? '120s' : '60s'}</span></div>
      </div>

      <SectionHeader title="Playback" />
      <div className="flex gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)} data-testid="btn-mob-play-pause"
          className={playing ? 'bg-green-900/40 border-green-700' : ''}>
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button size="sm" variant="outline" onClick={resetTimer} data-testid="btn-mob-reset">
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
      <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
      <LabeledSlider label="Facing" value={Math.round(state.facing * 180 / Math.PI)} min={0} max={360} step={1}
        onChange={v => setState({ facing: v * Math.PI / 180 })} suffix="deg" />

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-mob"
        onClick={() => {
          navigator.clipboard.writeText(JSON.stringify({ mobType: state.mobType, name: info.name, stats }, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Monster Data
      </Button>
    </div>
  );
}

function StructuresPanel({ state, setState }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
}) {
  const structType = state.structSubType;
  const setStructType = (v: "tower" | "nexus") => setState({ structSubType: v });

  const towerStats: Record<number, { hp: number; atk: number; rng: number }> = {
    0: { hp: 2000, atk: 120, rng: 700 },
    1: { hp: 2500, atk: 150, rng: 700 },
    2: { hp: 3000, atk: 180, rng: 700 },
  };

  const stats = structType === "tower" ? (towerStats[state.towerTier] || towerStats[0]) : { hp: 5000, atk: 0, rng: 0 };

  return (
    <div className="space-y-4">
      <SectionHeader title="Structure Type" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" data-testid="btn-struct-tower"
          variant={structType === "tower" ? "default" : "outline"}
          className={`text-xs ${structType === "tower" ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          onClick={() => setStructType("tower")}>
          Tower
        </Button>
        <Button size="sm" data-testid="btn-struct-nexus"
          variant={structType === "nexus" ? "default" : "outline"}
          className={`text-xs ${structType === "nexus" ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          onClick={() => setStructType("nexus")}>
          Nexus
        </Button>
      </div>

      {structType === "tower" && (
        <>
          <SectionHeader title="Tower Tier" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map(tier => (
              <Button key={tier} size="sm" data-testid={`btn-tower-tier-${tier}`}
                variant={state.towerTier === tier ? "default" : "outline"}
                className={`text-xs ${state.towerTier === tier ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                onClick={() => setState({ towerTier: tier })}>
                Tier {tier + 1}
              </Button>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Team Color" />
      <ColorPicker label="Team" value={structType === "tower" ? state.towerTeamColor : state.nexusTeamColor}
        onChange={v => setState(structType === "tower" ? { towerTeamColor: v } : { nexusTeamColor: v })} />
      <div className="grid grid-cols-5 gap-2 mt-2">
        {TEAM_COLORS.map(c => (
          <button key={c} data-testid={`btn-struct-color-${c.slice(1)}`}
            className={`h-8 rounded border transition-all ${
              (structType === "tower" ? state.towerTeamColor : state.nexusTeamColor) === c
                ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-gray-700 hover:border-gray-500'}`}
            style={{ backgroundColor: c }}
            onClick={() => setState(structType === "tower" ? { towerTeamColor: c } : { nexusTeamColor: c })} />
        ))}
      </div>

      <SectionHeader title="Stats" />
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} className="bg-black/20 rounded p-2 text-center">
            <div className="text-[10px] text-gray-500 uppercase">{key}</div>
            <div className="text-amber-300 font-mono text-sm">{val}</div>
          </div>
        ))}
      </div>

      <SectionHeader title="Properties" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        {structType === "tower" ? (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-amber-400">Tower T{state.towerTier + 1}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">True Sight</span><span className="text-green-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Targets Heroes</span><span className="text-red-400">When minion-attacking</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Ramp Damage</span><span className="text-orange-400">+25% per hit</span></div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-amber-400">Nexus</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Invulnerable</span><span className="text-red-400">Until towers fall</span></div>
            <div className="flex justify-between"><span className="text-gray-500">HP Regen</span><span className="text-green-400">5/s</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Game Over</span><span className="text-purple-400">When destroyed</span></div>
          </>
        )}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-structure"
        onClick={() => {
          const data = structType === "tower"
            ? { type: "tower", tier: state.towerTier, teamColor: state.towerTeamColor, stats }
            : { type: "nexus", teamColor: state.nexusTeamColor, stats };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Structure Data
      </Button>
    </div>
  );
}

function EffectsPanel({ state, setState, onPlayEffect }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  onPlayEffect: (type: SpriteEffectType, scale: number, durationMs: number) => void;
}) {
  const effectInfo: Record<string, { label: string; category: string }> = {
    mage_ability: { label: "Magic Spell", category: "Magic" },
    mage_attack: { label: "Magic Bolt", category: "Magic" },
    frost: { label: "Blue Fire", category: "Elemental" },
    channel: { label: "Casting Circle", category: "Magic" },
    magic_impact: { label: "Magic Hit", category: "Impact" },
    fire_ability: { label: "Flame Lash", category: "Elemental" },
    warrior_spin: { label: "Fire Spin", category: "Physical" },
    shield: { label: "Protection Circle", category: "Defensive" },
    buff: { label: "Bright Fire", category: "Buff" },
    melee_impact: { label: "Weapon Hit", category: "Impact" },
    fire_attack: { label: "Fire Blast", category: "Elemental" },
    ultimate: { label: "Nebula", category: "Ultimate" },
    dash: { label: "Vortex", category: "Movement" },
    undead: { label: "Phantom", category: "Dark" },
    charging: { label: "Loading", category: "Utility" },
    holy: { label: "Sunburn", category: "Light" },
    dark_magic: { label: "Fel Spell", category: "Dark" },
    shadow: { label: "Midnight", category: "Dark" },
    ice: { label: "Freezing", category: "Elemental" },
    healing: { label: "Magic Bubbles", category: "Healing" },
  };

  const categories = Array.from(new Set(Object.values(effectInfo).map(e => e.category)));

  return (
    <div className="space-y-4">
      <SectionHeader title="Effect Type" />
      <Select value={state.effectType} onValueChange={v => setState({ effectType: v as SpriteEffectType })}>
        <SelectTrigger data-testid="select-effect-type"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SPRITE_EFFECT_TYPES.map(e => (
            <SelectItem key={e} value={e}>
              {effectInfo[e]?.label || e} ({effectInfo[e]?.category})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SectionHeader title="By Category" />
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[10px] text-gray-500 uppercase mb-1">{cat}</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {SPRITE_EFFECT_TYPES.filter(e => effectInfo[e]?.category === cat).map(e => (
              <Button key={e} size="sm" data-testid={`btn-effect-${e}`}
                variant={state.effectType === e ? "default" : "outline"}
                className={`text-[10px] h-6 px-2 ${state.effectType === e ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                onClick={() => setState({ effectType: e })}>
                {effectInfo[e]?.label || e}
              </Button>
            ))}
          </div>
        </div>
      ))}

      <SectionHeader title="Settings" />
      <LabeledSlider label="Scale" value={state.effectScale} min={0.5} max={4.0} step={0.1} onChange={v => setState({ effectScale: v })} suffix="x" />
      <LabeledSlider label="Duration" value={state.effectDuration} min={200} max={3000} step={50} onChange={v => setState({ effectDuration: v })} suffix="ms" />

      <Button className="w-full bg-purple-700 hover:bg-purple-600 text-xs" data-testid="btn-play-effect"
        onClick={() => onPlayEffect(state.effectType, state.effectScale, state.effectDuration)}>
        <Sparkles className="w-3 h-3 mr-1" /> Play Effect
      </Button>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-play-all-effects"
        onClick={() => {
          SPRITE_EFFECT_TYPES.forEach((e, i) => {
            setTimeout(() => onPlayEffect(e, state.effectScale, state.effectDuration), i * 400);
          });
        }}>
        <Zap className="w-3 h-3 mr-1" /> Play All Effects (Sequence)
      </Button>

      <SectionHeader title="Current Effect Info" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="text-amber-400">{effectInfo[state.effectType]?.label}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="text-purple-400">{effectInfo[state.effectType]?.category}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Scale</span><span className="text-green-400">{state.effectScale}x</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Duration</span><span className="text-blue-400">{state.effectDuration}ms</span></div>
      </div>
    </div>
  );
}

function EnvironmentPanel({ state, setState }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
}) {
  const envType = state.envSubType;
  const setEnvType = (v: "tree" | "rock") => setState({ envSubType: v });

  return (
    <div className="space-y-4">
      <SectionHeader title="Environment Type" />
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" data-testid="btn-env-tree"
          variant={envType === "tree" ? "default" : "outline"}
          className={`text-xs ${envType === "tree" ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          onClick={() => setEnvType("tree")}>
          <TreePine className="w-3 h-3 mr-1" /> Tree
        </Button>
        <Button size="sm" data-testid="btn-env-rock"
          variant={envType === "rock" ? "default" : "outline"}
          className={`text-xs ${envType === "rock" ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
          onClick={() => setEnvType("rock")}>
          Rock
        </Button>
      </div>

      <SectionHeader title="Variation" />
      {envType === "tree" ? (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" data-testid="btn-tree-prev"
              onClick={() => setState({ treeSeed: Math.max(0, state.treeSeed - 1) })}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center">
              <span className="text-amber-400 font-mono text-lg">{state.treeSeed}</span>
              <p className="text-gray-500 text-[10px]">Seed Variation</p>
            </div>
            <Button size="sm" variant="outline" data-testid="btn-tree-next"
              onClick={() => setState({ treeSeed: state.treeSeed + 1 })}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[0, 1, 2, 3, 4, 5].map(seed => (
              <Button key={seed} size="sm" data-testid={`btn-tree-seed-${seed}`}
                variant={state.treeSeed === seed ? "default" : "outline"}
                className={`text-xs ${state.treeSeed === seed ? 'bg-green-700 hover:bg-green-600' : ''}`}
                onClick={() => setState({ treeSeed: seed })}>
                Tree {seed + 1}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" data-testid="btn-rock-prev"
              onClick={() => setState({ rockSeed: Math.max(0, state.rockSeed - 1) })}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center">
              <span className="text-amber-400 font-mono text-lg">{state.rockSeed}</span>
              <p className="text-gray-500 text-[10px]">Seed Variation</p>
            </div>
            <Button size="sm" variant="outline" data-testid="btn-rock-next"
              onClick={() => setState({ rockSeed: state.rockSeed + 1 })}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[0, 1, 2, 3].map(seed => (
              <Button key={seed} size="sm" data-testid={`btn-rock-seed-${seed}`}
                variant={state.rockSeed === seed ? "default" : "outline"}
                className={`text-xs ${state.rockSeed === seed ? 'bg-gray-600 hover:bg-gray-500' : ''}`}
                onClick={() => setState({ rockSeed: seed })}>
                Rock {seed + 1}
              </Button>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Properties" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        {envType === "tree" ? (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-green-400">Tree</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Variation</span><span className="text-amber-400">Seed {state.treeSeed}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Blocks Vision</span><span className="text-red-400">Yes (Fog of War)</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destructible</span><span className="text-gray-400">No</span></div>
          </>
        ) : (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-300">Rock</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Variation</span><span className="text-amber-400">Seed {state.rockSeed}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Collision</span><span className="text-red-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Terrain</span><span className="text-blue-400">Jungle / River</span></div>
          </>
        )}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-env"
        onClick={() => {
          const data = envType === "tree"
            ? { type: "tree", seed: state.treeSeed }
            : { type: "rock", seed: state.rockSeed };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Data
      </Button>
    </div>
  );
}

export default function EntityEditorPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);
  const spriteEffectsRef = useRef<SpriteEffectSystem | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [activeTab, setActiveTab] = useState<TabId>("heroes");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [animTimer, setAnimTimer] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeline, setTimeline] = useState<TimelineState>(defaultTimelineState);
  const timelineRef = useRef<TimelineState>(defaultTimelineState());

  const [state, setStateRaw] = useState<EditorState>({
    race: "Human",
    heroClass: "Warrior",
    animState: "idle",
    facing: 0,
    minionType: "melee",
    minionColor: "#3b82f6",
    mobType: "small",
    towerTeamColor: "#3b82f6",
    towerTier: 0,
    nexusTeamColor: "#3b82f6",
    treeSeed: 0,
    rockSeed: 0,
    effectType: "melee_impact",
    effectScale: 1.5,
    effectDuration: 800,
    structSubType: "tower",
    envSubType: "tree",
  });

  const setState = useCallback((partial: Partial<EditorState>) => {
    setStateRaw(prev => ({ ...prev, ...partial }));
  }, []);

  const animTimerRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const stateRef = useRef(state);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { timelineRef.current = timeline; }, [timeline]);

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

  const setAnimTimerDirect = useCallback((t: number) => {
    animTimerRef.current = t;
    setAnimTimer(t);
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
      const tl = timelineRef.current;
      animTimerRef.current += dt * speedRef.current;
      if (tl.enabled) {
        const range = tl.endTime - tl.startTime;
        if (animTimerRef.current > tl.endTime) {
          if (tl.loop && range > 0) {
            animTimerRef.current = tl.startTime + ((animTimerRef.current - tl.startTime) % range);
          } else {
            animTimerRef.current = tl.endTime;
          }
        }
        if (animTimerRef.current < tl.startTime) {
          animTimerRef.current = tl.startTime;
        }
      }
      setAnimTimer(animTimerRef.current);
    }

    const s = stateRef.current;
    const t = animTimerRef.current;

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
    const vr = voxelRef.current;

    ctx.save();
    ctx.beginPath();
    const shadowGrad = ctx.createRadialGradient(cx, cy + 25, 0, cx, cy + 25, 50);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.ellipse(cx, cy + 25, 50, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (activeTab === "heroes") {
      const hero = HEROES.find(h => h.race === s.race && h.heroClass === s.heroClass) || HEROES[0];
      ctx.save();
      const scale = 3.5;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      const tl = timelineRef.current;
      if (tl.enabled) {
        const motion: MotionPrimitive = { name: tl.name, duration: tl.duration, keyframes: tl.keyframes, loop: tl.loop };
        const pose = sampleMotion(motion, t);
        vr.drawHeroVoxelCustomPose(ctx, 0, 0, s.race, s.heroClass, s.facing, pose, hero.name);
      } else {
        const raceColor = RACE_COLORS[s.race] || "#94a3b8";
        const classColor = CLASS_COLORS[s.heroClass] || "#ef4444";
        vr.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, s.heroClass, s.facing, s.animState, t, s.race, hero.name);
      }
      ctx.restore();
    } else if (activeTab === "minions") {
      ctx.save();
      const scale = 4.0;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      vr.drawMinionVoxel(ctx, 0, 0, s.minionColor, 1, s.facing, t, s.minionType);
      ctx.restore();
    } else if (activeTab === "monsters") {
      ctx.save();
      const scale = s.mobType === 'buff' ? 3.5 : s.mobType === 'medium' ? 4.0 : 5.0;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      vr.drawJungleMobVoxel(ctx, 0, 0, s.mobType, s.facing, t);
      ctx.restore();
    } else if (activeTab === "structures") {
      ctx.save();
      const scale = 2.5;
      ctx.translate(cx, cy + 30);
      ctx.scale(scale, scale);
      if (s.structSubType === "nexus") {
        vr.drawNexusVoxel(ctx, 0, 0, s.nexusTeamColor);
      } else {
        vr.drawTowerVoxel(ctx, 0, 0, s.towerTeamColor, s.towerTier);
      }
      ctx.restore();
    } else if (activeTab === "environment") {
      ctx.save();
      const scale = 3.0;
      ctx.translate(cx, cy + 20);
      ctx.scale(scale, scale);
      if (s.envSubType === "rock") {
        vr.drawRockVoxel(ctx, 0, 0, s.rockSeed);
      } else {
        vr.drawTreeVoxel(ctx, 0, 0, s.treeSeed);
      }
      ctx.restore();
    }

    spriteEffectsRef.current.update(dt);
    spriteEffectsRef.current.render(ctx);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px monospace";
    const tlActive = timelineRef.current.enabled;
    const label = activeTab === "heroes" ? `${s.race} ${s.heroClass} | ${tlActive ? 'custom' : s.animState}`
      : activeTab === "minions" ? `Minion: ${s.minionType}`
      : activeTab === "monsters" ? `Monster: ${s.mobType}`
      : activeTab === "structures" ? `Structure`
      : activeTab === "effects" ? `Effect: ${s.effectType}`
      : `Environment`;
    ctx.fillText(`${label}  t:${t.toFixed(3)}  ${speedRef.current.toFixed(1)}x`, 8, canvas.height - 8);

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [activeTab]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [renderFrame]);

  return (
    <div className="h-screen flex bg-[#0a0a14] text-white overflow-hidden" data-testid="entity-editor-page">
      <div className="w-14 bg-[#0d0d1a] border-r border-gray-800/50 flex flex-col items-center py-3 gap-1">
        <Button variant="ghost" size="sm" className="w-10 h-10 p-0 mb-3" data-testid="btn-editor-back"
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
            <h1 className="text-amber-400 font-bold text-sm tracking-wider uppercase" data-testid="text-editor-title">
              GRUDGE Entity Editor
            </h1>
            <div className="flex gap-1 ml-4">
              {TABS.map(tab => (
                <button key={tab.id} data-testid={`tab-bar-${tab.id}`}
                  className={`px-3 py-1.5 rounded text-xs transition-all ${
                    activeTab === tab.id
                      ? 'bg-amber-900/40 text-amber-400 border border-amber-700/50'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'}`}
                  onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {activeTab === "heroes" && (
              <Select value={`${state.race}-${state.heroClass}`} onValueChange={v => {
                const [r, c] = v.split('-');
                setState({ race: r, heroClass: c });
              }}>
                <SelectTrigger className="w-56 h-8 text-xs" data-testid="select-hero-quick">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEROES.map(h => (
                    <SelectItem key={h.id} value={`${h.race}-${h.heroClass}`}>
                      {h.name} — {h.race} {h.heroClass}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center bg-[#08080f] relative">
            <canvas ref={canvasRef} width={640} height={520}
              className="rounded-lg border border-gray-800/30"
              data-testid="editor-preview-canvas" />
            <div className="absolute bottom-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-gray-400" data-testid="text-entity-label">
                {activeTab === "heroes" ? `${state.race} ${state.heroClass}` :
                 activeTab === "minions" ? `${state.minionType} minion` :
                 activeTab === "monsters" ? `${state.mobType} mob` :
                 activeTab === "structures" ? `Structure` :
                 activeTab === "effects" ? state.effectType :
                 `Environment`}
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-amber-400 font-mono" data-testid="text-timer-display">
                t:{animTimer.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        <button
          className="w-5 bg-[#0d0d1a] border-l border-gray-800/50 flex items-center justify-center hover:bg-gray-800/50 transition-colors shrink-0 cursor-pointer"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          data-testid="btn-collapse-sidebar"
          title={sidebarCollapsed ? 'Show panel' : 'Hide panel'}
        >
          {sidebarCollapsed ? <ChevronLeft className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
        </button>

        <div className={`${sidebarCollapsed ? 'w-0' : 'w-80'} bg-[#0d0d1a] border-l border-gray-800/50 flex flex-col transition-all overflow-hidden`}>
          <div className="h-12 border-b border-gray-800/50 flex items-center px-4 shrink-0">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider" data-testid="text-panel-title">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {activeTab === "heroes" && (
              <HeroesPanel state={state} setState={setState} playing={playing} setPlaying={setPlaying}
                speed={speed} setSpeed={setSpeed} animTimer={animTimer} resetTimer={resetTimer}
                stepFrame={stepFrame} stepBack={stepBack} timeline={timeline} setTimeline={setTimeline}
                setAnimTimerDirect={setAnimTimerDirect} />
            )}
            {activeTab === "minions" && (
              <MinionsPanel state={state} setState={setState} playing={playing} setPlaying={setPlaying}
                speed={speed} setSpeed={setSpeed} animTimer={animTimer} resetTimer={resetTimer} />
            )}
            {activeTab === "monsters" && (
              <MonstersPanel state={state} setState={setState} playing={playing} setPlaying={setPlaying}
                speed={speed} setSpeed={setSpeed} animTimer={animTimer} resetTimer={resetTimer} />
            )}
            {activeTab === "structures" && (
              <StructuresPanel state={state} setState={setState} />
            )}
            {activeTab === "effects" && (
              <EffectsPanel state={state} setState={setState} onPlayEffect={playEffect} />
            )}
            {activeTab === "environment" && (
              <EnvironmentPanel state={state} setState={setState} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
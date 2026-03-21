import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { VoxelRenderer } from "@/game/voxel";
import { SpriteEffectSystem, SpriteEffectType } from "@/game/sprite-effects";
import { EffectPool, EffectType } from "@/game/effect-pool";
import { sampleMotion, generateSmoothedAnimation, BODY_PART_CENTERS, type MotionPrimitive, type Keyframe as MotionKeyframe, type BodyPartPose, type FullPose } from "@/game/voxel-motion";
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
  Plus, Minus, Clock, Layers, Film, Move, RotateCw, Maximize2,
  Camera, Wand2, Mountain, Bird
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
  'holy', 'dark_magic', 'shadow', 'ice', 'healing',
  // Magic-sprites VFX pack
  'lightning', 'lightning_bolt', 'midas_touch', 'sun_strike', 'explosion',
  'spikes', 'fire_wall', 'shield_spell', 'black_hole', 'fire_ball',
];

const CANVAS_EFFECT_TYPES: EffectType[] = [
  'cast_circle', 'impact_ring', 'aoe_blast', 'skillshot_trail',
  'cone_sweep', 'dash_trail', 'melee_slash', 'melee_lunge',
  'heavy_slash', 'enemy_slash', 'enemy_aoe_telegraph', 'enemy_aoe_blast',
];

type TabId = "heroes" | "minions" | "monsters" | "structures" | "effects" | "environment" | "animals" | "glb_effects" | "map_objects" | "characters" | "tiles";
type GizmoMode = "move" | "rotate" | "scale";
type BrushId = "pose" | "wave" | "pulse" | "spin" | "bounce" | "tremble";

const ANIM_BRUSHES: { id: BrushId; label: string; color: string; desc: string }[] = [
  { id: 'pose', label: 'Pose', color: '#ef4444', desc: 'Static offset brush — paint a body part to a target offset' },
  { id: 'wave', label: 'Wave', color: '#3b82f6', desc: 'Sinusoidal motion — paint gentle oscillation on selected parts' },
  { id: 'pulse', label: 'Pulse', color: '#22c55e', desc: 'Scale pulse — paint a heartbeat-like scale animation' },
  { id: 'spin', label: 'Spin', color: '#a855f7', desc: 'Rotation sweep — paint a smooth rotation arc on parts' },
  { id: 'bounce', label: 'Bounce', color: '#f59e0b', desc: 'Vertical bounce — paint an up-down hop on parts' },
  { id: 'tremble', label: 'Tremble', color: '#06b6d4', desc: 'Micro-shake — paint fine trembling for tension or fear' },
];

interface PoseSnapshot {
  id: number;
  label: string;
  time: number;
  pose: FullPose;
  glow: number;
}

const GIZMO_SCREEN_POSITIONS: Record<string, { sx: number; sy: number }> = {
  head: { sx: 0, sy: -18 },
  torso: { sx: 0, sy: -8 },
  leftArm: { sx: -12, sy: -8 },
  rightArm: { sx: 12, sy: -8 },
  leftLeg: { sx: -5, sy: 4 },
  rightLeg: { sx: 5, sy: 4 },
  weapon: { sx: -16, sy: -12 },
};

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "heroes", label: "Heroes", icon: User },
  { id: "characters", label: "3D Models", icon: Layers },
  { id: "minions", label: "Minions", icon: Footprints },
  { id: "monsters", label: "Monsters", icon: Bug },
  { id: "structures", label: "Structures", icon: Castle },
  { id: "effects", label: "Sprite FX", icon: Sparkles },
  { id: "glb_effects", label: "GLB Effects", icon: Zap },
  { id: "environment", label: "Environment", icon: TreePine },
  { id: "animals", label: "Animals", icon: Bird },
  { id: "map_objects", label: "Map Objects", icon: Mountain },
  { id: "tiles", label: "Tiles", icon: Layers },
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
  canvasEffectColor: string;
  canvasEffectRadius: number;
  structSubType: "tower" | "nexus" | "house" | "bridge" | "well" | "shrine" | "gate" | "wall";
  envSubType: "tree" | "rock" | "mountain" | "terrain_prop";
  treeType: "standard" | "pine" | "willow" | "palm" | "dead" | "mushroom";
  rockType: "standard" | "crystal" | "mossy_boulder" | "stalagmite";
  mountainType: "peak" | "cliff" | "mesa" | "hill";
  terrainPropType: "bush" | "flower_patch" | "grass_tuft" | "mushroom_cluster" | "barrel" | "hay_bale";
  animalType: "deer" | "boar" | "horse" | "hawk" | "fish";
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
  returnToIdle: boolean; // Ensures animation ends at idle pose
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
    returnToIdle: true, // Default: always return to idle
    startTime: 0,
    endTime: 1.0,
    keyframes: [
      { time: 0, pose: {}, easing: 'easeInOut' },
      { time: 1.0, pose: {}, easing: 'easeInOut' }, // Empty pose = idle
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

  const updatePartPose = (part: string, axis: string, value: number) => {
    const rounded = axis === 'rotation' || axis === 'scale' ? value : Math.round(value);
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

  const getPartValue = (part: string, axis: string): number => {
    if (!kf) return axis === 'scale' ? 1 : 0;
    const p = kf.pose[part as keyof typeof kf.pose];
    if (!p) return axis === 'scale' ? 1 : 0;
    return (p as any)[axis] ?? (axis === 'scale' ? 1 : 0);
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
                          <LabeledSlider label="rotation (deg)" value={getPartValue(part, 'rotation')} min={-180} max={180} step={5}
                            onChange={v => updatePartPose(part, 'rotation', v)} suffix="°" />
                          <LabeledSlider label="scale" value={getPartValue(part, 'scale') || 1} min={0.2} max={3} step={0.1}
                            onChange={v => updatePartPose(part, 'scale', v)} suffix="x" />
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

  const STRUCTURE_TYPES: { id: EditorState['structSubType']; label: string }[] = [
    { id: 'tower', label: 'Tower' },
    { id: 'nexus', label: 'Nexus' },
    { id: 'house', label: 'House' },
    { id: 'bridge', label: 'Bridge' },
    { id: 'well', label: 'Well' },
    { id: 'shrine', label: 'Shrine' },
    { id: 'gate', label: 'Gate' },
    { id: 'wall', label: 'Wall' },
  ];

  const towerStats: Record<number, { hp: number; atk: number; rng: number }> = {
    0: { hp: 2000, atk: 120, rng: 700 },
    1: { hp: 2500, atk: 150, rng: 700 },
    2: { hp: 3000, atk: 180, rng: 700 },
  };

  const hasTeamColor = ['tower', 'nexus', 'house', 'shrine', 'gate', 'wall'].includes(structType);
  const teamColor = structType === 'nexus' ? state.nexusTeamColor : state.towerTeamColor;
  const setTeamColor = (v: string) => setState(structType === 'nexus' ? { nexusTeamColor: v } : { towerTeamColor: v });

  return (
    <div className="space-y-4">
      <SectionHeader title="Structure Type" />
      <div className="grid grid-cols-4 gap-2">
        {STRUCTURE_TYPES.map(st => (
          <Button key={st.id} size="sm" data-testid={`btn-struct-${st.id}`}
            variant={structType === st.id ? "default" : "outline"}
            className={`text-xs ${structType === st.id ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
            onClick={() => setState({ structSubType: st.id })}>
            {st.label}
          </Button>
        ))}
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

      {hasTeamColor && (
        <>
          <SectionHeader title="Team Color" />
          <ColorPicker label="Team" value={teamColor} onChange={setTeamColor} />
          <div className="grid grid-cols-5 gap-2 mt-2">
            {TEAM_COLORS.map(c => (
              <button key={c} data-testid={`btn-struct-color-${c.slice(1)}`}
                className={`h-8 rounded border transition-all ${
                  teamColor === c ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-gray-700 hover:border-gray-500'}`}
                style={{ backgroundColor: c }}
                onClick={() => setTeamColor(c)} />
            ))}
          </div>
        </>
      )}

      {structType === "tower" && (
        <>
          <SectionHeader title="Stats" />
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(towerStats[state.towerTier] || towerStats[0]).map(([key, val]) => (
              <div key={key} className="bg-black/20 rounded p-2 text-center">
                <div className="text-[10px] text-gray-500 uppercase">{key}</div>
                <div className="text-amber-300 font-mono text-sm">{val}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHeader title="Properties" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-amber-400 capitalize">{structType}</span></div>
        {structType === "tower" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">True Sight</span><span className="text-green-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Ramp Damage</span><span className="text-orange-400">+25% per hit</span></div>
          </>
        )}
        {structType === "nexus" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Invulnerable</span><span className="text-red-400">Until towers fall</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Game Over</span><span className="text-purple-400">When destroyed</span></div>
          </>
        )}
        {!['tower', 'nexus'].includes(structType) && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Collision</span><span className="text-red-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destructible</span><span className="text-gray-400">{['wall', 'gate'].includes(structType) ? 'Yes' : 'No'}</span></div>
          </>
        )}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-structure"
        onClick={() => {
          const data: Record<string, any> = { type: structType };
          if (structType === 'tower') { data.tier = state.towerTier; data.teamColor = state.towerTeamColor; }
          else if (hasTeamColor) { data.teamColor = teamColor; }
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Structure Data
      </Button>
    </div>
  );
}

function EffectsPanel({ state, setState, onPlayEffect, onPlayCanvasEffect }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  onPlayEffect: (type: SpriteEffectType, scale: number, durationMs: number) => void;
  onPlayCanvasEffect: (type: EffectType) => void;
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
    // Magic-sprites VFX pack
    lightning: { label: "Lightning", category: "Elemental" },
    lightning_bolt: { label: "Lightning Bolt", category: "Elemental" },
    midas_touch: { label: "Midas Touch", category: "Magic" },
    sun_strike: { label: "Sun Strike", category: "Light" },
    explosion: { label: "Explosion", category: "Impact" },
    spikes: { label: "Spikes", category: "Physical" },
    fire_wall: { label: "Fire Wall", category: "Elemental" },
    shield_spell: { label: "Shield Spell", category: "Defensive" },
    black_hole: { label: "Black Hole", category: "Dark" },
    fire_ball: { label: "Fire Ball", category: "Elemental" },
  };

  const canvasEffectInfo: Record<EffectType, { label: string; category: string; color: string }> = {
    cast_circle: { label: 'Cast Circle', category: 'Spell', color: '#8b5cf6' },
    impact_ring: { label: 'Impact Ring', category: 'Hit', color: '#ef4444' },
    aoe_blast: { label: 'AoE Blast', category: 'Spell', color: '#f97316' },
    skillshot_trail: { label: 'Skillshot Trail', category: 'Projectile', color: '#22c55e' },
    cone_sweep: { label: 'Cone Sweep', category: 'Melee', color: '#ef4444' },
    dash_trail: { label: 'Dash Trail', category: 'Movement', color: '#06b6d4' },
    melee_slash: { label: 'Melee Slash', category: 'Melee', color: '#ef4444' },
    melee_lunge: { label: 'Melee Lunge', category: 'Melee', color: '#ffd700' },
    heavy_slash: { label: 'Heavy Slash', category: 'Melee', color: '#ef4444' },
    enemy_slash: { label: 'Enemy Slash', category: 'Enemy', color: '#ff6666' },
    enemy_aoe_telegraph: { label: 'AoE Telegraph', category: 'Enemy', color: '#ff4444' },
    enemy_aoe_blast: { label: 'Enemy AoE', category: 'Enemy', color: '#ff6600' },
  };

  const categories = Array.from(new Set(Object.values(effectInfo).map(e => e.category)));
  const canvasCategories = Array.from(new Set(Object.values(canvasEffectInfo).map(e => e.category)));

  return (
    <div className="space-y-4">
      {/* ── Canvas VFX (geometric effects) ── */}
      <SectionHeader title="Canvas VFX" />
      <div className="space-y-2">
        {canvasCategories.map(cat => (
          <div key={cat}>
            <p className="text-[10px] text-gray-500 uppercase mb-1">{cat}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {CANVAS_EFFECT_TYPES.filter(e => canvasEffectInfo[e]?.category === cat).map(e => (
                <Button key={e} size="sm" data-testid={`btn-canvas-fx-${e}`}
                  variant="outline"
                  className="text-[10px] h-6 px-2 border-gray-700 hover:border-amber-600"
                  onClick={() => onPlayCanvasEffect(e)}>
                  <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: canvasEffectInfo[e]?.color }} />
                  {canvasEffectInfo[e]?.label || e}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <ColorPicker label="Color" value={state.canvasEffectColor} onChange={v => setState({ canvasEffectColor: v })} />
      </div>
      <LabeledSlider label="Radius" value={state.canvasEffectRadius} min={15} max={120} step={5} onChange={v => setState({ canvasEffectRadius: v })} suffix="px" />

      <Button variant="outline" className="w-full text-xs" data-testid="btn-play-all-canvas"
        onClick={() => {
          CANVAS_EFFECT_TYPES.forEach((e, i) => {
            setTimeout(() => onPlayCanvasEffect(e), i * 350);
          });
        }}>
        <Zap className="w-3 h-3 mr-1" /> Play All Canvas VFX
      </Button>

      {/* ── Sprite Effects ── */}
      <SectionHeader title="Sprite Effects" />
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

      <SectionHeader title="Sprite Settings" />
      <LabeledSlider label="Scale" value={state.effectScale} min={0.5} max={4.0} step={0.1} onChange={v => setState({ effectScale: v })} suffix="x" />
      <LabeledSlider label="Duration" value={state.effectDuration} min={200} max={3000} step={50} onChange={v => setState({ effectDuration: v })} suffix="ms" />

      <Button className="w-full bg-purple-700 hover:bg-purple-600 text-xs" data-testid="btn-play-effect"
        onClick={() => onPlayEffect(state.effectType, state.effectScale, state.effectDuration)}>
        <Sparkles className="w-3 h-3 mr-1" /> Play Sprite Effect
      </Button>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-play-all-effects"
        onClick={() => {
          SPRITE_EFFECT_TYPES.forEach((e, i) => {
            setTimeout(() => onPlayEffect(e, state.effectScale, state.effectDuration), i * 400);
          });
        }}>
        <Zap className="w-3 h-3 mr-1" /> Play All Sprite Effects
      </Button>

      <SectionHeader title="Current Effect Info" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="text-amber-400">{effectInfo[state.effectType]?.label || state.effectType}</span></div>
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

  const TREE_TYPES: { id: EditorState['treeType']; label: string }[] = [
    { id: 'standard', label: 'Standard' }, { id: 'pine', label: 'Pine' }, { id: 'willow', label: 'Willow' },
    { id: 'palm', label: 'Palm' }, { id: 'dead', label: 'Dead' }, { id: 'mushroom', label: 'Mushroom' },
  ];
  const ROCK_TYPES: { id: EditorState['rockType']; label: string }[] = [
    { id: 'standard', label: 'Standard' }, { id: 'crystal', label: 'Crystal' },
    { id: 'mossy_boulder', label: 'Mossy' }, { id: 'stalagmite', label: 'Stalagmite' },
  ];
  const MOUNTAIN_TYPES: { id: EditorState['mountainType']; label: string }[] = [
    { id: 'peak', label: 'Peak' }, { id: 'cliff', label: 'Cliff' }, { id: 'mesa', label: 'Mesa' }, { id: 'hill', label: 'Hill' },
  ];
  const TERRAIN_PROP_TYPES: { id: EditorState['terrainPropType']; label: string }[] = [
    { id: 'bush', label: 'Bush' }, { id: 'flower_patch', label: 'Flowers' }, { id: 'grass_tuft', label: 'Grass' },
    { id: 'mushroom_cluster', label: 'Shrooms' }, { id: 'barrel', label: 'Barrel' }, { id: 'hay_bale', label: 'Hay Bale' },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title="Environment Type" />
      <div className="grid grid-cols-4 gap-2">
        <Button size="sm" data-testid="btn-env-tree"
          variant={envType === "tree" ? "default" : "outline"}
          className={`text-xs ${envType === "tree" ? 'bg-green-700 hover:bg-green-600' : ''}`}
          onClick={() => setState({ envSubType: "tree" })}>
          <TreePine className="w-3 h-3 mr-1" /> Tree
        </Button>
        <Button size="sm" data-testid="btn-env-rock"
          variant={envType === "rock" ? "default" : "outline"}
          className={`text-xs ${envType === "rock" ? 'bg-gray-600 hover:bg-gray-500' : ''}`}
          onClick={() => setState({ envSubType: "rock" })}>
          Rock
        </Button>
        <Button size="sm" data-testid="btn-env-mountain"
          variant={envType === "mountain" ? "default" : "outline"}
          className={`text-xs ${envType === "mountain" ? 'bg-stone-600 hover:bg-stone-500' : ''}`}
          onClick={() => setState({ envSubType: "mountain" })}>
          <Mountain className="w-3 h-3 mr-1" /> Mtn
        </Button>
        <Button size="sm" data-testid="btn-env-terrain-prop"
          variant={envType === "terrain_prop" ? "default" : "outline"}
          className={`text-xs ${envType === "terrain_prop" ? 'bg-emerald-700 hover:bg-emerald-600' : ''}`}
          onClick={() => setState({ envSubType: "terrain_prop" })}>
          Props
        </Button>
      </div>

      {envType === "tree" && (
        <>
          <SectionHeader title="Tree Type" />
          <div className="grid grid-cols-3 gap-2">
            {TREE_TYPES.map(tt => (
              <Button key={tt.id} size="sm" data-testid={`btn-tree-type-${tt.id}`}
                variant={state.treeType === tt.id ? "default" : "outline"}
                className={`text-xs ${state.treeType === tt.id ? 'bg-green-700 hover:bg-green-600' : ''}`}
                onClick={() => setState({ treeType: tt.id })}>
                {tt.label}
              </Button>
            ))}
          </div>
          <SectionHeader title="Variation" />
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
        </>
      )}

      {envType === "rock" && (
        <>
          <SectionHeader title="Rock Type" />
          <div className="grid grid-cols-2 gap-2">
            {ROCK_TYPES.map(rt => (
              <Button key={rt.id} size="sm" data-testid={`btn-rock-type-${rt.id}`}
                variant={state.rockType === rt.id ? "default" : "outline"}
                className={`text-xs ${state.rockType === rt.id ? 'bg-gray-600 hover:bg-gray-500' : ''}`}
                onClick={() => setState({ rockType: rt.id })}>
                {rt.label}
              </Button>
            ))}
          </div>
          <SectionHeader title="Variation" />
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
        </>
      )}

      {envType === "mountain" && (
        <>
          <SectionHeader title="Mountain Type" />
          <div className="grid grid-cols-2 gap-2">
            {MOUNTAIN_TYPES.map(mt => (
              <Button key={mt.id} size="sm" data-testid={`btn-mountain-type-${mt.id}`}
                variant={state.mountainType === mt.id ? "default" : "outline"}
                className={`text-xs ${state.mountainType === mt.id ? 'bg-stone-600 hover:bg-stone-500' : ''}`}
                onClick={() => setState({ mountainType: mt.id })}>
                {mt.label}
              </Button>
            ))}
          </div>
        </>
      )}

      {envType === "terrain_prop" && (
        <>
          <SectionHeader title="Terrain Prop" />
          <div className="grid grid-cols-3 gap-2">
            {TERRAIN_PROP_TYPES.map(tp => (
              <Button key={tp.id} size="sm" data-testid={`btn-terrain-prop-${tp.id}`}
                variant={state.terrainPropType === tp.id ? "default" : "outline"}
                className={`text-xs ${state.terrainPropType === tp.id ? 'bg-emerald-700 hover:bg-emerald-600' : ''}`}
                onClick={() => setState({ terrainPropType: tp.id })}>
                {tp.label}
              </Button>
            ))}
          </div>
          {['bush', 'flower_patch', 'grass_tuft', 'mushroom_cluster'].includes(state.terrainPropType) && (
            <>
              <SectionHeader title="Variation" />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" data-testid="btn-terrain-seed-prev"
                  onClick={() => setState({ treeSeed: Math.max(0, state.treeSeed - 1) })}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-amber-400 font-mono text-lg">{state.treeSeed}</span>
                  <p className="text-gray-500 text-[10px]">Seed Variation</p>
                </div>
                <Button size="sm" variant="outline" data-testid="btn-terrain-seed-next"
                  onClick={() => setState({ treeSeed: state.treeSeed + 1 })}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <SectionHeader title="Properties" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Category</span><span className="text-amber-400 capitalize">{envType.replace('_', ' ')}</span></div>
        {envType === "tree" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Variant</span><span className="text-green-400 capitalize">{state.treeType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Seed</span><span className="text-amber-400">{state.treeSeed}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Blocks Vision</span><span className="text-red-400">Yes (Fog of War)</span></div>
          </>
        )}
        {envType === "rock" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Variant</span><span className="text-gray-300 capitalize">{state.rockType.replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Seed</span><span className="text-amber-400">{state.rockSeed}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Collision</span><span className="text-red-400">Yes</span></div>
          </>
        )}
        {envType === "mountain" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Variant</span><span className="text-stone-300 capitalize">{state.mountainType}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Impassable</span><span className="text-red-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Scale</span><span className="text-blue-400">Large</span></div>
          </>
        )}
        {envType === "terrain_prop" && (
          <>
            <div className="flex justify-between"><span className="text-gray-500">Variant</span><span className="text-emerald-400 capitalize">{state.terrainPropType.replace('_', ' ')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Walkable</span><span className="text-green-400">Yes</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destructible</span><span className="text-gray-400">No</span></div>
          </>
        )}
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-env"
        onClick={() => {
          const data: Record<string, any> = { type: envType };
          if (envType === 'tree') { data.variant = state.treeType; data.seed = state.treeSeed; }
          else if (envType === 'rock') { data.variant = state.rockType; data.seed = state.rockSeed; }
          else if (envType === 'mountain') { data.variant = state.mountainType; }
          else { data.variant = state.terrainPropType; data.seed = state.treeSeed; }
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Data
      </Button>
    </div>
  );
}

function AnimalsPanel({ state, setState, playing, setPlaying, speed, setSpeed, animTimer, resetTimer }: {
  state: EditorState; setState: (s: Partial<EditorState>) => void;
  playing: boolean; setPlaying: (p: boolean) => void;
  speed: number; setSpeed: (s: number) => void;
  animTimer: number; resetTimer: () => void;
}) {
  const ANIMAL_TYPES: { id: EditorState['animalType']; label: string }[] = [
    { id: 'deer', label: 'Deer' }, { id: 'boar', label: 'Boar' }, { id: 'horse', label: 'Horse' },
    { id: 'hawk', label: 'Hawk' }, { id: 'fish', label: 'Fish' },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title="Animal Type" />
      <div className="grid grid-cols-3 gap-2">
        {ANIMAL_TYPES.map(a => (
          <Button key={a.id} size="sm" data-testid={`btn-animal-${a.id}`}
            variant={state.animalType === a.id ? "default" : "outline"}
            className={`text-xs ${state.animalType === a.id ? 'bg-amber-700 hover:bg-amber-600' : ''}`}
            onClick={() => setState({ animalType: a.id })}>
            {a.label}
          </Button>
        ))}
      </div>

      <SectionHeader title="Facing" />
      <LabeledSlider label="Facing" value={state.facing} min={0} max={6.28} step={0.1}
        onChange={v => setState({ facing: v })} suffix=" rad" />

      <SectionHeader title="Playback" />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" data-testid="btn-animal-playpause"
          onClick={() => setPlaying(!playing)}>
          {playing ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button size="sm" variant="outline" data-testid="btn-animal-reset" onClick={resetTimer}>
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
      <LabeledSlider label="Speed" value={speed} min={0.1} max={3.0} step={0.1}
        onChange={setSpeed} suffix="x" />

      <SectionHeader title="Properties" />
      <div className="bg-black/20 rounded p-3 text-xs space-y-2">
        <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-amber-400 capitalize">{state.animalType}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Facing</span><span className="text-blue-400">{state.facing.toFixed(2)} rad</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Tameable</span><span className="text-green-400">Yes</span></div>
        <div className="flex justify-between"><span className="text-gray-500">AI</span><span className="text-purple-400">Wandering</span></div>
      </div>

      <Button variant="outline" className="w-full text-xs" data-testid="btn-export-animal"
        onClick={() => {
          const data = { type: state.animalType, facing: state.facing };
          navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        }}>
        <Copy className="w-3 h-3 mr-1" /> Export Animal Data
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

  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("move");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<PoseSnapshot[]>([]);
  const [showGizmo, setShowGizmo] = useState(true);
  const [activeBrush, setActiveBrush] = useState<BrushId | null>(null);
  const [brushIntensity, setBrushIntensity] = useState(1.0);
  const [brushTargetParts, setBrushTargetParts] = useState<Set<string>>(new Set());
  const snapshotIdRef = useRef(1);
  const dragRef = useRef<{ part: string; startX: number; startY: number; startOx: number; startOy: number; startOz: number; startRot: number; startScale: number } | null>(null);
  const gizmoModeRef = useRef<GizmoMode>("move");
  const selectedPartRef = useRef<string | null>(null);
  const showGizmoRef = useRef(true);

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
    canvasEffectColor: '#8b5cf6',
    canvasEffectRadius: 40,
    structSubType: "tower",
    envSubType: "tree",
    treeType: "standard",
    rockType: "standard",
    mountainType: "peak",
    terrainPropType: "bush",
    animalType: "deer",
  });

  const setState = useCallback((partial: Partial<EditorState>) => {
    setStateRaw(prev => ({ ...prev, ...partial }));
  }, []);

  const animTimerRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const stateRef = useRef(state);
  const effectPoolRef = useRef<EffectPool>(new EffectPool(64));

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { timelineRef.current = timeline; }, [timeline]);
  useEffect(() => { gizmoModeRef.current = gizmoMode; }, [gizmoMode]);
  useEffect(() => { selectedPartRef.current = selectedPart; }, [selectedPart]);
  useEffect(() => { showGizmoRef.current = showGizmo; }, [showGizmo]);

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

  const getCurrentPose = useCallback((): FullPose => {
    const tl = timelineRef.current;
    if (tl.enabled) {
      const motion: MotionPrimitive = { name: tl.name, duration: tl.duration, keyframes: tl.keyframes, loop: tl.loop };
      return sampleMotion(motion, animTimerRef.current);
    }
    const zero: BodyPartPose = { ox: 0, oy: 0, oz: 0 };
    return { leftLeg: zero, rightLeg: zero, leftArm: zero, rightArm: zero, torso: zero, head: zero, weapon: zero, weaponGlow: 0 };
  }, []);

  const captureSnapshot = useCallback(() => {
    const pose = getCurrentPose();
    const tl = timelineRef.current;
    const kf = tl.keyframes[tl.selectedKeyframeIdx];
    const glow = kf?.glow ?? 0;
    const id = snapshotIdRef.current++;
    setSnapshots(prev => [...prev, {
      id, label: `Snap ${id}`,
      time: parseFloat(animTimerRef.current.toFixed(3)),
      pose, glow,
    }]);
  }, [getCurrentPose]);

  const applySnapshotsToTimeline = useCallback((smooth: boolean) => {
    if (snapshots.length < 2) return;
    const sorted = [...snapshots].sort((a, b) => a.time - b.time);
    const maxTime = sorted[sorted.length - 1].time;
    const duration = maxTime > 0 ? maxTime : 1;

    if (smooth) {
      const smoothed = generateSmoothedAnimation(sorted, duration, timeline.loop, 2);
      setTimeline(prev => ({
        ...prev,
        enabled: true,
        duration: smoothed.duration,
        endTime: smoothed.duration,
        keyframes: smoothed.keyframes,
        selectedKeyframeIdx: 0,
      }));
    } else {
      const keyframes: MotionKeyframe[] = sorted.map(s => {
        const kf: MotionKeyframe = { time: s.time, pose: {}, glow: s.glow, easing: 'easeInOut' };
        const parts: (keyof Omit<FullPose, 'weaponGlow'>)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
        for (const p of parts) {
          const bp = s.pose[p];
          if (bp.ox !== 0 || bp.oy !== 0 || bp.oz !== 0 || (bp.rotation && bp.rotation !== 0) || (bp.scale && bp.scale !== 1)) {
            kf.pose[p] = { ...bp };
          }
        }
        return kf;
      });
      setTimeline(prev => ({
        ...prev,
        enabled: true,
        duration,
        endTime: duration,
        keyframes,
        selectedKeyframeIdx: 0,
      }));
    }
  }, [snapshots, timeline.loop]);

  const applyBrush = useCallback((brushId: BrushId) => {
    if (brushTargetParts.size === 0) return;
    const tl = timelineRef.current;
    const dur = tl.duration || 1;
    const intensity = brushIntensity;
    const targetPartsArr = Array.from(brushTargetParts);

    let keyframes: MotionKeyframe[] = [];
    const steps = 5;

    if (brushId === 'pose') {
      const kfStart: MotionKeyframe = { time: 0, pose: {}, glow: 0, easing: 'easeInOut' };
      const kfPeak: MotionKeyframe = { time: dur * 0.4, pose: {}, glow: 0, easing: 'easeOut' };
      const kfEnd: MotionKeyframe = { time: dur, pose: {}, glow: 0, easing: 'easeOut' };
      for (const p of targetPartsArr) {
        kfPeak.pose[p as keyof MotionKeyframe['pose']] = { ox: Math.round(2 * intensity), oy: 0, oz: Math.round(1 * intensity) };
      }
      keyframes = [kfStart, kfPeak, kfEnd];
    } else if (brushId === 'wave') {
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * dur;
        const wave = Math.sin((i / steps) * Math.PI * 2) * intensity;
        const kf: MotionKeyframe = { time: parseFloat(t.toFixed(4)), pose: {}, glow: 0, easing: 'easeInOut' };
        for (const p of targetPartsArr) {
          kf.pose[p as keyof MotionKeyframe['pose']] = { ox: Math.round(wave * 1.5), oy: 0, oz: Math.round(Math.cos((i / steps) * Math.PI * 2) * intensity * 0.5) };
        }
        keyframes.push(kf);
      }
    } else if (brushId === 'pulse') {
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * dur;
        const pulse = 1 + Math.sin((i / steps) * Math.PI * 2) * 0.15 * intensity;
        const kf: MotionKeyframe = { time: parseFloat(t.toFixed(4)), pose: {}, glow: 0, easing: 'easeInOut' };
        for (const p of targetPartsArr) {
          kf.pose[p as keyof MotionKeyframe['pose']] = { ox: 0, oy: 0, oz: 0, scale: parseFloat(pulse.toFixed(2)) };
        }
        keyframes.push(kf);
      }
    } else if (brushId === 'spin') {
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * dur;
        const rot = (i / steps) * 360 * intensity;
        const kf: MotionKeyframe = { time: parseFloat(t.toFixed(4)), pose: {}, glow: 0, easing: 'easeInOut' };
        for (const p of targetPartsArr) {
          kf.pose[p as keyof MotionKeyframe['pose']] = { ox: 0, oy: 0, oz: 0, rotation: rot };
        }
        keyframes.push(kf);
      }
    } else if (brushId === 'bounce') {
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * dur;
        const bounce = Math.abs(Math.sin((i / steps) * Math.PI * 2)) * 2 * intensity;
        const kf: MotionKeyframe = { time: parseFloat(t.toFixed(4)), pose: {}, glow: 0, easing: 'easeInOut' };
        for (const p of targetPartsArr) {
          kf.pose[p as keyof MotionKeyframe['pose']] = { ox: 0, oy: 0, oz: Math.round(bounce) };
        }
        keyframes.push(kf);
      }
    } else if (brushId === 'tremble') {
      for (let i = 0; i <= steps * 2; i++) {
        const t = (i / (steps * 2)) * dur;
        const shake = (i % 2 === 0 ? 1 : -1) * 0.5 * intensity;
        const kf: MotionKeyframe = { time: parseFloat(t.toFixed(4)), pose: {}, glow: 0, easing: 'linear' };
        for (const p of targetPartsArr) {
          kf.pose[p as keyof MotionKeyframe['pose']] = { ox: Math.round(shake), oy: Math.round(shake * 0.5), oz: 0 };
        }
        keyframes.push(kf);
      }
    }

    if (keyframes.length > 0) {
      setTimeline(prev => ({
        ...prev,
        enabled: true,
        keyframes,
        selectedKeyframeIdx: 0,
      }));
    }
  }, [brushTargetParts, brushIntensity]);

  const toggleBrushPart = useCallback((part: string) => {
    setBrushTargetParts(prev => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTab !== 'heroes' || !showGizmoRef.current || !timelineRef.current.enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 20;
    const scale = 3.5;

    let closestPart: string | null = null;
    let closestDist = 20;
    for (const [part, pos] of Object.entries(GIZMO_SCREEN_POSITIONS)) {
      const tl = timelineRef.current;
      const kf = tl.keyframes[tl.selectedKeyframeIdx];
      const partPose = kf?.pose?.[part as keyof typeof kf.pose] as Partial<BodyPartPose> | undefined;
      const px = cx + (pos.sx + (partPose?.ox ?? 0)) * scale;
      const py = cy + (pos.sy - (partPose?.oz ?? 0)) * scale;
      const d = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (d < closestDist) {
        closestDist = d;
        closestPart = part;
      }
    }

    if (closestPart) {
      setSelectedPart(closestPart);
      setTimeline(prev => ({ ...prev, expandedPart: closestPart }));
      const tl = timelineRef.current;
      const kf = tl.keyframes[tl.selectedKeyframeIdx];
      const pp = kf?.pose?.[closestPart as keyof typeof kf.pose] as Partial<BodyPartPose> | undefined;
      dragRef.current = {
        part: closestPart,
        startX: mx, startY: my,
        startOx: pp?.ox ?? 0,
        startOy: pp?.oy ?? 0,
        startOz: pp?.oz ?? 0,
        startRot: pp?.rotation ?? 0,
        startScale: pp?.scale ?? 1,
      };
      setPlaying(false);
    } else {
      setSelectedPart(null);
    }
  }, [activeTab]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scale = 3.5;
    const dx = (mx - dragRef.current.startX) / scale;
    const dy = (my - dragRef.current.startY) / scale;
    const part = dragRef.current.part;
    const mode = gizmoModeRef.current;

    const tl = timelineRef.current;
    const kfIdx = tl.selectedKeyframeIdx;
    const existingPart = tl.keyframes[kfIdx]?.pose?.[part as keyof MotionKeyframe['pose']] || {};

    let updates: Record<string, number> = {};
    if (mode === 'move') {
      if (e.shiftKey) {
        updates = { oy: Math.round(dragRef.current.startOy - dy) };
      } else {
        updates = { ox: Math.round(dragRef.current.startOx + dx), oz: Math.round(dragRef.current.startOz - dy) };
      }
    } else if (mode === 'rotate') {
      const angleDelta = Math.atan2(dy, dx) * 180 / Math.PI;
      updates = { rotation: Math.round((dragRef.current.startRot + angleDelta) / 5) * 5 };
    } else if (mode === 'scale') {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sign = dy < 0 ? 1 : -1;
      updates = { scale: Math.max(0.2, Math.min(3, parseFloat((dragRef.current.startScale + sign * dist * 0.05).toFixed(1)))) };
    }

    const newKeyframes = tl.keyframes.map((k, i) => {
      if (i !== kfIdx) return k;
      return { ...k, pose: { ...k.pose, [part]: { ...existingPart, ...updates } } };
    });
    setTimeline(prev => ({ ...prev, keyframes: newKeyframes }));
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const playEffect = useCallback((type: SpriteEffectType, scale: number, durationMs: number) => {
    if (!spriteEffectsRef.current) {
      spriteEffectsRef.current = new SpriteEffectSystem();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    spriteEffectsRef.current.playEffect(type, canvas.width / 2, canvas.height / 2 + 10, scale, durationMs);
  }, []);

  const playCanvasEffect = useCallback((type: EffectType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 20;
    const s = stateRef.current;
    // Offset so effects don't all stack on exact center
    const jitterX = (Math.random() - 0.5) * 40;
    const jitterY = (Math.random() - 0.5) * 20;
    const angle = Math.random() * Math.PI * 2;
    effectPoolRef.current.spawn(
      cx + jitterX, cy + jitterY,
      type, s.canvasEffectRadius, s.canvasEffectColor,
      type.includes('telegraph') ? 1.2 : 0.6,
      angle,
    );
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

      if (showGizmoRef.current && tl.enabled) {
        ctx.save();
        const gScale = 3.5;
        const selPart = selectedPartRef.current;
        const gMode = gizmoModeRef.current;
        const kf = tl.keyframes[tl.selectedKeyframeIdx];

        for (const [part, pos] of Object.entries(GIZMO_SCREEN_POSITIONS)) {
          const pp = kf?.pose?.[part as keyof typeof kf.pose] as Partial<BodyPartPose> | undefined;
          const px = cx + (pos.sx + (pp?.ox ?? 0)) * gScale;
          const py = cy + (pos.sy - (pp?.oz ?? 0)) * gScale;
          const isSelected = part === selPart;
          const color = PART_COLORS[part] || '#888';

          ctx.beginPath();
          ctx.arc(px, py, isSelected ? 8 : 5, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? color : color + '66';
          ctx.fill();
          ctx.strokeStyle = isSelected ? '#ffffff' : color + 'aa';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();

          if (isSelected) {
            if (gMode === 'move') {
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 20, py); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(px + 16, py - 3); ctx.lineTo(px + 20, py); ctx.lineTo(px + 16, py + 3); ctx.fill();
              ctx.strokeStyle = '#22c55e';
              ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 20); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(px - 3, py - 16); ctx.lineTo(px, py - 20); ctx.lineTo(px + 3, py - 16); ctx.fill();
            } else if (gMode === 'rotate') {
              const rot = (pp?.rotation ?? 0) * Math.PI / 180;
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(px, py, 16, 0, Math.PI * 2);
              ctx.stroke();
              ctx.strokeStyle = '#fbbf24';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(px + Math.cos(rot) * 16, py - Math.sin(rot) * 16);
              ctx.stroke();
            } else if (gMode === 'scale') {
              const sc = pp?.scale ?? 1;
              const sz = 10 * sc;
              ctx.strokeStyle = '#8b5cf6';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px - sz, py - sz, sz * 2, sz * 2);
              ctx.fillStyle = '#8b5cf600';
              ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2);
              ctx.fillStyle = '#8b5cf6';
              ctx.fillRect(px + sz - 3, py + sz - 3, 6, 6);
            }
          }

          ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.5)';
          ctx.font = `${isSelected ? 'bold' : 'normal'} 9px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(PART_LABELS[part] || part, px, py + (isSelected ? 18 : 14));
        }
        ctx.restore();
      }
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
      switch (s.structSubType) {
        case 'nexus': vr.drawNexusVoxel(ctx, 0, 0, s.nexusTeamColor); break;
        case 'house': vr.drawHouseVoxel(ctx, 0, 0, s.towerTeamColor); break;
        case 'bridge': vr.drawBridgeVoxel(ctx, 0, 0); break;
        case 'well': vr.drawWellVoxel(ctx, 0, 0); break;
        case 'shrine': vr.drawShrineVoxel(ctx, 0, 0, s.towerTeamColor); break;
        case 'gate': vr.drawGateVoxel(ctx, 0, 0, s.towerTeamColor); break;
        case 'wall': vr.drawWallSegmentVoxel(ctx, 0, 0, s.towerTeamColor); break;
        default: vr.drawTowerVoxel(ctx, 0, 0, s.towerTeamColor, s.towerTier); break;
      }
      ctx.restore();
    } else if (activeTab === "environment") {
      ctx.save();
      if (s.envSubType === 'mountain') {
        const scale = 2.0;
        ctx.translate(cx, cy + 30);
        ctx.scale(scale, scale);
        switch (s.mountainType) {
          case 'cliff': vr.drawCliffVoxel(ctx, 0, 0); break;
          case 'mesa': vr.drawMesaVoxel(ctx, 0, 0); break;
          case 'hill': vr.drawHillVoxel(ctx, 0, 0); break;
          default: vr.drawMountainPeakVoxel(ctx, 0, 0); break;
        }
      } else if (s.envSubType === 'terrain_prop') {
        const scale = 4.0;
        ctx.translate(cx, cy + 10);
        ctx.scale(scale, scale);
        switch (s.terrainPropType) {
          case 'flower_patch': vr.drawFlowerPatchVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'grass_tuft': vr.drawGrassTuftVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'mushroom_cluster': vr.drawMushroomClusterVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'barrel': vr.drawBarrelVoxel(ctx, 0, 0); break;
          case 'hay_bale': vr.drawHayBaleVoxel(ctx, 0, 0); break;
          default: vr.drawBushVoxel(ctx, 0, 0, s.treeSeed); break;
        }
      } else if (s.envSubType === 'rock') {
        const scale = 3.0;
        ctx.translate(cx, cy + 20);
        ctx.scale(scale, scale);
        switch (s.rockType) {
          case 'crystal': vr.drawCrystalRockVoxel(ctx, 0, 0, s.rockSeed); break;
          case 'mossy_boulder': vr.drawMossyBoulderVoxel(ctx, 0, 0, s.rockSeed); break;
          case 'stalagmite': vr.drawStalagmiteVoxel(ctx, 0, 0, s.rockSeed); break;
          default: vr.drawRockVoxel(ctx, 0, 0, s.rockSeed); break;
        }
      } else {
        const scale = 3.0;
        ctx.translate(cx, cy + 20);
        ctx.scale(scale, scale);
        switch (s.treeType) {
          case 'pine': vr.drawPineTreeVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'willow': vr.drawWillowVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'palm': vr.drawPalmVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'dead': vr.drawDeadTreeVoxel(ctx, 0, 0, s.treeSeed); break;
          case 'mushroom': vr.drawMushroomTreeVoxel(ctx, 0, 0, s.treeSeed); break;
          default: vr.drawTreeVoxel(ctx, 0, 0, s.treeSeed); break;
        }
      }
      ctx.restore();
    } else if (activeTab === "animals") {
      ctx.save();
      const scale = 4.0;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      switch (s.animalType) {
        case 'boar': vr.drawBoarVoxel(ctx, 0, 0, s.facing, t); break;
        case 'horse': vr.drawHorseVoxel(ctx, 0, 0, s.facing, t); break;
        case 'hawk': vr.drawHawkVoxel(ctx, 0, 0, s.facing, t); break;
        case 'fish': vr.drawFishVoxel(ctx, 0, 0, s.facing, t); break;
        default: vr.drawDeerVoxel(ctx, 0, 0, s.facing, t); break;
      }
      ctx.restore();
    } else if (activeTab === "effects") {
      // Draw target dummy crosshair so effects have visual context
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      // Outer ring
      ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke();
      // Inner ring
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
      // Crosshair lines
      ctx.beginPath(); ctx.moveTo(cx - 70, cy); ctx.lineTo(cx + 70, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx, cy + 70); ctx.stroke();
      // Center dot
      ctx.fillStyle = 'rgba(255,180,50,0.25)';
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Update and render geometric canvas VFX
    effectPoolRef.current.update(dt);
    effectPoolRef.current.forEach((slot) => {
      ctx.save();
      ctx.globalAlpha = slot.opacity;
      const r = slot.radius * slot.scaleMul;
      const hex = slot.color;
      switch (slot.type) {
        case 'cast_circle': {
          ctx.strokeStyle = hex;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = hex + '66';
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'impact_ring': {
          ctx.strokeStyle = hex;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'aoe_blast': {
          const grad = ctx.createRadialGradient(slot.x, slot.y, 0, slot.x, slot.y, r);
          grad.addColorStop(0, hex + 'aa');
          grad.addColorStop(1, hex + '00');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'skillshot_trail': {
          const dx = Math.cos(slot.angle) * r * 2;
          const dy = Math.sin(slot.angle) * r * 2;
          ctx.strokeStyle = hex;
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(slot.x, slot.y); ctx.lineTo(slot.x + dx, slot.y + dy); ctx.stroke();
          break;
        }
        case 'cone_sweep': {
          ctx.fillStyle = hex + '55';
          ctx.beginPath();
          ctx.moveTo(slot.x, slot.y);
          ctx.arc(slot.x, slot.y, r * 1.5, slot.angle - 0.5, slot.angle + 0.5);
          ctx.closePath(); ctx.fill();
          break;
        }
        case 'dash_trail': {
          const dx2 = Math.cos(slot.angle) * r * 2.5;
          const dy2 = Math.sin(slot.angle) * r * 2.5;
          ctx.strokeStyle = hex + '88';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(slot.x, slot.y); ctx.lineTo(slot.x + dx2, slot.y + dy2); ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        case 'melee_slash':
        case 'heavy_slash':
        case 'enemy_slash': {
          const arcW = slot.type === 'heavy_slash' ? 1.0 : 0.7;
          ctx.strokeStyle = hex;
          ctx.lineWidth = slot.type === 'heavy_slash' ? 5 : 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(slot.x, slot.y, r, slot.angle - arcW, slot.angle + arcW);
          ctx.stroke();
          break;
        }
        case 'melee_lunge': {
          const lx = Math.cos(slot.angle) * r * 1.8;
          const ly = Math.sin(slot.angle) * r * 1.8;
          ctx.strokeStyle = hex;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(slot.x, slot.y); ctx.lineTo(slot.x + lx, slot.y + ly); ctx.stroke();
          // Tip arrow
          ctx.fillStyle = hex;
          ctx.beginPath();
          ctx.arc(slot.x + lx, slot.y + ly, 4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'enemy_aoe_telegraph': {
          ctx.strokeStyle = hex + 'aa';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = hex + '18';
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'enemy_aoe_blast': {
          const g2 = ctx.createRadialGradient(slot.x, slot.y, 0, slot.x, slot.y, r);
          g2.addColorStop(0, hex + 'cc');
          g2.addColorStop(0.7, hex + '44');
          g2.addColorStop(1, hex + '00');
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(slot.x, slot.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      ctx.restore();
    });

    spriteEffectsRef.current.update(dt);
    spriteEffectsRef.current.render(ctx);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px monospace";
    const tlActive = timelineRef.current.enabled;
    const label = activeTab === "heroes" ? `${s.race} ${s.heroClass} | ${tlActive ? 'custom' : s.animState}`
      : activeTab === "minions" ? `Minion: ${s.minionType}`
      : activeTab === "monsters" ? `Monster: ${s.mobType}`
      : activeTab === "structures" ? `Structure: ${s.structSubType}`
      : activeTab === "effects" ? `Effect: ${s.effectType}`
      : activeTab === "animals" ? `Animal: ${s.animalType}`
      : `Env: ${s.envSubType}`;
    ctx.fillText(`${label}  t:${t.toFixed(3)}  ${speedRef.current.toFixed(1)}x`, 8, canvas.height - 8);

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, [activeTab]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [renderFrame]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (activeTab !== 'heroes') return;
      if (e.key === 'm' || e.key === 'M') setGizmoMode('move');
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) setGizmoMode('rotate');
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) setGizmoMode('scale');
      if (e.key === 'g' || e.key === 'G') setShowGizmo(prev => !prev);
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey) captureSnapshot();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeTab, captureSnapshot]);

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
            {activeTab === 'heroes' && timeline.enabled && (
              <div className="absolute top-3 left-3 flex gap-1 z-10">
                <button data-testid="btn-gizmo-move"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all ${gizmoMode === 'move' ? 'bg-red-900/60 text-red-400 border border-red-600' : 'bg-black/60 text-gray-400 hover:text-gray-200 border border-gray-700/50'}`}
                  onClick={() => setGizmoMode('move')} title="Move (M)">
                  <Move className="w-4 h-4" />
                </button>
                <button data-testid="btn-gizmo-rotate"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all ${gizmoMode === 'rotate' ? 'bg-amber-900/60 text-amber-400 border border-amber-600' : 'bg-black/60 text-gray-400 hover:text-gray-200 border border-gray-700/50'}`}
                  onClick={() => setGizmoMode('rotate')} title="Rotate (R)">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button data-testid="btn-gizmo-scale"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all ${gizmoMode === 'scale' ? 'bg-purple-900/60 text-purple-400 border border-purple-600' : 'bg-black/60 text-gray-400 hover:text-gray-200 border border-gray-700/50'}`}
                  onClick={() => setGizmoMode('scale')} title="Scale (S)">
                  <Maximize2 className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-700/50 mx-0.5" />
                <button data-testid="btn-toggle-gizmo"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all ${showGizmo ? 'bg-green-900/40 text-green-400 border border-green-700' : 'bg-black/60 text-gray-500 border border-gray-700/50'}`}
                  onClick={() => setShowGizmo(!showGizmo)} title="Toggle Gizmo">
                  {showGizmo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            )}

            {activeTab === 'heroes' && timeline.enabled && (
              <div className="absolute top-3 right-3 flex gap-1 z-10">
                <button data-testid="btn-capture-snapshot"
                  className="h-8 px-3 rounded bg-amber-900/60 text-amber-400 border border-amber-600 text-xs flex items-center gap-1.5 hover:bg-amber-800/60 transition-all"
                  onClick={captureSnapshot} title="Capture Snapshot">
                  <Camera className="w-3.5 h-3.5" /> Snapshot
                </button>
                {snapshots.length >= 2 && (
                  <>
                    <button data-testid="btn-apply-snapshots"
                      className="h-8 px-3 rounded bg-purple-900/60 text-purple-400 border border-purple-600 text-xs flex items-center gap-1.5 hover:bg-purple-800/60 transition-all"
                      onClick={() => applySnapshotsToTimeline(false)} title="Apply Snapshots to Timeline">
                      <Film className="w-3.5 h-3.5" /> Apply
                    </button>
                    <button data-testid="btn-ai-smooth"
                      className="h-8 px-3 rounded bg-green-900/60 text-green-400 border border-green-600 text-xs flex items-center gap-1.5 hover:bg-green-800/60 transition-all"
                      onClick={() => applySnapshotsToTimeline(true)} title="AI Smooth Animation">
                      <Wand2 className="w-3.5 h-3.5" /> AI Smooth
                    </button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'heroes' && snapshots.length > 0 && (
              <div className="absolute bottom-12 left-3 right-3 z-10">
                <div className="bg-black/80 backdrop-blur rounded border border-gray-700/50 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-amber-400 font-bold uppercase">Snapshots ({snapshots.length})</span>
                    <button className="text-[10px] text-gray-500 hover:text-red-400" data-testid="btn-clear-snapshots"
                      onClick={() => setSnapshots([])}>Clear All</button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {snapshots.map((snap, idx) => (
                      <div key={snap.id} data-testid={`snapshot-${snap.id}`}
                        className="flex-shrink-0 bg-gray-900/80 rounded px-2 py-1 border border-gray-700/50 hover:border-amber-700/50 transition-all cursor-pointer group"
                        onClick={() => setAnimTimerDirect(snap.time)}>
                        <div className="text-[9px] text-amber-400 font-mono">{snap.label}</div>
                        <div className="text-[8px] text-gray-500">t:{snap.time.toFixed(2)}s</div>
                        <button className="text-[8px] text-gray-600 hover:text-red-400 mt-0.5"
                          onClick={(e) => { e.stopPropagation(); setSnapshots(prev => prev.filter(s => s.id !== snap.id)); }}>
                          remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'heroes' && timeline.enabled && (
              <div className="absolute top-14 left-3 z-10 w-40" data-testid="brush-palette">
                <div className="bg-black/85 backdrop-blur rounded-lg border border-gray-700/50 p-2">
                  <div className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5">Anim Brushes</div>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {ANIM_BRUSHES.map(brush => (
                      <button key={brush.id} data-testid={`btn-brush-${brush.id}`}
                        className={`px-1.5 py-1 rounded text-[9px] font-semibold transition-all border ${activeBrush === brush.id
                          ? 'border-opacity-80 shadow-lg'
                          : 'border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600/60'}`}
                        style={activeBrush === brush.id ? { borderColor: brush.color, color: brush.color, backgroundColor: brush.color + '20', boxShadow: `0 0 8px ${brush.color}40` } : {}}
                        onClick={() => setActiveBrush(activeBrush === brush.id ? null : brush.id)}
                        title={brush.desc}>
                        {brush.label}
                      </button>
                    ))}
                  </div>
                  {activeBrush && (
                    <>
                      <div className="text-[8px] text-gray-400 mb-1.5">
                        {ANIM_BRUSHES.find(b => b.id === activeBrush)?.desc}
                      </div>
                      <div className="text-[9px] text-gray-400 mb-1">Target Parts</div>
                      <div className="flex flex-wrap gap-0.5 mb-2">
                        {BODY_PARTS.map(part => (
                          <button key={part} data-testid={`btn-brush-part-${part}`}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all border ${brushTargetParts.has(part)
                              ? 'border-opacity-70'
                              : 'border-gray-700/40 text-gray-600 hover:text-gray-400'}`}
                            style={brushTargetParts.has(part) ? { borderColor: PART_COLORS[part], color: PART_COLORS[part], backgroundColor: PART_COLORS[part] + '15' } : {}}
                            onClick={() => toggleBrushPart(part)}>
                            {PART_LABELS[part]}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-[9px]">
                          <span className="text-gray-400">Intensity</span>
                          <span className="text-cyan-400 font-mono">{brushIntensity.toFixed(1)}x</span>
                        </div>
                        <Slider min={0.1} max={3} step={0.1} value={[brushIntensity]} onValueChange={([v]) => setBrushIntensity(v)} />
                      </div>
                      <button data-testid="btn-brush-apply"
                        className="w-full h-7 rounded text-[10px] font-bold transition-all border flex items-center justify-center gap-1"
                        style={{ borderColor: ANIM_BRUSHES.find(b => b.id === activeBrush)?.color || '#888', color: ANIM_BRUSHES.find(b => b.id === activeBrush)?.color || '#888', backgroundColor: (ANIM_BRUSHES.find(b => b.id === activeBrush)?.color || '#888') + '20' }}
                        disabled={brushTargetParts.size === 0}
                        onClick={() => applyBrush(activeBrush)}>
                        <Wand2 className="w-3 h-3" /> Paint {ANIM_BRUSHES.find(b => b.id === activeBrush)?.label}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            <canvas ref={canvasRef} width={640} height={520}
              className="rounded-lg border border-gray-800/30"
              data-testid="editor-preview-canvas"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              style={{ cursor: activeTab === 'heroes' && showGizmo && timeline.enabled ? 'crosshair' : 'default' }} />
            <div className="absolute bottom-3 left-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-gray-400" data-testid="text-entity-label">
                {activeTab === "heroes" ? `${state.race} ${state.heroClass}` :
                 activeTab === "minions" ? `${state.minionType} minion` :
                 activeTab === "monsters" ? `${state.mobType} mob` :
                 activeTab === "structures" ? state.structSubType :
                 activeTab === "effects" ? state.effectType :
                 activeTab === "animals" ? state.animalType :
                 state.envSubType}
              </div>
            </div>
            <div className="absolute bottom-3 right-3 flex gap-2">
              <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] text-amber-400 font-mono" data-testid="text-timer-display">
                t:{animTimer.toFixed(3)}
              </div>
              {selectedPart && (
                <div className="bg-black/60 backdrop-blur rounded px-2 py-1 text-[10px] font-mono" data-testid="text-selected-part"
                  style={{ color: PART_COLORS[selectedPart] || '#888' }}>
                  {PART_LABELS[selectedPart] || selectedPart} | {gizmoMode}
                </div>
              )}
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
              <EffectsPanel state={state} setState={setState} onPlayEffect={playEffect} onPlayCanvasEffect={playCanvasEffect} />
            )}
            {activeTab === "environment" && (
              <EnvironmentPanel state={state} setState={setState} />
            )}
            {activeTab === "animals" && (
              <AnimalsPanel state={state} setState={setState} playing={playing} setPlaying={setPlaying}
                speed={speed} setSpeed={setSpeed} animTimer={animTimer} resetTimer={resetTimer} />
            )}
            {activeTab === "glb_effects" && (
              <div className="space-y-4">
                <SectionHeader title="GLB Effect Models" />
                <p className="text-gray-500 text-[10px]">3D GLB spell effects rendered as 2D sprites. Used for projectiles, shields, and ability overlays.</p>
                <div className="space-y-1">
                  {[
                    { id: 'fireball', name: 'Fireball', color: '#ef4444', file: 'Fireball.glb' },
                    { id: 'ice_lance', name: 'Ice Lance', color: '#38bdf8', file: 'Ice Lance.glb' },
                    { id: 'ice_lance_2', name: 'Ice Lance II', color: '#0ea5e9', file: 'Ice Lance 2.glb' },
                    { id: 'ice_lance_3', name: 'Ice Lance III', color: '#0284c7', file: 'Ice Lance 3.glb' },
                    { id: 'ice_rock', name: 'Ice Rock', color: '#67e8f9', file: 'Ice Rock.glb' },
                    { id: 'dark_shield', name: 'Dark Shield', color: '#6b21a8', file: 'Dark_Shield.glb' },
                    { id: 'nature_shield', name: 'Nature Shield', color: '#22c55e', file: 'Nature_Shield.glb' },
                    { id: 'distortion', name: 'Distortion', color: '#a855f7', file: 'Distortion.glb' },
                    { id: 'crystal', name: 'Crystal', color: '#06b6d4', file: 'Crystal.glb' },
                    { id: 'skull', name: 'Skull', color: '#f87171', file: 'Skull.glb' },
                    { id: 'root', name: 'Root', color: '#65a30d', file: 'Root.glb' },
                    { id: 'rock_icicle', name: 'Rock Icicle', color: '#64748b', file: 'Rock Icicle.glb' },
                    { id: 'potion', name: 'Potion', color: '#ec4899', file: 'Potion.glb' },
                    { id: 'tome', name: 'Tome', color: '#f59e0b', file: 'Tome.glb' },
                    { id: 'book', name: 'Book', color: '#d97706', file: 'Book.glb' },
                  ].map(eff => (
                    <div key={eff.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5 hover:bg-black/30 transition-colors">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: eff.color }} />
                      <span className="text-gray-300 text-xs flex-1">{eff.name}</span>
                      <span className="text-gray-600 text-[10px]">{eff.file}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Class Mappings" />
                <div className="bg-black/20 rounded p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Warrior</span><span className="text-red-400">Fireball + Dark Shield</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Mage</span><span className="text-blue-400">Ice Lance + Nature Shield</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Ranger</span><span className="text-green-400">Ice Rock + Nature Shield</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Worg</span><span className="text-amber-400">Skull + Dark Shield</span></div>
                </div>
              </div>
            )}
            {activeTab === "characters" && (
              <div className="space-y-4">
                <SectionHeader title="GLB Character Models" />
                <p className="text-gray-500 text-[10px]">All 3D character models with embedded animations. Click to see details.</p>
                {[
                  { cat: 'Animated Characters', items: [
                    { name: 'Human', file: 'Animated_Human.glb', anims: 8 },
                    { name: 'Wizard', file: 'Animated_Wizard.glb', anims: 15 },
                    { name: 'Woman', file: 'Animated_Woman.glb', anims: 24 },
                    { name: 'Zombie', file: 'Animated_Zombie.glb', anims: 5 },
                    { name: 'Anne', file: 'Anne.glb', anims: 14 },
                    { name: 'Pirate Captain', file: 'Pirate_Captain.glb', anims: 14 },
                    { name: 'Skeleton', file: 'Skeleton.glb', anims: 15 },
                    { name: 'Toon Character', file: 'Character_Toon_Animated.glb', anims: 24 },
                  ]},
                  { cat: 'Faction Heroes', items: [
                    { name: 'Barbarian Gladiator', file: 'BarbarianGlad.glb', anims: 19 },
                    { name: 'Berserker', file: 'berserker.glb', anims: 17 },
                    { name: 'Dwarf Enforcer', file: 'dwarf_enforcer.glb', anims: 17 },
                    { name: 'Elf Ranger', file: 'ElfRanger.glb', anims: 18 },
                    { name: 'Elf Enforcer', file: 'elf_enforcer.glb', anims: 17 },
                    { name: 'Fabled Worker', file: 'fabledworker.glb', anims: 9 },
                    { name: 'Graat Orc', file: 'graatorc.glb', anims: 20 },
                    { name: 'Human Deathgiver', file: 'humandeathgiver.glb', anims: 14 },
                    { name: 'Orc Peon', file: 'orcpeon.glb', anims: 15 },
                    { name: 'Siegeman', file: 'siegeman.glb', anims: 19 },
                    { name: 'Skullgoon', file: 'skullgoon.glb', anims: 15 },
                    { name: 'Undead Worker', file: 'undeadworker.glb', anims: 14 },
                  ]},
                  { cat: 'Creatures', items: [
                    { name: 'Wolf', file: 'Wolf.glb', anims: 24 },
                    { name: 'Velociraptor', file: 'Velociraptor.glb', anims: 6 },
                    { name: 'Dragon', file: 'Dragon.glb', anims: 5 },
                    { name: 'Shark', file: 'Shark.glb', anims: 3 },
                    { name: 'Slime', file: 'SlimeEnemy.glb', anims: 10 },
                    { name: 'Goblin Crew', file: 'GoblinCr3w.glb', anims: 17 },
                  ]},
                ].map(cat => (
                  <div key={cat.cat}>
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">{cat.cat}</div>
                    <div className="space-y-1">
                      {cat.items.map(item => (
                        <div key={item.file} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5 hover:bg-black/30">
                          <span className="text-gray-300 text-xs flex-1">{item.name}</span>
                          <span className="text-amber-400 text-[10px]">{item.anims} anims</span>
                          <span className="text-gray-600 text-[9px]">{item.file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "map_objects" && (
              <div className="space-y-4">
                <SectionHeader title="Spawners" />
                <div className="space-y-1">
                  {[{ id: 'minion', name: 'Minion Spawner', color: '#3b82f6' }, { id: 'boss', name: 'Boss Spawner', color: '#ef4444' }, { id: 'neutral', name: 'Neutral Spawner', color: '#a3a3a3' }, { id: 'event', name: 'Event Spawner', color: '#f59e0b' }].map(s => (
                    <div key={s.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-gray-300 text-xs">{s.name}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Events" />
                <div className="space-y-1">
                  {['ambush', 'quest_start', 'boss_spawn', 'loot_drop', 'trap', 'cutscene', 'portal', 'buff_zone'].map(a => (
                    <div key={a} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <span className="text-amber-400 text-xs">⚡</span>
                      <span className="text-gray-300 text-xs capitalize">{a.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Vendors" />
                <div className="space-y-1">
                  {[{ id: 'shop', name: 'Shop', color: '#ffd700' }, { id: 'faction', name: 'Faction Vendor', color: '#a855f7' }, { id: 'crafting', name: 'Crafting Station', color: '#f97316' }].map(v => (
                    <div key={v.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: v.color }} />
                      <span className="text-gray-300 text-xs">{v.name}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Harvestables" />
                <div className="space-y-1">
                  {[{ id: 'ore', name: 'Ore Vein', color: '#78716c', icon: '⛏️' }, { id: 'herb', name: 'Herb', color: '#4ade80', icon: '🌿' }, { id: 'wood', name: 'Wood', color: '#a16207', icon: '🪵' }, { id: 'fish', name: 'Fishing Spot', color: '#38bdf8', icon: '🐟' }, { id: 'gem', name: 'Gem Deposit', color: '#c084fc', icon: '💎' }].map(r => (
                    <div key={r.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <span>{r.icon}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-gray-300 text-xs">{r.name}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Camp Types" />
                <div className="space-y-1">
                  {[{ id: 'small', name: 'Small Camp', color: '#65a30d', mobs: 3 }, { id: 'medium', name: 'Medium Camp', color: '#3b82f6', mobs: 2 }, { id: 'buff', name: 'Buff Camp', color: '#a855f7', mobs: 1 }, { id: 'boss', name: 'Boss Pit', color: '#ef4444', mobs: 1 }].map(c => (
                    <div key={c.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="text-gray-300 text-xs flex-1">{c.name}</span>
                      <span className="text-gray-500 text-[10px]">{c.mobs} mobs</span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-600 text-[10px]">Place these on the map at /mapadmin</p>
              </div>
            )}
            {activeTab === "tiles" && (
              <div className="space-y-4">
                <SectionHeader title="Terrain Types" />
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 0, name: 'Grass', color: '#2a5c1a' }, { id: 1, name: 'Dirt', color: '#6b4423' },
                    { id: 2, name: 'Stone', color: '#5a5a6a' }, { id: 3, name: 'Water', color: '#1a4a8a' },
                    { id: 4, name: 'Lane', color: '#4a4030' }, { id: 5, name: 'Jungle', color: '#1a3a12' },
                    { id: 6, name: 'Base Blue', color: '#1a2a5a' }, { id: 7, name: 'Base Red', color: '#5a1a1a' },
                    { id: 8, name: 'River', color: '#1a5a7a' }, { id: 9, name: 'Jungle Path', color: '#3a3020' },
                    { id: 10, name: 'Dense Woods', color: '#0f2e0a' }, { id: 11, name: 'Stone Wall', color: '#3a3a4a' },
                  ].map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-black/20 rounded px-2 py-1.5">
                      <div className="w-5 h-5 rounded" style={{ backgroundColor: t.color }} />
                      <span className="text-gray-300 text-[10px]">{t.name}</span>
                      <span className="text-gray-600 text-[9px] ml-auto">id:{t.id}</span>
                    </div>
                  ))}
                </div>
                <SectionHeader title="Height Rules" />
                <div className="bg-black/20 rounded p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Height 0</span><span className="text-blue-400">→ Water (auto)</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Height 1</span><span className="text-green-400">→ Ground (walkable)</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Height 2</span><span className="text-amber-400">→ Hill (walkable)</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Height 3+</span><span className="text-red-400">→ Cliff (impassable)</span></div>
                </div>
                <SectionHeader title="Decoration Types" />
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {[
                    { cat: 'Trees', items: ['Common Tree', 'Pine Tree', 'Birch Tree', 'Dead Tree', 'Large Tree', 'Lava Tree', 'Tree House', 'Twisted Tree'] },
                    { cat: 'Rocks', items: ['Rock', 'Large Rock', 'Mountain Rock 1-5', 'Pebble'] },
                    { cat: 'Volcano', items: ['Volcano 1-3', 'Boulder 1-3', 'Lava Pool'] },
                    { cat: 'Nature', items: ['Bush', 'Flower Bush', 'Fern', 'Mushroom', 'Flower', 'Tall Grass', 'Short Grass', 'Clover', 'Plant'] },
                    { cat: 'Buildings', items: ['Coliseum', 'Barracks', 'Forge', 'Crypt', 'Arch', 'Cabin', 'Tower'] },
                    { cat: 'Effects', items: ['Camp Fire', 'Fountain Fire', 'Spike Trap', 'Rune Trap'] },
                  ].map(group => (
                    <div key={group.cat}>
                      <div className="text-[9px] text-gray-500 uppercase font-bold mt-2">{group.cat}</div>
                      {group.items.map(item => (
                        <div key={item} className="text-gray-400 text-[10px] pl-2">{item}</div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-gray-600 text-[10px]">Paint terrain and place decorations at /mapadmin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
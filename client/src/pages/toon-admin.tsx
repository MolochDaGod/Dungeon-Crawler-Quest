import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { VoxelRenderer } from "@/game/voxel";
import { SpriteEffectSystem, SpriteEffectType } from "@/game/sprite-effects";
import { HEROES, RACE_COLORS, CLASS_COLORS } from "@/game/types";
import {
  buildHeroRig, defaultRigPose, idleRigPose, walkRigPose, attackRigPose,
  dodgeRigPose, blockRigPose, deathRigPose, castRigPose, comboRigPose, lungeRigPose,
  mixamoToRigPose, getRigPoseForState, lerpRigPose, ALL_PARTS,
  type HeroRig, type HeroRigPose, type PartId, type WeaponType,
} from "@/game/voxel-parts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Move, RotateCw, Maximize2, Eye, EyeOff,
  Play, Pause, RotateCcw, SkipForward, SkipBack,
  Copy, User, Footprints, Bug, Castle, TreePine,
  Bird, Sparkles, Crosshair, Cpu,
} from "lucide-react";

// ─────────────── Constants ───────────────
const RACES = ["Human", "Barbarian", "Dwarf", "Elf", "Orc", "Undead"];
const CLASSES = ["Warrior", "Worg", "Mage", "Ranger"];
const ANIM_STATES = [
  "idle", "walk", "attack", "combo_finisher", "ability",
  "dodge", "block", "dash_attack", "lunge_slash", "death",
];
const BODY_PARTS = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "weapon"] as const;
type BodyPart = typeof BODY_PARTS[number];
type GizmoMode = "move" | "rotate" | "scale";

const PART_LABELS: Record<string, string> = {
  leftLeg: "L.Leg", rightLeg: "R.Leg", leftArm: "L.Arm",
  rightArm: "R.Arm", torso: "Torso", head: "Head", weapon: "Wpn",
};
const PART_COLORS: Record<string, string> = {
  leftLeg: "#3b82f6", rightLeg: "#6366f1", leftArm: "#22c55e",
  rightArm: "#10b981", torso: "#f59e0b", head: "#ef4444", weapon: "#a855f7",
};
// Default gizmo anchor positions (in voxel-space units, relative to character center)
const GIZMO_ANCHORS: Record<BodyPart, { sx: number; sy: number }> = {
  head:     { sx: 0,   sy: -18 },
  torso:    { sx: 0,   sy: -8  },
  leftArm:  { sx: -12, sy: -8  },
  rightArm: { sx: 12,  sy: -8  },
  leftLeg:  { sx: -5,  sy: 4   },
  rightLeg: { sx: 5,   sy: 4   },
  weapon:   { sx: -16, sy: -12 },
};

const MINION_TYPES = ["melee", "ranged", "siege", "super"] as const;
const MOB_TYPES    = ["small", "medium", "buff"] as const;
const STRUCT_TYPES = ["tower", "nexus", "house", "bridge", "well", "shrine", "gate", "wall"] as const;
const ENV_TYPES    = ["tree", "rock", "mountain", "terrain_prop"] as const;
const ANIMAL_TYPES = ["deer", "boar", "horse", "hawk", "fish"] as const;
type TabId = "heroes" | "minions" | "monsters" | "structures" | "environment" | "animals" | "effects";

const SPRITE_EFFECT_TYPES: SpriteEffectType[] = [
  "mage_ability","mage_attack","frost","channel","magic_impact",
  "fire_ability","warrior_spin","shield","buff","melee_impact",
  "fire_attack","ultimate","dash","undead","charging",
  "holy","dark_magic","shadow","ice","healing",
];

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "heroes",      label: "Heroes",      icon: User      },
  { id: "minions",     label: "Minions",     icon: Footprints },
  { id: "monsters",    label: "Monsters",    icon: Bug        },
  { id: "structures",  label: "Structures",  icon: Castle     },
  { id: "environment", label: "Env",         icon: TreePine   },
  { id: "animals",     label: "Animals",     icon: Bird       },
  { id: "effects",     label: "FX",          icon: Sparkles   },
];

// ─────────────── Pose State ───────────────
interface PartPose { ox: number; oy: number; oz: number; rotation: number; scale: number; }
type PoseOffsets = Record<BodyPart, PartPose>;

function defaultPose(): PoseOffsets {
  return Object.fromEntries(
    BODY_PARTS.map(p => [p, { ox: 0, oy: 0, oz: 0, rotation: 0, scale: 1 }])
  ) as PoseOffsets;
}

// ─────────────── Helpers ───────────────
function LabeledSlider({ label, value, min, max, step, onChange, suffix }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-amber-400 font-mono">{value.toFixed(step < 1 ? 2 : 0)}{suffix || ""}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-xs font-bold text-amber-400 border-b border-amber-900/30 pb-1 mb-2 uppercase tracking-wider">{title}</h3>;
}

// ─────────────── Main Page ───────────────
export default function ToonAdminPage() {
  const [, setLocation] = useLocation();

  // ── Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef  = useRef<VoxelRenderer | null>(null);
  const fxRef     = useRef<SpriteEffectSystem | null>(null);
  const rafRef    = useRef<number>(0);
  const lastTRef  = useRef<number>(0);
  const timerRef  = useRef(0);
  const playRef   = useRef(true);
  const speedRef  = useRef(1);

  // ── Rig state
  const [rigMode,    setRigMode]    = useState(false);
  const [rigLive,    setRigLive]    = useState(true);
  const [rigWeapon,  setRigWeapon]  = useState<WeaponType | 'class'>('class');
  const [rigPose,    setRigPose]    = useState<HeroRigPose>(idleRigPose());
  const [mixamoJson, setMixamoJson] = useState('');
  const [mixamoErr,  setMixamoErr]  = useState('');
  const rigPoseRef  = useRef<HeroRigPose>(idleRigPose());
  const rigRef      = useRef<HeroRig | null>(null);
  const rigModeRef   = useRef(false);
  const rigLiveRef   = useRef(true);
  const rigWeaponRef = useRef<WeaponType | 'class'>('class');
  useEffect(() => { rigModeRef.current   = rigMode;   }, [rigMode]);
  useEffect(() => { rigLiveRef.current   = rigLive;   }, [rigLive]);
  useEffect(() => { rigPoseRef.current   = rigPose;   }, [rigPose]);
  useEffect(() => { rigWeaponRef.current = rigWeapon; rigRef.current = null; }, [rigWeapon]);

  // ── Gizmo state (held in refs for the render loop)
  const selectedPartRef = useRef<BodyPart | null>(null);
  const gizmoModeRef    = useRef<GizmoMode>("move");
  const showGizmoRef    = useRef(true);
  const poseRef         = useRef<PoseOffsets>(defaultPose());
  const dragRef         = useRef<{
    part: BodyPart; startX: number; startY: number;
    startOx: number; startOy: number; startOz: number;
    startRot: number; startScale: number;
  } | null>(null);

  // ── React state (UI)
  const [activeTab,    setActiveTab]    = useState<TabId>("heroes");
  const [playing,      setPlaying]      = useState(true);
  const [speed,        setSpeed]        = useState(1);
  const [animTimer,    setAnimTimer]    = useState(0);
  const [gizmoMode,    setGizmoMode]    = useState<GizmoMode>("move");
  const [showGizmo,    setShowGizmo]    = useState(true);
  const [selectedPart, setSelectedPart] = useState<BodyPart | null>(null);
  const [pose,         setPose]         = useState<PoseOffsets>(defaultPose());

  // Hero
  const [race,       setRace]       = useState("Human");
  const [heroClass,  setHeroClass]  = useState("Warrior");
  const [animState,  setAnimState]  = useState("idle");
  const [facing,     setFacing]     = useState(0);
  const facingRef    = useRef(0);
  const animStateRef = useRef("idle");
  const raceRef      = useRef("Human");
  const heroClassRef = useRef("Warrior");

  // Other entities
  const [minionType,   setMinionType]   = useState<typeof MINION_TYPES[number]>("melee");
  const [minionColor,  setMinionColor]  = useState("#3b82f6");
  const [mobType,      setMobType]      = useState<typeof MOB_TYPES[number]>("small");
  const [structType,   setStructType]   = useState<typeof STRUCT_TYPES[number]>("tower");
  const [structColor,  setStructColor]  = useState("#3b82f6");
  const [structTier,   setStructTier]   = useState(0);
  const [envType,      setEnvType]      = useState<typeof ENV_TYPES[number]>("tree");
  const [envSeed,      setEnvSeed]      = useState(0);
  const [animalType,   setAnimalType]   = useState<typeof ANIMAL_TYPES[number]>("deer");
  const [fxType,       setFxType]       = useState<SpriteEffectType>("melee_impact");
  const [fxScale,      setFxScale]      = useState(1.5);

  // ── Keep refs in sync
  useEffect(() => { playRef.current    = playing;   }, [playing]);
  useEffect(() => { speedRef.current   = speed;     }, [speed]);
  useEffect(() => { gizmoModeRef.current = gizmoMode;}, [gizmoMode]);
  useEffect(() => { showGizmoRef.current = showGizmo;}, [showGizmo]);
  useEffect(() => { selectedPartRef.current = selectedPart; }, [selectedPart]);
  useEffect(() => { poseRef.current    = pose;      }, [pose]);
  useEffect(() => { facingRef.current  = facing;    }, [facing]);
  useEffect(() => { animStateRef.current = animState;}, [animState]);
  useEffect(() => { raceRef.current    = race;      rigRef.current = null; }, [race]);
  useEffect(() => { heroClassRef.current = heroClass; rigRef.current = null; }, [heroClass]);

  const activeTabRef = useRef<TabId>("heroes");
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ── Timer controls
  const resetTimer = useCallback(() => { timerRef.current = 0; setAnimTimer(0); }, []);
  const stepFrame  = useCallback(() => { setPlaying(false); playRef.current = false; timerRef.current += 1/60; setAnimTimer(timerRef.current); }, []);
  const stepBack   = useCallback(() => { setPlaying(false); playRef.current = false; timerRef.current = Math.max(0, timerRef.current - 1/60); setAnimTimer(timerRef.current); }, []);

  // ── Canvas gizmo helpers
  const getGizmoScreenPos = useCallback((part: BodyPart, canvas: HTMLCanvasElement) => {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 20;
    const SCALE = 3.5;
    const anchor = GIZMO_ANCHORS[part];
    const pp = poseRef.current[part];
    return {
      px: cx + (anchor.sx + pp.ox) * SCALE,
      py: cy + (anchor.sy - pp.oz) * SCALE,
    };
  }, []);

  // ── Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeTabRef.current !== "heroes" || !showGizmoRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest: BodyPart | null = null;
    let closestDist = 22;
    for (const part of BODY_PARTS) {
      const { px, py } = getGizmoScreenPos(part, canvas);
      const d = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
      if (d < closestDist) { closestDist = d; closest = part; }
    }

    if (closest) {
      setSelectedPart(closest);
      const pp = poseRef.current[closest];
      dragRef.current = {
        part: closest,
        startX: mx, startY: my,
        startOx: pp.ox, startOy: pp.oy, startOz: pp.oz,
        startRot: pp.rotation, startScale: pp.scale,
      };
      setPlaying(false); playRef.current = false;
    } else {
      setSelectedPart(null);
    }
  }, [getGizmoScreenPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const SCALE = 3.5;
    const dx = (mx - dragRef.current.startX) / SCALE;
    const dy = (my - dragRef.current.startY) / SCALE;
    const part = dragRef.current.part;
    const mode = gizmoModeRef.current;

    setPose(prev => {
      const pp = prev[part];
      let updated: PartPose = { ...pp };
      if (mode === "move") {
        if (e.shiftKey) {
          updated.oy = Math.round(dragRef.current!.startOy - dy);
        } else {
          updated.ox = Math.round(dragRef.current!.startOx + dx);
          updated.oz = Math.round(dragRef.current!.startOz - dy);
        }
      } else if (mode === "rotate") {
        const angleDelta = Math.atan2(dy, dx) * 180 / Math.PI;
        updated.rotation = Math.round((dragRef.current!.startRot + angleDelta) / 5) * 5;
      } else if (mode === "scale") {
        const dist = Math.sqrt(dx * dx + dy * dy);
        const sign = dy < 0 ? 1 : -1;
        updated.scale = Math.max(0.2, Math.min(3, parseFloat((dragRef.current!.startScale + sign * dist * 0.05).toFixed(1))));
      }
      return { ...prev, [part]: updated };
    });
  }, []);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "m" || e.key === "M") setGizmoMode("move");
      if (e.key === "r" && !e.ctrlKey && !e.metaKey) setGizmoMode("rotate");
      if (e.key === "s" && !e.ctrlKey && !e.metaKey) setGizmoMode("scale");
      if (e.key === "g" || e.key === "G") setShowGizmo(v => !v);
      if (e.key === "Escape") setSelectedPart(null);
      if (e.key === " ") { e.preventDefault(); setPlaying(v => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Render loop
  const renderFrame = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(renderFrame); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!voxelRef.current)  voxelRef.current  = new VoxelRenderer();
    if (!fxRef.current)     fxRef.current     = new SpriteEffectSystem();

    const dt = lastTRef.current ? (timestamp - lastTRef.current) / 1000 : 0.016;
    lastTRef.current = timestamp;

    if (playRef.current) {
      timerRef.current += dt * speedRef.current;
      setAnimTimer(timerRef.current);
    }

    const t   = timerRef.current;
    const vr  = voxelRef.current;
    const tab = activeTabRef.current;
    const cx  = canvas.width  / 2;
    const cy  = canvas.height / 2 + 20;

    // ── Background
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width;  x += 20) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += 20) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    // ── Ground shadow
    ctx.save();
    const sg = ctx.createRadialGradient(cx, cy + 25, 0, cx, cy + 25, 50);
    sg.addColorStop(0, "rgba(0,0,0,0.4)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(cx, cy + 25, 50, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // ── Entity rendering
    ctx.save();
    if (tab === "heroes") {
      if (rigModeRef.current) {
        // ── Rig mode: part-based rig with per-joint rotation
        if (!rigRef.current) {
          // Use selected weapon override, or fall back to class default
          const wt = rigWeaponRef.current !== 'class' ? rigWeaponRef.current : undefined;
          rigRef.current = buildHeroRig(raceRef.current, heroClassRef.current, wt);
        }
        // Live animation: compute pose from animState each frame
        const activePose = rigLiveRef.current
          ? getRigPoseForState(animStateRef.current, t)
          : rigPoseRef.current;
        const RIG_SCALE = 2.2;
        ctx.translate(cx, cy);
        ctx.scale(RIG_SCALE, RIG_SCALE);
        vr.drawHeroVoxelRig(ctx, 0, 0, rigRef.current, activePose, facingRef.current, 1);
      } else {
        // ── Legacy mode: monolithic voxel model
        const SCALE = 3.5;
        ctx.translate(cx, cy);
        ctx.scale(SCALE, SCALE);
        const p = poseRef.current;
        const heroName = HEROES.find(h => h.race === raceRef.current && h.heroClass === heroClassRef.current)?.name || "Hero";
        const hasOffsets = BODY_PARTS.some(part => p[part].ox !== 0 || p[part].oy !== 0 || p[part].oz !== 0 || p[part].rotation !== 0 || p[part].scale !== 1);
        if (hasOffsets) {
          const fullPose: any = { weaponGlow: p.weapon.scale > 1 ? 0.8 : 0 };
          for (const part of BODY_PARTS) {
            fullPose[part] = { ox: p[part].ox, oy: p[part].oy, oz: p[part].oz };
          }
          vr.drawHeroVoxelCustomPose(ctx, 0, 0, raceRef.current, heroClassRef.current, facingRef.current, fullPose, heroName);
        } else {
          const raceColor = RACE_COLORS[raceRef.current] || "#94a3b8";
          const classColor = CLASS_COLORS[heroClassRef.current] || "#ef4444";
          vr.drawHeroVoxel(ctx, 0, 0, raceColor, classColor, heroClassRef.current, facingRef.current, animStateRef.current, t, raceRef.current, heroName);
        }
      }
    } else if (tab === "minions") {
      const SCALE = 4.0;
      ctx.translate(cx, cy); ctx.scale(SCALE, SCALE);
      vr.drawMinionVoxel(ctx, 0, 0, minionColor, 1, facingRef.current, t, minionType);
    } else if (tab === "monsters") {
      const SCALE = mobType === "buff" ? 3.5 : mobType === "medium" ? 4.0 : 5.0;
      ctx.translate(cx, cy); ctx.scale(SCALE, SCALE);
      vr.drawJungleMobVoxel(ctx, 0, 0, mobType, facingRef.current, t);
    } else if (tab === "structures") {
      const SCALE = 2.5;
      ctx.translate(cx, cy + 30); ctx.scale(SCALE, SCALE);
      switch (structType) {
        case "nexus":  vr.drawNexusVoxel(ctx, 0, 0, structColor); break;
        case "house":  vr.drawHouseVoxel(ctx, 0, 0, structColor); break;
        case "bridge": vr.drawBridgeVoxel(ctx, 0, 0); break;
        case "well":   vr.drawWellVoxel(ctx, 0, 0); break;
        case "shrine": vr.drawShrineVoxel(ctx, 0, 0, structColor); break;
        case "gate":   vr.drawGateVoxel(ctx, 0, 0, structColor); break;
        case "wall":   vr.drawWallSegmentVoxel(ctx, 0, 0, structColor); break;
        default:       vr.drawTowerVoxel(ctx, 0, 0, structColor, structTier); break;
      }
    } else if (tab === "environment") {
      const SCALE = 3.0;
      ctx.translate(cx, cy + 20); ctx.scale(SCALE, SCALE);
      vr.drawTreeVoxel(ctx, 0, 0, envSeed);
    } else if (tab === "animals") {
      const SCALE = 4.0;
      ctx.translate(cx, cy); ctx.scale(SCALE, SCALE);
      switch (animalType) {
        case "boar":  vr.drawBoarVoxel(ctx, 0, 0, facingRef.current, t); break;
        case "horse": vr.drawHorseVoxel(ctx, 0, 0, facingRef.current, t); break;
        case "hawk":  vr.drawHawkVoxel(ctx, 0, 0, facingRef.current, t); break;
        case "fish":  vr.drawFishVoxel(ctx, 0, 0, facingRef.current, t); break;
        default:      vr.drawDeerVoxel(ctx, 0, 0, facingRef.current, t); break;
      }
    } else if (tab === "effects") {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-70,cy); ctx.lineTo(cx+70,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy-70); ctx.lineTo(cx,cy+70); ctx.stroke();
    }
    ctx.restore();

    // ── Gizmo overlay (heroes only, always on)
    if (tab === "heroes" && showGizmoRef.current) {
      ctx.save();
      const SCALE = 3.5;
      const selPart = selectedPartRef.current;
      const mode    = gizmoModeRef.current;
      const p       = poseRef.current;

      for (const part of BODY_PARTS) {
        const anchor = GIZMO_ANCHORS[part];
        const pp     = p[part];
        const px     = cx + (anchor.sx + pp.ox) * SCALE;
        const py     = cy + (anchor.sy - pp.oz) * SCALE;
        const isSel  = part === selPart;
        const color  = PART_COLORS[part] || "#888";

        // ── Handle circle (square-ish with fill)
        const sz = isSel ? 7 : 5;
        ctx.fillStyle   = isSel ? color : color + "55";
        ctx.strokeStyle = isSel ? "#ffffff" : color + "99";
        ctx.lineWidth   = isSel ? 2 : 1;
        // Draw a rounded square handle
        ctx.beginPath();
        ctx.roundRect(px - sz, py - sz, sz*2, sz*2, 2);
        ctx.fill();
        ctx.stroke();

        // ── Gizmo widgets for selected part
        if (isSel) {
          if (mode === "move") {
            // X axis arrow (red)
            ctx.strokeStyle = "#ef4444"; ctx.fillStyle = "#ef4444"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 26, py); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px+22, py-4); ctx.lineTo(px+26, py); ctx.lineTo(px+22, py+4); ctx.closePath(); ctx.fill();
            // Y axis arrow (yellow — the one the user sees)
            ctx.strokeStyle = "#eab308"; ctx.fillStyle = "#eab308"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 26); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(px-4, py-22); ctx.lineTo(px, py-26); ctx.lineTo(px+4, py-22); ctx.closePath(); ctx.fill();
            // Shift-drag hint (Z / forward)
            ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 10, py + 10); ctx.stroke();
          } else if (mode === "rotate") {
            const rot = (pp.rotation ?? 0) * Math.PI / 180;
            ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(rot)*18, py - Math.sin(rot)*18); ctx.stroke();
          } else if (mode === "scale") {
            const sc = pp.scale ?? 1;
            const hs = 11 * sc;
            ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 1.5;
            ctx.strokeRect(px - hs, py - hs, hs*2, hs*2);
            ctx.fillStyle = "#8b5cf6";
            ctx.fillRect(px + hs - 4, py + hs - 4, 8, 8);
            ctx.fillRect(px - hs - 4, py + hs - 4, 8, 8);
            ctx.fillRect(px + hs - 4, py - hs - 4, 8, 8);
            ctx.fillRect(px - hs - 4, py - hs - 4, 8, 8);
          }

          // ── World-space info badge
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.beginPath(); ctx.roundRect(px + 10, py - 36, 90, 34, 4); ctx.fill();
          ctx.fillStyle = "#fff"; ctx.font = "9px monospace"; ctx.textAlign = "left";
          ctx.fillText(`ox:${pp.ox}  oy:${pp.oy}  oz:${pp.oz}`, px + 14, py - 24);
          ctx.fillText(`rot:${pp.rotation}°  sc:${pp.scale.toFixed(1)}x`, px + 14, py - 12);
        }

        // ── Part label
        ctx.fillStyle   = isSel ? "#ffffff" : "rgba(255,255,255,0.55)";
        ctx.font        = `${isSel ? "bold" : "normal"} 8px monospace`;
        ctx.textAlign   = "center";
        ctx.fillText(PART_LABELS[part] || part, px, py + (isSel ? 20 : 16));
      }
      ctx.restore();
    }

    // ── Sprite FX
    fxRef.current.update(dt);
    fxRef.current.render(ctx);

    // ── HUD
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px monospace"; ctx.textAlign = "left";
    ctx.fillText(`${tab} | t:${t.toFixed(3)}  ${speedRef.current.toFixed(1)}x  [M]move [R]rot [S]scale [G]gizmo`, 8, canvas.height - 8);

    rafRef.current = requestAnimationFrame(renderFrame);
  }, []); // No deps — all state via refs

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [renderFrame]);

  // ── Pose helpers
  const updatePartPose = (part: BodyPart, field: keyof PartPose, value: number) => {
    setPose(prev => ({ ...prev, [part]: { ...prev[part], [field]: value } }));
  };
  const resetPose = () => { setPose(defaultPose()); setSelectedPart(null); };
  const exportPose = () => {
    navigator.clipboard.writeText(JSON.stringify(pose, null, 2));
  };


  return (
    <div className="h-screen flex bg-[#0a0a14] text-white overflow-hidden" data-testid="toon-admin-page">
      {/* ── Left icon nav */}
      <div className="w-14 bg-[#0d0d1a] border-r border-gray-800/50 flex flex-col items-center py-3 gap-1">
        <Button variant="ghost" size="sm" className="w-10 h-10 p-0 mb-3" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </Button>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} title={tab.label}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all
                ${activeTab === tab.id
                  ? "bg-amber-900/40 text-amber-400 shadow-lg shadow-amber-900/20"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"}`}
              onClick={() => setActiveTab(tab.id)}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* ── Main area */}
      <div className="flex-1 flex">
        {/* ── Canvas viewport */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-12 bg-[#0d0d1a] border-b border-gray-800/50 flex items-center px-4 gap-3">
            <h1 className="text-amber-400 font-bold text-sm tracking-wider uppercase">Toon Admin</h1>
            <span className="text-gray-600 text-xs">2D Sprite Editor</span>
            <div className="flex-1" />

            {/* Hero quick-select */}
            {activeTab === "heroes" && (
              <Select value={`${race}-${heroClass}`} onValueChange={v => {
                const [r, c] = v.split("-");
                setRace(r); setHeroClass(c);
              }}>
                <SelectTrigger className="w-52 h-8 text-xs"><SelectValue /></SelectTrigger>
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

          {/* Canvas + gizmo toolbar */}
          <div className="flex-1 flex items-center justify-center bg-[#08080f] relative">

            {/* Gizmo toolbar (top-left overlay) */}
            {activeTab === "heroes" && (
              <div className="absolute top-3 left-3 flex gap-1 z-10">
                <button title="Move (M)"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border
                    ${gizmoMode === "move" ? "bg-red-900/60 text-red-400 border-red-600" : "bg-black/60 text-gray-400 border-gray-700/50 hover:text-gray-200"}`}
                  onClick={() => setGizmoMode("move")}>
                  <Move className="w-4 h-4" />
                </button>
                <button title="Rotate (R)"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border
                    ${gizmoMode === "rotate" ? "bg-amber-900/60 text-amber-400 border-amber-600" : "bg-black/60 text-gray-400 border-gray-700/50 hover:text-gray-200"}`}
                  onClick={() => setGizmoMode("rotate")}>
                  <RotateCw className="w-4 h-4" />
                </button>
                <button title="Scale (S)"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border
                    ${gizmoMode === "scale" ? "bg-purple-900/60 text-purple-400 border-purple-600" : "bg-black/60 text-gray-400 border-gray-700/50 hover:text-gray-200"}`}
                  onClick={() => setGizmoMode("scale")}>
                  <Maximize2 className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-700/50 mx-0.5" />
                <button title="Toggle Gizmo (G)"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border
                    ${showGizmo ? "bg-green-900/40 text-green-400 border-green-700" : "bg-black/60 text-gray-500 border-gray-700/50"}`}
                  onClick={() => setShowGizmo(v => !v)}>
                  {showGizmo ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button title="Reset Pose"
                  className="w-8 h-8 rounded flex items-center justify-center bg-black/60 text-gray-500 border border-gray-700/50 hover:text-gray-200 transition-all"
                  onClick={resetPose}>
                  <Crosshair className="w-4 h-4" />
                </button>
                <div className="w-px bg-gray-700/50 mx-0.5" />
                <button title="Rig Mode — part-based rig with joint rotations"
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border
                    ${rigMode ? "bg-cyan-900/60 text-cyan-400 border-cyan-600" : "bg-black/60 text-gray-500 border-gray-700/50 hover:text-gray-200"}`}
                  onClick={() => { setRigMode(v => !v); rigRef.current = null; }}>
                  <Cpu className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Playback overlay (bottom-left) */}
            <div className="absolute bottom-3 left-3 flex gap-1 z-10">
              <button className="w-7 h-7 rounded bg-black/60 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white" onClick={stepBack}><SkipBack className="w-3 h-3" /></button>
              <button className={`w-7 h-7 rounded border flex items-center justify-center transition-all ${playing ? "bg-green-900/40 border-green-700 text-green-400" : "bg-black/60 border-gray-700/50 text-gray-400"}`}
                onClick={() => setPlaying(v => !v)}>
                {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button className="w-7 h-7 rounded bg-black/60 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white" onClick={stepFrame}><SkipForward className="w-3 h-3" /></button>
              <button className="w-7 h-7 rounded bg-black/60 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white" onClick={resetTimer}><RotateCcw className="w-3 h-3" /></button>
            </div>

            {/* Info badge for selected part */}
            {selectedPart && activeTab === "heroes" && (
              <div className="absolute top-3 right-3 bg-black/80 border border-amber-700/40 rounded p-2 text-[10px] font-mono z-10">
                <span className="text-amber-400 font-bold uppercase">{PART_LABELS[selectedPart]}</span>
                <div className="text-gray-300 mt-1">
                  <span className="text-red-400">ox</span>:{pose[selectedPart].ox}  <span className="text-green-400">oy</span>:{pose[selectedPart].oy}  <span className="text-blue-400">oz</span>:{pose[selectedPart].oz}
                </div>
                <div className="text-gray-300">
                  rot:{pose[selectedPart].rotation}°  sc:{pose[selectedPart].scale.toFixed(1)}x
                </div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={560} height={480}
              className="rounded-lg border border-gray-800/30 cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              data-testid="toon-admin-canvas"
            />
          </div>
        </div>

        {/* ── Right sidebar */}
        <div className="w-80 bg-[#0d0d1a] border-l border-gray-800/50 flex flex-col">
          <div className="h-12 border-b border-gray-800/50 flex items-center px-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              {TABS.find(t => t.id === activeTab)?.label} Editor
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* ── HEROES PANEL ── */}
            {activeTab === "heroes" && (
              <>
                <SectionHeader title="Character" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Race</label>
                    <Select value={race} onValueChange={setRace}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{RACES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">Class</label>
                    <Select value={heroClass} onValueChange={setHeroClass}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
                  onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />
                <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />

                <SectionHeader title="Animation" />
                <div className="grid grid-cols-2 gap-1.5">
                  {ANIM_STATES.map(s => (
                    <Button key={s} size="sm" variant={animState === s ? "default" : "outline"}
                      className={`text-[10px] h-7 ${animState === s ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                      onClick={() => { setAnimState(s); resetTimer(); }}>
                      {s.replace(/_/g, " ")}
                    </Button>
                  ))}
                </div>

                <SectionHeader title="Gizmo Mode" />
                <div className="flex gap-2">
                  {(["move","rotate","scale"] as GizmoMode[]).map(m => (
                    <Button key={m} size="sm" variant={gizmoMode === m ? "default" : "outline"}
                      className={`flex-1 text-[10px] capitalize h-7 ${gizmoMode === m ? "bg-amber-700 hover:bg-amber-600" : ""}`}
                      onClick={() => setGizmoMode(m)}>
                      {m}
                    </Button>
                  ))}
                </div>

                {/* ── Rig mode toggle in sidebar */}
                <div className="flex items-center justify-between bg-black/30 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs text-gray-300">Rig Mode</span>
                  </div>
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                      rigMode ? "bg-cyan-900/50 text-cyan-300 border-cyan-700" : "bg-black/40 text-gray-500 border-gray-700/50"}`}
                    onClick={() => { setRigMode(v => !v); rigRef.current = null; }}>
                    {rigMode ? "ON" : "OFF"}
                  </button>
                </div>

                {/* ── RIG MODE PANEL ── */}
                {rigMode && (
                  <>
                    {/* Live / Manual toggle */}
                    <div className="flex items-center justify-between bg-black/20 rounded px-2 py-1.5 mb-1">
                      <span className="text-[10px] text-gray-400">Animation drive</span>
                      <div className="flex gap-1">
                        <button
                          className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                            rigLive ? "bg-green-900/50 text-green-300 border-green-700" : "bg-black/40 text-gray-500 border-gray-700/50"}`}
                          onClick={() => setRigLive(true)}>
                          Live
                        </button>
                        <button
                          className={`text-[10px] px-2 py-0.5 rounded border transition-all ${
                            !rigLive ? "bg-amber-900/50 text-amber-300 border-amber-700" : "bg-black/40 text-gray-500 border-gray-700/50"}`}
                          onClick={() => setRigLive(false)}>
                          Manual
                        </button>
                      </div>
                    </div>

                    {rigLive && (
                      <div className="bg-black/20 rounded px-2 py-1 text-[9px] text-gray-500 font-mono">
                        Pose driven by anim state buttons above.
                        Switch to <span className="text-amber-500">Manual</span> to use sliders.
                      </div>
                    )}

                    <SectionHeader title="Weapon" />
                    <div className="grid grid-cols-3 gap-1">
                      {(['class','sword','shield_sword','axe','greatsword','war_hammer',
                         'spear','dagger','staff','wand','bow','crossbow','gun','claws'] as const).map(w => (
                        <Button key={w} size="sm"
                          variant={rigWeapon === w ? "default" : "outline"}
                          className={`text-[9px] h-6 capitalize px-1 ${rigWeapon === w ? "bg-amber-700 hover:bg-amber-600" : ""}`}
                          onClick={() => { setRigWeapon(w); rigRef.current = null; }}>
                          {w.replace(/_/g,' ')}
                        </Button>
                      ))}
                    </div>

                    <SectionHeader title="Preset Poses" />
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { label: "Idle",   fn: idleRigPose                 },
                        { label: "Walk",   fn: () => walkRigPose(0.25)     },
                        { label: "Attack", fn: () => attackRigPose(0.4)    },
                        { label: "Cast",   fn: () => castRigPose(0.8)      },
                        { label: "Block",  fn: blockRigPose                },
                        { label: "Dodge",  fn: () => dodgeRigPose(0.3)     },
                        { label: "Lunge",  fn: () => lungeRigPose(0.5)     },
                        { label: "Combo",  fn: () => comboRigPose(0.4)     },
                        { label: "Death",  fn: () => deathRigPose(0.8)     },
                        { label: "T-Pose", fn: defaultRigPose              },
                        { label: "Walk ½", fn: () => walkRigPose(0.5)      },
                        { label: "Reset",  fn: idleRigPose                 },
                      ] as { label: string; fn: () => HeroRigPose }[]).map(({ label, fn }) => (
                        <Button key={label} size="sm" variant="outline" className="text-[10px] h-7"
                          onClick={() => { setRigPose(fn()); setRigLive(false); }}>
                          {label}
                        </Button>
                      ))}
                    </div>

                    <SectionHeader title="Joint Rotations" />
                    <div className="space-y-1">
                      {([
                        { id: 'torso',         label: 'Torso',       color: '#f59e0b' },
                        { id: 'head',          label: 'Head',        color: '#ef4444' },
                        { id: 'leftUpperArm',  label: 'L.Shoulder',  color: '#22c55e' },
                        { id: 'leftForearm',   label: 'L.Elbow',     color: '#10b981' },
                        { id: 'rightUpperArm', label: 'R.Shoulder',  color: '#3b82f6' },
                        { id: 'rightForearm',  label: 'R.Elbow',     color: '#6366f1' },
                        { id: 'leftThigh',     label: 'L.Hip',       color: '#a855f7' },
                        { id: 'leftShin',      label: 'L.Knee',      color: '#8b5cf6' },
                        { id: 'rightThigh',    label: 'R.Hip',       color: '#ec4899' },
                        { id: 'rightShin',     label: 'R.Knee',      color: '#f43f5e' },
                      ] as { id: PartId; label: string; color: string }[]).map(({ id, label, color }) => (
                        <div key={id} className="space-y-0.5">
                          <div className="flex justify-between text-[9px]">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                              {label}
                            </span>
                            <span className="text-amber-400 font-mono">{rigPose[id]?.rotX.toFixed(0)}°</span>
                          </div>
                          <Slider min={-180} max={180} step={1}
                            value={[rigPose[id]?.rotX ?? 0]}
                            onValueChange={([v]) => setRigPose(prev => ({ ...prev, [id]: { ...prev[id], rotX: v } }))} />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7"
                        onClick={() => { setRigPose(defaultRigPose()); rigRef.current = null; }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7"
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(rigPose, null, 2))}>
                        <Copy className="w-3 h-3 mr-1" /> Export
                      </Button>
                    </div>

                    {/* Mixamo JSON importer */}
                    <SectionHeader title="Mixamo Import" />
                    <div className="text-[9px] text-gray-500 mb-1">
                      Paste a <span className="text-cyan-500">MixamoBoneFrame</span> JSON to preview:
                    </div>
                    <textarea
                      rows={4}
                      className="w-full bg-black/40 border border-gray-700 rounded p-1.5 text-[9px] font-mono text-gray-300 resize-none"
                      placeholder='{"LeftArm": 45, "RightArm": -30, "LeftUpLeg": 20}'
                      value={mixamoJson}
                      onChange={e => setMixamoJson(e.target.value)}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="flex-1 text-[10px] h-7"
                        onClick={() => {
                          try {
                            const frame = JSON.parse(mixamoJson);
                            const pose = mixamoToRigPose(frame);
                            setRigPose(pose);
                            setRigLive(false);
                            setMixamoErr('');
                          } catch (e) {
                            setMixamoErr('Invalid JSON');
                          }
                        }}>
                        Apply
                      </Button>
                      <Button size="sm" variant="ghost" className="text-[10px] h-7 text-gray-500"
                        onClick={() => { setMixamoJson(''); setMixamoErr(''); }}>
                        Clear
                      </Button>
                    </div>
                    {mixamoErr && <div className="text-[9px] text-red-400">{mixamoErr}</div>}

                    <div className="bg-black/30 rounded p-2 text-[9px] text-gray-600 font-mono space-y-0.5">
                      <div className="text-cyan-700 font-bold mb-1">Mixamo bone mapping:</div>
                      <div>LeftArm → L.Shoulder</div>
                      <div>LeftForeArm → L.Elbow</div>
                      <div>LeftUpLeg → L.Hip</div>
                      <div>LeftLeg → L.Knee</div>
                      <div>RightArm → R.Shoulder (inv)</div>
                    </div>
                  </>
                )}

                <SectionHeader title="Body Part Poses" />
                <div className="space-y-1.5">
                  {BODY_PARTS.map(part => {
                    const pp   = pose[part];
                    const isSel = selectedPart === part;
                    return (
                      <div key={part}
                        className={`rounded border cursor-pointer transition-all ${isSel ? "border-amber-600 bg-amber-900/20" : "border-gray-800/60 bg-black/20 hover:border-gray-700"}`}
                        onClick={() => setSelectedPart(isSel ? null : part)}>
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PART_COLORS[part] }} />
                            <span className="text-xs text-gray-300">{PART_LABELS[part]}</span>
                          </div>
                          <span className="text-[9px] font-mono text-gray-600">
                            {pp.ox},{pp.oy},{pp.oz} {pp.rotation !== 0 ? `r${pp.rotation}` : ""}
                          </span>
                        </div>
                        {isSel && (
                          <div className="px-2 pb-2 space-y-1.5">
                            <LabeledSlider label="ox (L/R)" value={pp.ox} min={-12} max={12} step={1}
                              onChange={v => updatePartPose(part, "ox", v)} />
                            <LabeledSlider label="oy (F/B)" value={pp.oy} min={-12} max={12} step={1}
                              onChange={v => updatePartPose(part, "oy", v)} />
                            <LabeledSlider label="oz (up/dn)" value={pp.oz} min={-12} max={12} step={1}
                              onChange={v => updatePartPose(part, "oz", v)} />
                            <LabeledSlider label="rotation" value={pp.rotation} min={-180} max={180} step={5}
                              onChange={v => updatePartPose(part, "rotation", v)} suffix="°" />
                            <LabeledSlider label="scale" value={pp.scale} min={0.2} max={3} step={0.1}
                              onChange={v => updatePartPose(part, "scale", v)} suffix="x" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={resetPose}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={exportPose}>
                    <Copy className="w-3 h-3 mr-1" /> Export
                  </Button>
                </div>
              </>
            )}

            {/* ── MINIONS PANEL ── */}
            {activeTab === "minions" && (
              <>
                <SectionHeader title="Minion Type" />
                <div className="grid grid-cols-2 gap-2">
                  {MINION_TYPES.map(t => (
                    <Button key={t} size="sm" variant={minionType === t ? "default" : "outline"}
                      className={`text-xs capitalize ${minionType === t ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                      onClick={() => { setMinionType(t); resetTimer(); }}>
                      {t}
                    </Button>
                  ))}
                </div>
                <SectionHeader title="Color" />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16">Team</span>
                  <input type="color" value={minionColor} onChange={e => setMinionColor(e.target.value)}
                    className="w-8 h-8 rounded border border-gray-700 bg-transparent cursor-pointer" />
                  <span className="text-xs text-gray-500 font-mono">{minionColor}</span>
                </div>
                <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
                  onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />
                <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
              </>
            )}

            {/* ── MONSTERS PANEL ── */}
            {activeTab === "monsters" && (
              <>
                <SectionHeader title="Monster Type" />
                <div className="grid grid-cols-3 gap-2">
                  {MOB_TYPES.map(t => (
                    <Button key={t} size="sm" variant={mobType === t ? "default" : "outline"}
                      className={`text-xs capitalize ${mobType === t ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                      onClick={() => { setMobType(t); resetTimer(); }}>
                      {t}
                    </Button>
                  ))}
                </div>
                <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
                  onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />
                <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
              </>
            )}

            {/* ── STRUCTURES PANEL ── */}
            {activeTab === "structures" && (
              <>
                <SectionHeader title="Structure" />
                <div className="grid grid-cols-4 gap-1.5">
                  {STRUCT_TYPES.map(t => (
                    <Button key={t} size="sm" variant={structType === t ? "default" : "outline"}
                      className={`text-xs capitalize ${structType === t ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                      onClick={() => setStructType(t)}>
                      {t}
                    </Button>
                  ))}
                </div>
                {structType === "tower" && (
                  <>
                    <SectionHeader title="Tier" />
                    <div className="flex gap-2">
                      {[0,1,2].map(tier => (
                        <Button key={tier} size="sm" variant={structTier === tier ? "default" : "outline"}
                          className={`flex-1 text-xs ${structTier === tier ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                          onClick={() => setStructTier(tier)}>
                          T{tier+1}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                <SectionHeader title="Team Color" />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16">Color</span>
                  <input type="color" value={structColor} onChange={e => setStructColor(e.target.value)}
                    className="w-8 h-8 rounded border border-gray-700 bg-transparent cursor-pointer" />
                  <span className="text-xs text-gray-500 font-mono">{structColor}</span>
                </div>
              </>
            )}

            {/* ── ENVIRONMENT PANEL ── */}
            {activeTab === "environment" && (
              <>
                <SectionHeader title="Type" />
                <div className="grid grid-cols-2 gap-2">
                  {ENV_TYPES.map(t => (
                    <Button key={t} size="sm" variant={envType === t ? "default" : "outline"}
                      className={`text-xs capitalize ${envType === t ? "bg-green-700 hover:bg-green-600" : ""}`}
                      onClick={() => setEnvType(t)}>
                      {t.replace("_"," ")}
                    </Button>
                  ))}
                </div>
                <SectionHeader title="Seed / Variation" />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                    onClick={() => setEnvSeed(v => Math.max(0, v - 1))}>-</Button>
                  <div className="flex-1 text-center text-amber-400 font-mono text-lg">{envSeed}</div>
                  <Button size="sm" variant="outline" className="w-8 h-8 p-0"
                    onClick={() => setEnvSeed(v => v + 1)}>+</Button>
                </div>
              </>
            )}

            {/* ── ANIMALS PANEL ── */}
            {activeTab === "animals" && (
              <>
                <SectionHeader title="Animal" />
                <div className="grid grid-cols-3 gap-2">
                  {ANIMAL_TYPES.map(t => (
                    <Button key={t} size="sm" variant={animalType === t ? "default" : "outline"}
                      className={`text-xs capitalize ${animalType === t ? "bg-amber-700 hover:bg-amber-600" : ""}`}
                      onClick={() => { setAnimalType(t); resetTimer(); }}>
                      {t}
                    </Button>
                  ))}
                </div>
                <LabeledSlider label="Facing" value={Math.round(facing * 180 / Math.PI)} min={0} max={360} step={1}
                  onChange={v => setFacing(v * Math.PI / 180)} suffix="°" />
                <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />
              </>
            )}

            {/* ── EFFECTS PANEL ── */}
            {activeTab === "effects" && (
              <>
                <SectionHeader title="Sprite Effect" />
                <Select value={fxType} onValueChange={v => setFxType(v as SpriteEffectType)}>
                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{SPRITE_EFFECT_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
                <LabeledSlider label="Scale" value={fxScale} min={0.5} max={4.0} step={0.1}
                  onChange={setFxScale} suffix="x" />
                <Button className="w-full bg-purple-700 hover:bg-purple-600 text-xs"
                  onClick={() => {
                    const c = canvasRef.current;
                    if (!c || !fxRef.current) return;
                    fxRef.current.playEffect(fxType, c.width/2, c.height/2, fxScale, 800);
                  }}>
                  <Sparkles className="w-3 h-3 mr-1" /> Play Effect
                </Button>
                <Button variant="outline" className="w-full text-xs"
                  onClick={() => {
                    const c = canvasRef.current;
                    if (!c || !fxRef.current) return;
                    SPRITE_EFFECT_TYPES.forEach((e, i) => {
                      setTimeout(() => fxRef.current!.playEffect(e, c.width/2, c.height/2, fxScale, 800), i * 300);
                    });
                  }}>
                  <Sparkles className="w-3 h-3 mr-1" /> Play All
                </Button>
              </>
            )}

            {/* ── Playback (shared) ── */}
            <SectionHeader title="Playback" />
            <div className="flex gap-1.5 justify-center">
              <Button size="sm" variant="outline" className="w-8 h-8 p-0" onClick={stepBack}><SkipBack className="w-4 h-4"/></Button>
              <Button size="sm" variant="outline" className={`w-8 h-8 p-0 ${playing ? "bg-green-900/40 border-green-700" : ""}`} onClick={() => setPlaying(v => !v)}>
                {playing ? <Pause className="w-4 h-4"/> : <Play className="w-4 h-4"/>}
              </Button>
              <Button size="sm" variant="outline" className="w-8 h-8 p-0" onClick={stepFrame}><SkipForward className="w-4 h-4"/></Button>
              <Button size="sm" variant="outline" className="w-8 h-8 p-0" onClick={resetTimer}><RotateCcw className="w-4 h-4"/></Button>
            </div>
            <LabeledSlider label="Speed" value={speed} min={0} max={3} step={0.1} onChange={setSpeed} suffix="x" />

            {/* ── Shortcut hints ── */}
            <div className="bg-black/30 rounded p-2 text-[9px] font-mono text-gray-600 space-y-0.5">
              <div><span className="text-amber-700">M</span> Move · <span className="text-amber-700">R</span> Rotate · <span className="text-amber-700">S</span> Scale</div>
              <div><span className="text-amber-700">G</span> Toggle gizmo · <span className="text-amber-700">Space</span> Play/Pause</div>
              <div><span className="text-amber-700">Shift+drag</span> Y-axis (forward/back)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

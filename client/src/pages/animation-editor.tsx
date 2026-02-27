import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { VoxelRenderer } from "@/game/voxel";
import { HEROES, RACE_COLORS, CLASS_COLORS } from "@/game/types";
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
import { ArrowLeft, Play, Pause, SkipForward, Download } from "lucide-react";

const RACES = ["Human", "Barbarian", "Dwarf", "Elf", "Orc", "Undead"];
const CLASSES = ["Warrior", "Worg", "Mage", "Ranger"];
const ANIM_STATES = [
  "idle",
  "walk",
  "attack",
  "combo_finisher",
  "ability",
  "dodge",
  "block",
  "dash_attack",
  "lunge_slash",
  "death",
];

const BODY_PARTS = [
  "leftLeg",
  "rightLeg",
  "leftArm",
  "rightArm",
  "torso",
  "head",
  "weapon",
] as const;

function getAnimPosesExternal(
  heroClass: string,
  animState: string,
  animTimer: number
) {
  const t = animTimer;
  const idle = {
    leftLeg: { ox: 0, oy: 0, oz: 0 },
    rightLeg: { ox: 0, oy: 0, oz: 0 },
    leftArm: { ox: 0, oy: 0, oz: 0 },
    rightArm: { ox: 0, oy: 0, oz: 0 },
    torso: { ox: 0, oy: 0, oz: Math.round(Math.sin(t * 2) * 0.3) },
    head: { ox: 0, oy: 0, oz: 0 },
    weapon: { ox: 0, oy: 0, oz: 0 },
    weaponGlow: 0,
  };

  if (animState === "idle") return idle;

  if (animState === "walk") {
    const freq = 10;
    const phase = Math.sin(t * freq);
    const phase2 = Math.cos(t * freq);
    const stride = 2.0;
    const liftHeight = 0.8;
    const bounce = Math.abs(Math.sin(t * freq * 2)) * 0.6;
    const hipSway = Math.sin(t * freq) * 0.4;
    const shoulderRock = Math.sin(t * freq) * 0.3;
    const headBob = Math.sin(t * freq * 2 + 0.5) * 0.35;
    return {
      leftLeg: {
        ox: Math.round(phase * stride),
        oy: 0,
        oz: Math.round(Math.max(0, -phase) * liftHeight),
      },
      rightLeg: {
        ox: Math.round(-phase * stride),
        oy: 0,
        oz: Math.round(Math.max(0, phase) * liftHeight),
      },
      leftArm: {
        ox: Math.round(-phase * 1.4),
        oy: Math.round(shoulderRock * 0.5),
        oz: Math.round(phase2 * 0.5),
      },
      rightArm: {
        ox: Math.round(phase * 1.4),
        oy: Math.round(-shoulderRock * 0.5),
        oz: Math.round(-phase2 * 0.5),
      },
      torso: { ox: 0, oy: Math.round(hipSway), oz: Math.round(bounce) },
      head: {
        ox: 0,
        oy: Math.round(Math.sin(t * freq * 0.5) * 0.25),
        oz: Math.round(bounce * 0.8 + headBob),
      },
      weapon: {
        ox: Math.round(phase * 0.6),
        oy: Math.round(shoulderRock * 0.3),
        oz: Math.round(bounce * 0.3),
      },
      weaponGlow: 0,
    };
  }

  if (animState === "attack") {
    const atkProgress = Math.min(1, t / 0.65);
    if (heroClass === "Warrior" || heroClass === "Worg") {
      const windUp = atkProgress < 0.35 ? atkProgress / 0.35 : 0;
      const swing =
        atkProgress >= 0.35 && atkProgress < 0.65
          ? (atkProgress - 0.35) / 0.3
          : 0;
      const followThru = atkProgress >= 0.65 ? (atkProgress - 0.65) / 0.35 : 0;
      const armExtend = Math.round(
        windUp > 0 ? -windUp * 4.0 : swing * 5.5 - followThru * 1.5
      );
      const lunge = Math.round(swing * 3.5);
      const bodyLean = Math.round(swing * 1.5);
      const plantFeet = Math.round(swing * 0.8);
      const shoulderTwist = Math.round(swing * 1.2 - windUp * 0.6);
      return {
        leftLeg: {
          ox: Math.round(swing * 2.5 - followThru * 0.8),
          oy: 0,
          oz: plantFeet,
        },
        rightLeg: {
          ox: Math.round(-swing * 1.5 + windUp * 0.8),
          oy: 0,
          oz: 0,
        },
        leftArm: {
          ox: armExtend,
          oy: Math.round(swing * -3.5 + shoulderTwist),
          oz: Math.round(swing * 5.0 - windUp * 3.0),
        },
        rightArm: {
          ox: Math.round(-windUp * 2.0 + followThru * 0.8),
          oy: Math.round(windUp * 1.0),
          oz: Math.round(windUp * 2.0 + swing * 0.5),
        },
        torso: {
          ox: lunge,
          oy: Math.round(swing * 0.8 - windUp * 0.5),
          oz: Math.round(-bodyLean * 0.4),
        },
        head: {
          ox: Math.round(swing * 1.2 - windUp * 0.5),
          oy: Math.round(shoulderTwist * 0.3),
          oz: Math.round(-bodyLean * 0.3),
        },
        weapon: {
          ox: armExtend + Math.round(swing * 5.0),
          oy: Math.round(swing * -5.5 + windUp * 1.5),
          oz: Math.round(windUp * 6 - swing * 5.5 + followThru * 0.5),
        },
        weaponGlow:
          swing > 0.15 ? 1.0 : windUp > 0.5 ? 0.5 : followThru > 0 ? 0.3 : 0,
      };
    }
    if (heroClass === "Ranger") {
      const draw = atkProgress < 0.45 ? atkProgress / 0.45 : 1;
      const hold =
        atkProgress >= 0.4 && atkProgress < 0.55 ? 1 : 0;
      const release =
        atkProgress >= 0.55
          ? Math.min(1, (atkProgress - 0.55) / 0.15)
          : 0;
      const recoil = atkProgress >= 0.7 ? (atkProgress - 0.7) / 0.3 : 0;
      const stringTension = draw * (1 - release);
      void hold;
      return {
        leftLeg: { ox: Math.round(-draw * 1.0), oy: 0, oz: 0 },
        rightLeg: {
          ox: Math.round(draw * 1.2 - recoil * 0.5),
          oy: 0,
          oz: 0,
        },
        leftArm: {
          ox: Math.round(draw * 3.5 - release * 0.5 - recoil * 1.0),
          oy: Math.round(-draw * 0.8),
          oz: Math.round(draw * 3.0),
        },
        rightArm: {
          ox: Math.round(-draw * 3.0 + release * 5.0 - recoil * 2.0),
          oy: Math.round(draw * 0.3),
          oz: Math.round(draw * 2.0 + release * 1.0 - recoil * 0.5),
        },
        torso: {
          ox: Math.round(-draw * 0.8 + release * 0.5),
          oy: Math.round(-draw * 0.5 + release * 0.3),
          oz: Math.round(release * -0.3),
        },
        head: {
          ox: Math.round(draw * 0.5 + release * 1.0 - recoil * 0.5),
          oy: Math.round(-draw * 0.3),
          oz: 0,
        },
        weapon: {
          ox: Math.round(draw * 3.0 - release * 0.5),
          oy: Math.round(-draw * 0.5),
          oz: Math.round(draw * 4.0 - release * 0.5),
        },
        weaponGlow:
          release > 0.2
            ? 1.0
            : stringTension > 0.6
              ? 0.7
              : draw > 0.3
                ? 0.3
                : 0,
      };
    }
    if (heroClass === "Mage") {
      const raise = atkProgress < 0.4 ? atkProgress / 0.4 : 1;
      const channel =
        atkProgress >= 0.25 && atkProgress < 0.55
          ? Math.min(1, (atkProgress - 0.25) / 0.3)
          : 0;
      const cast =
        atkProgress >= 0.5 ? Math.min(1, (atkProgress - 0.5) / 0.15) : 0;
      const recover = atkProgress >= 0.75 ? (atkProgress - 0.75) / 0.25 : 0;
      const glow = Math.max(channel * 0.8, cast);
      const orbPulse = Math.sin(t * 20) * 0.3;
      return {
        leftLeg: {
          ox: Math.round(-cast * 0.8 + recover * 0.3),
          oy: 0,
          oz: 0,
        },
        rightLeg: {
          ox: Math.round(cast * 0.8 - recover * 0.4),
          oy: 0,
          oz: 0,
        },
        leftArm: {
          ox: Math.round(cast * 4.5 - recover * 1.5),
          oy: Math.round(-raise * 1.5 + orbPulse),
          oz: Math.round(raise * 5.5 + cast * 1.0 - recover * 3),
        },
        rightArm: {
          ox: Math.round(cast * 3.0 - recover * 0.8),
          oy: Math.round(raise * 1.0 - orbPulse),
          oz: Math.round(raise * 4.5 + channel * 1.0 - recover * 2),
        },
        torso: {
          ox: Math.round(cast * 0.5),
          oy: 0,
          oz: Math.round(raise * 1.0 + channel * 0.5 - recover * 0.8),
        },
        head: {
          ox: Math.round(cast * 0.5),
          oy: 0,
          oz: Math.round(raise * 1.2 + channel * 0.5 - recover * 0.8),
        },
        weapon: {
          ox: Math.round(cast * 4.5 - recover * 1.5),
          oy: Math.round(-cast * 1.5 + orbPulse * 0.5),
          oz: Math.round(raise * 6 + cast * 2 - recover * 4),
        },
        weaponGlow: glow > 0.1 ? Math.min(1, glow + orbPulse * 0.2) : 0,
      };
    }
    return idle;
  }

  if (animState === "ability") {
    const pulse = (Math.sin(t * 8) + 1) * 0.5;
    const burst = Math.max(0, Math.sin(t * 8 + 1.5));
    const channel = Math.min(1, t * 4);
    return {
      leftLeg: { ox: Math.round(-burst * 0.8), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(burst * 0.8), oy: 0, oz: 0 },
      leftArm: {
        ox: Math.round(burst * 2.5),
        oy: Math.round(-pulse * 1.5),
        oz: Math.round(pulse * 4 + channel * 2),
      },
      rightArm: {
        ox: Math.round(burst * 2.5),
        oy: Math.round(pulse * 1.5),
        oz: Math.round(pulse * 4 + channel * 2),
      },
      torso: { ox: 0, oy: 0, oz: Math.round(pulse * 0.7 + channel * 0.5) },
      head: { ox: 0, oy: 0, oz: Math.round(pulse * 0.8 + channel * 0.5) },
      weapon: {
        ox: Math.round(burst * 2.5),
        oy: 0,
        oz: Math.round(pulse * 5 + channel),
      },
      weaponGlow: Math.max(pulse, channel * 0.6) * 0.95,
    };
  }

  if (animState === "dodge") {
    const roll = Math.min(1, t * 8);
    const spin = Math.sin(roll * Math.PI * 2);
    return {
      leftLeg: {
        ox: Math.round(spin * 2),
        oy: 0,
        oz: Math.round(-roll * 2),
      },
      rightLeg: {
        ox: Math.round(-spin * 2),
        oy: 0,
        oz: Math.round(-roll * 2),
      },
      leftArm: {
        ox: Math.round(-spin * 1.5),
        oy: Math.round(-roll),
        oz: Math.round(-roll * 3),
      },
      rightArm: {
        ox: Math.round(spin * 1.5),
        oy: Math.round(roll),
        oz: Math.round(-roll * 3),
      },
      torso: {
        ox: Math.round(spin * 0.5),
        oy: 0,
        oz: Math.round(-roll * 4),
      },
      head: { ox: Math.round(spin * 0.3), oy: 0, oz: Math.round(-roll * 5) },
      weapon: {
        ox: Math.round(-spin * 2),
        oy: 0,
        oz: Math.round(-roll * 3),
      },
      weaponGlow: 0,
    };
  }

  if (animState === "lunge_slash") {
    const progress = Math.min(1, t / 0.4);
    const lunge = progress < 0.4 ? progress / 0.4 : 1;
    const slash =
      progress >= 0.35 && progress < 0.6 ? (progress - 0.35) / 0.25 : 0;
    const recover = progress >= 0.6 ? (progress - 0.6) / 0.4 : 0;
    const lungeFwd = lunge * (1 - recover * 0.5);
    const slashArc = Math.sin(slash * Math.PI);
    return {
      leftLeg: {
        ox: Math.round(lungeFwd * 4 - recover * 2),
        oy: 0,
        oz: Math.round(Math.max(0, slash - 0.5) * 2),
      },
      rightLeg: {
        ox: Math.round(-lungeFwd * 2 + recover),
        oy: 0,
        oz: 0,
      },
      leftArm: {
        ox: Math.round(lungeFwd * 5 + slashArc * 3 - recover * 3),
        oy: Math.round(-slashArc * 4),
        oz: Math.round(lungeFwd * 3 + slashArc * 5 - recover * 4),
      },
      rightArm: {
        ox: Math.round(lungeFwd * 2 - recover),
        oy: Math.round(slashArc * 1.5),
        oz: Math.round(lungeFwd * 2 + slashArc * 2 - recover * 2),
      },
      torso: {
        ox: Math.round(lungeFwd * 3.5 - recover * 1.5),
        oy: Math.round(slashArc * 0.8),
        oz: Math.round(-slashArc * 0.5 + lungeFwd * 0.5),
      },
      head: {
        ox: Math.round(lungeFwd * 2.5 + slashArc * 0.5 - recover),
        oy: Math.round(slashArc * 0.5),
        oz: Math.round(lungeFwd * 0.5 - slashArc * 0.3),
      },
      weapon: {
        ox: Math.round(lungeFwd * 6 + slashArc * 4 - recover * 3),
        oy: Math.round(-slashArc * 6 + recover * 2),
        oz: Math.round(lungeFwd * 4 + slashArc * 6 - recover * 5),
      },
      weaponGlow:
        slash > 0.1 ? 1.0 : lungeFwd > 0.7 ? 0.6 : recover > 0 ? 0.3 : 0,
    };
  }

  if (animState === "dash_attack") {
    const thrust = Math.min(1, t * 6);
    const extend = Math.sin(thrust * Math.PI);
    return {
      leftLeg: { ox: Math.round(-extend * 2), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(extend * 2), oy: 0, oz: 0 },
      leftArm: {
        ox: Math.round(extend * 3),
        oy: Math.round(-extend),
        oz: Math.round(extend * 2),
      },
      rightArm: {
        ox: Math.round(extend * 2),
        oy: 0,
        oz: Math.round(extend),
      },
      torso: {
        ox: Math.round(extend * 2),
        oy: 0,
        oz: Math.round(extend * 0.5),
      },
      head: {
        ox: Math.round(extend * 1.5),
        oy: 0,
        oz: Math.round(extend * 0.5),
      },
      weapon: {
        ox: Math.round(extend * 4),
        oy: Math.round(-extend * 2),
        oz: Math.round(extend * 3),
      },
      weaponGlow: extend > 0.5 ? extend : 0,
    };
  }

  if (animState === "combo_finisher") {
    const phase = t * 28;
    const spin = Math.sin(phase);
    const spin2 = Math.cos(phase * 0.7);
    const power = Math.abs(Math.sin(phase * 0.5));
    const slam = Math.max(0, Math.sin(phase * 0.5 + 1.2));
    const twist = Math.sin(phase * 1.3) * 2.5;
    const bodyLean = Math.sin(phase * 0.8) * 2.2;
    const jumpPulse = Math.max(0, Math.sin(phase * 0.4)) * 1.5;
    const windmill = Math.sin(phase * 1.8) * 1.5;
    return {
      leftLeg: {
        ox: Math.round(spin * 4.0),
        oy: Math.round(spin2 * 1.2 + twist * 0.5),
        oz: Math.round(Math.max(0, -spin) * 2.5 + jumpPulse),
      },
      rightLeg: {
        ox: Math.round(-spin * 4.0),
        oy: Math.round(-spin2 * 1.2 - twist * 0.5),
        oz: Math.round(Math.max(0, spin) * 2.5 + jumpPulse),
      },
      leftArm: {
        ox: Math.round(spin * 7 + windmill),
        oy: Math.round(-power * 5.5 + twist),
        oz: Math.round(power * 7 + slam * 4.0),
      },
      rightArm: {
        ox: Math.round(-spin * 6 - windmill),
        oy: Math.round(power * 3.0 - twist),
        oz: Math.round(power * 6 + slam * 3.0),
      },
      torso: {
        ox: Math.round(spin * 3.0 + bodyLean),
        oy: Math.round(twist * 1.5),
        oz: Math.round(power * 2.0 - slam * 3.0 + jumpPulse * 0.5),
      },
      head: {
        ox: Math.round(spin * 2.0 + bodyLean * 0.8),
        oy: Math.round(twist * 1.0),
        oz: Math.round(power * 1.5 - slam * 2.5 + jumpPulse * 0.5),
      },
      weapon: {
        ox: Math.round(spin * 10 + power * 6),
        oy: Math.round(-power * 7 + slam * 4.0 + twist),
        oz: Math.round(power * 10 - slam * 6),
      },
      weaponGlow: 1.0,
    };
  }

  if (animState === "block") {
    const brace = Math.min(1, t * 6);
    return {
      leftLeg: { ox: Math.round(-brace * 0.5), oy: 0, oz: 0 },
      rightLeg: { ox: Math.round(brace * 0.5), oy: 0, oz: 0 },
      leftArm: {
        ox: Math.round(-brace * 2),
        oy: Math.round(brace),
        oz: Math.round(brace * 2),
      },
      rightArm: {
        ox: Math.round(brace * 1),
        oy: Math.round(-brace * 0.5),
        oz: Math.round(brace * 1.5),
      },
      torso: {
        ox: Math.round(-brace * 0.5),
        oy: 0,
        oz: Math.round(brace * 0.3),
      },
      head: {
        ox: Math.round(-brace * 0.5),
        oy: 0,
        oz: Math.round(brace * 0.3),
      },
      weapon: {
        ox: Math.round(-brace * 1),
        oy: Math.round(brace * 2),
        oz: Math.round(brace * 3),
      },
      weaponGlow: 0.2,
    };
  }

  if (animState === "death") {
    const fall = Math.min(1, t * 2);
    return {
      leftLeg: {
        ox: Math.round(fall * 2),
        oy: 0,
        oz: Math.round(-fall * 3),
      },
      rightLeg: {
        ox: Math.round(fall * 2),
        oy: 0,
        oz: Math.round(-fall * 3),
      },
      leftArm: {
        ox: Math.round(fall * 3),
        oy: Math.round(-fall),
        oz: Math.round(-fall * 2),
      },
      rightArm: {
        ox: Math.round(fall * 3),
        oy: Math.round(fall),
        oz: Math.round(-fall * 2),
      },
      torso: { ox: Math.round(fall * 2), oy: 0, oz: Math.round(-fall * 4) },
      head: { ox: Math.round(fall * 3), oy: 0, oz: Math.round(-fall * 5) },
      weapon: {
        ox: Math.round(fall * 4),
        oy: Math.round(-fall * 2),
        oz: Math.round(-fall * 4),
      },
      weaponGlow: 0,
    };
  }

  return idle;
}

export default function AnimationEditorPage() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voxelRef = useRef<VoxelRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [race, setRace] = useState("Human");
  const [heroClass, setHeroClass] = useState("Warrior");
  const [heroName, setHeroName] = useState("Sir Aldric Valorheart");
  const [animState, setAnimState] = useState("idle");
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [animTimer, setAnimTimer] = useState(0);
  const [facing, setFacing] = useState(0);
  const [bgColor, setBgColor] = useState("#1a1a2e");

  const animTimerRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const animStateRef = useRef("idle");
  const raceRef = useRef("Human");
  const heroClassRef = useRef("Warrior");
  const heroNameRef = useRef("Sir Aldric Valorheart");
  const facingRef = useRef(0);
  const bgColorRef = useRef("#1a1a2e");

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    animStateRef.current = animState;
  }, [animState]);
  useEffect(() => {
    raceRef.current = race;
  }, [race]);
  useEffect(() => {
    heroClassRef.current = heroClass;
  }, [heroClass]);
  useEffect(() => {
    heroNameRef.current = heroName;
  }, [heroName]);
  useEffect(() => {
    facingRef.current = facing;
  }, [facing]);
  useEffect(() => {
    bgColorRef.current = bgColor;
  }, [bgColor]);

  const filteredHeroes = HEROES.filter(
    (h) => h.race === race && h.heroClass === heroClass
  );

  useEffect(() => {
    const match = HEROES.find(
      (h) => h.race === race && h.heroClass === heroClass
    );
    if (match) setHeroName(match.name);
  }, [race, heroClass]);

  const renderFrame = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!voxelRef.current) {
        voxelRef.current = new VoxelRenderer();
      }

      const dt = lastTimeRef.current
        ? (timestamp - lastTimeRef.current) / 1000
        : 0;
      lastTimeRef.current = timestamp;

      if (playingRef.current) {
        animTimerRef.current += dt * speedRef.current;
        setAnimTimer(animTimerRef.current);
      }

      ctx.fillStyle = bgColorRef.current;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      const scale = 3.5;
      ctx.scale(scale, scale);
      const cx = canvas.width / (2 * scale);
      const cy = canvas.height / (2 * scale) + 10;

      const raceColor = RACE_COLORS[raceRef.current] || "#94a3b8";
      const classColor = CLASS_COLORS[heroClassRef.current] || "#ef4444";

      voxelRef.current.drawHeroVoxel(
        ctx,
        cx,
        cy,
        raceColor,
        classColor,
        heroClassRef.current,
        facingRef.current,
        animStateRef.current,
        animTimerRef.current,
        raceRef.current,
        heroNameRef.current
      );
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px monospace";
      ctx.fillText(
        `t: ${animTimerRef.current.toFixed(3)}  speed: ${speedRef.current.toFixed(1)}x`,
        8,
        canvas.height - 8
      );

      animFrameRef.current = requestAnimationFrame(renderFrame);
    },
    []
  );

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [renderFrame]);

  const stepFrame = () => {
    setPlaying(false);
    animTimerRef.current += 1 / 60;
    setAnimTimer(animTimerRef.current);
  };

  const resetTimer = () => {
    animTimerRef.current = 0;
    setAnimTimer(0);
  };

  const exportPose = () => {
    const poses = getAnimPosesExternal(heroClass, animState, animTimerRef.current);
    const data = {
      race,
      heroClass,
      heroName,
      animState,
      animTimer: animTimerRef.current,
      facing,
      speed,
      poses,
    };
    console.log("=== EXPORTED POSE ===");
    console.log(JSON.stringify(data, null, 2));
    console.log("=====================");
  };

  const currentPoses = getAnimPosesExternal(heroClass, animState, animTimer);

  const getAnimDuration = (state: string): number => {
    switch (state) {
      case "attack":
        return 0.65;
      case "lunge_slash":
        return 0.4;
      case "dash_attack":
        return 0.17;
      case "dodge":
        return 0.125;
      case "block":
        return 0.17;
      case "death":
        return 0.5;
      default:
        return 2;
    }
  };

  const duration = getAnimDuration(animState);
  const progress =
    animState === "idle" ||
    animState === "walk" ||
    animState === "ability" ||
    animState === "combo_finisher"
      ? (animTimer % duration) / duration
      : Math.min(1, animTimer / duration);

  return (
    <div
      className="flex flex-col h-screen bg-background text-foreground"
      data-testid="page-animation-editor"
    >
      <header className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft />
        </Button>
        <h1
          className="text-lg font-semibold"
          data-testid="text-page-title"
        >
          Animation Editor
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            className="rounded-md border border-border"
            style={{ imageRendering: "pixelated" }}
            data-testid="canvas-preview"
          />
        </div>

        <div className="w-80 border-l border-border overflow-y-auto p-4 flex flex-col gap-4">
          <Card className="p-4 flex flex-col gap-3">
            <h2
              className="text-sm font-semibold text-muted-foreground"
              data-testid="text-section-character"
            >
              Character
            </h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Race</label>
              <Select value={race} onValueChange={setRace}>
                <SelectTrigger data-testid="select-race">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RACES.map((r) => (
                    <SelectItem key={r} value={r} data-testid={`option-race-${r}`}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Class</label>
              <Select value={heroClass} onValueChange={setHeroClass}>
                <SelectTrigger data-testid="select-class">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c} value={c} data-testid={`option-class-${c}`}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Hero</label>
              <Select value={heroName} onValueChange={setHeroName}>
                <SelectTrigger data-testid="select-hero">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredHeroes.length > 0 ? (
                    filteredHeroes.map((h) => (
                      <SelectItem
                        key={h.id}
                        value={h.name}
                        data-testid={`option-hero-${h.id}`}
                      >
                        {h.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={heroName}>{heroName}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2
              className="text-sm font-semibold text-muted-foreground"
              data-testid="text-section-animation"
            >
              Animation
            </h2>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">State</label>
              <Select
                value={animState}
                onValueChange={(v) => {
                  setAnimState(v);
                  resetTimer();
                }}
              >
                <SelectTrigger data-testid="select-anim-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANIM_STATES.map((s) => (
                    <SelectItem key={s} value={s} data-testid={`option-anim-${s}`}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                Facing: {((facing * 180) / Math.PI).toFixed(0)}deg
              </label>
              <Slider
                min={0}
                max={628}
                step={1}
                value={[Math.round(facing * 100)]}
                onValueChange={([v]) => setFacing(v / 100)}
                data-testid="slider-facing"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                Speed: {speed.toFixed(1)}x
              </label>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[Math.round(speed * 10)]}
                onValueChange={([v]) => setSpeed(v / 10)}
                data-testid="slider-speed"
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2
              className="text-sm font-semibold text-muted-foreground"
              data-testid="text-section-controls"
            >
              Playback
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="icon"
                variant={playing ? "default" : "outline"}
                onClick={() => setPlaying(!playing)}
                data-testid="button-play-pause"
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={stepFrame}
                data-testid="button-step-frame"
              >
                <SkipForward />
              </Button>
              <Button
                variant="outline"
                onClick={resetTimer}
                data-testid="button-reset"
              >
                Reset
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                Timeline
              </label>
              <div
                className="h-4 rounded-md bg-muted overflow-hidden relative"
                data-testid="timeline-bar"
              >
                <div
                  className="h-full bg-primary transition-none"
                  style={{ width: `${Math.min(100, progress * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span data-testid="text-timer">
                  t={animTimer.toFixed(3)}s
                </span>
                <span data-testid="text-progress">
                  {(progress * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2
              className="text-sm font-semibold text-muted-foreground"
              data-testid="text-section-pose"
            >
              Pose Inspector
            </h2>
            <div className="text-xs font-mono flex flex-col gap-1">
              {BODY_PARTS.map((part) => {
                const pose = currentPoses[part];
                return (
                  <div
                    key={part}
                    className="flex items-center justify-between gap-2"
                    data-testid={`pose-part-${part}`}
                  >
                    <span className="text-muted-foreground w-20 truncate">
                      {part}
                    </span>
                    <span>
                      x:{pose.ox} y:{pose.oy} z:{pose.oz}
                    </span>
                  </div>
                );
              })}
              <div
                className="flex items-center justify-between gap-2"
                data-testid="pose-part-weaponGlow"
              >
                <span className="text-muted-foreground w-20">glow</span>
                <span>{currentPoses.weaponGlow.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 flex flex-col gap-3">
            <h2
              className="text-sm font-semibold text-muted-foreground"
              data-testid="text-section-settings"
            >
              Settings
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground">
                Background
              </label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-8 h-8 rounded-md border border-border cursor-pointer"
                data-testid="input-bg-color"
              />
            </div>
            <Button
              variant="outline"
              onClick={exportPose}
              data-testid="button-export-pose"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Pose
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

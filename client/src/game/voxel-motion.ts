import type { WeaponType } from './types';

export interface BodyPartPose {
  ox: number; oy: number; oz: number;
  rotation?: number;
  scale?: number;
}

export interface FullPose {
  leftLeg: BodyPartPose; rightLeg: BodyPartPose;
  leftArm: BodyPartPose; rightArm: BodyPartPose;
  torso: BodyPartPose; head: BodyPartPose;
  weapon: BodyPartPose; weaponGlow: number;
}

export interface Keyframe {
  time: number;
  pose: Partial<Record<keyof FullPose, Partial<BodyPartPose>>>;
  glow?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'overshoot' | 'bounce';
}

export interface MotionPrimitive {
  name: string;
  duration: number;
  keyframes: Keyframe[];
  loop?: boolean;
}

function ease(t: number, type: string): number {
  switch (type) {
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'overshoot': {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    }
    case 'bounce': {
      if (t < 0.5) return (1 - bounceOut(1 - 2 * t)) / 2;
      return (1 + bounceOut(2 * t - 1)) / 2;
    }
    default: return t;
  }
}

function bounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}

const MAX_OFFSET = 8;

function clampOffset(v: number): number {
  return Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, v));
}

function lerpPart(a: Partial<BodyPartPose> | undefined, b: Partial<BodyPartPose> | undefined, t: number): BodyPartPose {
  const ax = a?.ox ?? 0, ay = a?.oy ?? 0, az = a?.oz ?? 0;
  const bx = b?.ox ?? 0, by = b?.oy ?? 0, bz = b?.oz ?? 0;
  const ar = a?.rotation ?? 0, br = b?.rotation ?? 0;
  const as = a?.scale ?? 1, bs = b?.scale ?? 1;
  return {
    ox: clampOffset(Math.round(ax + (bx - ax) * t)),
    oy: clampOffset(Math.round(ay + (by - ay) * t)),
    oz: clampOffset(Math.round(az + (bz - az) * t)),
    rotation: ar + (br - ar) * t,
    scale: Math.max(0.2, Math.min(3, as + (bs - as) * t)),
  };
}

const zeroPose: BodyPartPose = { ox: 0, oy: 0, oz: 0 };

export function sampleMotion(motion: MotionPrimitive, time: number): FullPose {
  let t = time;
  if (motion.loop && motion.duration > 0) {
    t = t % motion.duration;
  }
  t = Math.max(0, Math.min(motion.duration, t));

  const kfs = motion.keyframes;
  if (kfs.length === 0) return { leftLeg: zeroPose, rightLeg: zeroPose, leftArm: zeroPose, rightArm: zeroPose, torso: zeroPose, head: zeroPose, weapon: zeroPose, weaponGlow: 0 };

  let prevIdx = 0;
  let nextIdx = 0;
  for (let i = 0; i < kfs.length; i++) {
    if (kfs[i].time <= t) prevIdx = i;
    if (kfs[i].time >= t) { nextIdx = i; break; }
    nextIdx = i;
  }

  if (prevIdx === nextIdx) {
    const kf = kfs[prevIdx];
    const parts: (keyof FullPose)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
    const result: any = { weaponGlow: kf.glow ?? 0 };
    for (const p of parts) {
      result[p] = lerpPart(kf.pose[p], kf.pose[p], 1);
    }
    return result;
  }

  const prevKf = kfs[prevIdx];
  const nextKf = kfs[nextIdx];
  const span = nextKf.time - prevKf.time;
  const rawT = span > 0 ? (t - prevKf.time) / span : 1;
  const easedT = ease(rawT, nextKf.easing || 'easeInOut');

  const parts: (keyof FullPose)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
  const result: any = {
    weaponGlow: (prevKf.glow ?? 0) + ((nextKf.glow ?? 0) - (prevKf.glow ?? 0)) * easedT
  };
  for (const p of parts) {
    result[p] = lerpPart(prevKf.pose[p], nextKf.pose[p], easedT);
  }
  return result;
}

export function composePoses(base: FullPose, overlay: FullPose, blend: number): FullPose {
  const parts: (keyof FullPose)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
  const result: any = {
    weaponGlow: base.weaponGlow + (overlay.weaponGlow - base.weaponGlow) * blend
  };
  for (const p of parts) {
    const bPart = base[p] as BodyPartPose;
    const oPart = overlay[p] as BodyPartPose;
    result[p] = {
      ox: Math.round(bPart.ox + (oPart.ox - bPart.ox) * blend),
      oy: Math.round(bPart.oy + (oPart.oy - bPart.oy) * blend),
      oz: Math.round(bPart.oz + (oPart.oz - bPart.oz) * blend),
      rotation: (bPart.rotation ?? 0) + ((oPart.rotation ?? 0) - (bPart.rotation ?? 0)) * blend,
      scale: (bPart.scale ?? 1) + ((oPart.scale ?? 1) - (bPart.scale ?? 1)) * blend,
    };
  }
  return result;
}

export function additivePoses(base: FullPose, add: FullPose, scale: number): FullPose {
  const parts: (keyof FullPose)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
  const result: any = {
    weaponGlow: Math.min(1, base.weaponGlow + add.weaponGlow * scale)
  };
  for (const p of parts) {
    const bPart = base[p] as BodyPartPose;
    const aPart = add[p] as BodyPartPose;
    result[p] = {
      ox: clampOffset(Math.round(bPart.ox + aPart.ox * scale)),
      oy: clampOffset(Math.round(bPart.oy + aPart.oy * scale)),
      oz: clampOffset(Math.round(bPart.oz + aPart.oz * scale)),
      rotation: (bPart.rotation ?? 0) + (aPart.rotation ?? 0) * scale,
      scale: Math.max(0.2, Math.min(3, (bPart.scale ?? 1) * Math.pow(aPart.scale ?? 1, scale))),
    };
  }
  return result;
}

export function generateSmoothedAnimation(snapshots: { time: number; pose: FullPose; glow?: number }[], duration: number, loop: boolean, smoothingSteps: number = 2): MotionPrimitive {
  const keyframes: Keyframe[] = snapshots.map(s => ({
    time: s.time,
    pose: {} as any,
    glow: s.glow ?? 0,
    easing: 'easeInOut' as const,
  }));

  for (let idx = 0; idx < snapshots.length; idx++) {
    const s = snapshots[idx];
    const kf = keyframes[idx];
    const parts: (keyof Omit<FullPose, 'weaponGlow'>)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
    for (const p of parts) {
      const bp = s.pose[p];
      kf.pose[p] = { ox: bp.ox, oy: bp.oy, oz: bp.oz, rotation: bp.rotation ?? 0, scale: bp.scale ?? 1 };
    }
  }

  if (smoothingSteps > 0 && keyframes.length >= 2) {
    const extras: Keyframe[] = [];
    for (let i = 0; i < keyframes.length - 1; i++) {
      const kA = keyframes[i];
      const kB = keyframes[i + 1];
      const span = kB.time - kA.time;
      if (span <= 0) continue;

      for (let s = 1; s <= smoothingSteps; s++) {
        const frac = s / (smoothingSteps + 1);
        const midTime = parseFloat((kA.time + span * frac).toFixed(4));
        const parts: (keyof Omit<FullPose, 'weaponGlow'>)[] = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm', 'torso', 'head', 'weapon'];
        const midPose: any = {};
        for (const p of parts) {
          const a = kA.pose[p];
          const b = kB.pose[p];
          if (a || b) {
            midPose[p] = lerpPart(a, b, ease(frac, 'easeInOut'));
          }
        }
        const midGlow = (kA.glow ?? 0) + ((kB.glow ?? 0) - (kA.glow ?? 0)) * ease(frac, 'easeInOut');
        extras.push({ time: midTime, pose: midPose, glow: midGlow, easing: 'easeInOut' });
      }
    }
    keyframes.push(...extras);
    keyframes.sort((a, b) => a.time - b.time);
  }

  return { name: 'ai_smoothed', duration, keyframes, loop };
}

export const BODY_PART_CENTERS: Record<string, { x: number; y: number; z: number }> = {
  leftLeg: { x: 2, y: 2.5, z: 0.5 },
  rightLeg: { x: 5, y: 2.5, z: 0.5 },
  leftArm: { x: 1, y: 3, z: 4 },
  rightArm: { x: 6, y: 3, z: 4 },
  torso: { x: 3.5, y: 3, z: 3.5 },
  head: { x: 3.5, y: 3, z: 6.5 },
  weapon: { x: 0, y: 1, z: 5 },
};

export const MOTION_LIBRARY: Record<string, MotionPrimitive> = {
  swing_horizontal: {
    name: 'swing_horizontal',
    duration: 0.65,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0, rotation: -8 },
        weapon: { ox: 0, oy: 0, oz: 4, rotation: 0 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.2, pose: {
        leftArm: { ox: -1, oy: 0, oz: 2 }, rightArm: { ox: 0, oy: 0, oz: 1 },
        torso: { ox: 0, oy: 0, oz: 0, rotation: -12 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: -1, oy: 0, oz: 6, rotation: 10 }
      }, glow: 0.4, easing: 'easeIn' },
      { time: 0.35, pose: {
        leftArm: { ox: 3, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 0, oz: 1 },
        torso: { ox: 1, oy: 0, oz: 0, rotation: 15 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 4, oy: -2, oz: 1, rotation: -90 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.5, pose: {
        leftArm: { ox: 2, oy: -1, oz: 1 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0, rotation: 5 },
        weapon: { ox: 2, oy: -1, oz: 0, rotation: -70 }
      }, glow: 0.3, easing: 'easeOut' },
      { time: 0.65, pose: {}, glow: 0 },
    ]
  },

  swing_vertical_chop: {
    name: 'swing_vertical_chop',
    duration: 0.65,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 0, oy: 0, oz: 4, rotation: 0 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.3, pose: {
        leftArm: { ox: 0, oy: -1, oz: 3 }, rightArm: { ox: 0, oy: 0, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 0, oy: -1, oz: 7, rotation: 15 }
      }, glow: 0.5, easing: 'easeIn' },
      { time: 0.48, pose: {
        leftArm: { ox: 2, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 0, oz: 1 },
        torso: { ox: 1, oy: 0, oz: -1 }, head: { ox: 0, oy: 0, oz: -1 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 2, oy: -2, oz: 0, rotation: -90 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.65, pose: {
        torso: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 1, oy: -1, oz: 0, rotation: -60 }
      }, glow: 0.2, easing: 'easeOut' },
    ]
  },

  thrust_linear: {
    name: 'thrust_linear',
    duration: 0.6,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: -1, oy: 0, oz: 0 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: -1, oy: 0, oz: 3, rotation: 0 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.2, pose: {
        leftArm: { ox: -1, oy: 0, oz: 1 }, rightArm: { ox: 0, oy: 0, oz: 1 },
        torso: { ox: -1, oy: 0, oz: 0 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: -1, oy: 0, oz: 5, rotation: 5 }
      }, glow: 0.3, easing: 'easeIn' },
      { time: 0.38, pose: {
        leftArm: { ox: 3, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 0, oz: 1 },
        torso: { ox: 2, oy: 0, oz: 0 }, head: { ox: 1, oy: 0, oz: 0 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 5, oy: -2, oz: 1, rotation: -90 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.5, pose: {
        leftArm: { ox: 2, oy: 0, oz: 1 },
        torso: { ox: 1, oy: 0, oz: 0 },
        weapon: { ox: 3, oy: -1, oz: 0, rotation: -75 }
      }, glow: 0.3, easing: 'easeOut' },
      { time: 0.6, pose: {}, glow: 0 },
    ]
  },

  slam_overhead: {
    name: 'slam_overhead',
    duration: 0.7,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 0, oy: 0, oz: 3, rotation: 0 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.3, pose: {
        leftArm: { ox: 0, oy: -1, oz: 4 }, rightArm: { ox: 0, oy: -1, oz: 3 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: 0, oy: -1, oz: 8, rotation: 20 }
      }, glow: 0.5, easing: 'easeIn' },
      { time: 0.5, pose: {
        leftArm: { ox: 2, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: -1, oz: 1 },
        torso: { ox: 1, oy: 0, oz: -1 }, head: { ox: 0, oy: 0, oz: -1 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 2, oy: -2, oz: -1, rotation: -90 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.62, pose: {
        torso: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 1, oy: -1, oz: -1, rotation: -70 }
      }, glow: 0.4, easing: 'easeOut' },
      { time: 0.7, pose: {}, glow: 0 },
    ]
  },

  cast_channel: {
    name: 'cast_channel',
    duration: 1.0,
    loop: true,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 3, oy: -2, oz: 5 }, rightArm: { ox: 3, oy: 2, oz: 4 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        weapon: { ox: 3, oy: -2, oz: 6 }
      }, glow: 0.6, easing: 'easeInOut' },
      { time: 0.5, pose: {
        leftArm: { ox: 4, oy: -1, oz: 7 }, rightArm: { ox: 4, oy: 1, oz: 6 },
        torso: { ox: 0, oy: 0, oz: 2 }, head: { ox: 0, oy: 0, oz: 2 },
        weapon: { ox: 4, oy: -1, oz: 8 }
      }, glow: 1.0, easing: 'easeInOut' },
      { time: 1.0, pose: {
        leftArm: { ox: 3, oy: -2, oz: 5 }, rightArm: { ox: 3, oy: 2, oz: 4 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        weapon: { ox: 3, oy: -2, oz: 6 }
      }, glow: 0.6 },
    ]
  },

  transform_grow: {
    name: 'transform_grow',
    duration: 0.8,
    keyframes: [
      { time: 0, pose: {
        torso: { ox: 0, oy: 0, oz: 0 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.2, pose: {
        leftArm: { ox: -1, oy: -1, oz: 2 }, rightArm: { ox: -1, oy: 1, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 1, scale: 1.1 }, head: { ox: 0, oy: 0, oz: 1 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: -1, oy: 0, oz: 2 }
      }, glow: 0.5, easing: 'easeInOut' },
      { time: 0.5, pose: {
        leftArm: { ox: 1, oy: -2, oz: 3 }, rightArm: { ox: 1, oy: 2, oz: 3 },
        torso: { ox: 0, oy: 0, oz: 1, scale: 1.3 }, head: { ox: 0, oy: 0, oz: 2 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: 0, oy: 0, oz: 3 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.8, pose: {
        leftArm: { ox: 0, oy: -1, oz: 1 }, rightArm: { ox: 0, oy: 1, oz: 1 },
        torso: { ox: 0, oy: 0, oz: 0, scale: 1.15 }, head: { ox: 0, oy: 0, oz: 1 },
      }, glow: 0.3 },
    ]
  },

  idle_breathe: {
    name: 'idle_breathe',
    duration: 3.0,
    loop: true,
    keyframes: [
      { time: 0, pose: {
        torso: { ox: 0, oy: 0, oz: 0 }, head: { ox: 0, oy: 0, oz: 0 },
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
      }, glow: 0, easing: 'easeInOut' },
      { time: 1.5, pose: {
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
      }, glow: 0, easing: 'easeInOut' },
      { time: 3.0, pose: {
        torso: { ox: 0, oy: 0, oz: 0 }, head: { ox: 0, oy: 0, oz: 0 },
      }, glow: 0 },
    ]
  },

  claw_swipe: {
    name: 'claw_swipe',
    duration: 0.5,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 0 }, rightArm: { ox: 0, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0, rotation: -8 },
        weapon: { ox: -1, oy: 0, oz: 4, rotation: 0 }
      }, glow: 0.3, easing: 'easeIn' },
      { time: 0.18, pose: {
        leftArm: { ox: 3, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 0, oz: 1 },
        torso: { ox: 1, oy: 0, oz: 0, rotation: 12 },
        leftLeg: { ox: 0, oy: 1, oz: 0 }, rightLeg: { ox: 0, oy: -1, oz: 0 },
        weapon: { ox: 4, oy: -2, oz: 0, rotation: -90 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.32, pose: {
        leftArm: { ox: 2, oy: -1, oz: 1 },
        torso: { ox: 0, oy: 0, oz: 0, rotation: 4 },
        weapon: { ox: 2, oy: -1, oz: 0, rotation: -65 }
      }, glow: 0.4, easing: 'easeOut' },
      { time: 0.5, pose: {}, glow: 0 },
    ]
  },

  bow_draw_release: {
    name: 'bow_draw_release',
    duration: 0.7,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 2, oy: -1, oz: 2 }, rightArm: { ox: -1, oy: 0, oz: 1 },
        torso: { ox: -1, oy: -1, oz: 0 }, head: { ox: 1, oy: 0, oz: 0 },
        weapon: { ox: 2, oy: -1, oz: 3 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.35, pose: {
        leftArm: { ox: 4, oy: -1, oz: 3 }, rightArm: { ox: -4, oy: 0, oz: 2 },
        torso: { ox: -1, oy: -1, oz: 0 }, head: { ox: 1, oy: 0, oz: 0 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
        weapon: { ox: 4, oy: -1, oz: 4 }
      }, glow: 0.7, easing: 'easeIn' },
      { time: 0.45, pose: {
        leftArm: { ox: 4, oy: -1, oz: 3 }, rightArm: { ox: 5, oy: 1, oz: 1 },
        torso: { ox: 1, oy: 0, oz: 0 }, head: { ox: 2, oy: 0, oz: 0 },
        weapon: { ox: 4, oy: -1, oz: 3 }
      }, glow: 1.0, easing: 'overshoot' },
      { time: 0.6, pose: {
        rightArm: { ox: 2, oy: 0, oz: 0 },
        torso: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 3, oy: 0, oz: 2 }
      }, glow: 0.2, easing: 'easeOut' },
      { time: 0.7, pose: {}, glow: 0 },
    ]
  },

  staff_cast: {
    name: 'staff_cast',
    duration: 0.6,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 0, oy: 0, oz: 2 }, rightArm: { ox: 0, oy: 0, oz: 1 },
        torso: { ox: 0, oy: 0, oz: 0 }, head: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 0, oy: 0, oz: 3 }
      }, glow: 0, easing: 'easeIn' },
      { time: 0.2, pose: {
        leftArm: { ox: 2, oy: -1, oz: 6 }, rightArm: { ox: 2, oy: 1, oz: 5 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 2 },
        weapon: { ox: 2, oy: -1, oz: 7 }
      }, glow: 0.5, easing: 'easeInOut' },
      { time: 0.35, pose: {
        leftArm: { ox: 5, oy: -2, oz: 6 }, rightArm: { ox: 4, oy: 1, oz: 5 },
        torso: { ox: 1, oy: 0, oz: 1 }, head: { ox: 1, oy: 0, oz: 2 },
        weapon: { ox: 5, oy: -2, oz: 8 }
      }, glow: 1.0, easing: 'overshoot' },
      { time: 0.5, pose: {
        leftArm: { ox: 2, oy: -1, oz: 3 }, rightArm: { ox: 1, oy: 0, oz: 2 },
        weapon: { ox: 2, oy: -1, oz: 4 }
      }, glow: 0.3, easing: 'easeOut' },
      { time: 0.6, pose: {}, glow: 0 },
    ]
  },

  howl_pose: {
    name: 'howl_pose',
    duration: 0.8,
    keyframes: [
      { time: 0, pose: {}, glow: 0, easing: 'easeIn' },
      { time: 0.15, pose: {
        leftArm: { ox: -1, oy: -1, oz: 2 }, rightArm: { ox: -1, oy: 1, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 2 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
      }, glow: 0.4, easing: 'easeInOut' },
      { time: 0.4, pose: {
        leftArm: { ox: 1, oy: -2, oz: 3 }, rightArm: { ox: 1, oy: 2, oz: 3 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 3 },
        leftLeg: { ox: 0, oy: -1, oz: 0 }, rightLeg: { ox: 0, oy: 1, oz: 0 },
      }, glow: 1.0, easing: 'easeOut' },
      { time: 0.6, pose: {
        leftArm: { ox: 1, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 1, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 2 },
      }, glow: 0.7, easing: 'easeInOut' },
      { time: 0.8, pose: {}, glow: 0 },
    ]
  },

  summon_spawn: {
    name: 'summon_spawn',
    duration: 1.2,
    keyframes: [
      { time: 0, pose: {
        leftArm: { ox: 1, oy: -1, oz: 2 }, rightArm: { ox: 1, oy: 1, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 0 }, head: { ox: 0, oy: 0, oz: 0 },
        weapon: { ox: 1, oy: 0, oz: 2 }
      }, glow: 0.2, easing: 'easeIn' },
      { time: 0.4, pose: {
        leftArm: { ox: 2, oy: -2, oz: 3 }, rightArm: { ox: 2, oy: 2, oz: 3 },
        torso: { ox: 0, oy: 0, oz: 1 }, head: { ox: 0, oy: 0, oz: 1 },
        weapon: { ox: 2, oy: 0, oz: 4 }
      }, glow: 0.8, easing: 'easeInOut' },
      { time: 0.7, pose: {
        leftArm: { ox: 1, oy: -2, oz: 2 }, rightArm: { ox: 1, oy: 2, oz: 2 },
        torso: { ox: 0, oy: 0, oz: 0 }, head: { ox: 0, oy: 0, oz: 1 },
        weapon: { ox: 1, oy: 0, oz: 3 }
      }, glow: 1.0, easing: 'easeOut' },
      { time: 1.0, pose: {
        leftArm: { ox: 0, oy: -1, oz: 1 }, rightArm: { ox: 0, oy: 1, oz: 1 },
      }, glow: 0.3, easing: 'easeOut' },
      { time: 1.2, pose: {}, glow: 0 },
    ]
  },
};

export interface ClassMotionProfile {
  attackMotion: string;
  abilityMotion: string;
  attackSpeed: number;
  swingWeight: number;
  recoilScale: number;
}

export function getClassMotionProfile(heroClass: string, weaponType: WeaponType): ClassMotionProfile {
  switch (weaponType) {
    case 'heavy_axe': return { attackMotion: 'swing_vertical_chop', abilityMotion: 'swing_vertical_chop', attackSpeed: 0.9, swingWeight: 1.4, recoilScale: 1.3 };
    case 'spear': return { attackMotion: 'thrust_linear', abilityMotion: 'thrust_linear', attackSpeed: 1.1, swingWeight: 0.7, recoilScale: 0.8 };
    case 'war_hammer': return { attackMotion: 'slam_overhead', abilityMotion: 'slam_overhead', attackSpeed: 0.75, swingWeight: 1.6, recoilScale: 1.5 };
    case 'sword_shield': return { attackMotion: 'swing_horizontal', abilityMotion: 'swing_horizontal', attackSpeed: 1.0, swingWeight: 1.0, recoilScale: 1.0 };
    case 'greatsword': return { attackMotion: 'swing_horizontal', abilityMotion: 'swing_horizontal', attackSpeed: 0.85, swingWeight: 1.3, recoilScale: 1.2 };
    case 'axe_shield': return { attackMotion: 'swing_vertical_chop', abilityMotion: 'swing_vertical_chop', attackSpeed: 0.95, swingWeight: 1.1, recoilScale: 1.1 };
    case 'bow': return { attackMotion: 'bow_draw_release', abilityMotion: 'bow_draw_release', attackSpeed: 1.2, swingWeight: 0.5, recoilScale: 0.6 };
    case 'staff': return { attackMotion: 'staff_cast', abilityMotion: 'cast_channel', attackSpeed: 1.0, swingWeight: 0.6, recoilScale: 0.4 };
    case 'claws': return { attackMotion: 'claw_swipe', abilityMotion: 'claw_swipe', attackSpeed: 1.4, swingWeight: 0.8, recoilScale: 0.9 };
    default: return { attackMotion: 'swing_horizontal', abilityMotion: 'swing_horizontal', attackSpeed: 1.0, swingWeight: 1.0, recoilScale: 1.0 };
  }
}

export interface WeaponTrailPoint {
  x: number; y: number; z: number;
  time: number;
  alpha: number;
}

export class WeaponTrailSystem {
  private points: WeaponTrailPoint[] = [];
  private maxPoints = 12;
  private trailLifetime = 0.25;

  addPoint(x: number, y: number, z: number, time: number) {
    this.points.push({ x, y, z, time, alpha: 1.0 });
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  update(currentTime: number) {
    this.points = this.points.filter(p => (currentTime - p.time) < this.trailLifetime);
    for (const p of this.points) {
      p.alpha = 1.0 - (currentTime - p.time) / this.trailLifetime;
    }
  }

  getPoints(): WeaponTrailPoint[] {
    return this.points;
  }

  clear() {
    this.points = [];
  }
}

export function drawCastingCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, progress: number, time: number) {
  ctx.save();
  ctx.translate(x, y);

  const rotation = time * 2;
  const runeCount = 6;
  const innerRadius = Math.max(0.1, radius * 0.6);
  const outerRadius = Math.max(0.1, radius);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.3 + progress * 0.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 + progress * 12;

  ctx.beginPath();
  ctx.ellipse(0, 0, outerRadius, outerRadius * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, innerRadius, innerRadius * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < runeCount; i++) {
    const angle = rotation + (i / runeCount) * Math.PI * 2;
    const rx = Math.cos(angle) * (outerRadius * 0.8);
    const ry = Math.sin(angle) * (outerRadius * 0.28);
    ctx.globalAlpha = (0.4 + Math.sin(time * 4 + i) * 0.3) * progress;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + progress * 2, 0, Math.PI * 2);
    ctx.fill();

    const nextAngle = rotation + ((i + 0.5) / runeCount) * Math.PI * 2;
    const nx = Math.cos(nextAngle) * (innerRadius * 0.8);
    const ny = Math.sin(nextAngle) * (innerRadius * 0.28);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.15 * progress;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(nx, ny);
    ctx.stroke();
  }

  if (progress > 0.5) {
    const pCount = Math.floor(progress * 8);
    for (let i = 0; i < pCount; i++) {
      const pa = time * 3 + i * 1.1;
      const pr = outerRadius * (0.3 + Math.sin(pa) * 0.5);
      const px = Math.cos(pa * 1.3) * pr;
      const py = Math.sin(pa * 1.3) * pr * 0.35;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5 * (1 - Math.abs(Math.sin(pa)));
      ctx.beginPath();
      ctx.arc(px, py - Math.sin(time * 5 + i) * 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawWeaponTrail(ctx: CanvasRenderingContext2D, trail: WeaponTrailPoint[], color: string, baseWidth: number, facing: number) {
  if (trail.length < 2) return;
  ctx.save();

  for (let i = 1; i < trail.length; i++) {
    const p0 = trail[i - 1];
    const p1 = trail[i];
    const alpha = p1.alpha * 0.8;
    if (alpha < 0.02) continue;

    const width = baseWidth * p1.alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * alpha;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y - p0.z);
    ctx.lineTo(p1.x, p1.y - p1.z);
    ctx.stroke();
  }

  if (trail.length >= 3) {
    ctx.globalAlpha = trail[trail.length - 1].alpha * 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(trail[trail.length - 3].x, trail[trail.length - 3].y - trail[trail.length - 3].z);
    ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y - trail[trail.length - 1].z);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawAuraEffect(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, intensity: number, time: number) {
  ctx.save();

  const layers = 3;
  for (let i = 0; i < layers; i++) {
    const phase = time * (2 + i * 0.5) + i * 1.2;
    const pulse = 0.6 + Math.sin(phase) * 0.4;
    const radius = (12 + i * 6) * pulse * intensity;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color + Math.floor(40 * pulse * intensity).toString(16).padStart(2, '0'));
    grad.addColorStop(0.5, color + Math.floor(20 * pulse * intensity).toString(16).padStart(2, '0'));
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const particleCount = Math.floor(intensity * 6);
  for (let i = 0; i < particleCount; i++) {
    const pa = time * 2.5 + i * (Math.PI * 2 / particleCount);
    const pr = 8 + Math.sin(pa * 1.5) * 6;
    const px = x + Math.cos(pa) * pr;
    const py = y + Math.sin(pa) * pr - Math.abs(Math.sin(time * 3 + i)) * 8;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4 + Math.sin(pa) * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, 1 + intensity, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawTransformVFX(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, color: string, time: number) {
  ctx.save();

  if (progress < 1) {
    const burstRadius = 20 + progress * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, burstRadius);
    grad.addColorStop(0, color + 'aa');
    grad.addColorStop(0.4, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, burstRadius, 0, Math.PI * 2);
    ctx.fill();

    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const ringProgress = Math.max(0, progress - i * 0.15);
      const ringRadius = 10 + ringProgress * 50;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (1 - ringProgress);
      ctx.globalAlpha = (1 - ringProgress) * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    const sparkCount = 12;
    for (let i = 0; i < sparkCount; i++) {
      const sa = (i / sparkCount) * Math.PI * 2 + time * 3;
      const sd = 10 + progress * 30 + Math.sin(time * 5 + i) * 5;
      const sx = x + Math.cos(sa) * sd;
      const sy = y + Math.sin(sa) * sd;
      ctx.fillStyle = i % 3 === 0 ? '#ffd700' : color;
      ctx.globalAlpha = (1 - progress) * 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawSummonVFX(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, color: string, time: number) {
  ctx.save();

  const portalRadius = 15 + progress * 10;
  ctx.translate(x, y);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4 + progress * 0.4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(0, 0, portalRadius, portalRadius * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  const innerR = portalRadius * 0.7;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3 + progress * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, innerR, innerR * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, portalRadius);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.globalAlpha = progress * 0.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, portalRadius, portalRadius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (progress > 0.3) {
    const beamCount = 4;
    for (let i = 0; i < beamCount; i++) {
      const ba = time * 3 + (i / beamCount) * Math.PI * 2;
      const bx = Math.cos(ba) * innerR;
      const by = Math.sin(ba) * innerR * 0.3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = (progress - 0.3) * 0.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx * 0.2, by * 0.2 - progress * 15);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawHealingVFX(ctx: CanvasRenderingContext2D, x: number, y: number, intensity: number, time: number) {
  ctx.save();

  const spiralCount = 6;
  for (let i = 0; i < spiralCount; i++) {
    const angle = time * 2.5 + (i / spiralCount) * Math.PI * 2;
    const radius = 6 + Math.sin(time * 3 + i) * 4;
    const px = x + Math.cos(angle) * radius;
    const rise = (time * 30 + i * 8) % 30;
    const py = y - rise;
    const alpha = intensity * (1 - rise / 30) * 0.7;

    ctx.fillStyle = '#22c55e';
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + intensity * 0.5, 0, Math.PI * 2);
    ctx.fill();

    if (i % 2 === 0) {
      ctx.fillStyle = '#86efac';
      ctx.globalAlpha = alpha * 0.6;
      const lx = x + Math.cos(angle + 0.5) * (radius * 0.6);
      const ly = y - rise * 0.8;
      ctx.beginPath();
      ctx.arc(lx, ly, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, 12 * intensity);
  glowGrad.addColorStop(0, '#22c55e' + Math.floor(30 * intensity).toString(16).padStart(2, '0'));
  glowGrad.addColorStop(1, '#22c55e00');
  ctx.fillStyle = glowGrad;
  ctx.globalAlpha = 0.3 * intensity;
  ctx.beginPath();
  ctx.arc(x, y, 12 * intensity, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

export interface AttackPlan {
  motionName: string;
  duration: number;
  speedMult: number;
  weight: number;
  slashArc: number;
  slashAngleStart: number;
  slashWidth: number;
  slashColor: string;
  impactFlash: boolean;
  trailIntensity: number;
  screenShake: number;
}

export interface SpellVFXPlan {
  castCircle: boolean;
  castColor: string;
  castRadius: number;
  auraColor: string;
  auraIntensity: number;
  particleCount: number;
  particleColor: string;
  particleRise: boolean;
  orbGlow: boolean;
  orbColor: string;
  burstOnImpact: boolean;
  burstColor: string;
  burstRadius: number;
}

const COMBO_PATTERNS: Record<string, string[]> = {
  swing_horizontal: ['swing_horizontal', 'thrust_linear', 'swing_vertical_chop'],
  swing_vertical_chop: ['swing_vertical_chop', 'swing_horizontal', 'slam_overhead'],
  thrust_linear: ['thrust_linear', 'claw_swipe', 'thrust_linear'],
  slam_overhead: ['slam_overhead', 'swing_horizontal', 'slam_overhead'],
  claw_swipe: ['claw_swipe', 'claw_swipe', 'swing_horizontal'],
  bow_draw_release: ['bow_draw_release', 'bow_draw_release', 'bow_draw_release'],
  staff_cast: ['staff_cast', 'staff_cast', 'staff_cast'],
};

const CLASS_SLASH_COLORS: Record<string, string> = {
  Warrior: '#ef4444', Worg: '#f97316', Mage: '#8b5cf6', Ranger: '#22c55e',
};

const CLASS_SPELL_COLORS: Record<string, { cast: string; aura: string; particle: string; orb: string; burst: string }> = {
  Warrior: { cast: '#ef4444', aura: '#dc2626', particle: '#fca5a5', orb: '#ef4444', burst: '#ff6b6b' },
  Worg: { cast: '#f97316', aura: '#ea580c', particle: '#fed7aa', orb: '#f97316', burst: '#ff9f43' },
  Mage: { cast: '#8b5cf6', aura: '#7c3aed', particle: '#c4b5fd', orb: '#a78bfa', burst: '#c084fc' },
  Ranger: { cast: '#22c55e', aura: '#16a34a', particle: '#86efac', orb: '#4ade80', burst: '#34d399' },
};

export class AnimationDirector {
  private comboCounters: Map<number, number> = new Map();
  private lastAttackTime: Map<number, number> = new Map();
  private comboTimeout = 1.5;

  getComboCount(entityId: number): number {
    return this.comboCounters.get(entityId) || 0;
  }

  registerAttack(entityId: number, time: number): number {
    const lastTime = this.lastAttackTime.get(entityId) || 0;
    let combo = this.comboCounters.get(entityId) || 0;

    if (time - lastTime > this.comboTimeout) {
      combo = 0;
    }

    const currentCombo = combo;
    this.comboCounters.set(entityId, combo + 1);
    this.lastAttackTime.set(entityId, time);
    return currentCombo;
  }

  planAttack(heroClass: string, weaponType: WeaponType, entityId: number, targetAngle: number): AttackPlan {
    const profile = getClassMotionProfile(heroClass, weaponType);
    const rawCombo = this.comboCounters.get(entityId) || 0;
    const combo = Math.max(0, rawCombo - 1);
    const comboIdx = combo % 3;

    const baseMotion = profile.attackMotion;
    const pattern = COMBO_PATTERNS[baseMotion] || COMBO_PATTERNS['swing_horizontal'];
    const motionName = pattern[comboIdx];
    const motion = MOTION_LIBRARY[motionName];

    const isFinisher = comboIdx === 2;
    const speedVariation = 0.9 + (((entityId * 7 + combo * 13) % 100) / 100) * 0.2;
    const angleVariation = ((combo * 31 + entityId * 17) % 60 - 30) * (Math.PI / 180);

    const slashColor = CLASS_SLASH_COLORS[heroClass] || '#ef4444';

    return {
      motionName,
      duration: motion ? motion.duration / (profile.attackSpeed * speedVariation) : 0.65,
      speedMult: profile.attackSpeed * speedVariation,
      weight: profile.swingWeight * (isFinisher ? 1.3 : 1.0),
      slashArc: (motionName === 'swing_horizontal' ? 130 : motionName === 'swing_vertical_chop' ? 90 : motionName === 'thrust_linear' ? 40 : motionName === 'slam_overhead' ? 110 : 100) * (Math.PI / 180),
      slashAngleStart: targetAngle + angleVariation + (motionName === 'swing_horizontal' ? -Math.PI * 0.36 : -Math.PI * 0.25),
      slashWidth: (isFinisher ? 4.5 : 3) * profile.swingWeight,
      slashColor,
      impactFlash: isFinisher || motionName === 'slam_overhead',
      trailIntensity: isFinisher ? 1.5 : 1.0,
      screenShake: isFinisher ? 3 : motionName === 'slam_overhead' ? 2 : 0,
    };
  }

  planSpellVFX(heroClass: string, abilityKey: string): SpellVFXPlan {
    const colors = CLASS_SPELL_COLORS[heroClass] || CLASS_SPELL_COLORS['Warrior'];
    const isUltimate = abilityKey === 'R';
    const isDefensive = abilityKey === 'Space';

    return {
      castCircle: !isDefensive,
      castColor: colors.cast,
      castRadius: isUltimate ? 22 : 16,
      auraColor: colors.aura,
      auraIntensity: isUltimate ? 1.0 : 0.6,
      particleCount: isUltimate ? 12 : isDefensive ? 8 : 6,
      particleColor: colors.particle,
      particleRise: !isDefensive,
      orbGlow: heroClass === 'Mage' || isUltimate,
      orbColor: colors.orb,
      burstOnImpact: true,
      burstColor: colors.burst,
      burstRadius: isUltimate ? 30 : 18,
    };
  }

  getAIAttackPose(heroClass: string, weaponType: WeaponType, entityId: number, animTimer: number, facing: number): FullPose {
    const plan = this.planAttack(heroClass, weaponType, entityId, facing);
    const motion = MOTION_LIBRARY[plan.motionName];
    if (!motion) {
      return { leftLeg: zeroPose, rightLeg: zeroPose, leftArm: zeroPose, rightArm: zeroPose, torso: zeroPose, head: zeroPose, weapon: zeroPose, weaponGlow: 0 };
    }

    const scaledTime = animTimer * plan.speedMult;
    const motionPose = sampleMotion(motion, scaledTime);

    const combo = this.comboCounters.get(entityId) || 0;
    const isFinisher = (combo % 3) === 2;

    if (isFinisher) {
      return additivePoses(motionPose, motionPose, 0.15);
    }

    return motionPose;
  }

  cleanup(entityId: number) {
    this.comboCounters.delete(entityId);
    this.lastAttackTime.delete(entityId);
  }
}

export const globalAnimDirector = new AnimationDirector();

export function drawAISlashVFX(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  plan: AttackPlan,
  progress: number,
  time: number
) {
  if (progress < 0.15 || progress > 0.95) return;

  ctx.save();
  ctx.translate(x, y);

  const swingProgress = Math.max(0, Math.min(1, (progress - 0.2) / 0.45));
  const fadeOut = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.3) : 1;

  const arcLen = plan.slashArc * swingProgress;
  const startAngle = plan.slashAngleStart;
  const innerRadius = 8;
  const outerRadius = 18 + plan.slashWidth * 3;

  ctx.globalAlpha = 0.7 * fadeOut;
  ctx.shadowColor = plan.slashColor;
  ctx.shadowBlur = 10 + plan.slashWidth * 2;

  const grad = ctx.createRadialGradient(0, 0, innerRadius, 0, 0, outerRadius);
  grad.addColorStop(0, plan.slashColor + '00');
  grad.addColorStop(0.3, plan.slashColor + '88');
  grad.addColorStop(0.7, plan.slashColor + 'cc');
  grad.addColorStop(1, '#ffffff88');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius, startAngle, startAngle + arcLen);
  ctx.arc(0, 0, innerRadius, startAngle + arcLen, startAngle, true);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.5 * fadeOut;
  ctx.beginPath();
  ctx.arc(0, 0, outerRadius - 1, startAngle, startAngle + arcLen);
  ctx.stroke();

  if (swingProgress > 0.3) {
    const sparkCount = Math.floor(plan.trailIntensity * 5);
    for (let i = 0; i < sparkCount; i++) {
      const sa = startAngle + arcLen * (0.5 + Math.random() * 0.5);
      const sr = innerRadius + Math.random() * (outerRadius - innerRadius);
      const sparkX = Math.cos(sa) * sr + (Math.random() - 0.5) * 4;
      const sparkY = Math.sin(sa) * sr + (Math.random() - 0.5) * 4;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : plan.slashColor;
      ctx.globalAlpha = (0.3 + Math.random() * 0.5) * fadeOut;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 0.8 + Math.random() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (plan.impactFlash && swingProgress > 0.7) {
    const flashAlpha = Math.max(0, (swingProgress - 0.7) / 0.3) * fadeOut;
    const impactAngle = startAngle + arcLen;
    const impactX = Math.cos(impactAngle) * (outerRadius + 5);
    const impactY = Math.sin(impactAngle) * (outerRadius + 5);

    const flashGrad = ctx.createRadialGradient(impactX, impactY, 0, impactX, impactY, 12);
    flashGrad.addColorStop(0, '#ffffff');
    flashGrad.addColorStop(0.3, plan.slashColor);
    flashGrad.addColorStop(1, plan.slashColor + '00');
    ctx.fillStyle = flashGrad;
    ctx.globalAlpha = flashAlpha * 0.8;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.globalAlpha = flashAlpha * 0.5;
    ctx.beginPath();
    ctx.arc(impactX, impactY, 8 + flashAlpha * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawAISpellVFX(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  plan: SpellVFXPlan,
  progress: number,
  time: number
) {
  ctx.save();

  if (plan.castCircle && progress < 0.6) {
    const castAlpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.3;
    drawCastingCircle(ctx, x, y + 8, plan.castRadius, plan.castColor, castAlpha, time);
  }

  if (plan.auraIntensity > 0) {
    const auraPhase = Math.sin(time * 3) * 0.3 + 0.7;
    drawAuraEffect(ctx, x, y - 5, plan.auraColor, plan.auraIntensity * auraPhase * Math.min(1, progress * 3), time);
  }

  if (plan.particleCount > 0 && progress > 0.05) {
    const pAlpha = Math.min(1, progress * 2) * (progress < 0.8 ? 1 : (1 - progress) / 0.2);
    for (let i = 0; i < plan.particleCount; i++) {
      const pa = time * 2.5 + (i / plan.particleCount) * Math.PI * 2;
      const radius = 8 + Math.sin(time * 3 + i) * 5;
      const px = x + Math.cos(pa) * radius;
      let py = y - 5 + Math.sin(pa) * radius * 0.4;
      if (plan.particleRise) {
        py -= ((time * 20 + i * 6) % 25);
      }
      ctx.fillStyle = plan.particleColor;
      ctx.globalAlpha = pAlpha * (0.3 + Math.sin(pa) * 0.3);
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (plan.orbGlow && progress > 0.1 && progress < 0.8) {
    const orbProgress = Math.min(1, (progress - 0.1) / 0.3);
    const orbFade = progress > 0.6 ? (0.8 - progress) / 0.2 : 1;
    const orbRadius = 3 + orbProgress * 4;
    const orbPulse = 1 + Math.sin(time * 8) * 0.2;

    ctx.save();
    ctx.shadowColor = plan.orbColor;
    ctx.shadowBlur = 12 + orbProgress * 8;
    const orbGrad = ctx.createRadialGradient(x, y - 12, 0, x, y - 12, orbRadius * orbPulse);
    orbGrad.addColorStop(0, '#ffffff');
    orbGrad.addColorStop(0.4, plan.orbColor);
    orbGrad.addColorStop(1, plan.orbColor + '00');
    ctx.fillStyle = orbGrad;
    ctx.globalAlpha = orbFade * 0.9;
    ctx.beginPath();
    ctx.arc(x, y - 12, orbRadius * orbPulse, 0, Math.PI * 2);
    ctx.fill();

    const rayCount = 4;
    for (let i = 0; i < rayCount; i++) {
      const ra = time * 4 + (i / rayCount) * Math.PI * 2;
      const rx = Math.cos(ra) * orbRadius * orbPulse * 1.5;
      const ry = Math.sin(ra) * orbRadius * orbPulse * 1.5;
      ctx.strokeStyle = plan.orbColor;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = orbFade * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x + rx, y - 12 + ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (plan.burstOnImpact && progress > 0.7) {
    const burstProgress = (progress - 0.7) / 0.3;
    const burstAlpha = Math.max(0, 1 - burstProgress * 1.5);
    const radius = Math.max(0.1, plan.burstRadius * burstProgress);

    ctx.save();
    ctx.shadowColor = plan.burstColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = plan.burstColor;
    ctx.lineWidth = 2 * (1 - burstProgress);
    ctx.globalAlpha = burstAlpha * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    innerGrad.addColorStop(0, plan.burstColor + '33');
    innerGrad.addColorStop(1, plan.burstColor + '00');
    ctx.fillStyle = innerGrad;
    ctx.globalAlpha = burstAlpha * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    const burstSparks = 8;
    for (let i = 0; i < burstSparks; i++) {
      const sa = (i / burstSparks) * Math.PI * 2 + time * 2;
      const sd = radius * (0.5 + burstProgress * 0.5);
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : plan.burstColor;
      ctx.globalAlpha = burstAlpha * 0.5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(sa) * sd, y + Math.sin(sa) * sd, Math.max(0.1, 1.5 * (1 - burstProgress)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawShieldVFX(ctx: CanvasRenderingContext2D, x: number, y: number, shieldHp: number, maxShieldHp: number, time: number) {
  if (shieldHp <= 0) return;
  ctx.save();

  const ratio = shieldHp / maxShieldHp;
  const shieldRadius = 16 + ratio * 4;
  const shieldColor = ratio > 0.6 ? '#3b82f6' : ratio > 0.3 ? '#f59e0b' : '#ef4444';
  const pulse = 0.7 + Math.sin(time * 4) * 0.3;

  ctx.strokeStyle = shieldColor;
  ctx.lineWidth = 1.5 + ratio;
  ctx.globalAlpha = 0.4 + ratio * 0.4;
  ctx.shadowColor = shieldColor;
  ctx.shadowBlur = 6 + ratio * 8;

  ctx.beginPath();
  const hexPoints = 6;
  for (let i = 0; i <= hexPoints; i++) {
    const ha = (i / hexPoints) * Math.PI * 2 - Math.PI / 2;
    const hx = x + Math.cos(ha) * shieldRadius * pulse;
    const hy = y - 8 + Math.sin(ha) * shieldRadius * 0.7 * pulse;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();

  const innerGrad = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, shieldRadius);
  innerGrad.addColorStop(0, shieldColor + '15');
  innerGrad.addColorStop(0.7, shieldColor + '08');
  innerGrad.addColorStop(1, shieldColor + '00');
  ctx.fillStyle = innerGrad;
  ctx.globalAlpha = 0.5 * ratio;
  ctx.fill();

  if (ratio < 0.4) {
    const crackCount = Math.floor((1 - ratio) * 4);
    for (let i = 0; i < crackCount; i++) {
      const ca = (i / crackCount) * Math.PI * 2 + time;
      const cx = x + Math.cos(ca) * shieldRadius * 0.5;
      const cy = y - 8 + Math.sin(ca) * shieldRadius * 0.35;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.3 * (1 - ratio);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ca + 0.5) * 4, cy + Math.sin(ca + 0.5) * 3);
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}

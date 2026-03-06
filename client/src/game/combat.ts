export enum StatusEffectType {
  Stun = 'Stun',
  Freeze = 'Freeze',
  Root = 'Root',
  Silence = 'Silence',
  Poison = 'Poison',
  Bleed = 'Bleed',
  Burn = 'Burn',
  Curse = 'Curse',
  Slow = 'Slow',
  Haste = 'Haste',
  Immobilize = 'Immobilize',
  Blind = 'Blind',
  Sleep = 'Sleep',
  Fear = 'Fear',
  Shield = 'Shield',
  Regen = 'Regen',
  AtkBuff = 'AtkBuff',
  DefBuff = 'DefBuff',
  SpdBuff = 'SpdBuff',
  AtkDebuff = 'AtkDebuff',
  DefDebuff = 'DefDebuff',
  ArmorPen = 'ArmorPen',
  Lifesteal = 'Lifesteal',
  Invulnerable = 'Invulnerable',
}

export const CC_TYPES = new Set([
  StatusEffectType.Stun, StatusEffectType.Freeze, StatusEffectType.Root,
  StatusEffectType.Silence, StatusEffectType.Sleep, StatusEffectType.Fear,
  StatusEffectType.Immobilize,
]);

export const DOT_TYPES = new Set([
  StatusEffectType.Poison, StatusEffectType.Bleed, StatusEffectType.Burn, StatusEffectType.Curse,
]);

export const BUFF_TYPES = new Set([
  StatusEffectType.Haste, StatusEffectType.Shield, StatusEffectType.Regen,
  StatusEffectType.AtkBuff, StatusEffectType.DefBuff, StatusEffectType.SpdBuff,
  StatusEffectType.ArmorPen, StatusEffectType.Lifesteal, StatusEffectType.Invulnerable,
]);

export const DEBUFF_TYPES = new Set([
  StatusEffectType.Stun, StatusEffectType.Freeze, StatusEffectType.Root,
  StatusEffectType.Silence, StatusEffectType.Poison, StatusEffectType.Bleed,
  StatusEffectType.Burn, StatusEffectType.Curse, StatusEffectType.Slow,
  StatusEffectType.Immobilize, StatusEffectType.Blind, StatusEffectType.Sleep,
  StatusEffectType.Fear, StatusEffectType.AtkDebuff, StatusEffectType.DefDebuff,
]);

export interface StatusEffect {
  id: number;
  type: StatusEffectType;
  duration: number;
  remaining: number;
  tickRate: number;
  tickTimer: number;
  tickDamage: number;
  maxStacks: number;
  stacks: number;
  sourceId: number;
  value: number;
  name: string;
  color: string;
  icon: string;
}

export const EFFECT_COLORS: Record<StatusEffectType, string> = {
  [StatusEffectType.Stun]: '#fbbf24',
  [StatusEffectType.Freeze]: '#93c5fd',
  [StatusEffectType.Root]: '#854d0e',
  [StatusEffectType.Silence]: '#7c3aed',
  [StatusEffectType.Poison]: '#22c55e',
  [StatusEffectType.Bleed]: '#dc2626',
  [StatusEffectType.Burn]: '#f97316',
  [StatusEffectType.Curse]: '#6b21a8',
  [StatusEffectType.Slow]: '#64748b',
  [StatusEffectType.Haste]: '#06b6d4',
  [StatusEffectType.Immobilize]: '#78716c',
  [StatusEffectType.Blind]: '#1e293b',
  [StatusEffectType.Sleep]: '#c4b5fd',
  [StatusEffectType.Fear]: '#581c87',
  [StatusEffectType.Shield]: '#22d3ee',
  [StatusEffectType.Regen]: '#4ade80',
  [StatusEffectType.AtkBuff]: '#ef4444',
  [StatusEffectType.DefBuff]: '#3b82f6',
  [StatusEffectType.SpdBuff]: '#10b981',
  [StatusEffectType.AtkDebuff]: '#991b1b',
  [StatusEffectType.DefDebuff]: '#1e3a5f',
  [StatusEffectType.ArmorPen]: '#fca5a5',
  [StatusEffectType.Lifesteal]: '#be123c',
  [StatusEffectType.Invulnerable]: '#ffd700',
};

export const EFFECT_ICONS: Record<StatusEffectType, string> = {
  [StatusEffectType.Stun]: '⚡',
  [StatusEffectType.Freeze]: '❄',
  [StatusEffectType.Root]: '⌇',
  [StatusEffectType.Silence]: '🔇',
  [StatusEffectType.Poison]: '☠',
  [StatusEffectType.Bleed]: '🩸',
  [StatusEffectType.Burn]: '🔥',
  [StatusEffectType.Curse]: '💀',
  [StatusEffectType.Slow]: '🐌',
  [StatusEffectType.Haste]: '💨',
  [StatusEffectType.Immobilize]: '⛓',
  [StatusEffectType.Blind]: '👁',
  [StatusEffectType.Sleep]: '💤',
  [StatusEffectType.Fear]: '😱',
  [StatusEffectType.Shield]: '🛡',
  [StatusEffectType.Regen]: '💚',
  [StatusEffectType.AtkBuff]: '⚔',
  [StatusEffectType.DefBuff]: '🛡',
  [StatusEffectType.SpdBuff]: '🏃',
  [StatusEffectType.AtkDebuff]: '📉',
  [StatusEffectType.DefDebuff]: '📉',
  [StatusEffectType.ArmorPen]: '🗡',
  [StatusEffectType.Lifesteal]: '🧛',
  [StatusEffectType.Invulnerable]: '✨',
};

let nextEffectId = 1;

export function createStatusEffect(
  type: StatusEffectType,
  duration: number,
  sourceId: number,
  value = 0,
  tickRate = 0,
  tickDamage = 0,
  maxStacks = 1,
  name?: string,
): StatusEffect {
  return {
    id: nextEffectId++,
    type,
    duration,
    remaining: duration,
    tickRate,
    tickTimer: tickRate,
    tickDamage,
    maxStacks,
    stacks: 1,
    sourceId,
    value,
    name: name || type.toString(),
    color: EFFECT_COLORS[type],
    icon: EFFECT_ICONS[type],
  };
}

export interface CombatEntity {
  id: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  activeEffects: StatusEffect[];
  ccImmunityTimers: Map<StatusEffectType, number>;
}

export interface DamageResult {
  rawDamage: number;
  finalDamage: number;
  isCrit: boolean;
  isBlocked: boolean;
  absorbed: number;
  dotApplied: StatusEffect | null;
}

const CC_IMMUNITY_DURATION = 3.0;
const DIMINISHING_RETURNS_FACTOR = 0.5;

export function calculateDamage(
  attacker: { atk: number; activeEffects?: StatusEffect[] },
  target: { def: number; activeEffects?: StatusEffect[]; shieldHp?: number },
  baseDamage: number,
  critChance = 0.05,
  critMultiplier = 1.5,
  armorPenFlat = 0,
  armorPenPercent = 0,
): DamageResult {
  let atkMod = attacker.atk;
  let defMod = target.def;
  let bonusCritChance = critChance;
  let bonusArmorPen = armorPenFlat;

  if (attacker.activeEffects) {
    for (const eff of attacker.activeEffects) {
      if (eff.type === StatusEffectType.AtkBuff) atkMod += eff.value * eff.stacks;
      if (eff.type === StatusEffectType.ArmorPen) bonusArmorPen += eff.value * eff.stacks;
    }
  }

  if (target.activeEffects) {
    for (const eff of target.activeEffects) {
      if (eff.type === StatusEffectType.DefDebuff) defMod -= eff.value * eff.stacks;
      if (eff.type === StatusEffectType.AtkDebuff && (target as any) === (attacker as any)) atkMod -= eff.value * eff.stacks;
    }

    const invuln = target.activeEffects.find(e => e.type === StatusEffectType.Invulnerable);
    if (invuln) {
      return { rawDamage: baseDamage, finalDamage: 0, isCrit: false, isBlocked: true, absorbed: baseDamage, dotApplied: null };
    }
  }

  defMod = Math.max(0, defMod - bonusArmorPen);
  defMod = Math.max(0, defMod * (1 - armorPenPercent));

  const variance = 1 + (Math.random() * 0.2 - 0.1);
  let rawDmg = baseDamage * variance;

  const isCrit = Math.random() < bonusCritChance;
  if (isCrit) rawDmg *= critMultiplier;

  const reduction = defMod / (defMod + 50);
  let finalDmg = Math.max(1, Math.floor(rawDmg * (1 - reduction)));

  let absorbed = 0;
  if (target.shieldHp !== undefined && target.shieldHp > 0) {
    absorbed = Math.min(target.shieldHp, finalDmg);
    finalDmg -= absorbed;
  }

  return { rawDamage: baseDamage, finalDamage: finalDmg, isCrit, isBlocked: false, absorbed, dotApplied: null };
}

export function canApplyCC(entity: CombatEntity, ccType: StatusEffectType): boolean {
  if (!CC_TYPES.has(ccType)) return true;

  const immunity = entity.ccImmunityTimers?.get(ccType);
  if (immunity && immunity > 0) return false;

  const existing = entity.activeEffects.filter(e => e.type === ccType);
  if (existing.length > 0) return true;

  return true;
}

export function getCCDuration(entity: CombatEntity, ccType: StatusEffectType, baseDuration: number): number {
  const recentCC = entity.activeEffects.filter(e => CC_TYPES.has(e.type));
  const diminishing = Math.pow(DIMINISHING_RETURNS_FACTOR, Math.min(recentCC.length, 3));
  return baseDuration * diminishing;
}

export function applyStatusEffect(entity: CombatEntity, effect: StatusEffect): boolean {
  if (!entity.activeEffects) return false;

  if (CC_TYPES.has(effect.type)) {
    if (!canApplyCC(entity, effect.type)) return false;
    effect.remaining = getCCDuration(entity, effect.type, effect.duration);
  }

  const existing = entity.activeEffects.find(e => e.type === effect.type && e.sourceId === effect.sourceId);
  if (existing) {
    if (existing.stacks < effect.maxStacks) {
      existing.stacks++;
      existing.remaining = Math.max(existing.remaining, effect.remaining);
    } else {
      existing.remaining = effect.remaining;
    }
    return true;
  }

  entity.activeEffects.push({ ...effect });
  return true;
}

export function removeEffectsByType(entity: CombatEntity, type: StatusEffectType) {
  entity.activeEffects = entity.activeEffects.filter(e => e.type !== type);
}

export function cleanse(entity: CombatEntity) {
  entity.activeEffects = entity.activeEffects.filter(e => !DEBUFF_TYPES.has(e.type));
}

export function dispel(entity: CombatEntity) {
  entity.activeEffects = entity.activeEffects.filter(e => !BUFF_TYPES.has(e.type));
}

export interface TickResult {
  entityId: number;
  damage: number;
  heal: number;
  effectsExpired: StatusEffect[];
}

export function updateStatusEffects(entity: CombatEntity, dt: number): TickResult {
  const result: TickResult = { entityId: entity.id, damage: 0, heal: 0, effectsExpired: [] };

  let spdMod = 0;

  for (const eff of entity.activeEffects) {
    eff.remaining -= dt;

    if (DOT_TYPES.has(eff.type) && eff.tickRate > 0) {
      eff.tickTimer -= dt;
      if (eff.tickTimer <= 0) {
        eff.tickTimer = eff.tickRate;
        result.damage += eff.tickDamage * eff.stacks;
      }
    }

    if (eff.type === StatusEffectType.Regen && eff.tickRate > 0) {
      eff.tickTimer -= dt;
      if (eff.tickTimer <= 0) {
        eff.tickTimer = eff.tickRate;
        result.heal += eff.value * eff.stacks;
      }
    }

    if (eff.type === StatusEffectType.Slow) spdMod -= eff.value * eff.stacks;
    if (eff.type === StatusEffectType.Haste) spdMod += eff.value * eff.stacks;
  }

  const expired = entity.activeEffects.filter(e => e.remaining <= 0);
  result.effectsExpired = expired;

  for (const exp of expired) {
    if (CC_TYPES.has(exp.type)) {
      if (!entity.ccImmunityTimers) entity.ccImmunityTimers = new Map();
      entity.ccImmunityTimers.set(exp.type, CC_IMMUNITY_DURATION);
    }
  }

  entity.activeEffects = entity.activeEffects.filter(e => e.remaining > 0);

  if (entity.ccImmunityTimers) {
    for (const [type, timer] of Array.from(entity.ccImmunityTimers.entries())) {
      const newTimer = timer - dt;
      if (newTimer <= 0) entity.ccImmunityTimers.delete(type);
      else entity.ccImmunityTimers.set(type, newTimer);
    }
  }

  return result;
}

export function isStunned(entity: CombatEntity): boolean {
  return entity.activeEffects.some(e =>
    e.type === StatusEffectType.Stun ||
    e.type === StatusEffectType.Freeze ||
    e.type === StatusEffectType.Sleep
  );
}

export function isRooted(entity: CombatEntity): boolean {
  return entity.activeEffects.some(e =>
    e.type === StatusEffectType.Root ||
    e.type === StatusEffectType.Immobilize
  );
}

export function isSilenced(entity: CombatEntity): boolean {
  return entity.activeEffects.some(e => e.type === StatusEffectType.Silence);
}

export function isFeared(entity: CombatEntity): boolean {
  return entity.activeEffects.some(e => e.type === StatusEffectType.Fear);
}

export function getSpeedMultiplier(entity: CombatEntity): number {
  let mult = 1.0;
  for (const eff of entity.activeEffects) {
    if (eff.type === StatusEffectType.Slow) mult -= (eff.value / 100) * eff.stacks;
    if (eff.type === StatusEffectType.Haste) mult += (eff.value / 100) * eff.stacks;
  }
  return Math.max(0.1, Math.min(3.0, mult));
}

export function getAtkMultiplier(entity: CombatEntity): number {
  let mult = 1.0;
  for (const eff of entity.activeEffects) {
    if (eff.type === StatusEffectType.AtkBuff) mult += (eff.value / 100) * eff.stacks;
    if (eff.type === StatusEffectType.AtkDebuff) mult -= (eff.value / 100) * eff.stacks;
  }
  return Math.max(0.1, mult);
}

export function getDefMultiplier(entity: CombatEntity): number {
  let mult = 1.0;
  for (const eff of entity.activeEffects) {
    if (eff.type === StatusEffectType.DefBuff) mult += (eff.value / 100) * eff.stacks;
    if (eff.type === StatusEffectType.DefDebuff) mult -= (eff.value / 100) * eff.stacks;
  }
  return Math.max(0.0, mult);
}

export function hasLifesteal(entity: CombatEntity): number {
  let total = 0;
  for (const eff of entity.activeEffects) {
    if (eff.type === StatusEffectType.Lifesteal) total += eff.value * eff.stacks;
  }
  return total / 100;
}

export function getShieldAmount(entity: CombatEntity): number {
  let total = 0;
  for (const eff of entity.activeEffects) {
    if (eff.type === StatusEffectType.Shield) total += eff.value * eff.stacks;
  }
  return total;
}

export const ABILITY_EFFECTS: Record<string, StatusEffect[]> = {};

export function getAbilityStatusEffects(abilityName: string, sourceId: number, heroAtk: number): StatusEffect[] {
  switch (abilityName) {
    case 'Shield Bash':
      return [createStatusEffect(StatusEffectType.Stun, 1.5, sourceId, 0, 0, 0, 1, 'Shield Bash Stun')];
    case 'Battle Cry':
    case 'Rally':
      return [createStatusEffect(StatusEffectType.AtkBuff, 5, sourceId, 25, 0, 0, 1, 'Rally')];
    case 'Avatar':
      return [
        createStatusEffect(StatusEffectType.AtkBuff, 10, sourceId, 50, 0, 0, 1, 'Avatar ATK'),
        createStatusEffect(StatusEffectType.DefBuff, 10, sourceId, 30, 0, 0, 1, 'Avatar DEF'),
      ];
    case 'Feral Charge':
      return [createStatusEffect(StatusEffectType.Slow, 1.5, sourceId, 40, 0, 0, 1, 'Impact Slow')];
    case 'Howl':
      return [createStatusEffect(StatusEffectType.Slow, 3, sourceId, 30, 0, 0, 1, 'Howl Slow')];
    case 'Rend':
      return [createStatusEffect(StatusEffectType.Bleed, 3, sourceId, 0, 0.5, Math.floor(heroAtk * 0.3), 3, 'Rend Bleed')];
    case 'Primal Fury':
      return [
        createStatusEffect(StatusEffectType.Haste, 12, sourceId, 40, 0, 0, 1, 'Frenzy Speed'),
        createStatusEffect(StatusEffectType.Lifesteal, 12, sourceId, 20, 0, 0, 1, 'Frenzy Lifesteal'),
      ];
    case 'Fireball':
      return [createStatusEffect(StatusEffectType.Burn, 3, sourceId, 0, 1, Math.floor(heroAtk * 0.2), 1, 'Fireball Burn')];
    case 'Frost Nova':
      return [createStatusEffect(StatusEffectType.Freeze, 2, sourceId, 0, 0, 0, 1, 'Frozen')];
    case 'Arcane Barrier':
      return [createStatusEffect(StatusEffectType.Shield, 4, sourceId, 100, 0, 0, 1, 'Arcane Shield')];
    case 'Meteor':
      return [createStatusEffect(StatusEffectType.Burn, 4, sourceId, 0, 0.5, Math.floor(heroAtk * 0.4), 1, 'Meteor Burn')];
    case 'Trap':
      return [createStatusEffect(StatusEffectType.Root, 2, sourceId, 0, 0, 0, 1, 'Trapped')];
    case 'Shadow Step':
      return [createStatusEffect(StatusEffectType.Haste, 1, sourceId, 100, 0, 0, 1, 'Shadow Speed')];
    case 'Storm of Arrows':
      return [createStatusEffect(StatusEffectType.Slow, 3, sourceId, 20, 0, 0, 1, 'Arrow Rain Slow')];
    case 'Skull Splitter':
      return [createStatusEffect(StatusEffectType.DefDebuff, 4, sourceId, 20, 0, 0, 1, 'DEF Shred')];
    case 'War Cry':
      return [createStatusEffect(StatusEffectType.Fear, 1.5, sourceId, 0, 0, 0, 1, 'War Cry Fear')];
    case 'Cleave':
      return [];
    case 'Blood Fury':
      return [
        createStatusEffect(StatusEffectType.AtkBuff, 10, sourceId, 40, 0, 0, 1, 'Blood Fury ATK'),
        createStatusEffect(StatusEffectType.Lifesteal, 10, sourceId, 30, 0, 0, 1, 'Blood Fury Lifesteal'),
        createStatusEffect(StatusEffectType.Haste, 10, sourceId, 20, 0, 0, 1, 'Blood Fury Speed'),
      ];
    case 'Piercing Strike':
      return [];
    case 'Wind Walk':
      return [createStatusEffect(StatusEffectType.Invulnerable, 1, sourceId, 0, 0, 0, 1, 'Wind Walk')];
    case 'Glaive Sweep':
      return [createStatusEffect(StatusEffectType.Slow, 2, sourceId, 25, 0, 0, 1, 'Glaive Slow')];
    case 'Dance of Blades':
      return [];
    default:
      return [];
  }
}

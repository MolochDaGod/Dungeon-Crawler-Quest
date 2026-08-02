/**
 * Weapon / class skill runtime for DCQ 3D modes.
 * Uses existing CLASS_ABILITIES + getHeroAbilities — no new skill content.
 */

import {
  type AbilityDef,
  getHeroAbilities,
  CLASS_ABILITIES,
} from "@/game/types";

export interface ModeSkillState {
  abilities: AbilityDef[];
  /** Remaining cooldown seconds per ability index */
  cds: number[];
  mp: number;
  maxMp: number;
}

export function createModeSkills(
  race: string,
  heroClass: string,
): ModeSkillState {
  let abilities = getHeroAbilities(race, heroClass);
  if (!abilities?.length) {
    // Fallback generic warrior pack
    abilities =
      CLASS_ABILITIES.Human_Warrior ||
      Object.values(CLASS_ABILITIES)[0] ||
      [];
  }
  // Cap to 4 skills for 3D HUD (Q E Space R style)
  abilities = abilities.slice(0, 4);
  return {
    abilities,
    cds: abilities.map(() => 0),
    mp: 100,
    maxMp: 100,
  };
}

export function tickModeSkills(state: ModeSkillState, dt: number): void {
  for (let i = 0; i < state.cds.length; i++) {
    if (state.cds[i] > 0) state.cds[i] = Math.max(0, state.cds[i] - dt);
  }
  // Slow MP regen
  state.mp = Math.min(state.maxMp, state.mp + 4 * dt);
}

export interface SkillCastResult {
  ok: boolean;
  ability: AbilityDef | null;
  reason?: string;
}

/**
 * Try cast skill by hotkey index 0..3 (keys 1-4 or Q/E/F/R).
 * Returns ability if fired.
 */
export function tryCastSkill(
  state: ModeSkillState,
  index: number,
): SkillCastResult {
  const ability = state.abilities[index];
  if (!ability) return { ok: false, ability: null, reason: "no-skill" };
  if (state.cds[index] > 0) return { ok: false, ability, reason: "cooldown" };
  if (state.mp < (ability.manaCost || 0)) {
    return { ok: false, ability, reason: "mana" };
  }
  state.mp -= ability.manaCost || 0;
  state.cds[index] = ability.cooldown || 0.4;
  return { ok: true, ability };
}

/** Map keyboard to skill index for 3D modes (1-4 / Q E F R — not Space/WASD). */
export function skillIndexFromKey(key: string): number {
  const k = key.toLowerCase();
  if (k === "1" || k === "q") return 0;
  if (k === "2") return 1; // E is interact in controller — use 2
  if (k === "3" || k === "f") return 2;
  if (k === "4" || k === "r") return 3;
  return -1;
}

export function skillHudLabel(a: AbilityDef): string {
  return `${a.key || "?"} ${a.name}`;
}

/**
 * BabylonJS Animation Retargeting — drop-in replacement for animation-retarget.ts
 *
 * Uses BabylonJS 9.0 native AnimatorAvatar for retargeting, with the same
 * canonical bone table and convention detection from the Three.js version.
 */

import { AnimatorAvatar } from "@babylonjs/core/Animations/animatorAvatar";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

// Re-export the convention detection and canonical bones from the original
// (these are pure string logic, no Three.js dependency)
export {
  CANONICAL_BONES,
  type CanonicalBone,
  type SkeletonConvention,
  detectConvention,
  extractCanonicalBone,
  BONE_ALIASES,
  BLENDER_LR_ALIASES,
} from "./animation-retarget";

import { extractCanonicalBone, CANONICAL_BONES, type CanonicalBone } from "./animation-retarget";

// ── Bone Map Builder ─────────────────────────────────────────────────────────

/**
 * Build a Map<string, string> for AnimatorAvatar.retargetAnimationGroup()
 * from source bone names to target bone names, using canonical names as
 * the intermediate.
 */
export function buildBoneMap(
  sourceNames: string[],
  targetNames: string[],
): Map<string, string> {
  const map = new Map<string, string>();

  // Build target lookup: canonical → target name
  const targetByCanonical = new Map<CanonicalBone, string>();
  for (const tName of targetNames) {
    const canonical = extractCanonicalBone(tName);
    if (canonical) targetByCanonical.set(canonical, tName);
  }

  // Map source → canonical → target
  for (const sName of sourceNames) {
    const canonical = extractCanonicalBone(sName);
    if (canonical && targetByCanonical.has(canonical)) {
      map.set(sName, targetByCanonical.get(canonical)!);
    }
  }

  return map;
}

// ── Retarget Using AnimatorAvatar ────────────────────────────────────────────

/**
 * Retarget an AnimationGroup from a source skeleton onto a target character.
 * Uses BabylonJS 9.0's native AnimatorAvatar.
 *
 * @param targetRoot - The root TransformNode of the target character
 * @param sourceGroup - The animation group to retarget
 * @param mapNodeNames - Optional bone name mapping (auto-generated if not provided)
 * @returns The retargeted AnimationGroup, ready to play on the target
 */
export function retargetAnimationGroup(
  targetRoot: TransformNode,
  sourceGroup: AnimationGroup,
  mapNodeNames?: Map<string, string>,
): AnimationGroup {
  const avatar = new AnimatorAvatar("retarget-avatar", targetRoot);

  return avatar.retargetAnimationGroup(sourceGroup, {
    animationGroupName: `retarget_${sourceGroup.name}`,
    fixRootPosition: true,
    fixGroundReference: true,
    rootNodeName: "Hips",
    groundReferenceNodeName: "LeftFoot",
    mapNodeNames,
  });
}

/**
 * Auto-detect bone naming conventions and retarget.
 * Extracts bone names from the source animation and target skeleton,
 * builds a mapping through canonical names, then retargets.
 */
export function autoRetargetAnimationGroup(
  targetRoot: TransformNode,
  sourceGroup: AnimationGroup,
): AnimationGroup {
  // Extract source bone names from the animation group's targeted animations
  const sourceNames: string[] = [];
  for (const ta of sourceGroup.targetedAnimations) {
    if (ta.target?.name) sourceNames.push(ta.target.name);
  }

  // Extract target bone names from the character's node hierarchy
  const targetNames: string[] = [];
  const collectNames = (node: TransformNode) => {
    targetNames.push(node.name);
    for (const child of node.getChildren()) {
      if ("name" in child) collectNames(child as TransformNode);
    }
  };
  collectNames(targetRoot);

  // Build the mapping
  const boneMap = buildBoneMap(sourceNames, targetNames);

  return retargetAnimationGroup(targetRoot, sourceGroup, boneMap);
}

/**
 * Retarget all animation groups from a source and apply to a target entity.
 * Returns a Map of name → retargeted AnimationGroup.
 */
export function retargetAllAnimations(
  targetRoot: TransformNode,
  sourceGroups: AnimationGroup[],
): Map<string, AnimationGroup> {
  const result = new Map<string, AnimationGroup>();

  for (const group of sourceGroups) {
    try {
      const retargeted = autoRetargetAnimationGroup(targetRoot, group);
      result.set(group.name.toLowerCase(), retargeted);
    } catch (err) {
      console.warn(`[babylon-retarget] Failed to retarget "${group.name}":`, err);
    }
  }

  return result;
}

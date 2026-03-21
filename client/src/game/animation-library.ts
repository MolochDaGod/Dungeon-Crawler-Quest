/**
 * Animation Library — master registry of every available animation clip.
 *
 * Each animation has:
 *   - A canonical name (e.g. 'combat.slash_combo')
 *   - The source GLB/FBX file it lives in
 *   - The original clip name inside that file
 *   - Category, tags, duration, loop flag
 *
 * The retarget system (animation-retarget.ts) can apply any clip from this
 * library to any humanoid skeleton regardless of bone naming convention.
 */

// ── Types ──────────────────────────────────────────────────────

export type AnimCategory =
  | 'idle'
  | 'movement'
  | 'combat_melee'
  | 'combat_ranged'
  | 'combat_magic'
  | 'combat_reaction'
  | 'dodge'
  | 'block'
  | 'death'
  | 'social'
  | 'harvesting'
  | 'swimming'
  | 'npc_idle'
  | 'mount'
  | 'misc';

export interface AnimEntry {
  /** Canonical name — unique key used in code */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Category for filtering */
  category: AnimCategory;
  /** Source file (relative to /assets/models/) */
  source: string;
  /** Original clip name inside the source file */
  clipName: string;
  /** Approximate duration in seconds */
  duration: number;
  /** Whether the animation should loop */
  loop: boolean;
  /** Tags for filtering/search */
  tags: string[];
  /** Which classes can use this (empty = all) */
  classes: string[];
}

// ── Registry ───────────────────────────────────────────────────

export const ANIM_LIBRARY: AnimEntry[] = [
  // ═══════════════════════════════════════════════════════════════
  // CC0 ESSENTIAL ANIMATIONS (universal — works on any humanoid)
  // These are animation-only FBX files, no mesh. CC0 licensed.
  // ═══════════════════════════════════════════════════════════════
  { id: 'cc0.idle', name: 'CC0 Idle', category: 'idle', source: 'animations/Idle.fbx', clipName: 'mixamo.com', duration: 3.0, loop: true, tags: ['idle', 'cc0', 'universal', 'default'], classes: [] },
  { id: 'cc0.run', name: 'CC0 Run', category: 'movement', source: 'animations/Run.fbx', clipName: 'mixamo.com', duration: 0.8, loop: true, tags: ['run', 'cc0', 'universal', 'default'], classes: [] },
  { id: 'cc0.attack', name: 'CC0 Attack', category: 'combat_melee', source: 'animations/Attack.fbx', clipName: 'mixamo.com', duration: 1.0, loop: false, tags: ['attack', 'cc0', 'universal', 'melee'], classes: [] },
  { id: 'cc0.hit', name: 'CC0 Hit React', category: 'combat_reaction', source: 'animations/Hit.fbx', clipName: 'mixamo.com', duration: 0.6, loop: false, tags: ['hit', 'cc0', 'universal', 'flinch'], classes: [] },
  { id: 'cc0.death', name: 'CC0 Death', category: 'death', source: 'animations/Death.fbx', clipName: 'mixamo.com', duration: 2.0, loop: false, tags: ['death', 'cc0', 'universal'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // IDLE
  // ═══════════════════════════════════════════════════════════════
  { id: 'idle.basic', name: 'Idle', category: 'idle', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Idle', duration: 10, loop: true, tags: ['idle', 'default'], classes: [] },
  { id: 'idle.wizard', name: 'Wizard Idle', category: 'idle', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Idle', duration: 3.13, loop: true, tags: ['idle', 'mage'], classes: ['Mage'] },
  { id: 'idle.weapon', name: 'Idle (Weapon Ready)', category: 'idle', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Idle_Weapon', duration: 3.13, loop: true, tags: ['idle', 'weapon', 'combat'], classes: [] },
  { id: 'idle.neutral', name: 'Idle Neutral', category: 'idle', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Idle_Neutral', duration: 2.08, loop: true, tags: ['idle', 'neutral'], classes: [] },
  { id: 'idle.sword', name: 'Idle (Sword)', category: 'idle', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Idle_Sword', duration: 2.08, loop: true, tags: ['idle', 'sword', 'combat'], classes: ['Warrior'] },
  { id: 'idle.gun', name: 'Idle (Gun)', category: 'idle', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Idle_Gun', duration: 2.08, loop: true, tags: ['idle', 'ranged'], classes: ['Ranger'] },
  { id: 'idle.combat_02', name: 'Combat Idle 2', category: 'idle', source: 'characters/berserker.glb', clipName: 'Idle_02', duration: 3.67, loop: true, tags: ['idle', 'combat', 'berserker'], classes: ['Warrior'] },
  { id: 'idle.combat_03', name: 'Combat Idle 3', category: 'idle', source: 'characters/berserker.glb', clipName: 'Idle_03', duration: 2.03, loop: true, tags: ['idle', 'combat'], classes: [] },
  { id: 'idle.combat_toon', name: 'Toon Attack Idle', category: 'idle', source: 'characters/Character_Toon_Animated.glb', clipName: 'Attacking_Idle', duration: 1.67, loop: true, tags: ['idle', 'combat', 'toon'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT
  // ═══════════════════════════════════════════════════════════════
  { id: 'move.walk', name: 'Walk', category: 'movement', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Walk', duration: 1.0, loop: true, tags: ['walk', 'default'], classes: [] },
  { id: 'move.run', name: 'Run', category: 'movement', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Run', duration: 0.63, loop: true, tags: ['run', 'default'], classes: [] },
  { id: 'move.run_fast', name: 'Run Fast', category: 'movement', source: 'characters/ElfRanger.glb', clipName: 'run_fast_2', duration: 1.63, loop: true, tags: ['run', 'fast', 'sprint'], classes: [] },
  { id: 'move.run_forward', name: 'Run Forward', category: 'movement', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Run', duration: 1.0, loop: true, tags: ['run'], classes: [] },
  { id: 'move.run_back', name: 'Run Backward', category: 'movement', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Run_Back', duration: 1.04, loop: true, tags: ['run', 'back', 'retreat'], classes: [] },
  { id: 'move.run_left', name: 'Run Strafe Left', category: 'movement', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Run_Left', duration: 1.0, loop: true, tags: ['run', 'strafe', 'left'], classes: [] },
  { id: 'move.run_right', name: 'Run Strafe Right', category: 'movement', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Run_Right', duration: 1.0, loop: true, tags: ['run', 'strafe', 'right'], classes: [] },
  { id: 'move.walk_wizard', name: 'Wizard Walk', category: 'movement', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Walk', duration: 1.25, loop: true, tags: ['walk', 'mage'], classes: ['Mage'] },
  { id: 'move.sneaky_walk', name: 'Sneaky Walk', category: 'movement', source: 'characters/fabledworker.glb', clipName: 'Sneaky_Walk', duration: 4.0, loop: true, tags: ['walk', 'stealth', 'sneak'], classes: ['Ranger'] },
  { id: 'move.sprint', name: 'Sprint', category: 'movement', source: 'characters/siegeman.glb', clipName: 'Lean_Forward_Sprint_inplace', duration: 2.6, loop: true, tags: ['run', 'sprint', 'charge'], classes: [] },
  { id: 'move.injured_walk', name: 'Injured Walk', category: 'movement', source: 'characters/undeadworker.glb', clipName: 'Injured_Walk', duration: 1.5, loop: true, tags: ['walk', 'injured', 'limp'], classes: [] },
  { id: 'move.limping', name: 'Limping Walk', category: 'movement', source: 'characters/siegeman.glb', clipName: 'Limping_Walk_3', duration: 2.27, loop: true, tags: ['walk', 'limp', 'injured'], classes: [] },
  { id: 'move.stumble', name: 'Stumble Walk', category: 'movement', source: 'characters/siegeman.glb', clipName: 'Stumble_Walk', duration: 2.53, loop: true, tags: ['walk', 'stumble', 'drunk'], classes: [] },
  { id: 'move.excited_walk', name: 'Excited Walk', category: 'movement', source: 'characters/dwarf_enforcer.glb', clipName: 'Excited_Walk_F', duration: 2.5, loop: true, tags: ['walk', 'excited', 'happy', 'npc'], classes: [] },
  { id: 'move.jump', name: 'Jump', category: 'movement', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Jump', duration: 1.0, loop: false, tags: ['jump'], classes: [] },
  { id: 'move.jump_run', name: 'Running Jump', category: 'movement', source: 'characters/siegeman.glb', clipName: 'Jump_Run', duration: 1.03, loop: false, tags: ['jump', 'run'], classes: [] },
  { id: 'move.slide_right', name: 'Slide Right', category: 'movement', source: 'characters/ElfRanger.glb', clipName: 'slide_right', duration: 2.1, loop: false, tags: ['slide', 'dodge'], classes: ['Ranger'] },

  // ═══════════════════════════════════════════════════════════════
  // COMBAT — MELEE
  // ═══════════════════════════════════════════════════════════════
  { id: 'combat.punch', name: 'Punch', category: 'combat_melee', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Punch', duration: 0.75, loop: false, tags: ['punch', 'melee', 'unarmed'], classes: [] },
  { id: 'combat.punch_left', name: 'Punch Left', category: 'combat_melee', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Punch_Left', duration: 1.04, loop: false, tags: ['punch', 'left'], classes: [] },
  { id: 'combat.punch_right', name: 'Punch Right', category: 'combat_melee', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Punch_Right', duration: 1.04, loop: false, tags: ['punch', 'right'], classes: [] },
  { id: 'combat.kick_left', name: 'Kick Left', category: 'combat_melee', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Kick_Left', duration: 1.17, loop: false, tags: ['kick', 'left'], classes: [] },
  { id: 'combat.kick_right', name: 'Kick Right', category: 'combat_melee', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Kick_Right', duration: 1.17, loop: false, tags: ['kick', 'right'], classes: [] },
  { id: 'combat.sword_slash', name: 'Sword Slash', category: 'combat_melee', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Sword_Slash', duration: 1.29, loop: false, tags: ['slash', 'sword', 'melee'], classes: ['Warrior'] },
  { id: 'combat.dagger_1', name: 'Dagger Attack', category: 'combat_melee', source: 'characters/Character_Toon_Animated.glb', clipName: 'Dagger_Attack', duration: 0.75, loop: false, tags: ['dagger', 'quick', 'melee'], classes: ['Ranger'] },
  { id: 'combat.dagger_2', name: 'Dagger Attack 2', category: 'combat_melee', source: 'characters/Character_Toon_Animated.glb', clipName: 'Dagger_Attack2', duration: 1.25, loop: false, tags: ['dagger', 'combo'], classes: ['Ranger'] },
  { id: 'combat.staff_attack', name: 'Staff Attack', category: 'combat_melee', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Staff_Attack', duration: 0.75, loop: false, tags: ['staff', 'melee', 'mage'], classes: ['Mage'] },
  { id: 'combat.charged_slash', name: 'Charged Upward Slash', category: 'combat_melee', source: 'characters/berserker.glb', clipName: 'Charged_Upward_Slash', duration: 1.03, loop: false, tags: ['slash', 'charged', 'heavy'], classes: ['Warrior'] },
  { id: 'combat.ground_slam', name: 'Ground Slam', category: 'combat_melee', source: 'characters/berserker.glb', clipName: 'Charged_Ground_Slam', duration: 2.5, loop: false, tags: ['slam', 'aoe', 'ground'], classes: ['Warrior'] },
  { id: 'combat.axe_spin', name: 'Axe Spin Attack', category: 'combat_melee', source: 'characters/berserker.glb', clipName: 'Axe_Spin_Attack', duration: 3.17, loop: false, tags: ['axe', 'spin', 'aoe'], classes: ['Warrior'] },
  { id: 'combat.double_blade_spin', name: 'Double Blade Spin', category: 'combat_melee', source: 'characters/berserker.glb', clipName: 'Double_Blade_Spin', duration: 7.0, loop: false, tags: ['spin', 'dual', 'channel'], classes: ['Warrior'] },
  { id: 'combat.punch_combo_1', name: 'Punch Combo 1', category: 'combat_melee', source: 'characters/BarbarianGlad.glb', clipName: 'Punch_Combo_1', duration: 3.0, loop: false, tags: ['combo', 'punch'], classes: [] },
  { id: 'combat.punch_combo_5', name: 'Punch Combo 5', category: 'combat_melee', source: 'characters/dwarf_enforcer.glb', clipName: 'Punch_Combo_5', duration: 0.9, loop: false, tags: ['combo', 'punch', 'fast'], classes: [] },
  { id: 'combat.right_sword_slash', name: 'Right Sword Slash', category: 'combat_melee', source: 'characters/ElfRanger.glb', clipName: 'Right_Hand_Sword_Slash', duration: 3.83, loop: false, tags: ['slash', 'sword', 'right'], classes: ['Warrior', 'Ranger'] },
  { id: 'combat.thrust_slash', name: 'Thrust Slash', category: 'combat_melee', source: 'characters/ElfRanger.glb', clipName: 'Thrust_Slash', duration: 7.03, loop: false, tags: ['thrust', 'spear', 'slash'], classes: [] },
  { id: 'combat.sweep_kick', name: 'Sweep Kick', category: 'combat_melee', source: 'characters/ElfRanger.glb', clipName: 'Sweep_Kick', duration: 2.3, loop: false, tags: ['kick', 'sweep', 'knockdown'], classes: [] },
  { id: 'combat.weapon_combo_2', name: 'Weapon Combo 2', category: 'combat_melee', source: 'characters/ElfRanger.glb', clipName: 'Weapon_Combo_2', duration: 2.33, loop: false, tags: ['combo', 'weapon'], classes: [] },
  { id: 'combat.hammer_swing', name: 'Heavy Hammer Swing', category: 'combat_melee', source: 'characters/fabledworker.glb', clipName: 'Heavy_Hammer_Swing', duration: 2.87, loop: false, tags: ['hammer', 'heavy', 'swing'], classes: ['Warrior'] },
  { id: 'combat.double_combo', name: 'Double Combo Attack', category: 'combat_melee', source: 'characters/humandeathgiver.glb', clipName: 'Double_Combo_Attack', duration: 3.17, loop: false, tags: ['combo', 'double', 'sword'], classes: ['Warrior'] },
  { id: 'combat.sword_judgment', name: 'Sword Judgment', category: 'combat_melee', source: 'characters/humandeathgiver.glb', clipName: 'Sword_Judgment', duration: 3.67, loop: false, tags: ['sword', 'judgment', 'finisher'], classes: ['Warrior'] },
  { id: 'combat.weapon_combo', name: 'Weapon Combo', category: 'combat_melee', source: 'characters/humandeathgiver.glb', clipName: 'Weapon_Combo', duration: 6.17, loop: false, tags: ['combo', 'weapon', 'long'], classes: [] },
  { id: 'combat.reaping_swing', name: 'Reaping Swing', category: 'combat_melee', source: 'creatures/GoblinCr3w.glb', clipName: 'Reaping_Swing', duration: 1.03, loop: false, tags: ['reap', 'swing', 'scythe'], classes: [] },
  { id: 'combat.lunge_spin_kick', name: 'Lunge Spin Kick', category: 'combat_melee', source: 'creatures/GoblinCr3w.glb', clipName: 'Lunge_Spin_Kick', duration: 3.0, loop: false, tags: ['lunge', 'spin', 'kick'], classes: [] },
  { id: 'combat.elbow_strike', name: 'Elbow Strike', category: 'combat_melee', source: 'characters/graatorc.glb', clipName: 'Elbow_Strike', duration: 2.47, loop: false, tags: ['elbow', 'close'], classes: [] },
  { id: 'combat.flying_fist_kick', name: 'Flying Fist Kick', category: 'combat_melee', source: 'characters/graatorc.glb', clipName: 'Flying_Fist_Kick', duration: 1.77, loop: false, tags: ['flying', 'kick', 'aerial'], classes: [] },
  { id: 'combat.rightward_spin', name: 'Rightward Spin', category: 'combat_melee', source: 'characters/berserker.glb', clipName: 'Rightward_Spin', duration: 0.53, loop: false, tags: ['spin', 'quick'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // COMBAT — RANGED
  // ═══════════════════════════════════════════════════════════════
  { id: 'combat.gun_shoot', name: 'Gun Shoot', category: 'combat_ranged', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Gun_Shoot', duration: 0.75, loop: false, tags: ['gun', 'shoot', 'ranged'], classes: ['Ranger'] },
  { id: 'combat.run_shoot', name: 'Run and Shoot', category: 'combat_ranged', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Run_Shoot', duration: 1.04, loop: true, tags: ['gun', 'run', 'shoot'], classes: ['Ranger'] },
  { id: 'combat.archery_shot', name: 'Archery Shot', category: 'combat_ranged', source: 'characters/orcpeon.glb', clipName: 'Archery_Shot_1', duration: 1.03, loop: false, tags: ['bow', 'archery', 'shot'], classes: ['Ranger'] },
  { id: 'combat.crouch_throw', name: 'Crouch Charge & Throw', category: 'combat_ranged', source: 'creatures/GoblinCr3w.glb', clipName: 'Crouch_Charge_and_Throw', duration: 4.53, loop: false, tags: ['throw', 'crouch', 'ranged'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // COMBAT — MAGIC
  // ═══════════════════════════════════════════════════════════════
  { id: 'combat.spell_1', name: 'Spell Cast 1', category: 'combat_magic', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Spell1', duration: 1.21, loop: false, tags: ['spell', 'cast', 'magic'], classes: ['Mage'] },
  { id: 'combat.spell_2', name: 'Spell Cast 2', category: 'combat_magic', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Spell2', duration: 1.46, loop: false, tags: ['spell', 'cast', 'magic'], classes: ['Mage'] },
  { id: 'combat.charged_spell', name: 'Charged Spell Cast', category: 'combat_magic', source: 'characters/graatorc.glb', clipName: 'Charged_Spell_Cast', duration: 3.2, loop: false, tags: ['spell', 'charged', 'channel'], classes: ['Mage'] },
  { id: 'combat.mage_cast_1', name: 'Mage Spell 1', category: 'combat_magic', source: 'characters/dwarf_enforcer.glb', clipName: 'mage_soell_cast_1', duration: 9.77, loop: false, tags: ['spell', 'long_cast'], classes: ['Mage'] },
  { id: 'combat.mage_cast_2', name: 'Mage Spell 2', category: 'combat_magic', source: 'characters/dwarf_enforcer.glb', clipName: 'mage_soell_cast_2', duration: 3.83, loop: false, tags: ['spell', 'medium_cast'], classes: ['Mage'] },
  { id: 'combat.mage_cast_4', name: 'Mage Spell 4', category: 'combat_magic', source: 'characters/dwarf_enforcer.glb', clipName: 'mage_soell_cast_4', duration: 2.4, loop: false, tags: ['spell', 'quick_cast'], classes: ['Mage'] },
  { id: 'combat.charged_spell_2', name: 'Charged Spell Cast 2', category: 'combat_magic', source: 'characters/orcpeon.glb', clipName: 'Charged_Spell_Cast_2', duration: 4.0, loop: false, tags: ['spell', 'charged', 'aoe'], classes: ['Mage'] },

  // ═══════════════════════════════════════════════════════════════
  // COMBAT — REACTIONS
  // ═══════════════════════════════════════════════════════════════
  { id: 'react.hit', name: 'Hit React', category: 'combat_reaction', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|RecieveHit', duration: 0.63, loop: false, tags: ['hit', 'flinch'], classes: [] },
  { id: 'react.hit_2', name: 'Hit React 2', category: 'combat_reaction', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|RecieveHit_2', duration: 0.63, loop: false, tags: ['hit', 'stagger'], classes: [] },
  { id: 'react.knockdown', name: 'Knock Down', category: 'combat_reaction', source: 'characters/berserker.glb', clipName: 'Knock_Down', duration: 2.8, loop: false, tags: ['knockdown', 'fall'], classes: [] },
  { id: 'react.slap', name: 'Slap Reaction', category: 'combat_reaction', source: 'characters/BarbarianGlad.glb', clipName: 'Slap_Reaction', duration: 0.63, loop: false, tags: ['slap', 'stun'], classes: [] },
  { id: 'react.face_punch', name: 'Face Punch Reaction', category: 'combat_reaction', source: 'characters/BarbarianGlad.glb', clipName: 'Face_Punch_Reaction', duration: 1.1, loop: false, tags: ['punch', 'face', 'stagger'], classes: [] },
  { id: 'react.waist_hit', name: 'Waist Hit Reaction', category: 'combat_reaction', source: 'characters/BarbarianGlad.glb', clipName: 'Hit_Reaction_to_Waist', duration: 2.83, loop: false, tags: ['hit', 'waist', 'bend'], classes: [] },
  { id: 'react.fly_up', name: 'Fly Up (Launched)', category: 'combat_reaction', source: 'characters/orcpeon.glb', clipName: 'BeHit_FlyUp', duration: 2.8, loop: false, tags: ['launch', 'fly', 'airborne'], classes: [] },
  { id: 'react.standup', name: 'Stand Up', category: 'combat_reaction', source: 'characters/berserker.glb', clipName: 'Stand_Up1', duration: 8.27, loop: false, tags: ['standup', 'recover'], classes: [] },
  { id: 'react.fall_dead', name: 'Fall Dead', category: 'combat_reaction', source: 'characters/berserker.glb', clipName: 'Fall_Dead_from_Abdominal_Injury', duration: 3.0, loop: false, tags: ['death', 'fall', 'abdominal'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // DODGE / BLOCK
  // ═══════════════════════════════════════════════════════════════
  { id: 'dodge.roll', name: 'Roll', category: 'dodge', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Roll', duration: 1.0, loop: false, tags: ['roll', 'dodge', 'evade'], classes: [] },
  { id: 'dodge.roll_woman', name: 'Roll (Alt)', category: 'dodge', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Roll', duration: 1.67, loop: false, tags: ['roll', 'dodge'], classes: [] },
  { id: 'dodge.roll_1', name: 'Roll Dodge 1', category: 'dodge', source: 'characters/berserker.glb', clipName: 'Roll_Dodge_2', duration: 3.2, loop: false, tags: ['roll', 'dodge', 'heavy'], classes: [] },
  { id: 'dodge.parkour_vault', name: 'Parkour Vault & Roll', category: 'dodge', source: 'characters/ElfRanger.glb', clipName: 'Parkour_Vault_with_Roll', duration: 0.57, loop: false, tags: ['vault', 'parkour', 'dodge'], classes: ['Ranger'] },
  { id: 'dodge.sliding_roll', name: 'Sliding Roll', category: 'dodge', source: 'characters/ElfRanger.glb', clipName: 'sliding_rool', duration: 4.07, loop: false, tags: ['slide', 'roll'], classes: [] },
  { id: 'dodge.counter', name: 'Dodge & Counter', category: 'dodge', source: 'characters/undeadworker.glb', clipName: 'Dodge_and_Counter', duration: 2.5, loop: false, tags: ['dodge', 'counter', 'parry'], classes: [] },
  { id: 'block.1', name: 'Block 1', category: 'block', source: 'characters/BarbarianGlad.glb', clipName: 'Block1', duration: 2.5, loop: false, tags: ['block', 'shield'], classes: ['Warrior'] },
  { id: 'block.2', name: 'Block 2', category: 'block', source: 'characters/BarbarianGlad.glb', clipName: 'Block2', duration: 3.5, loop: false, tags: ['block'], classes: ['Warrior'] },
  { id: 'block.3', name: 'Block 3', category: 'block', source: 'characters/BarbarianGlad.glb', clipName: 'Block3', duration: 1.6, loop: false, tags: ['block', 'quick'], classes: ['Warrior'] },
  { id: 'block.4', name: 'Block 4', category: 'block', source: 'characters/orcpeon.glb', clipName: 'Block4', duration: 1.53, loop: false, tags: ['block'], classes: [] },
  { id: 'block.shield_push', name: 'Shield Push', category: 'block', source: 'characters/dwarf_enforcer.glb', clipName: 'Shield_Push_Left', duration: 1.27, loop: false, tags: ['shield', 'push', 'bash'], classes: ['Warrior'] },
  { id: 'block.sword_parry_back', name: 'Sword Parry Backward', category: 'block', source: 'characters/humandeathgiver.glb', clipName: 'Sword_Parry_Backward_2', duration: 5.9, loop: false, tags: ['parry', 'sword', 'backstep'], classes: ['Warrior', 'Ranger'] },
  { id: 'block.two_handed_parry', name: 'Two Handed Parry', category: 'block', source: 'characters/graatorc.glb', clipName: 'Two_Handed_Parry', duration: 2.47, loop: false, tags: ['parry', 'two_hand'], classes: ['Warrior'] },

  // ═══════════════════════════════════════════════════════════════
  // DEATH
  // ═══════════════════════════════════════════════════════════════
  { id: 'death.basic', name: 'Death', category: 'death', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Death', duration: 3.5, loop: false, tags: ['death', 'default'], classes: [] },
  { id: 'death.wizard', name: 'Death (Wizard)', category: 'death', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|Death', duration: 1.17, loop: false, tags: ['death', 'mage'], classes: ['Mage'] },
  { id: 'death.shot_fall', name: 'Shot & Fall Backward', category: 'death', source: 'characters/BarbarianGlad.glb', clipName: 'Shot_and_Fall_Backward', duration: 2.5, loop: false, tags: ['death', 'shot', 'fall'], classes: [] },
  { id: 'death.falling', name: 'Falling Down', category: 'death', source: 'characters/siegeman.glb', clipName: 'falling_down', duration: 3.27, loop: false, tags: ['death', 'fall'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // SOCIAL / EMOTES
  // ═══════════════════════════════════════════════════════════════
  { id: 'social.wave', name: 'Wave', category: 'social', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Wave', duration: 2.08, loop: false, tags: ['wave', 'greet', 'emote'], classes: [] },
  { id: 'social.interact', name: 'Interact', category: 'social', source: 'characters/Animated_Woman.glb', clipName: 'CharacterArmature|Interact', duration: 1.58, loop: false, tags: ['interact', 'pickup', 'npc'], classes: [] },
  { id: 'social.agree', name: 'Agree Gesture', category: 'social', source: 'characters/fabledworker.glb', clipName: 'Agree_Gesture', duration: 1.83, loop: false, tags: ['agree', 'nod', 'yes'], classes: [] },
  { id: 'social.taunt', name: 'Chest Pound Taunt', category: 'social', source: 'characters/dwarf_enforcer.glb', clipName: 'Chest_Pound_Taunt', duration: 4.83, loop: false, tags: ['taunt', 'chest', 'emote'], classes: [] },
  { id: 'social.scream', name: 'Battle Cry', category: 'social', source: 'characters/dwarf_enforcer.glb', clipName: 'Zombie_Scream', duration: 2.23, loop: false, tags: ['scream', 'cry', 'battlecry'], classes: [] },
  { id: 'social.shout', name: 'Sword Shout', category: 'social', source: 'characters/humandeathgiver.glb', clipName: 'Sword_Shout', duration: 0.63, loop: false, tags: ['shout', 'sword', 'taunt'], classes: [] },
  { id: 'social.not_your_mom', name: 'Dismissive Gesture', category: 'social', source: 'characters/ElfRanger.glb', clipName: 'Not_Your_Mom', duration: 2.8, loop: false, tags: ['dismiss', 'rude', 'emote'], classes: [] },
  { id: 'social.yes', name: 'Yes (Nod)', category: 'social', source: 'characters/Anne.glb', clipName: 'CharacterArmature|CharacterArmature|CharacterArmature|Yes|CharacterArmature|Yes', duration: 1.67, loop: false, tags: ['yes', 'nod', 'agree'], classes: [] },
  { id: 'social.no', name: 'No (Head Shake)', category: 'social', source: 'characters/Anne.glb', clipName: 'CharacterArmature|CharacterArmature|CharacterArmature|No|CharacterArmature|No', duration: 1.67, loop: false, tags: ['no', 'shake', 'disagree'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // HARVESTING / WORK
  // ═══════════════════════════════════════════════════════════════
  { id: 'harvest.working', name: 'Working', category: 'harvesting', source: 'characters/Animated_Human.glb', clipName: 'Human Armature|Working', duration: 6.42, loop: true, tags: ['work', 'harvest', 'mining', 'chopping'], classes: [] },
  { id: 'harvest.pickup', name: 'Pick Up', category: 'harvesting', source: 'characters/Animated_Wizard.glb', clipName: 'CharacterArmature|PickUp', duration: 1.25, loop: false, tags: ['pickup', 'gather', 'loot'], classes: [] },
  { id: 'harvest.push_up', name: 'Push Up (Exercise)', category: 'harvesting', source: 'characters/dwarf_enforcer.glb', clipName: 'push_up', duration: 1.53, loop: true, tags: ['pushup', 'exercise', 'idle'], classes: [] },
  { id: 'harvest.jump_rope', name: 'Jump Rope', category: 'harvesting', source: 'characters/BarbarianGlad.glb', clipName: 'Jump_Rope', duration: 2.23, loop: true, tags: ['exercise', 'jump_rope', 'idle'], classes: [] },
  { id: 'harvest.jumping_jacks', name: 'Jumping Jacks', category: 'harvesting', source: 'characters/BarbarianGlad.glb', clipName: 'jumping_jacks', duration: 3.97, loop: true, tags: ['exercise', 'jacks', 'idle'], classes: [] },
  { id: 'harvest.catching_breath', name: 'Catching Breath', category: 'harvesting', source: 'characters/berserker.glb', clipName: 'Catching_Breath', duration: 5.33, loop: true, tags: ['rest', 'breathe', 'tired'], classes: [] },
  { id: 'harvest.burpee', name: 'Burpee Exercise', category: 'harvesting', source: 'characters/berserker.glb', clipName: 'Burpee_Exercise', duration: 2.33, loop: true, tags: ['exercise', 'burpee'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // SWIMMING
  // ═══════════════════════════════════════════════════════════════
  { id: 'swim.forward', name: 'Swim Forward', category: 'swimming', source: 'characters/undeadworker.glb', clipName: 'Swim_Forward', duration: 3.97, loop: true, tags: ['swim', 'forward'], classes: [] },
  { id: 'swim.idle', name: 'Swim Idle', category: 'swimming', source: 'creatures/GoblinCr3w.glb', clipName: 'Swim_Idle', duration: 2.27, loop: true, tags: ['swim', 'idle', 'tread'], classes: [] },
  { id: 'swim.to_edge', name: 'Swim to Edge', category: 'swimming', source: 'characters/undeadworker.glb', clipName: 'swimming_to_edge', duration: 3.5, loop: false, tags: ['swim', 'edge', 'exit'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // NPC IDLE BEHAVIORS
  // ═══════════════════════════════════════════════════════════════
  { id: 'npc.alert', name: 'Alert', category: 'npc_idle', source: 'characters/fabledworker.glb', clipName: 'Alert', duration: 1.3, loop: false, tags: ['alert', 'guard', 'npc'], classes: [] },
  { id: 'npc.arise', name: 'Arise', category: 'npc_idle', source: 'characters/fabledworker.glb', clipName: 'Arise', duration: 0.63, loop: false, tags: ['arise', 'wakeup', 'npc'], classes: [] },
  { id: 'npc.guard_turn', name: 'Alert Turn', category: 'npc_idle', source: 'characters/berserker.glb', clipName: 'Alert_Quick_Turn_Right', duration: 1.63, loop: false, tags: ['turn', 'alert', 'guard'], classes: [] },
  { id: 'npc.combat_turn', name: 'Combat Idle Turn', category: 'npc_idle', source: 'characters/graatorc.glb', clipName: 'Combat_Idle_Turn_Left', duration: 1.03, loop: false, tags: ['turn', 'combat', 'idle'], classes: [] },
  { id: 'npc.zombie_idle', name: 'Zombie Idle', category: 'npc_idle', source: 'characters/Animated_Zombie.glb', clipName: 'Zombie|ZombieIdle', duration: 5.54, loop: true, tags: ['zombie', 'idle', 'undead'], classes: [] },
  { id: 'npc.zombie_walk', name: 'Zombie Walk', category: 'npc_idle', source: 'characters/Animated_Zombie.glb', clipName: 'Zombie|ZombieWalk', duration: 4.0, loop: true, tags: ['zombie', 'walk', 'undead'], classes: [] },
  { id: 'npc.zombie_crawl', name: 'Zombie Crawl', category: 'npc_idle', source: 'characters/Animated_Zombie.glb', clipName: 'Zombie|ZombieCrawl', duration: 5.13, loop: true, tags: ['zombie', 'crawl'], classes: [] },
  { id: 'npc.zombie_bite', name: 'Zombie Bite', category: 'npc_idle', source: 'characters/Animated_Zombie.glb', clipName: 'Zombie|ZombieBite', duration: 5.04, loop: false, tags: ['zombie', 'bite', 'attack'], classes: [] },

  // ═══════════════════════════════════════════════════════════════
  // CREATURE ANIMATIONS
  // ═══════════════════════════════════════════════════════════════
  { id: 'creature.wolf_idle', name: 'Wolf Idle', category: 'npc_idle', source: 'creatures/Wolf.glb', clipName: 'Idle', duration: 3.33, loop: true, tags: ['wolf', 'idle'], classes: [] },
  { id: 'creature.wolf_walk', name: 'Wolf Walk', category: 'npc_idle', source: 'creatures/Wolf.glb', clipName: 'Walk', duration: 1.04, loop: true, tags: ['wolf', 'walk'], classes: [] },
  { id: 'creature.wolf_attack', name: 'Wolf Attack', category: 'npc_idle', source: 'creatures/Wolf.glb', clipName: 'Attack', duration: 1.33, loop: false, tags: ['wolf', 'attack', 'bite'], classes: [] },
  { id: 'creature.wolf_eat', name: 'Wolf Eating', category: 'npc_idle', source: 'creatures/Wolf.glb', clipName: 'Eating', duration: 2.5, loop: true, tags: ['wolf', 'eat'], classes: [] },
  { id: 'creature.wolf_gallop', name: 'Wolf Gallop', category: 'npc_idle', source: 'creatures/Wolf.glb', clipName: 'Gallop', duration: 0.54, loop: true, tags: ['wolf', 'run', 'gallop'], classes: [] },
  { id: 'creature.raptor_idle', name: 'Raptor Idle', category: 'npc_idle', source: 'creatures/Velociraptor.glb', clipName: 'Armature|Velociraptor_Idle', duration: 2.5, loop: true, tags: ['raptor', 'idle'], classes: [] },
  { id: 'creature.raptor_attack', name: 'Raptor Attack', category: 'npc_idle', source: 'creatures/Velociraptor.glb', clipName: 'Armature|Velociraptor_Attack', duration: 0.83, loop: false, tags: ['raptor', 'attack'], classes: [] },
  { id: 'creature.raptor_run', name: 'Raptor Run', category: 'npc_idle', source: 'creatures/Velociraptor.glb', clipName: 'Armature|Velociraptor_Run', duration: 0.54, loop: true, tags: ['raptor', 'run'], classes: [] },
  { id: 'creature.dragon_fly', name: 'Dragon Flying', category: 'npc_idle', source: 'environment/Dragon.glb', clipName: 'DragonArmature|Dragon_Flying', duration: 1.67, loop: true, tags: ['dragon', 'fly'], classes: [] },
  { id: 'creature.dragon_attack', name: 'Dragon Attack', category: 'npc_idle', source: 'environment/Dragon.glb', clipName: 'DragonArmature|Dragon_Attack', duration: 0.88, loop: false, tags: ['dragon', 'attack', 'breath'], classes: [] },
  { id: 'creature.shark_swim', name: 'Shark Swim', category: 'swimming', source: 'creatures/Shark.glb', clipName: 'SharkArmature|SharkArmature|SharkArmature|Swim|SharkArmature|Swim', duration: 1.33, loop: true, tags: ['shark', 'swim'], classes: [] },
  { id: 'creature.slime_idle', name: 'Slime Idle', category: 'npc_idle', source: 'environment/SlimeEnemy.glb', clipName: 'MonsterArmature|Idle', duration: 2.5, loop: true, tags: ['slime', 'idle'], classes: [] },
  { id: 'creature.slime_dance', name: 'Slime Dance', category: 'npc_idle', source: 'environment/SlimeEnemy.glb', clipName: 'MonsterArmature|Dance', duration: 0.83, loop: true, tags: ['slime', 'dance'], classes: [] },
];

// ── Lookup helpers ─────────────────────────────────────────────

const _byId = new Map<string, AnimEntry>();
const _byCategory = new Map<AnimCategory, AnimEntry[]>();
const _byTag = new Map<string, AnimEntry[]>();

function buildIndex() {
  if (_byId.size > 0) return;
  for (const entry of ANIM_LIBRARY) {
    _byId.set(entry.id, entry);

    if (!_byCategory.has(entry.category)) _byCategory.set(entry.category, []);
    _byCategory.get(entry.category)!.push(entry);

    for (const tag of entry.tags) {
      if (!_byTag.has(tag)) _byTag.set(tag, []);
      _byTag.get(tag)!.push(entry);
    }
  }
}

export function getAnim(id: string): AnimEntry | undefined {
  buildIndex();
  return _byId.get(id);
}

export function getAnimsByCategory(category: AnimCategory): AnimEntry[] {
  buildIndex();
  return _byCategory.get(category) || [];
}

export function getAnimsByTag(tag: string): AnimEntry[] {
  buildIndex();
  return _byTag.get(tag) || [];
}

export function getAnimsForClass(heroClass: string): AnimEntry[] {
  buildIndex();
  return ANIM_LIBRARY.filter(a => a.classes.length === 0 || a.classes.includes(heroClass));
}

export function searchAnims(query: string): AnimEntry[] {
  buildIndex();
  const q = query.toLowerCase();
  return ANIM_LIBRARY.filter(a =>
    a.id.includes(q) || a.name.toLowerCase().includes(q) ||
    a.tags.some(t => t.includes(q))
  );
}

/**
 * CC0 universal fallback set — guaranteed to work on any humanoid skeleton.
 * These are animation-only FBX files from the CC0 Essential Animation pack.
 */
export const CC0_FALLBACK_SET: Record<string, string> = {
  idle: 'cc0.idle',
  run: 'cc0.run',
  attack: 'cc0.attack',
  hit: 'cc0.hit',
  death: 'cc0.death',
};

/** Get a default animation set for a class (idle, walk, run, attack, death, etc) */
export function getDefaultAnimSet(heroClass: string): Record<string, string> {
  const isMage = heroClass === 'Mage';
  const isRanger = heroClass === 'Ranger';
  const isWorg = heroClass === 'Worg';

  return {
    // CC0 universal fallbacks (always available, any skeleton)
    ...CC0_FALLBACK_SET,
    // Class-specific overrides (loaded on top of CC0 base)
    idle: isMage ? 'idle.wizard' : 'idle.basic',
    walk: isMage ? 'move.walk_wizard' : 'move.walk',
    run: isRanger ? 'move.run_fast' : 'move.run',
    run_back: 'move.run_back',
    sprint: 'move.sprint',
    jump: 'move.jump',
    attack: isMage ? 'combat.staff_attack' : isRanger ? 'combat.dagger_1' : 'combat.sword_slash',
    attack_2: isMage ? 'combat.spell_1' : isRanger ? 'combat.dagger_2' : 'combat.charged_slash',
    combo: isMage ? 'combat.spell_2' : 'combat.punch_combo_1',
    ranged: isRanger ? 'combat.archery_shot' : isMage ? 'combat.spell_1' : 'combat.crouch_throw',
    spell: isMage ? 'combat.charged_spell' : 'combat.mage_cast_2',
    block: 'block.1',
    parry: 'block.two_handed_parry',
    dodge: 'dodge.roll',
    hit: 'react.hit',
    knockdown: 'react.knockdown',
    death: 'death.basic',
    harvest: 'harvest.working',
    pickup: 'harvest.pickup',
    swim: 'swim.forward',
    swim_idle: 'swim.idle',
    wave: 'social.wave',
    interact: 'social.interact',
    taunt: 'social.taunt',
  };
}

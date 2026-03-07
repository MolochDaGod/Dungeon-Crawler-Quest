# GRUDGE Warlords

## Overview

GRUDGE Warlords is a browser-based dark fantasy game featuring both a 5v5 MOBA and a Dungeon Crawler mode. It aims to provide a deep, engaging experience with 26 unique heroes across multiple races and classes, sophisticated AI, and detailed combat mechanics. The game utilizes a dual 2D/3D renderer, comprehensive spell and status effect systems, and procedural content generation, pushing the boundaries of browser-based gaming. The vision is to deliver a competitive and exploratory fantasy experience in a browser environment.

## User Preferences

I prefer iterative development, with clear communication before major changes. I value detailed explanations for complex implementations but keep responses concise where possible. I like functional programming paradigms where they fit naturally.

## System Architecture

The game's architecture centers on a React frontend with a custom HTML5 Canvas 2D and Three.js 3D dual renderer for its core engine. The UI uses Tailwind CSS with Shadcn UI components, enforcing a dark mode with a dark fantasy theme (crimson, gold, purple accents). Wouter manages frontend routing, and the backend is an Express server with REST API endpoints for game data and results.

**Core Game Engine:**
- **Rendering:** Custom HTML5 Canvas 2D and Three.js 3D renderers support voxel art for characters and environments.
- **Game Modes:** Dedicated engines for MOBA (5v5 combat, AI, lane mechanics) and Dungeon Crawler (procedural generation, enemy AI, boss fights).
- **Combat System:** Features 19 status effects (DoT, CC, buffs), critical hits, armor penetration, lifesteal, and a Dota 2-paced attack system.
- **AI System:** Advanced DOTA2-style AI with game phase awareness (laning/midgame/lategame), last-hitting, lane equilibrium, gank rotations, focus-fire coordination, orb-walking for ranged heroes, and class-specific ability leveling priorities.
- **Animation System:** Loads external FBX animation clips with cross-fading and state mapping for 3D models.
- **Voxel Art System:** Procedural isometric voxel rendering for heroes, minions, terrain, and structures with multi-part body posing and class-specific animations. Detailed minion models: melee (sword+shield, leather armor, metal shoulders), ranged (bow, leather bracers, taller build), siege (7x10 armored war machine with battering ram), super/monster (gold-crowned variant with glowing accents).
- **Voxel Motion Library (`voxel-motion.ts`):** Combat motion primitives (swing_horizontal, swing_vertical_chop, thrust_linear, slam_overhead, cast_channel, transform_grow, claw_swipe, bow_draw_release, staff_cast) with keyframe interpolation, easing functions, pose composition/blending (`sampleMotion`, `composePoses`, `additivePoses`), and per-class/weapon motion profiles (`getClassMotionProfile`). Motion library is additively blended into ability, combo_finisher, and lunge_slash animations.
- **Enhanced VFX Engine:** 7 VFX draw functions integrated into `drawHeroVoxel`: casting circles (rotating rune circles), weapon trails (bezier curves with gradient), aura effects (pulsing buff glow), transform VFX (bear morph burst), summon VFX (portal/spawn), healing VFX (green spiral particles), shield VFX (bubble overlay). Weapon trail tracking per entity via `WeaponTrailSystem`.
- **Bear Transformation Model:** Enhanced `buildBearModel` with 12x12x14 voxel quadruped: muscular body, proper paws with claws/paw pads, fangs, glowing eyes, textured multi-tone fur, rearing attack animation, weight-shifting quadruped gait, and shoulder hump detail.
- **Ability Icons:** 24 generated ability icons (dark fantasy RPG style) in `public/assets/abilities/` mapped via `ABILITY_ICONS` in types.ts. All 6 class kits covered (Warrior, Orc_Warrior, Elf_Warrior, Worg, Mage, Ranger).
- **RPG UI Overlay:** In-game HUD with ability hotbar (with level indicators, level-up buttons, and ability icons), item slots, buff/debuff display, KDA, scoreboard, custom cursor, and toggleable animation debug overlay (animState, timer, facing, position, active buffs).
- **Spell VFX System:** Comprehensive system with 16 visual effect types, multi-layered impact VFX, projectiles with trails, screen shake, and charge systems.
- **Keybinding System:** Fully rebindable actions persisted in localStorage. Q=attack, E=core skill, Space=defensive, R=ultimate. Ctrl+Q/E/Space/R to level abilities.
- **Fog of War (MOBA):** Full fog of war on both main 2D canvas and minimap. Vision sources: heroes (600px), towers (500px), minions (300px). Explored-but-not-visible areas shown dimly. Enemy entities hidden outside vision.
- **Dungeon Line of Sight:** Recursive shadowcasting algorithm (8-octant) computes true LOS from player position. Walls block vision — no seeing through walls or around corners. 7-tile vision radius with distance falloff. Revealed-but-not-visible tiles shown at 0.15 opacity. Enemies, chests, projectiles, particles all hidden outside LOS. Cached per player tile position for performance.
- **Ability Leveling System:** Heroes gain ability points on level up. Each ability (Q/W/E/R) can be leveled up to 4 times (R up to 3 times at levels 6/11/16). Ability damage scales +25% per level.

**Features:**
- **Heroes:** 26 unique heroes across 6 races and 4 classes, each with 4 weapon-based abilities from the GRUDGE ObjectStore sprite database. Weapon types: swords, greataxes, spears, hammers, axes1h, greatswords, daggers, scythes, bows, crossbows, guns, fireStaves, frostStaves, arcaneStaves, natureStaves, lightningStaves. Each hero mapped to a unique weapon with slot1 (Q/attack), slot2 (E/core skill), slot3 (Space/defensive), slot4 (R/ultimate).
- **MOBA Mode:** 4000x4000 map, 3 lanes, towers, Nexus objective, minion waves, jungle camps, hero leveling (1-18), item shop, gold economy, and KDA scoring.
- **Dungeon Crawler Mode:** 10 procedural floors, various enemy types, boss fights, traps, chests, inventory system, and enemy AI heroes of opposing factions (spawn floor 2+, 1-3 per floor, with patrol/chase/attack/retreat AI and weapon-skill casting).
- **Targeting System:** `MouseTargetingManager` handles AOE ground targeting with visual indicators in MOBA. Dungeon mode has full targeting indicators: ground AOE circles, skillshot lines, cone arcs, with spell effects (cast circles, impact rings, AOE blasts, cone sweeps, dash trails).
- **Settings UI:** `/settings` page with hotkey rebinding, audio settings (master/SFX/music volume sliders), display toggles (show damage numbers, show debug overlay). Settings gear icon in dungeon HUD. All settings persisted to localStorage.
- **Sprite Effect System:** Loads and manages 20 pixel art effect spritesheets for various combat triggers.
- **Dungeon Visibility:** Fog of War with `VISION_RADIUS` and distance-based dimming for tiles and enemies.
- **Animation Editor:** Developer tool for previewing voxel hero animations, accessed via `/animation-editor`.
- **Entity Editor:** Comprehensive `/editor` page with 6 tabs — Heroes (race/class selector, animation states with playback controls, ability viewer, stat display, export, **animation timeline editor**), Minions (4 types: melee/ranged/siege/super, team color picker with presets, stats), Monsters (small/medium/buff jungle mobs with stats and behavior info), Structures (towers with 3 tiers and nexus, team colors), Effects (20 sprite effects organized by category with live preview, scale/duration controls), Environment (trees with 6 seed variations, rocks with 4 seeds). All tabs feature live voxel canvas preview, collapsible sidebar, and JSON export. Accessible from home page.
- **Animation Timeline Editor:** Built into the Heroes tab of the Entity Editor. Features: toggle on/off custom animation mode, set animation name/duration, start/end time range clamping, loop toggle, visual timeline bar with clickable keyframe markers, add/remove keyframes at optimal gap positions, per-keyframe time/easing selection (linear/easeIn/easeOut/easeInOut/overshoot/bounce), weapon glow control, per-body-part pose editing (ox/oy/oz/rotation/scale sliders for leftLeg/rightLeg/leftArm/rightArm/torso/head/weapon with color-coded expand panels), live preview via `sampleMotion()` and `drawHeroVoxelCustomPose()`, and MotionPrimitive JSON export (clipboard copy + file download). Weapon glow is isolated to weapon voxels only.
- **Gizmo System:** Full Move/Rotate/Scale gizmo overlay on the entity editor canvas. Click body parts to select, drag to transform. Move mode adjusts ox/oz (shift+drag for oy depth). Rotate mode adjusts rotation angle (degrees, snapped to 5°). Scale mode adjusts uniform scale factor (0.2x to 3x). Visual indicators: move arrows (red X, green Z), rotate circle with angle indicator, scale box with corner handle. Keyboard shortcuts: M=move, R=rotate, S=scale, G=toggle gizmo, C=capture snapshot.
- **Pose Snapshot System:** Capture current character pose as a snapshot (with all body part transforms and weapon glow). Snapshots appear as cards at the bottom of the canvas. Click to jump to snapshot time, remove individually, or clear all. With 2+ snapshots: "Apply" converts directly to timeline keyframes, "AI Smooth" generates interpolated intermediate keyframes using easeInOut curves for fluid animation. `generateSmoothedAnimation()` in voxel-motion.ts handles the interpolation.
- **BodyPartPose Extensions:** Each body part now supports `rotation` (degrees, XZ plane rotation around part center) and `scale` (uniform scale around part center). These are interpolated during animation (`lerpPart`), composed (`composePoses`), and additively blended (`additivePoses`). `buildHeroModelWithPoses` in voxel.ts uses `xformV` helper to apply rotation and scale transforms to voxel positions before placement. All offsets are clamped to ±8 via `clampOffset()`, scales clamped 0.2-3.
- **Animation Brush System:** 6 color-coded magic brushes in the editor — Pose (red, static offset), Wave (blue, sinusoidal oscillation), Pulse (green, scale heartbeat), Spin (purple, rotation sweep), Bounce (amber, vertical hop), Tremble (cyan, micro-shake). Each brush: select target body parts via toggleable part buttons, adjust intensity (0.1x-3x), click Paint to generate keyframes automatically. Brushes replace timeline keyframes with procedurally generated animation curves for the selected parts.
- **Anatomical Animation System:** Combo finishers rewritten with controlled 4-phase motion (wind-up → strike → follow-through → recover) using torso rotation for power transfer. Arms stay within anatomically plausible ranges relative to shoulder sockets. Dodge animations have 3 variants: backflip (360° torso rotation with arc trajectory), clockwise quick-spin (360° with crouch), counterclockwise spin. All variants implemented in both 2D voxel renderer and 3D Three.js renderer. Motion library primitives rebalanced with reduced offsets (max ±6) and torso rotation-driven power expression.
- **Death Shatter Animation:** On death, the voxel character model explodes into individual voxel blocks that fly apart with physics simulation — each block gets random outward velocity based on its position in the model, falls under gravity (18 units/s²), collides with the ground floor, and fades out. `DeathDebris` system in VoxelRenderer caches per-entity particle state with automatic cleanup after 2.5s duration. Voxels are pre-sorted by z-depth at init time for correct render order without per-frame sorting.
- **Block Guard Stance:** Blocking animation positions weapon horizontally (rotation: -90°) in front of the character at chest height, with arms extended forward in a defensive cross-guard. Legs widen for stability, torso leans slightly back, and a subtle breathing animation pulses the weapon position. Weapon glows at 40% intensity during block. 3D renderer mirrors this with weapon rotated forward, arms angled to protect, torso braced.
- **Admin Editor Suite:** Comprehensive `/admin` page with 6 tabs — Characters (race/class/stats), Animations (10 states, playback controls, pose inspector), Effects (ability editor, sprite effect mapping/preview), Weapons (type/color/glow/items), AI Config (all tunable parameters), AI Generator (8 presets, randomizer, save/compare/apply profiles). Live voxel preview canvas with SpriteEffectSystem overlay.
- **REST API:** Endpoints for heroes (`GET /api/heroes`, `/api/heroes/:id`), abilities (`GET /api/abilities/:class`), items (`GET /api/items`), and game results (`POST/GET /api/game/results`).
- **Gameplay Systems:** Passive gold (1/s), last-hit bonus (+15g), kill streak bounties, first blood (+200g), tower bounties (200g split), mana regen, minion scaling, tower aggro protection, and dynamic respawn timers.

**Design Choices:**
- **UI/UX:** Forced dark mode with a dark fantasy theme using crimson, gold, and purple accents.
- **Rendering:** Both 2D and 3D renderers utilize voxel art. 3D renderer includes a 5-light rig, gradient skybox, height-varied terrain, animated water, GPU instanced particles, capsule heroes with PBR materials, and comprehensive spell VFX.
- **Combat Visuals:** Detailed voxel combat animations with triple-layered effects, shockwaves, and class-specific trails.
- **Map Tiles:** Enhanced 2D tiles with procedural grass tufts/flowers, worn stone lane paths with cracks, jungle moss/spore particles, river lilypads/sparkles/foam, and faction-colored base rune circles with ambient glow.

## External Dependencies

- **Frontend Framework:** React
- **UI Components:** Shadcn UI
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **3D Rendering:** Three.js
- **Model Loading:** GLTFLoader/FBXLoader (from Three.js)
- **Animation:** GSAP
- **Physics:** cannon-es
- **State Machines:** XState
- **Backend:** Express.js with REST API

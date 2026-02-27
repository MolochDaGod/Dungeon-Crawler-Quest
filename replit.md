# GRUDGE Warlords

## Overview

GRUDGE Warlords is a browser-based dark fantasy game offering two distinct modes: a 5v5 MOBA and a Dungeon Crawler. The project aims to deliver a rich, engaging experience with 26 unique heroes across diverse races and classes, sophisticated AI, and detailed combat mechanics. The game features a dual 2D/3D renderer, comprehensive spell and status effect systems, and procedural content generation, pushing the boundaries of browser-based gaming.

## User Preferences

I prefer iterative development, with clear communication before major changes. I value detailed explanations for complex implementations but keep responses concise where possible. I like functional programming paradigms where they fit naturally.

## System Architecture

The game utilizes a React frontend with a custom HTML5 Canvas 2D and Three.js 3D dual renderer for its core game engine. Tailwind CSS with Shadcn UI components is used for the user interface, maintaining a forced dark mode and a dark fantasy theme with crimson, gold, and purple accents. Wouter handles frontend routing. The backend is a minimal Express server serving static files, as game state is client-side.

**Core Game Engine:**
- **Rendering:** Custom HTML5 Canvas 2D and Three.js 3D renderers support voxel art for characters and environments.
- **Game Modes:** Dedicated engines for MOBA (`engine.ts`) with 5v5 combat, AI, and lane mechanics, and Dungeon Crawler (`dungeon.ts`) with procedural generation, enemy AI, and boss fights.
- **Combat System:** Features 19 status effects (DoT, CC, buffs), critical hits, armor penetration, and lifesteal. Includes a Dota 2-paced attack system with wind-up, damage point, and backswing.
- **Keybinding System:** Fully rebindable actions for both game modes, persisted in localStorage.
- **AI System:** Advanced AI for MOBA opponents and allies, featuring threat evaluation, smart retreat logic, class-aware ability targeting, last-hitting, and contextual chat callouts.
- **Animation System:** Loads external FBX animation clips (Idle, Run, Attack, Death, Hit) with cross-fading and state mapping for 3D models.
- **Voxel Art System:** Procedural isometric voxel rendering for heroes, minions, terrain, and structures, with multi-part body posing, class-specific attack animations, and unique racial features. Uses a tile cache for performance.
- **RPG UI Overlay:** In-game HUD with ability hotbar, item slots, buff/debuff display, KDA, scoreboard, and custom cursor.
- **Spell VFX System:** Comprehensive system with 16 visual effect types, multi-layered impact VFX, spell projectiles with trails, screen shake on powerful abilities, and charge systems for certain spells.

**Features:**
- **Heroes:** 26 unique heroes across 6 races (Human, Barbarian, Dwarf, Elf, Orc, Undead) and 4 classes (Warrior, Worg, Mage, Ranger), with unique stats and 4 abilities each.
- **MOBA Mode:** 4000x4000 map, 3 lanes, towers, Nexus objective, minion waves, jungle camps, hero leveling (1-18), item shop (12 items across 3 tiers), gold economy, and KDA scoring.
- **Dungeon Crawler Mode:** 10 procedural floors, various enemy types, boss fights every 5th floor, traps, chests, and an inventory system.

## Melee Attack System
- Melee heroes (Warrior/Worg) use `rng * 50` for pixel range (~75px), ranged get ~275-325px
- `performAutoAttack()` uses dynamic `meleeRange = hero.rng + 40` for melee hit check (not hardcoded)
- Melee attacks always deal instant damage even if slightly out of range (lunge fallback, no projectile)
- Melee VFX: slash_arc + impact_ring + 5 radial particles + screen shake on abilities
- Melee abilities (damage type) auto-lunge up to 80px toward target with dash_trail VFX
- Wind-up connection range: melee `rng + 60`, ranged `rng + 80`

## Custom Cursor System
- Canvas cursor: none (OS cursor hidden on 2D canvas)
- Custom-drawn cursors per mode: attack (red crosshair), ability (purple spinning arcs), attackmove (orange), move (green arrow), default (gold brackets)
- Grab hand cursor (`/assets/cursor-grab.png`) shown when hovering over selectable entities

## 3D Model Assets
- Neutral minion FBX models: `/assets/models/neutrals/neutral_minion_01-03.fbx` (from FreeContent pack)
- Registered in prefabs.ts as CREATURE_PREFABS (neutral_minion_01/02/03)

## External Dependencies

- **Frontend Framework:** React
- **UI Components:** Shadcn UI
- **Styling:** Tailwind CSS
- **Routing:** Wouter
- **3D Rendering:** Three.js
- **Model Loading:** GLTFLoader/FBXLoader (from Three.js)
- **Animation:** GSAP 3.12.5 (tweening/easing library)
- **Physics:** cannon-es (3D physics for knockback/launch effects)
- **State Machines:** XState (combat combo system)
- **Backend (minimal):** Express.js (for serving static files)

## Mouse Targeting & AOE System
- `MouseTargetingManager` class (mouse-targeting.ts): handles AOE ground targeting with circle indicator, max range ring, valid/invalid color pulsing
- AOE abilities: press ability key → shows targeting circle → left-click confirms → spawns AreaDamageZone
- Right-click or Escape cancels AOE targeting
- `PhysicsWorld` (physics.ts): cannon-es wrapper with hero/projectile bodies, knockback impulse, scale factor 0.01

## 3D Structure Assets (GLB)
- **Turrets**: `public/assets/models/turrets/` — Flamethrower_Turret, Gun_Cannon_Turret, Mortar_Tower, Rail_Gun_Turret, Tower3, Castle_Tower, Cannon
- **Structures**: `public/assets/models/structures/` — Crypt, Fantasy_Barracks, Forge, Storage_House, Hellhouse, Tree_House, Cabin_Shed, Coliseum, Necropolis_Walls, Arch
- **Environment**: `public/assets/models/environment/` — Gravestone, Tree_Lava, Camp_Fire (new GLB variants)
- All registered in `prefabs.ts` under TOWER_PREFABS and ENV_PREFABS
- Map landmarks placed in `generateDecorations()`: Coliseum at center, Barracks+Forge near blue base, Crypt+Necropolis near red base, Tree House and Hellhouse in jungle, Arches near bases, Camp fires and gravestones around jungle
- 2D renderer: custom `drawStructureDecoration()` renders animated campfires, detailed gravestones, lava trees, stone arches, and labeled buildings
- 3D renderer: loads GLB models for structures; falls back to colored primitive boxes when models unavailable

## 3D Renderer (three-renderer.ts)
- **Cannon-es physics**: World with gravity -9.82, ground plane body, fixed timestep 1/60
- **Lighting**: 5-light rig — ambient, hemisphere, directional sun (2048 shadow map, PCFSoftShadowMap), fill, rim
- **Skybox**: Gradient shader sphere (dark blue top to navy bottom)
- **Ground**: 128-segment terrain with height variation, vertex-colored (lanes, jungle, river, base tints)
- **Water**: Shader material with animated waves and specular highlights, positioned on diagonal river
- **Particle System**: GPU instanced Points (2000 max) with additive blending and per-particle color/size
- **Capsule Heroes**: Multi-part body (torso, head, eyes, legs, arms) with class-specific weapons (sword/claws/bow/staff)
- **Capsule Animations**: Walk cycle (leg swing, arm sway, body bob), attack (weapon swing), ability (arms raised, staff glow), dodge (spin), block (arms forward), idle (subtle breathing)
- **Spell Projectiles**: Core sphere + glow sphere + spinning ring + point light, with pulsing animation
- **Spell VFX 3D**: fire_ring, frost_ring, meteor_shadow/impact, arrow_rain (falling 3D arrows), whirlwind_slash (spinning arc), ground_scorch/frost (decals), combo_burst (radial rays), cast_circle, telegraph_circle
- **Area Damage Zones**: Colored circular areas with animated borders and point lights per damage type
- **Camera**: Smooth lerp follow + screen shake integration, sun light follows camera
- **Shadows**: PCFSoftShadowMap, circular shadow decals under entities, all meshes cast/receive shadows
- **Materials**: PBR with emissive glow on weapons/orbs/eyes, team-colored indicators, gold player ring

## Divine Rapier Weapon (voxel.ts)
- `buildRapierWeapon()` at line 378: pommel (#dc2626), handle (#6b4423, 2 voxels), cross-guard (#c5a059, 3 voxels), blade (#d4d4d4, 7 voxels)
- Applied when hero has Divine Rapier item (id=12) via `heroItems` check at line 578
- Overrides default class weapon; other weapons gated with `!hasRapier` checks

## HUD Minimap (game.tsx)
- Minimap component renders at 200×200 canvas in bottom-right area
- Shows all minimapEntities from HUD state: player (green), ally/enemy heroes, towers, nexuses, minions, jungle camps
- Camera viewport rectangle shown in white outline
- Uses minimap-bg.png asset as background

## Audio Settings (settings.tsx)
- Master Volume, SFX Volume, Music Volume sliders (range 0-100, step 5)
- Defaults: masterVolume=50, sfxVolume=100, musicVolume=60
- Synced to localStorage key `grudge_volume` for runtime access

## Voxel Combat Animation VFX (voxel.ts)
- **Warrior/Worg attack**: Sweeping slash arc (canvas-drawn) with glow + sparks at endpoint; extended sword model (pommel→guard→6-voxel blade z=6-12); shoulder twist + body lunge; follow-through trail arc
- **Ranger attack**: Bowstring draw animation (pull-back triangle), nocked arrow visible during draw phase, golden glow at full draw, green arrow streak on release with arrowhead; taller bow model (z=2-10 with limb tips)
- **Mage attack**: Radial glow orb at staff tip, orbiting runic circles during channel, spark particles, purple cast projectile burst on release; staff orb enlarged (3-voxel cross pattern + glow halo)
- **Ability VFX**: Warrior=red aura ring with energy spikes, Ranger=green rotating arc segments with sparkles, Mage=full rune circle with inner pentagram + glowing orb + orbiting glyphs
- **Dash attack VFX**: Class-colored motion streak with white core trail and rear sparks
- All VFX drawn as canvas overlays on top of voxel model (not part of voxel grid)

## Quality Notes
- All TypeScript compiles cleanly (no errors)
- AI heroes emit contextual chat messages based on situation (retreat, engage, laning, etc.)
- Weapon trails use class-specific tint colors: Warrior=#ef4444, Ranger=#22c55e, Mage=#8b5cf6, Worg=#f97316
- Combo finisher animation: phase speed 24, twist 2.0, trail count 3, trail alpha 0.35, trail overlay 32px
- River tiles have animated water overlay with ripple effects
- Area damage zones support fire/frost/poison/lightning/holy/shadow types with status effects
- Combat state machine: mouse events (LMB/RMB) and key-up events properly forwarded to combatActor
- blockActive properly resets when combat machine exits block state
- Spell projectile rings oriented flat (rotateX PI/2) in 3D renderer
- Spell VFX tracking uses key-based matching instead of position tolerance